"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Globe, KeyRound, Lock, LogOut, Plus, Trash2, Type, UserRound, X } from "lucide-react";
import { CrmShell } from "@/components/CrmShell";
import { useSettings } from "@/components/SettingsProvider";
import { useAuth } from "@/components/AuthProvider";
import { FONT_SIZES, THEMES } from "@/lib/settings";
import type { FontSizeKey, ThemeKey } from "@/lib/settings";
import { MAX_GEMINI_KEYS } from "@/lib/gemini";

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

  // Slots for new keys to be added (not yet saved)
  const [newKeys, setNewKeys] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  const storedCount = settings.geminiKeyCount;
  const storedTails = settings.geminiKeyTails ?? [];
  const remainingSlots = MAX_GEMINI_KEYS - storedCount;

  // Valid keys from the new input slots
  const filledNewKeys = newKeys.map((k) => k.trim()).filter(Boolean);

  // Check for duplicates among new inputs (realtime)
  const duplicateAmongNew = new Set(filledNewKeys).size !== filledNewKeys.length;

  // Detect per-slot: whether this key duplicates another slot in newKeys
  function isDuplicateSlot(index: number): boolean {
    const val = newKeys[index]?.trim();
    if (!val) return false;
    return newKeys.some((k, i) => i !== index && k.trim() === val);
  }

  function setKey(index: number, value: string) {
    setNewKeys((prev) => {
      const next = [...prev];
      // Take only the first line if multiline paste
      next[index] = value.split(/\r?\n/)[0] ?? "";
      return next;
    });
  }

  function addSlot() {
    if (newKeys.length < remainingSlots) {
      setNewKeys((prev) => [...prev, ""]);
    }
  }

  function removeSlot(index: number) {
    setNewKeys((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveNewKeys() {
    const valid = filledNewKeys;
    if (valid.length === 0) {
      onToast("Enter at least one API key before saving.");
      return;
    }
    if (duplicateAmongNew) {
      onToast("Duplicate API keys detected — each key must be unique.");
      return;
    }
    setBusy(true);
    try {
      // merge: true → append to existing stored keys
      const result = await updateSettings({ geminiApiKey: valid.join("\n"), merge: true });
      const count = result?.geminiKeyCount ?? (storedCount + valid.length);
      setNewKeys([""]);
      onToast(`${count} Gemini API key${count > 1 ? "s" : ""} saved.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to save API key.");
    } finally {
      setBusy(false);
    }
  }

  async function removeStoredKey(tailIndex: number) {
    // Send the index of the key to remove — server handles the rest.
    setBusy(true);
    try {
      const result = await updateSettings({ removeKeyIndex: tailIndex } as Parameters<typeof updateSettings>[0]);
      const count = result?.geminiKeyCount ?? 0;
      onToast(count > 0 ? `Key removed. ${count} key${count !== 1 ? "s" : ""} remaining.` : "All API keys removed.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to remove key.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAllKeys() {
    setBusy(true);
    try {
      await updateSettings({ geminiApiKey: "" });
      onToast("All Gemini API keys removed.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to remove keys.");
    } finally {
      setBusy(false);
    }
  }

  const canAddMore = newKeys.length < remainingSlots;
  const saveDisabled = busy || duplicateAmongNew || filledNewKeys.length === 0;

  return (
    <SectionCard
      icon={KeyRound}
      title="AI · API keys"
      description="Google Gemini API keys used to power all AI features. If one key hits its limit or fails, the next is used automatically. Up to 5 keys supported."
    >
      <div className="space-y-5">

        {/* === SAVED KEYS === */}
        {storedCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">
                Saved in database
              </p>
              <span className="rounded-full border border-(--crm-border-input) px-2.5 py-0.5 text-[11px] font-semibold text-(--crm-mid)">
                {storedCount} / {MAX_GEMINI_KEYS} keys
              </span>
            </div>
            <div className="space-y-2">
              {storedTails.map((tail, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-soft) text-[10px] font-bold text-(--crm-text)">
                    #{index + 1}
                  </span>
                  <div className="flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-(--crm-border) bg-(--crm-surface) px-3">
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span className="flex-1 font-mono text-sm text-(--crm-secondary)">
                      ••••••••••••••••<span className="text-(--crm-text) font-semibold">{tail}</span>
                    </span>
                    <span className="rounded-md bg-(--crm-soft) px-1.5 py-0.5 text-[10px] font-semibold text-(--crm-mid)">
                      ...{tail}
                    </span>
                  </div>
                  <button
                    onClick={() => void removeStoredKey(index)}
                    disabled={busy}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--crm-danger-border) text-(--crm-danger) transition-colors hover:bg-(--crm-danger-bg) disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Remove key #${index + 1}`}
                    aria-label={`Remove key #${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === NEW KEY INPUTS === */}
        {remainingSlots > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-(--crm-label)">
                {storedCount > 0 ? "Add new key" : "Gemini API keys"}
              </label>
              {remainingSlots > 1 && canAddMore && (
                <button
                  onClick={addSlot}
                  className="flex items-center gap-1 text-[11px] font-semibold text-(--crm-brand) transition-colors hover:underline"
                >
                  <Plus size={12} />
                  Add slot
                </button>
              )}
            </div>

            <div className="space-y-2">
              {newKeys.map((key, index) => {
                const isDup = isDuplicateSlot(index);
                return (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-soft) text-[10px] font-bold text-(--crm-text)">
                      #{storedCount + index + 1}
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(index, e.target.value)}
                        placeholder={`Paste API key ${storedCount + index + 1}`}
                        autoComplete="off"
                        spellCheck={false}
                        className={`h-10 w-full rounded-lg border px-3 font-mono text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:ring-2 focus:ring-(--crm-soft) ${
                          isDup
                            ? "border-red-400 bg-red-50 focus:border-red-400 dark:bg-red-950/20"
                            : "border-(--crm-border-input) bg-(--crm-surface) focus:border-(--crm-mid)"
                        }`}
                      />
                      {isDup && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-red-500">
                          duplicate
                        </span>
                      )}
                    </div>
                    {newKeys.length > 1 && (
                      <button
                        onClick={() => removeSlot(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--crm-border-input) text-(--crm-secondary) transition-colors hover:border-(--crm-danger-border) hover:text-(--crm-danger)"
                        title="Remove this slot"
                        aria-label="Remove this slot"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline add-slot button when only 1 slot and more room available */}
            {newKeys.length === 1 && remainingSlots > 1 && (
              <button
                onClick={addSlot}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-(--crm-border-input) px-3 py-2 text-xs font-semibold text-(--crm-secondary) transition-colors hover:border-(--crm-mid) hover:text-(--crm-text) w-full justify-center"
              >
                <Plus size={13} />
                Add another key ({remainingSlots - 1} slot{remainingSlots - 1 !== 1 ? "s" : ""} remaining)
              </button>
            )}
          </div>
        )}

        {/* Max capacity message */}
        {remainingSlots === 0 && storedCount > 0 && (
          <p className="text-[11px] font-semibold text-(--crm-mid)">
            ✓ {MAX_GEMINI_KEYS} keys configured — maximum reached. Remove an unused key to add a new one.
          </p>
        )}

        {/* === ACTION BUTTONS === */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {remainingSlots > 0 && (
            <button
              onClick={() => void saveNewKeys()}
              disabled={saveDisabled}
              className="flex items-center gap-1.5 rounded-lg bg-(--crm-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound size={14} />
              {busy ? "Saving…" : filledNewKeys.length > 0 ? `Save ${filledNewKeys.length} key${filledNewKeys.length > 1 ? "s" : ""}` : "Save"}
            </button>
          )}
          {storedCount > 0 && (
            <button
              onClick={() => void clearAllKeys()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-(--crm-danger-border) px-4 py-2 text-sm font-semibold text-(--crm-danger) transition-colors hover:bg-(--crm-danger-bg) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} />
              Remove all
            </button>
          )}
        </div>

        {duplicateAmongNew && (
          <p className="text-[11px] font-semibold text-red-500">
            ⚠ Duplicate API keys detected — each key must be unique.
          </p>
        )}

        <p className="text-[11px] leading-5 text-(--crm-muted)">
          Get free keys at{" "}
          <span className="font-mono text-(--crm-brand)">aistudio.google.com/apikey</span>.
          Keys are stored securely in the database, never sent to the browser.
          If a key fails or hits its quota, the next one is used automatically.
        </p>
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
