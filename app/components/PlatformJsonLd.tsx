import React from 'react';

/**
 * Renders structured data for the Keystone Web platform itself.
 * Uses SoftwareApplication and Organization schemas.
 */
export default function PlatformJsonLd() {
  const platformJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Keystone Web',
        applicationCategory: 'BusinessApplication, DesignApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '15.00',
          priceCurrency: 'CAD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '120',
        },
        description: 'AI-powered website builder for small businesses and trades.',
      },
      {
        '@type': 'Organization',
        name: 'Keystone Web Design',
        url: 'https://kswd.ca',
        logo: 'https://kswd.ca/assets/logo/keystone-logo.png',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'CA',
        },
      },
      {
        '@type': 'WebSite',
        name: 'Keystone Web',
        url: 'https://kswd.ca',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://kswd.ca/templates?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }}
    />
  );
}
