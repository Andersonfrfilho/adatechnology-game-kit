// fonte: site/pages/jogo/revisao-casa-a.html
// texto visível: Revisão da Casa tipo A Revisão da Casa tipo A Revisão da Casa tipo A (Anderson, 22/10). Status e notas vêm da lista de revisão; "conferi" e comentários são seus e ficam salvos neste navegador, sem internet. 57 de 72 corrigidos (79%) 57 corrigido · 3 aguardando decisão · 11 pronto no SDK · 1 aberto Abrir no visor Exportar JSON Importar JSON aberto corrigido aguardando decisão Câmera 1 ponto(s) 1 corrigido R01 Faltou modo livre voador no visor corrigido Nota da correção: Botão &quot;Voo livre&quot; ao lado de &quot;Primeira pessoa&quot;: WASD com arraste do mouse, Espaço/E sobem, Q/Ctrl descem, Shift acelera, sem colisão (atravessa paredes e telhado) e com botões na tela para toque. conferi Colisão 5 ponto(s) 4 corrigido 1 pronto no SDK R02 Passamos por dentro dos objetos corrigido Nota da correção: Na primeira pessoa o jogador colide com as pegadas orientadas dos móveis e itens (abaixo de 0,9 m de altura e acima de 0,3 m; tapetes passam), e agora também com muros e portões do lote, que antes eram descartados. conferi R09 Objetos atravessam paredes corrigido Nota da correção: Auditoria das pegadas (incluindo itens de parede com profundidade): nenhuma invade parede ou muro nos dados do SDK; adicionados testes de propriedade (pegada dentro das faces internas do cômodo e fora do corpo das paredes e do muro). conferi R42 Box do banheiro e roupas do varal travam o jogador e não se mexem ao passar pronto no SDK Nota da correção: Pronto no SDK de móveis (game-interactables-household) e testável na Bancada de móveis interativos; aparece no visor e no jogo quando o Mapa no jogo integrar. Portas do box e roupas do varal não bloqueiam: balançam (mola amortecida) quando o jogador passa, e a porta do box abre ao ser empurrada. conferi R64 Abajur e mesa de canto atravessam a parede corrigido Nota da correção: O abajur agora é item do SDK (categoria luz_mesa, montagem apoio, 0,36 m) afastado das paredes e sem dividir o tampo com o vaso; o visor deve desenhar o abajur de res.moveis em vez de inventar um no centro do criado. conferi R70 Jogador atravessa portas fechadas corrigido Nota da correção: Etapa 2 feita: a colisão própria do jogo (setDoor/doorHit) foi trocada pela do Casa3DSDK nas casas do SDK. Teste implementacao/jogo-web/t/porta-fechada.mjs: andando de verdade, a porta fechada para o jogador e a aberta deixa passar, em 7 portas do térreo e do 1º andar. Zumbis abrem as portas dos andares de cima (c3ZumbisAbrem). conferi Banheiro 5 ponto(s) 4 corrigido 1 pronto no SDK R03 Espelhos não refletem corrigido Nota da correção: Espelho mais próximo usa Reflector real só quando a câmera está no cômodo, com fallback de cubo de ambiente nos demais. Verificado em primeira pessoa (casaA semente 3, espelho do quarto): diante dele o Reflector fica ligado e mostra o cômodo refletido; teste em t_interacao.mjs. conferi R04 Box de vidro encostado na janela corrigido Nota da correção: Box de vidro não bloqueia mais a janela (hjan 1,95 m no catálogo, teste de janelas bloqueada

// ===== script 0 (3 KB)

(function(){
 'use strict';
 var CHAVE='zombiada-revisao-casa-a';
 var itens=document.querySelectorAll('.item');
 var TOTAL=itens.length;
 var conhecidos={};
 itens.forEach(function(el){conhecidos[el.getAttribute('data-item')]=true;});
 var st={};
 var aviso=document.getElementById('aviso');
 function msg(t){aviso.textContent=t;}
 function carregar(){
  try{
   var raw=localStorage.getItem(CHAVE);
   if(raw){var o=JSON.parse(raw); if(o&&typeof o==='object'&&!Array.isArray(o)) st=o;}
  }catch(e){st={};}
 }
 function gravar(){
  try{localStorage.setItem(CHAVE,JSON.stringify(st)); return true;}
  catch(e){msg('Não foi possível salvar neste navegador. Use Exportar para guardar o que você marcou.'); return false;}
 }
 function limpar(id){var e=st[id]; if(e&&!e.conferi&&!e.comentario) delete st[id];}
 function contar(){
  var n=0;
  itens.forEach(function(el){var e=st[el.getAttribute('data-item')]; if(e&&e.conferi) n++;});
  document.getElementById('conferidos').textContent=n+' de '+TOTAL+' conferidos';
 }
 function aplicar(){
  itens.forEach(function(el){
   var e=st[el.getAttribute('data-item')]||{};
   el.querySelector('input[type=checkbox]').checked=!!e.conferi;
   el.querySelector('textarea').value=e.comentario||'';
  });
  contar();
 }
 document.addEventListener('change',function(ev){
  var t=ev.target;
  if(!t.getAttribute||t.type!=='checkbox'||!t.getAttribute('data-id')) return;
  var id=t.getAttribute('data-id');
  var e=st[id]||{}; e.conferi=t.checked; st[id]=e; limpar(id);
  gravar(); contar();
 });
 document.addEventListener('input',function(ev){
  var t=ev.target;
  if(t.tagName!=='TEXTAREA'||!t.getAttribute('data-id')) return;
  var id=t.getAttribute('data-id');
  var e=st[id]||{}; e.comentario=t.value; st[id]=e; limpar(id);
  gravar();
 });
 document.getElementById('exportar').addEventListener('click',function(){
  var rev={};
  Object.keys(st).forEach(function(k){
   var e=st[k];
   if(e&&(e.conferi||e.comentario)) rev[k]={conferi:!!e.conferi,comentario:e.comentario||''};
  });
  var dados={chave:CHAVE,exportado_em:new Date().toISOString(),revisoes:rev};
  try{
   var blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});
   var url=URL.createObjectURL(blob);
   var a=document.createElement('a');
   a.href=url; a.download='revisao-casa-a.json';
   document.body.appendChild(a); a.click(); a.remove();
   setTimeout(function(){URL.revokeObjectURL(url);},1000);
   msg('Exportado: revisao-casa-a.json');
  }catch(e){msg('Não foi possível exportar: '+e.message);}
 });
 var arq=document.getElementById('arquivo');
 document.getElementById('importar').addEventListener('click',function(){arq.click();});
 arq.addEventListener('change',function(){
  var f=arq.files&&arq.files[0];
  if(!f) return;
  var leitor=new FileReader();
  leitor.onload=function(){
   var o;
   try{o=JSON.parse(leitor.result);}catch(e){msg('Arquivo inválido: não é JSON.'); return;}
   if(!o||typeof o!=='object'||!o.revisoes||typeof o.revisoes!=='object'){msg('Arquivo inválido: falta o campo "revisoes".'); return;}
   var n=0;
   Object.keys(o.revisoes).forEach(function(id){
    if(!conhecidos[id]) return;
    var v=o.revisoes[id]||{};
    st[id]={conferi:!!v.conferi,comentario:String(v.comentario||'')};
    limpar(id); n++;
   });
   gravar(); aplicar();
   msg('Importados '+n+' itens. Itens presentes no arquivo substituíram os salvos.');
  };
  leitor.onerror=function(){msg('Não foi possível ler o arquivo.');};
  leitor.readAsText(f);
  arq.value='';
 });
 carregar(); aplicar();
})();
