# Frontend progress

React + TypeScript SPA (Vite). Part of the job-tracking-app monorepo (see [/backend/PROGRESS.md](../backend/PROGRESS.md) for the other half).

## Stack

- React + Vite + TypeScript
- React Router (routing), TanStack Query (server state / API calls), Tailwind CSS v4 (via `@tailwindcss/vite`, no postcss config needed)

## Done

- **Monorepo scaffold** — created via `npm create vite@latest frontend -- --template react-ts`, npm workspace member. Verified `npm run dev` serves on :5173.
- **Routing + auth** — `src/App.tsx` wires up `/login`, `/signup`, and a `ProtectedRoute`-gated `/` + `/applications/:id` under a shared `Layout` (nav bar with logged-in email + logout). `src/context/AuthContext.tsx` wraps `GET /auth/me` as a TanStack Query (`queryKey: ["me"]`, treats a 401 as "no user" rather than an error) — login/signup/logout mutations write straight into that query's cache via `setQueryData` instead of forcing a refetch. `src/lib/api.ts` is a thin fetch wrapper (`credentials: "include"`, throws `ApiError` with the backend's error message on non-2xx).
- **Home page** (`src/pages/HomePage.tsx`) — table of applications with a status filter, a "needs review only" checkbox, and sort by date/company/title/status (asc/desc toggle), all as query params against `GET /applications`. Empty state explains applications arrive via email sync. **No manual "add" form**, per the decision that applications only originate from the email pipeline.
- **Detail page** (`src/pages/DetailPage.tsx`) — full editable form (`PATCH`), a "needs review" banner with a one-click confirm (`needsReview: false`), delete with a confirm dialog, and a status history timeline.
- **Verified in a real browser** via a scripted Playwright session (chromium-cli wasn't available, so installed `playwright` temporarily with `--no-save` + `npx playwright install chromium`, drove it with a throwaway `.mjs` script, then removed both): signup → home empty state → logout → login → seeded rows show up → status filter → sort → open detail → confirm needs-review → edit status → delete. Caught and fixed two real bugs this way — see backend log entry below and commit `aa8abb1`.
- **Settings page** (`src/pages/SettingsPage.tsx`) — lists connected `EmailAccount`s (`GET /email-accounts`), a "Connect Gmail" link when there are none (a plain `<a href>` to `${API_URL}/auth/google`, deliberately not a fetch/mutation — it has to be a real top-level browser navigation so the user actually lands on Google's consent screen), disconnect button, and a dismissable status banner reading the `?gmail=connected|denied|error` query param the backend's OAuth callback redirects back with. Linked from the nav bar in `Layout.tsx`. **Verified for real** — the user connected their actual Gmail account through this page (first attempt was missing the `gmail.readonly` scope due to a Google Cloud Console config gap, not a frontend bug; fixed on the backend side, reconnect worked).
- **"Sync now"** — per-account button on the Settings page calling `POST /email-accounts/:id/sync`, showing a per-run summary (scanned/created/updated/skipped/failed, plus a "stopped early: quota exceeded" note when the backend's circuit breaker trips) and invalidating both the `email-accounts` and `applications` queries so new/updated rows show up on the home page immediately. Verified against the real backend pipeline — see backend `PROGRESS.md` for what the sync actually found in the connected inbox.

## Next up

1. A dedicated "needs review" view (surfacing `needsReview: true` entries) — right now they're only visible via the home page's "needs review only" filter, not a focused inbox-zero-style queue.
2. No local browser-testing setup is committed to the repo — if UI testing becomes routine, worth running `/run-skill-generator` to capture a real project skill (chromium-cli or a committed Playwright setup) instead of reinstalling ad hoc each time.
