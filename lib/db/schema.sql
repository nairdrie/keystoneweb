-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.dns_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  record_type character varying NOT NULL CHECK (record_type::text = ANY (ARRAY['A'::character varying, 'AAAA'::character varying, 'CNAME'::character varying, 'MX'::character varying, 'TXT'::character varying]::text[])),
  name character varying NOT NULL,
  value text NOT NULL,
  ttl integer DEFAULT 3600,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dns_records_pkey PRIMARY KEY (id),
  CONSTRAINT dns_records_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);
CREATE TABLE public.pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  display_name text NOT NULL DEFAULT 'Untitled'::text,
  is_visible_in_nav boolean DEFAULT true,
  nav_order integer DEFAULT 0,
  design_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published_data jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT pages_pkey PRIMARY KEY (id),
  CONSTRAINT pages_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid CHECK (user_id IS NULL OR user_id IS NOT NULL),
  selected_template_id character varying NOT NULL,
  business_type character varying NOT NULL CHECK (business_type::text = ANY (ARRAY['services'::character varying, 'products'::character varying, 'both'::character varying]::text[])),
  category character varying NOT NULL,
  site_slug character varying UNIQUE,
  custom_domain character varying UNIQUE,
  design_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  published_at timestamp with time zone,
  deleted_at timestamp with time zone,
  published_domain text,
  is_published boolean DEFAULT false,
  published_data jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT sites_pkey PRIMARY KEY (id),
  CONSTRAINT sites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.template_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  category character varying,
  business_type character varying,
  palettes jsonb DEFAULT '{"default": {"bg": "#ffffff", "text": "#1f2937", "accent": "#06b6d4", "primary": "#dc2626", "secondary": "#1e40af"}}'::jsonb,
  customizables jsonb DEFAULT '{"cta": ["title", "button_text"], "hero": ["title", "subtitle", "cta"], "features": ["title", "description"]}'::jsonb,
  thumbnail_url character varying,
  multi_page boolean DEFAULT false,
  has_blog boolean DEFAULT false,
  has_gallery boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT template_metadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_subscriptions (
  user_id uuid NOT NULL,
  stripe_customer_id text UNIQUE,
  subscription_status text DEFAULT 'inactive'::text,
  subscription_plan text,
  stripe_subscription_id text UNIQUE,
  subscription_started_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email character varying NOT NULL UNIQUE,
  business_name character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);