import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const db=new PGlite();await db.exec('create role anon;create role authenticated;');
await db.exec(await readFile(new URL('../migrations/002_cloud_sessions.sql',import.meta.url),'utf8'));
const secret='local-test-only',id=randomUUID(),next=randomUUID();
await db.query('insert into stockflow_private.runtime_config values(1,$1)',[createHash('sha256').update(secret).digest('hex')]);
const call=(action,extra={})=>db.transaction(async t=>{
 await t.exec('set local role anon');
 return (await t.query("select public.stockflow_session($1,$2,$3,$4,$5,now(),now(),$6::jsonb,'{}') as data",[extra.secret??secret,action,extra.id??id,extra.old??null,extra.fresh??false,JSON.stringify(extra.attrs??{})])).rows[0].data;
});
await assert.rejects(call('get',{secret:'wrong'}),/INVALID_SESSION_STORE_KEY/);
await call('save',{fresh:true,attrs:{csrf:'ciphertext-a'}});
assert.equal((await call('get')).attributes.csrf,'ciphertext-a');
await call('save',{attrs:{auth:'ciphertext-b'}});assert.equal((await call('get')).attributes.csrf,'ciphertext-a');
await call('save',{id:next,old:id});assert.equal(await call('get'),null);assert.equal((await call('get',{id:next})).attributes.auth,'ciphertext-b');
await call('delete',{id:next});await call('save',{id:next,attrs:{auth:'stale'}});assert.equal(await call('get',{id:next}),null);
console.log('Cloud SQL: secret validation, encrypted attributes, merge, rotation and logout passed.');await db.close();
