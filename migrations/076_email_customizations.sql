-- Email customizations: per-site overrides for automated transactional emails
-- email_key values:
--   Ecommerce: order_confirmed, order_payment_confirmed, order_shipped, order_cancelled, mixed_order_confirmed
--   Bookings:  booking_confirmed, booking_payment_confirmed, booking_cancelled
-- overrides JSON: { subject?, heading?, subheading?, footerText? }

CREATE TABLE IF NOT EXISTS email_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email_key TEXT NOT NULL,
    overrides JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, email_key)
);

CREATE INDEX IF NOT EXISTS email_customizations_site_id_idx ON email_customizations(site_id);

ALTER TABLE email_customizations ENABLE ROW LEVEL SECURITY;

-- Site owners can read/write their own email customizations
CREATE POLICY "site_owner_email_customizations" ON email_customizations
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );
