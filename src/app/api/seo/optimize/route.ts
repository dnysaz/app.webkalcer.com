import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

export interface SeoGenResult {
  title: string;
  description: string;
  hashtags: string[];
  preview: { url: string; title: string; description: string };
  score: number;
  notes: string;
}

const SYSTEM_PROMPT = `You are a senior SEO specialist. Given an article and its target keyword, you produce a complete SEO package that helps the article RANK and CONVERT.

Return a STRICT JSON object (no markdown fences, no commentary) with EXACTLY this shape:
{
  "title": "SEO title, max 60 characters, includes the target keyword",
  "description": "Meta description, 120-155 characters, includes the target keyword and a small hook",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "preview": {
    "url": "www.domain.com/article-slug",
    "title": "Google preview title (reuse or refine the title above)",
    "description": "Google preview snippet (reuse or refine the description)"
  },
  "score": 72,
  "notes": "Short AI reasoning: what the AI checked and why this score."
}

Rules:
- The TARGET KEYWORD must appear in the title, description, and preview. If no keyword was provided, derive the best primary keyword from the article.
- The score (0-100) is based on: keyword presence in title/headings/first paragraph, keyword density (aim ~1.5-2%, penalize stuffing), meta description quality, LSI/semantic coverage, structure, readability, hashtag relevance, content depth, and presence of a conversion-oriented element (CTA). Be honest and critical.
- All text should be in the same language as the article.
- The notes field must read like an AI re-check: what the AI reviewed, whether the article uses the keyword well, and how it could improve.`;

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
      `Generate the full SEO package for this article.`,
      "",
      keyword ? `## TARGET KEYWORD\n${keyword}` : "## TARGET KEYWORD\n(derive the best primary keyword from the article)",
      "",
      `## ARTICLE TITLE\n${title || "(no title provided)"}`,
      "",
      `## ARTICLE CONTENT\n${content.slice(0, 20000)}`,
    ].join("\n");

    const raw = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    let parsed: Partial<SeoGenResult>;
    try {
      parsed = JSON.parse(raw) as Partial<SeoGenResult>;
    } catch {
      // Fall back to the raw text so the user can still see the output.
      return NextResponse.json({ error: "The AI returned an invalid response format. Please try again." }, { status: 502 });
    }

    const result: SeoGenResult = {
      title: String(parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 10) : [],
      preview: {
        url: String(parsed.preview?.url ?? ""),
        title: String(parsed.preview?.title ?? ""),
        description: String(parsed.preview?.description ?? ""),
      },
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
      notes: String(parsed.notes ?? ""),
    };
    if (!result.title && !result.description && !result.notes) {
      return NextResponse.json({ error: "The AI returned an empty result. Please try again." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("SEO generation failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while generating the SEO.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
