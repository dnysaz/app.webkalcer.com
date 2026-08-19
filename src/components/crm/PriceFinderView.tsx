"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Globe,
  Loader2,
  Save,
  Search,
  Sparkles,
  Tag,
  X,
  XCircle,
} from "lucide-react";
import { useCrm } from "@/components/CrmProvider";
import { CustomerSearch } from "@/components/crm/CustomerSearch";
import { NumberInput } from "@/components/crm/NumberInput";
import type { DomainCheckResult, TldPricing } from "@/lib/porkbun";
import { formatRupiah, uid } from "@/lib/crm";

const POPULAR_TLDS = ["com", "net", "org", "id", "co.id", "web.id", "my.id", "ac.id", "biz.id", "info", "co", "io", "dev", "app", "site", "xyz", "online", "store", "tech"];

const POPULAR_TLD_SET = new Set(POPULAR_TLDS);

const FALLBACK_RATE = 16000;

interface CheckState {
  loading: boolean;
  result: DomainCheckResult | null;
  error: string;
}

interface SaveForm {
  name: string;
  customerId: string;
  price: number;
  sellPrice: number;
  provider: string;
  startDate: string;
  expiryDate: string;
}

export function PriceFinderView({ onSaved }: { onSaved?: () => void }) {
  const { customers, addWebAsset } = useCrm();
  const [domain, setDomain] = useState("");
  const [check, setCheck] = useState<CheckState>({ loading: false, result: null, error: "" });
  const [pricing, setPricing] = useState<Record<string, TldPricing> | null>(null);
  const [pricingError, setPricingError] = useState("");
  const [tldQuery, setTldQuery] = useState("");
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [showSave, setShowSave] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing/tld")
      .then((r) => r.json())
      .then((data: { pricing?: Record<string, TldPricing>; rate?: number; error?: string }) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setPricing(data.pricing ?? {});
        if (typeof data.rate === "number" && data.rate > 0) setRate(data.rate);
      })
      .catch((e) => {
        if (!cancelled) setPricingError(e instanceof Error ? e.message : "Failed to load TLD prices.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usdToIdr = useMemo(() => (usd: string) => Math.round(Number(usd || 0) * rate), [rate]);

  async function runCheck() {
    const value = domain.trim().toLowerCase();
    if (!value) return;
    setCheck({ loading: true, result: null, error: "" });
    try {
      const res = await fetch("/api/pricing/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = (await res.json()) as { error?: string } & DomainCheckResult;
      if (!res.ok) throw new Error(data.error || "Failed to check the domain.");
      if (typeof data.rate === "number" && data.rate > 0) setRate(data.rate);
      setCheck({ loading: false, result: data, error: "" });
    } catch (e) {
      setCheck({ loading: false, result: null, error: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  function openSave() {
    if (!check.result) return;
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setSaveForm({
      name: check.result.domain,
      customerId: "",
      price: usdToIdr(check.result.price),
      sellPrice: 0,
      provider: "Porkbun",
      startDate: today.toISOString().slice(0, 10),
      expiryDate: nextYear.toISOString().slice(0, 10),
    });
    setSaveError("");
    setShowSave(true);
  }

  function confirmSave() {
    if (!saveForm) return;
    if (!saveForm.name.trim()) {
      setSaveError("Enter the domain name.");
      return;
    }
    if (!saveForm.customerId) {
      setSaveError("Select the customer who will own this asset.");
      return;
    }
    setSaving(true);
    addWebAsset({
      id: uid(),
      type: "domain",
      name: saveForm.name.trim(),
      customerId: saveForm.customerId,
      provider: saveForm.provider,
      startDate: saveForm.startDate,
      expiryDate: saveForm.expiryDate,
      price: saveForm.price || 0,
      sellPrice: saveForm.sellPrice || 0,
      notes: "",
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    setShowSave(false);
    onSaved?.();
  }

  const sortedTlds = useMemo(() => {
    if (!pricing) return [];
    return Object.keys(pricing).sort((a, b) => {
      const pa = POPULAR_TLD_SET.has(a) ? 0 : 1;
      const pb = POPULAR_TLD_SET.has(b) ? 0 : 1;
      return pa - pb || a.localeCompare(b);
    });
  }, [pricing]);

  const filteredTlds = useMemo(() => {
    const q = tldQuery.trim().toLowerCase().replace(/^\./, "");
    if (!q) return sortedTlds;
    return sortedTlds.filter((t) => t.includes(q));
  }, [sortedTlds, tldQuery]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="crm-rise rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--crm-st-active-bg) text-(--crm-st-active-text)"><Globe size={16} /></div>
          <div><h3 className="font-semibold tracking-[-.02em]">Live domain check</h3><p className="mt-0.5 text-[11px] text-(--crm-muted)">Availability &amp; price via Porkbun</p></div>
        </div>

        <div className="relative mt-4">
          <Search size={15} className="absolute left-3 top-3 text-(--crm-faint)" />
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") runCheck(); }}
            placeholder="e.g. webkalcer.com"
            className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)"
          />
          <button
            onClick={runCheck}
            disabled={check.loading || !domain.trim()}
            className="absolute right-1.5 top-1.5 flex h-7 items-center gap-1 rounded-md bg-(--crm-primary) px-2.5 text-xs font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {check.loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}Check
          </button>
        </div>

        {check.error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-(--crm-danger-border) bg-(--crm-danger-bg) p-3">
            <XCircle size={15} className="mt-0.5 shrink-0 text-(--crm-danger)" />
            <p className="text-xs leading-5 text-(--crm-danger)">{check.error}</p>
          </div>
        )}

        {check.result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4">
              <div className="flex items-center gap-2.5">
                {check.result.available
                  ? <CheckCircle2 size={18} className="text-(--crm-st-done-text)" />
                  : <XCircle size={18} className="text-(--crm-st-cancel-text)" />}
                <div>
                  <p className="text-sm font-semibold">{check.result.domain}</p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${check.result.available ? "bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)"}`}>
                    {check.result.available ? "Available" : "Taken"}
                  </span>
                </div>
              </div>
              {check.result.available && (
                <div className="text-right">
                  <p className="text-lg font-bold tracking-[-.03em]">{formatRupiah(usdToIdr(check.result.price))}</p>
                  <p className="text-[10px] text-(--crm-muted)">/ year · ${check.result.price}</p>
                </div>
              )}
            </div>

            {check.result.available && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <PriceCell label="Renewal" value={formatRupiah(usdToIdr(check.result.renewalPrice))} />
                  <PriceCell label="Transfer" value={formatRupiah(usdToIdr(check.result.transferPrice))} />
                </div>
                <button onClick={openSave} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark)">
                  <Save size={14} />Save as asset
                </button>
              </>
            )}

            {check.result.premium && <p className="rounded-xl bg-(--crm-soft) px-3 py-2 text-[11px] leading-5 text-(--crm-secondary)">Premium domain — price may differ at checkout.</p>}
            {check.result.suggestedDomain && <p className="text-[11px] text-(--crm-muted)">Suggestion: {check.result.suggestedDomain}</p>}
            {check.result.ttlRemaining != null && check.result.ttlRemaining > 0 && <p className="text-[10px] text-(--crm-faint)">Rate limit: {check.result.ttlRemaining}s left</p>}
          </div>
        )}
      </div>

      <div className="crm-rise rounded-2xl border border-(--crm-border) bg-(--crm-panel) lg:col-span-2">
        <div className="flex flex-col gap-4 border-b border-(--crm-border) p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--crm-st-draft-bg) text-(--crm-st-draft-text)"><Tag size={16} /></div>
              <div><h3 className="font-semibold tracking-[-.02em]">TLD price list</h3><p className="mt-0.5 text-[11px] text-(--crm-muted)">1-year prices in Rupiah · kurs Rp{rate.toLocaleString("id-ID")}</p></div>
            </div>
          </div>
          <div className="relative sm:w-[220px]">
            <Search size={15} className="absolute left-3 top-2.5 text-(--crm-faint)" />
            <input value={tldQuery} onChange={(event) => setTldQuery(event.target.value)} placeholder="Filter TLDs..." className="h-9 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" />
          </div>
        </div>

        {pricingError && (
          <div className="flex items-start gap-2 p-5">
            <XCircle size={15} className="mt-0.5 shrink-0 text-(--crm-danger)" />
            <p className="text-xs leading-5 text-(--crm-danger)">{pricingError}</p>
          </div>
        )}

        {!pricing && !pricingError && (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-(--crm-hover)" />)}
          </div>
        )}

        {pricing && filteredTlds.length === 0 && (
          <div className="p-12 text-center"><Search size={24} className="mx-auto text-(--crm-faint)" /><p className="mt-3 text-sm font-semibold">No TLDs match &quot;{tldQuery}&quot;</p></div>
        )}

        {pricing && filteredTlds.length > 0 && (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-(--crm-panel)">
                <tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">
                  <th className="px-6 py-3">Extension</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Renewal</th>
                  <th className="px-6 py-3">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {filteredTlds.map((tld) => {
                  const p = pricing[tld];
                  return (
                    <tr key={tld} className="border-t border-(--crm-border-soft)">
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">.{tld}</span>
                          {POPULAR_TLD_SET.has(tld) && (
                            <span className="flex items-center gap-1 rounded-full bg-(--crm-soft) px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] text-(--crm-secondary)"><Sparkles size={9} />Popular</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium">{formatRupiah(usdToIdr(p?.registration ?? ""))}</td>
                      <td className="px-4 py-2.5 text-sm text-(--crm-secondary)">{formatRupiah(usdToIdr(p?.renewal ?? ""))}</td>
                      <td className="px-6 py-2.5 text-sm text-(--crm-secondary)">{formatRupiah(usdToIdr(p?.transfer ?? ""))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pricing && <div className="border-t border-(--crm-border) p-4 text-center text-[11px] text-(--crm-faint)">Prices from Porkbun API, converted at Rp{rate.toLocaleString("id-ID")}/USD · may differ at checkout · {Object.keys(pricing).length} TLDs</div>}
      </div>

      {showSave && saveForm && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={() => { if (!saving) setShowSave(false); }} />
          <div className="crm-rise relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel) shadow-2xl">
            <div className="flex items-start justify-between border-b border-(--crm-border) p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-(--crm-brand)">Price Finder</p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-.02em]">Save as domain asset</h3>
              </div>
              <button onClick={() => { if (!saving) setShowSave(false); }} className="rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="space-y-3">
                <Field label="Domain name" icon={Globe}><input value={saveForm.name} onChange={(event) => setSaveForm({ ...saveForm, name: event.target.value })} className={inputCls} /></Field>
                <Field label="Owner / Customer *" icon={Building2}><CustomerSearch customers={customers} value={saveForm.customerId} onChange={(customerId) => setSaveForm({ ...saveForm, customerId })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Harga modal (Rp)" icon={Tag}><NumberInput value={saveForm.price} onChange={(v) => setSaveForm({ ...saveForm, price: v })} min={0} placeholder="0" className={inputCls} /></Field>
                  <Field label="Harga jual (Rp)" icon={Tag}><NumberInput value={saveForm.sellPrice} onChange={(v) => setSaveForm({ ...saveForm, sellPrice: v })} min={0} placeholder="0" className={inputCls} /></Field>
                </div>
                <Field label="Provider" icon={Building2}><input value={saveForm.provider} onChange={(event) => setSaveForm({ ...saveForm, provider: event.target.value })} className={inputCls} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Active from" icon={CalendarDays}><input type="date" value={saveForm.startDate} onChange={(event) => setSaveForm({ ...saveForm, startDate: event.target.value })} className={inputCls} /></Field>
                  <Field label="Expires on" icon={CalendarDays}><input type="date" value={saveForm.expiryDate} onChange={(event) => setSaveForm({ ...saveForm, expiryDate: event.target.value })} className={inputCls} /></Field>
                </div>
                {saveError && <p className="rounded-lg border border-(--crm-danger-border) bg-(--crm-danger-bg) px-3 py-2 text-xs font-medium text-(--crm-danger)">{saveError}</p>}
                {saveForm.price > 0 && saveForm.sellPrice > 0 && (
                  <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${saveForm.sellPrice >= saveForm.price ? "bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : "bg-(--crm-st-cancel-bg) text-(--crm-st-cancel-text)"}`}>
                    Margin: {formatRupiah(saveForm.sellPrice - saveForm.price)} ({saveForm.price > 0 ? Math.round(((saveForm.sellPrice - saveForm.price) / saveForm.price) * 100) : 0}%)
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 border-t border-(--crm-border) p-4">
              <button onClick={() => { if (!saving) setShowSave(false); }} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) hover:bg-(--crm-hover)">Cancel</button>
              <button onClick={confirmSave} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--crm-dark) disabled:opacity-60"><Save size={14} />Save asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";

function Field({ label, icon: Icon, children }: { label: string; icon?: typeof Globe; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">{Icon && <Icon size={12} />}{label}</span>
      {children}
    </label>
  );
}

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
