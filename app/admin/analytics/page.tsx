'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, Eye, Moon, AlertTriangle,
  ChevronDown, ChevronUp, Send, Bell, X, User, CheckCircle2, Search,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatsData {
  totalRespondents: number
  dailyRespondents?: number
  surveyRespondents?: number
  riskDistribution: { Low: number; Moderate: number; High: number; Critical: number }
  averageScreenTime: number
  topSymptoms: Array<{ symptom: string; count: number }>
  cvsqDistribution?: Record<string, number>
  avgCvsqScore?: number | null
}

interface UserRecord {
  userId: string | null
  email: string
  age: number | null
  gender: string | null
  yearLevel: string | null
  fieldOfStudy: string | null
  lastLogDate: string
  lastRiskLevel: string
}

interface DemographicsData {
  fieldOfStudy: Array<{ name: string; count: number }>
  yearLevel: Array<{ name: string; count: number }>
  gender: { Male: number; Female: number; Other: number; total: number }
  highRiskCount: number
  totalUsers: number
  highRiskUsers: UserRecord[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const riskColors: Record<string, string> = {
  Low: 'bg-green-500', Moderate: 'bg-yellow-500', High: 'bg-orange-500', Critical: 'bg-red-500',
}
const riskTextColors: Record<string, string> = {
  Low: 'text-green-600', Moderate: 'text-yellow-600', High: 'text-orange-600', Critical: 'text-red-600',
}
const riskBadge: Record<string, string> = {
  High:     'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Critical: 'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-300',
}
const symptomLabels: Record<string, string> = {
  eye_strain: 'Eye Strain', headaches: 'Headaches', blurry_vision: 'Blurry Vision', dry_eyes: 'Dry Eyes',
}
const YEAR_ORDER = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
const BAR_COLOR  = '#f97316'

const SEVERITY_OPTIONS = [
  { value: 'info',     label: 'Info',     cls: 'text-primary' },
  { value: 'high',     label: 'High',     cls: 'text-orange-500' },
  { value: 'critical', label: 'Critical', cls: 'text-red-500' },
] as const

// ── Demographics helper ───────────────────────────────────────────────────────

function computeDemographics(users: UserRecord[]): DemographicsData {
  const fieldMap     = new Map<string, number>()
  const yearMap      = new Map<string, number>()
  const genderCounts = { Male: 0, Female: 0, Other: 0 }
  let highRiskCount  = 0
  const highRiskUsers: UserRecord[] = []

  for (const u of users) {
    fieldMap.set(u.fieldOfStudy?.trim() || 'Unknown', (fieldMap.get(u.fieldOfStudy?.trim() || 'Unknown') ?? 0) + 1)
    yearMap.set(u.yearLevel?.trim() || 'Unknown',     (yearMap.get(u.yearLevel?.trim() || 'Unknown') ?? 0) + 1)
    const g = u.gender?.trim().toLowerCase()
    if (g === 'male') genderCounts.Male++
    else if (g === 'female') genderCounts.Female++
    else genderCounts.Other++
    if (u.lastRiskLevel === 'High' || u.lastRiskLevel === 'Critical') {
      highRiskCount++
      highRiskUsers.push(u)
    }
  }

  const fieldOfStudy = Array.from(fieldMap.entries())
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  const yearLevel = Array.from(yearMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ai = YEAR_ORDER.indexOf(a.name), bi = YEAR_ORDER.indexOf(b.name)
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
      if (ai === -1) return 1; if (bi === -1) return -1
      return ai - bi
    })

  return {
    fieldOfStudy, yearLevel,
    gender: { ...genderCounts, total: users.length },
    highRiskCount, totalUsers: users.length, highRiskUsers,
  }
}

// ── NotifyPanel — simple one-way notification sender ─────────────────────────

function NotifyPanel({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [message,  setMessage]  = useState('')
  const [severity, setSeverity] = useState<'info' | 'high' | 'critical'>('high')
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')

  const send = async () => {
    const text = message.trim()
    if (!text || sending) return
    const targetId = user.userId || user.email
    if (!targetId) {
      setError('Respondent identifier is required.')
      return
    }
    setSending(true); setError('')
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, content: text, severity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      setSent(true)
      setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border border-[#f97316]/20 bg-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f97316]/5 border-b border-[#f97316]/15">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{user.email}</p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${riskBadge[user.lastRiskLevel] ?? 'bg-muted text-muted-foreground'}`}>
              {user.lastRiskLevel}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          This message will appear directly in the user's notification bell.
        </p>

        {/* Severity selector */}
        <div className="flex gap-2">
          {SEVERITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSeverity(opt.value)}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                severity === opt.value
                  ? 'border-current bg-current/10 ' + opt.cls
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Message textarea */}
        <textarea
          value={message}
          onChange={e => { setMessage(e.target.value); setError('') }}
          placeholder="Type a notification message for this user…"
          rows={3}
          className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Send button */}
        <button
          onClick={send}
          disabled={!message.trim() || sending}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all
            bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20
            hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : sent ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? 'Sending…' : sent ? 'Sent!' : 'Send Notification'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [stats,         setStats]         = useState<StatsData | null>(null)
  const [demographics,  setDemographics]  = useState<DemographicsData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [demoLoading,   setDemoLoading]   = useState(true)
  const [error,         setError]         = useState('')
  const [alertExpanded, setAlertExpanded] = useState(false)
  const [activeUser,    setActiveUser]    = useState<UserRecord | null>(null)
  const [alertSearch,   setAlertSearch]   = useState('')

  const filteredHighRiskUsers = useMemo(() => {
    if (!demographics?.highRiskUsers) return []
    if (!alertSearch.trim()) return demographics.highRiskUsers
    const q = alertSearch.trim().toLowerCase()
    return demographics.highRiskUsers.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.fieldOfStudy?.toLowerCase().includes(q) ||
      u.yearLevel?.toLowerCase().includes(q)
    )
  }, [demographics?.highRiskUsers, alertSearch])

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json()).then(setStats)
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/admin/users?pageSize=1000')
      .then(r => r.json())
      .then((data: { users?: UserRecord[] }) => {
        if (data.users) setDemographics(computeDemographics(data.users))
      })
      .catch(() => {})
      .finally(() => setDemoLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div aria-busy="true" className="text-muted-foreground">Loading analytics…</div>
    </div>
  )
  if (error || !stats) return <p role="alert" className="text-destructive">{error || 'No data available.'}</p>

  const riskLevels = ['Low', 'Moderate', 'High', 'Critical'] as const
  const maxRiskPct = Math.max(...riskLevels.map(l => stats.riskDistribution[l]))

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide eye health trends across all users</p>
      </div>

      {/* ── HIGH RISK ALERT — top, always visible ── */}
      {!demoLoading && demographics && (() => {
        const pct = demographics.totalUsers > 0
          ? Math.round((demographics.highRiskCount / demographics.totalUsers) * 1000) / 10 : 0
        return (
          <div className="border border-red-500/25 bg-red-500/5 rounded-xl overflow-hidden">
            {/* Clickable summary row */}
            <button
              onClick={() => setAlertExpanded(v => !v)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-red-500/[0.04] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-sm font-semibold text-red-400">High Risk Alert Summary</h2>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-3xl font-bold text-red-400">{demographics.highRiskCount}</p>
                    <p className="text-xs text-muted-foreground">High / Critical users</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-400">{pct}%</p>
                    <p className="text-xs text-muted-foreground">of total users</p>
                  </div>
                </div>
                <p className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-4 py-2 inline-block">
                  These users may need immediate attention.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-red-400 flex-shrink-0">
                <span className="hidden sm:inline">{alertExpanded ? 'Collapse' : 'View & notify'}</span>
                {alertExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Expandable user list + notify form */}
            {alertExpanded && (
              <div className="border-t border-red-500/15 p-5 space-y-4">
                {demographics.highRiskUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No users with High or Critical risk found.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {demographics.highRiskUsers.length} respondent{demographics.highRiskUsers.length !== 1 ? 's' : ''} with High or Critical risk
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          View details or send notifications to users.
                        </p>
                      </div>
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="search"
                          placeholder="Search high-risk users…"
                          value={alertSearch}
                          onChange={(e) => setAlertSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* User cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                      {filteredHighRiskUsers.map((u, idx) => {
                        const isSelected = !!activeUser && (
                          (activeUser.userId && u.userId && activeUser.userId === u.userId) ||
                          (activeUser.email && u.email && activeUser.email.toLowerCase() === u.email.toLowerCase())
                        );
                        const userKey = u.userId ?? `${u.email}-${idx}`;
                        const profileUrl = `/admin/users/${u.userId ?? encodeURIComponent(u.email)}`;

                        return (
                          <div
                            key={userKey}
                            className={`p-4 rounded-xl border transition-all ${
                              isSelected
                                ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                                : 'border-red-500/20 bg-red-500/[0.03] hover:border-red-500/40 hover:bg-red-500/[0.06]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link
                                  href={profileUrl}
                                  className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors block"
                                >
                                  {u.email}
                                </Link>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {[u.yearLevel, u.fieldOfStudy].filter(Boolean).join(' · ') || 'No profile info'}
                                </p>
                                {(u.age || u.gender) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[u.age ? `Age ${u.age}` : null, u.gender].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                                <p className="text-[11px] text-muted-foreground/50 mt-1">Last log: {u.lastLogDate}</p>
                              </div>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${riskBadge[u.lastRiskLevel] ?? ''}`}>
                                {u.lastRiskLevel}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                              <button
                                type="button"
                                onClick={() => setActiveUser(isSelected ? null : u)}
                                className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium"
                              >
                                <Bell className="w-3.5 h-3.5" />
                                {isSelected ? 'Close' : 'Notify this user'}
                              </button>
                              <Link
                                href={profileUrl}
                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors ml-auto flex items-center gap-1"
                              >
                                View details &rarr;
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {filteredHighRiskUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No users found matching &ldquo;{alertSearch}&rdquo;
                      </p>
                    )}

                    {/* Notify panel — shown below cards when a user is selected */}
                    {activeUser && (
                      <NotifyPanel
                        user={activeUser}
                        onClose={() => setActiveUser(null)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#f97316]/15 flex items-center justify-center flex-shrink-0"><BarChart3 className="w-5 h-5 text-[#f97316]" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalRespondents}</p>
            {(stats.dailyRespondents != null || stats.surveyRespondents != null) && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                All active & registered users
              </p>
            )}
          </div>
        </div>
        <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Avg Screen Time</p><p className="text-2xl font-bold text-foreground">{stats.averageScreenTime}h</p></div>
        </div>
        <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#f97316]/15 flex items-center justify-center flex-shrink-0"><Eye className="w-5 h-5 text-[#f97316]" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Top Symptom</p>
            <p className="text-2xl font-bold text-foreground capitalize">{stats.topSymptoms[0] ? (symptomLabels[stats.topSymptoms[0].symptom] ?? stats.topSymptoms[0].symptom) : '—'}</p>
            {stats.avgCvsqScore != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Avg CVS-Smart: {stats.avgCvsqScore}/10</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Risk distribution ── */}
      <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-5">Risk Level Distribution</h2>
        <div className="space-y-4">
          {riskLevels.map(level => {
            const pct = stats.riskDistribution[level]
            const barWidth = maxRiskPct > 0 ? (pct / maxRiskPct) * 100 : 0
            return (
              <div key={level} className="flex items-center gap-4">
                <span className={`w-20 text-sm font-medium text-right flex-shrink-0 ${riskTextColors[level]}`}>{level}</span>
                <div className="flex-1 bg-[#f97316]/8 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${riskColors[level]}`} style={{ width: `${barWidth}%` }} />
                </div>
                <span className="w-12 text-sm text-muted-foreground text-right flex-shrink-0">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── CVS-Smart Distribution (from imported survey_responses) ── */}
      {stats.cvsqDistribution && Object.values(stats.cvsqDistribution).some(v => v > 0) && (() => {
        const cvsqOrder = ['Positive CVS Case', 'High Probability', 'Low Probability', 'Not a CVS Case', 'Normal']
        const cvsqColors: Record<string, string> = {
          'Positive CVS Case': 'bg-red-500',
          'High Probability':  'bg-orange-500',
          'Low Probability':   'bg-yellow-500',
          'Not a CVS Case':    'bg-green-500',
          'Normal':            'bg-green-400',
        }
        const cvsqTextColors: Record<string, string> = {
          'Positive CVS Case': 'text-red-500',
          'High Probability':  'text-orange-500',
          'Low Probability':   'text-yellow-500',
          'Not a CVS Case':    'text-green-500',
          'Normal':            'text-green-400',
        }
        const total = Object.values(stats.cvsqDistribution!).reduce((a, b) => a + b, 0) || 1
        const maxCount = Math.max(...Object.values(stats.cvsqDistribution!))
        return (
          <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">CVS-Smart Score Distribution</h2>
              {stats.avgCvsqScore != null && (
                <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted/40 border border-border">
                  Avg score: <strong className="text-foreground">{stats.avgCvsqScore}/10</strong>
                </span>
              )}
            </div>
            <div className="space-y-4">
              {cvsqOrder.map(status => {
                const count = stats.cvsqDistribution![status] ?? 0
                const pct   = Math.round((count / total) * 1000) / 10
                const barW  = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <div key={status} className="flex items-center gap-4">
                    <span className={`w-36 text-sm font-medium text-right flex-shrink-0 ${cvsqTextColors[status]}`}>{status}</span>
                    <div className="flex-1 bg-[#f97316]/8 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${cvsqColors[status]}`} style={{ width: `${barW}%` }} />
                    </div>
                    <span className="w-20 text-sm text-muted-foreground text-right flex-shrink-0">{count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Based on {stats.surveyRespondents ?? total} users. Score ≥7 = Positive CVS, 5–6 = High Probability, 3–4 = Low Probability, 1–2 = Not a CVS Case, 0 = Normal.
            </p>
          </div>
        )
      })()}

      {/* ── Symptom frequency ── */}
      <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-5">Symptom Frequency</h2>
        {stats.topSymptoms.length === 0
          ? <p className="text-muted-foreground text-sm">No symptom data available.</p>
          : (() => {
            const maxSymptomCount = Math.max(...stats.topSymptoms.map(s => s.count), 1);
            return (
              <div className="space-y-4">
                {stats.topSymptoms.map(s => {
                  const pct = stats.totalRespondents > 0
                    ? Math.round((s.count / stats.totalRespondents) * 1000) / 10
                    : 0;
                  const barWidth = maxSymptomCount > 0 ? (s.count / maxSymptomCount) * 100 : 0;

                  return (
                    <div key={s.symptom} className="flex items-center gap-4">
                      <span className="w-28 text-sm font-medium text-foreground text-right flex-shrink-0">
                        {symptomLabels[s.symptom] ?? s.symptom}
                      </span>
                      <div className="flex-1 bg-[#f97316]/8 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#f97316] to-[#fb923c] rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="w-28 text-sm text-muted-foreground text-right flex-shrink-0">
                        {s.count} <span className="text-xs">users</span> ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
      </div>

      {/* ── Screen time insight ── */}
      <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Moon className="w-4 h-4 text-[#f97316]" /> Screen Time Insight
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className={`p-4 rounded-xl ${stats.averageScreenTime <= 6 ? 'bg-green-500/10 border border-green-500/20' : stats.averageScreenTime <= 8 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className={`text-2xl font-bold ${stats.averageScreenTime <= 6 ? 'text-green-400' : stats.averageScreenTime <= 8 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.averageScreenTime <= 6 ? '✓' : stats.averageScreenTime <= 8 ? '~' : '✗'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.averageScreenTime <= 6 ? 'Healthy range (≤6h)' : stats.averageScreenTime <= 8 ? 'Moderate (6–8h)' : 'High risk (>8h)'}
            </p>
          </div>
          <div className="p-4 bg-[#f97316]/5 rounded-xl border border-[#f97316]/10">
            <p className="text-2xl font-bold text-foreground">{stats.averageScreenTime}h</p>
            <p className="text-xs text-muted-foreground mt-1">Average daily screen time</p>
          </div>
          <div className="p-4 bg-[#f97316]/5 rounded-xl border border-[#f97316]/10">
            <p className="text-2xl font-bold text-foreground">8h</p>
            <p className="text-xs text-muted-foreground mt-1">Recommended maximum</p>
          </div>
        </div>
      </div>

      {demoLoading && <p aria-busy="true" className="text-muted-foreground text-sm">Loading demographic data…</p>}

      {!demoLoading && demographics && (
        <>
          {/* Field of Study */}
          <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-5">Field of Study Breakdown</h2>
            {demographics.fieldOfStudy.length === 0
              ? <p className="text-muted-foreground text-sm">No data available.</p>
              : (
                <ResponsiveContainer width="100%" height={Math.max(200, demographics.fieldOfStudy.length * 40)}>
                  <BarChart data={demographics.fieldOfStudy} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v, 'Users']} cursor={{ fill: 'rgba(249,115,22,0.08)' }} contentStyle={{ background: 'var(--card)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '8px', color: 'var(--foreground)', fontSize: '12px' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {demographics.fieldOfStudy.map((_, i) => <Cell key={i} fill={BAR_COLOR} fillOpacity={1 - i * 0.06} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Year Level */}
          <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-5">Year Level Distribution</h2>
            {demographics.yearLevel.length === 0
              ? <p className="text-muted-foreground text-sm">No data available.</p>
              : (
                <ResponsiveContainer width="100%" height={Math.max(200, demographics.yearLevel.length * 48)}>
                  <BarChart data={demographics.yearLevel} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v, 'Users']} cursor={{ fill: 'rgba(249,115,22,0.08)' }} contentStyle={{ background: 'var(--card)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '8px', color: 'var(--foreground)', fontSize: '12px' }} />
                    <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Gender */}
          <div className="border border-[#f97316]/10 bg-[#f97316]/[0.03] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-5">Gender Distribution</h2>
            {demographics.gender.total === 0
              ? <p className="text-muted-foreground text-sm">No data available.</p>
              : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {([
                    { label: 'Male',                  key: 'Male'   as const, bg: 'bg-primary/10   border-primary/20',   text: 'text-primary'   },
                    { label: 'Female',                key: 'Female' as const, bg: 'bg-pink-500/10  border-pink-500/20',  text: 'text-pink-400'  },
                    { label: 'Other / Not specified', key: 'Other'  as const, bg: 'bg-[#f97316]/10 border-[#f97316]/20', text: 'text-[#fb923c]' },
                  ]).map(({ label, key, bg, text }) => {
                    const count = demographics.gender[key]
                    const pct   = demographics.gender.total > 0 ? Math.round((count / demographics.gender.total) * 1000) / 10 : 0
                    return (
                      <div key={key} className={`rounded-xl p-5 border ${bg}`}>
                        <p className={`text-3xl font-bold ${text}`}>{count}</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
                        <p className="text-xs text-muted-foreground">{pct}% of users</p>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        </>
      )}

    </div>
  )
}
