import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

import { createAdminClient } from '@/lib/supabase/admin';

import { isAdmin } from '@/lib/admin-guard';

import { callGemini, type GeminiMessage } from '@/lib/gemini';



export async function POST(request: NextRequest) {

  try {

    // ── Auth guard ────────────────────────────────────────────────────────────

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!isAdmin(user)) {

      return NextResponse.json({ error: 'Unauthorized — Admin access required' }, { status: 401 });

    }



    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {

      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });

    }



    const { message, history, targetUserId } = await request.json();

    if (!message?.trim()) {

      return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    }



    // ── Admin DB client ───────────────────────────────────────────────────────

    let adminClient;

    try {

      adminClient = createAdminClient();

    } catch {

      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    }



    // ── Build context ─────────────────────────────────────────────────────────

    let userContext = '';



    if (targetUserId) {

      // ── Per-user context ──────────────────────────────────────────────────

      try {

        const { data: authUserData } = await adminClient.auth.admin.getUserById(targetUserId);

        const authEmail = authUserData?.user?.email ?? null;



        const { data: profile } = await adminClient

          .from('user_profiles')

          .select('first_name, last_name, age, gender, year_level, field_of_study')

          .eq('user_id', targetUserId)

          .single();



        const { data: logs } = await adminClient

          .from('daily_logs')

          .select('date, screen_time, sleep_hours, brightness, age, gender, year_level, field_of_study, sym_dry_eyes, sym_eye_itchiness, sym_blurred_vision, sym_headaches, sym_eye_irritation, sym_light_sensitivity, sym_difficulty_focusing, sym_neck_shoulder_pain, sym_mental_fatigue, sym_difficulty_concentrating, overall_eye_strain, risk_level, notes')

          .eq('user_id', targetUserId)

          .order('date', { ascending: false })

          .limit(30);



        const { data: predictions } = await adminClient

          .from('predictions')

          .select('risk_level, risk_percentage, fatigue_score, recommendations, created_at')

          .eq('user_id', targetUserId)

          .order('created_at', { ascending: false })

          .limit(5);



        const latestLog = logs?.[0];

        const age           = profile?.age           ?? latestLog?.age           ?? null;

        const gender        = profile?.gender        ?? latestLog?.gender        ?? null;

        const yearLevel     = profile?.year_level    ?? latestLog?.year_level    ?? null;

        const fieldOfStudy  = profile?.field_of_study ?? latestLog?.field_of_study ?? null;



        const profileLines = [

          `User ID: ${targetUserId}`,

          authEmail           ? `- Email: ${authEmail}`                : null,

          profile?.first_name || profile?.last_name

                              ? `- Name: ${[profile?.first_name, profile?.last_name].filter(Boolean).join(' ')}` : null,

          age                 ? `- Age: ${age}`                        : null,

          gender              ? `- Gender: ${gender}`                  : null,

          yearLevel           ? `- Year level: ${yearLevel}`           : null,

          fieldOfStudy        ? `- Field of study: ${fieldOfStudy}`    : null,

        ].filter(Boolean).join('\n');



        let healthLines = '';

        if (logs && logs.length > 0) {

          const riskLabels = ['Low', 'Moderate', 'High', 'Critical'];

          const recentRisks     = logs.map((l: any) => l.risk_level).filter(Boolean);

          const highRiskDays    = logs.filter((l: any) => l.risk_level === 'High' || l.risk_level === 'Critical').length;

          const avgScreen       = (logs.reduce((s: number, l: any) => s + (l.screen_time   || 0), 0) / logs.length).toFixed(1);

          const avgSleep        = (logs.reduce((s: number, l: any) => s + (l.sleep_hours   || 0), 0) / logs.length).toFixed(1);

          const symCount = (field: string) => logs.filter((l: any) => l[field] && l[field] !== 'Never').length;

          const eyeStrainDays   = symCount('sym_eye_irritation');

          const headacheDays    = symCount('sym_headaches');

          const dryEyesDays     = symCount('sym_dry_eyes');

          const blurryDays      = symCount('sym_blurred_vision');



          const recentNotes = logs

            .map((l: any) => l.notes?.trim())

            .filter(Boolean)

            .slice(0, 3);



          healthLines = `

HEALTH DATA (last ${logs.length} logs):

- Average daily screen time: ${avgScreen} hours

- Average sleep: ${avgSleep} hours/night

- Eye strain: ${eyeStrainDays}/${logs.length} days

- Headaches: ${headacheDays}/${logs.length} days

- Dry eyes: ${dryEyesDays}/${logs.length} days

- Blurry vision: ${blurryDays}/${logs.length} days

- High/Critical risk days: ${highRiskDays}/${logs.length}

- Recent risk levels: ${recentRisks.join(', ')}`;



          if (predictions && predictions.length > 0) {

            const p = predictions[0] as any;

            healthLines += `

- Latest risk score: ${(p.risk_percentage ?? 0).toFixed(1)}% (${riskLabels[p.risk_level] ?? 'Unknown'})

- Latest fatigue score: ${(p.fatigue_score ?? 0).toFixed(1)}/10`;



            const recs = (p.recommendations as Array<{ title?: string; category?: string }> | null) ?? [];

            if (recs.length > 0) {

              healthLines += `

- Current recommendations:

${recs.slice(0, 3).map(r => `  • [${r.category ?? 'general'}] ${r.title ?? ''}`).join('\n')}`;

            }

          }



          if (recentNotes.length > 0) {

            healthLines += `

- User notes from recent logs:

${recentNotes.map((n: string) => `  • ${n}`).join('\n')}`;

          }

        }



        userContext = `TARGET USER PROFILE:\n${profileLines || '(no profile data)'}\n${healthLines}`;

      } catch (err) {

        console.error('[AdminChat] Error fetching user data:', err);

        userContext = `Note: Could not fetch full data for user ${targetUserId}`;

      }



    } else {

      // ── System-wide context ───────────────────────────────────────────────

      try {

        const [logsRes, profilesRes, authRes] = await Promise.all([

          adminClient

            .from('daily_logs')

            .select('user_id, email, risk_level, screen_time, eye_strain, headaches, blurry_vision, dry_eyes, gender, age, year_level, field_of_study, date')

            .order('date', { ascending: false }),

          adminClient

            .from('user_profiles')

            .select('user_id, gender, age, year_level, field_of_study'),

          adminClient.auth.admin.listUsers({ perPage: 1000 }),

        ]);



        const logs     = logsRes.data ?? [];

        const profiles = profilesRes.data ?? [];

        const registeredUserCount = authRes.data?.users?.length ?? 0;



        if (logs.length > 0) {

          // Most-recent log per unique user (matches UI table)

          const userMap = new Map<string, any>();

          for (const log of logs) {

            const key = (log as any).user_id ?? `anon:${(log as any).email ?? Math.random()}`;

            if (!userMap.has(key)) userMap.set(key, log);

          }

          const totalUniqueUsers = userMap.size;



          const riskCounts: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };

          for (const [, log] of userMap) {

            const lv = (log as any).risk_level;

            if (lv in riskCounts) riskCounts[lv]++;

          }



          const avgScreen      = (logs.reduce((s: number, l: any) => s + (l.screen_time || 0), 0) / logs.length).toFixed(1);

          const eyeStrainCount = logs.filter((l: any) => l.eye_strain === 1).length;

          const headachesCount = logs.filter((l: any) => l.headaches  === 1).length;



          const tally = (arr: any[], field: string) => {

            const map: Record<string, number> = {};

            for (const p of arr) { const v = (p as any)[field] || 'Unknown'; map[v] = (map[v] || 0) + 1; }

            return Object.entries(map).map(([k, c]) => `${k}=${c}`).join(', ');

          };



          // Tally demographics from all logs (covers migrated survey users too)

          const tally2 = (arr: any[], field: string) => {

            const map: Record<string, number> = {};

            for (const l of arr) { const v = (l as any)[field] || 'Unknown'; map[v] = (map[v] || 0) + 1; }

            return Object.entries(map).map(([k, c]) => `${k}=${c}`).join(', ');

          };



          userContext = `SYSTEM-WIDE ANALYTICS:

IMPORTANT — All users are real registered users:

  All previous survey respondents have been fully migrated into the EyeGuard system as real registered users.

  There is NO distinction between survey respondents and registered users — they are ALL users.

  Auth system account count: ${registeredUserCount}

  Total unique users with log data: ${totalUniqueUsers}

  When asked how many users, always answer: ${totalUniqueUsers} total users.



Totals:

- Total registered users: ${totalUniqueUsers}

- Total log entries: ${logs.length}



Risk distribution (per most-recent log per user — matches the UI):

- Low: ${riskCounts.Low}

- Moderate: ${riskCounts.Moderate}

- High: ${riskCounts.High}

- Critical: ${riskCounts.Critical}



Averages (all logs):

- Screen time: ${avgScreen} h/day

- Eye strain reports: ${eyeStrainCount}/${logs.length} log entries

- Headache reports: ${headachesCount}/${logs.length} log entries



Demographics (all users):

- Gender: ${tally2(logs, 'gender') || tally(profiles, 'gender') || 'No data'}

- Year level: ${tally2(logs, 'year_level') || tally(profiles, 'year_level') || 'No data'}

- Field of study: ${tally2(logs, 'field_of_study') || tally(profiles, 'field_of_study') || 'No data'}`;

        } else {

          userContext = 'No log data available yet.';

        }

      } catch (err) {

        console.error('[AdminChat] Error fetching system stats:', err);

        userContext = 'Could not load system-wide analytics at this time.';

      }

    }



    // ── System instruction ────────────────────────────────────────────────────

        const systemInstruction = `You are EyeGuard AI Admin Assistant — an eye health analytics tool for administrators of the EyeGuard student eye-health monitoring app.

You have access to the following database information:
${userContext}

CRITICAL INSTRUCTION — User Count:
  All survey respondents have been migrated and are now real registered users of EyeGuard.
  When asked about the number of users, ALWAYS use the "Total registered users" figure from the context above.
  Do NOT say there are only 6 registered users — the auth system account count is not the total user count.
  Do NOT distinguish between "survey respondents" and "registered users" — they are all simply "users".

Guidelines:
- You are speaking to an ADMINISTRATOR, not a regular user.
- Give detailed analytics, trends, and data-driven insights.
- Answer questions about users or system data directly and confidently.
- Identify patterns in health data and risk factors.
- Suggest interventions for high-risk users when relevant.
- Be analytical and precise with numbers; reference specific data points.
- Flag concerning patterns or outliers.
- Maintain privacy awareness — never expose PII unnecessarily.
- If data is missing, say so rather than guessing.`;



    // ── Build Gemini conversation turns ───────────────────────────────────────

    const contents: GeminiMessage[] = [];



    if (history && Array.isArray(history)) {

      for (const msg of history.slice(1).slice(-10)) {

        contents.push({

          role: msg.role === 'assistant' ? 'model' : 'user',

          parts: [{ text: msg.content }],

        });

      }

    }



    contents.push({ role: 'user', parts: [{ text: message }] });



    // ── Call Gemini via shared helper ─────────────────────────────────────────

    const result = await callGemini({

      apiKey,

      systemInstruction,

      contents,

      temperature: 0.7,

      maxOutputTokens: 1024,

    });



    if ('error' in result) {

      return NextResponse.json({ error: result.error }, { status: result.status });

    }



    return NextResponse.json({ reply: result.reply });



  } catch (error) {

    console.error('[AdminChat] Unhandled error:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

  }

}

