"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_SETTINGS, FONT_SIZES, THEMES, THEME_VAR_KEYS } from "@/lib/settings";
import type { FontSizeKey, SiteSettings, ThemeKey } from "@/lib/settings";

/** Patch payload. `geminiApiKey` is send-only — the stored key never leaves the server. */
export type SettingsPatch = Partial<SiteSettings> & { geminiApiKey?: string; merge?: boolean; removeKeyIndex?: number };

type SettingsContextValue = {
  settings: SiteSettings;
  updateSettings: (patch: SettingsPatch) => Promise<{ hasGeminiKey?: boolean; geminiKeyCount?: number }>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyTheme(theme: ThemeKey) {
  const colors = THEMES[theme];
  const root = document.documentElement;
  for (const key of THEME_VAR_KEYS) {
    root.style.setProperty(`--crm-${key}`, colors[key]);
  }
}

function applyFontSize(fontSize: FontSizeKey) {
  document.documentElement.style.fontSize = `${FONT_SIZES[fontSize].px}px`;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  // Load settings once on mount and apply theme + title.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { siteName?: string; theme?: ThemeKey; fontSize?: FontSizeKey; hasGeminiKey?: boolean; geminiKeyCount?: number; geminiKeyTails?: string[] }) => {
        if (cancelled) return;
        setSettings({
          siteName: data.siteName && data.siteName.trim() ? data.siteName.trim() : DEFAULT_SETTINGS.siteName,
          theme: data.theme && THEMES[data.theme] ? data.theme : DEFAULT_SETTINGS.theme,
          fontSize: data.fontSize && FONT_SIZES[data.fontSize] ? data.fontSize : DEFAULT_SETTINGS.fontSize,
          hasGeminiKey: !!data.hasGeminiKey,
          geminiKeyCount: typeof data.geminiKeyCount === "number" ? data.geminiKeyCount : 0,
          geminiKeyTails: Array.isArray(data.geminiKeyTails) ? data.geminiKeyTails : [],
        });
      })
      .catch(() => {
        // Keep defaults if settings can't be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep document title, theme, and font size in sync.
  useEffect(() => {
    document.title = settings.siteName;
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
  }, [settings]);

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { siteName?: string; theme?: ThemeKey; fontSize?: FontSizeKey; hasGeminiKey?: boolean; geminiKeyCount?: number; geminiKeyTails?: string[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Something went wrong while saving settings.");
    setSettings((prev) => ({
      siteName: data.siteName ?? prev.siteName,
      theme: data.theme ?? prev.theme,
      fontSize: data.fontSize ?? prev.fontSize,
      hasGeminiKey: typeof data.hasGeminiKey === "boolean" ? data.hasGeminiKey : prev.hasGeminiKey,
      geminiKeyCount: typeof data.geminiKeyCount === "number" ? data.geminiKeyCount : prev.geminiKeyCount,
      geminiKeyTails: Array.isArray(data.geminiKeyTails) ? data.geminiKeyTails : prev.geminiKeyTails,
    }));
    return data;
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
