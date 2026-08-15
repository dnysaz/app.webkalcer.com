"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function RightDrawer({
  onClose,
  eyebrow,
  title,
  children,
  footer,
  widthClass = "sm:w-[560px]",
}: {
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={`crm-slide-in relative flex max-w-full flex-col border-l border-(--crm-border) bg-(--crm-panel) shadow-2xl ${widthClass}`}>
        <div className="flex shrink-0 items-start justify-between border-b border-(--crm-border) p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-(--crm-brand)">{eyebrow}</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-.02em]">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="flex shrink-0 items-center gap-2 border-t border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">{footer}</div>}
      </aside>
    </div>
  );
}