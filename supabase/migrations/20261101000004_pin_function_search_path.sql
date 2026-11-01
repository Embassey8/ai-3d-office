-- Hardening flagged by the Supabase security advisor (function_search_path_mutable):
-- pin search_path on trigger helpers. All object references inside them are schema-qualified.
alter function public.set_updated_at()          set search_path = '';
alter function public.touch_status_changed()    set search_path = '';
alter function public.guard_task_update()       set search_path = '';
alter function public.guard_task_insert()       set search_path = '';
alter function public.stamp_approval_decision() set search_path = '';
