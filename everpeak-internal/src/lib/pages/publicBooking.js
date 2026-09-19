import { htmlDoc } from "../htmlShell.js";

export function publicBookingPage() {
  return htmlDoc({
    title: "Book a Session — EverPeak Visuals",
    style: `
      header { display:flex; justify-content:space-between; align-items:center; padding:20px 32px; border-bottom:1px solid var(--border); }
      .brand { font-weight:700; letter-spacing:.5px; }
      .login-pill { border:1px solid var(--border); background:var(--panel); color:var(--text); padding:8px 16px; border-radius:999px; font-size:13px; text-decoration:none; }
      .login-pill:hover { border-color: var(--accent); }
      .wrap { max-width:900px; margin: 0 auto; padding: 32px; }
      .month-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
      .month-nav button { background:var(--panel); border:1px solid var(--border); color:var(--text); padding:8px 14px; border-radius:8px; }
      .calendar { display:grid; grid-template-columns: repeat(7, 1fr); gap:8px; }
      .cal-head { text-align:center; color:var(--muted); font-size:12px; padding-bottom:6px; }
      .cal-cell { background:var(--panel); border:1px solid var(--border); border-radius:10px; min-height:88px; padding:8px; font-size:12px; position:relative; }
      .cal-cell.empty { background:transparent; border:none; }
      .cal-cell.today { border-color: var(--accent); }
      .cal-daynum { color:var(--muted); font-size:11px; margin-bottom:6px; }
      .slot-pill { display:inline-block; background: rgba(91,141,239,.15); color: var(--accent); border:1px solid rgba(91,141,239,.3); border-radius:6px; padding:2px 6px; font-size:10px; margin:1px 0; }
      .no-slots { color:#454b5c; font-size:10px; }
      .legend { margin-top:20px; color:var(--muted); font-size:12px; }
      .loading { color: var(--muted); padding: 40px; text-align:center; }
    `,
    body: `
      <header>
        <div class="brand">EverPeak Visuals</div>
        <a class="login-pill" href="/login">Admin Login</a>
      </header>
      <div class="wrap">
        <h1 style="margin-bottom:4px;">Availability</h1>
        <p style="color:var(--muted); margin-top:0;">Open days and times for booking. Contact us to reserve a slot.</p>
        <div class="month-nav">
          <button id="prevBtn">&larr; Prev</button>
          <div id="monthLabel" style="font-weight:600;"></div>
          <button id="nextBtn">Next &rarr;</button>
        </div>
        <div id="cal" class="loading">Loading availability…</div>
        <div class="legend">Times shown are local business hours and subject to change.</div>
      </div>
    `,
    script: `
      let cursor = new Date();
      cursor.setDate(1);

      function fmtMonth(d) { return d.toLocaleString('default', { month: 'long', year: 'numeric' }); }
      function pad(n) { return n.toString().padStart(2,'0'); }

      async function load() {
        const cal = document.getElementById('cal');
        cal.className = 'loading';
        cal.textContent = 'Loading availability…';
        document.getElementById('monthLabel').textContent = fmtMonth(cursor);
        const monthStr = cursor.getFullYear() + '-' + pad(cursor.getMonth()+1);
        try {
          const res = await fetch('/api/public/availability?month=' + monthStr);
          const data = await res.json();
          render(data);
        } catch (e) {
          cal.textContent = 'Could not load availability. Please try again later.';
        }
      }

      function render(data) {
        const cal = document.getElementById('cal');
        cal.className = 'calendar';
        cal.innerHTML = '';
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
          const h = document.createElement('div');
          h.className = 'cal-head'; h.textContent = d;
          cal.appendChild(h);
        });
        const year = cursor.getFullYear(), month = cursor.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const todayStr = new Date().toISOString().slice(0,10);

        for (let i=0;i<firstDay;i++) {
          const c = document.createElement('div'); c.className='cal-cell empty'; cal.appendChild(c);
        }
        for (let day=1; day<=daysInMonth; day++) {
          const dateStr = year + '-' + pad(month+1) + '-' + pad(day);
          const c = document.createElement('div');
          c.className = 'cal-cell' + (dateStr === todayStr ? ' today' : '');
          const slots = data.availability[dateStr] || [];
          c.innerHTML = '<div class="cal-daynum">' + day + '</div>' +
            (slots.length
              ? slots.map(s => '<div class="slot-pill">' + s.start + '–' + s.end + '</div>').join('')
              : '<div class="no-slots">—</div>');
          cal.appendChild(c);
        }
      }

      document.getElementById('prevBtn').addEventListener('click', () => { cursor.setMonth(cursor.getMonth()-1); load(); });
      document.getElementById('nextBtn').addEventListener('click', () => { cursor.setMonth(cursor.getMonth()+1); load(); });
      load();
    `,
  });
}
