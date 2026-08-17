"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Phone, Search, UploadCloud, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import type { Contact, ContactStatus } from "@/lib/crm";
import { formatDate } from "@/lib/crm";

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  reached: "Reached",
  unreachable: "Not reachable",
};

export function ContactBookView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ContactStatus>("all");
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Contact[]) => {
        if (!cancelled) setContacts(data);
      })
      .catch(() => {
        // keep empty
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isVcf = file.name.toLowerCase().endsWith(".vcf") || file.name.toLowerCase().endsWith(".vcard");
    if (!isCsv && !isVcf) {
      announce("Please choose a .csv or .vcf file");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, fileName: file.name }),
      });
      const data = (await res.json()) as { contacts?: Contact[]; count?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const imported = data.contacts ?? [];
      setContacts((prev) => [...imported, ...prev]);
      announce(`${data.count ?? imported.length} contact${(data.count ?? imported.length) === 1 ? "" : "s"} imported`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setStatus(contact: Contact, status: ContactStatus) {
    const prev = contacts;
    setContacts((all) => all.map((c) => (c.id === contact.id ? { ...c, status } : c)));
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setContacts(prev);
      announce("Failed to update status");
    }
  }

  async function deleteContact(contact: Contact) {
    setContacts((all) => all.filter((c) => c.id !== contact.id));
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      announce("Contact deleted");
    } catch {
      setContacts((all) => (all.some((c) => c.id === contact.id) ? all : [contact, ...all]));
      announce("Failed to delete contact");
    }
    setConfirmDelete(null);
  }

  const query = search.trim().toLowerCase();
  const visible = contacts.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (!query) return true;
    return `${c.name} ${c.phone}`.toLowerCase().includes(query);
  });

  const reachedCount = contacts.filter((c) => c.status === "reached").length;
  const unreachableCount = contacts.filter((c) => c.status === "unreachable").length;

  return (
    <CrmShell title="Contact Book" subtitle="Contacts & outreach">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Contact Book</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Upload a CSV or vCard (.vcf) file — e.g. exported from Google Contacts on Android — to build your contact list, then track outreach status.</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv,.vcf,.vcard,text/vcard" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><UploadCloud size={16} />{busy ? "Importing..." : "Upload CSV / vCard"}</button>
      </div>

      {/* Stats */}
      <div className="crm-rise mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4">
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">Total contacts</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-.04em] text-(--crm-fg)">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4">
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">Reached</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tracking-[-.04em] text-(--crm-st-done-text)"><Check size={18} />{reachedCount}</p>
        </div>
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4">
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">Not reachable</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-.04em] text-(--crm-danger)">{unreachableCount}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="crm-rise mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone..." className="w-full rounded-xl border border-(--crm-border-input) bg-(--crm-panel) py-2.5 pl-9 pr-3 text-sm text-(--crm-fg) outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-accent)" />
        </div>
        <div className="flex gap-1 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-1">
          {(["all", "new", "reached", "unreachable"] as const).map((key) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === key ? "bg-(--crm-focus-ring) text-(--crm-text) shadow-sm" : "text-(--crm-muted) hover:text-(--crm-body)"}`}>
              {key === "all" ? "All" : STATUS_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="crm-rise mt-6 flex min-h-[30vh] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" />
        </div>
      ) : visible.length === 0 ? (
        <div className="crm-rise mt-6 rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><FileUp size={26} /></div>
          <p className="mt-5 text-sm font-semibold text-(--crm-fg)">{contacts.length === 0 ? "No contacts yet" : "No matching contacts"}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">{contacts.length === 0 ? "Upload a CSV or vCard (.vcf) file to get started." : "Try a different search or filter."}</p>
        </div>
      ) : (
        <div className="crm-rise mt-6 overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
          <div className="hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-4 py-4">Phone</th>
                  <th className="px-4 py-4">Imported</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((contact) => (
                  <tr key={contact.id} className="border-t border-(--crm-border-soft)">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-[11px] font-bold text-(--crm-fg)">{contact.name.slice(0, 2).toUpperCase()}</span>
                        <p className="text-sm font-semibold">{contact.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-(--crm-secondary)">{contact.phone}</td>
                    <td className="px-4 py-3.5 text-xs text-(--crm-muted)">{formatDate(contact.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <StatusChecks contact={contact} onStatus={(s) => void setStatus(contact, s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-(--crm-border-soft) md:hidden">
            {visible.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-[11px] font-bold text-(--crm-fg)">{contact.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{contact.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-(--crm-muted)">{contact.phone}</p>
                </div>
                <StatusChecks contact={contact} onStatus={(s) => void setStatus(contact, s)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void deleteContact(confirmDelete)}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

/** Two checkboxes: Reached / Not reachable, plus a delete button. */
function StatusChecks({ contact, onStatus }: { contact: Contact; onStatus: (status: ContactStatus) => void }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => onStatus(contact.status === "reached" ? "new" : "reached")}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${contact.status === "reached" ? "border-(--crm-st-done-text) bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : "border-(--crm-border-input) text-(--crm-muted) hover:bg-(--crm-hover)"}`}
        title="Mark as reached"
      >
        <Check size={13} className={contact.status === "reached" ? "opacity-100" : "opacity-0"} />Reached
      </button>
      <button
        onClick={() => onStatus(contact.status === "unreachable" ? "new" : "unreachable")}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${contact.status === "unreachable" ? "border-(--crm-danger) bg-(--crm-danger-bg) text-(--crm-danger)" : "border-(--crm-border-input) text-(--crm-muted) hover:bg-(--crm-hover)"}`}
        title="Mark as not reachable"
      >
        <X size={13} className={contact.status === "unreachable" ? "opacity-100" : "opacity-0"} />Not reachable
      </button>
      <button onClick={() => onStatus("new")} className="rounded-lg p-1.5 text-(--crm-faint) transition-colors hover:text-(--crm-danger)" title="Reset status" aria-label="Reset status">
        <Phone size={13} />
      </button>
    </div>
  );
}
