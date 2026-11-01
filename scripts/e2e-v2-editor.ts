/**
 * Browser end-to-end test for engine v2: real Next.js dev server, middleware,
 * API routes, MCP endpoint, renderer, runtime and owner editor UI, with
 * Supabase emulated over HTTP (scripts/fixtures/fake-supabase-server.ts).
 *
 *   npm run test:v2:e2e            (needs Chromium/Playwright; ~2–4 min)
 *   E2E_SCREENSHOTS=/some/dir npm run test:v2:e2e
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Page, type FrameLocator } from 'playwright';
import { startFakeSupabase } from './fixtures/fake-supabase-server';
import { hashToken } from '../lib/v2/api-tokens';

const NEXT_PORT = 3100;
const SUPA_PORT = 54321;
const BASE = `http://localhost:${NEXT_PORT}`;
const SHOTS = process.env.E2E_SCREENSHOTS || '';
const OWNER = '11111111-1111-1111-1111-111111111111';
const TOKEN = `ks_pat_e2e${'x'.repeat(36)}`;

// ── A small agent-built design (what an agent would send over MCP) ──────────
const THEME = {
  tokens: [
    { name: 'ink', value: '#14110f', type: 'color', label: 'Text', group: 'Colours' },
    { name: 'paper', value: '#f6f1ea', type: 'color', label: 'Background', group: 'Colours', editable: true },
    { name: 'brand', value: '#c2410c', type: 'color', label: 'Brand colour', group: 'Colours', editable: true },
    { name: 'font-display', value: "'Fraunces', serif", type: 'font', label: 'Heading font', group: 'Fonts', editable: true },
    { name: 'font-body', value: "'Inter', sans-serif", type: 'font', label: 'Body font', group: 'Fonts', editable: true },
  ],
  global_css: `*,*::before,*::after{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--font-body)}
img{max-width:100%;display:block}a{color:inherit}.wrap{width:min(1180px,100% - 3rem);margin-inline:auto}
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 1.4rem;border-radius:999px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600}
.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 2px currentColor}
h1,h2,h3{font-family:var(--font-display);line-height:1;letter-spacing:-.02em;margin:0}`,
};

const SECTIONS: Record<string, { name: string; html: string }> = {
  header: {
    name: 'Header',
    html: `<header class="bar wrap"><a href="/" class="brand"><span data-ks="@site.name">Northline</span></a>
<nav><ul data-ks-nav><li><a href="/">Home</a></li></ul></nav>
<a class="btn call" data-ks="@business.phone" href="tel:">(905) 555-0100</a></header>
<style>.bar{display:flex;align-items:center;gap:2rem;padding:1.25rem 0}.brand{font:700 1.4rem var(--font-display);text-decoration:none}
nav{margin-left:auto}nav ul{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0}nav a{text-decoration:none;font-weight:500}nav a[aria-current]{color:var(--brand)}
@media(max-width:700px){nav{display:none}}</style>`,
  },
  hero: {
    name: 'Hero — headline and photo',
    html: `<section class="hero wrap">
<div class="copy"><p class="eyebrow" data-ks="eyebrow">Oakville · Since 1994</p>
<h1 data-ks="title" data-ks-max="70">Roofs done <em>right</em>, the first time.</h1>
<div class="intro" data-ks="intro" data-ks-type="richtext"><p>Family-owned crews, written warranties, and a site that's spotless when we leave.</p></div>
<div class="ctas"><a class="btn" data-ks="cta" href="/contact">Get a free quote</a><a class="btn ghost" data-ks="cta2" data-ks-optional href="/work">See our work</a></div>
<ul class="badges" data-ks-list="badges" data-ks-max-items="4"><li data-ks-item><span data-ks="label">Licensed &amp; insured</span></li><li data-ks-item><span data-ks="label">25-year warranty</span></li></ul></div>
<img class="photo" data-ks="photo" data-ks-aspect="4/5" src="/templates/airy.png" alt="A finished roof"></section>
<style>.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:4rem;align-items:center;padding:4rem 0 6rem}
.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.8rem;color:var(--brand);font-weight:700}
h1{font-size:clamp(2.8rem,6.5vw,5.6rem);font-weight:800}h1 em{color:var(--brand)}.intro{font-size:1.15rem;max-width:34ch;opacity:.85}
.ctas{display:flex;gap:.75rem;margin:2rem 0}.badges{display:flex;flex-wrap:wrap;gap:.5rem;list-style:none;padding:0;margin:0}
.badges li{padding:.35rem .8rem;border-radius:999px;background:#fff;font-size:.85rem;font-weight:600}
.photo{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:28px;box-shadow:0 30px 60px -30px rgba(0,0,0,.45)}
.ks-js h1{opacity:0;transform:translateY(12px);transition:all .7s}.ks-js h1.in{opacity:1;transform:none}
@media(max-width:800px){.hero{grid-template-columns:1fr;gap:2rem;padding-top:2rem}}</style>
<script type="module">export default (root) => { requestAnimationFrame(() => root.querySelector('h1')?.classList.add('in')); };</script>`,
  },
  services: {
    name: 'Services grid',
    html: `<section class="services wrap"><h2 data-ks="heading">What we do</h2>
<div class="grid" data-ks-list="items">
<article data-ks-item><h3 data-ks="name">Roof replacement</h3><p data-ks="blurb">Tear-off to final inspection in as little as two days.</p><a data-ks="link" href="/contact">Book an inspection</a></article>
<article data-ks-item><h3 data-ks="name">Repairs</h3><p data-ks="blurb">Leaks found and fixed fast, with photos of every fix.</p><a data-ks="link" href="/contact">Book a repair</a></article>
<article data-ks-item><h3 data-ks="name">Eavestroughs</h3><p data-ks="blurb">Seamless aluminium troughs, guards and downspouts.</p><a data-ks="link" href="/contact">Get a price</a></article>
</div></section>
<style>.services{padding:4rem 0}h2{font-size:clamp(2rem,4vw,3.2rem);margin-bottom:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem}
article{background:#fff;border-radius:22px;padding:1.75rem}h3{font-size:1.5rem;margin-bottom:.5rem}article a{color:var(--brand);font-weight:600}</style>`,
  },
  contact: {
    name: 'Contact form',
    html: `<section class="contact wrap"><h2 data-ks="heading">Get a free quote</h2>
<form data-ks-form="contact"><label><span data-ks="nameLabel">Your name</span><input name="name" required></label>
<label><span data-ks="emailLabel">Email</span><input name="email" type="email" required></label>
<label><span data-ks="messageLabel">Tell us about your roof</span><textarea name="message" required></textarea></label>
<button class="btn" data-ks="submit" type="submit">Send request</button>
<p data-ks-form-success hidden data-ks="thanks">Thanks! We'll call you within one business day.</p><p data-ks-form-error hidden></p></form></section>
<style>.contact{padding:4rem 0 6rem}form{display:grid;gap:1rem;max-width:560px}label{display:grid;gap:.35rem;font-weight:600}
input,textarea{font:inherit;padding:.8rem 1rem;border-radius:14px;border:1px solid #d6cfc5;background:#fff}textarea{min-height:120px}
form[data-ks-form-state=success] label,form[data-ks-form-state=success] button{display:none}</style>`,
  },
  footer: {
    name: 'Footer',
    html: `<footer class="foot wrap"><p data-ks="blurb">Northline Roofing — family-owned in Oakville.</p><p><a data-ks="@business.email" href="mailto:">hello@northline.ca</a></p></footer>
<style>.foot{display:flex;justify-content:space-between;padding:2.5rem 0;border-top:1px solid #e3dcd2;font-size:.9rem}</style>`,
  },
};

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

function hostRequest(host: string, urlPath: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: NEXT_PORT, path: urlPath, headers: { host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function mcp(method: string, params?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  return res.json();
}
async function tool(name: string, args: Record<string, unknown>) {
  const body = await mcp('tools/call', { name, arguments: args });
  const data = JSON.parse(body.result.content[0].text);
  assert.ok(!body.result.isError, `${name}: ${JSON.stringify(data)}`);
  return data;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function eventually(fn: () => boolean | Promise<boolean>, label: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await fn()) return;
    } catch {
      /* e.g. the canvas reloaded mid-check — retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out: ${label}`);
}

async function main() {
  const fake = await startFakeSupabase(SUPA_PORT);
  const { db } = fake;
  db.table('users').push({ id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false });
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });
  db.table('api_tokens').push({ id: 'tok-e2e', name: 'E2E agent', user_id: OWNER, token_hash: hashToken(TOKEN), scopes: ['sites:read', 'sites:write', 'sites:publish'], revoked_at: null, expires_at: null, last_used_at: null });
  const auth = fake.addSession({ id: OWNER, email: 'owner@example.com' });

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
    detached: true, // own process group, so teardown also stops next-server
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

  const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP northline.kswd.ca 127.0.0.1:${NEXT_PORT}`] });
  try {
    await waitForHttp(`${BASE}/api/v2/engine`, 240_000);
    console.log('v2 e2e (next dev up)');

    let siteId = '';
    await step('agent builds a site over the real /api/mcp endpoint', async () => {
      const init = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
      assert.equal(init.result.serverInfo.name, 'keystone');
      const created = await tool('create_site', { name: 'Northline Roofing', business: { phone: '+1 905-555-0199', email: 'hello@northline.ca', city: 'Oakville', region: 'ON' } });
      siteId = created.site_id;
      await tool('set_theme', { site_id: siteId, ...THEME });
      for (const [key, s] of Object.entries(SECTIONS)) {
        const r = await tool('put_section', { site_id: siteId, key, name: s.name, html: s.html });
        assert.deepEqual(r.issues.filter((i: { level: string }) => i.level === 'error'), [], key);
      }
      await tool('set_layout', { site_id: siteId, header: 'header', footer: 'footer' });
      await tool('put_page', { site_id: siteId, slug: 'home', title: 'Home', seo: { title: 'Northline Roofing — Oakville roofers', description: 'Roof replacement and repairs in Oakville.' }, sections: [{ section: 'hero', id: 'home-hero' }, { section: 'services', id: 'home-services' }, { section: 'contact', id: 'home-contact' }] });
      await tool('put_page', { site_id: siteId, slug: 'work', title: 'Our work', seo: { description: 'Recent roofs' }, sections: [{ section: 'services', id: 'work-grid', content: { heading: 'Recent projects' } }] });
      await tool('put_page', { site_id: siteId, slug: 'contact', title: 'Contact', seo: { description: 'Contact us' }, sections: [{ section: 'contact', id: 'contact-form' }] });
      const report = await tool('validate', { site_id: siteId });
      assert.equal(report.ok, true, JSON.stringify(report.errors));
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([{ name: auth.cookieName, value: auth.cookieValue, domain: 'localhost', path: '/' }]);
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    let canvas: FrameLocator;

    await step('owner opens /design and gets the v2 editor with the site in a sandboxed canvas', async () => {
      await page.goto(`${BASE}/design?siteId=${siteId}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForSelector('iframe[title="Your site"]', { timeout: 180_000 });
      canvas = page.frameLocator('iframe[title="Your site"]');
      await canvas.locator('h1').waitFor({ timeout: 60_000 });
      assert.equal(await page.locator('iframe[title="Your site"]').getAttribute('sandbox'), 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox');
      const cookieAccess = await page.frames()[1].evaluate(() => { try { return typeof document.cookie; } catch { return 'blocked'; } });
      assert.equal(cookieAccess, 'blocked', 'canvas runs in an opaque origin');
      await page.getByText('Hero — headline and photo').waitFor();
      await page.waitForTimeout(1500);
      await canvas.locator('h1').waitFor();
      await shot(page, '1-editor');
    });

    const content = (instance: string, field: string) => db.table('v2_content').find((r) => r.instance_id === instance && r.field === field);

    await step('click-to-edit text saves as an owner edit', async () => {
      const h1 = canvas.locator('h1[data-ks-f="title"]');
      await h1.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('Oakville roofs, done properly.');
      await page.keyboard.press('Enter');
      await eventually(() => /done properly/.test(String((content('home-hero', 'title')?.value as { html?: string })?.html)), 'title saved');
      assert.equal(content('home-hero', 'title')?.owner_edited, true);
    });

    await step('link dialog edits a button', async () => {
      await canvas.locator('a[data-ks-f="cta"]').click();
      const dialog = page.getByRole('dialog', { name: 'Edit link' });
      await dialog.waitFor();
      await dialog.locator('input').first().fill('Book a free inspection');
      await dialog.locator('select').selectOption('work');
      await dialog.getByRole('button', { name: 'Save link' }).click();
      await eventually(() => (content('home-hero', 'cta')?.value as { href?: string })?.href === '/work', 'cta saved');
      assert.equal((content('home-hero', 'cta')?.value as { label?: string }).label, 'Book a free inspection');
      await canvas.locator('a[data-ks-f="cta"]', { hasText: 'Book a free inspection' }).waitFor();
    });

    await step('list item toolbar duplicates a badge', async () => {
      await canvas.locator('[data-ks-l="badges"] > [data-ks-i="0"]').hover();
      await canvas.locator('#ks-item-bar button[data-op="duplicate"]').click();
      await eventually(() => ((content('home-hero', 'badges')?.value as { items?: unknown[] })?.items?.length || 0) === 3, 'badge duplicated');
      await canvas.locator('[data-ks-l="badges"] > [data-ks-i="2"]').waitFor();
    });

    await step('image picker uploads a photo through the existing upload route', async () => {
      await canvas.locator('img[data-ks-f="photo"]').click();
      const dialog = page.getByRole('dialog', { name: 'Choose an image' });
      await dialog.waitFor();
      const png = fs.readFileSync(path.resolve(__dirname, '../public/templates/booked.png'));
      await dialog.locator('input[type=file]').setInputFiles({ name: 'crew.png', mimeType: 'image/png', buffer: png });
      await dialog.locator('img[alt=""]').first().waitFor({ timeout: 30_000 });
      await dialog.locator('input').last().fill('Our crew finishing a roof');
      await dialog.getByRole('button', { name: 'Use this image' }).click();
      await eventually(() => /storage\/v1\/object\/public\/site-assets\//.test(String((content('home-hero', 'photo')?.value as { src?: string })?.src)), 'photo saved', 30_000);
      assert.equal((content('home-hero', 'photo')?.value as { alt?: string }).alt, 'Our crew finishing a roof');
    });

    await step('sections panel hides and reorders sections', async () => {
      const row = page.locator('li', { hasText: 'Services grid' }).first();
      await row.getByRole('button', { name: 'Hide' }).click();
      const layout = () => db.table('v2_page_layouts').find((l) => (l.instances as Array<{ id: string }>).some((i) => i.id === 'home-services'));
      await eventually(() => (layout()?.instances as Array<{ id: string; hidden?: boolean }>).find((i) => i.id === 'home-services')?.hidden === true, 'hidden');
      await row.getByRole('button', { name: 'Show' }).click();
      await row.getByRole('button', { name: 'Move down' }).click();
      await eventually(() => (layout()?.instances as Array<{ id: string }>)[2]?.id === 'home-services', 'moved');
    });

    await step('form view edits a list item field', async () => {
      await page.locator('li', { hasText: 'Services grid' }).first().locator('button').first().click();
      await page.getByRole('button', { name: 'Repairs', exact: true }).click();
      const item = page.locator('div.rounded-lg.border', { has: page.getByRole('button', { name: 'Repairs', exact: true }) }).first();
      const textarea = item.locator('textarea').nth(1);
      await textarea.waitFor();
      await textarea.fill('Leaks found and fixed the same week.');
      await item.getByRole('button', { name: 'Save' }).click();
      await eventually(() => /same week/.test(JSON.stringify(content('home-services', 'items')?.value)), 'item saved');
    });

    await step('brand panel changes an editable colour', async () => {
      await page.getByRole('button', { name: 'Brand' }).click();
      const brand = page.getByLabel('Brand colour', { exact: true });
      await brand.fill('#1d4ed8');
      await page.getByRole('button', { name: 'Apply brand changes' }).click();
      await eventually(() => (db.table('v2_themes')[0]?.owner_overrides as Record<string, string>)?.brand === '#1d4ed8', 'brand saved');
      await eventually(async () => (await page.frames()[1].evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim())) === '#1d4ed8', 'canvas restyled');
    });

    await step('business info updates every @business binding', async () => {
      await page.getByRole('button', { name: 'Business' }).click();
      const phone = page.locator('label', { hasText: 'Phone' }).locator('input');
      await phone.fill('(905) 555-0123');
      await page.getByRole('button', { name: 'Save business info' }).click();
      await canvas.locator('a.call', { hasText: '(905) 555-0123' }).waitFor();
    });

    await step('pages panel adds a page copied from another', async () => {
      await page.getByRole('button', { name: 'Pages' }).click();
      await page.getByPlaceholder('Page name, e.g. Kitchen Renovations').fill('Flat Roofs');
      await page.locator('select').last().selectOption({ label: 'Copy the layout of “Our work”' });
      await page.getByRole('button', { name: 'Add page' }).click();
      await eventually(() => db.table('pages').some((p) => p.slug === 'flat-roofs'), 'page added');
      const newPage = db.table('pages').find((p) => p.slug === 'flat-roofs')!;
      const layout = db.table('v2_page_layouts').find((l) => l.page_id === newPage.id);
      assert.equal((layout?.instances as unknown[]).length, 1);
      await canvas.locator('h2', { hasText: 'Recent projects' }).waitFor();
    });

    await step('preview mode runs the agent JS; edit mode does not', async () => {
      await page.getByRole('button', { name: 'Home' }).first().click().catch(() => {});
      await page.locator('header select').selectOption({ label: 'Home' });
      assert.equal(await canvas.locator('html.ks-js').count(), 0);
      await page.getByRole('button', { name: 'Preview' }).click();
      await canvas.locator('html.ks-js').waitFor();
      await canvas.locator('h1.in').waitFor();
      await page.getByRole('button', { name: 'Edit' }).click();
    });

    await step('history lists restore points and change requests reach ops', async () => {
      await page.getByRole('button', { name: 'History' }).click();
      const dialog = page.getByRole('dialog', { name: 'History' });
      await dialog.getByRole('button', { name: 'Restore' }).first().waitFor();
      await shot(page, '2-history');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Ask for a change' }).click();
      await page.getByRole('dialog', { name: 'Ask the Keystone team' }).locator('textarea').fill('Please add a section with our three roofing packages.');
      await page.getByRole('button', { name: 'Send request' }).click();
      await eventually(() => db.table('support_requests').some((r) => /three roofing packages/.test(String(r.body_text))), 'request stored');
    });

    await step('publish through the existing publish route freezes a release', async () => {
      const result = await page.evaluate(async (id) => {
        const r = await fetch('/api/sites/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id, publishedDomain: 'northline.kswd.ca' }) });
        return { status: r.status, body: await r.json() };
      }, siteId);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.publicUrl, 'https://northline.kswd.ca');
      const site = db.table('sites').find((s) => s.id === siteId)!;
      assert.ok(site.v2_release_id);
      assert.equal(site.published_domain, 'northline');
    });

    await step('published host is routed by middleware to the v2 renderer', async () => {
      const home = await hostRequest('northline.kswd.ca', '/');
      assert.equal(home.status, 200);
      assert.match(home.body, /Oakville roofs, done properly\./);
      assert.match(home.body, /--brand:#1d4ed8/);
      assert.match(home.body, /What we do/, 'services section survived hide → show → move');
      assert.ok(home.body.indexOf('What we do') > home.body.indexOf('Get a free quote'), 'services moved below contact');
      assert.doesNotMatch(home.body, /data-ks-f=/);
      assert.match(String(home.headers['content-security-policy']), /script-src 'self' blob:/);
      const runtime = await hostRequest('northline.kswd.ca', '/ks/runtime.js');
      assert.equal(runtime.status, 200);
      assert.match(runtime.body, /Keystone site runtime/);
      const missing = await hostRequest('northline.kswd.ca', '/nope');
      assert.equal(missing.status, 404);
      const sitemap = await hostRequest('northline.kswd.ca', '/sitemap.xml');
      assert.equal(sitemap.status, 200);
    });

    await step('published site runs in a browser: agent JS, nav, and the contact form', async () => {
      const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const v = await visitor.newPage();
      const errors: string[] = [];
      v.on('pageerror', (e) => errors.push(e.message));
      await v.goto('http://northline.kswd.ca/', { waitUntil: 'networkidle' });
      await v.locator('h1.in').waitFor();
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '4-published-mobile.png'), fullPage: true });
      await v.fill('input[name=name]', 'Pat Visitor');
      await v.fill('input[name=email]', 'pat@example.com');
      await v.fill('textarea[name=message]', 'My roof leaks near the chimney.');
      await v.click('button[type=submit]');
      await v.waitForSelector('form[data-ks-form-state=success], form[data-ks-form-state=error]', { timeout: 30_000 });
      const state = await v.getAttribute('form[data-ks-form]', 'data-ks-form-state');
      const submission = db.table('contact_submissions').find((r) => r.site_id === siteId);
      assert.ok(submission, `contact submission stored (form state: ${state})`);
      assert.equal(state, 'success');
      assert.deepEqual(errors, []);
      await visitor.close();
    });

    if (SHOTS) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await shot(page, '3-editor-after-edits');
      const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const d = await desktop.newPage();
      await d.goto('http://northline.kswd.ca/', { waitUntil: 'networkidle' });
      await d.screenshot({ path: path.join(SHOTS, '5-published-desktop.png'), fullPage: true });
      await desktop.close();
    }

    assert.deepEqual(pageErrors.filter((e) => !/ResizeObserver/.test(e)), [], 'no uncaught errors in the editor');
    console.log(`\n${passed} passed`);
  } catch (e) {
    console.error(e);
    console.error('--- next log (tail) ---\n' + nextLog.join('').split('\n').slice(-60).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    try {
      if (next.pid) process.kill(-next.pid, 'SIGTERM');
    } catch {
      next.kill('SIGTERM');
    }
    await fake.close();
  }
}

void main();
