'use client'
import { formatDisplayName, splitNameFromEmail } from '@/lib/name-utils'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Lock, Send, Copy, Check,
  Pencil, EyeOff, Eye, AlertTriangle, X, ShieldAlert, Bell,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyLog {
  id: string
  date: string
  screen_time: number
  sleep_hours: number
  brightness: number
  eye_strain: number
  headaches: number
  blurry_vision: number
  dry_eyes: number
  risk_level: string
  hidden_by_admin?: boolean  // only present after migration 001 is applied
}

interface SurveyResponse {
  response_timestamp: string | null
  email: string | null
  eg_age: number | string | null
  eg_gender: string | null
  eg_year_level: string | null
  eg_field_of_study: string | null
  cvsq_q1_visual_raw: string | null
  cvsq_q2_ocular_raw: string | null
  cvsq_q3_extraocular_raw: string | null
  cvsq_q4_frequency: string | null
  cvsq_q5_screen_associated: string | null
  cvsq_total: number | null
  cvsq_status: string | null
  eg_academic_screen_time: string | null
  eg_non_academic_screen_time: string | null
  eg_primary_device: string | null
  eg_continuous_screen_use: string | null
  eg_online_classes_per_day: string | null
  eg_follows_20_20_20: string | null
  eg_blue_light_filter: string | null
  eg_screen_brightness: string | null
  eg_dark_room_use: string | null
  eg_screen_distance: string | null
  eg_wears_glasses: string | null
  eg_blue_light_glasses: string | null
  eg_break_frequency: string | null
  eg_sleep_hours: number | string | null
  sym_dry_eyes: string | null
  sym_eye_itchiness: string | null
  sym_blurred_vision: string | null
  sym_headaches: string | null
  sym_eye_irritation: string | null
  sym_light_sensitivity: string | null
  sym_difficulty_focusing: string | null
  sym_neck_shoulder_pain: string | null
  sym_mental_fatigue: string | null
  sym_difficulty_concentrating: string | null
  eg_overall_eye_strain: string | null
  eg_digital_fatigue_frequency: string | null
  eg_primary_symptom_history: string | null
}

interface UserProfile {
  first_name?: string
  last_name?: string
  email?: string
  age?: number | string
  gender?: string
  year_level?: string
  field_of_study?: string
}

interface UserDetailResponse {
  profile: UserProfile | null
  logs: DailyLog[]
  surveyResponses?: SurveyResponse[]
}

interface AuditEventData {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changedFields?: string[]
  [key: string]: unknown
}

interface AuditEvent {
  id: string
  event_type: string
  description: string
  actor_email: string | null
  actor_id?: string | null
  created_at: string
  event_data?: AuditEventData | null
}

interface ProfileForm {
  first_name: string
  last_name: string
  age: string
  gender: string
  year_level: string
  year_level_custom: string   // used when year_level === 'Others'
  field_of_study: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  Low:      'text-green-600',
  Moderate: 'text-yellow-600',
  High:     'text-orange-600',
  Critical: 'text-red-600',
}

const RISK_BADGES: Record<string, string> = {
  Low:      'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400',
  Moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Critical: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
}

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other', 'Prefer not to say']
// "5th Year or higher" is legacy — new label is "Others" with a free-text field
const YEAR_OPTIONS   = ['', '1st Year', '2nd Year', '3rd Year', '4th Year', 'Others']
const FIELD_OPTIONS  = ['', 'IT / Computer Science', 'Engineering', 'Business', 'Health Sciences', 'Education', 'Arts and Humanities', 'Other']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeSymptoms(log: DailyLog): string {
  const s: string[] = []
  if (log.eye_strain    === 1) s.push('Eye Strain')
  if (log.headaches     === 1) s.push('Headaches')
  if (log.blurry_vision === 1) s.push('Blurry Vision')
  if (log.dry_eyes      === 1) s.push('Dry Eyes')
  return s.length > 0 ? s.join(', ') : 'None'
}

/** Normalise stored year_level so legacy "5th Year or higher" shows as "Others" */
function normalizeYearLevel(raw: string | undefined | null): { dropdown: string; custom: string } {
  if (!raw) return { dropdown: '', custom: '' }
  const standard = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Others']
  if (standard.includes(raw)) return { dropdown: raw, custom: '' }
  if (raw === '5th Year or higher') return { dropdown: 'Others', custom: '' }
  // anything else (free-text) → Others + fill custom field
  return { dropdown: 'Others', custom: raw }
}

// ── Re-usable select ──────────────────────────────────────────────────────────

function AdminSelect({
  id, label, value, options, onChange,
}: {
  id: string; label: string; value: string
  options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {options.map(o => <option key={o} value={o}>{o || '— select —'}</option>)}
      </select>
    </div>
  )
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, destructive,
  loading, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string
  destructive?: boolean; loading: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${destructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
            <AlertTriangle className={`w-5 h-5 ${destructive ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Working…
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()

  const [data, setData] = useState<UserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit profile
  const [isEditing, setIsEditing] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: '', last_name: '', age: '',
    gender: '', year_level: '', year_level_custom: '', field_of_study: '',
  })
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  // Save profile confirmation
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  // Delete user modal
  const [showDeleteUser, setShowDeleteUser] = useState(false)
  const [deleteUserLoading, setDeleteUserLoading] = useState(false)
  const [deleteUserError, setDeleteUserError] = useState('')

  // Hide log modal (soft-hide instead of hard-delete)
  const [logToHide, setLogToHide] = useState<DailyLog | null>(null)
  const [hideLogLoading, setHideLogLoading] = useState(false)

  // Show hidden logs toggle
  const [showHidden, setShowHidden] = useState(false)

  // Password reset modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [copied, setCopied] = useState(false)

  // Audit
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')

  // Send notification
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyContent, setNotifyContent] = useState('')
  const [notifySeverity, setNotifySeverity] = useState<'info' | 'high' | 'critical'>('info')
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [notifyResult, setNotifyResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const isRegistered = UUID_RE.test(userId ?? '')

  // ── Load user data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    fetch(`/api/admin/users/${userId}`)
      .then(async res => {
        if (res.status === 404) throw new Error('not_found')
        if (!res.ok) throw new Error('fetch_error')
        return res.json()
      })
      .then(json => {
        setData(json)
        const p = json.profile ?? {}
        const rawYear = p.year_level ?? ''
        const { dropdown, custom } = normalizeYearLevel(rawYear)
        const defNames = splitNameFromEmail(p.email ?? decodeURIComponent(userId))
        setProfileForm({
          first_name:        p.first_name    || defNames.first_name || '',
          last_name:         p.last_name     || defNames.last_name  || '',
          age:               p.age != null   ? String(p.age) : '',
          gender:            p.gender        ?? '',
          year_level:        dropdown,
          year_level_custom: custom,
          field_of_study:    p.field_of_study ?? '',
        })
      })
      .catch(err => setError(err.message === 'not_found' ? 'No logs found for this user.' : 'Failed to load user data.'))
      .finally(() => setLoading(false))
  }, [userId])

  // ── Load audit history ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    // For non-registered users (email-keyed), wait until profile data is loaded
    if (!isRegistered && !data) return
    setAuditLoading(true)
    setAuditError('')
    const emailKey = data?.profile?.email ?? decodeURIComponent(userId)
    const qp = isRegistered
      ? `userId=${encodeURIComponent(userId)}`
      : `userEmail=${encodeURIComponent(emailKey)}`
    fetch(`/api/admin/audit?${qp}&limit=50`)
      .then(async res => { const j = await res.json(); if (!res.ok) throw new Error(j?.error || 'Failed'); return j })
      .then(j => setAuditEvents(j.events || []))
      .catch(err => setAuditError(err instanceof Error ? err.message : 'Failed to load audit history'))
      .finally(() => setAuditLoading(false))
  }, [userId, isRegistered, data])

  // ── Profile save (after confirmation) ──────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!userId) return
    setSaveLoading(true); setSaveMessage(''); setSaveError('')
    setShowSaveConfirm(false)
    try {
      // Resolve the actual year_level to save
      const resolvedYear = profileForm.year_level === 'Others'
        ? (profileForm.year_level_custom.trim() || 'Others')
        : profileForm.year_level

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            first_name:    profileForm.first_name,
            last_name:     profileForm.last_name,
            age:           profileForm.age,
            gender:        profileForm.gender,
            year_level:    resolvedYear,
            field_of_study: profileForm.field_of_study,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save profile')
      setSaveMessage('Profile updated successfully.')
      setIsEditing(false)
      setData(cur => cur ? {
        ...cur,
        profile: { ...cur.profile, ...profileForm, year_level: resolvedYear },
      } : cur)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaveLoading(false)
    }
  }

  // ── Delete user ─────────────────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    setDeleteUserLoading(true); setDeleteUserError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to delete user')
      router.push('/admin/users')
    } catch (err) {
      setDeleteUserError(err instanceof Error ? err.message : 'Failed to delete user')
      setDeleteUserLoading(false)
      setShowDeleteUser(false)
    }
  }

  // ── Hide log (soft-hide, data preserved) ───────────────────────────────────
  const handleHideLog = async () => {
    if (!logToHide) return
    setHideLogLoading(true)
    try {
      const res = await fetch(`/api/admin/logs/${logToHide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to hide log')
      // Mark as hidden in local state (don't remove — admin can toggle visibility)
      setData(cur => cur ? {
        ...cur,
        logs: cur.logs.map(l => l.id === logToHide.id ? { ...l, hidden_by_admin: true } : l),
      } : cur)
    } catch (err) {
      console.error(err)
    } finally {
      setHideLogLoading(false)
      setLogToHide(null)
    }
  }

  // ── Unhide log ──────────────────────────────────────────────────────────────
  const handleUnhideLog = async (log: DailyLog) => {
    try {
      await fetch(`/api/admin/logs/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: false }),
      })
      setData(cur => cur ? {
        ...cur,
        logs: cur.logs.map(l => l.id === log.id ? { ...l, hidden_by_admin: false } : l),
      } : cur)
    } catch (err) {
      console.error(err)
    }
  }

  // ── Password reset ──────────────────────────────────────────────────────────
  const handleSendResetEmail = async () => {
    const email = data?.profile?.email ?? decodeURIComponent(userId ?? '')
    setResetLoading(true); setResetMessage('')
    try {
      const res = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, action: 'send-reset-email' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      setResetMessage('Password reset email sent successfully!')
      setTimeout(() => setShowPasswordModal(false), 2000)
    } catch (err) {
      setResetMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setResetLoading(false) }
  }

  const handleGenerateTempPassword = async () => {
    setResetLoading(true); setResetMessage(''); setTempPassword('')
    try {
      const res = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'generate-temp-password' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      setTempPassword(result.tempPassword)
    } catch (err) {
      setResetMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setResetLoading(false) }
  }

  // ── Send notification ───────────────────────────────────────────────────────
  const handleSendNotification = async () => {
    if (!notifyContent.trim()) return
    setNotifyLoading(true); setNotifyResult(null)
    // For survey respondents we need their auth user_id. Only works if they have an auth account.
    const targetId = isRegistered ? userId : null
    if (!targetId) {
      setNotifyResult({ ok: false, msg: 'This user does not have a login account yet. Generate a password first.' })
      setNotifyLoading(false)
      return
    }
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, content: notifyContent.trim(), severity: notifySeverity }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed')
      setNotifyResult({ ok: true, msg: 'Notification sent — the user will see it next time they open the app.' })
      setNotifyContent('')
    } catch (err) {
      setNotifyResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to send' })
    } finally {
      setNotifyLoading(false) }
  }

  const displayName = formatDisplayName(
    data?.profile?.first_name,
    data?.profile?.last_name,
    data?.profile?.email ?? decodeURIComponent(userId ?? '')
  )

  const visibleLogs = data?.logs.filter(l => showHidden || !l.hidden_by_admin) ?? []
  const hiddenCount = data?.logs.filter(l => l.hidden_by_admin).length ?? 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Go back"
            className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Detail</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{decodeURIComponent(userId ?? '')}</p>
          </div>
        </div>

        {/* Actions — notify + delete */}
        {!loading && data && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowNotifyModal(true); setNotifyResult(null) }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-background hover:bg-muted text-sm font-semibold rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              Send Notification
            </button>
            <button
              onClick={() => setShowDeleteUser(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Delete User
            </button>
          </div>
        )}
      </div>

      {loading && <p aria-busy="true" className="text-muted-foreground">Loading…</p>}
      {error   && <p role="alert" className="text-destructive">{error}</p>}
      {deleteUserError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {deleteUserError}
        </div>
      )}

      {data && (
        <>
          {/* ── Profile ── */}
          <section aria-labelledby="profile-heading" className="border border-border rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 id="profile-heading" className="text-lg font-semibold text-foreground">Profile</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Edit and update registered user details.
                </p>
              </div>
              <button
                onClick={() => { setIsEditing(v => !v); setSaveMessage(''); setSaveError('') }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {/* Read-only display */}
            {!isEditing && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Email',          value: data.profile?.email ?? decodeURIComponent(userId ?? '') },
                  { label: 'Name',           value: displayName || '—' },
                  { label: 'Age',            value: data.profile?.age ?? '—' },
                  { label: 'Gender',         value: data.profile?.gender ?? '—' },
                  { label: 'Year Level',     value: (() => {
                    const { dropdown, custom } = normalizeYearLevel(data.profile?.year_level)
                    if (dropdown === 'Others' && custom) return custom
                    return dropdown || '—'
                  })() },
                  { label: 'Field of Study', value: data.profile?.field_of_study ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</dt>
                    <dd className="mt-1 font-medium text-foreground">{String(value)}</dd>
                  </div>
                ))}
              </div>
            )}

            {/* Edit form */}
            {isEditing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fn" className="text-sm font-medium text-muted-foreground">First name</label>
                    <input id="fn" value={profileForm.first_name}
                      onChange={e => setProfileForm(p => ({ ...p, first_name: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label htmlFor="ln" className="text-sm font-medium text-muted-foreground">Last name</label>
                    <input id="ln" value={profileForm.last_name}
                      onChange={e => setProfileForm(p => ({ ...p, last_name: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label htmlFor="age" className="text-sm font-medium text-muted-foreground">Age</label>
                    <input id="age" type="number" value={profileForm.age}
                      onChange={e => setProfileForm(p => ({ ...p, age: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <AdminSelect id="gender" label="Gender"
                    value={profileForm.gender} options={GENDER_OPTIONS}
                    onChange={v => setProfileForm(p => ({ ...p, gender: v }))} />

                  {/* Year Level — dropdown + optional free-text for "Others" */}
                  <div className="space-y-2">
                    <AdminSelect id="year" label="Year Level"
                      value={profileForm.year_level} options={YEAR_OPTIONS}
                      onChange={v => setProfileForm(p => ({ ...p, year_level: v, year_level_custom: v !== 'Others' ? '' : p.year_level_custom }))} />
                    {profileForm.year_level === 'Others' && (
                      <div>
                        <label htmlFor="year-custom" className="text-xs text-muted-foreground">Specify year level</label>
                        <input
                          id="year-custom"
                          value={profileForm.year_level_custom}
                          onChange={e => setProfileForm(p => ({ ...p, year_level_custom: e.target.value }))}
                          placeholder="e.g. 5th Year, Graduate, Irregular"
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    )}
                  </div>

                  <AdminSelect id="field" label="Field of Study"
                    value={profileForm.field_of_study} options={FIELD_OPTIONS}
                    onChange={v => setProfileForm(p => ({ ...p, field_of_study: v }))} />
                </div>

                {saveError   && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                {saveMessage && <p className="text-sm text-green-600 dark:text-green-400">{saveMessage}</p>}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <button onClick={() => { setIsEditing(false); setSaveMessage(''); setSaveError('') }}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  {/* Save triggers confirmation modal */}
                  <button onClick={() => setShowSaveConfirm(true)} disabled={saveLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saveLoading
                      ? <><span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />Saving…</>
                      : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Reset password button */}
            {!isEditing && (
              <div className="pt-2 border-t border-border">
                <button onClick={() => setShowPasswordModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                  <Lock className="w-4 h-4" />
                  Reset Password
                </button>
              </div>
            )}
          </section>

          {/* ── Log History ── */}
          <section aria-labelledby="logs-heading">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 id="logs-heading" className="text-lg font-semibold text-foreground">
                Log History ({visibleLogs.length}{hiddenCount > 0 ? ` / ${data.logs.length} total` : ''})
              </h2>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden(v => !v)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                >
                  {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showHidden ? 'Hide hidden logs' : `Show ${hiddenCount} hidden log${hiddenCount !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>

            {visibleLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {data.surveyResponses && data.surveyResponses.length > 0
                  ? 'This respondent has no daily logs — their data comes from the survey import below.'
                  : 'No logs found for this user.'}
              </p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Daily log history</caption>
                    <thead className="bg-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Screen</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Sleep</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Brightness</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Symptoms</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Risk</th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLogs.map(log => (
                        <tr key={log.id} className={`border-t border-border transition-colors ${log.hidden_by_admin ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/30'}`}>
                          <td className="px-4 py-3 text-foreground font-medium">
                            {log.date}
                            {log.hidden_by_admin && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border align-middle">hidden</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{log.screen_time}h</td>
                          <td className="px-4 py-3 text-muted-foreground">{log.sleep_hours}h</td>
                          <td className="px-4 py-3 text-muted-foreground">{log.brightness}%</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{activeSymptoms(log)}</td>
                          <td className="px-4 py-3">
                            {log.risk_level ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGES[log.risk_level] ?? 'bg-muted text-foreground'}`}>
                                {log.risk_level}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {log.hidden_by_admin ? (
                              // Unhide button — no confirmation needed (reversible)
                              <button
                                onClick={() => handleUnhideLog(log)}
                                aria-label={`Unhide log for ${log.date}`}
                                title="Unhide this log"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            ) : (
                              // Hide button — opens confirmation
                              <button
                                onClick={() => setLogToHide(log)}
                                aria-label={`Hide log for ${log.date}`}
                                title="Hide this log (data is preserved)"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                              >
                                <EyeOff className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Hiding a log removes it from the user&apos;s view but preserves the data for research purposes. Admins can unhide logs at any time.
            </p>
          </section>

          {/* ── Survey Responses ── */}
          {data.surveyResponses && data.surveyResponses.length > 0 && (
            <section aria-labelledby="survey-heading" className="border border-border rounded-xl p-6 space-y-4">
              <div>
                <h2 id="survey-heading" className="text-lg font-semibold text-foreground">Survey Responses ({data.surveyResponses.length})</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Imported survey data for this respondent.</p>
              </div>

              {data.surveyResponses.map((sr, idx) => (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Response {idx + 1}
                      {sr.response_timestamp && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {sr.response_timestamp.split('T')[0]}
                        </span>
                      )}
                    </span>
                    {sr.eg_overall_eye_strain && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        sr.eg_overall_eye_strain === 'Severe'   ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        sr.eg_overall_eye_strain === 'Moderate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {sr.eg_overall_eye_strain} Eye Strain
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-4 text-sm">

                    {/* ── Screen habits ── */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Screen Habits</h3>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                        {[
                          { label: 'Academic Screen Time',     value: sr.eg_academic_screen_time },
                          { label: 'Non-Academic Screen Time', value: sr.eg_non_academic_screen_time },
                          { label: 'Primary Device',           value: sr.eg_primary_device },
                          { label: 'Continuous Use',           value: sr.eg_continuous_screen_use },
                          { label: 'Online Classes/Day',       value: sr.eg_online_classes_per_day },
                          { label: 'Screen Brightness',        value: sr.eg_screen_brightness },
                          { label: 'Screen Distance',          value: sr.eg_screen_distance },
                          { label: 'Dark Room Use',            value: sr.eg_dark_room_use },
                          { label: 'Break Frequency',          value: sr.eg_break_frequency },
                          { label: 'Follows 20-20-20',         value: sr.eg_follows_20_20_20 },
                          { label: 'Blue Light Filter',        value: sr.eg_blue_light_filter },
                          { label: 'Wears Glasses',            value: sr.eg_wears_glasses },
                          { label: 'Blue Light Glasses',       value: sr.eg_blue_light_glasses },
                          { label: 'Sleep Hours',              value: sr.eg_sleep_hours },
                        ].map(({ label, value }) => value != null && (
                          <div key={label}>
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="font-medium text-foreground">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* ── Symptoms ── */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Symptoms</h3>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Dry Eyes',                value: sr.sym_dry_eyes },
                          { label: 'Eye Itchiness',           value: sr.sym_eye_itchiness },
                          { label: 'Blurred Vision',          value: sr.sym_blurred_vision },
                          { label: 'Headaches',               value: sr.sym_headaches },
                          { label: 'Eye Irritation',          value: sr.sym_eye_irritation },
                          { label: 'Light Sensitivity',       value: sr.sym_light_sensitivity },
                          { label: 'Difficulty Focusing',     value: sr.sym_difficulty_focusing },
                          { label: 'Neck/Shoulder Pain',      value: sr.sym_neck_shoulder_pain },
                          { label: 'Mental Fatigue',          value: sr.sym_mental_fatigue },
                          { label: 'Difficulty Concentrating',value: sr.sym_difficulty_concentrating },
                        ].map(({ label, value }) => value != null && (
                          <span key={label} className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-foreground">
                            {label}: <span className="font-medium">{String(value)}</span>
                          </span>
                        ))}
                        {sr.eg_primary_symptom_history && (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-foreground">
                            History: <span className="font-medium">{sr.eg_primary_symptom_history}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── CVSQ scores ── */}
                    {(sr.cvsq_total != null || sr.cvsq_status) && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">CVSQ Scores</h3>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                          {[
                            { label: 'CVSQ Total',           value: sr.cvsq_total },
                            { label: 'Status',               value: sr.cvsq_status },
                            { label: 'Visual',               value: sr.cvsq_q1_visual_raw },
                            { label: 'Ocular',               value: sr.cvsq_q2_ocular_raw },
                            { label: 'Extraocular',          value: sr.cvsq_q3_extraocular_raw },
                            { label: 'Frequency',            value: sr.cvsq_q4_frequency },
                            { label: 'Screen Associated',    value: sr.cvsq_q5_screen_associated },
                            { label: 'Digital Fatigue Freq', value: sr.eg_digital_fatigue_frequency },
                          ].map(({ label, value }) => value != null && (
                            <div key={label}>
                              <dt className="text-xs text-muted-foreground">{label}</dt>
                              <dd className="font-medium text-foreground">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Audit History ── */}
          <section aria-labelledby="audit-heading" className="border border-border rounded-xl p-6">
            <h2 id="audit-heading" className="text-lg font-semibold text-foreground mb-1">Audit History</h2>
            <p className="text-sm text-muted-foreground mb-4">Recent admin actions involving this user.</p>

            {auditLoading ? (
              <p className="text-sm text-muted-foreground">Loading audit history…</p>
            ) : auditError ? (
              <p role="alert" className="text-sm text-destructive">{auditError}</p>
            ) : auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin audit events found for this user.</p>
            ) : (
              <div className="space-y-3">
                {auditEvents.map(event => {
                  const fieldLabels: Record<string, string> = {
                    first_name: 'First Name', last_name: 'Last Name',
                    age: 'Age', gender: 'Gender',
                    year_level: 'Year Level', field_of_study: 'Field of Study',
                  }
                  const hasStructured =
                    event.event_data &&
                    Array.isArray(event.event_data.changedFields) &&
                    event.event_data.changedFields.length > 0 &&
                    event.event_data.before !== undefined &&
                    event.event_data.after !== undefined

                  return (
                    <div key={event.id} className="rounded-lg border border-border bg-background p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{event.event_type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                      {hasStructured ? (
                        <div className="mt-2 space-y-1.5">
                          {event.event_data!.changedFields!.map(field => {
                            const label = fieldLabels[field] ?? field.replace(/_/g, ' ')
                            const before = event.event_data!.before?.[field]
                            const after  = event.event_data!.after?.[field]
                            return (
                              <div key={field} className="rounded border border-border bg-muted/40 px-3 py-1.5 text-sm">
                                <span className="font-medium text-foreground">{label}: </span>
                                <span className="text-muted-foreground line-through">{before != null && before !== '' ? String(before) : '—'}</span>
                                {' → '}
                                <span className="font-medium text-foreground">{after != null && after !== '' ? String(after) : '—'}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      {(event.actor_email || event.actor_id) && (
                        <p className="text-xs text-muted-foreground">By {event.actor_email ?? event.actor_id}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Send Notification modal ── */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Send Notification</h2>
              <button onClick={() => setShowNotifyModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Send an in-app notification to <strong>{displayName || data?.profile?.email}</strong>.
              They will see it in the bell icon on their dashboard.
            </p>
            <textarea
              value={notifyContent}
              onChange={e => setNotifyContent(e.target.value)}
              placeholder="e.g. Your risk score has increased. Please reduce screen time."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <select
                value={notifySeverity}
                onChange={e => setNotifySeverity(e.target.value as 'info' | 'high' | 'critical')}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="info">Info</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            {notifyResult && (
              <p className={`text-sm p-3 rounded-lg ${notifyResult.ok ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'}`}>
                {notifyResult.msg}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowNotifyModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleSendNotification} disabled={notifyLoading || !notifyContent.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {notifyLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save Profile confirmation modal ── */}
      {showSaveConfirm && (
        <ConfirmModal
          title="Save Profile Changes"
          message={`Are you sure you want to update the profile for ${displayName ?? data?.profile?.email ?? 'this user'}? This will overwrite their current profile data.`}
          confirmLabel="Save Changes"
          loading={saveLoading}
          onConfirm={handleSaveProfile}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      {/* ── Delete User confirmation modal ── */}
      {showDeleteUser && (
        <ConfirmModal
          title="Delete User Account"
          message={`This will permanently delete ${displayName ?? data?.profile?.email ?? 'this user'}'s account, all their logs, predictions, and profile data. This cannot be undone.`}
          confirmLabel="Delete User"
          destructive
          loading={deleteUserLoading}
          onConfirm={handleDeleteUser}
          onCancel={() => setShowDeleteUser(false)}
        />
      )}

      {/* ── Hide Log confirmation modal ── */}
      {logToHide && (
        <ConfirmModal
          title="Hide Log Entry"
          message={`Hide the log for ${logToHide.date}? The data is preserved and you can unhide it at any time. The user will no longer see this entry.`}
          confirmLabel="Hide Log"
          loading={hideLogLoading}
          onConfirm={handleHideLog}
          onCancel={() => setLogToHide(null)}
        />
      )}

      {/* ── Password Reset modal ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Reset User Password</h2>
              <button onClick={() => { setShowPasswordModal(false); setTempPassword(''); setResetMessage('') }}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {tempPassword ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 space-y-3">
                  <p className="text-sm text-foreground">Share this temporary password with the user:</p>
                  <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                    <code className="flex-1 font-mono text-sm font-semibold text-foreground">{tempPassword}</code>
                    <button onClick={() => { navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                      className="p-1.5 hover:bg-muted rounded transition-colors" title="Copy">
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">⚠ The user should change this immediately upon login.</p>
                </div>
                <button onClick={() => { setShowPasswordModal(false); setTempPassword(''); setResetMessage('') }}
                  className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-medium transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {resetMessage && (
                  <p className={`text-sm p-3 rounded-lg ${resetMessage.includes('Error') ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'}`}>
                    {resetMessage}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Choose a method to help the user reset their password:</p>

                <button onClick={handleSendResetEmail} disabled={resetLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-left">
                  <Send className="w-4 h-4 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Send Reset Email</p>
                    <p className="text-xs text-muted-foreground">User receives a link to reset their password</p>
                  </div>
                </button>

                <button onClick={handleGenerateTempPassword} disabled={resetLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-left">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Generate Temporary Password</p>
                    <p className="text-xs text-muted-foreground">You&apos;ll share a one-time password directly</p>
                  </div>
                </button>

                <button onClick={() => setShowPasswordModal(false)}
                  className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
