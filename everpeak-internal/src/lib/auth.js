import { randomToken, sha256Hex } from "./crypto.js";

const SESSION_COOKIE = "eps_session";
const CSRF_COOKIE = "eps_csrf";
const SESSION_TTL_HOURS = 12;
const MAX_ATTEMPTS = 6;
const LOCKOUT_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function baseCookieAttrs() {
  // Secure + HttpOnly + SameSite=Strict on the session cookie; CSRF cookie is
  // readable by JS (needed for double-submit) but still Secure + SameSite=Strict.
  return `Path=/; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_HOURS * 3600}`;
}

export async function createSession(env, request, userId) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";

  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(tokenHash, userId, csrfToken, ip, ua, expires)
    .run();

  const headers = new Headers();
  headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; ${baseCookieAttrs()}`);
  headers.append("Set-Cookie", `${CSRF_COOKIE}=${csrfToken}; ${baseCookieAttrs()}`);
  return headers;
}

export async function destroySession(env, request) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
  }
  const headers = new Headers();
  headers.append("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Secure; SameSite=Strict; Max-Age=0`);
  headers.append("Set-Cookie", `${CSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`);
  return headers;
}

/**
 * Resolves the current session, if any. Returns null if no valid, unexpired
 * session exists. Does NOT throw — callers decide how to respond (404, etc).
 */
export async function getSession(env, request) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.user_id, s.csrf_token, s.expires_at,
            u.email, u.role, u.active
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first();

  if (!row) return null;
  if (!row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
    return null;
  }
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    csrfToken: row.csrf_token,
  };
}

/** CSRF check for state-changing requests: header must match the csrf cookie AND the session record. */
export function checkCsrf(request, session) {
  const cookies = parseCookies(request);
  const cookieCsrf = cookies[CSRF_COOKIE];
  const headerCsrf = request.headers.get("X-CSRF-Token");
  if (!cookieCsrf || !headerCsrf || !session) return false;
  return cookieCsrf === headerCsrf && cookieCsrf === session.csrfToken;
}

/** Rate limiting for login attempts, keyed by email+IP combined. */
export async function checkAndRecordAttempt(env, key) {
  const now = new Date();
  const row = await env.DB.prepare(`SELECT * FROM login_attempts WHERE key = ?`).bind(key).first();

  if (row?.locked_until && new Date(row.locked_until) > now) {
    return { allowed: false, lockedUntil: row.locked_until };
  }

  if (row) {
    const windowStart = new Date(row.first_attempt);
    const withinWindow = now - windowStart < ATTEMPT_WINDOW_MINUTES * 60 * 1000;
    const newCount = withinWindow ? row.count + 1 : 1;
    const newFirst = withinWindow ? row.first_attempt : now.toISOString();
    let lockedUntil = null;
    if (newCount >= MAX_ATTEMPTS) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    await env.DB.prepare(
      `UPDATE login_attempts SET count = ?, first_attempt = ?, locked_until = ? WHERE key = ?`
    )
      .bind(newCount, newFirst, lockedUntil, key)
      .run();
    return { allowed: !lockedUntil, lockedUntil };
  } else {
    await env.DB.prepare(
      `INSERT INTO login_attempts (key, count, first_attempt) VALUES (?, 1, ?)`
    )
      .bind(key, now.toISOString())
      .run();
    return { allowed: true, lockedUntil: null };
  }
}

export async function clearAttempts(env, key) {
  await env.DB.prepare(`DELETE FROM login_attempts WHERE key = ?`).bind(key).run();
}

export function requireRole(session, roles) {
  return !!session && roles.includes(session.role);
}
