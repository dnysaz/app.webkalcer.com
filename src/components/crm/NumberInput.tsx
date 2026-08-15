"use client";

import { useState } from "react";

/** Parse Indonesian-style numbers: "." = thousands separator, "," = decimal. */
function parseNumeric(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (cleaned === "" || cleaned === "-") return Number.NaN;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isNaN(n) ? Number.NaN : n;
}

function formatNumeric(value: number): string {
  if (Number.isNaN(value)) return "";
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function NumberInput({ value, onChange, min, max, placeholder, title, className, disabled }: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatNumeric(value));
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      title={title}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        if (raw.trim() === "") { onChange(0); return; }
        const n = parseNumeric(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        if (text.trim() === "") return;
        const n = parseNumeric(text);
        if (Number.isNaN(n)) return;
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
        setText(formatNumeric(clamped));
        onChange(clamped);
      }}
      className={className}
    />
  );
}
