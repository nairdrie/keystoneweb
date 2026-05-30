-- Fix: the marketing_campaigns.status CHECK constraint (from migration 048) was
-- never extended to allow the two statuses the prepay/Stripe flow introduced:
--   'awaiting_payment' — customer approved, Stripe Checkout created, awaiting pay
--   'pending_launch'   — paid, awaiting ops billing setup before going to Google
--
-- Because the constraint rejected those values, every status transition during
-- the payment flow failed silently:
--   * /approve set status='awaiting_payment'  -> rejected, campaign stuck 'draft'
--   * the Stripe webhook set status='pending_launch' after payment -> rejected,
--     campaign stuck 'draft' even though the prepay row (a separate table) saved.
-- Net effect: customers paid, the budget showed the prepay, but the campaign
-- never left Draft and never reached the ops launch queue.
--
-- This migration brings the DB constraint in line with lib/marketing/types.ts
-- (CampaignStatus) and heals campaigns that were already stranded by the bug.

-- 1. Replace the constraint with the full, current status set.
ALTER TABLE marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;

ALTER TABLE marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check CHECK (status IN (
    'draft', 'suggested', 'approved', 'awaiting_payment', 'pending_launch',
    'submitting', 'active', 'paused', 'completed', 'failed', 'cancelled'
  ));

-- 2. Heal campaigns stranded by the bug: any campaign still sitting in 'draft'
--    that already has a succeeded prepay payment was actually paid for and
--    should be in 'pending_launch' so ops can finish setup and launch it.
WITH stranded AS (
  SELECT c.id
  FROM marketing_campaigns c
  WHERE c.status = 'draft'
    AND EXISTS (
      SELECT 1 FROM marketing_campaign_payments p
      WHERE p.campaign_id = c.id
        AND p.kind = 'prepay'
        AND p.status = 'succeeded'
    )
)
UPDATE marketing_campaigns c
SET status = 'pending_launch',
    updated_at = now()
FROM stranded s
WHERE c.id = s.id;

-- 3. Leave an audit trail for the heal so the history reflects what happened.
INSERT INTO marketing_campaign_log (campaign_id, action, actor, details)
SELECT c.id,
       'pending_launch',
       'system',
       jsonb_build_object('reason', 'migration_086_status_constraint_heal')
FROM marketing_campaigns c
WHERE c.status = 'pending_launch'
  AND EXISTS (
    SELECT 1 FROM marketing_campaign_payments p
    WHERE p.campaign_id = c.id
      AND p.kind = 'prepay'
      AND p.status = 'succeeded'
  )
  AND NOT EXISTS (
    SELECT 1 FROM marketing_campaign_log l
    WHERE l.campaign_id = c.id
      AND l.action = 'pending_launch'
  );
