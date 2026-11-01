Paste everything below the line into Claude Code.

---

You are building **Embassey AI Headquarters**: a chat-first 3D virtual office where a human CEO manages AI employees.

Read these files first, in this order:

1. `design/PROJECT_BRIEF.md`: the master instructions (stack, features, database, security, milestones, rules). Follow it as the source of truth for *what* to build.
2. `design/DESIGN_SPEC.md`: the approved visual design. Follow it as the source of truth for *how it looks and behaves*.
3. `design/references/*.png`: the three inspiration screenshots (look at them).
4. `design/design-source/*.dc.html`: the design artboards. They are reference only and will not run outside Claude Design. Use them to take exact colours, sizes, copy and the room/desk coordinates of the isometric scene.

Then, before writing substantial code:

- Inspect the current directory and tell me whether an app already exists. Never overwrite existing files without reading them first.
- Propose the architecture, folder structure, dependencies (current stable, mutually compatible versions; check official docs, especially for React Three Fiber and drei), external services and the `.env.example` variables.
- Give me a short milestone plan, then **start Milestone 1** right away.

Milestone 1 target, matching the design:

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, dark theme using the tokens in DESIGN_SPEC.md (Geist + Geist Mono).
- App shell: top bar, left chat panel, 3D scene area, with the responsive behaviour described in the spec.
- React Three Fiber scene of the HQ overview: seven rooms around the Brain, using the layout table in the spec. Placeholder geometry is fine (boxes, capsules for people), but match the colours, positions and camera angle.
- Isometric (orthographic) camera plus a third-person mode, with zoom, pan, click-to-focus on a room and the minimap.
- Floating HTML labels (drei `<Html>`) for room labels, employee status dots and the Brain label.
- The chat UI is visual only in Milestone 1, wired to local typed mock data in a single `lib/mock` module that is clearly labelled as mock. It will be replaced by Supabase in Milestone 3.

Rules: run the app and check it in the browser after each milestone; fix build and type errors before moving on; keep `README.md` and `PROJECT_STATUS.md` current; never claim a feature works unless it is implemented and tested; keep secrets server-side only.
