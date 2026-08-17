import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getSessionEmail } from "@/lib/auth";

type CountRow = { n: number };
type UserRow = { name: string };

export async function GET() {
  const email = await getSessionEmail();
  let adminExists = false;
  try {
    // "Admin exists" = at least one user with role 'admin' — non-admin/member
    // users must never re-enable the registration form.
    const rows = await query<CountRow>`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
    adminExists = (rows[0]?.n ?? 0) > 0;
  } catch (error) {
    // Brand-new DB (schema not created yet): treat as no admin so the
    // registration form shows. /api/setup creates the schema on first load.
    if ((error as { code?: string })?.code !== "42P01") throw error;
  }

  if (!email) {
    return NextResponse.json({ authed: false, adminExists });
  }
  let name = "";
  try {
    const user = await query<UserRow>`SELECT name FROM users WHERE email = ${email} LIMIT 1`;
    name = user[0]?.name ?? "";
  } catch (error) {
    if ((error as { code?: string })?.code !== "42P01") throw error;
  }
  return NextResponse.json({ authed: true, email, name, adminExists });
}
