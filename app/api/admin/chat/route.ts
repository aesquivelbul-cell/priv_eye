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
        const [logsRes, profilesRes, authRes, surveysRes] = await Promise.all([
          adminClient
            .from('daily_logs')
            .select('id, user_id, email, risk_level, screen_time, sleep_hours, eye_strain, headaches, blurry_vision, dry_eyes, gender, age, year_level, field_of_study, date')
            .order('date', { ascending: false }),
          adminClient
            .from('user_profiles')
            .select('user_id, first_name, last_name, gender, age, year_level, field_of_study'),
          adminClient.auth.admin.listUsers({ perPage: 1000 }),
          adminClient
            .from('survey_responses')
            .select('email, eg_age, eg_gender, eg_year_level, eg_field_of_study, eg_overall_eye_strain, cvsq_status, cvsq_total')
            .order('response_timestamp', { ascending: false })
            .limit(200),
        ]);

        const logs     = logsRes.data ?? [];
        const profiles = profilesRes.data ?? [];
        const surveys  = surveysRes.data ?? [];
        const registeredUserCount = authRes.data?.users?.length ?? 0;

        const profileNameMap = new Map<string, string>();
        for (const p of profiles) {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
          if (name) profileNameMap.set(p.user_id, name);
        }

        if (logs.length > 0) {
          // Most-recent log per unique user (matches UI table)
          const userMap = new Map<string, any>();
          for (const log of logs) {
            const key = (log as any).user_id ?? `anon:${(log as any).email ?? Math.random()}`;
            if (!userMap.has(key)) userMap.set(key, log);
          }
          const totalUniqueUsers = userMap.size;

          const riskCounts: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
          const highRiskList: string[] = [];
          const criticalList: string[] = [];

          for (const [, log] of userMap) {
            const lv = (log as any).risk_level;
            if (lv in riskCounts) riskCounts[lv]++;
            const uId = (log as any).user_id;
            const uName = (uId && profileNameMap.get(uId)) || (log as any).email || 'Anonymous Student';
            const uField = (log as any).field_of_study ? ` (${(log as any).field_of_study})` : '';
            if (lv === 'Critical') criticalList.push(`${uName}${uField}`);
            else if (lv === 'High') highRiskList.push(`${uName}${uField}`);
          }

          const avgScreen      = (logs.reduce((s: number, l: any) => s + (l.screen_time || 0), 0) / logs.length).toFixed(1);
          const eyeStrainCount = logs.filter((l: any) => l.eye_strain === 1).length;
          const headachesCount = logs.filter((l: any) => l.headaches  === 1).length;
          const blurryCount    = logs.filter((l: any) => l.blurry_vision === 1).length;
          const dryEyesCount   = logs.filter((l: any) => l.dry_eyes === 1).length;

          // Group by user to compute multi-log user trends (Improved vs Worsened)
          const byUserLogs = new Map<string, any[]>();
          for (const l of logs) {
            if (l.user_id) {
              if (!byUserLogs.has(l.user_id)) byUserLogs.set(l.user_id, []);
              byUserLogs.get(l.user_id)!.push(l);
            }
          }

          const worsenedUsers: string[] = [];
          const improvedUsers: string[] = [];
          const riskRank: Record<string, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 };

          for (const [uId, uLogs] of byUserLogs) {
            if (uLogs.length >= 2) {
              const uName = profileNameMap.get(uId) || uLogs[0].email || uId;
              const earliest = uLogs[uLogs.length - 1]; // oldest since sorted desc
              const latest = uLogs[0];
              const earliestRank = riskRank[earliest.risk_level] ?? 0;
              const latestRank = riskRank[latest.risk_level] ?? 0;
              if (latestRank > earliestRank || (latest.screen_time > earliest.screen_time + 1.5)) {
                worsenedUsers.push(`${uName} (Risk: ${earliest.risk_level} -> ${latest.risk_level}, Screen: ${earliest.screen_time}h -> ${latest.screen_time}h)`);
              } else if (latestRank < earliestRank || (latest.screen_time < earliest.screen_time - 1)) {
                improvedUsers.push(`${uName} (Risk: ${earliest.risk_level} -> ${latest.risk_level})`);
              }
            }
          }

          const tally = (arr: any[], field: string) => {
            const map: Record<string, number> = {};
            for (const p of arr) { const v = (p as any)[field] || 'Unknown'; map[v] = (map[v] || 0) + 1; }
            return Object.entries(map).map(([k, c]) => `${k}=${c}`).join(', ');
          };

          const tally2 = (arr: any[], field: string) => {
            const map: Record<string, number> = {};
            for (const l of arr) { const v = (l as any)[field] || 'Unknown'; map[v] = (map[v] || 0) + 1; }
            return Object.entries(map).map(([k, c]) => `${k}=${c}`).join(', ');
          };

          userContext = `SYSTEM-WIDE ANALYTICS & DATABASE RECORDS:

You are providing administrative intelligence directly to the authorized EyeGuard administrator. You have FULL permission and clearance to share specific user names, accounts, trends, and risk statistics. Never refuse an administrator's query or claim student privacy restrictions, because the admin needs this exact clinical data for targeted interventions, audits, and triage.

User Totals:
- Total registered students/users: ${totalUniqueUsers}
- Total daily log records: ${logs.length}
- Auth registered accounts: ${registeredUserCount}

Current Risk Distribution (Matches Admin Analytics UI):
- Critical (${riskCounts.Critical} users, ${Math.round((riskCounts.Critical / totalUniqueUsers) * 1000) / 10}%): Highest urgency. Notable Critical users: ${criticalList.slice(0, 20).join(', ') || 'None'}
- High (${riskCounts.High} users, ${Math.round((riskCounts.High / totalUniqueUsers) * 1000) / 10}%): Notable High-Risk users: ${highRiskList.slice(0, 20).join(', ') || 'None'}
- Moderate (${riskCounts.Moderate} users, ${Math.round((riskCounts.Moderate / totalUniqueUsers) * 1000) / 10}%)
- Low (${riskCounts.Low} users, ${Math.round((riskCounts.Low / totalUniqueUsers) * 1000) / 10}%)

Symptom Frequency (Total instances reported across user population):
- Eye Strain: ${eyeStrainCount} users
- Headaches: ${headachesCount} users
- Blurry Vision: ${blurryCount} users
- Dry Eyes: ${dryEyesCount} users

Progress Tracking / Trends:
- Worsened users: ${worsenedUsers.length > 0 ? worsenedUsers.join('; ') : 'None currently detected'}
- Improved users: ${improvedUsers.length > 0 ? improvedUsers.join('; ') : 'None currently detected'}

Averages & Benchmarks:
- Daily Screen Time: ${avgScreen} hours/day (Recommended max: ≤8 hours)
- Demographics:
  • Gender: ${tally2(logs, 'gender') || tally(profiles, 'gender') || 'No data'}
  • Year level: ${tally2(logs, 'year_level') || tally(profiles, 'year_level') || 'No data'}
  • Field of study: ${tally2(logs, 'field_of_study') || tally(profiles, 'field_of_study') || 'No data'}

CVS-Smart Clinical Survey Records:
${surveys.slice(0, 15).map(s => `- ${s.email}: CVS Status: ${s.cvsq_status ?? 'N/A'} (Score: ${s.cvsq_total ?? 'N/A'}), Overall Eye Strain: ${s.eg_overall_eye_strain ?? 'N/A'}`).join('\n')}`;

        } else {
          userContext = 'No log data available yet.';
        }
      } catch (err) {
        console.error('[AdminChat] Error fetching system stats:', err);
        userContext = 'Could not load system-wide analytics at this time.';
      }
    }

    // ── System instruction ────────────────────────────────────────────────────
    const systemInstruction = `You are EyeGuard AI Admin Assistant — an omniscient, intelligent clinical and analytical companion for administrators of the EyeGuard application.

You have FULL clearance and administrative visibility into all user data, clinical records, risk predictions, symptoms, trends, and individual user records provided below:
${userContext}

Guidelines for Admin Intelligence:
1. Complete Authority & Transparency:
   - The user asking you questions is the verified System Administrator.
   - NEVER hide behind "privacy policies", "FERPA", "HIPAA", or claims that "data is aggregated anonymously".
   - Answer ANY question directly, specifically, accurately, and thoroughly with specific names, numbers, percentages, email addresses, symptoms, and risk levels.
2. Clinical & Analytical Depth:
   - When asked about users who worsened, who are critical, what symptoms are trending, or who needs immediate intervention, name them specifically and provide their exact metrics.
   - If asked for recommendations, provide evidence-based clinical triage (20-20-20 rule, blue light filtration, ergonomic distance 50-70cm, artificial tears for dry eyes, luminance matching).
   - If asked a general eye-health, optometry, or AI prediction question, answer with expert knowledge and precision.
3. Formatting:
   - Format answers cleanly with markdown bolding, bullet points, and numbered lists where appropriate for rapid administrative review.`;



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

