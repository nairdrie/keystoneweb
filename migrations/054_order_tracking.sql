-- Add shipment tracking fields to orders so owners can record
-- a tracking number + carrier and notify customers.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_carrier text;
