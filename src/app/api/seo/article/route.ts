import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

import {
  ARTICLE_SYSTEM_PROMPT,
  LENGTH_SPECS,
  STYLE_SPECS,
  type ArticleLength,
  type ArticleStyle,
} from "@/lib/prompts";

export type { ArticleLength, ArticleStyle } from "@/lib/prompts";

export interface ArticleFormData {
  topic: string;
  description: string;
  length: ArticleLength;
  style: ArticleStyle;
  /** Target SEO keyword the article should be optimized for. */
  keyword: string;
  /** Links pasted by the admin, embedded into the article. */
  links: string;
  /** Output language, e.g. "Indonesian" / "English". */
  language: string;
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as Partial<ArticleFormData>;
    const topic = (body.topic || "").trim();
    const description = (body.description || "").trim();
    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Please describe the article in the description field." }, { status: 400 });
    }
    const length: ArticleLength = body.length === "short" || body.length === "long" ? body.length : "medium";
    const style: ArticleStyle =
      body.style === "casual" || body.style === "professional" || body.style === "news" || body.style === "humor" || body.style === "research" ? body.style : "professional";
    const keyword = (body.keyword || "").trim().slice(0, 120);
    const links = (body.links || "").trim();
    const language = (body.language || "Indonesian").trim() || "Indonesian";

    const spec = LENGTH_SPECS[length];
    const styleSpec = STYLE_SPECS[style];
    const userPrompt = [
      `Write a ${spec.label.toLowerCase()} article (${spec.words}) about: ${topic}`,
      "",
      keyword ? `## TARGET KEYWORD\n${keyword}\nOptimize the whole article for this keyword (H1, first paragraph, H2s, body) without keyword stuffing.` : "## TARGET KEYWORD\n(none — derive the best primary keyword from the topic)",
      "",
      "## BRIEF",
      description,
      "",
      links ? `## LINKS TO EMBED\n${links}` : "## LINKS TO EMBED\n(none)",
      "",
      `## LANGUAGE\n${language}`,
      "",
      `## WRITING STYLE\n${styleSpec.label}: ${styleSpec.instruction}`,
      "",
      spec.instructions,
    ].join("\n");

    const markdown = await callGemini({ systemPrompt: ARTICLE_SYSTEM_PROMPT, userPrompt, temperature: 1.1 });

    return NextResponse.json({ markdown, topic, keyword, length, style, links, language });
  } catch (error) {
    console.error("Article generation failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while generating the article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
