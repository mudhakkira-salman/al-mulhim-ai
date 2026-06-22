import crypto from "node:crypto";

const COOKIE_NAME = "mulhim_session";
const SESSION_DAYS = 30;
const SECRET = process.env.SESSION_SECRET || "dev-change-this-session-secret";

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function createSessionCookie(userId) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: expiresAt })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: "/"
    }
  };
}

export function readSessionUserId(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return Number(data.uid);
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function serializeCookie(cookie) {
  const pieces = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  if (cookie.options.httpOnly) pieces.push("HttpOnly");
  if (cookie.options.sameSite) pieces.push(`SameSite=${cookie.options.sameSite}`);
  if (cookie.options.secure) pieces.push("Secure");
  if (cookie.options.maxAge) pieces.push(`Max-Age=${cookie.options.maxAge}`);
  if (cookie.options.path) pieces.push(`Path=${cookie.options.path}`);
  return pieces.join("; ");
}
