-- Optional external URL for products. When set, clicking the product in a
-- product catalogue block opens this URL in a new tab instead of the built-in
-- /product/{id} detail page, and the detail page itself redirects to it.
-- Used for products that are actually fulfilled / sold on a third-party site
-- (e.g. an existing Shopify store, Amazon listing, manufacturer site, or an
-- affiliate link where the merchant earns a commission).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_url text;
