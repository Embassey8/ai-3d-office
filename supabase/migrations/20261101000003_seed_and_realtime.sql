-- Global tool catalogue, per-user company seeding on signup, and Realtime publication.

insert into public.tools (slug, name, description, requires_approval, risk_level) values
  ('calendar',         'Calendar',            'Read and propose calendar events.',                       false, 'low'),
  ('email_draft',      'Email drafts',        'Draft emails for review. Does not send.',                 false, 'low'),
  ('task_router',      'Task router',         'Hand work to other employees.',                           false, 'low'),
  ('web_search',       'Web search',          'Search the public web.',                                  false, 'low'),
  ('seo_audit',        'SEO audit',           'Analyse pages and keywords.',                             false, 'low'),
  ('social_draft',     'Social drafts',       'Draft social posts for review.',                          false, 'low'),
  ('social_publish',   'Social publishing',   'Publish posts or paid ads to social networks.',           true,  'high'),
  ('lead_search',      'Lead search',         'Find and qualify prospects.',                             false, 'low'),
  ('crm',              'CRM',                 'Read and update CRM records.',                            false, 'medium'),
  ('bulk_email',       'Bulk email',          'Send email to many recipients.',                          true,  'high'),
  ('helpdesk',         'Helpdesk',            'Read and answer support tickets.',                        false, 'medium'),
  ('refund',           'Refunds',             'Issue customer refunds.',                                 true,  'high'),
  ('knowledge_base',   'Knowledge base',      'Search internal documentation.',                          false, 'low'),
  ('repo_read',        'Repository (read)',   'Read code in company repositories.',                      false, 'low'),
  ('repo_pr',          'Repository (PRs)',    'Open pull requests. Never merges.',                       false, 'medium'),
  ('document_reader',  'Document reader',     'Read uploaded documents.',                                false, 'low')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Company seeding: one department set + the initial seven employees per CEO.
-- Keep in sync with src/lib/employees/seed.ts (a unit test enforces this).
-- ---------------------------------------------------------------------------
create or replace function public.seed_company(p_owner uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.departments (owner_id, slug, name, room_id) values
    (p_owner, 'executive',        'Executive',        'executive'),
    (p_owner, 'marketing',        'Marketing',        'marketing'),
    (p_owner, 'sales',            'Sales',            'sales'),
    (p_owner, 'customer-support', 'Customer Support', 'sales'),
    (p_owner, 'engineering',      'Engineering',      'engineering'),
    (p_owner, 'research',         'Research',         'research')
  on conflict (owner_id, slug) do nothing;

  insert into public.employees
    (owner_id, department_id, slug, name, title, personality, system_instructions,
     workstation_id, stand_side, appearance)
  select p_owner, d.id, e.slug, e.name, e.title, e.personality, e.instructions,
         e.workstation, e.stand_side, e.appearance::jsonb
  from (values
    ('exec-assistant', 'executive', 'Ava Mercer', 'Executive Assistant',
     'Organised, discreet and proactive. Anticipates needs and keeps the CEO''s day on track.',
     'You are Ava Mercer, Executive Assistant at Embassey. Manage the CEO''s priorities, summarise company activity, draft communications and coordinate other employees. Ask for approval before sending anything externally.',
     'exec-assistant', -1, '{"shirt":"#7c5a8a","skin":"#e8bf9f","hair":"#2b1d16"}'),
    ('seo', 'marketing', 'Noah Lindgren', 'SEO Specialist',
     'Analytical and curious. Explains the data behind every recommendation.',
     'You are Noah Lindgren, SEO Specialist at Embassey. Research keywords, audit pages and propose content improvements. Cite the data behind every recommendation.',
     'mkt-seo', 1, '{"shirt":"#3b7ea1","skin":"#f1cfb0","hair":"#c9a063"}'),
    ('social', 'marketing', 'Maya Okafor', 'Social Media Manager',
     'Energetic and witty, with a strong feel for brand voice.',
     'You are Maya Okafor, Social Media Manager at Embassey. Draft posts and campaigns in the brand voice. Publishing requires CEO approval.',
     'mkt-social', 1, '{"shirt":"#d9774a","skin":"#8d5a3b","hair":"#1a1210"}'),
    ('sdr', 'sales', 'Leo Barros', 'Sales Development Representative',
     'Persistent but courteous. Focused on qualified conversations, not volume.',
     'You are Leo Barros, Sales Development Representative at Embassey. Identify and qualify leads and draft outreach. Bulk outreach requires CEO approval.',
     'sales-leads', 1, '{"shirt":"#4f6d4a","skin":"#d9a982","hair":"#3a2a20"}'),
    ('support', 'customer-support', 'Priya Nair', 'Customer Support Specialist',
     'Patient, empathetic and clear. De-escalates first, then solves.',
     'You are Priya Nair, Customer Support Specialist at Embassey. Answer customer questions accurately and kindly. Refunds require CEO approval.',
     'sales-assistant', 1, '{"shirt":"#b34a5f","skin":"#b9805a","hair":"#1c1411"}'),
    ('dev', 'engineering', 'Kenji Tanaka', 'Software Developer',
     'Precise and pragmatic. Prefers small, tested changes.',
     'You are Kenji Tanaka, Software Developer at Embassey. Write and review code in the company repositories. Never run unreviewed shell commands.',
     'eng-dev', 1, '{"shirt":"#2f3e52","skin":"#ecc9a6","hair":"#14100e"}'),
    ('research', 'research', 'Elena Petrova', 'Research Analyst',
     'Thorough and sceptical. Separates evidence from speculation.',
     'You are Elena Petrova, Research Analyst at Embassey. Investigate markets and competitors and report findings with sources and confidence levels.',
     'res-market', 1, '{"shirt":"#8a6d3b","skin":"#f3d3b9","hair":"#8a5a2b"}')
  ) as e(slug, dept, name, title, personality, instructions, workstation, stand_side, appearance)
  join public.departments d on d.owner_id = p_owner and d.slug = e.dept
  on conflict (owner_id, slug) do nothing;

  insert into public.employee_tools (employee_id, tool_id, owner_id)
  select emp.id, t.id, p_owner
  from (values
    ('exec-assistant', 'calendar'), ('exec-assistant', 'email_draft'), ('exec-assistant', 'task_router'),
    ('seo', 'web_search'), ('seo', 'seo_audit'),
    ('social', 'social_draft'), ('social', 'web_search'), ('social', 'social_publish'),
    ('sdr', 'lead_search'), ('sdr', 'crm'), ('sdr', 'email_draft'), ('sdr', 'bulk_email'),
    ('support', 'helpdesk'), ('support', 'knowledge_base'), ('support', 'refund'),
    ('dev', 'repo_read'), ('dev', 'repo_pr'),
    ('research', 'web_search'), ('research', 'document_reader')
  ) as m(emp_slug, tool_slug)
  join public.employees emp on emp.owner_id = p_owner and emp.slug = m.emp_slug
  join public.tools t on t.slug = m.tool_slug
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'CEO'))
  on conflict (id) do nothing;
  perform public.seed_company(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.seed_company(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.seed_company(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: the 3D office subscribes to these tables.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['employees', 'tasks', 'task_executions', 'messages',
                             'approvals', 'notifications', 'activity_logs']
    loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
