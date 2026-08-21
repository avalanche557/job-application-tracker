# Backend progress

Express + TypeScript API, Postgres via Prisma. Part of the job-tracking-app monorepo (see [/frontend/PROGRESS.md](../frontend/PROGRESS.md) for the other half).

## Stack

- Express + TypeScript, run via `tsx` in dev (`npm run dev`), compiled via `tsc` for prod (`npm run build` / `npm start`)
- Postgres 16 (local: Homebrew service `postgresql@16`)
- Prisma 7 as ORM
- Auth (planned): JWT access + refresh tokens, bcrypt for password hashing — built in-house, not a library
- Background jobs (planned): BullMQ + Redis, for Gmail sync and LLM extraction

## Done

- **Monorepo scaffold** — Express + TS app at `backend/`, `/health` endpoint, npm workspace member.
- **Local Postgres** — installed via `brew install postgresql@16`, running as a brew service. Dedicated role/db (not the default superuser): role `job_tracker_user`, database `job_tracker`, both created via `psql`. Role has `CREATEDB` granted (needed for Prisma's shadow database during `migrate dev`).
- **Prisma setup** — `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg` installed. Schema at `prisma/schema.prisma` with `User`, `JobApplication`, `StatusHistory` models and `ApplicationStatus`/`ApplicationSource` enums. First migration (`init`) applied.
- **Verified end-to-end**: Express → Prisma → Postgres works (`/health` runs `SELECT 1` through Prisma; a scratch script did create/read/delete on `User`).
- **Auth** — `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `GET /auth/me` in `src/routes/auth.routes.ts`. bcryptjs for hashing (12 rounds), `jsonwebtoken` for access (15m) + refresh (7d) tokens, both set as httpOnly cookies (`src/lib/cookies.ts`) — refresh cookie is scoped to `Path=/auth/refresh` so it's never sent on normal requests. Refresh tokens are stateless (verified by signature only, not stored/revocable server-side) — fine for now, would need a persisted token table to support revocation later. `requireAuth` middleware (`src/middleware/auth.ts`) reads the access-token cookie and sets `req.userId`. Request bodies validated with `zod`. CORS configured with `credentials: true` and origin locked to `FRONTEND_URL` (required for cookies to work cross-origin). Manually verified full flow with curl: signup → me → duplicate signup (409) → wrong password (401) → refresh (rotates cookies) → logout → me (401).
- **JobApplication CRUD** — decision: **no manual "add application" form in the frontend** — new applications are meant to only ever come from the email pipeline (Phase 3/4 worker), so there's no public `POST /applications` route. `src/services/jobApplication.service.ts` holds `createApplication` (for the future in-process worker to call directly — not exposed over HTTP), `listApplications`, `getApplication`, `updateApplication`, `deleteApplication`; `src/routes/applications.routes.ts` exposes `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, all behind `requireAuth` and scoped to `req.userId` (cross-user access returns 404, not 403, to avoid leaking existence). `PATCH` is how a "needs review" entry gets confirmed/corrected, and how status changes append a `StatusHistory` row (only when `status` actually changes). List supports `status`, `needsReview` filters and `sortBy`/`order`. Verified with curl: list/filter/sort, get-by-id with history, patch (status change + review confirm) creates a second history row, unauthenticated request 401s, nonexistent id 404s, delete removes + cascades `StatusHistory`.
- **Bugfix (found via frontend browser testing, commit `aa8abb1`)** — `updateApplication`'s Prisma `update()` call didn't `include: { statusHistory }`, so `PATCH` responses were missing that field. The frontend caches the PATCH response as the full detail object, so editing an application's status crashed the detail page (`statusHistory.map` on `undefined`). Fixed by adding the same `include` used in `getApplication`. Lesson: any endpoint whose response gets cached/rendered as a "detail" shape needs to actually return that full shape, not just the updated row.

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

1. Gmail OAuth connection flow + `EmailAccount`/`RawEmail` models (not yet in schema).
2. BullMQ worker + Claude-based extraction pipeline for auto-populating applications from email — will call `createApplication`/`updateApplication` from `jobApplication.service.ts` directly (in-process, no HTTP hop).
