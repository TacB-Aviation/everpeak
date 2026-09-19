import { htmlDoc } from "../htmlShell.js";

export function acceptInvitePage({ token, valid, email, role }) {
  if (!valid) {
    return htmlDoc({
      title: "Invite Expired — EverPeak Internal",
      style: `.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
              .card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:32px;max-width:380px}`,
      body: `<div class="wrap"><div class="card"><h2>Invite link invalid or expired</h2>
             <p style="color:var(--muted)">Please ask an admin to send you a new invite.</p>
             <a href="/login">Back to login</a></div></div>`,
    });
  }

  return htmlDoc({
    title: "Activate your account — EverPeak Internal",
    style: `
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
      .card { background: var(--panel); border:1px solid var(--border); border-radius: var(--radius); padding:32px; width:100%; max-width:400px; }
      h1 { font-size:20px; margin:0 0 4px; }
      p.sub { color:var(--muted); font-size:13px; margin-top:0; margin-bottom:20px;}
      label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; margin-top:16px; }
      input { width:100%; padding:11px 12px; border-radius:8px; border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:14px; }
      button { width:100%; margin-top:24px; padding:12px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-weight:600; font-size:14px; }
      .hint { font-size:11px; color:var(--muted); margin-top:6px; }
      .err { background:rgba(239,91,91,.12); border:1px solid rgba(239,91,91,.4); color:#ff9b9b; font-size:13px; padding:10px 12px; border-radius:8px; margin-top:16px; }
      .role-badge { display:inline-block; background:var(--panel2); border:1px solid var(--border); padding:3px 10px; border-radius:999px; font-size:11px; color:var(--muted); }
    `,
    body: `
      <div class="wrap">
        <div class="card">
          <h1>Activate your account</h1>
          <p class="sub">${email} &middot; <span class="role-badge">${role === "manager" ? "Manager" : "Client Info Rep"}</span></p>
          <form id="f">
            <label for="password">Create a password</label>
            <input id="password" type="password" required minlength="12">
            <div class="hint">At least 12 characters, with upper/lowercase, a number, and a symbol.</div>
            <label for="confirm">Confirm password</label>
            <input id="confirm" type="password" required minlength="12">
            <div id="errBox"></div>
            <button type="submit">Activate account</button>
          </form>
        </div>
      </div>
    `,
    script: `
      document.getElementById('f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('errBox');
        errBox.innerHTML = '';
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm').value;
        if (password !== confirm) {
          errBox.innerHTML = '<div class="err">Passwords do not match.</div>';
          return;
        }
        const res = await fetch('/api/auth/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ${JSON.stringify(token)}, password })
        });
        const data = await res.json();
        if (!res.ok) {
          errBox.innerHTML = '<div class="err">' + (data.error || 'Something went wrong') + '</div>';
          return;
        }
        window.location.href = '/login';
      });
    `,
  });
}
