/**
 * Browser end-to-end test for "Add custom connector" sign-in: the AI app finds
 * the sign-in metadata from the MCP endpoint, registers itself, sends the owner
 * through sign-in + the Allow page, exchanges the code (PKCE) and calls the
 * MCP server. Real Next.js dev server; Supabase emulated over HTTP.
 *
 *   npm run test:v2:e2e:oauth      (needs Chromium/Playwright; ~1–3 min)
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFakeSupabase } from './fixtures/fake-supabase-server';

const NEXT_PORT = 3101;
const SUPA_PORT = 54322;
const BASE = `http://localhost:${NEXT_PORT}`;
const OWNER = '11111111-1111-1111-1111-111111111111';
const CALLBACK_PORT = 3199;
// Loopback callback (as native apps such as Claude Code use), served locally so nothing leaves the machine.
const REDIRECT = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => (Date.now() - started > timeoutMs ? reject(new Error(`Timed out waiting for ${url}`)) : setTimeout(tick, 1500)));
    };
    tick();
  });
}

async function main() {
  const fake = await startFakeSupabase(SUPA_PORT);
  const { db } = fake;
  db.table('users').push({ id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false });
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });
  const auth = fake.addSession({ id: OWNER, email: 'owner@example.com' });

  fs.rmSync(path.resolve(__dirname, '../.next/dev'), { recursive: true, force: true });
  const next: ChildProcess = spawn('npx', ['next', 'dev', '-p', String(NEXT_PORT)], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      KS_V2_PREVIEW_SECRET: 'e2e-secret',
      NEXT_PUBLIC_APP_URL: BASE,
      RESEND_API_KEY: 're_dummy_key',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const nextLog: string[] = [];
  next.stdout?.on('data', (d) => nextLog.push(String(d)));
  next.stderr?.on('data', (d) => nextLog.push(String(d)));

  let passed = 0;
  const step = async (label: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  };

  const callback = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); });
  await new Promise<void>((r) => callback.listen(CALLBACK_PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try {
    await waitForHttp(`${BASE}/api/v2/engine`, 240_000);
    console.log('MCP sign-in e2e (next dev up)');

    let resourceMetadataUrl = '';
    await step('unauthenticated MCP request points to the sign-in metadata', async () => {
      const res = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
      assert.equal(res.status, 401);
      const header = res.headers.get('www-authenticate') || '';
      const m = header.match(/resource_metadata="([^"]+)"/);
      assert.ok(m, header);
      resourceMetadataUrl = m[1];
      assert.equal(resourceMetadataUrl, `${BASE}/.well-known/oauth-protected-resource/api/mcp`);
    });

    let asMeta: Record<string, string> = {};
    await step('.well-known metadata resolves on the app host', async () => {
      const prm = await (await fetch(resourceMetadataUrl)).json();
      assert.equal(prm.resource, `${BASE}/api/mcp`);
      const res = await fetch(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`);
      assert.equal(res.status, 200);
      asMeta = await res.json();
      assert.equal(asMeta.issuer, BASE);
      assert.equal(asMeta.authorization_endpoint, `${BASE}/oauth/authorize`);
      const oidc = await fetch(`${BASE}/.well-known/openid-configuration`);
      assert.equal(oidc.status, 200);
      const rootPrm = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
      assert.equal(rootPrm.status, 200);
    });

    let clientId = '';
    await step('the app registers itself automatically', async () => {
      const res = await fetch(asMeta.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }) });
      assert.equal(res.status, 201);
      clientId = (await res.json()).client_id;
      assert.match(clientId, /^ksc_/);
    });

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const authorizeUrl = `${asMeta.authorization_endpoint}?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'sites:read sites:write', resource: `${BASE}/api/mcp` })}`;

    await step('signed-out owners are sent to sign in and come back', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForURL(/\/signin/, { timeout: 60_000 });
      const returnTo = new URL(page.url()).searchParams.get('returnTo') || '';
      assert.ok(returnTo.startsWith('/oauth/authorize?'), returnTo);
      assert.equal(new URLSearchParams(returnTo.split('?')[1]).get('client_id'), clientId);
      await context.close();
    });

    let code = '';
    await step('signed-in owner sees the Allow page and approves', async () => {
      const context = await browser.newContext();
      await context.addCookies([{ name: auth.cookieName, value: auth.cookieValue, domain: 'localhost', path: '/' }]);
      const page = await context.newPage();
      await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.getByText('Connect Claude to Keystone').waitFor({ timeout: 60_000 });
      await page.getByRole('button', { name: 'Allow' }).click();
      await page.waitForURL((u) => u.href.startsWith(REDIRECT), { timeout: 30_000 });
      const url = new URL(page.url());
      assert.equal(url.origin + url.pathname, REDIRECT);
      assert.equal(url.searchParams.get('state'), 'xyz');
      assert.equal(url.searchParams.get('iss'), BASE);
      code = url.searchParams.get('code') || '';
      assert.match(code, /^ksac_/);
      await context.close();
    });

    await step('Cancel sends access_denied back to the app', async () => {
      const context = await browser.newContext();
      await context.addCookies([{ name: auth.cookieName, value: auth.cookieValue, domain: 'localhost', path: '/' }]);
      const page = await context.newPage();
      await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForURL((u) => u.href.startsWith(REDIRECT), { timeout: 30_000 });
      assert.equal(new URL(page.url()).searchParams.get('error'), 'access_denied');
      await context.close();
    });

    let access = '';
    let refresh = '';
    await step('code exchange (PKCE) issues tokens; codes are single-use', async () => {
      const form = { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier };
      const res = await fetch(asMeta.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.token_type, 'Bearer');
      access = body.access_token;
      refresh = body.refresh_token;
      const again = await fetch(asMeta.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
      assert.equal(again.status, 400);
      assert.equal((await again.json()).error, 'invalid_grant');
    });

    await step('the connected app can use the MCP server', async () => {
      const res = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${access}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_site', arguments: { name: 'OAuth Bakery' } } }) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.notEqual(body.result.isError, true, JSON.stringify(body));
      assert.ok(db.table('sites').some((s) => s.user_id === OWNER && s.engine === 'sections_v2'), 'site created for the signed-in owner');
    });

    await step('refresh rotates tokens', async () => {
      const res = await fetch(asMeta.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId }) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.notEqual(body.refresh_token, refresh);
      access = body.access_token;
    });

    await step('Account Settings shows the URL and the connected app; Disconnect works', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addCookies([{ name: auth.cookieName, value: auth.cookieValue, domain: 'localhost', path: '/' }]);
      const page = await context.newPage();
      page.on('dialog', (d) => void d.accept());
      await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.getByText('MCP server URL').waitFor({ timeout: 60_000 }).catch(async (e) => {
        if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.E2E_SCREENSHOTS, 'settings-failure.png'), fullPage: true });
        console.error('settings page text:', (await page.locator('body').innerText()).slice(0, 800));
        throw e;
      });
      await page.getByText(`${BASE}/api/mcp`, { exact: true }).waitFor();
      const appRow = page.locator('li', { hasText: 'Claude' });
      await appRow.waitFor({ timeout: 30_000 });
      if (process.env.E2E_SCREENSHOTS) {
        await page.getByText('AI agents').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(process.env.E2E_SCREENSHOTS, 'settings-ai-agents.png'), fullPage: false });
      }
      await appRow.getByRole('button', { name: /Disconnect/ }).click();
      await page.getByText('No AI apps connected yet.').waitFor({ timeout: 30_000 });
      await context.close();
      const res = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }) });
      assert.equal(res.status, 401, 'disconnected apps lose access immediately');
    });

    console.log(`\n${passed} passed`);
  } catch (e) {
    console.error('\nFAILED:', e);
    console.error(nextLog.join('').split('\n').slice(-60).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    callback.close();
    try {
      if (next.pid) process.kill(-next.pid, 'SIGTERM');
    } catch {
      next.kill('SIGTERM');
    }
    await fake.close();
  }
}

void main();
