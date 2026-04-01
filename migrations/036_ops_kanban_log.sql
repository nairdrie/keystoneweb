-- Ops kanban audit log for ticket history across admins and agents.

CREATE TABLE IF NOT EXISTS public.ops_ticket_logs (
  id            bigserial   PRIMARY KEY,
  ticket_id     uuid        REFERENCES public.ops_tickets(id) ON DELETE SET NULL,
  ticket_name   text        NOT NULL,
  actor_user_id uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email   text,
  action        text        NOT NULL
                            CHECK (action IN ('create', 'update', 'delete')),
  field_name    text
                            CHECK (field_name IS NULL OR field_name IN ('title', 'description', 'status', 'priority', 'assignee')),
  old_value     text,
  new_value     text,
  old_label     text,
  new_label     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_ticket_logs_created_at
  ON public.ops_ticket_logs(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ops_ticket_logs_ticket_created_at
  ON public.ops_ticket_logs(ticket_id, created_at DESC, id DESC);

ALTER TABLE public.ops_ticket_logs ENABLE ROW LEVEL SECURITY;
