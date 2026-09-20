import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const USER_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const USER_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $fn$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users(id) values('${USER_A}'),('${USER_B}');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/001_stockflow.sql',import.meta.url),'utf8'));
 return db;
}
export async function asUser(db,user,fn) {
 return db.transaction(async tx=>{
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
  return fn(tx);
 });
}
export function rpc(db,user,name,payload) {
 if(!['save_product','save_category','move_stock','delete_product','delete_category'].includes(name))throw Error('Unknown RPC');
 return asUser(db,user,async tx=>(await tx.query(`select to_jsonb(public.${name}($1${name.startsWith('delete_')?'::uuid':'::jsonb'})) as result`,[typeof payload==='string'?payload:JSON.stringify(payload)])).rows[0].result);
}
export const product=(overrides={})=>({id:null,name:'Café especial',sku:'CAF-001',category_id:null,price:29.9,min_stock:5,description:'',...overrides});
