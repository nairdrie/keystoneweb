-- Universal Commerce Protocol (UCP) support.
--
-- Adds:
--   * native_commerce + AI attribute columns on products so the platform's
--     feed can emit Google's `native_commerce` attribute and AI agents can
--     execute deterministic compatibility / fit / specification lookups
--     without scraping the storefront.
--   * `ucp_carts` — agent-owned cart state separate from the cookie cart so
--     a Gemini/A2A session can outlive a browser session.
--   * `ucp_mandates` — AP2 cryptographic intent + payment mandates the agent
--     signs and the platform verifies at checkout. Stored hashed so we can
--     prove what the agent agreed to.
--   * `ai_agent_activity` — every AI-agent-attributed request (UCP, MCP,
--     A2A, native_commerce feed fetches) gets a row. Powers the merchant
--     dashboard's "Share of Voice" / "How is AI talking about my store" view.
--   * `product_ai_enrichment_jobs` — bookkeeping for the async enrichment
--     worker that auto-fills conversational attributes from name/desc/images.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ai_attributes      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS native_commerce    boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gtin               text,
  ADD COLUMN IF NOT EXISTS mpn                text,
  ADD COLUMN IF NOT EXISTS condition          text                 DEFAULT 'new'
    CHECK (condition IN ('new', 'refurbished', 'used')),
  ADD COLUMN IF NOT EXISTS ai_enriched_at     timestamptz,
  ADD COLUMN IF NOT EXISTS ai_enrichment_hash text;

CREATE INDEX IF NOT EXISTS idx_products_native_commerce
  ON public.products(site_id, native_commerce)
  WHERE is_archived = false AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_products_ai_attributes_gin
  ON public.products USING gin (ai_attributes);


-- 1. Agent-owned UCP carts
CREATE TABLE IF NOT EXISTS public.ucp_carts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  agent_id          text,                              -- e.g. "google-gemini", "openai-operator"
  agent_session_id  text,
  user_token        text,                              -- opaque token mapping back to a logged-in customer, if any
  currency          text NOT NULL DEFAULT 'USD',
  items             jsonb NOT NULL DEFAULT '[]'::jsonb,-- [{productId, qty, variants, options, unitPriceCents, lineSubtotalCents}]
  totals            jsonb NOT NULL DEFAULT '{}'::jsonb,-- {subtotalCents, taxCents, shippingCents, discountCents, totalCents}
  shipping_address  jsonb,
  promo_codes       text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'checking_out', 'converted', 'abandoned')),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ucp_carts_site_status
  ON public.ucp_carts(site_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucp_carts_agent
  ON public.ucp_carts(agent_id, created_at DESC);

ALTER TABLE public.ucp_carts ENABLE ROW LEVEL SECURITY;
-- Service-role only; agent access is mediated by the API layer.
CREATE POLICY "Site owners read their UCP carts"
  ON public.ucp_carts FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));


-- 2. AP2 mandates (signed agent intent / payment authorization)
CREATE TABLE IF NOT EXISTS public.ucp_mandates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  cart_id           uuid REFERENCES public.ucp_carts(id) ON DELETE SET NULL,
  order_id          uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  mandate_type      text NOT NULL CHECK (mandate_type IN ('intent', 'cart', 'payment')),
  agent_id          text NOT NULL,
  agent_session_id  text,
  payload_hash      text NOT NULL,                       -- sha256 of canonical mandate JSON
  payload           jsonb NOT NULL,                      -- the full mandate envelope (incl. amount, items)
  signature         text NOT NULL,                       -- HMAC-SHA256 of payload_hash with platform secret
  signature_alg     text NOT NULL DEFAULT 'HMAC-SHA256',
  status            text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'verified', 'consumed', 'revoked', 'expired')),
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  consumed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ucp_mandates_site
  ON public.ucp_mandates(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucp_mandates_cart
  ON public.ucp_mandates(cart_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ucp_mandates_hash
  ON public.ucp_mandates(payload_hash);

ALTER TABLE public.ucp_mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site owners read their mandates"
  ON public.ucp_mandates FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));


-- 3. AI agent activity log (powers Share of Voice + agent insights)
CREATE TABLE IF NOT EXISTS public.ai_agent_activity (
  id              bigserial PRIMARY KEY,
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  agent_id        text NOT NULL,            -- "google-gemini", "openai-operator", "anthropic-claude", "perplexity", "unknown-bot"
  surface         text NOT NULL,            -- "ucp_rest", "mcp", "a2a", "feed", "robots", "scrape", "checkout"
  action          text NOT NULL,            -- "list_products", "get_product", "create_cart", "quote", "checkout_init", "mandate_verify", "fetch_feed"
  product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
  cart_id         uuid REFERENCES public.ucp_carts(id) ON DELETE SET NULL,
  order_id        uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  http_status     integer,
  user_agent      text,
  ip_hash         text,                     -- sha256 of (ip + site_id), avoids storing raw IPs
  request_meta    jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_cents    integer,                  -- present on cart/checkout events for revenue attribution
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_site_time
  ON public.ai_agent_activity(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_site_agent
  ON public.ai_agent_activity(site_id, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_activity_product
  ON public.ai_agent_activity(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.ai_agent_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site owners read their AI activity"
  ON public.ai_agent_activity FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));


-- 4. AI enrichment job queue
CREATE TABLE IF NOT EXISTS public.product_ai_enrichment_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'error', 'skipped')),
  attempts      integer NOT NULL DEFAULT 0,
  error         text,
  input_hash    text NOT NULL,             -- sha256 of source fields so we skip no-op enrichments
  result        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_jobs_product_hash
  ON public.product_ai_enrichment_jobs(product_id, input_hash);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_pending
  ON public.product_ai_enrichment_jobs(status, created_at)
  WHERE status IN ('pending', 'running');

ALTER TABLE public.product_ai_enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site owners read their enrichment jobs"
  ON public.product_ai_enrichment_jobs FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));
