import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    await sql`DELETE FROM contacts WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete contact failed:", error);
    return NextResponse.json({ error: "Something went wrong while deleting the contact." }, { status: 500 });
  }
}
