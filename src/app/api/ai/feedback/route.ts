import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role to bypass RLS — feedback table has no user auth
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
  Run this in Supabase SQL editor once:

  create table if not exists ai_feedback (
    id uuid default gen_random_uuid() primary key,
    source text not null default 'public',   -- 'public' | 'internal'
    helpful boolean not null,
    user_message text,
    ai_response text,
    comment text,
    created_at timestamptz default now()
  );
*/

export async function POST(req: Request) {
  try {
    const { helpful, user_message, ai_response, comment, source } = await req.json()

    if (typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    await supabaseAdmin.from('ai_feedback').insert({
      source: source || 'public',
      helpful,
      user_message: user_message?.slice(0, 500),
      ai_response: ai_response?.slice(0, 1000),
      comment: comment?.slice(0, 300) || null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
