import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import type { Customer } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Customer;
  await sql`
    UPDATE customers
    SET name = ${body.name}, business_name = ${body.businessName}, email = ${body.email},
        phones = ${JSON.stringify(body.phones)}::jsonb, domain = ${body.domain},
        address = ${body.address}, status = ${body.status}, notes = ${body.notes}
    WHERE id = ${id}`;
  return NextResponse.json(body);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  await sql`DELETE FROM customers WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
