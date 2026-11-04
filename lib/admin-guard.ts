import type { User } from '@supabase/supabase-js'

/**
 * Determines whether a Supabase user has admin privileges.
 *
 * A user is considered an admin if either:
 * 1. Their `user_metadata.role` is set to `'admin'` (set via Supabase dashboard
 *    or admin API), OR
 * 2. Their email matches the `NEXT_PUBLIC_ADMIN_EMAIL` environment variable
 *    (and that variable is non-empty).
 *
 * Returns `false` for a `null` user or any other case.
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false
  }

  if (user.user_metadata?.role === 'admin') {
    return true
  }

  // Use server-only env var (no NEXT_PUBLIC_ prefix) to avoid leaking
  // the admin email in the client bundle. Falls back to NEXT_PUBLIC_ADMIN_EMAIL
  // for backwards compatibility but the server-only var takes precedence.
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) {
    return true
  }

  return false
}
