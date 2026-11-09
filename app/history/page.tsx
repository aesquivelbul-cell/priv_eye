'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Printer, FileText, CheckCircle2, AlertCircle, Shield, User, Activity } from 'lucide-react'
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

interface UserProfile {
  first_name?: string | null
  last_name?: string | null
  age?: number | string | null
  gender?: string | null
  year_level?: string | null
  field_of_study?: string | null
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

const RISK_BADGES: Record<string, string> = {
  Low:      'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400',
  Moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Critical: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

function activeSymptoms(log: DailyLog): string {
  const syms: string[] = []
  if (log.eye_strain)    syms.push('Eye Strain')
  if (log.headaches)     syms.push('Headaches')
  if (log.blurry_vision) syms.push('Blurry Vision')
  if (log.dry_eyes)      syms.push('Dry Eyes')
  return syms.length > 0 ? syms.join(', ') : 'None'
}

function fullActiveSymptomsList(log: DailyLog): string[] {
  const list: string[] = []
  if (log.sym_dry_eyes && log.sym_dry_eyes !== 'Never') list.push(`Dry eyes (${log.sym_dry_eyes})`)
  if (log.sym_eye_itchiness && log.sym_eye_itchiness !== 'Never') list.push(`Eye itchiness (${log.sym_eye_itchiness})`)
  if (log.sym_blurred_vision && log.sym_blurred_vision !== 'Never') list.push(`Blurred vision (${log.sym_blurred_vision})`)
  if (log.sym_headaches && log.sym_headaches !== 'Never') list.push(`Headaches (${log.sym_headaches})`)
  if (log.sym_eye_irritation && log.sym_eye_irritation !== 'Never') list.push(`Eye irritation (${log.sym_eye_irritation})`)
  if (log.sym_light_sensitivity && log.sym_light_sensitivity !== 'Never') list.push(`Light sensitivity (${log.sym_light_sensitivity})`)
  if (log.sym_difficulty_focusing && log.sym_difficulty_focusing !== 'Never') list.push(`Focus difficulty (${log.sym_difficulty_focusing})`)
  if (log.sym_neck_shoulder_pain && log.sym_neck_shoulder_pain !== 'Never') list.push(`Neck/shoulder pain (${log.sym_neck_shoulder_pain})`)
  if (log.sym_mental_fatigue && log.sym_mental_fatigue !== 'Never') list.push(`Mental fatigue (${log.sym_mental_fatigue})`)
  if (log.sym_difficulty_concentrating && log.sym_difficulty_concentrating !== 'Never') list.push(`Concentration issues (${log.sym_difficulty_concentrating})`)
  if (list.length === 0) {
    if (log.eye_strain) list.push('Eye strain')
    if (log.headaches) list.push('Headaches')
    if (log.blurry_vision) list.push('Blurry vision')
    if (log.dry_eyes) list.push('Dry eyes')
  }
  return list.length > 0 ? list : ['No reported acute symptoms']
}

export default function HistoryPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
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
        setProfile(json.profile ?? null)
        setUserEmail(json.userEmail ?? null)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [router])

  const visibleLogs = logs.filter(l => showHidden || !l.hidden_by_admin)
  const hiddenCount = logs.filter(l => l.hidden_by_admin).length
  const hasAnything = logs.length > 0 || surveyResponses.length > 0

  // ── Compute Longitudinal Metrics for Clinical Report ───────────────────────
  const n = logs.length
  const avgScreenTime = n > 0 ? (logs.reduce((s, l) => s + (Number(l.screen_time) || 0), 0) / n).toFixed(1) : '0.0'
  const avgSleepHours = n > 0 ? (logs.reduce((s, l) => s + (Number(l.sleep_hours) || 0), 0) / n).toFixed(1) : '0.0'
  const highRiskCount = logs.filter(l => l.risk_level === 'High' || l.risk_level === 'Critical').length
  const highRiskPct = n > 0 ? Math.round((highRiskCount / n) * 100) : 0

  // Latest baseline habits from latest log or survey
  const latestLog = logs[0]
  const latestSurvey = surveyResponses[0]

  const patientName = profile?.first_name || profile?.last_name
    ? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    : userEmail?.split('@')[0] ?? 'Patient'

  const patientAge = profile?.age ?? latestSurvey?.eg_age ?? 'N/A'
  const patientGender = profile?.gender ?? latestSurvey?.eg_gender ?? 'N/A'
  const patientMajor = profile?.field_of_study ?? latestSurvey?.eg_field_of_study ?? 'N/A'
  const patientYear = profile?.year_level ?? latestSurvey?.eg_year_level ?? 'N/A'

  // CVSQ score from latest log or survey
  const cvsqScore = latestLog?.cvsq_score ?? latestSurvey?.cvsq_total ?? null
  const cvsqStatus = latestLog?.cvsq_status ?? latestSurvey?.cvsq_status ?? (cvsqScore != null ? (cvsqScore >= 7 ? 'Positive for CVS' : cvsqScore >= 5 ? 'High Probability' : cvsqScore >= 3 ? 'Low Probability' : 'Normal') : 'Not Assessed')

  return (
    <MainLayout>
      {/* ════════════════════════════════════════════════════════════════════════
          SCREEN VIEW (hidden when printing)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 print:hidden">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Log History</h1>
            <p className="text-muted-foreground mt-1">All your daily logs, symptom patterns, and CVSQ scores.</p>
          </div>
          {hasAnything && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              <Printer className="w-4 h-4" />
              Export Clinical / Optometry Report
            </button>
          )}
        </div>

        {loading && <p aria-busy="true" className="text-muted-foreground">Loading history records…</p>}
        {error   && <p role="alert" className="text-destructive text-sm font-medium">{error}</p>}

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
            {/* Daily Log History Table */}
            <section aria-labelledby="logs-heading">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 id="logs-heading" className="text-lg font-semibold text-foreground">
                  Recorded Sessions ({visibleLogs.length}{hiddenCount > 0 ? ` / ${logs.length} total` : ''})
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
                <p className="text-muted-foreground text-sm">No visible logs found.</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Screen</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Sleep</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Brightness</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Symptoms</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Risk Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {visibleLogs.map(log => (
                          <tr
                            key={log.id}
                            className={`transition-colors ${
                              log.hidden_by_admin ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/40'
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
                            <td className="px-4 py-3 text-muted-foreground font-mono">{log.screen_time}h</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">{log.sleep_hours}h</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">{log.brightness}%</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                              {activeSymptoms(log)}
                            </td>
                            <td className="px-4 py-3">
                              {log.risk_level ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGES[log.risk_level] ?? 'bg-muted text-foreground'}`}>
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
            </section>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          FORMAL CLINICAL REPORT (Print / PDF Only - pure black & white, no UI clutter)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block p-8 bg-white text-black font-sans leading-normal max-w-4xl mx-auto">
        
        {/* Header Banner */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-black">
              EyeGuard Clinical Patient Intake Report
            </h1>
            <p className="text-xs text-gray-700 font-semibold mt-0.5">
              Standardized Computer Vision Syndrome (CVS) & Digital Eye Strain (DES) Assessment
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              Referencing AOA Clinical Guidelines & Validated CVS-Smart Diagnostic Criteria (Iqbal et al., 2024)
            </p>
          </div>
          <div className="text-right text-xs text-gray-700 space-y-0.5">
            <p className="font-bold text-black">CONFIDENTIAL MEDICAL DOCUMENT</p>
            <p>Date Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p>Evaluation Period: {logs[logs.length - 1]?.date ?? 'N/A'} to {logs[0]?.date ?? 'N/A'}</p>
          </div>
        </div>

        {/* Section 1: Patient Demographics */}
        <div className="mb-6 border border-gray-400 rounded p-4 bg-gray-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-gray-300 pb-1 mb-3">
            1. Patient Identification & Demographics
          </h2>
          <div className="grid grid-cols-3 gap-y-2 text-xs">
            <div><span className="font-semibold text-gray-700">Patient Name:</span> <span className="font-bold text-black">{patientName}</span></div>
            <div><span className="font-semibold text-gray-700">Email/Identifier:</span> <span>{userEmail ?? 'N/A'}</span></div>
            <div><span className="font-semibold text-gray-700">Age / Gender:</span> <span>{patientAge} yrs / {patientGender}</span></div>
            <div><span className="font-semibold text-gray-700">Academic Major:</span> <span>{patientMajor}</span></div>
            <div><span className="font-semibold text-gray-700">Academic Level:</span> <span>{patientYear}</span></div>
            <div><span className="font-semibold text-gray-700">Total Evaluations:</span> <span className="font-bold text-black">{logs.length} sessions recorded</span></div>
          </div>
        </div>

        {/* Section 2: Longitudinal Exposure & Diagnostic Stratification */}
        <div className="mb-6 grid grid-cols-4 gap-3 text-center">
          <div className="border border-gray-300 p-2.5 rounded">
            <p className="text-[10px] uppercase font-bold text-gray-600">Daily Screen Exposure</p>
            <p className="text-xl font-bold text-black mt-1">{avgScreenTime} <span className="text-xs font-normal">hrs/day</span></p>
            <p className="text-[9px] text-gray-500 mt-0.5">{Number(avgScreenTime) > 6 ? '⚠️ Exceeds safe ergonomic limit' : 'Normal exposure range'}</p>
          </div>
          <div className="border border-gray-300 p-2.5 rounded">
            <p className="text-[10px] uppercase font-bold text-gray-600">Average Sleep Recovery</p>
            <p className="text-xl font-bold text-black mt-1">{avgSleepHours} <span className="text-xs font-normal">hrs/night</span></p>
            <p className="text-[9px] text-gray-500 mt-0.5">{Number(avgSleepHours) < 7 ? '⚠️ Below optimal eye repair threshold' : 'Adequate tear repair'}</p>
          </div>
          <div className="border border-gray-300 p-2.5 rounded">
            <p className="text-[10px] uppercase font-bold text-gray-600">CVS-Smart Severity Score</p>
            <p className="text-xl font-bold text-black mt-1">{cvsqScore != null ? `${cvsqScore}/10` : '—'}</p>
            <p className="text-[9px] font-semibold text-black mt-0.5">{cvsqStatus}</p>
          </div>
          <div className="border border-gray-300 p-2.5 rounded">
            <p className="text-[10px] uppercase font-bold text-gray-600">High / Critical Incidence</p>
            <p className="text-xl font-bold text-black mt-1">{highRiskPct}%</p>
            <p className="text-[9px] text-gray-500 mt-0.5">{highRiskCount} out of {n} days flagged high risk</p>
          </div>
        </div>

        {/* Section 3: Baseline Ergonomic & Environmental Setup */}
        <div className="mb-6 border border-gray-400 rounded p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-gray-300 pb-1 mb-3">
            2. Ergonomic & Optical Workstation Baseline
          </h2>
          <div className="grid grid-cols-3 gap-y-2 text-xs">
            <div><span className="font-semibold text-gray-700">Primary Device:</span> <span>{latestLog?.primary_device ?? latestSurvey?.eg_primary_device ?? 'Laptop / Monitor'}</span></div>
            <div><span className="font-semibold text-gray-700">Viewing Distance:</span> <span>{latestLog?.screen_distance ?? latestSurvey?.eg_screen_distance ?? '40-60 cm'}</span></div>
            <div><span className="font-semibold text-gray-700">Display Brightness:</span> <span>{latestLog?.screen_brightness ?? `${latestLog?.brightness ?? 50}%`}</span></div>
            <div><span className="font-semibold text-gray-700">Continuous Screen Use:</span> <span>{latestLog?.continuous_screen_use ?? latestSurvey?.eg_continuous_screen_use ?? '1-2 hours'}</span></div>
            <div><span className="font-semibold text-gray-700">20-20-20 Rule Compliance:</span> <span>{latestLog?.follows_20_20_20 ?? latestSurvey?.eg_follows_20_20_20 ?? 'Rarely / Sometimes'}</span></div>
            <div><span className="font-semibold text-gray-700">Dark Room Usage:</span> <span>{latestLog?.dark_room_use ?? latestSurvey?.eg_dark_room_use ?? 'Sometimes'}</span></div>
            <div><span className="font-semibold text-gray-700">Wears Eyeglasses:</span> <span>{latestLog?.wears_glasses ?? latestSurvey?.eg_wears_glasses ?? 'No'}</span></div>
            <div><span className="font-semibold text-gray-700">Blue-Light Blocking Filter:</span> <span>{latestLog?.blue_light_filter ?? latestSurvey?.eg_blue_light_filter ?? 'Yes'}</span></div>
            <div><span className="font-semibold text-gray-700">Break Frequency:</span> <span>{latestLog?.break_frequency ?? latestSurvey?.eg_break_frequency ?? 'Every 1-2 hours'}</span></div>
          </div>
        </div>

        {/* Section 4: Longitudinal Symptom Manifestation Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black mb-2">
            3. Longitudinal Physiological & Symptom Logs (All Records)
          </h2>
          <table className="w-full border-collapse border border-gray-400 text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400 text-left font-bold text-gray-800">
                <th className="border-r border-gray-400 p-2 w-24">Date</th>
                <th className="border-r border-gray-400 p-2 w-20 text-center">Screen</th>
                <th className="border-r border-gray-400 p-2 w-20 text-center">Sleep</th>
                <th className="border-r border-gray-400 p-2 w-20 text-center">Brightness</th>
                <th className="border-r border-gray-400 p-2">Reported Clinical Symptoms</th>
                <th className="p-2 w-24 text-center">Risk Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {logs.map((log) => {
                const syms = fullActiveSymptomsList(log)
                return (
                  <tr key={log.id} className="border-b border-gray-200">
                    <td className="border-r border-gray-400 p-2 font-mono font-bold text-black">{log.date}</td>
                    <td className="border-r border-gray-400 p-2 text-center font-mono">{log.screen_time} hrs</td>
                    <td className="border-r border-gray-400 p-2 text-center font-mono">{log.sleep_hours} hrs</td>
                    <td className="border-r border-gray-400 p-2 text-center font-mono">{log.brightness}%</td>
                    <td className="border-r border-gray-400 p-2 text-gray-800 leading-snug">
                      {syms.join(', ')}
                    </td>
                    <td className="p-2 text-center font-bold text-black">
                      {log.risk_level}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Section 5: Clinician / Optometrist Examination Worksheet */}
        <div className="border-2 border-black rounded p-4 break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-3 flex items-center justify-between">
            <span>4. Optometrist / Clinical Examination Notes & Assessment</span>
            <span className="text-[10px] font-normal text-gray-600">(For Attending Eye Care Practitioner)</span>
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs mb-3">
            <div className="border border-gray-300 p-2.5 rounded space-y-2">
              <p className="font-bold text-gray-800">Visual Acuity & Refractive Status:</p>
              <div className="space-y-1 text-gray-600">
                <p>Unaided VA: OD: _______________ OS: _______________</p>
                <p>Subjective Refraction: OD: _______________ OS: _______________</p>
                <p>Accommodative Amplitude / Lag (FCC): _______________</p>
                <p>Near Point of Convergence (NPC): _______________</p>
              </div>
            </div>

            <div className="border border-gray-300 p-2.5 rounded space-y-2">
              <p className="font-bold text-gray-800">Ocular Surface & Tear Film Evaluation:</p>
              <div className="space-y-1 text-gray-600">
                <p>Tear Break-Up Time (TBUT): OD: _____ sec &nbsp; OS: _____ sec</p>
                <p>Corneal / Conjunctival Staining: [ ] None [ ] Mild [ ] Moderate</p>
                <p>Meibomian Gland Dysfunction (MGD): [ ] Grade 0-1 [ ] Grade 2-3</p>
                <p>Schirmer Test (if indicated): OD: _____ mm &nbsp; OS: _____ mm</p>
              </div>
            </div>
          </div>

          <div className="border border-gray-300 p-2.5 rounded text-xs mb-4">
            <p className="font-bold text-gray-800 mb-1.5">Recommended Clinical Treatment & Management Plan:</p>
            <div className="grid grid-cols-3 gap-2 text-gray-700">
              <div>[ ] Refractive Correction / New Rx</div>
              <div>[ ] Computer / Anti-Fatigue Lenses</div>
              <div>[ ] Lubricant Eye Drops (PF)</div>
              <div>[ ] Blue-Light Filtering Lenses</div>
              <div>[ ] 20-20-20 Ergonomic Protocol</div>
              <div>[ ] Follow-up in: ____________</div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-gray-500">Clinician Notes / Observations:</p>
              <div className="h-10 border-b border-dotted border-gray-400 mt-4" />
            </div>
          </div>

          {/* Signature Row */}
          <div className="grid grid-cols-3 gap-6 text-xs pt-2">
            <div>
              <p className="text-gray-500 text-[10px]">Attending Optometrist / Clinician:</p>
              <div className="border-b border-black mt-6" />
              <p className="text-[10px] text-gray-600 mt-1">Printed Name & Clinic Name</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Professional License Number:</p>
              <div className="border-b border-black mt-6" />
              <p className="text-[10px] text-gray-600 mt-1">PRC / Optometry Board Reg. No.</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Signature & Date:</p>
              <div className="border-b border-black mt-6" />
              <p className="text-[10px] text-gray-600 mt-1">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <p className="text-[9px] text-gray-500 text-center mt-4">
          EyeGuard Student Eye Health Monitoring System — Non-Diagnostic Clinical Decision Support Tool. 
          Generated for academic & clinical evaluation purposes.
        </p>

      </div>
    </MainLayout>
  )
}
