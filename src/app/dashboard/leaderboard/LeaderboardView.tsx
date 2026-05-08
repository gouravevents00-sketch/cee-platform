'use client'

import { useState, useEffect } from 'react'
import { Trophy, Star, Zap, Award, Target, TrendingUp, Gift, Plus, Check } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  poc: 'POC', admin: 'Admin', design: 'Design', accounts: 'Accounts',
}

const BADGE_META: Record<string, { label: string; icon: string; color: string }> = {
  first_task:         { label: 'First Step', icon: '🎯', color: 'bg-blue-900/50 text-blue-300 border-blue-800/50' },
  ten_tasks:          { label: '10 Tasks', icon: '⚡', color: 'bg-amber-900/50 text-amber-300 border-amber-800/50' },
  twenty_five_tasks:  { label: '25 Tasks', icon: '🔥', color: 'bg-orange-900/50 text-orange-300 border-orange-800/50' },
  fifty_tasks:        { label: '50 Tasks', icon: '👑', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50' },
  daily_achiever:     { label: 'Daily Achiever', icon: '⭐', color: 'bg-purple-900/50 text-purple-300 border-purple-800/50' },
}

const RANK_COLORS = [
  'text-yellow-400',   // 1st
  'text-gray-300',     // 2nd
  'text-amber-600',    // 3rd
]

const PODIUM_BG = [
  'bg-yellow-900/30 border-yellow-700/40',
  'bg-gray-800/60 border-gray-700/40',
  'bg-amber-900/20 border-amber-800/30',
]

interface Person {
  id: string
  name: string
  role: string
  points: number
  tasks_done: number
  badges: { key: string; awarded_at: string }[]
}

interface Prize {
  rank: number
  label: string
  description: string
}

interface Props {
  currentUserId: string
  isDirector: boolean
  team: { id: string; name: string; role: string }[]
}

export default function LeaderboardView({ currentUserId, isDirector, team }: Props) {
  const [period, setPeriod] = useState<'monthly' | 'alltime'>('monthly')
  const [leaderboard, setLeaderboard] = useState<Person[]>([])
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)

  // Bonus form state
  const [bonusTarget, setBonusTarget] = useState('')
  const [bonusPoints, setBonusPoints] = useState('5')
  const [bonusReason, setBonusReason] = useState('')
  const [awarding, setAwarding] = useState(false)
  const [awardSuccess, setAwardSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/points?period=${period}`)
      .then(r => r.json())
      .then(d => {
        setLeaderboard(d.leaderboard || [])
        setPrizes(d.prizes || [])
        setLoading(false)
      })
  }, [period])

  async function awardBonus() {
    if (!bonusTarget || !bonusPoints || !bonusReason.trim()) return
    setAwarding(true)
    const res = await fetch('/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_user_id: bonusTarget,
        points: parseInt(bonusPoints),
        reason: bonusReason.trim(),
        ref_type: 'bonus',
        is_bonus: true,
      }),
    })
    if (res.ok) {
      setAwardSuccess(true)
      setBonusReason('')
      setBonusTarget('')
      setTimeout(() => {
        setAwardSuccess(false)
        setLoading(true)
        fetch(`/api/points?period=${period}`)
          .then(r => r.json())
          .then(d => { setLeaderboard(d.leaderboard || []); setLoading(false) })
      }, 1500)
    }
    setAwarding(false)
  }

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const currentUserEntry = leaderboard.find(p => p.id === currentUserId)

  return (
    <div className="space-y-6">

      {/* Period tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
        {(['monthly', 'alltime'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {p === 'monthly' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <Trophy size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No points logged yet.</p>
          <p className="text-gray-600 text-xs mt-1">Complete tasks to earn points and appear on the board.</p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[top3[1], top3[0], top3[2]].map((person, visualIdx) => {
                if (!person) return <div key={visualIdx} />
                const actualRank = leaderboard.indexOf(person)
                const podiumOrder = [1, 0, 2][visualIdx] // visual: 2nd, 1st, 3rd
                const prize = prizes.find(p => p.rank === podiumOrder + 1)
                return (
                  <div
                    key={person.id}
                    className={`border rounded-2xl p-4 text-center ${PODIUM_BG[podiumOrder]} ${
                      person.id === currentUserId ? 'ring-1 ring-amber-500/50' : ''
                    }`}
                  >
                    <div className={`text-2xl font-black mb-1 ${RANK_COLORS[podiumOrder]}`}>
                      {podiumOrder === 0 ? '👑' : `#${podiumOrder + 1}`}
                    </div>
                    <p className="text-white text-sm font-semibold leading-tight">{person.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{ROLE_LABELS[person.role] || person.role}</p>
                    <p className={`text-xl font-bold mt-2 ${RANK_COLORS[podiumOrder]}`}>{person.points}</p>
                    <p className="text-gray-600 text-xs">pts</p>
                    <p className="text-gray-500 text-xs mt-1">{person.tasks_done} tasks</p>
                    {person.badges.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1 mt-2">
                        {person.badges.slice(0, 2).map(b => (
                          <span key={b.key} className="text-xs">{BADGE_META[b.key]?.icon || '🏅'}</span>
                        ))}
                      </div>
                    )}
                    {prize && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs font-semibold text-amber-400">{prize.label}</p>
                        {prize.description && <p className="text-gray-500 text-xs mt-0.5 leading-tight">{prize.description}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {rest.map((person, i) => (
                <div
                  key={person.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < rest.length - 1 ? 'border-b border-gray-800' : ''
                  } ${person.id === currentUserId ? 'bg-amber-500/5' : ''}`}
                >
                  <span className="text-gray-500 text-sm w-6 text-center font-medium">#{i + 4}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{person.name}</p>
                    <p className="text-gray-500 text-xs">{ROLE_LABELS[person.role] || person.role} · {person.tasks_done} tasks</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.badges.slice(0, 2).map(b => (
                      <span key={b.key} className="text-sm">{BADGE_META[b.key]?.icon || '🏅'}</span>
                    ))}
                    <span className="text-white font-bold text-sm">{person.points}</span>
                    <span className="text-gray-500 text-xs">pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current user's position (if not in top 3) */}
          {currentUserEntry && !top3.find(p => p?.id === currentUserId) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 text-sm font-bold">
                #{leaderboard.indexOf(currentUserEntry) + 1}
              </span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{currentUserEntry.name} (You)</p>
                <p className="text-gray-400 text-xs">{currentUserEntry.tasks_done} tasks completed</p>
              </div>
              <div>
                <span className="text-amber-400 font-bold">{currentUserEntry.points}</span>
                <span className="text-gray-500 text-xs ml-1">pts</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Prizes panel */}
      {prizes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={14} className="text-amber-400" />
            <p className="text-white text-sm font-semibold">Monthly Prizes</p>
          </div>
          <div className="space-y-2">
            {prizes.map(prize => (
              <div key={prize.rank} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{prize.rank === 1 ? '🥇' : prize.rank === 2 ? '🥈' : '🥉'}</span>
                <div>
                  <p className="text-white text-sm font-medium">{prize.label}</p>
                  {prize.description && <p className="text-gray-500 text-xs mt-0.5">{prize.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to earn points */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-amber-400" />
          <p className="text-white text-sm font-semibold">How to Earn Points</p>
        </div>
        <div className="space-y-1.5">
          {[
            { pts: '+10', label: 'Complete any task' },
            { pts: '+5', label: 'Speed bonus — task done before phase advances' },
            { pts: '+15', label: 'Complete all tasks in a phase' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5">
              <span className="text-green-400 text-xs font-bold w-8 flex-shrink-0">{item.pts}</span>
              <span className="text-gray-400 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-gray-500 text-xs font-semibold mb-1.5">Badges</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(BADGE_META).map(([key, meta]) => (
              <span key={key} className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>
                {meta.icon} {meta.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Director: Bonus Points */}
      {isDirector && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-400" />
            <p className="text-white text-sm font-semibold">Award Bonus Points</p>
          </div>
          <div className="space-y-2">
            <select
              value={bonusTarget}
              onChange={e => setBonusTarget(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Select team member…</option>
              {team.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={bonusPoints}
                onChange={e => setBonusPoints(e.target.value)}
                className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                {[5, 10, 15, 20, 25, 50].map(n => (
                  <option key={n} value={n}>+{n} pts</option>
                ))}
              </select>
              <input
                type="text"
                value={bonusReason}
                onChange={e => setBonusReason(e.target.value)}
                placeholder="Reason (e.g. Outstanding site execution)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={awardBonus}
              disabled={!bonusTarget || !bonusReason.trim() || awarding || awardSuccess}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              {awardSuccess ? (
                <><Check size={14} /> Awarded!</>
              ) : awarding ? (
                <>Awarding…</>
              ) : (
                <><Plus size={14} /> Award Points</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
