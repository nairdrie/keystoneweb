/**
 * Local sandbox for trying the v2 editor (and Archie) in a browser without a real Supabase:
 * fake Supabase + `next dev` on :3200 (NEXT_PORT / SUPA_PORT to change), seeded with the e2e sample site.
 *
 *   npx tsx scripts/dev-v2-archie.ts
 *
 * Prints the editor URL and the auth cookie to set (document.cookie) in your browser.
 * Archie calls the real Claude API with AI_BUILDER_API_KEY from your .env files.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { startFakeSupabase } from './fixtures/fake-supabase-server';
import { hashToken } from '../lib/v2/api-tokens';

// Not the e2e test's ports (3100 / 54321), so both can run at once.
const NEXT_PORT = Number(process.env.NEXT_PORT) || 3200;
const SUPA_PORT = Number(process.env.SUPA_PORT) || 54331;
const BASE = `http://localhost:${NEXT_PORT}`;
const OWNER = '11111111-1111-1111-1111-111111111111';
const TOKEN = `ks_pat_dev${'x'.repeat(36)}`;

const SECTIONS: Record<string, { name: string; html: string }> = {
  header: {
    name: 'Header',
    html: `<header class="bar wrap"><a href="/" class="brand"><span data-ks="@site.name">Northline</span></a>
<nav><ul data-ks-nav><li><a href="/">Home</a></li></ul></nav>
<a class="btn call" data-ks="@business.phone" href="tel:">(905) 555-0100</a></header>
<style>.bar{display:flex;align-items:center;gap:2rem;padding:1.25rem 0}.brand{font:700 1.4rem var(--font-display);text-decoration:none}
nav{margin-left:auto}nav ul{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0}nav a{text-decoration:none;font-weight:500}</style>`,
  },
  hero: {
    name: 'Hero — headline and photo',
    html: `<section class="hero wrap">
<div class="copy"><p class="eyebrow" data-ks="eyebrow">Oakville · Since 1994</p>
<h1 data-ks="title">Roofs done <em>right</em>, the first time.</h1>
<div class="intro" data-ks="intro" data-ks-type="richtext"><p>Family-owned crews, written warranties, and a spotless site when we leave.</p></div>
<div class="ctas"><a class="btn" data-ks="cta" href="/">Get a free quote</a></div></div>
<div class="art"><svg class="blob" viewBox="0 0 200 200" aria-hidden="true"><path fill="currentColor" d="M44.7,-58.2C57.6,-49.6,67.3,-35.7,71.5,-20.2C75.7,-4.7,74.4,12.4,67.2,26.3C60,40.2,47,50.9,32.4,58.6C17.8,66.3,1.6,71,-15.6,69.4C-32.8,67.8,-51,59.9,-62.1,46.1C-73.2,32.3,-77.2,12.6,-74.4,-5.6C-71.6,-23.8,-62,-40.5,-48.4,-49.2C-34.8,-57.9,-17.4,-58.6,-0.3,-58.2C16.8,-57.8,31.8,-66.8,44.7,-58.2Z" transform="translate(100 100)"/></svg>
<img class="photo" data-ks="photo" src="/templates/airy.png" alt="A finished roof"></div></section>
<style>.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:4rem;align-items:center;padding:4rem 0 6rem}
.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.8rem;color:var(--brand);font-weight:700}
h1{font-size:clamp(2.8rem,6.5vw,5.6rem);font-weight:800}h1 em{color:var(--brand)}.intro{font-size:1.15rem;max-width:34ch;opacity:.85}
.ctas{display:flex;gap:.75rem;margin:2rem 0}.art{position:relative}.blob{position:absolute;inset:-12% -10% auto auto;width:80%;color:var(--brand);opacity:.18;z-index:0}
.photo{position:relative;z-index:1;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:28px}</style>`,
  },
  footer: {
    name: 'Footer',
    html: `<footer class="foot wrap"><p data-ks="blurb">Northline Roofing — family-owned in Oakville.</p></footer>
<style>.foot{padding:2.5rem 0;border-top:1px solid #e3dcd2;font-size:.9rem}</style>`,
  },
};

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
.btn{display:inline-flex;align-items:center;padding:.9rem 1.4rem;border-radius:999px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600}
h1,h2,h3{font-family:var(--font-display);line-height:1;letter-spacing:-.02em;margin:0}`,
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

async function tool(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
  });
  const body = await res.json();
  const data = JSON.parse(body.result.content[0].text);
  if (body.result.isError) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const fake = await startFakeSupabase(SUPA_PORT);
  const { db } = fake;
  db.table('users').push({ id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false });
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });
  db.table('api_tokens').push({ id: 'tok-dev', name: 'Dev agent', user_id: OWNER, token_hash: hashToken(TOKEN), scopes: ['sites:read', 'sites:write'], revoked_at: null, expires_at: null, last_used_at: null });
  const auth = fake.addSession({ id: OWNER, email: 'owner@example.com' });

  const next = spawn('npx', ['next', 'dev', '-p', String(NEXT_PORT)], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      KS_V2_PREVIEW_SECRET: 'dev-secret',
      NEXT_PUBLIC_APP_URL: BASE,
      RESEND_API_KEY: 're_dummy_key',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.on('SIGINT', () => { next.kill(); process.exit(0); });

  await waitForHttp(`${BASE}/api/v2/engine`, 300_000);
  const created = await tool('create_site', { name: 'Northline Roofing', business: { phone: '+1 905-555-0199', city: 'Oakville', region: 'ON' } });
  const siteId = created.site_id;
  await tool('set_theme', { site_id: siteId, ...THEME });
  for (const [key, s] of Object.entries(SECTIONS)) await tool('put_section', { site_id: siteId, key, name: s.name, html: s.html });
  await tool('set_layout', { site_id: siteId, header: 'header', footer: 'footer' });
  await tool('put_page', { site_id: siteId, slug: 'home', title: 'Home', sections: [{ section: 'hero', id: 'home-hero' }] });

  console.log(`\n[dev-v2-archie] ready\n  editor: ${BASE}/design?siteId=${siteId}\n  cookie: ${auth.cookieName}=${auth.cookieValue}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
