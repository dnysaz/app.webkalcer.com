import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { query, rowToCustomer, rowToInvoice, rowToPaymentSettings, rowToQuote } from "@/lib/db";
import type { CustomerRow, InvoiceRow, PaymentSettingsRow, QuoteRow } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/rate-limit";

type ShareRow = { doc_type: string; doc_id: string };

/** Returns a 401/429 response, counting only failed passcode attempts. */
function rejectInvalidPasscode(request: Request, token: string): NextResponse {
  const limiter = rateLimit(`share:${token}:${clientKey(request)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }
  return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shares = await query<ShareRow>`SELECT doc_type, doc_id FROM shares WHERE token = ${token}`;
  const share = shares[0];
  if (!share) return NextResponse.json({ error: "Share link not found" }, { status: 404 });

  const paymentRows = await query<PaymentSettingsRow>`SELECT id, qris_image, bank_accounts FROM payment_settings WHERE id = 'site' LIMIT 1`;
  const payment = paymentRows[0] ? rowToPaymentSettings(paymentRows[0]) : null;

  const body = (await request.json()) as { passcode?: string };
  const passcode = String(body.passcode ?? "").trim().toLowerCase();

  if (share.doc_type === "invoice") {
    const rows = await query<InvoiceRow>`SELECT * FROM invoices WHERE id = ${share.doc_id}`;
    const invoice = rows[0];
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const customers = await query<CustomerRow>`SELECT * FROM customers WHERE id = ${invoice.customer_id}`;
    const customer = customers[0];
    const expected = (customer?.code ?? "").toLowerCase();
    if (!expected || passcode !== expected) return rejectInvalidPasscode(request, token);
    return NextResponse.json({
      docType: "invoice",
      doc: rowToInvoice(invoice),
      customer: customer ? rowToCustomer(customer) : undefined,
      payment,
    });
  }

  const rows = await query<QuoteRow>`SELECT * FROM quotes WHERE id = ${share.doc_id}`;
  const quote = rows[0];
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const customers = await query<CustomerRow>`SELECT * FROM customers WHERE id = ${quote.customer_id}`;
  const customer = customers[0];
  const expected = (customer?.code ?? "").toLowerCase();
  if (!expected || passcode !== expected) return rejectInvalidPasscode(request, token);
  return NextResponse.json({
    docType: "quote",
    doc: rowToQuote(quote),
    customer: customer ? rowToCustomer(customer) : undefined,
    payment,
  });
}
