"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, ImagePlus, Landmark, Plus, QrCode, Save, Trash2, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import type { BankAccount } from "@/lib/crm";
import { uid } from "@/lib/crm";
import { uploadImageToR2 } from "@/lib/image";

const emptyAccount = (): BankAccount => ({ id: uid(), bank: "", number: "", name: "" });

export function PaymentsView() {
  const [loading, setLoading] = useState(true);
  const [qrisImage, setQrisImage] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/payment");
        if (res.ok) {
          const data = (await res.json()) as { qrisImage: string; bankAccounts: BankAccount[] };
          setQrisImage(data.qrisImage);
          setBankAccounts(Array.isArray(data.bankAccounts) ? data.bankAccounts : []);
        }
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function updateAccount(index: number, patch: Partial<BankAccount>) {
    setBankAccounts((prev) => prev.map((account, i) => (i === index ? { ...account, ...patch } : account)));
  }

  async function save() {
    setSaving(true);
    try {
      const valid = bankAccounts.filter((a) => a.bank.trim() && a.number.trim());
      const res = await fetch("/api/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrisImage, bankAccounts: valid }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setBankAccounts(valid);
      announce("Payment settings saved");
    } catch {
      announce("Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <CrmShell title="Payments" subtitle="Payment methods">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" />
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell title="Payments" subtitle="Payment methods">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Payment settings</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Manage your static QRIS and bank accounts for customer payments.</p>
        </div>
        <button onClick={() => void save()} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} />{saving ? "Saving..." : "Save changes"}</button>
      </div>

      {/* QRIS */}
      <section className="crm-rise mt-6 rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold tracking-[-.02em]"><QrCode size={17} className="text-(--crm-text)" />QRIS (static)</h3>
            <p className="mt-1 text-xs text-(--crm-muted)">Upload a static QRIS image so customers can scan and pay directly.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-start gap-5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const url = await uploadImageToR2(file, { preferPng: true }); setQrisImage(url); announce("QRIS uploaded"); } catch (error) { announce(error instanceof Error ? error.message : "Upload failed"); } }} />
          {qrisImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR codes must never be re-encoded by next/image or they break scanning */}
              <img src={qrisImage} alt="QRIS preview" className="h-44 w-44 rounded-xl border border-(--crm-border) bg-(--crm-surface) object-contain p-2" />
              <button onClick={() => setQrisImage("")} className="absolute -right-2 -top-2 rounded-full bg-(--crm-dark) p-1.5 text-white shadow hover:bg-(--crm-primary)" aria-label="Remove QRIS"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--crm-border) bg-(--crm-surface) text-(--crm-brand) transition-colors hover:bg-(--crm-hover)" type="button"><ImagePlus size={24} /><span className="text-xs font-semibold">Upload QRIS image</span></button>
          )}
          {qrisImage && <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">Replace image</button>}
        </div>
      </section>

      {/* Bank accounts */}
      <section className="crm-rise mt-5 rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold tracking-[-.02em]"><Landmark size={17} className="text-(--crm-text)" />Bank accounts</h3>
            <p className="mt-1 text-xs text-(--crm-muted)">Add one or more bank accounts for manual transfers.</p>
          </div>
          <button onClick={() => setBankAccounts((prev) => [...prev, emptyAccount()])} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Plus size={14} />Add account</button>
        </div>

        <div className="mt-5 space-y-3">
          {bankAccounts.length === 0 && (
            <div className="rounded-xl border border-dashed border-(--crm-border) px-6 py-10 text-center">
              <Banknote size={22} className="mx-auto text-(--crm-faint)" />
              <p className="mt-2 text-sm font-semibold text-(--crm-fg)">No bank accounts yet</p>
              <p className="mt-1 text-xs text-(--crm-muted)">Click &quot;Add account&quot; to add your first bank account.</p>
            </div>
          )}
          {bankAccounts.map((account, index) => (
            <div key={account.id} className="flex flex-col gap-2 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Bank</span>
                <input value={account.bank} onChange={(event) => updateAccount(index, { bank: event.target.value })} placeholder="e.g. BCA" className={inputCls} />
              </label>
              <label className="block flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Account number</span>
                <input value={account.number} onChange={(event) => updateAccount(index, { number: event.target.value })} placeholder="e.g. 1234567890" className={inputCls} />
              </label>
              <label className="block flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Account name</span>
                <input value={account.name} onChange={(event) => updateAccount(index, { name: event.target.value })} placeholder="e.g. John Doe" className={inputCls} />
              </label>
              <button onClick={() => setBankAccounts((prev) => prev.filter((_, i) => i !== index))} className="shrink-0 rounded-lg border border-(--crm-danger-border) p-2 text-(--crm-danger) hover:bg-(--crm-danger-bg)" aria-label="Remove account"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </section>

      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
