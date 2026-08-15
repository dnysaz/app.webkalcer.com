import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { setupDatabase } from "@/lib/setup";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const counts = await setupDatabase();
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("Database setup failed:", error);
    return NextResponse.json({ ok: false, error: "Database setup failed." }, { status: 500 });
  }
}
