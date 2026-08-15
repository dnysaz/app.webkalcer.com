import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Image host for <Image/> (product thumbnails stored on Cloudflare R2).
const r2Host = (() => {
  const pub = process.env.R2_PUBLIC_URL;
  if (pub) {
    try {
      return new URL(pub).host;
    } catch {
      // fall through to default below
    }
  }
  return "pub-9ab970da1dae4d43b0957b7b79cabf58.r2.dev";
})();

// CSP is deliberately pragmatic: Next.js App Router inlines the RSC flight
// payload (`script-src 'unsafe-inline'`) and jsPDF uses blob/data URLs, so the
// strictest possible policy isn't compatible without nonce plumbing.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "media-src 'self' data:",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: r2Host }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp }, ...securityHeaders],
      },
    ];
  },
};

export default nextConfig;