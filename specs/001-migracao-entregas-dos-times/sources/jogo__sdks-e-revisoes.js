// fonte: site/pages/jogo/sdks-e-revisoes.html
// texto visível: SDKs e revisões SDKs e revisões Gerado em 22/10/2026 19:22 por docs/offline/ferramentas/docs_locais.py . Para atualizar, rode o script de novo. Sumário Documentação SDK Câmera SDK Modo livre (ferramenta de teste) PlantasSDK Coordenadas API Estilo ( estilo: &#x27;popular&#x27; | &#x27;nobre&#x27; | &#x27;comercial&#x27; ) Regras de colocação Como adicionar Templates Como o jogo se pluga Arquivos Revisão final ZombiAdA: checklist de consistência e orçamento de desempenho 1. Inconsistências encontradas (primeira passada) 2. Orçamento por quadro (host, 60 FPS = 16,6 ms) 3. Orçamento de rede (por cliente, 30 Hz) 4. Relevância única (mapa vivo + hordas) 5. NPCs vivos e histórias 6. Próximos passos 7. Situação em 22/10, 06h Regras de documentação e prévias do ZombiAdA A regra Onde fica cada coisa Como regenerar Imagens da revisão revisao/casa3-r6 (4) revisao/plantas (8) revisao/plantas-jogo (3) revisao/comparacoes (5) Documentação SDK Câmera Câmera de ombro, terceira pessoa e primeira pessoa para jogos em three.js. Não conhece nenhum jogo: recebe o alvo e uma função de colisão. const rig = CameraModosSDK.criar(THREE, { chave: &#x27;meu-jogo-camera&#x27;, nomes: { ombro: &#x27;ombro (Q troca)&#x27; } }); rig.seletor(document.querySelector(&#x27;#menu&#x27;), &#x27;Câmera&#x27;); // seletor pronto, opcional // a cada quadro rig.atualiza(camera, { x, y, z, yaw, pitch, mira, agachado }, dt, (ox, oy, oz, dx, dy, dz, max) =&gt; distanciaAteParede ?? null, // colisão (opcional) (x, z, y) =&gt; alturaDoTeto); // teto (opcional) if (rig.primeiraPessoa()) { rig.viewmodel(grupoDaArma, camera); /* esconda o corpo do jogador */ } rig.ciclar(); rig.trocaLado(); rig.setModo(&#x27;terceira&#x27;); rig.aoMudar(m =&gt; ...); Convenções: yaw 0 olha para -z; pitch positivo olha para baixo; a arma tem o cano em +z. Tudo que é número (distâncias, alturas, posição do viewmodel) se ajusta em criar(THREE, { ombro: {...}, terceira: {...}, primeira: {...}, viewmodel: {...} }) . No ZombiAdA o adaptador é implementacao/jogo-web/src/91-camera.js (tecla O, seletor no menu, esconde o corpo em primeira pessoa). SDK Modo livre (ferramenta de teste) Arquivo: modo-livre.js . Genérico, não conhece nenhum jogo. O build.py do jogo inclui tudo de sdk/*/*.js antes do src/ . const ML = ModoLivreSDK.criar(THREE, { chaveMarcas: &#x27;meujogo-marcas&#x27;, arquivo: &#x27;marcas.txt&#x27;, equipes: [[&#x27;mapa&#x27;,&#x27;Mapa&#x27;]], area: (x, z) =&gt; &#x27;nome da área&#x27;, hora: () =&gt; &#x27;12:00&#x27;, msg: (texto, s) =&gt; {}, pos: () =&gt; ({ x, y, z, yaw, pitch }), limites: { x: [-500, 500], y: [0.4, 260], z: [-500, 500] }, pausa: aberto =&gt; {}, // true ao abrir painel (soltar mouse, pausar), false ao fechar }); ML.chave(&#x27;id&#x27;, &#x27;Rótulo&#x27;, get, set) // liga/desliga no painel (set devolve true para fechar o painel) .acao(&#x27;id&#x27;, &#x27;Rótulo&#x27;, fn) // botão (fn devolve true para manter o painel aberto) .horasDoDia([[&#x27;Manhã&#x27;, 0.3]], setHora) .lu

// ===== script 0 (2 KB)

(function(){
  'use strict';
  function norm(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
  var busca = document.getElementById('busca');
  var resultado = document.getElementById('resultado');
  var vazio = document.getElementById('vazio');
  var artigos = [].slice.call(document.querySelectorAll('article.doc'));
  var grupos = [].slice.call(document.querySelectorAll('section.grupo'));
  var zoom = document.getElementById('zoom');
  var zimg = zoom.querySelector('img');

  artigos.forEach(function(a){ a._q = norm(a.textContent); });
  grupos.forEach(function(g){
    g._figs = [].slice.call(g.querySelectorAll('figure'));
    g._figs.forEach(function(f){ f._q = norm(f.textContent + ' ' + g.dataset.pasta); });
  });

  function alvo(id, oculto){
    var li = document.querySelector('[data-alvo="' + id + '"]');
    if (li) li.hidden = oculto;
  }

  function filtra(){
    var termo = norm(busca.value.trim());
    var docsVis = 0, imgVis = 0;
    artigos.forEach(function(a){
      var ok = !termo || a._q.indexOf(termo) >= 0;
      a.hidden = !ok; alvo(a.id, !ok);
      if (ok) docsVis++;
    });
    document.getElementById('docs').hidden = docsVis === 0;
    alvo('docs', docsVis === 0);
    grupos.forEach(function(g){
      var n = 0;
      g._figs.forEach(function(f){
        var ok = !termo || f._q.indexOf(termo) >= 0;
        f.hidden = !ok;
        if (ok) n++;
      });
      g.hidden = n === 0; alvo(g.id, n === 0);
      imgVis += n;
    });
    document.getElementById('imagens').hidden = imgVis === 0;
    alvo('imagens', imgVis === 0);
    resultado.textContent = termo ? (docsVis + ' documento(s) e ' + imgVis + ' imagem(ns) encontrados') : '';
    vazio.hidden = !termo || (docsVis + imgVis) > 0;
  }

  function abre(img){
    zimg.setAttribute('src', img.getAttribute('src'));
    zimg.alt = img.alt;
    zoom.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }
  function fecha(){
    zoom.hidden = true;
    zimg.removeAttribute('src');
    document.documentElement.style.overflow = '';
  }

  document.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('button.ampliar') : null;
    if (b) abre(b.querySelector('img'));
  });
  zoom.addEventListener('click', fecha);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && !zoom.hidden) fecha();
  });
  busca.addEventListener('input', filtra);
  filtra();
})();
