import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

export interface SwotResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  seoScore: number;
  summary: string;
}

const SYSTEM_PROMPT = `You are an expert content strategist. Given an article, you produce a SWOT analysis plus an SEO score.

Return a STRICT JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "opportunities": ["...", "..."],
  "threats": ["...", "..."],
  "seoScore": 75,
  "summary": "2-3 sentence strategic summary in the article's language."
}

Rules:
- Strengths/weaknesses analyze the article itself (structure, depth, keyword usage, readability, originality).
- Opportunities/threats analyze the external context: ranking potential, competition, search demand, risks.
- Each list should have 3-5 concise items.
- The seoScore is an estimated SEO score from 0 to 100.
- All text must be in the same language as the article.`;

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as { title?: string; content?: string; keyword?: string };
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const keyword = (body.keyword || "").trim();
    if (!content) {
      return NextResponse.json({ error: "Article content is required." }, { status: 400 });
    }

    const userPrompt = [
      `Run a SWOT analysis and SEO scoring on this article.`,
      "",
      keyword ? `## TARGET KEYWORD\n${keyword}` : "## TARGET KEYWORD\n(derived from the article)",
      "",
      `## ARTICLE TITLE\n${title || "(no title provided)"}`,
      "",
      `## ARTICLE CONTENT\n${content.slice(0, 20000)}`,
    ].join("\n");

    const raw = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    let parsed: Partial<SwotResult>;
    try {
      parsed = JSON.parse(raw) as Partial<SwotResult>;
    } catch {
      return NextResponse.json({ error: "The AI returned an invalid response format. Please try again." }, { status: 502 });
    }

    const list = (x: unknown): string[] => (Array.isArray(x) ? x.map(String).slice(0, 8) : []);
    const result: SwotResult = {
      strengths: list(parsed.strengths),
      weaknesses: list(parsed.weaknesses),
      opportunities: list(parsed.opportunities),
      threats: list(parsed.threats),
      seoScore: typeof parsed.seoScore === "number" ? Math.max(0, Math.min(100, Math.round(parsed.seoScore))) : 0,
      summary: String(parsed.summary ?? ""),
    };
    if (!result.strengths.length && !result.summary) {
      return NextResponse.json({ error: "The AI returned an empty result. Please try again." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("SWOT generation failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while generating the SWOT analysis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
