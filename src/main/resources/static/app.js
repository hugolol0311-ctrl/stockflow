'use strict';
// A confirmação por e-mail pode devolver tokens no fragmento. O BFF usa somente sua sessão.
if(location.hash.includes('access_token=')) history.replaceState(null,'',location.pathname+location.search);
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(value);
const number = value => new Intl.NumberFormat('pt-BR').format(value);
const date = value => new Date(value).toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short'});
const localDay = value => { const d=new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const state = {page:'dashboard',products:[],categories:[],movements:[],filter:'',category:'',status:'',type:'',from:'',to:'',index:1,loaded:false};
let csrf, signup=false, modalAction, saving=false, toastTimer, generation=0;
class ApiError extends Error { constructor(message,status) { super(message); this.status=status; } }
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,6500); }
async function getCsrf() { const r=await fetch('/api/auth/csrf',{cache:'no-store'}); if(!r.ok) throw new Error('Não foi possível conectar ao servidor.'); csrf=await r.json(); }
async function api(path,method='GET',body) {
 if(!csrf) await getCsrf();
 const headers={'Content-Type':'application/json'};
 if(method!=='GET') headers[csrf.headerName]=csrf.token;
 let r;
 try { r=await fetch('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'}); }
 catch { throw new ApiError('Sem conexão. Confira sua internet e tente novamente.',0); }
 const data=await r.json().catch(()=>({}));
 if(!r.ok) {
  if(r.status===401 && path!=='/auth/login') showLogin();
  if(r.status===403) csrf=null;
  throw new ApiError(data.message || (r.status===403?'Sessão de segurança atualizada. Tente novamente.':'Não foi possível concluir a operação.'),r.status);
 }
 return data;
}
function showLogin() { generation++; $('#app').hidden=true; $('#login-screen').hidden=false; if($('#modal').open) $('#modal').close(); state.products=[];state.categories=[];state.movements=[];state.loaded=false;$('#page-content').replaceChildren();csrf=null; }
async function enter(user) {
 $('#user-email').textContent=user.email; $('#user-email').title=user.email; $('#avatar').textContent=(user.email||'S')[0].toUpperCase();
 $('#auth-form').reset();$('#auth-error').textContent='';$('#login-screen').hidden=true;$('#app').hidden=false;
 state.page='dashboard'; await reload();
}
async function all(path) {
 const rows=[];
 for(let offset=0;;offset+=500) { const batch=await api(path+'?offset='+offset); if(!Array.isArray(batch)) throw new Error('Resposta inesperada do servidor.'); rows.push(...batch); if(batch.length<500) return rows; }
}
async function reload() {
 const ticket=++generation; $('#refresh').disabled=true;$('#load-error').hidden=true;
 if(!state.loaded) $('#page-content').innerHTML='<div class="loading">Carregando seu espaço de trabalho…</div>';
 try {
  const [products,categories,movements]=await Promise.all([all('/products'),all('/categories'),all('/movements')]);
  if(ticket!==generation) return;
  Object.assign(state,{products,categories,movements,loaded:true});renderPage();
  $('#updated-at').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
 } catch(e) { if(ticket===generation) { $('#load-error').textContent=e.message+' Use o botão de atualizar para tentar novamente.';$('#load-error').hidden=false; if(!state.loaded) $('#page-content').innerHTML='<div class="empty"><strong>Seus dados ainda não carregaram.</strong>Verifique a conexão e a configuração do Supabase.</div>'; } }
 finally { $('#refresh').disabled=false; }
}
const categoryName = id => state.categories.find(c=>c.id===id)?.name || 'Sem categoria';
const isLow = p => p.quantity<=p.min_stock;
const badge = p => `<span class="badge ${p.quantity===0?'zero':isLow(p)?'low':'good'}">${p.quantity===0?'Sem estoque':isLow(p)?'Estoque baixo':'Em dia'}</span>`;
function empty(title,subtitle) { return `<div class="empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(subtitle)}</div>`; }
function productTable(rows,actions=true) {
 if(!rows.length) return empty('Nenhum produto encontrado','Cadastre um produto ou ajuste os filtros para continuar.');
 return `<div class="table-wrap"><table><thead><tr><th>PRODUTO / SKU</th><th>CATEGORIA</th><th>ESTOQUE</th><th>PREÇO UNIT.</th><th>STATUS</th>${actions?'<th>AÇÕES</th>':''}</tr></thead><tbody>${rows.map(p=>`<tr><td><div class="product-cell"><span class="product-icon">▦</span><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.sku)}</small></div></div></td><td>${escapeHtml(categoryName(p.category_id))}</td><td class="numeric"><strong>${number(p.quantity)}</strong> un.<br><small>Mín. ${number(p.min_stock)}</small></td><td class="numeric">${money(p.price)}</td><td>${badge(p)}</td>${actions?`<td><div class="table-actions"><button data-edit-product="${p.id}" aria-label="Editar ${escapeHtml(p.name)}">Editar</button><button class="delete" data-delete-product="${p.id}" aria-label="Excluir ${escapeHtml(p.name)}">Excluir</button></div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function movementTable(rows) {
 if(!rows.length) return empty('Tudo pronto para o primeiro movimento','As entradas e saídas aparecerão aqui, com data, motivo e saldo.');
 return `<div class="table-wrap"><table><thead><tr><th>PRODUTO</th><th>MOVIMENTO</th><th>QUANTIDADE</th><th>SALDO APÓS</th><th>MOTIVO</th><th>DATA</th></tr></thead><tbody>${rows.map(m=>`<tr><td><div class="product-cell"><span class="product-icon">${m.type==='IN'?'↙':'↗'}</span><div><strong>${escapeHtml(m.product_name)}</strong><small>${escapeHtml(m.product_sku)}</small></div></div></td><td><span class="badge ${m.type==='IN'?'good':'low'}">${m.type==='IN'?'↙ Entrada':'↗ Saída'}</span></td><td class="numeric ${m.type==='IN'?'movement-in':'movement-out'}">${m.type==='IN'?'+':'−'}${number(m.quantity)}</td><td class="numeric">${number(m.balance_after)} un.</td><td>${escapeHtml(m.reason)}</td><td class="numeric">${date(m.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
function dashboard() {
 const alerts=state.products.filter(isLow).sort((a,b)=>a.quantity-b.quantity);
 const total=state.products.reduce((n,p)=>n+p.quantity,0), value=state.products.reduce((n,p)=>n+p.quantity*Number(p.price),0);
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {key:localDay(d),label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),incoming:0,outgoing:0};});
 for(const m of state.movements) { const d=days.find(d=>d.key===localDay(m.created_at)); if(d) d[m.type==='IN'?'incoming':'outgoing']+=m.quantity; }
 const max=Math.max(1,...days.flatMap(d=>[d.incoming,d.outgoing]));
 const chart=`<svg viewBox="0 0 560 155" width="100%" height="160" role="img" aria-label="Entradas e saídas dos últimos sete dias">${days.map((d,i)=>{const hi=d.incoming/max*135,ho=d.outgoing/max*135;return `<g><title>${escapeHtml(d.label)}: ${d.incoming} entradas, ${d.outgoing} saídas</title><rect x="${i*80+20}" y="${150-hi}" width="18" height="${hi}" rx="3" fill="#285d49"/><rect x="${i*80+43}" y="${150-ho}" width="18" height="${ho}" rx="3" fill="#d6e7ba"/></g>`;}).join('')}</svg>`;
 return `<div class="stats"><article class="stat-card"><div class="stat-top">Produtos cadastrados<span class="stat-icon">▦</span></div><strong class="stat-value">${number(state.products.length)}</strong><span class="stat-foot">Itens ativos no seu catálogo</span></article><article class="stat-card featured"><div class="stat-top">Valor em estoque<span class="stat-icon">↗</span></div><strong class="stat-value">${money(value)}</strong><span class="stat-foot">Quantidade × preço cadastrado</span></article><article class="stat-card"><div class="stat-top">Unidades em estoque<span class="stat-icon">▥</span></div><strong class="stat-value">${number(total)}</strong><span class="stat-foot">Disponíveis para o próximo passo</span></article><article class="stat-card warning"><div class="stat-top">Precisam de atenção<span class="stat-icon">◉</span></div><strong class="stat-value">${number(alerts.length)}</strong><span class="stat-foot">Produtos no mínimo ou abaixo</span></article></div>
 <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Ritmo do estoque</h2><p>Unidades movimentadas · últimos 7 dias</p></div><div class="legend"><span><i></i>Entradas</span><span><i class="out"></i>Saídas</span></div></div><div class="chart">${chart}</div><div class="chart-labels">${days.map(d=>`<span>${d.label}</span>`).join('')}</div></section><section class="panel"><div class="panel-heading"><div><h2>De olho na reposição</h2><p>Um cuidado agora evita uma falta depois.</p></div><button class="subtle-button" data-goto="alerts">Ver todos ↗</button></div><div class="alert-list">${alerts.length?alerts.slice(0,3).map(p=>`<div class="alert-row"><span class="product-icon">▦</span><div class="alert-info"><strong>${escapeHtml(p.name)}</strong><small>${number(p.quantity)} restantes · mínimo ${number(p.min_stock)}</small></div>${badge(p)}</div>`).join(''):empty('Estoque sob controle','Nenhum produto precisa de reposição.')}</div></section></div>
 <section class="panel"><div class="panel-heading"><div><h2>Últimas movimentações</h2><p>Cada entrada e saída, registrada.</p></div><button class="subtle-button" data-goto="movements">Ver histórico completo ↗</button></div>${movementTable(state.movements.slice(0,5))}</section>`;
}
function categoryOptions(selected='') { return '<option value="">Sem categoria</option>'+state.categories.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${escapeHtml(c.name)}</option>`).join(''); }
function renderPage() {
 const titles={dashboard:['Visão geral','Um olhar completo sobre o que entra, sai e fica.'],products:['Produtos','Seu catálogo organizado. Cada detalhe no lugar.'],categories:['Categorias','Organize os produtos do jeito que faz sentido para você.'],movements:['Movimentações','A história do seu estoque, movimento por movimento.'],alerts:['Alertas de estoque','Antecipe a reposição e mantenha seu negócio em movimento.']};
 const [title,subtitle]=titles[state.page];$('#page-title').innerHTML=title+'<span>.</span>';$('#page-subtitle').textContent=subtitle;$('#breadcrumb-page').textContent=title;
 document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===state.page);if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#nav-alert-count').textContent=state.products.filter(isLow).length;
 if(!state.loaded) return;
 if(state.page==='dashboard') { $('#page-content').innerHTML=dashboard();return; }
 if(state.page==='categories') {
  $('#page-content').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>${state.categories.length} categorias</h2><p>Uma organização simples para encontrar tudo.</p></div><button class="button secondary" data-new-category>＋ Nova categoria</button></div></section><div class="category-grid">${state.categories.map(c=>`<article class="category-card"><span class="product-icon">◇</span><h3>${escapeHtml(c.name)}</h3><p>${state.products.filter(p=>p.category_id===c.id).length} produtos vinculados</p><div class="table-actions"><button data-edit-category="${c.id}">Editar</button><button class="delete" data-delete-category="${c.id}">Excluir</button></div></article>`).join('')}</div>${state.categories.length?'':empty('Um catálogo mais organizado começa aqui','Crie sua primeira categoria para agrupar os produtos.')}`;return;
 }
 const movements=state.page==='movements';
 $('#page-content').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>${movements?'Histórico de movimentações':state.page==='alerts'?'Produtos para repor':'Todos os produtos'}</h2><p id="result-count"></p></div></div><div class="toolbar"><input aria-label="Buscar por nome ou SKU" type="search" id="search" placeholder="Buscar por nome ou SKU…" value="${escapeHtml(state.filter)}">${movements?`<select id="filter-type" aria-label="Tipo de movimento"><option value="">Todos os movimentos</option><option value="IN">Entradas</option><option value="OUT">Saídas</option></select><label>De<input type="date" id="filter-from" value="${state.from}"></label><label>Até<input type="date" id="filter-to" value="${state.to}"></label>`:`<select id="filter-category" aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${state.categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>${state.page==='products'?'<select id="filter-status" aria-label="Filtrar status"><option value="">Todos os status</option><option value="good">Em dia</option><option value="low">Estoque baixo</option><option value="zero">Sem estoque</option></select>':''}`}</div><div id="listing"></div></section>`;
 if($('#filter-category')) $('#filter-category').value=state.category;
 if($('#filter-status')) $('#filter-status').value=state.status;
 if($('#filter-type')) $('#filter-type').value=state.type;
 renderListing();
}
function renderListing() {
 const query=state.filter.toLocaleLowerCase('pt-BR');let rows;
 if(state.page==='movements') rows=state.movements.filter(m=>(m.product_name+' '+m.product_sku).toLocaleLowerCase('pt-BR').includes(query)&&(!state.type||m.type===state.type)&&(!state.from||localDay(m.created_at)>=state.from)&&(!state.to||localDay(m.created_at)<=state.to));
 else rows=state.products.filter(p=>(p.name+' '+p.sku).toLocaleLowerCase('pt-BR').includes(query)&&(!state.category||p.category_id===state.category)&&(state.page!=='alerts'||isLow(p))&&(!state.status||(state.status==='good'&&!isLow(p))||(state.status==='low'&&isLow(p)&&p.quantity>0)||(state.status==='zero'&&p.quantity===0)));
 const pages=Math.max(1,Math.ceil(rows.length/10));state.index=Math.min(state.index,pages);
 $('#result-count').textContent=state.page==='movements'?`${number(rows.length)} ${rows.length===1?'movimentação encontrada':'movimentações encontradas'}`:`${number(rows.length)} ${rows.length===1?'produto encontrado':'produtos encontrados'}`;
 const current=rows.slice((state.index-1)*10,state.index*10);
 $('#listing').innerHTML=(state.page==='movements'?movementTable(current):productTable(current))+`<div class="pagination"><span>${rows.length?`${(state.index-1)*10+1}–${Math.min(state.index*10,rows.length)} de ${number(rows.length)}`:'Nenhum resultado'}</span><div><button data-prev ${state.index===1?'disabled':''} aria-label="Página anterior">←</button><span>${state.index} / ${pages}</span><button data-next ${state.index===pages?'disabled':''} aria-label="Próxima página">→</button></div></div>`;
}
function navigate(page) { Object.assign(state,{page,filter:'',category:'',status:'',type:'',from:'',to:'',index:1});renderPage(); }
function openModal(title,fields,action,label='Salvar') {
 $('#modal-title').textContent=title;$('#modal-fields').innerHTML=fields;$('#modal-error').textContent='';$('#save-modal').textContent=label;$('#save-modal').classList.toggle('danger',label==='Excluir');modalAction=action;$('#modal').showModal();
}
function productModal(id) {
 if(!state.loaded) return toast('Aguarde o carregamento dos dados.');
 const p=state.products.find(p=>p.id===id)||{name:'',sku:'',price:'',min_stock:0,description:''};
 openModal(id?'Editar produto':'Novo produto',`<label>Nome do produto<input name="name" required maxlength="120" value="${escapeHtml(p.name)}" placeholder="Ex.: Café especial 250g"></label><div class="form-grid"><label>SKU / código<input name="sku" required maxlength="40" value="${escapeHtml(p.sku)}" placeholder="CAF-001"></label><label>Categoria<select name="category_id">${categoryOptions(p.category_id)}</select></label></div><div class="form-grid"><label>Preço unitário (R$)<input name="price" type="number" step="0.01" min="0" max="999999999.99" required value="${p.price}"></label><label>Estoque mínimo (un.)<input name="min_stock" type="number" step="1" min="0" max="1000000000" required value="${p.min_stock}"></label></div><label>Descrição <small>(opcional)</small><textarea name="description" maxlength="1000">${escapeHtml(p.description)}</textarea></label><p class="form-hint">O saldo é atualizado pelas entradas e saídas. Produtos novos começam com zero unidades.</p>`,async data=> { await api('/products','POST',{...data,id:id||null,category_id:data.category_id||null,price:Number(data.price),min_stock:Number(data.min_stock)});return 'Produto salvo com sucesso.'; });
}
function categoryModal(id) {
 const c=state.categories.find(c=>c.id===id);
 openModal(c?'Editar categoria':'Nova categoria',`<label>Nome da categoria<input name="name" required maxlength="80" value="${escapeHtml(c?.name||'')}" placeholder="Ex.: Alimentos e bebidas"></label>`,async data=>{await api('/categories','POST',{...data,id:id||null});return 'Categoria salva com sucesso.';});
}
function movementModal() {
 if(!state.products.length) return toast('Cadastre um produto antes de registrar movimentações.');
 let requestId=crypto.randomUUID(), previousPayload;
 openModal('Registrar movimento',`<label>Produto<select name="product_id" required>${state.products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${escapeHtml(p.sku)} (${number(p.quantity)} un.)</option>`).join('')}</select></label><div class="form-grid"><label>Tipo<select name="type"><option value="IN">↙ Entrada de estoque</option><option value="OUT">↗ Saída de estoque</option></select></label><label>Quantidade (un.)<input type="number" name="quantity" min="1" max="1000000000" step="1" required placeholder="0"></label></div><label>Motivo<textarea name="reason" required maxlength="500" placeholder="Ex.: Compra de fornecedor, venda ou ajuste de inventário"></textarea></label><p class="form-hint">O movimento fica no histórico. Para corrigir um lançamento, registre o movimento inverso e informe o motivo.</p>`,async data=>{
  const signature=JSON.stringify(data);if(previousPayload&&previousPayload!==signature) requestId=crypto.randomUUID();previousPayload=signature;
  await api('/movements','POST',{...data,quantity:Number(data.quantity),request_id:requestId});return 'Movimento registrado com sucesso.';
 },'Registrar movimento');
}
function confirmDelete(kind,id) {
 const p=(kind==='products'?state.products:state.categories).find(p=>p.id===id);if(!p)return;
 openModal('Excluir '+(kind==='products'?'produto':'categoria'),`<p class="confirm-copy">Deseja excluir <strong>${escapeHtml(p.name)}</strong>?</p><p class="form-hint">${kind==='products'?'O produto precisa estar com saldo zero. Seu histórico será preservado e o SKU permanecerá reservado.':'Categorias com produtos vinculados não podem ser excluídas.'}</p>`,async()=>{await api('/'+kind+'/'+id,'DELETE');return 'Registro excluído com sucesso.';},'Excluir');
}
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();$('#auth-error').textContent='';$('#auth-submit').disabled=true;$('#auth-toggle').disabled=true;
 try { const data=Object.fromEntries(new FormData(e.target)); if(signup) {const result=await api('/auth/signup','POST',data);toast(result.message);$('#auth-form').reset();setAuthMode(false);} else await enter(await api('/auth/login','POST',data)); }
 catch(e) {$('#auth-error').textContent=e.message;}
 finally {$('#auth-submit').disabled=false;$('#auth-toggle').disabled=false;}
});
function setAuthMode(value) { signup=value;$('#auth-title').textContent=value?'Comece a organizar.':'Bom ter você aqui.';$('#auth-subtitle').textContent=value?'Crie sua conta e dê o próximo passo.':'Entre para acompanhar o seu negócio.';$('#auth-submit').textContent=value?'Criar minha conta ↗':'Entrar na minha conta ↗';$('#auth-toggle').textContent=value?'Já tem conta? Entrar':'Ainda não tem conta? Cadastre-se';$('#auth-form [name=password]').autocomplete=value?'new-password':'current-password';$('#auth-error').textContent=''; }
$('#auth-toggle').addEventListener('click',()=>setAuthMode(!signup));
$('#logout').addEventListener('click',async()=>{ $('#logout').disabled=true;try {const result=await api('/auth/logout','POST');showLogin();toast(result.message);}catch(e){toast(e.message);}finally{$('#logout').disabled=false;} });
$('#refresh').addEventListener('click',reload);
$('#open-product').addEventListener('click',()=>productModal());$('#open-movement').addEventListener('click',movementModal);
function closeModal(){if(!saving)$('#modal').close();}
$('#close-modal').addEventListener('click',closeModal);$('#cancel-modal').addEventListener('click',closeModal);$('#modal').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('#modal-form').addEventListener('submit',async e=>{
 e.preventDefault();if(saving)return;saving=true;$('#modal-error').textContent='';
 const data=Object.fromEntries(new FormData(e.target));
 const controls=[...$('#modal').querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);
 try {const message=await modalAction(data);$('#modal').close();toast(message);await reload();}
 catch(e){$('#modal-error').textContent=e.message;}
 finally {saving=false;controls.forEach(c=>c.disabled=false);}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.page)navigate(b.dataset.page);if(b.dataset.goto)navigate(b.dataset.goto);
 if(b.hasAttribute('data-new-category'))categoryModal();
 if(b.dataset.editProduct)productModal(b.dataset.editProduct);if(b.dataset.editCategory)categoryModal(b.dataset.editCategory);
 if(b.dataset.deleteProduct)confirmDelete('products',b.dataset.deleteProduct);if(b.dataset.deleteCategory)confirmDelete('categories',b.dataset.deleteCategory);
 if(b.hasAttribute('data-prev')){state.index--;renderListing();}if(b.hasAttribute('data-next')){state.index++;renderListing();}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){state.filter=e.target.value;state.index=1;renderListing();}});
document.addEventListener('change',e=>{const key={'filter-category':'category','filter-status':'status','filter-type':'type','filter-from':'from','filter-to':'to'}[e.target.id];if(key){state[key]=e.target.value;state.index=1;renderListing();}});
(async()=>{try{await getCsrf();await enter(await api('/auth/me'));}catch(e){if(e.status!==401)$('#auth-error').textContent=e.message;}})();
