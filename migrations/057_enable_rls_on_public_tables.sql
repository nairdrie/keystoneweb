-- 057_enable_rls_on_public_tables.sql
-- Clears Supabase linter findings:
--   • RLS Disabled in Public (10 tables)
--   • Sensitive Columns Exposed (agent_invites.token, site_transfers.token)
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is bundled in the browser, so any visitor can
-- call PostgREST directly. Without RLS, that's full read+write on every
-- "public" table. This migration closes that by adopting the same
-- ownership-based pattern already used by blog_posts, bookings, members,
-- events, menu_items, products, booking_*, shipping_zones, site_media, etc.
--
-- The service-role admin client (lib/db/supabase-admin.ts) bypasses RLS and
-- continues to handle writes that must not be user-controlled
-- (e.g. users.is_admin, user_subscriptions.visitor_limit, ai_prompt_usage).

-- 1. Enable RLS --------------------------------------------------------------

ALTER TABLE public.dns_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_purchases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_sent_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_transfers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_metadata  ENABLE ROW LEVEL SECURITY;

-- 2. template_metadata: public catalog ---------------------------------------

CREATE POLICY "Anyone can read template_metadata" ON public.template_metadata
  FOR SELECT USING (true);

-- 3. pages: public read when parent site is published; site owners manage ----

CREATE POLICY "Public can read pages for published sites" ON public.pages
  FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE is_published = true));

CREATE POLICY "Site owners manage pages" ON public.pages
  FOR ALL
  USING      (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- 4. dns_records: site owners manage -----------------------------------------

CREATE POLICY "Site owners manage dns_records" ON public.dns_records
  FOR ALL
  USING      (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- 5. domain_purchases: users manage own --------------------------------------

CREATE POLICY "Users manage own domain_purchases" ON public.domain_purchases
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. user_subscriptions: self-read ONLY; writes via admin client -------------
--    (prevents a user from raising their own visitor_limit / publish_limit /
--    storage_limit_mb / ai_multiplier via direct PostgREST.)

CREATE POLICY "Users read own user_subscriptions" ON public.user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- 7. users: self-read ONLY; writes via admin client --------------------------
--    (prevents a user from setting is_admin = true or clearing is_banned.)

CREATE POLICY "Users read own users row" ON public.users
  FOR SELECT USING (id = auth.uid());

-- 8-11. Admin-only tables: no policies for anon / authenticated --------------
--      Service role bypasses RLS and handles every access.
--      Affected: site_transfers, agent_invites, ai_prompt_usage, ops_sent_emails
