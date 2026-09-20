// Test double local: não é um servidor de autenticação para produção.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {database,asUser,rpc,USER_A,product} from './database.mjs';
const db=await database();
const categories=[];
for(const name of ['Alimentos e bebidas','Escritório','Embalagens'])categories.push(await rpc(db,USER_A,'save_category',{id:null,name}));
const fixtures=[['Café especial 250g','CAF-001',29.9,20,12,0],['Caneca de cerâmica','CAN-002',42,10,32,1],['Caderno pontilhado','CAD-003',34.9,8,46,1],['Caixa kraft média','CX-004',4.5,25,8,2],['Chá de camomila','CHA-005',18.9,10,0,0],['Sacola ecológica','SAC-006',9.9,15,65,2]];
for(const [name,sku,price,min_stock,quantity,category] of fixtures) {
 const p=await rpc(db,USER_A,'save_product',product({name,sku,price,min_stock,category_id:categories[category].id}));
 if(quantity) {
  const entry=await rpc(db,USER_A,'move_stock',{product_id:p.id,type:'IN',quantity:quantity+5,reason:'Recebimento do fornecedor',request_id:randomUUID()});
  const exit=await rpc(db,USER_A,'move_stock',{product_id:p.id,type:'OUT',quantity:5,reason:'Pedido de cliente',request_id:randomUUID()});
  await db.query("update movements set created_at=now()-($1 * interval '1 day') where id=$2",[fixtures.findIndex(f=>f[1]===sku),entry.id]);
  await db.query("update movements set created_at=now()-($1 * interval '1 day') where id=$2",[Math.max(0,fixtures.findIndex(f=>f[1]===sku)-1),exit.id]);
 }
}
const token=()=>({access_token:'test-only-access',refresh_token:'test-only-refresh',expires_in:3600,user:{id:USER_A,email:'portfolio@example.com'}});
createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 const url=new URL(req.url,'http://127.0.0.1:54329');
 let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null;
 try {
  if(url.pathname==='/health')return res.end('{}');
  if(url.pathname==='/auth/v1/token') {
   if((body?.email==='portfolio@example.com'&&body?.password==='test-password-123')||body?.refresh_token==='test-only-refresh')return res.end(JSON.stringify(token()));
   res.statusCode=400;return res.end(JSON.stringify({error_code:'invalid_credentials'}));
  }
  if(url.pathname==='/auth/v1/signup')return res.end('{}');
  if(req.headers.authorization!=='Bearer test-only-access'){res.statusCode=401;return res.end('{}');}
  if(url.pathname==='/auth/v1/logout')return res.end('{}');
  if(url.pathname.startsWith('/rest/v1/rpc/'))return res.end(JSON.stringify(await rpc(db,USER_A,url.pathname.split('/').pop(),body.payload??body.p_id)));
  const table=url.pathname.split('/').pop();if(!['products','categories','movements'].includes(table))throw Error('Unknown table');
  const rows=await asUser(db,USER_A,tx=>tx.query(`select * from ${table} ${table==='products'?'where deleted_at is null':''} order by created_at ${table==='movements'?'desc':'asc'},id ${table==='movements'?'desc':'asc'} limit 500 offset $1`,[Number(url.searchParams.get('offset'))||0]));
  res.end(JSON.stringify(rows.rows));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({message:e.message,code:e.code}));}
}).listen(54329,'127.0.0.1',()=>console.log('Supabase test double ready on 127.0.0.1:54329'));
