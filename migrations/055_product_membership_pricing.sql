-- Add per-product tiered pricing and access gating by membership package.
--
--   tier_prices:          [{ packageId: uuid, priceCents: integer }]
--                         Members of the given package see priceCents (clamped to <= price_cents server-side).
--   allowed_package_ids:  [uuid, ...]
--                         [] = anyone can purchase. Non-empty = only members of those packages can purchase.
--
-- The resolver in lib/ecommerce/resolve-price.ts is the single source of truth
-- for turning these columns into the final displayed/charged price.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tier_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_package_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
