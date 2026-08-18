import { query } from "./db";
import { SETTINGS_ROW_ID } from "./settings";

type SettingsRow = { gemini_api_key: string };

/** Max number of Gemini API keys that can be configured. */
export const MAX_GEMINI_KEYS = 5;

/** Gemini models used for AI generation, tried in order.
 *  If one model returns an error or is unavailable, the next is tried.
 *  Override the whole list via GEMINI_MODEL env var (comma-separated). */
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const GEMINI_ENDPOINT = (apiKey: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

/** Splits a stored multi-key string (newline- or comma-separated) into keys. */
export function parseGeminiKeys(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_GEMINI_KEYS);
}

/**
 * Returns all configured Gemini API keys (settings row first, then env
 * fallback). The stored value may contain up to MAX_GEMINI_KEYS keys
 * separated by newlines or commas.
 */
export async function getGeminiApiKeys(): Promise<string[]> {
  const rows = await query<SettingsRow>`SELECT gemini_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
  const stored = rows[0]?.gemini_api_key || "";
  const env = process.env.GEMINI_API_KEY || "";
  return parseGeminiKeys([stored, env].filter(Boolean).join("\n"));
}

/** Returns the first configured Gemini API key (back-compat helper). */
export async function getGeminiApiKey(): Promise<string> {
  const keys = await getGeminiApiKeys();
  return keys[0] || "";
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
 * API key first, then each model in order. When one key hits an error
 * (rate limit, high demand, invalid) it automatically falls back to the
 * next key. Throws an Error with a user-friendly message only when every
 * key and model has failed.
 */
export async function callGemini(options: GeminiCallOptions): Promise<string> {
  const keys = await getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("Gemini API key is not configured. Add it in Settings → AI · API keys.");
  }

  let lastError = "";
  let lastStatus = 0;

  // Strategy: try each model first across all keys before moving to the next
  // model. This avoids burning all keys on an unavailable model.
  models: for (const model of GEMINI_MODELS) {
    for (const apiKey of keys) {
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
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (!text.trim()) {
          lastError = "empty response";
          continue;
        }
        return text.trim();
      }

      const detail = await res.text().catch(() => "");
      lastError = detail.slice(0, 300);
      lastStatus = res.status;
      const keyIdx = keys.indexOf(apiKey) + 1;
      console.error(`Gemini API error (model: ${model}, key: ${keyIdx}):`, res.status, lastError);

      // 403 = the Google Cloud project the key belongs to is denied
      // (PERMISSION_DENIED). This is project-level: every key in the same
      // project fails with the same status, so stop trying entirely.
      if (res.status === 403) break models;

      // 400 = key is invalid or model is disabled for this key — no point
      // trying other keys with the same model, skip to next model.
      if (res.status === 400) break;
    }
  }

  if (lastStatus === 403) {
    throw new Error("Google has denied access to your Gemini API project (HTTP 403). Every key in that project is blocked — generate a new API key in Google AI Studio, or contact Google support.");
  }

  if (lastError) {
    throw new Error(`The AI service returned an error on all API keys (HTTP ${lastStatus || "n/a"}). ${lastError}`);
  }
  throw new Error("The AI returned an empty response. Please try again.");
}
