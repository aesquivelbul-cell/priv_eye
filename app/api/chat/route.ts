import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Ultra-fast Gemini models verified operational and active with current API quota
const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
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
- Academic Field: ${profile?.field_of_study || 'N/A'} (Year ${profile?.year_level || 'N/A'})

RECENT HEALTH METRICS (last ${logs.length} logged sessions):
- Avg screen time: ${average('screen_time')} h/day
- Avg sleep: ${average('sleep_hours')} h/night
- Headaches reported: ${countPresent('sym_headaches')}/${logs.length} days
- Blurry vision reported: ${countPresent('sym_blurred_vision')}/${logs.length} days
- Dry eyes reported: ${countPresent('sym_dry_eyes')}/${logs.length} days
- Latest ML risk assessment: ${latestPrediction ? `${latestPrediction.risk_percentage ?? 'n/a'}% (${latestPrediction.risk_level ?? 'N/A'})` : 'None yet'}
`;
      } catch (err) {
        console.warn('Could not load user details for chat context:', err);
      }
    }

    // ── System instruction with Thesis-Grade Clinical Safety & AOA Guidelines ───
    const systemInstruction = `You are EyeGuard AI, a friendly and knowledgeable eye health companion for college students.

${userContext ? `Student Health Record (Reference ONLY when the student explicitly asks about their stats or health history):\n${userContext}` : 'The student is chatting in guest mode.'}

CRITICAL CONVERSATIONAL RULES (Always obey):
1. CASUAL GREETINGS & PLEASANTRIES:
   - If the student says "hi", "hello", "how are you?", "hey", "good morning", "what's up", "thanks", etc.:
     Reply warmly, naturally, and briefly in ONLY 1 or 2 short sentences.
     NEVER dump their health metrics, college major, year level, screen hours, or ergonomic guides during a greeting!
     Example for "how are you?": "I'm doing great, thanks for asking! How are your eyes feeling today, or is there anything about your screen habits you'd like to check?"
2. ON-TOPIC & RELEVANCE:
   - Answer ONLY what the user asks. Keep responses concise, helpful, and natural (1 to 2 brief paragraphs max).
   - ONLY cite their logged metrics (screen time, sleep hours, headaches, risk level) when the student EXPLICITLY asks questions like: "how are my habits?", "why is my risk level high?", "review my stats", "am I looking at screens too much?".
   - NEVER repeat long self-introductions in every reply.
3. CLINICAL RED FLAGS:
   - If the student describes acute red flags (sudden vision loss, severe acute pain with nausea/halos, flashes with floaters/curtain, chemical splashes, or trauma):
     Start with: "⚠️ [EMERGENCY CLINICAL NOTICE]: Please seek immediate emergency medical evaluation by an eye care professional or emergency room. EyeGuard is for digital eye strain prevention only."
4. ROUTINE ADVICE:
   - Ground general answers in standard AOA guidelines (20-20-20 rule, 20-28 inch viewing distance, proper lighting, blinking breaks).
   - Keep answers conversational, supportive, and clear.`;

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
              temperature: 0.6,
              maxOutputTokens: 500,
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
          const isEmergency = reply.includes('[EMERGENCY CLINICAL NOTICE]');
          return NextResponse.json({ reply, isEmergency });
        }
      } catch (err: any) {
        lastError = err.message ?? 'Network error';
      }
    }

    // Return a graceful clinical fallback instead of hard-failing to the user
    return NextResponse.json({
      reply: 'EyeGuard AI is currently receiving high demand or calibrating real-time clinical responses. Based on clinical guidelines, remember the 20-20-20 rule (every 20 minutes look 20 feet away for 20 seconds) and check your personalized risk breakdown on your Dashboard.',
      isEmergency: false
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      reply: 'EyeGuard AI is currently recalibrating. For immediate comfort, take a 5-minute screen break, blink intentionally, and review your recommendations on the Dashboard.',
      isEmergency: false
    });
  }
}
