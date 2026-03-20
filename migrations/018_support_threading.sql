-- Support request threading: group replies into conversations
-- Run in Supabase SQL editor

-- thread_id points to the root support request in a conversation.
-- NULL = this IS the root message.  Non-null = this is a reply.
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_requests_thread_id
  ON public.support_requests(thread_id)
  WHERE thread_id IS NOT NULL;
