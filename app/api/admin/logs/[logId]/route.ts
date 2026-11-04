import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ logId: string }> }

// ── PATCH — soft-hide a log (admin request or user request) ──────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { logId } = await params
  const body = await request.json().catch(() => ({}))
  const hide: boolean = body.hidden !== false // default to hiding

  // Fetch log for audit trail
  const { data: log, error: fetchErr } = await adminClient
    .from('daily_logs')
    .select('id, user_id, date, email, risk_level, hidden_by_admin')
    .eq('id', logId)
    .single()

  if (fetchErr || !log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 })
  }

  const { error: updateErr } = await adminClient
    .from('daily_logs')
    .update({
      hidden_by_admin: hide,
    })
    .eq('id', logId)

  if (updateErr) {
    console.error('Failed to hide log:', updateErr)
    // If the column doesn't exist yet, give a clear message
    if (updateErr.message?.includes('hidden_by_admin') || updateErr.code === '42703') {
      return NextResponse.json({
        error: 'Migration not applied yet. Run database/migrations/001_create_user_settings.sql in Supabase SQL Editor first.',
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 })
  }

  try {
    await recordAdminAuditEvent({
      targetUserId: log.user_id ?? null,
      targetEmail:  log.email ?? null,
      eventType:    hide ? 'log_hidden' : 'log_unhidden',
      description:  `Admin ${hide ? 'hid' : 'unhid'} log entry for ${log.date} (risk: ${log.risk_level ?? 'unknown'})`,
      eventData:    { logId, date: log.date, riskLevel: log.risk_level, hidden: hide },
      actorId:      user?.id ?? null,
      actorEmail:   user?.email ?? null,
    })
  } catch (auditError) {
    console.error('Audit logging failed:', auditError)
  }

  return NextResponse.json({ success: true, hidden: hide })
}

// ── DELETE — permanently remove a log (kept for completeness but UI no longer uses it) ──
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
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

  const { logId } = await params

  const { data: log, error: fetchErr } = await adminClient
    .from('daily_logs')
    .select('id, user_id, date, email, risk_level')
    .eq('id', logId)
    .single()

  if (fetchErr || !log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 })
  }

  await adminClient.from('predictions').delete().eq('daily_log_id', logId)

  const { error: deleteErr } = await adminClient
    .from('daily_logs')
    .delete()
    .eq('id', logId)

  if (deleteErr) {
    console.error('Failed to delete log:', deleteErr)
    return NextResponse.json({ error: 'Failed to delete log entry' }, { status: 500 })
  }

  try {
    await recordAdminAuditEvent({
      targetUserId: log.user_id ?? null,
      targetEmail:  log.email ?? null,
      eventType:    'log_deleted',
      description:  `Admin deleted log entry for ${log.date} (risk: ${log.risk_level ?? 'unknown'})`,
      eventData:    { logId, date: log.date, riskLevel: log.risk_level },
      actorId:      user?.id ?? null,
      actorEmail:   user?.email ?? null,
    })
  } catch (auditError) {
    console.error('Audit logging failed:', auditError)
  }

  return NextResponse.json({ success: true })
}
