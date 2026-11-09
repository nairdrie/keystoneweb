/**
 * v2 site operations. The owner editor (/api/v2/editor) and agents (/api/mcp)
 * call the same functions, so both are held to the same rules:
 *   - agents can't overwrite content the owner edited unless forced,
 *   - every change is attributed and a restore point is taken first,
 *   - all content is sanitized on write.
 */
import { randomBytes } from 'crypto';
import postcss from 'postcss';
import type { Actor, Audience, CompiledSection, FieldSchema, PageAccess, PageRecord, SectionInstance, SiteBundle, ThemeToken } from './types';
import { AUDIENCES, ENGINE_V2, GLOBAL_INSTANCE_FOOTER, GLOBAL_INSTANCE_HEADER } from './types';
import { compileSection } from './compile';
import { splitSectionSource } from './css-scope';
import { applyFieldChange, applyListOp, ContentError, defaultListItem, splitPath, type ListOp } from './content';
import { BUDGETS, PAGE_SLUG_RE, SECTION_KEY_RE, TOKEN_NAME_RE } from './policy';
import { safeSrc, safeTokenValue, toPlainText } from './sanitize';
import { validateBundle } from './validate';
import {
  actorLabel,
  copyInstanceContent,
  createSnapshot,
  ensureTheme,
  loadDraftBundle,
  loadSiteRow,
  logActivity,
  maybeSnapshot,
  restoreBundle,
  readContentRow,
  saveLayout,
  saveTheme,
  StaleWriteError,
  writeContentRow,
  type Db,
} from './store';

export interface OpsContext {
  db: Db;
  siteId: string;
  actor: Actor;
}

export class OpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'OpError';
    this.status = status;
    this.details = details;
  }
}

async function bundleOrThrow(ctx: OpsContext): Promise<SiteBundle> {
  const bundle = await loadDraftBundle(ctx.db, ctx.siteId);
  if (!bundle) throw new OpError('Site not found', 404);
  return bundle;
}

export function newInstanceId(): string {
  return `i_${randomBytes(4).toString('hex')}`;
}

function schemaOf(bundle: SiteBundle, sectionKey: string): CompiledSection {
  const section = bundle.sections[sectionKey];
  if (!section) throw new OpError(`Section "${sectionKey}" does not exist`, 404);
  const schema = section.schema as CompiledSection;
  return schema && Array.isArray(schema.fields) ? schema : compileSection(section.html);
}

/** Which section design an instance uses (page instances + global header/footer). */
export function findInstance(bundle: SiteBundle, instanceId: string): { section: string; page: PageRecord | null } | null {
  if (instanceId === GLOBAL_INSTANCE_HEADER && bundle.theme.header_section) return { section: bundle.theme.header_section, page: null };
  if (instanceId === GLOBAL_INSTANCE_FOOTER && bundle.theme.footer_section) return { section: bundle.theme.footer_section, page: null };
  for (const page of bundle.pages) {
    const inst = page.instances.find((i) => i.id === instanceId);
    if (inst) return { section: inst.section, page };
  }
  return null;
}

function findPage(bundle: SiteBundle, ref: string): PageRecord {
  const page = bundle.pages.find((p) => p.id === ref || p.slug === ref);
  if (!page) throw new OpError(`Page "${ref}" not found`, 404);
  return page;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale-write protection
//
// Every write is a compare-and-swap against the version that was read. When
// the caller passes the version it saw (expected_version / expected_rev) and
// something changed since, the write is rejected with 409 so the caller can
// reload. Without one, an internal race simply retries on fresh data.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 4;

function staleError(what: string, details: Record<string, unknown>) {
  return new OpError(`${what} was changed by someone else since you loaded it. Reload and try again.`, 409, { reason: 'stale', ...details });
}

/** Read-modify-write a page's section list with stale-write protection. */
async function mutateLayout(
  ctx: OpsContext,
  pageId: string,
  mutate: (instances: SectionInstance[]) => SectionInstance[] | Promise<SectionInstance[]>,
  expectedVersion?: number,
): Promise<{ instances: SectionInstance[]; version: number }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data } = await ctx.db.from('v2_page_layouts').select('instances, version').eq('page_id', pageId).maybeSingle();
    const current = data ? Number(data.version) || 1 : 0;
    if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== current) {
      throw staleError('This page', { currentVersion: current });
    }
    const instances = await mutate(Array.isArray(data?.instances) ? [...(data!.instances as SectionInstance[])] : []);
    try {
      const version = await saveLayout(ctx.db, ctx.siteId, pageId, instances, current);
      return { instances, version };
    } catch (e) {
      if (!(e instanceof StaleWriteError)) throw e;
      if (expectedVersion !== undefined && expectedVersion !== null) throw staleError('This page', {});
    }
  }
  throw new OpError('This page is being changed by someone else right now. Try again.', 409, { reason: 'busy' });
}

/** Patch the theme with stale-write protection (patch may be computed from the fresh row). */
async function mutateTheme(
  ctx: OpsContext,
  patch: (row: Record<string, unknown>) => Record<string, unknown>,
  expectedVersion?: number,
): Promise<number> {
  await ensureTheme(ctx.db, ctx.siteId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data } = await ctx.db.from('v2_themes').select('*').eq('site_id', ctx.siteId).maybeSingle();
    const current = Number(data?.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== current) {
      throw staleError('The theme', { currentVersion: current });
    }
    try {
      return await saveTheme(ctx.db, ctx.siteId, patch(data || {}), ctx.actor, current);
    } catch (e) {
      if (!(e instanceof StaleWriteError)) throw e;
      if (expectedVersion !== undefined && expectedVersion !== null) throw staleError('The theme', {});
    }
  }
  throw new OpError('The theme is being changed by someone else right now. Try again.', 409, { reason: 'busy' });
}

/**
 * Read-modify-write one content field. `apply` returns the new value (and
 * owner flag), or null to skip writing. `expectedRev` (0 = no stored value)
 * rejects the write if the field changed since the caller read it.
 */
async function mutateField(
  ctx: OpsContext,
  instance: string,
  field: string,
  fallback: unknown,
  apply: (current: unknown, ownerEdited: boolean) => { value: unknown; ownerEdited: boolean } | null,
  expectedRev?: number | null,
): Promise<{ rev: number; value: unknown } | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const row = await readContentRow(ctx.db, ctx.siteId, instance, field);
    const currentRev = row ? row.rev : 0;
    if (expectedRev !== undefined && expectedRev !== null && Number(expectedRev) !== currentRev) {
      throw staleError('This field', { currentRev, instance, field });
    }
    const next = apply(row ? structuredClone(row.value) : structuredClone(fallback), row?.ownerEdited ?? false);
    if (!next) return null;
    try {
      const rev = await writeContentRow(ctx.db, ctx.siteId, instance, field, next.value, next.ownerEdited, ctx.actor, row ? row.rev : null);
      return { rev, value: next.value };
    } catch (e) {
      if (!(e instanceof StaleWriteError)) throw e;
      if (expectedRev !== undefined && expectedRev !== null) throw staleError('This field', { instance, field });
    }
  }
  throw new OpError('This field is being changed by someone else right now. Try again.', 409, { reason: 'busy' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Site summary
// ─────────────────────────────────────────────────────────────────────────────

function summarizeFields(fields: FieldSchema[]): unknown[] {
  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    ...(f.max ? { max: f.max } : {}),
    ...(f.aspect ? { aspect: f.aspect } : {}),
    ...(f.hrefOnly ? { hrefOnly: true } : {}),
    ...(f.item ? { item: summarizeFields(f.item) } : {}),
  }));
}

export async function opGetSite(ctx: OpsContext, opts: { includeCode?: boolean } = {}) {
  const bundle = await bundleOrThrow(ctx);
  const row = await loadSiteRow(ctx.db, ctx.siteId);
  return {
    site: {
      id: bundle.site.id,
      title: bundle.site.title,
      engine: row?.engine,
      isPublished: !!row?.is_published,
      publishedDomain: row?.published_domain || null,
      domain: bundle.site.domain,
      logo: bundle.site.logo,
      favicon: bundle.site.favicon,
      contactEmail: bundle.site.contactEmail,
      businessProfile: bundle.site.businessProfile,
    },
    theme: {
      tokens: bundle.theme.tokens,
      ownerOverrides: bundle.theme.owner_overrides,
      fonts: bundle.theme.fonts,
      header: bundle.theme.header_section,
      footer: bundle.theme.footer_section,
      platform: bundle.theme.platform || {},
      version: bundle.theme.version,
      ...(opts.includeCode ? { globalCss: bundle.theme.global_css, globalJs: bundle.theme.global_js } : {
        globalCssBytes: bundle.theme.global_css.length,
        globalJsBytes: bundle.theme.global_js.length,
      }),
    },
    sections: Object.values(bundle.sections).map((s) => ({
      key: s.key,
      name: s.name,
      version: s.version,
      fields: summarizeFields(schemaOf(bundle, s.key).fields),
      ...(opts.includeCode ? { html: s.html, css: s.css, js: s.js } : {}),
    })),
    pages: bundle.pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      navLabel: p.display_name,
      showInNav: p.is_visible_in_nav,
      navOrder: p.nav_order,
      seo: p.seo,
      ...(p.template ? { template: p.template } : {}),
      ...(p.access ? { access: p.access } : {}),
      sections: p.instances,
      layoutVersion: p.layoutVersion ?? 0,
    })),
    ownerEditedFields: bundle.ownerEdited,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design (agents / staff)
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeInput {
  expected_version?: number;
  /** which tokens Keystone's own flows use: { primary, secondary, accent } → token name */
  platform?: Record<string, string>;
  tokens?: ThemeToken[];
  fonts?: Array<{ family: string; weights?: string }>;
  global_css?: string;
  global_js?: string;
}

export async function opSetTheme(ctx: OpsContext, input: ThemeInput) {
  const patch: Record<string, unknown> = {};
  if (input.tokens) {
    if (!Array.isArray(input.tokens)) throw new OpError('tokens must be an array');
    const names = new Set<string>();
    patch.tokens = input.tokens.map((t) => {
      const name = String(t.name || '').replace(/^--/, '');
      if (!TOKEN_NAME_RE.test(name)) throw new OpError(`Token name "${t.name}" is invalid`);
      if (names.has(name)) throw new OpError(`Duplicate token "${name}"`);
      names.add(name);
      const type = ['color', 'font', 'length', 'text'].includes(String(t.type)) ? t.type : 'text';
      return {
        name,
        value: safeTokenValue(t.value),
        label: t.label ? toPlainText(String(t.label)).slice(0, 60) : undefined,
        group: t.group ? toPlainText(String(t.group)).slice(0, 40) : undefined,
        type,
        editable: !!t.editable,
      };
    });
  }
  if (input.fonts) {
    patch.fonts = (input.fonts || []).slice(0, 6).map((f) => ({
      family: String(f.family || '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 60),
      weights: f.weights ? String(f.weights).replace(/[^0-9;]/g, '').slice(0, 40) : undefined,
    })).filter((f) => f.family);
  }
  if (input.global_css !== undefined) {
    const css = String(input.global_css);
    if (Buffer.byteLength(css, 'utf8') > BUDGETS.globalCssBytes) throw new OpError(`Global CSS is over ${BUDGETS.globalCssBytes / 1000}KB`);
    try {
      postcss.parse(css);
    } catch (e) {
      throw new OpError(`Global CSS does not parse: ${(e as Error).message}`);
    }
    patch.global_css = css;
  }
  if (input.global_js !== undefined) {
    const js = String(input.global_js);
    if (Buffer.byteLength(js, 'utf8') > BUDGETS.globalJsBytes) throw new OpError(`Global JS is over ${BUDGETS.globalJsBytes / 1000}KB`);
    patch.global_js = js;
  }
  if (input.platform !== undefined) {
    const platform: Record<string, string> = {};
    for (const role of ['primary', 'secondary', 'accent']) {
      const name = input.platform?.[role];
      if (name === undefined || name === null || name === '') continue;
      if (!TOKEN_NAME_RE.test(String(name).replace(/^--/, ''))) throw new OpError(`platform.${role} must be a token name`);
      platform[role] = String(name).replace(/^--/, '');
    }
    patch.platform = platform;
  }
  if (!Object.keys(patch).length) throw new OpError('Nothing to change');

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'theme change');
  const version = await mutateTheme(ctx, () => patch, input.expected_version);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'set_theme', { keys: Object.keys(patch) });
  return { ok: true, changed: Object.keys(patch), version };
}

export interface SectionInput {
  /** reject the write if the section changed since this version was read (0 = must be new) */
  expected_version?: number;
  key: string;
  name?: string;
  html: string;
  css?: string;
  js?: string;
}

export async function opPutSection(ctx: OpsContext, input: SectionInput) {
  const key = String(input.key || '').trim();
  if (!SECTION_KEY_RE.test(key)) throw new OpError('Section key must be lower-case letters, numbers and dashes (max 48), starting with a letter');
  const split = splitSectionSource(String(input.html || ''));
  const css = [split.css, input.css || ''].filter(Boolean).join('\n');
  const js = [split.js, input.js || ''].filter(Boolean).join('\n');
  if (Buffer.byteLength(css, 'utf8') > BUDGETS.sectionCssBytes * 2) throw new OpError('Section CSS is far over budget; move shared styles into the theme\'s global CSS');
  if (Buffer.byteLength(js, 'utf8') > BUDGETS.sectionJsBytes * 2) throw new OpError('Section JS is far over budget');
  try {
    postcss.parse(css);
  } catch (e) {
    throw new OpError(`Section CSS does not parse: ${(e as Error).message}`);
  }

  const compiled = compileSection(split.html);
  const { data: existing } = await ctx.db
    .from('v2_sections')
    .select('id, version, schema, name')
    .eq('site_id', ctx.siteId)
    .eq('key', key)
    .maybeSingle();

  const currentVersion = existing ? Number(existing.version) || 1 : 0;
  if (input.expected_version !== undefined && input.expected_version !== null && Number(input.expected_version) !== currentVersion) {
    throw staleError(`Section "${key}"`, { currentVersion });
  }

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `section ${key}`);
  const row = {
    site_id: ctx.siteId,
    key,
    name: toPlainText(input.name || existing?.name || key).slice(0, 80) || key,
    html: split.html,
    css,
    js,
    schema: compiled,
    version: (existing?.version || 0) + 1,
    updated_by: actorLabel(ctx.actor),
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { data: updated, error } = await ctx.db
      .from('v2_sections')
      .update(row)
      .eq('site_id', ctx.siteId)
      .eq('key', key)
      .eq('version', currentVersion)
      .select('version');
    if (error) throw new OpError(`Failed to save section: ${error.message}`, 500);
    if (!updated?.length) throw staleError(`Section "${key}"`, {});
  } else {
    const { error } = await ctx.db.from('v2_sections').insert(row);
    if (error?.code === '23505') throw staleError(`Section "${key}"`, {});
    if (error) throw new OpError(`Failed to save section: ${error.message}`, 500);
  }

  // Report fields that disappeared or changed type — stored content for them is no longer shown.
  const before = new Map(((existing?.schema as CompiledSection | undefined)?.fields || []).map((f) => [f.id, f.type]));
  const after = new Map(compiled.fields.map((f) => [f.id, f.type]));
  const removedFields = [...before.keys()].filter((id) => !after.has(id));
  const changedType = [...before.entries()].filter(([id, type]) => after.has(id) && after.get(id) !== type).map(([id]) => id);

  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'put_section', { key, version: row.version });
  return {
    key,
    version: row.version,
    created: !existing,
    fields: summarizeFields(compiled.fields),
    editableFields: compiled.stats.boundFields,
    issues: compiled.issues,
    ...(removedFields.length ? { removedFields } : {}),
    ...(changedType.length ? { changedTypeFields: changedType } : {}),
  };
}

export async function opDeleteSection(ctx: OpsContext, key: string, force = false) {
  const bundle = await bundleOrThrow(ctx);
  if (!bundle.sections[key]) throw new OpError(`Section "${key}" does not exist`, 404);
  const usedOn = bundle.pages.filter((p) => p.instances.some((i) => i.section === key)).map((p) => p.slug);
  const inLayout = bundle.theme.header_section === key || bundle.theme.footer_section === key;
  if ((usedOn.length || inLayout) && !force) {
    throw new OpError(`Section "${key}" is in use (${[...usedOn, ...(inLayout ? ['layout'] : [])].join(', ')}). Pass force to remove it from those pages too.`, 409);
  }
  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `delete section ${key}`);
  for (const page of bundle.pages) {
    if (page.instances.some((i) => i.section === key)) {
      await mutateLayout(ctx, page.id, (instances) => instances.filter((i) => i.section !== key));
    }
  }
  if (inLayout) {
    await mutateTheme(ctx, (row) => ({
      ...(row.header_section === key ? { header_section: null } : {}),
      ...(row.footer_section === key ? { footer_section: null } : {}),
    }));
  }
  await ctx.db.from('v2_sections').delete().eq('site_id', ctx.siteId).eq('key', key);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'delete_section', { key });
  return { deleted: key, removedFrom: usedOn };
}

export async function opSetLayout(ctx: OpsContext, input: { header?: string | null; footer?: string | null; header_content?: Record<string, unknown>; footer_content?: Record<string, unknown> }) {
  const bundle = await bundleOrThrow(ctx);
  const patch: Record<string, unknown> = {};
  for (const slot of ['header', 'footer'] as const) {
    const value = input[slot];
    if (value === undefined) continue;
    if (value !== null && !bundle.sections[value]) throw new OpError(`Section "${value}" does not exist. Create it with put_section first.`, 404);
    patch[`${slot}_section`] = value;
  }
  if (Object.keys(patch).length) {
    await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'layout');
    await mutateTheme(ctx, () => patch);
  }
  const contentResults = [];
  if (input.header_content) contentResults.push(...(await opSetContent(ctx, Object.entries(input.header_content).map(([path, value]) => ({ instance: GLOBAL_INSTANCE_HEADER, path, value })))).results);
  if (input.footer_content) contentResults.push(...(await opSetContent(ctx, Object.entries(input.footer_content).map(([path, value]) => ({ instance: GLOBAL_INSTANCE_FOOTER, path, value })))).results);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'set_layout', patch);
  return { ok: true, layout: patch, content: contentResults };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────────────────────

export interface PageInput {
  slug: string;
  title?: string;
  nav_label?: string;
  show_in_nav?: boolean;
  nav_order?: number;
  seo?: { title?: string; description?: string; ogImage?: string };
  /** "post" makes this page the article layout for /blog/<slug>; null turns that off. */
  template?: 'post' | null;
  /** Members-only page: { members: true, packages?: [ids] }; null/false makes it public again. */
  access?: { members?: boolean; packages?: string[] } | null | false;
  sections?: Array<{ id?: string; section: string; hidden?: boolean; audience?: Audience | null; content?: Record<string, unknown> }>;
  /** reject replacing the section list if the page layout changed since this version was read */
  expected_version?: number;
}

export async function opPutPage(ctx: OpsContext, input: PageInput, opts: { force?: boolean } = {}) {
  const slug = String(input.slug || '').trim().toLowerCase();
  if (!PAGE_SLUG_RE.test(slug)) throw new OpError('Page slug must be lower-case letters, numbers and dashes (use "home" for the home page)');
  const bundle = await bundleOrThrow(ctx);
  let page = bundle.pages.find((p) => p.slug === slug) || null;

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `page ${slug}`);

  if (input.template !== undefined && input.template !== null && input.template !== 'post') {
    throw new OpError('template must be "post" (the article layout) or null');
  }
  if (input.template === 'post') {
    if (slug === 'home') throw new OpError('The home page can\'t be the article layout. Use another slug, e.g. "article".');
    const other = bundle.pages.find((p) => p.template === 'post' && p.slug !== slug);
    if (other) throw new OpError(`Page "${other.slug}" is already the article layout. Set template: null on it first, or update that page.`);
  }
  const templateChange = input.template !== undefined ? { v2Template: input.template === 'post' ? 'post' : null } : null;
  let accessChange: { v2Access: PageAccess | null } | null = null;
  if (input.access !== undefined) {
    const wanted = input.access && input.access.members !== false ? input.access : null;
    if (wanted) {
      if (slug === 'home') throw new OpError('The home page can\'t be members-only. Make a separate page (e.g. "members") and link to it.');
      if (input.template === 'post' || (input.template === undefined && page?.template === 'post')) throw new OpError('The article layout can\'t be members-only.');
      const packages = Array.isArray(wanted.packages) ? [...new Set(wanted.packages.map(String))] : [];
      if (packages.length) {
        const { data: found } = await ctx.db.from('membership_packages').select('id').eq('site_id', ctx.siteId).in('id', packages);
        const known = new Set((found || []).map((r: { id: string }) => r.id));
        const missing = packages.filter((id) => !known.has(id));
        if (missing.length) throw new OpError(`Unknown membership package id(s): ${missing.join(', ')}. See get_membership.`);
      }
      accessChange = { v2Access: { members: true, ...(packages.length ? { packages } : {}) } };
    } else {
      accessChange = { v2Access: null };
    }
  }

  const title = input.title !== undefined ? toPlainText(input.title).slice(0, 120) : page?.title || titleFromSlug(slug);
  const seo = input.seo ? {
    seoTitle: input.seo.title !== undefined ? toPlainText(input.seo.title).slice(0, 120) || null : page?.seo.title || null,
    seoDescription: input.seo.description !== undefined ? toPlainText(input.seo.description).slice(0, 320) || null : page?.seo.description || null,
    ogImage: input.seo.ogImage !== undefined ? safeSrc(input.seo.ogImage) || null : page?.seo.ogImage || null,
  } : null;

  if (!page) {
    const navOrder = input.nav_order ?? (slug === 'home' ? 0 : Math.max(0, ...bundle.pages.map((p) => p.nav_order)) + 1);
    const { data, error } = await ctx.db.from('pages').insert({
      site_id: ctx.siteId,
      slug,
      title,
      display_name: input.nav_label ? toPlainText(input.nav_label).slice(0, 60) : title,
      // The article layout isn't a page of its own, so it stays out of the menu unless asked.
      is_visible_in_nav: input.show_in_nav ?? input.template !== 'post',
      nav_order: navOrder,
      design_data: { ...(seo || {}), ...(templateChange || {}), ...(accessChange || {}) },
    }).select('id').single();
    if (error) throw new OpError(`Failed to create page: ${error.message}`, 500);
    page = { id: data.id, slug, title, display_name: title, is_visible_in_nav: input.show_in_nav ?? input.template !== 'post', nav_order: navOrder, seo: {}, instances: [], ...(input.template === 'post' ? { template: 'post' as const } : {}), ...(accessChange?.v2Access ? { access: accessChange.v2Access } : {}) };
  } else {
    const { data: row } = await ctx.db.from('pages').select('design_data').eq('id', page.id).single();
    const update: Record<string, unknown> = { title, updated_at: new Date().toISOString() };
    if (input.nav_label !== undefined) update.display_name = toPlainText(input.nav_label).slice(0, 60) || title;
    if (input.show_in_nav !== undefined) update.is_visible_in_nav = !!input.show_in_nav;
    if (input.nav_order !== undefined) update.nav_order = Number(input.nav_order) || 0;
    if (seo || templateChange || accessChange) update.design_data = { ...(row?.design_data || {}), ...(seo || {}), ...(templateChange || {}), ...(accessChange || {}) };
    if (input.template === 'post' && input.show_in_nav === undefined && page.template !== 'post') update.is_visible_in_nav = false;
    const { error } = await ctx.db.from('pages').update(update).eq('id', page.id);
    if (error) throw new OpError(`Failed to update page: ${error.message}`, 500);
  }

  let contentResults: ContentResult[] = [];
  if (input.sections) {
    const usedElsewhere = new Set(bundle.pages.filter((p) => p.id !== page!.id).flatMap((p) => p.instances.map((i) => i.id)));
    const seen = new Set<string>();
    const instances: SectionInstance[] = input.sections.map((s) => {
      if (!bundle.sections[s.section]) throw new OpError(`Section "${s.section}" does not exist. Create it with put_section first.`, 404);
      let id = s.id && /^[a-zA-Z0-9_-]{1,40}$/.test(s.id) ? s.id : newInstanceId();
      if (id === GLOBAL_INSTANCE_HEADER || id === GLOBAL_INSTANCE_FOOTER) throw new OpError(`Instance id "${id}" is reserved`);
      if (usedElsewhere.has(id)) throw new OpError(`Instance id "${id}" is already used on another page`);
      if (seen.has(id)) id = newInstanceId();
      seen.add(id);
      if (s.audience && !(AUDIENCES as readonly string[]).includes(s.audience)) throw new OpError(`audience must be one of ${AUDIENCES.join(', ')}`);
      return { id, section: s.section, ...(s.hidden ? { hidden: true } : {}), ...(s.audience ? { audience: s.audience } : {}) };
    });
    if (input.expected_version !== undefined && input.expected_version !== null) {
      await mutateLayout(ctx, page.id, () => instances, input.expected_version);
    } else {
      await saveLayout(ctx.db, ctx.siteId, page.id, instances); // a full replacement: last write wins
    }
    page.instances = instances;

    const changes = input.sections.flatMap((s, index) =>
      Object.entries(s.content || {}).map(([path, value]) => ({ instance: instances[index].id, path, value })),
    );
    if (changes.length) {
      // Reload so the new layout is visible to content resolution.
      contentResults = (await opSetContent(ctx, changes, { force: opts.force, skipSnapshot: true })).results;
    }
  }

  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'put_page', { slug });
  const isTemplate = input.template !== undefined ? input.template === 'post' : page.template === 'post';
  const access = accessChange ? accessChange.v2Access : page.access || null;
  return {
    page: {
      id: page.id,
      slug,
      title,
      ...(isTemplate ? { template: 'post', note: 'Used for every /blog/<slug> article. Not reachable at its own URL on the live site.' } : {}),
      ...(access ? { access, note: 'Members-only: sections default to members; mark the hero "everyone" and a sign-in panel "guests". Visitors without access never receive the members sections.' } : {}),
    },
    sections: page.instances,
    content: contentResults,
  };
}

export async function opUpdatePage(ctx: OpsContext, ref: string, patch: { title?: string; nav_label?: string; show_in_nav?: boolean; nav_order?: number; seo?: { title?: string; description?: string } }) {
  const bundle = await bundleOrThrow(ctx);
  const page = findPage(bundle, ref);
  const { data: row } = await ctx.db.from('pages').select('design_data').eq('id', page.id).single();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = toPlainText(patch.title).slice(0, 120) || page.title;
  if (patch.nav_label !== undefined) update.display_name = toPlainText(patch.nav_label).slice(0, 60) || page.display_name;
  if (patch.show_in_nav !== undefined) update.is_visible_in_nav = !!patch.show_in_nav;
  if (patch.nav_order !== undefined) update.nav_order = Number(patch.nav_order) || 0;
  if (patch.seo) {
    update.design_data = {
      ...(row?.design_data || {}),
      ...(patch.seo.title !== undefined ? { seoTitle: toPlainText(patch.seo.title).slice(0, 120) || null } : {}),
      ...(patch.seo.description !== undefined ? { seoDescription: toPlainText(patch.seo.description).slice(0, 320) || null } : {}),
    };
  }
  const { error } = await ctx.db.from('pages').update(update).eq('id', page.id);
  if (error) throw new OpError(`Failed to update page: ${error.message}`, 500);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'update_page', { slug: page.slug });
  return { ok: true };
}

export async function opDeletePage(ctx: OpsContext, ref: string) {
  const bundle = await bundleOrThrow(ctx);
  const page = findPage(bundle, ref);
  if (page.slug === 'home') throw new OpError('The home page cannot be deleted');
  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `delete page ${page.slug}`);
  await ctx.db.from('v2_content').delete().eq('site_id', ctx.siteId).in('instance_id', page.instances.map((i) => i.id).concat(['__none__']));
  const { error } = await ctx.db.from('pages').delete().eq('id', page.id).eq('site_id', ctx.siteId);
  if (error) throw new OpError(`Failed to delete page: ${error.message}`, 500);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'delete_page', { slug: page.slug });
  return { deleted: page.slug };
}

/** Owner-editor section actions on a page. */
export async function opPageSections(
  ctx: OpsContext,
  input: { page: string; action: 'add' | 'move' | 'duplicate' | 'remove' | 'hide' | 'show'; instance?: string; section?: string; index?: number; to?: number; expected_version?: number },
) {
  const bundle = await bundleOrThrow(ctx);
  const page = findPage(bundle, input.page);
  if (input.action === 'add' && (!input.section || !bundle.sections[input.section])) throw new OpError('Choose a section design to add', 404);

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `${input.action} section`);
  const created = input.action === 'add' || input.action === 'duplicate' ? newInstanceId() : undefined;
  let copiedFrom: string | null = null;

  const result = await mutateLayout(ctx, page.id, (current) => {
    const instances = [...current];
    const at = input.instance ? instances.findIndex((i) => i.id === input.instance) : -1;
    if (input.action !== 'add' && at === -1) throw new OpError('Section not found on this page', 404);
    switch (input.action) {
      case 'add': {
        const index = input.index === undefined ? instances.length : Math.max(0, Math.min(instances.length, input.index));
        instances.splice(index, 0, { id: created!, section: input.section! });
        break;
      }
      case 'move': {
        const to = Math.max(0, Math.min(instances.length - 1, Number(input.to)));
        const [moved] = instances.splice(at, 1);
        instances.splice(to, 0, moved);
        break;
      }
      case 'duplicate':
        instances.splice(at + 1, 0, { id: created!, section: instances[at].section });
        copiedFrom = instances[at].id;
        break;
      case 'remove':
        instances.splice(at, 1);
        break;
      case 'hide':
      case 'show':
        instances[at] = { ...instances[at], hidden: input.action === 'hide' };
        break;
    }
    return instances;
  }, input.expected_version);

  if (copiedFrom && created) await copyInstanceContent(ctx.db, ctx.siteId, copiedFrom, created, ctx.actor);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, `section_${input.action}`, { page: page.slug, instance: input.instance || created });
  return { ok: true, instances: result.instances, layoutVersion: result.version, created };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentChange {
  instance: string;
  path: string;
  value: unknown;
  /** the field revision the caller read (0 = template default); stale → rejected */
  expected_rev?: number;
}

export interface ContentResult {
  instance: string;
  path: string;
  status: 'saved' | 'skipped_owner_edit' | 'conflict' | 'error';
  message?: string;
  rev?: number;
}

export async function opSetContent(ctx: OpsContext, changes: ContentChange[], opts: { force?: boolean; skipSnapshot?: boolean } = {}) {
  if (!Array.isArray(changes) || !changes.length) throw new OpError('No content changes given');
  if (changes.length > 300) throw new OpError('Too many changes in one call (max 300)');
  const bundle = await bundleOrThrow(ctx);
  if (!opts.skipSnapshot) await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'content edit');

  // Group by stored field so several paths into one list become one write.
  const groups = new Map<string, { instance: string; field: string; schema: CompiledSection; items: Array<{ change: ContentChange; rest: string[]; index: number }> }>();
  const results: ContentResult[] = changes.map((c) => ({ instance: c.instance, path: c.path, status: 'saved' as const }));

  changes.forEach((change, index) => {
    try {
      const where = findInstance(bundle, change.instance);
      if (!where) throw new ContentError(`Section instance "${change.instance}" not found`);
      const schema = schemaOf(bundle, where.section);
      const { field, rest } = splitPath(change.path);
      if (!schema.fields.some((f) => f.id === field)) throw new ContentError(`Unknown field "${field}"`);
      const key = `${change.instance}/${field}`;
      if (!groups.has(key)) groups.set(key, { instance: change.instance, field, schema, items: [] });
      groups.get(key)!.items.push({ change, rest, index });
    } catch (e) {
      results[index] = { instance: change.instance, path: change.path, status: 'error', message: (e as Error).message };
    }
  });

  let saved = 0;
  for (const [key, group] of groups) {
    const expectedRev = group.items.find((i) => i.change.expected_rev !== undefined)?.change.expected_rev;
    try {
      const outcome = await mutateField(ctx, group.instance, group.field, group.schema.defaults[group.field], (current, ownerEdited) => {
        if (ctx.actor.type !== 'owner' && ownerEdited && !opts.force) {
          for (const item of group.items) {
            results[item.index] = { instance: group.instance, path: item.change.path, status: 'skipped_owner_edit', message: 'The owner edited this field. Only overwrite it if the human asked you to (pass force: true).' };
          }
          return null;
        }
        let value = current;
        let applied = 0;
        for (const item of group.items) {
          try {
            value = applyFieldChange(group.schema.fields, value, group.field, item.rest, item.change.value);
            results[item.index] = { instance: group.instance, path: item.change.path, status: 'saved' };
            applied++;
          } catch (e) {
            results[item.index] = { instance: group.instance, path: item.change.path, status: 'error', message: (e as Error).message };
          }
        }
        if (!applied) return null;
        return { value, ownerEdited: ctx.actor.type === 'owner' ? true : opts.force ? false : ownerEdited };
      }, expectedRev);
      if (outcome) {
        saved++;
        for (const item of group.items) if (results[item.index].status === 'saved') results[item.index].rev = outcome.rev;
      }
    } catch (e) {
      const message = (e as Error).message;
      const status = e instanceof OpError && e.status === 409 ? 'conflict' : 'error';
      for (const item of group.items) results[item.index] = { instance: group.instance, path: item.change.path, status, message };
    }
    void key;
  }
  if (saved) await logActivity(ctx.db, ctx.siteId, ctx.actor, 'set_content', { fields: [...groups.keys()].slice(0, 50) });
  return { results };
}

export async function opListOp(ctx: OpsContext, input: { instance: string; path: string; expected_rev?: number } & ListOp) {
  const bundle = await bundleOrThrow(ctx);
  const where = findInstance(bundle, input.instance);
  if (!where) throw new OpError('Section instance not found', 404);
  const schema = schemaOf(bundle, where.section);
  const { field, rest } = splitPath(input.path);
  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'list edit');
  const template = defaultListItem(schema.defaults as Record<string, unknown>, field, rest);
  const { instance: _i, path: _p, expected_rev: expectedRev, ...operation } = input;
  void _i; void _p;
  const outcome = await mutateField(ctx, input.instance, field, schema.defaults[field], (current, ownerEdited) => {
    if (ctx.actor.type !== 'owner' && ownerEdited) {
      throw new OpError('The owner edited this list; agents may not restructure it without being asked.', 409, { reason: 'owner_edited' });
    }
    try {
      return { value: applyListOp(schema.fields, current, field, rest, operation as ListOp, template), ownerEdited: ctx.actor.type === 'owner' || ownerEdited };
    } catch (e) {
      throw new OpError((e as Error).message);
    }
  }, expectedRev);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, `list_${operation.op}`, { instance: input.instance, path: input.path });
  return { ok: true, value: outcome?.value, rev: outcome?.rev };
}

export async function opGetContent(ctx: OpsContext, opts: { page?: string; instance?: string } = {}) {
  const bundle = await bundleOrThrow(ctx);
  const describe = (instanceId: string, sectionKey: string) => {
    const schema = schemaOf(bundle, sectionKey);
    const values: Record<string, unknown> = {};
    for (const f of schema.fields) {
      const stored = bundle.content[instanceId]?.[f.id];
      values[f.id] = {
        value: stored ?? schema.defaults[f.id],
        rev: bundle.contentRev?.[`${instanceId}/${f.id}`] ?? 0,
        source: stored === undefined ? 'template default' : bundle.ownerEdited.includes(`${instanceId}/${f.id}`) ? 'owner' : 'stored',
      };
    }
    return { instance: instanceId, section: sectionKey, fields: summarizeFields(schema.fields), values };
  };
  const out: unknown[] = [];
  if (opts.instance) {
    const where = findInstance(bundle, opts.instance);
    if (!where) throw new OpError('Section instance not found', 404);
    out.push(describe(opts.instance, where.section));
  } else {
    if (!opts.page) {
      if (bundle.theme.header_section) out.push(describe(GLOBAL_INSTANCE_HEADER, bundle.theme.header_section));
      if (bundle.theme.footer_section) out.push(describe(GLOBAL_INSTANCE_FOOTER, bundle.theme.footer_section));
    }
    for (const page of bundle.pages) {
      if (opts.page && page.slug !== opts.page && page.id !== opts.page) continue;
      for (const inst of page.instances) {
        if (bundle.sections[inst.section]) out.push({ page: page.slug, ...describe(inst.id, inst.section) });
      }
    }
  }
  return { content: out };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner settings: brand tokens and business info
// ─────────────────────────────────────────────────────────────────────────────

export async function opSetOwnerTokens(ctx: OpsContext, overrides: Record<string, string | null>) {
  const bundle = await bundleOrThrow(ctx);
  const editable = new Map(bundle.theme.tokens.filter((t) => t.editable).map((t) => [t.name, t]));
  const next = { ...(bundle.theme.owner_overrides || {}) };
  for (const [name, value] of Object.entries(overrides || {})) {
    const token = editable.get(name);
    if (!token) throw new OpError(`"${name}" is not an editable brand setting`);
    if (value === null || value === '') {
      delete next[name];
      continue;
    }
    const clean = safeTokenValue(value);
    if (token.type === 'color' && !/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i.test(clean)) {
      throw new OpError(`"${clean}" is not a colour`);
    }
    next[name] = clean;
  }
  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'brand settings');
  // Re-apply onto the freshest overrides so concurrent brand edits don't clobber each other.
  await mutateTheme(ctx, (row) => {
    const merged = { ...((row.owner_overrides as Record<string, string>) || {}) };
    for (const [name, value] of Object.entries(overrides || {})) {
      if (value === null || value === '') delete merged[name];
      else merged[name] = next[name];
    }
    return { owner_overrides: merged };
  });
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'brand', { tokens: Object.keys(overrides || {}) });
  return { ok: true, ownerOverrides: next };
}

export interface BusinessInput {
  name?: string;
  legalName?: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  hours?: string[];
  logo?: string | null;
  favicon?: string | null;
}

export async function opUpdateBusiness(ctx: OpsContext, input: BusinessInput) {
  const row = await loadSiteRow(ctx.db, ctx.siteId);
  if (!row) throw new OpError('Site not found', 404);
  const dd = { ...(row.design_data || {}) } as Record<string, unknown>;
  const bp = { ...(row.business_profile || {}) } as Record<string, unknown>;
  const text = (v: unknown, max = 200) => toPlainText(String(v ?? '')).slice(0, max);

  if (input.name !== undefined) dd.siteTitle = text(input.name, 100);
  if (input.email !== undefined) dd.contactEmail = text(input.email, 200);
  if (input.logo !== undefined) dd.siteLogo = input.logo ? safeSrc(input.logo) : null;
  if (input.favicon !== undefined) dd.faviconLogo = input.favicon ? safeSrc(input.favicon) : null;
  const bpMap: Array<[keyof BusinessInput, string]> = [
    ['legalName', 'legalName'], ['phone', 'telephone'], ['streetAddress', 'streetAddress'], ['city', 'addressLocality'],
    ['region', 'addressRegion'], ['postalCode', 'postalCode'], ['country', 'addressCountry'],
  ];
  for (const [from, to] of bpMap) if (input[from] !== undefined) bp[to] = text(input[from]);
  if (input.hours !== undefined) bp.openingHours = (input.hours || []).slice(0, 14).map((h) => text(h, 80)).filter(Boolean);
  if (!bp.legalName && dd.siteTitle) bp.legalName = dd.siteTitle;

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'business info');
  const { error } = await ctx.db.from('sites').update({ design_data: dd, business_profile: bp, updated_at: new Date().toISOString() }).eq('id', ctx.siteId);
  if (error) throw new OpError(`Failed to save business info: ${error.message}`, 500);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'business', { keys: Object.keys(input) });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Versions, validation, publish
// ─────────────────────────────────────────────────────────────────────────────

export async function opListVersions(ctx: OpsContext, limit = 30) {
  const { data } = await ctx.db
    .from('v2_releases')
    .select('id, kind, label, created_at, created_by')
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, limit));
  const row = await loadSiteRow(ctx.db, ctx.siteId);
  return {
    live: row?.v2_release_id || null,
    versions: (data || []).map((v) => ({ ...v, isLive: v.id === row?.v2_release_id })),
  };
}

export async function opRestoreVersion(ctx: OpsContext, versionId: string) {
  const { data } = await ctx.db.from('v2_releases').select('id, manifest, site_id, label').eq('id', versionId).maybeSingle();
  if (!data || data.site_id !== ctx.siteId) throw new OpError('Version not found', 404);
  await createSnapshot(ctx.db, ctx.siteId, 'Before restoring an earlier version', ctx.actor);
  const result = await restoreBundle(ctx.db, ctx.siteId, data.manifest as SiteBundle, ctx.actor);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'restore', { versionId });
  return { ok: true, restored: versionId, note: result.extraPages.length ? `${result.extraPages.length} page(s) created after that version were kept.` : undefined };
}

export async function opValidate(ctx: OpsContext) {
  const bundle = await bundleOrThrow(ctx);
  return validateBundle(bundle);
}

/** Freeze the draft into a release and make it live. Caller handles domain + billing checks. */
export async function opPublishRelease(ctx: OpsContext, opts: { label?: string; skipValidation?: boolean } = {}) {
  const bundle = await bundleOrThrow(ctx);
  const report = validateBundle(bundle);
  if (!report.ok && !opts.skipValidation) {
    throw new OpError(`Fix ${report.errors.length} error(s) before publishing`, 422, report);
  }
  const { data, error } = await ctx.db
    .from('v2_releases')
    .insert({ site_id: ctx.siteId, kind: 'publish', label: opts.label || 'Published', manifest: bundle, created_by: actorLabel(ctx.actor) })
    .select('id')
    .single();
  if (error) throw new OpError(`Failed to create release: ${error.message}`, 500);
  const { error: siteErr } = await ctx.db.from('sites').update({ v2_release_id: data.id }).eq('id', ctx.siteId);
  if (siteErr) throw new OpError(`Failed to point site at release: ${siteErr.message}`, 500);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'publish', { releaseId: data.id });
  return { releaseId: data.id as string, warnings: report.warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Site creation
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSiteInput {
  name: string;
  business_type?: 'services' | 'products' | 'portfolio' | 'nonprofit' | 'other';
  category?: string;
  business?: BusinessInput;
}

export async function opCreateSite(db: Db, userId: string, actor: Actor, input: CreateSiteInput) {
  const name = toPlainText(input.name || '').slice(0, 100);
  if (!name) throw new OpError('name is required');
  const businessType = ['services', 'products', 'portfolio', 'nonprofit', 'other'].includes(String(input.business_type))
    ? input.business_type!
    : 'services';
  const category = toPlainText(input.category || 'general').toLowerCase().slice(0, 60) || 'general';

  // Same display-slug convention as /api/sites (unique per owner).
  const { data: existing } = await db.from('sites').select('site_slug').eq('user_id', userId).ilike('site_slug', `${name}%`);
  const taken = new Set((existing || []).map((s: { site_slug: string }) => s.site_slug));
  let siteSlug = name;
  for (let n = 2; taken.has(siteSlug); n++) siteSlug = `${name} ${n}`;

  const { data: site, error } = await db.from('sites').insert({
    user_id: userId,
    site_slug: siteSlug,
    selected_template_id: 'agent_v2',
    business_type: businessType,
    category,
    engine: ENGINE_V2,
    design_data: { siteTitle: name },
  }).select('id').single();
  if (error) throw new OpError(`Failed to create site: ${error.message}`, 500);

  const siteId = site.id as string;
  const { data: home, error: pageErr } = await db.from('pages').insert({
    site_id: siteId,
    slug: 'home',
    title: 'Home',
    display_name: 'Home',
    is_visible_in_nav: true,
    nav_order: 0,
    design_data: {},
  }).select('id').single();
  if (pageErr) throw new OpError(`Failed to create home page: ${pageErr.message}`, 500);
  await ensureTheme(db, siteId);
  await saveLayout(db, siteId, home.id, []);

  const ctx: OpsContext = { db, siteId, actor };
  if (input.business) await opUpdateBusiness(ctx, { name, ...input.business });
  await logActivity(db, siteId, actor, 'create_site', { name });
  return { siteId, homePageId: home.id as string };
}

function titleFromSlug(slug: string): string {
  if (slug === 'home') return 'Home';
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
