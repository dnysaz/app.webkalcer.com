import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// `__Host-` prefix hardens the cookie (Secure + path=/ + no Domain) but is
// only accepted over HTTPS — plain http://localhost rejects Secure cookies,
// so dev keeps a plain name while production gets the hardened one.
export const AUTH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-wcrmauth" : "wcrmauth";
const TOKEN_ISSUER = "webkalcer-crm";
const TOKEN_AUDIENCE = "webkalcer-crm";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(email: string): Promise<void> {
  const token = await signToken(email);
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  // Delete with the exact same attributes used by setSession (Secure + path=/).
  // A bare `store.delete()` drops Secure, so browsers reject the __Host- prefixed
  // deletion cookie and the original cookie survives — the user stays logged in.
  store.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function requireAuth(): Promise<boolean> {
  return (await getSessionEmail()) !== null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
