"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Package, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { RightDrawer } from "@/components/crm/RightDrawer";
import { PdfActions } from "@/components/crm/PdfActions";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { NumberInput } from "@/components/crm/NumberInput";
import type { Product } from "@/lib/crm";
import { formatRupiah, productEffectivePrice, uid } from "@/lib/crm";
import { buildProductPdf } from "@/lib/pdf";
import { uploadImageToR2 } from "@/lib/image";

type ProductForm = {
  name: string;
  detail: string;
  price: number;
  promo: boolean;
  discount: number;
  tax: number;
  image: string;
};

const emptyForm: ProductForm = {
  name: "",
  detail: "",
  price: 0,
  promo: false,
  discount: 0,
  tax: 11,
  image: "",
};

export function ProductsView() {
  const { products, addProduct, updateProduct, deleteProduct } = useCrm();
  const [query, setQuery] = useState("");
  const [promoFilter, setPromoFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [detail, setDetail] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const haystack = `${product.name} ${product.detail}`.toLowerCase();
        const matchesQuery = haystack.includes(query.toLowerCase());
        const matchesPromo = promoFilter === "All" || (promoFilter === "Yes" && product.promo) || (promoFilter === "No" && !product.promo);
        return matchesQuery && matchesPromo;
      }),
    [products, query, promoFilter],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      detail: product.detail,
      price: product.price,
      promo: product.promo,
      discount: product.discount,
      tax: product.tax,
      image: product.image,
    });
    setShowForm(true);
  }

  function save() {
    if (!form.name.trim()) { announce("Product name is required"); return; }
    if (form.price <= 0) { announce("Product price must be greater than zero"); return; }
    if (form.promo && form.discount >= 100) { announce("Promo discount must be below 100%"); return; }

    if (editing) {
      updateProduct({ ...editing, ...form });
      announce("Product updated successfully");
    } else {
      const product: Product = { id: uid(), ...form, createdAt: new Date().toISOString() };
      addProduct(product);
      announce("New product added successfully");
    }
    setShowForm(false);
  }

  function remove(product: Product) {
    deleteProduct(product.id);
    announce("Product deleted");
    setDetail(null);
  }

  return (
    <CrmShell title="Products" subtitle="Product catalog">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Manage products</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Catalog your products with prices, promo and tax.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md"><Plus size={16} />Add product</button>
        </div>
      </div>

      <div className="crm-rise mt-6 rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex flex-col gap-4 border-b border-(--crm-border) p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="font-semibold tracking-[-.02em]">Product list</h3><p className="mt-1 text-xs text-(--crm-muted)">{filtered.length} of {products.length} products</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." className="h-9 w-[200px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
            <select value={promoFilter} onChange={(event) => setPromoFilter(event.target.value)} className="h-9 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2 text-xs font-semibold text-(--crm-secondary) outline-none focus:border-(--crm-focus-border)">
              <option>All</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Product</th><th className="px-4 py-4">Detail</th><th className="px-4 py-4">Price</th><th className="px-4 py-4">Promo</th><th className="px-4 py-4">Tax</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((product) => {
                const final = productEffectivePrice(product);
                return (
                  <tr key={product.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setDetail(product)}>
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--crm-border) bg-(--crm-surface) ${!product.image ? "text-(--crm-faint)" : ""}`}>{product.image ? <Image fill sizes="40px" src={product.image} alt={product.name} className="object-cover" /> : <Package size={17} />}</div><p className="text-sm font-semibold">{product.name}</p></div></td>
                    <td className="px-4 py-4"><p className="max-w-[220px] truncate text-xs text-(--crm-muted)">{product.detail || "—"}</p></td>
                    <td className="px-4 py-4"><div className="text-sm"><p className="font-semibold">{formatRupiah(final)}</p>{product.promo && <p className="text-[11px] text-(--crm-danger) line-through">{formatRupiah(product.price)}</p>}</div></td>
                    <td className="px-4 py-4">{product.promo ? <span className="rounded-full bg-(--crm-st-process-bg) px-2.5 py-1 text-[10px] font-semibold text-(--crm-st-process-text)">Promo {product.discount}%</span> : <span className="rounded-full bg-(--crm-st-draft-bg) px-2.5 py-1 text-[10px] font-semibold text-(--crm-st-draft-text)">No</span>}</td>
                    <td className="px-4 py-4 text-xs text-(--crm-muted)">{product.tax}%</td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-1.5"><button onClick={(event) => { event.stopPropagation(); openEdit(product); }} className="rounded-lg border border-(--crm-border-input) p-2 text-(--crm-brand) hover:bg-(--crm-hover)" aria-label="Edit"><Pencil size={14} /></button><button onClick={(event) => { event.stopPropagation(); setConfirmDelete(product); }} className="rounded-lg border border-(--crm-danger-border) p-2 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Delete"><Trash2 size={14} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-(--crm-border-soft) md:hidden">
          {filtered.map((product) => (
            <button key={product.id} onClick={() => setDetail(product)} className="flex w-full items-center gap-3 p-4 text-left">
              <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--crm-border) bg-(--crm-surface) ${!product.image ? "text-(--crm-faint)" : ""}`}>{product.image ? <Image fill sizes="44px" src={product.image} alt={product.name} className="object-cover" /> : <Package size={17} />}</div>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-sm font-semibold">{formatRupiah(productEffectivePrice(product))}</p></div>{product.promo && <p className="mt-0.5 text-[11px] text-(--crm-danger) line-through">{formatRupiah(product.price)} · Promo {product.discount}%</p>}</div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No products</p><p className="mt-1 text-xs text-(--crm-muted)">Add your first product to the catalog.</p></div>}
      </div>

      {detail && (
        <RightDrawer onClose={() => setDetail(null)} eyebrow="Product details" title={detail.name} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<>
            <PdfActions build={() => buildProductPdf(detail)} filename={`${detail.name.replace(/\s+/g, "-").toLowerCase()}.pdf`} />
            <div className="flex-1" />
            <button onClick={() => { openEdit(detail); setDetail(null); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDelete(detail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
            <div className={`relative flex h-52 w-full items-center justify-center overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-surface) ${!detail.image ? "text-(--crm-faint)" : ""}`}>{detail.image ? <Image fill sizes="760px" src={detail.image} alt={detail.name} className="object-cover" /> : <Package size={40} />}</div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Final price</p><p className="mt-0.5 text-2xl font-semibold tracking-[-.04em] text-(--crm-fg)">{formatRupiah(productEffectivePrice(detail))}</p></div>
              {detail.promo ? <span className="rounded-full bg-(--crm-st-process-bg) px-3 py-1 text-[11px] font-semibold text-(--crm-st-process-text)">Promo {detail.discount}% off</span> : <span className="rounded-full bg-(--crm-st-draft-bg) px-3 py-1 text-[11px] font-semibold text-(--crm-st-draft-text)">No promo</span>}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoBox label="Base price" value={formatRupiah(detail.price)} />
              <InfoBox label="Tax" value={`${detail.tax}%`} />
            </div>
            {detail.detail && <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Details</p><p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{detail.detail}</p></div>}
        </RightDrawer>
      )}

      {showForm && (
        <RightDrawer onClose={() => setShowForm(false)} eyebrow={`${editing ? "Edit" : "Add"} product`} title={editing ? `Edit ${editing.name}` : "New product"} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<><button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) hover:bg-(--crm-hover)">Cancel</button><button onClick={save} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--crm-dark)">Save product</button></>}>
            <div className="mb-4">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Thumbnail (1 image)</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const url = await uploadImageToR2(file); setForm({ ...form, image: url }); announce("Image uploaded"); } catch (error) { announce(error instanceof Error ? error.message : "Upload failed"); } }} />
              {form.image ? (
                <div className="relative inline-block"><Image src={form.image} alt="Thumbnail preview" width={240} height={144} className="h-36 w-full max-w-[240px] rounded-xl border border-(--crm-border) object-cover" /><button onClick={() => setForm({ ...form, image: "" })} className="absolute right-2 top-2 rounded-full bg-(--crm-dark)/80 p-1 text-white hover:bg-(--crm-dark)" aria-label="Remove image"><X size={13} /></button></div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="flex h-36 w-full max-w-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--crm-border) bg-(--crm-surface) text-(--crm-brand) hover:bg-(--crm-hover)" type="button"><ImagePlus size={22} /><span className="text-xs font-semibold">Upload thumbnail</span></button>
              )}
            </div>
            <div className="space-y-3">
              <Field label="Product name *" icon={Package}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Point of Sale Pro" className={inputCls} /></Field>
              <Field label="Details" icon={Tag}><textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} placeholder="Product description, features, etc..." className={areaCls} rows={6} /></Field>
              <Field label="Price (Rp) *"><NumberInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} min={0} placeholder="e.g. 4500000" className={inputCls} /></Field>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
                <label className="flex sm:items-end"><input type="checkbox" checked={form.promo} onChange={(event) => setForm({ ...form, promo: event.target.checked })} className="peer sr-only" /><span className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-4 py-2.5 text-sm font-semibold text-(--crm-secondary) transition-colors peer-checked:border-(--crm-mid) peer-checked:bg-(--crm-soft) peer-checked:text-(--crm-text)"><Tag size={14} />Promo</span></label>
                <Field label="Discount (%)"><NumberInput value={form.discount} onChange={(v) => setForm({ ...form, discount: v })} min={0} max={99} disabled={!form.promo} className={`${inputCls} disabled:cursor-not-allowed disabled:bg-(--crm-surface)`} /></Field>
                <Field label="Tax (%)"><NumberInput value={form.tax} onChange={(v) => setForm({ ...form, tax: v })} min={0} max={100} className={inputCls} /></Field>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Final price</p>
              <p className="text-lg font-semibold tracking-[-.03em] text-(--crm-fg)">{formatRupiah(form.promo ? Math.round(form.price * (1 - form.discount / 100)) : form.price)}</p>
            </div>
        </RightDrawer>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete product "${confirmDelete.name}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => { remove(confirmDelete); setConfirmDelete(null); }}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-(--crm-body)">{value}</p>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: typeof Package; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">{Icon && <Icon size={12} />}{label}</span>
      {children}
    </label>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
const areaCls = "w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";