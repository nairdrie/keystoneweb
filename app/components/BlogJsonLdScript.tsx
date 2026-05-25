import { BusinessProfile } from '@/lib/types/sites';
import { buildBlogJsonLd } from '@/lib/seo/jsonld';

interface BlogJsonLdScriptProps {
  siteUrl: string;
  pageUrl: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  coverImage?: string | null;
  author?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  tags?: string[];
  businessProfile?: BusinessProfile | null;
  language?: string | null;
}

export default function BlogJsonLdScript(props: BlogJsonLdScriptProps) {
  const entries = buildBlogJsonLd(props);

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(entry => (
        <script
          key={entry.key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry.data) }}
        />
      ))}
    </>
  );
}
