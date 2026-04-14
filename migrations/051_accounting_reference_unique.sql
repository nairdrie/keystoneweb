-- Add unique partial index on reference_id so auto-synced accounting entries
-- (from stripe_transactions) are deduplicated on webhook retries.
-- NULL reference_id values (manual entries) are not constrained.

CREATE UNIQUE INDEX IF NOT EXISTS accounting_entries_reference_id_unique
  ON public.accounting_entries(reference_id)
  WHERE reference_id IS NOT NULL;
