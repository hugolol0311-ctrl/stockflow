-- Execute uma única vez no SQL Editor de um projeto Supabase novo.
begin;
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique (user_id,name)
);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),
 sku text not null check(length(trim(sku)) between 1 and 40),
 category_id uuid references public.categories(id) on delete restrict,
 description text not null default '' check(length(description)<=1000),
 price numeric(11,2) not null default 0 check(price between 0 and 999999999.99),
 quantity integer not null default 0 check(quantity between 0 and 1000000000),
 min_stock integer not null default 0 check(min_stock between 0 and 1000000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique(user_id,sku)
);
create table public.movements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id),
 product_name text not null,
 product_sku text not null,
 type text not null check(type in ('IN','OUT')),
 quantity integer not null check(quantity>0),
 balance_after integer not null check(balance_after>=0),
 reason text not null check(length(trim(reason)) between 1 and 500),
 request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create index on public.products(user_id,created_at,id) where deleted_at is null;
create index on public.categories(user_id,created_at,id);
create index on public.movements(user_id,created_at desc,id desc);
create index on public.products(category_id);
create index on public.movements(product_id);
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.movements enable row level security;
create policy own_products on public.products for select to authenticated using(user_id=(select auth.uid()));
create policy own_categories on public.categories for select to authenticated using(user_id=(select auth.uid()));
create policy own_movements on public.movements for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.products,public.categories,public.movements from anon,authenticated;
grant select on public.products,public.categories,public.movements to authenticated;

-- Escritas somente por funções, sempre com propriedade verificada e search_path fixo.
create function public.save_category(payload jsonb) returns public.categories
language plpgsql security definer set search_path = '' as $$
declare result public.categories; cid uuid := (payload->>'id')::uuid; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'INVALID_SESSION'; end if;
 if cid is null then
  insert into public.categories(user_id,name) values(uid,trim(payload->>'name')) returning * into result;
 else
  update public.categories set name=trim(payload->>'name') where id=cid and user_id=uid returning * into result;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 return result;
end $$;
create function public.delete_category(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.categories where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.products where category_id=p_id) then raise exception 'CATEGORY_IN_USE'; end if;
 delete from public.categories where id=p_id and user_id=auth.uid();
 return jsonb_build_object('deleted',true);
end $$;
create function public.save_product(payload jsonb) returns public.products
language plpgsql security definer set search_path = '' as $$
declare result public.products; pid uuid := (payload->>'id')::uuid;
 cid uuid := (payload->>'category_id')::uuid; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'INVALID_SESSION'; end if;
 if cid is not null then
  perform 1 from public.categories where id=cid and user_id=uid for key share;
  if not found then raise exception 'INVALID_CATEGORY'; end if;
 end if;
 if pid is null then
  insert into public.products(user_id,name,sku,category_id,description,price,min_stock)
  values(uid,trim(payload->>'name'),upper(trim(payload->>'sku')),cid,coalesce(payload->>'description',''),(payload->>'price')::numeric,(payload->>'min_stock')::integer)
  returning * into result;
 else
  update public.products set name=trim(payload->>'name'),sku=upper(trim(payload->>'sku')),category_id=cid,
   description=coalesce(payload->>'description',''),price=(payload->>'price')::numeric,min_stock=(payload->>'min_stock')::integer,updated_at=now()
  where id=pid and user_id=uid and deleted_at is null returning * into result;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 return result;
end $$;
create function public.delete_product(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.products;
begin
 select * into p from public.products where id=p_id and user_id=auth.uid() and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p.quantity<>0 then raise exception 'PRODUCT_HAS_STOCK'; end if;
 update public.products set deleted_at=now(),updated_at=now(),category_id=null where id=p_id;
 return jsonb_build_object('deleted',true);
end $$;
create function public.move_stock(payload jsonb) returns public.movements
language plpgsql security definer set search_path = '' as $$
declare p public.products; result public.movements; uid uuid := auth.uid();
 pid uuid := (payload->>'product_id')::uuid; rid uuid := (payload->>'request_id')::uuid;
 qty integer := (payload->>'quantity')::integer; kind text := payload->>'type'; new_balance bigint;
begin
 if uid is null or pid is null or rid is null or qty is null or qty<=0 or qty>1000000000 or kind is null or kind not in ('IN','OUT')
  or payload->>'reason' is null or length(trim(payload->>'reason')) not between 1 and 500 then raise exception 'INVALID_MOVEMENT'; end if;
 -- Serializa repetições da mesma requisição; evita duplicação após timeout/reenvio.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || rid::text,0));
 select * into result from public.movements where user_id=uid and request_id=rid;
 if found then
  if result.product_id<>pid or result.quantity<>qty or result.type<>kind or result.reason<>trim(payload->>'reason') then raise exception 'INVALID_REQUEST_REUSE'; end if;
  return result;
 end if;
 select * into p from public.products where id=pid and user_id=uid and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 new_balance := p.quantity::bigint + case when kind='IN' then qty else -qty end;
 if new_balance<0 then raise exception 'INSUFFICIENT_STOCK'; end if;
 if new_balance>1000000000 then raise exception 'INVALID_BALANCE'; end if;
 update public.products set quantity=new_balance,updated_at=now() where id=pid;
 insert into public.movements(user_id,product_id,product_name,product_sku,type,quantity,balance_after,reason,request_id)
 values(uid,pid,p.name,p.sku,kind,qty,new_balance,trim(payload->>'reason'),rid) returning * into result;
 return result;
end $$;
revoke all on function public.save_category(jsonb),public.delete_category(uuid),public.save_product(jsonb),public.delete_product(uuid),public.move_stock(jsonb) from public,anon;
grant execute on function public.save_category(jsonb),public.delete_category(uuid),public.save_product(jsonb),public.delete_product(uuid),public.move_stock(jsonb) to authenticated;
commit;
