/**
 * Auto-completes matching event tasks when a system action triggers them.
 * Matches task_name using keyword search (case-insensitive).
 */
export async function autoCompleteTasks(
  supabase: any,
  eventId: string,
  userId: string,
  keywords: string[],
  note: string,
): Promise<number> {
  if (!keywords.length || !eventId) return 0

  // Fetch all pending/in_progress tasks for this event
  const { data: tasks } = await supabase
    .from('event_tasks')
    .select('id, task_name, status')
    .eq('event_id', eventId)
    .in('status', ['pending', 'in_progress'])

  if (!tasks?.length) return 0

  // Match any task whose name contains at least one keyword (case-insensitive)
  const matched = tasks.filter((t: any) =>
    keywords.some(kw => t.task_name?.toLowerCase().includes(kw.toLowerCase()))
  )

  if (!matched.length) return 0

  await supabase
    .from('event_tasks')
    .update({
      status: 'done',
      completed_by: userId,
      completed_at: new Date().toISOString(),
      notes: note,
    })
    .in('id', matched.map((t: any) => t.id))

  return matched.length
}

// ── Keyword sets per trigger ─────────────────────────────────────────────────

/** Called when event is first created from a brief/lead */
export const KEYWORDS_EVENT_CREATED = [
  'inquiry', 'enquiry', 'receive brief', 'log inquiry', 'log lead',
  'whatsapp group', 'brief team', 'team brief', 'create event', 'event created',
  'internal group', 'client group', 'lead received',
]

/** Called when quotation is sent/shared with client */
export const KEYWORDS_QUOTATION_SENT = [
  'quotation sent', 'quote sent', 'proposal sent', 'share quotation',
  'send quotation', 'quotation shared', 'send quote', 'quote shared',
  'proposal share', 'quotation email', 'send proposal',
]

/** Called when quotation is locked (client approved) */
export const KEYWORDS_QUOTATION_LOCKED = [
  'quotation approved', 'quote approved', 'client approv', 'quotation accepted',
  'quote accepted', 'proposal approved', 'quotation locked',
  'client confirmation', 'booking confirm', 'advance invoice',
  'advance raised', 'raise advance',
]

/** Called when vendor SOs are generated/sent */
export const KEYWORDS_VENDOR_SO_SENT = [
  'vendor brief', 'so sent', 'vendor so', 'purchase order',
  'vendor confirm', 'vendor finaliz', 'vendor assign',
]

/** Called when artwork/mockup is approved */
export const KEYWORDS_ARTWORK_APPROVED = [
  'artwork approv', 'mockup approv', 'design approv', 'print approv',
  'client design approv', 'artwork finaliz',
]

/** Called when event goes into execution (setup day) */
export const KEYWORDS_EXECUTION_STARTED = [
  'loading', 'transport book', 'vehicle book', 'team depart',
  'site arrival', 'setup start', 'setup begin',
]
