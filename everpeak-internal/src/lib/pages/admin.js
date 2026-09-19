import { htmlDoc } from "../htmlShell.js";

export function adminPage({ email, role }) {
  const isManager = role === "manager";

  return htmlDoc({
    title: "Dashboard — EverPeak Internal",
    style: `
      body { display:flex; }
      .sidebar { width:220px; min-height:100vh; background:var(--panel); border-right:1px solid var(--border); padding:20px 14px; position:sticky; top:0; height:100vh; }
      .brand { font-size:13px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:24px; padding:0 8px; }
      .navbtn { display:block; width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:10px 12px; border-radius:8px; font-size:14px; margin-bottom:4px; }
      .navbtn:hover { background:var(--panel2); }
      .navbtn.active { background:var(--accent); color:#fff; }
      .who { font-size:12px; color:var(--muted); padding:0 8px; margin-top:24px; border-top:1px solid var(--border); padding-top:16px; }
      .role-pill { display:inline-block; margin-top:6px; background:var(--panel2); border:1px solid var(--border); padding:2px 8px; border-radius:999px; font-size:11px; }
      .logout { margin-top:14px; background:transparent; border:1px solid var(--border); color:var(--muted); padding:8px 10px; border-radius:8px; font-size:12px; width:100%; }
      .logout:hover { color:#fff; border-color:var(--danger); }
      .main { flex:1; padding:32px 40px; max-width:1200px; }
      h2 { margin-top:0; }
      .toolbar { display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap; align-items:center; }
      table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
      th, td { text-align:left; padding:10px 12px; font-size:13px; border-bottom:1px solid var(--border); }
      th { color:var(--muted); font-weight:600; background:var(--panel2); }
      tr:last-child td { border-bottom:none; }
      .btn { background:var(--accent); color:#fff; border:none; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; }
      .btn.secondary { background:var(--panel2); border:1px solid var(--border); color:var(--text); }
      .btn.danger { background:var(--danger); }
      .btn:disabled { opacity:.5; cursor:not-allowed; }
      input, select, textarea { padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:13px; }
      .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:none; align-items:center; justify-content:center; z-index:50; }
      .modal-bg.open { display:flex; }
      .modal { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:24px; width:100%; max-width:420px; max-height:90vh; overflow:auto; }
      .modal h3 { margin-top:0; }
      .field { margin-bottom:12px; }
      .field label { display:block; font-size:12px; color:var(--muted); margin-bottom:5px; }
      .field input, .field select, .field textarea { width:100%; }
      .row-actions button { margin-right:6px; }
      .badge { padding:2px 8px; border-radius:999px; font-size:11px; }
      .badge.confirmed, .badge.paid { background:rgba(51,196,129,.15); color:var(--success); }
      .badge.pending { background:rgba(255,193,7,.15); color:#ffc107; }
      .badge.cancelled, .badge.refunded { background:rgba(239,91,91,.15); color:var(--danger); }
      .note-item { border-bottom:1px solid var(--border); padding:8px 0; font-size:13px; }
      .note-meta { color:var(--muted); font-size:11px; }
      .readonly-note { font-size:12px; color:var(--muted); margin-bottom:14px; background:var(--panel2); border:1px solid var(--border); padding:8px 12px; border-radius:8px; }
      .calendar { display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; }
      .cal-cell { background:var(--panel); border:1px solid var(--border); border-radius:8px; min-height:80px; padding:6px; font-size:11px; }
      .cal-head { text-align:center; color:var(--muted); font-size:11px; padding-bottom:4px; }
      .cal-daynum { color:var(--muted); font-size:11px; margin-bottom:4px; }
      .slot { background:var(--accent); color:#fff; border-radius:4px; padding:2px 4px; margin-bottom:2px; font-size:10px; }
      .hidden { display:none !important; }
    `,
    body: `
      <div class="sidebar">
        <div class="brand">EverPeak Internal</div>
        <button class="navbtn active" data-tab="bookings">Bookings</button>
        <button class="navbtn" data-tab="clients">Clients</button>
        <button class="navbtn" data-tab="payments">Payments</button>
        <button class="navbtn" data-tab="availability">Availability</button>
        <button class="navbtn" data-tab="notes">Notes</button>
        ${isManager ? `<button class="navbtn" data-tab="users">Team / Invites</button>` : ""}
        <div class="who">
          Signed in as<br><strong>${email}</strong>
          <div class="role-pill">${isManager ? "Manager" : "Client Info Rep"}</div>
          <button class="logout" id="logoutBtn">Log out</button>
        </div>
      </div>
      <div class="main">
        ${!isManager ? `<div class="readonly-note">Your role is read-only. You can view all records and leave notes for managers, but cannot add, edit, or delete anything.</div>` : ""}
        <div id="view"></div>
      </div>
      <div class="modal-bg" id="modalBg"><div class="modal" id="modalBody"></div></div>
    `,
    script: adminScript(isManager),
  });
}

function adminScript(isManager) {
  return `
  const IS_MANAGER = ${isManager};
  const view = document.getElementById('view');
  const modalBg = document.getElementById('modalBg');
  const modalBody = document.getElementById('modalBody');

  function closeModal() { modalBg.classList.remove('open'); modalBody.innerHTML=''; }
  function openModal(html) { modalBody.innerHTML = html; modalBg.classList.add('open'); }
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) closeModal(); });

  async function api(path, opts = {}) {
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (opts.method && opts.method !== 'GET') {
      opts.headers['X-CSRF-Token'] = getCookie('eps_csrf');
    }
    const res = await fetch(path, opts);
    if (res.status === 401 || res.status === 404) {
      if (path.startsWith('/api/')) { /* fallthrough - handled by caller */ }
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : '';
  }
  function esc(s) { return (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  document.querySelectorAll('.navbtn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.tab);
    });
  });

  // ---------- BOOKINGS ----------
  async function renderBookings() {
    const bookings = await api('/api/bookings');
    view.innerHTML = \`
      <h2>Bookings</h2>
      <div class="toolbar">
        \${IS_MANAGER ? '<button class="btn" id="newBooking">+ New Booking</button>' : ''}
      </div>
      <table><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Client</th><th>Status</th>\${IS_MANAGER?'<th></th>':''}</tr></thead>
      <tbody>\${bookings.map(b => \`
        <tr>
          <td>\${esc(b.date)}</td>
          <td>\${esc(b.start_time)}–\${esc(b.end_time)}</td>
          <td>\${esc(b.session_type)}</td>
          <td>\${esc(b.client_name || '—')}</td>
          <td><span class="badge \${b.status}">\${esc(b.status)}</span></td>
          \${IS_MANAGER ? \`<td class="row-actions">
            <button class="btn secondary" onclick="editBooking('\${b.id}')">Edit</button>
            <button class="btn danger" onclick="deleteBooking('\${b.id}')">Delete</button>
          </td>\` : ''}
        </tr>\`).join('')}
      </tbody></table>
    \`;
    window.__bookings = bookings;
    if (IS_MANAGER) document.getElementById('newBooking').addEventListener('click', () => bookingForm());
  }

  window.editBooking = async (id) => {
    const b = window.__bookings.find(x => x.id === id);
    bookingForm(b);
  };
  window.deleteBooking = async (id) => {
    if (!confirm('Delete this booking?')) return;
    await api('/api/bookings/' + id, { method: 'DELETE' });
    renderBookings();
  };

  async function bookingForm(existing) {
    const clients = await api('/api/clients');
    openModal(\`
      <h3>\${existing ? 'Edit' : 'New'} Booking</h3>
      <form id="bForm">
        <div class="field"><label>Date</label><input type="date" name="date" value="\${existing?.date||''}" required></div>
        <div class="field"><label>Start time</label><input type="time" name="start_time" value="\${existing?.start_time||''}" required></div>
        <div class="field"><label>End time</label><input type="time" name="end_time" value="\${existing?.end_time||''}" required></div>
        <div class="field"><label>Session type</label><input type="text" name="session_type" value="\${esc(existing?.session_type||'')}" required></div>
        <div class="field"><label>Client</label>
          <select name="client_id">
            <option value="">— none —</option>
            \${clients.map(c => \`<option value="\${c.id}" \${existing?.client_id===c.id?'selected':''}>\${esc(c.name)}</option>\`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select name="status">
            \${['confirmed','pending','cancelled'].map(s => \`<option value="\${s}" \${existing?.status===s?'selected':''}>\${s}</option>\`).join('')}
          </select>
        </div>
        <div class="toolbar">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('bForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (existing) await api('/api/bookings/' + existing.id, { method: 'PUT', body: JSON.stringify(fd) });
        else await api('/api/bookings', { method: 'POST', body: JSON.stringify(fd) });
        closeModal(); renderBookings();
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- CLIENTS ----------
  async function renderClients() {
    const clients = await api('/api/clients');
    view.innerHTML = \`
      <h2>Clients</h2>
      <div class="toolbar">\${IS_MANAGER ? '<button class="btn" id="newClient">+ New Client</button>' : ''}</div>
      <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th>\${IS_MANAGER?'<th></th>':''}</tr></thead>
      <tbody>\${clients.map(c => \`
        <tr>
          <td>\${esc(c.name)}</td><td>\${esc(c.email||'—')}</td><td>\${esc(c.phone||'—')}</td>
          \${IS_MANAGER ? \`<td class="row-actions">
            <button class="btn secondary" onclick="editClient('\${c.id}')">Edit</button>
            <button class="btn danger" onclick="deleteClient('\${c.id}')">Delete</button>
          </td>\` : ''}
        </tr>\`).join('')}
      </tbody></table>
    \`;
    window.__clients = clients;
    if (IS_MANAGER) document.getElementById('newClient').addEventListener('click', () => clientForm());
  }
  window.editClient = (id) => clientForm(window.__clients.find(c => c.id === id));
  window.deleteClient = async (id) => {
    if (!confirm('Delete this client?')) return;
    await api('/api/clients/' + id, { method: 'DELETE' });
    renderClients();
  };
  function clientForm(existing) {
    openModal(\`
      <h3>\${existing ? 'Edit' : 'New'} Client</h3>
      <form id="cForm">
        <div class="field"><label>Name</label><input name="name" value="\${esc(existing?.name||'')}" required></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="\${esc(existing?.email||'')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="\${esc(existing?.phone||'')}"></div>
        <div class="field"><label>Address</label><textarea name="address">\${esc(existing?.address||'')}</textarea></div>
        <div class="toolbar">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('cForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (existing) await api('/api/clients/' + existing.id, { method: 'PUT', body: JSON.stringify(fd) });
        else await api('/api/clients', { method: 'POST', body: JSON.stringify(fd) });
        closeModal(); renderClients();
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- PAYMENTS ----------
  async function renderPayments() {
    const payments = await api('/api/payments');
    view.innerHTML = \`
      <h2>Payments</h2>
      <div class="toolbar">\${IS_MANAGER ? '<button class="btn" id="newPayment">+ New Payment</button>' : ''}</div>
      <table><thead><tr><th>Client</th><th>Amount</th><th>Method</th><th>Status</th><th>Paid At</th>\${IS_MANAGER?'<th></th>':''}</tr></thead>
      <tbody>\${payments.map(p => \`
        <tr>
          <td>\${esc(p.client_name||'—')}</td>
          <td>$\${Number(p.amount).toFixed(2)}</td>
          <td>\${esc(p.method||'—')}</td>
          <td><span class="badge \${p.status}">\${esc(p.status)}</span></td>
          <td>\${esc(p.paid_at||'—')}</td>
          \${IS_MANAGER ? \`<td class="row-actions">
            <button class="btn secondary" onclick="editPayment('\${p.id}')">Edit</button>
            <button class="btn danger" onclick="deletePayment('\${p.id}')">Delete</button>
          </td>\` : ''}
        </tr>\`).join('')}
      </tbody></table>
    \`;
    window.__payments = payments;
    if (IS_MANAGER) document.getElementById('newPayment').addEventListener('click', () => paymentForm());
  }
  window.editPayment = (id) => paymentForm(window.__payments.find(p => p.id === id));
  window.deletePayment = async (id) => {
    if (!confirm('Delete this payment?')) return;
    await api('/api/payments/' + id, { method: 'DELETE' });
    renderPayments();
  };
  async function paymentForm(existing) {
    const clients = await api('/api/clients');
    openModal(\`
      <h3>\${existing ? 'Edit' : 'New'} Payment</h3>
      <form id="pForm">
        <div class="field"><label>Client</label>
          <select name="client_id">
            <option value="">— none —</option>
            \${clients.map(c => \`<option value="\${c.id}" \${existing?.client_id===c.id?'selected':''}>\${esc(c.name)}</option>\`).join('')}
          </select>
        </div>
        <div class="field"><label>Amount</label><input type="number" step="0.01" name="amount" value="\${existing?.amount||''}" required></div>
        <div class="field"><label>Method</label><input name="method" value="\${esc(existing?.method||'')}" placeholder="card, cash, zelle..."></div>
        <div class="field"><label>Status</label>
          <select name="status">\${['paid','pending','refunded'].map(s=>\`<option value="\${s}" \${existing?.status===s?'selected':''}>\${s}</option>\`).join('')}</select>
        </div>
        <div class="field"><label>Paid at</label><input type="date" name="paid_at" value="\${existing?.paid_at||''}"></div>
        <div class="toolbar">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('pForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (existing) await api('/api/payments/' + existing.id, { method: 'PUT', body: JSON.stringify(fd) });
        else await api('/api/payments', { method: 'POST', body: JSON.stringify(fd) });
        closeModal(); renderPayments();
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- AVAILABILITY ----------
  async function renderAvailability() {
    const rules = await api('/api/availability/rules');
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    view.innerHTML = \`
      <h2>Availability</h2>
      <p style="color:var(--muted);font-size:13px;">Weekly recurring hours shown on the public booking page at /booking.</p>
      <div class="toolbar">\${IS_MANAGER ? '<button class="btn" id="newRule">+ Add Time Block</button>' : ''}</div>
      <table><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Active</th>\${IS_MANAGER?'<th></th>':''}</tr></thead>
      <tbody>\${rules.map(r => \`
        <tr>
          <td>\${days[r.day_of_week]}</td><td>\${esc(r.start_time)}</td><td>\${esc(r.end_time)}</td>
          <td>\${r.active ? 'Yes' : 'No'}</td>
          \${IS_MANAGER ? \`<td class="row-actions"><button class="btn danger" onclick="deleteRule('\${r.id}')">Delete</button></td>\` : ''}
        </tr>\`).join('')}
      </tbody></table>
    \`;
    if (IS_MANAGER) document.getElementById('newRule').addEventListener('click', ruleForm);
  }
  window.deleteRule = async (id) => {
    if (!confirm('Remove this time block?')) return;
    await api('/api/availability/rules/' + id, { method: 'DELETE' });
    renderAvailability();
  };
  function ruleForm() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    openModal(\`
      <h3>Add Weekly Time Block</h3>
      <form id="rForm">
        <div class="field"><label>Day</label>
          <select name="day_of_week">\${days.map((d,i)=>\`<option value="\${i}">\${d}</option>\`).join('')}</select>
        </div>
        <div class="field"><label>Start time</label><input type="time" name="start_time" required></div>
        <div class="field"><label>End time</label><input type="time" name="end_time" required></div>
        <div class="toolbar">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('rForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/api/availability/rules', { method: 'POST', body: JSON.stringify(fd) });
        closeModal(); renderAvailability();
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- NOTES ----------
  async function renderNotes() {
    const notes = await api('/api/notes');
    view.innerHTML = \`
      <h2>Notes</h2>
      <div class="toolbar"><button class="btn" id="newNote">+ Add Note</button></div>
      <div id="notesList">\${notes.map(n => \`
        <div class="note-item">
          <div>\${esc(n.content)} \${n.resolved ? '<span class="badge confirmed">resolved</span>' : ''}</div>
          <div class="note-meta">\${esc(n.entity_type)}\${n.entity_id ? ' · ' + esc(n.entity_id) : ''} — \${esc(n.author_email||'unknown')} · \${esc(n.created_at)}
            \${IS_MANAGER && !n.resolved ? \` · <a href="#" onclick="resolveNote(event,'\${n.id}')">mark resolved</a>\` : ''}
          </div>
        </div>\`).join('') || '<p style="color:var(--muted)">No notes yet.</p>'}
      </div>
    \`;
    document.getElementById('newNote').addEventListener('click', noteForm);
  }
  window.resolveNote = async (e, id) => {
    e.preventDefault();
    await api('/api/notes/' + id, { method: 'PUT', body: JSON.stringify({ resolved: 1 }) });
    renderNotes();
  };
  function noteForm() {
    openModal(\`
      <h3>Add Note</h3>
      <form id="nForm">
        <div class="field"><label>Relates to (optional)</label>
          <select name="entity_type">
            <option value="general">General</option>
            <option value="booking">Booking</option>
            <option value="client">Client</option>
            <option value="payment">Payment</option>
          </select>
        </div>
        <div class="field"><label>Entity ID (optional)</label><input name="entity_id" placeholder="paste booking/client/payment id"></div>
        <div class="field"><label>Note for the manager</label><textarea name="content" required rows="4"></textarea></div>
        <div class="toolbar">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('nForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/api/notes', { method: 'POST', body: JSON.stringify(fd) });
        closeModal(); renderNotes();
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- USERS / INVITES (manager only) ----------
  async function renderUsers() {
    const users = await api('/api/users');
    view.innerHTML = \`
      <h2>Team & Invites</h2>
      <div class="toolbar"><button class="btn" id="newInvite">+ Invite Teammate</button></div>
      <table><thead><tr><th>Email</th><th>Role</th><th>Active</th><th>Last Login</th><th></th></tr></thead>
      <tbody>\${users.map(u => \`
        <tr>
          <td>\${esc(u.email)}</td>
          <td>\${u.role === 'manager' ? 'Manager' : 'Client Info Rep'}</td>
          <td>\${u.active ? 'Yes' : 'Disabled'}</td>
          <td>\${esc(u.last_login_at||'never')}</td>
          <td class="row-actions">
            <button class="btn secondary" onclick="toggleUser('\${u.id}', \${u.active ? 0 : 1})">\${u.active ? 'Disable' : 'Enable'}</button>
          </td>
        </tr>\`).join('')}
      </tbody></table>
    \`;
    document.getElementById('newInvite').addEventListener('click', inviteForm);
  }
  window.toggleUser = async (id, active) => {
    await api('/api/users/' + id, { method: 'PUT', body: JSON.stringify({ active }) });
    renderUsers();
  };
  function inviteForm() {
    openModal(\`
      <h3>Invite Teammate</h3>
      <form id="iForm">
        <div class="field"><label>Email</label><input type="email" name="email" required></div>
        <div class="field"><label>Role</label>
          <select name="role">
            <option value="rep">Client Information Representative (read-only)</option>
            <option value="manager">Manager (full access)</option>
          </select>
        </div>
        <div class="toolbar">
          <button class="btn" type="submit">Send Invite Email</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button>
        </div>
      </form>
    \`);
    document.getElementById('iForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/api/invites', { method: 'POST', body: JSON.stringify(fd) });
        closeModal();
        alert('Invite sent to ' + fd.email);
        renderUsers();
      } catch (err) { alert(err.message); }
    });
  }

  function render(tab) {
    if (tab === 'bookings') return renderBookings();
    if (tab === 'clients') return renderClients();
    if (tab === 'payments') return renderPayments();
    if (tab === 'availability') return renderAvailability();
    if (tab === 'notes') return renderNotes();
    if (tab === 'users') return renderUsers();
  }
  render('bookings');
  `;
}
