import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const adminClient = createAdminClient()

    // Run all three counts in parallel
    const [logsRes, surveyRes, predictionsRes] = await Promise.all([
      adminClient.from('daily_logs').select('user_id, email'),
      adminClient.from('survey_responses').select('email', { count: 'exact', head: false }),
      adminClient.from('predictions').select('id', { count: 'exact', head: true }),
    ])

    const logs    = logsRes.data ?? []
    const surveys = surveyRes.data ?? []

    const isSurveyMigrated = logs.some((l: any) => !l.user_id || l.source === 'survey')
    const registeredUsers  = new Set(logs.filter((l: any) => l.user_id).map((l: any) => l.user_id))
    const surveyLogsCount  = logs.filter((l: any) => !l.user_id || l.source === 'survey').length

    let totalRespondents = 0
    let totalLogs = 0

    if (isSurveyMigrated) {
      totalRespondents = registeredUsers.size + surveyLogsCount
      totalLogs = logs.length
    } else {
      const dailyEmails = new Set(logs.map((l: any) => l.email).filter(Boolean))
      let surveyUnique = 0
      for (const s of surveys) {
        if (s.email && !dailyEmails.has(s.email)) surveyUnique++
      }
      totalRespondents = registeredUsers.size + surveyUnique
      totalLogs = logs.length + surveys.length
    }

    return NextResponse.json({
      respondents:          totalRespondents,
      logsRecorded:         totalLogs,
      predictionsGenerated: predictionsRes.count ?? 0,
    })
  } catch {
    return NextResponse.json({
      respondents: 0, logsRecorded: 0, predictionsGenerated: 0,
    })
  }
}
