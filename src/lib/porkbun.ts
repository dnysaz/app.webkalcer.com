import { query } from "./db";
import { SETTINGS_ROW_ID } from "./settings";

export const PORKBUN_BASE = "https://api.porkbun.com/api/json/v3";

type PorkbunSettingsRow = { porkbun_api_key: string; porkbun_secret_api_key: string };

export interface TldPricing {
  registration: string;
  renewal: string;
  transfer: string;
}

export interface DomainCheckResult {
  domain: string;
  available: boolean;
  premium: boolean;
  purchasable: boolean;
  price: string;
  renewalPrice: string;
  transferPrice: string;
  currency: string;
  suggestedDomain: string;
  ttlRemaining: number | null;
  /** USD → IDR rate used to convert the prices above. */
  rate: number;
}

/** Fallback USD→IDR rate when the live rate can't be fetched. */
const USD_TO_IDR_FALLBACK = 16000;

/**
 * Returns the current USD → IDR exchange rate (IDR per 1 USD).
 * Fetches from Frankfurter (ECB data, free, no key) with a fixed fallback.
 */
export async function getUsdToIdrRate(): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { rates?: { IDR?: number } };
      const rate = Number(data.rates?.IDR);
      if (rate > 0) return rate;
    }
  } catch {
    // Network or timeout — fall through to the fixed fallback rate.
  }
  return USD_TO_IDR_FALLBACK;
}

/**
 * Returns the configured Porkbun credentials (public + secret key).
 * Reads from the settings row first, falling back to PORKBUN_API_KEY /
 * PORKBUN_SECRET_API_KEY env vars. Returns null when not configured.
 */
export async function getPorkbunCredentials(): Promise<{ apiKey: string; secretKey: string } | null> {
  let stored: PorkbunSettingsRow | undefined;
  try {
    const rows = await query<PorkbunSettingsRow>`SELECT porkbun_api_key, porkbun_secret_api_key FROM settings WHERE id = ${SETTINGS_ROW_ID} LIMIT 1`;
    stored = rows[0];
  } catch {
    // Settings table may not exist yet on a fresh DB — env fallback below.
  }
  const apiKey = (stored?.porkbun_api_key || "").trim() || process.env.PORKBUN_API_KEY || "";
  const secretKey = (stored?.porkbun_secret_api_key || "").trim() || process.env.PORKBUN_SECRET_API_KEY || "";
  if (apiKey && secretKey) return { apiKey, secretKey };
  return null;
}

/** True when Porkbun credentials are configured (Settings row or env). */
export async function hasPorkbunCredentials(): Promise<boolean> {
  return (await getPorkbunCredentials()) !== null;
}

/** Default pricing for supported TLDs. Public endpoint, no auth required. Prices in USD. */
export async function getTldPricing(): Promise<Record<string, TldPricing>> {
  const res = await fetch(`${PORKBUN_BASE}/pricing/get`, { method: "GET" });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    pricing?: Record<string, Partial<TldPricing>>;
    message?: string;
  };
  if (!res.ok || data.status !== "SUCCESS") {
    throw new Error(data.message || `Porkbun pricing request failed (${res.status}).`);
  }
  return (data.pricing ?? {}) as Record<string, TldPricing>;
}

/** Live availability + registration/renewal/transfer prices for one domain. Requires API keys. */
export async function checkDomainPricing(domain: string): Promise<DomainCheckResult> {
  const creds = await getPorkbunCredentials();
  if (!creds) {
    throw new Error("Porkbun API keys are not configured. Add them in Settings → Porkbun API.");
  }
  const res = await fetch(`${PORKBUN_BASE}/domain/checkDomain/${encodeURIComponent(domain)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": creds.apiKey, "X-Secret-API-Key": creds.secretKey },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    ttlRemaining?: number | null;
    response?: {
      domain?: string;
      avail?: string;
      price?: string;
      renewalPrice?: string;
      transferPrice?: string;
      premium?: boolean;
      purchasable?: boolean;
      suggestedDomain?: string;
      currency?: string;
    };
  };
  if (!res.ok || data.status !== "SUCCESS") {
    throw new Error(data.message || `Porkbun domain check failed (${res.status}).`);
  }
  const r = data.response ?? {};
  const rate = await getUsdToIdrRate();
  return {
    domain: r.domain ?? domain,
    available: r.avail === "yes",
    premium: r.premium === true,
    purchasable: r.purchasable === true,
    price: r.price ?? "",
    renewalPrice: r.renewalPrice ?? "",
    transferPrice: r.transferPrice ?? "",
    currency: r.currency ?? "USD",
    suggestedDomain: r.suggestedDomain ?? "",
    ttlRemaining: typeof data.ttlRemaining === "number" ? data.ttlRemaining : null,
    rate,
  };
}
