-- Migration: Soft-delete (archive) support for admin-managed data entities
-- Adds is_archived + archived_on columns. Admin "delete" actions flip is_archived
-- instead of hard-deleting so we can recover from accidental deletions.
-- A future job can purge rows where archived_on is older than the retention window.

DO $$
DECLARE
    target_table text;
    target_tables text[] := ARRAY[
        'products',
        'blog_posts',
        'booking_services',
        'booking_categories',
        'booking_addons',
        'menu_items',
        'events',
        'vendors',
        'shipping_zones',
        'membership_packages',
        'members',
        'booking_blocked_dates'
    ];
BEGIN
    FOREACH target_table IN ARRAY target_tables LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false',
            target_table
        );
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS archived_on timestamptz',
            target_table
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON public.%I (site_id) WHERE is_archived = false',
            'idx_' || target_table || '_active', target_table
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON public.%I (archived_on) WHERE is_archived = true',
            'idx_' || target_table || '_archived_on', target_table
        );
    END LOOP;
END $$;
