# Frontend progress

React + TypeScript SPA (Vite). Part of the job-tracking-app monorepo (see [/backend/PROGRESS.md](../backend/PROGRESS.md) for the other half).

## Stack

- React + Vite + TypeScript
- Planned: React Router (routing), TanStack Query (server state / API calls), Tailwind CSS (styling)

## Done

- **Monorepo scaffold** — created via `npm create vite@latest frontend -- --template react-ts`, npm workspace member. Verified `npm run dev` serves on :5173.
- Everything else is still the Vite default template — no app-specific code yet.

## Next up

1. Install React Router, TanStack Query, Tailwind; strip the Vite template boilerplate.
2. Auth pages (login/signup) + API client talking to the backend's `/auth/*` endpoints, storing session via httpOnly cookies (no token handling in JS).
3. Home page: job application list (company, title, status, date applied) with filter (by status) and sort (by date/company) — backed by the backend's `JobApplication` list endpoint.
4. Detail page: full application info + status history timeline.
5. "Connect Gmail" flow + "needs review" view once the backend's email pipeline (Phase 3/4) lands.
