import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToInvoice } from "@/lib/db";
import type { InvoiceRow } from "@/lib/db";
import type { Invoice } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<InvoiceRow>`SELECT * FROM invoices ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToInvoice));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Invoice;
  await sql`
    INSERT INTO invoices (id, number, customer_id, items, discount, tax, status, issue_date, due_date, notes)
    VALUES (${body.id}, ${body.number}, ${body.customerId}, ${JSON.stringify(body.items)}::jsonb, ${body.discount}, ${body.tax}, ${body.status}, ${body.issueDate}, ${body.dueDate}, ${body.notes})`;
  return NextResponse.json(body);
}
