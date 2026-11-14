// Runs once a day on GitHub Actions. Sends Debt Drop payment reminders.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { buildReminders } from './reminders-logic.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('Missing FIREBASE_SERVICE_ACCOUNT secret. See the setup guide, step 6.'); process.exit(1); }
let account;
try { account = JSON.parse(raw); } catch { console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole downloaded key file.'); process.exit(1); }

initializeApp({ credential: cert(account) });
const db = getFirestore();
const messaging = getMessaging();
const TEST = String(process.env.TEST) === 'true';
const APP_URL = (process.env.APP_URL || '').replace(/\/?$/, '/');
const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

const users = await db.collection('users').get();
let sentCount = 0;

for (const doc of users.docs) {
  const data = doc.data() || {};
  const push = data.push || {};
  const tokens = Array.isArray(push.tokens) ? push.tokens.filter(Boolean) : [];
  if (!tokens.length || push.enabled === false) continue;

  let messages, sent = null;
  if (TEST) messages = [{ title: 'Debt Drop notifications work', body: "You'll get a reminder here before each payment is due." }];
  else ({ messages, sent } = buildReminders(data.state || {}, push));

  const dead = new Set();
  for (const m of messages) {
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: m.title, body: m.body },
      webpush: { notification: { icon: APP_URL + 'icon-192.png' }, fcmOptions: APP_URL ? { link: APP_URL } : undefined },
    });
    sentCount += res.successCount;
    res.responses.forEach((r, i) => { if (!r.success) { console.log('Send failed:', r.error?.code); if (DEAD.has(r.error?.code)) dead.add(tokens[i]); } });
  }

  const update = {};
  if (sent) update['push.sent'] = sent;
  if (dead.size) update['push.tokens'] = FieldValue.arrayRemove(...dead);
  if (Object.keys(update).length) await doc.ref.update(update);
}

console.log(`Done. ${sentCount} notification(s) delivered.`);
