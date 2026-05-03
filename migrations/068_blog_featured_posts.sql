-- Migration: Featured blog posts

ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
    ON public.blog_posts(site_id, is_featured);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_one_featured_per_site
    ON public.blog_posts(site_id)
    WHERE is_featured = true;
