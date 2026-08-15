import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader (no dotenv dependency). Runs before setupDatabase
// so DATABASE_URL is available when getSql() is first called.
const envPath = resolve(process.cwd(), ".env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  console.error("Could not read .env.local — make sure you run this from the project root.");
  process.exit(1);
}

import { setupDatabase } from "../src/lib/setup";
import { query } from "../src/lib/db";

const SEED_CUSTOMER_IDS = ["c1", "c2", "c3", "c4", "c5"];
const SEED_INVOICE_IDS = ["i1", "i2", "i3", "i4", "i5"];
const SEED_QUOTE_IDS = ["q1", "q2", "q3", "q4", "q5"];

/** Cust ID: webk-<4 digit date (MMDD) of created_at>. */
const codeFromDate = (createdAt: string) => {
  const d = new Date(createdAt);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `webk-${mm}${dd}`;
};

const yearOf = (dateStr: string) => String(new Date(dateStr).getFullYear());
const pad3 = (n: number) => String(n).padStart(3, "0");

async function main() {
  console.log("Running database setup + seed...");
  const counts = await setupDatabase();
  console.log("Setup done. Table counts:", counts);

  // ---- Customers: recompute codes from created_at ----
  const customers = await query<{ id: string; created_at: string }>`
    SELECT id, created_at FROM customers WHERE id = ANY(${SEED_CUSTOMER_IDS})`;
  const customerCodes = new Map<string, string>();
  for (const customer of customers) {
    const code = codeFromDate(customer.created_at);
    customerCodes.set(customer.id, code);
    await query`UPDATE customers SET code = ${code} WHERE id = ${customer.id}`;
    console.log(`  customer ${customer.id} -> ${code}`);
  }

  // ---- Invoices: INV-<cust code>-<year>-<seq per customer-year> ----
  const invoices = await query<{ id: string; customer_id: string; issue_date: string }>`
    SELECT id, customer_id, issue_date FROM invoices WHERE id = ANY(${SEED_INVOICE_IDS})`;
  const invoiceSeq = new Map<string, number>();
  for (const invoice of invoices.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const key = `${invoice.customer_id}-${yearOf(invoice.issue_date)}`;
    const seq = (invoiceSeq.get(key) ?? 0) + 1;
    invoiceSeq.set(key, seq);
    const number = `INV-${customerCodes.get(invoice.customer_id) ?? ""}-${yearOf(invoice.issue_date)}-${pad3(seq)}`;
    await query`UPDATE invoices SET number = ${number} WHERE id = ${invoice.id}`;
    console.log(`  invoice ${invoice.id} -> ${number}`);
  }

  // ---- Quotes: OFF-<cust code>-<year>-<seq per customer-year> ----
  const quotes = await query<{ id: string; customer_id: string; issue_date: string }>`
    SELECT id, customer_id, issue_date FROM quotes WHERE id = ANY(${SEED_QUOTE_IDS})`;
  const quoteSeq = new Map<string, number>();
  for (const quote of quotes.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const key = `${quote.customer_id}-${yearOf(quote.issue_date)}`;
    const seq = (quoteSeq.get(key) ?? 0) + 1;
    quoteSeq.set(key, seq);
    const number = `OFF-${customerCodes.get(quote.customer_id) ?? ""}-${yearOf(quote.issue_date)}-${pad3(seq)}`;
    await query`UPDATE quotes SET number = ${number} WHERE id = ${quote.id}`;
    console.log(`  quote ${quote.id} -> ${number}`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
