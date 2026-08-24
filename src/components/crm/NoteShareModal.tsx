"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2, X } from "lucide-react";

export function NoteShareModal({
  noteId,
  noteTitle,
  onClose,
}: {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create share token
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docType: "note", docId: noteId }),
        });
        if (!res.ok) throw new Error("Failed to create share");
        const data = (await res.json()) as { token: string };
        setToken(data.token);
      } catch {
        setError("Could not create the share link. Please try again.");
      }
    })();
  }, [noteId]);

  // Generate QR code when token is ready
  useEffect(() => {
    if (!token) return;
    const url = `${window.location.origin}/share/note/${token}`;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => {});
  }, [token]);

  const shareUrl = token ? `${window.location.origin}/share/note/${token}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
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
            <h3 className="text-base font-semibold tracking-[-.02em] text-(--crm-fg)">Share note</h3>
            <p className="mt-0.5 text-sm text-(--crm-muted)">Anyone with this link can view the note.</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="mt-5 flex flex-col items-center">
          {qrDataUrl ? (
            <div className="rounded-xl border border-(--crm-border-input) bg-white p-3 shadow-sm">
              <img src={qrDataUrl} alt="QR Code to share note" width={180} height={180} className="block" />
            </div>
          ) : token ? (
            <div className="flex h-[186px] w-[186px] items-center justify-center rounded-xl border border-(--crm-border-input) bg-(--crm-surface)">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" />
            </div>
          ) : (
            <div className="flex h-[186px] w-[186px] items-center justify-center rounded-xl border border-(--crm-border-input) bg-(--crm-surface)">
              <span className="text-xs text-(--crm-muted)">Creating link…</span>
            </div>
          )}
          <p className="mt-2 text-[11px] text-(--crm-faint)">Scan to open on mobile</p>
        </div>

        {/* Copy link */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Public link</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-(--crm-border-input) bg-(--crm-surface) p-2 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-(--crm-secondary)">{token ? shareUrl : "Creating link…"}</code>
            {token && (
              <button onClick={copyLink} className="flex shrink-0 items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1.5 text-[11px] font-semibold text-(--crm-brand) hover:bg-(--crm-hover)">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </div>

        {error && <p className="mt-3 rounded-xl bg-(--crm-danger-bg) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</p>}

        <button onClick={onClose} className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-(--crm-primary) text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark)">Done</button>
      </div>
    </div>
  );
}
