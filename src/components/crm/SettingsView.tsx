"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Globe, KeyRound, Lock, LogOut, Plus, Type, UserRound, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useSettings } from "@/components/SettingsProvider";
import { useAuth } from "@/components/AuthProvider";
import { FONT_SIZES, THEMES } from "@/lib/settings";
import type { FontSizeKey, ThemeKey } from "@/lib/settings";

export function SettingsView() {
  const [toast, setToast] = useState("");

  function onToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <CrmShell title="Settings" subtitle="Workspace & account">
      <div className="crm-rise">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-.04em]">Settings</h2>
          <p className="mt-1 text-sm text-(--crm-secondary)">Customize branding, theme, font size, and your account.</p>
        </div>
        <div className="mx-auto mt-6 grid max-w-2xl gap-6">
          <WebsiteSection onToast={onToast} />
          <AiSection onToast={onToast} />
          <AccountSection onToast={onToast} />
          <PasswordSection onToast={onToast} />
        </div>
      </div>
      {toast && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </CrmShell>
  );
}

function SectionCard({ icon: Icon, title, description, children }: { icon: typeof Globe; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--crm-soft) text-(--crm-text)"><Icon size={16} /></div>
        <div>
          <h3 className="text-sm font-semibold tracking-[-.01em]">{title}</h3>
          <p className="mt-0.5 text-xs text-(--crm-muted)">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function WebsiteSection({ onToast }: { onToast: (message: string) => void }) {
  const { settings, updateSettings } = useSettings();
  const [siteName, setSiteName] = useState(settings.siteName);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    const name = siteName.trim();
    if (!name) {
      onToast("Site name cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      await updateSettings({ siteName: name });
      onToast("Site name saved.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to save site name.");
    } finally {
      setBusy(false);
    }
  }

  async function pickTheme(theme: ThemeKey) {
    try {
      await updateSettings({ theme });
      onToast("Theme color updated.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to update theme.");
    }
  }

  async function pickFontSize(fontSize: FontSizeKey) {
    try {
      await updateSettings({ fontSize });
      onToast(`Font size set to ${FONT_SIZES[fontSize].label}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to update font size.");
    }
  }

  return (
    <SectionCard icon={Globe} title="Website branding" description="Site name shown in the sidebar, login page, and browser tab.">
      <div className="space-y-6">
        <div>
          <label htmlFor="site-name" className="block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Site name</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="site-name"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={80}
              className="h-10 flex-1 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-mid) focus:ring-2 focus:ring-(--crm-soft)"
            />
            <button onClick={saveName} disabled={busy} className="rounded-lg bg-(--crm-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Theme color</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const theme = THEMES[key];
              const active = settings.theme === key;
              return (
                <button
                  key={key}
                  onClick={() => void pickTheme(key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${active ? "border-(--crm-primary) bg-(--crm-soft) text-(--crm-text)" : "border-(--crm-border) bg-(--crm-surface) text-(--crm-secondary) hover:bg-(--crm-hover)"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
                    {active && <Check size={13} className="text-white" />}
                  </span>
                  <span className="truncate">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)"><Type size={12} />Font size</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:max-w-lg">
            {(Object.keys(FONT_SIZES) as FontSizeKey[]).map((key) => {
              const option = FONT_SIZES[key];
              const active = settings.fontSize === key;
              return (
                <button
                  key={key}
                  onClick={() => void pickFontSize(key)}
                  className={`rounded-xl border px-3 py-3 text-center transition-colors ${active ? "border-(--crm-primary) bg-(--crm-soft) text-(--crm-text)" : "border-(--crm-border) bg-(--crm-surface) text-(--crm-secondary) hover:bg-(--crm-hover)"}`}
                >
                  <span className="block font-semibold" style={{ fontSize: `${option.px}px` }}>Aa</span>
                  <span className="mt-1 block text-[11px]">{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-(--crm-muted)">Adjusts the base text size across the whole app.</p>
        </div>
      </div>
    </SectionCard>
  );
}

function AiSection({ onToast }: { onToast: (message: string) => void }) {
  const { settings, updateSettings } = useSettings();
  const [keys, setKeys] = useState<string[]>([""]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const keyConfigured = settings.hasGeminiKey;
  const filledKeys = keys.map((k) => k.trim()).filter(Boolean);
  const changed = filledKeys.length > 0;

  function addKey() {
    if (keys.length >= 5) return;
    setKeys((prev) => [...prev, ""]);
  }
  function removeKey(index: number) {
    setKeys((prev) => prev.filter((_, i) => i !== index));
  }
  function setKey(index: number, value: string) {
    setKeys((prev) => prev.map((k, i) => (i === index ? value : k)));
  }

  async function saveKey() {
    const value = filledKeys.join("\n");
    setBusy(true);
    try {
      await updateSettings({ geminiApiKey: value });
      setKeys([""]);
      onToast(value ? `${filledKeys.length} Gemini API key${filledKeys.length > 1 ? "s" : ""} saved.` : "Gemini API key cleared.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to save API key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={KeyRound} title="AI · PRD generator" description="Google Gemini API keys used to generate PRD prompts from the Create PRD page. Add up to 5 keys — if one fails, the next is tried automatically.">
      <div className="space-y-3">
        <label className="block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Gemini API keys</label>
        <div className="space-y-2">
          {keys.map((key, index) => (
            <div key={index} className="flex gap-2">
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(index, e.target.value)}
                placeholder={index === 0 && keyConfigured && !key.trim() ? "••••••••••••••••  (key already set)" : "AIza…"}
                autoComplete="off"
                className="h-10 flex-1 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 font-mono text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-mid) focus:ring-2 focus:ring-(--crm-soft)"
              />
              {keys.length > 1 && (
                <button onClick={() => removeKey(index)} className="flex h-10 items-center gap-1.5 rounded-lg border border-(--crm-border-input) px-3 text-xs font-semibold text-(--crm-danger) transition-colors hover:bg-(--crm-danger-bg)" title="Remove key" aria-label="Remove key"><X size={15} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={addKey} disabled={keys.length >= 5} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-brand) transition-colors hover:bg-(--crm-hover) disabled:cursor-not-allowed disabled:opacity-50"><Plus size={14} />Add API key ({keys.length}/5)</button>
          <button onClick={() => setShow((prev) => !prev)} className="flex items-center gap-1.5 rounded-lg border border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" title={show ? "Hide keys" : "Show keys"} aria-label={show ? "Hide keys" : "Show keys"}>{show ? <EyeOff size={14} /> : <Eye size={14} />}{show ? "Hide" : "Show"}</button>
          <button onClick={() => void saveKey()} disabled={busy || (!changed && !keyConfigured)} className="flex items-center gap-1.5 rounded-lg bg-(--crm-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60"><KeyRound size={14} />{busy ? "Saving…" : changed ? "Save keys" : "Clear"}</button>
        </div>
        <p className="text-[11px] leading-5 text-(--crm-muted)">Get free keys at <span className="font-mono text-(--crm-brand)">aistudio.google.com/apikey</span>. Separate each key with a new line — up to 5 keys. When one key hits a rate limit or error, the next key is used automatically. Keys are stored securely in the database, never sent to the browser.</p>
        <p className="text-[11px] leading-5 text-(--crm-muted)">Status: <span className={`font-semibold ${keyConfigured ? "text-(--crm-mid)" : "text-(--crm-danger)"}`}>{keyConfigured ? "API keys configured" : "No API key configured"}</span></p>
      </div>
    </SectionCard>
  );
}

function AccountSection({ onToast }: { onToast: (message: string) => void }) {
  const { session, updateName, logout } = useAuth();
  const [name, setName] = useState(session.status === "authed" ? session.name : "");
  const [busy, setBusy] = useState(false);
  const email = session.status === "authed" ? session.email : "";
  const username = email ? email.split("@")[0] : "";

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      onToast("Name cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      await updateName(trimmed);
      onToast("Profile name updated.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={UserRound} title="Profile" description="Email and username are fixed and cannot be changed.">
      <div className="space-y-4">
        <div>
          <label htmlFor="admin-name" className="block text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">Name</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="h-10 flex-1 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm outline-none transition-colors focus:border-(--crm-mid) focus:ring-2 focus:ring-(--crm-soft)"
            />
            <button onClick={saveName} disabled={busy} className="rounded-lg bg-(--crm-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadonlyField label="Email" value={email || "—"} />
          <ReadonlyField label="Username" value={username || "—"} />
        </div>
        <div className="border-t border-(--crm-border-soft) pt-4">
          <button onClick={() => void logout()} className="flex h-10 items-center gap-2 rounded-lg border border-(--crm-danger-border) px-4 text-sm font-semibold text-(--crm-danger) transition-colors hover:bg-(--crm-danger-bg)"><LogOut size={15} />Logout</button>
        </div>
      </div>
    </SectionCard>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">{label}</p>
      <div className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-(--crm-border-input) bg-(--crm-surface) px-3 text-sm text-(--crm-secondary)">
        <Lock size={13} className="shrink-0 text-(--crm-faint)" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  showPassword,
  onToggleShow,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-10 w-full rounded-lg border border-(--crm-border-input) bg-(--crm-surface) pr-11 pl-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-mid) focus:ring-2 focus:ring-(--crm-soft)"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-(--crm-muted) transition-colors hover:bg-(--crm-hover) hover:text-(--crm-secondary)"
      >
        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function PasswordSection({ onToast }: { onToast: (message: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (!current) {
      onToast("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      onToast("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      onToast("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to change password.");
      setCurrent("");
      setNext("");
      setConfirm("");
      onToast("Password changed successfully.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={KeyRound} title="Change password" description="Requires your current password to confirm.">
      <div className="space-y-3">
        <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" showPassword={showCurrent} onToggleShow={() => setShowCurrent((prev) => !prev)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (min. 8)" autoComplete="new-password" showPassword={showNext} onToggleShow={() => setShowNext((prev) => !prev)} />
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" showPassword={showConfirm} onToggleShow={() => setShowConfirm((prev) => !prev)} />
        </div>
        <button onClick={changePassword} disabled={busy} className="flex h-10 items-center gap-2 rounded-lg bg-(--crm-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60">
          <KeyRound size={14} />
          {busy ? "Updating..." : "Change password"}
        </button>
      </div>
    </SectionCard>
  );
}
