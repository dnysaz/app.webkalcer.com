import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

/** Maximum accepted image size after base64 decoding (bytes). */
const MAX_IMAGE_BYTES = 512 * 1024; // 512 KB
/** Content types we allow to be served from the R2 bucket. */
const ALLOWED_MIME: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { dataUrl?: string };
    if (!body.dataUrl || !body.dataUrl.includes(",")) {
      return NextResponse.json({ error: "No image data provided." }, { status: 400 });
    }
    const mime = body.dataUrl.slice(5, body.dataUrl.indexOf(";")).toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      return NextResponse.json({ error: "Only PNG, JPEG, or WebP images are allowed." }, { status: 400 });
    }
    const base64 = body.dataUrl.split(",")[1];
    if (!base64) return NextResponse.json({ error: "No image data provided." }, { status: 400 });

    const buf = Buffer.from(base64, "base64");
    if (buf.length === 0) return NextResponse.json({ error: "Empty image data." }, { status: 400 });
    if (buf.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Image is too large (max ${MAX_IMAGE_BYTES / 1024} KB).` }, { status: 400 });
    }

    // Reject files that aren't actually the claimed image type.
    if (!isValidImageHeader(buf, mime)) {
      return NextResponse.json({ error: "The file does not match its declared image type." }, { status: 400 });
    }

    const key = `images/${randomKey()}.${ext}`;
    const url = await uploadToR2(key, buf, mime);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Cheap magic-byte check so a PNG header can't be uploaded as JPEG, etc. */
function isValidImageHeader(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/webp") return buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP";
  return false;
}