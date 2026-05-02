-- =============================================
-- CEE PLATFORM — PRIORITY 2 SCHEMA
-- Run in Supabase SQL Editor
-- =============================================

-- EVENT TEMPLATES (save recurring event structures for reuse)
create table if not exists event_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  event_type text,
  venue text,
  city text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table event_templates enable row level security;
create policy "Directors manage templates" on event_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
