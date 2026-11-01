# Embassey AI Headquarters

A 3D virtual company headquarters where a human CEO walks around an office, meets AI employees,
assigns them tasks and monitors their work.

> **Status:** Milestones 1–2 (3D office, employees, profile panels) are complete. AI employees, backend and automation are
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

Copy `.env.example` to `.env.local` once backend milestones begin.
