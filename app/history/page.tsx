'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Printer, Download, FileText } from 'lucide-react'
import { MainLayout } from '@/components/main-layout'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyLog {
  id: string
  date: string
  screen_time: number
  sleep_hours: number
  brightness: number
  eye_strain: number
  headaches: number
  blurry_vision: number
  dry_eyes: number
  risk_level: string
  hidden_by_admin?: boolean
  // extended survey-style fields stored on daily_logs
  academic_screen_time?: string | null
  non_academic_screen_time?: string | null
  primary_device?: string | null
  continuous_screen_use?: string | null
  online_classes_per_day?: string | null
  follows_20_20_20?: string | null
  blue_light_filter?: string | null
  screen_brightness?: string | null
  dark_room_use?: string | null
  screen_distance?: string | null
  wears_glasses?: string | null
  blue_light_glasses?: string | null
  break_frequency?: string | null
  sym_dry_eyes?: string | null
  sym_eye_itchiness?: string | null
  sym_blurred_vision?: string | null
  sym_headaches?: string | null
  sym_eye_irritation?: string | null
  sym_light_sensitivity?: string | null
  sym_difficulty_focusing?: string | null
  sym_neck_shoulder_pain?: string | null
  sym_mental_fatigue?: string | null
  sym_difficulty_concentrating?: string | null
  overall_eye_strain?: string | null
  digital_fatigue_frequency?: string | null
  primary_symptom_history?: string | null
  cvsq_score?: number | null
  cvsq_status?: string | null
}

interface SurveyResponse {
  response_timestamp: string | null
  email: string | null
  eg_age: number | string | null
  eg_gender: string | null
  eg_year_level: string | null
  eg_field_of_study: string | null
  cvsq_q1_visual_raw: string | null
  cvsq_q2_ocular_raw: string | null
  cvsq_q3_extraocular_raw: string | null
  cvsq_q4_frequency: string | null
  cvsq_q5_screen_associated: string | null
  cvsq_total: number | null
  cvsq_status: string | null
  eg_academic_screen_time: string | null
  eg_non_academic_screen_time: string | null
  eg_primary_device: string | null
  eg_continuous_screen_use: string | null
  eg_online_classes_per_day: string | null
  eg_follows_20_20_20: string | null
  eg_blue_light_filter: string | null
  eg_screen_brightness: string | null
  eg_dark_room_use: string | null
  eg_screen_distance: string | null
  eg_wears_glasses: string | null
  eg_blue_light_glasses: string | null
  eg_break_frequency: string | null
  eg_sleep_hours: number | string | null
  sym_dry_eyes: string | null
  sym_eye_itchiness: string | null
  sym_blurred_vision: string | null
  sym_headaches: string | null
  sym_eye_irritation: string | null
  sym_light_sensitivity: string | null
  sym_difficulty_focusing: string | null
  sym_neck_shoulder_pain: string | null
  sym_mental_fatigue: string | null
  sym_difficulty_concentrating: string | null
  eg_overall_eye_strain: string | null
  eg_digital_fatigue_frequency: string | null
  eg_primary_symptom_history: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_BADGES: Record<string, string> = {
  Low:      'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400',
  Moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Critical: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeSymptoms(log: DailyLog): string {
  const s: string[] = []
  if (log.eye_strain    === 1) s.push('Eye Strain')
  if (log.headaches     === 1) s.push('Headaches')
  if (log.blurry_vision === 1) s.push('Blurry Vision')
  if (log.dry_eyes      === 1) s.push('Dry Eyes')
  return s.length > 0 ? s.join(', ') : 'None'
}

// ── Survey Section (shared render) ───────────────────────────────────────────

function SurveySection({ responses }: { responses: SurveyResponse[] }) {
  return (
    <section aria-labelledby="survey-heading" className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 id="survey-heading" className="text-lg font-semibold text-foreground">
          Survey Responses ({responses.length})
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Your imported survey data.</p>
      </div>

      {responses.map((sr, idx) => (
        <div key={idx} className="border border-border rounded-lg overflow-hidden">
          {/* Row header */}
          <div className="bg-muted px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Response {idx + 1}
              {sr.response_timestamp && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {sr.response_timestamp.split('T')[0]}
                </span>
              )}
            </span>
            {sr.eg_overall_eye_strain && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                sr.eg_overall_eye_strain === 'Severe'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : sr.eg_overall_eye_strain === 'Moderate'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {sr.eg_overall_eye_strain} Eye Strain
              </span>
            )}
          </div>

          <div className="p-4 space-y-4 text-sm">

            {/* Screen Habits */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Screen Habits</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {([
                  ['Academic Screen Time',     sr.eg_academic_screen_time],
                  ['Non-Academic Screen Time', sr.eg_non_academic_screen_time],
                  ['Primary Device',           sr.eg_primary_device],
                  ['Continuous Use',           sr.eg_continuous_screen_use],
                  ['Online Classes/Day',       sr.eg_online_classes_per_day],
                  ['Screen Brightness',        sr.eg_screen_brightness],
                  ['Screen Distance',          sr.eg_screen_distance],
                  ['Dark Room Use',            sr.eg_dark_room_use],
                  ['Break Frequency',          sr.eg_break_frequency],
                  ['Follows 20-20-20',         sr.eg_follows_20_20_20],
                  ['Blue Light Filter',        sr.eg_blue_light_filter],
                  ['Wears Glasses',            sr.eg_wears_glasses],
                  ['Blue Light Glasses',       sr.eg_blue_light_glasses],
                  ['Sleep Hours',              sr.eg_sleep_hours],
                ] as [string, unknown][]).map(([label, value]) =>
                  value != null && (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium text-foreground">{String(value)}</dd>
                    </div>
                  )
                )}
              </dl>
            </div>

            {/* Symptoms */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Symptoms</h3>
              <div className="flex flex-wrap gap-2">
                {([
                  ['Dry Eyes',                 sr.sym_dry_eyes],
                  ['Eye Itchiness',            sr.sym_eye_itchiness],
                  ['Blurred Vision',           sr.sym_blurred_vision],
                  ['Headaches',                sr.sym_headaches],
                  ['Eye Irritation',           sr.sym_eye_irritation],
                  ['Light Sensitivity',        sr.sym_light_sensitivity],
                  ['Difficulty Focusing',      sr.sym_difficulty_focusing],
                  ['Neck/Shoulder Pain',       sr.sym_neck_shoulder_pain],
                  ['Mental Fatigue',           sr.sym_mental_fatigue],
                  ['Difficulty Concentrating', sr.sym_difficulty_concentrating],
                ] as [string, unknown][]).map(([label, value]) =>
                  value != null && (
                    <span key={label} className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-foreground">
                      {label}: <span className="font-medium">{String(value)}</span>
                    </span>
                  )
                )}
                {sr.eg_primary_symptom_history && (
                  <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-foreground">
                    History: <span className="font-medium">{sr.eg_primary_symptom_history}</span>
                  </span>
                )}
              </div>
            </div>

            {/* CVSQ Scores */}
            {(sr.cvsq_total != null || sr.cvsq_status) && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">CVSQ Scores</h3>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                  {([
                    ['CVSQ Total',           sr.cvsq_total],
                    ['Status',               sr.cvsq_status],
                    ['Visual',               sr.cvsq_q1_visual_raw],
                    ['Ocular',               sr.cvsq_q2_ocular_raw],
                    ['Extraocular',          sr.cvsq_q3_extraocular_raw],
                    ['Frequency',            sr.cvsq_q4_frequency],
                    ['Screen Associated',    sr.cvsq_q5_screen_associated],
                    ['Digital Fatigue Freq', sr.eg_digital_fatigue_frequency],
                  ] as [string, unknown][]).map(([label, value]) =>
                    value != null && (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium text-foreground">{String(value)}</dd>
                      </div>
                    )
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => {
    fetch('/api/user/history')
      .then(async res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (!res.ok) throw new Error('Failed to load history')
        return res.json()
      })
      .then(json => {
        if (!json) return
        setLogs(json.logs ?? [])
        setSurveyResponses(json.surveyResponses ?? [])
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [router])

  const visibleLogs = logs.filter(l => showHidden || !l.hidden_by_admin)
  const hiddenCount = logs.filter(l => l.hidden_by_admin).length

  const hasAnything = logs.length > 0 || surveyResponses.length > 0

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Log History</h1>
            <p className="text-muted-foreground mt-1">All your daily logs, symptom patterns, and CVSQ scores.</p>
          </div>
          {hasAnything && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Export Clinical / Optometry Report
            </button>
          )}
        </div>

        {/* Clinical Print Header (Visible only when printed or exported as PDF) */}
        <div className="hidden print:block border-b-2 border-primary pb-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black">EyeGuard Digital Eye Strain Patient Report</h1>
              <p className="text-xs text-gray-600 mt-1">
                Automated Clinical Decision Support & Longitudinal Ergonomic Profile
              </p>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p>Report Date: {new Date().toLocaleDateString()}</p>
              <p>Total Records Analyzed: {logs.length}</p>
            </div>
          </div>
        </div>

        {loading && <p aria-busy="true" className="text-muted-foreground">Loading…</p>}
        {error   && <p role="alert" className="text-destructive text-sm">{error}</p>}

        {!loading && !error && !hasAnything && (
          <div className="border border-border rounded-xl p-10 text-center space-y-3">
            <p className="text-muted-foreground">No logs or survey responses found.</p>
            <button
              onClick={() => router.push('/daily-log')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Submit your first daily log
            </button>
          </div>
        )}

        {!loading && !error && hasAnything && (
          <>
            {/* ── Daily Log History ── */}
            <section aria-labelledby="logs-heading">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 id="logs-heading" className="text-lg font-semibold text-foreground">
                  Log History ({visibleLogs.length}{hiddenCount > 0 ? ` / ${logs.length} total` : ''})
                </h2>
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setShowHidden(v => !v)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showHidden
                      ? 'Hide hidden logs'
                      : `Show ${hiddenCount} hidden log${hiddenCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {visibleLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {surveyResponses.length > 0
                    ? 'You have no daily logs — your data comes from the survey import below.'
                    : 'No logs found.'}
                </p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Daily log history</caption>
                      <thead className="bg-muted">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Screen</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Sleep</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Brightness</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Symptoms</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLogs.map(log => (
                          <tr
                            key={log.id}
                            className={`border-t border-border transition-colors ${
                              log.hidden_by_admin ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/30'
                            }`}
                          >
                            <td className="px-4 py-3 text-foreground font-medium">
                              {log.date}
                              {log.hidden_by_admin && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border align-middle">
                                  hidden
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{log.screen_time}h</td>
                            <td className="px-4 py-3 text-muted-foreground">{log.sleep_hours}h</td>
                            <td className="px-4 py-3 text-muted-foreground">{log.brightness}%</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                              {activeSymptoms(log)}
                            </td>
                            <td className="px-4 py-3">
                              {log.risk_level ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGES[log.risk_level] ?? 'bg-muted text-foreground'}`}>
                                  {log.risk_level}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {hiddenCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {hiddenCount} log{hiddenCount !== 1 ? 's are' : ' is'} hidden by an admin but still stored for research purposes.
                </p>
              )}
            </section>

            {/* ── Survey Responses ── */}
            {surveyResponses.length > 0 && (
              <SurveySection responses={surveyResponses} />
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}
