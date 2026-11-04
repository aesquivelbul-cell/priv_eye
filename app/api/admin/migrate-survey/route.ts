/**
 * POST /api/admin/migrate-survey
 *
 * Converts every row in survey_responses into a real daily_logs row + a
 * predictions row, using the exact same JS scoring pipeline as
 * /api/predict-supabase. Survey rows that have already been migrated
 * (checked via a `migrated_to_log_id` column on survey_responses, or a
 * simple existence check) are skipped.
 *
 * Idempotent: safe to run multiple times — existing logs are never overwritten.
 */

import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'

// ── Scoring helpers (ported directly from app/api/predict-supabase/route.ts) ──

const SYM_FREQ_MAP: Record<string, number> = {
  Never: 0, Rarely: 0.5, Sometimes: 1.0, Often: 1.5, Always: 2.0,
  'Rarely (1-2 times a week)':    0.5,
  'Sometimes (3-4 times a week)': 1.0,
  'Often (5-6 times a week)':     1.5,
  'Always (every day)':           2.0,
}

function symFreq(val: string | null | undefined): number {
  return SYM_FREQ_MAP[val ?? ''] ?? 0
}

function brightnessToNumber(val: string | null | undefined): number {
  const map: Record<string, number> = {
    'Low (0–25%)':          15,
    'Medium (26–50%)':      40,
    'Medium-High (51–75%)': 65,
    'High (76–100%)':       90,
  }
  if (!val) return 50
  if (map[val] !== undefined) return map[val]
  const n = parseInt(val)
  return isNaN(n) ? 50 : n
}

function decodeScreenTime(
  academic: string | null | undefined,
  nonAcademic: string | null | undefined,
): number {
  const aMap: Record<string, number> = {
    'Less than 2 hours': 1, '2–4 hours': 3, '4–6 hours': 5,
    '6–8 hours': 7, 'More than 8 hours': 8,
  }
  const nMap: Record<string, number> = {
    'Less than 1 hour': 0.5, '1–3 hours': 2, '3–5 hours': 4,
    '5–7 hours': 5.5, 'More than 7 hours': 6,
  }
  const a = aMap[academic ?? ''] ?? 0
  const n = nMap[nonAcademic ?? ''] ?? 0
  return Math.min(a + n, 12)
}

function computeCvsqFromRaw(
  q1Raw: string | null, q2Raw: string | null, q3Raw: string | null,
  q4: string | null, q5: string | null,
) {
  const count = (raw: string | null) =>
    raw ? raw.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none').length : 0

  const q1 = Math.min(count(q1Raw), 2)
  const q2 = Math.min(count(q2Raw), 2)
  const q3 = Math.min(count(q3Raw), 2)
  const q4s = ({ Rare: 0, Infrequent: 1, Frequent: 2 } as Record<string, number>)[q4 ?? ''] ?? 0
  const q5s = ({ Never: 0, Sometimes: 1, Always: 2 } as Record<string, number>)[q5 ?? ''] ?? 0
  const total = q1 + q2 + q3 + q4s + q5s

  const status =
    total >= 7 ? 'Positive CVS Case' :
    total >= 5 ? 'High Probability'  :
    total >= 3 ? 'Low Probability'   :
    total >= 1 ? 'Not a CVS Case'    : 'Normal'

  return { q1, q2, q3, q4: q4s, q5: q5s, total, status }
}

function scoreRow(sr: Record<string, unknown>) {
  const s = (k: string) => (sr[k] as string | null) ?? null

  const screenTime  = decodeScreenTime(s('eg_academic_screen_time'), s('eg_non_academic_screen_time'))
  const sleepHours  = parseFloat(s('eg_sleep_hours') ?? '') || 7
  const brightness  = brightnessToNumber(s('eg_screen_brightness'))

  // Symptom frequencies
  const eyeStrainFreq    = symFreq(s('sym_blurred_vision'))   // aliased like predict-supabase
  const blurryVisionFreq = symFreq(s('sym_blurred_vision'))
  const headachesFreq    = symFreq(s('sym_headaches'))
  const dryEyesFreq      = symFreq(s('sym_dry_eyes'))
  const eyeItchinessFreq       = symFreq(s('sym_eye_itchiness'))
  const eyeIrritationFreq      = symFreq(s('sym_eye_irritation'))
  const lightSensitivityFreq   = symFreq(s('sym_light_sensitivity'))
  const difficultyFocusingFreq = symFreq(s('sym_difficulty_focusing'))
  const neckShoulderPainFreq   = symFreq(s('sym_neck_shoulder_pain'))
  const mentalFatigueFreq      = symFreq(s('sym_mental_fatigue'))
  const difficultyConcentFreq  = symFreq(s('sym_difficulty_concentrating'))

  // Symptom score (0–60)
  const cvqRawScore =
    eyeStrainFreq    * 2.0 + blurryVisionFreq * 2.0 + headachesFreq    * 1.0 +
    dryEyesFreq      * 1.5 + eyeIrritationFreq * 1.5 + lightSensitivityFreq * 1.0 +
    difficultyFocusingFreq * 1.0 + neckShoulderPainFreq * 0.5 +
    mentalFatigueFreq * 1.0 + difficultyConcentFreq * 0.5 + eyeItchinessFreq * 0.5
  const symptomScore = (cvqRawScore / 14) * 60

  // Environmental modifiers
  let screenMod = 0
  if (screenTime >= 2 && screenTime <= 6) screenMod = ((screenTime - 2) / 4) * 20
  else if (screenTime > 6) screenMod = 20 + (Math.min(screenTime - 6, 6) / 6) * 15

  let sleepMod = 0
  if      (sleepHours < 5)  sleepMod = 15
  else if (sleepHours < 6)  sleepMod = 10
  else if (sleepHours < 7)  sleepMod = 5
  else if (sleepHours <= 9) sleepMod = 0
  else                      sleepMod = 2

  let brightnessMod = 0
  if      (brightness < 40) brightnessMod = Math.min(((40 - brightness) / 10) * 2, 8)
  else if (brightness > 80) brightnessMod = Math.min(((brightness - 80) / 10) * 2, 8)

  const darkRoomMod = ({ Always: 10, Sometimes: 5, Rarely: 1, Never: 0 } as Record<string, number>)[s('eg_dark_room_use') ?? ''] ?? 0
  const rule202020Mod = ({ Always: -10, Sometimes: -5, Rarely: -2, Never: 0 } as Record<string, number>)[s('eg_follows_20_20_20') ?? ''] ?? 0
  const breakMod = ({
    'Every 20 minutes': -12, 'Every 30–60 minutes': -7,
    'Every 1–2 hours': -3, 'Rarely take breaks': 0,
  } as Record<string, number>)[s('eg_break_frequency') ?? ''] ?? 0
  const blueLightMod = ({ Always: -5, Regularly: -3, Sometimes: -1, Never: 0 } as Record<string, number>)[s('eg_blue_light_filter') ?? ''] ?? 0
  const blueGlassesMod = ({ Always: -4, Sometimes: -2, Rarely: -1, Never: 0 } as Record<string, number>)[s('eg_blue_light_glasses') ?? ''] ?? 0

  const totalModifier = screenMod + sleepMod + brightnessMod + darkRoomMod +
                        rule202020Mod + breakMod + blueLightMod + blueGlassesMod

  // EyeGuard risk score
  let riskScore = symptomScore === 0
    ? Math.max(0, Math.min(40, totalModifier))
    : Math.max(0, Math.min(100, symptomScore + totalModifier))
  riskScore = parseFloat(riskScore.toFixed(1))

  // EyeGuard risk level (int 0–3)
  const riskLevel = riskScore < 25 ? 0 : riskScore < 50 ? 1 : riskScore < 75 ? 2 : 3

  // CVSQ
  const cvsq = computeCvsqFromRaw(
    s('cvsq_q1_visual_raw'), s('cvsq_q2_ocular_raw'), s('cvsq_q3_extraocular_raw'),
    s('cvsq_q4_frequency'),  s('cvsq_q5_screen_associated'),
  )

  // Overall 60/40 blend
  const cvsqNorm = (cvsq.total / 10) * 100
  let overallScore = parseFloat((riskScore * 0.60 + cvsqNorm * 0.40).toFixed(1))
  if (cvsq.total <= 2) overallScore = Math.min(overallScore, 49.0)
  if (cvsq.total >= 7) overallScore = Math.max(overallScore, 50.0)
  overallScore = parseFloat(overallScore.toFixed(1))
  const overallLevel = overallScore < 25 ? 0 : overallScore < 50 ? 1 : overallScore < 75 ? 2 : 3
  const OVERALL_STATUS = ['Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk'] as const
  const overallStatus = OVERALL_STATUS[overallLevel]

  // Concordance
  let concordant = false
  if      (cvsq.total >= 7) concordant = overallLevel >= 2
  else if (cvsq.total >= 5) concordant = overallLevel >= 1
  else if (cvsq.total >= 3) concordant = overallLevel <= 1
  else                      concordant = overallLevel === 0
  const concordance_scenario =
    concordant ? 'agree' :
    cvsq.total >= 5 && overallLevel <= 1 ? 'cvsq_high_eyeguard_low' :
    cvsq.total <= 2 && overallLevel >= 2 ? 'cvsq_low_eyeguard_high' : 'discordant'

  // Fatigue score
  const symptomFatigue  = (cvqRawScore / 14) * 5
  const screenFatigue   = Math.min(screenTime / 3, 2.5)
  const sleepFatigue    = sleepHours < 6 ? 1.5 : sleepHours < 7 ? 0.8 : 0
  const breakFatigue    = s('eg_break_frequency') === 'Rarely take breaks' ? 1.0
                        : s('eg_break_frequency') === 'Every 1–2 hours' ? 0.5 : 0
  const fatigueScore = parseFloat(Math.min(10, Math.max(0, symptomFatigue + screenFatigue + sleepFatigue + breakFatigue)).toFixed(1))

  const RISK_LABELS = ['Low', 'Moderate', 'High', 'Critical'] as const

  // Binary legacy symptom columns
  const toArr = (raw: string | null) =>
    raw ? raw.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none') : []

  return {
    screenTime, sleepHours, brightness, riskScore, riskLevel,
    fatigueScore,
    cvsq,
    overallScore, overallLevel, overallStatus,
    concordant, concordance_scenario,
    riskLabel: RISK_LABELS[riskLevel],
    // legacy binaries
    eye_strain:    eyeStrainFreq    > 0 ? 1 : 0,
    eye_strain_frequency:    s('sym_blurred_vision'),
    headaches:     headachesFreq    > 0 ? 1 : 0,
    headaches_frequency:     s('sym_headaches'),
    blurry_vision: blurryVisionFreq > 0 ? 1 : 0,
    blurry_vision_frequency: s('sym_blurred_vision'),
    dry_eyes:      dryEyesFreq      > 0 ? 1 : 0,
    dry_eyes_frequency:      s('sym_dry_eyes'),
    // CVSQ arrays as JSON strings
    cvsq_visual_complaints:      JSON.stringify(toArr(s('cvsq_q1_visual_raw'))),
    cvsq_ocular_complaints:      JSON.stringify(toArr(s('cvsq_q2_ocular_raw'))),
    cvsq_extraocular_complaints: JSON.stringify(toArr(s('cvsq_q3_extraocular_raw'))),
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {
  // Auth guard
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

  // ── 1. Fetch all survey_responses ─────────────────────────────────────────
  const { data: surveyRows, error: fetchError } = await adminClient
    .from('survey_responses')
    .select('*')
    .order('response_timestamp', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch survey responses: ' + fetchError.message }, { status: 500 })
  }

  const rows = (surveyRows ?? []) as Record<string, unknown>[]
  if (rows.length === 0) {
    return NextResponse.json({ migrated: 0, skipped: 0, errors: [], message: 'No survey responses found.' })
  }

  // ── 2. Get set of already-migrated (email, date) pairs to skip duplicates ──
  const { data: existingLogs } = await adminClient
    .from('daily_logs')
    .select('id, email, date')
    .is('user_id', null)

  // Build a map of email::date -> log id so we can insert missing predictions
  const existingLogMap = new Map<string, string>(
    (existingLogs ?? []).map((l: Record<string, unknown>) => [`${l.email}::${l.date}`, l.id as string])
  )

  // Find which existing survey logs are missing a prediction
  const existingLogIds = (existingLogs ?? []).map((l: Record<string, unknown>) => l.id as string)
  const existingWithPred = new Set<string>()
  if (existingLogIds.length > 0) {
    const { data: existingPreds } = await adminClient
      .from('predictions')
      .select('daily_log_id')
      .in('daily_log_id', existingLogIds)
    for (const p of existingPreds ?? []) {
      existingWithPred.add((p as Record<string, unknown>).daily_log_id as string)
    }
  }

  // ── 3. Process each row ───────────────────────────────────────────────────
  let migrated = 0
  let skipped  = 0
  const errors: string[] = []

  // Default recommendations used for all survey rows
  const defaultRecommendations = [
    { title: 'Follow the 20-20-20 rule', description: 'Every 20 minutes, look at something 20 feet away for 20 seconds.', category: 'screen_time' },
    { title: 'Adjust screen brightness', description: 'Keep brightness at 60–80% to reduce eye fatigue.', category: 'brightness' },
    { title: 'Get 7–9 hours of sleep', description: 'Adequate sleep is essential for eye recovery.', category: 'sleep' },
  ]

  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)

    for (const sr of batch) {
      const s = (k: string) => (sr[k] as string | null) ?? null

      const email = s('email')
      const ts    = s('response_timestamp')
      const date  = ts ? ts.split('T')[0] : new Date().toISOString().split('T')[0]
      const key   = `${email}::${date}`

      const scores = scoreRow(sr)

      const insertPrediction = async (logId: string) => {
        const predRow = {
          daily_log_id:    logId,
          risk_level:      scores.riskLevel,
          risk_percentage: scores.riskScore,
          fatigue_score:   scores.fatigueScore,
          confidence:      0.65,
          recommendations: defaultRecommendations,
        }
        const { error: predError } = await adminClient
          .from('predictions')
          .insert(predRow)
        if (predError) {
          errors.push(`Row (${email} @ ${date}): prediction insert failed — ${predError.message}`)
        }
      }

      // Case 1 — log already exists but is missing a prediction
      if (existingLogMap.has(key)) {
        const logId = existingLogMap.get(key)!
        if (!existingWithPred.has(logId)) {
          try {
            await insertPrediction(logId)
            migrated++
          } catch (err) {
            errors.push(`Row (${email} @ ${date}): ${err instanceof Error ? err.message : String(err)}`)
          }
        } else {
          skipped++
        }
        continue
      }

      // Case 2 — new row, insert both log and prediction
      try {

        // ── Insert daily_log ────────────────────────────────────────────────
        const logRow = {
          // No user_id — survey respondents have no auth account
          date,
          email,
          age:            s('eg_age'),
          gender:         s('eg_gender'),
          year_level:     s('eg_year_level'),
          field_of_study: s('eg_field_of_study'),
          academic_screen_time:     s('eg_academic_screen_time'),
          non_academic_screen_time: s('eg_non_academic_screen_time'),
          screen_time:              scores.screenTime,
          primary_device:           s('eg_primary_device'),
          continuous_screen_use:    s('eg_continuous_screen_use'),
          online_classes_per_day:   s('eg_online_classes_per_day'),
          follows_20_20_20:     s('eg_follows_20_20_20'),
          blue_light_filter:    s('eg_blue_light_filter'),
          screen_brightness:    s('eg_screen_brightness'),
          brightness:           scores.brightness,
          dark_room_use:        s('eg_dark_room_use'),
          screen_distance:      s('eg_screen_distance'),
          wears_glasses:        s('eg_wears_glasses'),
          blue_light_glasses:   s('eg_blue_light_glasses'),
          break_frequency:      s('eg_break_frequency'),
          sleep_hours:          scores.sleepHours,
          // Symptom grid
          sym_dry_eyes:                 s('sym_dry_eyes'),
          sym_eye_itchiness:            s('sym_eye_itchiness'),
          sym_blurred_vision:           s('sym_blurred_vision'),
          sym_headaches:                s('sym_headaches'),
          sym_eye_irritation:           s('sym_eye_irritation'),
          sym_light_sensitivity:        s('sym_light_sensitivity'),
          sym_difficulty_focusing:      s('sym_difficulty_focusing'),
          sym_neck_shoulder_pain:       s('sym_neck_shoulder_pain'),
          sym_mental_fatigue:           s('sym_mental_fatigue'),
          sym_difficulty_concentrating: s('sym_difficulty_concentrating'),
          // Self-assessment
          overall_eye_strain:        s('eg_overall_eye_strain'),
          digital_fatigue_frequency: s('eg_digital_fatigue_frequency'),
          primary_symptom_history:   s('eg_primary_symptom_history'),
          // CVSQ raw
          cvsq_visual_complaints:       scores.cvsq_visual_complaints,
          cvsq_ocular_complaints:       scores.cvsq_ocular_complaints,
          cvsq_extraocular_complaints:  scores.cvsq_extraocular_complaints,
          cvsq_frequency:               s('cvsq_q4_frequency'),
          cvsq_screen_associated:       s('cvsq_q5_screen_associated'),
          // Legacy binary symptoms
          eye_strain:              scores.eye_strain,
          eye_strain_frequency:    scores.eye_strain_frequency,
          headaches:               scores.headaches,
          headaches_frequency:     scores.headaches_frequency,
          blurry_vision:           scores.blurry_vision,
          blurry_vision_frequency: scores.blurry_vision_frequency,
          dry_eyes:                scores.dry_eyes,
          dry_eyes_frequency:      scores.dry_eyes_frequency,
          // Risk
          risk_level: scores.riskLabel,
        }

        const { data: insertedLog, error: logError } = await adminClient
          .from('daily_logs')
          .insert(logRow)
          .select('id')
          .single()

        if (logError) {
          errors.push(`Row (${email} @ ${date}): log insert failed — ${logError.message}`)
          continue
        }

        await insertPrediction(insertedLog.id)
        existingLogMap.set(key, insertedLog.id)
        migrated++
      } catch (err) {
        errors.push(`Row (${email} @ ${date}): ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return NextResponse.json({
    migrated,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 50), // cap error list for response size
    message: `Migrated ${migrated} rows, skipped ${skipped} already-existing rows.${errors.length > 0 ? ` ${errors.length} error(s).` : ''}`,
  })
}
