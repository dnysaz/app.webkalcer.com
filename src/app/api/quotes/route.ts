import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToQuote } from "@/lib/db";
import type { QuoteRow } from "@/lib/db";
import type { Quote } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<QuoteRow>`SELECT * FROM quotes ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToQuote));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Quote;
  await sql`
    INSERT INTO quotes (id, number, customer_id, items, discount, tax, status, issue_date, valid_until, notes)
    VALUES (${body.id}, ${body.number}, ${body.customerId}, ${JSON.stringify(body.items)}::jsonb, ${body.discount}, ${body.tax}, ${body.status}, ${body.issueDate}, ${body.validUntil}, ${body.notes})`;
  return NextResponse.json(body);
}
