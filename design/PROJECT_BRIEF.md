# Master project instructions: Embassey AI Headquarters

## 1. Your role
Act as senior full-stack architect, 3D web developer, UI/UX designer, AI agent engineer and technical lead. Design and build a production-quality 3D virtual office called **Embassey AI Headquarters**.

This is not a static 3D illustration or a conventional admin dashboard. It is an interactive virtual company where a human CEO enters a 3D office, interacts with AI employees, assigns tasks, monitors their work, communicates with them and manages business operations.

Build a functional application, not a visual prototype. Do not stop after a landing page or a static 3D scene.

## 2. Product vision
AI employees have their own:

- identity and job description
- office and workstation
- AI model, tools and integrations
- task queue
- long-term memory
- execution history
- performance metrics

The CEO walks around the office, clicks an employee, opens their workstation, talks with them and assigns tasks.

The app combines a premium 3D game experience with a serious business management platform. The 3D environment is the primary interface; conventional dashboards provide deeper controls. **The approved design is chat-first: see `DESIGN_SPEC.md`.**

## 3. Technology stack
- **Frontend:** Next.js (App Router), TypeScript, React, Tailwind CSS, shadcn/ui, Lucide icons.
- **3D:** Three.js, React Three Fiber, @react-three/drei, GSAP where useful, Blender-compatible GLB/GLTF models.
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security).
- **AI:** Anthropic Claude API first, with other providers behind a provider abstraction. n8n for workflow orchestration. MCP-compatible tool integrations where appropriate.
- **Deployment:** Vercel (frontend), Supabase (database and auth), and suitable background-worker hosting for long-running agent tasks.

Use current stable, mutually compatible versions. Check official docs before installing. Do not use outdated React Three Fiber installation instructions.

## 4. Visual design
The office is a premium, modern corporate one:

- glass architecture
- warm ambient lighting
- wood and stone finishes
- large windows
- premium furniture
- realistic workstations
- plants
- meeting rooms
- interactive screens
- subtle holographic interfaces

Avoid excessive cyberpunk. (The approved design reinterprets this as a calm dark UI with department-coloured rooms: follow `DESIGN_SPEC.md`.)

- **Cameras:** third-person exploration and an isometric overview, with a switch between them.
- **Navigation:** WASD, mouse rotation, wheel zoom, click-to-interact, click-to-focus on employees, collision detection, interactive doors and workstations.
- **Devices:** desktop first, with a responsive alternative for tablet and mobile.

## 5. Office structure (modular, extensible)

| Room | Contents |
|---|---|
| **Reception** | branding, welcome screen, navigation, company activity notifications |
| **Executive Office** | CEO desk, executive dashboard, company performance, financial overview, agent activity overview |
| **Marketing** | SEO, Social Media and Content workstations |
| **Sales** | Lead Generation and Sales Assistant workstations, CRM dashboard |
| **Engineering** | Software Developer and AI Automation workstations, development monitoring dashboard |
| **Research** | Market Research and Competitor Intelligence workstations |
| **Conference Room** | meeting table, employee meeting interactions, company planning interface |

## 6. AI employee system

Initial employees:

1. Executive Assistant
2. SEO Specialist
3. Social Media Manager
4. Sales Development Representative
5. Customer Support Specialist
6. Software Developer
7. Research Analyst

Each employee has:

- unique ID
- name
- avatar
- job title
- department
- personality
- system instructions
- assigned AI model
- available tools
- current task
- task queue
- working status
- memory
- activity history
- performance metrics

**Statuses:** Idle, Working, Thinking, Waiting for approval, Paused, Completed, Error. Show them in the profile and above the 3D avatar.

**Animations:**

- seated and typing when working
- standing when idle
- walking between workstations
- looking at monitors
- taking part in meetings

Animations reflect real state. Never show an employee working when no task is running.

## 7. Employee interaction (panel opened by clicking an employee)
- **Overview:** name, job title, status, current assignment, model provider.
- **Chat:** messages go to the real AI backend, never simulated replies.
- **Tasks:** assign, edit, prioritize, pause, cancel, review completed work.
- **Activity:** recent actions, tool usage, execution logs, errors, completed assignments.
- **Controls:** start, pause, resume, configure, assign new task.

## 8. Task execution engine
When a task is assigned:

1. Save it to the database.
2. Assign it to the employee.
3. Trigger the backend workflow.
4. Load the employee's system instructions.
5. Load relevant memory.
6. Send it to the configured AI provider.
7. Execute permitted tools.
8. Record each action.
9. Update the task status.
10. Save the result.
11. Notify the CEO.

Long-running tasks run in background workers, never blocking the browser. Use n8n where it makes sense for integrations, schedules and workflows. Support retries, timeouts, error handling and execution logs. Never execute arbitrary AI-generated shell commands without security checks.

## 9. Database (normalized Supabase Postgres)

| Table | Holds |
|---|---|
| `profiles` | user and CEO information |
| `employees` | identity, department, model configuration, status |
| `employee_memories` | persistent employee-specific memories |
| `tasks` | title, description, priority, employee ID, status, deadlines |
| `task_executions` | attempts, timestamps, logs, outcomes |
| `conversations` | employee conversations |
| `messages` | individual chat messages |
| `tools` | available integrations and permissions |
| `employee_tools` | tools assigned to individual employees |
| `activity_logs` | employee actions and business events |
| `approvals` | actions awaiting CEO approval |
| `departments` | office departments and locations |
| `notifications` | system notifications |

Use foreign keys, indexes, constraints and timestamps. Turn on RLS for user-owned records. Never expose service-role keys or private API credentials to the browser.

## 10. Realtime office
Use Supabase Realtime for:

- status changes
- task completion
- new messages
- errors
- approval requests
- notifications

The 3D avatar reacts:

- **Start:** the status indicator changes, the typing animation starts, the workstation screen updates and the current assignment is shown.
- **Finish:** the animation stops, the status updates and a completion notification appears.

## 11. CEO dashboard
Show:

- total and active employees
- tasks in progress, completed and failed
- pending approvals
- recent activity
- department performance
- estimated AI usage costs
- an office map for navigation

All of it comes from real database data. No hardcoded fake metrics.

## 12. Security and approvals
Employees only use tools they are authorized for.

CEO approval is required for:

- spending money
- publishing ads
- issuing refunds
- bulk communications
- supplier orders
- deleting important records
- external financial commitments

Store approval decisions and execution records. Rate-limit, and protect credentials.

## 13. Performance
Must run on ordinary modern laptops. Use:

- instancing
- compressed GLB
- texture optimization
- lazy loading
- LOD
- efficient shadows
- limited real-time lights
- asset caching

Don't load every asset at once. Show loading screens and meaningful error states. Use attractive placeholder geometry when assets are unavailable.

## 14. Milestones
1. **Foundation:**
   - Next.js, TypeScript, Tailwind and folder structure
   - base layout
   - working 3D canvas with camera controls
   - initial office

   *Done when* the user can open the app, enter the office and navigate.
2. **Office environment:**
   - all departments, furniture, workstations and lighting
   - avatars and click interactions
   - employee profile panels

   *Done when* every employee has a visible workstation and can be selected.
3. **Backend:**
   - Supabase, migrations and auth
   - employees, tasks, messages and activity logs
   - realtime

   *Done when* data persists after a refresh.
4. **AI employees:**
   - AI provider and per-employee prompts
   - chat and task execution
   - tool permissions, memory and execution logging

   *Done when* at least one employee receives a real task, executes it and returns a result.
5. **Business automation:**
   - n8n, scheduled tasks and external integrations
   - notifications and approval workflows

   *Done when* an employee can trigger a real, authorized business workflow.
6. **Production readiness:**
   - test auth, permissions, execution, realtime and error recovery
   - optimize 3D
   - prepare deployment

   *Done when* it can be deployed and used without mocked AI operations.

## 15. Development rules
1. Build working software, not screenshots.
2. Never substitute mock functionality without clearly labelling it.
3. Keep the 3D environment separate from the AI execution engine.
4. Use reusable components and maintainable TypeScript.
5. Create database migrations.
6. Keep secrets in environment variables.
7. Test important business logic.
8. Run and inspect the app after each milestone, and fix build errors before moving on.
9. Document installation and configuration in `README.md`, and keep `PROJECT_STATUS.md` (done and pending work) up to date.
10. Never overwrite existing files without inspecting them.
11. Never claim a feature works unless it is implemented and tested.

## 16. First task
1. Inspect the project directory and determine whether an app exists.
2. Propose the architecture and folder structure.
3. List the dependencies, external services and environment variables.
4. Write the milestone plan.
5. **Then begin Milestone 1.** Do not spend the session only on documentation.
