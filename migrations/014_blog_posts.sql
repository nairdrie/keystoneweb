-- Migration: Blog Posts Table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text, -- HTML from TipTap rich text editor
    cover_image text,
    author text,
    tags text[] DEFAULT '{}',
    is_published boolean NOT NULL DEFAULT false,
    published_at timestamptz,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(site_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_site ON public.blog_posts(site_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(site_id, slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(site_id, is_published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_sort ON public.blog_posts(site_id, sort_order);

-- RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Site owners can do everything
CREATE POLICY "Site owners manage blog posts"
    ON public.blog_posts FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Anyone can read published posts
CREATE POLICY "Anyone can read published blog posts"
    ON public.blog_posts FOR SELECT
    USING (is_published = true);
