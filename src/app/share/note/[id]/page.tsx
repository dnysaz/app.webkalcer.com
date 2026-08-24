"use client";

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import type { Note } from "@/lib/crm";
import { THEMES, THEME_VAR_KEYS } from "@/lib/settings";
import type { ThemeKey } from "@/lib/settings";

function toHtmlBlocks(html: string): string {
  if (/<\/?[a-z][\s\S]*>/i.test(html)) return html;
  if (!html.trim()) return "";
  return html
    .split(/\r?\n/)
    .map((line) => `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</div>`)
    .join("");
}

export default function ShareNotePage({ params }: { params: Promise<{ id: string }> }) {
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { theme?: ThemeKey }) => {
        if (data.theme && THEMES[data.theme]) {
          const colors = THEMES[data.theme];
          const root = document.documentElement;
          for (const key of THEME_VAR_KEYS) {
            root.style.setProperty(`--crm-${key}`, colors[key]);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { id } = await params;
        const res = await fetch(`/api/shares/${id}`);
        if (!res.ok) {
          setError("Share link not found or has been revoked.");
          return;
        }
        const data = await res.json();
        if (data.docType === "note" && data.doc) {
          setNote(data.doc);
        } else {
          setError("This share link is not for a note.");
        }
      } catch {
        setError("Failed to load note.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="text-center">
          <StickyNote size={32} className="mx-auto text-gray-300" />
          <h1 className="mt-4 text-lg font-semibold text-gray-800">Note not found</h1>
          <p className="mt-1 text-sm text-gray-500">{error || "This note doesn't exist or has been deleted."}</p>
        </div>
      </div>
    );
  }

  const title = note.title || "Untitled note";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
        <div className="mt-8 text-base leading-8 text-gray-800 [&_div]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-blue-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: toHtmlBlocks(note.content) }} />
      </div>
    </div>
  );
}
