"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Building2,
  FileText,
  Globe,
  Mail,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
  UserRound,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { RightDrawer } from "@/components/crm/RightDrawer";
import { CustomerSearch } from "@/components/crm/CustomerSearch";
import { NumberInput } from "@/components/crm/NumberInput";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import type { WebAsset, WebAssetType } from "@/lib/crm";
import { formatDate, formatRupiah, uid, WEB_ASSET_TYPES } from "@/lib/crm";

const typeTone: Record<WebAssetType, { badge: string; icon: typeof Globe; color: string }> = {
  domain: { badge: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)", icon: Globe, color: "bg-(--crm-st-active-bg) text-(--crm-st-active-text)" },
  hosting: { badge: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)", icon: Server, color: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)" },
};

function expiryInfo(expiryDate: string): { label: string; tone: string } | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: "Expired", tone: "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)" };
  if (diffDays <= 30) return { label: `Expires in ${diffDays}d`, tone: "bg-(--crm-st-process-bg) text-(--crm-st-process-text)" };
  return { label: "Active", tone: "bg-(--crm-st-done-bg) text-(--crm-st-done-text)" };
}

const emptyForm = {
  type: "domain" as WebAssetType,
  name: "",
  customerId: "",
  provider: "",
  startDate: "",
  expiryDate: "",
  price: 0,
  notes: "",
};

export function DomainHostingView() {
  const { customers, webAssets, addWebAsset, updateWebAsset, deleteWebAsset } = useCrm();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | WebAssetType>("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WebAsset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<WebAsset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WebAsset | null>(null);
  const [toast, setToast] = useState("");

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(
    () =>
      webAssets.filter((asset) => {
        const customer = customerById.get(asset.customerId);
        const haystack = `${asset.name} ${asset.provider} ${customer?.name ?? ""} ${customer?.businessName ?? ""} ${customer?.code ?? ""}`.toLowerCase();
        const matchesQuery = haystack.includes(query.toLowerCase());
        const matchesType = typeFilter === "All" || asset.type === typeFilter;
        return matchesQuery && matchesType;
      }),
    [webAssets, query, typeFilter, customerById],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  }

  function openEdit(asset: WebAsset) {
    setEditing(asset);
    setForm({
      type: asset.type,
      name: asset.name,
      customerId: asset.customerId,
      provider: asset.provider,
      startDate: asset.startDate,
      expiryDate: asset.expiryDate,
      price: asset.price,
      notes: asset.notes,
    });
    setShowForm(true);
  }

  function save() {
    if (!form.name.trim()) {
      announce("Name is required");
      return;
    }
    if (!form.customerId) {
      announce("Select the customer who owns this asset");
      return;
    }
    if (editing) {
      updateWebAsset({ ...editing, ...form, name: form.name.trim() });
      announce(`${form.type === "domain" ? "Domain" : "Hosting"} updated successfully`);
    } else {
      const asset: WebAsset = {
        id: uid(),
        ...form,
        name: form.name.trim(),
        createdAt: new Date().toISOString(),
      };
      addWebAsset(asset);
      announce(`New ${form.type} added successfully`);
    }
    setShowForm(false);
  }

  function remove(asset: WebAsset) {
    deleteWebAsset(asset.id);
    announce(`${asset.type === "domain" ? "Domain" : "Hosting"} deleted`);
    setDetail(null);
  }

  return (
    <CrmShell title="Domain & Hosting" subtitle="Web assets & subscriptions">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Manage domains & hosting</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Track purchased domains and hosting plans, their owner, and active period.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md"><Plus size={16} />Add asset</button>
        </div>
      </div>

      <div className="crm-rise mt-6 rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex flex-col gap-4 border-b border-(--crm-border) p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="font-semibold tracking-[-.02em]">Asset list</h3><p className="mt-1 text-xs text-(--crm-muted)">{filtered.length} of {webAssets.length} assets</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, provider, customer..." className="h-9 w-[220px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "All" | WebAssetType)} className="h-9 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2 text-xs font-semibold text-(--crm-secondary) outline-none focus:border-(--crm-focus-border)">
              <option>All</option>
              {WEB_ASSET_TYPES.map((type) => <option key={type} value={type}>{type === "domain" ? "Domain" : "Hosting"}</option>)}
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Asset</th><th className="px-4 py-4">Owner</th><th className="px-4 py-4">Provider</th><th className="px-4 py-4">Active period</th><th className="px-4 py-4">Price</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((asset) => {
                const customer = customerById.get(asset.customerId);
                const info = typeTone[asset.type];
                const expiry = expiryInfo(asset.expiryDate);
                const Icon = info.icon;
                return (
                  <tr key={asset.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setDetail(asset)}>
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${info.color}`}><Icon size={16} /></div><div><p className="text-sm font-semibold">{asset.name}</p><p className="mt-0.5 flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${info.badge}`}>{asset.type}</span>{expiry && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${expiry.tone}`}>{expiry.label}</span>}</p></div></div></td>
                    <td className="px-4 py-4"><p className="text-sm font-medium">{customer?.name ?? "—"}</p><p className="mt-0.5 text-[11px] text-(--crm-muted)">{customer?.businessName ?? ""}</p></td>
                    <td className="px-4 py-4 text-xs text-(--crm-muted)">{asset.provider || "—"}</td>
                    <td className="px-4 py-4 text-xs text-(--crm-muted)">{asset.startDate ? formatDate(asset.startDate) : "—"} → {asset.expiryDate ? formatDate(asset.expiryDate) : "—"}</td>
                    <td className="px-4 py-4 text-sm font-semibold">{formatRupiah(asset.price)}</td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-1.5"><button onClick={(event) => { event.stopPropagation(); openEdit(asset); }} className="rounded-lg border border-(--crm-border-input) p-2 text-(--crm-brand) hover:bg-(--crm-hover)" aria-label="Edit"><Pencil size={14} /></button><button onClick={(event) => { event.stopPropagation(); setConfirmDelete(asset); }} className="rounded-lg border border-(--crm-danger-border) p-2 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Delete"><Trash2 size={14} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-(--crm-border-soft) md:hidden">
          {filtered.map((asset) => {
            const customer = customerById.get(asset.customerId);
            const info = typeTone[asset.type];
            const expiry = expiryInfo(asset.expiryDate);
            const Icon = info.icon;
            return (
              <button key={asset.id} onClick={() => setDetail(asset)} className="flex w-full items-center gap-3 p-4 text-left">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${info.color}`}><Icon size={16} /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{asset.name}</p>{expiry && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${expiry.tone}`}>{expiry.label}</span>}</div><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{customer?.name ?? "—"} · {asset.provider || asset.type} · {formatRupiah(asset.price)}</p></div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No domains or hosting found</p><p className="mt-1 text-xs text-(--crm-muted)">Add your first purchased asset to start tracking it.</p></div>}
      </div>

      {showForm && (
        <RightDrawer onClose={() => setShowForm(false)} eyebrow={`${editing ? "Edit" : "Add"} asset`} title={editing ? `Edit ${editing.name}` : "New domain / hosting"} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<><button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) hover:bg-(--crm-hover)">Cancel</button><button onClick={save} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--crm-dark)">Save</button></>}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type *" icon={FileText}><div className="flex rounded-xl bg-(--crm-hover) p-1">{WEB_ASSET_TYPES.map((type) => <button key={type} type="button" onClick={() => setForm({ ...form, type })} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors capitalize ${form.type === type ? "bg-(--crm-surface) text-(--crm-text) shadow-sm" : "text-(--crm-muted)"}`}>{type}</button>)}</div></Field>
                <Field label="Name *" icon={form.type === "domain" ? Globe : Server}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={form.type === "domain" ? "e.g. webkalcer.com" : "e.g. Cloud Hosting 4GB"} className={inputCls} /></Field>
              </div>
              <Field label="Owner / Customer *" icon={UserRound}><CustomerSearch customers={customers} value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Provider" icon={Building2}><input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} placeholder="e.g. Niagahoster, Domainesia" className={inputCls} /></Field>
                <Field label="Price (Rp)" icon={Server}><NumberInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} min={0} placeholder="0" className={inputCls} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Active from" icon={CalendarDays}><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={inputCls} /></Field>
                <Field label="Expires on" icon={CalendarDays}><input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Notes"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Additional details..." className={areaCls} rows={10} /></Field>
            </div>
        </RightDrawer>
      )}

      {detail && (
        <RightDrawer onClose={() => setDetail(null)} eyebrow={`${detail.type === "domain" ? "Domain" : "Hosting"} details`} title={detail.name} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<>
            <div className="flex-1" />
            <button onClick={() => { openEdit(detail); setDetail(null); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDelete(detail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
            <div className="flex items-center gap-4">{(() => { const info = typeTone[detail.type]; const Icon = info.icon; return <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.color}`}><Icon size={22} /></div>; })()}<div><p className="text-sm text-(--crm-secondary) capitalize">{detail.type} · {detail.provider || "No provider"}</p><span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${(expiryInfo(detail.expiryDate) ?? { tone: "bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)" }).tone}`}>{expiryInfo(detail.expiryDate)?.label ?? "No expiry"}</span></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoRow icon={UserRound} label="Owner" value={customerById.get(detail.customerId)?.name ?? "—"} />
              <InfoRow icon={UserRound} label="Owner Cust ID" value={customerById.get(detail.customerId)?.code || "—"} />
              <InfoRow icon={Mail} label="Owner email" value={customerById.get(detail.customerId)?.email || "—"} />
              <InfoRow icon={Building2} label="Provider" value={detail.provider || "—"} />
              <InfoRow icon={Server} label="Price" value={formatRupiah(detail.price)} />
              <InfoRow icon={CalendarDays} label="Active from" value={detail.startDate ? formatDate(detail.startDate) : "—"} />
              <InfoRow icon={CalendarDays} label="Expires on" value={detail.expiryDate ? formatDate(detail.expiryDate) : "—"} />
            </div>
            <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Notes</p><p className="mt-1.5 text-sm leading-6 text-(--crm-body)">{detail.notes || "No notes yet."}</p></div>
            <p className="mt-4 text-[11px] text-(--crm-faint)">Registered {formatDate(detail.createdAt)}</p>
        </RightDrawer>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete.type === "domain" ? "domain" : "hosting"} "${confirmDelete.name}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => { remove(confirmDelete); setConfirmDelete(null); }}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
const areaCls = "w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";

function Field({ label, icon: Icon, children }: { label: string; icon?: typeof Mail; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">{Icon && <Icon size={12} />}{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-soft) text-(--crm-brand)"><Icon size={14} /></div>
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p><p className="mt-0.5 break-words text-sm text-(--crm-body)">{value}</p></div>
    </div>
  );
}
