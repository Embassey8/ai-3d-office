-- Behavioural tests for schema, RLS, guards and queue. Run against a database that has the stub
-- (00_supabase_stub.sql) and all migrations applied:  psql -v ON_ERROR_STOP=1 -f this-file
-- Any failed assertion raises an exception and aborts the run.

drop schema if exists test cascade;
create schema test;
grant usage on schema test to public;

create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok   - %', label;
end $$;

-- Runs sql and requires it to raise an error.
create function test.fails(sql text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin
    execute sql;
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'FAIL (expected an error): %', label; end if;
  raise notice 'ok   - %', label;
end $$;

-- Runs a DML statement and returns the number of rows it touched (RLS hides rows silently).
create function test.rows(sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function test.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
end $$;
create function test.as_service() returns void language plpgsql as $$
begin reset role; set local role service_role; end $$;
create function test.as_anon() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', true); set local role anon; end $$;
create function test.as_admin() returns void language plpgsql as $$
begin reset role; end $$;

begin;

-- Two CEOs. The auth trigger must create a profile and seed a company for each.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');

select test.ok((select count(*) from public.profiles) = 2, 'signup creates a profile per user');
select test.ok((select count(*) from public.employees where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 7, 'signup seeds 7 employees');
select test.ok((select count(*) from public.departments where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 6, 'signup seeds 6 departments');
select test.ok((select count(*) from public.employee_tools where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 19, 'signup grants 19 employee tools');
select test.ok((select count(distinct workstation_id) from public.employees where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 7, 'every employee has a distinct workstation');
select test.ok((select bool_and(status = 'idle') from public.employees), 'all employees start idle');

-- Capture ids as admin
create temp table ids as
select
  (select id from public.employees where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' and slug = 'seo')  as a_seo,
  (select id from public.employees where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' and slug = 'dev')  as a_dev,
  (select id from public.employees where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002' and slug = 'seo')  as b_seo;
grant select on ids to authenticated, service_role, anon;

-- ================= anon =================
select test.as_anon();
select test.fails('select * from public.employees', 'anon cannot read employees');
select test.fails('select * from public.tasks', 'anon cannot read tasks');

-- ================= isolation =================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok((select count(*) from public.employees) = 7, 'A sees exactly their 7 employees');
select test.ok((select count(*) from public.employees where id = (select b_seo from ids)) = 0, 'A cannot see B''s employee');
select test.ok((select count(*) from public.employee_tools) = 19, 'A sees only their employee_tools');
select test.ok((select count(*) from public.tools) = 16, 'tool catalogue is readable');
select test.ok((select count(*) from public.profiles) = 1, 'A sees only their own profile');

-- Configure employee: allowed columns only
select test.ok(test.rows($$update public.employees set personality = 'Even more analytical' where id = (select a_seo from ids)$$) = 1, 'A can configure own employee');
select test.fails($$update public.employees set status = 'working' where id = (select a_seo from ids)$$, 'A cannot set employee status (server-owned)');
select test.fails($$update public.employees set owner_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = (select a_seo from ids)$$, 'A cannot reassign employee ownership');
select test.ok(test.rows($$update public.employees set name = 'Hacked' where id = (select b_seo from ids)$$) = 0, 'A cannot edit B''s employee');

-- ================= tasks =================
select test.ok(test.rows($$insert into public.tasks (owner_id, employee_id, title, priority) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'Audit homepage', 'normal')$$) = 1, 'A can assign a task to own employee');
select test.fails($$insert into public.tasks (owner_id, employee_id, title, status) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'Sneaky', 'completed')$$, 'A cannot insert a task with a chosen status');
select test.fails($$insert into public.tasks (owner_id, employee_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', (select b_seo from ids), 'Cross-tenant')$$, 'A cannot assign a task to B''s employee (composite FK)');
select test.fails($$insert into public.tasks (owner_id, employee_id, title) values ('bbbbbbbb-0000-0000-0000-000000000002', (select b_seo from ids), 'Impersonate')$$, 'A cannot create a task owned by B (RLS)');
select test.fails($$insert into public.tasks (owner_id, employee_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), '')$$, 'empty task title rejected');
select test.fails($$insert into public.tasks (owner_id, employee_id, title, priority) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'x', 'asap')$$, 'invalid priority rejected');

select test.ok(test.rows($$update public.tasks set priority = 'urgent', title = 'Audit homepage (urgent)'$$) = 1, 'A can edit and prioritise a queued task');
select test.ok(test.rows($$update public.tasks set status = 'paused'$$) = 1, 'A can pause a queued task');
select test.ok(test.rows($$update public.tasks set status = 'queued'$$) = 1, 'A can resume a paused task');
select test.fails($$update public.tasks set status = 'running'$$, 'A cannot mark a task running');
select test.fails($$update public.tasks set status = 'completed'$$, 'A cannot mark a task completed');
select test.fails($$update public.tasks set result = 'forged result'$$, 'A cannot write task results');
select test.fails($$update public.tasks set locked_by = 'me'$$, 'A cannot touch queue bookkeeping');

-- Second task so we can test ordering later (as A, normal priority, created after the urgent one)
select test.ok(test.rows($$insert into public.tasks (owner_id, employee_id, title, priority) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_dev from ids), 'Fix flaky test', 'normal')$$) = 1, 'A queues a second task');

-- ================= queue (service role) =================
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.tasks) = 0, 'B sees none of A''s tasks');
select test.fails($$select * from public.claim_next_task('hacker')$$, 'authenticated users cannot claim tasks');
select test.fails($$select public.seed_company('bbbbbbbb-0000-0000-0000-000000000002')$$, 'authenticated users cannot call seed_company');

select test.as_service();
select test.ok((select title from public.claim_next_task('worker-1')) = 'Audit homepage (urgent)', 'claim returns highest-priority task first');
select test.ok((select status || '/' || attempts || '/' || locked_by from public.tasks where title = 'Audit homepage (urgent)') = 'running/1/worker-1', 'claimed task is running with attempt 1 and locked');
select test.ok((select title from public.claim_next_task('worker-2')) = 'Fix flaky test', 'second worker gets the next task, not the same one');
select test.ok((select count(*) from public.claim_next_task('worker-3')) = 0, 'no more claimable tasks');

-- Stale task recovery
update public.tasks set locked_at = now() - interval '1 hour' where title = 'Fix flaky test';
select test.ok(public.requeue_stale_tasks() = 1, 'stale running task is detected');
select test.ok((select status from public.tasks where title = 'Fix flaky test') = 'queued', 'stale task is re-queued while attempts remain');
update public.tasks set status = 'running', attempts = max_attempts, locked_at = now() - interval '1 hour' where title = 'Fix flaky test';
select public.requeue_stale_tasks();
select test.ok((select status from public.tasks where title = 'Fix flaky test') = 'failed', 'stale task fails once attempts are exhausted');

-- Server-written state: execution, status, activity
insert into public.task_executions (owner_id, task_id, employee_id, attempt, status, model_provider, model_name, input_tokens, output_tokens, cost_usd)
select owner_id, id, employee_id, 1, 'succeeded', 'anthropic', 'claude-sonnet-5-5', 1200, 300, 0.0123 from public.tasks where title = 'Audit homepage (urgent)';
update public.employees set status = 'working' where id = (select a_seo from ids);
insert into public.activity_logs (owner_id, employee_id, event_type, message)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'task.started', 'Started audit');
select test.ok((select status_changed_at > created_at from public.employees where id = (select a_seo from ids)), 'status change stamps status_changed_at');
select test.fails($$insert into public.task_executions (owner_id, task_id, employee_id, attempt) select owner_id, id, (select b_seo from ids), 2 from public.tasks limit 1$$, 'execution cannot link another owner''s employee');

-- Task edit guard once running (as A)
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.fails($$update public.tasks set title = 'changed' where title = 'Audit homepage (urgent)'$$, 'A cannot edit a running task');
select test.ok(test.rows($$update public.tasks set status = 'paused' where title = 'Audit homepage (urgent)'$$) = 1, 'A can request pause of a running task');
select test.ok((select count(*) from public.task_executions) = 1, 'A can read their executions');
select test.ok((select count(*) from public.activity_logs) = 1, 'A can read their activity log');
select test.fails($$insert into public.activity_logs (owner_id, event_type, message) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'forged')$$, 'A cannot write activity logs');
select test.fails($$insert into public.task_executions (owner_id, task_id, employee_id, attempt) select owner_id, id, employee_id, 9 from public.tasks limit 1$$, 'A cannot write executions');

-- ================= approvals =================
select test.as_service();
insert into public.approvals (owner_id, employee_id, action_type, description, payload)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'publish_advertisement', 'Publish $200 ad', '{"amount":200}');
insert into public.approvals (owner_id, employee_id, action_type, description)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'issue_refund', 'Refund order 42');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.approvals) = 0, 'B cannot see A''s approvals');
select test.ok(test.rows($$update public.approvals set status = 'approved'$$) = 0, 'B cannot decide A''s approvals');

select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok((select count(*) from public.approvals where status = 'pending') = 2, 'A sees 2 pending approvals');
select test.fails($$update public.approvals set status = 'expired'$$, 'A cannot set status expired');
select test.fails($$update public.approvals set status = 'pending'$$, 'A cannot set status back to pending');
select test.fails($$update public.approvals set payload = '{"amount":1}'$$, 'A cannot edit the approval payload');
select test.ok(test.rows($$update public.approvals set status = 'approved', decision_note = 'ok' where description = 'Publish $200 ad'$$) = 1, 'A can approve');
select test.ok(test.rows($$update public.approvals set status = 'rejected' where description = 'Refund order 42'$$) = 1, 'A can reject');
select test.ok((select bool_and(decided_at is not null and decided_by = 'aaaaaaaa-0000-0000-0000-000000000001') from public.approvals), 'decisions are stamped server-side');
select test.ok(test.rows($$update public.approvals set status = 'rejected' where description = 'Publish $200 ad'$$) = 0, 'a decided approval cannot be re-decided');

-- ================= conversations / messages =================
select test.ok(test.rows($$insert into public.conversations (owner_id, employee_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'Weekly sync')$$) = 1, 'A can open a conversation');
select test.fails($$insert into public.conversations (owner_id, employee_id) values ('aaaaaaaa-0000-0000-0000-000000000001', (select b_seo from ids))$$, 'A cannot converse with B''s employee');
select test.ok(test.rows($$insert into public.messages (owner_id, conversation_id, role, content) select owner_id, id, 'user', 'Hello' from public.conversations$$) = 1, 'A can send a user message');
select test.fails($$insert into public.messages (owner_id, conversation_id, role, content) select owner_id, id, 'assistant', 'I am the AI' from public.conversations$$, 'A cannot forge assistant messages');
select test.fails($$insert into public.messages (owner_id, conversation_id, role, content) select owner_id, id, 'user', '' from public.conversations$$, 'empty message rejected');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.messages) = 0 and (select count(*) from public.conversations) = 0, 'B cannot see A''s conversations or messages');

-- ================= notifications & memories =================
select test.as_service();
insert into public.notifications (owner_id, type, title, employee_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'task_completed', 'Audit done', (select a_seo from ids));
insert into public.employee_memories (owner_id, employee_id, content) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'CEO prefers concise reports');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok(test.rows($$update public.notifications set read_at = now()$$) = 1, 'A can mark a notification read');
select test.fails($$update public.notifications set title = 'edited'$$, 'A cannot edit notification content');
select test.ok((select count(*) from public.employee_memories) = 1, 'A can read employee memories');
select test.fails($$insert into public.employee_memories (owner_id, employee_id, content) values ('aaaaaaaa-0000-0000-0000-000000000001', (select a_seo from ids), 'implant')$$, 'A cannot write employee memories');

-- ================= cascade =================
select test.as_admin();
delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test.ok((select count(*) from public.employees where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0
           and (select count(*) from public.departments where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0
           and (select count(*) from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0, 'deleting a user cascades all their data');
select test.ok((select count(*) from public.employees where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 7, 'other users are unaffected by the cascade');

rollback;
\echo ALL TESTS PASSED
