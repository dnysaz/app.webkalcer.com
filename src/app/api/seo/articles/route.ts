import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToSeoArticle } from "@/lib/db";
import type { SeoArticleRow } from "@/lib/db";
import type { SeoArticle } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setupDatabase();
  const rows = await query<SeoArticleRow>`SELECT * FROM seo_articles ORDER BY updated_at DESC`;
  return NextResponse.json(rows.map(rowToSeoArticle));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const sql = getSql();
    const body = (await request.json()) as Partial<SeoArticle>;
    const id = body.id || `art_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const title = (body.title || "").slice(0, 300);
    const content = body.content || "";
    const length = body.length === "short" || body.length === "long" ? body.length : "medium";
    const links = (body.links || "").slice(0, 5000);

    await sql`
      INSERT INTO seo_articles (id, title, content, length, links, seo, swot, verified, created_at, updated_at)
      VALUES (${id}, ${title}, ${content}, ${length}, ${links}, ${JSON.stringify(body.seo ?? null)}, ${JSON.stringify(body.swot ?? null)}, ${!!body.verified}, ${body.createdAt ?? now}, ${now})`;

    const article: SeoArticle = {
      id,
      title,
      content,
      length,
      links,
      seo: body.seo ?? null,
      swot: body.swot ?? null,
      verified: !!body.verified,
      createdAt: body.createdAt ?? now,
      updatedAt: now,
    };
    return NextResponse.json(article);
  } catch (error) {
    console.error("Save article failed:", error);
    return NextResponse.json({ error: "Something went wrong while saving the article." }, { status: 500 });
  }
}
