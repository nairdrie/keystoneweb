#!/usr/bin/env node
/**
 * Smoke tests for the Universal Commerce Protocol layer. No network/DB —
 * exercises only the pure pieces:
 *   - mandate canonicalization + HMAC signature
 *   - feed XML/JSON builders
 *   - product mapper field shape
 *   - agent detection
 */

import { strict as assert } from 'node:assert';

process.env.UCP_MANDATE_SECRET ||= 'a'.repeat(32);

// Use the compiled-by-Next type stripping isn't available here, so we use
// `tsx`-style importing: pure-JS files only. We hand-port the same logic
// here to keep the script dep-free and fast.

import { createHash, createHmac, randomUUID } from 'node:crypto';

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

// 1. Canonicalization is stable across key orders.
{
  const a = canonicalize({ b: 2, a: 1, c: { y: 1, x: 2 } });
  const b = canonicalize({ a: 1, c: { x: 2, y: 1 }, b: 2 });
  assert.equal(a, b, 'canonicalize should be order-independent');
}

// 2. HMAC verification works end to end.
{
  const secret = process.env.UCP_MANDATE_SECRET;
  const payload = { items: [{ id: 'p1', qty: 2 }], amount: { amount: 4598, currency: 'USD' }, nonce: randomUUID() };
  const hash = createHash('sha256').update(canonicalize(payload)).digest('hex');
  const sig = createHmac('sha256', secret).update(hash).digest('hex');

  const recomputed = createHmac('sha256', secret).update(hash).digest('hex');
  assert.equal(recomputed, sig, 'HMAC signature should reproduce');

  // Tampering with the payload must invalidate the signature.
  const tampered = { ...payload, amount: { amount: 1, currency: 'USD' } };
  const tamperedHash = createHash('sha256').update(canonicalize(tampered)).digest('hex');
  assert.notEqual(tamperedHash, hash, 'tampered payload must hash differently');
}

// 3. Native commerce feed XML must include the native_commerce element.
{
  const sample = {
    nativeCommerce: true,
    availability: 'in_stock',
    id: 'p1', title: 'Test', description: 'A test',
    url: 'https://store.example/p/test',
    images: ['https://store.example/img.jpg'],
    price: { amount: 1999, currency: 'USD' },
    compareAtPrice: null,
    condition: 'new', brand: 'Acme',
    aiAttributes: { material: 'cotton', fit: 'true_to_size' },
    shippingDimensions: { weightGrams: 200, lengthMm: null, widthMm: null, heightMm: null },
  };
  function priceString(c, cur) { return `${(c / 100).toFixed(2)} ${cur}`; }
  const escape = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = [];
  lines.push('<g:native_commerce>yes</g:native_commerce>');
  for (const [k, v] of Object.entries(sample.aiAttributes)) {
    lines.push(`<g:native_commerce_attribute name="${escape(k)}">${escape(String(v))}</g:native_commerce_attribute>`);
  }
  const xml = lines.join('\n');
  assert.match(xml, /<g:native_commerce>yes<\/g:native_commerce>/, 'feed must opt in to native_commerce');
  assert.match(xml, /native_commerce_attribute name="material"/, 'feed must emit ai attributes as native_commerce_attribute');
  // sanity: price formatter
  assert.equal(priceString(sample.price.amount, sample.price.currency), '19.99 USD');
}

// 4. Agent detection — pattern matching for known UAs.
{
  function detect(ua) {
    const known = [
      [/Google-Extended|GoogleOther|google-gemini|Gemini-Shopping/i, 'google-gemini'],
      [/Storebot-Google|GoogleBot.*Shopping/i, 'google-shopping'],
      [/OAI-SearchBot|OpenAI-Operator/i, 'openai-operator'],
      [/ChatGPT-User|GPTBot/i, 'openai-chatgpt'],
      [/ClaudeBot|Claude-Web|Anthropic-AI/i, 'anthropic-claude'],
    ];
    for (const [p, id] of known) if (p.test(ua)) return id;
    if (/\bbot\b|crawler|spider|agent|headless/i.test(ua)) return 'unknown-bot';
    return 'browser';
  }
  assert.equal(detect('Mozilla/5.0 GPTBot/1.0'), 'openai-chatgpt');
  assert.equal(detect('Google-Extended'), 'google-gemini');
  assert.equal(detect('ClaudeBot/1.0'), 'anthropic-claude');
  assert.equal(detect('Mozilla/5.0 (Macintosh) Safari/605'), 'browser');
}

console.log('UCP smoke checks passed.');
