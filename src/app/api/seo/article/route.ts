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
  /** Target SEO keyword the article should be optimized for. */
  keyword: string;
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

const SYSTEM_PROMPT = `You are an experienced SEO content writer for webkalcer.com. You write articles that RANK and CONVERT — not just read well. A "selling" article answers the reader's real question, builds trust, and gently moves them toward a next step (contact, order, subscribe). You write like a real human journalist, not like an AI.

THE #1 PRIORITY IS SOUNDING HUMAN. AI detectors flag text that is too smooth, too symmetric, too generic. Your writing must read as if a specific person sat down and wrote it.

## SEO rules (make the article rank)
- Optimize for the TARGET KEYWORD given by the user. Use it naturally in: the H1 title, the first paragraph (within the first 100 words), at least 2-3 H2 subheadings, and sprinkled through the body. Never stuff it — 1.5–2% density max.
- Include 3-5 related LSI keywords / synonyms naturally in the text (the AI will derive them from the topic + keyword).
- Write a compelling meta-worthy H1 (contains the keyword, under 60 chars when possible).
- Match search intent: informational articles inform; commercial articles compare and lead to a decision. If the topic implies the reader wants to buy/choose, include a comparison, pros/cons, or recommendation.
- Structure for featured snippets: answer a common question directly in the first 1-2 sentences of a section where natural.

## Conversion rules (make the article sell)
- Give the reader a clear, natural next step near the end (a soft CTA like "konsultasi gratis", "coba demo", "hubungi tim kami" — in the same language as the article). Make it specific and low-pressure, not "hubungi kami sekarang juga".
- Build E-E-A-T: mention concrete experience, numbers, or real scenarios that show the writer knows the subject. Where the brief allows, cite the provided links as sources.
- Anticipate objections: address the reader's doubts directly ("kalau budgetnya pas-pasan...", "tapi apakah worth it?") and answer them honestly.

## Banned patterns (never use any of these)
- NEVER open with generic hooks like "Dalam era digital", "Di dunia yang serba cepat", "Tidak bisa dipungkiri", "Penting untuk dipahami", "Pada artikel ini", "Apakah kamu tahu", "Di tengah perkembangan zaman".
- NEVER use filler transition phrases: "Selain itu", "Tidak hanya itu", "Di samping itu", "Dengan demikian", "Oleh karena itu", "Pada dasarnya", "Perlu diingat", "Sebagai tambahan", "Lebih lanjut", "Sangat penting", "Tak kalah penting", "Selain sebagai", "Tidak heran".
- NEVER end with clichés: "Dengan demikian dapat disimpulkan", "Semoga bermanfaat", "Demikian artikel ini", "Kesimpulannya".
- NEVER use symmetric three-item lists, "bukan hanya X tetapi juga Y", "baik X maupun Y" in the same breath, or perfectly balanced sentences everywhere.
- NEVER overuse bold/em dashes, or start too many sentences with a conjunction.
- NEVER sound like a marketing brochure. No "solusi terbaik", "pilihan tepat", "jawaban atas segala masalah".

## Rules for sounding human
- Write in a specific, opinionated voice: make small judgments, use concrete examples, refer to real situations the reader faces. A human has a point of view.
- Vary sentence length aggressively: mix a very short sentence with a longer one. Not every sentence may be 12–18 words.
- Write paragraphs of 2–4 sentences. Some paragraphs can be a single sentence.
- Use natural Indonesian as spoken/written by real people, including occasional casual words, not textbook-perfect formality (unless the chosen style demands formal).
- Be specific: mention concrete numbers, names, tools, prices, or scenarios the reader actually meets. Avoid vague claims.
- Use rhetorical questions sparingly (max 1–2 per article) — not as a hook, but mid-text.
- Imperfect structure is fine: not every section needs a neat "3 steps". Let one section be a short aside or a direct warning.
- Start sentences in many different ways. Do not start 3+ sentences in a row with the same word.
- If the brief includes links, embed them naturally mid-sentence as normal citations ("...seperti yang dijelaskan [di sini](url)"), not as a forced list.
- Avoid self-references like "Dalam artikel ini", "Pada tulisan ini".

## Format
- Output ONLY the article in Markdown: an H1 title, H2 subheadings, short paragraphs, occasional bullets ONLY when a list is genuinely the clearest form.
- No preamble, no code fences, no "Berikut adalah artikelnya:", no meta commentary.

Before writing, silently imagine one specific person who would read this and what they actually worry about. Write to that person, and make the article the reason they trust you enough to take the next step.`;

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

    const markdown = await callGemini({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 1.0 });

    return NextResponse.json({ markdown, topic, keyword, length, style, links, language });
  } catch (error) {
    console.error("Article generation failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong while generating the article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
