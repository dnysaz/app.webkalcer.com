"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, X } from "lucide-react";

export function ShareButton({
  docType,
  docId,
  customerCode,
}: {
  docType: "invoice" | "quote";
  docId: string;
  customerCode: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-xl border border-(--crm-border-input) px-3 py-2.5 text-sm font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)" aria-label="Share link"><Link2 size={15} className="inline sm:mr-1.5" /><span className="hidden sm:inline">Share</span></button>
      {open && <ShareLinkModal docType={docType} docId={docId} customerCode={customerCode} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ShareLinkModal({
  docType,
  docId,
  customerCode,
  onClose,
}: {
  docType: "invoice" | "quote";
  docId: string;
  customerCode: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docType, docId }),
        });
        if (!res.ok) throw new Error("Failed to create share");
        const data = (await res.json()) as { token: string };
        setToken(data.token);
      } catch {
        setError("Could not create the share link. Please try again.");
      }
    })();
  }, [docType, docId]);

  const url = token ? `${window.location.origin}/share/${token}` : "";

  async function copy(text: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "link") {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        window.setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // clipboard blocked — ignore
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="crm-rise relative w-full max-w-md rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={16} /></button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-brand)"><Link2 size={18} /></div>
          <div>
            <h3 className="text-base font-semibold tracking-[-.02em] text-(--crm-fg)">Share {docType} link</h3>
            <p className="mt-0.5 text-sm text-(--crm-muted)">Your customer opens the link and enters the customer ID to view the document.</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Password · Customer ID</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-(--crm-border-input) bg-(--crm-surface) p-2 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-(--crm-fg)">{customerCode || "—"}</code>
            <button onClick={() => void copy(customerCode, "code")} className="flex shrink-0 items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">{copiedCode ? <Check size={13} /> : <Copy size={13} />}{copiedCode ? "Copied" : "Copy"}</button>
          </div>
          <p className="mt-1 text-[11px] text-(--crm-faint)">Share this ID with your customer so they can open the document.</p>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Public link</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-(--crm-border-input) bg-(--crm-surface) p-2 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-(--crm-secondary)">{token ? url : "Creating link…"}</code>
            {token && <button onClick={() => void copy(url, "link")} className="flex shrink-0 items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">{copiedLink ? <Check size={13} /> : <Copy size={13} />}{copiedLink ? "Copied" : "Copy"}</button>}
          </div>
        </div>

        {error && <p className="mt-3 rounded-xl bg-(--crm-danger-bg) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</p>}

        <button onClick={onClose} className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-(--crm-primary) text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark)">Done</button>
      </div>
    </div>
  );
}
