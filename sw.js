// Debt Drop service worker: receives push notifications.
importScripts('./config.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Open the app when a notification is tapped (Firebase handles its own pushes).
self.addEventListener('notificationclick', e => {
  if (e.notification.data && e.notification.data.FCM_MSG) return;
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    for (const w of wins) { if ('focus' in w) return w.focus(); }
    return self.clients.openWindow('./');
  }));
});

const C = self.DEBT_DROP_CONFIG;
if (C && C.firebase && C.firebase.apiKey && !String(C.firebase.apiKey).startsWith('PASTE')) {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'
  );
  firebase.initializeApp(C.firebase);
  firebase.messaging();
}
