import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

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

    let text: string;
    try {
      text = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.7, maxOutputTokens: 8192 });
    } catch (aiErr) {
      return NextResponse.json({ error: aiErr instanceof Error ? aiErr.message : "The AI service returned an error. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ markdown: text });
  } catch (error) {
    console.error("PRD generation failed:", error);
    return NextResponse.json({ error: "Something went wrong while generating the PRD." }, { status: 500 });
  }
}
