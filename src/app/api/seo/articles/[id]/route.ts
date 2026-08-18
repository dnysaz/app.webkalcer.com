import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      length?: string;
      links?: string;
      seo?: unknown;
      swot?: unknown;
      verified?: boolean;
    };
    const now = new Date().toISOString();
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : undefined;
    const content = typeof body.content === "string" ? body.content : undefined;
    const length = body.length === "short" || body.length === "long" || body.length === "medium" ? body.length : undefined;
    const links = typeof body.links === "string" ? body.links.slice(0, 5000) : undefined;
    const seo = body.seo !== undefined ? JSON.stringify(body.seo) : undefined;
    const swot = body.swot !== undefined ? JSON.stringify(body.swot) : undefined;
    const verified = typeof body.verified === "boolean" ? body.verified : undefined;
    if (title === undefined && content === undefined && length === undefined && links === undefined && seo === undefined && swot === undefined && verified === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    await sql`
      UPDATE seo_articles SET
        title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        length = COALESCE(${length ?? null}, length),
        links = COALESCE(${links ?? null}, links),
        seo = COALESCE(${seo ?? null}::jsonb, seo),
        swot = COALESCE(${swot ?? null}::jsonb, swot),
        verified = COALESCE(${verified ?? null}, verified),
        updated_at = ${now}
      WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update article failed:", error);
    return NextResponse.json({ error: "Something went wrong while updating the article." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    await sql`DELETE FROM seo_articles WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete article failed:", error);
    return NextResponse.json({ error: "Something went wrong while deleting the article." }, { status: 500 });
  }
}
