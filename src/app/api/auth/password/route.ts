import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query } from "@/lib/db";
import { getSessionEmail, hashPassword, requireAuth, verifyPassword } from "@/lib/auth";

type UserRow = { password_hash: string };

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const email = await getSessionEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "New password must be different from the current password." }, { status: 400 });
    }

    const rows = await query<UserRow>`SELECT password_hash FROM users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const hash = await hashPassword(newPassword);
    const sql = getSql();
    await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${email}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Change password failed:", error);
    return NextResponse.json({ error: "Something went wrong while changing your password." }, { status: 500 });
  }
}
