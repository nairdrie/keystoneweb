import { BusinessProfile } from '@/lib/types/sites';

interface TestimonialItem {
  name?: string;
  quote?: string;
  rating?: number;
}

interface JsonLdScriptProps {
  businessProfile: BusinessProfile;
  siteUrl?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  /** Testimonial items from testimonials blocks — used to emit AggregateRating */
  testimonials?: TestimonialItem[];
}

/**
 * Renders a <script type="application/ld+json"> tag in the document <head>
 * containing a Schema.org LocalBusiness structured data block.
 *
 * This enables Google Knowledge Panels, Rich Snippets, and Local Map Pack
 * eligibility for the tenant's published site.
 */
export default function JsonLdScript({ businessProfile, siteUrl, socialLinks, testimonials }: JsonLdScriptProps) {
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

  if (businessProfile.priceRange) {
    jsonLd.priceRange = businessProfile.priceRange;
  }

  if (businessProfile.openingHours && businessProfile.openingHours.length > 0) {
    jsonLd.openingHours = businessProfile.openingHours;
  }

  if (businessProfile.image) {
    jsonLd.image = businessProfile.image;
  }

  // AggregateRating from testimonials (boosts star ratings in SERPs)
  if (testimonials && testimonials.length > 0) {
    const ratings = testimonials.map(t => t.rating ?? 5);
    const sum = ratings.reduce((a, b) => a + b, 0);
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (sum / ratings.length).toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: ratings.length,
    };
  }

  // sameAs link to social profiles to help Google connect them
  if (socialLinks) {
    const sameAs = Object.values(socialLinks).filter(Boolean);
    if (sameAs.length > 0) {
      jsonLd.sameAs = sameAs;
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
