-- =============================================
-- CEE PLATFORM — PRIORITY 3 SCHEMA
-- Run in Supabase SQL Editor
-- =============================================

-- STEP 1: Enable pg_cron extension
-- Go to Supabase Dashboard → Database → Extensions → Search "pg_cron" → Enable

-- =============================================
-- EXPENSE AUTO-APPROVAL (amounts ≤ ₹500)
-- =============================================
create or replace function auto_approve_small_expenses()
returns trigger language plpgsql security definer as $$
begin
  if new.amount <= 500 then
    new.status := 'approved';
    insert into activity_log (event_id, user_id, action, detail)
    values (
      new.event_id,
      new.submitted_by,
      'Expense Auto-Approved',
      new.item || ' — ₹' || new.amount::text || ' (auto-approved, under ₹500 threshold)'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_expense_auto_approve on expenses;
create trigger trg_expense_auto_approve
before insert on expenses
for each row execute function auto_approve_small_expenses();

-- =============================================
-- PAYMENT OVERDUE AUTO-MARK + NOTIFY
-- =============================================
create or replace function mark_overdue_payments()
returns void language plpgsql security definer as $$
declare
  r record;
  notify_ids uuid[];
begin
  for r in
    select p.id, p.event_id, p.amount, p.type, e.name as event_name
    from payments p
    join events e on e.id = p.event_id
    where p.status = 'pending' and p.due_date < current_date
  loop
    update payments set status = 'overdue' where id = r.id;

    select array_agg(id) into notify_ids
    from profiles where role in ('director', 'accounts');

    if notify_ids is not null then
      insert into notifications (user_id, title, body, link)
      select
        unnest(notify_ids),
        'Payment Overdue',
        r.event_name || ' — ' || r.type || ' of ₹' || r.amount::text || ' is now overdue',
        '/dashboard/events/' || r.event_id || '/payments';
    end if;

    insert into activity_log (event_id, user_id, action, detail)
    values (r.event_id, null, 'Payment Marked Overdue',
            'Auto: ' || r.type || ' of ₹' || r.amount::text || ' overdue');
  end loop;
end;
$$;

-- =============================================
-- CRON JOB: Daily at 9am IST (3:30 UTC)
-- Run ONLY after enabling pg_cron extension
-- =============================================
-- select cron.schedule('mark-overdue-payments', '30 3 * * *', 'select mark_overdue_payments()');

-- To manually test the function:
-- select mark_overdue_payments();

-- =============================================
-- APP SETTINGS (for configurable thresholds)
-- =============================================
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
create policy "Directors manage settings" on app_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'director')
);
create policy "All can read settings" on app_settings for select using (true);

-- Default settings
insert into app_settings (key, value) values
  ('expense_auto_approve_limit', '500'),
  ('payment_reminder_days_before', '3')
on conflict (key) do nothing;
