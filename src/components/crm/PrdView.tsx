"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  Bot,
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Layers,
  Loader2,
  Paintbrush,
  Palette,
  RefreshCw,
  Rocket,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useCrm } from "@/components/CrmProvider";
import { uid } from "@/lib/crm";
import type { PrdFormData } from "@/app/api/prd/generate/route";

const PROJECT_TYPES = [
  "Landing page",
  "Company profile",
  "Portfolio",
  "E-commerce / Online store",
  "Web application / SaaS",
  "Blog / Content site",
  "Booking / Reservation",
  "Others",
];

const DESIGN_STYLES = [
  "Minimal & clean",
  "Modern & bold",
  "Corporate & professional",
  "Playful & colorful",
  "Elegant & premium",
  "Dark & techy",
  "Warm & friendly",
];

const UI_SKILLS = [
  "shadcn/ui + Tailwind",
  "Next.js + Tailwind",
  "Bootstrap",
  "Custom CSS",
  "Framer Motion animations",
  "Glassmorphism",
];

const BACKENDS = [
  "None — static site",
  "Supabase",
  "Neon (PostgreSQL)",
  "SQLite (local)",
  "MySQL",
  "Custom REST API",
];

const FRONTENDS = ["Next.js (React)", "React (Vite)", "Astro", "Plain HTML/CSS/JS", "WordPress-style CMS"];

const DATABASES = ["Supabase Postgres", "Neon Postgres", "SQLite", "MySQL", "None"];

const AUTH_OPTIONS = [
  "None — public site",
  "Supabase Auth",
  "NextAuth / Auth.js",
  "Custom email + password",
  "Google OAuth",
];

const LANGUAGES = ["English", "Indonesian", "Bilingual (EN + ID)", "Other"];

type SectionProps = {
  icon: typeof Globe;
  title: string;
  description?: string;
  children: React.ReactNode;
};

function Section({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-text)"><Icon size={16} /></div>
        <div>
          <h3 className="text-sm font-semibold tracking-[-.01em]">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-(--crm-muted)">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-(--crm-brand)">{children}</span>;
}

const inputCls = "h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";
const areaCls = "w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)";

function ChipGroup<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${value === option ? "bg-(--crm-primary) text-white shadow-sm" : "border border-(--crm-border-input) bg-(--crm-surface) text-(--crm-secondary) hover:bg-(--crm-hover)"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const emptyForm: PrdFormData = {
  projectName: "",
  projectType: "",
  description: "",
  audience: "",
  goals: "",
  pages: "",
  features: "",
  designStyle: "",
  uiSkills: "",
  colorPalette: "",
  backend: "",
  frontend: "",
  database: "",
  auth: "",
  language: "",
  logoUrl: "",
  faviconUrl: "",
  contact: "",
  extra: "",
};

export function PrdView() {
  const { addNote } = useCrm();
  const [form, setForm] = useState<PrdFormData>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [savedNoteTitle, setSavedNoteTitle] = useState("");

  const set = <K extends keyof PrdFormData>(key: K, value: PrdFormData[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const completeness = useMemo(() => {
    const keys = Object.keys(FIELD_COUNTS) as (keyof PrdFormData)[];
    const filled = keys.filter((k) => form[k].trim().length > 0).length;
    return { filled, total: keys.length, pct: Math.round((filled / keys.length) * 100) };
  }, [form]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function generate() {
    setError("");
    if (!form.projectName.trim()) {
      setError("Please enter a project name.");
      return;
    }
    if (!form.description.trim()) {
      setError("Please describe the project in the general details field.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/prd/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { markdown?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to generate the PRD.");
        return;
      }
      const content = data.markdown || "";
      setMarkdown(content);
      // Auto-save the PRD to Notes (title = project name, content = markdown).
      const now = new Date().toISOString();
      const noteTitle = form.projectName.trim() || "Untitled PRD";
      addNote({ id: uid(), title: noteTitle, content, createdAt: now, updatedAt: now });
      setSavedNoteTitle(noteTitle);
      announce("PRD generated & saved to Notes");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      announce("PRD copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      announce("Could not copy. Select the text manually.");
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (form.projectName || "prd").trim().replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safeName}-prd.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce("PRD downloaded as .md");
  }

  return (
    <CrmShell title="Create PRD" subtitle="AI prompt generator">
      <div className="crm-rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Create PRD</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Fill in the details of your project — Gemini turns it into a copy-paste-ready PRD for your AI agent.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-(--crm-border-input) bg-(--crm-surface) px-3 py-1.5 text-xs font-semibold text-(--crm-secondary)"><Check size={13} className="text-(--crm-mid)" />{completeness.filled}/{completeness.total} fields</span>
          <button onClick={() => void generate()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-(--crm-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-(--crm-dark) hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><Sparkles size={16} />{busy ? "Generating…" : "Generate PRD"}</button>
        </div>
      </div>

      {!markdown ? (
        <div className="crm-rise mt-6 grid gap-5 xl:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5">
            <Section icon={Rocket} title="Project basics" description="What are you building?">
              <div className="space-y-4">
                <div>
                  <Label>Project name *</Label>
                  <input value={form.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. Webkalcer CRM" className={inputCls} />
                </div>
                <div>
                  <Label>Project type</Label>
                  <ChipGroup options={PROJECT_TYPES as readonly string[]} value={form.projectType} onChange={(v) => set("projectType", v)} />
                </div>
                <div>
                  <Label>General details *</Label>
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} placeholder="Describe what this website is, what problem it solves, and what the admin expects the AI agent to build…" className={areaCls} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Target audience</Label>
                    <input value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who is this for?" className={inputCls} />
                  </div>
                  <div>
                    <Label>Goals & objectives</Label>
                    <input value={form.goals} onChange={(e) => set("goals", e.target.value)} placeholder="e.g. generate leads, sell products" className={inputCls} />
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={Layers} title="Structure & content" description="Pages and features the site should have.">
              <div className="space-y-4">
                <div>
                  <Label>Pages / sections wanted</Label>
                  <textarea value={form.pages} onChange={(e) => set("pages", e.target.value)} rows={3} placeholder="e.g. Home, About, Services, Pricing, Contact, Blog…" className={areaCls} />
                </div>
                <div>
                  <Label>Key features</Label>
                  <textarea value={form.features} onChange={(e) => set("features", e.target.value)} rows={3} placeholder="e.g. contact form, testimonials, product catalog, booking…" className={areaCls} />
                </div>
              </div>
            </Section>

            <Section icon={User} title="Branding & assets" description="URLs the agent should use for your brand.">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Logo URL</Label>
                    <input value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.png" className={inputCls} />
                  </div>
                  <div>
                    <Label>Favicon URL</Label>
                    <input value={form.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)} placeholder="https://…/favicon.ico" className={inputCls} />
                  </div>
                </div>
                <div>
                  <Label>Contact details</Label>
                  <textarea value={form.contact} onChange={(e) => set("contact", e.target.value)} rows={3} placeholder="Email, phone, WhatsApp, address, social media links…" className={areaCls} />
                </div>
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <Section icon={Paintbrush} title="Design & theme" description="How should the site look and feel?">
              <div className="space-y-4">
                <div>
                  <Label>Design style</Label>
                  <ChipGroup options={DESIGN_STYLES as readonly string[]} value={form.designStyle} onChange={(v) => set("designStyle", v)} />
                </div>
                <div>
                  <Label>UI skills / style references</Label>
                  <ChipGroup options={UI_SKILLS as readonly string[]} value={form.uiSkills} onChange={(v) => set("uiSkills", v)} />
                </div>
                <div>
                  <Label>Color palette / theme</Label>
                  <div className="flex gap-2">
                    <input value={form.colorPalette} onChange={(e) => set("colorPalette", e.target.value)} placeholder="e.g. emerald green #234b42 with cream background, or: brand colors" className={inputCls} />
                    <Palette size={18} className="mt-3 shrink-0 text-(--crm-faint)" />
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={Bot} title="Tech stack" description="Choose the tools the agent should use.">
              <div className="space-y-4">
                <div>
                  <Label>Frontend</Label>
                  <ChipGroup options={FRONTENDS as readonly string[]} value={form.frontend} onChange={(v) => set("frontend", v)} />
                </div>
                <div>
                  <Label>Backend</Label>
                  <ChipGroup options={BACKENDS as readonly string[]} value={form.backend} onChange={(v) => set("backend", v)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Database</Label>
                    <ChipGroup options={DATABASES as readonly string[]} value={form.database} onChange={(v) => set("database", v)} />
                  </div>
                  <div>
                    <Label>Authentication</Label>
                    <ChipGroup options={AUTH_OPTIONS as readonly string[]} value={form.auth} onChange={(v) => set("auth", v)} />
                  </div>
                </div>
                <div>
                  <Label>Content language</Label>
                  <ChipGroup options={LANGUAGES as readonly string[]} value={form.language} onChange={(v) => set("language", v)} />
                </div>
              </div>
            </Section>

            <Section icon={Wand2} title="Additional requirements" description="Anything else the AI agent must know.">
              <textarea value={form.extra} onChange={(e) => set("extra", e.target.value)} rows={4} placeholder="SEO requirements, performance targets, analytics, i18n, special constraints…" className={areaCls} />
            </Section>
          </div>
        </div>
      ) : (
        /* Result view */
        <div className="crm-rise mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><BookOpenText size={16} className="text-(--crm-brand)" />{form.projectName} — PRD</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void copyPrompt()} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Copy size={14} />{copied ? "Copied!" : "Copy prompt"}</button>
              <button onClick={downloadMarkdown} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover)"><Download size={14} />Download .md</button>
              <button onClick={() => void generate()} disabled={busy} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />Regenerate</button>
              <button onClick={() => setMarkdown("")} className="flex items-center gap-1.5 rounded-xl border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)"><FileText size={14} />Edit form</button>
            </div>
          </div>
          {savedNoteTitle && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-(--crm-muted)"><Check size={13} className="text-(--crm-mid)" />Saved to Notes as “{savedNoteTitle}” (markdown).</p>
          )}
          {busy && (
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-(--crm-border) bg-(--crm-panel) py-16 text-sm font-medium text-(--crm-secondary)">
              <Loader2 size={20} className="animate-spin text-(--crm-mid)" />Regenerating PRD with Gemini…
            </div>
          )}
          {!busy && (
            <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-6 font-mono text-[13px] leading-6 text-(--crm-body)">{markdown}</pre>
          )}
        </div>
      )}

      {error && !markdown && <div className="crm-rise mt-5 rounded-xl bg-(--crm-danger-bg) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</div>}
      {toast && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

// Mirrors the field labels used in the API so completeness counting stays in sync.
const FIELD_COUNTS = {
  projectName: true,
  projectType: true,
  description: true,
  audience: true,
  goals: true,
  pages: true,
  features: true,
  designStyle: true,
  uiSkills: true,
  colorPalette: true,
  backend: true,
  frontend: true,
  database: true,
  auth: true,
  language: true,
  logoUrl: true,
  faviconUrl: true,
  contact: true,
  extra: true,
} as const;
