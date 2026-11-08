import type { User } from '@supabase/supabase-js'

/**
 * Determines whether a Supabase user has admin privileges.
 *
 * A user is considered an admin if either:
 * 1. Their `user_metadata.role` is set to `'admin'` (set via Supabase dashboard or admin API), OR
 * 2. Their email matches `NEXT_PUBLIC_ADMIN_EMAIL` / `ADMIN_EMAIL`, OR
 * 3. Their email matches the project admin account.
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false
  }

  // 1. Check user_metadata.role
  if (user.user_metadata?.role === 'admin') {
    return true
  }

  // 2. Case-insensitive email match against configured admin emails
  const userEmail = (user.email || '').trim().toLowerCase()
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase()

  if (adminEmail && userEmail === adminEmail) {
    return true
  }

  // 3. Fallback for the principal project admin email
  if (userEmail === 'aadrueco2117qc@student.fatima.edu.ph') {
    return true
  }

  return false
}
