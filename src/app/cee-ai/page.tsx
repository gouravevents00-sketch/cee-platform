'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface FeedbackState {
  given: boolean
  helpful?: boolean
  showComment: boolean
  comment: string
  submitting: boolean
}

const STARTER_QUESTIONS = [
  'What are the most common mistakes in event day execution?',
  'How should I structure a vendor contract?',
  'What technical specs do I need for a 200-pax indoor conference?',
  'How do I handle a VIP government inauguration?',
  'What is the standard payment structure for event vendors?',
  'How do I run a product launch event professionally?',
]

export default function PublicChatPage() {
  const [passcode, setPasscode] = useState('')
  const [passcodeInput, setPasscodeInput] = useState('')
  const [passcodeError, setPasscodeError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Record<number, FeedbackState>>({})
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function submitFeedback(msgIndex: number, helpful: boolean) {
    setFeedbacks(prev => ({
      ...prev,
      [msgIndex]: { given: false, helpful, showComment: !helpful, comment: '', submitting: false },
    }))
    if (helpful) {
      // Thumbs up — submit immediately, no comment needed
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helpful: true,
          user_message: messages[msgIndex - 1]?.content,
          ai_response: messages[msgIndex]?.content,
          source: 'public',
        }),
      })
      setFeedbacks(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], given: true } }))
    }
  }

  async function submitComment(msgIndex: number) {
    const fb = feedbacks[msgIndex]
    if (!fb) return
    setFeedbacks(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], submitting: true } }))
    await fetch('/api/ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        helpful: false,
        user_message: messages[msgIndex - 1]?.content,
        ai_response: messages[msgIndex]?.content,
        comment: fb.comment,
        source: 'public',
      }),
    })
    setFeedbacks(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], given: true, submitting: false, showComment: false } }))
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function verifyPasscode() {
    if (!passcodeInput.trim()) return
    setVerifying(true)
    setPasscodeError('')

    // Test the passcode with a lightweight probe message
    const res = await fetch('/api/ai/public-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        passcode: passcodeInput.trim(),
      }),
    })

    setVerifying(false)
    if (res.status === 401) {
      setPasscodeError('Invalid access code. Please check and try again.')
      return
    }
    setPasscode(passcodeInput.trim())
  }

  async function send(text?: string) {
    const query = (text ?? input).trim()
    if ((!query && !attachedFile) || loading) return

    const displayContent = query || (attachedFile ? `📎 ${attachedFile.name}` : '')
    const newMessages: Message[] = [...messages, { role: 'user', content: displayContent }]
    setMessages(newMessages)
    setInput('')
    const fileToSend = attachedFile
    setAttachedFile(null)
    setLoading(true)

    try {
      let res: Response
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))

      if (fileToSend) {
        const formData = new FormData()
        formData.append('passcode', passcode)
        formData.append('messages', JSON.stringify(apiMessages))
        formData.append('file', fileToSend)
        res = await fetch('/api/ai/public-chat', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/ai/public-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, passcode }),
        })
      }

      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Something went wrong. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ─── Passcode Gate ─────────────────────────────────────────────────────────
  if (!passcode) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 mb-4">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">CEE AI</h1>
            <p className="text-sm text-gray-400 mt-1">Event Management Intelligence</p>
            <p className="text-xs text-gray-500 mt-1">by Creative Era Events</p>
          </div>

          {/* Passcode Form */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-sm text-gray-300 mb-4">
              This is a beta access preview. Enter your access code to continue.
            </p>
            <input
              type="text"
              value={passcodeInput}
              onChange={e => setPasscodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPasscode()}
              placeholder="Access code"
              className="w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition-colors tracking-widest"
              autoFocus
            />
            {passcodeError && (
              <p className="text-xs text-red-400 mt-2">{passcodeError}</p>
            )}
            <button
              onClick={verifyPasscode}
              disabled={!passcodeInput.trim() || verifying}
              className="w-full mt-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl py-3 transition-colors"
            >
              {verifying ? 'Verifying...' : 'Continue'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-600 mt-4">
            Beta v0.1 · Creative Era Events
          </p>
        </div>
      </div>
    )
  }

  // ─── Chat Interface ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">CEE AI</p>
          <p className="text-xs text-gray-400 leading-tight">Creative Era Events · Beta</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Beta v0.1</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="pt-6 pb-4">
            <p className="text-center text-gray-400 text-sm mb-1">
              Ask me anything about event management.
            </p>
            <p className="text-center text-gray-600 text-xs mb-6">
              Vendor contracts, technical specs, protocols, crisis handling, and more.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-xs text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl px-3 py-2.5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-gray-900 text-gray-100 rounded-bl-sm border border-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>

              {/* Feedback row — only for assistant messages, not the last one while loading */}
              {m.role === 'assistant' && !loading && (
                <div className="ml-8 mt-1">
                  {feedbacks[i]?.given ? (
                    <p className="text-xs text-gray-600">Thanks for the feedback.</p>
                  ) : feedbacks[i]?.showComment ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={feedbacks[i].comment}
                        onChange={e => setFeedbacks(prev => ({ ...prev, [i]: { ...prev[i], comment: e.target.value } }))}
                        onKeyDown={e => e.key === 'Enter' && submitComment(i)}
                        placeholder="What was wrong? (optional)"
                        className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300 placeholder-gray-600 outline-none focus:border-gray-500 w-48"
                        autoFocus
                      />
                      <button
                        onClick={() => submitComment(i)}
                        disabled={feedbacks[i].submitting}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        {feedbacks[i].submitting ? '...' : 'Send'}
                      </button>
                      <button
                        onClick={() => setFeedbacks(prev => ({ ...prev, [i]: { ...prev[i], showComment: false, given: true } }))}
                        className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => submitFeedback(i, true)}
                        className="text-gray-600 hover:text-green-400 transition-colors p-1"
                        title="Helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => submitFeedback(i, false)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1"
                        title="Not helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-800 bg-gray-950 px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {/* Attached file pill */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 text-xs bg-violet-900/40 border border-violet-700/40 text-violet-300 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {attachedFile.name}
              </span>
              <button onClick={() => setAttachedFile(null)} className="text-gray-600 hover:text-gray-400 transition-colors text-xs">✕</button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.jpg,.jpeg,.png,.webp"
              onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = '' }}
            />
            {/* Paperclip */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700 transition-colors flex-shrink-0"
              title="Attach file (PDF, Excel, Word, Image)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about event management..."
              rows={1}
              className="flex-1 bg-gray-900 text-sm text-white placeholder-gray-500 rounded-xl px-4 py-2.5 resize-none outline-none border border-gray-800 focus:border-violet-500 transition-colors max-h-28"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={() => send()}
              disabled={(!input.trim() && !attachedFile) || loading}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-700 mt-1.5">
          CEE AI may make mistakes. Verify critical information before acting on it.
        </p>
      </div>
    </div>
  )
}
