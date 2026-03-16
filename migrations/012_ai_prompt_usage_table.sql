-- Consolidated AI prompt usage tracking for all subscription tiers.
-- Replaces the in-memory rate limiter (which reset on server restart) and
-- extends the free-user free_ai_prompts_used column to cover Basic & Pro.
--
-- Limits enforced in app/api/ai/builder/rate-limit.ts:
--   free:  4 total prompts ever (resets if user later subscribes)
--   basic: 10/day, 20/week, 30/month
--   pro:   30/day, 50/week, 100/month
--
-- "Quota resets on upgrade" is handled by comparing used_at against
-- user_subscriptions.subscription_started_at — old usage before the
-- upgrade date is excluded from counts automatically.

CREATE TABLE public.ai_prompt_usage (
  id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_prompt_usage_user_time
  ON public.ai_prompt_usage(user_id, used_at DESC);

-- NOTE: free_ai_prompts_used in user_subscriptions is no longer written to.
-- The column is kept for historical reference but the source of truth is now
-- the ai_prompt_usage table.
