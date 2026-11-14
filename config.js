// ===== Debt Drop settings =====
// Step 1: Replace everything between the { } after "firebase:" with the
//         firebaseConfig values from your Firebase project (see setup guide).
// Step 2: Replace PASTE_VAPID_KEY with your Web Push certificate key pair.
// Keep the quotes and commas exactly as they are.

self.DEBT_DROP_CONFIG = {
  firebase: {
    apiKey: "PASTE_API_KEY",
    authDomain: "PASTE_AUTH_DOMAIN",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_STORAGE_BUCKET",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID"
  },
  vapidKey: "PASTE_VAPID_KEY"
};
