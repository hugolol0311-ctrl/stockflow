-- Shared server-only session persistence for Vercel. No plaintext tokens are stored.
begin;
create schema if not exists stockflow_private;
revoke all on schema stockflow_private from public,anon,authenticated;
create table stockflow_private.runtime_config (
 id integer primary key check(id=1),
 secret_sha256 text not null check(length(secret_sha256)=64)
);
create table stockflow_private.http_sessions (
 id uuid primary key,
 attributes jsonb not null default '{}'::jsonb,
 created_at timestamptz not null,
 last_accessed_at timestamptz not null,
 expires_at timestamptz not null
);
create index on stockflow_private.http_sessions(expires_at);
alter table stockflow_private.runtime_config enable row level security;
alter table stockflow_private.http_sessions enable row level security;
revoke all on stockflow_private.runtime_config,stockflow_private.http_sessions from public,anon,authenticated;
create function public.stockflow_session(
 p_secret text,p_action text,p_id uuid,p_old_id uuid default null,p_new boolean default false,
 p_created_at timestamptz default null,p_accessed_at timestamptz default null,
 p_attributes jsonb default '{}'::jsonb,p_removed text[] default '{}'::text[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; old_session stockflow_private.http_sessions;
begin
 if p_secret is null or not exists(select 1 from stockflow_private.runtime_config where id=1 and secret_sha256=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_secret,'UTF8')),'hex')) then
  raise exception 'INVALID_SESSION_STORE_KEY' using errcode='42501';
 end if;
 if p_action='get' then
  select to_jsonb(s) into result from stockflow_private.http_sessions s where id=p_id and expires_at>now();return result;
 elsif p_action='delete' then
  delete from stockflow_private.http_sessions where id=p_id;return '{}'::jsonb;
 elsif p_action<>'save' then raise exception 'INVALID_ACTION'; end if;
 if p_id is null or p_created_at is null or p_accessed_at is null or p_accessed_at>now()+interval '1 minute' or jsonb_typeof(p_attributes)<>'object' or length(p_attributes::text)>131072 then raise exception 'INVALID_SESSION';end if;
 delete from stockflow_private.http_sessions where expires_at<=now();
 if p_old_id is not null and p_old_id<>p_id then
  select * into old_session from stockflow_private.http_sessions where id=p_old_id for update;
  if not found then return null; end if;
  insert into stockflow_private.http_sessions(id,attributes,created_at,last_accessed_at,expires_at)
  values(p_id,(old_session.attributes||p_attributes)-p_removed,old_session.created_at,p_accessed_at,p_accessed_at+interval '8 hours');
  delete from stockflow_private.http_sessions where id=p_old_id;
 elsif p_new then
  insert into stockflow_private.http_sessions(id,attributes,created_at,last_accessed_at,expires_at)
  values(p_id,p_attributes-p_removed,p_created_at,p_accessed_at,p_accessed_at+interval '8 hours');
 else
  update stockflow_private.http_sessions set attributes=(attributes||p_attributes)-p_removed,
   last_accessed_at=greatest(last_accessed_at,p_accessed_at),expires_at=greatest(last_accessed_at,p_accessed_at)+interval '8 hours' where id=p_id;
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.stockflow_session(text,text,uuid,uuid,boolean,timestamptz,timestamptz,jsonb,text[]) from public,anon,authenticated;
-- The separate server secret is always checked before any read or write.
grant execute on function public.stockflow_session(text,text,uuid,uuid,boolean,timestamptz,timestamptz,jsonb,text[]) to anon;
commit;
