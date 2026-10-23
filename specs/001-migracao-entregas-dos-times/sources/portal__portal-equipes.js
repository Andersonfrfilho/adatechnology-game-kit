// fonte: site/pages/portal/portal-equipes.html
// texto visível: Portal das Equipes ZombiAdA ZombiAdA · Portal das Equipes Uma ficha por equipe: abra a prévia publicada, ache o arquivo-fonte, veja se já entrou no jogo e deixe o ajuste que a equipe precisa fazer. Carregando… Cópia offline de todas as prévias: docs/offline/index.html (abre sem internet, a partir da pasta do projeto). Regra: docs/REGRAS-DOCUMENTACAO.md . Status no jogo vem da auditoria de 22/10 (jogo comparado com cada prévia) e pode ser trocado na ficha. Na versão publicada os ajustes ficam salvos para todos com acesso; abrindo o arquivo portal/portal-equipes.html direto da pasta do projeto, os arquivos viram links locais e os ajustes ficam só neste navegador.

// ===== script 0 (17 KB)

const STATUS = {
  entrou:{label:"No jogo"}, parcial:{label:"Parcial"}, faltando:{label:"Faltando"}, referencia:{label:"Referência"}
};
const TEAMS = [
  {id:"jogo", name:"Jogo", what:"Fatia jogável do Jardim Aurora, motor, hordas", status:"entrou",
   game:"Jogável. Auditoria em andamento trazendo o trabalho das outras equipes para dentro.",
   links:[["Jardim Aurora (jogável)","https://claude.ai/artifact/RLRHckn97FjHNDHM23DRvb"],["Revisão final e fatia jogável","https://claude.ai/artifact/VcdTu9bhVwaF25mWhSHctg"],["Bancada de Hordas","https://claude.ai/artifact/2iCyhJbt7jkEG3q13RzfnZ"],["Antes do Dia 1 (surto gradual)","https://claude.ai/artifact/Mu3Xy7Lm9DXc1fJGNMrM3p"]],
   files:[["offline","docs/offline/jogo/zombiada-jardim-aurora.html"],["offline","docs/offline/jogo/revisao-final-fatia-jogavel.html"],["offline","docs/offline/jogo/bancada-de-hordas.html"],["offline","docs/offline/jogo/bancada-moveis-interativos.html"],["offline","docs/offline/sala-de-testes/sala-de-testes.html"],["sdk","sdk/destruicao/"],["sdk","sdk/interactables/"],["offline","docs/offline/jogo/antes-do-dia-1.html"],["prévia","surto/inicio-do-surto.html"],["sdk","implementacao/sdk/contagio/"],["dados","implementacao/jogo-web/dados/surto-vale.json"],["jogo","implementacao/jogo-web/zombiada.html"],["código","implementacao/jogo-web/src/"],["build","implementacao/jogo-web/build.py"],["hordas","implementacao/prototipo-web/bancada-hordas.html"],["brief","mapa/briefs/jardim-aurora-fatia-vertical.md"],["revisão","revisao/checklist-e-orcamento.md"]]},
  {id:"mapa", name:"Mapa", what:"Vale Cinzento: terreno, bairros, trilhas, pontes", status:"parcial",
   game:"Só o Jardim Aurora está no jogo. Trilhas, pontes, fazendas e mansão sendo integrados.",
   links:[["Mapa do Vale Cinzento","https://claude.ai/artifact/FchNV6FWcWreFFHLnNkuAP"],["Galeria do Vale Cinzento","https://claude.ai/artifact/AeuwWYcdRpcv86yW3nz3yi"]],
   files:[["offline","docs/offline/mapa/mapa-vale-cinzento.html"],["offline","docs/offline/mapa/galeria-vale-cinzento.html"],["prévia","mapa/mapa-vale-cinzento.html"],["galeria","mapa/galeria-vale-cinzento.html"],["dados","mapa/mundo-terreno.json"],["dados","mapa/padrao-urbano.json"],["dados","mapa/itens-destrutiveis.json"]]},
  {id:"zumbis", name:"Zumbis e personagens", what:"Bestiário, anatomia, cortes e movimentos", status:"parcial",
   game:"Zumbis do Bestiário revisados e no jogo. Anatomia dos personagens entrou pela metade.",
   links:[["Bestiário","https://claude.ai/artifact/X1Q11t2w24GtE2MsyYy7wr"],["Elenco","https://claude.ai/artifact/1N5SEWsaguU6pwm6PPHiKC"],["Personagens","https://claude.ai/artifact/B3xvaw4FLSCCtvHEf5nHCx"]],
   files:[["offline","docs/offline/zumbis-personagens/bestiario.html"],["offline","docs/offline/zumbis-personagens/elenco.html"],["offline","docs/offline/zumbis-personagens/personagens.html"],["prévia","implementacao/zumbi-arte/bestiario-zombiada.html"],["prévia","personagens/personagens.html"],["prévia","personagens/arte/elenco.html"],["brief","briefs/zumbis-categorias.md"],["brief","personagens/briefs/sistema-personagens.md"],["guia","personagens/arte/guia-estilo-corpo.md"],["artes","personagens/arte/"]]},
  {id:"sobreviventes", name:"Sobreviventes e facções", what:"NPCs com vida própria, histórias, fardados", status:"parcial",
   game:"Sobreviventes do quarteirão no jogo. Facções fardadas (Exército, polícia, BOPE/COT/GATE) ainda não.",
   links:[["Os Vivos do Vale","https://claude.ai/artifact/AkFLNVrwUbtJjUVwMfKBuZ"],["Retratos do Vale","https://claude.ai/artifact/9djtWyfGQ5LrfwTRrL5XBd"]],
   files:[["offline","docs/offline/sobreviventes/os-vivos-do-vale.html"],["offline","docs/offline/sobreviventes/retratos-do-vale.html"],["prévia","sobreviventes/sobreviventes.html"],["prévia","sobreviventes/arte-sobreviventes.html"],["brief","sobreviventes/briefs/sobreviventes-destino.md"],["dados","sobreviventes/fardados-itens.json"]]},
  {id:"armas", name:"Armas e itens", what:"Arsenal real, munições, loot", status:"entrou",
   game:"Itens revisados e no jogo.",
   links:[["Arsenal","https://claude.ai/artifact/NNmzTbMKsE6nuThHKuXzWd"],["Galeria 3D do Arsenal","https://claude.ai/artifact/C96Cxhb4bTA9bbojV4ctKH"],["Itens do Vale Cinzento","https://claude.ai/artifact/NKmkGZ2Lvcd96mp6Nyksds"]],
   files:[["offline","docs/offline/armas-itens/arsenal.html"],["offline","docs/offline/armas-itens/galeria-3d-arsenal.html"],["offline","docs/offline/armas-itens/itens-vale-cinzento.html"],["prévia","itens/itens-vale-cinzento.html"],["dados","itens/catalogo-itens.json"],["brief","itens/briefs/itens-loot.md"],["fonte","itens/fonte/dados_itens.py"],["fonte","itens/fonte/template.html"]]},
  {id:"veiculos", name:"Veículos", what:"Garagem v4: 69 veículos, dano por zona, SDK genérico", status:"parcial",
   game:"Os 69 modelos montam no motor; versões leves sendo preparadas para as ruas.",
   links:[["Garagem","https://claude.ai/artifact/Xy9QydZTRyAfwxRMjzh1aT"],["Frota","https://claude.ai/artifact/3FqnqNJrEc4jLgAAvjGmnp"]],
   files:[["offline","veiculos/garagem.html"],["offline","veiculos/frota.html"],["prévia","veiculos/garagem-sdk/index.html"],["spec","veiculos/garagem-v4/SPEC.md"],["notas","veiculos/garagem-v4/NOTAS.md"],["api","veiculos/garagem-sdk/API.md"],["sdk","veiculos/garagem-sdk/sdk/README.md"],["brief","briefs/zombiada-veiculos.md"]]},
  {id:"efeitos", name:"Efeitos", what:"Explosões, partículas, sangue e fluidos", status:"parcial",
   game:"Explosão básica no jogo. Faltam camadas do Laboratório, crateras, granada que quica e sangue na parede.",
   links:[["Laboratório de Explosões","https://claude.ai/artifact/XHSLUfNEdzAqGrqVQCWifG"],["Oficina de VFX","https://claude.ai/artifact/LhJANM9RPMxWKS1ZXCzQ56"],["Padrão de Fluidos","https://claude.ai/artifact/XnjUUwx8fq5oQdDGvEq4Nv"]],
   files:[["offline","docs/offline/efeitos/laboratorio-explosoes.html"],["offline","docs/offline/efeitos/oficina-vfx.html"],["offline","docs/offline/efeitos/padrao-fluidos.html"],["prévia","vfx/explosoes/laboratorio-explosoes.html"],["brief","vfx/explosoes/brief-explosoes.md"],["prévia","vfx/oficina-vfx.html"],["brief","vfx/briefs/vfx-particulas.md"],["prévia","fluidos/padrao-fluidos.html"]]},
  {id:"animais", name:"Animais", what:"Fauna do vale e habitats", status:"faltando",
   game:"Ainda não existem no jogo.",
   links:[["Bichos do Vale","https://claude.ai/artifact/6wxuUFgg9EZxQCeAQwx4HN"]],
   files:[["offline","docs/offline/animais/bichos-do-vale.html"],["prévia","animais/animais.html"],["dados","animais/habitats.json"],["brief","animais/briefs/animais.md"]]},
  {id:"vegetacao", name:"Vegetação", what:"Plantas, árvores, flores, cactos e gramas do SDK game-vegetation", status:"parcial",
   game:"Plantas do SDK aparecem nos visores de lotes. O Viveiro do Vale é a galeria de teste das espécies, ainda fora do jogo.",
   links:[],
   files:[["offline","docs/offline/vegetacao/viveiro.html"],["prévia","vegetacao/viveiro.html"],["fonte","vegetacao/fonte/"]]},
  {id:"arte", name:"Arte geral", what:"Cenas de referência e pranchas", status:"referencia",
   game:"Referência visual para todas as equipes.",
   links:[["Cena de Arte","https://claude.ai/artifact/7UjDQiGv4m5E49dCa2kRmE"]],
   files:[["offline","docs/offline/arte/cena-de-arte.html"],["prancha","arte/zumbis-cenas-3d.png"],["prancha","arte/horda-barricada.png"],["prancha","arte/horda-piramide.png"],["prancha","arte/explosao-horda.png"],["prancha","arte/dano-partes.png"],["pasta","arte/"]]},
];

const LOCAL = location.protocol === "file:";
const state = {filter:"todos", q:"", notes:[], status:{}, db:null, user:null, canWrite:true, names:{}};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT;
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}

function statusOf(t){return state.status[t.id]?.state || t.status}
function fmtDate(ms){try{return new Date(ms).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch(e){return ""}}

function renderSummary(){
  const counts={todos:TEAMS.length}; for(const k in STATUS) counts[k]=0;
  TEAMS.forEach(t=>counts[statusOf(t)]++);
  const open = state.notes.filter(n=>!n.done).length;
  const items=[["todos","Todas"],...Object.entries(STATUS).map(([k,v])=>[k,v.label])];
  $("#summary").innerHTML = items.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${state.filter===k}">${l} <span class="n">${counts[k]}</span></button>`).join("")
    + `<button class="chip" data-f="ajustes" aria-pressed="${state.filter==="ajustes"}">Com ajustes abertos <span class="n">${open}</span></button>`
    + `<label class="search"><input id="q" type="search" placeholder="Buscar equipe ou arquivo" value="${esc(state.q)}" aria-label="Buscar"></label>`;
}

function filesHTML(t){
  return t.files.map(([k,p])=>{
    const path = LOCAL ? `<a class="p" href="../${esc(p)}">${esc(p)}</a>` : `<span class="p">${esc(p)}</span>`;
    return `<li><span class="k">${esc(k)}</span>${path}${LOCAL?"":`<button class="copy" data-copy="${esc(p)}" type="button">copiar</button>`}</li>`;
  }).join("");
}

function notesHTML(t){
  const list = state.notes.filter(n=>n.team===t.id).sort((a,b)=>(a.done-b.done)||(b.at-a.at));
  if(!list.length) return `<p class="empty">Nenhum ajuste anotado. Escreva abaixo o que esta equipe precisa mudar.</p>`;
  return list.map(n=>{
    const who = n.by ? (state.names[n.by] || "Alguém") : "";
    return `<div class="note ${n.done?"done":""}">
      <input type="checkbox" ${n.done?"checked":""} data-done="${esc(n.id)}" aria-label="Marcar como feito" ${state.canWrite?"":"disabled"}>
      <div class="t">${esc(n.text)}</div>
      ${state.canWrite?`<button class="del" data-del="${esc(n.id)}" type="button" aria-label="Apagar ajuste">✕</button>`:"<span></span>"}
      <div class="meta">${who?esc(who)+" · ":""}${fmtDate(n.at)}${n.done?" · feito":""}</div>
    </div>`;}).join("");
}

function renderGrid(){
  const q = state.q.trim().toLowerCase();
  const teams = TEAMS.filter(t=>{
    const st=statusOf(t);
    if(state.filter==="ajustes"){ if(!state.notes.some(n=>n.team===t.id&&!n.done)) return false; }
    else if(state.filter!=="todos" && st!==state.filter) return false;
    if(!q) return true;
    return (t.name+" "+t.what+" "+t.files.map(f=>f[1]).join(" ")+" "+t.links.map(l=>l[0]).join(" ")).toLowerCase().includes(q);
  });
  if(!teams.length){$("#grid").innerHTML=`<p class="empty">Nenhuma equipe nesse filtro.</p>`;return}
  $("#grid").innerHTML = teams.map(t=>{
    const st=statusOf(t), open=state.notes.filter(n=>n.team===t.id&&!n.done).length;
    const ov = state.status[t.id];
    return `<section class="team" id="${t.id}">
      <div class="team-head">
        <div><h2>${esc(t.name)}</h2><p class="what">${esc(t.what)}</p></div>
        <div class="statusbox">
          <span class="pill ${st}">${STATUS[st].label}</span>
          ${state.canWrite?`<select data-status="${t.id}" aria-label="Trocar status de ${esc(t.name)}">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===st?"selected":""}>${v.label}</option>`).join("")}</select>`:""}
        </div>
      </div>
      <div class="body">
        <p class="gamenote"><small>No jogo</small>${esc(ov?.note || t.game)}</p>
        <div><p class="label">Prévias publicadas</p><div class="links">${t.links.map(([l,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join("")}</div></div>
        <div><p class="label">Arquivos na pasta do projeto</p><ul class="files">${filesHTML(t)}</ul></div>
        <div class="notes"><p class="label">Ajustes ${open?`<span class="count">${open} aberto${open>1?"s":""}</span>`:""}</p>${notesHTML(t)}
          ${state.canWrite?`<form class="add" data-team="${t.id}"><textarea id="nova-${t.id}" rows="1" placeholder="Ex.: cabelo do jogador mais escuro, igual ao Elenco" aria-label="Novo ajuste para ${esc(t.name)}"></textarea><button type="submit">Anotar</button></form>`:""}
        </div>
      </div>
    </section>`;
  }).join("");
}

function render(){
  const active=document.activeElement, id=active&&active.id, val=active&&active.value, pos=active&&active.selectionStart;
  renderSummary(); renderGrid();
  if(id){const el=document.getElementById(id); if(el){el.value=val; el.focus(); try{el.setSelectionRange(pos,pos)}catch(e){}}}
}

/* ---------- armazenamento: db compartilhado na versão publicada, localStorage no arquivo local ---------- */
const LS="zombiada-portal-v1";
function lsLoad(){try{const d=JSON.parse(localStorage.getItem(LS)||"{}");state.notes=d.notes||[];state.status=d.status||{}}catch(e){}}
function lsSave(){try{localStorage.setItem(LS,JSON.stringify({notes:state.notes,status:state.status}))}catch(e){}}

async function addNote(team,text){
  const at=Date.now();
  if(state.db){
    const me = state.user ? await state.user.id() : null;
    try{await state.db.collection("notas").add({team,text,done:false,at,by:me||""})}
    catch(e){failed(e);return}
  }else{state.notes.push({id:"n"+at,team,text,done:false,at,by:""});lsSave();render()}
  toast("Ajuste anotado");
}
async function setDone(id,done){
  if(state.db){try{await state.db.collection("notas").doc(id).update({done})}catch(e){failed(e)}}
  else{const n=state.notes.find(n=>n.id===id); if(n){n.done=done;lsSave();render()}}
}
async function delNote(id){
  if(state.db){try{await state.db.collection("notas").doc(id).delete();toast("Ajuste apagado")}catch(e){failed(e)}}
  else{state.notes=state.notes.filter(n=>n.id!==id);lsSave();render();toast("Ajuste apagado")}
}
async function setStatus(team,st){
  const def=TEAMS.find(t=>t.id===team);
  if(state.db){try{await state.db.collection("status").doc(team).set({state:st,at:Date.now()})}catch(e){failed(e)}}
  else{state.status[team]={state:st};lsSave();render()}
  toast(`${def.name}: ${STATUS[st].label}`);
}
function failed(e){
  if(e&&e.code==="invalid_argument"){state.canWrite=false;render();toast("Você só pode ver este portal, não editar.")}
  else if(e&&e.code==="quota_exceeded"){toast("O portal está cheio. Apague ajustes já feitos para liberar espaço.")}
  else toast("Não deu para salvar agora. Tente de novo em instantes.");
}

async function resolveNames(){
  if(!state.user) return;
  const ids=[...new Set(state.notes.map(n=>n.by).filter(Boolean))];
  if(!ids.length) return;
  try{const ps=await state.user.profiles(ids); for(const id of ids) state.names[id]=(ps[id]&&ps[id].name)||"Alguém"; renderGrid()}catch(e){}
}

/* ---------- eventos ---------- */
document.addEventListener("click",async e=>{
  const f=e.target.closest("[data-f]"); if(f){state.filter=f.dataset.f;render();return}
  const c=e.target.closest("[data-copy]"); if(c){
    const p="/mnt/project-files/"+c.dataset.copy;
    try{await navigator.clipboard.writeText(p);toast("Caminho copiado")}catch(err){const r=document.createRange();r.selectNodeContents(c.previousElementSibling);const s=getSelection();s.removeAllRanges();s.addRange(r);toast("Caminho selecionado")}
    return}
  const d=e.target.closest("[data-del]"); if(d){delNote(d.dataset.del);return}
});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-done]")) setDone(e.target.dataset.done,e.target.checked);
  if(e.target.matches("[data-status]")) setStatus(e.target.dataset.status,e.target.value);
});
document.addEventListener("input",e=>{if(e.target.id==="q"){state.q=e.target.value;renderGrid()}});
document.addEventListener("submit",e=>{
  const f=e.target.closest("form.add"); if(!f) return; e.preventDefault();
  const ta=f.querySelector("textarea"), text=ta.value.trim(); if(!text) return;
  ta.value=""; addNote(f.dataset.team,text);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey&&e.target.matches("form.add textarea")){e.preventDefault();e.target.form.requestSubmit()}
});

/* ---------- início ---------- */
lsLoad();
if(!LOCAL){const a=document.querySelector(".offline-note a"); if(a){const c=document.createElement("code"); c.textContent="docs/offline/index.html"; a.replaceWith(c)}}
$("#mode").innerHTML = LOCAL ? "Arquivo local<br><b>ajustes ficam neste navegador</b>" : "Conectando…";
render();
if(location.hash){const el=document.getElementById(location.hash.slice(1)); if(el) el.scrollIntoView()}

(async()=>{
  if(LOCAL || !window.claude || !window.claude.use) { if(!LOCAL) $("#mode").innerHTML="Modo offline<br><b>ajustes ficam neste navegador</b>"; return }
  const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
  state.user=user;
  if(!db){$("#mode").innerHTML="Sem conexão com o portal<br><b>ajustes ficam neste navegador</b>";return}
  state.db=db; state.notes=[]; state.status={};
  if(user){try{const c=await user.can("data.write"); if(c===false) state.canWrite=false}catch(e){}}
  $("#mode").innerHTML = state.canWrite ? "Portal compartilhado<br><b>ajustes salvos para toda a equipe</b>" : "Portal compartilhado<br><b>somente leitura</b>";
  render();
  db.collection("notas").onSnapshot(s=>{
    state.notes=s.docs.map(d=>({id:d.id,...d.data()}));
    render(); resolveNames();
  },e=>toast("Os ajustes pararam de atualizar. Recarregue a página."));
  db.collection("status").onSnapshot(s=>{
    const m={}; s.docs.forEach(d=>{const v=d.data(); if(v&&STATUS[v.state]) m[d.id]=v}); state.status=m; render();
  },()=>{});
})();
