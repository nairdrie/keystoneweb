/**
 * Store setup over MCP + Printful fulfillment, against an in-memory database
 * and a mocked Printful API (no real Printful account needed):
 * variants/options/slugs on upsert_products, the readiness checklist, the
 * Printful connection (encrypted, never returned), listing and linking
 * Printful products (variant mapping computed from Printful's data), paid
 * order → Printful order, webhook signature, shipment sync and failures.
 * Run: npx tsx scripts/verify-printful.ts
 */
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';

process.env.RESEND_API_KEY ||= 're_test_dummy';
process.env.KS_V2_PREVIEW_SECRET ||= 'test-secret';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://keystoneweb.ca';
process.env.CREDENTIALS_ENCRYPTION_KEY ||= randomBytes(32).toString('hex');

// ── Printful mock ────────────────────────────────────────────────────────────
const PF_TOKEN = 'pf_private_token_abcdefghijklmnopqrstuvwxyz';
const WEBHOOK_SECRET = randomBytes(32).toString('hex');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- recorded request bodies are free-form JSON
const calls: Array<{ method: string; url: URL; body: any; auth: string | null }> = [];
let nextOrderStatus = 'draft';
let orderShipments: unknown[] = [];

const variant = (id: number, color: string, size: string, price: string, extra: Record<string, unknown> = {}) => ({
  id, external_id: `ext${id}`, sync_product_id: 501, name: `Logo Tee / ${color} / ${size}`, synced: true, variant_id: 4000 + id,
  retail_price: price, currency: 'CAD', is_ignored: false, sku: `SKU${id}`, size, color, availability_status: 'active',
  product: { variant_id: 4000 + id, product_id: 71, image: `https://files.cdn.printful.com/blank-${color}.png`, name: 'Unisex Tee' },
  files: [{ type: 'default', preview_url: 'https://files.cdn.printful.com/print.png' }, { type: 'preview', preview_url: `https://files.cdn.printful.com/mockup-${color}.png` }],
  ...extra,
});
const TEE = {
  sync_product: { id: 501, external_id: 'x', name: 'Logo Tee', variants: 6, synced: 6, thumbnail_url: 'https://files.cdn.printful.com/thumb-501.png', is_ignored: false },
  sync_variants: [
    variant(9001, 'Black', 'M', '25.00'), variant(9002, 'Black', 'L', '25.00'), variant(9003, 'Black', '2XL', '28.00'),
    variant(9004, 'White', 'M', '25.00'), variant(9005, 'White', 'L', '25.00'), variant(9006, 'White', '2XL', '28.00'),
    variant(9007, 'White', '3XL', '30.00', { is_ignored: true }),
  ],
};
const MUG = {
  sync_product: { id: 502, name: 'Logo Mug', variants: 1, synced: 1, thumbnail_url: 'https://files.cdn.printful.com/thumb-502.png' },
  sync_variants: [{ id: 9101, name: 'Logo Mug / 11 oz', retail_price: '18.00', currency: 'CAD', is_ignored: false, size: '11 oz', color: null, files: [] }],
};

let pngBytes: Buffer;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method || 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form JSON
  let body: any = null;
  try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { body = String(init?.body); }
  if (url.hostname === 'files.cdn.printful.com') return new Response(new Uint8Array(pngBytes), { status: 200, headers: { 'content-type': 'image/png' } });
  if (url.hostname !== 'api.printful.com') return json(503, { error: 'offline in tests' });
  calls.push({ method, url, body, auth: headers.get('authorization') });
  if (headers.get('authorization') !== `Bearer ${PF_TOKEN}`) return json(401, { code: 401, result: 'Unauthorized', error: { message: 'Bad token' } });
  const path = url.pathname;
  if (path === '/v2/stores') return json(200, { data: [{ id: 777, type: 'native', name: 'Northline Merch' }] });
  if (path === '/v2/webhooks' && method === 'POST') return json(200, { data: { default_url: body.default_url, events: body.events, public_key: 'pk', secret_key: WEBHOOK_SECRET } });
  if (path === '/store/products') return json(200, { code: 200, paging: { total: 2, offset: 0, limit: 20 }, result: [TEE.sync_product, MUG.sync_product] });
  if (path === '/store/products/501') return json(200, { code: 200, result: TEE });
  if (path === '/store/products/502') return json(200, { code: 200, result: MUG });
  if (path.startsWith('/store/products/')) return json(404, { code: 404, result: 'Not found', error: { message: 'Not found' } });
  if (path === '/orders' && method === 'POST') return json(200, { code: 200, result: { id: 3301, external_id: body.external_id, status: url.searchParams.get('confirm') === 'true' ? 'pending' : nextOrderStatus, shipments: [] } });
  if (path === '/orders/3301') return json(200, { code: 200, result: { id: 3301, external_id: calls.find((c) => c.url.pathname === '/orders' && c.method === 'POST')?.body.external_id, status: nextOrderStatus, shipments: orderShipments } });
  if (path.startsWith('/orders/@')) return json(404, { code: 404, result: 'Not found', error: { message: 'Not found' } });
  return json(404, { code: 404, result: 'Not found', error: { message: `no mock for ${method} ${path}` } });
}) as typeof fetch;

async function main() {
  const sharp = (await import('sharp')).default;
  pngBytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#223344' } }).png().toBuffer();

  const { FakeSupabase } = await import('./fixtures/fake-supabase');
  const { handleMcpHttp } = await import('../lib/v2/mcp-server');
  const { hashToken } = await import('../lib/v2/api-tokens');
  const { mapSyncProduct, lineSelection, findVariantLink } = await import('../lib/printful/mapping');
  const { encryptSecret, decryptSecret } = await import('../lib/crypto/secret-box');
  const { saveConnection } = await import('../lib/printful/connect');
  const { publicConnection, loadConnection } = await import('../lib/printful/client');
  const fulfillment = await import('../lib/printful/fulfillment');
  const { APP_URL } = await import('../lib/env/domain');

  const db = new FakeSupabase();
  const OWNER = '11111111-1111-1111-1111-111111111111';
  db.table('users').push({ id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false });
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });
  const token = `ks_pat_owner${'x'.repeat(30)}`;
  db.table('api_tokens').push({ id: 'tok', name: 'agent', user_id: OWNER, token_hash: hashToken(token), scopes: ['sites:read', 'sites:write'], revoked_at: null, expires_at: null, last_used_at: null });

  let rpcId = 0;
  async function tool(name: string, args: Record<string, unknown>) {
    const res = await handleMcpHttp(db as never, `Bearer ${token}`, { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } });
    const body = res.body as { result: { isError?: boolean; content: Array<{ text: string }> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form tool JSON
    return { isError: !!body.result.isError, data: JSON.parse(body.result.content[0].text) as Record<string, any> };
  }
  async function ok(name: string, args: Record<string, unknown>) {
    const r = await tool(name, args);
    assert.equal(r.isError, false, `${name} failed: ${JSON.stringify(r.data)}`);
    return r.data;
  }
  async function fails(name: string, args: Record<string, unknown>, re: RegExp) {
    const r = await tool(name, args);
    assert.equal(r.isError, true, `${name} should fail`);
    assert.match(JSON.stringify(r.data), re);
  }

  let passed = 0;
  const step = async (label: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  };
  console.log('store setup + Printful');

  await step('variant mapping: price-driving size → option, colour → variant; ignored variants dropped', async () => {
    const m = mapSyncProduct(TEE as never);
    assert.equal(m.priceCents, 2500);
    assert.equal(m.currency, 'CAD');
    assert.deepEqual(m.variants, [{ name: 'Color', options: ['Black', 'White'] }]);
    assert.deepEqual(m.options, [{ name: 'Size', defaultIndex: 0, values: [{ label: 'M', priceModifierCents: 0 }, { label: 'L', priceModifierCents: 0 }, { label: '2XL', priceModifierCents: 300 }] }]);
    assert.equal(m.links.length, 6, '3XL is ignored in Printful');
    assert.equal(findVariantLink(m.links, lineSelection({ variants: { Color: 'White' }, options: { Size: '2XL' } }, m.options))?.sync_variant_id, 9006);
    assert.equal(findVariantLink(m.links, lineSelection({ variants: { Color: 'Black' } }, m.options))?.sync_variant_id, 9001, 'default option value');
    assert.equal(findVariantLink(m.links, lineSelection({ variants: { Color: 'Gold' } }, m.options)), null);
    assert.ok(m.imageUrls.includes('https://files.cdn.printful.com/mockup-Black.png') && m.imageUrls.includes('https://files.cdn.printful.com/mockup-White.png'));
    assert.ok(!m.imageUrls.includes('https://files.cdn.printful.com/print.png'), 'print files are not product images');

    const same = mapSyncProduct({ ...TEE, sync_variants: TEE.sync_variants.map((v) => ({ ...v, retail_price: '25.00' })) } as never);
    assert.deepEqual(same.variants.map((v) => v.name), ['Color', 'Size']);
    assert.equal(same.options.length, 0);

    const combo = mapSyncProduct({ ...TEE, sync_variants: [variant(1, 'Black', 'M', '25.00'), variant(2, 'Black', 'L', '27.00'), variant(3, 'White', 'M', '26.00'), variant(4, 'White', 'L', '25.00')] } as never);
    assert.equal(combo.options[0].name, 'Style');
    assert.deepEqual(combo.options[0].values.map((v) => [v.label, v.priceModifierCents]), [['Black / M', 0], ['Black / L', 200], ['White / M', 100], ['White / L', 0]]);
    assert.equal(findVariantLink(combo.links, lineSelection({ options: { Style: 'White / M' } }, combo.options))?.sync_variant_id, 3);

    const single = mapSyncProduct(MUG as never);
    assert.equal(single.variants.length + single.options.length, 0);
    assert.equal(findVariantLink(single.links, {})?.sync_variant_id, 9101);
  });

  await step('credentials encryption round-trips and is not plaintext; webhook signatures verify', async () => {
    const box = encryptSecret('secret-value');
    assert.ok(!box.includes('secret-value'));
    assert.equal(decryptSecret(box), 'secret-value');
    const raw = '{"type":"shipment_sent"}';
    const sig = createHmac('sha256', Buffer.from(WEBHOOK_SECRET, 'hex')).update(raw).digest('hex');
    assert.equal(fulfillment.verifyWebhookSignature(raw, sig, WEBHOOK_SECRET), true);
    assert.equal(fulfillment.verifyWebhookSignature(raw + ' ', sig, WEBHOOK_SECRET), false);
    assert.equal(fulfillment.verifyWebhookSignature(raw, null, WEBHOOK_SECRET), false);
  });

  let siteId = '';
  await step('upsert_products: variants, options with price modifiers, unique slugs, partial updates', async () => {
    siteId = (await ok('create_site', { name: 'Northline Roofing', business_type: 'products' })).site_id;
    const created = await ok('upsert_products', { site_id: siteId, products: [
      { name: 'Work Jacket', price_cents: 8900, variants: [{ name: 'Colour', options: ['Navy', 'Navy', 'Olive'] }], options: [{ name: 'Size', values: [{ label: 'M', priceModifierCents: 0 }, { label: '2XL', priceModifierCents: 500 }] }] },
      { name: 'Work Jacket', price_cents: 9900 },
    ] });
    const [a, b] = created.products.map((p: { id: string }) => db.table('products').find((r) => r.id === p.id)!);
    assert.equal(a.slug, 'work-jacket');
    assert.equal(b.slug, 'work-jacket-2', 'slugs are unique per site');
    assert.equal(a.status, 'published');
    assert.deepEqual(a.variants, [{ name: 'Colour', options: ['Navy', 'Olive'] }]);
    assert.deepEqual(a.options, [{ name: 'Size', defaultIndex: 0, values: [{ label: 'M', priceModifierCents: 0 }, { label: '2XL', priceModifierCents: 500 }] }]);
    assert.equal(created.products[0].url, `/product/${a.id}`);

    await ok('upsert_products', { site_id: siteId, products: [{ id: a.id, description: 'Waxed canvas.' }] });
    const again = db.table('products').find((r) => r.id === a.id)!;
    assert.equal(again.price_cents, 8900, 'fields not passed are kept');
    assert.equal(again.description, 'Waxed canvas.');
    assert.equal((again.variants as unknown[]).length, 1);

    await fails('upsert_products', { site_id: siteId, products: [{ name: 'Bad', price_cents: 100, options: [{ name: 'Size', values: [{ label: 'S', priceModifierCents: -100 }] }] }] }, /0 or more/);
    await fails('upsert_products', { site_id: siteId, products: [{ name: 'Clash', price_cents: 100, variants: [{ name: 'Size', options: ['S'] }], options: [{ name: 'Size', values: [{ label: 'S' }] }] }] }, /both a variant and an option/);
    await fails('upsert_products', { site_id: siteId, products: [{ name: 'No price' }] }, /price_cents is required/);
  });

  await step('get_store_readiness: owner steps with Admin links; Printful tools need the connection', async () => {
    const r = await ok('get_store_readiness', { site_id: siteId });
    const byId = Object.fromEntries(r.steps.map((s: { id: string }) => [s.id, s]));
    assert.equal(r.ready, false);
    assert.equal(byId.payments.status, 'todo');
    assert.match(byId.payments.link, new RegExp(`/admin/ecommerce\\?siteId=${siteId}&tab=payments$`));
    assert.match(byId.payments.owner_action, /Only the owner/);
    assert.equal(byId.shipping.status, 'todo');
    assert.equal(byId.products.status, 'done');
    assert.equal(byId.fulfillment.status, 'done');
    assert.equal(byId.storefront.status, 'todo');
    await fails('list_printful_products', { site_id: siteId }, /not connected.*tab=fulfillment/);
    await fails('upsert_products', { site_id: siteId, products: [{ fulfillment: { provider: 'printful', printful_product_id: 501 } }] }, /not connected/);
  });

  await step('connect Printful: token encrypted at rest, store + signed webhook registered, nothing secret returned', async () => {
    const conn = await saveConnection(db as never, { siteId, userId: OWNER, authType: 'token', accessToken: PF_TOKEN });
    assert.equal(conn.store_id, 777);
    const row = db.table('printful_connections').find((r) => r.site_id === siteId)!;
    assert.ok(!JSON.stringify(row).includes(PF_TOKEN), 'token not stored in plaintext');
    assert.ok(!JSON.stringify(row).includes(WEBHOOK_SECRET), 'webhook secret not stored in plaintext');
    assert.ok(row.webhook_configured_at);
    const hook = calls.find((c) => c.url.pathname === '/v2/webhooks')!;
    assert.equal(hook.body.default_url, `${APP_URL}/api/printful/webhook?site=${siteId}`);
    assert.ok(hook.body.events.some((e: { type: string }) => e.type === 'shipment_sent'));
    const pub = JSON.stringify(publicConnection(await loadConnection(db as never, siteId)));
    assert.ok(!/token_enc|secret|Bearer/.test(pub));
    assert.equal(row.auto_confirm, false, 'drafts by default');
  });

  let teeId = '';
  await step('list_printful_products, then create a Keystone product from Printful (server-computed mapping)', async () => {
    const list = await ok('list_printful_products', { site_id: siteId });
    assert.equal(list.products.length, 2);
    const tee = list.products.find((p: { printful_product_id: number }) => p.printful_product_id === 501);
    assert.deepEqual(tee.price_range_cents, [2500, 2800]);
    assert.ok(tee.mockup_urls.length >= 2);
    assert.equal(tee.linked_keystone_product_id, null);
    assert.ok(!JSON.stringify(list).includes(PF_TOKEN));

    await fails('upsert_products', { site_id: siteId, products: [{ price_cents: 100, fulfillment: { provider: 'printful', printful_product_id: 501 } }] }, /Printful retail price/);
    await fails('upsert_products', { site_id: siteId, products: [{ variants: [{ name: 'Size', options: ['S'] }], fulfillment: { provider: 'printful', printful_product_id: 501 } }] }, /come from Printful/);
    await fails('upsert_products', { site_id: siteId, products: [{ fulfillment: { provider: 'printful', printful_product_id: 999 } }] }, /not found/i);

    const res = await ok('upsert_products', { site_id: siteId, products: [{ description: 'Our logo on a soft tee.', category: 'Merch', fulfillment: { provider: 'printful', printful_product_id: 501 } }] });
    const p = res.products[0];
    teeId = p.id;
    assert.equal(p.fulfillment, 'printful');
    assert.equal(p.price_cents, 2500);
    assert.equal(p.printful_variants_linked, 6);
    const row = db.table('products').find((r) => r.id === teeId)!;
    assert.equal(row.name, 'Logo Tee');
    assert.equal(row.slug, 'logo-tee');
    assert.equal(row.fulfillment_provider, 'printful');
    assert.equal(row.currency, 'CAD');
    assert.ok((row.images as string[]).length >= 2, 'mockups re-hosted in the media library');
    assert.ok((row.images as string[]).every((u) => !u.includes('printful.com')), 'images are Keystone-hosted copies');
    const link = db.table('printful_product_links').find((l) => l.product_id === teeId)!;
    assert.equal(link.sync_product_id, 501);
    assert.deepEqual((link.variants as Array<{ sync_variant_id: number }>).map((v) => v.sync_variant_id).sort(), [9001, 9002, 9003, 9004, 9005, 9006]);

    await fails('upsert_products', { site_id: siteId, products: [{ fulfillment: { provider: 'printful', printful_product_id: 501 } }] }, /already linked/);
    await fails('upsert_products', { site_id: siteId, products: [{ id: teeId, price_cents: 100 }] }, /follow Printful/);

    // Link an existing product (the mug was made by hand first).
    const mug = await ok('upsert_products', { site_id: siteId, products: [{ name: 'Mug', price_cents: 1000, images: ['https://cdn.example.com/mug.jpg'] }] });
    const linked = await ok('upsert_products', { site_id: siteId, products: [{ id: mug.products[0].id, fulfillment: { provider: 'printful', printful_product_id: 502 } }] });
    assert.equal(linked.products[0].price_cents, 1800);
    const mugRow = db.table('products').find((r) => r.id === mug.products[0].id)!;
    assert.deepEqual(mugRow.images, ['https://cdn.example.com/mug.jpg'], 'existing images kept');
    assert.equal(mugRow.name, 'Mug', 'existing name kept');

    const after = await ok('list_printful_products', { site_id: siteId, details: false });
    assert.equal(after.products.find((x: { printful_product_id: number }) => x.printful_product_id === 501).linked_keystone_product_id, teeId);
  });

  const order = (id: string, items: unknown[], extra: Record<string, unknown> = {}) => {
    db.table('orders').push({
      id, site_id: siteId, items, subtotal_cents: 2800, shipping_cents: 900, status: 'confirmed', payment_status: 'paid', payment_method: 'stripe',
      customer_name: 'Ada Buyer', customer_email: 'ada@example.com', customer_phone: null,
      shipping_address: { line1: '1 Main St', city: 'Toronto', region: 'Ontario', postal: 'M5V 1A1', country: 'CA' }, ...extra,
    });
  };

  const ORDER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  await step('paid order → one Printful draft order with the right sync variant; idempotent', async () => {
    order(ORDER, [{ productId: teeId, name: 'Logo Tee', price_cents: 2800, currency: 'CAD', qty: 2, variants: { Color: 'White' }, options: { Size: '2XL' } }]);
    const r = await fulfillment.fulfillPaidOrder(db as never, ORDER);
    assert.equal(r.ok, true, JSON.stringify(r));
    const post = calls.filter((c) => c.url.pathname === '/orders' && c.method === 'POST');
    assert.equal(post.length, 1);
    assert.equal(post[0].url.searchParams.get('confirm'), 'false');
    assert.equal(post[0].body.external_id, ORDER.replace(/-/g, ''));
    assert.deepEqual(post[0].body.items.map((i: { sync_variant_id: number; quantity: number }) => [i.sync_variant_id, i.quantity]), [[9006, 2]]);
    assert.equal(post[0].body.recipient.state_code, 'ON');
    assert.equal(post[0].body.recipient.country_code, 'CA');
    const rec = db.table('printful_orders').find((o) => o.order_id === ORDER)!;
    assert.equal(rec.status, 'draft');
    assert.equal(rec.printful_order_id, 3301);

    const again = await fulfillment.fulfillPaidOrder(db as never, ORDER);
    assert.equal((again as { skipped?: string }).skipped, 'already sent to Printful');
    assert.equal(calls.filter((c) => c.url.pathname === '/orders' && c.method === 'POST').length, 1);

    const unpaid = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
    order(unpaid, [{ productId: teeId, qty: 1, variants: { Color: 'Black' } }], { payment_status: 'unpaid' });
    assert.equal((await fulfillment.fulfillPaidOrder(db as never, unpaid) as { skipped?: string }).skipped, 'not a paid order');
  });

  await step('shipment sync: tracking saved, order marked shipped, only new shipments counted', async () => {
    nextOrderStatus = 'fulfilled';
    orderShipments = [{ id: 1, carrier: 'Canada Post', service: 'Standard', tracking_number: 'CP123', tracking_url: 'https://track/CP123' }];
    const rec = db.table('printful_orders').find((o) => o.order_id === ORDER)!;
    const r = await fulfillment.syncPrintfulOrder(db as never, rec as never);
    assert.equal(r.ok, true);
    assert.equal((r as { new_shipments: number }).new_shipments, 1);
    const o = db.table('orders').find((x) => x.id === ORDER)!;
    assert.equal(o.tracking_number, 'CP123');
    assert.equal(o.tracking_carrier, 'Canada Post');
    assert.equal(o.status, 'shipped');
    const rec2 = db.table('printful_orders').find((x) => x.order_id === ORDER)!;
    assert.equal(rec2.status, 'fulfilled');
    const r2 = await fulfillment.syncPrintfulOrder(db as never, rec2 as never);
    assert.equal((r2 as { new_shipments: number }).new_shipments, 0);
  });

  await step('unfulfillable orders fail visibly: unmatched choice, no address; retry works once fixed', async () => {
    const bad = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';
    order(bad, [{ productId: teeId, qty: 1, variants: { Color: 'Gold' } }]);
    const r = await fulfillment.fulfillPaidOrder(db as never, bad);
    assert.equal(r.ok, false);
    const rec = db.table('printful_orders').find((x) => x.order_id === bad)!;
    assert.equal(rec.status, 'failed');
    assert.match(String(rec.error), /No Printful variant matches "Logo Tee" \(Gold/);

    const noAddr = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003';
    order(noAddr, [{ productId: teeId, qty: 1, variants: { Color: 'Black' } }], { shipping_address: null });
    assert.equal((await fulfillment.fulfillPaidOrder(db as never, noAddr)).ok, false);
    assert.match(String(db.table('printful_orders').find((x) => x.order_id === noAddr)!.error), /shipping address/);

    // Owner fixes the order's choice, then retries.
    const o = db.table('orders').find((x) => x.id === bad)!;
    o.items = [{ productId: teeId, qty: 1, variants: { Color: 'Black' }, options: { Size: 'L' } }];
    nextOrderStatus = 'draft';
    const retried = await fulfillment.retryPrintfulOrder(db as never, siteId, bad);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(db.table('printful_orders').find((x) => x.order_id === bad)!.attempts, 2);
    await assert.rejects(() => fulfillment.retryPrintfulOrder(db as never, siteId, bad), /Only failed/);
  });

  await step('readiness reports Printful fulfillment and failures; auto-confirm sends confirm=true', async () => {
    const r = await ok('get_store_readiness', { site_id: siteId });
    const byId = Object.fromEntries(r.steps.map((s: { id: string }) => [s.id, s]));
    assert.match(byId.fulfillment.detail, /Printful: 2/);
    assert.match(byId.fulfillment.detail, /drafts/);
    assert.equal(byId.printful_orders.status, 'attention');
    assert.match(byId.printful_orders.link, /tab=fulfillment/);

    db.table('printful_connections').find((c) => c.site_id === siteId)!.auto_confirm = true;
    const auto = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000004';
    order(auto, [{ productId: teeId, qty: 1, variants: { Color: 'Black' } }]);
    await fulfillment.fulfillPaidOrder(db as never, auto);
    const post = calls.filter((c) => c.url.pathname === '/orders' && c.method === 'POST').pop()!;
    assert.equal(post.url.searchParams.get('confirm'), 'true');
    assert.equal(db.table('printful_orders').find((x) => x.order_id === auto)!.confirmed, true);

    // Unlinking returns the product to self-fulfilment.
    await ok('upsert_products', { site_id: siteId, products: [{ id: teeId, fulfillment: { provider: 'self' } }] });
    assert.equal(db.table('products').find((p) => p.id === teeId)!.fulfillment_provider, null);
    assert.equal(db.table('printful_product_links').some((l) => l.product_id === teeId), false);
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
