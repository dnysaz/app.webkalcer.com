"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { ConfirmModal } from "@/components/crm/ConfirmModal";
import { RightDrawer } from "@/components/crm/RightDrawer";
import type { ArticleLength, HumanizeData, SeoArticle, SeoData, SwotData } from "@/lib/crm";
import { formatDate, uid } from "@/lib/crm";
import { buildArticlePdf, downloadPdf } from "@/lib/pdf";
import { buildArticleDocxBlob } from "@/lib/docx";
import type { ArticleFormData } from "@/app/api/seo/article/route";
import type { ArticleStyle } from "@/app/api/seo/article/route";
import type { SeoGenResult } from "@/app/api/seo/optimize/route";
import type { SwotResult } from "@/app/api/seo/swot/route";
import type { HumanizeResult } from "@/app/api/seo/humanize/route";

type TabKey = "article" | "seo" | "swot";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "article", label: "Smart AI Article", icon: PenLine },
  { key: "seo", label: "AI SEO Gen", icon: Wand2 },
  { key: "swot", label: "SWOT Analysis", icon: Bot },
];

const LENGTHS: { key: ArticleLength; label: string; hint: string }[] = [
  { key: "short", label: "Short", hint: "300–500 words" },
  { key: "medium", label: "Medium", hint: "800–1200 words" },
  { key: "long", label: "Long", hint: "1800–2500 words" },
];

const STYLES: { key: ArticleStyle; label: string }[] = [
  { key: "casual", label: "Casual" },
  { key: "professional", label: "Professional" },
  { key: "news", label: "News" },
  { key: "humor", label: "Humor" },
  { key: "research", label: "Research" },
];

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
const areaCls = "w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">{children}</span>;
}

export function ContentSeoView() {
  const [tab, setTab] = useState<TabKey>("article");
  const [toast, setToast] = useState("");
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<SeoArticle | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<SeoArticle | null>(null);
  const [detail, setDetail] = useState<SeoArticle | null>(null);
  const [editingArticle, setEditingArticle] = useState<SeoArticle | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; keyword: string; content: string }>({ title: "", keyword: "", content: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [humanizeBusy, setHumanizeBusy] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Article form ----
  const [form, setForm] = useState<ArticleFormData>({ topic: "", description: "", length: "medium", style: "professional", keyword: "", links: "", language: "Indonesian" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ markdown: string; topic: string; length: ArticleLength; links: string; keyword: string } | null>(null);

  // ---- SEO tab ----
  const [seoArticleId, setSeoArticleId] = useState("");
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoResult, setSeoResult] = useState<SeoData | null>(null);

  // ---- SWOT tab ----
  const [swotArticleId, setSwotArticleId] = useState("");
  const [swotBusy, setSwotBusy] = useState(false);
  const [swotResult, setSwotResult] = useState<SwotData | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seo/articles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SeoArticle[]) => {
        if (!cancelled) setArticles(data);
      })
      .catch(() => {
        // keep empty
      })
      .finally(() => {
        if (!cancelled) setArticlesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedArticles = useMemo(
    () => [...articles].sort((a, b) => Number(b.updatedAt > a.updatedAt ? 1 : -1)),
    [articles],
  );

  const selectedArticle = useMemo(
    () => (tab === "seo" || tab === "swot" ? sortedArticles.find((a) => a.id === (tab === "seo" ? seoArticleId : swotArticleId)) ?? null : null),
    [tab, sortedArticles, seoArticleId, swotArticleId],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function set<K extends keyof ArticleFormData>(key: K, value: ArticleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function generateArticle() {
    setError("");
    if (!form.topic.trim()) {
      setError("Please enter an article topic.");
      return;
    }
    if (!form.description.trim()) {
      setError("Please describe the article in the description field.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/seo/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { markdown?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to generate the article.");
      setDraft({ markdown: data.markdown || "", topic: form.topic.trim(), length: form.length, links: form.links.trim(), keyword: form.keyword.trim() });
      setDraftMode(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveArticle() {
    if (!draft) return;
    setSaving("new");
    try {
      const now = new Date().toISOString();
      const article: SeoArticle = {
        id: uid(),
        title: draft.topic,
        content: draft.markdown,
        length: draft.length,
        links: draft.links,
        keyword: draft.keyword,
        seo: null,
        swot: null,
        humanize: null,
        verified: false,
        createdAt: now,
        updatedAt: now,
      };
      const res = await fetch("/api/seo/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article),
      });
      if (!res.ok) throw new Error("Failed to save");
      setArticles((prev) => [article, ...prev]);
      setDraftMode(false);
      setDraft(null);
      setTab("seo");
      setSeoArticleId(article.id);
      announce("Article saved");
    } catch {
      announce("Failed to save article");
    } finally {
      setSaving(null);
    }
  }

  async function runSeo() {
    if (!selectedArticle) return;
    setSeoBusy(true);
    setError("");
    try {
      const res = await fetch("/api/seo/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedArticle.title, content: selectedArticle.content, keyword: selectedArticle.keyword }),
      });
      const data = (await res.json()) as SeoGenResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to generate SEO.");
      const seo: SeoData = {
        title: data.title,
        description: data.description,
        hashtags: data.hashtags,
        preview: data.preview,
        score: data.score,
        notes: data.notes,
      };
      setSeoResult(seo);
      await persistSeo(selectedArticle.id, seo);
      announce("SEO generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSeoBusy(false);
    }
  }

  async function runSwot() {
    if (!selectedArticle) return;
    setSwotBusy(true);
    setError("");
    try {
      const res = await fetch("/api/seo/swot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedArticle.title, content: selectedArticle.content, keyword: selectedArticle.keyword }),
      });
      const data = (await res.json()) as SwotResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to generate SWOT.");
      const swot: SwotData = {
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        opportunities: data.opportunities,
        threats: data.threats,
        seoScore: data.seoScore,
        summary: data.summary,
      };
      setSwotResult(swot);
      await persistSwot(selectedArticle.id, swot);
      announce("SWOT generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSwotBusy(false);
    }
  }

  async function persistSeo(id: string, seo: SeoData) {
    setArticles((all) => all.map((a) => (a.id === id ? { ...a, seo } : a)));
    try {
      await fetch(`/api/seo/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seo }),
      });
    } catch {
      // keep local state; next save retries
    }
  }

  async function persistSwot(id: string, swot: SwotData) {
    setArticles((all) => all.map((a) => (a.id === id ? { ...a, swot } : a)));
    try {
      await fetch(`/api/seo/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swot }),
      });
    } catch {
      // keep local state
    }
  }

  /** Picking a different article resets the preview; shows stored result if already analyzed. */
  function selectForSeo(id: string) {
    setSeoArticleId(id);
    setSeoResult(id ? (sortedArticles.find((a) => a.id === id)?.seo ?? null) : null);
    setError("");
  }

  function selectForSwot(id: string) {
    setSwotArticleId(id);
    setSwotResult(id ? (sortedArticles.find((a) => a.id === id)?.swot ?? null) : null);
    setError("");
  }

  async function runHumanize(article: SeoArticle) {
    setError("");
    setHumanizeBusy(article.id);
    try {
      const res = await fetch("/api/seo/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: article.title, content: article.content }),
      });
      const data = (await res.json()) as HumanizeResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to assess the article.");
      const humanize: HumanizeData = {
        aiPercent: data.aiPercent,
        humanPercent: data.humanPercent,
        verdict: data.verdict,
        notes: data.notes,
      };
      const updated: SeoArticle = { ...article, humanize };
      setArticles((all) => all.map((a) => (a.id === article.id ? updated : a)));
      setDetail((d) => (d && d.id === article.id ? updated : d));
      try {
        await fetch(`/api/seo/articles/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ humanize }),
        });
      } catch {
        // keep local state
      }
      announce("Humanize score generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setHumanizeBusy(null);
    }
  }

  async function toggleVerify(article: SeoArticle) {
    const next = !article.verified;
    setArticles((all) => all.map((a) => (a.id === article.id ? { ...a, verified: next } : a)));
    try {
      const res = await fetch(`/api/seo/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: next }),
      });
      if (!res.ok) throw new Error("Failed");
      announce(next ? "Article verified" : "Verification removed");
    } catch {
      setArticles((all) => all.map((a) => (a.id === article.id ? { ...a, verified: article.verified } : a)));
      announce("Failed to update verification");
    }
    setVerifyTarget(null);
  }

  async function deleteArticle(article: SeoArticle) {
    setArticles((all) => all.filter((a) => a.id !== article.id));
    try {
      const res = await fetch(`/api/seo/articles/${article.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      announce("Article deleted");
    } catch {
      setArticles((all) => (all.some((a) => a.id === article.id) ? all : [article, ...all]));
      announce("Failed to delete article");
    }
    setConfirmDelete(null);
  }

  function openEditArticle(article: SeoArticle) {
    setEditingArticle(article);
    setEditForm({ title: article.title, keyword: article.keyword, content: article.content });
  }

  async function saveArticleEdit() {
    if (!editingArticle) return;
    const title = editForm.title.trim();
    const content = editForm.content.trim();
    if (!title || !content) {
      announce("Title and content are required");
      return;
    }
    setSavingEdit(true);
    try {
      const now = new Date().toISOString();
      const updated: SeoArticle = {
        ...editingArticle,
        title,
        keyword: editForm.keyword.trim(),
        content,
        updatedAt: now,
      };
      const res = await fetch(`/api/seo/articles/${editingArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keyword: updated.keyword, content }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setArticles((all) => all.map((a) => (a.id === editingArticle.id ? updated : a)));
      setDetail((d) => (d && d.id === editingArticle.id ? updated : d));
      setEditingArticle(null);
      announce("Article updated");
    } catch {
      announce("Failed to update article");
    } finally {
      setSavingEdit(false);
    }
  }

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      announce(message);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      announce("Could not copy. Select the text manually.");
    }
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce("Downloaded");
  }

  async function downloadWord(content: string, title: string) {
    try {
      const blob = await buildArticleDocxBlob({ title, content });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase().slice(0, 60)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      announce("Word document downloaded");
    } catch {
      announce("Failed to generate Word document");
    }
  }

  async function downloadArticlePdf(article: Pick<SeoArticle, "title" | "content" | "createdAt">, seo?: SeoData | null, swot?: SwotData | null) {
    try {
      const doc = await buildArticlePdf(article, seo, swot);
      downloadPdf(doc, `${article.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase().slice(0, 60)}.pdf`);
      announce("PDF downloaded");
    } catch {
      announce("Failed to generate PDF");
    }
  }

  function importMarkdownFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".md") && !file.name.toLowerCase().endsWith(".txt")) {
      announce("Please choose a .md or .txt file");
      return;
    }
    file.text().then((text) => {
      setForm((prev) => ({ ...prev, description: prev.description ? `${prev.description}\n\n[Lampiran] ${text.slice(0, 5000)}` : text.slice(0, 5000) }));
      announce("File content attached to the brief");
    });
  }

  const seoArticle = tab === "seo" ? selectedArticle : null;
  const swotArticle = tab === "swot" ? selectedArticle : null;

  return (
    <CrmShell title="Content & SEO" subtitle="Smart AI content tools">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Content & SEO</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Generate AI articles, SEO metadata, and SWOT analyses — then verify the results.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setError(""); }} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === key ? "bg-(--crm-focus-ring) text-(--crm-text) shadow-sm" : "text-(--crm-muted) hover:text-(--crm-body)"}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Smart AI Article */}
      {tab === "article" && (
        <div className="crm-rise mt-6 grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-text)"><PenLine size={16} /></div>
                <div>
                  <h3 className="text-sm font-semibold tracking-[-.01em]">Article brief</h3>
                  <p className="mt-0.5 text-xs text-(--crm-muted)">Describe the topic — Gemini writes the article.</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <Label>Topic *</Label>
                  <input value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. How to choose web hosting for SMEs" className={inputCls} />
                </div>
                <div>
                  <Label>Target keyword (SEO)</Label>
                  <input value={form.keyword} onChange={(e) => set("keyword", e.target.value)} placeholder="e.g. affordable web hosting for SMEs" className={inputCls} />
                  <p className="mt-1 text-[11px] text-(--crm-muted)">The article is optimized for this keyword to rank and convert. Leave empty to let the AI decide.</p>
                </div>
                <div>
                  <Label>Description *</Label>
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} placeholder="Describe the article you want, target reader, and key points…" className={areaCls} />
                </div>
                <div>
                  <Label>Article length</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {LENGTHS.map(({ key, label, hint }) => (
                      <button key={key} type="button" onClick={() => set("length", key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${form.length === key ? "bg-(--crm-primary) text-white shadow-sm" : "border border-(--crm-border-input) bg-(--crm-surface) text-(--crm-secondary) hover:bg-(--crm-hover)"}`}>
                        {label} <span className="opacity-70">· {hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Writing style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLES.map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => set("style", key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${form.style === key ? "bg-(--crm-primary) text-white shadow-sm" : "border border-(--crm-border-input) bg-(--crm-surface) text-(--crm-secondary) hover:bg-(--crm-hover)"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Paste links to embed</Label>
                  <textarea value={form.links} onChange={(e) => set("links", e.target.value)} rows={3} placeholder="https://… (one link per line, inserted into the article)" className={areaCls} />
                </div>
                <div>
                  <Label>Language</Label>
                  <select value={form.language} onChange={(e) => set("language", e.target.value)} className={inputCls}>
                    <option>Indonesian</option>
                    <option>English</option>
                    <option>Bilingual</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => void generateArticle()} disabled={generating} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
                    <Sparkles size={16} />{generating ? "Writing…" : "Generate article"}
                  </button>
                  <input ref={fileRef} type="file" accept=".md,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => importMarkdownFile(e.target.files?.[0])} />
                  <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><FileText size={14} />Attach .md/.txt</button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview column — sticky on xl so it stays put while the brief scrolls,
              then moves up naturally once the brief column runs out. */}
          <div className="xl:sticky xl:top-[88px] xl:self-start space-y-5">
            {draftMode && draft ? (
              <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><PenLine size={16} className="text-(--crm-brand)" />{draft.topic}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void copyText(draft.markdown, "Article copied to clipboard")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Copy size={14} />{copied ? "Copied!" : "Copy"}</button>
                    <button onClick={() => void downloadWord(draft.markdown, draft.topic)} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Download size={14} />Word</button>
                    <button onClick={() => void downloadArticlePdf({ title: draft.topic, content: draft.markdown, createdAt: new Date().toISOString() })} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><FileText size={14} />PDF</button>
                    <button onClick={() => void generateArticle()} disabled={generating} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={14} className={generating ? "animate-spin" : ""} />Regenerate</button>
                    <button onClick={() => { setDraftMode(false); setDraft(null); }} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)"><X size={14} />Edit form</button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={() => void saveArticle()} disabled={saving === "new"} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60"><Check size={15} />{saving === "new" ? "Saving…" : "Save article"}</button>
                  <span className="text-[11px] text-(--crm-muted)">Saved articles go to AI SEO Gen & SWOT tabs.</span>
                </div>
                <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4 font-mono text-[13px] leading-6 text-(--crm-body)">{draft.markdown}</pre>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><Globe size={26} /></div>
                <p className="mt-5 text-sm font-semibold text-(--crm-fg)">{generating ? "Writing your article…" : "Your generated article will appear here"}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">{generating ? "Gemini is working on the draft. This can take a few moments." : "Fill in the brief and press Generate article. The result comes back as Markdown text — copy it, download it, or save it for SEO analysis."}</p>
                {generating && <Loader2 size={20} className="mx-auto mt-4 animate-spin text-(--crm-mid)" />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: AI SEO Gen */}
      {tab === "seo" && (
        <div className="crm-rise mt-6 grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-text)"><Wand2 size={16} /></div>
                <div>
                  <h3 className="text-sm font-semibold tracking-[-.01em]">Pick an article</h3>
                  <p className="mt-0.5 text-xs text-(--crm-muted)">AI generates Title, Description, Hashtag, Google preview, and an estimated SEO score — then re-checks the result.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <ArticlePicker articles={sortedArticles} value={seoArticleId} onChange={selectForSeo} loading={articlesLoading} />
                {seoArticle && (
                  <button onClick={() => void runSeo()} disabled={seoBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
                    <Sparkles size={16} />{seoBusy ? "Analyzing…" : "Generate SEO"}
                  </button>
                )}
                {seoArticle?.seo && (
                  <div className="rounded-xl bg-(--crm-soft) px-4 py-3 text-xs font-medium text-(--crm-text)">Existing SEO result — regenerate to update it.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {seoResult ? (
              <SeoResultCard seo={seoResult} onCopy={copyText} onDownload={(text, name) => downloadText(text, name)} />
            ) : seoBusy ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-(--crm-border) bg-(--crm-panel) py-20 text-sm font-medium text-(--crm-secondary)">
                <Loader2 size={20} className="animate-spin text-(--crm-mid)" />Running AI SEO check…
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><Wand2 size={26} /></div>
                <p className="mt-5 text-sm font-semibold text-(--crm-fg)">SEO result will appear here</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">Pick an article on the left and press Generate SEO.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: SWOT */}
      {tab === "swot" && (
        <div className="crm-rise mt-6 grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-text)"><Bot size={16} /></div>
                <div>
                  <h3 className="text-sm font-semibold tracking-[-.01em]">Pick an article</h3>
                  <p className="mt-0.5 text-xs text-(--crm-muted)">AI analyzes the article with SWOT and gives its SEO score.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <ArticlePicker articles={sortedArticles} value={swotArticleId} onChange={selectForSwot} loading={articlesLoading} />
                {swotArticle && (
                  <button onClick={() => void runSwot()} disabled={swotBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
                    <Sparkles size={16} />{swotBusy ? "Analyzing…" : "Run SWOT analysis"}
                  </button>
                )}
                {swotArticle?.swot && (
                  <div className="rounded-xl bg-(--crm-soft) px-4 py-3 text-xs font-medium text-(--crm-text)">Existing SWOT result — regenerate to update it.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {swotResult ? (
              <SwotResultCard swot={swotResult} onCopy={copyText} onDownload={(text, name) => downloadText(text, name)} />
            ) : swotBusy ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-(--crm-border) bg-(--crm-panel) py-20 text-sm font-medium text-(--crm-secondary)">
                <Loader2 size={20} className="animate-spin text-(--crm-mid)" />Running SWOT analysis…
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--crm-soft) text-(--crm-text)"><Bot size={26} /></div>
                <p className="mt-5 text-sm font-semibold text-(--crm-fg)">SWOT result will appear here</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-(--crm-muted)">Pick an article on the left and press Run SWOT analysis.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved articles */}
      <div className="crm-rise mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-[-.01em]">Saved articles</h3>
          {!articlesLoading && <span className="text-xs text-(--crm-muted)">{articles.length} article{articles.length === 1 ? "" : "s"}</span>}
        </div>
        {articlesLoading ? (
          <div className="mt-4 flex min-h-[80px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" /></div>
        ) : articles.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-(--crm-border) bg-(--crm-panel) px-6 py-10 text-center text-xs text-(--crm-muted)">No saved articles yet — generate one in the Smart AI Article tab.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-(--crm-border) bg-(--crm-panel)">
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">
                    <th className="px-6 py-4">Title</th>
                    <th className="px-4 py-4">Keyword</th>
                    <th className="px-4 py-4">Length</th>
                    <th className="px-4 py-4">SEO</th>
                    <th className="px-4 py-4">SWOT</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Updated</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedArticles.map((article) => (
                    <tr key={article.id} className="border-t border-(--crm-border-soft)">
                      <td className="max-w-[260px] px-6 py-3.5">
                        <button onClick={() => setDetail(article)} className="block w-full truncate text-left text-sm font-semibold text-(--crm-fg) transition-colors hover:text-(--crm-brand)" title="Open article details">{article.title}</button>
                      </td>
                      <td className="max-w-[180px] px-4 py-3.5 text-xs text-(--crm-brand)">{article.keyword || <span className="text-(--crm-faint)">—</span>}</td>
                      <td className="px-4 py-3.5 text-xs capitalize text-(--crm-secondary)">{article.length}</td>
                      <td className="px-4 py-3.5 text-xs">{article.seo ? <ScorePill score={article.seo.score} /> : <span className="text-(--crm-faint)">—</span>}</td>
                      <td className="px-4 py-3.5 text-xs">{article.swot ? <ScorePill score={article.swot.seoScore} /> : <span className="text-(--crm-faint)">—</span>}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setVerifyTarget(article)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${article.verified ? "border-(--crm-st-done-text) bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : "border-(--crm-border-input) text-(--crm-muted) hover:bg-(--crm-hover)"}`}
                          title="Toggle verification"
                        >
                          {article.verified ? "Verified" : "Unverified"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-(--crm-muted)">{formatDate(article.updatedAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setTab("seo"); selectForSeo(article.id); }} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Run SEO" aria-label="Run SEO"><Wand2 size={14} /></button>
                          <button onClick={() => { setTab("swot"); selectForSwot(article.id); }} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Run SWOT" aria-label="Run SWOT"><Bot size={14} /></button>
                          <button onClick={() => void downloadArticlePdf(article, article.seo, article.swot)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Download PDF (article + reports)" aria-label="Download PDF"><FileText size={14} /></button>
                          <button onClick={() => void downloadWord(article.content, article.title)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)" title="Download .docx" aria-label="Download .docx"><Download size={14} /></button>
                          <button onClick={() => setConfirmDelete(article)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-danger-bg) hover:text-(--crm-danger)" title="Delete article" aria-label="Delete article"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-(--crm-border-soft) md:hidden">
              {sortedArticles.map((article) => (
                <div key={article.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setDetail(article)} className="block w-full truncate text-left text-sm font-semibold text-(--crm-fg) transition-colors hover:text-(--crm-brand)">{article.title}</button>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] capitalize text-(--crm-muted)">{article.length}</span>
                      <span className="text-(--crm-faint)">·</span>
                      {article.seo ? <ScorePill score={article.seo.score} /> : <span className="text-[11px] text-(--crm-faint)">no SEO</span>}
                      {article.swot ? <ScorePill score={article.swot.seoScore} /> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => setVerifyTarget(article)} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${article.verified ? "text-(--crm-st-done-text)" : "text-(--crm-muted)"}`}>{article.verified ? "Verified" : "Verify"}</button>
                    <button onClick={() => setConfirmDelete(article)} className="rounded-lg p-2 text-(--crm-muted) transition-colors hover:bg-(--crm-danger-bg) hover:text-(--crm-danger)" aria-label="Delete article"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="crm-rise mt-5 rounded-xl bg-(--crm-danger-bg) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</div>}

      {detail && (
        <RightDrawer
          onClose={() => setDetail(null)}
          eyebrow="Article details"
          title={detail.title}
          widthClass="sm:w-[680px] lg:w-[760px]"
          footer={
            <>
              <button onClick={() => void copyText(detail.content, "Article copied")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Copy size={15} />Copy article</button>
              <button onClick={() => void downloadArticlePdf(detail, detail.seo, detail.swot)} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><FileText size={15} />PDF</button>
              <button onClick={() => void downloadWord(detail.content, detail.title)} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Download size={15} />.docx</button>
              <div className="flex-1" />
              <button onClick={() => openEditArticle(detail)} className="rounded-xl border border-(--crm-border-input) px-4 py-2.5 text-sm font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)">Edit</button>
              <button onClick={() => setDetail(null)} className="rounded-xl border border-(--crm-border) px-4 py-2.5 text-sm font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)">Close</button>
            </>
          }
        >
          <HumanizeCard article={detail} busy={humanizeBusy === detail.id} error={error} onAssess={() => void runHumanize(detail)} />
          <div className="mt-4">
            <ArticleDetailBody article={detail} />
          </div>
        </RightDrawer>
      )}

      {editingArticle && (
        <RightDrawer
          onClose={() => setEditingArticle(null)}
          eyebrow="Edit article"
          title={editingArticle.title}
          widthClass="sm:w-[680px] lg:w-[760px]"
          footer={
            <>
              <button onClick={() => setEditingArticle(null)} className="flex-1 rounded-xl border border-(--crm-border) py-2.5 text-sm font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)">Cancel</button>
              <button onClick={() => void saveArticleEdit()} disabled={savingEdit} className="flex-1 rounded-xl bg-(--crm-primary) py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">{savingEdit ? "Saving…" : "Save changes"}</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <Label>Target keyword</Label>
              <input value={editForm.keyword} onChange={(e) => setEditForm((f) => ({ ...f, keyword: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <Label>Content (Markdown) *</Label>
              <textarea value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} rows={18} className={`${areaCls} font-mono`} />
            </div>
          </div>
        </RightDrawer>
      )}

      {verifyTarget && (
        <ConfirmModal
          title={verifyTarget.verified ? "Remove verification?" : "Verify this article?"}
          message={verifyTarget.verified ? "The article will be marked as unverified." : "Confirm that you have checked the AI output and accept it."}
          confirmLabel={verifyTarget.verified ? "Remove" : "Verify"}
          onClose={() => setVerifyTarget(null)}
          onConfirm={() => void toggleVerify(verifyTarget)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.title}"?`}
          message="This action cannot be undone."
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void deleteArticle(confirmDelete)}
        />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

function ArticlePicker({ articles, value, onChange, loading }: { articles: SeoArticle[]; value: string; onChange: (id: string) => void; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center gap-2 rounded-xl border border-(--crm-border) bg-(--crm-surface) px-3 py-3 text-xs text-(--crm-muted)"><Loader2 size={14} className="animate-spin" />Loading articles…</div>;
  }
  if (articles.length === 0) {
    return <div className="rounded-xl border border-dashed border-(--crm-border) bg-(--crm-surface) px-3 py-3 text-xs text-(--crm-muted)">No saved articles yet. Create one in the Smart AI Article tab first.</div>;
  }
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-muted)" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-xl border border-(--crm-border-input) bg-(--crm-surface) py-2.5 pl-9 pr-8 text-sm text-(--crm-fg) outline-none transition-colors focus:border-(--crm-accent)">
        <option value="">Select an article…</option>
        {articles.map((a) => (
          <option key={a.id} value={a.id}>{a.title}</option>
        ))}
      </select>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? "border-(--crm-st-done-text) bg-(--crm-st-done-bg) text-(--crm-st-done-text)" : score >= 50 ? "border-(--crm-st-process-text) bg-(--crm-st-process-bg) text-(--crm-st-process-text)" : "border-(--crm-danger) bg-(--crm-danger-bg) text-(--crm-danger)";
  return <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{score}/100</span>;
}

/** Renders article Markdown (headings, lists, bold, links) as simple styled HTML. */
function ArticleMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const h1 = block.match(/^#\s+(.*)$/);
        const h2 = block.match(/^##\s+(.*)$/);
        const h3 = block.match(/^###\s+(.*)$/);
        if (h1 || h2 || h3) {
          const text = (h1?.[1] ?? h2?.[1] ?? h3?.[1] ?? "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          const cls = h1 ? "text-xl font-bold text-(--crm-fg)" : h2 ? "text-lg font-semibold text-(--crm-fg)" : "text-base font-semibold text-(--crm-fg)";
          return <h4 key={i} className={cls} dangerouslySetInnerHTML={{ __html: text }} />;
        }
        const listItems = block.split("\n").filter((l) => /^\s*[-*]\s+/.test(l.trim()));
        if (listItems.length > 0 && listItems.length === block.split("\n").filter((l) => l.trim()).length) {
          return (
            <ul key={i} className="space-y-1.5">
              {listItems.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-6 text-(--crm-body)"><span className="mt-0.5 text-(--crm-muted)">•</span><span dangerouslySetInnerHTML={{ __html: item.trim().replace(/^\s*[-*]\s+/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} /></li>
              ))}
            </ul>
          );
        }
        const html = block
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-(--crm-brand) underline" target="_blank" rel="noopener" href="$2">$1</a>')
          .replace(/\n/g, " ");
        return <p key={i} className="text-sm leading-7 text-(--crm-body)" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

/** AI-vs-Human writing assessment card — shown at the top of the detail drawer. */
function HumanizeCard({ article, busy, error, onAssess }: { article: SeoArticle; busy: boolean; error: string; onAssess: () => void }) {
  const h = article.humanize;
  return (
    <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold tracking-[-.01em]">Humanize score</h4>
          <p className="mt-0.5 text-[11px] text-(--crm-muted)">Estimated % of AI-generated vs human-written text.</p>
        </div>
        <button onClick={onAssess} disabled={busy} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{h ? "Re-assess" : "Assess article"}
        </button>
      </div>
      {error && <div className="mt-3 rounded-xl bg-(--crm-danger-bg) px-3 py-2 text-xs font-medium text-(--crm-danger)">{error}</div>}
      {busy ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-(--crm-surface) py-8 text-xs font-medium text-(--crm-secondary)"><Loader2 size={16} className="animate-spin text-(--crm-mid)" />Analyzing writing style…</div>
      ) : h ? (
        <div className="mt-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-(--crm-soft)">
            <div className="h-full bg-(--crm-danger)" style={{ width: `${h.aiPercent}%` }} />
            <div className="h-full bg-(--crm-st-done-text)" style={{ width: `${h.humanPercent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-(--crm-danger)">AI {h.aiPercent}%</span>
            <span className="text-(--crm-st-done-text)">Human {h.humanPercent}%</span>
          </div>
          {h.verdict && <p className="mt-3 rounded-xl bg-(--crm-soft) px-3 py-2 text-xs font-semibold text-(--crm-text)">{h.verdict}</p>}
          {h.notes && <p className="mt-2 text-xs leading-5 text-(--crm-body)">{h.notes}</p>}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-(--crm-border) bg-(--crm-surface) px-3 py-4 text-center text-xs text-(--crm-muted)">Not assessed yet — click Assess article to see the estimated AI vs Human percentage.</p>
      )}
    </div>
  );
}

/** Article detail body — shown in the right drawer when a title is clicked. */
function ArticleDetailBody({ article }: { article: SeoArticle }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-(--crm-border-input) px-2.5 py-1 text-[11px] font-semibold capitalize text-(--crm-secondary)">{article.length}</span>
        {article.keyword && <span className="rounded-full border border-(--crm-border-input) bg-(--crm-soft) px-2.5 py-1 text-[11px] font-semibold text-(--crm-brand)">{article.keyword}</span>}
        {article.verified ? (
          <span className="rounded-full border border-(--crm-st-done-text) bg-(--crm-st-done-bg) px-2.5 py-1 text-[11px] font-semibold text-(--crm-st-done-text)"><Check size={12} className="mr-1 inline" />Verified</span>
        ) : (
          <span className="rounded-full border border-(--crm-border-input) px-2.5 py-1 text-[11px] font-semibold text-(--crm-muted)">Unverified</span>
        )}
        <span className="text-[11px] text-(--crm-faint)">Updated {formatDate(article.updatedAt)}</span>
      </div>
      {article.seo && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">SEO score</p>
            <ScorePill score={article.seo.score} />
          </div>
          <div className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">SWOT score</p>
            {article.swot ? <ScorePill score={article.swot.seoScore} /> : <span className="text-xs text-(--crm-faint)">—</span>}
          </div>
        </div>
      )}
      <div className="mt-4 rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-(--crm-label)">Article</p>
        <div className="mt-3">
          <ArticleMarkdown content={article.content} />
        </div>
      </div>
    </>
  );
}

function GooglePreview({ preview }: { preview: SeoData["preview"] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--crm-border) bg-(--crm-surface)">
      <div className="flex items-center gap-1.5 border-b border-(--crm-border-soft) bg-(--crm-soft) px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-(--crm-danger)" />
        <span className="h-2 w-2 rounded-full bg-(--crm-st-process-text)" />
        <span className="h-2 w-2 rounded-full bg-(--crm-st-done-text)" />
        <span className="ml-2 text-[10px] font-medium text-(--crm-muted)">Google preview</span>
      </div>
      <div className="px-4 py-3">
        <p className="truncate text-xs text-(--crm-secondary)">{preview.url || "www.domain.com"}</p>
        <p className="mt-1 text-[15px] font-medium text-[#1a0dab]">{preview.title || "(title)"}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--crm-body)">{preview.description || "(description)"}</p>
      </div>
    </div>
  );
}

function SeoResultCard({ seo, onCopy, onDownload }: { seo: SeoData; onCopy?: (text: string, message: string) => void; onDownload?: (text: string, name: string) => void }) {
  const report = [
    `# SEO Report`,
    ``,
    `## Title`,
    seo.title,
    ``,
    `## Meta description`,
    seo.description,
    ``,
    `## Hashtags`,
    seo.hashtags.map((h) => `- ${h}`).join("\n"),
    ``,
    `## Google preview`,
    `- URL: ${seo.preview.url}`,
    `- Title: ${seo.preview.title}`,
    `- Description: ${seo.preview.description}`,
    ``,
    `## Estimated SEO score`,
    `${seo.score}/100`,
    ``,
    `## AI check notes`,
    seo.notes,
  ].join("\n");

  return (
    <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-[-.01em]">SEO result</h3>
        <ScorePill score={seo.score} />
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <Label>Title</Label>
          <p className="rounded-xl border border-(--crm-border) bg-(--crm-surface) px-3 py-2.5 text-sm text-(--crm-fg)">{seo.title || "—"}</p>
        </div>
        <div>
          <Label>Meta description</Label>
          <p className="rounded-xl border border-(--crm-border) bg-(--crm-surface) px-3 py-2.5 text-sm leading-6 text-(--crm-fg)">{seo.description || "—"}</p>
        </div>
        <div>
          <Label>Hashtags</Label>
          <div className="flex flex-wrap gap-1.5">
            {seo.hashtags.map((h) => (
              <span key={h} className="rounded-full border border-(--crm-border-input) bg-(--crm-surface) px-2.5 py-1 text-xs font-semibold text-(--crm-brand)">{h}</span>
            ))}
          </div>
        </div>
        <div>
          <Label>Google preview</Label>
          <GooglePreview preview={seo.preview} />
        </div>
        <div>
          <Label>AI check notes</Label>
          <p className="rounded-xl border border-(--crm-border) bg-(--crm-surface) px-3 py-2.5 text-xs leading-5 text-(--crm-body)">{seo.notes || "—"}</p>
        </div>
        {onCopy && onDownload && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onCopy(report, "SEO report copied")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Copy size={14} />Copy report</button>
            <button onClick={() => onDownload(report, "seo-report.md")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Download size={14} />Download .md</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SwotResultCard({ swot, onCopy, onDownload }: { swot: SwotData; onCopy?: (text: string, message: string) => void; onDownload?: (text: string, name: string) => void }) {
  const quadrants: { key: keyof Pick<SwotData, "strengths" | "weaknesses" | "opportunities" | "threats">; label: string; tone: string }[] = [
    { key: "strengths", label: "Strengths", tone: "border-(--crm-st-done-text) text-(--crm-st-done-text)" },
    { key: "weaknesses", label: "Weaknesses", tone: "border-(--crm-danger) text-(--crm-danger)" },
    { key: "opportunities", label: "Opportunities", tone: "border-(--crm-st-process-text) text-(--crm-st-process-text)" },
    { key: "threats", label: "Threats", tone: "border-(--crm-st-draft-text) text-(--crm-st-draft-text)" },
  ];

  const report = [
    `# SWOT Analysis`,
    ``,
    `## SEO score: ${swot.seoScore}/100`,
    ``,
    ...quadrants.flatMap(({ key, label }) => [ `## ${label}`, ...swot[key].map((s) => `- ${s}`), `` ]),
    `## Summary`,
    swot.summary,
  ].join("\n");

  return (
    <div className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-[-.01em]">SWOT analysis</h3>
        <ScorePill score={swot.seoScore} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {quadrants.map(({ key, label, tone }) => (
          <div key={key} className="rounded-xl border border-(--crm-border) bg-(--crm-surface) p-4">
            <p className={`text-[11px] font-bold uppercase tracking-[.1em] ${tone}`}>{label}</p>
            <ul className="mt-2 space-y-1.5">
              {swot[key].map((item, i) => (
                <li key={i} className="flex gap-1.5 text-xs leading-5 text-(--crm-body)"><span className="text-(--crm-muted)">•</span>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Label>Summary</Label>
        <p className="rounded-xl border border-(--crm-border) bg-(--crm-surface) px-3 py-2.5 text-xs leading-5 text-(--crm-body)">{swot.summary || "—"}</p>
      </div>
      {onCopy && onDownload && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onCopy(report, "SWOT report copied")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Copy size={14} />Copy report</button>
          <button onClick={() => onDownload(report, "swot-report.md")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Download size={14} />Download .md</button>
        </div>
      )}
    </div>
  );
}
