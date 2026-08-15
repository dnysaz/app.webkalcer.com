import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import type { Invoice } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Invoice;
  await sql`
    UPDATE invoices
    SET number = ${body.number}, customer_id = ${body.customerId}, items = ${JSON.stringify(body.items)}::jsonb,
        discount = ${body.discount}, tax = ${body.tax}, status = ${body.status},
        issue_date = ${body.issueDate}, due_date = ${body.dueDate}, notes = ${body.notes}
    WHERE id = ${id}`;
  return NextResponse.json(body);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
