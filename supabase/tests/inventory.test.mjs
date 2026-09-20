import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,asUser,rpc,USER_A,USER_B,product} from '../../tests/support/database.mjs';
let db;
before(async()=>{db=await database();});after(async()=>{await db.close();});
const move=(id,type,quantity,overrides={})=>({product_id:id,type,quantity,reason:'Teste de inventário',request_id:randomUUID(),...overrides});
test('migração, entrada e saída atualizam saldo e histórico na mesma transação',async()=>{
 const p=await rpc(db,USER_A,'save_product',product());assert.equal(p.quantity,0);
 const incoming=await rpc(db,USER_A,'move_stock',move(p.id,'IN',10));assert.equal(incoming.balance_after,10);
 const outgoing=await rpc(db,USER_A,'move_stock',move(p.id,'OUT',4));assert.equal(outgoing.balance_after,6);
 const current=await asUser(db,USER_A,tx=>tx.query('select quantity from products where id=$1',[p.id]));assert.equal(current.rows[0].quantity,6);
 await assert.rejects(rpc(db,USER_A,'move_stock',move(p.id,'OUT',7)),/INSUFFICIENT_STOCK/);
 const rows=await asUser(db,USER_A,tx=>tx.query('select * from movements where product_id=$1',[p.id]));assert.equal(rows.rows.length,2);
});
test('RLS e RPC impedem leitura e modificação de outra conta',async()=>{
 const p=await rpc(db,USER_A,'save_product',product({sku:'PRIVATE'}));
 const result=await asUser(db,USER_B,tx=>tx.query('select * from products'));assert.equal(result.rows.length,0);
 await assert.rejects(rpc(db,USER_B,'save_product',product({id:p.id})),/NOT_FOUND/);
 await assert.rejects(rpc(db,USER_B,'delete_product',p.id),/NOT_FOUND/);
 await assert.rejects(rpc(db,USER_B,'move_stock',move(p.id,'IN',1)),/NOT_FOUND/);
 const category=await rpc(db,USER_A,'save_category',{id:null,name:'Privada'});
 await assert.rejects(rpc(db,USER_B,'save_product',product({sku:'ALIEN',category_id:category.id})),/INVALID_CATEGORY/);
 await assert.rejects(rpc(db,USER_B,'save_category',{id:category.id,name:'Alterada'}),/NOT_FOUND/);
 await assert.rejects(rpc(db,USER_B,'delete_category',category.id),/NOT_FOUND/);
 for(const table of ['categories','movements']) assert.equal((await asUser(db,USER_B,tx=>tx.query(`select * from ${table}`))).rows.length,0);
});
test('requisições repetidas são idempotentes; payload diferente é rejeitado',async()=>{
 const p=await rpc(db,USER_A,'save_product',product({sku:'IDEMPOTENT'}));const payload=move(p.id,'IN',7);
 const [a,b]=await Promise.all([rpc(db,USER_A,'move_stock',payload),rpc(db,USER_A,'move_stock',payload)]);
 assert.equal(a.id,b.id);assert.equal(b.balance_after,7);
 await assert.rejects(rpc(db,USER_A,'move_stock',{...payload,quantity:8}),/INVALID_REQUEST_REUSE/);
});
test('duas saídas disputando o saldo não produzem saldo negativo',async()=>{
 const p=await rpc(db,USER_A,'save_product',product({sku:'RACE'}));await rpc(db,USER_A,'move_stock',move(p.id,'IN',5));
 const results=await Promise.allSettled([rpc(db,USER_A,'move_stock',move(p.id,'OUT',4)),rpc(db,USER_A,'move_stock',move(p.id,'OUT',4))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await asUser(db,USER_A,tx=>tx.query('select quantity from products where id=$1',[p.id]))).rows[0].quantity,1);
});
test('escrita direta de saldo e alteração/exclusão de histórico são proibidas',async()=>{
 await assert.rejects(asUser(db,USER_A,tx=>tx.exec('update products set quantity=999')),/permission denied/);
 await assert.rejects(asUser(db,USER_A,tx=>tx.exec('delete from movements')),/permission denied/);
 await assert.rejects(asUser(db,USER_A,tx=>tx.exec("update movements set reason='fraude'")),/permission denied/);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select * from products');}),/permission denied/);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query("select public.save_category('{\"name\":\"test\"}')");}),/permission denied/);
});
test('exclusão exige saldo zero e preserva histórico e SKU',async()=>{
 const c=await rpc(db,USER_A,'save_category',{id:null,name:'Descartáveis'});
 const p=await rpc(db,USER_A,'save_product',product({sku:'ARCHIVE',category_id:c.id}));
 await assert.rejects(rpc(db,USER_A,'delete_category',c.id),/CATEGORY_IN_USE/);
 await rpc(db,USER_A,'move_stock',move(p.id,'IN',1));await assert.rejects(rpc(db,USER_A,'delete_product',p.id),/PRODUCT_HAS_STOCK/);
 await rpc(db,USER_A,'move_stock',move(p.id,'OUT',1));await rpc(db,USER_A,'delete_product',p.id);
 assert.equal((await asUser(db,USER_A,tx=>tx.query('select * from movements where product_id=$1',[p.id]))).rows.length,2);
 await assert.rejects(rpc(db,USER_A,'move_stock',move(p.id,'IN',1)),/NOT_FOUND/);
 await assert.rejects(rpc(db,USER_A,'save_product',product({sku:'ARCHIVE'})),/unique constraint/);
 await rpc(db,USER_A,'delete_category',c.id);
});
test('validação do banco rejeita quantidades inválidas, preço negativo e SKU duplicado',async()=>{
 const p=await rpc(db,USER_A,'save_product',product({sku:'VALIDATE'}));
 for(const quantity of [0,-1,1000000001])await assert.rejects(rpc(db,USER_A,'move_stock',move(p.id,'IN',quantity)),/INVALID_MOVEMENT/);
 await assert.rejects(rpc(db,USER_A,'move_stock',move(p.id,'IN',1,{reason:' '})),/INVALID_MOVEMENT/);
 await assert.rejects(rpc(db,USER_A,'save_product',product({sku:'NEGATIVE',price:-1})),/check constraint/);
 await assert.rejects(rpc(db,USER_A,'save_product',product({sku:'VALIDATE'})),/unique constraint/);
});
