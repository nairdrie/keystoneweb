-- Migration 094: Shop tab (service desk + books for auto repair shops)
--
--   * sites.shop_enabled          feature flag, toggled by ops (same as marketing_enabled)
--   * shop_* tables               all site-scoped, owner RLS; API routes use the
--                                 service-role client after checking access
--   * shop-files storage bucket   private: job photos, voice notes, supplier
--                                 invoice photos, signatures
--   * shop_next_number()          race-safe repair order / invoice numbering
--
-- Money is stored as integer cents everywhere.

-- ── Feature flag ────────────────────────────────────────────────────────────

ALTER TABLE public.sites
    ADD COLUMN IF NOT EXISTS shop_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sites_shop_enabled
    ON public.sites(shop_enabled) WHERE shop_enabled = true;

-- ── Shared updated_at trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ── Settings (one row per site) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_settings (
    site_id                 uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
    legal_name              text,
    address                 text,
    phone                   text,
    email                   text,
    hst_number              text,
    tax_label               text NOT NULL DEFAULT 'HST',
    tax_rate_bps            integer NOT NULL DEFAULT 1300 CHECK (tax_rate_bps BETWEEN 0 AND 3000),
    labour_rate_cents       integer NOT NULL DEFAULT 12500 CHECK (labour_rate_cents >= 0),
    estimate_fee_cents      integer NOT NULL DEFAULT 9500 CHECK (estimate_fee_cents >= 0),
    estimate_valid_days     integer NOT NULL DEFAULT 30 CHECK (estimate_valid_days BETWEEN 1 AND 365),
    payment_terms           text NOT NULL DEFAULT 'Due at pickup',
    payment_methods_note    text NOT NULL DEFAULT 'Debit, credit, cash or e-transfer',
    etransfer_email         text,
    warranty_extra          text,  -- the shop's own warranty terms, printed after the statutory text
    diagnostic_policy       text,  -- how diagnostic time is charged (shop sign)
    flat_rate_policy        text,  -- flat rates and the work they apply to (shop sign)
    parts_commission_policy text NOT NULL DEFAULT 'Staff are not paid commissions on parts.',
    other_charges           text,  -- storage, pick-up/delivery, loaner vehicle, with prices
    bays                    jsonb NOT NULL DEFAULT '[{"id":"bay1","label":"Bay 1"},{"id":"bay2","label":"Bay 2"}]'::jsonb,
    staff                   jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "name": "Mike", "role": "tech" }]
    intake_dismissed        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- website form / booking ids hidden from intake
    province                text NOT NULL DEFAULT 'ON',
    next_ro_number          integer NOT NULL DEFAULT 1001,
    next_invoice_number     integer NOT NULL DEFAULT 1,
    key_tag_max             integer NOT NULL DEFAULT 99 CHECK (key_tag_max BETWEEN 1 AND 9999),
    tech_code               text UNIQUE,
    tech_pin_hash           text,
    tech_failed_attempts    integer NOT NULL DEFAULT 0,
    tech_locked_until       timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── Customers and vehicles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_customers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name            text NOT NULL,
    phone           text,
    email           text,
    address         text,
    customer_type   text NOT NULL DEFAULT 'consumer' CHECK (customer_type IN ('consumer', 'business')),
    business_reason text,  -- why consumer repair rules don't apply (e.g. "company fleet")
    preferences     text,  -- e.g. "Wants an itemized quote with options"
    notes           text,
    member_id       uuid REFERENCES public.members(id) ON DELETE SET NULL,
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_customers_site ON public.shop_customers(site_id, name);

CREATE TABLE IF NOT EXISTS public.shop_vehicles (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    customer_id   uuid NOT NULL REFERENCES public.shop_customers(id) ON DELETE CASCADE,
    year          integer CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
    make          text,
    model         text,
    trim          text,
    vin           text,
    plate         text,
    color         text,
    engine        text,
    notes         text,
    last_odometer integer,
    archived_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_vehicles_customer ON public.shop_vehicles(site_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_vehicles_vin ON public.shop_vehicles(site_id, vin);
CREATE INDEX IF NOT EXISTS idx_shop_vehicles_plate ON public.shop_vehicles(site_id, plate);

-- ── Suppliers (parts wholesalers; separate from ecommerce dropship vendors) ─

CREATE TABLE IF NOT EXISTS public.shop_suppliers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name           text NOT NULL,
    account_number text,
    rep_name       text,
    phone          text,
    email          text,
    terms          text,
    archived_at    timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_suppliers_site ON public.shop_suppliers(site_id, name);

-- ── Jobs (one per visit; a repair order) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_jobs (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id                uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    ro_number              integer NOT NULL,
    customer_id            uuid NOT NULL REFERENCES public.shop_customers(id) ON DELETE RESTRICT,
    vehicle_id             uuid NOT NULL REFERENCES public.shop_vehicles(id) ON DELETE RESTRICT,
    key_tag                text,
    stage                  text NOT NULL DEFAULT 'dropped'
                           CHECK (stage IN ('dropped', 'estimate', 'waiting', 'approved', 'done')),
    bay                    text,  -- bay id from shop_settings.bays while the car is in a bay
    sort_order             double precision NOT NULL DEFAULT 0,
    assigned_tech          text,
    complaint              text NOT NULL,
    diagnosis              text,
    source                 text NOT NULL DEFAULT 'walk_in'
                           CHECK (source IN ('walk_in', 'key_drop', 'phone', 'website_form', 'booking', 'other')),
    source_ref             text,  -- contact_submissions.id or bookings.id it came from
    odometer_in            integer,
    odometer_out           integer,
    estimate_fee_cents     integer NOT NULL DEFAULT 0 CHECK (estimate_fee_cents >= 0),
    estimate_fee_note      text,  -- how the customer agreed to the fee
    estimate_fee_agreed_at timestamptz,
    next_step              text,
    promised_date          date,
    -- Changes to approved lines before invoicing (actual hours, price changes),
    -- keyed by estimate line id. The invoice total must stay within 10% of the
    -- approved estimate.
    invoice_adjustments    jsonb NOT NULL DEFAULT '{}'::jsonb,
    owner_is_customer      boolean NOT NULL DEFAULT true,
    registered_owner_name  text,
    diagnosed_at           timestamptz,
    completed_at           timestamptz,
    returned_at            timestamptz,
    holding_since          timestamptz,  -- possessory lien: car kept until the bill is paid
    status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_reason          text CHECK (closed_reason IS NULL OR closed_reason IN ('paid', 'released_on_plan', 'no_charge', 'cancelled')),
    closed_at              timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (site_id, ro_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_jobs_open_key_tag
    ON public.shop_jobs(site_id, key_tag) WHERE status = 'open' AND key_tag IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shop_jobs_open_bay
    ON public.shop_jobs(site_id, bay) WHERE status = 'open' AND bay IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_jobs_site_status ON public.shop_jobs(site_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_jobs_customer ON public.shop_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_jobs_vehicle ON public.shop_jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_shop_jobs_source_ref ON public.shop_jobs(site_id, source_ref) WHERE source_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shop_job_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id    uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    job_id     uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE CASCADE,
    kind       text NOT NULL CHECK (kind IN (
                   'intake', 'note', 'voice', 'photo', 'call', 'move', 'diagnosis', 'estimate',
                   'authorization', 'parts', 'invoice', 'payment', 'lien', 'email', 'system')),
    actor      text,
    body       text,
    quote      text,  -- the customer's words or a voice-note transcript
    file_path  text,  -- shop-files object path (photo, audio)
    meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_job_events_job ON public.shop_job_events(job_id, created_at);

-- ── Estimates (versioned) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_estimates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    job_id       uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE CASCADE,
    version      integer NOT NULL,
    status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'replaced')),
    is_revision  boolean NOT NULL DEFAULT false,  -- adds work to an approved estimate
    needs_review boolean NOT NULL DEFAULT false,  -- AI drafted lines from a voice note; the desk hasn't looked yet
    sent_at      timestamptz,
    sent_via     text,
    valid_until  date,
    ready_by     date,
    public_token text UNIQUE,
    approved_at  timestamptz,
    declined_at  timestamptz,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, version)
);

CREATE INDEX IF NOT EXISTS idx_shop_estimates_job ON public.shop_estimates(job_id);

CREATE TABLE IF NOT EXISTS public.shop_estimate_lines (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id           uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    estimate_id       uuid NOT NULL REFERENCES public.shop_estimates(id) ON DELETE CASCADE,
    position          integer NOT NULL DEFAULT 0,
    kind              text NOT NULL CHECK (kind IN ('labour', 'part', 'supply', 'fee', 'discount', 'sublet')),
    description       text NOT NULL,
    decision          text NOT NULL DEFAULT 'include' CHECK (decision IN ('include', 'declined')),
    qty               numeric(10, 2) NOT NULL DEFAULT 1,
    hours             numeric(6, 2),
    rate_cents        integer,
    unit_price_cents  integer,  -- parts: null means it still needs a price
    amount_cents      integer,  -- supply / fee / sublet / discount (negative)
    unit_cost_cents   integer,
    supplier_id       uuid REFERENCES public.shop_suppliers(id) ON DELETE SET NULL,
    part_number       text,
    brand             text,
    condition         text CHECK (condition IS NULL OR condition IN ('new_oem', 'new_non_oem', 'used', 'reconditioned')),
    quoted_at         date,
    quoted_by         text,
    eta               text,
    core_charge_cents integer,
    no_warranty       boolean NOT NULL DEFAULT false,  -- fluids, filters, lights, tires, batteries
    is_added_work     boolean NOT NULL DEFAULT false,
    alternates        jsonb NOT NULL DEFAULT '[]'::jsonb,
    ordered_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_estimate_lines_estimate ON public.shop_estimate_lines(estimate_id, position);

-- ── Authorizations (append-only record of every customer OK) ───────────────

CREATE TABLE IF NOT EXISTS public.shop_authorizations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    job_id         uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE CASCADE,
    estimate_id    uuid REFERENCES public.shop_estimates(id) ON DELETE SET NULL,
    kind           text NOT NULL CHECK (kind IN ('estimate_fee', 'estimate', 'max_amount')),
    method         text NOT NULL CHECK (method IN ('phone', 'in_person', 'online', 'email', 'text')),
    authorized_by  text NOT NULL,
    phone          text,
    contact        text,
    authorized_at  timestamptz NOT NULL,
    taken_by       text,
    amount_cents   integer,
    line_ids       uuid[] NOT NULL DEFAULT '{}',
    parts_back     boolean,
    signature_path text,
    typed_name     text,
    ip_address     text,
    user_agent     text,
    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_authorizations_job ON public.shop_authorizations(job_id, authorized_at);

-- ── Supplier invoices (the "parts pile") ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_supplier_bills (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id           uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    supplier_id       uuid REFERENCES public.shop_suppliers(id) ON DELETE SET NULL,
    supplier_name_raw text,
    invoice_number    text,
    invoice_date      date,
    subtotal_cents    integer,
    tax_cents         integer,
    total_cents       integer,
    file_path         text,
    file_mime         text,
    handwritten_note  text,
    status            text NOT NULL DEFAULT 'needs_match'
                      CHECK (status IN ('needs_match', 'matched', 'stock', 'returned')),
    suggested_job_id  uuid REFERENCES public.shop_jobs(id) ON DELETE SET NULL,
    suggestion_reason text,
    ai_error          text,
    paid_at           timestamptz,
    created_by        text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_supplier_bills_number
    ON public.shop_supplier_bills(site_id, supplier_id, invoice_number)
    WHERE supplier_id IS NOT NULL AND invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_supplier_bills_status ON public.shop_supplier_bills(site_id, status);

CREATE TABLE IF NOT EXISTS public.shop_supplier_bill_lines (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    bill_id          uuid NOT NULL REFERENCES public.shop_supplier_bills(id) ON DELETE CASCADE,
    position         integer NOT NULL DEFAULT 0,
    description      text NOT NULL,
    part_number      text,
    qty              numeric(10, 2) NOT NULL DEFAULT 1,
    unit_cost_cents  integer NOT NULL DEFAULT 0,
    line_total_cents integer NOT NULL DEFAULT 0,
    is_core          boolean NOT NULL DEFAULT false,  -- refundable core charge
    core_returned_at timestamptz,
    job_id           uuid REFERENCES public.shop_jobs(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_supplier_bill_lines_bill ON public.shop_supplier_bill_lines(bill_id, position);
CREATE INDEX IF NOT EXISTS idx_shop_supplier_bill_lines_job ON public.shop_supplier_bill_lines(job_id) WHERE job_id IS NOT NULL;

-- ── Invoices (locked once issued; changes go through void + reissue) ───────

CREATE TABLE IF NOT EXISTS public.shop_invoices (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    job_id         uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE RESTRICT,
    invoice_number integer NOT NULL,
    status         text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'void')),
    issued_at      timestamptz NOT NULL DEFAULT now(),
    estimate_id    uuid REFERENCES public.shop_estimates(id) ON DELETE SET NULL,
    subtotal_cents integer NOT NULL,
    tax_cents      integer NOT NULL,
    total_cents    integer NOT NULL,
    snapshot       jsonb NOT NULL,  -- everything printed on the invoice, frozen at issue time
    public_token   text UNIQUE,
    voided_at      timestamptz,
    void_reason    text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (site_id, invoice_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_invoices_one_active
    ON public.shop_invoices(job_id) WHERE status = 'issued';
CREATE INDEX IF NOT EXISTS idx_shop_invoices_site ON public.shop_invoices(site_id, issued_at);

-- ── Liens (release on credit) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_liens (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id                  uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    job_id                   uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE RESTRICT,
    invoice_id               uuid NOT NULL REFERENCES public.shop_invoices(id) ON DELETE RESTRICT,
    status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paid', 'discharged', 'cancelled')),
    released_at              timestamptz NOT NULL DEFAULT now(),
    amount_owing_cents       integer NOT NULL CHECK (amount_owing_cents >= 0),
    down_payment_cents       integer NOT NULL DEFAULT 0 CHECK (down_payment_cents >= 0),
    plan_kind                text NOT NULL CHECK (plan_kind IN ('single', 'instalments')),
    frequency                text CHECK (frequency IS NULL OR frequency IN ('weekly', 'biweekly', 'monthly')),
    instalment_cents         integer,
    schedule                 jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "due": "YYYY-MM-DD", "amount_cents": 0 }]
    ack_signer_name          text NOT NULL,
    ack_signer_capacity      text NOT NULL DEFAULT 'owner' CHECK (ack_signer_capacity IN ('owner', 'authorized_agent')),
    ack_signature_path       text,
    ack_signed_at            timestamptz NOT NULL,
    credit_disclosure_given  boolean NOT NULL DEFAULT false,
    debtor_legal_name        text,
    debtor_dob               date,
    debtor_address           text,
    ppsr_registration_number text,
    ppsr_registered_at       timestamptz,
    ppsr_years               integer CHECK (ppsr_years IS NULL OR ppsr_years BETWEEN 1 AND 3),
    ppsr_expires_on          date,
    paid_off_at              timestamptz,
    discharge_due_on         date,
    discharge_registered_at  timestamptz,
    discharge_reference      text,
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_liens_site ON public.shop_liens(site_id, status);

-- ── Payments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_payments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    invoice_id   uuid NOT NULL REFERENCES public.shop_invoices(id) ON DELETE RESTRICT,
    job_id       uuid NOT NULL REFERENCES public.shop_jobs(id) ON DELETE RESTRICT,
    lien_id      uuid REFERENCES public.shop_liens(id) ON DELETE SET NULL,
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    method       text NOT NULL CHECK (method IN ('cash', 'debit', 'credit', 'etransfer', 'cheque', 'stripe', 'paypal', 'other')),
    reference    text,
    provider_ref text,  -- Stripe checkout session / PayPal order id (idempotency)
    received_at  timestamptz NOT NULL DEFAULT now(),
    recorded_by  text,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_payments_provider_ref
    ON public.shop_payments(site_id, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_payments_invoice ON public.shop_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_site ON public.shop_payments(site_id, received_at);

-- ── Tech devices (shop PIN sign-in for the bay phone/tablet) ───────────────

CREATE TABLE IF NOT EXISTS public.shop_tech_devices (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    label        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz,
    revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_tech_devices_site ON public.shop_tech_devices(site_id);

-- ── updated_at triggers ─────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'shop_settings', 'shop_customers', 'shop_vehicles', 'shop_suppliers', 'shop_jobs',
        'shop_estimates', 'shop_estimate_lines', 'shop_supplier_bills', 'shop_invoices', 'shop_liens'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_updated_at', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.shop_set_updated_at()',
            t || '_updated_at', t
        );
    END LOOP;
END;
$$;

-- ── Row level security: site owners only ────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'shop_settings', 'shop_customers', 'shop_vehicles', 'shop_suppliers', 'shop_jobs',
        'shop_job_events', 'shop_estimates', 'shop_estimate_lines', 'shop_authorizations',
        'shop_supplier_bills', 'shop_supplier_bill_lines', 'shop_invoices', 'shop_liens',
        'shop_payments', 'shop_tech_devices'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Site owners manage ' || t, t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL '
            'USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())) '
            'WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))',
            'Site owners manage ' || t, t
        );
    END LOOP;
END;
$$;

-- ── Numbering ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_next_number(p_site_id uuid, p_kind text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v integer;
BEGIN
    INSERT INTO public.shop_settings (site_id) VALUES (p_site_id)
    ON CONFLICT (site_id) DO NOTHING;

    IF p_kind = 'ro' THEN
        UPDATE public.shop_settings
           SET next_ro_number = next_ro_number + 1
         WHERE site_id = p_site_id
        RETURNING next_ro_number - 1 INTO v;
    ELSIF p_kind = 'invoice' THEN
        UPDATE public.shop_settings
           SET next_invoice_number = next_invoice_number + 1
         WHERE site_id = p_site_id
        RETURNING next_invoice_number - 1 INTO v;
    ELSE
        RAISE EXCEPTION 'Unknown number kind: %', p_kind;
    END IF;

    RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.shop_next_number(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_next_number(uuid, text) TO service_role;

-- ── Storage ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('shop-files', 'shop-files', false, 26214400) -- 25 MB
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role full access on shop-files" ON storage.objects;

CREATE POLICY "Service role full access on shop-files"
    ON storage.objects FOR ALL
    USING (bucket_id = 'shop-files' AND auth.role() = 'service_role')
    WITH CHECK (bucket_id = 'shop-files' AND auth.role() = 'service_role');
