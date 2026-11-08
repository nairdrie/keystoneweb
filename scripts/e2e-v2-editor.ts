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

// Override when a dev harness already holds the defaults.
const NEXT_PORT = Number(process.env.E2E_NEXT_PORT) || 3100;
const SUPA_PORT = Number(process.env.E2E_SUPABASE_PORT) || 54321;
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
<div class="ctas"><a class="btn" data-ks="cta" href="/contact">Get a free quote</a><a class="btn ghost" data-ks="cta2" href="/work">See our work</a></div>
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

  // Start from a fresh dev cache: a stale Turbopack cache can stall route compiles.
  fs.rmSync(path.resolve(__dirname, '../.next/dev'), { recursive: true, force: true });
  // Run next's own bin with this node (works on Windows too, where `npx` can't be spawned directly).
  // E2E_WEBPACK=1 for checkouts Turbopack can't root (e.g. a git worktree without its own node_modules).
  const nextArgs = [require.resolve('next/dist/bin/next'), 'dev', '-p', String(NEXT_PORT), ...(process.env.E2E_WEBPACK ? ['--webpack'] : [])];
  const next: ChildProcess = spawn(process.execPath, nextArgs, {
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
      // No Sections tab any more: Brand is the first tab.
      assert.equal(await page.getByRole('button', { name: 'Sections' }).count(), 0);
      await page.getByRole('button', { name: 'Apply brand changes' }).or(page.getByText('Replace logo')).first().waitFor();
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

    const layout = () => db.table('v2_page_layouts').find((l) => (l.instances as Array<{ id: string }>).some((i) => i.id === 'home-hero'));
    const homeIds = () => (layout()?.instances as Array<{ id: string }>).map((i) => i.id);
    const sectionButton = async (instance: string, op: string) => {
      await canvas.locator(`[data-ks-instance="${instance}"] h2, [data-ks-instance="${instance}"] h1`).first().hover();
      const b = canvas.locator(`#ks-section-bar button[data-sop="${op}"]`);
      await b.waitFor();
      return b;
    };

    await step('section toolbar on the page reorders sections (no hide: owners remove instead)', async () => {
      await canvas.locator('[data-ks-instance="home-services"] h2').hover();
      await canvas.locator('#ks-section-bar .ks-name', { hasText: 'Services grid' }).waitFor();
      assert.equal(await canvas.locator('#ks-section-bar button[data-sop="up"]').isDisabled(), false);
      assert.equal(await canvas.locator('#ks-section-bar button[data-sop="hide"]').count(), 0);
      await (await sectionButton('home-services', 'down')).click();
      await eventually(() => homeIds()[2] === 'home-services', 'moved');
      await shot(page, '1b-section-toolbar');
    });

    await step('add-section buttons insert a design between sections, and delete removes it', async () => {
      await canvas.locator('[data-ks-instance="home-hero"] h1').hover();
      await canvas.locator('#ks-add-bottom button').click();
      const dialog = page.getByRole('dialog', { name: 'Add a section' });
      await dialog.getByRole('button', { name: /Services grid/ }).click();
      await eventually(() => homeIds().length === 4 && homeIds()[0] === 'home-hero' && homeIds()[1] !== 'home-contact', 'inserted after the hero');
      const added = homeIds()[1];
      page.once('dialog', (d) => void d.accept());
      await (await sectionButton(added, 'remove')).click();
      await eventually(() => homeIds().length === 3 && !homeIds().includes(added), 'deleted');
    });

    await step('any editable part can be removed from its chip, and Undo brings it back', async () => {
      await canvas.locator('a[data-ks-f="cta2"]').hover();
      await canvas.locator('#ks-rm-chip button', { hasText: 'Remove' }).click();
      await eventually(() => (content('home-hero', 'cta2')?.value as { hidden?: boolean })?.hidden === true, 'cta2 removed');
      assert.equal(await canvas.locator('a[data-ks-f="cta2"]').isVisible(), false);
      await page.getByRole('button', { name: 'Undo' }).click();
      await eventually(() => (content('home-hero', 'cta2')?.value as { hidden?: boolean })?.hidden === false, 'cta2 back');
      await canvas.locator('a[data-ks-f="cta2"]').waitFor({ state: 'visible' });
    });

    await step('Archie opens from a section toolbar, aimed at that section', async () => {
      await (await sectionButton('home-services', 'ask')).click();
      await page.getByText('the “Services grid” section').waitFor();
      await page.keyboard.press('Escape');
    });

    await step('"Edit all content" edits a list item field', async () => {
      await (await sectionButton('home-services', 'content')).click();
      const modal = page.getByRole('dialog', { name: 'Services grid' });
      await modal.getByRole('button', { name: 'Repairs', exact: true }).click();
      const item = modal.locator('div.rounded-lg.border', { has: page.getByRole('button', { name: 'Repairs', exact: true }) }).first();
      const textarea = item.locator('textarea').nth(1);
      await textarea.waitFor();
      await textarea.fill('Leaks found and fixed the same week.');
      await item.getByRole('button', { name: 'Save' }).click();
      await eventually(() => /same week/.test(JSON.stringify(content('home-services', 'items')?.value)), 'item saved');
      await page.keyboard.press('Escape');
      await modal.waitFor({ state: 'detached' });
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
      // "Ask for a change" opens Archie; a person is one click further.
      await page.getByRole('button', { name: 'Ask for a change' }).click();
      await page.getByRole('button', { name: 'Ask a human' }).click();
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
      assert.match(home.body, /What we do/, 'services section survived the move');
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

    let productId = '';
    let serviceId = '';
    await step('agent adds services, products and a shop page; screenshot tool shows the agent its work', async () => {
      const svc = await tool('upsert_services', { site_id: siteId, services: [{ name: 'Roof inspection', description: 'Full inspection with photos.', duration_minutes: 60, price_cents: 0, featured: true }] });
      serviceId = svc.services[0].id;
      const prod = await tool('upsert_products', { site_id: siteId, products: [{ name: 'Ridge vent kit', price_cents: 4900, compare_at_cents: 6000, featured: true, description: 'Everything for a 20ft ridge.' }] });
      productId = prod.products[0].id;
      await tool('set_theme', { site_id: siteId, platform: { primary: 'brand', secondary: 'ink', accent: 'paper' } });
      await tool('put_section', { site_id: siteId, key: 'shop', name: 'Shop & book', html: `<section class="shop wrap"><h2 data-ks="heading">Book or shop</h2>
<a class="cartlink" href="/cart" data-ks-action="open-cart"><span data-ks="cartLabel">Cart</span> <span class="count" data-ks-cart-count>0</span></a>
<ul class="svc" data-ks-collection="services"><li data-ks-item><h3 data-ks-bind="name">Service</h3><p data-ks-bind="duration">1 hr</p><a class="btn" data-ks-action="book" href="/book">Book now</a></li></ul>
<div class="prods" data-ks-collection="products"><article data-ks-item><h3 data-ks-bind="name">Product</h3><p><s data-ks-if="on_sale" data-ks-bind="compare_price">$9</s> <b data-ks-bind="price">$5</b></p>
<button class="btn" data-ks-action="add-to-cart">Add to cart</button> <a data-ks-bind="url" href="#">Details</a></article></div></section>
<style>.shop{padding:3rem 0}.svc,.prods{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;list-style:none;padding:0}
.svc li,.prods article{background:#fff;border-radius:20px;padding:1.5rem}</style>` });
      await tool('put_page', { site_id: siteId, slug: 'shop', title: 'Shop', seo: { description: 'Shop and book' }, sections: [{ section: 'shop', id: 'shop-main' }] });

      const res = await mcp('tools/call', { name: 'screenshot', arguments: { site_id: siteId, path: '/shop', viewports: ['desktop', 'mobile'] } });
      assert.ok(!res.result.isError, JSON.stringify(res.result.content[0]).slice(0, 400));
      const images = res.result.content.filter((c: { type: string }) => c.type === 'image');
      assert.equal(images.length, 2);
      assert.equal(images[0].mimeType, 'image/jpeg');
      const report = JSON.parse(res.result.content[0].text);
      assert.ok(Array.isArray(report.problems));
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        fs.writeFileSync(path.join(SHOTS, '6-agent-screenshot-desktop.jpg'), Buffer.from(images[0].data, 'base64'));
        fs.writeFileSync(path.join(SHOTS, '7-agent-screenshot-mobile.jpg'), Buffer.from(images[1].data, 'base64'));
      }
      // A deliberately broken section: the screenshot report catches sideways scrolling.
      await tool('put_section', { site_id: siteId, key: 'wide', name: 'Too wide', html: '<section><div style="width:1400px;height:20px" data-ks-static></div><p data-ks="t">Wide</p></section>' });
      await tool('put_page', { site_id: siteId, slug: 'wide-test', seo: { description: 'x' }, sections: [{ section: 'wide' }] });
      const wide = await mcp('tools/call', { name: 'screenshot', arguments: { site_id: siteId, path: '/wide-test', viewports: ['mobile'], full_page: false } });
      const wideReport = JSON.parse(wide.result.content[0].text);
      assert.ok(wideReport.problems.some((p: string) => /scrolls sideways/.test(p)), JSON.stringify(wideReport.problems));
      await tool('delete_page', { site_id: siteId, slug: 'wide-test' });
      await tool('delete_section', { site_id: siteId, key: 'wide' });

      const pub = await page.evaluate(async (id) => {
        const r = await fetch('/api/sites/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id, publishedDomain: 'northline.kswd.ca' }) });
        return r.status;
      }, siteId);
      assert.equal(pub, 200);
    });

    await step('shoppers: live products, add to cart, hosted cart in the site design, product page', async () => {
      const shopper = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const v = await shopper.newPage();
      const errors: string[] = [];
      v.on('pageerror', (e) => errors.push(e.message));
      await v.goto('http://northline.kswd.ca/shop', { waitUntil: 'networkidle' });
      await v.locator('h3', { hasText: 'Roof inspection' }).waitFor();
      await v.locator('s', { hasText: '$60.00' }).waitFor();
      await v.getByRole('button', { name: 'Add to cart' }).click();
      await v.locator('#ks-toast', { hasText: 'Added to cart' }).waitFor();
      await v.locator('[data-ks-cart-count]', { hasText: '1' }).waitFor();
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '8-shop-live.png'), fullPage: true });

      // Dev mode compiles hosted pages on first visit, so allow extra time.
      await v.getByRole('link', { name: 'View cart' }).click({ noWaitAfter: true });
      await v.waitForURL('**/cart', { timeout: 120_000 });
      await v.locator('header.bar').waitFor(); // the agent's own header wraps Keystone's cart
      await v.getByText('Ridge vent kit').first().waitFor({ timeout: 30_000 });
      await v.waitForTimeout(1000); // let the drawer finish sliding in
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '9-cart-in-site-design.png') });

      await v.goto(`http://northline.kswd.ca/product/${productId}`, { waitUntil: 'networkidle', timeout: 120_000 });
      await v.getByText('Ridge vent kit').first().waitFor();
      await v.locator('footer.foot').waitFor();
      assert.deepEqual(errors, []);
      await shopper.close();
    });

    await step('booking: services link to Keystone booking, pre-selected, inside the site design', async () => {
      const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const v = await visitor.newPage();
      await v.goto('http://northline.kswd.ca/shop', { waitUntil: 'networkidle' });
      await v.getByText('Book now').click({ noWaitAfter: true });
      await v.waitForURL(`**/book?service=${serviceId}`, { timeout: 120_000 });
      await v.locator('header.bar').waitFor();
      await v.getByText('Roof inspection').first().waitFor({ timeout: 30_000 });
      // Pre-selected: the flow skips the service list and asks for a date.
      await v.getByText(/select a date|choose a date|pick a date/i).first().waitFor({ timeout: 30_000 });
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '10-booking-in-site-design.png') });
      await visitor.close();
    });

    await step('blog: agent designs the list + article layout; owner posts in Admin → Blog; visitors see it live', async () => {
      await tool('put_section', { site_id: siteId, key: 'news', name: 'News grid', html: `<section class="news wrap"><h2 data-ks="heading">Roofing news</h2>
        <div class="cards" data-ks-collection="posts"><a class="card" data-ks-item data-ks-bind="url" href="/blog/x"><time data-ks-bind="date">Jan 1</time><h3 data-ks-bind="title">Sample story</h3><p data-ks-bind="excerpt">Sample</p></a>
        <p data-ks-empty data-ks="empty">Articles coming soon.</p></div></section>`,
        css: '.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;padding:2rem 0}.card{display:block;padding:1.25rem;border-radius:16px;background:#fff;text-decoration:none}' });
      await tool('put_section', { site_id: siteId, key: 'article', name: 'Article', html: `<article class="post wrap" data-ks-collection="post"><div data-ks-item>
        <p class="kicker"><time data-ks-bind="date">Jan 1</time> · <span data-ks-bind="reading_time">1 min read</span></p><h1 data-ks-bind="title">Sample title</h1>
        <div class="prose" data-ks-bind="content"><p>Sample paragraph.</p></div></div></article>` });
      await tool('put_page', { site_id: siteId, slug: 'news', title: 'News', seo: { description: 'Roofing news' }, sections: [{ section: 'news', id: 'news-grid' }] });
      await tool('put_page', { site_id: siteId, slug: 'article', title: 'Article', template: 'post', sections: [{ section: 'article', id: 'article-main' }] });
      await tool('upsert_posts', { site_id: siteId, posts: [{ title: 'Northline turns ten', content: '<p>Ten years of roofs in Oakville.</p>', published_at: '2025-05-01' }] });
      await tool('publish', { site_id: siteId, subdomain: 'northline' });

      // Admin shows the Blog tab for this agent-built site, with the posts manager.
      await page.goto(`${BASE}/admin/blog?siteId=${siteId}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.getByText('Northline turns ten').first().waitFor({ timeout: 60_000 });
      assert.equal(await page.getByText('No Blog block on this site').count(), 0);
      assert.ok(await page.locator('button[title="Blog"]').or(page.locator('button', { hasText: /^Blog$/ })).count() > 0, 'Blog tab in the sidebar');
      // The owner publishes a post through the same API the Blog manager uses.
      const created = await page.evaluate(async (sid) => {
        const res = await fetch('/api/blog/posts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: sid, title: 'How to spot hail damage', excerpt: 'Three signs to look for.', content: '<h2>Look up</h2><p>Dents in the <strong>vents</strong>.</p>', is_published: true }) });
        return { status: res.status, body: await res.json() };
      }, siteId);
      assert.equal(created.status, 200, JSON.stringify(created.body));

      const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const v = await visitor.newPage();
      const errors: string[] = [];
      v.on('pageerror', (e) => errors.push(e.message));
      await v.goto('http://northline.kswd.ca/news', { waitUntil: 'networkidle' });
      await v.getByText('How to spot hail damage').waitFor();
      await v.getByText('Northline turns ten').waitFor();
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '11-blog-list.png'), fullPage: true });
      await v.getByText('How to spot hail damage').click();
      await v.waitForURL('**/blog/how-to-spot-hail-damage');
      await v.locator('h1', { hasText: 'How to spot hail damage' }).waitFor();
      await v.locator('.prose h2', { hasText: 'Look up' }).waitFor();
      assert.equal(await v.title(), 'How to spot hail damage | Northline Roofing');
      if (SHOTS) await v.screenshot({ path: path.join(SHOTS, '12-blog-article.png'), fullPage: true });
      assert.equal((await v.goto('http://northline.kswd.ca/article'))?.status(), 404, 'the layout is not a page of its own');
      assert.deepEqual(errors, []);
      await visitor.close();

      // In the editor, posts point the owner to Admin → Blog.
      await page.goto(`${BASE}/design?siteId=${siteId}`, { waitUntil: 'domcontentloaded' });
      await page.locator('select[aria-label="Page"] option', { hasText: 'Blog article layout' }).waitFor({ state: 'attached', timeout: 60_000 });
      await page.selectOption('select[aria-label="Page"]', { label: 'News' });
      const frame = page.frameLocator('iframe[title="Your site"]');
      await frame.locator('.card', { hasText: 'How to spot hail damage' }).click();
      await page.getByText(/come from Admin → Blog/).first().waitFor();
    });

    await step('editor: an edit based on an out-of-date copy is rejected and reloaded, not silently lost', async () => {
      await page.goto(`${BASE}/design?siteId=${siteId}`, { waitUntil: 'domcontentloaded' });
      const frame = page.frameLocator('iframe[title="Your site"]');
      await frame.locator('h1').waitFor({ timeout: 60_000 });
      // The agent changes the eyebrow while the owner has the page open…
      await tool('set_content', { site_id: siteId, changes: [{ instance: 'home-hero', path: 'eyebrow', value: 'Agent changed this' }] });
      // …then the owner edits the same field from their stale view.
      await frame.locator('[data-ks-f="eyebrow"]').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('Owner text');
      await page.keyboard.press('Enter');
      await page.getByText(/changed by someone else/).first().waitFor();
      await frame.locator('[data-ks-f="eyebrow"]', { hasText: 'Agent changed this' }).waitFor();
      const row = db.table('v2_content').find((r) => r.instance_id === 'home-hero' && r.field === 'eyebrow');
      assert.equal((row?.value as { html: string }).html, 'Agent changed this');
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

    await step('Design/Admin toggle and logo go to /admin for this site, after the last edit saves', async () => {
      await page.goto(`${BASE}/design?siteId=${siteId}`, { waitUntil: 'domcontentloaded' });
      const frame = page.frameLocator('iframe[title="Your site"]');
      await frame.locator('h1').waitFor({ timeout: 60_000 });
      const adminHref = `/admin?siteId=${siteId}`;
      assert.equal(await page.getByRole('link', { name: 'Back to admin' }).getAttribute('href'), adminHref);
      // Type into a field and leave without pressing Enter: the edit still saves.
      await frame.locator('[data-ks-f="eyebrow"]').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('Saved on the way out');
      await page.getByRole('link', { name: 'Admin', exact: true }).click();
      await page.waitForURL((u) => u.pathname === '/admin' && u.searchParams.get('siteId') === siteId, { timeout: 60_000 });
      const row = db.table('v2_content').find((r) => r.instance_id === 'home-hero' && r.field === 'eyebrow');
      assert.equal((row?.value as { html: string }).html, 'Saved on the way out');
    });
    console.log(`\n${passed} passed`);
  } catch (e) {
    console.error(e);
    console.error('--- next log (tail) ---\n' + nextLog.join('').split('\n').slice(-60).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    try {
      if (next.pid && process.platform === 'win32') spawn('taskkill', ['/pid', String(next.pid), '/T', '/F'], { stdio: 'ignore' });
      else if (next.pid) process.kill(-next.pid, 'SIGTERM');
    } catch {
      next.kill('SIGTERM');
    }
    await fake.close();
  }
}

void main();
