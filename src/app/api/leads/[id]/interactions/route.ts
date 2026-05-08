import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/*
  Run once in Supabase SQL editor:

  create table if not exists lead_interactions (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid references leads(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete set null,
    type text not null check (type in ('call','email','whatsapp','meeting','proposal','note')),
    note text not null,
    created_at timestamptz default now()
  );
  alter table lead_interactions enable row level security;
  create policy "Authenticated users manage interactions" on lead_interactions
    for all using (auth.role() = 'authenticated');
*/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_interactions')
    .select('id, type, note, created_at, logger:profiles!lead_interactions_user_id_fkey(name)')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, note } = await req.json()
  if (!type || !note?.trim()) {
    return NextResponse.json({ error: 'type and note are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lead_interactions')
    .insert({ lead_id: id, user_id: user.id, type, note: note.trim() })
    .select('id, type, note, created_at, logger:profiles!lead_interactions_user_id_fkey(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
