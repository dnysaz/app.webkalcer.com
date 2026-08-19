import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { DEFAULT_SETTINGS, FONT_SIZES, SETTINGS_ROW_ID, THEMES } from "@/lib/settings";
import type { FontSizeKey, ThemeKey } from "@/lib/settings";
import { MAX_GEMINI_KEYS, parseGeminiKeys } from "@/lib/gemini";

type SettingsRow = { site_name: string; theme: string; font_size: string; gemini_api_key: string; porkbun_api_key: string; porkbun_secret_api_key: string };

/** Returns the last 5 characters of each key — enough to identify it, never enough to use it. */
function keyTails(keys: string[]): string[] {
  return keys.map((k) => k.slice(-5));
}

export async function GET() {
  try {
    const rows = await query<SettingsRow>`SELECT site_name, theme, font_size, gemini_api_key, porkbun_api_key, porkbun_secret_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    const row = rows[0];
    const keys = parseGeminiKeys(row?.gemini_api_key ?? "");
    const porkbunApiKey = (row?.porkbun_api_key ?? "").trim();
    const porkbunSecretKey = (row?.porkbun_secret_api_key ?? "").trim();
    const hasPorkbun = porkbunApiKey.length > 0 && porkbunSecretKey.length > 0;
    return NextResponse.json({
      siteName: row?.site_name ?? DEFAULT_SETTINGS.siteName,
      theme: row?.theme && THEMES[row.theme as ThemeKey] ? (row.theme as ThemeKey) : DEFAULT_SETTINGS.theme,
      fontSize: row?.font_size && FONT_SIZES[row.font_size as FontSizeKey] ? (row.font_size as FontSizeKey) : DEFAULT_SETTINGS.fontSize,
      // Never send the raw key to the browser — only a safe tail for identification.
      hasGeminiKey: keys.length > 0,
      geminiKeyCount: keys.length,
      geminiKeyTails: keyTails(keys),
      hasPorkbunKey: hasPorkbun,
      porkbunKeyTail: hasPorkbun ? porkbunApiKey.slice(-5) : "",
      porkbunSecretKeyTail: hasPorkbun ? porkbunSecretKey.slice(-5) : "",
    });
  } catch (error) {
    // Table may not exist yet on a brand-new DB (schema is created by
    // /api/setup when the app first loads). Return defaults instead of
    // running the full ~30-statement migration on every page view.
    if ((error as { code?: string })?.code === "42P01") {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { siteName?: string; theme?: string; fontSize?: string; geminiApiKey?: string; merge?: boolean; removeKeyIndex?: number; porkbunApiKey?: string; porkbunSecretApiKey?: string; clearPorkbunKeys?: boolean };
    const siteName = typeof body.siteName === "string" ? body.siteName.trim().slice(0, 80) : undefined;
    const theme = body.theme && THEMES[body.theme as ThemeKey] ? (body.theme as ThemeKey) : undefined;
    const fontSize = body.fontSize && FONT_SIZES[body.fontSize as FontSizeKey] ? (body.fontSize as FontSizeKey) : undefined;
    const geminiApiKey = typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : undefined;
    const merge = body.merge === true;
    const removeKeyIndex = typeof body.removeKeyIndex === "number" ? body.removeKeyIndex : undefined;
    const porkbunApiKey = typeof body.porkbunApiKey === "string" ? body.porkbunApiKey.trim() : undefined;
    const porkbunSecretApiKey = typeof body.porkbunSecretApiKey === "string" ? body.porkbunSecretApiKey.trim() : undefined;
    const clearPorkbunKeys = body.clearPorkbunKeys === true;

    if (siteName !== undefined && !siteName) {
      return NextResponse.json({ error: "Site name cannot be empty." }, { status: 400 });
    }
    if (
      siteName === undefined && theme === undefined && fontSize === undefined && geminiApiKey === undefined &&
      removeKeyIndex === undefined && porkbunApiKey === undefined && porkbunSecretApiKey === undefined && !clearPorkbunKeys
    ) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    // Porkbun keys must be saved as a pair.
    if ((porkbunApiKey !== undefined && porkbunSecretApiKey === undefined) || (porkbunApiKey === undefined && porkbunSecretApiKey !== undefined)) {
      return NextResponse.json({ error: "Enter both Porkbun API key and secret key." }, { status: 400 });
    }
    if ((porkbunApiKey !== undefined && !porkbunApiKey) || (porkbunSecretApiKey !== undefined && !porkbunSecretApiKey)) {
      return NextResponse.json({ error: "Porkbun API keys cannot be empty." }, { status: 400 });
    }

    await setupDatabase();
    const rows = await query<SettingsRow>`SELECT site_name, theme, font_size, gemini_api_key, porkbun_api_key, porkbun_secret_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    const current = rows[0];

    let finalKeysValue: string | undefined = geminiApiKey;

    // Handle removeKeyIndex: hapus key by index dari stored keys
    if (removeKeyIndex !== undefined) {
      const existing = parseGeminiKeys(current?.gemini_api_key ?? "");
      if (removeKeyIndex < 0 || removeKeyIndex >= existing.length) {
        return NextResponse.json({ error: "Invalid key index." }, { status: 400 });
      }
      const remaining = existing.filter((_, i) => i !== removeKeyIndex);
      finalKeysValue = remaining.join("\n");
    } else if (merge && geminiApiKey !== undefined) {
      // Merge mode: append incoming ke stored, dedup
      const existing = parseGeminiKeys(current?.gemini_api_key ?? "");
      const incoming = parseGeminiKeys(geminiApiKey);
      const combined = [...existing, ...incoming];
      const deduped = [...new Set(combined)].slice(0, MAX_GEMINI_KEYS);
      if (deduped.length < combined.length) {
        return NextResponse.json({ error: "Duplicate API keys detected — each key must be unique." }, { status: 400 });
      }
      finalKeysValue = deduped.join("\n");
    } else if (!merge && geminiApiKey !== undefined) {
      // Replace mode: validasi duplikat pada incoming
      const incoming = parseGeminiKeys(geminiApiKey);
      if (new Set(incoming).size !== incoming.length) {
        return NextResponse.json({ error: "Duplicate API keys detected — each key must be unique." }, { status: 400 });
      }
    }

    const finalKeys = parseGeminiKeys(finalKeysValue ?? current?.gemini_api_key ?? "");
    const finalKeysStored = finalKeys.join("\n");
    const finalPorkbunApiKey = clearPorkbunKeys ? "" : (porkbunApiKey ?? current?.porkbun_api_key ?? "");
    const finalPorkbunSecretKey = clearPorkbunKeys ? "" : (porkbunSecretApiKey ?? current?.porkbun_secret_api_key ?? "");
    const hasPorkbun = finalPorkbunApiKey.trim().length > 0 && finalPorkbunSecretKey.trim().length > 0;
    const sql = getSql();
    await sql`
      INSERT INTO settings (id, site_name, theme, font_size, gemini_api_key, porkbun_api_key, porkbun_secret_api_key, updated_at)
      VALUES (${SETTINGS_ROW_ID}, ${siteName ?? current?.site_name ?? DEFAULT_SETTINGS.siteName}, ${theme ?? current?.theme ?? DEFAULT_SETTINGS.theme}, ${fontSize ?? current?.font_size ?? DEFAULT_SETTINGS.fontSize}, ${finalKeysStored}, ${finalPorkbunApiKey}, ${finalPorkbunSecretKey}, now())
      ON CONFLICT (id) DO UPDATE SET
        site_name = EXCLUDED.site_name,
        theme = EXCLUDED.theme,
        font_size = EXCLUDED.font_size,
        gemini_api_key = EXCLUDED.gemini_api_key,
        porkbun_api_key = EXCLUDED.porkbun_api_key,
        porkbun_secret_api_key = EXCLUDED.porkbun_secret_api_key,
        updated_at = now()`;

    return NextResponse.json({
      siteName: siteName ?? current?.site_name ?? DEFAULT_SETTINGS.siteName,
      theme: theme ?? current?.theme ?? DEFAULT_SETTINGS.theme,
      fontSize: fontSize ?? current?.font_size ?? DEFAULT_SETTINGS.fontSize,
      hasGeminiKey: finalKeys.length > 0,
      geminiKeyCount: finalKeys.length,
      geminiKeyTails: keyTails(finalKeys),
      hasPorkbunKey: hasPorkbun,
      porkbunKeyTail: hasPorkbun ? finalPorkbunApiKey.trim().slice(-5) : "",
      porkbunSecretKeyTail: hasPorkbun ? finalPorkbunSecretKey.trim().slice(-5) : "",
    });
  } catch (error) {
    console.error("Update settings failed:", error);
    return NextResponse.json({ error: "Something went wrong while updating settings." }, { status: 500 });
  }
}
