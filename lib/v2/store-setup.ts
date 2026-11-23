/**
 * Store setup for agents (MCP): products with variants/options and
 * fulfillment (self / vendor / Printful), Printful product listing, and the
 * store readiness checklist.
 *
 * Printful data (variants, prices, mockups, sync variant ids) is always read
 * from Printful by the server through the site's own connection; the model
 * only names a Printful product id, which Printful itself scopes to the
 * connected store.
 */
import { APP_URL } from '@/lib/env/domain';
import { parseProductOptions, type ProductOptionGroup } from '@/lib/ecommerce/resolve-price';
import { getSyncProduct, listSyncProducts, loadConnection, PrintfulError, publicConnection, type PfSyncProduct } from '@/lib/printful/client';
import { mapSyncProduct, type MappedProduct, type VariantLink } from '@/lib/printful/mapping';
import { featuresIn } from './collections';
import { importImageFromUrl } from './media';
import { OpError } from './ops';
import { safeSrc, toPlainText } from './sanitize';
import type { Db } from './store';

type Json = Record<string, unknown>;

export const adminLink = (siteId: string, tab: string) => `${APP_URL}/admin/ecommerce?siteId=${siteId}&tab=${tab}`;

function pfError(e: unknown): never {
  if (e instanceof PrintfulError) throw new OpError(e.message, e.status === 404 ? 404 : e.status === 401 ? 409 : 502);
  throw e;
}

async function requireConnection(db: Db, siteId: string) {
  const conn = await loadConnection(db, siteId);
  if (!conn) {
    throw new OpError(`Printful is not connected for this site. Ask the owner to connect it in Admin → Ecommerce → Fulfillment (${adminLink(siteId, 'fulfillment')}), then try again.`, 409);
  }
  return conn;
}

// ── Input parsing ──────────────────────────────────────────────────────────

const text = (v: unknown, max: number) => toPlainText(String(v ?? '')).replace(/\s+/g, ' ').trim().slice(0, max);

export function parseVariantsInput(raw: unknown, where: string): Array<{ name: string; options: string[] }> {
  if (!Array.isArray(raw)) throw new OpError(`${where}.variants must be an array of { name, options[] }`);
  const out: Array<{ name: string; options: string[] }> = [];
  for (const [i, g] of raw.slice(0, 10).entries()) {
    const name = text((g as Json)?.name, 60);
    const options = [...new Set((Array.isArray((g as Json)?.options) ? ((g as Json).options as unknown[]) : []).map((o) => text(o, 60)).filter(Boolean))].slice(0, 100);
    if (!name || !options.length) throw new OpError(`${where}.variants[${i}] needs a name and at least one option`);
    if (out.some((x) => x.name === name)) throw new OpError(`${where}.variants has "${name}" twice`);
    out.push({ name, options });
  }
  return out;
}

export function parseOptionsInput(raw: unknown, where: string): ProductOptionGroup[] {
  if (!Array.isArray(raw)) throw new OpError(`${where}.options must be an array of { name, values[{ label, priceModifierCents }], defaultIndex }`);
  const cleaned = raw.slice(0, 10).map((g) => ({
    name: text((g as Json)?.name, 60),
    defaultIndex: (g as Json)?.defaultIndex,
    values: (Array.isArray((g as Json)?.values) ? ((g as Json).values as unknown[]) : []).slice(0, 100).map((v) => ({
      label: text((v as Json)?.label, 60),
      priceModifierCents: Number((v as Json)?.priceModifierCents) || 0,
    })),
  }));
  for (const [i, g] of cleaned.entries()) {
    if (!g.name || !g.values.some((v) => v.label)) throw new OpError(`${where}.options[${i}] needs a name and at least one value with a label`);
    if (g.values.some((v) => v.priceModifierCents < 0)) throw new OpError(`${where}.options[${i}]: priceModifierCents must be 0 or more (set the base price to the cheapest choice)`);
  }
  return parseProductOptions(cleaned);
}

function slugify(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'product';
}

async function uniqueSlug(db: Db, siteId: string, name: string, exceptId?: string) {
  const base = slugify(name);
  const { data } = await db.from('products').select('id, slug').eq('site_id', siteId).ilike('slug', `${base}%`);
  const taken = new Set((data || []).filter((r: { id: string }) => r.id !== exceptId).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// ── upsert_products ────────────────────────────────────────────────────────

interface FulfillmentInput {
  provider?: 'self' | 'vendor' | 'printful';
  vendor_id?: string;
  printful_product_id?: number | string;
}

const PRODUCT_COLUMNS = 'id, site_id, name, slug, images, price_cents, currency, variants, options, vendor_id, fulfillment_provider';

export async function upsertProducts(db: Db, site: { id: string; user_id: string | null }, fallbackUserId: string, list: Json[]) {
  const results: Json[] = [];
  for (const [i, p] of list.entries()) {
    const where = `products[${i}]`;
    const warnings: string[] = [];
    const existing = p.id
      ? (await db.from('products').select(PRODUCT_COLUMNS).eq('id', String(p.id)).eq('site_id', site.id).maybeSingle()).data as Json | null
      : null;
    if (p.id && !existing) throw new OpError(`${where}: product ${p.id} not found on this site`, 404);

    const ff = (p.fulfillment && typeof p.fulfillment === 'object' ? p.fulfillment : null) as FulfillmentInput | null;
    if (ff && !['self', 'vendor', 'printful'].includes(String(ff.provider))) throw new OpError(`${where}.fulfillment.provider must be "self", "vendor" or "printful"`);

    // Printful: everything that must match Printful comes from Printful.
    let mapped: MappedProduct | null = null;
    let syncProductId: number | null = null;
    if (ff?.provider === 'printful') {
      if (p.variants !== undefined || p.options !== undefined) throw new OpError(`${where}: variants and options of a Printful product come from Printful; leave them out.`);
      if (p.price_cents !== undefined) throw new OpError(`${where}: the price of a Printful product is its Printful retail price (set it in Printful, then link again); leave price_cents out.`);
      syncProductId = Number(ff.printful_product_id);
      if (!Number.isInteger(syncProductId) || syncProductId <= 0) throw new OpError(`${where}.fulfillment.printful_product_id must be a Printful sync product id from list_printful_products`);
      const conn = await requireConnection(db, site.id);
      const { data: other } = await db.from('printful_product_links').select('product_id').eq('site_id', site.id).eq('sync_product_id', syncProductId).maybeSingle();
      if (other && other.product_id !== existing?.id) throw new OpError(`${where}: Printful product ${syncProductId} is already linked to Keystone product ${other.product_id}. Update that one (pass its id) instead.`, 409);
      let pf: PfSyncProduct;
      try {
        pf = await getSyncProduct(db, conn, syncProductId);
      } catch (e) {
        pfError(e);
      }
      try {
        mapped = mapSyncProduct(pf);
      } catch (e) {
        throw new OpError(`${where}: ${e instanceof Error ? e.message : 'this Printful product cannot be sold'}`);
      }
      warnings.push(...mapped.warnings);
    } else if (existing?.fulfillment_provider === 'printful' && !ff && (p.variants !== undefined || p.options !== undefined || p.price_cents !== undefined)) {
      throw new OpError(`${where}: this product is fulfilled by Printful, so its variants, options and price follow Printful. Link it again with fulfillment { provider: "printful", printful_product_id } to refresh them, or set fulfillment { provider: "self" } first.`, 409);
    }

    const row: Json = {};
    const name = p.name !== undefined ? text(p.name, 160) : undefined;
    if (name !== undefined) row.name = name;
    if (!existing) row.name = name || mapped?.name || '';
    if (!existing && !row.name) throw new OpError(`${where}.name is required`);
    if (p.description !== undefined) row.description = toPlainText(String(p.description || '')).slice(0, 5000) || null;

    if (mapped) {
      row.price_cents = mapped.priceCents;
      row.currency = mapped.currency;
      row.variants = mapped.variants;
      row.options = mapped.options;
    } else {
      if (p.price_cents !== undefined) row.price_cents = Math.max(0, Math.round(Number(p.price_cents) || 0));
      else if (!existing) throw new OpError(`${where}.price_cents is required`);
      if (p.currency !== undefined) row.currency = text(p.currency, 3).toUpperCase() || 'CAD';
      if (p.variants !== undefined) row.variants = parseVariantsInput(p.variants, where);
      if (p.options !== undefined) row.options = parseOptionsInput(p.options, where);
    }
    const variantNames = ((row.variants ?? existing?.variants ?? []) as Array<{ name: string }>).map((v) => v.name);
    const clash = ((row.options ?? existing?.options ?? []) as Array<{ name: string }>).find((o) => variantNames.includes(o.name));
    if (clash) throw new OpError(`${where}: "${clash.name}" is both a variant and an option; use one or the other.`);

    if (p.compare_at_cents !== undefined) row.compare_at_cents = p.compare_at_cents ? Math.max(0, Math.round(Number(p.compare_at_cents))) : null;
    if (p.category !== undefined) row.category = p.category ? text(p.category, 80) : null;
    if (p.featured !== undefined) row.is_featured = !!p.featured;
    if (p.sort_order !== undefined && Number.isFinite(Number(p.sort_order))) row.sort_order = Number(p.sort_order);
    if (p.inventory_count !== undefined) row.inventory_count = p.inventory_count === null ? -1 : Math.max(0, Math.round(Number(p.inventory_count) || 0));
    if (p.weight_grams !== undefined) row.weight_grams = p.weight_grams === null ? null : Math.max(0, Math.round(Number(p.weight_grams) || 0));
    if (!existing) {
      row.sort_order ??= i;
      row.is_active = true;
      row.status = 'published';
    }

    // Images: the agent's (imported with import_media), else Printful mockups re-hosted in the media library.
    if (p.images !== undefined) {
      row.images = (Array.isArray(p.images) ? p.images : []).map((u) => safeSrc(u)).filter(Boolean).slice(0, 10);
    } else if (mapped && (!existing || !((existing.images as unknown[]) || []).length)) {
      const urls: string[] = [];
      for (const url of mapped.imageUrls) {
        try {
          const img = await importImageFromUrl(db, { siteId: site.id, ownerUserId: site.user_id || fallbackUserId, url, name: `${slugify(String(row.name || existing?.name || 'printful'))}.jpg` });
          urls.push(img.url);
        } catch (e) {
          warnings.push(`A Printful mockup could not be imported (${e instanceof Error ? e.message : 'error'}).`);
        }
      }
      row.images = urls;
      if (!urls.length) warnings.push('No Printful mockups could be imported; add images with import_media.');
    } else if (!existing) {
      row.images = [];
    }

    // Fulfillment.
    if (ff?.provider === 'printful') {
      row.fulfillment_provider = 'printful';
      row.vendor_id = null;
    } else if (ff?.provider === 'self') {
      row.fulfillment_provider = null;
      row.vendor_id = null;
    } else if (ff?.provider === 'vendor') {
      const { data: vendor } = await db.from('vendors').select('id, name').eq('id', String(ff.vendor_id || '')).eq('site_id', site.id).maybeSingle();
      if (!vendor) throw new OpError(`${where}.fulfillment.vendor_id must be one of this site's vendors (owners add vendors in Admin → Ecommerce)`);
      row.fulfillment_provider = null;
      row.vendor_id = vendor.id;
    }

    const finalName = String(row.name ?? existing?.name ?? '');
    if (!existing || (row.name !== undefined && row.name !== existing.name)) row.slug = await uniqueSlug(db, site.id, finalName, existing?.id as string | undefined);
    row.updated_at = new Date().toISOString();

    let id: string;
    if (existing) {
      const { data, error } = await db.from('products').update(row).eq('id', existing.id as string).eq('site_id', site.id).select('id').maybeSingle();
      if (error || !data) throw new OpError(`Could not update product ${existing.id}: ${error?.message || 'not found'}`);
      id = data.id;
    } else {
      const { data, error } = await db.from('products').insert({ site_id: site.id, ...row }).select('id').single();
      if (error) throw new OpError(`Could not create product "${row.name}": ${error.message}`, 500);
      id = data.id;
    }

    if (mapped && syncProductId) {
      const { error } = await db.from('printful_product_links').upsert(
        { product_id: id, site_id: site.id, sync_product_id: syncProductId, variants: mapped.links, synced_at: new Date().toISOString() },
        { onConflict: 'product_id' },
      );
      if (error) throw new OpError(`Product saved, but its Printful link could not be stored: ${error.message}`, 500);
    } else if (ff && ff.provider !== 'printful') {
      await db.from('printful_product_links').delete().eq('product_id', id);
    }

    const fulfillment = row.fulfillment_provider !== undefined || row.vendor_id !== undefined
      ? (row.fulfillment_provider === 'printful' ? 'printful' : row.vendor_id ? 'vendor' : 'self')
      : (existing?.fulfillment_provider === 'printful' ? 'printful' : existing?.vendor_id ? 'vendor' : 'self');
    results.push({
      id,
      ...(existing ? { updated: true } : { created: true }),
      url: `/product/${id}`,
      fulfillment,
      ...(mapped ? {
        printful_product_id: syncProductId,
        price_cents: mapped.priceCents,
        currency: mapped.currency,
        variants: mapped.variants,
        options: mapped.options,
        printful_variants_linked: mapped.links.length,
        images: row.images,
      } : {}),
      ...(warnings.length ? { warnings } : {}),
    });
  }
  return { products: results };
}

// ── list_printful_products ─────────────────────────────────────────────────

function summarize(pf: PfSyncProduct) {
  try {
    const m = mapSyncProduct(pf);
    const prices = m.links.map((l) => l.retail_price_cents).filter((c) => c > 0);
    return {
      currency: m.currency,
      price_range_cents: prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
      variant_count: m.links.length,
      choices: [...m.variants.map((v) => ({ name: v.name, values: v.options })), ...m.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.label), adds_to_price: true }))],
      mockup_urls: m.imageUrls,
      notes: m.warnings.length ? m.warnings : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'cannot be sold' };
  }
}

export async function listPrintfulProducts(db: Db, siteId: string, opts: { offset?: number; limit?: number; details?: boolean }) {
  const conn = await requireConnection(db, siteId);
  const limit = Math.max(1, Math.min(opts.details === false ? 100 : 20, Math.round(opts.limit || 20)));
  const offset = Math.max(0, Math.round(opts.offset || 0));
  let page: Awaited<ReturnType<typeof listSyncProducts>>;
  try {
    page = await listSyncProducts(db, conn, offset, limit);
  } catch (e) {
    pfError(e);
  }
  const { data: links } = await db.from('printful_product_links').select('product_id, sync_product_id').eq('site_id', siteId);
  const linked = new Map((links || []).map((l: { product_id: string; sync_product_id: number }) => [Number(l.sync_product_id), l.product_id]));

  const products: Json[] = [];
  for (let i = 0; i < page.products.length; i += 5) {
    const batch = page.products.slice(i, i + 5);
    const detailed = await Promise.all(batch.map(async (sp) => {
      const base: Json = {
        printful_product_id: sp.id,
        name: sp.name,
        variants: sp.variants ?? null,
        thumbnail_url: sp.thumbnail_url || null,
        linked_keystone_product_id: linked.get(Number(sp.id)) || null,
        ...(sp.is_ignored ? { ignored: true } : {}),
      };
      if (opts.details === false) return base;
      try {
        return { ...base, ...summarize(await getSyncProduct(db, conn, sp.id)) };
      } catch (e) {
        return { ...base, error: e instanceof Error ? e.message : 'could not load variants' };
      }
    }));
    products.push(...detailed);
  }
  return {
    store: publicConnection(conn).store_name,
    total: page.total,
    offset,
    next_offset: offset + page.products.length < page.total ? offset + page.products.length : null,
    products,
    next: 'Create a Keystone product from one with upsert_products { name?, description?, category?, fulfillment: { provider: "printful", printful_product_id } }. Pass id as well to link an existing Keystone product.',
  };
}

// ── get_store_readiness ────────────────────────────────────────────────────

type StepStatus = 'done' | 'todo' | 'attention' | 'optional';
interface Step { id: string; title: string; status: StepStatus; detail: string; owner_action?: string; link?: string }

export async function storeReadiness(db: Db, siteId: string) {
  const [siteRes, settingsRes, zonesRes, productsRes, vendorsRes, conn, linksRes, pfOrdersRes, sectionsRes] = await Promise.all([
    db.from('sites').select('stripe_account_id, paypal_client_id, paypal_secret, converge_merchant_id, converge_user_id, converge_pin, clover_merchant_id, clover_public_key, clover_private_token, is_published, engine').eq('id', siteId).maybeSingle(),
    db.from('ecommerce_settings').select('payment_methods, etransfer_email, notification_email, shipping_required, tax_enabled, tax_rate_bps').eq('site_id', siteId).maybeSingle(),
    db.from('shipping_zones').select('id, is_archived').eq('site_id', siteId),
    db.from('products').select('id, name, status, is_active, is_archived, vendor_id, fulfillment_provider, price_cents').eq('site_id', siteId).limit(1000),
    db.from('vendors').select('id, name, is_default').eq('site_id', siteId),
    loadConnection(db, siteId),
    db.from('printful_product_links').select('product_id, variants').eq('site_id', siteId),
    db.from('printful_orders').select('order_id, status, error, updated_at').eq('site_id', siteId).order('updated_at', { ascending: false }).limit(50),
    db.from('v2_sections').select('html').eq('site_id', siteId),
  ]);
  const site = (siteRes.data || {}) as Json;
  const settings = (settingsRes.data || {}) as Json;
  const pm = (settings.payment_methods || {}) as Record<string, boolean>;
  const steps: Step[] = [];

  // 1. Payments — always the owner's to set up (identity / bank checks).
  const connected = {
    stripe: !!site.stripe_account_id,
    paypal: !!(site.paypal_client_id && site.paypal_secret),
    converge: !!(site.converge_merchant_id && site.converge_user_id && site.converge_pin),
    clover: !!(site.clover_merchant_id && site.clover_public_key && site.clover_private_token),
  };
  const live = (Object.keys(connected) as Array<keyof typeof connected>).filter((k) => connected[k] && pm[k]);
  const connectedOff = (Object.keys(connected) as Array<keyof typeof connected>).filter((k) => connected[k] && !pm[k]);
  const etransfer = !!(pm.etransfer && settings.etransfer_email);
  steps.push({
    id: 'payments',
    title: 'Take payments',
    status: live.length || etransfer ? 'done' : 'todo',
    detail: live.length || etransfer
      ? `Customers can pay with ${[...live, ...(etransfer ? ['e-Transfer'] : [])].join(', ')}.`
      : connectedOff.length
        ? `${connectedOff.join(', ')} is connected but not turned on for checkout.`
        : 'No payment method is connected, so customers cannot pay online.',
    ...(live.length || etransfer ? {} : { owner_action: 'Connect Stripe (or PayPal, Clover, Converge) and turn it on. Only the owner can do this: it verifies their identity and bank account.' }),
    link: adminLink(siteId, 'payments'),
  });

  // 2. Shipping.
  const products = ((productsRes.data || []) as Json[]).filter((p) => !p.is_archived);
  const printfulProducts = products.filter((p) => p.fulfillment_provider === 'printful');
  const shippingRequired = settings.shipping_required !== false;
  const zones = ((zonesRes.data || []) as Json[]).filter((z) => !z.is_archived);
  steps.push({
    id: 'shipping',
    title: 'Shipping',
    status: !shippingRequired ? (printfulProducts.length ? 'attention' : 'done') : zones.length ? 'done' : 'todo',
    detail: !shippingRequired
      ? printfulProducts.length
        ? 'Shipping is turned off, but Printful needs a shipping address for every order. Turn "shipping required" on.'
        : 'This store does not ship (shipping is turned off).'
      : zones.length
        ? `${zones.length} shipping zone(s) set.${printfulProducts.length ? ' Printful products ship from Printful, but customers pay the shipping rates set here, so make them cover Printful\'s shipping.' : ''}`
        : 'No shipping zones yet, so checkout cannot charge shipping.',
    ...(zones.length && shippingRequired ? {} : { owner_action: 'Add shipping zones and rates in Admin → Ecommerce → Shipping.' }),
    link: adminLink(siteId, 'shipping'),
  });

  // 3. Taxes.
  const taxOn = !!settings.tax_enabled || Number(settings.tax_rate_bps) > 0;
  steps.push({
    id: 'taxes',
    title: 'Sales tax',
    status: taxOn ? 'done' : 'optional',
    detail: taxOn
      ? settings.tax_enabled ? 'Stripe calculates tax automatically.' : `A flat ${(Number(settings.tax_rate_bps) / 100).toFixed(2)}% tax is added.`
      : 'No tax is charged. The owner should check whether they must collect sales tax.',
    ...(taxOn ? {} : { owner_action: 'Set a tax rate (or Stripe automatic tax) in Admin → Ecommerce → Payments, if the business must collect tax.' }),
    link: adminLink(siteId, 'payments'),
  });

  // 4. Products published.
  const published = products.filter((p) => p.status === 'published' && p.is_active);
  const drafts = products.filter((p) => p.status !== 'published');
  const free = published.filter((p) => !Number(p.price_cents));
  steps.push({
    id: 'products',
    title: 'Products published',
    status: published.length ? (free.length ? 'attention' : 'done') : 'todo',
    detail: `${published.length} published, ${drafts.length} draft.${free.length ? ` ${free.length} published product(s) have a price of 0: ${free.slice(0, 5).map((p) => p.name).join(', ')}.` : ''}`,
    ...(published.length ? {} : { owner_action: 'Add products (upsert_products) or publish drafts in Admin → Ecommerce → Products.' }),
    link: adminLink(siteId, 'products'),
  });

  // 5. Fulfillment per product.
  const vendors = (vendorsRes.data || []) as Json[];
  const defaultVendor = vendors.find((v) => v.is_default);
  const linkByProduct = new Map(((linksRes.data || []) as Json[]).map((l) => [l.product_id as string, (l.variants || []) as VariantLink[]]));
  const byMethod = { self: [] as string[], vendor: [] as string[], printful: [] as string[] };
  const problems: string[] = [];
  for (const p of published) {
    if (p.fulfillment_provider === 'printful') {
      byMethod.printful.push(String(p.name));
      const links = linkByProduct.get(p.id as string);
      if (!links?.length) problems.push(`"${p.name}" is set to Printful but not linked to a Printful product (link it with upsert_products fulfillment).`);
      else if (links.every((l) => !l.available)) problems.push(`"${p.name}": every Printful variant is out of stock or discontinued.`);
    } else if (p.vendor_id || defaultVendor) {
      byMethod.vendor.push(String(p.name));
    } else {
      byMethod.self.push(String(p.name));
    }
  }
  if (printfulProducts.length && !conn) problems.push('Products are set to Printful, but Printful is not connected.');
  if (conn && !conn.webhook_configured_at) problems.push('Printful is connected but its shipping updates (webhook) are not set up: reconnect Printful so tracking reaches customers.');
  if (conn?.last_error) problems.push(`Printful: ${conn.last_error}`);
  steps.push({
    id: 'fulfillment',
    title: 'Fulfillment for every product',
    status: !published.length ? 'todo' : problems.length ? 'attention' : 'done',
    detail: [
      `Owner ships: ${byMethod.self.length}`,
      `vendor: ${byMethod.vendor.length}${defaultVendor ? ` (default vendor "${defaultVendor.name}")` : ''}`,
      `Printful: ${byMethod.printful.length}.`,
      conn ? `Printful store "${conn.store_name || conn.store_id}" is connected; new Printful orders are ${conn.auto_confirm ? 'confirmed automatically (Printful charges the owner and starts production)' : 'created as drafts the owner confirms in Printful or Admin'}.` : '',
      ...problems,
    ].filter(Boolean).join(' '),
    ...(problems.length ? { owner_action: problems.join(' ') } : {}),
    link: adminLink(siteId, 'fulfillment'),
  });

  // 6. Printful order failures.
  const failing = ((pfOrdersRes.data || []) as Json[]).filter((o) => ['failed', 'onhold', 'canceled'].includes(String(o.status)));
  if (conn || failing.length) {
    steps.push({
      id: 'printful_orders',
      title: 'Printful orders',
      status: failing.length ? 'attention' : 'done',
      detail: failing.length
        ? `${failing.length} recent order(s) need attention: ${failing.slice(0, 3).map((o) => `${String(o.order_id).slice(0, 8)} (${o.status}${o.error ? `: ${String(o.error).slice(0, 120)}` : ''})`).join('; ')}.`
        : 'No failed Printful orders.',
      ...(failing.length ? { owner_action: 'Retry or fix them in Admin → Ecommerce → Fulfillment.' } : {}),
      link: adminLink(siteId, 'fulfillment'),
    });
  }

  // 7. Order emails.
  steps.push({
    id: 'notifications',
    title: 'Order notification email',
    status: settings.notification_email ? 'done' : 'optional',
    detail: settings.notification_email ? 'The owner is emailed about new orders.' : 'No notification email is set, so the owner is not emailed about new orders.',
    link: adminLink(siteId, 'payments'),
  });

  // 8. The storefront is reachable from the design (v2 sites).
  if (site.engine === 'sections_v2') {
    const usesStore = featuresIn(((sectionsRes.data || []) as Json[]).map((s) => String(s.html || ''))).ecommerce;
    steps.push({
      id: 'storefront',
      title: 'Products shown on the site',
      status: usesStore ? 'done' : 'todo',
      detail: usesStore
        ? 'The design shows products and links to the cart.'
        : 'No section shows products or the cart yet, so shoppers cannot reach them (and Admin hides the Ecommerce tab).',
      ...(usesStore ? {} : { owner_action: 'Agent: add a section with data-ks-collection="products" and a cart link (get_guide topic "business").' }),
    });
  }

  const blocking = steps.filter((s) => s.status === 'todo' || s.status === 'attention');
  return {
    ready: blocking.length === 0,
    steps,
    remaining: blocking.map((s) => s.title),
    note: 'Walk the owner through each remaining step with its link. Payment onboarding (Stripe identity and bank checks, PayPal, Clover, Converge) is always done by the owner: never try to complete it for them.',
  };
}
