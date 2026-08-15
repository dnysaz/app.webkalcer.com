import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import type { WebAsset } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as WebAsset;
  await sql`
    UPDATE web_assets
    SET type = ${body.type}, name = ${body.name}, customer_id = ${body.customerId},
        provider = ${body.provider}, start_date = ${body.startDate}, expiry_date = ${body.expiryDate},
        price = ${body.price}, notes = ${body.notes}
    WHERE id = ${id}`;
  return NextResponse.json(body);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  await sql`DELETE FROM web_assets WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
