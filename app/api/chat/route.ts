import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Ultra-fast Gemini models verified operational in this environment
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

    // ── Build context from Supabase (lean & fast queries) ─────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let userContext = '';

    if (user) {
      try {
        const [profileResult, logsResult, predictionsResult] = await Promise.all([
          supabase.from('user_profiles')
            .select('first_name, last_name, year_level, field_of_study')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase.from('daily_logs')
            .select('date, screen_time, sleep_hours, brightness, breaks_taken, sym_headaches, sym_blurred_vision, sym_dry_eyes, risk_level')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(14),
          supabase.from('predictions')
            .select('risk_level, risk_percentage, fatigue_score')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        const profile = profileResult.data;
        const logs = logsResult.data ?? [];
        const latestPrediction = predictionsResult.data?.[0] ?? null;

        const number = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0);
        const average = (field: string) => logs.length
          ? (logs.reduce((sum: number, log: any) => sum + number(log[field]), 0) / logs.length).toFixed(1)
          : '0.0';
        const countPresent = (field: string) => logs.filter((log: any) => log[field] && log[field] !== 'Never').length;

        userContext = `
USER PROFILE:
- Name: ${profile?.first_name || ''} ${profile?.last_name || ''}
- Field: ${profile?.field_of_study || 'N/A'} (Year ${profile?.year_level || 'N/A'})

RECENT HEALTH METRICS (last ${logs.length} logs):
- Avg screen time: ${average('screen_time')} h/day
- Avg sleep: ${average('sleep_hours')} h/night
- Headaches reported: ${countPresent('sym_headaches')}/${logs.length} days
- Blurry vision reported: ${countPresent('sym_blurred_vision')}/${logs.length} days
- Dry eyes reported: ${countPresent('sym_dry_eyes')}/${logs.length} days
- Latest risk assessment: ${latestPrediction ? `${latestPrediction.risk_percentage ?? 'n/a'}% (${latestPrediction.risk_level ?? 'N/A'})` : 'None yet'}
`;
      } catch (err) {
        console.warn('Could not load user details for chat context:', err);
      }
    }

    // ── System instruction ─────────────────────────────────────────────
    const systemInstruction = `You are EyeGuard AI, a helpful, friendly, and knowledgeable eye health coach for college students.

${userContext ? `Student Health Context:
${userContext}` : 'The student is chatting in guest mode.'}

Guidelines:
- Keep responses concise (1 to 2 short paragraphs max).
- Ground advice in standard ergonomic practices: the 20-20-20 rule, viewing distance of 20-28 inches, proper room lighting, conscious blinking.
- If asked about their risk or history, reference their health context numbers above.
- Always be supportive, practical, and remind students that advice is educational, not medical diagnosis.`;

    // ── Build Gemini conversation turns ───────────────────────────────
    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(1).slice(-6)) {
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
              maxOutputTokens: 400,
            },
          }),
          signal: AbortSignal.timeout(5000), // Fail fast if a model stalls
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
