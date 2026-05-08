import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CEE_AI_KNOWLEDGE } from '@/lib/ai/cee-knowledge'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_LOOPS = 4

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOL_GET_MY_EVENTS = {
  name: 'get_my_events',
  description: 'Get the list of events assigned to or relevant for the current user. Use this when the user asks about their events, what events are coming up, or needs to pick an event.',
  input_schema: { type: 'object', properties: {}, required: [] },
}

const TOOL_GET_MY_TASKS = {
  name: 'get_my_tasks',
  description: 'Get pending tasks for the current user. Optionally filter by a specific event. Use this when the user asks "mera kaam kya hai", "kya pending hai", "aaj kya karna hai".',
  input_schema: {
    type: 'object',
    properties: {
      event_id: { type: 'string', description: 'Optional UUID of a specific event to filter tasks for' },
    },
    required: [],
  },
}

const TOOL_MARK_TASK_DONE = {
  name: 'mark_task_done',
  description: 'Mark a specific task as done. Use the task ID from get_my_tasks. Always confirm with the user before marking done unless they explicitly said to mark it.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'UUID of the task to mark as done' },
      note: { type: 'string', description: 'Optional completion note' },
    },
    required: ['task_id'],
  },
}

const TOOL_SUBMIT_EXPENSE = {
  name: 'submit_expense',
  description: 'Submit an expense entry for a POC. Use when user mentions spending money on transport, food, material, manpower for an event.',
  input_schema: {
    type: 'object',
    properties: {
      event_id: { type: 'string', description: 'UUID of the event this expense is for' },
      item: { type: 'string', description: 'Description of what was purchased' },
      amount: { type: 'number', description: 'Amount in INR' },
      category: {
        type: 'string',
        enum: ['transport', 'material', 'food', 'manpower', 'other'],
        description: 'Expense category',
      },
    },
    required: ['event_id', 'item', 'amount', 'category'],
  },
}

const TOOL_GET_EVENT_BRIEF = {
  name: 'get_event_brief',
  description: 'Get the details of a specific event — name, date, venue, current phase, client, POC, notes. Use when user asks about an event or needs context.',
  input_schema: {
    type: 'object',
    properties: {
      event_id: { type: 'string', description: 'UUID of the event' },
    },
    required: ['event_id'],
  },
}

const TOOL_GET_PENDING_EXPENSES = {
  name: 'get_pending_expenses',
  description: 'Get list of pending expense approvals. For accounts and director roles only.',
  input_schema: { type: 'object', properties: {}, required: [] },
}

const TOOL_GET_PENDING_APPROVALS = {
  name: 'get_pending_approvals',
  description: 'Get list of pending approval requests across all events. Director only.',
  input_schema: { type: 'object', properties: {}, required: [] },
}

// ─── Tools per role ──────────────────────────────────────────────────────────

function getToolsForRole(role: string) {
  const base = [TOOL_GET_MY_EVENTS, TOOL_GET_MY_TASKS, TOOL_MARK_TASK_DONE, TOOL_GET_EVENT_BRIEF]
  if (role === 'poc') return [...base, TOOL_SUBMIT_EXPENSE]
  if (role === 'accounts') return [...base, TOOL_GET_PENDING_EXPENSES]
  if (role === 'director') return [...base, TOOL_SUBMIT_EXPENSE, TOOL_GET_PENDING_EXPENSES, TOOL_GET_PENDING_APPROVALS]
  return base // admin, design
}

// ─── Tool Executors ──────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, any>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userRole: string,
): Promise<string> {
  try {
    if (name === 'get_my_events') {
      let query = supabase
        .from('events')
        .select('id, name, event_date, venue, city, status, current_phase')
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true })
        .limit(15)

      if (userRole === 'poc') query = query.eq('poc_id', userId)
      else if (userRole !== 'director') query = query.in('status', ['active', 'execution', 'completed'])

      const { data, error } = await query
      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No events found.'
      return JSON.stringify(data)
    }

    if (name === 'get_my_tasks') {
      const eventId = input.event_id as string | undefined
      let query = supabase
        .from('event_tasks')
        .select('id, task_name, phase, phase_name, status, task_type, owner_role, event_id, events(name)')
        .in('status', ['pending', 'in_progress'])
        .order('phase', { ascending: true })
        .limit(20)

      if (eventId) {
        query = query.eq('event_id', eventId)
      } else if (userRole === 'poc') {
        // RLS handles filtering to POC's events
      } else if (userRole !== 'director') {
        query = query.eq('owner_role', userRole)
      }

      const { data, error } = await query
      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No pending tasks found.'
      return JSON.stringify(data)
    }

    if (name === 'mark_task_done') {
      const { task_id, note } = input
      const updateData: Record<string, any> = {
        status: 'done',
        completed_by: userId,
        completed_at: new Date().toISOString(),
      }
      if (note) updateData.notes = note

      const { data, error } = await supabase
        .from('event_tasks')
        .update(updateData)
        .eq('id', task_id)
        .select('task_name, phase_name')
        .single()

      if (error) return `Error marking task done: ${error.message}`
      if (!data) return 'Task not found or you do not have access.'

      // Log activity
      const { data: task } = await supabase
        .from('event_tasks')
        .select('event_id')
        .eq('id', task_id)
        .single()
      if (task?.event_id) {
        await supabase.from('activity_log').insert({
          event_id: task.event_id,
          user_id: userId,
          action: 'task_completed',
          detail: `"${data.task_name}" marked done via AI`,
        })
      }
      return `Task "${data.task_name}" (${data.phase_name}) marked as done.`
    }

    if (name === 'submit_expense') {
      const { event_id, item, amount, category } = input

      // Verify POC access to this event
      const { data: eventCheck } = await supabase
        .from('events')
        .select('id, name')
        .eq('id', event_id)
        .single()
      if (!eventCheck) return 'Event not found or you do not have access to it.'

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          event_id,
          submitted_by: userId,
          item,
          amount,
          category,
          status: 'pending',
        })
        .select('id')
        .single()

      if (error) return `Error submitting expense: ${error.message}`
      return `Expense submitted: ₹${amount} for "${item}" (${category}) — pending approval. ID: ${data.id}`
    }

    if (name === 'get_event_brief') {
      const { event_id } = input
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, venue, city, type, status, current_phase, notes, clients(name), poc:profiles!events_poc_id_fkey(name)')
        .eq('id', event_id)
        .single()

      if (error) return `Error: ${error.message}`
      if (!data) return 'Event not found.'
      return JSON.stringify(data)
    }

    if (name === 'get_pending_expenses') {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, item, amount, category, submitted_at, events(name), submitter:profiles!expenses_submitted_by_fkey(name)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(10)

      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No pending expenses.'
      return JSON.stringify(data)
    }

    if (name === 'get_pending_approvals') {
      const { data, error } = await supabase
        .from('approvals')
        .select('id, type, requested_at, events(name), requester:profiles!approvals_requested_by_fkey(name)')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(10)

      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No pending approvals.'
      return JSON.stringify(data)
    }

    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Tool execution failed: ${e.message}`
  }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(userName: string, userRole: string, eventContext?: string) {
  const roleHints: Record<string, string> = {
    director: 'You can access all events, tasks, financials, expenses, and approvals.',
    poc: 'You can see your assigned events and tasks, mark tasks done, and submit expenses. You do NOT have access to costs, rates, or financials.',
    admin: 'You can see all active events and tasks, and mark tasks done. No financial access.',
    design: 'You can see events and your design tasks, and mark artwork tasks done. No financial access.',
    accounts: 'You can see events, tasks, and pending expenses for approval. Financial access is available.',
  }

  return `${CEE_AI_KNOWLEDGE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: ${userName} | Role: ${userRole}
Today: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
${eventContext ? `Current event context: ${eventContext}` : ''}

Access level: ${roleHints[userRole] || 'Standard access.'}

LANGUAGE RULE:
Match the language the team member writes in.
- If they write in English → reply in English.
- If they write in Hinglish (Hindi + English mix) → reply in Hinglish.
- Always stay professional and respectful regardless of language.
- Never switch language mid-reply.

TOOL USE RULES:
- Use tools when the question needs live data (tasks, events, expenses, status).
- After calling a tool, give a clear summary — not raw JSON.
- When marking a task done: confirm what was done.
- When submitting an expense: repeat back the details before submitting, then do it.
- If a user asks for something outside your tool set (e.g., financial data for a POC), politely tell them they don't have access.`
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { messages, event_id } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages provided' }, { status: 400 })

  // Optional: fetch event context if event_id is provided
  let eventContext: string | undefined
  if (event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('name, event_date, current_phase')
      .eq('id', event_id)
      .single()
    if (ev) eventContext = `${ev.name} | Phase ${ev.current_phase} | Date: ${ev.event_date}`
  }

  const systemPrompt = buildSystemPrompt(profile.name, profile.role, eventContext)
  const tools = getToolsForRole(profile.role)

  let currentMessages = [...messages]

  // Tool use loop
  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `AI API error: ${err}` }, { status: 500 })
    }

    const data = await res.json()

    // Done — return final text
    if (data.stop_reason === 'end_turn') {
      const reply = data.content?.find((b: any) => b.type === 'text')?.text?.trim()
      return NextResponse.json({ reply: reply || 'No response.' })
    }

    // Tool use — execute all tool calls and loop
    if (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter((b: any) => b.type === 'tool_use')

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block: any) => ({
          type: 'tool_result',
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input, supabase, user.id, profile.role),
        }))
      )

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults },
      ]
      continue
    }

    // Unexpected stop reason
    break
  }

  return NextResponse.json({ error: 'AI did not return a response.' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error.' }, { status: 500 })
  }
}
