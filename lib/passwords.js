import crypto from "node:crypto";

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [method, iterationsText, salt, expectedHash] = String(passwordHash || "").split("$");
  if (method !== "pbkdf2" || !iterationsText || !salt || !expectedHash) return false;
  const iterations = Number(iterationsText);
  const actual = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("base64url");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}
