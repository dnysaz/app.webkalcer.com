"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Globe, Pencil, Search, Trash2, UploadCloud, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import type { Contact } from "@/lib/crm";

const PAGE_SIZE = 25;

export function ContactBookView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editHasWeb, setEditHasWeb] = useState(false);
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
      setPage(1);
      announce(`${data.count ?? imported.length} contact${(data.count ?? imported.length) === 1 ? "" : "s"} imported`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
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

  function openEdit(contact: Contact) {
    setEditing(contact);
    setEditName(contact.name);
    setEditPhone(contact.phone);
    setEditNote(contact.note);
    setEditHasWeb(contact.hasWeb);
  }

  async function saveEdit() {
    if (!editing) return;
    const name = editName.trim();
    const phone = editPhone.trim();
    if (!name || !phone) {
      announce("Name and phone are required");
      return;
    }
    const prev = contacts;
    setContacts((all) =>
      all.map((c) => (c.id === editing.id ? { ...c, name, phone, note: editNote.trim(), hasWeb: editHasWeb } : c)),
    );
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name, phone, note: editNote.trim(), hasWeb: editHasWeb }),
      });
      if (!res.ok) throw new Error("Failed to save");
      announce("Contact updated");
      setEditing(null);
    } catch {
      setContacts(prev);
      announce("Failed to update contact");
    }
  }

  const query = search.trim().toLowerCase();
  const visible = contacts.filter((c) => {
    if (filter === "yes" && !c.hasWeb) return false;
    if (filter === "no" && c.hasWeb) return false;
    if (!query) return true;
    return `${c.name} ${c.phone}`.toLowerCase().includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasWebCount = contacts.filter((c) => c.hasWeb).length;
  const noWebCount = contacts.filter((c) => !c.hasWeb).length;

  return (
    <CrmShell title="Contact Book" subtitle="Contacts & outreach">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Contact Book</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Upload a CSV or vCard (.vcf) file — e.g. exported from Google Contacts on Android — to build your contact list, then track whether each contact has a website.</p>
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
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">Have a web</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tracking-[-.04em] text-(--crm-st-done-text)"><Globe size={18} />{hasWebCount}</p>
        </div>
        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4">
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-(--crm-secondary)">No web yet</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-.04em] text-(--crm-danger)">{noWebCount}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="crm-rise mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-muted)" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or phone..." className="w-full rounded-xl border border-(--crm-border-input) bg-(--crm-panel) py-2.5 pl-9 pr-3 text-sm text-(--crm-fg) outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-accent)" />
        </div>
        <div className="flex gap-1 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-1">
          {(["all", "yes", "no"] as const).map((key) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === key ? "bg-(--crm-focus-ring) text-(--crm-text) shadow-sm" : "text-(--crm-muted) hover:text-(--crm-body)"}`}>
              {key === "all" ? "All" : key === "yes" ? "Have web" : "No web"}
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
                  <th className="px-4 py-4">Note</th>
                  <th className="px-6 py-4 text-right">Have a web</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((contact) => (
                  <tr key={contact.id} className="border-t border-(--crm-border-soft)">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-[11px] font-bold text-(--crm-fg)">{contact.name.slice(0, 2).toUpperCase()}</span>
                        <p className="text-sm font-semibold">{contact.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-(--crm-secondary)">{contact.phone}</td>
                    <td className="max-w-[280px] px-4 py-3.5">
                      <p className="line-clamp-1 text-xs text-(--crm-muted)">{contact.note || "—"}</p>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <HasWebBadge hasWeb={contact.hasWeb} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(contact)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Edit contact" aria-label="Edit contact"><Pencil size={14} /></button>
                        <button onClick={() => setConfirmDelete(contact)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-danger-bg) hover:text-(--crm-danger)" title="Delete contact" aria-label="Delete contact"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-(--crm-border-soft) md:hidden">
            {pageItems.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--crm-soft) text-[11px] font-bold text-(--crm-fg)">{contact.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    <HasWebBadge hasWeb={contact.hasWeb} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-(--crm-muted)">{contact.phone}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-(--crm-faint)">{contact.note || "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => openEdit(contact)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Edit contact" aria-label="Edit contact"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmDelete(contact)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-danger-bg) hover:text-(--crm-danger)" title="Delete contact" aria-label="Delete contact"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && visible.length > PAGE_SIZE && (
        <div className="crm-rise mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-(--crm-muted)">Showing {pageItems.length} of {visible.length} contacts</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-(--crm-border-input) px-3 py-1.5 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-semibold text-(--crm-fg)">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-(--crm-border-input) px-3 py-1.5 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
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
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="crm-fade-in absolute inset-0 bg-(--crm-dark)/40 backdrop-blur-[2px]" onClick={() => setEditing(null)} />
          <div className="crm-rise relative w-full max-w-md rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-6 shadow-2xl">
            <button onClick={() => setEditing(null)} className="absolute right-3 top-3 rounded-lg p-1 text-(--crm-muted) hover:bg-(--crm-hover)" aria-label="Close"><X size={16} /></button>
            <h3 className="text-base font-semibold tracking-[-.02em] text-(--crm-fg)">Edit contact</h3>
            <p className="mt-0.5 text-sm text-(--crm-muted)">Update the contact details.</p>
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Name</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Contact name" className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Phone</span>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number" className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 font-mono text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Have a web</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditHasWeb(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${editHasWeb ? "border-(--crm-st-done-text) bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : "border-(--crm-border-input) text-(--crm-muted) hover:bg-(--crm-hover)"}`}
                  >
                    <Globe size={14} />Yes
                  </button>
                  <button
                    onClick={() => setEditHasWeb(false)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${!editHasWeb ? "border-(--crm-danger) bg-(--crm-danger-bg) text-(--crm-danger)" : "border-(--crm-border-input) text-(--crm-muted) hover:bg-(--crm-hover)"}`}
                  >
                    <X size={14} />No
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Note</span>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Small note about this contact..." rows={3} className="w-full resize-none rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-(--crm-border) bg-(--crm-surface) py-2.5 text-sm font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)">Cancel</button>
              <button onClick={() => void saveEdit()} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark)">Save</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

/** Green "Yes" / gray "No" pill showing whether the contact has a website. */
function HasWebBadge({ hasWeb }: { hasWeb: boolean }) {
  return hasWeb ? (
    <span className="inline-flex items-center gap-1 rounded-lg border border-(--crm-st-done-text) bg-(--crm-st-done-bg) px-2.5 py-1 text-[11px] font-semibold text-(--crm-st-done-text)"><Globe size={12} />Yes</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-lg border border-(--crm-border-input) px-2.5 py-1 text-[11px] font-semibold text-(--crm-muted)">No</span>
  );
}