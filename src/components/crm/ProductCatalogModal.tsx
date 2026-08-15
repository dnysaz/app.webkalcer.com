"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Package, Plus, Search, X } from "lucide-react";
import { useCrm } from "@/components/CrmProvider";
import type { Product } from "@/lib/crm";
import { formatRupiah, productEffectivePrice } from "@/lib/crm";

export function ProductCatalogModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (product: Product) => void;
}) {
  const { products } = useCrm();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.detail}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="crm-rise relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel) shadow-2xl">
        <div className="flex items-start justify-between border-b border-(--crm-border) p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-(--crm-brand)">Product catalog</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-.02em]">Pick a product</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 pt-4">
          <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--crm-border-soft) px-5 pb-5 pt-3">
          {filtered.length === 0 ? (
            <div className="py-10 text-center"><Package size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">{products.length === 0 ? "No products yet" : "No matching products"}</p><p className="mt-1 text-xs text-(--crm-muted)">{products.length === 0 ? "Add products in the Products menu first." : "Try another keyword."}</p></div>
          ) : (
            <ul className="divide-y divide-(--crm-border-soft)">
              {filtered.map((product) => (
                <li key={product.id} className="flex items-center gap-3 py-3">
                  <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--crm-border) bg-(--crm-surface) ${!product.image ? "text-(--crm-faint)" : ""}`}>{product.image ? <Image fill sizes="44px" src={product.image} alt={product.name} className="object-cover" /> : <Package size={17} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{product.name}</p>{product.promo && <span className="shrink-0 rounded-full bg-(--crm-st-process-bg) px-2 py-0.5 text-[10px] font-semibold text-(--crm-st-process-text)">Promo {product.discount}%</span>}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">{product.promo && <p className="text-[11px] text-(--crm-danger) line-through">{formatRupiah(product.price)}</p>}<p className={`text-xs font-semibold ${product.promo ? "text-(--crm-fg)" : "text-(--crm-secondary)"}`}>{formatRupiah(productEffectivePrice(product))}</p></div>
                  </div>
                  <button onClick={() => onPick(product)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-(--crm-primary) px-3 py-2 text-[11px] font-semibold text-white hover:bg-(--crm-dark)"><Plus size={13} />Add</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}