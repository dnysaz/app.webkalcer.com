import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callGemini } from "@/lib/gemini";

export type ArticleLength = "short" | "medium" | "long";

/** Writing style for the generated article. */
export type ArticleStyle = "casual" | "professional" | "news" | "humor" | "research";

export interface ArticleFormData {
  topic: string;
  description: string;
  length: ArticleLength;
  style: ArticleStyle;
  /** Links pasted by the admin, embedded into the article. */
  links: string;
  /** Output language, e.g. "Indonesian" / "English". */
  language: string;
}

const STYLE_SPECS: Record<ArticleStyle, { label: string; instruction: string }> = {
  casual: {
    label: "Santai",
    instruction: "Write in a relaxed, friendly, conversational tone — like talking to a friend. Use everyday words and a light touch.",
  },
  professional: {
    label: "Profesional",
    instruction: "Write in a formal, professional, authoritative tone. Clear, concise, business-appropriate language.",
  },
  news: {
    label: "Berita",
    instruction: "Write in a journalistic news tone: objective, factual, engaging, with a strong lead paragraph and quotes where suitable.",
  },
  humor: {
    label: "Humor",
    instruction: "Write with a light, witty, humorous tone. Keep it fun and engaging, but still informative and on-topic.",
  },
  research: {
    label: "Penelitian",
    instruction: "Write in an academic/research tone: structured, evidence-based, with data, reasoning, and a clear methodology feel.",
  },
};

const LENGTH_SPECS: Record<ArticleLength, { label: string; words: string; instructions: string }> = {
  short: {
    label: "Short",
    words: "300–500 words",
    instructions: "Keep it concise: an intro, 2–3 short sections, and a conclusion.",
  },
  medium: {
    label: "Medium",
    words: "800–1200 words",
    instructions: "Structure it with an intro, 4–6 sections with subheadings, and a conclusion.",
  },
  long: {
    label: "Long",
    words: "1800–2500 words",
    instructions: "Write an in-depth piece with 8–12 sections, subheadings, examples, and a conclusion.",
  },
};

const SYSTEM_PROMPT = `You are an expert SEO content writer for webkalcer.com, an Indonesian web development company.
You write high-quality, original, publishable articles in Markdown.

Rules:
- Write in the language requested by the user (default Indonesian).
- Follow the requested article length strictly.
- Write in a natural, engaging, professional tone. Avoid filler, fluff, and AI-sounding clichés.
- Use Markdown formatting: a title (H1), H2 subheadings, short paragraphs, bullet/numbered lists where useful.
- If the user provided links, embed them naturally as markdown links inside the relevant sections. Never invent URLs that were not provided.
- The output must be ONLY the article in Markdown — no preamble, no code fences, no meta commentary.`;

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
    const links = (body.links || "").trim();
    const language = (body.language || "Indonesian").trim() || "Indonesian";

    const spec = LENGTH_SPECS[length];
    const styleSpec = STYLE_SPECS[style];
    const userPrompt = [
      `Write a ${spec.label.toLowerCase()} article (${spec.words}) about: ${topic}`,
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

    const markdown = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    return NextResponse.json({ markdown, topic, length, style, links, language });
  } catch (error) {
    console.error("Article generation failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while generating the article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
