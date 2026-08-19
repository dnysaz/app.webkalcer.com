import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToWebAsset } from "@/lib/db";
import type { WebAssetRow } from "@/lib/db";
import type { WebAsset } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<WebAssetRow>`SELECT * FROM web_assets ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToWebAsset));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as WebAsset;
  await sql`
    INSERT INTO web_assets (id, type, name, customer_id, provider, start_date, expiry_date, price, sell_price, notes, created_at)
    VALUES (${body.id}, ${body.type}, ${body.name}, ${body.customerId}, ${body.provider}, ${body.startDate}, ${body.expiryDate}, ${body.price}, ${body.sellPrice ?? 0}, ${body.notes}, ${body.createdAt})`;
  return NextResponse.json(body);
}
