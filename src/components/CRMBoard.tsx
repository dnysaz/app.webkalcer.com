"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  DollarSign,
  FileText,
  MoreHorizontal,
  Package,
  ScrollText,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { useSettings } from "@/components/SettingsProvider";
import { useAuth } from "@/components/AuthProvider";
import { RightDrawer } from "@/components/crm/RightDrawer";
import { PdfActions } from "@/components/crm/PdfActions";
import { ShareButton } from "@/components/crm/ShareLinkModal";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { usePaymentSettings } from "@/components/crm/usePaymentSettings";
import { CustomerDetailBody, InvoiceDetailBody, QuoteDetailBody } from "@/components/crm/DetailBodies";
import type { Customer, Invoice, Quote } from "@/lib/crm";
import { computeTotals, formatDate, formatDateLong, formatRupiahShort, nextNumber, uid } from "@/lib/crm";
import { buildCustomerPdf, buildInvoicePdf, buildQuotePdf } from "@/lib/pdf";

const stageTone: Record<string, string> = {
  Prospect: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Suspend: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Inactive: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

const avatarTone: Record<string, string> = {
  Prospect: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Active: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Suspend: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Cancel: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Inactive: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
};

const docStatusTone: Record<string, string> = {
  Draft: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Process: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Done: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

function StatCard({ label, value, badge, note, icon: Icon, accent }: { label: string; value: string; badge: string; note: string; icon: typeof DollarSign; accent: string }) {
  return (
    <div className="group rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 shadow-[0_8px_30px_rgba(32,54,49,.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(32,54,49,.09)]">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}><Icon size={18} strokeWidth={2.2} /></div>
        <span className="rounded-full bg-(--crm-st-done-bg) px-2 py-1 text-[11px] font-semibold text-(--crm-st-done-text)">{badge}</span>
      </div>
      <p className="mt-5 text-[12px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">{label}</p>
      <p className="mt-1 text-[28px] font-semibold tracking-[-.04em] text-(--crm-fg)">{value}</p>
      <p className="mt-1 text-xs text-(--crm-muted)">{note}</p>
    </div>
  );
}

export function CRMBoard() {
  const { customers, invoices, quotes, products, deleteCustomer, deleteInvoice, deleteQuote, addInvoice, updateQuote } = useCrm();
  const { settings } = useSettings();
  const { session } = useAuth();
  const router = useRouter();
  const siteName = settings.siteName;
  const adminName = session.status === "authed" && session.name ? session.name : "Admin";
  const [chartSource, setChartSource] = useState<"invoices" | "quotes">("invoices");
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Customer | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<Quote | null>(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<Customer | null>(null);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<Invoice | null>(null);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState<Quote | null>(null);
  const [confirmProcessQuote, setConfirmProcessQuote] = useState<Quote | null>(null);
  const [latestTab, setLatestTab] = useState<"customers" | "invoices" | "quotes">("customers");

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const payment = usePaymentSettings();

  const invoiceDetailCustomer = invoiceDetail ? customerById.get(invoiceDetail.customerId) : undefined;
  const invoiceDetailTotals = invoiceDetail ? computeTotals(invoiceDetail.items, invoiceDetail.discount, invoiceDetail.tax) : null;
  const quoteDetailCustomer = quoteDetail ? customerById.get(quoteDetail.customerId) : undefined;
  const quoteDetailTotals = quoteDetail ? computeTotals(quoteDetail.items, quoteDetail.discount, quoteDetail.tax) : null;

  const latestInvoices = useMemo(
    () => [...invoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).slice(0, 6),
    [invoices],
  );
  const latestQuotes = useMemo(
    () => [...quotes].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).slice(0, 6),
    [quotes],
  );

  // ---- Stat cards from real data ----
  const stats = useMemo(() => {
    const activeCount = customers.filter((c) => c.status === "Active").length;
    const doneCount = invoices.filter((i) => i.status === "Done").length;
    const openCount = quotes.filter((q) => q.status === "Active" || q.status === "Process").length;
    const promoCount = products.filter((p) => p.promo).length;
    return {
      customerPct: customers.length > 0 ? Math.round((activeCount / customers.length) * 100) : 0,
      invoiceDonePct: invoices.length > 0 ? Math.round((doneCount / invoices.length) * 100) : 0,
      quoteOpenPct: quotes.length > 0 ? Math.round((openCount / quotes.length) * 100) : 0,
      promoPct: products.length > 0 ? Math.round((promoCount / products.length) * 100) : 0,
    };
  }, [customers, invoices, quotes, products]);

  const totalInvoiceValue = useMemo(() => invoices.reduce((sum, i) => sum + computeTotals(i.items, i.discount, i.tax).total, 0), [invoices]);
  const doneInvoiceValue = useMemo(() => invoices.filter((i) => i.status === "Done").reduce((sum, i) => sum + computeTotals(i.items, i.discount, i.tax).total, 0), [invoices]);
  const openQuoteValue = useMemo(() => quotes.filter((q) => q.status === "Active" || q.status === "Process").reduce((sum, q) => sum + computeTotals(q.items, q.discount, q.tax).total, 0), [quotes]);

  // ---- Pipeline chart: monthly revenue for last 6 months ----
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short" }) };
    });
  }, []);

  const chartData = useMemo(() => {
    const source = chartSource === "invoices" ? invoices : quotes;
    const rows = months.map((m) => ({ ...m, committed: 0, won: 0, count: 0 }));
    for (const doc of source) {
      const key = doc.issueDate.slice(0, 7);
      const row = rows.find((r) => r.key === key);
      if (!row) continue;
      const total = computeTotals(doc.items, doc.discount, doc.tax).total;
      if (doc.status === "Cancel") continue;
      row.count += 1;
      if (doc.status === "Done") row.won += total;
      else row.committed += total;
    }
    const maxValue = Math.max(1, ...rows.map((r) => r.committed + r.won));
    return { rows, maxValue };
  }, [months, chartSource, invoices, quotes]);

  const chartTotals = useMemo(() => {
    const source = chartSource === "invoices" ? invoices : quotes;
    const total = source.reduce((sum, doc) => (doc.status === "Cancel" ? sum : sum + computeTotals(doc.items, doc.discount, doc.tax).total), 0);
    const won = source.filter((doc) => doc.status === "Done").reduce((sum, doc) => sum + computeTotals(doc.items, doc.discount, doc.tax).total, 0);
    return { total, won };
  }, [chartSource, invoices, quotes]);

  // ---- Activity feed from real latest records ----
  const activities = useMemo(() => {
    type Item = { key: string; icon: typeof Check; title: string; detail: string; time: string; color: string; date: number };
    const items: Item[] = [];
    for (const c of customers) {
      items.push({ key: `c-${c.id}`, icon: UserRound, title: "New customer", detail: `${c.name} · ${c.businessName || c.email}`, time: timeAgo(c.createdAt), color: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)", date: new Date(c.createdAt).getTime() });
    }
    for (const inv of invoices) {
      const cust = customerById.get(inv.customerId);
      const total = computeTotals(inv.items, inv.discount, inv.tax).total;
      items.push({ key: `i-${inv.id}`, icon: FileText, title: `Invoice ${inv.number}`, detail: `${cust?.name ?? "Customer"} · ${formatRupiahShort(total)}`, time: timeAgo(inv.issueDate), color: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)", date: new Date(inv.issueDate).getTime() });
    }
    for (const q of quotes) {
      const cust = customerById.get(q.customerId);
      const total = computeTotals(q.items, q.discount, q.tax).total;
      items.push({ key: `q-${q.id}`, icon: ScrollText, title: `Quote ${q.number}`, detail: `${cust?.name ?? "Customer"} · ${formatRupiahShort(total)}`, time: timeAgo(q.issueDate), color: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)", date: new Date(q.issueDate).getTime() });
    }
    for (const p of products) {
      items.push({ key: `p-${p.id}`, icon: Package, title: "Product added", detail: `${p.name} · ${formatRupiahShort(p.price)}`, time: timeAgo(p.createdAt), color: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)", date: new Date(p.createdAt).getTime() });
    }
    return items.sort((a, b) => b.date - a.date).slice(0, 6);
  }, [customers, invoices, quotes, products, customerById]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  /** Convert an approved quote into an invoice — same behavior as the Quotes page. */
  function processToInvoice(quote: Quote) {
    const number = nextNumber("INV", invoices.map((i) => i.number));
    const invoice = {
      id: uid(),
      number,
      customerId: quote.customerId,
      items: quote.items.map((item) => ({ ...item })),
      discount: quote.discount,
      tax: quote.tax,
      status: "Active" as const,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: quote.notes ? `From quote ${quote.number}. ${quote.notes}` : `From quote ${quote.number}.`,
    };
    addInvoice(invoice);
    updateQuote({ ...quote, status: "Done" });
    setConfirmProcessQuote(null);
    setQuoteDetail(null);
    announce(`Invoice ${number} created from quote ${quote.number}`);
  }

  const today = formatDateLong(new Date().toISOString());

  return (      <CrmShell title={`${greeting()}, ${adminName}`} subtitle={today}>
      <section className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-[30px] font-semibold tracking-[-.05em] sm:text-[36px]">Revenue overview</h2><p className="mt-1 text-sm text-(--crm-secondary)">Live summary from customers, invoices, quotes, and products.</p></div><div className="flex items-center gap-2"><button onClick={() => announce("Dashboard options opened")} className="rounded-xl border border-(--crm-border) bg-(--crm-panel) p-2.5 text-(--crm-secondary) hover:bg-(--crm-hover)" aria-label="More options"><MoreHorizontal size={18} /></button></div></section>

      <section className="crm-rise crm-delay-1 mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total customers" value={String(customers.length)} badge={`${stats.customerPct}% active`} note={`${customers.filter((c) => c.status === "Active").length} active in database`} icon={Users} accent="bg-(--crm-st-done-bg) text-(--crm-st-done-text)" />
        <StatCard label="Closed revenue" value={formatRupiahShort(doneInvoiceValue)} badge={`${stats.invoiceDonePct}% of ${invoices.length} invoices`} note={`${invoices.filter((i) => i.status === "Done").length} paid · ${formatRupiahShort(totalInvoiceValue)} total billed`} icon={DollarSign} accent="bg-(--crm-st-process-bg) text-(--crm-st-process-text)" />
        <StatCard label="Open quotes" value={formatRupiahShort(openQuoteValue)} badge={`${stats.quoteOpenPct}% open`} note={`${quotes.filter((q) => q.status === "Active" || q.status === "Process").length} of ${quotes.length} quotes`} icon={ScrollText} accent="bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)" />
        <StatCard label="Products" value={String(products.length)} badge={`${stats.promoPct}% promo`} note={`${products.filter((p) => p.promo).length} on promo · ${formatRupiahShort(products.reduce((sum, p) => sum + p.price, 0))} catalog`} icon={Package} accent="bg-(--crm-st-active-bg) text-(--crm-st-active-text)" />
      </section>

      <section className="crm-rise crm-delay-2 mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-semibold tracking-[-.02em]">Revenue by month</h3><p className="mt-1 text-xs text-(--crm-muted)">Last 6 months, {chartSource === "invoices" ? "invoices" : "quotes"} grouped by status</p></div><div className="flex rounded-lg border border-(--crm-border) bg-(--crm-surface) p-0.5">{(["invoices", "quotes"] as const).map((option) => <button key={option} onClick={() => setChartSource(option)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors capitalize ${chartSource === option ? "bg-(--crm-focus-ring) text-(--crm-primary) shadow-sm" : "text-(--crm-muted)"}`}>{option}</button>)}</div></div><div className="mt-7 flex h-[190px] items-end gap-3 border-b border-l border-(--crm-border) px-3 pb-0 pt-3 sm:gap-7 sm:px-5">{chartData.rows.map((row) => { const committedPct = Math.round((row.committed / chartData.maxValue) * 100); const wonPct = Math.round((row.won / chartData.maxValue) * 100); const hasValue = row.committed + row.won > 0; return (
          <div key={row.key} className="relative flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
              <div className={`w-full rounded-t-md transition-all ${hasValue ? "bg-(--crm-accent)" : "bg-(--crm-surface)"}`} style={{ height: `${wonPct}%` }} title={formatRupiahShort(row.won)} />
              <div className={`w-full rounded-b-md transition-all ${row.committed > 0 ? "bg-(--crm-chart-committed)" : "bg-(--crm-surface)"}`} style={{ height: `${committedPct}%` }} title={formatRupiahShort(row.committed)} />
            </div>
            <span className="text-[10px] text-(--crm-muted)">{row.label}</span>
          </div>); })}</div><div className="mt-10 flex items-center gap-5 text-[11px] text-(--crm-muted)"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-(--crm-chart-committed)" />Committed</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-(--crm-accent)" />Won</span><span className="ml-auto font-semibold text-(--crm-brand)">{formatRupiahShort(chartTotals.total)} total · {chartTotals.total > 0 ? Math.round((chartTotals.won / chartTotals.total) * 100) : 0}% won</span></div></div>
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-semibold tracking-[-.02em]">Recent activity</h3><p className="mt-1 text-xs text-(--crm-muted)">Latest customers, invoices, quotes & products</p></div><button onClick={() => announce("Activity view selected")} className="text-xs font-semibold text-(--crm-brand) hover:text-(--crm-primary)">View all</button></div><div className="mt-5 space-y-4">{activities.map((item) => { const Icon = item.icon; return <div key={item.key} className="flex gap-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}><Icon size={15} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-(--crm-fg)">{item.title}</p><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{item.detail}</p></div><span className="shrink-0 text-[10px] text-(--crm-muted)">{item.time}</span></div> })}</div></div>
      </section>

      <section className="crm-rise crm-delay-3 mt-5 rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex items-center gap-3 border-b border-(--crm-border) p-5 sm:p-6">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-(--crm-surface) p-1">
            {([["customers", "Latest Customers"], ["invoices", "Latest Invoices"], ["quotes", "Latest Quotes"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setLatestTab(key)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${latestTab === key ? "bg-(--crm-focus-ring) text-(--crm-text) shadow-sm" : "text-(--crm-muted) hover:text-(--crm-body)"}`}>{label}</button>
            ))}
          </div>
        </div>

        {latestTab === "customers" && (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Customer</th><th className="px-4 py-4">Business</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Contact</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setDetail(customer)}><td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone[customer.status] ?? "bg-(--crm-avatar-bg) text-(--crm-avatar-text)"}`}>{initials(customer.name)}</div><div><p className="text-sm font-semibold">{customer.name}</p><p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">{customer.code}</p></div></div></td><td className="px-4 py-4 text-xs text-(--crm-secondary)">{customer.businessName}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${stageTone[customer.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{customer.status}</span></td><td className="px-4 py-4 text-xs text-(--crm-muted)">{customer.email}</td><td className="px-6 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setDetail(customer); }} className="rounded-lg border border-(--crm-border-input) px-3 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">View details</button></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-(--crm-border-soft) md:hidden">{customers.map((customer) => <button key={customer.id} onClick={() => setDetail(customer)} className="flex w-full items-center gap-3 p-4 text-left"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone[customer.status] ?? "bg-(--crm-avatar-bg) text-(--crm-avatar-text)"}`}>{initials(customer.name)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{customer.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageTone[customer.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{customer.status}</span></div><p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">{customer.code}</p><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{customer.businessName}</p></div></button>)}</div>
            {customers.length === 0 && <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No customers yet</p><p className="mt-1 text-xs text-(--crm-muted)">Add your first customer to see it here.</p></div>}
          </>
        )}

        {latestTab === "invoices" && (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Invoice</th><th className="px-4 py-4">Customer</th><th className="px-4 py-4">Total</th><th className="px-4 py-4">Due date</th><th className="px-6 py-4 text-right">Status</th></tr></thead><tbody>{latestInvoices.map((invoice) => { const cust = customerById.get(invoice.customerId); const total = computeTotals(invoice.items, invoice.discount, invoice.tax).total; return <tr key={invoice.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setInvoiceDetail(invoice)}><td className="px-6 py-4"><div className="flex items-center gap-2"><FileText size={15} className="text-(--crm-faint)" /><p className="text-sm font-semibold">{invoice.number}</p></div></td><td className="px-4 py-4"><p className="text-sm font-medium">{cust?.name ?? "—"}</p><p className="mt-0.5 text-[11px] text-(--crm-muted)">{cust?.businessName ?? "—"}</p></td><td className="px-4 py-4 text-sm font-semibold">{formatRupiahShort(total)}</td><td className="px-4 py-4 text-xs text-(--crm-muted)">{formatDate(invoice.dueDate)}</td><td className="px-6 py-4 text-right"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${docStatusTone[invoice.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{invoice.status}</span></td></tr>; })}</tbody></table></div>
            <div className="divide-y divide-(--crm-border-soft) md:hidden">{latestInvoices.map((invoice) => { const cust = customerById.get(invoice.customerId); const total = computeTotals(invoice.items, invoice.discount, invoice.tax).total; return <button key={invoice.id} onClick={() => setInvoiceDetail(invoice)} className="flex w-full items-center gap-3 p-4 text-left"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--crm-surface) text-(--crm-secondary)"><FileText size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{invoice.number}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[invoice.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{invoice.status}</span></div><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{cust?.name ?? "—"} · {formatRupiahShort(total)}</p></div></button>; })}</div>
            {latestInvoices.length === 0 && <div className="p-12 text-center"><FileText size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No invoices yet</p><p className="mt-1 text-xs text-(--crm-muted)">Create your first invoice to see it here.</p></div>}
          </>
        )}

        {latestTab === "quotes" && (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Quote</th><th className="px-4 py-4">Customer</th><th className="px-4 py-4">Total</th><th className="px-4 py-4">Valid until</th><th className="px-6 py-4 text-right">Status</th></tr></thead><tbody>{latestQuotes.map((quote) => { const cust = customerById.get(quote.customerId); const total = computeTotals(quote.items, quote.discount, quote.tax).total; return <tr key={quote.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setQuoteDetail(quote)}><td className="px-6 py-4"><div className="flex items-center gap-2"><ScrollText size={15} className="text-(--crm-faint)" /><p className="text-sm font-semibold">{quote.number}</p></div></td><td className="px-4 py-4"><p className="text-sm font-medium">{cust?.name ?? "—"}</p><p className="mt-0.5 text-[11px] text-(--crm-muted)">{cust?.businessName ?? "—"}</p></td><td className="px-4 py-4 text-sm font-semibold">{formatRupiahShort(total)}</td><td className="px-4 py-4 text-xs text-(--crm-muted)">{formatDate(quote.validUntil)}</td><td className="px-6 py-4 text-right"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${docStatusTone[quote.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{quote.status}</span></td></tr>; })}</tbody></table></div>
            <div className="divide-y divide-(--crm-border-soft) md:hidden">{latestQuotes.map((quote) => { const cust = customerById.get(quote.customerId); const total = computeTotals(quote.items, quote.discount, quote.tax).total; return <button key={quote.id} onClick={() => setQuoteDetail(quote)} className="flex w-full items-center gap-3 p-4 text-left"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--crm-surface) text-(--crm-secondary)"><ScrollText size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{quote.number}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[quote.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{quote.status}</span></div><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{cust?.name ?? "—"} · {formatRupiahShort(total)}</p></div></button>; })}</div>
            {latestQuotes.length === 0 && <div className="p-12 text-center"><ScrollText size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No quotes yet</p><p className="mt-1 text-xs text-(--crm-muted)">Create your first quote to see it here.</p></div>}
          </>
        )}
      </section>
      <p className="mt-6 text-center text-[11px] text-(--crm-faint)">{siteName} · CRM by webkalcer.com</p>
      {detail && (
        <RightDrawer onClose={() => setDetail(null)} eyebrow="Customer details" title={detail.name} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<>
            <PdfActions build={() => buildCustomerPdf(detail)} filename={`${detail.name.replace(/\s+/g, "-").toLowerCase()}.pdf`} />
            <div className="flex-1" />
            <button onClick={() => { setDetail(null); router.push("/customers"); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDeleteCustomer(detail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
          <CustomerDetailBody customer={detail} onCopy={() => announce("Cust ID copied")} />
        </RightDrawer>
      )}
      {invoiceDetail && invoiceDetailTotals && (
        <RightDrawer onClose={() => setInvoiceDetail(null)} eyebrow="Invoice details" title={invoiceDetail.number} widthClass="sm:w-[720px] lg:w-[820px]"
          footer={<>
            {["Active", "Process"].includes(invoiceDetail.status) && <><PdfActions build={() => buildInvoicePdf(invoiceDetail, invoiceDetailCustomer ?? undefined, payment)} filename={`${invoiceDetail.number}.pdf`} /><ShareButton docType="invoice" docId={invoiceDetail.id} customerCode={invoiceDetailCustomer?.code ?? ""} /></>}
            <div className="flex-1" />
            <button onClick={() => { setInvoiceDetail(null); router.push("/invoices"); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDeleteInvoice(invoiceDetail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
          <InvoiceDetailBody invoice={invoiceDetail} customer={invoiceDetailCustomer} />
        </RightDrawer>
      )}

      {quoteDetail && quoteDetailTotals && (
        <RightDrawer onClose={() => setQuoteDetail(null)} eyebrow="Quote details" title={quoteDetail.number} widthClass="sm:w-[720px] lg:w-[820px]"
          footer={<>
            {["Active", "Process"].includes(quoteDetail.status) && <><PdfActions build={() => buildQuotePdf(quoteDetail, quoteDetailCustomer ?? undefined)} filename={`${quoteDetail.number}.pdf`} /><ShareButton docType="quote" docId={quoteDetail.id} customerCode={quoteDetailCustomer?.code ?? ""} /></>}
            <div className="flex-1" />
            {["Active", "Process"].includes(quoteDetail.status) && (
              <button onClick={() => setConfirmProcessQuote(quoteDetail)} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark)" title="Create an invoice from this quote"><FileText size={15} />Process to invoice</button>
            )}
            <button onClick={() => { setQuoteDetail(null); router.push("/quotes"); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDeleteQuote(quoteDetail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
          <QuoteDetailBody quote={quoteDetail} customer={quoteDetailCustomer} />
        </RightDrawer>
      )}

      {confirmDeleteCustomer && (
        <ConfirmModal
          title={`Delete customer "${confirmDeleteCustomer.name}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDeleteCustomer(null)}
          onConfirm={() => { deleteCustomer(confirmDeleteCustomer.id); setConfirmDeleteCustomer(null); setDetail(null); announce("Customer deleted"); }}
        />
      )}
      {confirmDeleteInvoice && (
        <ConfirmModal
          title={`Delete invoice "${confirmDeleteInvoice.number}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDeleteInvoice(null)}
          onConfirm={() => { deleteInvoice(confirmDeleteInvoice.id); setConfirmDeleteInvoice(null); setInvoiceDetail(null); announce(`Invoice ${confirmDeleteInvoice.number} deleted`); }}
        />
      )}
      {confirmDeleteQuote && (
        <ConfirmModal
          title={`Delete quote "${confirmDeleteQuote.number}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDeleteQuote(null)}
          onConfirm={() => { deleteQuote(confirmDeleteQuote.id); setConfirmDeleteQuote(null); setQuoteDetail(null); announce(`Quote ${confirmDeleteQuote.number} deleted`); }}
        />
      )}
      {confirmProcessQuote && (
        <ConfirmModal
          title="Process to invoice?"
          message="An invoice will be created with the same customer, items, and pricing. This quote will be marked as Done."
          confirmLabel="Process to invoice"
          onClose={() => setConfirmProcessQuote(null)}
          onConfirm={() => processToInvoice(confirmProcessQuote)}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}
