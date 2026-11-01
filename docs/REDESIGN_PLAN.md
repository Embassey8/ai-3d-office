# Redesign plan — chat-first Embassey AI HQ

Source of truth: `design/PROJECT_BRIEF.md` (what) and `design/DESIGN_SPEC.md` (how it looks).
**Status: plan only. No redesign code written yet — waiting for `design/design-source/*.dc.html` and
`design/references/*.png`, which are needed for exact values.**

## What exists today (inspected)
A working Next.js 16 app from Milestones 1–4: warm-light corridor-style 3D office, 7 seeded employees, profile
panel, Supabase schema/RLS/queue (migrations 1–5), auth, Realtime data layer, Claude execution engine, approvals
logic, 66 unit tests. Migration 5 is written but **not applied** to the Supabase project; nothing has been run
against the real Claude API or live Supabase from the app (no keys, sandbox network blocked).

## Keep / change / replace
| Area | Decision |
|---|---|
| DB schema, RLS, queue, auth, `proxy.ts`, Supabase data layer, engine (provider, runner, tools, approvals), tests, Vercel project | **Keep**, extend via new migrations |
| App shell (3 columns: chat · scene · panel; top bar with tabs) | **Replace** the current floating-HUD layout |
| Look & feel (tokens, Geist/Geist Mono, department colours, status colours) | **Replace** the warm office look |
| 3D scene | **Replace**: 7 department rooms on a circle (r=255 design px) around "The Brain", roads, orthographic ~35° camera, room kit, stylised characters, minimap |
| Office layout data (`lib/office/layout.ts`: corridor, walls, doors) | **Replace** with a data-driven `departments` table (position + colour). Third-person mode needs new collision data |
| Roster | **Rename** to Ada, Femi, Zara, Tobi, Nneka, Kai, Iris (EMP-001…007) with the spec's colours and models |
| Chat | **Promote** to the primary surface: DM per employee, Ada (Chief of Staff) as default, message kinds, voice |

## Schema changes the design needs (new migration, not yet written)
- `messages.kind` (`text | approval_request | task_card | tool_run | file | media_preview`) + refs to approvals/tasks.
- `departments`: position (x, y), colour, icon, size. `employees`: employee code, avatar colour.
- **The Brain**: shared memory across employees (today `employee_memories.employee_id` is required) plus a count shown on the Brain label.
- Per-employee models per spec: Opus (Ada, Kai, Iris), Sonnet (Femi, Zara, Tobi), Haiku (Nneka). Supersedes the "all Opus" default.
- Re-seed with the new roster. Safe: the Supabase project currently holds no users.
- Ada routes requests by creating tasks → chat needs a controlled `create_task` tool (today chat is memory-only).

## Proposed milestones
1. **Shell + tokens**: Geist (via the `geist` package, no network fetch), tokens, top bar, three-column shell, responsive stacking, command palette stub.
2. **3D scene rebuild**: data-driven rooms, Brain, roads, room kit (instanced), characters, ortho + third-person cameras, GSAP fly-to, labels, minimap.
3. **Chat-first**: DM threads, message-kind cards (approval, task, tool-run), composer + slash commands, Ada routing, real engine behind it.
4. **Department view + employee panel** and the Tasks / Approvals / Dashboard / Brain tabs (real data only).
5. **Voice**: live transcript, captions, listening state.
6. **Backend alignment + live verification** (apply migrations, real keys, end-to-end) and production readiness.

## Questions to settle (blocking where marked)
1. **(blocking)** Please send `design/design-source/Main.dc.html`, `Office.dc.html`, `Chat.dc.html` and `design/references/*.png`.
2. **Voice transcription**: browser Web Speech API (free, Chrome/Edge/Safari-dependent, audio goes to the browser vendor) or a server-side speech-to-text service you'd supply a key for?
3. **Third-person mode**: keep WASD walking with collision in the new radial layout, or isometric-only for now?
4. **Mock data**: the prompt asks for a labelled `lib/mock` module for Milestone 1; the app already has a labelled demo mode plus a real backend. Recommendation: reuse demo mode and mock only what has no backend yet. OK?
5. Still open from before: apply migration 5 to Supabase, and provide `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` as Vercel secrets.
