import { htmlDoc } from "../htmlShell.js";

export function notFoundPage() {
  return htmlDoc({
    title: "404 Not Found",
    style: `
      .wrap { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
      h1 { font-size: 96px; margin:0; letter-spacing:2px; color:#2a2f3c; }
      p { color: var(--muted); margin-top:0; }
      .login-link { margin-top: 40px; font-size: 12px; color: #3a4051; text-decoration:none; }
      .login-link:hover { color: var(--muted); }
    `,
    body: `
      <div class="wrap">
        <h1>404</h1>
        <p>This page could not be found.</p>
        <a class="login-link" href="/login">Staff Login</a>
      </div>
    `,
  });
}
