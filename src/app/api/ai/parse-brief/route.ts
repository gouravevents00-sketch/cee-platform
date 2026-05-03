import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

async function extractTextFromFile(formData: FormData): Promise<string> {
  const file = formData.get('file') as File
  const brief = formData.get('brief') as string

  // Plain text brief (no file)
  if (!file && brief) return brief

  if (!file) throw new Error('No file provided')

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  // Excel files
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      // Convert to array of arrays for better readability
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
      text += `[Sheet: ${sheetName}]\n`
      for (const row of rows) {
        const cells = row.map((c: any) => String(c ?? '').trim()).filter(Boolean)
        if (cells.length > 0) text += cells.join(' | ') + '\n'
      }
      text += '\n'
    }
    return text
  }

  // Word files
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Plain text / other
  return buffer.toString('utf-8')
}

const BRIEF_PROMPT = (brief: string, eventName: string) => `You are a quotation assistant for Creative Era Events, a premium Indian event management company.

A client element sheet / tender document has been provided below. Extract all deliverable items and return them as a JSON array of quotation rows.

Event: ${eventName || 'Event'}

Document Content:
${brief}

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  { "_type": "section", "label": "SECTION NAME" },
  {
    "_type": "item",
    "description": "element name",
    "specs": "material, finish, specs",
    "dim_str": "width×height ft or rft or nos",
    "days": 1,
    "qty": 1,
    "rate": 0
  }
]

Rules:
- Group related items under section headers
- dim_str: use format like "20×10 ft", "15 rft", "2×2 ft" — or leave empty if not mentioned
- days: setup + event days (default 1 if not mentioned)
- qty: quantity count (default 1)
- rate: 0 (director will fill rates)
- specs: material type, finish (e.g. "Flex print", "Backlit vinyl", "3mm PVC")
- Extract ALL items mentioned: stages, backdrops, standees, LED walls, flooring, lighting, decor, branding, etc.
- If a section isn't clear, use "GENERAL" as label`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  let briefText = ''
  let eventName = ''

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    eventName = (formData.get('eventName') as string) || ''
    try {
      briefText = await extractTextFromFile(formData)
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Failed to read file' }, { status: 400 })
    }
  } else {
    const body = await req.json()
    briefText = body.brief || ''
    eventName = body.eventName || ''
  }

  if (!briefText?.trim()) return NextResponse.json({ error: 'No content found in file' }, { status: 400 })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: BRIEF_PROMPT(briefText, eventName) }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text?.trim()
    if (!text) return NextResponse.json({ error: 'No rows generated' }, { status: 500 })

    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const rows = JSON.parse(clean)
    return NextResponse.json({ rows })
  } catch {
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }
}
