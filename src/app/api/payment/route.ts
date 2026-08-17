import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToPaymentSettings } from "@/lib/db";
import type { PaymentSettingsRow } from "@/lib/db";
import type { PaymentSettings } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";

const ROW_ID = "site";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await query<PaymentSettingsRow>`SELECT id, qris_image, bank_accounts FROM payment_settings WHERE id = ${ROW_ID} LIMIT 1`;
    return NextResponse.json(rows[0] ? rowToPaymentSettings(rows[0]) : { qrisImage: "", bankAccounts: [] });
  } catch (error) {
    // Table may not exist yet on a brand-new DB (schema is created by
    // /api/setup when the app first loads). Return defaults instead of
    // running the full ~30-statement migration on every page view.
    if ((error as { code?: string })?.code === "42P01") {
      return NextResponse.json({ qrisImage: "", bankAccounts: [] });
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as PaymentSettings;
    const bankAccounts = Array.isArray(body.bankAccounts)
      ? body.bankAccounts.filter((b) => b && typeof b === "object" && typeof b.bank === "string")
      : [];
    const sql = getSql();
    await sql`
      INSERT INTO payment_settings (id, qris_image, bank_accounts, updated_at)
      VALUES (${ROW_ID}, ${typeof body.qrisImage === "string" ? body.qrisImage : ""}, ${JSON.stringify(bankAccounts)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        qris_image = EXCLUDED.qris_image,
        bank_accounts = EXCLUDED.bank_accounts,
        updated_at = now()`;
    return NextResponse.json({ qrisImage: typeof body.qrisImage === "string" ? body.qrisImage : "", bankAccounts });
  } catch (error) {
    console.error("Save payment settings failed:", error);
    return NextResponse.json({ error: "Something went wrong while saving payment settings." }, { status: 500 });
  }
}
