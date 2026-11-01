-- Embassey AI Headquarters — core schema (Milestone 3)
-- Ownership model: every business row carries owner_id (the CEO's auth.users id).
-- Child rows reference their parent with a composite (id, owner_id) foreign key, so the
-- database itself guarantees a row can never point at another owner's employee/task.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'CEO',
  company_name  text not null default 'Embassey',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  slug        text not null,
  name        text not null,
  room_id     text,                       -- matches RoomId in src/lib/office/layout.ts
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, slug),
  unique (id, owner_id)
);

-- ---------------------------------------------------------------------------
-- tools (global catalogue) — what an employee MAY be given
-- ---------------------------------------------------------------------------
create table public.tools (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  description        text not null default '',
  /** Sensitive tools always require CEO approval before each use. */
  requires_approval  boolean not null default false,
  risk_level         text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  department_id         uuid,
  slug                  text not null,                 -- stable key, e.g. 'seo'
  name                  text not null,
  title                 text not null,
  personality           text not null default '',
  system_instructions   text not null default '',
  model_provider        text not null default 'anthropic'
                          check (model_provider in ('anthropic', 'openai', 'google', 'local')),
  model_name            text not null default 'claude-sonnet-5-5',
  workstation_id        text,                          -- furniture id in src/lib/office/layout.ts
  stand_side            smallint not null default 1 check (stand_side in (-1, 1)),
  appearance            jsonb not null default '{}'::jsonb,
  status                text not null default 'idle'
                          check (status in ('idle', 'working', 'thinking', 'waiting_for_approval',
                                            'paused', 'completed', 'error')),
  current_task_id       uuid,
  status_changed_at     timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (owner_id, slug),
  unique (id, owner_id),
  foreign key (department_id, owner_id) references public.departments (id, owner_id) on delete set null (department_id)
);

-- ---------------------------------------------------------------------------
-- employee_tools
-- ---------------------------------------------------------------------------
create table public.employee_tools (
  employee_id  uuid not null,
  tool_id      uuid not null references public.tools (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (employee_id, tool_id),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  employee_id     uuid not null,
  title           text not null check (char_length(title) between 1 and 200),
  description     text not null default '' check (char_length(description) <= 20000),
  priority        text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status          text not null default 'queued'
                    check (status in ('queued', 'running', 'waiting_for_approval', 'paused',
                                      'completed', 'failed', 'cancelled')),
  deadline        timestamptz,
  result          text,
  error           text,
  -- queue / worker bookkeeping (used by the execution engine in Milestone 4)
  attempts        integer not null default 0,
  max_attempts    integer not null default 3 check (max_attempts between 1 and 10),
  timeout_seconds integer not null default 300 check (timeout_seconds between 5 and 3600),
  run_after       timestamptz not null default now(),
  locked_by       text,
  locked_at       timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade
);

alter table public.employees
  add foreign key (current_task_id, owner_id) references public.tasks (id, owner_id) on delete set null (current_task_id);

-- ---------------------------------------------------------------------------
-- task_executions (one row per attempt)
-- ---------------------------------------------------------------------------
create table public.task_executions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  task_id        uuid not null,
  employee_id    uuid not null,
  attempt        integer not null check (attempt >= 1),
  status         text not null default 'running'
                   check (status in ('running', 'succeeded', 'failed', 'timed_out', 'cancelled')),
  worker_id      text,
  model_provider text,
  model_name     text,
  input_tokens   integer not null default 0 check (input_tokens >= 0),
  output_tokens  integer not null default 0 check (output_tokens >= 0),
  cost_usd       numeric(12, 6) not null default 0 check (cost_usd >= 0),
  output         text,
  error          text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (id, owner_id),
  unique (task_id, attempt),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade,
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- conversations / messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  employee_id  uuid not null,
  title        text not null default 'Conversation',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id  uuid not null,
  role             text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content          text not null check (char_length(content) between 1 and 50000),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  foreign key (conversation_id, owner_id) references public.conversations (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- employee_memories
-- ---------------------------------------------------------------------------
create table public.employee_memories (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  employee_id     uuid not null,
  kind            text not null default 'fact' check (kind in ('fact', 'preference', 'summary', 'lesson')),
  content         text not null check (char_length(content) between 1 and 10000),
  importance      smallint not null default 3 check (importance between 1 and 5),
  source_task_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade,
  foreign key (source_task_id, owner_id) references public.tasks (id, owner_id) on delete set null (source_task_id)
);

-- ---------------------------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  employee_id   uuid,
  task_id       uuid,
  execution_id  uuid,
  event_type    text not null,        -- e.g. task.started, tool.called, task.failed
  level         text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  message       text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade,
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade,
  foreign key (execution_id, owner_id) references public.task_executions (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------
create table public.approvals (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  employee_id    uuid not null,
  task_id        uuid,
  execution_id   uuid,
  action_type    text not null check (action_type in (
                   'spend_money', 'publish_advertisement', 'issue_refund', 'send_bulk_communication',
                   'place_supplier_order', 'delete_records', 'financial_commitment', 'other')),
  description    text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  decision_note  text,
  decided_by     uuid references public.profiles (id),
  decided_at     timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade,
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade,
  foreign key (execution_id, owner_id) references public.task_executions (id, owner_id) on delete cascade,
  check ((status = 'pending') = (decided_at is null))
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in ('task_completed', 'task_failed', 'approval_requested',
                                             'employee_error', 'message', 'system')),
  title        text not null,
  body         text not null default '',
  employee_id  uuid,
  task_id      uuid,
  approval_id  uuid references public.approvals (id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees (id, owner_id) on delete cascade,
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- indexes (every FK column used for lookups + queue/feeds)
-- ---------------------------------------------------------------------------
create index departments_owner_idx        on public.departments (owner_id);
create index employees_owner_idx          on public.employees (owner_id);
create index employees_department_idx     on public.employees (department_id);
create index employee_tools_owner_idx     on public.employee_tools (owner_id);
create index employee_tools_tool_idx      on public.employee_tools (tool_id);
create index tasks_owner_status_idx       on public.tasks (owner_id, status);
create index tasks_employee_idx           on public.tasks (employee_id, created_at desc);
create index tasks_queue_idx              on public.tasks (run_after, created_at) where status = 'queued';
create index task_executions_task_idx     on public.task_executions (task_id);
create index task_executions_employee_idx on public.task_executions (employee_id);
create index task_executions_owner_idx    on public.task_executions (owner_id, started_at desc);
create index conversations_employee_idx   on public.conversations (employee_id);
create index conversations_owner_idx      on public.conversations (owner_id);
create index messages_conversation_idx    on public.messages (conversation_id, created_at);
create index messages_owner_idx           on public.messages (owner_id);
create index memories_employee_idx        on public.employee_memories (employee_id, importance desc);
create index memories_owner_idx           on public.employee_memories (owner_id);
create index activity_owner_idx           on public.activity_logs (owner_id, created_at desc);
create index activity_employee_idx        on public.activity_logs (employee_id, created_at desc);
create index activity_task_idx            on public.activity_logs (task_id);
create index approvals_owner_status_idx   on public.approvals (owner_id, status);
create index approvals_employee_idx       on public.approvals (employee_id);
create index notifications_owner_idx      on public.notifications (owner_id, created_at desc);
create index notifications_unread_idx     on public.notifications (owner_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','departments','employees','tasks','conversations',
                           'employee_memories','approvals']
  loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Track when an employee's status last changed (drives avatar transitions / dashboards).
create or replace function public.touch_status_changed()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger employees_status_changed before update on public.employees
  for each row execute function public.touch_status_changed();
