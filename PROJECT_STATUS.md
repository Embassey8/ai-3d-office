# Project Status

_Last updated: Redesign R1–R3 (shell, 3D scene, Ada task routing, Tasks/Approvals/Dashboard pages) · Milestone 4 in progress · Settings → API keys._

## REDESIGN (chat-first, from design/) — R1 shell + R2 scene: built and browser-checked in DEMO mode

The old corridor-style office, HUD and employee overlay were **replaced** following `design/DESIGN_SPEC.md` and
`design/design-source/Main.dc.html`. Built:

- Design tokens (Geist / Geist Mono via the `geist` package, dark palette, status and department colours).
- App shell: top bar (logo, workspace switcher stub, Office/Tasks/Approvals/Dashboard/Brain tabs with real
  counts, ⌘K employee palette, status pill, notifications, account menu), left chat panel, 3D scene, docked
  right employee panel; stacks on narrow screens.
- Chat panel: team row with live status dots, DM header (model chip), thread built from REAL data in live mode
  (messages, task cards, approval cards with working Approve/Reject), typing indicator from real status, composer
  wired to `/api/chat`.
- 3D scene (React Three Fiber): data-driven `lib/office/departments.ts` (7 rooms on a ring of radius 255 around
  the Brain, exact design coordinates/colours), roads, Brain (disc, rings, beam, pulsing orb, label with real note
  count), room kit, low-poly characters whose pose follows the REAL status, status dots, selection ring, HTML room
  labels, orthographic isometric camera with zoom/pan/fly-to-room, minimap with zoom/fit, third-person mode with
  WASD walking and collision.
- Migration 7 (`20261101000007_design_roster.sql`): the design team (Ada, Femi, Zara, Tobi, Nneka, Kai, Iris) and
  per-employee models for new sign-ups; renames existing seeded employees only if they still have the old default
  names. **Applied to the Supabase project** (verified: the seeding function carries the new roster; project now
  holds 2 users / 14 employees).
- Verification: typecheck, lint, 75 unit tests, production build; headless-Chromium run of demo mode (no console
  errors): scene renders, room fly-to, ⌘K → employee DM + docked panel, status preview changes the 3D pose/label,
  third-person walking.

Not built yet (shown disabled or labelled "coming soon" in the UI — nothing is faked): Tasks / Approvals /
Dashboard / Brain pages, the department close-up scene (Office.dc.html: 3× room, bookshelf, calendar chip, hire
placeholder), voice chat (Chat.dc.html), slash commands, file attachments, hiring, workspace switcher, notification
list and toasts, @mentions, department group channels, the Ada "create task" chat tool. The live (signed-in) path of
the new UI has not been seen against a real Supabase project (sandbox network block). Characters are primitives.

### R3 (this step)

- **Ada routes work**: employees with the `task_router` grant get a `create_task` tool in CHAT (low-risk, reversible:
  creates a *queued* task visible to the CEO). The system prompt lists the colleagues (slug, name, role); the tool is
  scoped to the same company, refuses self-assignment, is limited to 3 tasks per message, and the reply message
  records `metadata.taskIds` so the chat shows task cards under it. Tasks created this way start running in the
  background right away (`after()` + queue). High-risk tools (publish, bulk email, refunds, web) are still NOT offered
  in chat. 79 unit tests cover this with a scripted fake model; it has not been run against the real Claude API.
- **Tasks, Approvals and Dashboard pages** (real data only; demo mode shows "—" and a notice): task list with
  filters and pause/resume/cancel; approvals with Approve/Reject + optional note; dashboard with employees,
  in-progress/queued/completed/failed, pending approvals, estimated AI cost, department performance and recent
  activity. The Brain tab stays disabled.
- Browser-checked in demo mode: tab navigation, empty states, returning to the 3D office. Not seen live.

Still to build: department close-up scene, voice chat, slash commands, attachments, hiring, notifications list,
the Brain page (shared memory), department channels/@mentions.

## Milestone 1 — Foundation: complete (superseded by the redesign above)

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

## Milestone 3 — Backend: database verified on real Supabase; app-level live flow NOT yet verified

Supabase project **`embassey-ai-hq`** (ref `pimsupckcbezbmjwmdgj`, eu-west-1, free plan) was created and
migrations `20261101000001`–`…04` are applied to it. Security advisor: no findings. Performance advisor:
INFO only (composite FKs lack covering indexes; indexes unused on an empty DB) — deferred until there is data.

Built and **verified**:

- 4 SQL migrations: the 13 required tables with composite ownership FKs, check constraints, indexes,
  `updated_at` triggers, RLS on every table, column-level grants, task/approval guards, a `SKIP LOCKED` task
  queue (`claim_next_task`, `requeue_stale_tasks`), tool catalogue, per-user company seeding on sign-up
  (trigger on `auth.users`), Realtime publication (7 tables), pinned function `search_path`.
- **The full security test suite passes twice**: 71 assertions on a local PostgreSQL 16
  (`supabase/tests/run.sh`) and again on the **real Supabase project** (real roles, `auth.uid()` and default
  grants; run in a transaction that rolled itself back — the project has 0 users/rows afterwards). Covers
  two-tenant isolation, forged/cross-tenant writes, server-owned columns, task transitions, queue ordering /
  locking / stale recovery, approval stamping, cascade deletes.
- 22 unit tests (mappers, validation, SQL-seed ↔ app-seed consistency); typecheck, lint, production build;
  with Supabase configured, signed-out visitors are redirected to `/login` by `proxy.ts`; demo mode re-checked.

**Not verified end-to-end — blocked by this build sandbox's network policy**, which denies
`pimsupckcbezbmjwmdgj.supabase.co` for the app server and `curl` (the Supabase connector used for the
migrations works over a separate channel). So I have **not** seen these work in a browser against the live
project: sign-up/sign-in/sign-out, loading real data into the office, Realtime updates to avatars, assigning /
editing / pausing / cancelling tasks, saving chat messages, configuring employees, the live stats bar. The
acceptance criterion "data persists after refresh" is therefore **unconfirmed** at the app level, even though
the database contract it relies on is verified. To close this: allow that host in the environment's network
settings and re-run the sign-up → assign task → refresh flow (or run the app locally with `.env.local` set).

Honest limitations:

- Tasks are saved and queue, but **nothing executes them** (Milestone 4). Chat messages are saved but
  **no employee answers** (Milestone 4). Employees stay `idle` until a worker updates them.
- No approvals/notifications UI yet — only live counts in the bar (decision UI is Milestone 5).
- The "Demo preview" status selector still exists (local, never saved, clearly labelled).
- Email confirmation on the new project is at Supabase's default; sign-up shows "check your email".

## Milestone 4 — AI employees: IN PROGRESS (not verified live)

Written and unit-tested (66 tests, typecheck and lint clean) against test doubles only:
provider abstraction + Claude adapter (default model `claude-opus-5-5`), task runner (agent loop, tool
permission gateway, single-use approvals, memory, retries/backoff, timeout, cancel/pause, cost estimate,
activity logging), queue processor, chat reply, `/api/chat`, `/api/worker/tick`,
`/api/employees/[id]/control`, standalone `npm run worker`, UI wiring (chat, tasks, controls, approve/reject).

**Migrations 5 and 6 are now APPLIED to the Supabase project** (5 verified by inspecting the schema; 6 applied
successfully). Settings → API keys (Vault) is built: `/settings`, `PUT/DELETE /api/settings/api-key`,
`GET /api/settings/status`; the engine resolves each CEO's key from Vault, falling back to an optional
`ANTHROPIC_API_KEY` env var. **Still pending:** the rolled-back security test for migration 6 against the real
project (the connector's confirmation prompt for that script went unanswered); it passes on local Postgres
(101 SQL assertions, with a stand-in Vault) and 76 unit tests pass.

**Not done / not verified:** No real Claude API call and no live Supabase call from the app has ever been made (no
Anthropic key / `SUPABASE_SERVICE_ROLE_KEY` in this environment; network blocked). Integrations other than
web search, delegation and memory are not connected; sensitive tools pause for approval and then report that no
integration is connected. Docs for the engine are still to be written.

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
| 3 — Backend (Supabase schema, auth, realtime) | DB verified on real project; app-level live flow unverified (network-blocked, see above) |
| 4 — AI employees (Claude, chat, tasks, tools, memory) | code written + unit-tested with a fake model; migration 5 NOT yet applied to the Supabase project; never run against the real Claude API or live Supabase (no keys / network blocked) |
| 5 — Business automation (n8n, approvals, schedules) | not started |
| 6 — Production readiness | not started |
