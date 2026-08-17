import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getSessionEmail } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";

type CountRow = { n: number };
type UserRow = { name: string };

export async function GET() {
  await setupDatabase();
  const email = await getSessionEmail();
  // "Admin exists" = at least one user with role 'admin' — non-admin/member
  // users must never re-enable the registration form.
  const rows = await query<CountRow>`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
  const adminExists = (rows[0]?.n ?? 0) > 0;

  if (!email) {
    return NextResponse.json({ authed: false, adminExists });
  }
  const user = await query<UserRow>`SELECT name FROM users WHERE email = ${email} LIMIT 1`;
  return NextResponse.json({ authed: true, email, name: user[0]?.name ?? "", adminExists });
}
