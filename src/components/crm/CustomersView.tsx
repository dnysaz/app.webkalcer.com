"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { RightDrawer } from "@/components/crm/RightDrawer";
import { PdfActions } from "@/components/crm/PdfActions";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { CustomerDetailBody, avatarTone, initials, statusTone } from "@/components/crm/DetailBodies";
import type { Customer, CustomerStatus } from "@/lib/crm";
import { CUSTOMER_STATUSES, formatDate, formatPhones, generateCustomerCode, uid } from "@/lib/crm";
import { buildCustomerPdf } from "@/lib/pdf";

const emptyForm = {
  name: "",
  businessName: "",
  email: "",
  phones: [] as string[],
  domain: "",
  address: "",
  status: "Prospect" as CustomerStatus,
  notes: "",
};

export function CustomersView() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCrm();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [toast, setToast] = useState("");

  const filtered = useMemo(
    () =>
      customers.filter((customer) => {
        const haystack = `${customer.name} ${customer.businessName} ${customer.email} ${formatPhones(customer.phones)} ${customer.domain} ${customer.code}`.toLowerCase();
        const matchesQuery = haystack.includes(query.toLowerCase());
        const matchesStatus = statusFilter === "All" || customer.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [customers, query, statusFilter],
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

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      businessName: customer.businessName,
      email: customer.email,
      phones: [...customer.phones],
      domain: customer.domain,
      address: customer.address,
      status: customer.status,
      notes: customer.notes,
    });
    setShowForm(true);
  }

  function updatePhone(index: number, value: string) {
    setForm((prev) => ({ ...prev, phones: prev.phones.map((p, i) => (i === index ? value : p)) }));
  }

  function addPhone() {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, ""] }));
  }

  function removePhone(index: number) {
    setForm((prev) => ({ ...prev, phones: prev.phones.filter((_, i) => i !== index) }));
  }

  function save() {
    if (!form.name.trim()) {
      announce("Customer name is required");
      return;
    }
    const phones = form.phones.map((p) => p.trim()).filter(Boolean);
    if (editing) {
      updateCustomer({ ...editing, ...form, phones });
      announce("Customer updated successfully");
    } else {
      const customer: Customer = {
        id: uid(),
        code: generateCustomerCode(),
        ...form,
        phones,
        createdAt: new Date().toISOString(),
      };
      addCustomer(customer);
      announce("New customer added successfully");
    }
    setShowForm(false);
  }

  function remove(customer: Customer) {
    deleteCustomer(customer.id);
    announce("Customer deleted");
    setDetail(null);
  }

  return (
    <CrmShell title="Customers" subtitle="Customer management">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Manage customers</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Store complete customer, business, and contact details.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md"><Plus size={16} />Add customer</button>
        </div>
      </div>

      <div className="crm-rise mt-6 rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex flex-col gap-4 border-b border-(--crm-border) p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="font-semibold tracking-[-.02em]">Customer list</h3><p className="mt-1 text-xs text-(--crm-muted)">{filtered.length} of {customers.length} customers</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers..." className="h-9 w-[200px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-2 text-xs font-semibold text-(--crm-secondary) outline-none focus:border-(--crm-focus-border)">
              <option>All</option>
              {CUSTOMER_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><th className="px-6 py-4">Customer</th><th className="px-4 py-4">Cust ID</th><th className="px-4 py-4">Business</th><th className="px-4 py-4">Contact</th><th className="px-4 py-4">Address</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="cursor-pointer border-t border-(--crm-border-soft) transition-colors hover:bg-(--crm-hover)" onClick={() => setDetail(customer)}>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone[customer.status]}`}>{initials(customer.name)}</div><div><p className="text-sm font-semibold hover:text-(--crm-text)">{customer.name}</p><p className="mt-0.5 text-[11px] text-(--crm-muted)">Since {formatDate(customer.createdAt)}</p></div></div></td>
                  <td className="px-4 py-4"><span className="font-mono text-xs font-medium text-(--crm-fg)">{customer.code}</span></td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2 text-xs text-(--crm-secondary)"><Building2 size={13} className="text-(--crm-faint)" />{customer.businessName || "—"}</div></td>
                  <td className="px-4 py-4"><div className="text-xs text-(--crm-muted)"><p className="flex items-center gap-1.5"><Mail size={12} className="text-(--crm-faint)" />{customer.email || "—"}</p><p className="mt-1 flex items-center gap-1.5"><Phone size={12} className="text-(--crm-faint)" />{formatPhones(customer.phones) || "—"}</p></div></td>
                  <td className="px-4 py-4"><div className="flex max-w-[240px] items-start gap-1.5 text-xs text-(--crm-muted)"><MapPin size={12} className="mt-0.5 shrink-0 text-(--crm-faint)" /><span className="truncate">{customer.address || "—"}</span></div></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[customer.status]}`}>{customer.status}</span></td>
                  <td className="px-6 py-4"><div className="flex justify-end gap-1.5"><button onClick={(event) => { event.stopPropagation(); openEdit(customer); }} className="rounded-lg border border-(--crm-border-input) p-2 text-(--crm-brand) hover:bg-(--crm-hover)" aria-label="Edit"><Pencil size={14} /></button><button onClick={(event) => { event.stopPropagation(); setConfirmDelete(customer); }} className="rounded-lg border border-(--crm-danger-border) p-2 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Delete"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-(--crm-border-soft) md:hidden">
          {filtered.map((customer) => (
            <button key={customer.id} onClick={() => setDetail(customer)} className="flex w-full items-center gap-3 p-4 text-left">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone[customer.status]}`}>{initials(customer.name)}</div>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{customer.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[customer.status]}`}>{customer.status}</span></div><p className="mt-0.5 font-mono text-[11px] text-(--crm-fg)">{customer.code}</p><p className="mt-0.5 truncate text-[11px] text-(--crm-muted)">{customer.businessName} · {formatPhones(customer.phones) || customer.email}</p></div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No matching customers</p><p className="mt-1 text-xs text-(--crm-muted)">Try another keyword or filter.</p></div>}
      </div>

      {showForm && (
        <RightDrawer onClose={() => setShowForm(false)} eyebrow={`${editing ? "Edit" : "Add"} customer`} title={editing ? `Edit ${editing.name}` : "New customer"} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<><button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) hover:bg-(--crm-hover)">Cancel</button><button onClick={save} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--crm-dark)">Save</button></>}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name *" icon={UserRound}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. John Doe" className={inputCls} /></Field>
                <Field label="Business name" icon={Building2}><input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} placeholder="e.g. John Doe Company" className={inputCls} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" icon={Mail}><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@email.com" className={inputCls} /></Field>
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)"><Phone size={12} />Phone numbers</span>
                  <div className="space-y-2">
                    {form.phones.map((phone, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input value={phone} onChange={(event) => updatePhone(index, event.target.value)} placeholder="0812-xxxx-xxxx" className={inputCls} />
                        <button type="button" onClick={() => removePhone(index)} className="shrink-0 rounded-lg p-2 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Remove phone"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={addPhone} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) hover:bg-(--crm-hover)"><Plus size={13} />Add phone</button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Domain name" icon={Globe}><input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="e.g. webkalcer.com" className={inputCls} /></Field>
                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">Status</span>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CustomerStatus })} className="h-9 w-full max-w-[170px] rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-xs font-semibold outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)">{CUSTOMER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                </div>
              </div>
              <Field label="Address" icon={MapPin}><textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Full address" className={areaCls} rows={4} /></Field>
              <Field label="Notes"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detailed customer notes..." className={areaCls} rows={10} /></Field>
            </div>
        </RightDrawer>
      )}

      {detail && (
        <RightDrawer onClose={() => setDetail(null)} eyebrow="Customer details" title={detail.name} widthClass="sm:w-[680px] lg:w-[760px]"
          footer={<>
            <PdfActions build={() => buildCustomerPdf(detail)} filename={`${detail.name.replace(/\s+/g, "-").toLowerCase()}.pdf`} />
            <div className="flex-1" />
            <button onClick={() => { openEdit(detail); setDetail(null); }} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Edit</button>
            <button onClick={() => setConfirmDelete(detail)} className="rounded-xl border border-(--crm-danger-border) px-4 py-2.5 text-sm font-semibold text-(--crm-danger) hover:bg-(--crm-danger-bg)">Delete</button>
          </>}>
            <CustomerDetailBody customer={detail} onCopy={() => announce("Cust ID copied")} />
        </RightDrawer>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete customer "${confirmDelete.name}"?`}
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

