"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Globe, Mail, Phone, ScrollText, Search, Server, UserRound } from "lucide-react";
import { useCrm } from "@/components/CrmProvider";
import type { Customer, Invoice, Quote, WebAsset } from "@/lib/crm";
import { computeTotals, formatDate, formatPhones, formatRupiahShort } from "@/lib/crm";

const docStatusTone: Record<string, string> = {
  Draft: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Process: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Done: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

const stageTone: Record<string, string> = {
  Prospect: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)",
  Active: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)",
  Suspend: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Cancel: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)",
  Inactive: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)",
};

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function GlobalSearch() {
  const router = useRouter();
  const { customers, invoices, quotes, webAssets } = useCrm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();

  const matchedCustomers = useMemo(
    () => (q ? customers.filter((c) => `${c.code} ${c.name} ${c.businessName} ${c.email} ${c.domain}`.toLowerCase().includes(q)) : []),
    [customers, q],
  );

  // A "focus customer" shows the full profile panel (data + invoices + quotes + assets).
  const focusCustomer = useMemo(() => {
    if (!q) return null;
    const exact = customers.find((c) => c.code.toLowerCase() === q);
    if (exact) return exact;
    return matchedCustomers.length === 1 ? matchedCustomers[0] : null;
  }, [customers, q, matchedCustomers]);

  const relatedInvoices = useMemo(
    () => (focusCustomer ? invoices.filter((i) => i.customerId === focusCustomer.id) : []),
    [invoices, focusCustomer],
  );
  const relatedQuotes = useMemo(
    () => (focusCustomer ? quotes.filter((quote) => quote.customerId === focusCustomer.id) : []),
    [quotes, focusCustomer],
  );
  const relatedAssets = useMemo(
    () => (focusCustomer ? webAssets.filter((asset) => asset.customerId === focusCustomer.id) : []),
    [webAssets, focusCustomer],
  );

  const matchedInvoices = useMemo(() => {
    if (!q || focusCustomer) return [];
    return invoices
      .filter((inv) => {
        const cust = customers.find((c) => c.id === inv.customerId);
        return `${inv.number} ${cust?.name ?? ""} ${cust?.code ?? ""}`.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [q, focusCustomer, invoices, customers]);

  const matchedQuotes = useMemo(() => {
    if (!q || focusCustomer) return [];
    return quotes
      .filter((quote) => {
        const cust = customers.find((c) => c.id === quote.customerId);
        return `${quote.number} ${cust?.name ?? ""} ${cust?.code ?? ""}`.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [q, focusCustomer, quotes, customers]);

  const matchedAssets = useMemo(() => {
    if (!q || focusCustomer) return [];
    return webAssets
      .filter((asset) => {
        const cust = customers.find((c) => c.id === asset.customerId);
        return `${asset.name} ${asset.type} ${cust?.name ?? ""} ${cust?.code ?? ""}`.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [q, focusCustomer, webAssets, customers]);

  const hasResults = matchedCustomers.length > 0 || matchedInvoices.length > 0 || matchedQuotes.length > 0 || matchedAssets.length > 0;

  function close() {
    setOpen(false);
    setQuery("");
  }

  function go(path: string) {
    close();
    router.push(path);
  }

  return (
    <div className="relative hidden sm:block">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-faint)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search cust id, name, domain, invoice..."
          className="h-9 w-36 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring) lg:w-64"
        />
      </div>

      {open && q && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="crm-rise absolute right-0 top-full z-50 mt-2 w-[min(92vw,600px)] overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel) shadow-2xl">
            {focusCustomer ? (
              <CustomerPanel
                customer={focusCustomer}
                invoices={relatedInvoices}
                quotes={relatedQuotes}
                assets={relatedAssets}
                onViewProfile={() => go("/customers")}
              />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto p-2">
                {!hasResults && (
                  <p className="px-3 py-6 text-center text-xs text-(--crm-muted)">No results for &quot;{query.trim()}&quot;</p>
                )}

                {matchedCustomers.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Customers</p>
                    {matchedCustomers.map((customer) => (
                      <button key={customer.id} onClick={() => setQuery(customer.code)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-(--crm-hover)">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-[10px] font-bold text-(--crm-fg)">{initials(customer.name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--crm-fg)">{customer.name}</p>
                          <p className="truncate text-[11px] text-(--crm-muted)">{customer.code} · {customer.businessName || "—"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageTone[customer.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{customer.status}</span>
                      </button>
                    ))}
                  </>
                )}

                {matchedInvoices.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Invoices</p>
                    {matchedInvoices.map((inv) => (
                      <button key={inv.id} onClick={() => go("/invoices")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-(--crm-hover)">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-surface) text-(--crm-secondary)"><FileText size={14} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--crm-fg)">{inv.number}</p>
                          <p className="truncate text-[11px] text-(--crm-muted)">{customers.find((c) => c.id === inv.customerId)?.name ?? "—"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[inv.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{inv.status}</span>
                      </button>
                    ))}
                  </>
                )}

                {matchedQuotes.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Quotes</p>
                    {matchedQuotes.map((quote) => (
                      <button key={quote.id} onClick={() => go("/quotes")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-(--crm-hover)">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-surface) text-(--crm-secondary)"><ScrollText size={14} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--crm-fg)">{quote.number}</p>
                          <p className="truncate text-[11px] text-(--crm-muted)">{customers.find((c) => c.id === quote.customerId)?.name ?? "—"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[quote.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{quote.status}</span>
                      </button>
                    ))}
                  </>
                )}

                {matchedAssets.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Domains & Hosting</p>
                    {matchedAssets.map((asset) => (
                      <button key={asset.id} onClick={() => go("/web-assets")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-(--crm-hover)">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${asset.type === "domain" ? "bg-(--crm-st-active-bg) text-(--crm-st-active-text)" : "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{asset.type === "domain" ? <Globe size={14} /> : <Server size={14} />}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--crm-fg)">{asset.name}</p>
                          <p className="truncate text-[11px] text-(--crm-muted)">{asset.type === "domain" ? "Domain" : "Hosting"} · {customers.find((c) => c.id === asset.customerId)?.name ?? "—"}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerPanel({
  customer,
  invoices,
  quotes,
  assets,
  onViewProfile,
}: {
  customer: Customer;
  invoices: Invoice[];
  quotes: Quote[];
  assets: WebAsset[];
  onViewProfile: () => void;
}) {
  return (
    <div className="max-h-[75vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-(--crm-border) p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-xs font-bold text-(--crm-fg)">{initials(customer.name)}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-(--crm-fg)">{customer.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">{customer.code}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${stageTone[customer.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{customer.status}</span>
      </div>

      <div className="p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <PanelInfo icon={UserRound} label="Business" value={customer.businessName || "—"} />
          <PanelInfo icon={Mail} label="Email" value={customer.email || "—"} />
          <PanelInfo icon={Phone} label="Phone" value={formatPhones(customer.phones) || "—"} />
          <PanelInfo icon={Globe} label="Domain" value={customer.domain || "—"} />
          <PanelInfo icon={Building2} label="Address" value={customer.address || "—"} wide />
        </div>

        <PanelSection title={`Invoices (${invoices.length})`}>
          {invoices.length === 0 ? (
            <p className="py-1.5 text-[11px] text-(--crm-faint)">No invoices yet.</p>
          ) : (
            invoices.map((inv) => {
              const total = computeTotals(inv.items, inv.discount, inv.tax).total;
              return (
                <div key={inv.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2"><FileText size={13} className="shrink-0 text-(--crm-faint)" /><p className="truncate text-xs font-semibold text-(--crm-fg)">{inv.number}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><span className="text-[11px] text-(--crm-muted)">{formatRupiahShort(total)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[inv.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{inv.status}</span></div>
                </div>
              );
            })
          )}
        </PanelSection>

        <PanelSection title={`Quotes (${quotes.length})`}>
          {quotes.length === 0 ? (
            <p className="py-1.5 text-[11px] text-(--crm-faint)">No quotes yet.</p>
          ) : (
            quotes.map((quote) => {
              const total = computeTotals(quote.items, quote.discount, quote.tax).total;
              return (
                <div key={quote.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2"><ScrollText size={13} className="shrink-0 text-(--crm-faint)" /><p className="truncate text-xs font-semibold text-(--crm-fg)">{quote.number}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><span className="text-[11px] text-(--crm-muted)">{formatRupiahShort(total)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${docStatusTone[quote.status] ?? "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"}`}>{quote.status}</span></div>
                </div>
              );
            })
          )}
        </PanelSection>

        <PanelSection title={`Domain & Hosting (${assets.length})`}>
          {assets.length === 0 ? (
            <p className="py-1.5 text-[11px] text-(--crm-faint)">No domains or hosting yet.</p>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="flex min-w-0 items-center gap-2">{asset.type === "domain" ? <Globe size={13} className="shrink-0 text-(--crm-brand)" /> : <Server size={13} className="shrink-0 text-(--crm-brand)" />}<p className="truncate text-xs font-semibold capitalize text-(--crm-fg)">{asset.name}</p></div>
                <div className="flex shrink-0 items-center gap-2"><span className="text-[11px] text-(--crm-muted)">{asset.expiryDate ? formatDate(asset.expiryDate) : "—"}</span></div>
              </div>
            ))
          )}
        </PanelSection>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-(--crm-border) pt-3">
          <p className="text-[11px] text-(--crm-faint)">Customer since {formatDate(customer.createdAt)}</p>
          <button onClick={onViewProfile} className="rounded-lg border border-(--crm-border-input) px-3 py-1.5 text-[11px] font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)">View in Customers</button>
        </div>
      </div>
    </div>
  );
}

function PanelInfo({ icon: Icon, label, value, wide }: { icon: typeof Mail; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-(--crm-border) bg-(--crm-surface) p-2.5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--crm-soft) text-(--crm-brand)"><Icon size={12} /></div>
      <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p><p className="mt-0.5 break-words text-xs text-(--crm-body)">{value}</p></div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">{title}</p>
      <div className="mt-1 divide-y divide-(--crm-border-soft)">{children}</div>
    </div>
  );
}
