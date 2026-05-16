import type { BusinessProfile } from '@/lib/types/sites';

interface BuildLlmsTxtInput {
  siteUrl: string;
  businessName: string;
  description?: string;
  businessProfile?: BusinessProfile | null;
  pages: Array<{ slug: string; title: string; displayName?: string | null; seoDescription?: string | null }>;
  blogPosts?: Array<{ slug: string; title: string; excerpt?: string | null }>;
}

/**
 * llms.txt is a plain-text site index for AI assistants (Perplexity, ChatGPT,
 * Claude.ai). Spec: https://llmstxt.org/. We emit the H1 + summary block, an
 * "Important" section with the contact page, and a "Pages" list with all
 * non-system pages and blog posts.
 */
export function buildLlmsTxt(input: BuildLlmsTxtInput): string {
  const { siteUrl, businessName, description, businessProfile, pages, blogPosts = [] } = input;

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
      const label = p.displayName || p.title || p.slug;
      const summary = p.seoDescription ? `: ${p.seoDescription}` : '';
      lines.push(`- [${label}](${url})${summary}`);
    }
    lines.push('');
  }

  if (blogPosts.length > 0) {
    lines.push('## Articles');
    for (const post of blogPosts.slice(0, 50)) {
      const url = `${siteUrl}/blog/${post.slug}`;
      const summary = post.excerpt ? `: ${post.excerpt}` : '';
      lines.push(`- [${post.title}](${url})${summary}`);
    }
    lines.push('');
  }

  lines.push('## Optional');
  lines.push(`- Site home: ${siteUrl}`);
  lines.push(`- Sitemap: ${siteUrl}/sitemap.xml`);

  return lines.join('\n') + '\n';
}
