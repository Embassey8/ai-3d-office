# Embassey AI Headquarters

A 3D virtual company headquarters where a human CEO walks around an office, meets AI employees,
assigns them tasks and monitors their work.

> **Status:** Milestones 1–2 are complete; Milestone 3 (Supabase backend): database verified on a real project, app-level live flow not yet verified. AI employees and automation are
> not built yet — see [PROJECT_STATUS.md](./PROJECT_STATUS.md).

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx vitest run` | Unit tests |

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Move (relative to the camera) |
| `Shift` | Run |
| Mouse drag | Rotate camera (third-person) |
| Scroll | Zoom |
| `C` | Switch third-person / isometric camera |
| Click an employee | Open their profile panel (`Esc` closes) |
| On-screen pad | Movement on touch devices |

## Documentation

* [Architecture](./docs/ARCHITECTURE.md) — design, folder structure, services, env vars
* [PROJECT_STATUS.md](./PROJECT_STATUS.md) — completed and pending work

## Connecting Supabase (optional until you want persistence)

Without Supabase the app runs in **demo mode** (seed employees, nothing saved). To enable real
accounts, tasks, chat history and Realtime:

1. Create a Supabase project and apply `supabase/migrations/*` (see [supabase/README.md](./supabase/README.md)).
2. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. `npm run dev`, create an account on `/login`. Your company is seeded on first sign-up.

Never put the service-role key in a `NEXT_PUBLIC_*` variable.
