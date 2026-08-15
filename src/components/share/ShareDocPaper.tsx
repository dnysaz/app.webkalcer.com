"use client";

import type { Customer, Invoice, PaymentSettings, Quote } from "@/lib/crm";
import { computeTotals, formatDate, formatPhones, formatRupiah } from "@/lib/crm";

const statusTone: Record<string, string> = {
  Draft: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Process: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Done: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

export function ShareDocPaper({
  docType,
  doc,
  customer,
  payment,
}: {
  docType: "invoice" | "quote";
  doc: Invoice | Quote;
  customer?: Customer;
  payment?: PaymentSettings | null;
}) {
  const totals = computeTotals(doc.items, doc.discount, doc.tax);
  const isInvoice = docType === "invoice";
  const docTitle = isInvoice ? "INVOICE" : "QUOTE";
  const dateLabel = isInvoice ? "Due date" : "Valid until";
  const dateValue = isInvoice ? (doc as Invoice).dueDate : (doc as Quote).validUntil;

  return (
    <div className="flex w-full max-w-3xl flex-col rounded-sm border border-(--crm-border) bg-(--crm-panel) shadow-[0_12px_40px_rgba(32,54,49,.12)] sm:aspect-[210/297]">
      {/* Header band */}
      <div className="flex items-center justify-between bg-(--crm-primary) px-7 py-5 sm:px-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/70">Webkalcer CRM</p>
          <p className="mt-1 text-sm font-semibold text-white">webkalcer.com</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tracking-[-.02em] text-white">{docTitle}</p>
          <p className="mt-0.5 text-xs text-white/75">{doc.number}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-7 py-8 sm:px-10">
        {/* Info card */}
        <div className="rounded-lg border border-(--crm-border-input) bg-(--crm-surface) p-5">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Bill to</p>
              <p className="mt-1 text-sm font-semibold text-(--crm-fg)">{customer?.name ?? "—"}{customer?.businessName ? ` · ${customer.businessName}` : ""}</p>
              {customer?.email && <p className="mt-0.5 text-xs text-(--crm-body)">{customer.email}</p>}
              {customer && formatPhones(customer.phones) && <p className="mt-0.5 text-xs text-(--crm-body)">{formatPhones(customer.phones)}</p>}
              {customer?.address && <p className="mt-0.5 text-xs text-(--crm-body)">{customer.address}</p>}
            </div>
            <div className="sm:text-right">
              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[doc.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{doc.status}</span>
            </div>
            <div className="sm:col-span-2 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Issue date" value={formatDate(doc.issueDate)} />
              <Field label={dateLabel} value={formatDate(dateValue)} />
              <Field label="Customer" value={customer?.code || "—"} mono />
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="mt-6 overflow-hidden rounded-lg border border-(--crm-border-input)">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-(--crm-primary) text-[10px] font-semibold uppercase tracking-[.12em] text-white">
                <th className="px-4 py-2.5">Item / Service</th>
                <th className="px-4 py-2.5 text-center">Qty</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item) => (
                <tr key={item.id} className="border-t border-(--crm-border-soft)">
                  <td className="px-4 py-2.5 text-sm text-(--crm-fg)">{item.name}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-(--crm-secondary)">{item.qty}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-(--crm-secondary)">{formatRupiah(item.price)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold text-(--crm-fg)">{formatRupiah(item.qty * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment + Totals — payment (QRIS/rekening) only applies to invoices */}
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <PaymentSection payment={isInvoice ? payment : null} />
          <div className="w-full max-w-[280px] space-y-1.5 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) p-4 text-xs text-(--crm-body)">
            <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></p>
            <p className="flex justify-between"><span>Discount ({doc.discount}%)</span><span>−{formatRupiah(totals.discountAmount)}</span></p>
            <p className="flex justify-between"><span>Tax ({doc.tax}%)</span><span>{formatRupiah(totals.taxAmount)}</span></p>
            <p className="flex justify-between border-t border-(--crm-border) pt-2 text-sm font-semibold text-(--crm-fg)"><span>Total</span><span>{formatRupiah(totals.total)}</span></p>
          </div>
        </div>

        {/* Notes */}
        {doc.notes && (
          <div className="mt-5 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Notes</p>
            <p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{doc.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-(--crm-border-soft) pt-4">
          <p className="text-[10px] text-(--crm-muted)">Generated by webkalcerCRM · CRM by webkalcer.com</p>
          <p className="text-[10px] text-(--crm-muted)">{formatDate(new Date().toISOString())}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentSection({ payment }: { payment?: PaymentSettings | null }) {
  const hasQris = !!payment?.qrisImage;
  const hasBanks = !!payment?.bankAccounts?.length;
  if (!hasQris && !hasBanks) return null;
  return (
    <div className="w-full sm:max-w-[380px]">
      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Payment</p>
      {hasQris && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-(--crm-fg)">Scan QRIS to pay</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR codes must never be re-encoded by next/image or they break scanning */}
          <img src={payment?.qrisImage} alt="QRIS" className="mt-2 h-52 w-52 rounded-md border border-(--crm-border-input) bg-(--crm-surface) object-contain p-2" />
        </div>
      )}
      {hasBanks && (
        <div className={`space-y-1.5 ${hasQris ? "mt-3" : "mt-2"}`}>
          <p className="text-[11px] font-semibold text-(--crm-fg)">Bank transfer</p>
          {payment?.bankAccounts.map((account) => (
            <div key={account.id} className="rounded-md border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-(--crm-label)">{account.bank || "Bank"}</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-(--crm-fg)">{account.number}</p>
              {account.name && <p className="mt-0.5 text-[10px] text-(--crm-secondary)">{account.name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">{label}</p>
      <p className={`mt-0.5 text-sm text-(--crm-fg) ${mono ? "font-mono text-(--crm-fg)" : ""}`}>{value}</p>
    </div>
  );
}
