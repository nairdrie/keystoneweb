-- Drop unused site_analytics_daily table
--
-- site_analytics_daily was created in migration 020 as a pre-aggregated analytics
-- cache, but the analytics API (/api/sites/analytics) reads directly from site_visits
-- instead, and nothing in the app ever writes to this table. The daily aggregation
-- needed for billing/overage is handled by site_usage_daily (migration 027).

DROP TABLE IF EXISTS public.site_analytics_daily;
