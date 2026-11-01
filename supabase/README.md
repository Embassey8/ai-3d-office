# Supabase

Migrations in `migrations/` are the single source of truth for the database.

| File | Purpose |
|---|---|
| `20261101000001_core_schema.sql` | 13 tables, composite ownership FKs, checks, indexes, triggers |
| `20261101000002_rls_and_queue.sql` | RLS, column-level grants, task/approval guards, `claim_next_task`, `requeue_stale_tasks` |
| `20261101000003_seed_and_realtime.sql` | Tool catalogue, per-user company seeding on signup, Realtime publication |

## Apply to a Supabase project

Either use the Supabase CLI (`supabase link --project-ref <ref>` then `supabase db push`) or paste
the three files, in order, into the SQL editor. Then in the dashboard:

1. **Authentication → Providers → Email** — enabled. For quick local testing you may turn off
   "Confirm email"; leave it on for production.
2. Copy the project URL and publishable key into `.env.local` (see `.env.example`).

The first sign-up for a user creates their profile and seeds their 6 departments, 7 employees and
tool grants automatically (trigger `on_auth_user_created`).

## Security model (summary)

* Every business row has `owner_id`; child rows use composite foreign keys `(id, owner_id)` so a row
  can never reference another owner's data.
* The browser role can **read** its own data and perform a few CEO actions: create/edit/pause/resume/
  cancel tasks, configure employees, send chat messages, decide approvals, mark notifications read.
* It can **not** write: employee status, task results/bookkeeping, executions, activity logs,
  memories, notifications, or assistant messages. Only the service role (server/worker) can.
* `claim_next_task` / `requeue_stale_tasks` / `seed_company` are executable by `service_role` only.

## Tests

```bash
# Needs a local PostgreSQL 16+ server; creates and drops a scratch database `hq_test`.
PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres supabase/tests/run.sh
```

`tests/00_supabase_stub.sql` fakes the Supabase roles/`auth` schema for plain Postgres;
`tests/10_rls_and_queue.test.sql` holds the assertions (two tenants, forged writes, queue, approvals).
