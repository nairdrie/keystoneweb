import { BusinessProfile } from '@/lib/types/sites';

interface JsonLdScriptProps {
  businessProfile: BusinessProfile;
  siteUrl?: string;
}

/**
 * Renders a <script type="application/ld+json"> tag in the document <head>
 * containing a Schema.org LocalBusiness structured data block.
 *
 * This enables Google Knowledge Panels, Rich Snippets, and Local Map Pack
 * eligibility for the tenant's published site.
 */
export default function JsonLdScript({ businessProfile, siteUrl }: JsonLdScriptProps) {
  if (!businessProfile?.legalName) return null;

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessProfile.legalName,
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessProfile.streetAddress,
      addressLocality: businessProfile.addressLocality,
      addressRegion: businessProfile.addressRegion,
      postalCode: businessProfile.postalCode,
      addressCountry: businessProfile.addressCountry,
    },
  };

  if (businessProfile.telephone) {
    jsonLd.telephone = businessProfile.telephone;
  }

  if (businessProfile.latitude !== null && businessProfile.longitude !== null) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: businessProfile.latitude,
      longitude: businessProfile.longitude,
    };
  }

  if (siteUrl) {
    jsonLd.url = siteUrl;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
