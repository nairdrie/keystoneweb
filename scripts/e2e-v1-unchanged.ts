// Usage: git worktree add <dir>/main-wt origin/main && cp -al node_modules <dir>/main-wt/ && npx tsx scripts/e2e-v1-unchanged.ts <dir>
/**
 * Renders the same classic (v1) site on two checkouts (origin/main vs this
 * branch) through the real Next server + middleware, and compares what a
 * visitor sees: visible text and full-page screenshots, pixel for pixel.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { startFakeSupabase } from './fixtures/fake-supabase-server';

const SP = process.argv[2]; // working dir: needs SP/main-wt (git worktree of origin/main with node_modules)
const CHECKOUTS = (process.env.ONLY === 'branch' ? [['branch', path.resolve(__dirname, '..')]] : [['main', `${SP}/main-wt`], ['branch', path.resolve(__dirname, '..')]]) as ReadonlyArray<readonly [string, string]>;
const PORT = 3200;
const SITE = '55555555-5555-5555-5555-555555555555';
const OWNER = '66666666-6666-6666-6666-666666666666';

const design = {
  siteTitle: 'Old Bakery', __selectedPalette: 'default', headerCtaText: 'Order now',
  __navItems: [{ id: 'n1', label: 'Home', linkType: 'page', href: '/', pageId: 'pg-home' }, { id: 'n2', label: 'About', linkType: 'page', href: '/about', pageId: 'pg-about' }],
};
const homeBlocks = { blocks: [
  { id: 'b1', type: 'hero', data: { title: 'Fresh bread every morning', subtitle: 'Since 1987 on Main Street.' } },
  { id: 'b2', type: 'text', data: { html: '<p>We bake everything in house.</p>' } },
  { id: 'b3', type: 'faq', data: { title: 'Questions', items: [{ question: 'Gluten free?', answer: 'Some loaves, yes.' }] } },
] };

function waitHttp(url: string, ms: number) {
  const t0 = Date.now();
  return new Promise<void>((res, rej) => {
    const tick = () => http.get(url, (r) => { r.resume(); res(); }).on('error', () => Date.now() - t0 > ms ? rej(new Error('timeout')) : setTimeout(tick, 1500));
    tick();
  });
}

async function main() {
  const fake = await startFakeSupabase(54321);
  const db = fake.db;
  db.table('users').push({ id: OWNER, email: 'baker@example.com', is_admin: false, is_banned: false });
  db.table('sites').push({ id: SITE, user_id: OWNER, site_slug: 'Old Bakery', selected_template_id: 'airy_general', business_type: 'services', category: 'general',
    published_domain: 'oldbakery', custom_domain: null, is_published: true, design_data: design, published_data: design, translations_config: {}, translations: {}, business_profile: null, engine: 'blocks_v1', deleted_at: null, published_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
  db.table('pages').push(
    { id: 'pg-home', site_id: SITE, slug: 'home', title: 'Home', display_name: 'Home', is_visible_in_nav: true, nav_order: 0, design_data: homeBlocks, published_data: homeBlocks, translations: {} },
    { id: 'pg-about', site_id: SITE, slug: 'about', title: 'About', display_name: 'About', is_visible_in_nav: true, nav_order: 1, design_data: { blocks: [{ id: 'a1', type: 'text', data: { html: '<p>Our story.</p>' } }] }, published_data: { blocks: [{ id: 'a1', type: 'text', data: { html: '<p>Our story.</p>' } }] }, translations: {} },
  );

  const results: Record<string, Record<string, { text: string; png: Buffer; status: number }>> = {};
  for (const [name, dir] of CHECKOUTS) {
    fs.rmSync(path.join(dir, '.next'), { recursive: true, force: true });
    const next: ChildProcess = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: dir, detached: true, stdio: 'ignore',
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 're_x', NEXT_TELEMETRY_DISABLED: '1' },
    });
    try {
      await waitHttp(`http://localhost:${PORT}/api/v2/engine`, 240_000);
      const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP oldbakery.kswd.ca 127.0.0.1:${PORT}`, '--unsafely-treat-insecure-origin-as-secure=http://oldbakery.kswd.ca'] });
      results[name] = {};
      for (const p of (process.env.ONLY ? ['/'] : ['/', '/about', '/ks/test', '/sitemap.xml'])) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
        // Test-only: plain-http test origin lacks crypto.randomUUID (production is https).
        await ctx.addInitScript(() => {
          if (!crypto.randomUUID) {
            (crypto as unknown as { randomUUID: () => string }).randomUUID = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16));
          }
        });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => console.log(name, p, 'PAGEERROR', String(e.message).slice(0, 400)));
        page.on('console', (m) => { if (m.type() === 'error') console.log(name, p, 'CONSOLE', m.text().slice(0, 300)); });
        // Warm the route once (dev compiles on first hit), then measure.
        console.log(name, 'loading', p);
        await page.goto(`http://oldbakery.kswd.ca${p}`, { waitUntil: 'load', timeout: 300_000 }).catch((e) => console.log('warm-up', String(e).slice(0, 80)));
        const resp = await page.goto(`http://oldbakery.kswd.ca${p}`, { waitUntil: 'load', timeout: 300_000 });
        await page.waitForTimeout(4000);
        const text = await page.evaluate(() => document.body?.innerText || '');
        const png = await page.screenshot({ fullPage: true });
        results[name][p] = { text, png, status: resp?.status() || 0 };
        fs.writeFileSync(`${SP}/${name}${p.replace(/\W+/g, '_') || '_'}.png`, png);
        await ctx.close();
      }
      await browser.close();
    } finally {
      try { process.kill(-next.pid!, 'SIGTERM'); } catch { /* gone */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (process.env.ONLY) { console.log('RESULT: debug done'); await fake.close(); process.exit(0); }
  let identical = true;
  for (const p of Object.keys(results.main)) {
    const a = results.main[p];
    const b = results.branch[p];
    const ia = await sharp(a.png).raw().toBuffer({ resolveWithObject: true });
    const ib = await sharp(b.png).raw().toBuffer({ resolveWithObject: true });
    const sameSize = ia.info.width === ib.info.width && ia.info.height === ib.info.height;
    let diff = 0;
    if (sameSize) for (let i = 0; i < ia.data.length; i++) if (ia.data[i] !== ib.data[i]) diff++;
    const ok = a.status === b.status && a.text === b.text && sameSize && diff === 0;
    identical &&= ok;
    console.log(`${p.padEnd(14)} status ${a.status}/${b.status}  text ${a.text === b.text ? 'same' : 'DIFFERENT'} (${a.text.length} chars)  pixels ${sameSize ? (diff === 0 ? 'identical' : `${diff} differ`) : `size ${ia.info.width}x${ia.info.height} vs ${ib.info.width}x${ib.info.height}`}`);
    if (a.text !== b.text) console.log('  main:', JSON.stringify(a.text.slice(0, 300)), '\n  branch:', JSON.stringify(b.text.slice(0, 300)));
  }
  console.log(identical ? 'RESULT: identical' : 'RESULT: differences found');
  await fake.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
