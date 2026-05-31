-- Flat-rate tax for booking: mirrors ecommerce_settings.tax_rate_bps / tax_label
-- so the booking checkout can charge a fixed percentage on every booking the
-- same way the store does on every order.

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label text;
