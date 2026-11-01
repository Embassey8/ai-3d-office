-- Row Level Security, privileges, approval/task guards and the task-queue functions.
-- Principle: the browser (role `authenticated`) can read its own data and perform a small set of
-- CEO actions. Everything an AI employee *does* (status, executions, logs, memories, results,
-- notifications) is written only by the server using the service role, which bypasses RLS.

alter table public.profiles          enable row level security;
alter table public.departments       enable row level security;
alter table public.tools             enable row level security;
alter table public.employees         enable row level security;
alter table public.employee_tools    enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_executions   enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.employee_memories enable row level security;
alter table public.activity_logs     enable row level security;
alter table public.approvals         enable row level security;
alter table public.notifications     enable row level security;

-- ---------------------------------------------------------------------------
-- privileges: start from nothing, grant exactly what the browser needs
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select on public.profiles, public.departments, public.tools, public.employees,
                public.employee_tools, public.tasks, public.task_executions, public.conversations,
                public.messages, public.employee_memories, public.activity_logs,
                public.approvals, public.notifications
  to authenticated;

grant update (display_name, company_name) on public.profiles to authenticated;
-- "Configure employee": identity/model settings only. status & current_task_id are server-owned.
grant update (name, title, personality, system_instructions, model_provider, model_name)
  on public.employees to authenticated;
grant insert, delete on public.employee_tools to authenticated;
grant update (enabled) on public.employee_tools to authenticated;
grant insert (employee_id, title, description, priority, deadline, owner_id)
  on public.tasks to authenticated;
grant update (title, description, priority, deadline, status) on public.tasks to authenticated;
grant insert (employee_id, title, owner_id), update (title), delete on public.conversations to authenticated;
grant insert (conversation_id, role, content, owner_id) on public.messages to authenticated;
grant delete on public.employee_memories to authenticated;
grant update (status, decision_note) on public.approvals to authenticated;
grant update (read_at), delete on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- policies  (auth.uid() wrapped in a sub-select so Postgres evaluates it once per query)
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy tools_select on public.tools for select to authenticated using (true);

create policy departments_select on public.departments for select to authenticated
  using (owner_id = (select auth.uid()));

create policy employees_select on public.employees for select to authenticated
  using (owner_id = (select auth.uid()));
create policy employees_update on public.employees for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy employee_tools_select on public.employee_tools for select to authenticated
  using (owner_id = (select auth.uid()));
create policy employee_tools_insert on public.employee_tools for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy employee_tools_update on public.employee_tools for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy employee_tools_delete on public.employee_tools for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy tasks_select on public.tasks for select to authenticated
  using (owner_id = (select auth.uid()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'queued');
create policy tasks_update on public.tasks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy task_executions_select on public.task_executions for select to authenticated
  using (owner_id = (select auth.uid()));

create policy conversations_select on public.conversations for select to authenticated
  using (owner_id = (select auth.uid()));
create policy conversations_insert on public.conversations for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy conversations_update on public.conversations for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy conversations_delete on public.conversations for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy messages_select on public.messages for select to authenticated
  using (owner_id = (select auth.uid()));
create policy messages_insert on public.messages for insert to authenticated
  with check (owner_id = (select auth.uid()) and role = 'user');

create policy memories_select on public.employee_memories for select to authenticated
  using (owner_id = (select auth.uid()));
create policy memories_delete on public.employee_memories for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy activity_select on public.activity_logs for select to authenticated
  using (owner_id = (select auth.uid()));

create policy approvals_select on public.approvals for select to authenticated
  using (owner_id = (select auth.uid()));
create policy approvals_decide on public.approvals for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'pending')
  with check (owner_id = (select auth.uid()) and status in ('approved', 'rejected'));

create policy notifications_select on public.notifications for select to authenticated
  using (owner_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guard: what the CEO (browser) may do to a task. The server (service_role) is unrestricted.
-- ---------------------------------------------------------------------------
create or replace function public.guard_task_update()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;               -- service role / worker
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'queued'               and new.status in ('paused', 'cancelled'))
      or (old.status = 'paused'               and new.status in ('queued', 'cancelled'))
      or (old.status = 'running'              and new.status in ('paused', 'cancelled'))
      or (old.status = 'waiting_for_approval' and new.status in ('cancelled'))
    ) then
      raise exception 'Task status change % -> % is not allowed', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  -- Content can only be edited before the task is picked up (or while paused).
  if (new.title, new.description, new.priority, new.deadline)
     is distinct from (old.title, old.description, old.priority, old.deadline)
     and old.status not in ('queued', 'paused') then
    raise exception 'A % task can no longer be edited', old.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_guard_update before update on public.tasks
  for each row execute function public.guard_task_update();

-- Tasks must be assigned to an employee that has an enabled, existing owner match (FK handles
-- ownership); also stamp a clean initial state regardless of what the client sent.
create or replace function public.guard_task_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.status := 'queued';
    new.attempts := 0;
    new.result := null;
    new.error := null;
    new.locked_by := null;
    new.locked_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_guard_insert before insert on public.tasks
  for each row execute function public.guard_task_insert();

-- Approval decisions are stamped server-side so they cannot be forged.
create or replace function public.stamp_approval_decision()
returns trigger language plpgsql as $$
begin
  if old.status = 'pending' and new.status is distinct from 'pending' then
    new.decided_at := now();
    if current_user in ('authenticated', 'anon') then
      new.decided_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;
create trigger approvals_stamp before update on public.approvals
  for each row execute function public.stamp_approval_decision();

-- ---------------------------------------------------------------------------
-- Task queue (service role only): safe concurrent claiming with SKIP LOCKED.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_task(p_worker text)
returns setof public.tasks
language sql security definer set search_path = '' as $$
  update public.tasks t
     set status     = 'running',
         locked_by  = p_worker,
         locked_at  = now(),
         started_at = coalesce(t.started_at, now()),
         attempts   = t.attempts + 1
   where t.id = (
     select c.id from public.tasks c
      where c.status = 'queued' and c.run_after <= now() and c.attempts < c.max_attempts
      order by case c.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
               c.created_at
      for update skip locked
      limit 1)
  returning t.*;
$$;

-- Tasks whose worker disappeared: retry while attempts remain, otherwise fail them.
create or replace function public.requeue_stale_tasks()
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with stale as (
    update public.tasks t
       set status    = case when t.attempts < t.max_attempts then 'queued' else 'failed' end,
           error     = case when t.attempts < t.max_attempts then t.error
                            else 'Timed out after ' || t.attempts || ' attempts' end,
           locked_by = null,
           locked_at = null,
           finished_at = case when t.attempts < t.max_attempts then null else now() end
     where t.status = 'running'
       and t.locked_at < now() - make_interval(secs => t.timeout_seconds)
    returning 1)
  select count(*) into n from stale;
  return n;
end;
$$;

revoke all on function public.claim_next_task(text) from public, anon, authenticated;
revoke all on function public.requeue_stale_tasks() from public, anon, authenticated;
grant execute on function public.claim_next_task(text) to service_role;
grant execute on function public.requeue_stale_tasks() to service_role;
