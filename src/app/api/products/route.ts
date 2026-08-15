import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToProduct } from "@/lib/db";
import type { ProductRow } from "@/lib/db";
import type { Product } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<ProductRow>`SELECT * FROM products ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToProduct));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Product;
  await sql`
    INSERT INTO products (id, name, detail, price, promo, discount, tax, image, created_at)
    VALUES (${body.id}, ${body.name}, ${body.detail}, ${body.price}, ${body.promo}, ${body.discount}, ${body.tax}, ${body.image}, ${body.createdAt})`;
  return NextResponse.json(body);
}
