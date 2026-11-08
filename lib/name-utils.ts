/**
 * Utilities for formatting human-friendly names from email addresses
 * when first_name and last_name are not yet explicitly set.
 */

const COMMON_PREFIXES = [
  'alexander', 'princess', 'christian', 'patricia', 'gabriel', 'michael',
  'johline', 'angela', 'daniel', 'joshua', 'justin', 'joseph', 'miguel',
  'jeslen', 'aaron', 'alessi', 'lanz', 'mark', 'john', 'mary', 'rose',
  'kaise', 'carlo', 'kevin', 'paolo', 'david', 'sarah', 'micay', 'guel',
  'endic', 'renz', 'yzack', 'gio', 'kim', 'bea', 'elise', 'claire'
]

export function splitNameFromEmail(email: string): { first_name: string; last_name: string } {
  if (!email) return { first_name: '', last_name: '' }
  const local = email.split('@')[0] || ''

  // Strip trailing student IDs / digits and institution markers (e.g. 1673, 2117qc)
  let clean = local.replace(/\d+.*$/, '')
  clean = clean.replace(/qc$/i, '').trim()

  if (!clean) {
    const raw = local.charAt(0).toUpperCase() + local.slice(1)
    return { first_name: raw, last_name: '' }
  }

  // If separated by dots, hyphens, or underscores (e.g. aaron.ibarra, john_smith)
  if (/[._-]/.test(clean)) {
    const parts = clean.split(/[._-]+/).filter(Boolean)
    const cap = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    return {
      first_name: cap[0] || '',
      last_name: cap.slice(1).join(' ') || '',
    }
  }

  const lower = clean.toLowerCase()

  // Match known first-name prefixes to split compound usernames (e.g. aaronibarra -> Aaron Ibarra)
  for (const prefix of COMMON_PREFIXES) {
    if (lower.startsWith(prefix) && lower.length > prefix.length + 1) {
      const first = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()
      const rest = clean.slice(prefix.length)
      const last = rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase()
      return { first_name: first, last_name: last }
    }
  }

  // Handle common initials suffix (e.g. caputolantj -> Caputolan TJ)
  if (lower.endsWith('tj') && lower.length > 2) {
    const first = clean.slice(0, -2)
    return {
      first_name: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
      last_name: 'TJ',
    }
  }

  // Fallback: capitalize whole cleaned localpart
  return {
    first_name: clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(),
    last_name: '',
  }
}

export function formatDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const parts = [firstName, lastName].map(s => (s || '').trim()).filter(Boolean)
  if (parts.length > 0) {
    return parts.join(' ')
  }
  if (!email) return ''
  const { first_name, last_name } = splitNameFromEmail(email)
  return [first_name, last_name].filter(Boolean).join(' ')
}
