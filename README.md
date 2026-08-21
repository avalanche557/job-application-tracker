# Job Tracking App

Tracks job applications, auto-populated from your inbox. React frontend, Express + Prisma backend, Postgres database. npm workspaces monorepo with `frontend/` and `backend/` packages.

See [backend/PROGRESS.md](backend/PROGRESS.md) and [frontend/PROGRESS.md](frontend/PROGRESS.md) for what's built and what's next.

## Prerequisites

- Node.js 20+
- Postgres (locally via Homebrew, or any reachable Postgres instance)

## Setup

1. Configure the backend environment:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Fill in `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `backend/.env` with random values:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Leave `DATABASE_URL` as-is for now if you're following step 2 below as written — its default matches the role/db created there. (`.env` must exist before the next step, since installing the backend's dependencies generates the Prisma client, which needs `DATABASE_URL` to at least be present.)

2. Configure the frontend environment:

   ```bash
   cp frontend/.env.example frontend/.env
   ```

   Defaults (`VITE_API_URL=http://localhost:4000`) work as-is for local development.

3. Install dependencies for both workspaces from the repo root:

   ```bash
   npm install
   ```

4. Start Postgres and create a database. `postgresql@16` is keg-only, so its CLI tools (`psql`, `createdb`, ...) aren't on `PATH` by default:

   ```bash
   brew install postgresql@16   # skip if already installed
   brew services start postgresql@16
   export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # add to your shell profile to make this permanent

   createuser job_tracker_user --pwprompt --createdb   # set a password when prompted; --createdb is needed for Prisma's shadow database
   createdb job_tracker --owner job_tracker_user
   ```

   If you use a different role name, password, or database name, update `DATABASE_URL` in `backend/.env` to match.

5. Run the database migrations:

   ```bash
   npm run db:migrate -w backend
   ```

## Running the app

From the repo root, in two terminals:

```bash
npm run dev:backend    # API on http://localhost:4000
npm run dev:frontend   # app on http://localhost:5173
```

Or from within each package directory: `npm run dev`.

## Building for production

```bash
npm run build -w backend    # compiles to backend/dist, run with npm start -w backend
npm run build -w frontend   # static build to frontend/dist
```
