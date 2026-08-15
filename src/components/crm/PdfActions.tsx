"use client";

import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import type { jsPDF } from "jspdf";
import { downloadPdf, printPdf } from "@/lib/pdf";

export function PdfActions({
  build,
  filename,
  compact = false,
}: {
  build: () => jsPDF | Promise<jsPDF>;
  filename: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const base = compact
    ? "rounded-xl border border-(--crm-border-input) p-2 text-(--crm-brand) hover:bg-(--crm-hover)"
    : "rounded-xl border border-(--crm-border-input) px-3 py-2.5 text-sm font-semibold text-(--crm-brand) hover:bg-(--crm-hover)";

  async function handle(action: "print" | "download") {
    setBusy(true);
    try {
      const doc = await build();
      if (action === "print") printPdf(doc);
      else downloadPdf(doc, filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => void handle("print")} disabled={busy} className={`${base} disabled:cursor-not-allowed disabled:opacity-60`} aria-label="Print"><Printer size={15} className="inline sm:mr-1.5" /><span className="hidden sm:inline">Print</span></button>
      <button onClick={() => void handle("download")} disabled={busy} className={`${base} disabled:cursor-not-allowed disabled:opacity-60`} aria-label="Download PDF"><FileDown size={15} className="inline sm:mr-1.5" /><span className="hidden sm:inline">Download PDF</span></button>
    </>
  );
}
