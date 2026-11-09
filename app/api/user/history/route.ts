import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let adminClient
  try {
    adminClient = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ── 1. Fetch daily_logs for this authenticated user ───────────────────────
  const { data: logs, error: logsError } = await adminClient
    .from('daily_logs')
    .select(
      'id, date, screen_time, sleep_hours, brightness, ' +
      'eye_strain, headaches, blurry_vision, dry_eyes, risk_level, hidden_by_admin, ' +
      'academic_screen_time, non_academic_screen_time, primary_device, ' +
      'continuous_screen_use, online_classes_per_day, ' +
      'follows_20_20_20, blue_light_filter, screen_brightness, dark_room_use, ' +
      'screen_distance, wears_glasses, blue_light_glasses, break_frequency, ' +
      'sym_dry_eyes, sym_eye_itchiness, sym_blurred_vision, sym_headaches, ' +
      'sym_eye_irritation, sym_light_sensitivity, sym_difficulty_focusing, ' +
      'sym_neck_shoulder_pain, sym_mental_fatigue, sym_difficulty_concentrating, ' +
      'overall_eye_strain, digital_fatigue_frequency, primary_symptom_history, ' +
      'cvsq_visual_complaints, cvsq_ocular_complaints, cvsq_extraocular_complaints, cvsq_frequency, cvsq_screen_associated'
    )
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (logsError) {
    console.error('Error fetching user daily_logs:', logsError)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // Compute CVSQ scores dynamically from complaint lists
  const computedLogs = (logs ?? []).map((l: any) => {
    let cvsq_score: number | null = null
    let cvsq_status: string | null = null

    try {
      if (l.cvsq_frequency || l.cvsq_screen_associated) {
        const parseList = (val: any) => {
          if (!val) return 0
          if (Array.isArray(val)) return Math.min(val.length, 2)
          try {
            const arr = JSON.parse(val)
            return Math.min(Array.isArray(arr) ? arr.length : 0, 2)
          } catch {
            return 0
          }
        }
        const q1 = parseList(l.cvsq_visual_complaints)
        const q2 = parseList(l.cvsq_ocular_complaints)
        const q3 = parseList(l.cvsq_extraocular_complaints)
        const freqMap: Record<string, number> = { 'Rare': 0, 'Infrequent': 1, 'Frequent': 2 }
        const scrMap: Record<string, number> = { 'Never': 0, 'Sometimes': 1, 'Always': 2 }
        const q4 = freqMap[l.cvsq_frequency] ?? 0
        const q5 = scrMap[l.cvsq_screen_associated] ?? 0
        const total = q1 + q2 + q3 + q4 + q5
        cvsq_score = total
        cvsq_status = total >= 7 ? 'Positive for CVS' : total >= 5 ? 'High Probability' : total >= 3 ? 'Low Probability' : 'Not a CVS Case'
      }
    } catch {
      /* non-fatal */
    }

    return { ...l, cvsq_score, cvsq_status }
  })

  // ── 2. Fetch survey_responses by email ────────────────────────────────────
  const email = user.email
  let surveyResponses: Record<string, unknown>[] = []

  if (email) {
    const { data: surveyRows } = await adminClient
      .from('survey_responses')
      .select([
        'response_timestamp', 'email', 'eg_age', 'eg_gender', 'eg_year_level', 'eg_field_of_study',
        'cvsq_q1_visual_raw', 'cvsq_q2_ocular_raw', 'cvsq_q3_extraocular_raw',
        'cvsq_q4_frequency', 'cvsq_q5_screen_associated', 'cvsq_total', 'cvsq_status',
        'eg_academic_screen_time', 'eg_non_academic_screen_time', 'eg_primary_device',
        'eg_continuous_screen_use', 'eg_online_classes_per_day',
        'eg_follows_20_20_20', 'eg_blue_light_filter', 'eg_screen_brightness',
        'eg_dark_room_use', 'eg_screen_distance', 'eg_wears_glasses', 'eg_blue_light_glasses',
        'eg_break_frequency', 'eg_sleep_hours',
        'sym_dry_eyes', 'sym_eye_itchiness', 'sym_blurred_vision', 'sym_headaches',
        'sym_eye_irritation', 'sym_light_sensitivity', 'sym_difficulty_focusing',
        'sym_neck_shoulder_pain', 'sym_mental_fatigue', 'sym_difficulty_concentrating',
        'eg_overall_eye_strain', 'eg_digital_fatigue_frequency', 'eg_primary_symptom_history',
      ].join(', '))
      .eq('email', email)
      .order('response_timestamp', { ascending: false })

    surveyResponses = (surveyRows as unknown as Record<string, unknown>[]) ?? []
  }

  return NextResponse.json({ logs: computedLogs, surveyResponses })
}
