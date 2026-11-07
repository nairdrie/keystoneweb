/**
 * Blog posts for agent-built sites: the same records owners manage in
 * Admin → Blog (blog_posts). Agents can add posts for a new business or
 * import articles from an old site; how posts look is up to the agent's
 * design (see articles.ts and data-ks-collection="posts" / "post").
 */
import { OpError, type OpsContext } from './ops';
import { logActivity } from './store';
import { postPath } from './collections';
import { safeSrc, sanitizeArticle, toPlainText } from './sanitize';

export interface PostInput {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  cover_image?: string;
  author?: string;
  tags?: string[];
  /** ISO date or YYYY-MM-DD; for articles imported from an old site. */
  published_at?: string;
  /** default true for new posts */
  publish?: boolean;
  featured?: boolean;
}

const MAX_CONTENT = 200_000;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

function parseDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  // A bare date: noon UTC, so it shows as that day across North America.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00Z` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new OpError(`published_at "${raw}" is not a date (use YYYY-MM-DD)`);
  return d.toISOString();
}

async function uniqueSlug(ctx: OpsContext, base: string, exceptId?: string): Promise<string> {
  const root = base || 'post';
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const { data } = await ctx.db.from('blog_posts').select('id').eq('site_id', ctx.siteId).eq('slug', slug).limit(2);
    const taken = (data || []).some((r) => r.id !== exceptId);
    if (!taken) return slug;
  }
  throw new OpError('Could not find a free slug for this post');
}

async function moderate(ctx: OpsContext, ownerId: string, text: string) {
  const { scanText } = await import('@/lib/moderation/text-scan');
  const result = await scanText(text);
  if (!result.flagged) return;
  const { handleModerationResult } = await import('@/lib/moderation/report');
  await handleModerationResult(
    { ...result, severity: 'review' as const },
    { siteId: ctx.siteId, userId: ownerId, ipAddress: null, contentType: 'text', contentRef: null, contentHash: null },
  ).catch(() => {});
  throw new OpError('This post was blocked by the content policy.', 422);
}

export async function opUpsertPosts(ctx: OpsContext, ownerId: string, posts: PostInput[]) {
  if (!Array.isArray(posts) || !posts.length) throw new OpError('posts is required');
  if (posts.length > 50) throw new OpError('At most 50 posts per call');
  const results: Array<Record<string, unknown>> = [];

  for (const [i, p] of posts.entries()) {
    const fields: Record<string, unknown> = {};
    if (p.title !== undefined) fields.title = toPlainText(String(p.title)).slice(0, 200);
    if (p.excerpt !== undefined) fields.excerpt = toPlainText(String(p.excerpt)).slice(0, 400) || null;
    if (p.content !== undefined) {
      const content = String(p.content);
      if (content.length > MAX_CONTENT) throw new OpError(`posts[${i}].content is over ${MAX_CONTENT / 1000}KB`);
      fields.content = sanitizeArticle(content) || null;
    }
    if (p.cover_image !== undefined) fields.cover_image = safeSrc(p.cover_image) || null;
    if (p.author !== undefined) fields.author = toPlainText(String(p.author)).slice(0, 80) || null;
    if (p.tags !== undefined) {
      fields.tags = (Array.isArray(p.tags) ? p.tags : [])
        .map((t) => toPlainText(String(t)).slice(0, 40))
        .filter(Boolean)
        .slice(0, 10);
    }
    const publishedAt = parseDate(p.published_at);
    if (publishedAt) fields.published_at = publishedAt;
    if (p.publish !== undefined) fields.is_published = !!p.publish;
    if (p.featured !== undefined) fields.is_featured = !!p.featured;

    const text = [fields.title, fields.excerpt, fields.content].filter(Boolean).join('\n\n');
    if (text) await moderate(ctx, ownerId, String(text));

    if (fields.is_featured === true) {
      // One featured post per site.
      const q = ctx.db.from('blog_posts').update({ is_featured: false }).eq('site_id', ctx.siteId).eq('is_featured', true);
      await (p.id ? q.neq('id', String(p.id)) : q);
    }

    if (p.id) {
      const { data: current } = await ctx.db.from('blog_posts').select('id, slug, published_at, is_archived').eq('id', String(p.id)).eq('site_id', ctx.siteId).maybeSingle();
      if (!current || current.is_archived) throw new OpError(`Post ${p.id} not found`, 404);
      if (fields.title === '') throw new OpError(`posts[${i}].title can't be empty`);
      // URLs stay put unless a new slug is asked for.
      if (p.slug !== undefined) fields.slug = await uniqueSlug(ctx, slugify(String(p.slug)), current.id);
      if (fields.is_published === true && !current.published_at && !fields.published_at) fields.published_at = new Date().toISOString();
      fields.updated_at = new Date().toISOString();
      const { error } = await ctx.db.from('blog_posts').update(fields).eq('id', current.id);
      if (error) throw new OpError(`Could not update post ${p.id}: ${error.message}`, 500);
      const slug = String(fields.slug || current.slug);
      results.push({ id: current.id, slug, url: postPath(slug), updated: true });
    } else {
      if (!fields.title) throw new OpError(`posts[${i}].title is required`);
      const slug = await uniqueSlug(ctx, slugify(String(p.slug || fields.title)));
      const publish = fields.is_published !== false;
      const { data: last } = await ctx.db.from('blog_posts').select('sort_order').eq('site_id', ctx.siteId).order('sort_order', { ascending: false }).limit(1);
      const row = {
        site_id: ctx.siteId,
        slug,
        excerpt: null,
        content: null,
        cover_image: null,
        author: null,
        tags: [],
        is_featured: false,
        ...fields,
        is_published: publish,
        published_at: fields.published_at || (publish ? new Date().toISOString() : null),
        sort_order: (Number(last?.[0]?.sort_order) || 0) + 1,
      };
      const { data, error } = await ctx.db.from('blog_posts').insert(row).select('id').single();
      if (error) throw new OpError(`Could not create post "${fields.title}": ${error.message}`, 500);
      results.push({ id: data.id, slug, url: postPath(slug), created: true, published: publish });
    }
  }

  await logActivity(ctx.db, ctx.siteId, ctx.actor, 'upsert_posts', { count: results.length });
  return { posts: results };
}

/** Posts as get_business_data shows them (no article bodies). */
export async function listPosts(ctx: OpsContext) {
  const { data } = await ctx.db
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image, author, tags, is_published, is_featured, published_at, content')
    .eq('site_id', ctx.siteId)
    .eq('is_archived', false)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200);
  return (data || []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    url: postPath(String(p.slug)),
    excerpt: p.excerpt,
    cover_image: p.cover_image,
    author: p.author,
    tags: p.tags || [],
    published: !!p.is_published,
    featured: !!p.is_featured,
    published_at: p.published_at,
    words: toPlainText(String(p.content || '')).split(/\s+/).filter(Boolean).length,
  }));
}
