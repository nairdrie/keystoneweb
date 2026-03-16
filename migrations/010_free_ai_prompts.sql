-- Add free_ai_prompts_used to track lifetime AI Builder usage for unpaid users.
-- Free (unauthenticated/unpaid) users get 3 total prompts before being prompted to subscribe.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS free_ai_prompts_used integer NOT NULL DEFAULT 0;
