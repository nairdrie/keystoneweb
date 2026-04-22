-- Flat-rate tax: attach a configurable rate+label to ecommerce_settings and
-- record the tax charged on each order for reporting.

ALTER TABLE public.ecommerce_settings
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label text;
