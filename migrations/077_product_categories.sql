-- Persistent product categories / subcategories.
--
-- Until now, product categories were inferred from distinct values on
-- products.category and products.subcategory. That meant categories with
-- no products couldn't be created or kept around. This table lets the
-- admin manage a stable list (add, rename, delete) and lets empty
-- categories show up in pickers.
--
-- A row with parent_name = NULL is a top-level category. A row with
-- parent_name set is a subcategory under that parent (matched by name).

CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    parent_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_top_unique
    ON public.product_categories (site_id, name)
    WHERE parent_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_sub_unique
    ON public.product_categories (site_id, parent_name, name)
    WHERE parent_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_site
    ON public.product_categories (site_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners manage product_categories"
    ON public.product_categories FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can read product_categories"
    ON public.product_categories FOR SELECT
    USING (true);
