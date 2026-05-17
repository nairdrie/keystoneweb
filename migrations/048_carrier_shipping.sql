-- Product physical dimensions (required for carrier rate quoting)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weight_grams integer,
    ADD COLUMN IF NOT EXISTS length_mm integer,
    ADD COLUMN IF NOT EXISTS width_mm integer,
    ADD COLUMN IF NOT EXISTS height_mm integer;

-- Origin (warehouse) address + Shippo credentials on store settings
ALTER TABLE public.ecommerce_settings
    ADD COLUMN IF NOT EXISTS origin_line1 text,
    ADD COLUMN IF NOT EXISTS origin_line2 text,
    ADD COLUMN IF NOT EXISTS origin_city text,
    ADD COLUMN IF NOT EXISTS origin_region text,
    ADD COLUMN IF NOT EXISTS origin_postal text,
    ADD COLUMN IF NOT EXISTS origin_country text,
    ADD COLUMN IF NOT EXISTS shippo_api_key text;

-- Extend shipping_zones: add 'carrier' rate type + service allowlist + markup
ALTER TABLE public.shipping_zones
    DROP CONSTRAINT IF EXISTS shipping_zones_rate_type_check;
ALTER TABLE public.shipping_zones
    ADD CONSTRAINT shipping_zones_rate_type_check
    CHECK (rate_type IN ('flat', 'free', 'free_above', 'carrier'));

ALTER TABLE public.shipping_zones
    ADD COLUMN IF NOT EXISTS carrier_services jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS markup_type text DEFAULT 'exact'
        CHECK (markup_type IN ('exact', 'flat')),
    ADD COLUMN IF NOT EXISTS markup_cents integer DEFAULT 0;

-- Persist the customer's chosen service on the order for fulfillment
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS shipping_service_token text,
    ADD COLUMN IF NOT EXISTS shipping_carrier text;
