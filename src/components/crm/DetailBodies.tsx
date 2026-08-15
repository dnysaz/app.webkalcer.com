"use client";

import type { ReactNode } from "react";
import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Customer, CustomerStatus, Invoice, InvoiceItem, Quote } from "@/lib/crm";
import { computeTotals, formatDate, formatRupiah } from "@/lib/crm";

// Status tone maps — same values used across pages & dashboard.
export const statusTone: Record<string, string> = {
  Draft: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Process: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Done: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
  Prospect: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Suspend: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Inactive: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

export const avatarTone: Record<string, string> = {
  Prospect: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Active: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Suspend: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Cancel: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Inactive: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
};

export function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function InfoRow({ icon: Icon, label, value, badge, mono }: { icon: typeof Mail; label: string; value: string; badge?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-soft) text-(--crm-brand)"><Icon size={14} /></div>
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p>{badge ? <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusTone[value as CustomerStatus]}`}>{value}</span> : <p className={`mt-0.5 break-words text-sm text-(--crm-body) ${mono ? "font-mono text-(--crm-fg)" : ""}`}>{value}</p>}</div>
    </div>
  );
}

export function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-(--crm-body)">{value}</p>
    </div>
  );
}

/** Customer detail body — identical to the Customers page drawer. */
export function CustomerDetailBody({ customer, onCopy }: { customer: Customer; onCopy: (code: string) => void }) {
  return (
    <>
      <div className="flex items-center gap-4"><div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${avatarTone[customer.status]}`}>{initials(customer.name)}</div><div><h3 className="text-xl font-semibold">{customer.name}</h3><p className="mt-0.5 text-sm text-(--crm-secondary)">{customer.businessName || "No business"}</p><button onClick={() => { void navigator.clipboard?.writeText(customer.code); onCopy(customer.code); }} className="mt-1.5 rounded-md bg-(--crm-hover) px-2 py-0.5 font-mono text-[11px] font-medium text-(--crm-fg) transition-colors hover:bg-(--crm-hover)" title="Click to copy">{customer.code} · copy</button></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {customer.phones.length > 0 ? (
          <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Phone</p><div className="mt-1.5 flex flex-wrap gap-1.5">{customer.phones.map((p, i) => <span key={i} className="rounded-full bg-(--crm-soft) px-2.5 py-1 text-xs font-medium text-(--crm-brand)">{p}</span>)}</div></div>
        ) : (
          <InfoRow icon={Phone} label="Phone" value="—" />
        )}
        <InfoRow icon={Globe} label="Domain" value={customer.domain || "—"} />
        <InfoRow icon={Mail} label="Email" value={customer.email || "—"} />
        <InfoRow icon={Building2} label="Status" value={customer.status} badge />
        <div className="sm:col-span-2"><InfoRow icon={MapPin} label="Address" value={customer.address || "—"} /></div>
      </div>
      <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Notes</p><p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{customer.notes || "No notes yet."}</p></div>
      <p className="mt-4 text-[11px] text-(--crm-faint)">Customer since {formatDate(customer.createdAt)}</p>
    </>
  );
}

/** Invoice detail body — identical to the Invoices page drawer. */
export function InvoiceDetailBody({ invoice, customer }: { invoice: Invoice; customer?: Customer }) {
  const totals = computeTotals(invoice.items, invoice.discount, invoice.tax);
  return (
    <>
      <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Customer</p><p className="mt-0.5 text-sm font-semibold text-(--crm-fg)">{customer?.name ?? "—"} — {customer?.businessName ?? ""}</p><p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">Cust ID · {customer?.code ?? "—"}</p>{customer?.domain && <p className="mt-0.5 flex items-center gap-1 text-xs text-(--crm-secondary)"><Globe size={11} className="text-(--crm-faint)" />{customer.domain}</p>}<p className="mt-0.5 text-xs text-(--crm-secondary)">{customer?.address ?? ""}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[invoice.status]}`}>{invoice.status}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBox label="Issue date" value={formatDate(invoice.issueDate)} />
        <InfoBox label="Due date" value={formatDate(invoice.dueDate)} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-(--crm-border)">
        <table className="w-full text-left">
          <thead><tr className="bg-(--crm-surface) text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-4 py-3">Item</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
          <tbody>{invoice.items.map((item) => <tr key={item.id} className="border-t border-(--crm-border-soft)"><td className="px-4 py-3 text-sm">{item.name}</td><td className="px-4 py-3 text-xs text-(--crm-muted)">{item.qty}</td><td className="px-4 py-3 text-right text-xs text-(--crm-muted)">{formatRupiah(item.price)}</td><td className="px-4 py-3 text-right text-sm font-semibold">{formatRupiah(item.qty * item.price)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4 text-xs text-(--crm-secondary)">
        <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></p>
        <p className="flex justify-between"><span>Discount</span><span>−{formatRupiah(totals.discountAmount)}</span></p>
        <p className="flex justify-between"><span>Tax ({invoice.tax}%)</span><span>{formatRupiah(totals.taxAmount)}</span></p>
        <p className="flex justify-between border-t border-(--crm-border-soft) pt-1.5 text-sm font-semibold text-(--crm-fg)"><span>Total</span><span>{formatRupiah(totals.total)}</span></p>
      </div>
      {invoice.notes && <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Notes</p><p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{invoice.notes}</p></div>}
    </>
  );
}

/** Quote detail body — identical to the Quotes page drawer. */
export function QuoteDetailBody({ quote, customer }: { quote: Quote; customer?: Customer }) {
  const totals = computeTotals(quote.items, quote.discount, quote.tax);
  return (
    <>
      <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Customer</p><p className="mt-0.5 text-sm font-semibold text-(--crm-fg)">{customer?.name ?? "—"} — {customer?.businessName ?? ""}</p><p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">Cust ID · {customer?.code ?? "—"}</p>{customer?.domain && <p className="mt-0.5 flex items-center gap-1 text-xs text-(--crm-secondary)"><Globe size={11} className="text-(--crm-faint)" />{customer.domain}</p>}<p className="mt-0.5 text-xs text-(--crm-secondary)">{customer?.address ?? ""}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[quote.status]}`}>{quote.status}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBox label="Quote date" value={formatDate(quote.issueDate)} />
        <InfoBox label="Valid until" value={formatDate(quote.validUntil)} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-(--crm-border)">
        <table className="w-full text-left">
          <thead><tr className="bg-(--crm-surface) text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-4 py-3">Item</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
          <tbody>{quote.items.map((item) => <tr key={item.id} className="border-t border-(--crm-border-soft)"><td className="px-4 py-3 text-sm">{item.name}</td><td className="px-4 py-3 text-xs text-(--crm-muted)">{item.qty}</td><td className="px-4 py-3 text-right text-xs text-(--crm-muted)">{formatRupiah(item.price)}</td><td className="px-4 py-3 text-right text-sm font-semibold">{formatRupiah(item.qty * item.price)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4 text-xs text-(--crm-secondary)">
        <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></p>
        <p className="flex justify-between"><span>Discount</span><span>−{formatRupiah(totals.discountAmount)}</span></p>
        <p className="flex justify-between"><span>Tax ({quote.tax}%)</span><span>{formatRupiah(totals.taxAmount)}</span></p>
        <p className="flex justify-between border-t border-(--crm-border-soft) pt-1.5 text-sm font-semibold text-(--crm-fg)"><span>Total</span><span>{formatRupiah(totals.total)}</span></p>
      </div>
      {quote.notes && <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Notes</p><p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{quote.notes}</p></div>}
    </>
  );
}

/** Item table used by invoice/quote edit generators — shared so the markup stays consistent. */
export function DetailItemRow({ item, index }: { item: InvoiceItem; index: number }) {
  return (
    <>
      <td className="px-3 py-2 text-xs font-medium text-(--crm-muted)">{index + 1}</td>
      <td className="px-3 py-2 text-sm font-medium text-(--crm-fg)">{item.name}</td>
      <td className="px-3 py-2 text-center text-xs text-(--crm-muted)">{item.qty}</td>
      <td className="px-3 py-2 text-right text-xs text-(--crm-muted)">{formatRupiah(item.price)}</td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-(--crm-fg)">{formatRupiah(item.qty * item.price)}</td>
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{children}</p>;
}
