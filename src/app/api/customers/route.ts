import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToCustomer } from "@/lib/db";
import type { CustomerRow } from "@/lib/db";
import type { Customer } from "@/lib/crm";
import { generateCustomerCode } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query<CustomerRow>`SELECT * FROM customers ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(rowToCustomer));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const body = (await request.json()) as Customer;
  // Retry a few times in the (astronomically rare) case of a code collision.
  let customer = body;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sql`
        INSERT INTO customers (id, code, name, business_name, email, phones, domain, address, status, notes, created_at)
        VALUES (${customer.id}, ${customer.code}, ${customer.name}, ${customer.businessName}, ${customer.email}, ${JSON.stringify(customer.phones)}::jsonb, ${customer.domain}, ${customer.address}, ${customer.status}, ${customer.notes}, ${customer.createdAt})`;
      return NextResponse.json(customer);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "23505" && attempt < 4) {
        customer = { ...customer, code: generateCustomerCode() };
        continue;
      }
      throw error;
    }
  }
  throw new Error("unreachable");
}
