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

  // Fetch logs for this user ordered by date descending.
  // For survey respondents we look up by email when userId isn't a UUID.
  const query = adminClient
    .from('daily_logs')
    .select('id, date, email, user_id, age, gender, year_level, field_of_study, screen_time, sleep_hours, brightness, eye_strain, headaches, blurry_vision, dry_eyes, risk_level, hidden_by_admin')
    .order('date', { ascending: false })
    .eq(isUuid ? 'user_id' : 'email', decodeURIComponent(userId))

  const { data: logs, error: logsError } = await query

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // For survey-only respondents (email-based lookup) who have no daily_logs,
  // fall back to survey_responses table so the admin can still see their data.
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
        const profile = {
          email: (latest.email as string) ?? null,
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

  let profile = null
  if (isUuid) {
    const { data: profileData } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    profile = profileData ?? null
  }

  const latestLog = logs[0]
  if (!profile) {
    profile = {
      email: latestLog.email ?? null,
      age: latestLog.age ?? null,
      gender: latestLog.gender ?? null,
      year_level: latestLog.year_level ?? null,
      field_of_study: latestLog.field_of_study ?? null,
    }
  } else {
    profile = {
      ...profile,
      email: profile.email ?? latestLog.email ?? null,
      age: profile.age ?? latestLog.age ?? null,
      gender: profile.gender ?? latestLog.gender ?? null,
      year_level: profile.year_level ?? latestLog.year_level ?? null,
      field_of_study: profile.field_of_study ?? latestLog.field_of_study ?? null,
    }
  }

  return NextResponse.json({ profile, logs })
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
  if (!uuidRegex.test(userId)) {
    return NextResponse.json({ error: 'Profile updates are only supported for registered users' }, { status: 400 })
  }

  const body = await request.json()
  const profileUpdates = body.profile
  if (!profileUpdates || typeof profileUpdates !== 'object') {
    return NextResponse.json({ error: 'profile data is required' }, { status: 400 })
  }

  const allowedFields = [
    'first_name',
    'last_name',
    'age',
    'gender',
    'year_level',
    'field_of_study',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in profileUpdates) {
      updates[field] = profileUpdates[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable profile fields were provided' }, { status: 400 })
  }

  let beforeProfile: Record<string, unknown> | null = null
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from('user_profiles')
    .select(allowedFields.join(','))
    .eq('user_id', userId)
    .single()

  if (!existingProfileError && existingProfile) {
    beforeProfile = existingProfile as unknown as Record<string, unknown>
  }

  const { error: updateError } = await adminClient
    .from('user_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })

  if (updateError) {
    console.error('Profile update error:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  const afterProfile = beforeProfile ? { ...beforeProfile, ...updates } : updates

  const fieldLabels: Record<string, string> = {
    first_name: 'First Name',
    last_name: 'Last Name',
    age: 'Age',
    gender: 'Gender',
    year_level: 'Year Level',
    field_of_study: 'Field of Study',
  }

  const changeSummary = Object.keys(updates)
    .map((field) => {
      const label = fieldLabels[field] ?? field
      const before = beforeProfile?.[field] ?? 'N/A'
      const after = updates[field] ?? 'N/A'
      return `${label}: "${before}" → "${after}"`
    })
    .join(', ')

  // Use the name from BEFORE the edit so the audit log reflects who was changed
  const targetName = [
    beforeProfile?.first_name,
    beforeProfile?.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  const targetLabel = targetName || userId

  try {
    await recordAdminAuditEvent({
      targetUserId: userId,
      targetEmail: null,
      eventType: 'profile_update',
      description: `Admin updated profile for ${targetLabel}: ${changeSummary}`,
      eventData: {
        before: beforeProfile,
        after: afterProfile,
        changedFields: Object.keys(updates),
      },
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
    })
  } catch (auditError) {
    console.error('Audit logging failed:', auditError)
  }

  return NextResponse.json({ success: true })
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

  // Only registered users (UUID) can be fully deleted through auth
  if (!uuidRegex.test(userId)) {
    return NextResponse.json(
      { error: 'Account deletion is only supported for registered users' },
      { status: 400 },
    )
  }

  // Snapshot profile for the audit trail before wiping anything
  let snapshotEmail: string | null = null
  let snapshotName: string | null = null
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    snapshotEmail = authUser?.user?.email ?? null

    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .single()
    if (profile) {
      snapshotName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
    }
  } catch { /* non-fatal — proceed with deletion */ }

  // Delete predictions first (FK → daily_logs)
  const { error: predErr } = await adminClient
    .from('predictions')
    .delete()
    .eq('user_id', userId)
  if (predErr) {
    console.error('Failed to delete predictions:', predErr)
    return NextResponse.json({ error: 'Failed to delete user predictions' }, { status: 500 })
  }

  // Delete daily logs
  const { error: logsErr } = await adminClient
    .from('daily_logs')
    .delete()
    .eq('user_id', userId)
  if (logsErr) {
    console.error('Failed to delete daily logs:', logsErr)
    return NextResponse.json({ error: 'Failed to delete user logs' }, { status: 500 })
  }

  // Delete user_profiles (if exists)
  await adminClient.from('user_profiles').delete().eq('user_id', userId)

  // Delete user_settings (if exists)
  await adminClient.from('user_settings').delete().eq('user_id', userId)

  // Delete the auth account — this is irreversible
  const { error: authErr } = await adminClient.auth.admin.deleteUser(userId)
  if (authErr) {
    console.error('Failed to delete auth user:', authErr)
    return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 })
  }

  // Record audit event
  try {
    await recordAdminAuditEvent({
      targetUserId: userId,
      targetEmail: snapshotEmail,
      eventType: 'user_deleted',
      description: `Admin deleted user account for ${snapshotName ?? snapshotEmail ?? userId}`,
      eventData: { deletedUserId: userId, email: snapshotEmail, name: snapshotName },
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
    })
  } catch (auditError) {
    console.error('Audit logging failed:', auditError)
  }

  return NextResponse.json({ success: true })
}
