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

  // If the user has no daily_logs, look up profile or survey responses rather than throwing 404!
  if (!logs || logs.length === 0) {
    let profile = null
    let surveyResponses: Record<string, unknown>[] = []
    let emailVal = decodeURIComponent(userId)

    if (isUuid) {
      const { data: profileData } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      profile = profileData ?? null

      // Also get auth email if available
      try {
        const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
        if (authUser?.user?.email) emailVal = authUser.user.email
      } catch { /* non-fatal */ }
    }

    const { data: surveyRows } = await adminClient
      .from('survey_responses')
      .select('*')
      .eq('email', emailVal)
      .order('response_timestamp', { ascending: false })

    if (surveyRows && surveyRows.length > 0) {
      surveyResponses = surveyRows as unknown as Record<string, unknown>[]
    }

    const defNames = splitNameFromEmail(emailVal)
    const latestSurvey = surveyResponses[0]

    const fullProfile = {
      email: emailVal,
      first_name: (profile as any)?.first_name || defNames.first_name,
      last_name:  (profile as any)?.last_name  || defNames.last_name,
      age: (profile as any)?.age ?? (latestSurvey?.eg_age as any) ?? null,
      gender: (profile as any)?.gender ?? (latestSurvey?.eg_gender as any) ?? null,
      year_level: (profile as any)?.year_level ?? (latestSurvey?.eg_year_level as any) ?? null,
      field_of_study: (profile as any)?.field_of_study ?? (latestSurvey?.eg_field_of_study as any) ?? null,
    }

    return NextResponse.json({ profile: fullProfile, logs: [], surveyResponses })
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
  const isUuid = uuidRegex.test(userId)
  const body = await request.json()

  if (!isUuid) {
    const email = decodeURIComponent(userId)
    const profileUpdates = body.profile || {}
    const updates: Record<string, any> = {}
    if (profileUpdates.age !== undefined) updates.age = profileUpdates.age
    if (profileUpdates.gender !== undefined) updates.gender = profileUpdates.gender
    if (profileUpdates.year_level !== undefined) updates.year_level = profileUpdates.year_level
    if (profileUpdates.field_of_study !== undefined) updates.field_of_study = profileUpdates.field_of_study

    if (Object.keys(updates).length > 0) {
      await adminClient.from('daily_logs').update(updates).eq('email', email)
    }

    try {
      await recordAdminAuditEvent({
        targetUserId: null,
        targetEmail: email,
        eventType: 'profile_update',
        description: `Admin updated profile for respondent ${email}`,
        eventData: { updates },
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true })
  }
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
  const isUuid = uuidRegex.test(userId)

  if (!isUuid) {
    const email = decodeURIComponent(userId)
    const { data: userLogs } = await adminClient
      .from('daily_logs')
      .select('id')
      .eq('email', email)

    if (userLogs && userLogs.length > 0) {
      const logIds = userLogs.map(l => l.id)
      await adminClient.from('predictions').delete().in('log_id', logIds)
    }

    await adminClient.from('daily_logs').delete().eq('email', email)
    await adminClient.from('survey_responses').delete().eq('email', email)

    try {
      await recordAdminAuditEvent({
        targetUserId: null,
        targetEmail: email,
        eventType: 'user_deleted',
        description: `Admin deleted respondent account for ${email}`,
        eventData: { email },
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true })
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
