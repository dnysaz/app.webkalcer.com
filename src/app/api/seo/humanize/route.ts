import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

export interface HumanizeResult {
  aiPercent: number;
  humanPercent: number;
  verdict: string;
  notes: string;
}

const SYSTEM_PROMPT = `You are an expert at evaluating how human-written a text sounds, like a professional AI-content detector.

Given an article, estimate the percentage of AI-generated vs human-written text and explain why.

Return a STRICT JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "aiPercent": 8,
  "humanPercent": 92,
  "verdict": "Very likely human-written",
  "notes": "2-4 sentences explaining the judgment in the article's language."
}

Scoring criteria — judge each and weigh them together:
- Sentence length variation: humans mix short punchy sentences with long ones; AI tends toward uniform medium length.
- Very short sentences: presence of fragments/emphatic short lines (human-like).
- Word choice: mean word length and everyday vocabulary vs formal, generic AI diction.
- Function words & discourse markers: natural connectors ("Nah,", "Terus", "coba deh") vs formal transitions ("Selain itu", "Dengan demikian").
- Repetition: natural self-repetition and cohesive local topic flow vs AI's sterile avoidance of repetition.
- Pronoun subjects & personal voice: "kamu", "gue", "saya" giving a conversational tone.
- Question marks: natural rhetorical/dialogue questions.
- Clichés & AI patterns: opening hooks ("Dalam era digital"), filler transitions, symmetric three-item lists, marketing fluff — these raise aiPercent.
- Conclusion: natural wrap-up that gives practical guidance vs formulaic "kesimpulannya".

Rules:
- aiPercent and humanPercent must be integers, aiPercent + humanPercent = 100.
- Be honest and critical; do not default to low AI percentages.
- Write the notes in the same language as the article.`;

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as { title?: string; content?: string };
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "Article content is required." }, { status: 400 });
    }

    const userPrompt = [
      `Assess how human-written this article is.`,
      "",
      `## ARTICLE TITLE\n${title || "(no title provided)"}`,
      "",
      `## ARTICLE CONTENT\n${content.slice(0, 20000)}`,
    ].join("\n");

    const raw = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.5 });

    let parsed: Partial<HumanizeResult>;
    try {
      parsed = JSON.parse(raw) as Partial<HumanizeResult>;
    } catch {
      return NextResponse.json({ error: "The AI returned an invalid response format. Please try again." }, { status: 502 });
    }

    const aiPercent = typeof parsed.aiPercent === "number" ? Math.max(0, Math.min(100, Math.round(parsed.aiPercent))) : 0;
    const result: HumanizeResult = {
      aiPercent,
      humanPercent: typeof parsed.humanPercent === "number" ? Math.max(0, Math.min(100, Math.round(parsed.humanPercent))) : 100 - aiPercent,
      verdict: String(parsed.verdict ?? ""),
      notes: String(parsed.notes ?? ""),
    };
    if (!result.verdict && !result.notes) {
      return NextResponse.json({ error: "The AI returned an empty result. Please try again." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Humanize assessment failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while assessing the article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
