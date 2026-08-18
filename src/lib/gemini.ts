import { query } from "./db";
import { SETTINGS_ROW_ID } from "./settings";

type SettingsRow = { gemini_api_key: string };

/** Gemini models used for AI generation, tried in order.
 *  Google occasionally returns 503 "high demand" for a given model, so we
 *  fall back to the next one. Override the whole list via GEMINI_MODEL env
 *  (comma-separated, e.g. "gemini-3.6-flash,gemini-flash-latest"). */
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.6-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const GEMINI_ENDPOINT = (apiKey: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

/** Returns the configured Gemini API key (settings row first, then env fallback). */
export async function getGeminiApiKey(): Promise<string> {
  const rows = await query<SettingsRow>`SELECT gemini_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
  return rows[0]?.gemini_api_key || process.env.GEMINI_API_KEY || "";
}

export interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  /** 0..2 — higher = more creative. Defaults to 0.7. */
  temperature?: number;
  /** Max output tokens. Defaults to 8192. */
  maxOutputTokens?: number;
}

/**
 * Calls Gemini with the given system + user prompt, trying each configured
 * model in order. Throws an Error with a user-friendly message on failure.
 */
export async function callGemini(options: GeminiCallOptions): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Add it in Settings → AI · PRD generator.");
  }

  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } = {};
  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const res = await fetch(GEMINI_ENDPOINT(apiKey, model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 8192,
        },
      }),
    });

    if (res.ok) {
      data = (await res.json()) as typeof data;
      lastError = "";
      break;
    }

    const detail = await res.text().catch(() => "");
    lastError = detail.slice(0, 500);
    console.error(`Gemini API error (${model}):`, res.status, lastError);
    // Non-transient errors (bad key, model disabled) won't be fixed by
    // retrying another model — fail fast.
    if (res.status === 400 || res.status === 403) {
      throw new Error("Gemini rejected the request. Check that the API key is valid and the model is enabled.");
    }
  }

  if (!lastError && !data.candidates?.length) {
    lastError = "empty response";
  }
  if (lastError) {
    throw new Error("The AI service returned an error. Please try again.");
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) {
    throw new Error("The AI returned an empty response. Please try again.");
  }
  return text.trim();
}
