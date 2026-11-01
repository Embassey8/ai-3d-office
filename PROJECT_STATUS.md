# Project Status

_Last updated: Milestone 1._

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
| 2 — Office environment (employees, avatars, click interaction, profile panels, interactive doors) | not started |
| 3 — Backend (Supabase schema, auth, realtime) | not started |
| 4 — AI employees (Claude, chat, tasks, tools, memory) | not started |
| 5 — Business automation (n8n, approvals, schedules) | not started |
| 6 — Production readiness | not started |
