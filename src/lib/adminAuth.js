import crypto from "node:crypto";
import { adminSessionSecret } from "../config.js";

export const ADMIN_SESSION_COOKIE = "quiz_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", adminSessionSecret)
    .update(payload)
    .digest("base64url");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(String(password || ""), salt, 64).toString("base64url");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  const normalizedHash = String(storedHash || "");
  const [scheme, salt, hash] = normalizedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derived = crypto.scryptSync(String(password || ""), salt, 64).toString("base64url");
  return safeCompare(derived, hash);
}

export function createAdminSessionToken(admin) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const nonce = crypto.randomBytes(16).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      adminId: Number(admin.id),
      username: String(admin.username || ""),
      expiresAt,
      nonce,
    }),
  ).toString("base64url");

  return {
    token: `${payload}.${signPayload(payload)}`,
    expiresAt,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function parseAdminSessionToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken.includes(".")) {
    return null;
  }

  const [payload, signature] = normalizedToken.split(".");
  if (!payload || !signature || !safeCompare(signature, signPayload(payload))) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded?.adminId || !decoded?.username || decoded.expiresAt <= Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
