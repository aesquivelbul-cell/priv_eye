import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Maps categorical screen time strings from survey_responses to numeric hours
const ACAD_MAP: Record<string, number> = {
  'Less than 2 hours': 1, '2–4 hours': 3, '4–6 hours': 5,
  '6–8 hours': 7, 'More than 8 hours': 9,
}
const NON_ACAD_MAP: Record<string, number> = {
  'Less than 1 hour': 0.5, '1–3 hours': 2, '3–5 hours': 4,
  '5–7 hours': 6, 'More than 7 hours': 8,
}
const BRIGHTNESS_MAP: Record<string, number> = {
  'Low (0–25%)': 15, 'Low (0-25%)': 15,
  'Medium (26–50%)': 40,
  'Medium-High (51–75%)': 65,
  'High (76–100%)': 90,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ avgScreenTime: 0, avgSleepHours: 0, avgBrightness: 0, totalRespondents: 0 })
    }

    const adminClient = createAdminClient()

    // Fetch both sources in parallel
    const [logsRes, surveysRes] = await Promise.all([
      adminClient
        .from('daily_logs')
        .select('user_id, email, screen_time, sleep_hours, brightness, source'),
      adminClient
        .from('survey_responses')
        .select('email, eg_academic_screen_time, eg_non_academic_screen_time, eg_screen_brightness, eg_sleep_hours'),
    ])

    const logs    = logsRes.data    ?? []
    const surveys = (surveysRes.data ?? []) as Record<string, unknown>[]

    // Detect if survey data is already migrated into daily_logs
    const isSurveyMigrated = logs.some((l: any) => !l.user_id || l.source === 'survey')

    let allScreenTimes: number[] = []
    let allSleepHours: number[] = []
    let allBrightness: number[] = []
    let totalRespondents = 0

    if (isSurveyMigrated) {
      // All survey entries are already stored in daily_logs — do NOT double-count from survey_responses!
      allScreenTimes = logs.map((l: any) => Number(l.screen_time) || 0).filter(v => v > 0)
      allSleepHours  = logs.map((l: any) => Number(l.sleep_hours) || 0).filter(v => v > 0)
      allBrightness  = logs.map((l: any) => Number(l.brightness) || 0).filter(v => v > 0)

      const registeredUsers = new Set(logs.filter((l: any) => l.user_id).map((l: any) => l.user_id))
      const migratedSurveyLogsCount = logs.filter((l: any) => !l.user_id || l.source === 'survey').length
      totalRespondents = registeredUsers.size + migratedSurveyLogsCount
    } else {
      const dailyScreenTimes = logs.map((l: any) => Number(l.screen_time) || 0)
      const surveyScreenTimes = surveys.map(s => {
        const a = ACAD_MAP[s.eg_academic_screen_time as string]     ?? 0
        const b = NON_ACAD_MAP[s.eg_non_academic_screen_time as string] ?? 0
        return a + b
      })
      allScreenTimes = [...dailyScreenTimes, ...surveyScreenTimes].filter(v => v > 0)

      const SLEEP_MAP: Record<string, number> = {
        'Less than 5 hours': 4.5, '5–6 hours': 5.5, '7–8 hours': 7.5, 'More than 8 hours': 8.5,
      }
      const dailySleepHours = logs.map((l: any) => Number(l.sleep_hours) || 0)
      const surveySleepHours = surveys.map(s => {
        const raw = s.eg_sleep_hours as string | null
        return SLEEP_MAP[raw ?? ''] ?? (Number(raw) || 0)
      })
      allSleepHours = [...dailySleepHours, ...surveySleepHours].filter(v => v > 0)

      const dailyBrightness = logs.map((l: any) => Number(l.brightness) || 0)
      const surveyBrightness = surveys.map(s => {
        return BRIGHTNESS_MAP[s.eg_screen_brightness as string] ?? 50
      })
      allBrightness = [...dailyBrightness, ...surveyBrightness].filter(v => v > 0)

      const dailyEmails = new Set(logs.map((l: any) => l.email).filter(Boolean))
      let surveyUnique = 0
      for (const s of surveys) {
        if (s.email && !dailyEmails.has(s.email as string)) surveyUnique++
      }
      const registeredUsers = new Set(logs.filter((l: any) => l.user_id).map((l: any) => l.user_id))
      totalRespondents = registeredUsers.size + surveyUnique
    }

    const avg = (arr: number[]) => arr.length > 0
      ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
      : 0

    return NextResponse.json({
      avgScreenTime:   avg(allScreenTimes),
      avgSleepHours:   avg(allSleepHours),
      avgBrightness:   Math.round(avg(allBrightness)),
      totalRespondents,
    })
  } catch {
    return NextResponse.json({ avgScreenTime: 0, avgSleepHours: 0, avgBrightness: 0, totalRespondents: 0 })
  }
}
