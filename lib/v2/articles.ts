/**
 * Blog articles on agent-built sites.
 *
 * Posts are the owner's (Admin → Blog, table blog_posts) and live at
 * /blog/<slug>. The agent designs how they look: lists anywhere with
 * data-ks-collection="posts", and the article itself on a page marked
 * template: "post" (data-ks-collection="post" binds the article being read).
 * Without such a page, Keystone shows the article in a plain layout inside the
 * site's own header and footer, so post links never break.
 */
import type { Db } from './store';
import type { PageAccess, PageRecord, SiteBundle } from './types';
import type { MemberVisitor } from '@/lib/membership/access';
import { collectionsIn, fetchCollections, pageSectionHtmls, POST_PATH_PREFIX, type ArticleMeta, type CollectionData } from './collections';
import { findPageByPath, pageIsPersonalized, pagePath, platformPalette, renderPage, type RenderedPage, type RenderOptions } from './render';
import { escapeHtml, safeSrc } from './sanitize';

export function articleTemplate(bundle: SiteBundle): PageRecord | null {
  return bundle.pages.find((p) => p.template === 'post') || null;
}

/** The post slug for /blog/<slug>, else null. */
export function postSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(POST_PATH_PREFIX)) return null;
  const rest = pathname.slice(POST_PATH_PREFIX.length).replace(/\/+$/, '');
  if (!rest || rest.includes('/')) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

/** The page that lists posts (for "back to all posts"), if the agent made one. */
export function postIndexPage(bundle: SiteBundle): PageRecord | null {
  return bundle.pages.find((p) =>
    p.template !== 'post' &&
    p.instances.some((i) => /data-ks-collection\s*=\s*["']posts["']/.test(bundle.sections[i.section]?.html || '')),
  ) || null;
}

type BaseOptions = Omit<RenderOptions, 'collections' | 'article' | 'bodyOverride' | 'visitor'> & {
  /**
   * Published pages: who is visiting, for members-only pages and sections. Only called
   * when the page depends on it (the result then must not be cached publicly).
   */
  resolveVisitor?: (access: PageAccess | null) => Promise<MemberVisitor>;
};

/** Render any path of a v2 site: a page, an article, or not found. */
export async function renderSitePath(db: Db, bundle: SiteBundle, siteId: string, pathname: string, baseOptions: BaseOptions): Promise<RenderedPage & { collections?: CollectionData; personalized?: boolean }> {
  const { resolveVisitor, ...base } = baseOptions;
  const postSlug = postSlugFromPath(pathname);
  if (postSlug) {
    const template = articleTemplate(bundle);
    const kinds = collectionsIn(pageSectionHtmls(bundle, template));
    const collections = await fetchCollections(db, siteId, kinds, { postSlug });
    if (!collections.article) return { ...renderPage(bundle, null, { ...base, collections }), collections };
    if (template) return { ...renderPage(bundle, template, { ...base, collections, article: collections.article }), collections };
    return {
      ...renderPage(bundle, null, { ...base, collections, article: collections.article, bodyOverride: defaultArticleHtml(bundle, collections.article) }),
      collections,
    };
  }

  let page = findPageByPath(bundle, pathname) || null;
  // The article layout isn't a page of its own on the live site.
  if (page?.template === 'post' && base.mode === 'published') page = null;
  const kinds = collectionsIn(pageSectionHtmls(bundle, page));
  const personalized = base.mode === 'published' && pageIsPersonalized(page);
  const [collections, visitor] = await Promise.all([
    kinds.size ? fetchCollections(db, siteId, kinds) : Promise.resolve(undefined),
    personalized && resolveVisitor ? resolveVisitor(page?.access || null) : Promise.resolve(null),
  ]);
  return { ...renderPage(bundle, page, { ...base, collections, visitor, path: pathname }), collections, personalized };
}

/** Keystone's plain article layout, coloured with the agent's platform tokens. */
export function defaultArticleHtml(bundle: SiteBundle, article: ArticleMeta): string {
  const palette = platformPalette(bundle.theme);
  const index = postIndexPage(bundle);
  const meta = [article.datePublished ? formatDate(article.datePublished) : '', article.author].filter(Boolean).map(escapeHtml).join(' · ');
  const image = safeSrc(article.image);
  const css = `
.ks-article{max-width:44rem;margin:0 auto;padding:clamp(2rem,6vw,5rem) 1.25rem;line-height:1.7}
.ks-article__meta{margin:0 0 .75rem;font-size:.9rem;opacity:.7}
.ks-article h1{margin:0 0 1rem;font-size:clamp(2rem,5vw,3rem);line-height:1.15}
.ks-article__excerpt{margin:0 0 2rem;font-size:1.15rem;opacity:.8}
.ks-article__cover{display:block;width:100%;height:auto;margin:0 0 2.5rem;border-radius:12px}
.ks-article__body img{max-width:100%;height:auto;border-radius:8px}
.ks-article__body a{color:${cssColor(palette.secondary)}}
.ks-article__body blockquote{margin:1.5rem 0;padding:.25rem 0 .25rem 1.25rem;border-left:3px solid ${cssColor(palette.primary)};opacity:.85}
.ks-article__body pre{overflow:auto;padding:1rem;border-radius:8px;background:rgba(127,127,127,.12)}
.ks-article__body table{border-collapse:collapse;width:100%}.ks-article__body td,.ks-article__body th{border:1px solid rgba(127,127,127,.3);padding:.5rem}
.ks-article__tags{display:flex;flex-wrap:wrap;gap:.5rem;margin:2.5rem 0 0;padding:0;list-style:none}
.ks-article__tags li{padding:.25rem .75rem;border-radius:999px;background:rgba(127,127,127,.12);font-size:.85rem}
.ks-article__back{display:inline-block;margin-top:2.5rem;color:${cssColor(palette.secondary)}}`;
  return [
    `<style>${css}</style>`,
    '<article class="ks-article">',
    meta ? `<p class="ks-article__meta">${meta}</p>` : '',
    `<h1>${escapeHtml(article.title)}</h1>`,
    article.excerpt ? `<p class="ks-article__excerpt">${escapeHtml(article.excerpt)}</p>` : '',
    image ? `<img class="ks-article__cover" src="${escapeHtml(image)}" alt="">` : '',
    `<div class="ks-article__body">${article.content}</div>`,
    article.tags.length ? `<ul class="ks-article__tags">${article.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '',
    index ? `<a class="ks-article__back" href="${escapeHtml(pagePath(index))}">← ${escapeHtml(index.display_name || index.title)}</a>` : '',
    '</article>',
  ].join('');
}

function cssColor(value: string): string {
  return /^[#a-z0-9(),.\s%-]+$/i.test(value) ? value : 'currentColor';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Toronto' }).format(d);
}
