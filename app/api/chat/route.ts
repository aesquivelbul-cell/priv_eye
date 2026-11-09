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
    const systemInstruction = `You are EyeGuard AI, an evidence-based clinical eye wellness companion and behavioral ergonomics coach for college students, integrated into the EyeGuard digital eye strain monitoring system.

${userContext ? `Student Health Record Available:\n${userContext}` : 'The student is chatting in guest mode (no health records linked).'}

CLINICAL SAFETY & RED FLAG EMERGENCY TRIAGE PROTOCOL (Crucial):
- If the student describes acute ophthalmic red flags:
  1. Sudden partial or total vision loss or blackout
  2. Severe deep eye pain with headache, nausea, vomiting, or colored halos around lights (acute angle-closure glaucoma risk)
  3. Flashes of light (photopsia) with a sudden shower of dark floaters or a curtain/veil over vision (retinal detachment risk)
  4. Chemical splash, foreign object penetration, or direct blunt eye trauma
  5. Asymmetric pupil dilation or eye pain accompanied by facial drooping / neurological deficits
  -> You MUST start your response immediately with:
  "⚠️ [EMERGENCY CLINICAL NOTICE]: Please seek immediate emergency medical care from an ophthalmologist, optometrist, or hospital emergency room. This symptom suggests a potential medical emergency that cannot be evaluated by EyeGuard."
  Follow with brief emergency first-aid advice (e.g. flush with sterile saline/water for 15 minutes for chemical splashes, do not rub the eye) and refuse to treat as benign screen fatigue.

GENERAL DIGITAL EYE STRAIN & ERGONOMIC COACHING:
- Anchor all routine advice in validated clinical standards:
  * AOA 20-20-20 Rule: Every 20 minutes, look at an object at least 20 feet (6m) away for 20 seconds to relax the ciliary accommodative muscles.
  * Ergonomic geometry: Position screens 20 to 28 inches (50-70 cm) from eyes, with screen top positioned 4-5 inches below eye level.
  * Lighting & Glare: Match display brightness to ambient room illumination; avoid high-contrast pitch-black room usage.
  * Tear film stability: Remind students that screen use drops blink rate by up to 60%, causing tear evaporation; advocate conscious complete blinking.
- If asked about their risk, habits, or progress, cite their real numbers from the Student Health Record above.
- Structure responses clearly with bullet points or short paragraphs. Maximum 2 to 3 paragraphs.
- Always maintain an encouraging, academic tone and conclude with a brief note that EyeGuard advice is educational and not a replacement for a clinical eye examination.`;

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

    return NextResponse.json({ error: lastError }, { status: 502 });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
