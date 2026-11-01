# Embassey AI Headquarters — Architecture

## Guiding principles

1. **The 3D scene is a view, not the engine.** The office renders state; it never runs AI work.
   The AI execution engine lives behind an API/worker boundary and talks to the scene only
   through database rows and Supabase Realtime events.
2. **Data-driven office.** Rooms, walls, furniture and workstations are described in
   `src/lib/office/layout.ts`. Rendering and collision are both derived from it, so adding a room
   or an employee desk is a data change.
3. **No fake work.** An employee only shows a "working" animation/status when a real
   `task_execution` is running. Placeholder content is labelled as such.
4. **Secrets stay server-side.** The browser only ever holds the Supabase anon key.

## System overview

```
Browser (Next.js, R3F)            Next.js route handlers          Worker (Node)            External
┌────────────────────┐  REST/SSE  ┌─────────────────────┐ enqueue ┌──────────────┐        ┌─────────┐
│ 3D office + panels │──────────▶ │ /api/chat           │───────▶ │ task runner  │──────▶ │ Claude  │
│ zustand UI state   │            │ /api/tasks          │         │ provider abs.│        │ n8n/MCP │
│ Realtime subscriber│◀── WS ──── │ /api/approvals      │         │ tool gateway │        └─────────┘
└────────────────────┘            └──────────┬──────────┘         └──────┬───────┘
          ▲                                  │ RLS (user JWT)            │ service role
          │                                  ▼                           ▼
          └──────────── Supabase Realtime ◀── PostgreSQL (RLS) ◀─────────┘
```

* **Task flow:** CEO assigns task → row in `tasks` (status `queued`) → worker claims it
  (`SELECT … FOR UPDATE SKIP LOCKED`) → loads employee instructions + memory → provider call →
  permitted tools only (checked against `employee_tools`) → every step in `task_executions` /
  `activity_logs` → status + result written → notification row → Realtime pushes to the scene.
* **Approvals:** sensitive tool calls create an `approvals` row and pause the execution
  (`waiting_for_approval`) until the CEO decides.
* **Provider abstraction:** `LLMProvider` interface (`complete`, `stream`, tool-call support);
  Anthropic first, others pluggable.
* **Shell safety:** no arbitrary AI-generated shell execution. Tools are an explicit allow-list
  with validated JSON schemas.

## Folder structure

```
src/
  app/                    Next.js App Router (pages, route handlers)
  components/
    office/               R3F scene: Office, Rig (camera+player), furniture, materials
    hud/                  2D overlay: camera toggle, room indicator, controls, touch pad
    employees/            (M2) employee panel, status badges
    dashboard/            (M3+) CEO dashboard
    ui/                   (M2) shadcn/ui primitives
  lib/
    office/               layout data, collision (pure TS, unit tested)
    input.ts              keyboard / touch input state
    ai/                   (M4) provider abstraction, prompts, tool gateway
    supabase/             (M3) browser + server clients
  store/                  zustand stores
supabase/migrations/      (M3) SQL migrations
worker/                   (M4) background task runner
docs/                     architecture and setup docs
```

## Dependencies (verified compatible, Nov 2026)

next 16.4, react 19.3, three 0.187, @react-three/fiber 9.8, @react-three/drei 10.7,
zustand 5, tailwindcss 4, lucide-react, gsap, vitest. Later: @supabase/supabase-js,
@supabase/ssr, @anthropic-ai/sdk, zod.

Note: `typescript` stays on the 5.x line that `create-next-app` selected; TypeScript 7 was
not adopted because ecosystem support is unverified.

## External services and environment variables

| Variable | Scope | Milestone |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser | 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | server/worker only | 3 |
| `ANTHROPIC_API_KEY` | server/worker only | 4 |
| `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` | server/worker only | 5 |
| `NEXT_PUBLIC_HQ_DEBUG` | browser, test only (`1` exposes player position) | 1 |

## Milestones

See `PROJECT_STATUS.md` for the live status of each milestone.
