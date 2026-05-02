-- Migration 070: add the missing SELECT policy for user_addons
--
-- Migration 040 enabled RLS on user_addons but never defined a SELECT policy.
-- Result: GET /api/user/addons (which uses the user-scoped Supabase client)
-- returns an empty array even when ops has approved an add-on, so the
-- "Accept & Pay" UI on /settings never renders. Service-role callers still
-- worked (RLS is bypassed there) which is why the ops panel saw data fine.
--
-- We grant users SELECT on their own rows. Writes remain admin-only — those
-- still go through the service-role admin client in the ops + activate
-- routes, so a user can't directly mutate their own add-ons by editing
-- requests.

DROP POLICY IF EXISTS "Users can read own add-ons" ON public.user_addons;
CREATE POLICY "Users can read own add-ons"
  ON public.user_addons FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on user_addons" ON public.user_addons;
CREATE POLICY "Service role full access on user_addons"
  ON public.user_addons FOR ALL
  USING (auth.role() = 'service_role');
