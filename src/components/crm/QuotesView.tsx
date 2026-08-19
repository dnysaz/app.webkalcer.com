"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Globe, Package, Plus, ScrollText, Search, Trash2 } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { RightDrawer } from "@/components/crm/RightDrawer";
import { PdfActions } from "@/components/crm/PdfActions";
import { ShareButton } from "@/components/crm/ShareLinkModal";
import { ProductCatalogModal } from "@/components/crm/ProductCatalogModal";
import { WebAssetCatalogModal } from "@/components/crm/WebAssetCatalogModal";
import { CustomerSearch } from "@/components/crm/CustomerSearch";
import { NumberInput } from "@/components/crm/NumberInput";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { QuoteDetailBody, statusTone } from "@/components/crm/DetailBodies";
import type { Quote, InvoiceItem, QuoteStatus, Product, WebAsset } from "@/lib/crm";
import { computeTotals, formatDate, formatRupiah, nextNumber, productEffectivePrice, QUOTE_STATUSES, uid } from "@/lib/crm";
import { buildQuotePdf } from "@/lib/pdf";

type Draft = {
  customerId: string;
  items: InvoiceItem[];
  discount: number;
  tax: number;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  customerId: "",
  items: [],
  discount: 0,
  tax: 11,
  status: "Draft",
  issueDate: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  notes: "",
});

export function QuotesView() {
  const { customers, quotes, invoices, addQuote, updateQuote, deleteQuote, addInvoice } = useCrm();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showGenerator, setShowGenerator] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [detail, setDetail] = useState<Quote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<Quote | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [webAssetCatalog, setWebAssetCatalog] = useState(false);
  const [toast, setToast] = useState("");

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(
    () =>
      quotes.filter((quote) => {
        const customer = customerById.get(quote.customerId);
        const haystack = `${quote.number} ${customer?.name ?? ""} ${customer?.businessName ?? ""} ${customer?.code ?? ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) && (statusFilter === "All" || quote.status === statusFilter);
      }),
    [quotes, query, statusFilter, customerById],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setShowGenerator(true);
  }

  function openEdit(quote: Quote) {
    setEditing(quote);
    setDraft({
      customerId: quote.customerId,
      items: quote.items.map((item) => ({ ...item })),
      discount: quote.discount,
      tax: quote.tax,
      status: quote.status,
      issueDate: quote.issueDate,
      validUntil: quote.validUntil,
      notes: quote.notes,
    });
    setShowGenerator(true);
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setDraft((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  }

  function addFromCatalog(product: Product) {
    setDraft((prev) => ({ ...prev, items: [...prev.items, { id: uid(), name: product.name, qty: 1, price: productEffectivePrice(product) }] }));
    setCatalog(false);
    announce(`${product.name} added to items`);
  }

  function addFromWebAsset(asset: WebAsset) {
    setDraft((prev) => ({ ...prev, items: [...prev.items, { id: uid(), name: asset.name, qty: 1, price: asset.sellPrice > 0 ? asset.sellPrice : asset.price }] }));
    setWebAssetCatalog(false);
    announce(`${asset.type === "domain" ? "Domain" : "Hosting"} ${asset.name} added to items`);
  }

  function save() {
    if (!draft.customerId) { announce("Please select a customer first"); return; }
    const validItems = draft.items.filter((item) => item.name.trim() && item.qty > 0);
    if (validItems.length === 0) { announce("At least one item with a name and quantity is required"); return; }

    if (editing) {
      updateQuote({ ...editing, ...draft, items: validItems });
      announce(`Quote ${editing.number} updated successfully`);
    } else {
      const number = nextNumber("OFF", quotes.map((q) => q.number));
      const quote: Quote = { id: uid(), number, ...draft, items: validItems };
      addQuote(quote);
      announce(`Quote ${number} created successfully`);
    }
    setShowGenerator(false);
  }

  function remove(quote: Quote) {
    deleteQuote(quote.id);
    announce(`Quote ${quote.number} deleted`);
    setDetail(null);
  }

  /** Convert an approved quote into an invoice (copies customer, items, pricing, notes). */
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
    setConfirmProcess(null);
    setDetail(null);
    announce(`Invoice ${number} created from quote ${quote.number}`);
  }

  function cycleStatus(quote: Quote) {
    const idx = QUOTE_STATUSES.indexOf(quote.status);
    const next = QUOTE_STATUSES[(idx + 1) % QUOTE_STATUSES.length];
    updateQuote({ ...quote, status: next });
    announce(`Quote ${quote.number} is now ${next}`);
  }

  const totals = computeTotals(draft.items, draft.discount, draft.tax);
  const selectedCustomer = draft.customerId ? customerById.get(draft.customerId) : null;
  const detailCustomer = detail ? customerById.get(detail.customerId) : null;
  const detailTotals = detail ? computeTotals(detail.items, detail.discount, detail.tax) : null;

  return (
    <CrmShell title="Quotes" subtitle="Quotes & price offers">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Manage quotes</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Create professional quotes for your prospects.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md"><Plus size={16} />Create quote</button>
        </div>
      </div>

      <div className="crm-rise mt-6 rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex flex-col gap-4 border-b border-(--crm-border) p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="font-semibold tracking-[-.02em]">Quote list</h3><p className="mt-1 text-xs text-(--crm-muted)">{filtered.length} of {quotes.length} quotes</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quotes..." className="h-9 w-[200px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2 text-xs font-semibold text-(--crm-secondary) outline-none focus:border-(--crm-focus-border)">
              <option>All</option>
              {QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">No. Quote</th><th className="px-4 py-4">Customer</th><th className="px-4 py-4">Total</th><th className="px-4 py-4">Valid until</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((quote) => {
                const customer = customerById.get(quote.customerId);
                const total = computeTotals(quote.items, quote.discount, quote.tax).total;
                return (
                  <tr key={quote.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setDetail(quote)}>
                    <td className="px-6 py-4"><div className="flex items-center gap-2"><ScrollText size={15} className="text-(--crm-faint)" /><p className="text-sm font-semibold">{quote.number}</p></div></td>
                    <td className="px-4 py-4"><p className="text-sm font-medium">{customer?.name ?? "—"}</p><p className="mt-0.5 text-[11px] text-(--crm-muted)">{customer?.businessName ?? "—"}</p></td>
                    <td className="px-4 py-4 text-sm font-semibold">{formatRupiah(total)}</td>
                    <td className="px-4 py-4 text-xs text-(--crm-muted)">{formatDate(quote.validUntil)}</td>
                    <td className="px-4 py-4"><button onClick={(event) => { event.stopPropagation(); cycleStatus(quote); }} title="Click to change status"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[quote.status]}`}>{quote.status}</span></button></td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-1.5"><button onClick={(event) => { event.stopPropagation(); openEdit(quote); }} className="rounded-lg border border-(--crm-border-input) px-3 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button><button onClick={(event) => { event.stopPropagation(); setConfirmDelete(quote); }} className="rounded-lg border border-(--crm-danger-border) p-1.5 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Delete"><Trash2 size={14} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-(--crm-border-soft) md:hidden">
          {filtered.map((quote) => {
            const customer = customerById.get(quote.customerId);
            const total = computeTotals(quote.items, quote.discount, quote.tax).total;
            return (
              <button key={quote.id} onClick={() => setDetail(quote)} className="w-full p-4 text-left">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{quote.number}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[quote.status]}`}>{quote.status}</span></div>
                <p className="mt-0.5 text-[11px] text-(--crm-muted)">{customer?.name ?? "—"} · {formatRupiah(total)}</p>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No quotes</p><p className="mt-1 text-xs text-(--crm-muted)">Create a new quote to get started.</p></div>}
      </div>

      {detail && detailTotals && (
        <RightDrawer onClose={() => setDetail(null)} eyebrow="Quote details" title={detail.number} widthClass="sm:w-[720px] lg:w-[820px]"
          footer={<>
            {["Active", "Process"].includes(detail.status) && <>
              <PdfActions build={() => buildQuotePdf(detail, detailCustomer ?? undefined)} filename={`${detail.number}.pdf`} />
              <ShareButton docType="quote" docId={detail.id} customerCode={detailCustomer?.code ?? ""} />
            </>}
            <div className="flex-1" />
            {["Active", "Process"].includes(detail.status) && (
              <button onClick={() => setConfirmProcess(detail)} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark)" title="Create an invoice from this quote"><ArrowRightLeft size={15} />Process to invoice</button>
            )}
            <button onClick={() => { openEdit(detail); setDetail(null); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDelete(detail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
          <QuoteDetailBody quote={detail} customer={detailCustomer ?? undefined} />
        </RightDrawer>
      )}

      {showGenerator && (
        <RightDrawer onClose={() => setShowGenerator(false)} eyebrow={`${editing ? "Edit" : "Generate"} quote`} title={editing ? editing.number : "New quote"} widthClass="sm:w-[720px] lg:w-[820px]"
          footer={<><button onClick={() => setShowGenerator(false)} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) hover:bg-(--crm-hover)">Cancel</button><button onClick={save} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--crm-dark)">Save quote</button></>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Customer *</span><CustomerSearch customers={customers} value={draft.customerId} onChange={(id) => setDraft({ ...draft, customerId: id })} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Quote date</span><input type="date" value={draft.issueDate} onChange={(event) => setDraft({ ...draft, issueDate: event.target.value })} className={inputCls} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Valid until</span><input type="date" value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })} className={inputCls} /></label>
            </div>

            <div className="mt-5"><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Quote items</p><div className="flex items-center gap-1.5"><button onClick={() => setCatalog(true)} className="flex items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)"><Package size={12} />Catalog</button><button onClick={() => setWebAssetCatalog(true)} className="flex items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)"><Globe size={12} />Domain/Hosting</button><button onClick={() => setDraft({ ...draft, items: [...draft.items, { id: uid(), name: "", qty: 1, price: 0 }] })} className="flex items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)"><Plus size={12} />Add item</button></div></div>
              <div className="overflow-x-auto rounded-xl border border-(--crm-border)">
                <table className="w-full text-left">
                  <thead><tr className="bg-(--crm-surface) text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-3 py-2.5">No</th><th className="px-3 py-2.5">Product name</th><th className="px-3 py-2.5">Price</th><th className="px-3 py-2.5">Qty</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-2 py-2.5" /></tr></thead>
                  <tbody>
                    {draft.items.map((item, index) => (
                      <tr key={item.id} className="border-t border-(--crm-border-soft)">
                        <td className="px-3 py-2 text-xs font-medium text-(--crm-muted)">{index + 1}</td>
                        <td className="px-3 py-2"><input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Item / service name" className="h-9 w-full min-w-[140px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2.5 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></td>
                        <td className="px-3 py-2"><NumberInput value={item.price} onChange={(v) => updateItem(index, { price: v })} min={0} className="h-9 w-[110px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2.5 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" title="Price" /></td>
                        <td className="px-3 py-2"><NumberInput value={item.qty} onChange={(v) => updateItem(index, { qty: v })} min={1} className="h-9 w-[64px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2.5 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" title="Quantity" /></td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-(--crm-brand)">{formatRupiah(item.qty * item.price)}</td>
                        <td className="px-2 py-2"><button onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })} className="rounded-lg p-1.5 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Remove item"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {draft.items.length === 0 && <p className="p-6 text-center text-xs text-(--crm-muted)">No items yet. Add a product from the catalog.</p>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Discount (%)</span><NumberInput value={draft.discount} onChange={(v) => setDraft({ ...draft, discount: v })} min={0} max={100} className={`${inputCls} w-[110px]`} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Tax (%)</span><NumberInput value={draft.tax} onChange={(v) => setDraft({ ...draft, tax: v })} min={0} max={100} className={`${inputCls} w-[110px]`} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as QuoteStatus })} className={inputCls}>{QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              <div className="ml-auto w-[190px] rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3"><p className="flex justify-between text-[10px] text-(--crm-muted)"><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></p><p className="mt-1 flex justify-between text-[10px] text-(--crm-muted)"><span>Discount</span><span>−{formatRupiah(totals.discountAmount)}</span></p><p className="mt-1 flex justify-between text-[10px] text-(--crm-muted)"><span>Tax</span><span>{formatRupiah(totals.taxAmount)}</span></p><p className="mt-2 flex justify-between border-t border-(--crm-border-soft) pt-2 text-sm font-semibold tracking-[-.02em] text-(--crm-fg)"><span>Total</span><span>{formatRupiah(totals.total)}</span></p></div>
            </div>

            <label className="mt-4 block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Notes</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Terms & conditions, notes, etc..." className={areaCls} rows={10} /></label>

            {selectedCustomer && (
              <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3 text-xs text-(--crm-secondary)"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Quote for</p><p className="mt-1 font-semibold text-(--crm-fg)">{selectedCustomer.name} — {selectedCustomer.businessName || selectedCustomer.email}</p>{selectedCustomer.address && <p className="mt-0.5">{selectedCustomer.address}</p>}</div>
            )}
        </RightDrawer>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete quote ${confirmDelete.number}?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => { remove(confirmDelete); setConfirmDelete(null); }}
        />
      )}
      {confirmProcess && (
        <ConfirmModal
          title={`Create invoice from quote ${confirmProcess.number}?`}
          message="An invoice will be created with the same customer, items, and pricing. This quote will be marked as Done."
          onClose={() => setConfirmProcess(null)}
          onConfirm={() => { processToInvoice(confirmProcess); setConfirmProcess(null); }}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
      {catalog && <ProductCatalogModal onClose={() => setCatalog(false)} onPick={addFromCatalog} />}
      {webAssetCatalog && <WebAssetCatalogModal onClose={() => setWebAssetCatalog(false)} onPick={addFromWebAsset} />}
    </CrmShell>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
const areaCls = "w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";