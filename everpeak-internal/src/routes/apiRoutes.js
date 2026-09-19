import { json } from "../lib/respond.js";
import { requireRole, checkCsrf } from "../lib/auth.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";
import { sendMail, inviteEmailHtml } from "../lib/email.js";

const uid = () => crypto.randomUUID();

function mustBeAuthed(session) {
  return !!session;
}

function forbidReadOnlyWrite(request, session) {
  // Only managers can perform mutating requests on core resources.
  if (request.method === "GET") return null;
  if (!requireRole(session, ["manager"])) {
    return json({ error: "You do not have permission to make this change." }, 403);
  }
  return null;
}

/**
 * Routes /api/* (excluding /api/auth/* and /api/public/*) which all require
 * an authenticated session. Returns a Response, or null if no route matched.
 */
export async function handleApi(request, env, session, url) {
  if (!mustBeAuthed(session)) return json({ error: "Unauthorized" }, 401);

  // CSRF protection on every mutating request.
  if (request.method !== "GET" && !checkCsrf(request, session)) {
    return json({ error: "Invalid CSRF token." }, 403);
  }

  const path = url.pathname;
  const parts = path.split("/").filter(Boolean); // ["api", "bookings", ":id"]

  // ---------- BOOKINGS ----------
  if (parts[1] === "bookings") {
    const guard = forbidReadOnlyWrite(request, session);
    if (guard) return guard;
    return handleBookings(request, env, parts[2]);
  }

  // ---------- CLIENTS ----------
  if (parts[1] === "clients") {
    const guard = forbidReadOnlyWrite(request, session);
    if (guard) return guard;
    return handleClients(request, env, parts[2]);
  }

  // ---------- PAYMENTS ----------
  if (parts[1] === "payments") {
    const guard = forbidReadOnlyWrite(request, session);
    if (guard) return guard;
    return handlePayments(request, env, parts[2]);
  }

  // ---------- NOTES (both roles may create; only managers resolve/delete) ----------
  if (parts[1] === "notes") {
    return handleNotes(request, env, session, parts[2]);
  }

  // ---------- AVAILABILITY RULES ----------
  if (parts[1] === "availability" && parts[2] === "rules") {
    const guard = forbidReadOnlyWrite(request, session);
    if (guard) return guard;
    return handleAvailabilityRules(request, env, parts[3]);
  }

  // ---------- USERS (manager only) ----------
  if (parts[1] === "users") {
    if (!requireRole(session, ["manager"])) return json({ error: "Forbidden" }, 403);
    return handleUsers(request, env, parts[2], session);
  }

  // ---------- INVITES (manager only) ----------
  if (parts[1] === "invites") {
    if (!requireRole(session, ["manager"])) return json({ error: "Forbidden" }, 403);
    return handleInvites(request, env, session);
  }

  return null;
}

// ---------------- BOOKINGS ----------------
async function handleBookings(request, env, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT b.*, c.name as client_name FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       ORDER BY b.date ASC, b.start_time ASC`
    ).all();
    return json(results);
  }
  if (request.method === "POST") {
    const b = await request.json();
    if (!b.date || !b.start_time || !b.end_time || !b.session_type) {
      return json({ error: "Missing required fields." }, 400);
    }
    const id2 = uid();
    await env.DB.prepare(
      `INSERT INTO bookings (id, client_id, date, start_time, end_time, session_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id2, b.client_id || null, b.date, b.start_time, b.end_time, b.session_type, b.status || "confirmed")
      .run();
    return json({ ok: true, id: id2 });
  }
  if (request.method === "PUT" && id) {
    const b = await request.json();
    await env.DB.prepare(
      `UPDATE bookings SET client_id=?, date=?, start_time=?, end_time=?, session_type=?, status=?, updated_at=datetime('now')
       WHERE id=?`
    )
      .bind(b.client_id || null, b.date, b.start_time, b.end_time, b.session_type, b.status || "confirmed", id)
      .run();
    return json({ ok: true });
  }
  if (request.method === "DELETE" && id) {
    await env.DB.prepare(`DELETE FROM bookings WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- CLIENTS ----------------
async function handleClients(request, env, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(`SELECT * FROM clients ORDER BY name ASC`).all();
    return json(results);
  }
  if (request.method === "POST") {
    const c = await request.json();
    if (!c.name) return json({ error: "Name is required." }, 400);
    const id2 = uid();
    await env.DB.prepare(
      `INSERT INTO clients (id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id2, c.name, c.email || null, c.phone || null, c.address || null)
      .run();
    return json({ ok: true, id: id2 });
  }
  if (request.method === "PUT" && id) {
    const c = await request.json();
    await env.DB.prepare(
      `UPDATE clients SET name=?, email=?, phone=?, address=?, updated_at=datetime('now') WHERE id=?`
    )
      .bind(c.name, c.email || null, c.phone || null, c.address || null, id)
      .run();
    return json({ ok: true });
  }
  if (request.method === "DELETE" && id) {
    await env.DB.prepare(`DELETE FROM clients WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- PAYMENTS ----------------
async function handlePayments(request, env, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT p.*, c.name as client_name FROM payments p
       LEFT JOIN clients c ON c.id = p.client_id
       ORDER BY p.created_at DESC`
    ).all();
    return json(results);
  }
  if (request.method === "POST") {
    const p = await request.json();
    if (!p.amount) return json({ error: "Amount is required." }, 400);
    const id2 = uid();
    await env.DB.prepare(
      `INSERT INTO payments (id, client_id, booking_id, amount, method, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id2, p.client_id || null, p.booking_id || null, p.amount, p.method || null, p.status || "paid", p.paid_at || null)
      .run();
    return json({ ok: true, id: id2 });
  }
  if (request.method === "PUT" && id) {
    const p = await request.json();
    await env.DB.prepare(
      `UPDATE payments SET client_id=?, amount=?, method=?, status=?, paid_at=? WHERE id=?`
    )
      .bind(p.client_id || null, p.amount, p.method || null, p.status || "paid", p.paid_at || null, id)
      .run();
    return json({ ok: true });
  }
  if (request.method === "DELETE" && id) {
    await env.DB.prepare(`DELETE FROM payments WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- NOTES ----------------
async function handleNotes(request, env, session, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT n.*, u.email as author_email FROM notes n
       LEFT JOIN users u ON u.id = n.author_id
       ORDER BY n.created_at DESC`
    ).all();
    return json(results);
  }
  if (request.method === "POST") {
    const n = await request.json();
    if (!n.content) return json({ error: "Note content is required." }, 400);
    const id2 = uid();
    await env.DB.prepare(
      `INSERT INTO notes (id, entity_type, entity_id, author_id, content) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id2, n.entity_type || "general", n.entity_id || null, session.userId, n.content)
      .run();
    return json({ ok: true, id: id2 });
  }
  if (request.method === "PUT" && id) {
    // Only managers may mark notes resolved / edit them.
    if (!requireRole(session, ["manager"])) return json({ error: "Forbidden" }, 403);
    const n = await request.json();
    await env.DB.prepare(`UPDATE notes SET resolved = ? WHERE id = ?`)
      .bind(n.resolved ? 1 : 0, id)
      .run();
    return json({ ok: true });
  }
  if (request.method === "DELETE" && id) {
    if (!requireRole(session, ["manager"])) return json({ error: "Forbidden" }, 403);
    await env.DB.prepare(`DELETE FROM notes WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- AVAILABILITY RULES ----------------
async function handleAvailabilityRules(request, env, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM availability_rules ORDER BY day_of_week ASC, start_time ASC`
    ).all();
    return json(results);
  }
  if (request.method === "POST") {
    const r = await request.json();
    if (r.day_of_week === undefined || !r.start_time || !r.end_time) {
      return json({ error: "Missing fields." }, 400);
    }
    const id2 = uid();
    await env.DB.prepare(
      `INSERT INTO availability_rules (id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`
    )
      .bind(id2, parseInt(r.day_of_week, 10), r.start_time, r.end_time)
      .run();
    return json({ ok: true, id: id2 });
  }
  if (request.method === "DELETE" && id) {
    await env.DB.prepare(`DELETE FROM availability_rules WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- USERS ----------------
async function handleUsers(request, env, id, session) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT id, email, role, active, created_at, last_login_at FROM users ORDER BY created_at ASC`
    ).all();
    return json(results);
  }
  if (request.method === "PUT" && id) {
    const u = await request.json();
    if (id === session.userId && u.active === 0) {
      return json({ error: "You cannot disable your own account." }, 400);
    }
    await env.DB.prepare(`UPDATE users SET active = ? WHERE id = ?`)
      .bind(u.active ? 1 : 0, id)
      .run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------------- INVITES ----------------
async function handleInvites(request, env, session) {
  if (request.method !== "POST") return json({ error: "Not found" }, 404);
  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  const role = body.role === "manager" ? "manager" : "rep";
  if (!email) return json({ error: "Email is required." }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (existing) return json({ error: "That email already has an account." }, 400);

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO invites (token_hash, email, role, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(tokenHash, email, role, session.userId, expires)
    .run();

  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/accept-invite?token=${token}`;

  try {
    await sendMail(env, {
      to: email,
      subject: "You've been invited to EverPeak Internal",
      html: inviteEmailHtml({ inviteUrl, role, appName: "EverPeak Internal" }),
    });
  } catch (err) {
    return json(
      { error: "Invite created, but the email failed to send. Check GMAIL_USER/GMAIL_APP_PASSWORD secrets. Link: " + inviteUrl },
      207
    );
  }

  return json({ ok: true });
}
