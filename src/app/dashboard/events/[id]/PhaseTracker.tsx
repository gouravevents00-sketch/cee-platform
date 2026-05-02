'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PHASES } from '@/lib/types'
import { CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp, Lock, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

interface Task {
  id: string
  phase: number
  phase_name: string
  task_number: string
  task_name: string
  task_type: 'action' | 'approval' | 'followup'
  owner_role: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  notes?: string
}

interface Props {
  eventId: string
  tasksByPhase: Record<number, Task[]>
  currentPhase: number
  userRole: string
  userId: string
  isDirector: boolean
}

function TaskNoteInput({ taskId, currentNote }: { taskId: string, currentNote?: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(currentNote || '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function saveNote() {
    setSaving(true)
    await supabase.from('event_tasks').update({ notes: note || null }).eq('id', taskId)
    setOpen(false)
    router.refresh()
    setSaving(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mt-1">
        <MessageSquare size={11} /> {currentNote ? 'Edit note' : 'Add note'}
      </button>
    )
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        autoFocus
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && saveNote()}
        placeholder="Add a note..."
        className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
      />
      <button onClick={saveNote} disabled={saving} className="text-xs bg-amber-500 text-black font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
        {saving ? '...' : 'Save'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-white px-2">✕</button>
    </div>
  )
}

const TASK_TYPE_BADGE = {
  action: 'bg-gray-800 text-gray-400',
  approval: 'bg-amber-900/60 text-amber-400',
  followup: 'bg-blue-900/60 text-blue-400',
}

const TASK_TYPE_LABEL = {
  action: 'Task',
  approval: 'Approval',
  followup: 'Follow-up',
}

export default function PhaseTracker({ eventId, tasksByPhase, currentPhase, userRole, userId, isDirector }: Props) {
  const [expandedPhase, setExpandedPhase] = useState<number>(currentPhase)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  useRealtimeRefresh(['event_tasks', 'approvals'], eventId)

  async function updateTaskStatus(task: Task, newStatus: 'in_progress' | 'done' | 'pending') {
    setUpdatingTask(task.id)

    const { error } = await supabase
      .from('event_tasks')
      .update({
        status: newStatus,
        completed_by: newStatus === 'done' ? userId : null,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', task.id)

    if (!error) {
      // Check if all tasks in current phase are done — advance phase
      if (newStatus === 'done') {
        const phaseTasks = tasksByPhase[task.phase] || []
        const allDone = phaseTasks.every(t => t.id === task.id || t.status === 'done')
        if (allDone && task.phase === currentPhase && currentPhase < 7) {
          await supabase.from('events').update({ current_phase: currentPhase + 1 }).eq('id', eventId)
        }
      }
      router.refresh()
    }
    setUpdatingTask(null)
  }

  function canUpdateTask(task: Task): boolean {
    if (isDirector) return true
    if (task.owner_role === userRole) return true
    if (task.owner_role === 'poc' && userRole === 'poc') return true
    return false
  }

  return (
    <div className="space-y-2">
      {PHASES.map(phase => {
        const phaseTasks = tasksByPhase[phase.number] || []
        const doneTasks = phaseTasks.filter(t => t.status === 'done').length
        const isCurrentPhase = phase.number === currentPhase
        const isExpanded = expandedPhase === phase.number
        const isLocked = phase.number > currentPhase
        const phaseComplete = phaseTasks.length > 0 && doneTasks === phaseTasks.length

        return (
          <div
            key={phase.number}
            className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
              isCurrentPhase ? 'border-amber-700/50' : phaseComplete ? 'border-green-900/50' : 'border-gray-800'
            }`}
          >
            {/* Phase Header */}
            <button
              onClick={() => setExpandedPhase(isExpanded ? -1 : phase.number)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Phase Status Icon */}
                {phaseComplete ? (
                  <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                ) : isLocked ? (
                  <Lock size={16} className="text-gray-600 flex-shrink-0" />
                ) : isCurrentPhase ? (
                  <Clock size={18} className="text-amber-400 flex-shrink-0" />
                ) : (
                  <Circle size={18} className="text-gray-600 flex-shrink-0" />
                )}

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Phase {phase.number}</span>
                    {isCurrentPhase && (
                      <span className="text-xs bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-semibold">Current</span>
                    )}
                  </div>
                  <p className={`text-sm font-semibold ${phaseComplete ? 'text-green-400' : isLocked ? 'text-gray-600' : 'text-white'}`}>
                    {phase.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {phaseTasks.length > 0 && (
                  <span className={`text-xs px-2.5 py-1 rounded-full ${phaseComplete ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    {doneTasks}/{phaseTasks.length} done
                  </span>
                )}
                {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              </div>
            </button>

            {/* Tasks */}
            {isExpanded && phaseTasks.length > 0 && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3">
                {phaseTasks.map(task => {
                  const canUpdate = canUpdateTask(task)
                  const isUpdating = updatingTask === task.id

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        task.status === 'done' ? 'bg-gray-800/40' : 'bg-gray-800/70'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => canUpdate && !isUpdating && updateTaskStatus(
                          task,
                          task.status === 'done' ? 'pending' : 'done'
                        )}
                        disabled={!canUpdate || isUpdating}
                        className={`mt-0.5 flex-shrink-0 transition-colors ${canUpdate ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                      >
                        {isUpdating ? (
                          <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                        ) : task.status === 'done' ? (
                          <CheckCircle2 size={20} className="text-green-400" />
                        ) : task.status === 'in_progress' ? (
                          <Clock size={20} className="text-amber-400" />
                        ) : task.status === 'blocked' ? (
                          <AlertCircle size={20} className="text-red-400" />
                        ) : (
                          <Circle size={20} className="text-gray-600" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-white'}`}>
                            <span className="text-gray-600 text-xs mr-1">{task.task_number}</span>
                            {task.task_name}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${TASK_TYPE_BADGE[task.task_type]}`}>
                            {TASK_TYPE_LABEL[task.task_type]}
                          </span>
                        </div>

                        {/* Owner role + actions */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-gray-600 text-xs capitalize">{task.owner_role}</span>
                          {canUpdate && task.status !== 'done' && (
                            <button
                              onClick={() => !isUpdating && updateTaskStatus(task, task.status === 'in_progress' ? 'pending' : 'in_progress')}
                              className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                            >
                              {task.status === 'in_progress' ? '• In Progress' : '→ Mark as In Progress'}
                            </button>
                          )}
                        </div>
                        {/* Task Note */}
                        {task.notes && (
                          <p className="text-gray-500 text-xs mt-1 bg-gray-800 rounded-lg px-2 py-1">{task.notes}</p>
                        )}
                        {canUpdate && (
                          <TaskNoteInput taskId={task.id} currentNote={task.notes} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
