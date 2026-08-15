import { jsPDF } from "jspdf";
import type { Customer, Invoice, InvoiceItem, PaymentSettings, Product, Quote } from "@/lib/crm";
import { computeTotals, formatDate, formatPhones, formatRupiah, productEffectivePrice } from "@/lib/crm";

type RGB = [number, number, number];

// ---- Theme-aware palette ----
// Falls back to the emerald brand (matching ShareDocPaper) when CSS variables
// aren't available (e.g. SSR/node), and is refreshed from the applied theme's
// CSS custom properties at build time so PDF/print follow the chosen theme.
function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function cssVar(name: string, fallback: RGB): RGB {
  if (typeof document === "undefined") return fallback;
  try {
    // Probe element resolves color-mix()/var() chains to a computed rgb().
    const probe = document.createElement("div");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (raw.startsWith("#")) return hexToRgb(raw);
  } catch {
    // fall through
  }
  return fallback;
}

// Emerald brand defaults (also what ShareDocPaper uses before theme applies).
const EMERALD: RGB = [35, 75, 66]; // #234b42
const DARK_DEF: RGB = [25, 51, 45]; // #19332d
const INK_DEF: RGB = [51, 78, 69]; // #334e45
const BODY_DEF: RGB = [95, 113, 104]; // #5f7168
const MUTED_DEF: RGB = [150, 163, 157]; // #96a39d
const CARD_DEF: RGB = [247, 250, 247]; // #f7faf7
const BORDER_DEF: RGB = [227, 233, 228]; // #e3e9e4
const ROWLINE_DEF: RGB = [237, 241, 238]; // #edf1ee
const NOTESTEXT_DEF: RGB = [74, 94, 85]; // #4a5e55
const FOOT_DEF: RGB = [154, 167, 160]; // #9aa7a0
const HEADNUM_DEF: RGB = [214, 229, 222]; // #d6e5de
const PRICE_DEF: RGB = [125, 140, 133]; // #7d8c85
const SEP_DEF: RGB = [220, 230, 224]; // #dce6e0
const HEADER_SUB_DEF: RGB = [189, 201, 198]; // white/70 over #234b42

const STATUS_TONES_DEF: Record<string, [RGB, RGB]> = {
  Draft: [[232, 228, 244], [110, 93, 147]],
  Active: [[227, 232, 247], [78, 101, 163]],
  Process: [[253, 241, 220], [154, 106, 42]],
  Done: [[222, 241, 229], [53, 115, 85]],
  Cancel: [[244, 223, 227], [162, 75, 98]],
};

// Theme-aware palette — refreshed from CSS vars at build time.
let GREEN: RGB = EMERALD;
let DARK: RGB = DARK_DEF;
let INK: RGB = INK_DEF;
let BODY: RGB = BODY_DEF;
let MUTED: RGB = MUTED_DEF;
let CARD: RGB = CARD_DEF;
let BORDER: RGB = BORDER_DEF;
let ROWLINE: RGB = ROWLINE_DEF;
let NOTESTEXT: RGB = NOTESTEXT_DEF;
let FOOT: RGB = FOOT_DEF;
let HEADNUM: RGB = HEADNUM_DEF;
let PRICE: RGB = PRICE_DEF;
let SEP: RGB = SEP_DEF;
let HEADER_SUB: RGB = HEADER_SUB_DEF;
let STATUS_TONES: Record<string, [RGB, RGB]> = { ...STATUS_TONES_DEF };

/** Mix two RGB colors by ratio (0..1) toward the second color. */
function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/**
 * Refresh the palette from the applied theme (called at the start of every
 * PDF build). When CSS vars are unavailable the emerald defaults are kept.
 */
function refreshTheme() {
  GREEN = cssVar("--crm-primary", EMERALD);
  DARK = cssVar("--crm-fg", DARK_DEF);
  INK = cssVar("--crm-fg", INK_DEF);
  BODY = cssVar("--crm-body", BODY_DEF);
  MUTED = cssVar("--crm-muted", MUTED_DEF);
  CARD = cssVar("--crm-surface", CARD_DEF);
  BORDER = cssVar("--crm-border-input", BORDER_DEF);
  ROWLINE = cssVar("--crm-border-soft", ROWLINE_DEF);
  NOTESTEXT = cssVar("--crm-body", NOTESTEXT_DEF);
  FOOT = cssVar("--crm-muted", FOOT_DEF);
  PRICE = cssVar("--crm-secondary", PRICE_DEF);
  SEP = cssVar("--crm-border", SEP_DEF);
  // Header number + sub-label are light tints over the primary band.
  HEADNUM = mixRgb(GREEN, [255, 255, 255], 0.78);
  HEADER_SUB = mixRgb(GREEN, [255, 255, 255], 0.72);
  const toneMap: Record<string, [string, string]> = {
    Draft: ["--crm-st-draft-bg", "--crm-st-draft-text"],
    Active: ["--crm-st-active-bg", "--crm-st-active-text"],
    Process: ["--crm-st-process-bg", "--crm-st-process-text"],
    Done: ["--crm-st-done-bg", "--crm-st-done-text"],
    Cancel: ["--crm-st-cancel-bg", "--crm-st-cancel-text"],
  };
  const fresh: Record<string, [RGB, RGB]> = {};
  for (const [status, [bgVar, fgVar]] of Object.entries(toneMap)) {
    fresh[status] = [cssVar(bgVar, STATUS_TONES_DEF[status][0]), cssVar(fgVar, STATUS_TONES_DEF[status][1])];
  }
  STATUS_TONES = fresh;
}

// The share paper is max-w-3xl (768px) at A4 aspect. Scale 768px -> 210mm,
// so its px-10 (40px) side padding becomes ~11mm on the A4 PDF.
const MARGIN = 11;

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}
function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}
function contentWidth(doc: jsPDF): number {
  return pageWidth(doc) - MARGIN * 2;
}

// ---- Embedded fonts (DM Sans + Space Mono, same as the app UI) ----
let fontsPromise: Promise<Record<string, string> | null> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function loadFonts(): Promise<Record<string, string>> {
  const files: Record<string, string> = {
    dm400: "/fonts/dm-sans-400.ttf",
    dm600: "/fonts/dm-sans-600.ttf",
    dm700: "/fonts/dm-sans-700.ttf",
    sm400: "/fonts/space-mono-400.ttf",
    sm700: "/fonts/space-mono-700.ttf",
  };
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(files).map(async ([key, url]) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      out[key] = bytesToBase64(new Uint8Array(buf));
    }),
  );
  return out;
}

/** Register fonts into a doc. Safe to call on every build (cached fetch). */
async function ensureFonts(doc: jsPDF): Promise<void> {
  fontsPromise ??= loadFonts().catch(() => null);
  const f = await fontsPromise;
  if (!f) return; // fonts unavailable → fall back to jsPDF built-in fonts
  try {
    doc.addFileToVFS("dm400.ttf", f.dm400);
    doc.addFont("dm400.ttf", "DMSans", "normal");
    doc.addFileToVFS("dm600.ttf", f.dm600);
    doc.addFont("dm600.ttf", "DMSansSemi", "normal");
    doc.addFileToVFS("dm700.ttf", f.dm700);
    doc.addFont("dm700.ttf", "DMSans", "bold");
    doc.addFileToVFS("sm400.ttf", f.sm400);
    doc.addFont("sm400.ttf", "SpaceMono", "normal");
    doc.addFileToVFS("sm700.ttf", f.sm700);
    doc.addFont("sm700.ttf", "SpaceMono", "bold");
  } catch {
    // font registration failed — fall back to built-in fonts
  }
}

function setFontSafe(doc: jsPDF, family: "DMSans" | "DMSansSemi" | "SpaceMono" | "helvetica", style: "normal" | "bold" = "normal") {
  try {
    doc.setFont(family, style);
  } catch {
    doc.setFont("helvetica", style);
  }
}

/** Green header band identical to the share paper. */
function drawHeader(doc: jsPDF, docType: string, subtitle: string) {
  const w = pageWidth(doc);
  const bandH = 20;
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, w, bandH, "F");

  // Left: label + site
  setFontSafe(doc, "DMSans", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...HEADER_SUB);
  doc.text("WEBCALCER CRM", MARGIN, 9.5);
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("webkalcer.com", MARGIN, 15);

  // Right: doc title + number
  setFontSafe(doc, "DMSans", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(docType, w - MARGIN, 10.5, { align: "right" });
  setFontSafe(doc, "DMSans");
  doc.setFontSize(9);
  doc.setTextColor(...HEADNUM);
  doc.text(subtitle, w - MARGIN, 16.5, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const w = pageWidth(doc);
  const h = pageHeight(doc);
  doc.setDrawColor(...ROWLINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, h - 12, w - MARGIN, h - 12);
  setFontSafe(doc, "DMSans");
  doc.setFontSize(7.5);
  doc.setTextColor(...FOOT);
  doc.text("Generated by webkalcerCRM · CRM by webkalcer.com", MARGIN, h - 7.5);
  doc.text(formatDate(new Date().toISOString()), w - MARGIN, h - 7.5, { align: "right" });
}

/** Section title for customer/product PDFs (neutral dark uppercase). */
function sectionTitle(doc: jsPDF, y: number, title: string): number {
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(title.toUpperCase(), MARGIN, y);
  return y + 6;
}

/** Generic info card (customer/product PDFs). */
function infoCard(doc: jsPDF, y: number, rows: { label: string; value: string }[], cols = 2): number {
  const w = contentWidth(doc);
  const colW = w / cols;
  const pad = 5.5;

  const cellHeights: number[] = rows.map((r) => {
    setFontSafe(doc, "DMSans");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(r.value || "—", colW - pad * 2) as string[];
    return 4 + Math.max(1, lines.length) * 4.6;
  });
  const bands = Math.ceil(rows.length / cols);
  const bandH: number[] = [];
  for (let b = 0; b < bands; b++) {
    let max = 0;
    for (let c = 0; c < cols; c++) {
      const idx = b * cols + c;
      if (idx < rows.length) max = Math.max(max, cellHeights[idx]);
    }
    bandH.push(max + 3);
  }
  const cardH = 8 + bandH.reduce((a, b) => a + b, 0) + 5;

  doc.setFillColor(...CARD);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, w, cardH, 3, 3, "FD");

  let bandTop = y + 10;
  for (let b = 0; b < bands; b++) {
    for (let c = 0; c < cols; c++) {
      const idx = b * cols + c;
      if (idx >= rows.length) continue;
      const r = rows[idx];
      const px = MARGIN + pad + c * colW;
      setFontSafe(doc, "DMSansSemi");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(r.label.toUpperCase(), px, bandTop + 4);
      setFontSafe(doc, "DMSans");
      doc.setFontSize(9.5);
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(r.value || "—", colW - pad * 2) as string[];
      doc.text(lines, px, bandTop + 9);
    }
    bandTop += bandH[b];
  }
  return y + cardH + 8;
}

/** Info card identical to the share paper: Bill to + status pill + 3-field row. */
function docInfoCard(doc: jsPDF, y: number, docType: "invoice" | "quote", d: Invoice | Quote, customer?: Customer): number {
  const w = contentWidth(doc);
  const pad = 5.5;
  const leftW = w / 2 - pad;

  const dateLabel = docType === "invoice" ? "Due date" : "Valid until";
  const dateValue = docType === "invoice" ? (d as Invoice).dueDate : (d as Quote).validUntil;

  const billTo: string[] = [];
  if (customer) {
    billTo.push(`${customer.name}${customer.businessName ? ` · ${customer.businessName}` : ""}`);
    if (customer.domain) billTo.push(`Domain: ${customer.domain}`);
    if (customer.email) billTo.push(customer.email);
    const phones = formatPhones(customer.phones);
    if (phones) billTo.push(phones);
    if (customer.address) billTo.push(customer.address);
  }

  // Measure left column
  const nameLines = billTo[0] ? (doc.splitTextToSize(billTo[0], leftW) as string[]) : ["—"];
  let contactH = 0;
  const contactLines: string[][] = [];
  setFontSafe(doc, "DMSans");
  doc.setFontSize(9);
  for (const line of billTo.slice(1)) {
    const lines = doc.splitTextToSize(line, leftW) as string[];
    contactLines.push(lines);
    contactH += lines.length * 3.8;
  }
  const leftH = 3 + 1.5 + nameLines.length * 4.2 + (contactLines.length ? 1.5 + contactH : 0);

  const bottomRowH = 3 + 4.4 + 4;
  const cardH = pad + leftH + 5 + bottomRowH + pad;

  doc.setFillColor(...CARD);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, w, cardH, 3, 3, "FD");

  // Bill to
  let yy = y + pad;
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("BILL TO", MARGIN + pad, yy);
  yy += 3.2;
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  for (const line of nameLines) {
    doc.text(line, MARGIN + pad, yy + 2);
    yy += 4.2;
  }
  if (contactLines.length) {
    yy += 1.5;
    setFontSafe(doc, "DMSans");
    doc.setFontSize(9);
    doc.setTextColor(...BODY);
    for (const lines of contactLines) {
      for (const line of lines) {
        doc.text(line, MARGIN + pad, yy + 2);
        yy += 3.8;
      }
    }
  }

  // Status pill (top right)
  const [bg, fg] = STATUS_TONES[d.status] ?? [[225, 237, 241], [71, 117, 137]];
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(7.5);
  const pillW = doc.getTextWidth(d.status.toUpperCase()) + 6;
  const pillH = 5.2;
  doc.setFillColor(...bg);
  doc.roundedRect(MARGIN + w - pad - pillW, y + pad, pillW, pillH, 2.5, 2.5, "F");
  doc.setTextColor(...fg);
  doc.text(d.status.toUpperCase(), MARGIN + w - pad - pillW + 3, y + pad + pillH / 2 + 1);

  // Bottom row: Issue date / Due date | Valid until / Customer
  const fields = [
    { label: "Issue date", value: formatDate(d.issueDate) },
    { label: dateLabel, value: formatDate(dateValue) },
    { label: "Customer", value: customer?.code || "—", mono: true },
  ];
  const bottomTop = y + pad + leftH + 5;
  const thirdW = w / 3;
  for (let c = 0; c < 3; c++) {
    const fx = MARGIN + pad + c * thirdW;
    setFontSafe(doc, "DMSansSemi");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(fields[c].label.toUpperCase(), fx, bottomTop);
    setFontSafe(doc, fields[c].mono ? "SpaceMono" : "DMSansSemi");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(fields[c].value, fx, bottomTop + 4.4);
  }

  return y + cardH + 8;
}

/** Items table drawn manually to match the share paper (green header, border-t rows only). */
function itemsTable(doc: jsPDF, items: InvoiceItem[], y: number): number {
  const w = contentWidth(doc);
  const colQty = 16;
  const colPrice = 34;
  const colAmount = 40;
  const colName = w - colQty - colPrice - colAmount;
  const headH = 8;
  const rowH = 8;
  const outerH = headH + items.length * rowH;

  // Outer border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, w, outerH, 2, 2, "S");

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(MARGIN + 0.3, y + 0.3, w - 0.6, headH - 0.3, "F");
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  const headY = y + headH / 2 + 1.2;
  doc.text("Item / Service", MARGIN + 3, headY);
  doc.text("Qty", MARGIN + colName + colQty / 2, headY, { align: "center" });
  doc.text("Price", MARGIN + colName + colQty + colPrice - 3, headY, { align: "right" });
  doc.text("Amount", MARGIN + w - 3, headY, { align: "right" });

  // Rows (border-t only, like the share paper)
  items.forEach((item, i) => {
    const ry = y + headH + i * rowH;
    if (i > 0) {
      doc.setDrawColor(...ROWLINE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN + 0.3, ry, MARGIN + w - 0.3, ry);
    }
    const rowY = ry + rowH / 2 + 1.2;
    setFontSafe(doc, "DMSans");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(item.name, colName - 4) as string[], MARGIN + 3, rowY);
    setFontSafe(doc, "DMSans");
    doc.setFontSize(9);
    doc.setTextColor(...PRICE);
    doc.text(String(item.qty), MARGIN + colName + colQty / 2, rowY, { align: "center" });
    doc.text(formatRupiah(item.price), MARGIN + colName + colQty + colPrice - 3, rowY, { align: "right" });
    setFontSafe(doc, "DMSansSemi");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(formatRupiah(item.qty * item.price), MARGIN + w - 3, rowY, { align: "right" });
  });

  return y + outerH + 8;
}

/** Notes box matching the share paper (label inside, card background). */
function notesBlock(doc: jsPDF, y: number, notes: string): number {
  const w = contentWidth(doc);
  setFontSafe(doc, "DMSans");
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(notes, w - 9) as string[];
  const boxH = 4 + 3.4 + 1.8 + Math.max(1, lines.length) * 4.6 + 4;

  if (y + boxH > pageHeight(doc) - 20) {
    doc.addPage();
    y = 22;
  }

  doc.setFillColor(...CARD);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, w, boxH, 3, 3, "FD");

  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("NOTES", MARGIN + 4, y + 4.4);
  setFontSafe(doc, "DMSans");
  doc.setFontSize(10.5);
  doc.setTextColor(...NOTESTEXT);
  let ly = y + 7.6;
  for (const line of lines) {
    doc.text(line, MARGIN + 4, ly);
    ly += 4.6;
  }
  return y + boxH + 6;
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;
  try {
    // The public R2 bucket does not send CORS headers, so a direct browser
    // fetch would be blocked. Go through the same-origin proxy instead.
    const proxy = `/api/image-proxy?url=${encodeURIComponent(src)}`;
    const res = await fetch(proxy);
    if (!res.ok) return null;
    const { dataUrl } = (await res.json()) as { dataUrl: string };
    return dataUrl || null;
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/**
 * Bottom section identical to the share paper: payment (QRIS + bank boxes) on the
 * left, totals card on the right. Returns the next Y position.
 */
async function drawBottomSection(
  doc: jsPDF,
  payment: PaymentSettings | null,
  totals: ReturnType<typeof computeTotals>,
  taxPct: number,
  discountPct: number,
  startY: number,
): Promise<number> {
  const hasQris = !!payment?.qrisImage;
  const hasBanks = (payment?.bankAccounts?.length ?? 0) > 0;
  const hasPayment = hasQris || hasBanks;

  const w = contentWidth(doc);
  const pageH = pageHeight(doc);

  const totalsW = 76;
  const totalsX = MARGIN + w - totalsW;
  const qrisSize = 57; // share h-52 (208px) ≈ 57mm on A4

  // Payment (left) height
  let leftH = 0;
  if (hasPayment) {
    leftH = 3.2;
    if (hasQris) leftH += 3.2 + qrisSize + 8;
    if (hasBanks) {
      leftH += 3.2;
      const boxH = (payment?.bankAccounts ?? []).some((a) => a.name) ? 12.5 : 10;
      leftH += (payment?.bankAccounts?.length ?? 0) * boxH + (payment?.bankAccounts?.length ?? 0) * 1.5;
    }
  }

  // Totals card (right) height
  const totalsH = 4.4 + 3 * 5 + 1.2 + 5.6 + 4.4;

  const blockH = Math.max(hasPayment ? leftH : 0, totalsH) + 4;

  let y = startY;
  if (y + blockH > pageH - 18) {
    doc.addPage();
    y = 22;
  }

  // ---- Totals card (right) ----
  const cardTop = y + 2;
  doc.setFillColor(...CARD);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, cardTop, totalsW, totalsH - 2, 3, 3, "FD");
  let yy = cardTop + 5.5;
  setFontSafe(doc, "DMSans");
  doc.setFontSize(9);
  doc.setTextColor(...BODY);
  const rows: [string, string][] = [
    ["Subtotal", formatRupiah(totals.subtotal)],
    [`Discount (${discountPct}%)`, `−${formatRupiah(totals.discountAmount)}`],
    [`Tax (${taxPct}%)`, formatRupiah(totals.taxAmount)],
  ];
  for (const [label, value] of rows) {
    doc.text(label, totalsX + 4.4, yy);
    doc.text(value, totalsX + totalsW - 4.4, yy, { align: "right" });
    yy += 5;
  }
  // Total row with top separator (share: border-t, semibold)
  yy += 0.4;
  doc.setDrawColor(...SEP);
  doc.setLineWidth(0.3);
  doc.line(totalsX + 4.4, yy, totalsX + totalsW - 4.4, yy);
  yy += 3.2;
  setFontSafe(doc, "DMSansSemi");
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text("Total", totalsX + 4.4, yy);
  doc.text(formatRupiah(totals.total), totalsX + totalsW - 4.4, yy, { align: "right" });

  // ---- Payment (left) ----
  if (hasPayment) {
    let py = y + 3;
    setFontSafe(doc, "DMSansSemi");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT", MARGIN, py);
    py += 3.2;

    if (hasQris) {
      setFontSafe(doc, "DMSansSemi");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text("Scan QRIS to pay", MARGIN, py);
      py += 2.4;
      const dataUrl = await loadImageDataUrl(payment?.qrisImage ?? "");
      if (dataUrl) {
        try {
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.3);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(MARGIN, py, qrisSize, qrisSize, 2, 2, "FD");
          // Fit the image inside the box preserving its aspect ratio
          // (like the share paper's object-contain) — never stretch it.
          const props = doc.getImageProperties(dataUrl);
          const boxInner = qrisSize - 2;
          const scale = Math.min(boxInner / (props.width || 1), boxInner / (props.height || 1));
          const drawW = (props.width || 1) * scale;
          const drawH = (props.height || 1) * scale;
          const dx = MARGIN + 1 + (boxInner - drawW) / 2;
          const dy = py + 1 + (boxInner - drawH) / 2;
          doc.addImage(dataUrl, imageFormat(dataUrl), dx, dy, drawW, drawH);
        } catch {
          // image could not be embedded — skip silently
        }
      }
      py += qrisSize + 8;
    }

    if (hasBanks) {
      setFontSafe(doc, "DMSansSemi");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text("Bank transfer", MARGIN, py);
      py += 2.4;
      const boxW = 100;
      for (const account of payment?.bankAccounts ?? []) {
        const boxH = account.name ? 12.5 : 10;
        doc.setFillColor(...CARD);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(MARGIN, py, boxW, boxH, 2, 2, "FD");
        setFontSafe(doc, "DMSansSemi");
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text((account.bank || "Bank").toUpperCase(), MARGIN + 3, py + 3.4);
        setFontSafe(doc, "SpaceMono", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text(account.number, MARGIN + 3, py + 7);
        if (account.name) {
          setFontSafe(doc, "DMSans");
          doc.setFontSize(7.5);
          doc.setTextColor(...PRICE);
          doc.text(account.name, MARGIN + 3, py + 10.6);
        }
        py += boxH + 1.5;
      }
    }
  }

  return y + blockH + 4;
}

export async function buildCustomerPdf(customer: Customer): Promise<jsPDF> {
  refreshTheme();
  const doc = new jsPDF();
  await ensureFonts(doc);
  drawHeader(doc, "CUSTOMER PROFILE", customer.name);
  let y = 44;
  y = sectionTitle(doc, y, "Customer details");
  y = infoCard(doc, y, [
    { label: "Name", value: customer.name },
    { label: "Business", value: customer.businessName },
    { label: "Domain", value: customer.domain || "—" },
    { label: "Email", value: customer.email },
    { label: "Phone", value: formatPhones(customer.phones) },
    { label: "Status", value: customer.status },
    { label: "Customer since", value: formatDate(customer.createdAt) },
  ]);
  y = sectionTitle(doc, y, "Address");
  y = infoCard(doc, y, [{ label: "Address", value: customer.address }]);
  if (customer.notes) {
    y = sectionTitle(doc, y, "Notes");
    notesBlock(doc, y, customer.notes);
  }
  drawFooter(doc);
  return doc;
}

export async function buildInvoicePdf(invoice: Invoice, customer?: Customer, payment?: PaymentSettings | null): Promise<jsPDF> {
  refreshTheme();
  const doc = new jsPDF();
  await ensureFonts(doc);
  drawHeader(doc, "INVOICE", invoice.number);
  let y = 29;
  y = docInfoCard(doc, y, "invoice", invoice, customer);
  y = itemsTable(doc, invoice.items, y);
  y = await drawBottomSection(doc, payment ?? null, computeTotals(invoice.items, invoice.discount, invoice.tax), invoice.tax, invoice.discount, y);
  if (invoice.notes) {
    notesBlock(doc, y + 2, invoice.notes);
  }
  drawFooter(doc);
  return doc;
}

export async function buildQuotePdf(quote: Quote, customer?: Customer): Promise<jsPDF> {
  refreshTheme();
  const doc = new jsPDF();
  await ensureFonts(doc);
  drawHeader(doc, "QUOTE", quote.number);
  let y = 29;
  y = docInfoCard(doc, y, "quote", quote, customer);
  y = itemsTable(doc, quote.items, y);
  // Quotes are pre-agreement documents — no payment section (QRIS/rekening).
  y = await drawBottomSection(doc, null, computeTotals(quote.items, quote.discount, quote.tax), quote.tax, quote.discount, y);
  if (quote.notes) {
    notesBlock(doc, y + 2, quote.notes);
  }
  drawFooter(doc);
  return doc;
}

export async function buildProductPdf(product: Product): Promise<jsPDF> {
  refreshTheme();
  const doc = new jsPDF();
  await ensureFonts(doc);
  drawHeader(doc, "PRODUCT", product.name);
  let y = 44;
  y = sectionTitle(doc, y, "Product info");
  y = infoCard(doc, y, [
    { label: "Name", value: product.name },
    { label: "Price", value: formatRupiah(product.price) },
    { label: "Promo", value: product.promo ? "Yes" : "No" },
    { label: "Discount", value: product.promo ? `${product.discount}%` : "—" },
    { label: "Tax", value: `${product.tax}%` },
    { label: "Final price", value: `${formatRupiah(productEffectivePrice(product))}${product.promo ? " (after discount)" : ""}` },
  ]);
  if (product.detail) {
    y = sectionTitle(doc, y, "Details");
    notesBlock(doc, y, product.detail);
  }
  drawFooter(doc);
  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function printPdf(doc: jsPDF) {
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}
