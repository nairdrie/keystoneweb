-- Migration 078: Allow capturing guest checkout customers as members
-- 1. Allow null password_hash (guest rows have no credential until claimed).
-- 2. Add 'guest' to members.status enum.
-- 3. Add a nullable orders.member_id FK so we can attribute orders to the
--    upserted member without relying on email-only joins.

ALTER TABLE public.members ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check
    CHECK (status IN ('guest', 'pending', 'active', 'suspended', 'cancelled'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS member_id uuid
    REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_member
    ON public.orders(member_id) WHERE member_id IS NOT NULL;
