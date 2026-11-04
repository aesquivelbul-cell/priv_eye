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
    // Require an authenticated session — this endpoint uses the admin client
    // so we need at least a valid user to prevent public data exposure.
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
        .select('screen_time, sleep_hours, brightness'),
      adminClient
        .from('survey_responses')
        .select('eg_academic_screen_time, eg_non_academic_screen_time, eg_screen_brightness, eg_sleep_hours'),
    ])

    const logs    = logsRes.data    ?? []
    const surveys = (surveysRes.data ?? []) as Record<string, unknown>[]

    // ── Screen time ──────────────────────────────────────────────────────────
    const dailyScreenTimes = logs.map((l: any) => Number(l.screen_time) || 0)
    const surveyScreenTimes = surveys.map(s => {
      const a = ACAD_MAP[s.eg_academic_screen_time as string]     ?? 0
      const b = NON_ACAD_MAP[s.eg_non_academic_screen_time as string] ?? 0
      return a + b
    })
    const allScreenTimes = [...dailyScreenTimes, ...surveyScreenTimes].filter(v => v > 0)

    // ── Sleep hours ──────────────────────────────────────────────────────────
    const SLEEP_MAP: Record<string, number> = {
      'Less than 5 hours': 4.5, '5–6 hours': 5.5, '7–8 hours': 7.5, 'More than 8 hours': 8.5,
    }
    const dailySleepHours = logs.map((l: any) => Number(l.sleep_hours) || 0)
    const surveySleepHours = surveys.map(s => {
      const raw = s.eg_sleep_hours as string | null
      return SLEEP_MAP[raw ?? ''] ?? (Number(raw) || 0)
    })
    const allSleepHours = [...dailySleepHours, ...surveySleepHours].filter(v => v > 0)

    // ── Brightness ───────────────────────────────────────────────────────────
    const dailyBrightness = logs.map((l: any) => Number(l.brightness) || 0)
    const surveyBrightness = surveys.map(s => {
      return BRIGHTNESS_MAP[s.eg_screen_brightness as string] ?? 50
    })
    const allBrightness = [...dailyBrightness, ...surveyBrightness].filter(v => v > 0)

    // ── Averages ─────────────────────────────────────────────────────────────
    const avg = (arr: number[]) => arr.length > 0
      ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
      : 0

    const totalRespondents = logs.length + surveys.length

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
