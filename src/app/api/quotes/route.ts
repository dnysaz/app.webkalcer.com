import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToQuote } from "@/lib/db";
import type { QuoteRow } from "@/lib/db";
import type { Quote } from "@/lib/crm";
import { nextNumber } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<QuoteRow>`SELECT * FROM quotes ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToQuote));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  let body = (await request.json()) as Quote;
  // The number is generated client-side; two tabs can pick the same one.
  // On a unique violation, retry with the next free number from the DB.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sql`
        INSERT INTO quotes (id, number, customer_id, items, discount, tax, status, issue_date, valid_until, notes)
        VALUES (${body.id}, ${body.number}, ${body.customerId}, ${JSON.stringify(body.items)}::jsonb, ${body.discount}, ${body.tax}, ${body.status}, ${body.issueDate}, ${body.validUntil}, ${body.notes})`;
      return NextResponse.json(body);
    } catch (error) {
      const e = error as { code?: string; constraint?: string };
      if (e.code === "23505" && e.constraint === "quotes_number_key" && attempt < 4) {
        const rows = await query<{ number: string }>`SELECT number FROM quotes`;
        body = { ...body, number: nextNumber("OFF", rows.map((r) => r.number)) };
        continue;
      }
      throw error;
    }
  }
  throw new Error("unreachable");
}
