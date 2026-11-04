import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEventPayload = {
  targetUserId?: string | null
  targetEmail?: string | null
  eventType: string
  description: string
  eventData?: Record<string, unknown>
  actorId?: string | null
  actorEmail?: string | null
}

export async function recordAdminAuditEvent(event: AuditEventPayload) {
  const adminClient = createAdminClient()

  // Write to admin_audit_logs with proper dedicated columns
  const { error } = await adminClient.from('admin_audit_logs').insert([{
    target_user_id: event.targetUserId ?? null,
    target_email:   event.targetEmail  ?? null,
    event_type:     event.eventType,
    description:    event.description,
    event_data:     event.eventData ?? {},
    actor_id:       event.actorId   ?? null,
    actor_email:    event.actorEmail ?? null,
  }])

  if (error) {
    // Graceful fallback: log to console but don't crash callers
    console.error('[audit] Failed to record audit event:', error.message, event)
  }
}

export type AuditEvent = {
  id: string
  target_user_id: string | null
  target_email: string | null
  event_type: string
  description: string
  event_data: Record<string, unknown> | null
  actor_id: string | null
  actor_email: string | null
  created_at: string
}

export async function fetchAdminAuditEvents(options?: {
  userId?: string
  userEmail?: string
  eventType?: string
  search?: string
  limit?: number
}): Promise<AuditEvent[]> {
  const adminClient = createAdminClient()

  let query = adminClient
    .from('admin_audit_logs')
    .select('id, target_user_id, target_email, event_type, description, event_data, actor_id, actor_email, created_at')
    .order('created_at', { ascending: false })

  if (options?.userId) {
    query = query.eq('target_user_id', options.userId)
  }

  if (options?.userEmail) {
    query = query.eq('target_email', options.userEmail)
  }

  if (options?.eventType) {
    query = query.eq('event_type', options.eventType)
  }

  if (options?.search) {
    query = query.or(
      `description.ilike.%${options.search}%,target_email.ilike.%${options.search}%,actor_email.ilike.%${options.search}%`
    )
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id:              row.id,
    target_user_id:  row.target_user_id  ?? null,
    target_email:    row.target_email    ?? null,
    event_type:      row.event_type      ?? 'admin_action',
    description:     row.description     ?? '',
    event_data:      row.event_data      ?? null,
    actor_id:        row.actor_id        ?? null,
    actor_email:     row.actor_email     ?? null,
    created_at:      row.created_at,
  }))
}
