-- Migration 013: Add business_profile JSONB column to sites table
-- Stores structured local business data for Google JSON-LD / Schema.org injection
-- Fields map to LocalBusiness schema: https://schema.org/LocalBusiness

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS business_profile JSONB DEFAULT NULL;

COMMENT ON COLUMN sites.business_profile IS
  'Structured local business data for JSON-LD SEO injection. Schema:
   {
     legalName: string,          -- Official business name
     streetAddress: string,      -- Street address line
     addressLocality: string,    -- City
     addressRegion: string,      -- Province / State
     postalCode: string,
     addressCountry: string,     -- ISO 3166-1 alpha-2 (e.g. "CA")
     telephone: string,          -- E.164 format preferred
     latitude: number,
     longitude: number,
     placeId: string | null,     -- Google Places ID (null = manual entry)
     verifiedAt: string | null   -- ISO-8601 timestamp of last verification
   }';
