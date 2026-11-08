import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { NextResponse } from 'next/server'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Maps the new Never/Rarely/Sometimes/Often/Always scale to 0–4. */
function symToScore(freq: string | null | undefined): number {
  const map: Record<string, number> = {
    'Never': 0, 'Rarely': 1, 'Sometimes': 2, 'Often': 3, 'Always': 4,
  }
  return map[freq ?? ''] ?? 0
}

/** Maps break_frequency string to a numeric score (higher = more breaks taken = better). */
function breakFreqToScore(freq: string | null | undefined): number {
  const map: Record<string, number> = {
    'Every 20 minutes':    4,
    'Every 30–60 minutes': 3,
    'Every 1–2 hours':     2,
    'Rarely take breaks':  0,
  }
  return map[freq ?? ''] ?? 1
}

/** Maps categorical screen time strings to numeric hours. */
function acadToHours(s: string | null | undefined): number {
  return ({ 'Less than 2 hours': 1, '2–4 hours': 3, '4–6 hours': 5, '6–8 hours': 7, 'More than 8 hours': 9 } as Record<string, number>)[s ?? ''] ?? 0
}
function nonAcadToHours(s: string | null | undefined): number {
  return ({ 'Less than 1 hour': 0.5, '1–3 hours': 2, '3–5 hours': 4, '5–7 hours': 6, 'More than 7 hours': 8 } as Record<string, number>)[s ?? ''] ?? 0
}

/** Maps sleep hours string to numeric. */
function sleepToHours(s: string | null | undefined): number {
  return ({ 'Less than 5 hours': 4.5, '5–6 hours': 5.5, '7–8 hours': 7.5, 'More than 8 hours': 8.5 } as Record<string, number>)[s ?? ''] ?? (Number(s) || 0)
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function delta(before: number, after: number): number {
  return parseFloat((after - before).toFixed(2))
}

function improvementStatus(
  screenDelta: number, sleepDelta: number,
  symptomDelta: number, riskDelta: number,
): 'Improved' | 'No Change' | 'Worsened' {
  // A meaningful drop of >= 5% in eye strain risk (e.g. Critical -> Moderate) directly marks an improvement
  if (riskDelta <= -5) return 'Improved'
  if (riskDelta >= 5)  return 'Worsened'

  let score = 0
  if (screenDelta  < -0.3) score += 1; else if (screenDelta  > 0.5)  score -= 1
  if (sleepDelta   > 0.2)  score += 1; else if (sleepDelta   < -0.3) score -= 1
  if (symptomDelta < -0.1) score += 1; else if (symptomDelta > 0.1)  score -= 1
  if (riskDelta    < -2)   score += 1; else if (riskDelta    > 2)    score -= 1
  if (score >= 2) return 'Improved'
  if (score <= -2) return 'Worsened'
  return 'No Change'
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
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

  // Fetch all registered-user logs with new questionnaire columns
  const { data: logs, error: logsError } = await adminClient
    .from('daily_logs')
    .select(`
      id, user_id, email, date,
      academic_screen_time, non_academic_screen_time, screen_time,
      sleep_hours,
      break_frequency,
      sym_eye_irritation,
      sym_headaches,
      sym_blurred_vision,
      sym_dry_eyes,
      sym_mental_fatigue,
      sym_neck_shoulder_pain,
      sym_difficulty_focusing,
      sym_light_sensitivity,
      sym_eye_itchiness,
      overall_eye_strain,
      risk_level
    `)
    .not('user_id', 'is', null)
    .order('date', { ascending: true })

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // Fetch risk_percentage from predictions for each log
  const logIds = (logs ?? []).map((l: any) => l.id)
  const predMap: Record<string, number> = {}
  if (logIds.length > 0) {
    const { data: preds } = await adminClient
      .from('predictions')
      .select('daily_log_id, risk_percentage')
      .in('daily_log_id', logIds)
    for (const p of preds ?? []) {
      predMap[p.daily_log_id] = Number(p.risk_percentage) || 0
    }
  }

  // Fetch user profiles
  const userIds = [...new Set((logs ?? []).map((l: any) => l.user_id))]
  const { data: profiles } = await adminClient
    .from('user_profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds)
  const profileMap: Record<string, { firstName: string; lastName: string }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.user_id] = { firstName: p.first_name ?? '', lastName: p.last_name ?? '' }
  }

  // Group logs by user
  const byUser = new Map<string, any[]>()
  for (const log of logs ?? []) {
    if (!byUser.has(log.user_id)) byUser.set(log.user_id, [])
    byUser.get(log.user_id)!.push(log)
  }

  const results: any[] = []

  for (const [userId, userLogs] of byUser) {
    if (userLogs.length < 2) continue

    let beforeLogs: any[], recentLogs: any[]
    if (userLogs.length >= 14) {
      recentLogs = userLogs.slice(-7); beforeLogs = userLogs.slice(-14, -7)
    } else if (userLogs.length >= 4) {
      const split = Math.floor(userLogs.length / 2)
      beforeLogs = userLogs.slice(0, split); recentLogs = userLogs.slice(split)
    } else {
      beforeLogs = [userLogs[0]]; recentLogs = userLogs.slice(1)
    }

    // ── Screen time ──────────────────────────────────────────────────────────
    // Use pre-computed screen_time if available, otherwise sum categorical
    const toScreenHours = (l: any) =>
      l.screen_time != null
        ? Number(l.screen_time) || 0
        : acadToHours(l.academic_screen_time) + nonAcadToHours(l.non_academic_screen_time)

    const beforeScreen = avg(beforeLogs.map(toScreenHours))
    const recentScreen = avg(recentLogs.map(toScreenHours))

    // ── Sleep ────────────────────────────────────────────────────────────────
    const toSleep = (l: any) =>
      typeof l.sleep_hours === 'number' ? l.sleep_hours : sleepToHours(l.sleep_hours)

    const beforeSleep = avg(beforeLogs.map(toSleep))
    const recentSleep = avg(recentLogs.map(toSleep))

    // ── Breaks ───────────────────────────────────────────────────────────────
    const beforeBreaks = avg(beforeLogs.map((l: any) => breakFreqToScore(l.break_frequency)))
    const recentBreaks = avg(recentLogs.map((l: any) => breakFreqToScore(l.break_frequency)))

    // ── Symptom burden (0–1 scale, weighted) ─────────────────────────────────
    // Weights: blurred vision & eye irritation (primary) × 2, others × 1; max raw = 2+2+1+1+1+1+1+1+1 = 12
    const symptomBurden = (ls: any[]) =>
      avg(ls.map(l => (
        (symToScore(l.sym_blurred_vision)       * 2) +
        (symToScore(l.sym_eye_irritation)        * 2) +
        (symToScore(l.sym_headaches)             * 1) +
        (symToScore(l.sym_dry_eyes)              * 1) +
        (symToScore(l.sym_mental_fatigue)        * 1) +
        (symToScore(l.sym_neck_shoulder_pain)    * 1) +
        (symToScore(l.sym_difficulty_focusing)   * 1) +
        (symToScore(l.sym_light_sensitivity)     * 1) +
        (symToScore(l.sym_eye_itchiness)         * 1)
      ) / 20)) // normalise to 0–1 (20 = all Always)

    const beforeSymptom = symptomBurden(beforeLogs)
    const recentSymptom = symptomBurden(recentLogs)

    // ── Per-symptom averages ──────────────────────────────────────────────────
    const beforeEyeStrain  = avg(beforeLogs.map((l: any) => symToScore(l.sym_eye_irritation)))
    const recentEyeStrain  = avg(recentLogs.map((l: any) => symToScore(l.sym_eye_irritation)))
    const beforeHeadaches  = avg(beforeLogs.map((l: any) => symToScore(l.sym_headaches)))
    const recentHeadaches  = avg(recentLogs.map((l: any) => symToScore(l.sym_headaches)))
    const beforeBlurry     = avg(beforeLogs.map((l: any) => symToScore(l.sym_blurred_vision)))
    const recentBlurry     = avg(recentLogs.map((l: any) => symToScore(l.sym_blurred_vision)))
    const beforeDryEyes    = avg(beforeLogs.map((l: any) => symToScore(l.sym_dry_eyes)))
    const recentDryEyes    = avg(recentLogs.map((l: any) => symToScore(l.sym_dry_eyes)))

    // ── Risk percentage from predictions ──────────────────────────────────────
    const beforeRisk = avg(beforeLogs.map((l: any) => predMap[l.id] ?? 0))
    const recentRisk = avg(recentLogs.map((l: any) => predMap[l.id] ?? 0))

    const latestLog = userLogs[userLogs.length - 1]
    const latestRiskLevel = latestLog.risk_level ?? 'Unknown'

    const screenDelta  = delta(beforeScreen,  recentScreen)
    const sleepDelta   = delta(beforeSleep,   recentSleep)
    const breaksDelta  = delta(beforeBreaks,  recentBreaks)
    const symptomDelta = delta(beforeSymptom, recentSymptom)
    const riskDelta    = delta(beforeRisk,    recentRisk)

    const status = improvementStatus(screenDelta, sleepDelta, symptomDelta, riskDelta)

    const profile = profileMap[userId]
    const displayName = (profile?.firstName || profile?.lastName)
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : null

    results.push({
      userId,
      email:         latestLog.email ?? '',
      displayName,
      totalLogs:     userLogs.length,
      firstLogDate:  userLogs[0].date,
      latestLogDate: latestLog.date,
      latestRiskLevel,
      status,
      before: {
        avgScreenTime:  parseFloat(beforeScreen.toFixed(1)),
        avgSleepHours:  parseFloat(beforeSleep.toFixed(1)),
        avgBreaks:      parseFloat(beforeBreaks.toFixed(1)),
        symptomBurden:  parseFloat((beforeSymptom * 100).toFixed(1)),
        riskPercentage: parseFloat(beforeRisk.toFixed(1)),
        eyeStrain:      parseFloat(beforeEyeStrain.toFixed(2)),
        headaches:      parseFloat(beforeHeadaches.toFixed(2)),
        blurryVision:   parseFloat(beforeBlurry.toFixed(2)),
        dryEyes:        parseFloat(beforeDryEyes.toFixed(2)),
        logCount:       beforeLogs.length,
      },
      recent: {
        avgScreenTime:  parseFloat(recentScreen.toFixed(1)),
        avgSleepHours:  parseFloat(recentSleep.toFixed(1)),
        avgBreaks:      parseFloat(recentBreaks.toFixed(1)),
        symptomBurden:  parseFloat((recentSymptom * 100).toFixed(1)),
        riskPercentage: parseFloat(recentRisk.toFixed(1)),
        eyeStrain:      parseFloat(recentEyeStrain.toFixed(2)),
        headaches:      parseFloat(recentHeadaches.toFixed(2)),
        blurryVision:   parseFloat(recentBlurry.toFixed(2)),
        dryEyes:        parseFloat(recentDryEyes.toFixed(2)),
        logCount:       recentLogs.length,
      },
      deltas: {
        screenTime:     screenDelta,
        sleepHours:     sleepDelta,
        breaks:         breaksDelta,
        symptomBurden:  parseFloat(symptomDelta.toFixed(3)),
        riskPercentage: riskDelta,
        eyeStrain:      parseFloat(delta(beforeEyeStrain, recentEyeStrain).toFixed(2)),
        headaches:      parseFloat(delta(beforeHeadaches, recentHeadaches).toFixed(2)),
        blurryVision:   parseFloat(delta(beforeBlurry, recentBlurry).toFixed(2)),
        dryEyes:        parseFloat(delta(beforeDryEyes, recentDryEyes).toFixed(2)),
      },
    })
  }

  const order = { Worsened: 0, 'No Change': 1, Improved: 2 }
  results.sort((a, b) => order[a.status as keyof typeof order] - order[b.status as keyof typeof order])

  const improved  = results.filter(r => r.status === 'Improved').length
  const worsened  = results.filter(r => r.status === 'Worsened').length
  const noChange  = results.filter(r => r.status === 'No Change').length
  const n         = results.length

  return NextResponse.json({
    users: results,
    summary: {
      total:       n,
      improved, worsened, noChange,
      improvedPct: n ? parseFloat(((improved / n) * 100).toFixed(1)) : 0,
      worsenedPct: n ? parseFloat(((worsened / n) * 100).toFixed(1)) : 0,
      avgRiskDelta:    parseFloat((n ? avg(results.map(r => r.deltas.riskPercentage)) : 0).toFixed(1)),
      avgScreenDelta:  parseFloat((n ? avg(results.map(r => r.deltas.screenTime))     : 0).toFixed(1)),
      avgSleepDelta:   parseFloat((n ? avg(results.map(r => r.deltas.sleepHours))     : 0).toFixed(1)),
      avgSymptomDelta: parseFloat((n ? avg(results.map(r => r.deltas.symptomBurden))  : 0).toFixed(1)),
    },
  })
}
