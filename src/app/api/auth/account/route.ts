import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql } from "@/lib/db";
import { getSessionEmail, requireAuth } from "@/lib/auth";

export async function PATCH(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const email = await getSessionEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : undefined;
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    const sql = getSql();
    await sql`UPDATE users SET name = ${name} WHERE email = ${email}`;
    return NextResponse.json({ email, name });
  } catch (error) {
    console.error("Update account failed:", error);
    return NextResponse.json({ error: "Something went wrong while updating your account." }, { status: 500 });
  }
}
