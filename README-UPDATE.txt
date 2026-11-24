MATCHLENS LIVE DATA UPDATE

This package contains a complete replacement for the starter website plus Vercel API routes.

IMPORTANT:
- Keep the Vercel environment variable named APISPORTS_KEY.
- It must contain your API-Football / API-Sports key.
- Do not put the key in any file or commit it to GitHub.

UPLOAD:
1. Extract this ZIP.
2. In your GitHub matchlens repository, upload/replace index.html, styles.css and app.js.
3. Also upload the api folder with fixtures.js and standings.js inside it. The api folder must be at the repository root.
4. Commit the changes. Vercel should redeploy automatically.

TEST:
Open https://YOUR-DOMAIN/api/fixtures
Or a date: /api/fixtures?date=2026-11-24

The site loads fixtures for the selected date, with times in Africa/Lagos.
API-Football plan limits and competition coverage apply.
