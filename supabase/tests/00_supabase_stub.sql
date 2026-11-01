-- Minimal stand-in for the parts of Supabase the migrations depend on.
-- ONLY for local testing against plain Postgres; real Supabase already provides all of this.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create publication supabase_realtime;

-- Stand-in for Supabase Vault. The real extension encrypts `secret` at rest; this stub stores plaintext
-- and exists ONLY so the migrations can be exercised on plain Postgres.
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(), name text, description text default '', secret text not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create or replace view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret), updated_at = now() where id = secret_id $$;
-- Like production, the Vault is not reachable by the API roles.
revoke all on schema vault from public;
