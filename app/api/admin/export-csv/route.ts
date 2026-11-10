import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'
import { generateXlsx, type XlsxColumn, type CellValue } from '@/lib/xlsx-export'
import { NextResponse } from 'next/server'

// ── Combined export columns ───────────────────────────────────────────────────
// One sheet covers both daily_logs (live) and survey_responses (imported).
// Each row has a "Source" column so you can filter in Excel.

const COLUMNS: XlsxColumn[] = [
  { header: 'Source',                       key: 'Source',                       width: 16 },
  { header: 'Date / Timestamp',             key: 'Date',                         width: 22 },
  { header: 'Email',                        key: 'Email',                        width: 38 },
  // Profile
  { header: 'Age',                          key: 'Age',                          width: 10 },
  { header: 'Gender',                       key: 'Gender',                       width: 14 },
  { header: 'Year Level',                   key: 'Year Level',                   width: 16 },
  { header: 'Field of Study',               key: 'Field of Study',               width: 26 },
  // CVSQ Part 1
  { header: 'CVS-Q: Visual Complaints',     key: 'CVSQ Visual',                  width: 40 },
  { header: 'CVS-Q: Ocular Complaints',     key: 'CVSQ Ocular',                  width: 40 },
  { header: 'CVS-Q: Extraocular Complaints',key: 'CVSQ Extraocular',             width: 40 },
  { header: 'CVS-Q: Frequency',             key: 'CVSQ Frequency',               width: 16 },
  { header: 'CVS-Q: Screen Associated',     key: 'CVSQ Screen',                  width: 18 },
  { header: 'CVS-Q Total Score',            key: 'CVSQ Total',                   width: 14 },
  { header: 'CVS-Q Status',                 key: 'CVSQ Status',                  width: 22 },
  // Screen time
  { header: 'Academic Screen Time',         key: 'Academic Screen Time',         width: 22 },
  { header: 'Non-Academic Screen Time',     key: 'Non-Academic Screen Time',     width: 24 },
  { header: 'Total Screen Time (hrs)',      key: 'Screen Time (hrs)',            width: 20 },
  { header: 'Primary Device',              key: 'Primary Device',               width: 18 },
  { header: 'Continuous Use Without Break', key: 'Continuous Use',               width: 22 },
  { header: 'Online Classes Per Day',       key: 'Online Classes',               width: 20 },
  // Habits & environment
  { header: '20-20-20 Rule',               key: '20-20-20',                     width: 14 },
  { header: 'Blue Light Filter',           key: 'Blue Light Filter',            width: 16 },
  { header: 'Screen Brightness',           key: 'Screen Brightness',            width: 18 },
  { header: 'Dark Room Use',               key: 'Dark Room Use',                width: 14 },
  { header: 'Screen Distance',             key: 'Screen Distance',              width: 16 },
  { header: 'Wears Glasses',               key: 'Wears Glasses',                width: 14 },
  { header: 'Blue Light Glasses',          key: 'Blue Light Glasses',           width: 16 },
  { header: 'Break Frequency',             key: 'Break Frequency',              width: 22 },
  { header: 'Sleep Hours',                 key: 'Sleep Hours',                  width: 14 },
  // Symptom grid
  { header: 'Sym: Dry Eyes',              key: 'Sym Dry Eyes',                 width: 14 },
  { header: 'Sym: Eye Itchiness',         key: 'Sym Eye Itchiness',            width: 16 },
  { header: 'Sym: Blurred Vision',        key: 'Sym Blurred Vision',           width: 18 },
  { header: 'Sym: Headaches',             key: 'Sym Headaches',                width: 14 },
  { header: 'Sym: Eye Irritation',        key: 'Sym Eye Irritation',           width: 18 },
  { header: 'Sym: Light Sensitivity',     key: 'Sym Light Sensitivity',        width: 18 },
  { header: 'Sym: Difficulty Focusing',   key: 'Sym Difficulty Focusing',      width: 20 },
  { header: 'Sym: Neck/Shoulder Pain',    key: 'Sym Neck Shoulder',            width: 20 },
  { header: 'Sym: Mental Fatigue',        key: 'Sym Mental Fatigue',           width: 18 },
  { header: 'Sym: Difficulty Concentrating', key: 'Sym Difficulty Concentrating', width: 26 },
  // Self-assessment
  { header: 'Overall Eye Strain',         key: 'Overall Eye Strain',           width: 18 },
  { header: 'Digital Fatigue Frequency',  key: 'Digital Fatigue Frequency',    width: 22 },
  { header: 'Primary Symptom History',    key: 'Primary Symptom History',      width: 26 },
  // Risk result
  { header: 'Risk Level',                 key: 'Risk Level',                   width: 14 },
]

function s(v: unknown): string { return v == null ? '' : String(v) }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let adminClient
  try { adminClient = createAdminClient() }
  catch { return NextResponse.json({ error: 'Server configuration error' }, { status: 500 }) }

  // Fetch both tables in parallel
  const [logsRes, surveysRes] = await Promise.all([
    adminClient.from('daily_logs').select([
      'id', 'date', 'email', 'age', 'gender', 'year_level', 'field_of_study',
      'academic_screen_time', 'non_academic_screen_time', 'screen_time',
      'primary_device', 'continuous_screen_use', 'online_classes_per_day',
      'follows_20_20_20', 'blue_light_filter', 'screen_brightness',
      'dark_room_use', 'screen_distance', 'wears_glasses', 'blue_light_glasses',
      'break_frequency', 'sleep_hours',
      'sym_dry_eyes', 'sym_eye_itchiness', 'sym_blurred_vision', 'sym_headaches',
      'sym_eye_irritation', 'sym_light_sensitivity', 'sym_difficulty_focusing',
      'sym_neck_shoulder_pain', 'sym_mental_fatigue', 'sym_difficulty_concentrating',
      'overall_eye_strain', 'digital_fatigue_frequency', 'primary_symptom_history',
      'cvsq_visual_complaints', 'cvsq_ocular_complaints', 'cvsq_extraocular_complaints',
      'cvsq_frequency', 'cvsq_screen_associated',
      'risk_level', 'created_at',
    ].join(', ')).order('date', { ascending: false }),
    adminClient.from('survey_responses').select([
      'response_timestamp', 'email', 'eg_age', 'eg_gender', 'eg_year_level', 'eg_field_of_study',
      'cvsq_q1_visual_raw', 'cvsq_q2_ocular_raw', 'cvsq_q3_extraocular_raw',
      'cvsq_q4_frequency', 'cvsq_q5_screen_associated', 'cvsq_total', 'cvsq_status',
      'eg_academic_screen_time', 'eg_non_academic_screen_time', 'eg_primary_device',
      'eg_continuous_screen_use', 'eg_online_classes_per_day',
      'eg_follows_20_20_20', 'eg_blue_light_filter', 'eg_screen_brightness',
      'eg_dark_room_use', 'eg_screen_distance', 'eg_wears_glasses', 'eg_blue_light_glasses',
      'eg_break_frequency', 'eg_sleep_hours',
      'sym_dry_eyes', 'sym_eye_itchiness', 'sym_blurred_vision', 'sym_headaches',
      'sym_eye_irritation', 'sym_light_sensitivity', 'sym_difficulty_focusing',
      'sym_neck_shoulder_pain', 'sym_mental_fatigue', 'sym_difficulty_concentrating',
      'eg_overall_eye_strain', 'eg_digital_fatigue_frequency', 'eg_primary_symptom_history',
    ].join(', ')).order('response_timestamp', { ascending: true }),
  ])

  if (logsRes.error) {
    return NextResponse.json({ error: 'Failed to fetch daily logs' }, { status: 500 })
  }

  // ── Map survey_responses rows first (399 imported research responses) ───────
  const surveyRows = (((surveysRes.data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    'Source':                       'Live Submission',
    'Date':                         s(r.response_timestamp)?.split('T')[0] ?? '',
    'Email':                        s(r.email),
    'Age':                          s(r.eg_age),
    'Gender':                       s(r.eg_gender),
    'Year Level':                   s(r.eg_year_level),
    'Field of Study':               s(r.eg_field_of_study),
    'CVSQ Visual':                  s(r.cvsq_q1_visual_raw),
    'CVSQ Ocular':                  s(r.cvsq_q2_ocular_raw),
    'CVSQ Extraocular':             s(r.cvsq_q3_extraocular_raw),
    'CVSQ Frequency':               s(r.cvsq_q4_frequency),
    'CVSQ Screen':                  s(r.cvsq_q5_screen_associated),
    'CVSQ Total':                   r.cvsq_total ?? '',
    'CVSQ Status':                  s(r.cvsq_status),
    'Academic Screen Time':         s(r.eg_academic_screen_time),
    'Non-Academic Screen Time':     s(r.eg_non_academic_screen_time),
    'Screen Time (hrs)':            '',
    'Primary Device':               s(r.eg_primary_device),
    'Continuous Use':               s(r.eg_continuous_screen_use),
    'Online Classes':               s(r.eg_online_classes_per_day),
    '20-20-20':                     s(r.eg_follows_20_20_20),
    'Blue Light Filter':            s(r.eg_blue_light_filter),
    'Screen Brightness':            s(r.eg_screen_brightness),
    'Dark Room Use':                s(r.eg_dark_room_use),
    'Screen Distance':              s(r.eg_screen_distance),
    'Wears Glasses':                s(r.eg_wears_glasses),
    'Blue Light Glasses':           s(r.eg_blue_light_glasses),
    'Break Frequency':              s(r.eg_break_frequency),
    'Sleep Hours':                  s(r.eg_sleep_hours),
    'Sym Dry Eyes':                 s(r.sym_dry_eyes),
    'Sym Eye Itchiness':            s(r.sym_eye_itchiness),
    'Sym Blurred Vision':           s(r.sym_blurred_vision),
    'Sym Headaches':                s(r.sym_headaches),
    'Sym Eye Irritation':           s(r.sym_eye_irritation),
    'Sym Light Sensitivity':        s(r.sym_light_sensitivity),
    'Sym Difficulty Focusing':      s(r.sym_difficulty_focusing),
    'Sym Neck Shoulder':            s(r.sym_neck_shoulder_pain),
    'Sym Mental Fatigue':           s(r.sym_mental_fatigue),
    'Sym Difficulty Concentrating': s(r.sym_difficulty_concentrating),
    'Overall Eye Strain':           s(r.eg_overall_eye_strain),
    'Digital Fatigue Frequency':    s(r.eg_digital_fatigue_frequency),
    'Primary Symptom History':      s(r.eg_primary_symptom_history),
    'Risk Level':                   '',
  }))) as unknown as Record<string, CellValue>[]

  // ── Map daily_logs rows (live system submissions) ─────────────────────────
  const dailyRows = (((logsRes.data ?? []) as unknown as Record<string, unknown>[]).map(r => {
    // Parse CVSQ complaints JSON arrays
    let cvsqVisual = '', cvsqOcular = '', cvsqExtra = ''
    try { cvsqVisual = JSON.parse(s(r.cvsq_visual_complaints) || '[]').join(', ') } catch { cvsqVisual = s(r.cvsq_visual_complaints) }
    try { cvsqOcular = JSON.parse(s(r.cvsq_ocular_complaints) || '[]').join(', ') } catch { cvsqOcular = s(r.cvsq_ocular_complaints) }
    try { cvsqExtra  = JSON.parse(s(r.cvsq_extraocular_complaints) || '[]').join(', ') } catch { cvsqExtra = s(r.cvsq_extraocular_complaints) }

    return {
      'Source':                       'Live Submission',
      'Date':                         s(r.date),
      'Email':                        s(r.email),
      'Age':                          s(r.age),
      'Gender':                       s(r.gender),
      'Year Level':                   s(r.year_level),
      'Field of Study':               s(r.field_of_study),
      'CVSQ Visual':                  cvsqVisual,
      'CVSQ Ocular':                  cvsqOcular,
      'CVSQ Extraocular':             cvsqExtra,
      'CVSQ Frequency':               s(r.cvsq_frequency),
      'CVSQ Screen':                  s(r.cvsq_screen_associated),
      'CVSQ Total':                   '',
      'CVSQ Status':                  '',
      'Academic Screen Time':         s(r.academic_screen_time),
      'Non-Academic Screen Time':     s(r.non_academic_screen_time),
      'Screen Time (hrs)':            r.screen_time ?? '',
      'Primary Device':               s(r.primary_device),
      'Continuous Use':               s(r.continuous_screen_use),
      'Online Classes':               s(r.online_classes_per_day),
      '20-20-20':                     s(r.follows_20_20_20),
      'Blue Light Filter':            s(r.blue_light_filter),
      'Screen Brightness':            s(r.screen_brightness),
      'Dark Room Use':                s(r.dark_room_use),
      'Screen Distance':              s(r.screen_distance),
      'Wears Glasses':                s(r.wears_glasses),
      'Blue Light Glasses':           s(r.blue_light_glasses),
      'Break Frequency':              s(r.break_frequency),
      'Sleep Hours':                  r.sleep_hours ?? '',
      'Sym Dry Eyes':                 s(r.sym_dry_eyes),
      'Sym Eye Itchiness':            s(r.sym_eye_itchiness),
      'Sym Blurred Vision':           s(r.sym_blurred_vision),
      'Sym Headaches':                s(r.sym_headaches),
      'Sym Eye Irritation':           s(r.sym_eye_irritation),
      'Sym Light Sensitivity':        s(r.sym_light_sensitivity),
      'Sym Difficulty Focusing':      s(r.sym_difficulty_focusing),
      'Sym Neck Shoulder':            s(r.sym_neck_shoulder_pain),
      'Sym Mental Fatigue':           s(r.sym_mental_fatigue),
      'Sym Difficulty Concentrating': s(r.sym_difficulty_concentrating),
      'Overall Eye Strain':           s(r.overall_eye_strain),
      'Digital Fatigue Frequency':    s(r.digital_fatigue_frequency),
      'Primary Symptom History':      s(r.primary_symptom_history),
      'Risk Level':                   s(r.risk_level),
    }
  })) as unknown as Record<string, CellValue>[]

  // ── Combine: survey responses first, then live submissions ────────────────
  const allRows = [...surveyRows, ...dailyRows]

  try {
    const xlsx  = generateXlsx(allRows, COLUMNS, 'EyeGuard All Responses')
    const today = new Date().toISOString().split('T')[0]
    return new Response(xlsx, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="eyeguard-all-responses-${today}.xlsx"`,
        'Content-Length': xlsx.byteLength.toString(),
      },
    })
  } catch (err) {
    console.error('XLSX generation error:', err)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
