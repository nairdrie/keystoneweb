-- 007_stripe_connect.sql
-- Add stripe_account_id to sites table for Stripe Connect

ALTER TABLE sites ADD COLUMN stripe_account_id text;
