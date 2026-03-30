-- Store which service variant/option the customer selected at booking time,
-- plus the total price they were quoted (option may be addon or override).
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS selected_option_name text DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS total_price_cents integer DEFAULT NULL;
