import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Gemini models to try in order (newest first)
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured. Please set GEMINI_API_KEY.' }, { status: 500 });
    }

    // ── Build context from Supabase (graceful fallback if unauthenticated / guest) ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let userContext = '';

    if (user) {
      try {
        const [profileResult, logsResult, predictionsResult, progressResult, settingsResult] = await Promise.all([
          supabase.from('user_profiles')
            .select('first_name, last_name, age, gender, year_level, field_of_study, baseline_risk_level, medical_history, preferred_contact_method, opt_in_communications')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase.from('daily_logs')
            .select('date, academic_screen_time, non_academic_screen_time, screen_time, primary_device, breaks_taken, brightness, sleep_hours, sym_dry_eyes, sym_eye_itchiness, sym_blurred_vision, sym_headaches, sym_eye_irritation, sym_light_sensitivity, sym_difficulty_focusing, sym_neck_shoulder_pain, sym_mental_fatigue, sym_difficulty_concentrating, overall_eye_strain, risk_level, notes')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(90),
          supabase.from('predictions')
            .select('risk_level, risk_percentage, fatigue_score, confidence, recommendations, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase.from('user_progress')
            .select('total_logs_count, consecutive_days, last_log_date, avg_screen_time_week, avg_sleep_hours_week, avg_risk_score_week, daily_screen_time_goal, daily_sleep_hours_goal')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase.from('user_settings')
            .select('enable_email_notifications, enable_daily_reminders, reminder_time, theme, language, share_data_for_research, allow_data_export')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        const profile = profileResult.data;
        const logs = logsResult.data ?? [];
        const predictions = predictionsResult.data ?? [];
        const progress = progressResult.data;
        const settings = settingsResult.data;

        const number = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0);
        const average = (field: string) => logs.length
          ? (logs.reduce((sum: number, log: any) => sum + number(log[field]), 0) / logs.length).toFixed(1)
          : '0.0';
        const countPresent = (field: string) => logs.filter((log: any) => log[field] && log[field] !== 'Never').length;

        const logLines = logs.slice(0, 30).map((log: any) => [
          log.date,
          `screen=${log.screen_time ?? 'n/a'}h`,
          `sleep=${log.sleep_hours ?? 'n/a'}h`,
          `brightness=${log.brightness ?? 'n/a'}%`,
          `breaks=${log.breaks_taken ?? 'n/a'}`,
          `risk=${log.risk_level ?? 'n/a'}`
        ].join(', '));

        const latestPrediction = predictions[0] ?? null;

        userContext = `
USER PROFILE:
- Name: ${profile?.first_name || ''} ${profile?.last_name || ''}
- Field: ${profile?.field_of_study || 'N/A'} (Year ${profile?.year_level || 'N/A'})

HEALTH SUMMARY (${logs.length} logs):
- Average screen time: ${average('screen_time')} hours/day
- Average sleep: ${average('sleep_hours')} hours/night
- Headaches reported: ${countPresent('sym_headaches')}/${logs.length} logs
- Blurry vision reported: ${countPresent('sym_blurred_vision')}/${logs.length} logs
- Dry eyes reported: ${countPresent('sym_dry_eyes')}/${logs.length} logs
- Latest prediction: ${latestPrediction ? `${latestPrediction.risk_percentage ?? 'n/a'}% risk, ${latestPrediction.fatigue_score ?? 'n/a'}/10 fatigue` : 'None yet'}
`;
      } catch (err) {
        console.warn('Could not load user details for chat context:', err);
      }
    }

    // ── System instruction ─────────────────────────────────────────────
    const systemInstruction = `You are EyeGuard AI, a helpful, knowledgeable, and friendly eye health and ergonomics coach built into the EyeGuard app.

${userContext ? `User Data Available:\n${userContext}` : 'The user is chatting in guest/general mode or has no logged data yet.'}

Guidelines:
- Answer questions directly, clearly, and concisely.
- For general questions (e.g. "hello", "what is 20-20-20 rule?", "how to reduce screen fatigue"), explain in friendly, supportive terms.
- Ground advice in standard ergonomic practices (AOA 20-20-20 rule, display brightness matching ambient light, frequent blinking, proper viewing distance of 20-28 inches).
- Keep answers concise (1 to 3 short paragraphs max).
- If the user asks about their own history or risk, summarize their logged numbers if available.
- Always include a gentle reminder that this guidance is informational and educational, not a medical diagnosis.`;

    // ── Build Gemini conversation turns ───────────────────────────────
    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(1).slice(-10)) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(msg.content) }],
        });
      }
    }

    contents.push({ role: 'user', parts: [{ text: message }] });

    let lastError = 'Failed to generate response';

    for (const model of GEMINI_MODELS) {
      try {
        const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 600,
            },
          }),
        });

        if (response.status === 404) {
          continue;
        }

        const data = await response.json();

        if (!response.ok) {
          lastError = data.error?.message ?? `Model ${model} returned ${response.status}`;
          continue;
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          return NextResponse.json({ reply });
        }
      } catch (err: any) {
        lastError = err.message ?? 'Network error';
      }
    }

    return NextResponse.json({ error: lastError }, { status: 502 });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
