import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { getTldPricing } from "@/lib/porkbun";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const pricing = await getTldPricing();
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("TLD pricing fetch failed:", error);
    const message = error instanceof Error ? error.message : "Failed to load domain pricing.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
