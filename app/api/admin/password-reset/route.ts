import { splitNameFromEmail } from '@/lib/name-utils'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin-guard';
import { recordAdminAuditEvent } from '@/lib/admin-audit';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // Auth check - ensure user is admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, action } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (action === 'send-reset-email') {
      if (!userId.includes('@')) {
        return NextResponse.json({ error: 'A valid email address is required to send a password reset link' }, { status: 400 });
      }
      // Generate a password reset link and send via email
      try {
        const { data, error } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: userId,
        });

        if (error || !data?.properties?.action_link) {
          console.error('Generate link error:', error);
          return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
        }

        await recordAdminAuditEvent({
          targetUserId: null,
          targetEmail: userId,
          eventType: 'password_reset_request',
          description: `Admin requested a password reset link for ${userId}`,
          eventData: { action: 'send-reset-email' },
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
        });

        return NextResponse.json({
          success: true,
          message: 'Password reset link generated. A reset email would be sent to the user in production.',
        });
      } catch (err) {
        console.error('Send reset email error:', err);
        return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
      }
    } else if (action === 'generate-temp-password') {
      try {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
        const bytes = new Uint8Array(16)
        crypto.getRandomValues(bytes)
        const tempPassword = Array.from(bytes)
          .map(b => chars[b % chars.length])
          .join('')

        let targetAuthId = userId
        let targetEmail: string | null = null

        if (!uuidRegex.test(userId)) {
          targetEmail = userId
          const { data: { users } } = await adminClient.auth.admin.listUsers()
          const existing = users.find(u => u.email?.toLowerCase() === targetEmail!.toLowerCase())

          if (existing) {
            targetAuthId = existing.id
          } else {
            const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
              email: targetEmail ?? undefined,
              password: tempPassword,
              email_confirm: true,
            })
            if (createError || !newUser?.user) {
              console.error('Failed to create auth user:', createError)
              return NextResponse.json({ error: 'Failed to create account for user' }, { status: 500 })
            }
            targetAuthId = newUser.user.id

            await adminClient.from('daily_logs').update({ user_id: targetAuthId }).eq('email', targetEmail ?? '')
            const { first_name, last_name } = splitNameFromEmail(targetEmail ?? '')
            await adminClient.from('user_profiles').insert({
              user_id: targetAuthId,
              first_name,
              last_name,
              baseline_risk_level: 'unknown',
            })
          }
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(targetAuthId, {
          password: tempPassword,
        })

        if (updateError) {
          console.error('Update password error:', updateError)
          return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
        }

        await recordAdminAuditEvent({
          targetUserId: targetAuthId,
          targetEmail: targetEmail,
          eventType: 'temporary_password_generated',
          description: `Admin generated a temporary password for ${targetEmail ?? targetAuthId}`,
          eventData: { action: 'generate-temp-password' },
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
        });

        return NextResponse.json({
          success: true,
          message: 'Temporary password generated successfully',
          tempPassword,
          instructions: 'Share this temporary password with the user. They should change it immediately upon login.',
        });
      } catch (err) {
        console.error('Generate temp password error:', err);
        return NextResponse.json({ error: 'Failed to generate temporary password' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
