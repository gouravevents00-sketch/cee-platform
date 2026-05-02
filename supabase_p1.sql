-- =============================================
-- CEE PLATFORM — PRIORITY 1 SCHEMA
-- Run in Supabase SQL Editor
-- =============================================

-- QUOTATIONS (per event, director creates, client accepts/rejects)
create table if not exists quotations (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  quote_number text,
  items jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  gst_percent numeric default 18,
  gst_amount numeric default 0,
  total numeric default 0,
  validity_days integer default 7,
  notes text,
  status text default 'draft' check (status in ('draft','sent','accepted','rejected')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table quotations enable row level security;
create policy "Directors manage quotations" on quotations for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "Accounts see quotations" on quotations for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'accounts')
);
