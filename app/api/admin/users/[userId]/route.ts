import { splitNameFromEmail } from '@/lib/name-utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { NextRequest, NextResponse } from 'next/server'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

  const { userId } = await params
  const isUuid = uuidRegex.test(userId)

  // Fetch full daily logs for this user with all ergonomic & symptom attributes
  const query = adminClient
    .from('daily_logs')
    .select(
      'id, date, email, user_id, age, gender, year_level, field_of_study, ' +
      'screen_time, sleep_hours, brightness, eye_strain, headaches, blurry_vision, dry_eyes, risk_level, hidden_by_admin, ' +
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
    .order('date', { ascending: false })
    .eq(isUuid ? 'user_id' : 'email', decodeURIComponent(userId))

  const { data: logs, error: logsError } = await query

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // Fallback to survey_responses if user has no daily logs
  if (!logs || logs.length === 0) {
    if (!isUuid) {
      const email = decodeURIComponent(userId)
      const { data: surveyRows, error: surveyError } = await adminClient
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

      if (!surveyError && surveyRows && surveyRows.length > 0) {
        const rows = surveyRows as unknown as Record<string, unknown>[]
        const latest = rows[0]
        const emailVal = (latest.email as string) ?? decodeURIComponent(userId)
        const defNames = splitNameFromEmail(emailVal)
        const profile = {
          email: emailVal,
          first_name: defNames.first_name,
          last_name: defNames.last_name,
          age: (latest.eg_age as number | string) ?? null,
          gender: (latest.eg_gender as string) ?? null,
          year_level: (latest.eg_year_level as string) ?? null,
          field_of_study: (latest.eg_field_of_study as string) ?? null,
        }
        return NextResponse.json({ profile, logs: [], surveyResponses: rows })
      }
    }

    return NextResponse.json({ error: 'No logs found for this user' }, { status: 404 })
  }

  // Compute CVS-Smart scores dynamically
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

  let profile = null
  if (isUuid) {
    const { data: profileData } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    profile = profileData ?? null
  }

  const latestLog = computedLogs[0]
  const emailVal = (profile as any)?.email ?? latestLog.email ?? decodeURIComponent(userId)
  const defNames = splitNameFromEmail(emailVal)

  profile = {
    first_name: (profile as any)?.first_name || defNames.first_name,
    last_name:  (profile as any)?.last_name  || defNames.last_name,
    email: emailVal,
    age: (profile as any)?.age ?? latestLog.age ?? null,
    gender: (profile as any)?.gender ?? latestLog.gender ?? null,
    year_level: (profile as any)?.year_level ?? latestLog.year_level ?? null,
    field_of_study: (profile as any)?.field_of_study ?? latestLog.field_of_study ?? null,
  }

  // Also query survey responses for this email if present
  let surveyResponses: Record<string, unknown>[] = []
  if (emailVal) {
    const { data: sRows } = await adminClient
      .from('survey_responses')
      .select('*')
      .eq('email', emailVal)
      .order('response_timestamp', { ascending: false })
    surveyResponses = (sRows as unknown as Record<string, unknown>[]) ?? []
  }

  return NextResponse.json({ profile, logs: computedLogs, surveyResponses })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

  const { userId } = await params
  const isUuid = uuidRegex.test(userId)
  const body = await request.json()

  const allowedFields = ['first_name', 'last_name', 'age', 'gender', 'year_level', 'field_of_study']
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (isUuid) {
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert({ user_id: userId, ...updates })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
  }

  await adminClient
    .from('daily_logs')
    .update(updates)
    .eq(isUuid ? 'user_id' : 'email', decodeURIComponent(userId))

  await recordAdminAuditEvent({
    adminId: user.id,
    adminEmail: user.email ?? 'unknown',
    action: 'USER_PROFILE_UPDATE',
    targetUserId: userId,
    details: { updatedFields: Object.keys(updates) },
  })

  return NextResponse.json({ success: true, updates })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

  const { userId } = await params
  const isUuid = uuidRegex.test(userId)

  if (isUuid) {
    await adminClient.from('daily_logs').delete().eq('user_id', userId)
    await adminClient.from('predictions').delete().eq('user_id', userId)
    await adminClient.from('user_profiles').delete().eq('user_id', userId)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      console.warn('Could not delete auth user (may not exist in auth.users):', authError.message)
    }
  } else {
    const email = decodeURIComponent(userId)
    await adminClient.from('daily_logs').delete().eq('email', email)
    await adminClient.from('survey_responses').delete().eq('email', email)
  }

  await recordAdminAuditEvent({
    adminId: user.id,
    adminEmail: user.email ?? 'unknown',
    action: 'USER_DELETE',
    targetUserId: userId,
    details: { isUuid, deletedAt: new Date().toISOString() },
  })

  return NextResponse.json({ success: true })
}
