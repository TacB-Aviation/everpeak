import { getSession } from "./lib/auth.js";
import { securityHeaders } from "./lib/htmlShell.js";
import { notFoundPage } from "./lib/pages/notFound.js";
import { loginPage } from "./lib/pages/login.js";
import { acceptInvitePage } from "./lib/pages/acceptInvite.js";
import { adminPage } from "./lib/pages/admin.js";
import { publicBookingPage } from "./lib/pages/publicBooking.js";
import { handleLogin, handleLogout, handleAcceptInvite } from "./routes/authRoutes.js";
import { handleApi } from "./routes/apiRoutes.js";
import { handlePublicAvailability } from "./routes/publicRoutes.js";
import { sha256Hex } from "./lib/crypto.js";
import { json } from "./lib/respond.js";

function html(body, status = 200) {
  return new Response(body, { status, headers: securityHeaders() });
}
function notFound() {
  return html(notFoundPage(), 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      // ---------- Fully public routes (no auth needed) ----------
      if (path === "/booking" || path === "/booking/") {
        return html(publicBookingPage());
      }
      if (path === "/api/public/availability" && request.method === "GET") {
        return handlePublicAvailability(request, env, url);
      }
      if (path === "/login" && request.method === "GET") {
        const existing = await getSession(env, request);
        if (existing) return Response.redirect(url.origin + "/admin", 302);
        return html(loginPage());
      }
      if (path === "/api/auth/login" && request.method === "POST") {
        return handleLogin(request, env);
      }
      if (path === "/api/auth/logout" && request.method === "POST") {
        return handleLogout(request, env);
      }
      if (path === "/accept-invite" && request.method === "GET") {
        const token = url.searchParams.get("token") || "";
        if (!token) return notFound();
        const tokenHash = await sha256Hex(token);
        const invite = await env.DB.prepare(
          `SELECT email, role, expires_at, used FROM invites WHERE token_hash = ?`
        )
          .bind(tokenHash)
          .first();
        const valid = invite && !invite.used && new Date(invite.expires_at) > new Date();
        return html(
          acceptInvitePage({
            token,
            valid: !!valid,
            email: invite?.email,
            role: invite?.role,
          })
        );
      }
      if (path === "/api/auth/accept-invite" && request.method === "POST") {
        return handleAcceptInvite(request, env);
      }

      // ---------- Everything else requires a valid session ----------
      const session = await getSession(env, request);

      if (path === "/admin" || path === "/admin/") {
        if (!session) return notFound();
        return html(adminPage({ email: session.email, role: session.role }));
      }

      if (path.startsWith("/api/")) {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const result = await handleApi(request, env, session, url);
        if (result) return result;
        return json({ error: "Not found" }, 404);
      }

      // Root and anything unrecognized: show a real 404, revealing nothing.
      if (path === "/") {
        if (session) return Response.redirect(url.origin + "/admin", 302);
        return notFound();
      }

      return notFound();
    } catch (err) {
      // Never leak stack traces or internals.
      console.error(err);
      return json({ error: "Internal server error." }, 500);
    }
  },
};
