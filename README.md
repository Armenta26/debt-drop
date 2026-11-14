# Debt Drop

Personal debt payoff tracker: installable on iPhone and Windows, syncs through Firebase, and sends due-date reminders through a daily GitHub Actions job.

- `index.html` — the app
- `config.js` — your Firebase settings (fill this in)
- `sw.js`, `manifest.webmanifest`, icons — make it installable and able to receive notifications
- `firestore.rules` — paste into Firebase so only you can read your data
- `.github/workflows/reminders.yml` + `scripts/` — the daily reminder job
