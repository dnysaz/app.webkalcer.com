import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

type UserRow = { id: string; email: string; name: string; password_hash: string };

export async function POST(request: Request) {
  // Brute-force protection: 10 attempts per 15 minutes per IP.
  const limiter = rateLimit(`login:${clientKey(request)}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const rows = await query<UserRow>`SELECT id, email, name, password_hash FROM users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setSession(user.email);
    return NextResponse.json({ email: user.email, name: user.name });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Something went wrong while logging in." }, { status: 500 });
  }
}