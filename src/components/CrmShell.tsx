"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCrm } from "@/components/CrmProvider";
import { useAuth } from "@/components/AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import { GlobalSearch } from "@/components/crm/GlobalSearch";
import {
  Bell,
  BookOpenText,
  ChevronDown,
  ContactRound,
  FileText,
  Globe,
  LayoutDashboard,
  Menu,
  NotebookPen,
  Package,
  QrCode,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Quotes", href: "/quotes", icon: ScrollText },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payments", href: "/payment", icon: QrCode },
  { label: "Products", href: "/products", icon: Package },
  { label: "Contact Book", href: "/contacts", icon: ContactRound },
  { label: "Domain & Hosting", href: "/web-assets", icon: Globe },
  { label: "Content & SEO", href: "/content-seo", icon: Sparkles },
  { label: "Create PRD", href: "/prd", icon: BookOpenText },
  { label: "Notes", href: "/notes", icon: NotebookPen },
];

const SIDEBAR_KEY = "webkalcer:sidebar:minimized";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function CrmShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const pathname = usePathname();
  const { loading } = useCrm();
  const { session } = useAuth();
  const { settings } = useSettings();
  const adminEmail = session.status === "authed" ? session.email : "";
  const adminName = session.status === "authed" && session.name ? session.name : adminEmail;
  const adminInitials = (adminName || adminEmail || "AD").slice(0, 2).toUpperCase();
  const compact = minimized && !mobileNav;
  const skipFirstPersist = useRef(true);

  // Enable width transitions only after mount, so user toggles animate
  // smoothly while the persisted width applies with zero transition.
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Persist minimized state to localStorage. Skip the very first run so the
  // restore above isn't clobbered back to "0" before it applies.
  useIsomorphicLayoutEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(SIDEBAR_KEY, minimized ? "1" : "0");
    } catch {
      // storage blocked — ignore
    }
  }, [minimized]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className="min-h-screen bg-(--crm-bg) font-[var(--font-dm)] text-(--crm-fg)">
      {loading && <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-(--crm-soft)"><div className="h-full w-1/3 animate-[crm-load_1.1s_ease-in-out_infinite] rounded-full bg-(--crm-mid)" /></div>}
      <style>{`
        @keyframes crm-rise { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .crm-rise { animation: crm-rise .55s cubic-bezier(.2,.75,.25,1) both; }
        @keyframes crm-load { 0% { transform: translateX(-100%) } 50% { transform: translateX(200%) } 100% { transform: translateX(400%) } }
      `}</style>
      <div className="flex min-h-screen">
        <aside className={`${mobileNav ? "fixed inset-0 z-40 flex" : "hidden"} shrink-0 flex-col border-r border-(--crm-border) bg-(--crm-dark) px-5 py-6 text-(--crm-faint) md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto ${minimized ? "md:w-[76px] md:px-3" : "md:w-[246px] md:px-5"} ${mounted ? "transition-[width] duration-300" : ""}`}>
          <div className={`flex items-center justify-between px-2 ${minimized ? "mb-8" : "mb-11"}`}>
            <button type="button" onClick={() => setMinimized((prev) => !prev)} title={minimized ? "Expand sidebar" : "Minimize sidebar"} aria-label={minimized ? "Expand sidebar" : "Minimize sidebar"} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--crm-accent) font-[var(--font-space-mono)] text-sm font-bold text-(--crm-dark)">w</div>{!compact && <div className="min-w-0"><span className="block truncate text-[17px] font-semibold leading-tight tracking-[-.03em] text-white">{settings.siteName}</span><span className="block text-[10px] font-medium tracking-[.08em] text-(--crm-faint)">CRM · webkalcer.com</span></div>}</button>
            <button className="shrink-0 md:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
          </div>
          {!compact && <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-(--crm-faint)">Workspace</p>}
          <nav className="space-y-1">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} title={label} onClick={() => setMobileNav(false)} className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm transition-colors ${compact ? "justify-center px-2" : "px-3 text-left"} ${active ? "bg-(--crm-active) text-white" : "text-(--crm-faint) hover:bg-(--crm-darker) hover:text-white"}`}><Icon size={17} className="shrink-0" />{!compact && label}</Link>
              );
            })}
          </nav>
          {!compact && <p className="mb-3 mt-9 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-(--crm-faint)">Manage</p>}
          <nav className="space-y-1">
            <Link href="/settings" title="Settings" onClick={() => setMobileNav(false)} className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm transition-colors ${compact ? "justify-center px-2" : "px-3 text-left"} ${pathname === "/settings" ? "bg-(--crm-active) text-white" : "text-(--crm-faint) hover:bg-(--crm-darker) hover:text-white"}`}><Settings size={17} className="shrink-0" />{!compact && "Settings"}</Link>
          </nav>
          {!compact && <div className="mt-auto px-2 text-[11px] leading-5 text-(--crm-faint)"><p>© {new Date().getFullYear()} {settings.siteName} · webkalcer.com</p><p className="mt-0.5 text-(--crm-body)">Crafted with care for your business.</p></div>}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between border-b border-(--crm-border) bg-(--crm-surface) px-5 shadow-[0_1px_0_rgba(0,0,0,.03)] sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 hover:bg-(--crm-hover) md:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[.16em] text-(--crm-muted)">{subtitle}</p>
                <h1 className="mt-0.5 text-xl font-semibold tracking-[-.03em]">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <GlobalSearch />
              <button onClick={() => announce("No new notifications")} className="relative rounded-xl p-2 text-(--crm-secondary) transition-colors hover:bg-(--crm-hover)" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-(--crm-danger)" /></button>
              <div className="hidden h-7 w-px bg-(--crm-border) sm:block" />
              <div className="relative">
                <button onClick={() => setProfileOpen((prev) => !prev)} className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-(--crm-hover)"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--crm-soft) text-xs font-bold text-(--crm-fg)">{adminInitials}</span><span className="hidden max-w-[140px] truncate text-sm font-medium sm:block">{adminName || "Admin"}</span><ChevronDown size={14} className={`text-(--crm-muted) transition-transform ${profileOpen ? "rotate-180" : ""}`} /></button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="crm-rise absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-(--crm-border) bg-(--crm-panel) p-2 shadow-xl">
                      <div className="border-b border-(--crm-border-soft) px-3 pb-3 pt-2">
                        <p className="truncate text-sm font-semibold text-(--crm-fg)">{adminName || "Admin"}</p>
                        <p className="mt-0.5 truncate text-xs text-(--crm-muted)">{adminEmail}</p>
                      </div>
                      <Link href="/settings" onClick={() => setProfileOpen(false)} className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-(--crm-fg) transition-colors hover:bg-(--crm-soft) hover:text-(--crm-text)"><Settings size={16} />Settings</Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1480px] flex-1 px-5 py-7 sm:px-8 lg:px-10">{children}</div>
        </main>
      </div>
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-(--crm-dark) px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}
