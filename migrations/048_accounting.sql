-- Accounting system: manual entries, recurring entries, invoice tracking.
-- Auto-tracked revenue/expenses are computed on the fly from
-- user_subscriptions, user_addons, and domain_purchases tables.

-- ── Manual accounting entries ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                text        NOT NULL CHECK (type IN ('revenue', 'expense')),
  source              text        NOT NULL DEFAULT 'manual'
                                  CHECK (source IN ('manual', 'subscription', 'addon', 'domain_sale', 'domain_cost', 'overage')),
  title               text        NOT NULL,
  description         text,
  amount_cents        integer     NOT NULL CHECK (amount_cents >= 0),
  tax_cents           integer     NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  tax_type            text        CHECK (tax_type IN ('gst', 'hst', 'gst_pst', 'none')),
  currency            text        NOT NULL DEFAULT 'CAD',
  category            text,
  date                date        NOT NULL DEFAULT CURRENT_DATE,
  reference_id        text,       -- stripe invoice ID, domain purchase ID, etc.
  reference_type      text,       -- 'stripe_invoice', 'domain_purchase', etc.
  user_id             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  recurring_entry_id  uuid,       -- FK added after recurring table exists
  invoice_storage_path text,      -- path in Supabase storage for invoice file
  invoice_filename    text,
  notes               text,
  is_auto             boolean     NOT NULL DEFAULT false,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_entries_type       ON public.accounting_entries(type);
CREATE INDEX IF NOT EXISTS accounting_entries_date       ON public.accounting_entries(date);
CREATE INDEX IF NOT EXISTS accounting_entries_source     ON public.accounting_entries(source);
CREATE INDEX IF NOT EXISTS accounting_entries_category   ON public.accounting_entries(category);
CREATE INDEX IF NOT EXISTS accounting_entries_recurring  ON public.accounting_entries(recurring_entry_id);

-- ── Recurring entry templates ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounting_recurring (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              text        NOT NULL CHECK (type IN ('revenue', 'expense')),
  title             text        NOT NULL,
  description       text,
  amount_cents      integer     NOT NULL CHECK (amount_cents >= 0),
  tax_cents         integer     NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  tax_type          text        CHECK (tax_type IN ('gst', 'hst', 'gst_pst', 'none')),
  currency          text        NOT NULL DEFAULT 'CAD',
  category          text,
  frequency         text        NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date        date        NOT NULL,
  end_date          date,       -- null = ongoing
  next_due_date     date        NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  requires_invoice  boolean     NOT NULL DEFAULT true,
  notes             text,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Now add FK from entries to recurring
ALTER TABLE public.accounting_entries
  ADD CONSTRAINT fk_accounting_entries_recurring
  FOREIGN KEY (recurring_entry_id) REFERENCES public.accounting_recurring(id) ON DELETE SET NULL;

-- ── Category presets ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  color      text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.accounting_categories (name, color) VALUES
  ('Subscriptions',  '#10b981'),
  ('Domains',        '#3b82f6'),
  ('Add-ons',        '#8b5cf6'),
  ('Hosting',        '#f59e0b'),
  ('Software',       '#ec4899'),
  ('Marketing',      '#ef4444'),
  ('Legal',          '#6366f1'),
  ('Office',         '#14b8a6'),
  ('Tax',            '#f97316'),
  ('Other',          '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- ── RLS — service-role only (ops dashboard uses admin client) ───────────────

ALTER TABLE public.accounting_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_recurring  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no public policies needed.

-- ── Storage bucket for invoices ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;
