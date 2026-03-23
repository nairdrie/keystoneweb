-- Migration: Add options JSONB to booking_services
-- Run this in the Supabase SQL Editor
--
-- Service options allow variants like "Single Session", "5-Pack", "10-Pack"
-- Each option has a name and price_cents that overrides the base service price.
-- When options is NULL or empty, the base price_cents on the service is used.
-- 
-- Option shape: [{ id: string, name: string, price_cents: number }]

ALTER TABLE public.booking_services
ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL;
