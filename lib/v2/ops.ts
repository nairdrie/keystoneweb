/**
 * v2 site operations. The owner editor (/api/v2/editor) and agents (/api/mcp)
 * call the same functions, so both are held to the same rules:
 *   - agents can't overwrite content the owner edited unless forced,
 *   - every change is attributed and a restore point is taken first,
 *   - all content is sanitized on write.
 */
import { randomBytes } from 'crypto';
import postcss from 'postcss';
import type { Actor, CompiledSection, FieldSchema, PageRecord, SectionInstance, SiteBundle, ThemeToken } from './types';
import { ENGINE_V2, GLOBAL_INSTANCE_FOOTER, GLOBAL_INSTANCE_HEADER } from './types';
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
  saveLayout,
  saveTheme,
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
// Site summary
// ─────────────────────────────────────────────────────────────────────────────

function summarizeFields(fields: FieldSchema[]): unknown[] {
  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    ...(f.max ? { max: f.max } : {}),
    ...(f.aspect ? { aspect: f.aspect } : {}),
    ...(f.optional ? { optional: true } : {}),
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
      contactEmail: bundle.site.contactEmail,
      businessProfile: bundle.site.businessProfile,
    },
    theme: {
      tokens: bundle.theme.tokens,
      ownerOverrides: bundle.theme.owner_overrides,
      fonts: bundle.theme.fonts,
      header: bundle.theme.header_section,
      footer: bundle.theme.footer_section,
      ...(opts.includeCode ? { globalCss: bundle.theme.global_css, globalJs: bundle.theme.global_js } : {
        globalCssBytes: bundle.theme.global_css.length,
        globalJsBytes: bundle.theme.global_js.length,
      }),
    },
    sections: Object.values(bundle.sections).map((s) => ({
      key: s.key,
      name: s.name,
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
      sections: p.instances,
    })),
    ownerEditedFields: bundle.ownerEdited,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design (agents / staff)
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeInput {
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
  if (!Object.keys(patch).length) throw new OpError('Nothing to change');

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'theme change');
  await saveTheme(ctx.db, ctx.siteId, patch, ctx.actor);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'set_theme', { keys: Object.keys(patch) });
  return { ok: true, changed: Object.keys(patch) };
}

export interface SectionInput {
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
  const { error } = await ctx.db.from('v2_sections').upsert(row, { onConflict: 'site_id,key' });
  if (error) throw new OpError(`Failed to save section: ${error.message}`, 500);

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
      await saveLayout(ctx.db, ctx.siteId, page.id, page.instances.filter((i) => i.section !== key));
    }
  }
  if (inLayout) {
    await saveTheme(ctx.db, ctx.siteId, {
      ...(bundle.theme.header_section === key ? { header_section: null } : {}),
      ...(bundle.theme.footer_section === key ? { footer_section: null } : {}),
    }, ctx.actor);
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
    await saveTheme(ctx.db, ctx.siteId, patch, ctx.actor);
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
  sections?: Array<{ id?: string; section: string; hidden?: boolean; content?: Record<string, unknown> }>;
}

export async function opPutPage(ctx: OpsContext, input: PageInput, opts: { force?: boolean } = {}) {
  const slug = String(input.slug || '').trim().toLowerCase();
  if (!PAGE_SLUG_RE.test(slug)) throw new OpError('Page slug must be lower-case letters, numbers and dashes (use "home" for the home page)');
  const bundle = await bundleOrThrow(ctx);
  let page = bundle.pages.find((p) => p.slug === slug) || null;

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `page ${slug}`);

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
      is_visible_in_nav: input.show_in_nav ?? true,
      nav_order: navOrder,
      design_data: seo || {},
    }).select('id').single();
    if (error) throw new OpError(`Failed to create page: ${error.message}`, 500);
    page = { id: data.id, slug, title, display_name: title, is_visible_in_nav: true, nav_order: navOrder, seo: {}, instances: [] };
  } else {
    const { data: row } = await ctx.db.from('pages').select('design_data').eq('id', page.id).single();
    const update: Record<string, unknown> = { title, updated_at: new Date().toISOString() };
    if (input.nav_label !== undefined) update.display_name = toPlainText(input.nav_label).slice(0, 60) || title;
    if (input.show_in_nav !== undefined) update.is_visible_in_nav = !!input.show_in_nav;
    if (input.nav_order !== undefined) update.nav_order = Number(input.nav_order) || 0;
    if (seo) update.design_data = { ...(row?.design_data || {}), ...seo };
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
      return { id, section: s.section, ...(s.hidden ? { hidden: true } : {}) };
    });
    await saveLayout(ctx.db, ctx.siteId, page.id, instances);
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
  return {
    page: { id: page.id, slug, title },
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
  input: { page: string; action: 'add' | 'move' | 'duplicate' | 'remove' | 'hide' | 'show'; instance?: string; section?: string; index?: number; to?: number },
) {
  const bundle = await bundleOrThrow(ctx);
  const page = findPage(bundle, input.page);
  const instances = [...page.instances];
  const at = input.instance ? instances.findIndex((i) => i.id === input.instance) : -1;
  if (input.action !== 'add' && at === -1) throw new OpError('Section not found on this page', 404);

  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, `${input.action} section`);
  let created: string | undefined;
  switch (input.action) {
    case 'add': {
      if (!input.section || !bundle.sections[input.section]) throw new OpError('Choose a section design to add', 404);
      created = newInstanceId();
      const index = input.index === undefined ? instances.length : Math.max(0, Math.min(instances.length, input.index));
      instances.splice(index, 0, { id: created, section: input.section });
      break;
    }
    case 'move': {
      const to = Math.max(0, Math.min(instances.length - 1, Number(input.to)));
      const [moved] = instances.splice(at, 1);
      instances.splice(to, 0, moved);
      break;
    }
    case 'duplicate': {
      created = newInstanceId();
      instances.splice(at + 1, 0, { id: created, section: instances[at].section });
      await copyInstanceContent(ctx.db, ctx.siteId, instances[at].id, created, ctx.actor);
      break;
    }
    case 'remove':
      instances.splice(at, 1);
      break;
    case 'hide':
    case 'show':
      instances[at] = { ...instances[at], hidden: input.action === 'hide' };
      break;
  }
  await saveLayout(ctx.db, ctx.siteId, page.id, instances);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, `section_${input.action}`, { page: page.slug, instance: input.instance || created });
  return { ok: true, instances, created };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentChange {
  instance: string;
  path: string;
  value: unknown;
}

export interface ContentResult {
  instance: string;
  path: string;
  status: 'saved' | 'skipped_owner_edit' | 'error';
  message?: string;
}

export async function opSetContent(ctx: OpsContext, changes: ContentChange[], opts: { force?: boolean; skipSnapshot?: boolean } = {}) {
  if (!Array.isArray(changes) || !changes.length) throw new OpError('No content changes given');
  if (changes.length > 300) throw new OpError('Too many changes in one call (max 300)');
  const bundle = await bundleOrThrow(ctx);
  const owner = new Set(bundle.ownerEdited);
  if (!opts.skipSnapshot) await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'content edit');

  // Group by stored field so several paths into one list become one write.
  const pending = new Map<string, { instance: string; field: string; value: unknown; fields: FieldSchema[] }>();
  const results: ContentResult[] = [];

  for (const change of changes) {
    try {
      const where = findInstance(bundle, change.instance);
      if (!where) throw new ContentError(`Section instance "${change.instance}" not found`);
      const schema = schemaOf(bundle, where.section);
      const { field, rest } = splitPath(change.path);
      const key = `${change.instance}/${field}`;
      if (ctx.actor.type !== 'owner' && owner.has(key) && !opts.force) {
        results.push({ instance: change.instance, path: change.path, status: 'skipped_owner_edit', message: 'The owner edited this field. Only overwrite it if the human asked you to (pass force: true).' });
        continue;
      }
      const base = pending.get(key)?.value ?? bundle.content[change.instance]?.[field] ?? schema.defaults[field];
      const next = applyFieldChange(schema.fields, structuredClone(base), field, rest, change.value);
      pending.set(key, { instance: change.instance, field, value: next, fields: schema.fields });
      results.push({ instance: change.instance, path: change.path, status: 'saved' });
    } catch (e) {
      results.push({ instance: change.instance, path: change.path, status: 'error', message: (e as Error).message });
    }
  }

  for (const [key, p] of pending) {
    const ownerEdited = ctx.actor.type === 'owner' ? true : opts.force ? false : owner.has(key);
    await writeContentRow(ctx.db, ctx.siteId, p.instance, p.field, p.value, ownerEdited, ctx.actor);
  }
  if (pending.size) await logActivity(ctx.db, ctx.siteId, ctx.actor, 'set_content', { fields: [...pending.keys()].slice(0, 50) });
  return { results };
}

export async function opListOp(ctx: OpsContext, input: { instance: string; path: string } & ListOp) {
  const bundle = await bundleOrThrow(ctx);
  const where = findInstance(bundle, input.instance);
  if (!where) throw new OpError('Section instance not found', 404);
  const schema = schemaOf(bundle, where.section);
  const { field, rest } = splitPath(input.path);
  const key = `${input.instance}/${field}`;
  if (ctx.actor.type !== 'owner' && bundle.ownerEdited.includes(key)) {
    throw new OpError('The owner edited this list; agents may not restructure it without being asked.', 409);
  }
  await maybeSnapshot(ctx.db, ctx.siteId, ctx.actor, 'list edit');
  const base = bundle.content[input.instance]?.[field] ?? schema.defaults[field];
  const template = defaultListItem(schema.defaults as Record<string, unknown>, field, rest);
  const { instance: _i, path: _p, ...operation } = input;
  void _i; void _p;
  let next: unknown;
  try {
    next = applyListOp(schema.fields, structuredClone(base), field, rest, operation as ListOp, template);
  } catch (e) {
    throw new OpError((e as Error).message);
  }
  await writeContentRow(ctx.db, ctx.siteId, input.instance, field, next, ctx.actor.type === 'owner' || bundle.ownerEdited.includes(key), ctx.actor);
  await logActivity(ctx.db, ctx.siteId, ctx.actor, `list_${operation.op}`, { instance: input.instance, path: input.path });
  return { ok: true, value: next };
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
  await saveTheme(ctx.db, ctx.siteId, { owner_overrides: next }, ctx.actor);
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
