-- Ops kanban tickets for internal collaboration across admins and agents.

CREATE TABLE IF NOT EXISTS public.ops_tickets (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  description        text,
  status             text        NOT NULL DEFAULT 'backlog'
                                  CHECK (status IN ('backlog', 'blocked', 'todo', 'in_progress', 'review', 'testing', 'resolved')),
  priority           text        NOT NULL DEFAULT 'medium'
                                  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_user_id   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_user_id uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  sort_order         integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_tickets_status_sort
  ON public.ops_tickets(status, sort_order, updated_at DESC);

CREATE INDEX IF NOT EXISTS ops_tickets_assignee_status
  ON public.ops_tickets(assignee_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ops_tickets_updated_at
  ON public.ops_tickets(updated_at DESC);

ALTER TABLE public.ops_tickets ENABLE ROW LEVEL SECURITY;
