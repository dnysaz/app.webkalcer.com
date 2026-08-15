"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthScreen } from "@/components/AuthScreen";

type Session =
  | { status: "loading" }
  | { status: "guest"; adminExists: boolean }
  | { status: "authed"; email: string; name: string };

type AuthContextValue = {
  session: Session;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SHARE_CACHE_PREFIX = "wcrm-share:v3:";

/** Wipes locally cached CRM data and share documents (incl. passcodes). */
function clearClientCache() {
  try {
    window.localStorage.removeItem("webkalcer:crm:v3");
    window.localStorage.removeItem("webkalcer:notes:draft");
  } catch {
    // storage blocked — ignore
  }
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(SHARE_CACHE_PREFIX)) {
        window.sessionStorage.removeItem(key);
        i -= 1;
      }
    }
  } catch {
    // storage blocked — ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { authed: boolean; email?: string; name?: string; adminExists: boolean }) => {
        if (data.authed) setSession({ status: "authed", email: data.email ?? "", name: data.name ?? "" });
        else setSession({ status: "guest", adminExists: data.adminExists });
      })
      .catch(() => setSession({ status: "guest", adminExists: true }));
  }, []);

  async function postAuth(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { email?: string; name?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return { email: data.email ?? "", name: data.name ?? "" };
  }

  const login = async (email: string, password: string) => {
    const { email: authedEmail, name } = await postAuth("/api/auth/login", { email, password });
    setSession({ status: "authed", email: authedEmail, name });
  };

  const register = async (email: string, password: string) => {
    const { email: authedEmail, name } = await postAuth("/api/auth/register", { email, password });
    setSession({ status: "authed", email: authedEmail, name });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearClientCache();
    setSession({ status: "guest", adminExists: true });
  };

  const updateName = async (name: string) => {
    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await res.json()) as { name?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    setSession((prev) => (prev.status === "authed" ? { ...prev, name: data.name ?? prev.name } : prev));
  };

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--crm-bg) font-[var(--font-dm)]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-(--crm-soft) border-t-(--crm-mid)" />
      </div>
    );
  }

  if (session.status === "guest") {
    return <AuthScreen adminExists={session.adminExists} onLogin={login} onRegister={register} />;
  }

  return <AuthContext.Provider value={{ session, login, register, logout, updateName }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
