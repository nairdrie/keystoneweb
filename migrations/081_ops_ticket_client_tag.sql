-- Add a per-ticket client tag so ops tickets can be associated with a client.

ALTER TABLE public.ops_tickets
  ADD COLUMN IF NOT EXISTS client_tag text;

CREATE INDEX IF NOT EXISTS ops_tickets_client_tag
  ON public.ops_tickets(client_tag);

-- Extend the ticket log field check to include the new 'client' field.
ALTER TABLE public.ops_ticket_logs
  DROP CONSTRAINT IF EXISTS ops_ticket_logs_field_name_check;

ALTER TABLE public.ops_ticket_logs
  ADD CONSTRAINT ops_ticket_logs_field_name_check
  CHECK (
    field_name IS NULL
    OR field_name IN ('title', 'description', 'status', 'priority', 'assignee', 'client')
  );
