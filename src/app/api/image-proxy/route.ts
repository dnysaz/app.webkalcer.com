import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PUBLIC_HOST = (process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).host : "")
  || "pub-9ab970da1dae4d43b0957b7b79cabf58.r2.dev";

/**
 * Fetches an image server-side and returns it as a data URL. Browser `fetch()`
 * to the public R2 bucket is blocked by CORS, so PDF generation (which runs in
 * the browser) uses this proxy to embed images. Only allows the configured R2
 * public host to avoid SSRF.
 */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || target.host !== PUBLIC_HOST) {
    return NextResponse.json({ error: "Url not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString());
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
