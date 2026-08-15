import { randomUUID } from "crypto";

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * NOTE: On serverless platforms (Vercel, Neon) memory does not persist across
 * cold starts or multiple instances, so this throttles per-instance traffic.
 * It still stops the most common brute-force/abuse patterns. For a fully
 * distributed limit, move the counters to the database (Neon) — the interface
 * is kept identical to swap it out later.
 */

const MAX_WINDOW_MS = 30 * 60 * 1000; // longest window we track
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

function sweep() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < MAX_WINDOW_MS);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Maximum number of allowed attempts within `windowMs`. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds to wait before the next attempt is allowed. */
  retryAfterMs: number;
}

/** Rates a request keyed by `key`; mutates internal counters. */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  sweep();
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);
  if (bucket.hits.length >= options.limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterMs = Math.max(1, options.windowMs - (now - oldest));
    return { allowed: false, retryAfterMs };
  }
  bucket.hits.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/** Extracts a stable caller id from a fetch Request (handles proxies). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Generates a cryptographically secure random id for this caller. */
export function callerId(): string {
  return randomUUID();
}