-- =============================================
-- CEE PLATFORM — FULL DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Clean slate: drop existing tables if any
drop table if exists activity_log cascade;
drop table if exists payments cascade;
drop table if exists expenses cascade;
drop table if exists elements cascade;
drop table if exists approvals cascade;
drop table if exists event_tasks cascade;
drop table if exists events cascade;
drop table if exists vendors cascade;
drop table if exists clients cascade;
drop table if exists profiles cascade;

-- TEAM PROFILES (linked to Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('director', 'admin', 'design', 'poc', 'accounts')),
  email text not null,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read all profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- CLIENTS
create table clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('agency', 'corporate', 'government', 'individual')),
  contact_name text,
  contact_phone text,
  contact_email text,
  credit_period_days integer default 30,
  advance_percent integer default 50,
  work_order_number text,
  notes text,
  created_at timestamptz default now()
);
alter table clients enable row level security;
create policy "Directors and accounts see clients" on clients for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('director','accounts','admin'))
);

-- VENDORS
create table vendors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text,
  contact_name text,
  contact_phone text,
  reliability_score integer default 3 check (reliability_score between 1 and 5),
  notes text,
  created_at timestamptz default now()
);
alter table vendors enable row level security;
create policy "Directors see vendors" on vendors for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('director','accounts'))
);

-- EVENTS (core table)
create table events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client_id uuid references clients(id),
  event_date date,
  venue text,
  city text,
  type text,
  status text default 'enquiry' check (status in ('enquiry','active','execution','completed','cancelled')),
  current_phase integer default 0,
  poc_id uuid references profiles(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Directors see all events" on events for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Admin/Design/Accounts see all events" on events for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','design','accounts'))
);
create policy "POC sees assigned events" on events for select using (
  poc_id = auth.uid()
);

-- EVENT TASKS (8 phases x 30 tasks — progress tracking)
create table event_tasks (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  phase integer not null,
  phase_name text not null,
  task_number text not null,
  task_name text not null,
  task_type text not null check (task_type in ('action','approval','followup')),
  owner_role text,
  status text default 'pending' check (status in ('pending','in_progress','done','blocked')),
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
alter table event_tasks enable row level security;
create policy "Directors manage all tasks" on event_tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Team reads their event tasks" on event_tasks for select using (
  exists (
    select 1 from events e
    join profiles p on p.id = auth.uid()
    where e.id = event_id and (
      p.role in ('admin','design','accounts') or e.poc_id = auth.uid()
    )
  )
);
create policy "Team updates assigned tasks" on event_tasks for update using (
  exists (
    select 1 from events e
    join profiles p on p.id = auth.uid()
    where e.id = event_id and (
      p.role in ('admin','design','accounts') or e.poc_id = auth.uid()
    )
  )
);

-- APPROVALS (formal approval records)
create table approvals (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  task_id uuid references event_tasks(id),
  type text not null,
  requested_by uuid references profiles(id),
  requested_at timestamptz default now(),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  comment text,
  attachment_url text
);
alter table approvals enable row level security;
create policy "Directors manage approvals" on approvals for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Team reads approvals for their events" on approvals for select using (
  exists (
    select 1 from events e
    join profiles p on p.id = auth.uid()
    where e.id = event_id and (
      p.role in ('admin','design','accounts') or e.poc_id = auth.uid()
    )
  )
);
create policy "Team creates approval requests" on approvals for insert with check (
  exists (
    select 1 from events e
    join profiles p on p.id = auth.uid()
    where e.id = event_id and (
      p.role in ('admin','design','accounts','poc') or e.poc_id = auth.uid()
    )
  )
);

-- ELEMENT SHEET (per event deliverables)
create table elements (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  specs text,
  quantity integer default 1,
  material text,
  size text,
  vendor_id uuid references vendors(id),
  vendor_rate numeric,
  client_rate numeric,
  margin numeric generated always as (
    case when vendor_rate is not null and client_rate is not null
    then client_rate - vendor_rate else null end
  ) stored,
  status text default 'pending' check (status in ('pending','approved','additional','cancelled')),
  poc_owner text,
  notes text,
  created_at timestamptz default now()
);
alter table elements enable row level security;
create policy "Directors see all elements" on elements for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Accounts see rates" on elements for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'accounts')
);
create policy "Design and POC see elements without rates" on elements for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('design','admin'))
  or exists (select 1 from events e where e.id = event_id and e.poc_id = auth.uid())
);

-- EXPENSES (POC field expenses)
create table expenses (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  submitted_by uuid references profiles(id),
  item text not null,
  amount numeric not null,
  category text check (category in ('transport','material','food','manpower','other')),
  bill_url text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz default now()
);
alter table expenses enable row level security;
create policy "Directors manage expenses" on expenses for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Accounts see all expenses" on expenses for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'accounts')
);
create policy "POC submits and sees own expenses" on expenses for all using (
  submitted_by = auth.uid()
  or exists (select 1 from events e where e.id = event_id and e.poc_id = auth.uid())
);

-- PAYMENTS (client payments)
create table payments (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  type text check (type in ('advance','milestone','final')),
  amount numeric not null,
  due_date date,
  received_date date,
  status text default 'pending' check (status in ('pending','received','overdue')),
  notes text,
  created_at timestamptz default now()
);
alter table payments enable row level security;
create policy "Directors and accounts manage payments" on payments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('director','accounts'))
);

-- ACTIVITY LOG (audit trail)
create table activity_log (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,
  detail text,
  created_at timestamptz default now()
);
alter table activity_log enable row level security;
create policy "Directors see all activity" on activity_log for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Team sees their event activity" on activity_log for select using (
  exists (
    select 1 from events e
    join profiles p on p.id = auth.uid()
    where e.id = event_id and (
      p.role in ('admin','design','accounts') or e.poc_id = auth.uid()
    )
  )
);

-- =============================================
-- FUNCTION: Auto-create 30 tasks when event is created
-- =============================================
create or replace function create_event_tasks(p_event_id uuid)
returns void language plpgsql as $$
begin
  insert into event_tasks (event_id, phase, phase_name, task_number, task_name, task_type, owner_role) values
  -- Phase 0: ENQUIRY
  (p_event_id, 0, 'Enquiry', '0.1', 'Enquiry logged (source, client, event type, date, budget)', 'action', 'director'),
  (p_event_id, 0, 'Enquiry', '0.2', 'Quote / Proposal sent to client', 'action', 'director'),
  (p_event_id, 0, 'Enquiry', '0.3', 'Client confirmed — event officially created', 'approval', 'director'),
  -- Phase 1: ONBOARD
  (p_event_id, 1, 'Onboard', '1.1', 'Event created (name, date, venue, POC assigned)', 'action', 'director'),
  (p_event_id, 1, 'Onboard', '1.2', 'Internal team briefing complete', 'action', 'director'),
  -- Phase 2: PLAN & COST
  (p_event_id, 2, 'Plan & Cost', '2.1', 'Pre-CC + vendor finalization locked', 'action', 'director'),
  (p_event_id, 2, 'Plan & Cost', '2.2', 'Vendor SOs prepared and sent', 'action', 'director'),
  (p_event_id, 2, 'Plan & Cost', '2.3', 'Element sheet drafted and shared with client', 'action', 'director'),
  (p_event_id, 2, 'Plan & Cost', '2.4', 'Client approved element sheet', 'approval', 'director'),
  (p_event_id, 2, 'Plan & Cost', '2.5', 'Agreement / scope confirmation signed by client', 'approval', 'director'),
  (p_event_id, 2, 'Plan & Cost', '2.6', 'Advance invoice sent to client', 'action', 'accounts'),
  (p_event_id, 2, 'Plan & Cost', '2.7', 'Advance received from client', 'followup', 'accounts'),
  -- Phase 3: RECCE & LAYOUT
  (p_event_id, 3, 'Recce & Layout', '3.1', 'Venue recce done — photos and dimensions shared', 'action', 'poc'),
  (p_event_id, 3, 'Recce & Layout', '3.2', 'Layout mockups created by design team', 'action', 'design'),
  (p_event_id, 3, 'Recce & Layout', '3.3', 'Client approved layout — element sheet locked', 'approval', 'director'),
  -- Phase 4: OPERATIONS
  (p_event_id, 4, 'Operations', '4.1', 'Advance released to vendors (after client advance received)', 'action', 'accounts'),
  (p_event_id, 4, 'Operations', '4.2', 'Logistics booked — tickets, hotels, kits dispatched', 'action', 'admin'),
  (p_event_id, 4, 'Operations', '4.3', 'Material purchase started — invoices being logged', 'action', 'poc'),
  (p_event_id, 4, 'Operations', '4.4', 'Vendor briefing done + workshop check complete', 'action', 'director'),
  -- Phase 5: ARTWORK & PRINT
  (p_event_id, 5, 'Artwork & Print', '5.1', 'Artwork and mockups created by design team', 'action', 'design'),
  (p_event_id, 5, 'Artwork & Print', '5.2', 'Client approved all mockups and creatives', 'approval', 'director'),
  (p_event_id, 5, 'Artwork & Print', '5.3', 'Print files (CDR) shared with printer', 'action', 'design'),
  (p_event_id, 5, 'Artwork & Print', '5.4', 'Printer JPGs reviewed — print approved', 'approval', 'director'),
  -- Phase 6: EXECUTION
  (p_event_id, 6, 'Execution', '6.1', 'Team and vendors dispatched — live tracking active', 'action', 'poc'),
  (p_event_id, 6, 'Execution', '6.2', 'Setup progress updates shared every 30–40 min', 'action', 'poc'),
  (p_event_id, 6, 'Execution', '6.3', 'Additional elements approved (Gourav → Client)', 'approval', 'director'),
  (p_event_id, 6, 'Execution', '6.4', 'Setup complete — GPS photos of every element taken', 'action', 'poc'),
  (p_event_id, 6, 'Execution', '6.5', 'Event photos, videos, client feedback video captured', 'action', 'poc'),
  -- Phase 7: CLOSE
  (p_event_id, 7, 'Close', '7.1', 'Media collected — Google Drive link shared', 'action', 'admin'),
  (p_event_id, 7, 'Close', '7.2', 'Highlight reel and event poster created', 'action', 'design'),
  (p_event_id, 7, 'Close', '7.3', 'Social media content approved by directors — posted', 'approval', 'admin'),
  (p_event_id, 7, 'Close', '7.4', 'Final invoice sent to client', 'action', 'accounts'),
  (p_event_id, 7, 'Close', '7.5', 'Client final payment received', 'followup', 'accounts'),
  (p_event_id, 7, 'Close', '7.6', 'Final vendor payments released', 'action', 'accounts'),
  (p_event_id, 7, 'Close', '7.7', 'Final documents shared (element sheet, bills, photos)', 'action', 'poc'),
  (p_event_id, 7, 'Close', '7.8', 'Equipment stored and kits refilled', 'action', 'admin'),
  (p_event_id, 7, 'Close', '7.9', 'Google Review request sent to client', 'followup', 'admin'),
  (p_event_id, 7, 'Close', '7.10', 'Post-event review meeting done — archived', 'action', 'director');
end;
$$;

-- =============================================
-- VENDOR PAYMENTS (run this separately if schema already applied)
-- =============================================
create table if not exists vendor_payments (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  vendor_id uuid references vendors(id),
  amount numeric not null,
  due_date date,
  paid_date date,
  status text default 'pending' check (status in ('pending','paid','overdue')),
  notes text,
  created_at timestamptz default now()
);
alter table vendor_payments enable row level security;
create policy "Directors and accounts manage vendor payments" on vendor_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('director','accounts'))
);

-- =============================================
-- NOTIFICATIONS TABLE (run separately)
-- =============================================
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "Users see own notifications" on notifications for all using (user_id = auth.uid());

-- =============================================
-- SOCIAL MEDIA POSTS (run separately)
-- =============================================
create table if not exists social_posts (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete set null,
  platform text not null check (platform in ('instagram','youtube','whatsapp','linkedin','other')),
  content_type text check (content_type in ('reel','post','story','video','other')),
  caption text,
  scheduled_date date,
  status text default 'draft' check (status in ('draft','pending_approval','approved','posted')),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  file_url text,
  notes text,
  created_at timestamptz default now()
);
alter table social_posts enable row level security;
create policy "Directors manage all social posts" on social_posts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Admin and design see social posts" on social_posts for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','design'))
);
create policy "Admin and design create posts" on social_posts for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','design'))
);
create policy "Admin and design update own posts" on social_posts for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','design'))
);
