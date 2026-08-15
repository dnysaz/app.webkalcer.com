import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToNote } from "@/lib/db";
import type { NoteRow } from "@/lib/db";
import type { Note } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<NoteRow>`SELECT * FROM notes ORDER BY updated_at DESC`;
  return NextResponse.json(rows.map(rowToNote));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Note;
  await sql`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (${body.id}, ${body.title}, ${body.content}, ${body.createdAt}, ${body.updatedAt})`;
  return NextResponse.json(body);
}
