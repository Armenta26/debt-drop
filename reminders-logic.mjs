// Decides which reminders to send today. Pure logic, no network.
const DAY = 86400000;
const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function todayIn(tz, now = new Date()) {
  let s;
  try { s = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const dueOn = (y, m, day) => { const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Date.UTC(y, m, Math.min(day, last)); };
const payDay = p => { const [y, m, d] = String(p.date || '').split('-').map(Number); return y ? Date.UTC(y, m - 1, d) : 0; };
const iso = t => new Date(t).toISOString().slice(0, 10);
const label = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function balance(d, payments) {
  let b = num(d.start);
  for (const p of payments) if (p.debtId === d.id) b += p.type === 'charge' ? num(p.amount) : -num(p.amount);
  return Math.max(0, Math.round(b * 100) / 100);
}

// Returns { messages: [{key,title,body}], sent: updated sent-map }
export function buildReminders(state, push, now = new Date()) {
  const debts = Array.isArray(state?.debts) ? state.debts : [];
  const payments = Array.isArray(state?.payments) ? state.payments : [];
  const today = todayIn(push?.tz, now);
  const t = new Date(today), Y = t.getUTCFullYear(), M = t.getUTCMonth();
  const remindDays = [1, 2, 3, 5, 7].includes(+push?.remindDays) ? +push.remindDays : 3;
  const dueDay = push?.dueDay !== false, missed = push?.missed !== false;
  const sent = { ...(push?.sent || {}) };
  const messages = [];

  const plan = state?.dmp && state.dmp.active ? state.dmp : null;
  const planCards = new Set(plan && plan.cards ? Object.keys(plan.cards) : []);

  // One combined reminder for a debt management plan
  if (plan) {
    const day = parseInt(plan.day, 10);
    const open = debts.filter(d => planCards.has(d.id) && balance(d, payments) > 0);
    if (day >= 1 && day <= 31 && open.length) {
      const name = String(plan.name || 'Debt plan').slice(0, 40);
      const amt = money(num(plan.payment));
      let next = dueOn(Y, M, day);
      if (next < today) { const n = new Date(next); next = dueOn(n.getUTCFullYear(), n.getUTCMonth() + 1, day); }
      const nd = new Date(next);
      const prev = dueOn(nd.getUTCFullYear(), nd.getUTCMonth() - 1, day);
      const prev2 = dueOn(nd.getUTCFullYear(), nd.getUTCMonth() - 2, day);
      const days = Math.round((next - today) / DAY);
      const marks = Array.isArray(plan.paidMarks) ? plan.paidMarks : [];
      const pays = payments.filter(p => String(p.group || '').startsWith('dmp')).map(payDay);
      const paidNext = marks.includes(iso(next)) || pays.some(x => x > prev && x <= next);
      const paidPrev = marks.includes(iso(prev)) || pays.some(x => x > prev2 && x <= prev);
      const startT = plan.start ? Date.parse(plan.start + 'T00:00:00Z') : num(plan.created);
      const add = (key, title, body) => { if (!sent[key]) { sent[key] = iso(today); messages.push({ key, title, body }); } };
      if (!paidNext && days > 0 && days <= remindDays) add(`dmp:${iso(next)}:soon`, `${name} payment due ${days === 1 ? 'tomorrow' : `in ${days} days`}`, `${amt} due ${label(next)} for ${open.length} card${open.length > 1 ? 's' : ''}. Tap to log it.`);
      if (!paidNext && days === 0 && dueDay) add(`dmp:${iso(next)}:today`, `${name} payment is due today`, `${amt}. If you've paid, log it so your balances stay right.`);
      const sincePrev = Math.round((today - prev) / DAY);
      if (missed && !paidPrev && sincePrev >= 1 && sincePrev <= 3 && startT && startT < prev) add(`dmp:${iso(prev)}:missed`, `Did you make your ${name} payment?`, `It was due ${label(prev)} and isn't logged. Missing a plan payment can put the plan at risk, so contact your counselor if you can't pay.`);
    }
  }

  for (const d of debts) {
    if (planCards.has(d.id) || d.closed) continue;
    const day = parseInt(d.due, 10);
    if (!day || day < 1 || day > 31) continue;
    const bal = balance(d, payments);
    if (bal <= 0) continue;
    let next = dueOn(Y, M, day);
    if (next < today) { const n = new Date(next); next = dueOn(n.getUTCFullYear(), n.getUTCMonth() + 1, day); }
    const nd = new Date(next);
    const prev = dueOn(nd.getUTCFullYear(), nd.getUTCMonth() - 1, day);
    const prev2 = dueOn(nd.getUTCFullYear(), nd.getUTCMonth() - 2, day);
    const days = Math.round((next - today) / DAY);
    const pays = payments.filter(p => p.debtId === d.id && p.type !== 'charge').map(payDay);
    const marks = Array.isArray(d.paidMarks) ? d.paidMarks : [];
    const paidNext = marks.includes(iso(next)) || pays.some(x => x > prev && x <= next);
    const paidPrev = marks.includes(iso(prev)) || pays.some(x => x > prev2 && x <= prev);
    const minDue = Math.min(num(d.min) || bal, bal);
    const name = String(d.name || 'A card').slice(0, 40);

    if (!paidNext && days > 0 && days <= remindDays) {
      const key = `${d.id}:${iso(next)}:soon`;
      if (!sent[key]) {
        sent[key] = iso(today);
        messages.push({ key, title: `${name} is due ${days === 1 ? 'tomorrow' : `in ${days} days`}`, body: `${money(minDue)} minimum due ${label(next)}. Balance ${money(bal)}. Tap to log your payment.` });
      }
    }
    if (!paidNext && days === 0 && dueDay) {
      const key = `${d.id}:${iso(next)}:today`;
      if (!sent[key]) {
        sent[key] = iso(today);
        messages.push({ key, title: `${name} is due today`, body: `${money(minDue)} minimum. If you've paid, log it so your balance stays right.` });
      }
    }
    const sincePrev = Math.round((today - prev) / DAY);
    if (missed && !paidPrev && sincePrev >= 1 && sincePrev <= 3 && num(d.created) && num(d.created) < prev) {
      const key = `${d.id}:${iso(prev)}:missed`;
      if (!sent[key]) {
        sent[key] = iso(today);
        messages.push({ key, title: `Did you pay ${name}?`, body: `It was due ${label(prev)} and no payment is logged. If it's paid, log it. If not, pay the ${money(minDue)} minimum today to limit late fees.` });
      }
    }
  }
  // Forget sent-markers older than 90 days
  for (const [k, v] of Object.entries(sent)) if (!v || today - Date.parse(v) > 90 * DAY) delete sent[k];
  return { messages, sent };
}
