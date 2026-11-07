/**
 * Keystone MCP tools. Each tool maps onto the same operations the owner editor
 * uses (lib/v2/ops.ts), plus agent-only helpers (guide, research, media,
 * preview links, publish/approval).
 */
import { APP_URL, PUBLISHED_ROOT } from '@/lib/env/domain';
import { sendComposedEmail } from '@/lib/email';
import type { TokenIdentity, TokenScope } from './api-tokens';
import type { Actor } from './types';
import { ENGINE_V2 } from './types';
import { getGuide, GUIDE_TOPICS } from './guide';
import {
  OpError,
  opCreateSite,
  opDeletePage,
  opDeleteSection,
  opGetContent,
  opGetSite,
  opListOp,
  opListVersions,
  opPutPage,
  opPutSection,
  opRestoreVersion,
  opSetContent,
  opSetLayout,
  opSetTheme,
  opUpdateBusiness,
  opValidate,
  type OpsContext,
} from './ops';
import { loadDraftBundle, loadSiteRow, type Db } from './store';
import { draftUrl } from './preview-token';
import { checkPublishEligibility, publishV2Site, resolveSubdomain } from './publish';
import { importImageFromUrl, searchStockPhotos } from './media';
import { exportLegacySite } from './legacy';
import { escapeHtml, safeSrc, toPlainText } from './sanitize';
import { captureScreenshots, type ViewportName } from './screenshot';
import { COLLECTION_FIELDS } from './collections';
import { listPosts, opUpsertPosts, type PostInput } from './posts';
import { articleTemplate, postIndexPage } from './articles';

type Json = Record<string, unknown>;

export interface ToolContext {
  db: Db;
  auth: TokenIdentity;
}

interface ToolDef {
  name: string;
  title: string;
  description: string;
  scope: TokenScope;
  readOnly?: boolean;
  staffOnly?: boolean;
  inputSchema: Json;
  run: (args: Json, ctx: ToolContext) => Promise<unknown>;
}

const PREVIEW_TTL = 7 * 24 * 3600;

// ── helpers ─────────────────────────────────────────────────────────────────

const str = (description: string, extra: Json = {}) => ({ type: 'string', description, ...extra });
const siteIdProp = { site_id: str('The site id (from list_sites or create_site).') };

async function siteContext(args: Json, ctx: ToolContext, opts: { requireV2?: boolean } = { requireV2: true }) {
  const siteId = String(args.site_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) throw new OpError('site_id is required (a UUID from list_sites)');
  const site = await loadSiteRow(ctx.db, siteId);
  if (!site || site.deleted_at) throw new OpError('Site not found', 404);
  const isOwner = site.user_id === ctx.auth.userId;
  if (!isOwner && !ctx.auth.isStaff) throw new OpError('You do not have access to this site', 403);
  if (opts.requireV2 && site.engine !== ENGINE_V2) {
    throw new OpError('This is a classic (block) site. Use export_legacy_site to read its content and create_site to build the redesign.', 409);
  }
  const actor: Actor = {
    type: isOwner ? 'agent' : 'staff',
    label: `${ctx.auth.tokenName} · ${ctx.auth.email || ctx.auth.userId}`,
  };
  const ops: OpsContext = { db: ctx.db, siteId, actor };
  return { site, ops };
}

async function withPreview<T extends object>(siteId: string, result: T, path = '/') {
  return { ...result, preview_url: await draftUrl(APP_URL, siteId, 'preview', PREVIEW_TTL, path) };
}

const tokenSchema = {
  type: 'object',
  properties: {
    name: str('CSS custom property name without "--", e.g. "color-brand".'),
    value: str('CSS value.'),
    type: { type: 'string', enum: ['color', 'font', 'length', 'text'] },
    label: str('Owner-facing label, e.g. "Brand colour".'),
    group: str('Owner-facing group, e.g. "Colours".'),
    editable: { type: 'boolean', description: 'Show in the owner\'s Brand panel.' },
  },
  required: ['name', 'value'],
};

const businessSchema = {
  type: 'object',
  properties: {
    name: str('Business / site name.'),
    legalName: str('Legal business name (for structured data).'),
    phone: str('Phone number as it should be displayed.'),
    email: str('Public contact email.'),
    streetAddress: str('Street address.'),
    city: str('City.'),
    region: str('Province / state.'),
    postalCode: str('Postal / ZIP code.'),
    country: str('ISO country code, e.g. "CA".'),
    hours: { type: 'array', items: { type: 'string' }, description: 'Opening hours lines, e.g. "Mo-Fr 08:00-17:00".' },
    logo: str('Logo image URL (import it with import_media first).'),
    favicon: str('Favicon image URL.'),
  },
};

// ── tools ───────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    name: 'get_guide',
    title: 'Read the Keystone authoring guide',
    description: 'How to build a Keystone site: the section markup contract (data-ks attributes), theme, content, forms, scripts, quality bar and workflow. Read this first.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: { topic: { type: 'string', enum: [...GUIDE_TOPICS, 'all'], description: 'Omit for the overview + workflow.' } } },
    run: async (args) => ({ guide: getGuide(args.topic as string | undefined) }),
  },
  {
    name: 'list_sites',
    title: 'List sites',
    description: 'Sites you own (engine "sections_v2" = agent-built, "blocks_v1" = classic).',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: {} },
    run: async (_args, ctx) => {
      const { data } = await ctx.db
        .from('sites')
        .select('id, site_slug, engine, is_published, published_domain, custom_domain, updated_at')
        .eq('user_id', ctx.auth.userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      return { sites: data || [] };
    },
  },
  {
    name: 'get_site',
    title: 'Get a site',
    description: 'Pages, section designs (with their editable fields), theme tokens, layout and business info for a site. Set include_code to also get HTML/CSS/JS.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: { ...siteIdProp, include_code: { type: 'boolean' } }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return withPreview(ops.siteId, await opGetSite(ops, { includeCode: !!args.include_code }));
    },
  },
  {
    name: 'create_site',
    title: 'Create a site',
    description: 'Create a new agent-built site (draft) owned by you, with an empty home page. Optionally set business info.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        name: str('Business / site name.'),
        business_type: { type: 'string', enum: ['services', 'products', 'portfolio', 'nonprofit', 'other'] },
        category: str('Industry, e.g. "roofing", "salon".'),
        business: businessSchema,
        lead_id: str('Staff only: prefill business info from an ops lead.'),
      },
      required: ['name'],
    },
    run: async (args, ctx) => {
      const actor: Actor = { type: ctx.auth.isStaff ? 'staff' : 'agent', label: `${ctx.auth.tokenName} · ${ctx.auth.email || ctx.auth.userId}` };
      let business = (args.business as Json | undefined) || undefined;
      if (args.lead_id) {
        if (!ctx.auth.isStaff) throw new OpError('lead_id is for Keystone staff tokens', 403);
        const { data: lead } = await ctx.db.from('leads').select('business_name, email, phone, address, city, region, postal_code, country').eq('id', String(args.lead_id)).maybeSingle();
        if (!lead) throw new OpError('Lead not found', 404);
        business = {
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          streetAddress: lead.address || undefined,
          city: lead.city || undefined,
          region: lead.region || undefined,
          postalCode: lead.postal_code || undefined,
          country: lead.country || undefined,
          ...(business || {}),
        };
      }
      const created = await opCreateSite(ctx.db, ctx.auth.userId, actor, {
        name: String(args.name || ''),
        business_type: args.business_type as never,
        category: args.category as string | undefined,
        business: business as never,
      });
      if (args.lead_id) {
        await ctx.db.from('lead_site_generations').insert({ lead_id: String(args.lead_id), site_id: created.siteId, status: 'generating' }).then(() => {}, () => {});
      }
      return withPreview(created.siteId, { site_id: created.siteId, next: 'Read get_guide, then set_theme, put_section (header/footer) and set_layout.' });
    },
  },
  {
    name: 'research_business',
    title: 'Research a business (staff)',
    description: 'Look up a real business on Google: verified phone/address/hours, rating and review snippets, Business Profile photo URLs (import them with import_media) and brand colours from photos.',
    scope: 'sites:read',
    readOnly: true,
    staffOnly: true,
    inputSchema: {
      type: 'object',
      properties: { name: str('Business name.'), city: str('City.'), region: str('Province/state.'), address: str('Street address.'), website: str('Existing website URL.'), place_id: str('Google place id if known.') },
      required: ['name'],
    },
    run: async (args) => {
      const { enrichLead } = await import('@/lib/leads/enrich');
      return enrichLead({
        businessName: String(args.name),
        city: (args.city as string) || null,
        region: (args.region as string) || null,
        address: (args.address as string) || null,
        website: (args.website as string) || null,
        placeId: (args.place_id as string) || null,
      });
    },
  },
  {
    name: 'update_business_profile',
    title: 'Update business info',
    description: 'Set the business name, phone, email, address, hours, logo and favicon. These feed @business.* / @site.* bindings, structured data and SEO.',
    scope: 'sites:write',
    inputSchema: { type: 'object', properties: { ...siteIdProp, ...(businessSchema.properties as Json) }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const { site_id: _s, ...input } = args;
      void _s;
      return opUpdateBusiness(ops, input as never);
    },
  },
  {
    name: 'set_theme',
    title: 'Set theme',
    description: 'Set design tokens (CSS custom properties; mark owner-adjustable ones editable), extra Google fonts, global CSS and global JS (ES module). Only the keys you pass are changed.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        tokens: { type: 'array', items: tokenSchema, description: 'Replaces the full token list.' },
        fonts: { type: 'array', items: { type: 'object', properties: { family: { type: 'string' }, weights: { type: 'string' } }, required: ['family'] } },
        global_css: str('Global CSS (not scoped).'),
        global_js: str('ES module: export default (ks) => { ... }'),
        platform: {
          type: 'object',
          description: 'Which colour tokens Keystone\'s own pages (cart, checkout, booking, product pages) use: { primary, secondary, accent } → token name.',
          properties: { primary: { type: 'string' }, secondary: { type: 'string' }, accent: { type: 'string' } },
        },
        expected_version: { type: 'number', description: 'Theme version you last read (get_site.theme.version). Rejected if someone changed it since.' },
      },
      required: ['site_id'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return withPreview(ops.siteId, await opSetTheme(ops, args as never));
    },
  },
  {
    name: 'put_section',
    title: 'Create or replace a section design',
    description: 'Create or replace a section template (annotated HTML; trailing <style> and <script type="module"> are extracted). Returns the editable fields it exposes and any issues. Keep field ids stable across revisions so owner content survives.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        key: str('Section key, e.g. "hero", "services-grid" (lower-case, dashes).'),
        name: str('Owner-facing name, e.g. "Hero — split photo".'),
        html: str('Annotated HTML. May end with <style> and <script type="module"> blocks.'),
        css: str('Optional CSS (scoped to the section automatically).'),
        js: str('Optional ES module: export default (root, ks) => { ... }'),
        expected_version: { type: 'number', description: 'Section version you last read (get_site sections[].version; 0 = must not exist yet). Rejected if it changed since.' },
      },
      required: ['site_id', 'key', 'html'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return withPreview(ops.siteId, await opPutSection(ops, args as never));
    },
  },
  {
    name: 'delete_section',
    title: 'Delete a section design',
    description: 'Delete a section design. Fails if it is used on a page or in the layout unless force is true.',
    scope: 'sites:write',
    inputSchema: { type: 'object', properties: { ...siteIdProp, key: { type: 'string' }, force: { type: 'boolean' } }, required: ['site_id', 'key'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opDeleteSection(ops, String(args.key), !!args.force);
    },
  },
  {
    name: 'set_layout',
    title: 'Set header and footer',
    description: 'Choose the section designs used as the global header and footer (null removes). Optionally set their content (instances "header" / "footer").',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        header: { type: ['string', 'null'] },
        footer: { type: ['string', 'null'] },
        header_content: { type: 'object', description: 'path → value for the header instance' },
        footer_content: { type: 'object', description: 'path → value for the footer instance' },
      },
      required: ['site_id'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return withPreview(ops.siteId, await opSetLayout(ops, args as never));
    },
  },
  {
    name: 'put_page',
    title: 'Create or update a page',
    description: 'Create a page or update it. If `sections` is given it replaces the page\'s section list (instances keep content by id). Content per instance is path → value. Use slug "home" for the home page.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        slug: str('"home" or lower-case-dashes.'),
        title: { type: 'string' },
        nav_label: { type: 'string' },
        show_in_nav: { type: 'boolean' },
        nav_order: { type: 'number' },
        seo: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, ogImage: { type: 'string' } } },
        template: {
          type: 'string',
          enum: ['post', 'none'],
          description: '"post" makes this page the article layout used for every blog post at /blog/<slug> (see get_guide topic "business"). "none" turns that off.',
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: str('Section design key.'),
              id: str('Stable instance id, e.g. "home-hero". Reuse it to keep content.'),
              hidden: { type: 'boolean' },
              content: { type: 'object', description: 'path → value, e.g. { "title": "…", "items": [ { "name": "…" } ] }' },
            },
            required: ['section'],
          },
        },
        force: { type: 'boolean', description: 'Overwrite fields the owner edited. Only when the human asked.' },
        expected_version: { type: 'number', description: 'Page layoutVersion you last read (get_site pages[].layoutVersion). Rejected if the owner or anyone changed the page since.' },
      },
      required: ['site_id', 'slug'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const slug = String(args.slug);
      const input = { ...args, ...(args.template !== undefined ? { template: args.template === 'post' ? 'post' : null } : {}) };
      return withPreview(ops.siteId, await opPutPage(ops, input as never, { force: !!args.force }), slug === 'home' ? '/' : `/${slug}`);
    },
  },
  {
    name: 'delete_page',
    title: 'Delete a page',
    description: 'Delete a page (not the home page).',
    scope: 'sites:write',
    inputSchema: { type: 'object', properties: { ...siteIdProp, slug: { type: 'string' } }, required: ['site_id', 'slug'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opDeletePage(ops, String(args.slug));
    },
  },
  {
    name: 'get_content',
    title: 'Get content',
    description: 'Current field values (and whether the owner edited them) for a page, an instance, or the whole site.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: { ...siteIdProp, page: str('Page slug'), instance: str('Instance id') }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opGetContent(ops, { page: args.page as string | undefined, instance: args.instance as string | undefined });
    },
  },
  {
    name: 'set_content',
    title: 'Set content',
    description: 'Change field values on section instances. Paths reach into lists ("items.2.name"). Owner-edited fields are skipped unless force is true (only when the human asked).',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              instance: { type: 'string' },
              path: { type: 'string' },
              value: {},
              expected_rev: { type: 'number', description: 'Field rev you last read (get_content; 0 = template default). That change is rejected ("conflict") if the field changed since.' },
            },
            required: ['instance', 'path', 'value'],
          },
        },
        force: { type: 'boolean' },
      },
      required: ['site_id', 'changes'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return withPreview(ops.siteId, await opSetContent(ops, args.changes as never, { force: !!args.force }));
    },
  },
  {
    name: 'edit_list',
    title: 'Add/remove/move list items',
    description: 'Structural list edits on an instance: add (with template defaults), duplicate, remove, move.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        instance: { type: 'string' },
        path: str('List path, e.g. "items" or "items.0.tags".'),
        op: { type: 'string', enum: ['add', 'duplicate', 'remove', 'move'] },
        index: { type: 'number' },
        to: { type: 'number' },
        expected_rev: { type: 'number', description: 'Field rev you last read; rejected if it changed since.' },
      },
      required: ['site_id', 'instance', 'path', 'op'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opListOp(ops, { instance: String(args.instance), path: String(args.path), op: args.op, index: args.index, to: args.to, expected_rev: args.expected_rev } as never);
    },
  },
  {
    name: 'search_stock_media',
    title: 'Search stock photos',
    description: 'Search Unsplash. Import the ones you use with import_media (pass unsplash_download_location).',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, per_page: { type: 'number' } }, required: ['query'] },
    run: async (args) => ({ results: await searchStockPhotos(String(args.query), Number(args.per_page) || 12) }),
  },
  {
    name: 'import_media',
    title: 'Import an image',
    description: 'Download an image (https URL) into the site\'s media library: re-encoded, resized to ≤2400px, moderated. Use the returned URL in your HTML/content.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdProp, url: { type: 'string' }, name: { type: 'string' }, unsplash_download_location: { type: 'string' } },
      required: ['site_id', 'url'],
    },
    run: async (args, ctx) => {
      const { site } = await siteContext(args, ctx);
      return importImageFromUrl(ctx.db, {
        siteId: site.id,
        ownerUserId: site.user_id || ctx.auth.userId,
        url: String(args.url),
        name: args.name as string | undefined,
        unsplashDownloadLocation: args.unsplash_download_location as string | undefined,
      });
    },
  },
  {
    name: 'preview',
    title: 'Get a preview link',
    description: 'A signed link to the current draft (scripts run, forms are inert). Open it at desktop and ~390px mobile width to review your work.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: { ...siteIdProp, path: str('Page path, e.g. "/" or "/about"'), hours: { type: 'number', description: 'Link lifetime (default 168)' } }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const hours = Math.max(1, Math.min(24 * 30, Number(args.hours) || 168));
      return { preview_url: await draftUrl(APP_URL, ops.siteId, 'preview', hours * 3600, String(args.path || '/')) };
    },
  },
  {
    name: 'screenshot',
    title: 'Screenshot the draft',
    description: 'See your work: real-browser screenshots of a draft page at desktop / tablet / mobile size (scripts run, like a visitor sees it), plus problems found — horizontal scrolling, broken images, text stuck invisible by animations, small tap targets and JavaScript errors. Use after every meaningful change and fix what you see.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        path: str('Page path, e.g. "/" or "/about", or a flow: "/cart", "/book" (published sites only).'),
        viewports: { type: 'array', items: { type: 'string', enum: ['desktop', 'tablet', 'mobile'] }, description: 'Default ["desktop","mobile"].' },
        full_page: { type: 'boolean', description: 'Whole page (default) or just the first screen.' },
      },
      required: ['site_id'],
    },
    run: async (args, ctx) => {
      const { ops, site } = await siteContext(args, ctx);
      const path = String(args.path || '/');
      const isFlow = /^\/(cart|book|order-confirmation)$|^\/product\//.test(path.split('?')[0]);
      let url: string;
      if (isFlow) {
        // Keystone's hosted flows only exist on the live site.
        const host = site.custom_domain || (site.published_domain ? `${site.published_domain}.${PUBLISHED_ROOT}` : null);
        if (!site.is_published || !host) throw new OpError('Cart, booking and product pages can only be captured once the site is published.', 409);
        url = `https://${host}${path}`;
      } else {
        url = await draftUrl(APP_URL, ops.siteId, 'preview', 600, path);
      }
      const viewports = (Array.isArray(args.viewports) && args.viewports.length ? args.viewports : ['desktop', 'mobile']) as ViewportName[];
      const shots = await captureScreenshots(url, viewports, args.full_page !== false);
      const problems = shots.flatMap((s) => {
        const d = s.diagnostics;
        return [
          d.overflowX ? `${s.viewport}: page scrolls sideways by ${d.overflowX}px — caused by ${d.overflowElements.join(', ') || 'unknown elements'}` : '',
          d.brokenImages.length ? `${s.viewport}: broken images: ${d.brokenImages.join(', ')}` : '',
          d.invisibleText.length ? `${s.viewport}: text still invisible after scrolling (animation never revealed it?): ${d.invisibleText.join(', ')}` : '',
          d.smallTapTargets ? `${s.viewport}: ${d.smallTapTargets} links/buttons smaller than 32px` : '',
          d.consoleErrors.length ? `${s.viewport}: JavaScript errors: ${d.consoleErrors.join(' | ')}` : '',
        ].filter(Boolean);
      });
      return {
        path,
        problems,
        shots: shots.map((s) => ({ viewport: s.viewport, width: s.width, height: s.height, truncated: s.truncated, pageHeight: s.diagnostics.pageHeight })),
        __images: shots.map((s) => ({ label: `${s.viewport} (${s.width}px wide${s.truncated ? ', truncated' : ''})`, data: s.data, mimeType: s.mimeType })),
      };
    },
  },
  {
    name: 'get_business_data',
    title: 'Get products, services & blog posts',
    description: 'The site\'s live products, bookable services and blog posts (what data-ks-collection sections will show), with the fields you can bind, plus which page is the article layout. Owners manage these in Keystone Admin; use upsert_products / upsert_services / upsert_posts to add them for a new business or import them from an old site.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: siteIdProp, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const [products, services, settings, posts, bundle] = await Promise.all([
        ctx.db.from('products').select('id, name, price_cents, currency, category, status, is_active, is_featured, images').eq('site_id', ops.siteId).eq('is_archived', false).order('sort_order').limit(200),
        ctx.db.from('booking_services').select('id, name, price_cents, duration_minutes, status, is_active, is_featured').eq('site_id', ops.siteId).eq('is_archived', false).order('sort_order').limit(200),
        ctx.db.from('booking_settings').select('site_id').eq('site_id', ops.siteId).maybeSingle(),
        listPosts(ops),
        loadDraftBundle(ctx.db, ops.siteId),
      ]);
      const layout = bundle ? articleTemplate(bundle) : null;
      const index = bundle ? postIndexPage(bundle) : null;
      return {
        products: products.data || [],
        services: services.data || [],
        bookingConfigured: !!settings.data,
        posts,
        blog: {
          articleUrls: '/blog/<slug>',
          articleLayoutPage: layout?.slug || null,
          postsListPage: index?.slug || null,
          note: layout ? undefined : 'No article layout yet: /blog/<slug> uses Keystone\'s plain article page. Design one with put_page { template: "post" }.',
        },
        bindableFields: COLLECTION_FIELDS,
      };
    },
  },
  {
    name: 'upsert_services',
    title: 'Add or update bookable services',
    description: 'Create or update the services customers can book (name, description, duration, price). Pass id to update. New services are published. Payment methods, hours and staff are configured by the owner in Admin → Booking.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        services: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str('Existing service id to update.'),
              name: { type: 'string' },
              description: { type: 'string' },
              duration_minutes: { type: 'number' },
              price_cents: { type: 'number', description: '0 = free / quote on site.' },
              featured: { type: 'boolean' },
              sort_order: { type: 'number' },
            },
            required: ['name'],
          },
        },
      },
      required: ['site_id', 'services'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const list = Array.isArray(args.services) ? (args.services as Json[]).slice(0, 50) : [];
      if (!list.length) throw new OpError('services is required');
      // A settings row (with its default weekly hours) makes the site bookable.
      await ctx.db.from('booking_settings').upsert({ site_id: ops.siteId }, { onConflict: 'site_id', ignoreDuplicates: true });
      const results = [];
      for (const [i, svc] of list.entries()) {
        const row = {
          site_id: ops.siteId,
          name: toPlainText(String(svc.name || '')).slice(0, 120),
          description: toPlainText(String(svc.description || '')).slice(0, 2000) || null,
          duration_minutes: Math.max(5, Math.min(24 * 60, Math.round(Number(svc.duration_minutes) || 60))),
          price_cents: Math.max(0, Math.round(Number(svc.price_cents) || 0)),
          is_featured: !!svc.featured,
          sort_order: Number.isFinite(Number(svc.sort_order)) ? Number(svc.sort_order) : i,
          is_active: true,
          status: 'published',
        };
        if (!row.name) throw new OpError(`services[${i}].name is required`);
        if (svc.id) {
          const { data, error } = await ctx.db.from('booking_services').update(row).eq('id', String(svc.id)).eq('site_id', ops.siteId).select('id').maybeSingle();
          if (error || !data) throw new OpError(`Could not update service ${svc.id}: ${error?.message || 'not found'}`);
          results.push({ id: data.id, updated: true });
        } else {
          const { data, error } = await ctx.db.from('booking_services').insert(row).select('id').single();
          if (error) throw new OpError(`Could not create service "${row.name}": ${error.message}`, 500);
          results.push({ id: data.id, created: true });
        }
      }
      return { services: results };
    },
  },
  {
    name: 'upsert_products',
    title: 'Add or update products',
    description: 'Create or update store products (name, description, price, images, category). Pass id to update. Import images with import_media first. Variants, shipping, taxes and payments are managed by the owner in Admin → Ecommerce.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str('Existing product id to update.'),
              name: { type: 'string' },
              description: { type: 'string' },
              price_cents: { type: 'number' },
              compare_at_cents: { type: 'number', description: 'Original price, to show a sale.' },
              images: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              featured: { type: 'boolean' },
              inventory_count: { type: 'number', description: 'Omit for untracked stock.' },
              sort_order: { type: 'number' },
            },
            required: ['name', 'price_cents'],
          },
        },
      },
      required: ['site_id', 'products'],
    },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      const list = Array.isArray(args.products) ? (args.products as Json[]).slice(0, 100) : [];
      if (!list.length) throw new OpError('products is required');
      const results = [];
      for (const [i, p] of list.entries()) {
        const images = (Array.isArray(p.images) ? p.images : []).map((u) => safeSrc(u)).filter(Boolean).slice(0, 10);
        const row: Json = {
          site_id: ops.siteId,
          name: toPlainText(String(p.name || '')).slice(0, 160),
          description: toPlainText(String(p.description || '')).slice(0, 5000) || null,
          price_cents: Math.max(0, Math.round(Number(p.price_cents) || 0)),
          compare_at_cents: p.compare_at_cents ? Math.max(0, Math.round(Number(p.compare_at_cents))) : null,
          images,
          category: p.category ? toPlainText(String(p.category)).slice(0, 80) : null,
          is_featured: !!p.featured,
          sort_order: Number.isFinite(Number(p.sort_order)) ? Number(p.sort_order) : i,
          is_active: true,
          status: 'published',
        };
        if (p.inventory_count !== undefined) row.inventory_count = Math.max(0, Math.round(Number(p.inventory_count) || 0));
        if (!row.name) throw new OpError(`products[${i}].name is required`);
        if (p.id) {
          const { data, error } = await ctx.db.from('products').update(row).eq('id', String(p.id)).eq('site_id', ops.siteId).select('id').maybeSingle();
          if (error || !data) throw new OpError(`Could not update product ${p.id}: ${error?.message || 'not found'}`);
          results.push({ id: data.id, updated: true });
        } else {
          const { data, error } = await ctx.db.from('products').insert(row).select('id').single();
          if (error) throw new OpError(`Could not create product "${row.name}": ${error.message}`, 500);
          results.push({ id: data.id, created: true });
        }
      }
      return { products: results };
    },
  },
  {
    name: 'upsert_posts',
    title: 'Add or update blog posts',
    description: 'Create or update blog posts: the same posts the owner writes in Admin → Blog. Use it to seed a new blog or import articles from the business\'s old site (keep their original dates with published_at). Pass id to update; only update posts the owner asked you to change — they are the owner\'s writing. Posts appear at /blog/<slug> and in every data-ks-collection="posts" list without republishing. Import images with import_media first.',
    scope: 'sites:write',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdProp,
        posts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str('Existing post id to update (omit to create).'),
              title: { type: 'string' },
              slug: str('URL slug (default: from the title). Changing it changes the post\'s URL.'),
              excerpt: str('One or two sentence summary for lists and search results.'),
              content: str('The article as HTML: p, h2–h4, ul/ol, blockquote, a, strong/em, img, figure, pre/code, table. Scripts and styles are removed.'),
              cover_image: str('Image URL (from import_media).'),
              author: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              published_at: str('Publish date, YYYY-MM-DD or ISO. Use the original date for imported articles.'),
              publish: { type: 'boolean', description: 'Default true for new posts. false keeps it as a draft in Admin → Blog.' },
              featured: { type: 'boolean', description: 'One featured post per site (data-ks-filter="featured").' },
            },
          },
        },
      },
      required: ['site_id', 'posts'],
    },
    run: async (args, ctx) => {
      const { ops, site } = await siteContext(args, ctx);
      return opUpsertPosts(ops, site.user_id || ctx.auth.userId, (Array.isArray(args.posts) ? args.posts : []) as PostInput[]);
    },
  },
  {
    name: 'validate',
    title: 'Validate the site',
    description: 'Check the whole draft: editability (unbound text/images), markup safety, broken links, headings, alt text, budgets, missing SEO. Errors block publishing.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: siteIdProp, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opValidate(ops);
    },
  },
  {
    name: 'publish',
    title: 'Publish',
    description: 'Make the current draft live (requires the sites:publish scope and an owner subscription). Blocked while validate reports errors.',
    scope: 'sites:publish',
    inputSchema: { type: 'object', properties: { ...siteIdProp, subdomain: str('Optional <subdomain>.kswd.ca for the first publish.') }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      await checkPublishEligibility(ctx.db, ops.siteId);
      const subdomain = await resolveSubdomain(ctx.db, ops.siteId, args.subdomain as string | undefined);
      return publishV2Site(ctx.db, { siteId: ops.siteId, subdomain, actor: ops.actor });
    },
  },
  {
    name: 'request_approval',
    title: 'Ask the owner to approve',
    description: 'Email the site owner a 7-day preview link and a link to the editor so they can review and publish.',
    scope: 'sites:write',
    inputSchema: { type: 'object', properties: { ...siteIdProp, message: str('Short note to the owner.') }, required: ['site_id'] },
    run: async (args, ctx) => {
      const { site, ops } = await siteContext(args, ctx);
      const { data: owner } = await ctx.db.from('users').select('email').eq('id', site.user_id).maybeSingle();
      if (!owner?.email) throw new OpError('The site owner has no email address', 400);
      const preview = await draftUrl(APP_URL, ops.siteId, 'preview', PREVIEW_TTL);
      const editor = `${APP_URL}/design?siteId=${ops.siteId}`;
      const note = args.message ? `<p>${escapeHtml(String(args.message)).slice(0, 2000)}</p>` : '';
      const sent = await sendComposedEmail({
        from: 'Keystone Web <hello@keystoneweb.ca>',
        replyTo: 'hello@keystoneweb.ca',
        to: [owner.email],
        subject: 'Your new website is ready to review',
        html: `<p>Hi,</p><p>Your new website is ready for you to look over.</p>${note}<p><a href="${preview}">Preview your site</a></p><p>When you're happy, open the <a href="${editor}">editor</a> to change any words or photos, then press Publish.</p><p>— Keystone</p>`,
        plainText: `Your new website is ready to review.\n\nPreview: ${preview}\nEditor: ${editor}`,
      });
      if (!sent.success) throw new OpError('The email could not be sent', 502);
      return { sent_to: owner.email, preview_url: preview };
    },
  },
  {
    name: 'list_versions',
    title: 'List versions',
    description: 'Restore points and published releases, newest first.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: siteIdProp, required: ['site_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opListVersions(ops);
    },
  },
  {
    name: 'restore_version',
    title: 'Restore a version',
    description: 'Make an earlier version the current draft (the current draft is saved as a restore point first). Does not publish.',
    scope: 'sites:write',
    inputSchema: { type: 'object', properties: { ...siteIdProp, version_id: { type: 'string' } }, required: ['site_id', 'version_id'] },
    run: async (args, ctx) => {
      const { ops } = await siteContext(args, ctx);
      return opRestoreVersion(ops, String(args.version_id));
    },
  },
  {
    name: 'export_legacy_site',
    title: 'Export a classic site\'s content',
    description: 'Read a classic (block engine) site\'s pages, text, images, links and business data, to rebuild it as a new agent-built site. The classic site is not changed.',
    scope: 'sites:read',
    readOnly: true,
    inputSchema: { type: 'object', properties: siteIdProp, required: ['site_id'] },
    run: async (args, ctx) => {
      const { site } = await siteContext(args, ctx, { requireV2: false });
      return exportLegacySite(ctx.db, site.id);
    },
  },
];

export function toolList(auth: TokenIdentity) {
  return TOOLS.filter((t) => !t.staffOnly || auth.isStaff).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: !!t.readOnly, destructiveHint: ['delete_page', 'delete_section', 'restore_version', 'publish'].includes(t.name) },
  }));
}

export async function callTool(name: string, args: Json, ctx: ToolContext): Promise<{ result?: unknown; error?: string; details?: unknown }> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || (tool.staffOnly && !ctx.auth.isStaff)) return { error: `Unknown tool "${name}"` };
  if (!ctx.auth.scopes.includes(tool.scope)) return { error: `This token lacks the ${tool.scope} scope` };
  try {
    return { result: await tool.run(args || {}, ctx) };
  } catch (e) {
    if (e instanceof OpError) return { error: e.message, details: e.details };
    console.error(`[mcp] ${name} failed`, e);
    return { error: e instanceof Error ? e.message : 'Tool failed' };
  }
}
