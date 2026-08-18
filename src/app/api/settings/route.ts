import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSql, query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { setupDatabase } from "@/lib/setup";
import { DEFAULT_SETTINGS, FONT_SIZES, SETTINGS_ROW_ID, THEMES } from "@/lib/settings";
import type { FontSizeKey, ThemeKey } from "@/lib/settings";
import { MAX_GEMINI_KEYS, parseGeminiKeys } from "@/lib/gemini";

type SettingsRow = { site_name: string; theme: string; font_size: string; gemini_api_key: string };

export async function GET() {
  try {
    const rows = await query<SettingsRow>`SELECT site_name, theme, font_size, gemini_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    const row = rows[0];
    return NextResponse.json({
      siteName: row?.site_name ?? DEFAULT_SETTINGS.siteName,
      theme: row?.theme && THEMES[row.theme as ThemeKey] ? (row.theme as ThemeKey) : DEFAULT_SETTINGS.theme,
      fontSize: row?.font_size && FONT_SIZES[row.font_size as FontSizeKey] ? (row.font_size as FontSizeKey) : DEFAULT_SETTINGS.fontSize,
      // Never send the raw key to the browser — only whether one is configured.
      hasGeminiKey: !!row?.gemini_api_key,
      geminiKeyCount: parseGeminiKeys(row?.gemini_api_key ?? "").length,
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
    const body = (await request.json()) as { siteName?: string; theme?: string; fontSize?: string; geminiApiKey?: string; merge?: boolean };
    const siteName = typeof body.siteName === "string" ? body.siteName.trim().slice(0, 80) : undefined;
    const theme = body.theme && THEMES[body.theme as ThemeKey] ? (body.theme as ThemeKey) : undefined;
    const fontSize = body.fontSize && FONT_SIZES[body.fontSize as FontSizeKey] ? (body.fontSize as FontSizeKey) : undefined;
    const geminiApiKey = typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : undefined;
    const merge = body.merge === true;

    if (siteName !== undefined && !siteName) {
      return NextResponse.json({ error: "Site name cannot be empty." }, { status: 400 });
    }
    if (siteName === undefined && theme === undefined && fontSize === undefined && geminiApiKey === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await setupDatabase();
    const rows = await query<SettingsRow>`SELECT site_name, theme, font_size, gemini_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    const current = rows[0];
    // In merge mode the incoming keys are appended to the stored ones
    // (deduped) instead of replacing them.
    let finalKeysValue = geminiApiKey;
    if (merge && geminiApiKey !== undefined) {
      const existing = parseGeminiKeys(current?.gemini_api_key ?? "");
      const incoming = parseGeminiKeys(geminiApiKey);
      const combined = [...existing, ...incoming];
      finalKeysValue = [...new Set(combined)].slice(0, MAX_GEMINI_KEYS).join("\n");
    }
    const geminiKeyCount = parseGeminiKeys(finalKeysValue ?? current?.gemini_api_key ?? "").length;
    const sql = getSql();
    await sql`
      INSERT INTO settings (id, site_name, theme, font_size, gemini_api_key, updated_at)
      VALUES (${SETTINGS_ROW_ID}, ${siteName ?? current?.site_name ?? DEFAULT_SETTINGS.siteName}, ${theme ?? current?.theme ?? DEFAULT_SETTINGS.theme}, ${fontSize ?? current?.font_size ?? DEFAULT_SETTINGS.fontSize}, ${finalKeysValue ?? current?.gemini_api_key ?? ""}, now())
      ON CONFLICT (id) DO UPDATE SET
        site_name = EXCLUDED.site_name,
        theme = EXCLUDED.theme,
        font_size = EXCLUDED.font_size,
        gemini_api_key = EXCLUDED.gemini_api_key,
        updated_at = now()`;

    return NextResponse.json({
      siteName: siteName ?? current?.site_name ?? DEFAULT_SETTINGS.siteName,
      theme: theme ?? current?.theme ?? DEFAULT_SETTINGS.theme,
      fontSize: fontSize ?? current?.font_size ?? DEFAULT_SETTINGS.fontSize,
      hasGeminiKey: geminiApiKey !== undefined ? !!geminiApiKey.trim() : !!current?.gemini_api_key,
      geminiKeyCount,
    });
  } catch (error) {
    console.error("Update settings failed:", error);
    return NextResponse.json({ error: "Something went wrong while updating settings." }, { status: 500 });
  }
}
