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
- **Settings page** (`src/pages/SettingsPage.tsx`) — lists connected `EmailAccount`s (`GET /email-accounts`), a "Connect Gmail" link when there are none (a plain `<a href>` to `${API_URL}/auth/google`, deliberately not a fetch/mutation — it has to be a real top-level browser navigation so the user actually lands on Google's consent screen), disconnect button, and a dismissable status banner reading the `?gmail=connected|denied|error` query param the backend's OAuth callback redirects back with. Linked from the nav bar in `Layout.tsx`. Not yet exercised against the real Google consent screen — that needs a human in a browser with a real Google account, which is the next thing to actually do.

## Next up

1. A human needs to click "Connect Gmail" in a real browser and complete Google's consent screen at least once, to confirm the redirect-back and connected-account display actually work end to end (backend side is curl-verified, but the OAuth screen itself can't be scripted).
2. A dedicated "needs review" view (surfacing `needsReview: true` entries) once the backend's email pipeline (Phase 4) lands.
3. No local browser-testing setup is committed to the repo — if UI testing becomes routine, worth running `/run-skill-generator` to capture a real project skill (chromium-cli or a committed Playwright setup) instead of reinstalling ad hoc each time.
