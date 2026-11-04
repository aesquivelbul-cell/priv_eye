'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Monitor, Brain, TrendingUp,
  Download, ArrowRight,
  Activity, Zap,
} from 'lucide-react'

interface AggregateStats {
  totalRespondents: number
  riskDistribution: { Low: number; Moderate: number; High: number; Critical: number }
  averageScreenTime: number
  topSymptoms: Array<{ symptom: string; count: number }>
}

const RISK_META = {
  Low:      { text: 'text-green-500',  bar: 'bg-green-500',   badge: 'bg-green-500/15 text-green-400'  },
  Moderate: { text: 'text-yellow-500', bar: 'bg-yellow-500',  badge: 'bg-yellow-500/15 text-yellow-400' },
  High:     { text: 'text-[#f97316]',  bar: 'bg-[#f97316]',   badge: 'bg-[#f97316]/15 text-[#fb923c]'  },
  Critical: { text: 'text-red-500',    bar: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400'      },
} as const

/* ── Warm card wrapper ── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#f97316]/10 bg-[#f97316]/[0.03] p-6 ${className}`}>
      {children}
    </div>
  )
}

/* ── Section heading ── */
function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
      <span className="w-6 h-6 rounded-md bg-[#f97316]/15 flex items-center justify-center text-[#f97316] flex-shrink-0">
        {icon}
      </span>
      {label}
    </h2>
  )
}

/* ── KPI stat card ── */
function StatCard({ icon, label, value, sub, iconBg }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; iconBg?: string
}) {
  return (
    <div className="rounded-xl border border-[#f97316]/10 bg-[#f97316]/[0.03] p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg ?? 'bg-[#f97316]/15 text-[#f97316]'}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => setStats(null)).finally(() => setStatsLoading(false))
  }, [])

  const handleExport = async () => {
    setDownloading(true); setExportError('')
    try {
      const res = await fetch('/api/admin/export-csv')
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Export failed') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eyeguard-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (err) { setExportError(err instanceof Error ? err.message : 'Export failed') }
    finally { setDownloading(false) }
  }

  const totalRisk = stats ? Object.values(stats.riskDistribution).reduce((a, b) => a + b, 0) || 1 : 1

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System-wide statistics and model management</p>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#f97316] text-[#0f0a07] rounded-xl text-sm font-semibold hover:bg-[#fb923c] disabled:opacity-50 transition-colors"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          {downloading ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      {/* KPI cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-[#f97316]/10 p-5 h-24 animate-pulse bg-[#f97316]/5" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />}         label="Total Respondents" value={stats.totalRespondents}  sub="All-time submissions"  iconBg="bg-primary/15 text-primary" />
          <StatCard icon={<Monitor className="w-5 h-5" />}       label="Avg Screen Time"   value={`${stats.averageScreenTime}h`} sub="Per daily log"    iconBg="bg-primary/15 text-primary" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="High / Critical"   value={`${stats.riskDistribution.High + stats.riskDistribution.Critical}%`} sub="Of all respondents" iconBg="bg-red-500/15 text-red-400" />
          <StatCard icon={<CheckCircle className="w-5 h-5" />}   label="Low Risk"          value={`${stats.riskDistribution.Low}%`} sub="Healthy range"  iconBg="bg-green-500/15 text-green-400" />
        </div>
      ) : (
        <p className="text-sm text-destructive">Failed to load statistics.</p>
      )}

      {/* Risk distribution + symptoms */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk distribution */}
          <Card>
            <SectionHeading icon={<TrendingUp className="w-3.5 h-3.5" />} label="Risk Distribution" />
            <div className="space-y-4">
              {(['Low', 'Moderate', 'High', 'Critical'] as const).map((level) => {
                const pct = stats.riskDistribution[level]
                const meta = RISK_META[level]
                return (
                  <div key={level}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground">{level}</span>
                      <span className={`text-sm font-bold tabular-nums ${meta.text}`}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#f97316]/8 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-[#f97316]/8 flex flex-wrap gap-2">
              {(['Low', 'Moderate', 'High', 'Critical'] as const).map((level) => (
                <span key={level} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${RISK_META[level].badge}`}>
                  {level}: {stats.riskDistribution[level]}%
                </span>
              ))}
            </div>
          </Card>

          {/* Top symptoms */}
          <Card>
            <SectionHeading icon={<Activity className="w-3.5 h-3.5" />} label="Top Reported Symptoms" />
            {stats.topSymptoms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No symptom data yet.</p>
            ) : (
              <div className="space-y-4">
                {stats.topSymptoms.map((s, idx) => {
                  const maxCount = stats.topSymptoms[0]?.count || 1
                  const barPct = (s.count / maxCount) * 100
                  const barColors = ['bg-[#f97316]', 'bg-[#fb923c]', 'bg-[#fdba74]', 'bg-yellow-500']
                  return (
                    <div key={s.symptom}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-foreground capitalize">{s.symptom.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-bold text-foreground tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f97316]/8 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColors[idx] ?? 'bg-[#f97316]'}`} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#f97316]/15 flex items-center justify-center text-[#f97316]">
            <Zap className="w-3.5 h-3.5" />
          </span>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Manage Respondents', desc: 'View, filter, and search all users', href: '/admin/users',     icon: <Users className="w-4 h-4" /> },
            { label: 'Analytics',          desc: 'System-wide trend charts',           href: '/admin/analytics', icon: <TrendingUp className="w-4 h-4" /> },
            { label: 'Activity Logs',      desc: 'System event history',               href: '/admin/logs',      icon: <Activity className="w-4 h-4" /> },
            { label: 'Settings',           desc: 'Admin configuration',                href: '/admin/settings',  icon: <Brain className="w-4 h-4" /> },
          ].map(({ label, desc, href, icon }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex items-start gap-3 p-4 rounded-xl border border-[#f97316]/10 bg-[#f97316]/[0.03] text-left hover:border-[#f97316]/25 hover:bg-[#f97316]/[0.07] transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#f97316]/15 text-[#f97316] flex items-center justify-center flex-shrink-0 group-hover:bg-[#f97316]/25 transition-colors">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#f97316] mt-0.5 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
