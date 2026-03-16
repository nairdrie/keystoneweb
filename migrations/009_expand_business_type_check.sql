-- Expand sites.business_type check constraint to include new onboarding types:
-- portfolio, nonprofit, other (replaces 'both' which is being removed)
ALTER TABLE sites
  DROP CONSTRAINT sites_business_type_check,
  ADD CONSTRAINT sites_business_type_check
    CHECK (business_type::text = ANY (ARRAY[
      'services'::text,
      'products'::text,
      'portfolio'::text,
      'nonprofit'::text,
      'other'::text
    ]));
