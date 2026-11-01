# Project Status

_Last updated: Milestone 3._

## Milestone 1 — Foundation: complete

Implemented and verified:

- Next.js 16 (App Router) + TypeScript + Tailwind 4 project; production build passes.
- R3F 3D canvas (client-only, dynamically imported), loading overlay, error boundary.
- Data-driven office layout: 7 rooms, corridor, doorways, perimeter glass walls, furniture.
- Third-person camera (mouse-drag orbit, wheel zoom) and isometric overview with cutaway walls;
  `C` / button toggles between them.
- WASD/arrow movement, Shift to run, camera-relative, with sub-stepped wall/furniture collision
  (a tunnelling bug was found by tests and fixed).
- HUD: current-room indicator, camera toggle, controls help, touch D-pad for coarse pointers.
- Tests: 8 unit tests (collision, doorway reachability for all 7 rooms, furniture overlap).
- Browser-verified (headless Chromium): scene renders, no console errors, both camera modes work,
  player walks through the Executive Office doorway, room indicator updates, west wall blocks.

## Milestone 2 — Office environment: complete (frontend only)

Implemented and verified:

- 7 employees (Executive Assistant, SEO, Social Media, SDR, Customer Support, Developer, Research
  Analyst), each with a distinct workstation, from `src/lib/employees/seed.ts`.
  Seed data stands in for the database until Milestone 3.
- Procedural humanoid avatars with seated typing, standing idle, walking between desk and standing
  spot, a thinking pose, and breathing. Only the `working` status types; avatars sit only for
  statuses where an employee is at their desk. Monitors light up only while the owner is engaged.
- Floating status label (name + status) above every avatar; labels are limited to the player's
  current room in third-person view so they don't show through walls.
- Click an avatar to select it: selection ring, camera focus (third-person), profile panel.
- Employee panel: Overview (real identity/model/tools/instructions), Chat, Tasks, Activity,
  Controls. Esc or X closes. Bottom sheet on phones, side panel on desktop.
- Interactive sliding glass doors that open by proximity and block the doorway while closed.
- Chair orientation bug fixed (backrests were facing the desks).
- 13 unit tests (workstation uniqueness/placement, door behaviour, collision); browser-checked:
  avatar click, panel tabs, preview status, Esc, doorway walk-through with real door colliders.

**Honest limitations of Milestone 2**

- Chat, Tasks, Activity and Start/Pause/Resume/Configure are shown **disabled** with a notice and the
  milestone that builds them. They are not simulated.
- Every employee is `idle` and the "current assignment" is "None" because no task system exists yet.
- The panel's **Demo preview** selector sets a status locally to exercise avatar poses. It runs no
  task, is labelled "Demo preview" in the panel and "preview" on the 3D label, and resets on reload.
- Performance metrics are not shown (no real data yet) rather than invented.
- Walking goes in a straight line, so an employee can clip through their chair when sitting down.
- Meeting-room participation animations are not implemented yet.
- Avatars are primitive-geometry placeholders, not GLB models; no LOD/instancing yet (Milestone 6).
- shadcn/ui is still blocked by the network. `Button`, `Badge` and `TabList` are hand-written in
  shadcn style under `src/components/ui/`.

## Milestone 3 — Backend: code complete; NOT yet verified against a live Supabase project

Built and **verified**:

- 3 SQL migrations: all 13 required tables with composite ownership FKs, check constraints, indexes,
  `updated_at` triggers, RLS on every table, column-level grants, task/approval guards, a
  `SKIP LOCKED` task queue (`claim_next_task`, `requeue_stale_tasks`), a tool catalogue, per-user
  company seeding on sign-up, and the Realtime publication.
- **71 SQL assertions pass on a real PostgreSQL 16** (`supabase/tests/run.sh`): two-tenant isolation,
  forged/cross-tenant writes rejected, server-owned columns protected, task transitions, queue
  ordering/locking/stale recovery, approval stamping, cascade deletes. A tunnelling-style test bug
  and a same-transaction timestamp quirk were found and fixed while writing them.
- 22 unit tests (mappers, validation, SQL-seed ↔ app-seed consistency); typecheck, lint and
  production build pass; demo mode re-checked in a browser.

Built but **not verified end-to-end** (needs a Supabase project with the migrations applied):

- Auth (email/password sign-in/up, `proxy.ts` session refresh, sign-out), loading real employees /
  tasks / activity / conversations, Realtime subscriptions that update avatars and counts, assigning/
  editing/pausing/resuming/cancelling tasks, saving chat messages, configuring employees, the live
  company-stats bar. The code compiles and follows the tested DB contract, but I have **not** seen it
  work against real Supabase Auth/PostgREST/Realtime, so the acceptance criterion "data persists after
  refresh" is **unconfirmed**.
- The local Postgres used for the SQL tests stubs Supabase's `auth` schema and roles; behaviours such as
  Realtime delivery and JWT handling were not exercised.

Honest limitations:

- Tasks are saved and queue, but **nothing executes them** (Milestone 4). Chat messages are saved but
  **no employee answers** (Milestone 4). Employees stay `idle` until a worker updates them.
- No approvals/notifications UI yet — only live counts in the bar (decision UI is Milestone 5).
- The "Demo preview" status selector still exists (local, never saved, clearly labelled).
- Moved to `src/proxy.ts` (Next 16 renamed middleware to proxy).

## Known gaps / honest notes

- **shadcn/ui is not initialised yet.** `npx shadcn init` could not reach `ui.shadcn.com` from the
  build sandbox. A `cn()` helper exists; run the init when the network allows (Milestone 2).
- Furniture and the CEO avatar are primitive-geometry placeholders (no GLB assets yet).
- The third-person camera can clip through walls (no camera collision yet).
- Touch controls are implemented but have not been tested on a real device.
- Frame rate on a real GPU has not been measured (only software-rendered headless Chromium).
- Isometric-mode movement is camera-relative (diagonal along the corridor); may be revisited.

## Pending

| Milestone | Status |
|---|---|
| 2 — Office environment | complete (see above) |
| 3 — Backend (Supabase schema, auth, realtime) | code complete; DB tested locally; live Supabase verification pending (see above) |
| 4 — AI employees (Claude, chat, tasks, tools, memory) | not started |
| 5 — Business automation (n8n, approvals, schedules) | not started |
| 6 — Production readiness | not started |
