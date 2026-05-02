import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: tasks },
    { data: payments },
    { data: vendorPayments },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('event_tasks').select('status, phase_name, task_name').eq('event_id', id),
    supabase.from('payments').select('amount, status').eq('event_id', id),
    supabase.from('vendor_payments').select('amount, status').eq('event_id', id),
    supabase.from('expenses').select('amount, status').eq('event_id', id).eq('status', 'pending'),
  ])

  const totalTasks = tasks?.length || 0
  const doneTasks = tasks?.filter(t => t.status === 'done').length || 0
  const pendingTasks = tasks?.filter(t => t.status !== 'done') || []

  const totalPayments = payments?.length || 0
  const receivedPayments = payments?.filter(p => p.status === 'received').length || 0
  const outstandingAmount = (payments || [])
    .filter(p => p.status !== 'received')
    .reduce((s, p) => s + p.amount, 0)

  const totalVendors = vendorPayments?.length || 0
  const paidVendors = vendorPayments?.filter(p => p.status === 'paid').length || 0
  const vendorDueAmount = (vendorPayments || [])
    .filter(p => p.status !== 'paid')
    .reduce((s, p) => s + p.amount, 0)

  const pendingExpenseCount = expenses?.length || 0

  const checks = [
    {
      id: 'tasks',
      label: 'All tasks completed',
      passed: doneTasks === totalTasks && totalTasks > 0,
      detail: `${doneTasks}/${totalTasks} tasks done`,
      blocking: pendingTasks.filter(t => t.phase_name === 'Close').length > 0,
      pendingItems: pendingTasks.slice(0, 5).map(t => t.task_name),
    },
    {
      id: 'payments',
      label: 'All client payments received',
      passed: receivedPayments === totalPayments && totalPayments > 0,
      detail: totalPayments === 0 ? 'No payments tracked' : `${receivedPayments}/${totalPayments} received`,
      blocking: outstandingAmount > 0,
      outstandingAmount,
    },
    {
      id: 'vendors',
      label: 'All vendor payments settled',
      passed: paidVendors === totalVendors || totalVendors === 0,
      detail: totalVendors === 0 ? 'No vendor payments tracked' : `${paidVendors}/${totalVendors} paid`,
      blocking: false,
      vendorDueAmount,
    },
    {
      id: 'expenses',
      label: 'No pending expense approvals',
      passed: pendingExpenseCount === 0,
      detail: pendingExpenseCount === 0 ? 'All clear' : `${pendingExpenseCount} expense(s) awaiting approval`,
      blocking: false,
    },
  ]

  const allClear = checks.every(c => c.passed)
  const hasBlockers = checks.some(c => c.blocking && !c.passed)

  return NextResponse.json({ checks, allClear, hasBlockers })
}
