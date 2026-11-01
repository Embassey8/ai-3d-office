-- Redesign: the team from design/DESIGN_SPEC.md §6 (Ada, Femi, Zara, Tobi, Nneka, Kai, Iris), their colours
-- and per-employee models (Opus / Sonnet / Haiku).
--  * seed_company() now seeds the new roster for new sign-ups.
--  * Existing seeded employees are updated ONLY where they still carry the old default name, so anything a
--    CEO renamed or reconfigured is left alone.

create or replace function public.seed_company(p_owner uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.departments (owner_id, slug, name, room_id) values
    (p_owner, 'executive',        'Executive',        'executive'),
    (p_owner, 'marketing',        'Marketing',        'marketing'),
    (p_owner, 'sales',            'Sales',            'sales'),
    (p_owner, 'customer-support', 'Customer Support', 'reception'),
    (p_owner, 'engineering',      'Engineering',      'engineering'),
    (p_owner, 'research',         'Research',         'research')
  on conflict (owner_id, slug) do nothing;

  insert into public.employees
    (owner_id, department_id, slug, name, title, personality, system_instructions,
     model_name, stand_side, appearance)
  select p_owner, d.id, e.slug, e.name, e.title, e.personality, e.instructions,
         e.model, 1, e.appearance::jsonb
  from (values
    ('exec-assistant', 'executive', 'Ada', 'Executive Assistant',
     'Organised, discreet and proactive. Anticipates needs and keeps the CEO''s day on track.',
     'You are Ada, Chief of Staff (Executive Assistant) at Embassey. Route the CEO''s requests to the right employee by creating tasks, summarise company activity and draft communications. Ask for approval before anything external.',
     'claude-opus-5-5', '{"shirt":"#2E3A5C","skin":"#e8bf9f","hair":"#2C1A12","avatar":"#D89A4A"}'),
    ('seo', 'marketing', 'Femi', 'SEO Specialist',
     'Analytical and curious. Explains the data behind every recommendation.',
     'You are Femi, SEO Specialist at Embassey. Research keywords, audit pages and propose content improvements. Cite the data behind every recommendation.',
     'claude-sonnet-5-5', '{"shirt":"#7FB7FF","skin":"#f1cfb0","hair":"#1A1311","avatar":"#B05BD0"}'),
    ('social', 'marketing', 'Zara', 'Social Media Manager',
     'Energetic and witty, with a strong feel for brand voice.',
     'You are Zara, Social Media Manager at Embassey. Draft posts and campaigns in the brand voice. Publishing requires CEO approval.',
     'claude-sonnet-5-5', '{"shirt":"#F2EEE8","skin":"#8d5a3b","hair":"#3A2216","avatar":"#D59AE8"}'),
    ('sdr', 'sales', 'Tobi', 'Sales Development Rep',
     'Persistent but courteous. Focused on qualified conversations, not volume.',
     'You are Tobi, Sales Development Representative at Embassey. Identify and qualify leads and draft outreach. Bulk outreach requires CEO approval.',
     'claude-sonnet-5-5', '{"shirt":"#F2C14E","skin":"#d9a982","hair":"#1E1410","avatar":"#D9574F"}'),
    ('support', 'customer-support', 'Nneka', 'Customer Support Specialist',
     'Patient, empathetic and clear. De-escalates first, then solves.',
     'You are Nneka, Customer Support Specialist at Embassey. Answer customer questions accurately and kindly. Refunds require CEO approval.',
     'claude-haiku-5-5', '{"shirt":"#E2E5EA","skin":"#b9805a","hair":"#2B1B14","avatar":"#8B8F98"}'),
    ('dev', 'engineering', 'Kai', 'Software Developer',
     'Precise and pragmatic. Prefers small, tested changes.',
     'You are Kai, Software Developer at Embassey. Write and review code in the company repositories. Never run unreviewed shell commands.',
     'claude-opus-5-5', '{"shirt":"#3B4256","skin":"#ecc9a6","hair":"#121212","avatar":"#3FA56B"}'),
    ('research', 'research', 'Iris', 'Research Analyst',
     'Thorough and sceptical. Separates evidence from speculation.',
     'You are Iris, Research Analyst at Embassey. Investigate markets and competitors and report findings with sources and confidence levels.',
     'claude-opus-5-5', '{"shirt":"#E9E4F5","skin":"#f3d3b9","hair":"#8A4B2A","avatar":"#4C7BD9"}')
  ) as e(slug, dept, name, title, personality, instructions, model, appearance)
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

revoke all on function public.seed_company(uuid) from public, anon, authenticated;
grant execute on function public.seed_company(uuid) to service_role;

-- Re-map the customer-support department to the Reception room (the design puts Nneka in Reception).
update public.departments set room_id = 'reception' where slug = 'customer-support';

-- Existing seeded employees: update only those still carrying the old default name.
update public.employees e
   set name = n.name, title = n.title, system_instructions = n.instructions, model_name = n.model, appearance = n.appearance::jsonb
  from (values
    ('exec-assistant', 'Ava Mercer',    'Ada',   'Executive Assistant',   'You are Ada, Chief of Staff (Executive Assistant) at Embassey. Route the CEO''s requests to the right employee by creating tasks, summarise company activity and draft communications. Ask for approval before anything external.', 'claude-opus-5-5',   '{"shirt":"#2E3A5C","skin":"#e8bf9f","hair":"#2C1A12","avatar":"#D89A4A"}'),
    ('seo',            'Noah Lindgren', 'Femi',  'SEO Specialist',        'You are Femi, SEO Specialist at Embassey. Research keywords, audit pages and propose content improvements. Cite the data behind every recommendation.', 'claude-sonnet-5-5', '{"shirt":"#7FB7FF","skin":"#f1cfb0","hair":"#1A1311","avatar":"#B05BD0"}'),
    ('social',         'Maya Okafor',   'Zara',  'Social Media Manager',  'You are Zara, Social Media Manager at Embassey. Draft posts and campaigns in the brand voice. Publishing requires CEO approval.', 'claude-sonnet-5-5', '{"shirt":"#F2EEE8","skin":"#8d5a3b","hair":"#3A2216","avatar":"#D59AE8"}'),
    ('sdr',            'Leo Barros',    'Tobi',  'Sales Development Rep', 'You are Tobi, Sales Development Representative at Embassey. Identify and qualify leads and draft outreach. Bulk outreach requires CEO approval.', 'claude-sonnet-5-5', '{"shirt":"#F2C14E","skin":"#d9a982","hair":"#1E1410","avatar":"#D9574F"}'),
    ('support',        'Priya Nair',    'Nneka', 'Customer Support Specialist', 'You are Nneka, Customer Support Specialist at Embassey. Answer customer questions accurately and kindly. Refunds require CEO approval.', 'claude-haiku-5-5',  '{"shirt":"#E2E5EA","skin":"#b9805a","hair":"#2B1B14","avatar":"#8B8F98"}'),
    ('dev',            'Kenji Tanaka',  'Kai',   'Software Developer',    'You are Kai, Software Developer at Embassey. Write and review code in the company repositories. Never run unreviewed shell commands.', 'claude-opus-5-5',   '{"shirt":"#3B4256","skin":"#ecc9a6","hair":"#121212","avatar":"#3FA56B"}'),
    ('research',       'Elena Petrova', 'Iris',  'Research Analyst',      'You are Iris, Research Analyst at Embassey. Investigate markets and competitors and report findings with sources and confidence levels.', 'claude-opus-5-5',   '{"shirt":"#E9E4F5","skin":"#f3d3b9","hair":"#8A4B2A","avatar":"#4C7BD9"}')
  ) as n(slug, old_name, name, title, instructions, model, appearance)
 where e.slug = n.slug and e.name = n.old_name;
