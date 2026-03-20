-- Site Edit History
-- Stores full snapshots of site config + page data on every save/publish event

CREATE TABLE IF NOT EXISTS site_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('save_draft', 'publish')),
  -- Full snapshot of site-level design_data at time of event
  site_design_data jsonb NOT NULL DEFAULT '{}',
  -- Full snapshot of all pages (array of {id, slug, title, design_data})
  pages_snapshot jsonb NOT NULL DEFAULT '[]',
  -- Site title at time of event
  site_title text,
  -- Palette key at time of event
  selected_palette text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by site, ordered by most recent first
CREATE INDEX idx_site_history_site_id_created ON site_history (site_id, created_at DESC);

-- RLS policies
ALTER TABLE site_history ENABLE ROW LEVEL SECURITY;

-- Users can only see history for their own sites
CREATE POLICY "Users can view own site history"
  ON site_history FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert history for their own sites
CREATE POLICY "Users can insert own site history"
  ON site_history FOR INSERT
  WITH CHECK (user_id = auth.uid());
