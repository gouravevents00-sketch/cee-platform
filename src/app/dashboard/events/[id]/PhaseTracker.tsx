'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PHASES } from '@/lib/types'
import { CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp, Lock } from 'lucide-react'
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
  const [completingTask, setCompletingTask] = useState<Task | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const router = useRouter()
  const supabase = createClient()
  useRealtimeRefresh(['event_tasks', 'approvals'], eventId)

  function requestDone(task: Task) {
    setCompletingTask(task)
    setCompletionNote('')
  }

  async function confirmDone() {
    if (!completingTask || !completionNote.trim()) return
    setUpdatingTask(completingTask.id)

    const { error } = await supabase
      .from('event_tasks')
      .update({
        status: 'done',
        completed_by: userId,
        completed_at: new Date().toISOString(),
        notes: completionNote.trim(),
      })
      .eq('id', completingTask.id)

    if (!error) {
      const phaseTasks = tasksByPhase[completingTask.phase] || []
      const allDone = phaseTasks.every(t => t.id === completingTask.id || t.status === 'done')
      if (allDone && completingTask.phase === currentPhase && currentPhase < 7) {
        await supabase.from('events').update({ current_phase: currentPhase + 1 }).eq('id', eventId)
        // Phase completion bonus
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_user_id: userId,
            points: 15,
            reason: `Phase ${completingTask.phase} complete — ${completingTask.phase_name}`,
            ref_type: 'phase',
            ref_id: eventId,
          }),
        })
      } else {
        // Regular task completion
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_user_id: userId,
            points: 10,
            reason: `Task done: ${completingTask.task_name}`,
            ref_type: 'task',
            ref_id: completingTask.id,
          }),
        })
      }
      router.refresh()
    }
    setUpdatingTask(null)
    setCompletingTask(null)
    setCompletionNote('')
  }

  async function updateTaskStatus(task: Task, newStatus: 'in_progress' | 'pending') {
    setUpdatingTask(task.id)
    await supabase.from('event_tasks').update({
      status: newStatus,
      completed_by: null,
      completed_at: null,
    }).eq('id', task.id)
    router.refresh()
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

      {/* Completion note modal */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <p className="text-white text-sm font-semibold">Mark as Done</p>
            <p className="text-gray-400 text-xs">{completingTask.task_name}</p>
            <textarea
              autoFocus
              rows={3}
              value={completionNote}
              onChange={e => setCompletionNote(e.target.value)}
              placeholder="What was done? Add proof or details… (required)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDone}
                disabled={!completionNote.trim() || updatingTask === completingTask.id}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
              >
                {updatingTask === completingTask.id ? 'Saving…' : 'Confirm Done'}
              </button>
              <button
                onClick={() => { setCompletingTask(null); setCompletionNote('') }}
                className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                        onClick={() => {
                          if (!canUpdate || isUpdating) return
                          if (task.status === 'done') updateTaskStatus(task, 'pending')
                          else requestDone(task)
                        }}
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
                        {/* Completion proof */}
                        {task.notes && (
                          <p className="text-gray-500 text-xs mt-1 bg-gray-800 rounded-lg px-2 py-1">
                            ✓ {task.notes}
                          </p>
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
