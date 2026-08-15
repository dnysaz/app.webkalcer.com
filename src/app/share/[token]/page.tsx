"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import type { Customer, Invoice, PaymentSettings, Quote } from "@/lib/crm";
import { ShareDocPaper } from "@/components/share/ShareDocPaper";
import { THEMES, THEME_VAR_KEYS } from "@/lib/settings";
import type { ThemeKey } from "@/lib/settings";

type DocData = {
  docType: "invoice" | "quote";
  doc: Invoice | Quote;
  customer?: Customer;
  payment?: PaymentSettings | null;
};

// Cache also remembers the passcode so the page can silently re-verify on every
// load — this keeps the document (QRIS, bank accounts, invoice/quote content)
// fresh whenever the admin updates anything.
type CachedData = DocData & { passcode: string };

const cacheKey = (token: string) => `wcrm-share:v3:${token}`;

function readCache(token: string): CachedData | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData;
    return typeof parsed.passcode === "string" && parsed.passcode ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(token: string, data: CachedData) {
  try {
    window.sessionStorage.setItem(cacheKey(token), JSON.stringify(data));
  } catch {
    // storage blocked — ignore
  }
}

function clearCache(token: string) {
  try {
    window.sessionStorage.removeItem(cacheKey(token));
  } catch {
    // storage blocked — ignore
  }
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);

  // Apply the admin's saved theme so the shared document follows the brand.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { theme?: ThemeKey }) => {
        if (data.theme && THEMES[data.theme]) {
          const colors = THEMES[data.theme];
          const root = document.documentElement;
          for (const key of THEME_VAR_KEYS) {
            root.style.setProperty(`--crm-${key}`, colors[key]);
          }
        }
      })
      .catch(() => {
        // keep defaults
      });
  }, []);
  const [stage, setStage] = useState<"loading" | "locked" | "ready" | "missing">("loading");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<DocData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { token: resolved } = await params;
      setToken(resolved);
      const cached = readCache(resolved);
      if (cached) {
        // Re-verify against the server on every load so edits made by the admin
        // (QRIS, bank accounts, invoice/quote content) show up on reload.
        try {
          const res = await fetch(`/api/shares/${resolved}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passcode: cached.passcode }),
          });
          if (res.ok) {
            const payload = (await res.json()) as DocData;
            writeCache(resolved, { ...payload, passcode: cached.passcode });
            setData(payload);
            setStage("ready");
            return;
          }
          if (res.status === 404) {
            clearCache(resolved);
            setStage("missing");
            return;
          }
          // Passcode no longer valid (e.g. customer ID changed) — ask again.
          clearCache(resolved);
          setStage("locked");
          return;
        } catch {
          // Offline / server hiccup — fall back to the cached document.
          setData(cached);
          setStage("ready");
          return;
        }
      }
      try {
        const res = await fetch(`/api/shares/${resolved}`);
        if (!res.ok) {
          setStage("missing");
          return;
        }
        setStage("locked");
      } catch {
        setStage("missing");
      }
    })();
  }, [params]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !passcode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/shares/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      if (!res.ok) {
        setError("Wrong passcode. Please check the customer ID with the sender.");
        return;
      }
      const payload = (await res.json()) as DocData;
      writeCache(token, { ...payload, passcode: passcode.trim() });
      setData(payload);
      setStage("ready");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--crm-bg)">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" />
      </div>
    );
  }

  if (stage === "missing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--crm-bg) px-4">
        <div className="w-full max-w-sm rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--crm-danger-bg) text-(--crm-danger)"><Lock size={20} /></div>
          <h1 className="mt-4 text-lg font-semibold text-(--crm-fg)">Link not found</h1>
          <p className="mt-1 text-sm text-(--crm-secondary)">This share link is invalid or no longer available.</p>
        </div>
      </div>
    );
  }

  if (stage === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--crm-bg) px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--crm-primary) text-(--crm-accent)"><Lock size={24} /></div>
            <h1 className="mt-4 text-lg font-semibold tracking-[-.02em] text-(--crm-fg)">This document is protected</h1>
            <p className="mt-1 text-sm leading-6 text-(--crm-secondary)">Enter the customer ID to open the document.</p>
          </div>
          <form onSubmit={unlock} className="mt-6 space-y-3">
            <input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Cust ID · webk-…"
              autoFocus
              className="h-12 w-full rounded-xl border border-(--crm-border-input) bg-(--crm-surface) px-4 text-center font-mono text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)"
            />
            {error && <p className="rounded-xl bg-(--crm-danger-bg) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--crm-primary) text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
              <ShieldCheck size={16} />{busy ? "Checking..." : "Open document"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-(--crm-bg) px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
        <div className="flex w-full items-center justify-between text-[11px] text-(--crm-muted)">
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-(--crm-mid)" />Verified document</span>
          <span>webkalcerCRM · webkalcer.com</span>
        </div>
        <ShareDocPaper docType={data.docType} doc={data.doc} customer={data.customer} payment={data.payment} />
        <p className="text-[11px] text-(--crm-muted)">Generated by webkalcerCRM · CRM by webkalcer.com</p>
      </div>
    </div>
  );
}
