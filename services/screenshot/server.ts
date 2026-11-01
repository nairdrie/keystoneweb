/**
 * Keystone screenshot service: captures agent-site drafts in a real browser
 * for the MCP `screenshot` tool. Run it anywhere Chromium can run (it cannot
 * run inside Vercel functions comfortably), then set on the app:
 *   KS_SCREENSHOT_URL=https://<this service>/capture
 *   KS_SCREENSHOT_TOKEN=<same value as SCREENSHOT_TOKEN here>
 *
 * POST /capture { url, viewports: ["desktop","mobile"], fullPage: true }
 *   → { shots: [{ viewport, png (base64), diagnostics }] }
 * Only URLs on ALLOWED_ORIGINS (default: the Keystone app) are captured.
 */
import http from 'node:http';
import { chromium } from 'playwright';
import { captureWithChromium, VIEWPORTS, type ViewportName } from '../../lib/v2/screenshot-core';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.SCREENSHOT_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://keystoneweb.ca,https://staging.keystoneweb.ca')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
let running = 0;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 2);

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/capture') return send(res, 404, { error: 'not found' });
  if (!TOKEN || req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
  if (running >= MAX_CONCURRENT) return send(res, 429, { error: 'busy' });

  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  let body: { url?: string; viewports?: string[]; fullPage?: boolean };
  try {
    body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return send(res, 400, { error: 'bad json' });
  }
  let target: URL;
  try {
    target = new URL(String(body.url));
  } catch {
    return send(res, 400, { error: 'bad url' });
  }
  if (!ALLOWED_ORIGINS.includes(target.origin)) return send(res, 403, { error: 'origin not allowed' });
  const viewports = (body.viewports || ['desktop', 'mobile']).filter((v): v is ViewportName => v in VIEWPORTS);

  running++;
  try {
    const shots = await captureWithChromium(chromium, target.toString(), viewports, body.fullPage !== false);
    send(res, 200, { shots: shots.map((s) => ({ viewport: s.viewport, png: s.png.toString('base64'), diagnostics: s.diagnostics })) });
  } catch (e) {
    send(res, 500, { error: (e as Error).message });
  } finally {
    running--;
  }
}).listen(PORT, () => console.log(`screenshot service on :${PORT}`));
