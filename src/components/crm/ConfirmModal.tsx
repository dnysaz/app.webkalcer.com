"use client";

import { AlertTriangle, X } from "lucide-react";

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="crm-rise relative w-full max-w-sm rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={16} /></button>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--crm-danger-bg) text-(--crm-danger)"><AlertTriangle size={18} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-[-.02em] text-(--crm-fg)">{title}</h3>
            {message && <p className="mt-1 text-sm leading-6 text-(--crm-muted)">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-(--crm-border) bg-(--crm-surface) py-2.5 text-sm font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)">{cancelLabel}</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-(--crm-danger) py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--crm-danger-hover)">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
