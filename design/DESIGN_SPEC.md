# Embassey AI HQ — design spec

This spec describes the approved design. Where it is silent, follow `PROJECT_BRIEF.md`. Exact values can be looked up in `design-source/*.dc.html`.

## 1. Principles

- **Chat first.** Every screen has a conversation panel. The CEO runs the company by talking to employees by text or voice. The 3D office shows what is happening and is where you navigate.
- **The scene shows real state.** Status dots, animations and labels come from the database. An employee with no running task is shown as idle. Never fake activity.
- **Calm premium dark UI.** Use one colour per department. Glows are subtle; avoid neon cyberpunk.
- **Sensitive actions always surface an approval card** in the chat, in the employee panel and as a notification.

## 2. Tokens

### Colour (UI)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0D12` | app background |
| `surface-1` | `#0E1117` | top bar |
| `surface-2` | `#10131A` | side panels |
| `surface-3` | `#151922` | cards, inputs, chips |
| `surface-4` | `#1A1E28` | chips on panels |
| `bubble-me` | `#262C3A` | CEO chat bubbles, active tab |
| `border` | `rgba(255,255,255,0.07–0.12)` | hairlines |
| `text` | `#ECEEF2` | primary text |
| `text-2` | `#AEB5C2` / `#9AA3B2` | secondary text |
| `text-3` | `#8790A0` | labels, timestamps (mono) |
| `primary` | `#4F5BD5` | primary buttons (white text, about 5.7:1 contrast) |
| `primary-text` | `#8F9BFF` | links on dark |
| `mic-active` | `#D9443C` | recording button |
| `voice-tag` | `#F2CF63` on `#1A1508` | "NAME · VOICE" caption chip |

### Status colours (shared by UI and 3D)

| Status | Colour | Label |
|---|---|---|
| working | `#3DDC84` | Working |
| thinking | `#F5B841` | Thinking |
| waiting_for_approval | `#FF8A3D` | Needs approval |
| idle | `#8A93A3` | Idle |
| paused | `#6C8CFF` | Paused |
| completed | `#7EE2A8` | Completed |
| error | `#FF5A5F` | Error |

Approval cards use a warm surface: background `#1A140F`, border `#4A3320`, label `#FFB27A`.

### Department colours

| Department | Wall / accent | Floor | Rug | Icon (lucide) |
|---|---|---|---|---|
| Reception | `#6E7684` | `#575E6A` | `#B5BBC5` | `home` |
| Executive | `#C98A3E` | `#A9732F` | `#EED3A6` | `briefcase` |
| Marketing | `#A04CC0` | `#8A40A6` | `#DDB3EC` | `megaphone` |
| Sales | `#C5463F` | `#A43A34` | `#EDB2AD` | `trending-up` |
| Engineering | `#2F8F5A` | `#287A4D` | `#ADDDC0` | `code` |
| Research | `#3F68C2` | `#3459A8` | `#AFC3EE` | `search` |
| Conference | `#278C84` | `#227870` | `#A9DED9` | `users` |

Room glow: the room's slab gets an outer glow in its wall colour at about 40% alpha. The Brain uses blues from `#C6DAFF` to `#3A3F9E`.

### Type

- **Geist** (400/500/600/700/800) for UI text, and **Geist Mono** (400/500) for labels, counts, timestamps, task IDs and slash commands.
- Sizes: body 14, small 12–13, mono labels 10–11 with letter-spacing 0.08–0.14em in UPPERCASE, panel titles 15–17, department hero 22, voice captions 48/800 uppercase.

### Shape

- Radius: chips 5–7, buttons 7–10, cards 10–12, composer 14, avatars round, employee avatar tile 14.
- Touch targets are at least 36px in dense desktop UI and 44px on touch layouts.

## 3. App shell (all screens)

- **Top bar (56px):**
  - Left: logo tile `#4F5BD5`, "Embassey AI HQ", workspace switcher, and a breadcrumb inside rooms.
  - Centre: tabs Office · Tasks (count) · Approvals (count, orange) · Dashboard · Brain.
  - Right: a "Ask any employee… ⌘K" command palette, a status pill ("7 employees · 4 working" on green `#10241A`), notifications with a badge, and the CEO avatar.
- **Body:** a flex row that wraps: chat panel `flex: 1 1 360px`, 3D scene `flex: 999 1 560px`, and an optional right panel `flex: 1 1 340px`. On narrow screens the panels stack, with chat first.
- **Scene overlays** (HTML over the canvas):
  - Top-left: the camera mode toggle (Isometric / Third-person) and the floor label.
  - Top-right: the notification toast stack.
  - Bottom-left: "RUNS ON" model chips (Opus, Sonnet, Haiku, n8n).
  - Bottom-right: the minimap with zoom out, zoom in and fit-to-view buttons.
  - Bottom-centre: a mono hint line.

## 4. Screens

### 4.1 Main: HQ overview (`design-source/Main.dc.html`)

- **Left: chat with Ada (Chief of Staff, the Executive Assistant).**
  - A team row of seven avatar buttons with status dots. Clicking one opens a DM with that employee.
  - Header: name, role, live status line, model chip, voice button.
  - Thread elements:
    - CEO bubbles (right-aligned, `bubble-me`).
    - Agent messages (left, with avatar).
    - **Approval card** (Approve / Review).
    - **Task card** (task ID, priority badge, assignee, live status, progress bar).
    - Typing/thinking indicator ("Femi is reading 3 notes from the Brain…").
  - Composer: slash-command chips (`/assign`, `/standup`, `/approvals`, `/meeting`), a textarea, and attach, mic and send buttons.
- **Scene:** an isometric overview with seven rooms around the Brain, linked by dashed roads tinted in each department's colour. Each room has a floating label showing its icon tile, name, "N agents · status" and the agents' avatar dots.
- **Interactions:**
  - Click a room to fly the camera there and open the department view.
  - Click an employee to open their panel and chat.
  - Use the camera toggle and the zoom buttons.

### 4.2 Office: department view (`design-source/Office.dc.html`)

- **Left:** the department channel `# marketing`. It holds a group thread with file attachments (saved to the Brain), a preview grid of 3 post drafts, @mentions and a typing indicator.
- **Centre:** one large room with three workstations (SEO, Social, Content), a bookshelf, a wall screen with a 7-day chart, a window, a sofa, a coffee table, a lamp and plants.
  - Each employee has a floating chip with their name and role plus status.
  - The selected employee has a coloured ring on the floor.
  - An unstaffed workstation shows a dashed "+ Hire an employee" placeholder.
  - A floating calendar chip appears for scheduled work ("TUE 9:00 · LinkedIn carousel · pending approval").
  - A "Back to HQ" button sits top-left, and a department hero card bottom-left.
- **Right: the employee panel** (the brief's §7).
  - Header: avatar, name, role · department, status pill, close button.
  - Tabs: Overview · Chat · Tasks · Activity · Settings.
  - Overview contains:
    - an approval card,
    - the current assignment with step and progress,
    - a 2×2 facts grid: model, employee ID, memory count, AI cost today,
    - authorized tools as chips,
    - the task queue with priority badges (HIGH / MED / LOW),
    - controls: Pause, Configure and **Assign task** (primary).

### 4.3 Chat: voice chat with an employee (`design-source/Chat.dc.html`)

- **Left: DM with Kai.**
  - Header: avatar with status, name, role, "Engineering · Claude Opus · 6 tools", and Chat / Tasks / Activity tabs.
  - The thread dims to 55% while listening.
  - The **tool run log card** shows: steps with ✓ or ●, file paths in mono, +/− diff counts, duration, and a pending approval step.
  - Voice dock:
    - a breathing gradient orb with a "LISTENING" mono label,
    - suggested quick actions,
    - a live transcript field with an animated waveform,
    - a red stop/mic button and a send button.
- **Right:** the room close-up.
  - The employee wears a headset and has a green floor ring and a "Listening to you" chip.
  - A "Kai · listening" pill sits top-right.
  - Voice captions sit top-left: a yellow "EMMANUEL · VOICE" chip, then the previous words in grey and the current words in white, 48px uppercase.
  - The employee's plan card sits bottom-right: numbered steps, done / needs approval / pending.
  - A dashed "SUB-AGENT BAY · READY" area.

## 5. 3D scene

The design uses CSS 3D. Rebuild it in **React Three Fiber**.

- **Camera.** Isometric mode is an `OrthographicCamera` looking down at about 35° elevation (equivalent to CSS `rotateX(60deg) rotateZ(-45deg)`). The back corner of the floor points up on screen and the back walls run along the top-left and top-right edges. Third-person mode uses a perspective camera behind a CEO avatar, with WASD movement and collision.
- **Units.** Design pixels map to world units at 1 unit = 10 design px. Floor plane is x/z; height is y.
- **Overview layout** (design px, on a 700×700 floor; the Brain is at (350, 350)):

| Room | Centre (x, y) | Size | Employees |
|---|---|---|---|
| Reception | (169.7, 530.3) | 150×130 | Nneka · Customer Support (idle), with a sofa |
| Sales | (96.6, 321.5) | 150×130 | Tobi · SDR (working) |
| Marketing | (214.3, 134.1) | 150×130 | Femi · SEO (working), Zara · Social (needs approval), with a sofa |
| Executive | (434.2, 109.3) | 150×130 | Ada · Executive Assistant (working) |
| Research | (590.7, 265.8) | 150×130 | Iris · Research Analyst (thinking) |
| Engineering | (565.9, 485.7) | 150×130 | Kai · Software Developer (working) |
| Conference | (378.5, 603.4) | 150×130 | empty; table and six chairs, label "No meeting" |

Rooms sit on a circle of radius 255 around the Brain, 360/7 degrees apart, with Reception nearest the viewer. Make the layout data-driven (a `departments` table holding position and colour) so rooms can be added.

- **Room kit (overview scale):**
  - slab 6 high,
  - two back walls 44 high (left wall lighter, right wall darker, with a light top-edge highlight),
  - inset rug at 42% opacity,
  - white desk 72×24×12 with two dark monitors that glow in the room colour,
  - chairs, two plants, a wall screen, an optional sofa.
  - Close-up rooms are about 3× scale with walls 100 high, a window on the right wall and bookshelves.
- **The Brain:**
  - a dark disc (r≈88) with three concentric glowing rings,
  - a vertical light beam (about 190 high),
  - a pulsing orb (r≈24) floating at height 22,
  - a floating label "THE BRAIN · N notes · shared memory" showing the real `employee_memories` / shared memory count.
- **Roads:** 12 wide, colour `#1A1F2B`, a dashed white centre line, and a thin line in the department colour.
- **Employees:** low-poly stylized characters. Each has hair colour, shirt colour and an avatar colour per employee. Animations by state:
  - working: seated and typing,
  - thinking: seated, looking at the monitor, with a small amber pulse,
  - waiting for approval: seated, turned toward the camera, with an orange chip,
  - idle: standing,
  - in a meeting: walks to the Conference room.
- **Labels:** use drei `<Html>` with occlusion off and a distance factor so they stay readable. The status dot above the head uses the status colour plus a glow.
- **Selection:** a ring on the floor in the status colour and a camera ease (GSAP) to frame the employee.
- **Performance:** instance desks, chairs and plants; bake lighting where possible; use one shadow-casting light; lazy-load close-up room detail.

## 6. Employee seed data (design names)

| ID | Name | Role | Department | Avatar colour | Default model |
|---|---|---|---|---|---|
| EMP-001 | Ada | Executive Assistant / Chief of Staff | Executive | `#D89A4A` | Opus |
| EMP-002 | Femi | SEO Specialist | Marketing | `#B05BD0` | Sonnet |
| EMP-003 | Zara | Social Media Manager | Marketing | `#D59AE8` | Sonnet |
| EMP-004 | Tobi | Sales Development Rep | Sales | `#D9574F` | Sonnet |
| EMP-005 | Nneka | Customer Support Specialist | Reception | `#8B8F98` | Haiku |
| EMP-006 | Kai | Software Developer | Engineering | `#3FA56B` | Opus |
| EMP-007 | Iris | Research Analyst | Research | `#4C7BD9` | Opus |

Ada is the default chat: she routes CEO requests to other employees by creating tasks. Counts and metrics in the designs are sample values; in the app they come from the database.

## 7. Chat message types (map to `messages` with a `kind` column)

`text` · `approval_request` (links to `approvals`) · `task_card` (links to `tasks`) · `tool_run` (summarises `task_executions` / `activity_logs`) · `file` (links to Supabase Storage or a Brain note) · `media_preview` · `system` / `typing` (realtime presence, not stored). Voice input is transcribed into a normal `text` message, and the live transcript is shown while recording.
