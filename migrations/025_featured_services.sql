-- Migration 025: Featured services
-- Adds featured flag and compare-at price to booking_services

ALTER TABLE booking_services
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_at_price_cents integer;

-- Index to quickly fetch featured services first
CREATE INDEX IF NOT EXISTS idx_booking_services_featured
  ON booking_services (site_id, is_featured)
  WHERE is_featured = true;
