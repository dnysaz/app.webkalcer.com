"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { useSettings } from "@/components/SettingsProvider";

type Props = {
  adminExists: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--crm-secondary)" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-(--crm-border-input) bg-(--crm-surface) pl-10 pr-11 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)"
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--crm-secondary) hover:text-(--crm-text)"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function AuthScreen({ adminExists, onLogin, onRegister }: Props) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"login" | "register">(adminExists ? "login" : "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "login") await onLogin(email.trim(), password);
      else await onRegister(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--crm-bg) px-4 font-[var(--font-dm)] text-(--crm-fg)">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--crm-dark) font-[var(--font-space-mono)] text-2xl font-bold text-(--crm-accent)">w</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-.03em]">{settings.siteName}</h1>
          <p className="mt-1 text-sm text-(--crm-muted)">CRM by webkalcer.com</p>
        </div>

        <div className="rounded-2xl border border-(--crm-border) bg-(--crm-surface) p-7 shadow-sm">
          {!adminExists ? (
            <>
              <div className="mb-6 flex rounded-xl bg-(--crm-hover) p-1">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-(--crm-surface) text-(--crm-text) shadow-sm" : "text-(--crm-muted)"}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "register" ? "bg-(--crm-surface) text-(--crm-text) shadow-sm" : "text-(--crm-muted)"}`}
                >
                  Register
                </button>
              </div>

              {mode === "register" && (
                <p className="mb-5 rounded-xl bg-(--crm-hover) px-4 py-3 text-xs leading-5 text-(--crm-secondary)">
                  This form only appears <strong>once</strong> to create the <strong>admin</strong> account. After an admin is registered, the register form will be removed and only login remains.
                </p>
              )}
            </>
          ) : (
            <p className="mb-6 text-center text-sm font-semibold tracking-[-.01em] text-(--crm-fg)">Sign in to your account</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--crm-secondary)" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-(--crm-border-input) bg-(--crm-surface) pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-(--crm-placeholder) focus:border-(--crm-focus-border) focus:ring-2 focus:ring-(--crm-focus-ring)"
              />
            </div>

            <PasswordField value={password} onChange={setPassword} placeholder={mode === "register" ? "Create password (min. 8 characters)" : "Password"} />

            {mode === "register" && <PasswordField value={confirm} onChange={setConfirm} placeholder="Confirm password" />}

            {error && <p className="rounded-xl bg-(--crm-hover) px-4 py-3 text-xs font-medium text-(--crm-danger)">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-(--crm-primary) text-sm font-semibold text-white transition-colors hover:bg-(--crm-dark) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Processing..." : mode === "register" ? "Register Admin" : "Login"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-(--crm-placeholder)">webkalcer · CRM by webkalcer.com</p>
      </div>
    </div>
  );
}
