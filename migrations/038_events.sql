-- 038_events.sql
-- Events table for the Events block / admin tab

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  -- Stored as ISO date (YYYY-MM-DD) for sorting and past/future filtering.
  -- For month-only events (e.g. "June 2025") the day is set to 01.
  event_date date NOT NULL,
  -- Human-readable display string: "June 2025" or "June 15, 2025"
  date_display text NOT NULL,
  image_url text,
  event_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_site_id_idx ON public.events (site_id);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON public.events (event_date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Site owners can do everything
CREATE POLICY "Site owners can manage events"
  ON public.events
  FOR ALL
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
  );

-- Public can read events from published sites
CREATE POLICY "Public can read events for published sites"
  ON public.events
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE is_published = true
    )
  );
