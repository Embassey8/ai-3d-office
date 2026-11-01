-- Milestone 4: support for the AI execution engine.
--  * claim_next_task can be scoped to one owner (used when a CEO triggers their own queue) and
--    never claims work for a paused employee.
--  * approvals become single-use: an approval authorises exactly one matching tool call.
--  * Tasks can record the task that delegated them (parent_task_id) so delegation depth is bounded.
--  * Executions gain a 'waiting_for_approval' status.
--  * Employees default to claude-opus-5-5.

drop function if exists public.claim_next_task(text);

create or replace function public.claim_next_task(p_worker text, p_owner uuid default null)
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
       join public.employees e on e.id = c.employee_id and e.owner_id = c.owner_id
      where c.status = 'queued'
        and c.run_after <= now()
        and c.attempts < c.max_attempts
        and e.status <> 'paused'
        -- one running task per employee at a time
        and not exists (select 1 from public.tasks r
                         where r.employee_id = c.employee_id and r.owner_id = c.owner_id
                           and r.status = 'running')
        and (p_owner is null or c.owner_id = p_owner)
      order by case c.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
               c.created_at
      for update of c skip locked
      limit 1)
  returning t.*;
$$;

revoke all on function public.claim_next_task(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_next_task(text, uuid) to service_role;

-- Single-use approvals (written only by the server).
alter table public.approvals add column if not exists consumed_at timestamptz;
create index if not exists approvals_task_idx on public.approvals (task_id);

-- Model default.
alter table public.employees alter column model_name set default 'claude-opus-5-5';
update public.employees set model_name = 'claude-opus-5-5' where model_name = 'claude-sonnet-5-5';

-- Delegation lineage.
alter table public.tasks add column if not exists parent_task_id uuid;
alter table public.tasks
  add constraint tasks_parent_fkey foreign key (parent_task_id, owner_id)
  references public.tasks (id, owner_id) on delete set null (parent_task_id);
create index if not exists tasks_parent_idx on public.tasks (parent_task_id);

-- An execution can end because it is waiting for a CEO decision.
alter table public.task_executions drop constraint if exists task_executions_status_check;
alter table public.task_executions add constraint task_executions_status_check
  check (status in ('running', 'succeeded', 'failed', 'timed_out', 'cancelled', 'waiting_for_approval'));
