/**
 * Whole-site validation for v2 drafts. Publishing is blocked while any
 * error-level issue remains; warnings are reported but allowed.
 */
import postcss from 'postcss';
import { load } from 'cheerio';
import type { CompileIssue, SiteBundle } from './types';
import { compileSection } from './compile';
import { pageIsPersonalized, renderPage } from './render';
import { SIGNED_OUT, type MemberVisitor } from '@/lib/membership/access';
import { BUDGETS, SCRIPT_HOST_ALLOWLIST, TOKEN_NAME_RE, isAllowedScriptUrl } from './policy';

export interface SiteIssue extends CompileIssue {
  section?: string;
  page?: string;
}

export interface ValidationReport {
  ok: boolean;
  errors: SiteIssue[];
  warnings: SiteIssue[];
  summary: {
    pages: number;
    sections: number;
    editableFields: number;
    unboundTextNodes: number;
  };
}

export function validateBundle(bundle: SiteBundle): ValidationReport {
  const issues: SiteIssue[] = [];
  let editableFields = 0;
  let unboundTextNodes = 0;

  // ── Sections ──
  for (const section of Object.values(bundle.sections)) {
    const compiled = compileSection(section.html);
    editableFields += compiled.stats.boundFields;
    unboundTextNodes += compiled.stats.unboundTextNodes;
    for (const issue of compiled.issues) issues.push({ ...issue, section: section.key });
    if (section.css) {
      try {
        postcss.parse(section.css);
      } catch (e) {
        issues.push({ level: 'error', rule: 'css-syntax', message: `CSS does not parse: ${(e as Error).message}`, section: section.key });
      }
    }
    if (Buffer.byteLength(section.css || '', 'utf8') > BUDGETS.sectionCssBytes) {
      issues.push({ level: 'warning', rule: 'budget', message: `Section CSS is over ${BUDGETS.sectionCssBytes / 1000}KB.`, section: section.key });
    }
    if (Buffer.byteLength(section.js || '', 'utf8') > BUDGETS.sectionJsBytes) {
      issues.push({ level: 'warning', rule: 'budget', message: `Section JS is over ${BUDGETS.sectionJsBytes / 1000}KB.`, section: section.key });
    }
    if (section.js && !/export\s+default/.test(section.js)) {
      issues.push({ level: 'error', rule: 'js-module', message: 'Section JS must be an ES module with `export default (root, ks) => { ... }`.', section: section.key });
    }
    issues.push(...scanJs(section.js || '', section.key));
    issues.push(...scanAttributionCss(section.css || '', section.key));
  }

  // ── Theme ──
  const theme = bundle.theme;
  for (const t of theme.tokens || []) {
    if (!TOKEN_NAME_RE.test(t.name)) issues.push({ level: 'error', rule: 'token-name', message: `Token name "${t.name}" is invalid (use lower-case letters, numbers and -).` });
  }
  if (theme.global_css) {
    try {
      postcss.parse(theme.global_css);
    } catch (e) {
      issues.push({ level: 'error', rule: 'css-syntax', message: `Global CSS does not parse: ${(e as Error).message}` });
    }
  }
  if (theme.global_js && !/export\s+default/.test(theme.global_js)) {
    issues.push({ level: 'error', rule: 'js-module', message: 'Global JS must be an ES module with `export default (ks) => { ... }`.' });
  }
  issues.push(...scanJs(theme.global_js || '', undefined));
  issues.push(...scanAttributionCss(theme.global_css || '', undefined));
  if (!theme.header_section) issues.push({ level: 'warning', rule: 'no-header', message: 'No header section set (set_layout).' });
  if (!theme.footer_section) issues.push({ level: 'warning', rule: 'no-footer', message: 'No footer section set (set_layout).' });
  const footerHtml = theme.footer_section ? bundle.sections[theme.footer_section]?.html : undefined;
  if (footerHtml !== undefined && !/\sdata-ks-attribution(?:[\s=>]|$)/i.test(footerHtml)) {
    issues.push({
      level: 'warning',
      rule: 'attribution',
      message: 'The footer has no "Powered by Keystone" slot, so Keystone adds a plain line below it. Put <p data-ks-attribution></p> in the footer and style it to match (get_guide topic "sections").',
      section: theme.footer_section || undefined,
    });
  }
  for (const key of [theme.header_section, theme.footer_section]) {
    if (key && !bundle.sections[key]) issues.push({ level: 'error', rule: 'missing-section', message: `Layout uses section "${key}" which does not exist.` });
  }

  // ── Pages ──
  const slugs = new Set(bundle.pages.map((p) => p.slug));
  const articleLayoutSlug = bundle.pages.find((p) => p.template === 'post')?.slug;
  if (!slugs.has('home')) issues.push({ level: 'error', rule: 'no-home', message: 'The site needs a page with slug "home".' });

  for (const page of bundle.pages) {
    for (const inst of page.instances) {
      if (!bundle.sections[inst.section]) {
        issues.push({ level: 'error', rule: 'missing-section', message: `Page uses section "${inst.section}" which does not exist.`, page: page.slug });
      }
    }
    if (!page.instances.length) issues.push({ level: 'warning', rule: 'empty-page', message: 'Page has no sections.', page: page.slug });
    const isArticleLayout = page.template === 'post';
    // Each article supplies its own title and description.
    if (!page.seo.description && !isArticleLayout) issues.push({ level: 'warning', rule: 'seo-description', message: 'Page has no SEO description.', page: page.slug });
    if (isArticleLayout && !page.instances.some((i) => /data-ks-collection\s*=\s*["']post["']/.test(bundle.sections[i.section]?.html || ''))) {
      issues.push({ level: 'warning', rule: 'article-layout', message: 'This page is the article layout but has no data-ks-collection="post" section, so articles would show no title or text.', page: page.slug });
    }

    if (page.access && page.slug === 'home') {
      issues.push({ level: 'error', rule: 'members-only', message: 'The home page can\'t be members-only.', page: page.slug });
    }

    // The article layout is checked with its sample article (live posts fill it at request time).
    // Members-only pages and sections are checked as both a member and a signed-out visitor.
    const views: Array<MemberVisitor | null> = pageIsPersonalized(page) ? [MEMBER_VIEW, SIGNED_OUT] : [null];
    for (const visitor of views) {
      const viewNote = visitor ? (visitor.hasAccess ? ' (as a member)' : ' (as a signed-out visitor)') : '';
      const rendered = renderPage(bundle, page, { mode: isArticleLayout ? 'preview' : 'published', visitor });
      if (rendered.stats.cssBytes > BUDGETS.pageCssBytes) {
        issues.push({ level: 'warning', rule: 'budget', message: `Page CSS is ${Math.round(rendered.stats.cssBytes / 1000)}KB (budget ${BUDGETS.pageCssBytes / 1000}KB).`, page: page.slug });
      }
      if (rendered.stats.jsBytes > BUDGETS.pageJsBytes) {
        issues.push({ level: 'warning', rule: 'budget', message: `Page JS is ${Math.round(rendered.stats.jsBytes / 1000)}KB (budget ${BUDGETS.pageJsBytes / 1000}KB).`, page: page.slug });
      }

      const $ = load(rendered.html);
      const allH1 = $('h1').length;
      if (allH1 === 0) issues.push({ level: 'warning', rule: 'h1', message: `Page has no <h1>${viewNote}.`, page: page.slug });
      if (allH1 > 1) issues.push({ level: 'warning', rule: 'h1', message: `Page has ${allH1} <h1> elements${viewNote}; use one.`, page: page.slug });

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        // Members belong to one site: sign-in on another Keystone site (e.g. the old one) doesn't sign them in here.
        const external = /^https?:\/\/([a-z0-9-]+\.kswd\.ca)\/(signin|signup|member|forgot-password)\b/i.exec(href);
        if (external && external[1].toLowerCase() !== (bundle.site.domain || '').toLowerCase()) {
          issues.push({
            level: 'warning',
            rule: 'member-link',
            message: `Link to ${href} — that's another site's member page, and members of this site can't sign in there. Use /${external[2]} (get_guide topic "membership").`,
            page: page.slug,
          });
          return;
        }
        if (!href.startsWith('/') || href.startsWith('//')) return;
        const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
        const slug = path === '/' ? 'home' : path.slice(1);
        if (slug.includes('/') || SYSTEM_PATHS.some((p) => path.startsWith(p))) return;
        if (!slugs.has(slug)) {
          issues.push({ level: 'error', rule: 'broken-link', message: `Link to ${href} — there is no page "${slug}".`, page: page.slug });
        }
        else if (articleLayoutSlug === slug) {
          issues.push({ level: 'error', rule: 'broken-link', message: `Link to ${href} — that page is the article layout, which isn't reachable on the live site. Link to a post (/blog/<slug>) or the page listing posts.`, page: page.slug });
        }
      });

      $('img').each((_, el) => {
        const alt = $(el).attr('alt');
        if (alt === undefined) issues.push({ level: 'warning', rule: 'missing-alt', message: `Image ${$(el).attr('src') || ''} has no alt text.`, page: page.slug });
      });
    }
  }

  const listsPosts = bundle.pages.some((p) => p.instances.some((i) => /data-ks-collection\s*=\s*["']posts["']/.test(bundle.sections[i.section]?.html || '')));
  if (listsPosts && !bundle.pages.some((p) => p.template === 'post')) {
    issues.push({
      level: 'warning',
      rule: 'article-layout',
      message: 'The site lists blog posts but has no article layout, so /blog/<slug> uses Keystone\'s plain article page. Design one with put_page { template: "post" } (get_guide topic "business").',
    });
  }

  // Unused designs are fine (they're the owner's "add section" library) — no issue.

  const deduped = dedupe(issues);
  const errors = deduped.filter((i) => i.level === 'error');
  const warnings = deduped.filter((i) => i.level === 'warning');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: { pages: bundle.pages.length, sections: Object.keys(bundle.sections).length, editableFields, unboundTextNodes },
  };
}

const SYSTEM_PATHS = ['/api/', '/product/', '/cart', '/book', '/order-confirmation', '/checkout', '/booking', '/blog/', '/signin', '/signup', '/member', '/forgot-password'];

const MEMBER_VIEW: MemberVisitor = { signedIn: true, hasAccess: true, reason: null };

function scanJs(js: string, section: string | undefined): SiteIssue[] {
  const out: SiteIssue[] = [];
  if (!js) return out;
  const importRe = /(?:import\s+(?:[^'"]*?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(js))) {
    const spec = m[1];
    let ok = false;
    try {
      const u = new URL(spec);
      ok = isAllowedScriptUrl(u.toString());
    } catch {
      ok = false;
    }
    if (!ok) {
      out.push({
        level: 'error',
        rule: 'script-host',
        message: `Import "${spec}" is not allowed. Import full https:// URLs from ${SCRIPT_HOST_ALLOWLIST.join(', ')}.`,
        section,
      });
    }
  }
  if (/document\.cookie|localStorage\.(get|set)Item\(\s*['"]sb-/.test(js)) {
    out.push({ level: 'error', rule: 'js-forbidden', message: 'Scripts may not read cookies or auth storage.', section });
  }
  if (/\beval\s*\(|new\s+Function\s*\(/.test(js)) {
    out.push({ level: 'error', rule: 'js-forbidden', message: 'eval / new Function are not allowed.', section });
  }
  if (/ks-attribution|keystoneweb\.ca/i.test(js)) {
    out.push({ level: 'error', rule: 'attribution', message: 'Scripts may not touch the "Powered by Keystone" link. It is required on every Keystone site.', section });
  }
  return out;
}

// Declarations that would hide or shrink the "Powered by Keystone" slot.
const HIDING_DECLS: Array<[RegExp, RegExp]> = [
  [/^display$/, /^none\b/],
  [/^visibility$/, /^(hidden|collapse)\b/],
  [/^opacity$/, /^(0(\.[0-2]\d*)?|\.[0-2]\d*|[0-2]?\d(\.\d+)?%)\s*(!important)?$/],
  [/^font-size$/, /^(0|[0-8](\.\d+)?px|0?\.[0-5]\d*(r?em)?)\s*(!important)?$/],
  [/^(width|height|max-width|max-height)$/, /^0(px|%|r?em)?\s*(!important)?$/],
  [/^(clip|clip-path|filter|mask|mask-image|-webkit-mask)$/, /./],
  [/^(transform|translate|scale)$/, /scale\(\s*0\s*[,)]|^0$|-?\d{3,}(\.\d+)?(px|%|vw|vh|r?em)/],
  [/^(left|right|top|bottom|inset|margin|margin-left|margin-top|text-indent)$/, /-\d{3,}/],
  [/^color$/, /^transparent\b/],
  [/^content-visibility$/, /^hidden\b/],
];

/** CSS rules aimed at the attribution slot may restyle it but not hide it. */
function scanAttributionCss(css: string, section: string | undefined): SiteIssue[] {
  if (!/attribution/i.test(css)) return [];
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return []; // reported as css-syntax
  }
  const out: SiteIssue[] = [];
  root.walkRules((rule) => {
    if (!/attribution/i.test(rule.selector)) return;
    rule.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      const value = decl.value.trim().toLowerCase();
      if (HIDING_DECLS.some(([p, v]) => p.test(prop) && v.test(value))) {
        out.push({
          level: 'error',
          rule: 'attribution',
          message: `"${rule.selector} { ${decl.prop}: ${decl.value} }" hides the "Powered by Keystone" link. Style it to fit the design, but keep it visible and legible.`,
          section,
        });
      }
    });
  });
  return out;
}

function dedupe(issues: SiteIssue[]): SiteIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.level}|${i.rule}|${i.section || ''}|${i.page || ''}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map a v2 validation report onto the health-check ("doctor") result shape. */
export function toDiagnosticResults(report: ValidationReport) {
  const out = [...report.errors, ...report.warnings].map((issue, i) => ({
    id: `v2-${issue.rule}-${i}`,
    category: issue.page ? 'Pages' : issue.section ? 'Sections' : 'Site',
    label: issue.rule.replace(/-/g, ' '),
    severity: issue.level as 'error' | 'warning' | 'pass',
    message: [issue.message, issue.section ? `(section "${issue.section}")` : ''].filter(Boolean).join(' '),
    ...(issue.page ? { page: issue.page } : {}),
  }));
  out.push({
    id: 'v2-editable',
    category: 'Site',
    label: 'editable content',
    severity: (report.summary.unboundTextNodes === 0 ? 'pass' : 'warning') as 'error' | 'warning' | 'pass',
    message: `${report.summary.editableFields} editable fields across ${report.summary.sections} section designs and ${report.summary.pages} pages.`,
  });
  return out;
}
