"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Customer } from "@/lib/crm";

const avatarTone: Record<string, string> = {
  Prospect: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Active: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Suspend: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Cancel: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  // legacy statuses (kept for old data)
  VIP: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
  Inactive: "bg-(--crm-avatar-bg) text-(--crm-avatar-text)",
};

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function CustomerSearch({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
}) {
  const selected = customers.find((c) => c.id === value) ?? null;
  const selectedLabel = selected ? (selected.businessName ? `${selected.name} — ${selected.businessName}` : selected.name) : "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? customers.filter((c) => `${c.name} ${c.businessName} ${c.email}`.toLowerCase().includes(q))
      : customers;
    return base.slice(0, 8);
  }, [customers, query]);

  function pick(customer: Customer) {
    setQuery(customer.businessName ? `${customer.name} — ${customer.businessName}` : customer.name);
    onChange(customer.id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-(--crm-faint)" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (event.target.value.trim() === "" && value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Type to search customer..."
          className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pl-9 pr-9 text-sm outline-none transition-colors focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)"
        />
        {value && (
          <button
            onClick={() => { setQuery(""); onChange(""); }}
            className="absolute right-2.5 top-2.5 text-(--crm-faint) hover:text-(--crm-danger)"
            aria-label="Clear customer"
          >
            <span className="text-xs font-semibold">✕</span>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-(--crm-border) bg-(--crm-panel) py-1 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-(--crm-muted)">No customers found.</p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                onMouseDown={(event) => { event.preventDefault(); pick(customer); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-(--crm-hover)"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarTone[customer.status]}`}>{initials(customer.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{customer.name}</span>
                  <span className="block truncate text-[11px] text-(--crm-muted)">{customer.businessName || customer.email || "No business"}</span>
                </span>
                {customer.id === value && <Check size={15} className="shrink-0 text-(--crm-brand)" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}