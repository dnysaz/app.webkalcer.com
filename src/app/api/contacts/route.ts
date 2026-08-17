import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query, rowToContact } from "@/lib/db";
import type { ContactRow } from "@/lib/db";
import type { Contact, ContactStatus } from "@/lib/crm";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { uploadToR2 } from "@/lib/r2";
import { callerId } from "@/lib/rate-limit";

const VALID_STATUSES: ContactStatus[] = ["new", "reached", "unreachable"];
const MAX_CSV_BYTES = 1024 * 1024; // 1 MB

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const rows = await query<ContactRow>`SELECT * FROM contacts ORDER BY created_at DESC`;
    return NextResponse.json(rows.map(rowToContact));
  } catch (error) {
    // Table may not exist yet on a brand-new DB — return an empty list.
    if ((error as { code?: string })?.code === "42P01") {
      return NextResponse.json([]);
    }
    console.error("List contacts failed:", error);
    return NextResponse.json({ error: "Something went wrong while loading contacts." }, { status: 500 });
  }
}

/**
 * Uploads a CSV contact file to R2, parses it, and stores the rows.
 * Body: { csv: string } — raw CSV text. The original file is kept in R2
 * (csvUrl) so the source data is always available.
 */
export async function POST(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await setupDatabase();
    const body = (await request.json()) as { csv?: string; fileName?: string };
    if (typeof body.csv !== "string" || !body.csv.trim()) {
      return NextResponse.json({ error: "File content is required." }, { status: 400 });
    }
    const content = body.csv;
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "File is too large (max 1 MB)." }, { status: 400 });
    }

    // Detect format: vCard (.vcf/.vcard) or CSV.
    const isVcf = /BEGIN:VCARD/i.test(content);
    const parsed = isVcf ? parseVcf(content) : parseCsv(content);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: isVcf ? "No valid contacts found in the vCard file." : "No valid rows found. Expected columns: name, phone." },
        { status: 400 },
      );
    }

    // Store the original file in R2 (keeps the source data available).
    const ext = isVcf ? "vcf" : "csv";
    const mime = isVcf ? "text/vcard; charset=utf-8" : "text/csv; charset=utf-8";
    const key = `contacts/${Date.now().toString(36)}-${callerId().slice(0, 8)}.${ext}`;
    const csvUrl = await uploadToR2(key, Buffer.from(content, "utf8"), mime);

    // Insert all rows.
    const sql = getSql();
    const now = new Date().toISOString();
    const contacts: Contact[] = [];
    for (const row of parsed) {
      const id = `ct_${Date.now().toString(36)}${callerId().slice(0, 8)}`;
      await sql`
        INSERT INTO contacts (id, name, phone, status, csv_url, created_at)
        VALUES (${id}, ${row.name}, ${row.phone}, 'new', ${csvUrl}, ${now})`;
      contacts.push({ id, name: row.name, phone: row.phone, status: "new", csvUrl, createdAt: now });
    }

    return NextResponse.json({ contacts, count: contacts.length });
  } catch (error) {
    console.error("Upload contacts failed:", error);
    return NextResponse.json({ error: "Something went wrong while uploading the contact file." }, { status: 500 });
  }
}

/** Updates a contact's status: { id, status }. */
export async function PATCH(request: Request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { id?: string; status?: string };
    if (!body.id || !VALID_STATUSES.includes(body.status as ContactStatus)) {
      return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
    }
    const sql = getSql();
    await sql`UPDATE contacts SET status = ${body.status} WHERE id = ${body.id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update contact status failed:", error);
    return NextResponse.json({ error: "Something went wrong while updating the contact." }, { status: 500 });
  }
}

/**
 * Parses CSV text into { name, phone } rows.
 * - Skips a header line when it looks like column labels (contains "name"
 *   and/or "phone").
 * - Skips blank lines and rows without a phone.
 * - Trims and limits field length.
 */
function parseCsv(csv: string): { name: string; phone: string }[] {
  const lines = csv.split(/\r?\n/);
  const rows: { name: string; phone: string }[] = [];
  let startIndex = 0;

  // Header detection: first non-empty line looks like labels.
  const first = lines.find((l) => l.trim().length > 0);
  if (first) {
    const header = first.toLowerCase();
    if (header.includes("name") || header.includes("phone") || header.includes("telepon") || header.includes("nama")) {
      startIndex = lines.findIndex((l) => l.trim().length > 0) + 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Support comma and semicolon delimiters.
    const parts = line.includes(";") ? line.split(";") : line.split(",");
    const name = (parts[0] ?? "").trim().replace(/^"|"$/g, "").slice(0, 200);
    const phone = (parts[1] ?? "").trim().replace(/^"|"$/g, "").slice(0, 40);
    if (!name || !phone) continue;
    rows.push({ name, phone });
  }
  return rows;
}

/**
 * Parses vCard (vcf) text into { name, phone } rows — the format Android /
 * Google Contacts exports. Handles folded lines (continuation), FN/N fields
 * for the name, and TEL for the phone (prefers CELL/VOICE, skips FAX).
 */
function parseVcf(vcf: string): { name: string; phone: string }[] {
  // Unfold lines: a line starting with a space/tab is a continuation of the
  // previous one.
  const unfolded = vcf
    .split(/\r?\n/)
    .reduce<string[]>((acc, line) => {
      if ((line.startsWith(" ") || line.startsWith("\t")) && acc.length > 0) {
        acc[acc.length - 1] += line.slice(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, []);

  const rows: { name: string; phone: string }[] = [];
  let current: { name: string; phone: string } | null = null;

  for (const raw of unfolded) {
    const line = raw.trim();
    if (!line) continue;

    if (/^BEGIN:VCARD/i.test(line)) {
      current = { name: "", phone: "" };
      continue;
    }
    if (/^END:VCARD/i.test(line)) {
      if (current && current.name && current.phone) rows.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    // Strip params: TEL;TYPE=CELL → TEL ; N;CHARSET=UTF-8 → N
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const keyRaw = line.slice(0, colon).toUpperCase();
    const value = line.slice(colon + 1).trim();
    const key = keyRaw.split(";")[0];

    if (key === "FN" || key === "N") {
      if (!current.name) {
        // N uses semicolon-separated parts: Family;Given;... — use Given Family.
        const parts = value.split(";");
        const given = (parts[1] ?? "").trim();
        const family = (parts[0] ?? "").trim();
        current.name = given && family ? `${given} ${family}` : (given || family);
      }
    } else if (key === "TEL") {
      if (!current.phone) {
        const type = keyRaw.includes("FAX") ? "fax" : keyRaw.includes("CELL") || keyRaw.includes("VOICE") ? "voice" : "other";
        if (type !== "fax") {
          current.phone = value
            .replace(/[\s\-().]/g, "")
            .replace(/^\+/, "+")
            .slice(0, 40);
        }
      }
    }
  }

  // Handle a trailing block without END:VCARD.
  if (current && current.name && current.phone) rows.push(current);

  return rows.map((r) => ({ name: r.name.slice(0, 200), phone: r.phone }));
}
