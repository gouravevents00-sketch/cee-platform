// Requires Supabase table:
// create table attendance (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references profiles(id) not null,
//   date date not null,
//   status text not null default 'present'
//     check (status in ('present','absent','wfh','half_day','leave')),
//   notes text,
//   marked_by uuid references profiles(id),
//   created_at timestamptz default now(),
//   unique(user_id, date)
// );
// alter table attendance enable row level security;
// create policy "staff manage attendance" on attendance using (true) with check (true);

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AttendanceManager from './AttendanceManager'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, id, name').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: profiles }, { data: todayRecords }] = await Promise.all([
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('attendance').select('*').eq('date', today).then(r => r.error ? { data: [] } : r),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Office Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">Mark daily team attendance</p>
      </div>
      <AttendanceManager
        allProfiles={(profiles || []) as any[]}
        initialRecords={(todayRecords || []) as any[]}
        currentUserId={user.id}
        today={today}
      />
    </div>
  )
}
