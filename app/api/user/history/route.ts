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
      // extended fields stored on daily_logs (survey-style)
      'academic_screen_time, non_academic_screen_time, primary_device, ' +
      'continuous_screen_use, online_classes_per_day, ' +
      'follows_20_20_20, blue_light_filter, screen_brightness, dark_room_use, ' +
      'screen_distance, wears_glasses, blue_light_glasses, break_frequency, ' +
      'sym_dry_eyes, sym_eye_itchiness, sym_blurred_vision, sym_headaches, ' +
      'sym_eye_irritation, sym_light_sensitivity, sym_difficulty_focusing, ' +
      'sym_neck_shoulder_pain, sym_mental_fatigue, sym_difficulty_concentrating, ' +
      'overall_eye_strain, digital_fatigue_frequency, primary_symptom_history, ' +
      'cvsq_score, cvsq_status'
    )
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // ── 2. Always try to fetch survey_responses by email ─────────────────────
  // A user might have participated in the imported survey before registering.
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

  return NextResponse.json({ logs: logs ?? [], surveyResponses })
}
