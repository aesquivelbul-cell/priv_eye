'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Monitor, Moon, Coffee, Activity, AlertTriangle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserMetrics {
  avgScreenTime: number
  avgSleepHours: number
  avgBreaks: number
  symptomBurden: number
  riskPercentage: number
  eyeStrain: number
  headaches: number
  blurryVision: number
  dryEyes: number
  logCount: number
}

interface UserRow {
  userId: string
  email: string
  displayName: string | null
  totalLogs: number
  firstLogDate: string
  latestLogDate: string
  latestRiskLevel: string
  status: 'Improved' | 'No Change' | 'Worsened'
  before: UserMetrics
  recent: UserMetrics
  deltas: {
    screenTime: number
    sleepHours: number
    breaks: number
    symptomBurden: number
    riskPercentage: number
    eyeStrain: number
    headaches: number
    blurryVision: number
    dryEyes: number
  }
}

interface Summary {
  total: number
  improved: number
  worsened: number
  noChange: number
  improvedPct: number
  worsenedPct: number
  avgRiskDelta: number
  avgScreenDelta: number
  avgSleepDelta: number
  avgSymptomDelta: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQ_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']

function freqLabel(score: number): string {
  return FREQ_LABELS[Math.round(score)] ?? '—'
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}

const STATUS_STYLES = {
  Improved:  { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  icon: <TrendingUp  className="w-4 h-4" /> },
  'No Change': { bg: 'bg-gray-100 dark:bg-gray-800',     text: 'text-gray-600 dark:text-gray-400',    icon: <Minus       className="w-4 h-4" /> },
  Worsened:  { bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      icon: <TrendingDown className="w-4 h-4" /> },
}

const RISK_TEXT: Record<string, string> = {
  Low:      'text-green-600 dark:text-green-400',
  Moderate: 'text-yellow-600 dark:text-yellow-400',
  High:     'text-orange-600 dark:text-orange-400',
  Critical: 'text-red-600 dark:text-red-400',
}

/** Arrow + coloured delta for a metric. good = direction where delta is "healthy" */
function Delta({
  value, good = 'down', unit = '', decimals = 1,
}: {
  value: number; good?: 'up' | 'down'; unit?: string; decimals?: number
}) {
  const isGood = good === 'down' ? value < -0.05 : value > 0.05
  const isBad  = good === 'down' ? value > 0.05  : value < -0.05
  const sign   = value > 0 ? '+' : ''

  const color = isGood ? 'text-green-600 dark:text-green-400'
              : isBad  ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground'

  const Icon = isGood
    ? (good === 'down' ? TrendingDown : TrendingUp)
    : isBad
    ? (good === 'down' ? TrendingUp : TrendingDown)
    : Minus

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {sign}{value.toFixed(decimals)}{unit}
    </span>
  )
}

// ── Expanded row detail ───────────────────────────────────────────────────────

function ExpandedDetail({ row }: { row: UserRow }) {
  const metrics = [
    {
      label: 'Screen Time',
      icon: <Monitor className="w-4 h-4" />,
      before: `${row.before.avgScreenTime}h`,
      after:  `${row.recent.avgScreenTime}h`,
      delta:  <Delta value={row.deltas.screenTime} good="down" unit="h" />,
    },
    {
      label: 'Sleep',
      icon: <Moon className="w-4 h-4" />,
      before: `${row.before.avgSleepHours}h`,
      after:  `${row.recent.avgSleepHours}h`,
      delta:  <Delta value={row.deltas.sleepHours} good="up" unit="h" />,
    },
    {
      label: 'Eye Breaks',
      icon: <Coffee className="w-4 h-4" />,
      before: `${row.before.avgBreaks.toFixed(1)}/day`,
      after:  `${row.recent.avgBreaks.toFixed(1)}/day`,
      delta:  <Delta value={row.deltas.breaks} good="up" unit="" />,
    },
    {
      label: 'Symptom Burden',
      icon: <Activity className="w-4 h-4" />,
      before: `${row.before.symptomBurden}%`,
      after:  `${row.recent.symptomBurden}%`,
      delta:  <Delta value={row.deltas.symptomBurden} good="down" unit="%" />,
    },
    {
      label: 'Risk Score',
      icon: <AlertTriangle className="w-4 h-4" />,
      before: `${row.before.riskPercentage}%`,
      after:  `${row.recent.riskPercentage}%`,
      delta:  <Delta value={row.deltas.riskPercentage} good="down" unit="%" />,
    },
  ]

  const symptoms = [
    { label: 'Eye Strain',    before: row.before.eyeStrain,    after: row.recent.eyeStrain,    delta: row.deltas.eyeStrain    },
    { label: 'Headaches',     before: row.before.headaches,    after: row.recent.headaches,    delta: row.deltas.headaches    },
    { label: 'Blurry Vision', before: row.before.blurryVision, after: row.recent.blurryVision, delta: row.deltas.blurryVision },
    { label: 'Dry Eyes',      before: row.before.dryEyes,      after: row.recent.dryEyes,      delta: row.deltas.dryEyes      },
  ]

  return (
    <tr>
      <td colSpan={7} className="px-4 pb-4 pt-0">
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">

          {/* Habit metrics */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Habit Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {metrics.map(m => (
                <div key={m.label} className="bg-background rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {m.icon}
                    <span className="text-xs font-medium">{m.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground line-through">{m.before}</span>
                    <span className="text-sm font-bold text-foreground">{m.after}</span>
                  </div>
                  {m.delta}
                </div>
              ))}
            </div>
          </div>

          {/* Symptom frequency */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Symptom Frequency (before → recent)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {symptoms.map(s => {
                const improved = s.delta < -0.05
                const worsened = s.delta > 0.05
                return (
                  <div key={s.label} className="bg-background rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-muted-foreground line-through">{freqLabel(s.before)}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className={`font-semibold ${improved ? 'text-green-600 dark:text-green-400' : worsened ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                          {freqLabel(s.after)}
                        </span>
                      </div>
                      <Delta value={s.delta} good="down" unit="" decimals={2} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Baseline: {row.before.logCount} log{row.before.logCount !== 1 ? 's' : ''} · Recent: {row.recent.logCount} log{row.recent.logCount !== 1 ? 's' : ''} · Period: {fmtDate(row.firstLogDate)} – {fmtDate(row.latestLogDate)}
          </p>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImprovementPage() {
  const router = useRouter()
  const [data, setData] = useState<{ users: UserRow[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'All' | 'Improved' | 'No Change' | 'Worsened'>('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/improvement')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => setData(d))
      .catch(() => setError('Failed to load improvement data.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtered = (data?.users ?? []).filter(u => {
    const matchStatus = statusFilter === 'All' || u.status === statusFilter
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-muted-foreground animate-pulse">Loading improvement data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const s = data!.summary

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Health Improvement Tracking</h1>
        <p className="text-muted-foreground mt-1">
          Compares each user's recent habits and symptoms against their earlier baseline to measure whether recommendations are working.
        </p>
      </div>

      {s.total === 0 ? (
        <div className="flex items-center justify-center min-h-64 rounded-xl border-2 border-dashed border-border">
          <div className="text-center space-y-3 p-8 max-w-md">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Not enough data yet</p>
            <p className="text-sm text-muted-foreground">
              Improvement tracking requires each user to have{" "}
              <strong>at least 2 daily log submissions</strong>.
              Once a user has 2 or more entries they will appear here automatically.
            </p>
            <p className="text-xs text-muted-foreground">
              Survey-imported respondents have only 1 historical log and are excluded until they submit a live follow-up.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total Tracked</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.total}</p>
              <p className="text-xs text-muted-foreground mt-1">registered users with ≥2 live logs</p>
              <p className="text-xs text-muted-foreground">Users need at least 2 submissions to evaluate progress</p>
            </div>
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-5">
              <p className="text-sm text-green-700 dark:text-green-400">Improved</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">{s.improved}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">{s.improvedPct}% of users</p>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5">
              <p className="text-sm text-red-700 dark:text-red-400">Worsened</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-400 mt-1">{s.worsened}</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{s.worsenedPct}% of users</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">No Change</p>
              <p className="text-3xl font-bold text-foreground mt-1">{s.noChange}</p>
              <p className="text-xs text-muted-foreground mt-1">{(100 - s.improvedPct - s.worsenedPct).toFixed(1)}% of users</p>
            </div>
          </div>

          {/* Population deltas */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Average Change Across All Users (baseline → recent)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Risk Score',     value: s.avgRiskDelta,    good: 'down' as const, unit: '%' },
                { label: 'Screen Time',    value: s.avgScreenDelta,  good: 'down' as const, unit: 'h' },
                { label: 'Sleep',          value: s.avgSleepDelta,   good: 'up'   as const, unit: 'h' },
                { label: 'Symptom Burden', value: s.avgSymptomDelta, good: 'down' as const, unit: '%' },
              ].map(m => (
                <div key={m.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <Delta value={m.value} good={m.good} unit={m.unit} decimals={1} />
                </div>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search by email or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] max-w-sm px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center gap-2">
              {(['All', 'Improved', 'No Change', 'Worsened'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === f
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f}{f === 'All' ? ` (${s.total})` : f === 'Improved' ? ` (${s.improved})` : f === 'Worsened' ? ` (${s.worsened})` : ` (${s.noChange})`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Risk Score</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Screen Time</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Sleep</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Symptoms</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Current Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No users match this filter.
                      </td>
                    </tr>
                  ) : filtered.map(row => {
                    const st = STATUS_STYLES[row.status]
                    const isOpen = expanded.has(row.userId)
                    return (
                      <React.Fragment key={row.userId}>
                        <tr
                          key={row.userId}
                          className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => toggle(row.userId)}
                        >
                          {/* User */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground text-xs truncate max-w-[180px]">
                              {row.displayName ?? row.email}
                            </p>
                            {row.displayName && (
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.email}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{row.totalLogs} logs</p>
                          </td>

                          {/* Status badge */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                              {st.icon}{row.status}
                            </span>
                          </td>

                          {/* Risk score delta */}
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs text-muted-foreground">{row.before.riskPercentage}% → <span className="font-semibold text-foreground">{row.recent.riskPercentage}%</span></p>
                            <Delta value={row.deltas.riskPercentage} good="down" unit="%" />
                          </td>

                          {/* Screen time delta */}
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs text-muted-foreground">{row.before.avgScreenTime}h → <span className="font-semibold text-foreground">{row.recent.avgScreenTime}h</span></p>
                            <Delta value={row.deltas.screenTime} good="down" unit="h" />
                          </td>

                          {/* Sleep delta */}
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs text-muted-foreground">{row.before.avgSleepHours}h → <span className="font-semibold text-foreground">{row.recent.avgSleepHours}h</span></p>
                            <Delta value={row.deltas.sleepHours} good="up" unit="h" />
                          </td>

                          {/* Symptom burden delta */}
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs text-muted-foreground">{row.before.symptomBurden}% → <span className="font-semibold text-foreground">{row.recent.symptomBurden}%</span></p>
                            <Delta value={row.deltas.symptomBurden} good="down" unit="%" />
                          </td>

                          {/* Current risk level + expand toggle */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-semibold ${RISK_TEXT[row.latestRiskLevel] ?? 'text-foreground'}`}>
                                {row.latestRiskLevel}
                              </span>
                              {isOpen
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              }
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isOpen && <ExpandedDetail key={`${row.userId}-detail`} row={row} />}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Improvement is determined by comparing the most recent logs against earlier baseline logs. Users with fewer than 2 logs are excluded.
            Click any row to see the full metric breakdown.
          </p>
        </>
      )}
    </div>
  )
}
