-- Add tax_enabled flag to ecommerce and booking settings tables.
-- When enabled, Stripe Checkout sessions will use automatic_tax.

ALTER TABLE ecommerce_settings
  ADD COLUMN IF NOT EXISTS tax_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE booking_settings
  ADD COLUMN IF NOT EXISTS tax_enabled boolean NOT NULL DEFAULT false;
