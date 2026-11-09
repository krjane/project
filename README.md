# 🧽 The Grime League

A monthly deep-clean league for two, built as an iPhone web app (no App Store needed).

**Live app:** https://krjane.github.io/project/

- **Round tab:** this month's tasks, auto-split fairly. Swipe right to finish, swipe left to hand a task over. Includes a team goal, monthly stakes and wildcard, a secret double-points mystery task, and bounty hour (steal unfinished tasks for bonus points after the 20th).
- **Board:** season standings (12 rounds), ranks, badges, round history.
- **Tasks:** add/edit recurring tasks, one-off jobs and rooms.
- **Settings:** players, avatars & colors, rules and bonuses, stakes/rewards lists, invite link.

Data syncs live between phones through Firebase Firestore. Each household is one document whose long random key lives only in the invite link.

## Install on iPhone
Open your invite link in **Safari** → Share → **Add to Home Screen**.

## Files
Plain HTML/CSS/JS, no build step. `firebase-config.js` holds the (public) Firebase web config; access is enforced by Firestore security rules. App icons are rendered from `icon.svg` by the deploy workflow in `.github/workflows/deploy.yml`.
