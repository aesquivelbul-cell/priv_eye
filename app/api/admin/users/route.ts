import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10))
  const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
  const search   = searchParams.get('search') ?? ''

  // ── 1. Daily-log respondents (registered + anonymous) ──────────────────────
  let logsQuery = adminClient
    .from('daily_logs')
    .select('user_id, email, age, gender, year_level, field_of_study, date, risk_level')
    .order('date', { ascending: false })

  if (search) logsQuery = logsQuery.ilike('email', `%${search}%`)

  const { data: logs, error: logsErr } = await logsQuery
  if (logsErr) return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })

  // Group daily-log rows by user key (keep most recent = first, already ordered desc)
  const userMap = new Map<string, { userId: string|null; email: string; age: any; gender: any; yearLevel: any; fieldOfStudy: any; lastLogDate: string; lastRiskLevel: string; source: string }>()
  for (const log of logs ?? []) {
    const key = log.user_id ?? `anon:${log.email}`
    if (!userMap.has(key)) {
      userMap.set(key, {
        userId:        log.user_id ?? null,
        email:         log.email ?? '',
        age:           log.age ?? null,
        gender:        log.gender ?? null,
        yearLevel:     log.year_level ?? null,
        fieldOfStudy:  log.field_of_study ?? null,
        lastLogDate:   log.date,
        lastRiskLevel: log.risk_level ?? '',
        source:        'daily_log',
      })
    }
  }

  // ── 2. Survey-response respondents ─────────────────────────────────────────
  let surveyQuery = adminClient
    .from('survey_responses')
    .select('email, eg_age, eg_gender, eg_year_level, eg_field_of_study, response_timestamp, eg_overall_eye_strain, cvsq_status')
    .order('response_timestamp', { ascending: false })

  if (search) surveyQuery = surveyQuery.ilike('email', `%${search}%`)

  const { data: surveys } = await surveyQuery

  // Precompute a lowercase Set of emails already in daily_logs — O(1) lookup
  const dailyLogEmails = new Set<string>(
    [...userMap.values()].map(u => u.email.toLowerCase()).filter(Boolean)
  )

  // Map overall_eye_strain to a risk level label for display
  const strainToRisk = (s: string|null) => {
    if (s === 'Severe') return 'High'
    if (s === 'Moderate') return 'Moderate'
    if (s === 'Mild') return 'Low'
    return 'Low'
  }

  for (const s of surveys ?? []) {
    const key = `survey:${s.email}`
    if (!dailyLogEmails.has((s.email ?? '').toLowerCase())) {
      userMap.set(key, {
        userId:        null,
        email:         s.email ?? '',
        age:           s.eg_age ?? null,
        gender:        s.eg_gender ?? null,
        yearLevel:     s.eg_year_level ?? null,
        fieldOfStudy:  s.eg_field_of_study ?? null,
        lastLogDate:   s.response_timestamp ? s.response_timestamp.split('T')[0] : '',
        lastRiskLevel: strainToRisk(s.eg_overall_eye_strain),
        source:        'survey',
      })
    }
  }

  // ── 3. Paginate and return ──────────────────────────────────────────────────
  const allUsers   = Array.from(userMap.values())
  const totalCount = allUsers.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const start      = (page - 1) * pageSize
  const users      = allUsers.slice(start, start + pageSize)

  return NextResponse.json({ users, page, totalPages, totalCount })
}
