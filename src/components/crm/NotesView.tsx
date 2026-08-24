"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  FileDown,
  FileText,
  FileImage,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Plus,
  Redo2,
  Search,
  StickyNote,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { NoteShareModal } from "@/components/crm/NoteShareModal";
import type { Note } from "@/lib/crm";
import { formatDate, uid } from "@/lib/crm";

const DRAFT_KEY = "webkalcer:notes:draft";

type NoteDraft = {
  id: string | null;
  title: string;
  content: string;
};

function readDraft(): NoteDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as NoteDraft;
    if (draft && typeof draft.title === "string" && typeof draft.content === "string") return draft;
    return null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage blocked — ignore
  }
}

function toPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

// Convert legacy plain-text content (\n line breaks) into HTML block elements
// so old notes render as separate lines inside the contentEditable editor.
function toHtmlBlocks(html: string): string {
  if (/<\/?[a-z][\s\S]*>/i.test(html)) return html;
  if (!html.trim()) return "";
  return html
    .split(/\r?\n/)
    .map((line) => `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</div>`)
    .join("");
}

function snippet(note: Note): string {
  const flat = toPlainText(note.content);
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

export function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useCrm();
  const [editor, setEditor] = useState<NoteDraft | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [shareNote, setShareNote] = useState<{ id: string; title: string } | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const savedTimer = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Resume a non-empty draft after refresh / navigation.
  useEffect(() => {
    const draft = readDraft();
    if (draft && (draft.title || draft.content)) {
      // One-time sync of persisted draft from localStorage (external system) into React state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditor(draft);
    }
  }, []);

  // Auto-save draft to localStorage on every keystroke.
  useEffect(() => {
    if (!editor) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(editor));
    } catch {
      // storage full or blocked — ignore
    }
  }, [editor]);

  // Sync the contentEditable node with the note being edited (avoids resetting
  // the caret on every keystroke by not binding innerHTML through React).
  // Enter inserts a new block line natively; legacy plain-text content is
  // converted to blocks so its saved \n breaks show up as separate lines.
  useEffect(() => {
    const node = contentRef.current;
    if (!node || !editor) return;
    const display = toHtmlBlocks(editor.content);
    if (node.innerHTML !== display) {
      node.innerHTML = display;
    }
    // Intentionally runs only when the edited note changes, not per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor?.id]);

  useEffect(() => () => {
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
  }, []);

  // ESC key exits fullscreen
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [notes],
  );

  // Realtime search: filters only once the query reaches 3 characters.
  const query = search.trim();
  const visibleNotes = useMemo(() => {
    if (query.length < 3) return sortedNotes;
    const q = query.toLowerCase();
    return sortedNotes.filter(
      (note) => note.title.toLowerCase().includes(q) || toPlainText(note.content).toLowerCase().includes(q),
    );
  }, [sortedNotes, query]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function markSaved() {
    setDraftSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setDraftSaved(false), 1500);
  }

  function updateDraft(patch: Partial<Pick<NoteDraft, "title" | "content">>) {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
    markSaved();
  }

  function openNote(note: Note) {
    setEditor({ id: note.id, title: note.title, content: note.content });
  }

  function openNew() {
    setEditor({ id: null, title: "", content: "" });
  }

  function exec(command: string, value?: string) {
    contentRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // unsupported command — ignore
    }
    const node = contentRef.current;
    if (node && node.innerHTML !== editor?.content) {
      updateDraft({ content: node.innerHTML });
    }
  }

  /** Save the current note (if non-empty) then open a blank note. */
  function handleNewNote() {
    if (!editor) return;
    const title = editor.title.trim();
    const content = editor.content.trim();
    clearDraft();
    if (title || toPlainText(content)) {
      const now = new Date().toISOString();
      const finalTitle = title || "Untitled note";
      if (editor.id) {
        const existing = notes.find((n) => n.id === editor.id);
        if (existing) {
          updateNote({ ...existing, title: finalTitle, content, updatedAt: now });
        }
      } else {
        addNote({ id: uid(), title: finalTitle, content, createdAt: now, updatedAt: now });
      }
      announce("Note saved");
    }
    setEditor({ id: null, title: "", content: "" });
  }

  function downloadTxt() {
    if (!editor) return;
    const title = editor.title.trim() || "Untitled note";
    const plain = toPlainText(editor.content) || " ";
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveMenuOpen(false);
    announce("Saved as .txt");
  }

  async function downloadPdf() {
    if (!editor) return;
    const { buildNotePdf, downloadPdf } = await import("@/lib/pdf");
    const doc = await buildNotePdf({
      title: editor.title || "Untitled note",
      content: editor.content,
    });
    downloadPdf(doc, `${editor.title.trim() || "Untitled note"}.pdf`);
    setSaveMenuOpen(false);
    announce("Saved as PDF");
  }

  async function downloadWord() {
    if (!editor) return;
    const { buildNoteDocxBlob } = await import("@/lib/docx");
    const blob = await buildNoteDocxBlob({
      title: editor.title || "Untitled note",
      content: editor.content,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${editor.title.trim() || "Untitled note"}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveMenuOpen(false);
    announce("Saved as Word");
  }

  function handleShare() {
    if (!editor) return;
    // Save the note first so it exists in the DB before sharing
    const title = editor.title.trim();
    const content = editor.content.trim();
    if (!title && !toPlainText(content)) {
      announce("Write something before sharing");
      return;
    }
    const now = new Date().toISOString();
    const finalTitle = title || "Untitled note";
    let noteId = editor.id;
    if (editor.id) {
      const existing = notes.find((n) => n.id === editor.id);
      if (existing) {
        updateNote({ ...existing, title: finalTitle, content, updatedAt: now });
      }
    } else {
      noteId = uid();
      addNote({ id: noteId, title: finalTitle, content, createdAt: now, updatedAt: now });
    }
    clearDraft();
    setEditor({ id: noteId, title: finalTitle, content });
    setShareNote({ id: noteId!, title: finalTitle });
  }

  // Save to the database, then go back to the grid.
  function handleBack() {
    if (!editor) return;
    const title = editor.title.trim();
    const content = editor.content.trim();
    clearDraft();
    if (!title && !toPlainText(content)) {
      setEditor(null);
      return;
    }
    const now = new Date().toISOString();
    const finalTitle = title || "Untitled note";
    if (editor.id) {
      const existing = notes.find((n) => n.id === editor.id);
      if (existing) {
        updateNote({ ...existing, title: finalTitle, content, updatedAt: now });
        announce("Note saved");
      }
    } else {
      addNote({ id: uid(), title: finalTitle, content, createdAt: now, updatedAt: now });
      announce("Note saved");
    }
    setEditor(null);
  }

  const confirmModal = confirmDelete && (
    <ConfirmModal
      title={`Delete "${confirmDelete.title || "Untitled note"}"?`}
      message="This action cannot be undone."
      onClose={() => setConfirmDelete(null)}
      onConfirm={() => {
        deleteNote(confirmDelete.id);
        if (editor?.id === confirmDelete.id) {
          clearDraft();
          setEditor(null);
        }
        announce("Note deleted");
        setConfirmDelete(null);
      }}
    />
  );

  // ---------------- Editor (MS Word style paper) ----------------
  if (editor) {
    // ---- Fullscreen mode ----
    if (fullscreen) {
      const fsToolbarBtn = "flex items-center justify-center rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700";
      const fsSep = "my-1 w-6 h-px bg-gray-200";
      return (
        <div className="fixed inset-0 z-[80] flex bg-white">
          {/* Vertical toolbar — left side */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-100 py-4">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={fsToolbarBtn} title="Bold"><Bold size={17} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={fsToolbarBtn} title="Italic"><Italic size={17} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={fsToolbarBtn} title="Underline"><Underline size={17} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")} className={fsToolbarBtn} title="Strikethrough"><Strikethrough size={17} /></button>
            <div className={fsSep} />
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={fsToolbarBtn} title="Bullet list"><List size={17} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className={fsToolbarBtn} title="Numbered list"><ListOrdered size={17} /></button>
            <div className={fsSep} />
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")} className={fsToolbarBtn} title="Undo"><Undo2 size={17} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")} className={fsToolbarBtn} title="Redo"><Redo2 size={17} /></button>
            {/* Spacer pushes exit to bottom */}
            <div className="flex-1" />
            <div className={fsSep} />
            <button onClick={() => setFullscreen(false)} className={fsToolbarBtn} title="Exit fullscreen (Esc)"><Minimize2 size={17} /></button>
          </div>

          {/* Paper centered */}
          <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-10 sm:px-10">
            <div className="flex w-full max-w-[780px] flex-col">
              {/* Title */}
              <input
                value={editor.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                placeholder="Untitled note"
                maxLength={160}
                className="w-full bg-transparent text-4xl font-bold tracking-tight text-gray-900 outline-none placeholder:text-gray-300 sm:text-5xl"
              />
              <div className="my-6 h-px bg-gray-100" />
              {/* Content */}
              <div
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-ph="Start writing…"
                onInput={(event) => updateDraft({ content: (event.currentTarget as HTMLDivElement).innerHTML })}
                className="note-editor min-h-[50vh] w-full bg-transparent text-lg leading-9 text-gray-800 outline-none [&_div]:mb-1 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>
          </div>

          {/* Toast */}
          {toast && <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
        </div>
      );
    }

    // ---- Normal editor ----
    return (
      <CrmShell title="Notes" subtitle="Project notes">
        <div className="crm-rise mx-auto flex w-full max-w-5xl flex-col items-center">
          <style>{`
            .note-editor:empty::before { content: attr(data-ph); color: var(--crm-placeholder); pointer-events: none; }
          `}</style>
          {/* Toolbar */}
          <div className="mb-4 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-2 rounded-xl border border-(--crm-border) bg-(--crm-panel) px-2 py-1.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-0.5">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Bold" aria-label="Bold"><Bold size={15} /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Italic" aria-label="Italic"><Italic size={15} /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Underline" aria-label="Underline"><Underline size={15} /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Strikethrough" aria-label="Strikethrough"><Strikethrough size={15} /></button>
              <span className="mx-1 h-5 w-px bg-(--crm-border)" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Bullet list" aria-label="Bullet list"><List size={15} /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Numbered list" aria-label="Numbered list"><ListOrdered size={15} /></button>
              <span className="mx-1 h-5 w-px bg-(--crm-border)" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Undo" aria-label="Undo"><Undo2 size={15} /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")} className="rounded-lg p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-fg)" title="Redo" aria-label="Redo"><Redo2 size={15} /></button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleNewNote} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border) bg-(--crm-surface) px-3 py-1.5 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" title="Save current & new note"><Plus size={14} />New Note</button>
              {editor.id && (
                <button onClick={handleShare} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border) bg-(--crm-surface) px-3 py-1.5 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" title="Share note"><Link2 size={14} />Share</button>
              )}
              <div className="relative">
                <button onClick={() => setSaveMenuOpen(!saveMenuOpen)} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border) bg-(--crm-surface) px-3 py-1.5 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" title="Save as"><FileDown size={14} />Save <ChevronDown size={12} /></button>
                {saveMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[55]" onClick={() => setSaveMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-[56] mt-1 w-44 rounded-xl border border-(--crm-border) bg-(--crm-panel) py-1 shadow-xl">
                      <button onClick={downloadWord} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-(--crm-fg) hover:bg-(--crm-hover)"><FileText size={14} />Save as Word</button>
                      <button onClick={downloadPdf} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-(--crm-fg) hover:bg-(--crm-hover)"><FileImage size={14} />Save as PDF</button>
                      <button onClick={downloadTxt} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-(--crm-fg) hover:bg-(--crm-hover)"><FileDown size={14} />Save as TXT</button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setFullscreen(true)} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border) bg-(--crm-surface) px-2.5 py-1.5 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" title="Fullscreen"><Maximize2 size={14} /></button>
              <button onClick={handleBack} className="flex items-center gap-1.5 rounded-lg bg-(--crm-primary) px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg(--crm-dark)"><ArrowLeft size={14} />Back</button>
            </div>
          </div>

          {/* A4 paper */}
          <div className="w-full max-w-[820px]">
            <div className="flex aspect-[210/297] w-full flex-col rounded-[3px] border border-(--crm-border-soft) bg-white p-8 shadow-[0_2px_8px_rgba(0,0,0,.05),0_24px_56px_rgba(0,0,0,.14)] sm:p-12">
              <div className="flex items-center justify-end gap-3">
                <span className={`text-xs font-medium text-(--crm-muted) transition-opacity ${draftSaved ? "opacity-100" : "opacity-0"}`}>Auto-saved locally</span>
                {editor.id && (
                  <button onClick={() => setConfirmDelete({ id: editor.id!, title: editor.title })} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-(--crm-danger) transition-colors hover:bg-(--crm-danger-bg)"><Trash2 size={14} />Delete</button>
                )}
              </div>
              <input
                value={editor.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                placeholder="Untitled note"
                maxLength={160}
                className="w-full bg-transparent text-3xl font-semibold tracking-[-.04em] text-(--crm-fg) outline-none placeholder:text-(--crm-placeholder) sm:text-4xl"
              />
              <div className="my-6 h-px bg-(--crm-border-soft)" />
              <div
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-ph="Start writing your project note here…"
                onInput={(event) => updateDraft({ content: (event.currentTarget as HTMLDivElement).innerHTML })}
                className="note-editor min-h-0 w-full flex-1 overflow-y-auto bg-transparent text-base leading-8 text-(--crm-fg) outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>
          </div>
        </div>
        {confirmModal}
        {shareNote && (
          <NoteShareModal
            noteId={shareNote.id}
            noteTitle={shareNote.title}
            onClose={() => setShareNote(null)}
          />
        )}
        {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
      </CrmShell>
    );
  }

  // ---------------- Grid view ----------------
  return (
    <CrmShell title="Notes" subtitle="Project notes">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Project notes</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">{query.length >= 3 ? `${visibleNotes.length} ${visibleNotes.length === 1 ? "match" : "matches"} for "${query}"` : `${sortedNotes.length} ${sortedNotes.length === 1 ? "note" : "notes"} to manage your projects.`}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-muted)" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes…" className="w-full max-w-[240px] rounded-xl border border-(--crm-border-input) bg-(--crm-panel) py-2.5 pl-9 pr-3 text-sm text-(--crm-fg) outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-accent)" />
          </div>
          <button onClick={openNew} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md"><Plus size={16} />New Note</button>
        </div>
      </div>

      {sortedNotes.length === 0 ? (
        <div className="crm-rise mt-6 rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-24 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><StickyNote size={28} /></div>
          <p className="mt-5 text-sm font-semibold text-(--crm-fg)">No notes yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">This page is empty. Click <span className="font-semibold text-(--crm-brand)">New Note</span> in the top right to start writing your first project note.</p>
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="crm-rise mt-6 rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><Search size={24} /></div>
          <p className="mt-5 text-sm font-semibold text-(--crm-fg)">No notes found</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">Nothing matches <span className="font-semibold text-(--crm-brand)">&ldquo;{query}&rdquo;</span>. Try different keywords.</p>
        </div>
      ) : (
        <div className="crm-rise mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleNotes.map((note) => (
            <div key={note.id} onClick={() => openNote(note)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openNote(note); } }} className="group relative flex aspect-[3/4] cursor-pointer flex-col rounded-md border border-(--crm-border-soft) bg-white p-3 text-left transition-shadow duration-200 hover:shadow-[0_3px_10px_rgba(0,0,0,.10)]">
              <div className="flex items-start justify-between gap-1">
                <p className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-4 text-(--crm-fg)">{note.title || "Untitled note"}</p>
                <button onClick={(event) => { event.stopPropagation(); setConfirmDelete({ id: note.id, title: note.title }); }} className="shrink-0 rounded p-0.5 text-(--crm-muted) opacity-0 transition-opacity hover:bg-(--crm-danger-bg) hover:text-(--crm-danger) group-hover:opacity-100" aria-label="Delete note"><Trash2 size={13} /></button>
              </div>
              <div className="my-2.5 h-px bg-(--crm-border-soft)" />
              <p className="line-clamp-4 flex-1 text-[11px] leading-4 text-(--crm-muted)">{snippet(note) || "No content yet."}</p>
              <p className="mt-2.5 border-t border-(--crm-border-soft) pt-2 text-[9px] font-medium uppercase tracking-[.1em] text-(--crm-faint)">Updated {formatDate(note.updatedAt)}</p>
            </div>
          ))}
        </div>
      )}

      {confirmModal}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}
