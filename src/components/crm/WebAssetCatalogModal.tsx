"use client";

import { useMemo, useState } from "react";
import { Globe, Plus, Search, Server, X } from "lucide-react";
import { useCrm } from "@/components/CrmProvider";
import type { WebAsset } from "@/lib/crm";
import { formatRupiah } from "@/lib/crm";

export function WebAssetCatalogModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (asset: WebAsset) => void;
}) {
  const { webAssets, customers } = useCrm();
  const [query, setQuery] = useState("");

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(
    () =>
      webAssets.filter((asset) => {
        const customer = customerById.get(asset.customerId);
        return `${asset.name} ${asset.type} ${asset.provider} ${customer?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
      }),
    [webAssets, query, customerById],
  );

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="crm-rise relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel) shadow-2xl">
        <div className="flex items-start justify-between border-b border-(--crm-border) p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-(--crm-brand)">Domain & hosting</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-.02em]">Add domain / hosting</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 pt-4">
          <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search domains or hosting..." className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--crm-border-soft) px-5 pb-5 pt-3">
          {filtered.length === 0 ? (
            <div className="py-10 text-center"><Globe size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">{webAssets.length === 0 ? "No domains or hosting yet" : "No matching assets"}</p><p className="mt-1 text-xs text-(--crm-muted)">{webAssets.length === 0 ? "Add them in the Domain & Hosting menu first." : "Try another keyword."}</p></div>
          ) : (
            <ul className="divide-y divide-(--crm-border-soft)">
              {filtered.map((asset) => {
                const customer = customerById.get(asset.customerId);
                const Icon = asset.type === "domain" ? Globe : Server;
                return (
                  <li key={asset.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--crm-border) bg-(--crm-surface) text-(--crm-brand)"><Icon size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{asset.name}</p><span className="shrink-0 rounded-full bg-(--crm-surface) px-2 py-0.5 text-[10px] font-semibold capitalize text-(--crm-secondary)">{asset.type}</span></div>
                      <p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{customer?.name ?? "No owner"} · {formatRupiah(asset.price)}</p>
                    </div>
                    <button onClick={() => onPick(asset)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-(--crm-primary) px-3 py-2 text-[11px] font-semibold text-white hover:bg-(--crm-dark)"><Plus size={13} />Add</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
