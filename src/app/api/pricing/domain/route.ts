import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { checkDomainPricing } from "@/lib/porkbun";

const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as { domain?: string };
    const domain = (body.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain) {
      return NextResponse.json({ error: "Domain is required." }, { status: 400 });
    }
    if (!DOMAIN_PATTERN.test(domain)) {
      return NextResponse.json({ error: "Invalid domain. Enter a full domain like webkalcer.com." }, { status: 400 });
    }
    const result = await checkDomainPricing(domain);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Domain check failed:", error);
    const message = error instanceof Error ? error.message : "Failed to check the domain.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
