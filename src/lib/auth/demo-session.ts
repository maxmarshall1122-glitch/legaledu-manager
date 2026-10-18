import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * DEMO MODE session token: base64url(JSON{uid,exp}).HMAC-SHA256. Stored in an
 * httpOnly, SameSite=Lax cookie. Production uses Supabase Auth instead.
 */
export const DEMO_SESSION_COOKIE = "le_demo_session";
export const DEMO_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function signSession(uid: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Math.floor(now / 1000) + DEMO_SESSION_TTL_SECONDS })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof uid !== "string" || typeof exp !== "number" || exp * 1000 < now) return null;
    return uid;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
