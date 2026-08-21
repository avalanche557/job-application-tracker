# Backend progress

Express + TypeScript API, Postgres via Prisma. Part of the job-tracking-app monorepo (see [/frontend/PROGRESS.md](../frontend/PROGRESS.md) for the other half).

## Stack

- Express + TypeScript, run via `tsx` in dev (`npm run dev`), compiled via `tsc` for prod (`npm run build` / `npm start`)
- Postgres 16 (local: Homebrew service `postgresql@16`)
- Prisma 7 as ORM
- Auth: JWT access + refresh tokens, bcrypt for password hashing — built in-house, not a library
- Email sync: synchronous HTTP endpoint for now (`POST /email-accounts/:id/sync`), not a background queue — see "Email extraction pipeline" below for why BullMQ was deferred
- LLM extraction: Gemini API (`@google/genai`), not Claude — user's call, keeps everything in one Google ecosystem alongside Gmail OAuth

## Done

- **Monorepo scaffold** — Express + TS app at `backend/`, `/health` endpoint, npm workspace member.
- **Local Postgres** — installed via `brew install postgresql@16`, running as a brew service. Dedicated role/db (not the default superuser): role `job_tracker_user`, database `job_tracker`, both created via `psql`. Role has `CREATEDB` granted (needed for Prisma's shadow database during `migrate dev`).
- **Prisma setup** — `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg` installed. Schema at `prisma/schema.prisma` with `User`, `JobApplication`, `StatusHistory` models and `ApplicationStatus`/`ApplicationSource` enums. First migration (`init`) applied.
- **Verified end-to-end**: Express → Prisma → Postgres works (`/health` runs `SELECT 1` through Prisma; a scratch script did create/read/delete on `User`).
- **Auth** — `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `GET /auth/me` in `src/routes/auth.routes.ts`. bcryptjs for hashing (12 rounds), `jsonwebtoken` for access (15m) + refresh (7d) tokens, both set as httpOnly cookies (`src/lib/cookies.ts`) — refresh cookie is scoped to `Path=/auth/refresh` so it's never sent on normal requests. Refresh tokens are stateless (verified by signature only, not stored/revocable server-side) — fine for now, would need a persisted token table to support revocation later. `requireAuth` middleware (`src/middleware/auth.ts`) reads the access-token cookie and sets `req.userId`. Request bodies validated with `zod`. CORS configured with `credentials: true` and origin locked to `FRONTEND_URL` (required for cookies to work cross-origin). Manually verified full flow with curl: signup → me → duplicate signup (409) → wrong password (401) → refresh (rotates cookies) → logout → me (401).
- **JobApplication CRUD** — decision: **no manual "add application" form in the frontend** — new applications are meant to only ever come from the email pipeline (Phase 3/4 worker), so there's no public `POST /applications` route. `src/services/jobApplication.service.ts` holds `createApplication` (for the future in-process worker to call directly — not exposed over HTTP), `listApplications`, `getApplication`, `updateApplication`, `deleteApplication`; `src/routes/applications.routes.ts` exposes `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, all behind `requireAuth` and scoped to `req.userId` (cross-user access returns 404, not 403, to avoid leaking existence). `PATCH` is how a "needs review" entry gets confirmed/corrected, and how status changes append a `StatusHistory` row (only when `status` actually changes). List supports `status`, `needsReview` filters and `sortBy`/`order`. Verified with curl: list/filter/sort, get-by-id with history, patch (status change + review confirm) creates a second history row, unauthenticated request 401s, nonexistent id 404s, delete removes + cascades `StatusHistory`.
- **Bugfix (found via frontend browser testing, commit `aa8abb1`)** — `updateApplication`'s Prisma `update()` call didn't `include: { statusHistory }`, so `PATCH` responses were missing that field. The frontend caches the PATCH response as the full detail object, so editing an application's status crashed the detail page (`statusHistory.map` on `undefined`). Fixed by adding the same `include` used in `getApplication`. Lesson: any endpoint whose response gets cached/rendered as a "detail" shape needs to actually return that full shape, not just the updated row.
- **Gmail OAuth connect flow** — `EmailAccount` model (`userId`, `provider`, `email`, `encryptedRefreshToken`, `scope`, `expiryDate`, `lastSyncedAt`; unique on `[userId, provider, email]`). Scope decision: OAuth consent screen stays in **Testing** mode with an allowlist of test users, not published to Production — see memory `gmail-oauth-scope` for why. `src/lib/crypto.ts` does AES-256-GCM encrypt/decrypt for the refresh token at rest, keyed by `ENCRYPTION_KEY`. `src/lib/googleOAuth.ts` wraps `googleapis`' `OAuth2` client (`generateGoogleAuthUrl`, `exchangeCodeForTokens` — the latter also fetches the connected email via `oauth2.userinfo.get()`). `GET /auth/google` (`requireAuth`) redirects to Google with `access_type=offline&prompt=consent` (forces a refresh token even on reconnect) and a signed `state` param carrying the user id (`signOAuthState`/`verifyOAuthState` in `src/lib/jwt.ts`, 5m expiry) — deliberately not relying on the session cookie surviving the third-party redirect. `GET /auth/google/callback` verifies `state`, exchanges the code, upserts the `EmailAccount`, redirects to `${FRONTEND_URL}/settings?gmail=connected|denied|error`. `GET`/`DELETE /email-accounts` list/disconnect, `requireAuth` + user-scoped like the applications routes. Verified for real: connected the user's actual Gmail account (first attempt only granted `userinfo.email`/`openid` because `gmail.readonly` wasn't added under Data Access in Google Cloud Console yet — fixed by adding the scope there and disconnect+reconnect, `prompt=consent` in the auth URL ensured a fresh consent screen).
- **Email extraction pipeline** — `RawEmail` model tracks processed Gmail message ids per account (dedup key `[emailAccountId, gmailMessageId]`) plus `extractionConfidence` and `matchedApplicationId`; doesn't persist full email bodies. `src/lib/gmailClient.ts`: narrow Gmail search query (job-shaped subjects or known ATS/job-board sender domains, last 90 days, capped 200/run — not a full-inbox scan) plus full-message fetch with MIME `text/plain` extraction (falls back to stripped `text/html`). `src/lib/gemini.ts`: structured-JSON classification via `@google/genai` + `responseSchema` (`isJobApplicationRelated`, `companyName`, `jobTitle`, `status`, `confidence`), wrapped with a 30s timeout and retry-with-backoff for transient 429/503. `src/services/emailSync.service.ts` orchestrates: skip already-seen messages, match to an existing `JobApplication` by company name (`findApplicationByCompany` in `jobApplication.service.ts`) or create a new `needsReview` one, route status changes through `updateApplication` with a new `historySource` param set to `"EMAIL"` (was hardcoded `"MANUAL"` before — real gap, since email-driven changes shouldn't be attributed to a manual edit). `POST /email-accounts/:id/sync` exposes it, still synchronous-in-request (no BullMQ yet — see Stack notes).
- **Verified against the real connected inbox**: correctly identified 6 real job applications with accurate company/title, and correctly read status from content (JYSK → `REJECTED`, micro1 → `INTERVIEWING`, not just defaulting everything to `APPLIED`); correctly skipped job-alert emails and a LinkedIn connection request as not application-related.
- **Gemini free tier is a real constraint** — capped at 20 requests/day/project/model; a normal sync exhausts it partway through. User chose to stay on free tier rather than enable billing (memory `gemini-free-tier`). Added `isQuotaExceededError` in `gemini.ts` so `emailSync.service.ts` stops the whole run immediately on a 429 (`stoppedEarly: "quota_exceeded"` in the response) instead of retrying every remaining candidate message pointlessly — verified this turns a stuck multi-minute run into a clean ~7s failure.

### Prisma 7 gotchas (differs from most tutorials/older docs)

- Connection URL does **not** go in `schema.prisma`'s `datasource` block anymore — it goes in `backend/prisma.config.ts` via `defineConfig({ datasource: { url: env("DATABASE_URL") } })`.
- `PrismaClient` **requires** an explicit driver adapter now — plain `new PrismaClient()` throws. We use `@prisma/adapter-pg`'s `PrismaPg`, see `src/lib/prisma.ts`.
- Generator output is pointed at `src/generated/prisma` (not the node_modules default) — that folder is gitignored and regenerated via `npx prisma generate` (also runs automatically on `migrate dev`).

## Local dev cheatsheet

```bash
brew services start postgresql@16          # start db (if not already running)
cd backend
npx prisma migrate dev --name <change>      # after editing schema.prisma
npx prisma studio                           # browse data in a GUI
npm run dev                                 # start API on :4000
```

`.env` (gitignored) holds `DATABASE_URL` for the local `job_tracker_user`/`job_tracker` db — see `.env.example` for the shape.

## Next up

1. BullMQ + Redis + cron, to replace the synchronous sync endpoint with a background job (needed once quota allows regular/automatic syncing, not just manual "Sync now" clicks).
2. If sync reliability matters before then, the fix is enabling billing on the Gemini API project (cheap for Flash-tier usage), not more client-side workarounds — see memory `gemini-free-tier`.
