import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { SETTINGS_ROW_ID } from "@/lib/settings";

type SettingsRow = { gemini_api_key: string };

/** Gemini models used for PRD generation, tried in order.
 *  Google occasionally returns 503 "high demand" for a given model, so we
 *  fall back to the next one. Override the whole list via GEMINI_MODEL env
 *  (comma-separated, e.g. "gemini-3.6-flash,gemini-flash-latest"). */
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.6-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const GEMINI_ENDPOINT = (apiKey: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

export interface PrdFormData {
  projectName: string;
  projectType: string;
  description: string;
  audience: string;
  goals: string;
  pages: string;
  features: string;
  designStyle: string;
  uiSkills: string;
  colorPalette: string;
  backend: string;
  frontend: string;
  database: string;
  auth: string;
  language: string;
  logoUrl: string;
  faviconUrl: string;
  contact: string;
  extra: string;
}

const SYSTEM_PROMPT = `You are an expert Product Requirements Document (PRD) writer for AI web-development agents.
Your job: turn the user's project brief into a single, highly detailed, copy-paste-ready PRD prompt written in Markdown.

The PRD must be written so another AI coding agent can build the website WITHOUT further clarification. Be concrete and prescriptive:
- Start with a short "Project Overview" paragraph.
- Include a "Requirements" section covering every page/section with explicit content and layout instructions.
- Include a "Design & Theme" section: color palette (exact hex values when provided), typography direction, spacing/rounded-corner style, dark/light mode.
- Include a "Tech Stack" section naming the frontend framework, UI approach, backend/database/auth providers the user selected.
- Include a "Data Model" section (only if a database is involved) with the exact tables/fields and relationships needed.
- Include "Functional Spec" bullets: every behavior, interaction, and state (loading, empty, error).
- Include "Pages / Routes" list.
- Include "Acceptance Criteria" checklist.
- End with "Out of scope" and "Notes for the developer".

Rules:
- Use the exact project name, URLs (logo, favicon), contact details, language, and theme the user provided — never invent brand assets.
- If the user's choices are empty, mark them as "TBD" instead of guessing.
- Keep the document structured with clear Markdown headings, bullet lists, and tables where useful.
- Write the whole document in English, unless the user requested another language for the document itself.
- The output must be ONLY the Markdown document — no preamble, no code fences around it.`;

const FIELD_LABELS: Record<keyof PrdFormData, string> = {
  projectName: "Project name",
  projectType: "Project type",
  description: "General description",
  audience: "Target audience",
  goals: "Goals & objectives",
  pages: "Pages / sections wanted",
  features: "Key features",
  designStyle: "Design style",
  uiSkills: "UI skill / style references",
  colorPalette: "Color palette / theme",
  backend: "Backend",
  frontend: "Frontend",
  database: "Database",
  auth: "Authentication",
  language: "Content language",
  logoUrl: "Logo URL",
  faviconUrl: "Favicon URL",
  contact: "Contact details",
  extra: "Additional requirements",
};

function buildBrief(form: PrdFormData): string {
  const lines: string[] = [];
  lines.push("## PROJECT BRIEF");
  lines.push("");
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const value = (form[key as keyof PrdFormData] || "").trim();
    lines.push(`### ${label}`);
    lines.push(value ? value : "TBD");
    lines.push("");
  }
  return lines.join("\n");
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as Partial<PrdFormData>;
    if (!body.projectName || !body.projectName.trim()) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }
    if (!body.description || !body.description.trim()) {
      return NextResponse.json({ error: "Please describe the project in the general details field." }, { status: 400 });
    }

    // API key: settings row first, then env fallback.
    await setupDatabase();
    const rows = await query<SettingsRow>`SELECT gemini_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    const apiKey = rows[0]?.gemini_api_key || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured. Add it in Settings → AI · PRD generator." }, { status: 400 });
    }

    const form: PrdFormData = {
      projectName: (body.projectName || "").trim(),
      projectType: (body.projectType || "").trim(),
      description: (body.description || "").trim(),
      audience: (body.audience || "").trim(),
      goals: (body.goals || "").trim(),
      pages: (body.pages || "").trim(),
      features: (body.features || "").trim(),
      designStyle: (body.designStyle || "").trim(),
      uiSkills: (body.uiSkills || "").trim(),
      colorPalette: (body.colorPalette || "").trim(),
      backend: (body.backend || "").trim(),
      frontend: (body.frontend || "").trim(),
      database: (body.database || "").trim(),
      auth: (body.auth || "").trim(),
      language: (body.language || "").trim(),
      logoUrl: (body.logoUrl || "").trim(),
      faviconUrl: (body.faviconUrl || "").trim(),
      contact: (body.contact || "").trim(),
      extra: (body.extra || "").trim(),
    };

    const userPrompt = [
      `Write a complete PRD for the project "${form.projectName}".`,
      "",
      buildBrief(form),
    ].join("\n");

    let data: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    } = {};
    let lastError = "";
    for (const model of GEMINI_MODELS) {
      const res = await fetch(GEMINI_ENDPOINT(apiKey, model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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
        return NextResponse.json({ error: "Gemini rejected the request. Check that the API key is valid and the model is enabled." }, { status: 502 });
      }
    }

    if (!lastError && !data.candidates?.length) {
      lastError = "empty response";
    }
    if (lastError) {
      return NextResponse.json({ error: "The AI service returned an error. Please try again." }, { status: 502 });
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    if (!text.trim()) {
      return NextResponse.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ markdown: text.trim() });
  } catch (error) {
    console.error("PRD generation failed:", error);
    return NextResponse.json({ error: "Something went wrong while generating the PRD." }, { status: 500 });
  }
}
