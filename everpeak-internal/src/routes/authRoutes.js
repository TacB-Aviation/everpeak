import {
  createSession,
  destroySession,
  checkAndRecordAttempt,
  clearAttempts,
} from "../lib/auth.js";
import { verifyPassword, hashPassword, isStrongPassword, sha256Hex } from "../lib/crypto.js";
import { json } from "../lib/respond.js";

export async function handleLogin(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return json({ error: "Email and password are required." }, 400);

  const attemptKey = `${email}:${ip}`;
  const attempt = await checkAndRecordAttempt(env, attemptKey);
  if (!attempt.allowed) {
    return json({ error: "Too many failed attempts. Try again later." }, 429);
  }

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, role, active FROM users WHERE email = ?`
  )
    .bind(email)
    .first();

  // Always run a verify (even against a dummy hash) to avoid timing leaks about account existence.
  const dummyHash = "pbkdf2:210000:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const ok = await verifyPassword(password, user?.password_hash || dummyHash);

  if (!user || !ok || !user.active) {
    return json({ error: "Invalid email or password." }, 401);
  }

  await clearAttempts(env, attemptKey);
  await env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(user.id)
    .run();

  const headers = await createSession(env, request, user.id);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true }), { headers });
}

export async function handleLogout(request, env) {
  const headers = await destroySession(env, request);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true }), { headers });
}

export async function handleAcceptInvite(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const { token, password } = body;
  if (!token || !password) return json({ error: "Missing fields." }, 400);
  if (!isStrongPassword(password)) {
    return json(
      { error: "Password must be 12+ characters with upper/lowercase, a number, and a symbol." },
      400
    );
  }

  const tokenHash = await sha256Hex(token);
  const invite = await env.DB.prepare(
    `SELECT * FROM invites WHERE token_hash = ? AND used = 0`
  )
    .bind(tokenHash)
    .first();

  if (!invite || new Date(invite.expires_at) < new Date()) {
    return json({ error: "This invite link is invalid or has expired." }, 400);
  }

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(invite.email)
    .first();
  if (existing) {
    return json({ error: "An account with this email already exists." }, 400);
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)`
    ).bind(id, invite.email, passwordHash, invite.role),
    env.DB.prepare(`UPDATE invites SET used = 1 WHERE token_hash = ?`).bind(tokenHash),
  ]);

  return json({ ok: true });
}
