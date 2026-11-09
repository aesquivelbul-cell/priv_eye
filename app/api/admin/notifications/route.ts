import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin-guard';
import { splitNameFromEmail } from '@/lib/name-utils';
import { recordAdminAuditEvent } from '@/lib/admin-audit';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/notifications?userId=xxx — fetch notifications sent to a user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let adminClient;
  try { adminClient = createAdminClient(); } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  let targetAuthId = userId;
  if (!uuidRegex.test(userId)) {
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users.find(u => u.email?.toLowerCase() === userId.toLowerCase());
    if (existing) {
      targetAuthId = existing.id;
    } else {
      return NextResponse.json({ notifications: [] });
    }
  }

  const { data, error } = await adminClient
    .from('admin_notifications')
    .select('id, content, severity, created_at')
    .eq('user_id', targetAuthId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

// POST /api/admin/notifications — send a push notification to a user
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let adminClient;
  try { adminClient = createAdminClient(); } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { userId, content, severity = 'info' } = await request.json();
  if (!userId || !content?.trim()) {
    return NextResponse.json({ error: 'userId and content are required' }, { status: 400 });
  }
  if (!['info', 'high', 'critical'].includes(severity)) {
    return NextResponse.json({ error: 'severity must be info, high, or critical' }, { status: 400 });
  }

  let targetAuthId = userId;
  let targetEmail: string | null = null;

  if (!uuidRegex.test(userId)) {
    targetEmail = userId;
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users.find(u => u.email?.toLowerCase() === targetEmail!.toLowerCase());

    if (existing) {
      targetAuthId = existing.id;
    } else {
      // Auto-provision an auth account for this respondent so they can receive notifications and login
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const tempPassword = Array.from(bytes).map(b => chars[b % chars.length]).join('');

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: targetEmail ?? undefined,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError || !newUser?.user) {
        console.error('Failed to provision auth user for notification:', createError);
        return NextResponse.json({ error: createError?.message ?? 'Failed to provision account for notification' }, { status: 500 });
      }

      targetAuthId = newUser.user.id;
      await adminClient.from('daily_logs').update({ user_id: targetAuthId }).eq('email', targetEmail ?? '');
      const { first_name, last_name } = splitNameFromEmail(targetEmail ?? '');
      await adminClient.from('user_profiles').insert({
        user_id: targetAuthId,
        first_name,
        last_name,
        baseline_risk_level: 'unknown',
      });
    }
  }

  const { data, error } = await adminClient
    .from('admin_notifications')
    .insert({ user_id: targetAuthId, content: content.trim(), severity, read: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await recordAdminAuditEvent({
      targetUserId: targetAuthId,
      targetEmail,
      eventType: 'notification_sent',
      description: `Admin sent a ${severity} notification to ${targetEmail ?? targetAuthId}`,
      eventData: { severity, content: content.trim() },
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ notification: data });
}
