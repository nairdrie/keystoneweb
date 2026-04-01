-- Add priority_rank as a real generated stored column so it can be used
-- in ORDER BY without PostgREST computed column tricks.

ALTER TABLE public.ops_tickets
  ADD COLUMN IF NOT EXISTS priority_rank integer GENERATED ALWAYS AS (
    CASE priority
      WHEN 'urgent' THEN 0
      WHEN 'high'   THEN 1
      WHEN 'medium' THEN 2
      ELSE               3
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS ops_tickets_status_priority_rank
  ON public.ops_tickets(status, priority_rank, sort_order);
