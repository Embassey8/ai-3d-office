-- Per-CEO API keys entered in Settings, stored encrypted in Supabase Vault.
--  * The browser can SET or DELETE its own keys and read only metadata (name, last4, updated_at).
--  * Nothing but the server (service_role) can read a key's value.
--  * The key allow-list is enforced here, not just in the UI.

create table public.user_secrets (
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (name in ('anthropic_api_key')),
  vault_secret_id  uuid not null,
  last4            text not null check (char_length(last4) = 4),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (owner_id, name)
);

alter table public.user_secrets enable row level security;
create policy user_secrets_select on public.user_secrets for select to authenticated
  using (owner_id = (select auth.uid()));

-- Metadata only; vault_secret_id is never exposed to the browser.
revoke all on public.user_secrets from anon, authenticated;
grant select (owner_id, name, last4, created_at, updated_at) on public.user_secrets to authenticated;

create trigger user_secrets_updated_at before update on public.user_secrets
  for each row execute function public.set_updated_at();

-- Remove the encrypted value whenever the metadata row goes away (including user deletion cascades).
create or replace function public.drop_vault_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$$;
create trigger user_secrets_drop_vault after delete on public.user_secrets
  for each row execute function public.drop_vault_secret();

create or replace function public.set_my_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  existing uuid;
  sid uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_name not in ('anthropic_api_key') then raise exception 'Unknown secret name' using errcode = '22023'; end if;
  if p_value is null or char_length(p_value) < 20 or char_length(p_value) > 400 or p_value ~ '\s' then
    raise exception 'That does not look like a valid API key' using errcode = '22023';
  end if;

  select vault_secret_id into existing from public.user_secrets where owner_id = uid and name = p_name;
  if existing is null then
    sid := vault.create_secret(p_value, 'user:' || uid::text || ':' || p_name, 'Embassey AI HQ user secret');
    insert into public.user_secrets (owner_id, name, vault_secret_id, last4)
      values (uid, p_name, sid, right(p_value, 4));
  else
    perform vault.update_secret(existing, p_value);
    update public.user_secrets set last4 = right(p_value, 4) where owner_id = uid and name = p_name;
  end if;
end;
$$;

create or replace function public.delete_my_secret(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  delete from public.user_secrets where owner_id = auth.uid() and name = p_name;  -- trigger removes the vault row
end;
$$;

-- Server-side read of a decrypted value. service_role only.
create or replace function public.get_secret(p_owner uuid, p_name text)
returns text language sql stable security definer set search_path = '' as $$
  select ds.decrypted_secret
    from public.user_secrets us
    join vault.decrypted_secrets ds on ds.id = us.vault_secret_id
   where us.owner_id = p_owner and us.name = p_name;
$$;

revoke all on function public.set_my_secret(text, text), public.delete_my_secret(text), public.get_secret(uuid, text),
                       public.drop_vault_secret() from public, anon, authenticated;
grant execute on function public.set_my_secret(text, text), public.delete_my_secret(text) to authenticated;
grant execute on function public.get_secret(uuid, text) to service_role;
