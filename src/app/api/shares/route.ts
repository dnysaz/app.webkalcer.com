import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Cryptographically secure, unguessable share token.
function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { docType?: string; docId?: string };
    if (body.docType !== "invoice" && body.docType !== "quote") {
      return NextResponse.json({ error: "docType must be invoice or quote" }, { status: 400 });
    }
    if (!body.docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }
    const sql = getSql();
    const token = makeToken();
    await sql`INSERT INTO shares (token, doc_type, doc_id) VALUES (${token}, ${body.docType}, ${body.docId})`;
    return NextResponse.json({ token, url: `/share/${token}` });
  } catch (error) {
    console.error("Create share failed:", error);
    return NextResponse.json({ error: "Something went wrong while creating the share link." }, { status: 500 });
  }
}
