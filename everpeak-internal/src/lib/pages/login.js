import { htmlDoc } from "../htmlShell.js";

export function loginPage({ error } = {}) {
  return htmlDoc({
    title: "Sign in — EverPeak Internal",
    style: `
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
      .card { background: var(--panel); border:1px solid var(--border); border-radius: var(--radius); padding:32px; width:100%; max-width:380px; }
      h1 { font-size:20px; margin:0 0 4px; }
      p.sub { color:var(--muted); font-size:13px; margin-top:0; margin-bottom:24px; }
      label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; margin-top:16px; }
      input { width:100%; padding:11px 12px; border-radius:8px; border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:14px; }
      input:focus { outline:2px solid var(--accent); border-color:transparent; }
      button { width:100%; margin-top:24px; padding:12px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-weight:600; font-size:14px; }
      button:hover { opacity:.92; }
      button:disabled { opacity:.5; cursor:not-allowed; }
      .err { background:rgba(239,91,91,.12); border:1px solid rgba(239,91,91,.4); color:#ff9b9b; font-size:13px; padding:10px 12px; border-radius:8px; margin-top:16px; }
      .brand { text-align:center; margin-bottom:24px; color:var(--muted); font-size:12px; letter-spacing:2px; text-transform:uppercase; }
    `,
    body: `
      <div class="wrap">
        <div class="card">
          <div class="brand">EverPeak Visuals</div>
          <h1>Internal System Login</h1>
          <p class="sub">Restricted access. Staff accounts only.</p>
          <form id="loginForm">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" required>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
            <div id="errBox"></div>
            <button type="submit" id="submitBtn">Sign in</button>
          </form>
        </div>
      </div>
    `,
    script: `
      const form = document.getElementById('loginForm');
      const errBox = document.getElementById('errBox');
      const btn = document.getElementById('submitBtn');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBox.innerHTML = '';
        btn.disabled = true; btn.textContent = 'Signing in...';
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: document.getElementById('email').value.trim(),
              password: document.getElementById('password').value
            })
          });
          const data = await res.json();
          if (!res.ok) {
            errBox.innerHTML = '<div class="err">' + (data.error || 'Login failed') + '</div>';
            btn.disabled = false; btn.textContent = 'Sign in';
            return;
          }
          window.location.href = '/admin';
        } catch (err) {
          errBox.innerHTML = '<div class="err">Network error. Please try again.</div>';
          btn.disabled = false; btn.textContent = 'Sign in';
        }
      });
    `,
  });
}
