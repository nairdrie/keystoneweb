import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket from 'ws';

const DEFAULT_TEMPLATE_IDS = [
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
];

const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith('--base='));
const widthArg = args.find((arg) => arg.startsWith('--width='));
const heightArg = args.find((arg) => arg.startsWith('--height='));
const baseUrl = (baseArg?.slice('--base='.length) || process.env.PREVIEW_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');
const screenshotWidth = parseInt(widthArg?.slice('--width='.length) || process.env.PREVIEW_WIDTH || '1440', 10);
const screenshotHeight = parseInt(heightArg?.slice('--height='.length) || process.env.PREVIEW_HEIGHT || '810', 10);
const templateIds = args.filter((arg) => !arg.startsWith('--'));
const idsToGenerate = templateIds.length > 0 ? templateIds : DEFAULT_TEMPLATE_IDS;
const outputDir = path.resolve(process.cwd(), 'public/templates');
const edgePath = findEdgePath();

if (!edgePath) {
  console.error('Could not find Microsoft Edge. Set EDGE_PATH to the browser executable and run again.');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

for (const id of idsToGenerate) {
  const outputPath = path.join(outputDir, `${id}.png`);
  const userDataDir = mkdtempSync(path.join(tmpdir(), `keystone-template-${id}-`));
  const url = `${baseUrl}/template-preview/${encodeURIComponent(id)}`;

  try {
    await capturePreview(url, outputPath, userDataDir);
  } catch (error) {
    cleanupUserDataDir(userDataDir);
    console.error(`Failed to generate ${id}.png: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  cleanupUserDataDir(userDataDir);
  console.log(`Generated public/templates/${id}.png`);
}

async function capturePreview(url, outputPath, userDataDir) {
  const port = 9222 + Math.floor(Math.random() * 20000);
  const browser = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--disable-features=GlobalMediaControls,MediaRouter',
    `--window-size=${screenshotWidth},${screenshotHeight}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const target = await waitForTarget(port);
    const client = await createCdpClient(target.webSocketDebuggerUrl);

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: screenshotWidth,
      height: screenshotHeight,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const loaded = client.waitForEvent('Page.loadEventFired', 30000);
    await client.send('Page.navigate', { url });
    await loaded;

    await client.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `
        Promise.all([
          document.fonts?.ready || Promise.resolve(),
          ...Array.from(document.images).map((img) => img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              }))
        ]).then(() => true)
      `,
    });
    await sleep(1500);

    const pageCheck = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `document.body?.innerText?.includes('This page could not be found.') || false`,
    });

    if (pageCheck.result?.value) {
      throw new Error(`Preview route returned a 404 page for ${url}`);
    }

    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: screenshotWidth,
        height: screenshotHeight,
        scale: 1,
      },
    });

    writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
    client.close();
  } finally {
    browser.kill('SIGKILL');
    await sleep(1000);
  }
}

function cleanupUserDataDir(userDataDir) {
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

async function waitForTarget(port) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Edge is still starting.
    }
    await sleep(250);
  }

  throw new Error('Timed out waiting for Edge remote debugging target.');
}

async function createCdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;

  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
      return;
    }

    const callbacks = listeners.get(message.method);
    if (callbacks) {
      for (const callback of callbacks) callback(message.params || {});
    }
  });

  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    waitForEvent(method, timeoutMs) {
      return new Promise((resolve, reject) => {
        const callbacks = listeners.get(method) || new Set();
        let timeout;
        const callback = (params) => {
          clearTimeout(timeout);
          callbacks.delete(callback);
          resolve(params);
        };
        timeout = setTimeout(() => {
          callbacks.delete(callback);
          reject(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs);
        callbacks.add(callback);
        listeners.set(method, callbacks);
      });
    },
    close() {
      socket.close();
    },
  };
}

function findEdgePath() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Copilot\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) || null;
}
