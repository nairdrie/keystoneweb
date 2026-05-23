import type { BusinessProfile } from '@/lib/types/sites';

interface BuildLlmsTxtInput {
  siteUrl: string;
  businessName: string;
  description?: string;
  businessProfile?: BusinessProfile | null;
  pages: Array<{ slug: string; title: string; displayName?: string | null; seoDescription?: string | null }>;
  blogPosts?: Array<{ slug: string; title: string; excerpt?: string | null }>;
}

// Some upstream fields (site title, page display name, SEO description) can
// contain rich-text HTML from the editor. llms.txt must be plain text, so
// strip tags, decode the handful of entities we'd realistically see, and
// collapse whitespace before emitting.
function toPlainText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * llms.txt is a plain-text site index for AI assistants (Perplexity, ChatGPT,
 * Claude.ai). Spec: https://llmstxt.org/. We emit the H1 + summary block, an
 * "Important" section with the contact page, and a "Pages" list with all
 * non-system pages and blog posts.
 */
export function buildLlmsTxt(input: BuildLlmsTxtInput): string {
  const { siteUrl, businessProfile, pages, blogPosts = [] } = input;
  const businessName = toPlainText(input.businessName) || new URL(siteUrl).hostname;
  const description = toPlainText(input.description);

  const lines: string[] = [];
  lines.push(`# ${businessName}`);
  lines.push('');
  if (description) {
    lines.push(`> ${description}`);
    lines.push('');
  }

  if (businessProfile) {
    const addr = [
      businessProfile.streetAddress,
      businessProfile.addressLocality,
      businessProfile.addressRegion,
      businessProfile.postalCode,
    ].filter(Boolean).join(', ');
    if (addr) lines.push(`Address: ${addr}`);
    if (businessProfile.telephone) lines.push(`Phone: ${businessProfile.telephone}`);
    if (businessProfile.openingHours?.length) {
      lines.push(`Hours: ${businessProfile.openingHours.join('; ')}`);
    }
    if (lines[lines.length - 1] !== '') lines.push('');
  }

  const visiblePages = pages.filter(p => !p.slug.startsWith('__') && p.slug !== 'home');
  const contactPage = visiblePages.find(p => /contact/i.test(p.slug));

  if (contactPage) {
    lines.push('## Important');
    lines.push(`- [Contact](${siteUrl}/${contactPage.slug}): How to get in touch with ${businessName}.`);
    lines.push('');
  }

  if (visiblePages.length > 0) {
    lines.push('## Pages');
    for (const p of visiblePages) {
      const url = `${siteUrl}/${p.slug}`;
      const label = toPlainText(p.displayName) || toPlainText(p.title) || p.slug;
      const seoDescription = toPlainText(p.seoDescription);
      const summary = seoDescription ? `: ${seoDescription}` : '';
      lines.push(`- [${label}](${url})${summary}`);
    }
    lines.push('');
  }

  if (blogPosts.length > 0) {
    lines.push('## Articles');
    for (const post of blogPosts.slice(0, 50)) {
      const url = `${siteUrl}/blog/${post.slug}`;
      const title = toPlainText(post.title) || post.slug;
      const excerpt = toPlainText(post.excerpt);
      const summary = excerpt ? `: ${excerpt}` : '';
      lines.push(`- [${title}](${url})${summary}`);
    }
    lines.push('');
  }

  lines.push('## Optional');
  lines.push(`- Site home: ${siteUrl}`);
  lines.push(`- Sitemap: ${siteUrl}/sitemap.xml`);

  return lines.join('\n') + '\n';
}
