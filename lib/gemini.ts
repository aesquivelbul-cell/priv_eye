/**
 * Shared Gemini API helper.
 * Tries models in order until one responds successfully.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Most-available first — ordered by availability and cost-efficiency.
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
];

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function callGemini({
  apiKey,
  systemInstruction,
  contents,
  temperature = 0.7,
  maxOutputTokens = 1024,
}: {
  apiKey: string;
  systemInstruction: string;
  contents: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<{ reply: string } | { error: string; status: number }> {
  let lastError = '';

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature, maxOutputTokens },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      });
    } catch (err) {
      lastError = `Network error: ${err}`;
      continue;
    }

    // 404 = model not available on this key — try next
    if (res.status === 404) {
      console.warn(`[Gemini] model ${model} not available, trying next…`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Gemini] ${model} error ${res.status}:`, body);

      if (res.status === 400) return { error: 'Invalid request to AI service.', status: 502 };
      if (res.status === 401 || res.status === 403)
        return { error: 'AI key authentication failed. Contact support.', status: 502 };
      if (res.status === 429)
        return { error: 'AI rate limit reached. Please wait a moment and try again.', status: 429 };
      // 503 = model overloaded — try the next model in the list
      if (res.status === 503) {
        console.warn(`[Gemini] model ${model} overloaded, trying next…`);
        lastError = `HTTP 503: model overloaded`;
        continue;
      }

      lastError = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      continue;
    }

    const data = await res.json();

    // Check for blocked content
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      return { error: `Message blocked by safety filter: ${blockReason}`, status: 400 };
    }

    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      // Might be a finish reason issue
      const finishReason = data?.candidates?.[0]?.finishReason;
      console.warn(`[Gemini] empty text, finishReason=${finishReason}`, JSON.stringify(data).slice(0, 300));
      return { error: 'AI returned an empty response. Please try again.', status: 502 };
    }

    return { reply: text };
  }

  return {
    error: `No AI model available. Last error: ${lastError}`,
    status: 502,
  };
}
