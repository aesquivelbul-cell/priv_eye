import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { NextResponse } from 'next/server'

export async function GET() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let adminClient
  try {
    adminClient = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ── Fetch both data sources in parallel ────────────────────────────────────
  const [logsRes, surveyRes] = await Promise.all([
    adminClient
      .from('daily_logs')
      .select('user_id, email, screen_time, risk_level, eye_strain, headaches, blurry_vision, dry_eyes, source'),
    adminClient
      .from('survey_responses')
      .select(
        'email, eg_academic_screen_time, eg_non_academic_screen_time, ' +
        'sym_dry_eyes, sym_blurred_vision, sym_headaches, sym_eye_irritation, ' +
        'sym_mental_fatigue, sym_neck_shoulder_pain, sym_difficulty_focusing, ' +
        'sym_light_sensitivity, sym_eye_itchiness, ' +
        'cvsq_total, cvsq_status, ' +
        'eg_overall_eye_strain'
      ),
  ])

  const logs    = logsRes.data   ?? []
  const surveys = (surveyRes.data ?? []) as Array<Record<string, any>>

  // ── Helper: map categorical screen time to hours ───────────────────────────
  const acadMap: Record<string, number> = {
    'Less than 2 hours': 1, '2–4 hours': 3, '4–6 hours': 5,
    '6–8 hours': 7, 'More than 8 hours': 9,
  }
  const nonAcadMap: Record<string, number> = {
    'Less than 1 hour': 0.5, '1–3 hours': 2, '3–5 hours': 4,
    '5–7 hours': 6, 'More than 7 hours': 8,
  }
  const symScale: Record<string, number> = {
    Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4,
  }

  // ── Detect if survey responses were already migrated into daily_logs ──────
  // If daily_logs has rows with source='survey' or user_id=null, the survey respondents
  // are already present in daily_logs and must NOT be added a second time.
  const isSurveyMigrated = logs.some((l) => !l.user_id || l.source === 'survey')

  const registeredUserIds = new Set(logs.filter((l) => l.user_id).map((l) => l.user_id))
  const migratedSurveyLogs = logs.filter((l) => !l.user_id || l.source === 'survey')

  const surveyRespondents = surveys.length
  const dailyRespondents  = registeredUserIds.size

  // Total deduplicated respondents: registered app users + survey participants
  const totalRespondents = isSurveyMigrated
    ? registeredUserIds.size + migratedSurveyLogs.length
    : (() => {
        const surveyEmails = new Set(surveys.map((s) => s.email).filter(Boolean))
        const dailyEmails  = new Set(logs.map((l: any) => l.email).filter(Boolean))
        let overlap = 0
        surveyEmails.forEach((e) => { if (dailyEmails.has(e)) overlap++ })
        return dailyRespondents + surveyRespondents - overlap
      })()

  // ── Risk distribution ─────────────────────────────────────────────────────
  const riskCounts: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 }
  for (const log of logs) {
    const level = log.risk_level as string
    if (level in riskCounts) riskCounts[level]++
  }

  // Only supplement from survey_responses if survey rows have NOT yet been migrated to daily_logs
  if (!isSurveyMigrated) {
    for (const s of surveys) {
      const strain = s.eg_overall_eye_strain as string | null
      if (strain === 'None' || strain === 'Mild') riskCounts.Low++
      else if (strain === 'Moderate') riskCounts.Moderate++
      else if (strain === 'Severe') riskCounts.High++
      else riskCounts.Low++
    }
  }

  const totalForRisk = Object.values(riskCounts).reduce((a, b) => a + b, 0) || 1
  const riskDistribution = {
    Low:      Math.round((riskCounts.Low      / totalForRisk) * 1000) / 10,
    Moderate: Math.round((riskCounts.Moderate / totalForRisk) * 1000) / 10,
    High:     Math.round((riskCounts.High     / totalForRisk) * 1000) / 10,
    Critical: Math.round((riskCounts.Critical / totalForRisk) * 1000) / 10,
  }

  // ── Average screen time ───────────────────────────────────────────────────
  const dailyScreenTimes  = logs.map((l) => Number(l.screen_time) || 0)
  const surveyScreenTimes = isSurveyMigrated ? [] : surveys.map((s) => {
    const a = acadMap[s.eg_academic_screen_time as string] ?? 0
    const n = nonAcadMap[s.eg_non_academic_screen_time as string] ?? 0
    return a + n
  })
  const allScreenTimes = [...dailyScreenTimes, ...surveyScreenTimes].filter((h) => h > 0)
  const averageScreenTime = allScreenTimes.length > 0
    ? Math.round((allScreenTimes.reduce((a, b) => a + b, 0) / allScreenTimes.length) * 10) / 10
    : 0

  // ── Top symptoms ──────────────────────────────────────────────────────────
  const symptomCountsMap: Record<string, number> = {
    eye_strain: 0, headaches: 0, blurry_vision: 0, dry_eyes: 0,
  }
  for (const log of logs) {
    if (log.eye_strain    === 1) symptomCountsMap.eye_strain++
    if (log.headaches     === 1) symptomCountsMap.headaches++
    if (log.blurry_vision === 1) symptomCountsMap.blurry_vision++
    if (log.dry_eyes      === 1) symptomCountsMap.dry_eyes++
  }

  if (!isSurveyMigrated) {
    for (const s of surveys) {
      if (symScale[s.sym_blurred_vision as string] >= 2) symptomCountsMap.blurry_vision++
      if (symScale[s.sym_headaches      as string] >= 2) symptomCountsMap.headaches++
      if (symScale[s.sym_dry_eyes       as string] >= 2) symptomCountsMap.dry_eyes++
      if (symScale[s.sym_eye_irritation as string] >= 2) symptomCountsMap.eye_strain++
    }
  }

  const topSymptoms = Object.entries(symptomCountsMap)
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)

  // ── CVSQ distribution from survey_responses ────────────────────────────────
  const cvsqDistribution: Record<string, number> = {
    'Positive CVS Case': 0,
    'High Probability': 0,
    'Low Probability': 0,
    'Not a CVS Case': 0,
    'Normal': 0,
  }
  let cvsqTotalSum = 0
  let cvsqCount    = 0
  for (const s of surveys) {
    const status = s.cvsq_status as string | null
    if (status && status in cvsqDistribution) {
      cvsqDistribution[status]++
    }
    if (s.cvsq_total != null) {
      cvsqTotalSum += Number(s.cvsq_total)
      cvsqCount++
    }
  }
  const avgCvsqScore = cvsqCount > 0 ? Math.round((cvsqTotalSum / cvsqCount) * 10) / 10 : null

  return NextResponse.json({
    totalRespondents,
    dailyRespondents,
    surveyRespondents,
    riskDistribution,
    averageScreenTime,
    topSymptoms,
    cvsqDistribution,
    avgCvsqScore,
    registeredUserCount: distinctUserIds.size,
    surveyRespondentCount: surveyRespondents,
  })
}
