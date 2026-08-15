import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query } from "@/lib/db";

type ShareRow = { doc_type: string };

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = await query<ShareRow>`SELECT doc_type FROM shares WHERE token = ${token}`;
  const share = rows[0];
  if (!share) return NextResponse.json({ error: "Share link not found" }, { status: 404 });
  return NextResponse.json({ ok: true, docType: share.doc_type });
}
