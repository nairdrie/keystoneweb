#!/usr/bin/env node
/**
 * Index the builder corpus into the builder_corpus pgvector table.
 *
 * Reads lib/ai/corpus/manifest.json + sites/*.json, distills each site into the
 * CorpusExemplar shape (structure + design tokens + a few copy samples), embeds
 * its embed_text, and upserts the row (keyed by slug).
 *
 * Usage:
 *   npm run rag:index
 *
 * Requires env (loaded from process.env, .env.local, or .env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RAG_EMBED_API_KEY (or OPENAI_API_KEY / VOYAGE_API_KEY)
 *   RAG_EMBED_PROVIDER (openai|voyage, default openai), RAG_EMBED_MODEL (optional)
 *
 * NOTE: the embedding dimension must match migration 093's vector(N).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'lib', 'ai', 'corpus');

// ── minimal .env loader (only fills missing keys) ──────────────────────────
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const PROVIDER = (process.env.RAG_EMBED_PROVIDER || 'openai').toLowerCase();
const PROVIDER_DEFAULTS = {
  openai: { model: 'text-embedding-3-small', url: 'https://api.openai.com/v1/embeddings' },
  voyage: { model: 'voyage-3', url: 'https://api.voyageai.com/v1/embeddings' },
};
const EMBED_MODEL = process.env.RAG_EMBED_MODEL || PROVIDER_DEFAULTS[PROVIDER]?.model;
const EMBED_URL = PROVIDER_DEFAULTS[PROVIDER]?.url;
const EMBED_KEY =
  process.env.RAG_EMBED_API_KEY ||
  (PROVIDER === 'voyage' ? process.env.VOYAGE_API_KEY : process.env.OPENAI_API_KEY);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ── copy-sample extraction (one compact sample per notable block type) ──────
function txt(...vals) {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}
function heroText(data = {}) {
  const c = data.cards?.[0]?.content;
  if (c) return [txt(c.title?.value), txt(c.subtitle?.value)].filter(Boolean).join(' — ');
  return [txt(data.title), txt(data.subtitle)].filter(Boolean).join(' — ');
}
function itemsText(items = [], fields) {
  return items
    .slice(0, 3)
    .map((it) => {
      if (typeof it === 'string') return it;
      return fields.map((f) => txt(it[f])).filter(Boolean).join(': ');
    })
    .filter(Boolean)
    .join(' | ');
}
function sampleForBlock(blockType, data = {}) {
  switch (blockType) {
    case 'hero': return heroText(data);
    case 'servicesGrid': return txt(data.title) + ' — ' + itemsText(data.items, ['title', 'description']);
    case 'featuresList': return txt(data.title) + ' — ' + itemsText(data.items, ['title', 'description']);
    case 'faq': return itemsText(data.items, ['question', 'answer']);
    case 'testimonials': return itemsText(data.items, ['quote', 'name']);
    case 'stats': return itemsText(data.items, ['value', 'label']);
    case 'pricing': return itemsText(data.tiers || data.items, ['name', 'description']);
    case 'featuredQuote': return txt(data.quote);
    case 'aboutImageText': return [txt(data.title), txt(data.description)].filter(Boolean).join(' — ');
    case 'cta': return [txt(data.title), txt(data.subtitle), txt(data.buttonText)].filter(Boolean).join(' — ');
    case 'menu': return [txt(data.menuTitle), txt(data.menuSubtitle)].filter(Boolean).join(' — ');
    case 'timeline': return txt(data.title) + ' — ' + itemsText(data.items, ['title', 'description']);
    default: return txt(data.title, data.menuTitle, data.subtitle);
  }
}
function extractCopyExemplars(site) {
  const seen = new Set();
  const out = [];
  for (const page of site.pages || []) {
    for (const block of page.blocks || []) {
      if (seen.has(block.blockType)) continue;
      const sample = sampleForBlock(block.blockType, block.data || {});
      if (sample && sample.length > 8) {
        out.push({ blockType: block.blockType, sample: sample.slice(0, 320) });
        seen.add(block.blockType);
      }
    }
    if (out.length >= 10) break;
  }
  return out;
}

function distill(site, manifestItem) {
  const embedText =
    manifestItem?.embedText ||
    [site.category, site.businessType, site.styleFamily, site.siteTitle, site.voice, site.metadata?.tone,
      (site.metadata?.tags || []).join(' '), site.metadata?.structureNotes]
      .filter(Boolean)
      .join(' | ');

  const payload = {
    slug: site.slug,
    category: site.category,
    businessType: site.businessType,
    styleFamily: site.styleFamily,
    siteTitle: site.siteTitle,
    voice: site.voice || '',
    tone: site.metadata?.tone || '',
    tags: site.metadata?.tags || [],
    structureNotes: site.metadata?.structureNotes || '',
    pages: (site.pages || []).map((p) => ({
      slug: p.slug,
      title: p.title,
      displayName: p.displayName || p.title,
      role: p.role || p.slug,
      blockTypes: (p.blocks || []).map((b) => b.blockType),
    })),
    designTokens: site.designTokens || {},
    copyExemplars: extractCopyExemplars(site),
  };

  return { embedText, payload };
}

async function embedBatch(texts) {
  if (!EMBED_URL) fail(`Unknown RAG_EMBED_PROVIDER "${PROVIDER}" (use openai|voyage)`);
  const body = { model: EMBED_MODEL, input: texts };
  if (PROVIDER === 'voyage') body.input_type = 'document';
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMBED_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Embedding API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.data || [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((r) => r.embedding);
}

async function main() {
  const dry = process.argv.includes('--dry');
  if (!dry) {
    if (!SUPABASE_URL || !SERVICE_KEY) fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    if (!EMBED_KEY) fail('Missing embedding key (RAG_EMBED_API_KEY / OPENAI_API_KEY / VOYAGE_API_KEY)');
  }

  const manifestPath = path.join(CORPUS_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) fail(`No manifest at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const byslug = new Map((manifest.items || []).map((i) => [i.slug, i]));

  const sitesDir = path.join(CORPUS_DIR, 'sites');
  const files = fs.readdirSync(sitesDir).filter((f) => f.endsWith('.json')).sort();
  console.log(`Distilling ${files.length} sites from ${sitesDir} …`);

  const rows = [];
  for (const f of files) {
    const site = JSON.parse(fs.readFileSync(path.join(sitesDir, f), 'utf8'));
    const { embedText, payload } = distill(site, byslug.get(site.slug));
    rows.push({
      slug: site.slug,
      category: site.category || 'general',
      business_type: site.businessType || 'services',
      style_family: site.styleFamily || null,
      tags: site.metadata?.tags || [],
      embed_text: embedText,
      payload,
    });
  }

  if (dry) {
    for (const r of rows) {
      console.log(
        `- ${r.slug} [${r.category}/${r.business_type}] pages=${r.payload.pages.length} ` +
          `copy=${r.payload.copyExemplars.length} palette=${JSON.stringify(r.payload.designTokens.customColors || {})}`,
      );
      const c0 = r.payload.copyExemplars[0];
      if (c0) console.log(`    e.g. ${c0.blockType}: ${c0.sample.slice(0, 100)}`);
    }
    console.log(`\n(dry run) distilled ${rows.length} rows — skipping embed + upsert.`);
    return;
  }

  console.log(`Embedding ${rows.length} texts via ${PROVIDER}/${EMBED_MODEL} …`);
  const embeddings = await embedBatch(rows.map((r) => r.embed_text));
  if (embeddings.length !== rows.length) fail(`Embedding count mismatch: ${embeddings.length} vs ${rows.length}`);
  console.log(`  → embedding dimension: ${embeddings[0]?.length}`);

  rows.forEach((r, i) => {
    // pgvector accepts the textual '[a,b,c]' form via PostgREST.
    r.embedding = '[' + embeddings[i].join(',') + ']';
  });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Upserting into builder_corpus …');
  const { error } = await supabase.from('builder_corpus').upsert(rows, { onConflict: 'slug' });
  if (error) fail(`Upsert failed: ${error.message}`);

  console.log(`\n✓ Indexed ${rows.length} corpus sites into builder_corpus.`);
  console.log(`  categories: ${[...new Set(rows.map((r) => r.category))].sort().join(', ')}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
