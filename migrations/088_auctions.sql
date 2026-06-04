-- Migration 088: Live Auctions
--
-- Adds:
--   * sites.auctions_enabled (feature flag, ops toggleable; mirrors marketing_enabled)
--   * auctions             — one row per scheduled auction event
--   * auction_lots         — items within an auction, ordered, with soft-close state
--   * auction_registrations — per-auction bidder enrolment with Stripe card on file
--   * auction_bids         — immutable bid ledger
--   * auction_charges      — Stripe PaymentIntent ledger for winners
--   * place_auction_bid()  — atomic SQL function enforcing min-bid + soft-close

-- 1. Feature flag on sites ----------------------------------------------------
ALTER TABLE public.sites
    ADD COLUMN IF NOT EXISTS auctions_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sites_auctions_enabled
    ON public.sites(auctions_enabled) WHERE auctions_enabled = true;

-- 2. Auctions -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auctions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_start timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
    current_lot_id uuid,
    soft_close_seconds int NOT NULL DEFAULT 20 CHECK (soft_close_seconds BETWEEN 5 AND 120),
    initial_lot_seconds int NOT NULL DEFAULT 60 CHECK (initial_lot_seconds BETWEEN 15 AND 600),
    auto_approve_registrations boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_auctions_site ON public.auctions(site_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(site_id, status);

-- 3. Lots ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auction_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    lot_number int NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    starting_bid_cents int NOT NULL CHECK (starting_bid_cents >= 0),
    bid_increment_cents int NOT NULL DEFAULT 100 CHECK (bid_increment_cents > 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'live', 'sold', 'passed', 'skipped')),
    current_bid_cents int,
    current_winner_registration_id uuid,
    ends_at timestamptz,
    started_at timestamptz,
    ended_at timestamptz,
    sold_price_cents int,
    winner_registration_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(auction_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_lots_auction ON public.auction_lots(auction_id, lot_number);
CREATE INDEX IF NOT EXISTS idx_lots_status ON public.auction_lots(auction_id, status);

-- 4. Registrations ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auction_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'approved'
        CHECK (status IN ('pending', 'approved', 'rejected', 'banned')),
    -- Anonymous alias shown to other bidders, e.g. "Crimson Wolf"
    alias_color text NOT NULL,
    alias_animal text NOT NULL,
    -- Stripe card on file (captured via SetupIntent at registration)
    stripe_customer_id text NOT NULL,
    stripe_payment_method_id text NOT NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(auction_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_auction ON public.auction_registrations(auction_id);
CREATE INDEX IF NOT EXISTS idx_registrations_member ON public.auction_registrations(member_id);
CREATE INDEX IF NOT EXISTS idx_registrations_site ON public.auction_registrations(site_id);

-- 5. Bids ledger --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auction_bids (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
    registration_id uuid NOT NULL REFERENCES public.auction_registrations(id) ON DELETE CASCADE,
    amount_cents int NOT NULL CHECK (amount_cents > 0),
    status text NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('accepted', 'retracted')),
    retracted_at timestamptz,
    retracted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    retracted_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_lot ON public.auction_bids(lot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_registration ON public.auction_bids(registration_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON public.auction_bids(auction_id);

-- 6. Winner charges -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auction_charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
    registration_id uuid NOT NULL REFERENCES public.auction_registrations(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    stripe_payment_intent_id text,
    amount_cents int NOT NULL CHECK (amount_cents > 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    failure_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(lot_id)
);

CREATE INDEX IF NOT EXISTS idx_charges_site ON public.auction_charges(site_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON public.auction_charges(status);

-- 7. Atomic bid acceptance ----------------------------------------------------
-- Enforces:
--   - lot is live and not yet ended
--   - registration is approved for this auction
--   - bid is at least starting_bid (first bid) or current_bid + increment
--   - bidder isn't outbidding themselves
-- Returns jsonb with { ok, ...details }.
-- On success: inserts bid, updates lot's current_bid + winner, extends ends_at
-- via soft-close (now() + soft_close_seconds, but never shrinking the timer).
CREATE OR REPLACE FUNCTION public.place_auction_bid(
    p_lot_id uuid,
    p_registration_id uuid,
    p_amount_cents int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lot record;
    v_auction record;
    v_min_bid int;
    v_new_ends_at timestamptz;
    v_bid_id uuid;
BEGIN
    SELECT * INTO v_lot FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'lot_not_found');
    END IF;
    IF v_lot.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'lot_not_live');
    END IF;
    IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'lot_ended');
    END IF;

    SELECT * INTO v_auction FROM public.auctions WHERE id = v_lot.auction_id;
    IF v_auction.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auction_not_live');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.auction_registrations
        WHERE id = p_registration_id
          AND auction_id = v_lot.auction_id
          AND status = 'approved'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'registration_not_approved');
    END IF;

    IF v_lot.current_bid_cents IS NULL THEN
        v_min_bid := v_lot.starting_bid_cents;
    ELSE
        v_min_bid := v_lot.current_bid_cents + v_lot.bid_increment_cents;
    END IF;

    IF p_amount_cents < v_min_bid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bid_too_low', 'min_cents', v_min_bid);
    END IF;

    IF v_lot.current_winner_registration_id = p_registration_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'already_high_bidder');
    END IF;

    v_new_ends_at := GREATEST(
        COALESCE(v_lot.ends_at, now()),
        now() + (v_auction.soft_close_seconds || ' seconds')::interval
    );

    INSERT INTO public.auction_bids (auction_id, lot_id, registration_id, amount_cents)
    VALUES (v_lot.auction_id, p_lot_id, p_registration_id, p_amount_cents)
    RETURNING id INTO v_bid_id;

    UPDATE public.auction_lots SET
        current_bid_cents = p_amount_cents,
        current_winner_registration_id = p_registration_id,
        ends_at = v_new_ends_at,
        updated_at = now()
    WHERE id = p_lot_id;

    RETURN jsonb_build_object(
        'ok', true,
        'bid_id', v_bid_id,
        'lot_id', p_lot_id,
        'amount_cents', p_amount_cents,
        'ends_at', v_new_ends_at,
        'winner_registration_id', p_registration_id
    );
END;
$$;

-- 8. RLS ----------------------------------------------------------------------
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_charges ENABLE ROW LEVEL SECURITY;

-- Site owners (admin context) can fully manage their site's auction data.
CREATE POLICY "Site owners manage auctions" ON public.auctions FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage lots" ON public.auction_lots FOR ALL
    USING (auction_id IN (SELECT id FROM public.auctions WHERE site_id IN
        (SELECT id FROM public.sites WHERE user_id = auth.uid())))
    WITH CHECK (auction_id IN (SELECT id FROM public.auctions WHERE site_id IN
        (SELECT id FROM public.sites WHERE user_id = auth.uid())));

CREATE POLICY "Site owners manage registrations" ON public.auction_registrations FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners view bids" ON public.auction_bids FOR SELECT
    USING (auction_id IN (SELECT id FROM public.auctions WHERE site_id IN
        (SELECT id FROM public.sites WHERE user_id = auth.uid())));

CREATE POLICY "Site owners manage bids" ON public.auction_bids FOR UPDATE
    USING (auction_id IN (SELECT id FROM public.auctions WHERE site_id IN
        (SELECT id FROM public.sites WHERE user_id = auth.uid())))
    WITH CHECK (auction_id IN (SELECT id FROM public.auctions WHERE site_id IN
        (SELECT id FROM public.sites WHERE user_id = auth.uid())));

CREATE POLICY "Site owners view charges" ON public.auction_charges FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Server-side code uses the admin (service-role) client for all writes that
-- aren't site-owner-driven (e.g. bid placement by members, winner charges).
-- Members never query these tables directly from the browser; everything
-- flows through validated API routes.
