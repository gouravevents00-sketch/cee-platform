-- ─────────────────────────────────────────────────────────────
-- CEE PLATFORM — P1/P2/P3 FEATURES
-- Event Team, Artwork Tracking, Sales Leads, Event Media
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ─── 1. EVENT TEAM ───────────────────────────────────────────
-- Multi-person events: internal staff + freelancers per event
CREATE TABLE IF NOT EXISTS event_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  freelancer_name text,
  role_in_event text NOT NULL DEFAULT 'team_member',
  department text DEFAULT 'other' CHECK (department IN ('admin','design','poc','accounts','operations','other')),
  is_freelancer boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_team_select" ON event_team FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "event_team_insert" ON event_team FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "event_team_delete" ON event_team FOR DELETE USING (auth.role() = 'authenticated');

-- ─── 2. ARTWORK TASKS ────────────────────────────────────────
-- Design workflow: brief → in_progress → review → revision → approved
CREATE TABLE IF NOT EXISTS artwork_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  element_id uuid REFERENCES elements(id) ON DELETE SET NULL,
  title text NOT NULL,
  brief text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'briefed' CHECK (status IN ('briefed','in_progress','review','revision','approved')),
  file_url text,
  revision_notes text,
  revision_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE artwork_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artwork_select" ON artwork_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "artwork_insert" ON artwork_tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "artwork_update" ON artwork_tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "artwork_delete" ON artwork_tasks FOR DELETE USING (auth.role() = 'authenticated');

-- ─── 3. LEADS (SALES PIPELINE) ───────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  contact_name text,
  contact_phone text,
  contact_email text,
  event_type text,
  est_budget numeric DEFAULT 0,
  source text DEFAULT 'referral' CHECK (source IN ('referral','instagram','cold_call','expo','walk_in','repeat','other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','proposal_sent','negotiation','closed_won','closed_lost')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  follow_up_date date,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_leads_updated_at();

-- ─── 4. EVENT MEDIA ──────────────────────────────────────────
-- POC uploads on-ground photos → Social team uses for content
CREATE TABLE IF NOT EXISTS event_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  caption text,
  media_type text DEFAULT 'photo' CHECK (media_type IN ('photo','video','raw')),
  status text DEFAULT 'uploaded' CHECK (status IN ('uploaded','approved_for_social','used')),
  social_post_id uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_select" ON event_media FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "media_insert" ON event_media FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "media_update" ON event_media FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "media_delete" ON event_media FOR DELETE USING (auth.role() = 'authenticated');

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_team_event ON event_team(event_id);
CREATE INDEX IF NOT EXISTS idx_artwork_event ON artwork_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_artwork_assigned ON artwork_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_media_event ON event_media(event_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON event_media(status);
