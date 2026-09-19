import { json } from "../lib/respond.js";

// Returns only { "YYYY-MM-DD": [{start,end}, ...] } — booked slots are removed,
// and nothing about clients, payments, or booking identities is ever exposed here.
export async function handlePublicAvailability(request, env, url) {
  const month = url.searchParams.get("month"); // "YYYY-MM"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return json({ error: "month must be YYYY-MM" }, 400);
  }
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const rules = await env.DB.prepare(
    `SELECT day_of_week, start_time, end_time FROM availability_rules WHERE active = 1`
  ).all();

  const overrides = await env.DB.prepare(
    `SELECT date, type, start_time, end_time FROM availability_overrides WHERE date BETWEEN ? AND ?`
  )
    .bind(monthStart, monthEnd)
    .all();

  const bookings = await env.DB.prepare(
    `SELECT date, start_time, end_time FROM bookings WHERE date BETWEEN ? AND ? AND status != 'cancelled'`
  )
    .bind(monthStart, monthEnd)
    .all();

  const overridesByDate = {};
  for (const o of overrides.results) {
    (overridesByDate[o.date] ||= []).push(o);
  }
  const bookingsByDate = {};
  for (const b of bookings.results) {
    (bookingsByDate[b.date] ||= []).push(b);
  }

  const availability = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, "0")}`;
    const dow = new Date(year, mon - 1, d).getDay();
    const closedForDay = (overridesByDate[dateStr] || []).some((o) => o.type === "closed");
    if (closedForDay) {
      availability[dateStr] = [];
      continue;
    }
    let slots = rules.results
      .filter((r) => r.day_of_week === dow)
      .map((r) => ({ start: r.start_time, end: r.end_time }));

    for (const o of overridesByDate[dateStr] || []) {
      if (o.type === "open" && o.start_time && o.end_time) {
        slots.push({ start: o.start_time, end: o.end_time });
      }
    }

    // Remove time ranges that overlap an existing booking (simple exact/overlap filter).
    const booked = bookingsByDate[dateStr] || [];
    slots = slots.filter(
      (s) => !booked.some((b) => rangesOverlap(s.start, s.end, b.start_time, b.end_time))
    );

    if (slots.length) availability[dateStr] = slots;
  }

  return json({ month, availability });
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
