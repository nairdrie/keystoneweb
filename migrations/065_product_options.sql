-- Add `options` to products: required selections that modify price.
--
-- Unlike `variants` (size/colour, same-price), an option is a required
-- choice with a default whose values can adjust the line price by a
-- non-negative `priceModifierCents`. Example:
--   [{
--     "name": "Quantity",
--     "values": [
--       {"label": "Single", "priceModifierCents": 0},
--       {"label": "Case of 24", "priceModifierCents": 2000}
--     ],
--     "defaultIndex": 0
--   }]

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;
