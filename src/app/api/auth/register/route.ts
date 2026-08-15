import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query } from "@/lib/db";
import { hashPassword, isValidEmail, setSession } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { callerId } from "@/lib/rate-limit";

type CountRow = { n: number };

export async function POST(request: Request) {
  try {
    await setupDatabase();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await query<CountRow>`SELECT count(*)::int AS n FROM users`;
    if ((existing[0]?.n ?? 0) > 0) {
      return NextResponse.json({ error: "Admin already registered." }, { status: 403 });
    }

    const hash = await hashPassword(password);
    const id = `u_${Date.now().toString(36)}${callerId().slice(0, 8)}`;
    const sql = getSql();
    try {
      await sql`
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES (${id}, ${email}, ${hash}, '', 'admin')`;
    } catch (error) {
      // Two requests can pass the count() check at once; the UNIQUE(email)
      // constraint makes the race harmless — surface the same denial.
      if ((error as { code?: string })?.code === "23505") {
        return NextResponse.json({ error: "Admin already registered." }, { status: 403 });
      }
      throw error;
    }

    await setSession(email);
    return NextResponse.json({ email, name: "" });
  } catch (error) {
    console.error("Register failed:", error);
    return NextResponse.json({ error: "Something went wrong while registering." }, { status: 500 });
  }
}
