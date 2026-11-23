-- Printful as a connectable, automated fulfillment provider (per site).
--
-- Keystone holds each site's Printful connection: credentials are encrypted
-- by the app (lib/crypto/secret-box.ts, env CREDENTIALS_ENCRYPTION_KEY) before
-- they are stored, and these tables have RLS on with NO policies, so only the
-- service role (server code) can read them. Nothing here is ever returned to
-- browsers or MCP output.
--
-- Why not a vendor (061_vendors)? Vendors are paid separately at checkout
-- (their own Stripe/Converge/Clover account, or externally). With Printful the
-- customer pays the site owner as usual and Printful bills the owner, so a
-- Printful line item stays in the owner's order; only fulfillment differs.

-- 1. Connection (one per site)
CREATE TABLE IF NOT EXISTS public.printful_connections (
    site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
    auth_type text NOT NULL CHECK (auth_type IN ('oauth', 'token')),
    store_id bigint,
    store_name text,
    access_token_enc text NOT NULL,
    refresh_token_enc text,                 -- OAuth only (rotates on each refresh)
    token_expires_at timestamptz,           -- OAuth access tokens last ~1 hour
    webhook_secret_enc text,                -- v2 webhook HMAC secret (hex), encrypted
    webhook_configured_at timestamptz,
    auto_confirm boolean NOT NULL DEFAULT false, -- false = Printful orders are created as drafts
    last_error text,
    connected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.printful_connections ENABLE ROW LEVEL SECURITY;

-- Short-lived OAuth state (CSRF) for the Connect Printful flow.
CREATE TABLE IF NOT EXISTS public.printful_oauth_states (
    state text PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.printful_oauth_states ENABLE ROW LEVEL SECURITY;

-- 2. Product fulfillment
-- null = the owner (or a vendor via vendor_id) fulfills it; 'printful' = Printful does.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS fulfillment_provider text
        CHECK (fulfillment_provider IS NULL OR fulfillment_provider IN ('printful'));

-- Keystone product → Printful sync product, with the variant mapping computed
-- on the server from Printful's own data:
--   variants: [{ "selection": {"Color":"Black","Size":"M"}, "sync_variant_id": 123,
--                "name": "...", "retail_price_cents": 2500, "available": true }]
CREATE TABLE IF NOT EXISTS public.printful_product_links (
    product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    sync_product_id bigint NOT NULL,
    variants jsonb NOT NULL DEFAULT '[]'::jsonb,
    synced_at timestamptz DEFAULT now(),
    UNIQUE (site_id, sync_product_id)
);

CREATE INDEX IF NOT EXISTS idx_printful_links_site ON public.printful_product_links(site_id);
ALTER TABLE public.printful_product_links ENABLE ROW LEVEL SECURITY;

-- 3. One Printful order per Keystone order (external_id = Keystone order id)
CREATE TABLE IF NOT EXISTS public.printful_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    printful_order_id bigint,
    -- submitting → draft | pending (confirmed) | ... Printful statuses ... | failed | skipped
    status text NOT NULL DEFAULT 'submitting',
    confirmed boolean NOT NULL DEFAULT false,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{productId, sync_variant_id, quantity}]
    shipments jsonb NOT NULL DEFAULT '[]'::jsonb,
    error text,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printful_orders_site ON public.printful_orders(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_printful_orders_pf ON public.printful_orders(printful_order_id);
ALTER TABLE public.printful_orders ENABLE ROW LEVEL SECURITY;
