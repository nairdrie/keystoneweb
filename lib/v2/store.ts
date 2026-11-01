/**
 * Persistence for v2 sites. All functions take a service-role client; callers
 * must have checked site access first (requireSiteAccess / token auth).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import type { Actor, PageRecord, SectionInstance, SectionRecord, SiteBundle, SiteEngine, SiteMeta, ThemeRecord } from './types';
import { ENGINE_V1, ENGINE_V2 } from './types';

export type Db = SupabaseClient;

export const EMPTY_THEME: ThemeRecord = {
  tokens: [],
  owner_overrides: {},
  fonts: [],
  global_css: '',
  global_js: '',
  header_section: null,
  footer_section: null,
};

export interface SiteRow {
  id: string;
  user_id: string | null;
  site_slug: string | null;
  design_data: Record<string, unknown> | null;
  business_profile: Record<string, unknown> | null;
  published_domain: string | null;
  custom_domain: string | null;
  is_published: boolean | null;
  engine?: string | null;
  v2_release_id?: string | null;
  deleted_at?: string | null;
}

/** Engine for a site. Fails safe to v1 (e.g. before the migration is applied). */
export async function getSiteEngine(db: Db, siteId: string): Promise<SiteEngine> {
  try {
    const { data, error } = await db.from('sites').select('engine').eq('id', siteId).maybeSingle();
    if (error || !data) return ENGINE_V1;
    return data.engine === ENGINE_V2 ? ENGINE_V2 : ENGINE_V1;
  } catch {
    return ENGINE_V1;
  }
}

export async function loadSiteRow(db: Db, siteId: string): Promise<SiteRow | null> {
  const { data } = await db
    .from('sites')
    .select('id, user_id, site_slug, design_data, business_profile, published_domain, custom_domain, is_published, engine, v2_release_id, deleted_at')
    .eq('id', siteId)
    .maybeSingle();
  return (data as SiteRow) || null;
}

export function siteMetaFromRow(row: SiteRow): SiteMeta {
  const dd = (row.design_data || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    id: row.id,
    title: str(dd.siteTitle) || row.site_slug || 'My Website',
    logo: str(dd.siteLogo) || str(dd.headerLogo),
    favicon: str(dd.faviconLogo),
    contactEmail: str(dd.contactEmail),
    businessProfile: row.business_profile || null,
    domain: row.custom_domain || (row.published_domain ? `${row.published_domain}.${PUBLISHED_ROOT}` : null),
  };
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  display_name: string | null;
  is_visible_in_nav: boolean | null;
  nav_order: number | null;
  design_data: Record<string, unknown> | null;
}

export function pageFromRow(row: PageRow, instances: SectionInstance[]): PageRecord {
  const dd = (row.design_data || {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    display_name: row.display_name || row.title,
    is_visible_in_nav: row.is_visible_in_nav !== false,
    nav_order: row.nav_order ?? 0,
    seo: { title: s(dd.seoTitle), description: s(dd.seoDescription), ogImage: s(dd.ogImage) },
    instances,
  };
}

export async function loadDraftBundle(db: Db, siteId: string): Promise<SiteBundle | null> {
  const row = await loadSiteRow(db, siteId);
  if (!row || row.deleted_at) return null;

  const [themeRes, sectionsRes, pagesRes, layoutsRes, contentRes] = await Promise.all([
    db.from('v2_themes').select('*').eq('site_id', siteId).maybeSingle(),
    db.from('v2_sections').select('key, name, html, css, js, schema, version').eq('site_id', siteId),
    db.from('pages').select('id, slug, title, display_name, is_visible_in_nav, nav_order, design_data').eq('site_id', siteId),
    db.from('v2_page_layouts').select('page_id, instances').eq('site_id', siteId),
    db.from('v2_content').select('instance_id, field, value, owner_edited').eq('site_id', siteId).eq('locale', 'default'),
  ]);

  const theme: ThemeRecord = themeRes.data
    ? {
        tokens: themeRes.data.tokens || [],
        owner_overrides: themeRes.data.owner_overrides || {},
        fonts: themeRes.data.fonts || [],
        global_css: themeRes.data.global_css || '',
        global_js: themeRes.data.global_js || '',
        header_section: themeRes.data.header_section || null,
        footer_section: themeRes.data.footer_section || null,
        version: themeRes.data.version,
      }
    : { ...EMPTY_THEME };

  const sections: Record<string, SectionRecord> = {};
  for (const s of sectionsRes.data || []) sections[s.key] = s as SectionRecord;

  const layoutByPage = new Map<string, SectionInstance[]>();
  for (const l of layoutsRes.data || []) layoutByPage.set(l.page_id, Array.isArray(l.instances) ? l.instances : []);

  const pages = ((pagesRes.data || []) as PageRow[])
    .map((p) => pageFromRow(p, layoutByPage.get(p.id) || []))
    .sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : a.nav_order - b.nav_order));

  const content: SiteBundle['content'] = {};
  const ownerEdited: string[] = [];
  for (const c of contentRes.data || []) {
    (content[c.instance_id] ||= {})[c.field] = c.value;
    if (c.owner_edited) ownerEdited.push(`${c.instance_id}/${c.field}`);
  }

  return { site: siteMetaFromRow(row), theme, sections, pages, content, ownerEdited };
}

export async function loadRelease(db: Db, releaseId: string): Promise<SiteBundle | null> {
  const { data } = await db.from('v2_releases').select('manifest').eq('id', releaseId).maybeSingle();
  return (data?.manifest as SiteBundle) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureTheme(db: Db, siteId: string): Promise<void> {
  await db.from('v2_themes').upsert({ site_id: siteId }, { onConflict: 'site_id', ignoreDuplicates: true });
}

export async function saveTheme(db: Db, siteId: string, patch: Partial<ThemeRecord>, actor: Actor): Promise<void> {
  await ensureTheme(db, siteId);
  const { data: current } = await db.from('v2_themes').select('version').eq('site_id', siteId).maybeSingle();
  const { error } = await db
    .from('v2_themes')
    .update({ ...patch, version: (current?.version || 1) + 1, updated_by: actorLabel(actor), updated_at: new Date().toISOString() })
    .eq('site_id', siteId);
  if (error) throw new Error(`Failed to save theme: ${error.message}`);
}

export async function saveLayout(db: Db, siteId: string, pageId: string, instances: SectionInstance[]): Promise<void> {
  const clean = instances.map((i) => ({ id: i.id, section: i.section, ...(i.hidden ? { hidden: true } : {}) }));
  const { error } = await db
    .from('v2_page_layouts')
    .upsert({ page_id: pageId, site_id: siteId, instances: clean, updated_at: new Date().toISOString() }, { onConflict: 'page_id' });
  if (error) throw new Error(`Failed to save page layout: ${error.message}`);
}

export async function writeContentRow(
  db: Db,
  siteId: string,
  instanceId: string,
  field: string,
  value: unknown,
  ownerEdited: boolean,
  actor: Actor,
): Promise<void> {
  const { error } = await db.from('v2_content').upsert(
    {
      site_id: siteId,
      instance_id: instanceId,
      field,
      locale: 'default',
      value,
      owner_edited: ownerEdited,
      updated_by: actorLabel(actor),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id,instance_id,field,locale' },
  );
  if (error) throw new Error(`Failed to save content: ${error.message}`);
}

export async function copyInstanceContent(db: Db, siteId: string, fromInstance: string, toInstance: string, actor: Actor) {
  const { data } = await db.from('v2_content').select('field, locale, value, owner_edited').eq('site_id', siteId).eq('instance_id', fromInstance);
  if (!data?.length) return;
  await db.from('v2_content').upsert(
    data.map((r) => ({ ...r, site_id: siteId, instance_id: toInstance, updated_by: actorLabel(actor), updated_at: new Date().toISOString() })),
    { onConflict: 'site_id,instance_id,field,locale' },
  );
}

export async function logActivity(db: Db, siteId: string, actor: Actor, action: string, detail: Record<string, unknown> = {}) {
  try {
    await db.from('v2_activity').insert({ site_id: siteId, actor_type: actor.type, actor_label: actor.label, action, detail });
  } catch {
    /* activity is best-effort */
  }
}

export function actorLabel(actor: Actor): string {
  return `${actor.type}:${actor.label}`.slice(0, 200);
}

/** Store a restore point (full bundle). */
export async function createSnapshot(db: Db, siteId: string, label: string, actor: Actor, kind: 'snapshot' | 'publish' = 'snapshot') {
  const bundle = await loadDraftBundle(db, siteId);
  if (!bundle) throw new Error('Site not found');
  const { data, error } = await db
    .from('v2_releases')
    .insert({ site_id: siteId, kind, label, manifest: bundle, created_by: actorLabel(actor) })
    .select('id, created_at')
    .single();
  if (error) throw new Error(`Failed to save version: ${error.message}`);
  return { id: data.id as string, createdAt: data.created_at as string, bundle };
}

const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

/** Take a restore point before a change, at most every 10 minutes per actor type. */
export async function maybeSnapshot(db: Db, siteId: string, actor: Actor, reason: string) {
  try {
    const { data } = await db
      .from('v2_releases')
      .select('created_at, created_by')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const recent = data && Date.now() - new Date(data.created_at).getTime() < AUTO_SNAPSHOT_INTERVAL_MS;
    const sameActorType = data?.created_by?.startsWith(`${actor.type}:`);
    if (recent && sameActorType) return;
    await createSnapshot(db, siteId, `Before: ${reason}`, actor);
  } catch (e) {
    console.error('[v2] auto snapshot failed', e);
  }
}

/** Make every page/section/content change of `bundle` the current draft. */
export async function restoreBundle(db: Db, siteId: string, bundle: SiteBundle, actor: Actor) {
  const t = bundle.theme;
  await saveTheme(db, siteId, {
    tokens: t.tokens,
    owner_overrides: t.owner_overrides,
    fonts: t.fonts,
    global_css: t.global_css,
    global_js: t.global_js,
    header_section: t.header_section,
    footer_section: t.footer_section,
  }, actor);

  // Sections: replace the set.
  await db.from('v2_sections').delete().eq('site_id', siteId);
  const sectionRows = Object.values(bundle.sections).map((s) => ({
    site_id: siteId,
    key: s.key,
    name: s.name,
    html: s.html,
    css: s.css,
    js: s.js,
    schema: s.schema,
    updated_by: actorLabel(actor),
  }));
  if (sectionRows.length) {
    const { error } = await db.from('v2_sections').insert(sectionRows);
    if (error) throw new Error(`Restore failed (sections): ${error.message}`);
  }

  // Pages present in the version: recreate if missing, restore meta + layout.
  const { data: existing } = await db.from('pages').select('id, design_data').eq('site_id', siteId);
  const existingIds = new Map((existing || []).map((p) => [p.id, p.design_data || {}]));
  for (const page of bundle.pages) {
    const seo = { seoTitle: page.seo.title || null, seoDescription: page.seo.description || null, ogImage: page.seo.ogImage || null };
    const row = {
      id: page.id,
      site_id: siteId,
      slug: page.slug,
      title: page.title,
      display_name: page.display_name,
      is_visible_in_nav: page.is_visible_in_nav,
      nav_order: page.nav_order,
      design_data: { ...(existingIds.get(page.id) || {}), ...seo },
      updated_at: new Date().toISOString(),
    };
    if (existingIds.has(page.id)) await db.from('pages').update(row).eq('id', page.id);
    else await db.from('pages').insert(row);
    await saveLayout(db, siteId, page.id, page.instances);
  }

  // Content: replace default-locale rows.
  await db.from('v2_content').delete().eq('site_id', siteId).eq('locale', 'default');
  const owner = new Set(bundle.ownerEdited || []);
  const rows = Object.entries(bundle.content || {}).flatMap(([instanceId, fields]) =>
    Object.entries(fields || {}).map(([field, value]) => ({
      site_id: siteId,
      instance_id: instanceId,
      field,
      locale: 'default',
      value,
      owner_edited: owner.has(`${instanceId}/${field}`),
      updated_by: actorLabel(actor),
    })),
  );
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('v2_content').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Restore failed (content): ${error.message}`);
  }

  const extraPages = (existing || []).filter((p) => !bundle.pages.some((bp) => bp.id === p.id)).map((p) => p.id);
  return { extraPages };
}
