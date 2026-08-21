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

1. Auth endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (JWT in httpOnly cookies + bcrypt).
2. Auth middleware to protect routes.
3. `JobApplication` CRUD endpoints (list w/ filter+sort, get by id, create, update, delete) backing the frontend's home + detail pages.
4. Gmail OAuth connection flow + `EmailAccount`/`RawEmail` models (not yet in schema).
5. BullMQ worker + Claude-based extraction pipeline for auto-populating applications from email.
