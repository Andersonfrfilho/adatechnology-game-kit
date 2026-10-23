// fonte: site/pages/zumbis-personagens/bestiario.html
// texto visível: Bestiário ZombiAdA ZombiAdA · Documento de design · v0.1 · 22/10/2026 Bestiário dos infectados As 13 categorias de zumbis, como a idade da infecção muda cada uma, o dano por região, as roupas que protegem, como alguém vira zumbi e como tudo isso roda em hordas de milhares sem lag na LAN. PROPOSTA · NÚMEROS A TESTAR Regras de ouro Artes 3D Cenas Categorias Horda Idade da infecção Idade da pessoa Dano e penetração Roupas Mordida Som Corpos Altura e porte Grupo Técnica Em aberto Regras de ouro Tiro no crânio mata Qualquer categoria. Só capacete pode segurar um tiro. Mordida = fim Infecção de 100%, sem cura. Arranhão tem 20% de chance. Olhos dizem o tipo Silhueta + cor do brilho identificam a ameaça de longe e no escuro. Velho sangra menos Quanto mais antiga a infecção, menos sangue, mais lento e mais frágil. Bala atravessa Cada calibre atravessa um número de corpos e perde dano em cada um. Corpos ficam 15 min E escondem o Espreitador, que finge de morto entre eles. Artes 3D Conceito low poly de cada categoria no mesmo corpo anatômico dos sobreviventes do Elenco do Vale, cada um com seu jeito de andar, em escala real: cada quadrado do chão tem 1 m. Arraste para girar, escolha um zumbi para chegar perto e troque as idades para ver como o visual muda. São bonecos de referência para silhueta, postura e cor dos olhos, não os modelos finais. Ver Todos Idade da infecção Fresco Recente Antigo Decrépito Idade da pessoa Jovem Adulto Idoso Movimento Andando Parado Aparência Sortear aparência Cenas de referência Tudo o que a equipe propôs, em 3D: roupas, dano por região, penetração, os comportamentos especiais, a transformação, os corpos e a técnica de hordas. Escolha uma cena e arraste para girar a câmera. Cena As 13 categorias Velocidade em m/s: vagando / perseguindo. Multiplicadores de dano valem para tronco · braços · pernas (a cabeça sempre mata com tiro). Spawn é a fatia de uma horda típica. Composição de uma horda de 100 Ver em 3D Em cada grupo visível aparecem no máximo 2 ou 3 especiais, para que a silhueta deles se destaque da massa de Lentos. À noite, Corredores sobem para 25%. Idade da infecção Não é categoria: é um modificador sobre qualquer categoria. A mistura de idades acompanha os dias do mundo (1ª semana: 80% frescos; dia 60: cerca de metade antigos). Quem é transformado (jogador ou NPC) sempre nasce Fresco. Fresco · 0–3 dias Recente · 4–30 d Antigo · 1–6 meses Decrépito · 6+ meses Sangue / rastro 100% 70% 35% 10% Velocidade +10% base −10% −25% Vida 100% 100% 85% 65% Dano nos membros ×0,8 ×1,0 ×1,3 ×1,8 Percepção base base audição −10% visão −40%, olfato −30% Pele pálida, veias azuladas cinza-esverdeada, manchas roxas verde-oliva, feridas abertas couro seco, ossos à mostra Roupa inteira, cores vivas rasgada, suja trapos desbotados fiapos cinza Sangue vermelho vivo e brilhante; escorre e seca em 10 min para marrom fosco vermelho-escuro; seca em 6 min bordô-marrom, grosso; seca em 6 min pó escuro, não escorre Olhos íris leitosa, brilho fraco bril

// ===== script 0 (8 KB)

const Z=[
 {n:"Lento",eye:"#e3c341",pct:48,role:"A massa da horda: cerca e prende.",hp:100,spd:"0,6 / 1,4",dmg:10,bite:"15%",mult:"1,0 · 0,8 · 0,8",
  look:"Vertical, ombros caídos, arrasta um pé. Olhos amarelos fracos que piscam.",ai:"Visão 15 m (cone 90°), audição 40 m, olfato 10 m. Segue o som dos outros. Agarra e depois morde.",
  spawn:"Todo lugar, dia e noite.",counter:"Gargalos, empurrão + golpe na cabeça, distância.",voice:"Gemido grave e longo",step:"Pé arrastando, chiado úmido"},
 {n:"Corredor",eye:"#e5392b",pct:14,role:"Predador que quebra a formação do grupo.",hp:70,spd:"1,2 / 5,5",dmg:8,bite:"25%",mult:"1,0 · 1,2 · 1,3",
  look:"Tronco inclinado 45°, braços para trás, magro. Vermelho intenso e fixo.",ai:"Visão 30 m, audição 50 m. Linha reta, pula obstáculos baixos. Investida que derruba e morde.",
  spawn:"Mais na cidade; 25% à noite. Só Fresco/Recente.",counter:"Tiro na perna, portas fechadas, iscas sonoras.",voice:"Rosnado curto, grito ao avistar",step:"Ofegante, passos batidos"},
 {n:"Brutamonte",eye:"#ef8a2a",pct:5,role:"Tanque que quebra barricadas.",hp:220,spd:"0,8 / 2,0",dmg:30,bite:"10%",mult:"1,0 · 0,6 · 0,7",
  look:"1,5× altura, 2× largura, forma de V, cabeça afundada. Olhos laranja grandes.",ai:"Visão 20 m, audição 30 m. Dano ×3 em portas. Golpe em arco que derruba 2 m, com aviso de 0,8 s. Cabeça baixa: −40% de área de headshot.",
  spawn:"Industrial, prisão, hordas grandes.",counter:"Atirar quando ele ergue a cabeça após o golpe (1,2 s), fogo, explosivos.",voice:"Urro subgrave",step:"Pisada pesada, câmera treme"},
 {n:"Rastejante",eye:"#a9d14a",pct:9,role:"Emboscada no chão.",hp:60,spd:"0,4",dmg:6,bite:"35%",mult:"1,0 · 1,0 · —",
  look:"Baixo e horizontal (0,4 de altura), puxa o corpo com os braços. Brilho amarelo-esverdeado rente ao chão.",ai:"Visão 5 m, audição 20 m. Esconde-se no mato e sob carros. Morde o tornozelo sem agarrar.",
  spawn:"Rural e estradas, mais quem perde as pernas.",counter:"Lanterna, olhar para o chão, pisão (40 na cabeça).",voice:"Gorgolejo, unhas raspando",step:"Corpo arrastando"},
 {n:"Gritador",eye:"#f2f2ea",pct:2,role:"O alarme vivo.",hp:50,spd:"1,0 / 3,0",dmg:4,bite:"5%",mult:"1,2 · 1,2 · 1,2",
  look:"Magro, pescoço longo, mandíbula aberta. Brilho branco pulsante. Arqueia as costas antes de gritar (1,5 s).",ai:"Audição 60 m, visão 25 m. Ao ver alguém grita: chama todos num raio de 150 m e dá +20% de velocidade por 30 s. Repete a cada 20 s e foge do combate.",
  spawn:"Shopping, hospital, escola; mais à noite.",counter:"Matar primeiro e em silêncio (arco, supressor), cortar a linha de visão.",voice:"Grito de 3 s ouvido a 100 m",step:"Inspiração audível antes do grito"},
 {n:"Inchado",eye:"#5fe08a",pct:3,role:"Perigo de área.",hp:120,spd:"0,5 / 1,0",dmg:12,bite:"15%",mult:"1,5 · 1,0 · 1,0",
  look:"Esférico, braços curtos, barriga translúcida com veias verdes brilhando. Incha antes de estourar.",ai:"Visão 10 m, olfato 25 m. Ao morrer explode numa nuvem de 4 m: cega 5 s, dobra seu rastro de cheiro e faz tossir.",
  spawn:"Perto de água, esgoto e porões.",counter:"Tiro de longe, explodir no meio da horda, máscara.",voice:"Borbulho e gases",step:"Passo molhado; estouro com chiado"},
 {n:"Espreitador",eye:"#9b5ce0",pct:3,dim:true,role:"Terror de interiores.",hp:90,spd:"1,0 / 4,0",dmg:10,bite:"40%",mult:"1,0 · 1,0 · 1,0",
  look:"Agachado, membros longos, anda de quatro e cola nas paredes. Brilho roxo quase apagado, que acende no bote.",ai:"Finge de morto entre os corpos. Acorda se alguém passa a menos de 3 m ou de costas. Bote de 4 m/s por 3 s, agarra por trás.",
  spawn:"Interiores escuros e entre corpos; mais à noite.",counter:"Tiro de confirmação nos corpos; corpo de verdade tem olho apagado. Entrar em dupla.",voice:"Silencioso; estalo de articulação a <8 m",step:"Clique de unha, respiração curta"},
 {n:"Farejador",eye:"#4fc6d6",pct:5,role:"Caçador que segue rastro.",hp:80,spd:"1,0 / 3,5",dmg:9,bite:"20%",mult:"1,0 · 1,1 · 1,1",
  look:"Cabeça erguida e inclinada, nariz exposto, narinas abertas. Brilho ciano.",ai:"Olfato 60 m, segue rastro de sangue (jogador ferido, zumbis frescos) e puxa até 8 Lentos atrás. Visão 10 m.",
  spawn:"Rural e floresta; mais de dia.",counter:"Curativo para estancar, atravessar água, isca de carne.",voice:"Fungadas, rosnado baixo",step:"Passos rápidos e irregulares"},
 {n:"Saltador",eye:"#e04aa8",pct:4,role:"Pula sobre o grupo e derruba quem está atrás de cobertura.",hp:75,spd:"1,0 / 4,5",dmg:14,bite:"30%",mult:"1,0 · 1,1 · 1,4",
  look:"Agachado e enrolado como mola, pernas longas, braços para trás antes do salto. Olhos magenta.",ai:"Visão 25 m, audição 40 m. Salta 6 m na horizontal e 3 m para cima (capôs, muros baixos, telhados). O salto derruba o alvo por 1,5 s. Recarga de 5 s.",
  spawn:"Cidade: telhados, viadutos e estacionamentos; mais à noite.",counter:"Tiro no ar durante o salto (ele não desvia), ficar junto de parede alta, empurrão no pouso.",voice:"Chiado agudo antes do salto",step:"Passos curtos, impacto seco no pouso"},
 {n:"Cego",eye:"#d9d4c8",pct:3,blind:true,role:"Caça só pelo som.",hp:110,spd:"0,8 / 3,0",dmg:12,bite:"35%",mult:"1,0 · 0,9 · 0,9",
  look:"Olhos brancos leitosos e apagados, cabeça inclinada escutando, boca aberta. É o único sem olhos acesos.",ai:"Não enxerga. Ouve tiros a 80 m e passos a 6 m (agachado, 2 m). Vai direto à fonte do som e ataca o que encontrar, até outros zumbis.",
  spawn:"Metrô, túneis, porões e hospitais; dia e noite.",counter:"Andar agachado, jogar garrafa para desviar, não atirar sem supressor por perto.",voice:"Estalos de língua, como um morcego",step:"Passos lentos com pausas para ouvir"},
 {n:"Afogado",eye:"#3d8bff",pct:1,role:"Emboscada na água.",hp:130,spd:"0,6 / 2,5 (3,0 na água)",dmg:10,bite:"25%",mult:"1,0 · 1,0 · 1,0",
  look:"Pele azulada e inchada de água, cabelo grudado, roupa encharcada pingando. Olhos azuis.",ai:"Fica submerso em rios, lagos e enchentes. Agarra quem atravessa e puxa para baixo: 3 s para se soltar ou começa a afogar. Fora d'água é lento.",
  spawn:"Só perto de água; mais depois de chuva.",counter:"Pontes, barco, atirar nas bolhas da água.",voice:"Gorgolejo encharcado",step:"Passo molhado e pesado, pingando"},
 {n:"Carbonizado",eye:"#ff6a1a",pct:2,role:"Brasa ambulante.",hp:90,spd:"0,9 / 2,2",dmg:10,bite:"15%",mult:"0,8 · 0,8 · 0,8",
  look:"Pele preta rachada com brasas acesas nas rachaduras, roupa queimada. Olhos laranja.",ai:"Imune a fogo. O corpo a corpo queima (3 de dano por segundo durante 4 s). À noite ilumina o entorno e se denuncia. Água apaga as brasas e tira 30% da vida.",
  spawn:"Áreas de incêndio, postos de gasolina e onde o jogador usou fogo.",counter:"Tiro à distância, água, extintor.",voice:"Crepitar e chiado",step:"Passos estalando, faíscas"},
 {n:"Devorador",eye:"#b0103a",pct:1,role:"Fica mais forte comendo.",hp:120,spd:"0,9 / 3,0",dmg:16,bite:"30%",mult:"1,0 · 1,0 · 1,0",
  look:"Ajoelhado sobre os corpos, rosto e peito cobertos de sangue fresco. Olhos vermelho-escuros.",ai:"Procura os corpos que ficam 15 min no chão e come: cada um dá +20 de vida e +5% de tamanho, até 3 vezes. Enquanto come, só vê a 5 m. Defende a comida.",
  spawn:"Onde há muitos corpos: depois de tiroteios e explosões.",counter:"Queimar ou recolher os corpos, atacar enquanto ele come.",voice:"Mastigar molhado, rosnado",step:"Arrasto de joelhos"}
];
const cards=document.getElementById("cards"), bar=document.getElementById("hordeBar"), leg=document.getElementById("hordeLegend"), snd=document.getElementById("soundRows");
Z.forEach(z=>{
  const c=document.createElement("article"); c.className="card"; c.style.setProperty("--eye",z.eye);
  c.innerHTML=`<div class="card-head"><span class="eyes${z.dim?" dim":""}" aria-hidden="true"><i></i><i></i></span><h3>${z.n}</h3><span class="pct">${z.pct}%</span></div>
  <p class="role">${z.role}</p>
  <div class="stats"><div><small>Vida</small><b>${z.hp}</b></div><div><small>m/s</small><b>${z.spd}</b></div><div><small>Dano</small><b>${z.dmg}</b></div><div><small>Mordida</small><b>${z.bite}</b></div></div>
  <dl><dt>Visual</dt><dd>${z.look}</dd><dt>IA</dt><dd>${z.ai}</dd><dt>Dano ×</dt><dd>${z.mult}</dd><dt>Onde</dt><dd>${z.spawn}</dd><dt>Como vencer</dt><dd>${z.counter}</dd></dl>`;
  cards.appendChild(c);
  const s=document.createElement("div"); s.style.setProperty("--eye",z.eye); s.style.flex=z.pct; s.title=`${z.n} ${z.pct}`; bar.appendChild(s);
  const l=document.createElement("span"); l.style.setProperty("--eye",z.eye); l.textContent=`${z.n} ${z.pct}`; leg.appendChild(l);
  const r=document.createElement("tr"); r.innerHTML=`<td>${z.n}</td><td>${z.voice}</td><td>${z.step}</td>`; snd.appendChild(r);
});


// ===== script 2 (101 KB)

(function(){
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fail=(el,msg)=>el.insertAdjacentHTML("beforeend",`<p class="nogl">${msg}</p>`);
  if(!window.THREE){document.querySelectorAll(".viewer").forEach(el=>fail(el,"Não foi possível carregar o visualizador 3D."));return}
  const V3=THREE.Vector3;

  // ---------- biblioteca de bonecos ----------
  const gc=document.createElement("canvas");gc.width=gc.height=64;
  const gx=gc.getContext("2d"),gr=gx.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.25,"rgba(255,255,255,.6)");gr.addColorStop(1,"rgba(255,255,255,0)");
  gx.fillStyle=gr;gx.fillRect(0,0,64,64);
  const glowTex=new THREE.CanvasTexture(gc);

  const SKIN=[0xcdbba8,0x94a084,0x7b744a,0x8c7c5e];
  const BLOOD=[0x9e1b12,0x6e1410,0x4a2a18,0x1c1612];
  const CLOTH=[0x4a6f96,0x8e3b3b,0x5d4a3a,0x4f7a43,0x6b6f78,0x3f5f3a,0x5a4a6e,0x8a6a3a];
  const PANTS=0x2c3340, GRAY=0x4a4a46, RED=0x7a120c;
  const col=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t);
  const geoBox=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  const box=(w,h,d,m)=>new THREE.Mesh(geoBox(w,h,d),m);
  const limbGeo=(w,len)=>{const g=geoBox(w,len,w);g.translate(0,-len/2,0);return g};
  const basic=(c,o)=>new THREE.MeshBasicMaterial(Object.assign({color:c},o||{}));
  const glow=(c,s,op)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:c,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:op??.9}));sp.scale.setScalar(s);return sp};

  // Corpo anatômico compartilhado com o Elenco do Vale (personagens/arte/elenco.html, build()):
  // tronco em Lathe de 24 lados suavizado por spline, sombreado liso, membros em cilindros afinados com juntas esféricas, mesmo esqueleto do humano.
  const PI=Math.PI, SEG=16;
  const TORSO_P=[[.18,.86],[.205,.95],[.195,1.03],[.19,1.12],[.225,1.27],[.26,1.4],[.265,1.47],[.21,1.55],[.085,1.6]];
  const TORSO_F=[[.17,.86],[.215,.95],[.2,1.02],[.165,1.1],[.2,1.25],[.245,1.38],[.25,1.46],[.2,1.54],[.085,1.6]];
  const torsoGeo=(sx,sz,fem)=>{const g=new THREE.LatheGeometry(new THREE.SplineCurve((fem?TORSO_F:TORSO_P).map(p=>new THREE.Vector2(p[0],p[1]))).getPoints(30),24);g.scale(1.12*(sx||1),1,.64*(sz||1));return g};
  const cylDown=(r1,r2,len)=>new THREE.CylinderGeometry(r1,r2,len,SEG,1).translate(0,-len/2,0);
  const capGeo=(r,len)=>new THREE.SphereGeometry(r,20,10,0,PI*2,0,len||PI/2);

  // pose base: braços/pernas em rotação x (negativo = para a frente), cotovelo e joelho dobram, drop desce o quadril
  const BASE={s:1,bulk:1,lean:.15,armL:-1.15,armR:-.85,elbL:-.25,elbR:-.4,legL:-.15,legR:.25,kneeL:.15,kneeR:.35,headX:.08,headZ:.22,drop:-.02,neck:0};
  const TYPES={
    Lento:{},
    Corredor:{s:.97,bulk:.88,lean:.75,armL:-1.35,armR:-1.05,elbL:-.08,elbR:-.12,legL:-.75,legR:.55,kneeL:.45,kneeR:1.25,headX:-.55,headZ:0,drop:-.1},
    Brutamonte:{s:1.42,bulk:1.32,lean:.3,armL:-.4,armR:-.25,elbL:-.35,elbR:-.25,legL:-.12,legR:.12,kneeL:.12,kneeR:.12,headX:-.2,headZ:0,neck:-.07,drop:-.02},
    Rastejante:{noLegs:true,lean:1.42,drop:-.74,armL:-2.75,armR:-2.35,elbL:-.5,elbR:-.3,headX:-1.35,headZ:.1},
    Gritador:{bulk:.84,lean:-.18,armL:.35,armR:.45,elbL:-.6,elbR:-.5,legL:-.05,legR:.1,kneeL:.05,kneeR:.1,headX:-.65,headZ:0,neck:.12,mouth:true,drop:0},
    Inchado:{bloat:true,s:1.03,bulk:1.15,lean:0,armL:-.55,armR:-.45,elbL:-.3,elbR:-.3,legL:0,legR:0,kneeL:.05,kneeR:.05,headZ:.1,drop:0,armOut:.45},
    Espreitador:{bulk:.86,lean:1.2,drop:-.36,legL:-1.05,legR:-.85,kneeL:1.75,kneeR:1.6,armL:-1.1,armR:-1.35,elbL:-.05,elbR:-.1,headX:-1.05,headZ:0,dim:true},
    Farejador:{lean:.45,headX:-.75,headFwd:.07,armL:-.35,armR:-.2,elbL:-.45,elbR:-.4,legL:-.25,legR:.2,kneeL:.3,kneeR:.45,headZ:.12,nose:true,drop:-.04},
    Saltador:{bulk:.86,lean:.65,drop:-.36,legL:-1.15,legR:-.9,kneeL:1.9,kneeR:1.7,armL:.7,armR:.5,elbL:-.6,elbR:-.5,headX:-.7,headZ:0},
    Cego:{lean:.05,armL:-.6,armR:-.35,elbL:-.5,elbR:-.7,legL:-.08,legR:.1,kneeL:.08,kneeR:.12,headX:-.25,headZ:.45,blind:true,mouth:true},
    Afogado:{bulk:1.08,lean:.22,armL:-.25,armR:-.15,elbL:-.1,elbR:-.15,headX:.35,headZ:.3,wet:true},
    Carbonizado:{lean:.2,armL:-1,armR:-.6,elbL:-.6,elbR:-.9,headX:.05,headZ:-.15,char:true},
    Devorador:{lean:.95,drop:-.42,legL:-1.45,legR:-1.3,kneeL:2.3,kneeR:2.2,armL:-1.55,armR:-1.35,elbL:-.7,elbR:-.9,headX:.25,headZ:0,gore:true}
  };
  const OUTFITS={
    policial:{cloth:0x1f2a44,pants:0x1a1f2c,vest:0x15171a,hat:"cap",hatC:0x1b2238},
    militar:{cloth:0x4b5a32,pants:0x3f4a2b,vest:0x39412a,hat:"helmet",hatC:0x4a5532},
    bombeiro:{cloth:0xa8874a,pants:0x8f7340,stripes:0xd9d24a,hat:"fire",hatC:0xa3241c},
    motociclista:{cloth:0x18181a,pants:0x22252b,hat:"moto",hatC:0x111214},
    operario:{cloth:0x6b6f78,pants:0x2c3340,vest:0xe0702a,hat:"hardhat",hatC:0xe6c13a},
    medico:{cloth:0x7fb0c8,pants:0x6f9ab0,mask:true},
    cacador:{cloth:0x5a4a2e,pants:0x4a4030,hat:"cap",hatC:0xe0702a}
  };

  function build(spec){
    const ti=Math.max(0,Z.findIndex(x=>x.n===spec.type)), z=Z[ti];
    const P=Object.assign({},BASE,TYPES[spec.type]||{},spec.pose||{}), d=spec.decay??0, life=spec.life??1, cut=spec.cut||{};
    P.s*=spec.h??1;P.bulk*=spec.bulk??1;
    if(life===0){P.s*=.94;P.bulk*=.9}
    if(life===2){P.lean+=.28;P.headX-=.18;P.armL*=.8;P.armR*=.8;P.kneeL+=.1;P.kneeR+=.1}
    if(spec.lying)Object.assign(P,{armL:.2,armR:-.15,elbL:-.15,elbR:-.3,legL:-.05,legR:.12,kneeL:.05,kneeR:.2,lean:0,drop:0,headX:0,headZ:.35});
    const op=spec.opacity??1;
    const cache={};
    const M=c=>{const k=new THREE.Color(c).getHex();if(cache[k])return cache[k];const m=new THREE.MeshLambertMaterial({color:c});if(op<1){m.transparent=true;m.opacity=op}return cache[k]=m};
    const O=spec.outfit?OUTFITS[spec.outfit]||{}:{};
    // aparência sorteada: o tipo fica, rosto, cabelo, pele, corpo e roupa variam
    const VR=rng(spec.seed??(Math.random()*1e9|0)), pick=a=>a[Math.floor(VR()*a.length)], uni=!!spec.uniform;
    const fem=!uni&&spec.type!=="Brutamonte"&&(spec.fem??VR()<.42);
    const tone=spec.tone??(uni?SKIN[0]:pick([0xf1c9a5,0xe0ac80,0xc68c62,0xa8714a,0x8a5a3a,0x5e3b26]));
    const skinC=spec.skin??(uni?SKIN[d]:col(tone,SKIN[d],[.45,.65,.8,.88][d]));
    const TOPS=[0x4a6f96,0x8e3b3b,0x5d4a3a,0x4f7a43,0x6b6f78,0x3f5f3a,0x5a4a6e,0x8a6a3a,0xb8b2a2,0x2c2c30,0x9a4a2a,0x2f5d63,0xc9a94a,0x7a2e4a,0xd8d4c8,0x3a4a6a];
    const topC=O.cloth??(uni?CLOTH[spec.clothIdx??ti]:pick(TOPS)), pantC=O.pants??(uni?PANTS:pick([0x2c3340,0x1f2228,0x4a4030,0x5a5f66,0x3a4a6a,0x6a5a40,0x2a3a2a]));
    const V=uni?{sleeve:"short",hair:"short",hx:1,hy:1,jaw:1,nose:1}:{sleeve:O.cloth?"long":pick(["short","short","long","tank"]),
      hair:P.wet?"long":P.char?"bald":pick(fem?["long","long","bun","short","afro","bald"]:["short","short","buzz","bald","afro","long"]),
      hx:1+(VR()-.5)*.16,hy:1+(VR()-.5)*.14,jaw:1+(VR()-.5)*.3,nose:1+(VR()-.5)*.5,
      beard:!fem&&VR()<.25,glasses:VR()<.12,cap:!O.hat&&VR()<.12,capC:pick([0x8e3b3b,0x2c2c30,0x3a4a6a,0xc9a94a]),bag:VR()<.15,bagC:pick([0x3a4a3a,0x5a2a24,0x2c3340]),torn:VR()<.35,apron:VR()<.05};
    const hairC=spec.hair??(life===2?0xb9b6ae:pick([0x1a1410,0x2a1e16,0x3b2c20,0x6a4a2a,0xb08a50,0x7a2a1a]));
    const skinFinal=P.char?0x1c1612:P.wet?col(skinC,0x7a8fa0,.55):skinC;
    const skinM=M(skinFinal);
    const topM=M(P.char?col(topC,0x151210,.75):P.wet?col(topC,0x1a2230,.45):col(topC,GRAY,d*.3)), pantsM=M(col(pantC,GRAY,d*.3)), shoeM=M(uni?0x1d1f22:pick([0x1d1f22,0x3a2a1a,0xb8b4a8,0x4a1a1a])), red=M(RED);
    const add=(p,geo,m,x,y,z,rx,ry,rz)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);p.add(o);return o};
    const ball=(p,r,m,x,y,z)=>add(p,new THREE.SphereGeometry(r,SEG,12),m,x,y,z);
    // sangue no corpo: mancha plana irregular colada na roupa (mesma forma BLOB do chão), com satélites; n>0 deixa um filete escorrendo
    const SKM={},skM=c=>SKM[c]||(SKM[c]=new THREE.MeshStandardMaterial({color:c,roughness:.3,metalness:0,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
    const flat=(p,x,y,zz,sx,sy,c)=>{const m=new THREE.Mesh(BLOB,skM(c));m.rotation.set(PI/2,0,Math.random()*6.28);m.scale.set(sx,1,sy);m.position.set(x,y,zz);p.add(m);return m};
    const splat=(p,x,y,zz,r,c,n)=>{const a=flat(p,x,y,zz+.004,r,r*(.7+Math.random()*.5),c);
      for(let k=0;k<(n||0);k++){const an=Math.random()*6.28,dd=r*(1.2+Math.random()*.9),q=r*(.12+Math.random()*.18);flat(p,x+Math.cos(an)*dd,y+Math.sin(an)*dd,zz+.004,q,q*.7,c)}
      if(n)run(p,x+r*.15,y-r*.5,y-r*(2.2+Math.random()*1.2),zz+.003,zz,c,r*.35);return a};
    // filete: desce pela pele/roupa afinando e termina num bulbo (é dali que a gota cai)
    const run=(p,x,y0,y1,z0,z1,c,w)=>{const L=y0-y1,sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.quadraticCurveTo(w*.3,-L*.5,w*.18,-L);sh.lineTo(-w*.12,-L);sh.quadraticCurveTo(-w*.35,-L*.5,-w/2,0);
      const g=new THREE.ShapeGeometry(sh),m=new THREE.Mesh(g,skM(c));m.position.set(x,y0,z0);m.rotation.x=-Math.atan2(z0-z1,L);p.add(m);
      const bl=new THREE.Mesh(new THREE.SphereGeometry(w*.42,10,8),skM(c));bl.scale.set(1,1.35,.5);bl.position.set(x+w*.03,y1,z1);p.add(bl);return bl};
    const stump=(p,r,y,up)=>{const st=ball(p,r*1.02,red,0,y,0);st.scale.set(1,.35,1);add(p,new THREE.CylinderGeometry(r*.32,r*.36,.07,10),M(0xe8e0cc),0,y+(up?.04:-.04),0)};
    const ring=(p,r,h,m,y,sx,sz)=>{const o=add(p,new THREE.CylinderGeometry(r,r,h,24),m,0,y,0);o.scale.set(sx||1.12,1,sz||.7);return o};
    const root=new THREE.Group(), fig=new THREE.Group();
    const drip=(p,x,y,zz,kind,every)=>{if(d>=3&&kind!=="bile")return;const o=new THREE.Object3D();o.position.set(x,y,zz);o.userData.drip={kind:kind||(d<1?"blood":"old"),every:every||(d<1?1.2:2.4)};p.add(o)};
    fig.scale.set(P.s*P.bulk,P.s,P.s*Math.min(1.15,P.bulk));fig.position.y=P.drop*P.s;root.add(fig);
    // quadril e pernas
    const pel=ball(fig,.2,pantsM,0,.92,0);pel.scale.set(fem?1.16:1.08,.62,.74);
    const legs=[];
    [[-1,P.legL,P.kneeL],[1,P.legR,P.kneeR]].forEach(([s,r,kr])=>{
      const g=new THREE.Group();g.position.set(s*(fem?.115:.105),.9,0);fig.add(g);
      add(g,cylDown(P.bloat?.13:fem?.11:.105,P.bloat?.095:.078,.42),pantsM);
      const kn=new THREE.Group();kn.position.y=-.42;g.add(kn);
      ball(kn,.078,pantsM);
      const lost=P.noLegs||cut.legs;
      if(lost){stump(kn,.08,-.01);drip(kn,0,-.05,0,null,1);g.rotation.x=1.45}
      else{add(kn,cylDown(.077,.056,.38),pantsM);const sh=ball(kn,.075,shoeM,0,-.43,.06);sh.scale.set(.95,.7,1.75);
        g.rotation.x=r;kn.rotation.x=kr}
      legs.push({g,kn,s,base:g.rotation.x,kBase:kn.rotation.x,lost});
    });
    // tronco com pivô no quadril
    const upper=new THREE.Group();upper.position.y=.9;upper.rotation.x=P.lean;fig.add(upper);
    const U=new THREE.Group();U.position.y=-.9;upper.add(U);
    let frontZ=.175;
    if(P.bloat){
      // Inchado: pele esticada e esverdeada, barriga caída por baixo da camisa curta, pústulas que brilham
      const sick=col(skinC,0x7f9a52,.45), sickM=M(sick), veinM=M(col(sick,0x2a3a1a,.55));
      const chest=add(U,torsoGeo(1.25,1.35),topM);chest.scale.set(1,1,1);
      const belly=add(U,new THREE.SphereGeometry(.34,24,18),sickM,0,1.06,.1);belly.scale.set(1.12,1,1.08);
      const shirt=add(U,new THREE.SphereGeometry(.355,24,10,0,PI*2,0,PI*.42),topM,0,1.08,.1);shirt.scale.set(1.12,1,1.08);
      for(let k=0;k<7;k++){const a=-1+k*.33+Math.sin(k*3.1)*.12,b=.05+((k*37)%5)*.11;const vv=add(U,new THREE.SphereGeometry(.012,8,6),veinM,Math.sin(a)*.36,1.0-b*.5,.1+Math.cos(a)*.36);vv.scale.set(1,6,1);vv.rotation.z=a*.8}
      const pus=[[.12,1.0],[-.17,.92],[.02,.86],[-.06,1.12],[.2,.88],[-.22,1.05]];
      drip(U,.05,.8,.3,"bile",1.6);pus.forEach(([x,y],k)=>{const zz=.1+Math.sqrt(Math.max(.01,.34*.34-x*x/1.25-(y-1.06)**2))*1.08;const r=.022+(k%3)*.01;
        add(U,new THREE.SphereGeometry(r,10,8),basic(z.eye),x,y,zz);const g=glow(z.eye,r*5,.55);g.position.set(x,y,zz+.02);U.add(g)});
      add(U,new THREE.CylinderGeometry(.09,.1,.12,16),sickM,0,1.62,0);
      frontZ=.38;
    }else add(U,torsoGeo(1,1,fem),topM);
    if(P.char){const emb=[[.1,1.2,.17],[-.12,1.35,.17],[.02,1.02,.16],[-.15,1.08,.15],[.16,1.42,.15],[0,1.5,-.15],[.12,1.1,-.16]];
      emb.forEach(([x,y,zz])=>{const c=add(U,new THREE.SphereGeometry(.018,8,6),basic(0xff6a1a),x,y,zz);c.scale.set(2.2,.6,.5);const g=glow(0xff5a10,.12,.7);g.position.set(x,y,zz*1.1);U.add(g)});
      emb.forEach(([x,y,zz],k)=>{if(k%2)return;const o=new THREE.Object3D();o.position.set(x,y,zz*1.1);o.userData.ember={smoke:k===0||k===4};U.add(o)})}
    if(P.gore){splat(U,0,1.4,frontZ+.01,.07,0x8a0a0a,5);splat(U,-.08,1.18,frontZ+.01,.05,0x8a0a0a,3)}
    if(V.bag&&!P.bloat){const bm=M(V.bagC),sm=M(col(V.bagC,0x111111,.5));const b=ball(U,.2,bm,0,1.22,-.25);b.scale.set(1.05,1.25,.62);const f=ball(U,.12,bm,0,1.12,-.36);f.scale.set(1.2,.8,.5);
      [-1,1].forEach(sx=>{const st=add(U,new THREE.TorusGeometry(.2,.018,6,18,PI*1.1),sm,sx*.14,1.3,0);st.rotation.set(0,PI/2,0)})}
    if(spec.type==="Brutamonte"){[-1,1].forEach(sx=>{const t=ball(U,.17,topM,sx*.2,1.53,-.03);t.scale.set(1.2,.8,1)});const hb=ball(U,.2,topM,0,1.45,-.12);hb.scale.set(1.5,.9,.8)}
    if(O.vest){const v=add(U,new THREE.CylinderGeometry(.275,.24,.48,24),M(O.vest),0,1.3,0);v.scale.set(1.12,1,.7);for(let i=0;i<3;i++)add(U,geoBox(.11,.13,.05),M(O.vest),-.15+i*.15,1.17,.17)}
    if(O.stripes){ring(U,.205,.05,M(O.stripes),1.03,1.13,.68);ring(U,.268,.05,M(O.stripes),1.42,1.13,.67)}
    if(d===3&&!P.bloat)[0,1,2].forEach(k=>add(U,geoBox(.2,.022,.02),M(0xd8cfb8),0,1.3+k*.065,.168));
    if(!spec.human){const wy=P.bloat?1.25:1.36,hy=P.bloat?1.02:.98;run(U,.08,wy-.03,hy,frontZ+.012,frontZ-.01,col(BLOOD[d],0x1a0806,.35),.022);drip(U,.083,hy-.012,frontZ-.005);const bs=.07+.05*(3-d);splat(U,.07,P.bloat?1.25:1.36,frontZ+(O.vest?.02:0),bs*.32,col(BLOOD[d],0x1a0806,.35),d<2?3:1)}
    for(let k=0;k<(spec.wounds||0);k++)splat(U,-.13+k*.13,1.15+.13*(k%2),frontZ+.012,.032,0x2a0503,2);
    if(cut.gut){const gm=M(0xb04a50);for(let k=0;k<6;k++){const q=add(U,new THREE.TorusGeometry(.05,.022,6,10),gm,(k%2?.04:-.03),1.0-k*.06,frontZ+.02,0,k*.7,0);q.userData.flap=true}
      const hole=ball(U,.1,red,0,1.05,frontZ-.03);hole.scale.set(1.2,1,.3);drip(U,0,.75,frontZ+.02,null,.5)}
    if(cut.flaps){[[.12,1.2],[-.1,1.35],[.02,.98]].forEach(([x,y],k)=>{const f=add(U,geoBox(.07,.12,.012),k%2?skinM:M(0x9a2a2a),x,y,frontZ+.03);f.geometry.translate(0,-.06,0);f.userData.flap=true;drip(U,x,y-.12,frontZ+.03,null,1.5)})}
    // pescoço e cabeça
    const neckLen=.14+Math.max(0,P.neck);
    if(!cut.head)add(U,new THREE.CylinderGeometry(.058,.068,neckLen,SEG),skinM,0,1.63+Math.max(0,P.neck)/2,0);
    const headG=new THREE.Group();headG.position.set(0,1.64+P.neck,P.headFwd||0);headG.rotation.x=P.headX;headG.rotation.z=P.headZ;U.add(headG);
    const Hd=new THREE.Group();Hd.position.y=-1.64;headG.add(Hd);
    if(cut.head){
      const jaw=add(Hd,new THREE.SphereGeometry(.12,16,12),skinM,0,1.69,.03);jaw.scale.set(1,.6,1);
      drip(U,0,1.6,.1,null,.6);const hst=ball(Hd,.11,red,0,1.74,.02);hst.scale.set(1,.35,1);add(Hd,new THREE.CylinderGeometry(.03,.035,.08,10),M(0xe8e0cc),0,1.78,0);splat(U,0,1.5,.2,.05,BLOOD[0],3);
    }else{
      if(cut.blown){head0:{const hb=add(Hd,new THREE.SphereGeometry(.165,20,16,0,PI*2,PI*.55,PI*.45),skinM,0,1.8,0);hb.scale.set(.96,1.1,1.02);const cv=ball(Hd,.15,red,0,1.82,0);cv.scale.set(.95,.3,.95);
        for(let k=0;k<5;k++){const f=ball(Hd,.03,k%2?M(0xe8e0cc):red,Math.cos(k*1.3)*.13,1.86,Math.sin(k*1.3)*.13);f.scale.set(1.4,.6,.9)};drip(Hd,0,1.7,.1,null,.4)}}
      const head=add(Hd,new THREE.SphereGeometry(.165,20,16),skinM,0,1.8,0);if(cut.blown)head.visible=false;head.scale.set(.96*V.hx*(P.bloat?1.12:1),1.1*V.hy,1.02*(P.bloat?1.08:1));
      const jaw=add(Hd,new THREE.SphereGeometry(.12,16,12),skinM,0,1.715,.03);jaw.scale.set(V.jaw*(P.bloat?1.3:1),.72*(P.bloat?1.25:1),1);
      if(cut.jaw){jaw.geometry.translate(0,0,.06);jaw.position.set(.03,1.70,-.04);jaw.rotation.set(.75,0,.35);add(Hd,new THREE.SphereGeometry(.07,10,8),red,0,1.72,.11).scale.set(1.3,.5,.4);drip(Hd,.02,1.6,.12,null,.6);jaw.userData.flap=true}
      [-1,1].forEach(s=>{const e=ball(Hd,.038,skinM,s*.158,1.79,-.005);e.scale.set(.6,1,.9)});
      const nose=add(Hd,geoBox(.045,.065,.05),skinM,0,1.765,.172);nose.scale.set(V.nose,V.nose,1);if(P.nose)nose.scale.set(1.5,1.4,2.2);
      let covered=false;
      if(O.hat){const c=M(O.hatC);covered=true;
        if(O.hat==="cap"){const o=add(Hd,capGeo(.182),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,geoBox(.28,.022,.17),c,0,1.85,.2,.12,0,0)}
        if(O.hat==="helmet"){const o=add(Hd,capGeo(.205,PI*.55),c,0,1.82,-.01);o.scale.set(1,1,1.08)}
        if(O.hat==="hardhat"){const o=add(Hd,capGeo(.198),c,0,1.86,0);o.scale.set(1,1.02,1.08);add(Hd,new THREE.CylinderGeometry(.25,.25,.02,24),c,0,1.865,.02)}
        if(O.hat==="fire"){const o=add(Hd,capGeo(.205),c,0,1.86,0);o.scale.set(1,1.02,1.1);const br=add(Hd,new THREE.CylinderGeometry(.27,.27,.02,24),c,0,1.86,-.06);br.scale.set(1,1,1.25);add(Hd,geoBox(.09,.08,.02),M(0xd8b040),0,1.96,.205)}
        if(O.hat==="moto"){const o=add(Hd,new THREE.SphereGeometry(.235,20,16),c,0,1.81,-.01);o.scale.set(.98,1.04,1.06);add(Hd,new THREE.SphereGeometry(.226,20,6,PI*.18,PI*.64,PI*.36,PI*.2),new THREE.MeshLambertMaterial({color:0x22303c}),0,1.81,.02)}}
      if(O.mask)add(Hd,geoBox(.24,.12,.04),M(0xe8eef0),0,1.72,.15);
      if(!covered&&V.cap){const c=M(V.capC);const o=add(Hd,capGeo(.182),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,geoBox(.28,.022,.17),c,0,1.85,.2,.12,0,0);covered=true}
      const hc=M(hairC);
      if(!cut.blown&&!(d===3&&VR()<.6)){
        const hairCap=(r,len,tilt)=>{const o=add(Hd,capGeo(r,len),hc,0,1.8,-.004);o.scale.set(.97*V.hx,1.1*V.hy,1.04);o.rotation.x=tilt;return o};
        const backBand=(t0,tl)=>{const o=add(Hd,new THREE.SphereGeometry(.172,20,8,PI*.85,PI*1.3,t0,tl),hc,0,1.8,0);o.scale.set(.97*V.hx,1.1*V.hy,1.04);return o};
        const hs=V.hair;
        if(!covered&&(hs==="short"||hs==="bun"||hs==="long"))hairCap(.174,PI/2,-.38);
        if(hs==="short"||hs==="bun"||hs==="long")backBand(PI*.45,PI*.22);
        if(!covered&&hs==="bun")ball(Hd,.085,hc,0,1.92,-.15);
        if(hs==="long"){const l=add(Hd,new THREE.CylinderGeometry(.15,.12,.42,16,1,false,PI*.6,PI*.8),hc,0,1.66,-.02);l.scale.set(1.05,1,1.1)}
        if(!covered&&hs==="buzz")hairCap(.17,PI*.45,-.32);
        if(hs==="bald")backBand(PI*.42,PI*.2);
        if(!covered&&hs==="afro"){const a=add(Hd,new THREE.SphereGeometry(.25,16,12),hc,0,1.9,-.045);a.scale.set(1.08,.9,1.02)}
      }
      if(V.beard){const b=add(Hd,new THREE.SphereGeometry(.128,16,12),hc,0,1.7,.035);b.scale.set(1.02*V.jaw,.78,1)}
      if(V.glasses){add(Hd,geoBox(.27,.012,.015),M(0x1a1a1a),0,1.84,.175);[-1,1].forEach(s=>{add(Hd,geoBox(.09,.055,.012),new THREE.MeshLambertMaterial({color:0x8fb0c0,transparent:true,opacity:.3}),s*.06,1.817,.18);add(Hd,geoBox(.012,.012,.17),M(0x1a1a1a),s*.15,1.83,.09)})}
      if(P.mouth){const m=add(Hd,geoBox(.1,.09,.03),basic(0x050505),0,1.69,.14)}
      if(P.gore)splat(Hd,0,1.7,.15,.05,0x8a0a0a,3);
      else if(!spec.human){add(Hd,geoBox(.1,.035,.02),M(0x3a0a08),0,1.69,.145)}
      const moto=O.hat==="moto", eyeZ=moto?.245:.162, dim=spec.eyeDim??(P.dim||moto), eye=spec.eye??z.eye;
      [-1,1].forEach(s=>{
        if(cut.blown)return;
        if(P.blind&&!spec.human){add(Hd,new THREE.SphereGeometry(.03,10,8),M(0xe8e4d8),s*.058,1.815,.152);return}
        if(spec.human||spec.eyesOff){add(Hd,geoBox(.05,.028,.02),basic(spec.human?0x1a1a1a:0x2a2a22),s*.058,1.815,.158);return}
        add(Hd,geoBox(.052,.03,.02),basic(eye),s*.058,1.815,eyeZ);
        const g=glow(eye,dim?.1:.15,dim?.3:.85);g.position.set(s*.058,1.815,eyeZ+.025);Hd.add(g);
      });
    }
    // braços: ombro -> cotovelo -> mão
    const arms=[];
    [[1,P.armR,P.elbR,cut.armR],[-1,P.armL,P.elbL,cut.armL]].forEach(([s,r,er,isCut])=>{
      const g=new THREE.Group();g.position.set(s*(P.bloat?.37:fem?.285:.305),1.475,0);U.add(g);
      const upM=V.sleeve==="tank"?skinM:topM, foreM=V.sleeve==="long"?topM:skinM, ab=P.bloat?1.35:1;
      ball(g,.088*ab,upM);add(g,cylDown(.083*ab,.075*ab,.31),upM);
      const el=new THREE.Group();el.position.y=-.31;g.add(el);
      if(isCut){stump(el,.07,0);drip(el,0,-.05,0,null,.9)}
      else{ball(el,.06*ab,foreM);add(el,cylDown(.06*ab,.046*ab,.29),foreM);const h=ball(el,.055*ab,skinM,0,-.33,.005);h.scale.set(.85,1.15,.7);
        if(spec.bandage&&s<0)add(el,new THREE.CylinderGeometry(.068,.064,.09,SEG),M(0xe8e4d8),0,-.17,0)}
      const dang=(s>0?cut.dangleR:cut.dangleL);if(dang&&!isCut){const fl=add(el,new THREE.CylinderGeometry(.065,.05,.06,10),red,0,.01,0);drip(el,0,-.33,0,null,.8);el.userData.dangle=true}
      if((s>0?cut.shoulderR:cut.shoulderL)){g.children.slice().forEach(c=>{if(c!==el)g.remove(c)});el.visible=false;stump(g,.085,0);drip(g,0,-.05,0,null,.7)}
      g.rotation.x=r;g.rotation.z=s*(.07+(P.armOut||0));el.rotation.x=isCut?0:er;
      arms.push({g,el,s,base:r,eBase:el.rotation.x});
    });
    const flaps=[];root.traverse(o=>{if(o.userData.flap)flaps.push(o)});
    const rig={flaps,dangles:arms.filter(a=>a.el.userData.dangle),type:spec.type||"Lento",fig,upper,headG,arms,legs,P,ph:(spec.phase??Math.random()*6),dropBase:fig.position.y,leanBase:P.lean,hxBase:P.headX};
    if(spec.lying){root.rotation.x=-PI/2;root.position.set(0,.16*P.s,.9*P.s);const w=new THREE.Group();w.add(root);return w}
    root.userData.rig=rig;return root;
  }

  // andar próprio de cada tipo (offsets sobre a pose base)
  const GAIT={
    Lento:{f:1.1,a:.28,k:.35,drag:true,arm:.08},
    Corredor:{f:3.1,a:.75,k:1.1,arm:.12,bob:.05},
    Brutamonte:{f:.9,a:.3,k:.3,arm:.15,bob:.04,sway:.05},
    Rastejante:{f:1,crawl:true},
    Gritador:{f:.8,idle:true},
    Inchado:{f:.9,a:.18,k:.15,sway:.09,arm:.1},
    Espreitador:{f:.7,a:.12,k:.15,arm:.25,stalk:true},
    Farejador:{f:1.6,a:.4,k:.45,arm:.1,sniff:true},
    Saltador:{f:.42,leap:true},
    Cego:{f:.5,listen:true},
    Afogado:{f:.9,a:.25,k:.25,arm:.06,drag:true},
    Carbonizado:{f:1.1,a:.3,k:.35,arm:.12,bob:.03},
    Devorador:{f:1.3,eat:true}
  };
  function animate(obj,t){const R=obj.userData.rig;if(!R)return;animate0(obj,t);
    R.dangles.forEach(a=>{a.el.rotation.x=-(a.g.rotation.x+R.upper.rotation.x)+Math.sin(t*3.2+R.ph)*.3});
    R.flaps.forEach((f,i)=>{f.rotation.x=(f.userData.rx0??(f.userData.rx0=f.rotation.x))+Math.sin(t*4+i+R.ph)*.18})}
  function animate0(obj,t){
    const R=obj.userData.rig;if(!R)return;const G=GAIT[R.type]||GAIT.Lento,p=t*G.f*2*PI+R.ph,sn=Math.sin(p),cs=Math.cos(p);
    if(G.leap){const c=(t*G.f+R.ph/6.3)%1,air=c<.38?Math.sin(c/.38*PI):0;R.fig.position.y=R.dropBase+air*.95;R.upper.rotation.x=R.leanBase-air*.45;
      R.legs.forEach(l=>{l.g.rotation.x=l.base*(1-air*.7);l.kn.rotation.x=l.kBase*(1-air*.75)});R.arms.forEach(a=>{a.g.rotation.x=a.base-air*2.3;a.el.rotation.x=a.eBase*(1-air)});return}
    if(G.listen){R.headG.rotation.y=Math.sin(t*.7+R.ph)*.6;R.arms.forEach((a,i)=>a.g.rotation.x=a.base+Math.sin(t*.9+i)*.08);return}
    if(G.eat){const q=Math.sin(t*G.f*2*PI+R.ph);R.headG.rotation.x=R.hxBase+Math.max(0,q)*.35;R.upper.rotation.x=R.leanBase+Math.max(0,q)*.08;R.arms.forEach(a=>a.el.rotation.x=a.eBase+q*.2);return}
    if(G.crawl){R.arms.forEach((a,i)=>{const q=i?sn:-sn;a.g.rotation.x=a.base+q*.35;a.el.rotation.x=a.eBase-Math.max(0,q)*.6});R.upper.rotation.z=sn*.06;return}
    if(G.idle){const sc=Math.max(0,Math.sin(t*.9+R.ph));R.upper.rotation.x=R.leanBase-sc*.18;R.headG.rotation.x=R.hxBase-sc*.25;R.arms.forEach(a=>a.g.rotation.x=a.base+sc*.25);return}
    R.legs.forEach((l,i)=>{if(l.lost)return;const q=i?-sn:sn;
      if(G.drag&&i===1){l.g.rotation.x=l.base+q*G.a*.35;l.kn.rotation.x=l.kBase;return}
      l.g.rotation.x=l.base+q*G.a;l.kn.rotation.x=l.kBase+Math.max(0,(i?cs:-cs))*G.k});
    R.arms.forEach((a,i)=>{const q=i?sn:-sn;a.g.rotation.x=a.base+q*(G.arm||.1)});
    R.fig.position.y=R.dropBase-Math.abs(cs)*(G.bob||.02);
    R.upper.rotation.y=sn*.06;R.upper.rotation.z=(G.sway||0)*sn+(G.drag?.04:0);
    if(G.stalk)R.upper.rotation.x=R.leanBase+sn*.04;
    if(G.sniff)R.headG.rotation.y=Math.sin(t*3.1+R.ph)*.35;
  }
  // ---------- movimento em cascata: cada junta chega na pose com um atraso, do quadril para a cabeça ----------
  const CASC={hip:16,spine:11,shoulder:9,elbow:7,leg:14,knee:11,head:6};
  function cascade(R,dt){
    if(!R.cur){R.cur=new Map();R.jl=[[R.fig.position,"y","hip"],[R.upper.rotation,"x","spine"],[R.upper.rotation,"y","spine"],[R.upper.rotation,"z","spine"],
      [R.headG.rotation,"x","head"],[R.headG.rotation,"y","head"],[R.headG.rotation,"z","head"]];
      R.arms.forEach(a=>{R.jl.push([a.g.rotation,"x","shoulder"],[a.el.rotation,"x","elbow"])});
      R.legs.forEach(l=>{R.jl.push([l.g.rotation,"x","leg"],[l.kn.rotation,"x","knee"])});
      R.jl.forEach(j=>R.cur.set(j,j[0][j[1]]));return}
    R.jl.forEach(j=>{const c=R.cur.get(j),tg=j[0][j[1]],v=c+(tg-c)*Math.min(1,dt*CASC[j[2]]);R.cur.set(j,v);j[0][j[1]]=v});
  }
  // pose por nome de junta (alvo); a cascata faz o caminho
  function setPose(R,q){
    if(q.lean!=null)R.upper.rotation.x=q.lean;if(q.twist!=null)R.upper.rotation.y=q.twist;if(q.side!=null)R.upper.rotation.z=q.side;
    if(q.drop!=null)R.fig.position.y=R.dropBase+q.drop;
    if(q.headX!=null)R.headG.rotation.x=q.headX;if(q.headY!=null)R.headG.rotation.y=q.headY;if(q.headZ!=null)R.headG.rotation.z=q.headZ;
    const [aR,aL]=R.arms;if(q.armR!=null)aR.g.rotation.x=q.armR;if(q.armL!=null)aL.g.rotation.x=q.armL;if(q.elbR!=null)aR.el.rotation.x=q.elbR;if(q.elbL!=null)aL.el.rotation.x=q.elbL;
    if(q.armRz!=null)aR.g.rotation.z=q.armRz;if(q.armLz!=null)aL.g.rotation.z=q.armLz;
    const [lL,lR]=R.legs;if(q.legL!=null)lL.g.rotation.x=q.legL;if(q.legR!=null)lR.g.rotation.x=q.legR;if(q.kneeL!=null)lL.kn.rotation.x=q.kneeL;if(q.kneeR!=null)lR.kn.rotation.x=q.kneeR;
  }
  const lerpPose=(a,b,k)=>{const o={};for(const n in b)o[n]=a[n]==null?b[n]:a[n]+(b[n]-a[n])*k;return o};

  // ---------- fluidos vivos: pingam, escorrem, a poça espalha, ondula e seca ----------
  // ---------- partículas: puffs opacos que se desfazem por ruído, faíscas e névoa ----------
  const TEX=(()=>{const mk=(fn)=>{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d"),im=x.createImageData(64,64);
      for(let j=0;j<64;j++)for(let i=0;i<64;i++){const [l,a]=fn(i,j);const k=(j*64+i)*4;im.data[k]=im.data[k+1]=im.data[k+2]=l*255;im.data[k+3]=a*255}
      x.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);return t};
    const R=rng(77),N=[];for(let i=0;i<256;i++)N.push(R());
    const vn=(u,v)=>{const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,s=t=>t*t*(3-2*t),g=(a,b)=>N[((a&15)*16+(b&15))],
      a=g(i,j),b=g(i+1,j),c=g(i,j+1),d=g(i+1,j+1);return a+(b-a)*s(fu)+(c-a)*s(fv)+(a-b-c+d)*s(fu)*s(fv)};
    const puff=mk((i,j)=>{const dx=(i-31.5)/31.5,dy=(j-31.5)/31.5,r=Math.hypot(dx,dy),n=.55*vn(i/8,j/8)+.3*vn(i/4,j/4)+.15*vn(i/2,j/2);
      const a=Math.max(0,Math.min(1,(1-r)*1.7))*(.25+.75*n);return [.72+.28*(1-r)*n,a]});
    const spark=mk((i,j)=>{const r=Math.hypot(i-31.5,j-31.5)/31.5;return [1,Math.max(0,1-r)**2.2]});
    return{puff,spark}})();
  const TC=new THREE.Color();
  function Particles(par){
    const P=[],self={P};
    // dissolve: o limiar de alfa sobe com a idade, então a nuvem continua opaca e some comendo as bordas pelo ruído
    const dmat=(c)=>{const m=new THREE.SpriteMaterial({map:TEX.puff,color:c,transparent:true,depthWrite:false});m.userData.thr={value:0};
      m.onBeforeCompile=sh=>{sh.uniforms.uThr=m.userData.thr;sh.fragmentShader="uniform float uThr;\n"+sh.fragmentShader.replace("#include <alphatest_fragment>","if(diffuseColor.a<uThr)discard;diffuseColor.a=clamp((diffuseColor.a-uThr)*9.,0.,1.)*opacity;")};
      m.customProgramCacheKey=()=>"dissolve";return m};
    self.emit=o=>{if(P.length>700)return;
      const m=o.dissolve?dmat(o.c):new THREE.SpriteMaterial({map:o.spark?TEX.spark:TEX.puff,color:o.c,transparent:true,depthWrite:false,opacity:o.op??1,blending:o.add?THREE.AdditiveBlending:THREE.NormalBlending});
      m.rotation=Math.random()*6.28;const s=new THREE.Sprite(m);s.position.copy(o.p);s.scale.setScalar(o.s0);par.add(s);
      P.push(Object.assign({s,age:0,ph:Math.random()*6,spin:(Math.random()-.5)*.8},o,{v:(o.v||new V3()).clone()}))};
    self.step=dt=>{for(let i=P.length-1;i>=0;i--){const q=P[i];q.age+=dt;const k=q.age/q.life;
        if(k>=1){par.remove(q.s);q.s.material.dispose();P.splice(i,1);continue}
        q.v.y+=(q.g??0)*dt;q.v.multiplyScalar(Math.max(0,1-(q.drag??0)*dt));
        if(q.wig){q.v.x+=Math.sin(q.age*7+q.ph)*q.wig*dt;q.v.z+=Math.cos(q.age*6+q.ph)*q.wig*dt}
        q.s.position.addScaledVector(q.v,dt);if(q.s.position.y<(q.floor??-9)){q.s.position.y=q.floor;q.v.multiplyScalar(.2);q.v.y=0}
        q.s.scale.setScalar(q.s0+(q.s1-q.s0)*(1-(1-k)*(1-k)));q.s.material.rotation+=q.spin*dt;
        if(q.c1!=null)q.s.material.color.set(q.c).lerp(TC.set(q.c1),Math.min(1,k*(q.cs??1)));
        if(q.dissolve)q.s.material.userData.thr.value=.03+.95*Math.pow(k,q.dp??1.4);
        else q.s.material.opacity=(q.op??1)*(k<.15&&q.fadeIn?k/.15:1)*(1-k)}};
    self.clear=()=>{P.forEach(q=>{par.remove(q.s);q.s.material.dispose()});P.length=0};
    // receitas
    self.burst=(p,n,o)=>{for(let i=0;i<n;i++){const a=Math.random()*6.28,e=(o.up??.3)+Math.random()*(o.upr??.5),sp=o.sp*(.5+Math.random()*.7);
      self.emit(Object.assign({p:p.clone().add(new V3((Math.random()-.5)*(o.jit??.2),(Math.random()-.5)*(o.jit??.2),(Math.random()-.5)*(o.jit??.2))),
        v:new V3(Math.cos(a)*sp,e*sp,Math.sin(a)*sp),life:o.life*(.7+Math.random()*.6),s0:o.s0*(.7+Math.random()*.6),s1:o.s1*(.7+Math.random()*.6)},o))}};
    return self;
  }
  // explosão padrão: clarão, bola de fogo que vira fumaça, poeira no chão e coluna de fumaça
  function blast(PS,p,sc){sc=sc||1;
    PS.emit({p:p.clone().add(new V3(0,.4*sc,0)),c:0xfff0c0,add:true,spark:true,s0:3*sc,s1:6*sc,life:.25,op:1});
    PS.burst(p.clone().add(new V3(0,.5*sc,0)),22,{c:0xffb040,c1:0x2a2622,cs:2.2,dissolve:true,sp:5*sc,drag:4,up:.2,upr:.6,g:1.2,life:1.8,s0:.5*sc,s1:1.6*sc,dp:1.8});
    PS.burst(p.clone().add(new V3(0,.15,0)),18,{c:0x6a6258,c1:0x4a4640,dissolve:true,sp:6*sc,drag:3,up:0,upr:.12,life:3.2,s0:.4*sc,s1:1.5*sc,floor:.1});
    PS.burst(p.clone().add(new V3(0,1*sc,0)),10,{c:0x2e2a26,dissolve:true,sp:.8,drag:.5,up:2,upr:1,g:.4,life:4.5,s0:.6*sc,s1:2*sc,wig:.6});
    PS.burst(p.clone().add(new V3(0,.4,0)),26,{c:0xffc060,c1:0xff4010,spark:true,add:true,sp:9*sc,drag:1.2,up:.3,upr:.9,g:-9.8,life:1.1,s0:.06,s1:.03,floor:.02})}
  // ---------- fluidos: marca irregular (coroa serrilhada + satélites), material iluminado único, seca pela borda e perde o brilho ----------
  const BLOB=(()=>{const sh=new THREE.Shape(),N=64,R=rng(123),a=[R()*6,R()*6,R()*6];
    for(let i=0;i<N;i++){const t=i/N*6.2832,r=1+.14*Math.sin(3*t+a[0])+.08*Math.sin(5*t+a[1])+.05*Math.sin(9*t+a[2])+(R()-.5)*.1+(i%5===0?R()*.22:0);
      i?sh.lineTo(Math.cos(t)*r,Math.sin(t)*r):sh.moveTo(Math.cos(t)*r,Math.sin(t)*r)}
    sh.closePath();const g=new THREE.ShapeGeometry(sh);g.rotateX(-PI/2);return g})();
  function FluidMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    m.onBeforeCompile=sh=>{
      sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aWet;attribute vec3 aDry;varying float vWet;varying vec3 vDry;varying float vR;")
        .replace("#include <begin_vertex>","#include <begin_vertex>\nvWet=aWet;vDry=aDry;vR=length(position.xz);");
      // a borda seca primeiro; molhado brilha (rugosidade 0,08), seco fica fosco (0,95)
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying float vWet;varying vec3 vDry;varying float vR;")
        .replace("#include <color_fragment>","float wl=clamp(vWet*1.6-vR*.6,0.,1.);diffuseColor.rgb=mix(vDry,vColor,wl);")
        .replace("#include <roughnessmap_fragment>","float roughnessFactor=mix(.95,.08,wl);")};
    m.customProgramCacheKey=()=>"fluid";return m}
  const MARKM={};
  // marca parada para as cenas: alongada na direção do golpe, com satélites atrás
  function mark(par,x,z,r,c,o){o=o||{};const m=MARKM[c]||(MARKM[c]=new THREE.MeshStandardMaterial({color:c,roughness:o.rough??.25,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    const dir=o.dir??Math.random()*6.28,el=o.elong??1.3,g=new THREE.Group();g.position.set(x,.008,z);g.rotation.y=dir;par.add(g);
    const b=new THREE.Mesh(BLOB,m);b.scale.set(r*el,1,r/el);b.rotation.y=Math.random()*.4;g.add(b);
    const n=o.sat??(2+Math.floor(Math.random()*4));for(let k=0;k<n;k++){const s=new THREE.Mesh(BLOB,m),d=r*(1.3+Math.random()*1.4*el);s.position.set(d,0,(Math.random()-.5)*r*1.2);const q=r*(.08+Math.random()*.14);s.scale.set(q*1.6,1,q);s.rotation.y=(Math.random()-.5)*.6;g.add(s)}
    return g}
  // poça grande parada: lóbulos a partir da ferida, mais escura e grossa no meio, borda mais fina que seca primeiro
  function poolMark(par,x,z,r,wc,dc,dir){const u={uWet:{value:1},uC:{value:new THREE.Color(wc)},uD:{value:new THREE.Color(dc)}};
    const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
      sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying float vR;").replace("#include <begin_vertex>","#include <begin_vertex>\nvR=length(position.xz);");
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uWet;uniform vec3 uC;uniform vec3 uD;varying float vR;")
        .replace("#include <color_fragment>","float wl=clamp(uWet*1.7-vR*.7,0.,1.);vec3 wc=mix(uC*.95,uC*.42,smoothstep(.95,.2,vR));vec3 dc=mix(uD*.85,uD*.55,smoothstep(.95,.3,vR));diffuseColor.rgb=mix(dc,wc,wl);")
        .replace("#include <roughnessmap_fragment>","float roughnessFactor=mix(.95,.06,wl);")};
    m.customProgramCacheKey=()=>"pool";
    const g=new THREE.Group();g.position.set(x,.007,z);g.rotation.y=dir??0;par.add(g);
    [[0,0,1,1.25,0],[.55,.1,.7,1.4,.5],[-.35,-.2,.55,1.2,2],[.9,-.25,.45,1.6,1],[.25,.45,.4,1.3,4]].forEach(([dx,dz,s,el,rot])=>{const b=new THREE.Mesh(BLOB,m);b.position.set(dx*r,0,dz*r);b.scale.set(r*s*el,1,r*s/el);b.rotation.y=rot;g.add(b)});
    return{g,u}}
  const WET={blood:{c:0x8a0a0a,dry:0x3b1d14,t:20},old:{c:0x5a0c10,dry:0x2e1810,t:12},bile:{c:0x8a9a2a,dry:0x3e4220,t:30}};
  function Fluids(scene){
    const MAXM=900,MAXD=160,geo=BLOB.clone(),aWet=new THREE.InstancedBufferAttribute(new Float32Array(MAXM),1),aDry=new THREE.InstancedBufferAttribute(new Float32Array(MAXM*3),3);
    geo.setAttribute("aWet",aWet);geo.setAttribute("aDry",aDry);
    const mk=new THREE.InstancedMesh(geo,FluidMat(),MAXM);
    const sg=new THREE.CylinderGeometry(.0045,.0022,1,6,1,true);sg.translate(0,-.5,0);
    const wetM=()=>new THREE.MeshStandardMaterial({roughness:.1,metalness:0});
    const dm=new THREE.InstancedMesh(new THREE.SphereGeometry(.011,8,6),wetM(),MAXD),st=new THREE.InstancedMesh(sg,wetM(),MAXD),bu=new THREE.InstancedMesh(new THREE.SphereGeometry(.01,8,6),wetM(),MAXD);
    [mk,dm,st,bu].forEach(m=>{for(let i=0;i<m.count;i++)m.setColorAt(i,TC.set(0x8a0a0a));m.frustumCulled=false;m.count=0;scene.add(m)});
    const drops=[],pools=[],marks=[],self={anchors:[]},PS=Particles(scene);self.PS=PS;
    self.collect=group=>{self.anchors=[];self.embers=[];group.traverse(o=>{if(o.userData.drip)self.anchors.push(o);if(o.userData.ember)self.embers.push(o)})};
    const wp=new V3(),M4=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new V3(),P=new V3(),UP=new V3(0,1,0);
    const addMark=(p,x,z,s,el,rot)=>{if(marks.length>=MAXM){const o=pools.shift();if(o)for(let i=marks.length-1;i>=0;i--)if(marks[i].p===o)marks.splice(i,1)}
      const m={p,x,z,s:0,ts:s,el,rot,y:.006+Math.random()*.003};marks.push(m);p.marks++;return m};
    // um pingo no chão: soma uma marca à poça vizinha (cresce em lóbulos) ou nasce uma coroa com 2 a 5 satélites
    const land=(x,z,kind,spd)=>{let p=pools.find(p=>p.kind===kind&&Math.hypot(p.x-x,p.z-z)<p.r*1.1);
      if(p){p.r=Math.min(.38,p.r+.01);p.age=Math.min(p.age,.5);const a=Math.random()*6.28,d=p.r*(.25+Math.random()*.6);
        addMark(p,p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,p.r*(.4+Math.random()*.3),1+Math.random()*.4,Math.random()*6.28);
        if(Math.random()<.35){const b=Math.random()*6.28,e=p.r*(1.15+Math.random()*.5);addMark(p,p.x+Math.cos(b)*e,p.z+Math.sin(b)*e,.005+Math.random()*.006,1.5,b)}}
      else{p={x,z,kind,age:0,r:.035,marks:0};pools.push(p);const s=.022+Math.min(.015,spd*.003);addMark(p,x,z,s,1+Math.random()*.3,Math.random()*6.28);
        const n=2+Math.floor(Math.random()*4);for(let k=0;k<n;k++){const b=Math.random()*6.28,e=s*(1.6+Math.random()*1.8);addMark(p,x+Math.cos(b)*e,z+Math.sin(b)*e,s*(.12+Math.random()*.18),1.6,b)}}};
    self.step=dt=>{
      // Carbonizado: brasas sobem tremendo e um fiapo de fumaça sai das costas
      self.embers.forEach(a=>{const e=a.userData.ember;e.cd=(e.cd??Math.random()*.5)-dt;e.sd=(e.sd??Math.random())-dt;a.getWorldPosition(wp);
        if(e.cd<=0&&PS.P.length<600){e.cd=.18+Math.random()*.35;PS.emit({p:wp,v:new V3((Math.random()-.5)*.2,.5+Math.random()*.6,(Math.random()-.5)*.2),c:0xffc060,c1:0xff3a10,spark:true,add:true,s0:.05,s1:.015,life:.9+Math.random()*.9,wig:1.6})}
        if(e.smoke&&e.sd<=0){e.sd=.35+Math.random()*.3;PS.emit({p:wp,v:new V3(0,.35,0),c:0x4a4440,op:.28,fadeIn:true,s0:.06,s1:.4,life:2.6,wig:.35})}});
      PS.step(dt);
      // ferida: o fio desce e afina, o bulbo na ponta engorda e só então a gota se solta
      let ns=0;
      self.anchors.forEach(a=>{const d=a.userData.drip;if(d.off)return;a.getWorldPosition(wp);if(wp.y<.05||!a.visible)return;
        if(d.L==null){d.L=.04+Math.random()*.08;d.len=0;d.cd=Math.random()*d.every;d.ph=0}
        if(d.ph===0){d.cd-=dt;if(d.cd<=0)d.ph=1}
        else if(d.ph===1){d.len+=dt*d.L/(.35+d.every*.3);if(d.len>=d.L){d.ph=2;if(drops.length<MAXD)drops.push({x:wp.x,y:wp.y-d.len,z:wp.z,vy:-.3,kind:d.kind})}}
        else{d.len-=dt*.4;if(d.len<=0){d.len=0;d.ph=0;d.cd=d.every*(.6+Math.random()*.8)}}
        if(d.len>.002&&ns<MAXD){const c=TC.set(WET[d.kind].c),k=d.len/d.L;
          S.set(1-.35*k,d.len,1-.35*k);M4.compose(wp,Q.identity(),S);st.setMatrixAt(ns,M4);st.setColorAt(ns,c);
          P.copy(wp);P.y-=d.len;const bs=d.ph===1?.5+.7*k:.4;S.set(bs,bs*1.25,bs);M4.compose(P,Q,S);bu.setMatrixAt(ns,M4);bu.setColorAt(ns,c);ns++}});
      st.count=bu.count=ns;st.instanceMatrix.needsUpdate=bu.instanceMatrix.needsUpdate=true;if(ns){st.instanceColor.needsUpdate=bu.instanceColor.needsUpdate=true}
      for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.vy-=9.8*dt;d.y+=d.vy*dt;if(d.y<=.01){land(d.x,d.z,d.kind,-d.vy);drops.splice(i,1)}}
      drops.forEach((d,i)=>{P.set(d.x,d.y,d.z);S.set(1,1.4+Math.min(3,-d.vy*.5),1);M4.compose(P,Q.identity(),S);dm.setMatrixAt(i,M4);dm.setColorAt(i,TC.set(WET[d.kind].c))});
      dm.count=drops.length;dm.instanceMatrix.needsUpdate=true;if(drops.length)dm.instanceColor.needsUpdate=true;
      pools.forEach(p=>p.age+=dt);
      marks.forEach((m,i)=>{m.s+=(m.ts-m.s)*Math.min(1,dt*7);const W=WET[m.p.kind];P.set(m.x,m.y,m.z);Q.setFromAxisAngle(UP,m.rot);S.set(m.s*m.el,1,m.s);M4.compose(P,Q,S);mk.setMatrixAt(i,M4);
        mk.setColorAt(i,TC.set(W.c));aWet.array[i]=Math.max(0,1-m.p.age/W.t);TC.set(W.dry);aDry.array[i*3]=TC.r;aDry.array[i*3+1]=TC.g;aDry.array[i*3+2]=TC.b});
      mk.count=marks.length;mk.instanceMatrix.needsUpdate=aWet.needsUpdate=aDry.needsUpdate=true;if(marks.length)mk.instanceColor.needsUpdate=true;
    };
    self.clear=()=>{PS.clear();drops.length=0;pools.length=0;marks.length=0;mk.count=dm.count=st.count=bu.count=0;self.anchors.forEach(a=>{const d=a.userData.drip;d.len=0;d.ph=0})};
    return self;
  }

  // ---------- multidão: separação, empurrão, escalar quem está na frente, tropeçar e cair ----------
  function Crowd(o){
    const A=[],cell=.6,grid=new Map(),key=(x,z)=>(Math.floor(x/cell)*73856093)^(Math.floor(z/cell)*19349663);
    const self={A,o};
    self.add=(obj,x,z,sp,extra)=>{const a=Object.assign({o:obj,R:obj.userData.rig,x,z,y:0,vy:0,vx:0,vz:0,sp,tumble:0,climb:0,yaw:0,lane:(Math.random()-.5)},extra||{});A.push(a);obj.position.set(x,0,z);return a};
    const near=(a,r,f)=>{const cx=Math.floor(a.x/cell),cz=Math.floor(a.z/cell);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const L=grid.get(((cx+i)*73856093)^((cz+j)*19349663));if(L)for(const b of L)if(b!==a){const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;if(d2<r*r)f(b,dx,dz,Math.sqrt(d2)+1e-4)}}};
    self.step=(dt,t)=>{
      grid.clear();A.forEach(a=>{const k=key(a.x,a.z);(grid.get(k)||grid.set(k,[]).get(k)).push(a)});
      A.forEach(a=>{
        const g=o.goal(a,t);let dx=g.x-a.x,dz=g.z-a.z;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
        let sp=a.sp*(g.slow??1)*(a.tumble>0?.35:1)*(a.y>.3?1.15:1);
        let sx=0,sz=0,ahead=0,aheadY=0,supp=0;
        near(a,.62,(b,ex,ez,d)=>{const dy=b.y-a.y;
          if(Math.abs(dy)<.38){const f=(.62-d)/.62;sx-=ex/d*f;sz-=ez/d*f;if((ex*dx+ez*dz)/d>.35&&d<.58){ahead++;aheadY=Math.max(aheadY,b.y)}}
          if(d<.36&&b.y<a.y-.2)supp=Math.max(supp,b.y+.45)});
        let vx=dx*sp+sx*2.6,vz=dz*sp+sz*2.6;
        a.vx+=(vx-a.vx)*Math.min(1,dt*5);a.vz+=(vz-a.vz)*Math.min(1,dt*5);
        let nx=a.x+a.vx*dt,nz=a.z+a.vz*dt,blocked=ahead>=(o.pileAt??2),top=0;
        const pad=o.pad??.25;
        (o.walls||[]).forEach(w=>{if(nx>w.x0-pad&&nx<w.x1+pad&&nz>w.z0-pad&&nz<w.z1+pad){
          if(a.y>=w.h-.15&&!w.noPass){top=Math.max(top,w.h);return}
          // empurra de volta para o lado de onde veio: nunca atravessa
          const inX=a.x>w.x0-pad&&a.x<w.x1+pad,inZ=a.z>w.z0-pad&&a.z<w.z1+pad;
          if(inX&&!inZ)nz=a.z<(w.z0+w.z1)/2?w.z0-pad:w.z1+pad;
          else if(inZ&&!inX)nx=a.x<(w.x0+w.x1)/2?w.x0-pad:w.x1+pad;
          else{const px=Math.min(nx-(w.x0-pad),(w.x1+pad)-nx),pz=Math.min(nz-(w.z0-pad),(w.z1+pad)-nz);
            if(px<pz)nx=nx<(w.x0+w.x1)/2?w.x0-pad:w.x1+pad;else nz=nz<(w.z0+w.z1)/2?w.z0-pad:w.z1+pad}
          blocked=true;a.atWall=w}});
        if(o.bound){const b=o.bound(nx,nz);nx=b.x;nz=b.z}
        a.x=nx;a.z=nz;
        // escalar: quem está travado sobe em cima de quem está na frente
        const cap=Math.min(a.atWall&&a.atWall.noPass?a.atWall.h-.4:9,o.cap?o.cap(a):9);
        const want=blocked&&ahead?Math.min(cap,aheadY+.45):0;supp=Math.max(supp,top);
        if(a.y>cap+.1&&a.vy<=0){a.y=Math.max(cap,a.y-1.5*dt);a.climb=Math.max(0,a.climb-dt)}
        else if(want>a.y+.05&&a.tumble<=0){a.y+=1.9*dt;a.vy=0;a.climb=Math.min(1,a.climb+dt*3)}
        else{a.climb=Math.max(0,a.climb-dt*2);a.vy-=9.8*dt;a.y+=a.vy*dt;if(a.y<=supp){if(a.vy<-3.2&&a.tumble<=0)a.tumble=.9;a.y=supp;a.vy=0}}
        a.atWall=null;
        if(a.tumble<=0&&ahead>=3&&a.y<.2&&Math.random()<dt*(o.trip??.25))a.tumble=.9;
        if(a.tumble>0)a.tumble-=dt;
        o.after&&o.after(a,t);
        // visual
        const tyaw=Math.atan2(a.vx,a.vz);let dyaw=((tyaw-a.yaw+PI)%(2*PI)+2*PI)%(2*PI)-PI;a.yaw+=dyaw*Math.min(1,dt*8);
        a.o.position.set(a.x,a.y,a.z);a.o.rotation.y=a.yaw;
        a.o.rotation.x=a.tumble>0?(1-a.tumble/.9)*PI*1.6:0;
      });
    };
    // pose: correr, escalar (tronco deitado, braços buscando o alto) ou rolar
    self.pose=(t,dt)=>A.forEach(a=>{const R=a.R;if(!R)return;
      if(a.climb>.05){const s=Math.sin(t*9+R.ph);setPose(R,{lean:(self.o.climbLean??1.25)*a.climb+R.leanBase*(1-a.climb),armR:-2.9+s*.35,armL:-2.6-s*.35,elbR:-.3,elbL:-.5,legL:.9+s*.4,legR:.6-s*.4,kneeL:1,kneeR:1.2,headX:-1,drop:-.2})}
      else if(a.tumble>0)setPose(R,{lean:1.2,armR:-2.5,armL:-2.2,legL:-1.2,legR:-.9,kneeL:1.6,kneeR:1.4,headX:.4});
      else animate(a.o,t,true);
      cascade(R,dt);
      // nenhuma parte do corpo dentro de parede: mede braços e cabeça e empurra o corpo para fora pelo lado de onde veio
      for(let it=0;it<2;it++)(o.walls||[]).forEach(w=>{if(a.x<w.x0-1.8||a.x>w.x1+1.8||a.z<w.z0-1.8||a.z>w.z1+1.8||a.y>=w.h-.15&&!w.noPass)return;
        a.o.updateMatrixWorld(true);const m0=.1,inX=a.x>w.x0&&a.x<w.x1;let need=0;
        a.o.traverse(m=>{if(!m.isMesh)return;m.getWorldPosition(wp2);if(wp2.y>w.h||wp2.x<w.x0-m0||wp2.x>w.x1+m0||wp2.z<w.z0-m0||wp2.z>w.z1+m0)return;
          need=Math.max(need,inX?(a.z<(w.z0+w.z1)/2?wp2.z-(w.z0-m0):(w.z1+m0)-wp2.z):(a.x<(w.x0+w.x1)/2?wp2.x-(w.x0-m0):(w.x1+m0)-wp2.x))});
        if(need>0){const sg=inX?(a.z<(w.z0+w.z1)/2?-1:1):(a.x<(w.x0+w.x1)/2?-1:1);if(inX)a.z+=sg*need;else a.x+=sg*need;a.o.position.set(a.x,a.y,a.z)}})});
    const wp2=new V3();
    return self;
  }
  const at=(o,x,y,z,ry)=>{o.position.set(x,y,z);if(ry!=null)o.rotation.y=ry;return o};
  const pool=(r,c,op)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(r,20),basic(c,{transparent:true,opacity:op??.8,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.006;return m};
  const ring=(r,c,op)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r-.06,r,48),basic(c,{transparent:true,opacity:op??.5,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.01;return m};
  const looseLimb=(len,w,c)=>{const g=new THREE.Group(),l=box(w,len,w,new THREE.MeshLambertMaterial({color:c,flatShading:true}));l.rotation.z=Math.PI/2;l.position.y=w/2;g.add(l);const e=box(.03,w*1.1,w*1.1,new THREE.MeshLambertMaterial({color:RED}));e.position.set(len/2,w/2,0);g.add(e);return g};
  const shadow=()=>{const m=pool(.45,0x000000,.45);return m};
  const face=(x,z,tx,tz)=>Math.atan2(tx-x,tz-z);
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const fit=(aspect,W,o)=>{o=o||{};const ly=o.lookY??.85,d=Math.max(o.min??6,(W/2)/(Math.tan(19*Math.PI/180)*aspect));return{pos:new V3(o.x??0,ly+.4+d*(o.elev??.14),d+(o.z??0)),look:new V3(o.x??0,ly,o.z??0)}};

  // ---------- visualizador genérico ----------
  function Viewer(el){
    const canvas=el.querySelector("canvas"), labelsEl=el.querySelector(".zlabels");
    let renderer;
    try{renderer=new THREE.WebGLRenderer({canvas,antialias:true})}catch(e){fail(el,"Este navegador não tem WebGL, então as artes 3D não aparecem.");return null}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0d0b);scene.fog=new THREE.Fog(0x0a0d0b,10,30);
    const cam=new THREE.PerspectiveCamera(38,1,.1,120);
    scene.add(new THREE.HemisphereLight(0x9fb3c8,0x1a1410,.6));
    const moon=new THREE.DirectionalLight(0xb8c8e0,.85);moon.position.set(-4,8,6);scene.add(moon);
    const rim=new THREE.DirectionalLight(0x7d8f4a,.55);rim.position.set(5,3,-6);scene.add(rim);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,60),new THREE.MeshLambertMaterial({color:0x141915}));ground.rotation.x=-Math.PI/2;ground.renderOrder=-2;scene.add(ground);
    const grid=new THREE.GridHelper(40,40,0x2c352f,0x1c221e);grid.position.y=.003;grid.renderOrder=-2;scene.add(grid);
    const self={content:null,yaw:0,dragging:false,cam};const fluids=Fluids(scene);
    const look=new V3(0,.9,0),lookT=new V3(),posT=new V3();let spans=[],first=true,visible=true;
    self.retarget=()=>{if(!self.content)return;const t=self.content.cam(cam.aspect);lookT.copy(t.look);
      const off=t.pos.clone().sub(t.look).applyAxisAngle(new V3(0,1,0),self.yaw);posT.copy(t.look).add(off);
      if(first){cam.position.copy(posT);look.copy(lookT);first=false}};
    self.set=c=>{if(self.content)scene.remove(self.content.group);self.content=c;scene.add(c.group);self.yaw=0;
      if(!c.rigs){c.rigs=[];c.group.traverse(o=>{if(o.userData.rig)c.rigs.push(o)})}
      fluids.clear();fluids.collect(c.group);labelsEl.textContent="";spans=(c.labels||[]).map(l=>{const s=document.createElement("span");s.textContent=l.text;labelsEl.appendChild(s);return s});self.retarget()};
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();self.retarget()};
    new ResizeObserver(resize).observe(el);
    new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(el);
    let px=null;
    canvas.addEventListener("pointerdown",e=>{px=e.clientX;self.dragging=true;canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing"});
    canvas.addEventListener("pointermove",e=>{if(px===null)return;const dx=e.clientX-px;px=e.clientX;
      if(self.content&&self.content.onDrag)self.content.onDrag(dx);else{self.yaw-=dx*.008;self.retarget()}});
    const end=()=>{px=null;self.dragging=false;canvas.style.cursor=""};
    canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
    const v=new V3();let last=performance.now(),time=0;
    function tick(now){
      const dt=Math.min(.05,(now-last)/1000);last=now;requestAnimationFrame(tick);
      if(!visible||!self.content)return;time+=dt;
      self.content.update&&self.content.update(dt,time,self.dragging);
      if(!reduce&&(self.content.animate?self.content.animate():false))self.content.rigs.forEach(o=>{animate(o,time);cascade(o.userData.rig,dt)});
      if(!reduce)fluids.step(dt);if(self.content.live)self.retarget();
      const a=reduce?1:1-Math.pow(.002,dt);cam.position.lerp(posT,a);look.lerp(lookT,a);cam.lookAt(look);
      const w=el.clientWidth,h=el.clientHeight;
      (self.content.labels||[]).forEach((l,i)=>{const s=spans[i];v.copy(l.p);if(l.track)v.add(l.track.position);v.project(cam);if(l.fn&&s.textContent!==l.fn())s.textContent=l.fn();const show=v.z<1&&(!l.show||l.show());
        s.hidden=!show;if(show){s.style.left=((v.x+1)/2*w)+"px";s.style.top=Math.max(4,Math.min(h-22,(1-v.y)/2*h))+"px"}});
      renderer.render(scene,cam);
    }
    requestAnimationFrame(tick);resize();
    return self;
  }

  function group(id,onPick){const el=document.getElementById(id);el.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    el.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));onPick(b.dataset.v)});return el}

  // ---------- fila das 13 categorias ----------
  const lv=Viewer(document.getElementById("viewer"));
  if(lv){
    const SP=1.7,N=Z.length,xs=Z.map((_,i)=>(i-(N-1)/2)*SP);
    const st={decay:0,life:1,focus:-1,spin:.5,walk:true,seed:1000};
    const G=new THREE.Group();
    const holders=Z.map((z,i)=>{const h=new THREE.Group();h.position.x=xs[i];G.add(h);G.add(at(shadow(),xs[i],.005,0));return h});
    const models=[];
    const rebuild=()=>{holders.forEach((h,i)=>{if(models[i])h.remove(models[i]);models[i]=build({type:Z[i].n,decay:st.decay,life:st.life,clothIdx:i,phase:i*.7,seed:st.seed+i*17});h.add(models[i])});if(lv.content)lv.content.rigs=models.slice()};
    rebuild();
    lv.set({group:G,
      labels:Z.map((z,i)=>({text:z.n,p:new V3(xs[i],0,.75),show:()=>st.focus<0||st.focus===i})),
      cam:a=>{if(st.focus<0)return fit(a,N*SP+.6,{min:7,elev:.12});const k=Z[st.focus].n==="Brutamonte"?1.45:1;return{pos:new V3(xs[st.focus]+.6,1.5*k,4.6*k),look:new V3(xs[st.focus],.8*k,0)}},
      onDrag:dx=>{st.spin+=dx*.012},animate:()=>st.walk,
      update:(dt,t,drag)=>{if(!reduce&&!drag)st.spin+=dt*.35;holders.forEach(h=>h.rotation.y=st.spin)}});
    const focusEl=document.getElementById("zfocus");
    Z.forEach((z,i)=>focusEl.insertAdjacentHTML("beforeend",`<button type="button" data-v="${i}" aria-pressed="false" style="--eye:${z.eye}">${z.n}</button>`));
    const setFocus=v=>{st.focus=+v;if(st.focus>=0)st.spin=-.35;focusEl.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.v===st.focus));lv.retarget()};
    group("zfocus",setFocus);
    group("zdecay",v=>{st.decay=+v;rebuild()});
    group("zlife",v=>{st.life=+v;rebuild()});
    group("zmove",v=>{st.walk=v==="1";if(!st.walk)rebuild()});
    document.getElementById("zreroll").addEventListener("click",()=>{st.seed=Math.random()*1e9|0;rebuild()});
    document.querySelectorAll("#cards .card").forEach((c,i)=>{const b=document.createElement("button");b.type="button";b.className="see3d";b.textContent="Ver em 3D";
      b.addEventListener("click",()=>{setFocus(i);document.getElementById("artes").scrollIntoView({behavior:reduce?"auto":"smooth"})});c.querySelector(".card-head").appendChild(b)});
  }

  // ---------- cenas de referência ----------
  const L=(text,x,y,z,show)=>({text,p:new V3(x,y,z),show});
  const row=(n,sp)=>Array.from({length:n},(_,i)=>(i-(n-1)/2)*sp);
  const SCENES={
    roupas:{name:"Roupas e proteção",cap:"Qualquer categoria pode vestir qualquer roupa. Aqui todos são Lentos. O equipamento aparece na silhueta: colete, capacete e máscara mudam a proteção e o loot. O motociclista tem o brilho dos olhos abafado pelo visor e não morde enquanto estiver de capacete.",
      make(){const G=new THREE.Group(),o=[["civil","Civil"],["policial","Policial"],["militar","Militar"],["bombeiro","Bombeiro"],["motociclista","Motociclista"],["operario","Operário"],["medico","Médico"],["cacador","Caçador"]],xs=row(o.length,1.5);
        o.forEach(([k],i)=>{G.add(at(build({type:"Lento",decay:1,outfit:k,clothIdx:0,pose:{armL:-.95,armR:-.7}}),xs[i],0,0));G.add(at(shadow(),xs[i],.005,0))});
        return{group:G,labels:o.map(([,n],i)=>L(n,xs[i],0,.75)),cam:a=>fit(a,o.length*1.5+.6,{min:6.5})}}},
    dano:{name:"Dano por região",cap:"Na frente: os efeitos básicos. Atrás: os estados dilacerados, com antebraço pendurado balançando, mandíbula solta, cabeça explodida por escopeta, tripas para fora, carne rasgada e braço arrancado no ombro, todos pingando. Tiro no crânio apaga os olhos na hora. Braço a 0 é arrancado e cai no chão. Perna a 50% faz mancar; perna a 0 transforma em rastejante, mas ele continua sendo da mesma categoria. O Brutamonte mostra cada tiro no tronco e cai no quarto.",
      make(){const G=new THREE.Group(),xs=row(7,2.15);
        const add=(o,i)=>{G.add(at(o,xs[i],0,0));G.add(at(shadow(),xs[i],.005,0))};
        add(build({type:"Lento",decay:1,clothIdx:0}),0);
        add(build({type:"Lento",decay:1,clothIdx:0,cut:{head:true}}),1);
        for(let k=0;k<6;k++){const f=box(.06+.04*(k%2),.04,.06,new THREE.MeshLambertMaterial({color:k%3?0x94a084:0x7a120c}));G.add(at(f,xs[1]+Math.cos(k*1.7)*.45,.02,-.2+Math.sin(k*1.7)*.4))}
        mark(G,xs[1],-.3,.3,0x6e1410,{elong:1.2});
        add(build({type:"Lento",decay:1,clothIdx:0,cut:{armR:true}}),2);G.add(at(looseLimb(.68,.12,0x94a084),xs[2]+.45,0,.35,.6));
        add(build({type:"Lento",decay:1,clothIdx:0,cut:{armL:true,armR:true}}),3);
        const limp=build({type:"Lento",decay:1,clothIdx:0,pose:{legR:.5,legL:-.3}});limp.rotation.z=.12;add(limp,4);
        add(build({type:"Rastejante",eye:Z[0].eye,decay:1,clothIdx:0,cut:{legs:true}}),5);
        G.add(at(looseLimb(.88,.16,PANTS),xs[5]-.2,0,-.9,.3));G.add(at(looseLimb(.88,.16,PANTS),xs[5]+.4,0,-1.1,-.4));
        add(build({type:"Brutamonte",decay:1,wounds:3}),6);
        const n=["Inteiro","Headshot","Sem um braço","Sem braços","Manca","Rastejante","3 tiros"];
        const x2=row(6,2.6),z2=-3.2,row2=[[{cut:{dangleR:true}},"Antebraço solto"],[{cut:{jaw:true}},"Mandíbula solta"],[{cut:{blown:true}},"Cabeça explodida"],[{cut:{gut:true}},"Tripas"],[{cut:{flaps:true}},"Carne pendurada"],[{cut:{shoulderR:true}},"Sem braço"]];
        row2.forEach(([sp,t],i)=>{G.add(at(build(Object.assign({type:"Lento",decay:0,phase:i},sp)),x2[i],0,z2));G.add(at(shadow(),x2[i],.005,z2))});
        return{group:G,animate:()=>true,labels:n.map((t,i)=>L(t,xs[i],0,.85)).concat(row2.map(([,t],i)=>L(t,x2[i],i%2?2.15:0,z2+(i%2?0:.85)))),cam:a=>fit(a,7*2.15+1,{min:9,lookY:.9,elev:.32,z:-1.6})}}},
    penetracao:{name:"Penetração",cap:"Cada calibre atravessa um número de corpos e perde dano em cada um: 9mm passa por 2 (−50% por corpo), 5.56 por 3 (−35%) e .308 por 4 (−25%). Os pontos vermelhos marcam quem foi atingido.",
      make(){const G=new THREE.Group(),rows=[["9mm",2,0xe3c341],["5.56",3,0xef8a2a],[".308",4,0xe5392b]],labels=[];
        rows.forEach(([c,n,colr],r)=>{const z=(1-r)*2.3;
          const gun=box(.55,.08,.08,new THREE.MeshLambertMaterial({color:0x2a2d30}));G.add(at(gun,-4.4,1.25,z));
          for(let k=0;k<5;k++){const x=-1.8+k*1.05;G.add(at(build({type:"Lento",decay:1,clothIdx:k,wounds:k<n?1:0,pose:{armL:-.9,armR:-.7}}),x,0,z,-Math.PI/2));
            if(k<n){const s=glow(0xff3020,.35,.9);G.add(at(s,x-.1,1.2,z))}}
          const xe=-1.8+(n-1)*1.05,len=xe+4.1,tr=box(len,.022,.022,basic(colr,{transparent:true,opacity:.9}));G.add(at(tr,-4.1+len/2,1.24,z));
          labels.push(L(`${c} · atravessa ${n}`,-4.4,1.5,z))});
        return{group:G,labels,cam:a=>{const f=fit(a,14,{min:9,lookY:.6,x:-1});f.pos.set(-1+f.pos.z*.15,f.pos.z*.55,f.pos.z);return f}}}},
    espreitador:{name:"Espreitador",cap:"Ele finge de morto entre os corpos que ficam no chão por 15 min. A pista é o brilho roxo fraco nos olhos (corpo de verdade tem olho apagado). Quem passa a menos de 3 m, ou de costas, leva o bote.",
      make(){const G=new THREE.Group(),R=rng(7);
        [[-2.2,-.6],[-1.2,1.1],[.9,-1.3],[1.8,.7],[-.3,-2.1],[-2.6,1.6]].forEach(([x,z])=>{G.add(at(build({type:"Lento",decay:2,lying:true,eyesOff:true,clothIdx:Math.floor(R()*8)}),x,0,z,R()*6.28));mark(G,x,z,.45,0x3a1c12,{elong:1.15,rough:.85})});
        const lie=build({type:"Lento",lying:true,decay:2,eye:Z[6].eye,eyeDim:true,clothIdx:6,pose:{torsoW:.36}});G.add(at(lie,0,0,0,.4));
        const rg=ring(3,0x9b5ce0,.35);G.add(at(rg,0,.01,0));
        G.add(at(build({type:"Espreitador",decay:1}),5,0,.3,-1.2));G.add(at(shadow(),5,.005,.3));
        return{group:G,labels:[L("Fingindo de morto",0,.1,.9),L("Raio de 3 m",0,.05,3.15),L("O bote",5,0,1.1)],cam:a=>fit(a,11,{min:7,elev:.55,x:1,lookY:.3}),
          update:(dt,t)=>{rg.material.opacity=.2+.18*Math.sin(t*2.2)}}}},
    gritador:{name:"Gritador",cap:"Ao ver alguém, ele arqueia as costas e grita. Todos os zumbis num raio de 150 m vêm e ficam 20% mais rápidos por 30 s. Os anéis saindo da boca são o grito; os do chão mostram o som se espalhando (fora de escala).",
      make(){const G=new THREE.Group(),rings=[0,1,2].map(()=>{const r=ring(1,0xf2f2ea,.5);G.add(r);return r});
        G.add(build({type:"Gritador",decay:1}));G.add(shadow());
        const mouth=[0,1,2].map(()=>{const m=new THREE.Mesh(new THREE.TorusGeometry(1,.014,6,48),basic(0xf2f2ea,{transparent:true,opacity:.6,depthWrite:false}));G.add(m);return m});
        const ps=[[-4.5,-2],[-3,-4],[0,-5],[3,-4.2],[4.6,-1.8],[-5.2,1.2],[5.2,1.5],[-1.5,-5.4],[1.6,-5.2]];
        ps.forEach(([x,z],i)=>{const t=i===2||i===6?"Corredor":"Lento";G.add(at(build({type:t,decay:i%3,clothIdx:i}),x,0,z,face(x,z,0,0)));G.add(at(shadow(),x,.005,z))});
        return{group:G,animate:()=>true,labels:[L("Gritador",0,0,.8),L("Horda atraída",0,0,-5.9)],cam:a=>fit(a,15,{min:10,elev:.5,lookY:.4,z:-1.5}),
          update:(dt,t)=>{rings.forEach((r,i)=>{const k=((reduce?.5:t*.35)+i/3)%1;r.scale.setScalar(.6+k*6.5);r.material.opacity=.55*(1-k)});
            // o grito sai da boca em 3 anéis que crescem e somem
            mouth.forEach((m,i)=>{const k=((reduce?.4:t*.9)+i/3)%1;m.scale.setScalar(.06+k*1.5);m.position.z=.2+k*1.4;m.position.y=1.62+k*.25;m.material.opacity=.7*(1-k)})}}}},
    inchado:{name:"Inchado",cap:"Ele caminha até o grupo. Meio segundo antes de estourar ele incha e treme: é o aviso para fugir. Quando morre, estoura numa nuvem de bile de 4 m (em escala real aqui), em puffs opacos que se desfazem aos poucos pelas bordas. Quem está dentro fica cego por 5 s, com o dobro de rastro de cheiro, e tosse. A bile respinga, forma poça e vira crosta. Dá para usar a explosão contra a própria horda.",
      make(){const G=new THREE.Group(),PS=Particles(G),R=rng(3),cx=1.4;
        const inch=build({type:"Inchado",decay:1});G.add(inch);const sh=shadow();G.add(sh);const fig=inch.userData.rig.fig,s0=fig.scale.clone();
        const bp=new THREE.Mesh(BLOB,new THREE.MeshStandardMaterial({color:0x8a9a2a,roughness:.15,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));bp.position.set(cx,.007,0);G.add(bp);
        const hum=[[3.4,1.5],[4.3,-1],[3.7,.3]].map(([x,z],i)=>{const o=build({type:"Lento",human:true,seed:950+i});G.add(at(o,x,0,z,face(x,z,cx,0)));G.add(at(shadow(),x,.005,z));return o});
        const gm=[0x6e7a26,0x5a1a10,0x9aaa30,0x7b8a48],gibs=Array.from({length:12},(_,k)=>{const m=box(.07+R()*.08,.05+R()*.05,.07+R()*.08,new THREE.MeshLambertMaterial({color:gm[k%4]}));m.visible=false;G.add(m);return{m,v:new V3(),w:new V3()}});
        let T=0,popped=false;
        const step=(dt,t)=>{T+=dt;if(T>8.5){T=0;popped=false;inch.visible=true;fig.scale.copy(s0);PS.clear();gibs.forEach(g=>g.m.visible=false)}
          const x=-4+Math.min(T,3)/3*(cx+4);inch.position.x=x;sh.position.x=x;
          if(T<3){animate(inch,t);cascade(inch.userData.rig,dt)}
          else if(!popped){const k=Math.min(1,(T-3)/.5);fig.scale.set(s0.x*(1+.3*k),s0.y*(1+.08*k),s0.z*(1+.35*k));inch.position.x=x+Math.sin(T*70)*.03*k;
            if(T>=3.5){popped=true;inch.visible=false;const c=new V3(cx,1.1,0);
              PS.burst(c,42,{c:0x8a9a2a,c1:0x6e7a26,dissolve:true,sp:5,drag:2.4,up:.02,upr:.4,g:-.25,life:4.2,s0:.45,s1:1.8,dp:1.6,jit:.4});
              PS.burst(c,36,{c:0x9aaa30,spark:true,sp:5.5,up:.3,upr:.9,g:-9.8,life:1.3,s0:.07,s1:.05,floor:.02});
              gibs.forEach(g=>{g.m.visible=true;g.m.position.copy(c);const a=R()*6.28,s=2+R()*4;g.v.set(Math.cos(a)*s,2+R()*3,Math.sin(a)*s);g.w.set(R()*9,R()*9,R()*9)})}}
          const k=popped?Math.min(1,(T-3.5)/1.6):0;bp.visible=k>0;bp.scale.setScalar(.05+2.1*k*(1+.03*Math.sin(T*3)));
          const dk=Math.min(1,Math.max(0,(T-5)/3.5));bp.material.color.set(0x8a9a2a).lerp(TC.set(0x3e4220),dk);bp.material.roughness=.15+.8*dk;
          gibs.forEach(g=>{if(!g.m.visible||g.m.position.y<=.03)return;g.v.y-=9.8*dt;g.m.position.addScaledVector(g.v,dt);g.m.rotation.x+=g.w.x*dt;g.m.rotation.y+=g.w.y*dt;if(g.m.position.y<.03)g.m.position.y=.03});
          hum.forEach((o,i)=>{const Rg=o.userData.rig;if(popped&&T>3.6+i*.08)setPose(Rg,{lean:.45,armR:-2.5,armL:-2.3,elbR:-1.9,elbL:-2,headX:.6,headY:.3});else animate(o,t);cascade(Rg,dt)});
          PS.step(dt)};
        if(reduce){for(let k=0;k<80;k++)step(.05,k*.05)}
        return{group:G,labels:[L("Inchado",-4,0,.8),L("Nuvem de bile de 4 m: cega 5 s",cx,0,4.3)],cam:a=>fit(a,14,{min:9,elev:.45,lookY:.6,x:-.4}),
          update:(dt,t)=>{if(!reduce)step(Math.min(dt,.05),t)}}}},
    explosao:{name:"Explosão na horda",cap:"Uma granada M67 no meio de 18 zumbis. Ela abre um buraco de 0,9 m com borda de asfalto levantada e placas voando. Até 25% do raio letal a cabeça estoura e o corpo vira membros voando e uns 20 pedaços de carne e osso, cada um respingando onde cai. Até 45%, membros e mais 5 pedaços. Até o raio letal ele é desmembrado (2 a 4 partes arrancadas, braço pendurado, tripas) e arremessado; a menos de 70% do letal, se a cabeça for arrancada, ela estoura. Quem cai perto pousa dentro do buraco. Até o raio de ferimento ele só é derrubado e levanta poeira ao cair. Fora disso nada acontece. Clarão, bola de fogo que vira fumaça, poeira no chão e faíscas vêm da Oficina de explosões.",
      make(){const G=new THREE.Group(),PS=Particles(G),R=rng(55),ctr=new V3(0,0,0),LET=4,EXP=LET*.45,PUL=LET*.25,WND=8,CR=.9,CD=.25;
        [[PUL,0xff2a2a],[EXP,0xff5a3a],[LET,0xffa040],[WND,0xd9d4c8]].forEach(([r,c])=>G.add(ring(r,c,.35)));
        const Zs=[],CUTS=[{shoulderR:true,legs:true},{shoulderL:true,dangleR:true},{legs:true,jaw:true},{shoulderR:true,gut:true},{dangleL:true,legs:true,flaps:true}];
        const place=(n,r0,r1,kind)=>{for(let i=0;i<n;i++){const a=(i/n)*6.28+R()*.6,r=r0+R()*(r1-r0),x=Math.cos(a)*r,z=Math.sin(a)*r,tp=R()<.6?"Lento":"Corredor";
          const sp={type:tp,decay:Math.floor(R()*3),seed:Math.floor(R()*1e5),h:.95+R()*.1,phase:R()*6},o=build(sp);o.rotation.order="YXZ";G.add(o);
          const q={o,x,z,r,kind,yaw:face(x,z,0,0),sh:shadow()};G.add(q.sh);
          if(kind==="dism"){const cu=Object.assign({},CUTS[i%5]);if(r<.7*LET&&i%2===0){cu.blown=true;cu.jaw=false;q.pop=true}q.d=build(Object.assign({},sp,{cut:cu}));q.d.rotation.order="YXZ";q.d.visible=false;G.add(q.d)}
          Zs.push(q)}};
        place(2,.45,PUL-.15,"pulp");place(2,PUL+.2,EXP-.15,"exp");place(5,EXP+.4,LET-.3,"dism");place(6,LET+.6,WND-.6,"knock");place(4,WND+.8,10.5,"safe");
        const chunks=[],splats=[],skin=[0x8a9478,0x94a084,0x7a8a6a];
        // o chão afunda: bacia de 0,9 m e 25 cm (M67); quem cai dentro pousa no fundo
        const floorY=(x,z)=>{const d=Math.hypot(x,z);return d<CR?-CD*(1-(d/CR)**2):0};
        const crater=new THREE.Group();crater.visible=false;G.add(crater);
        // buraco de verdade: um disco "apaga" a profundidade do chão (desenhado logo depois dele) e a bacia deformada aparece abaixo de 0
        {const mask=new THREE.Mesh(new THREE.CircleGeometry(CR,40),new THREE.ShaderMaterial({vertexShader:"void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
            fragmentShader:"void main(){gl_FragColor=vec4(0.);gl_FragDepthEXT=1.;}",extensions:{fragDepth:true},colorWrite:false,depthFunc:THREE.AlwaysDepth}));
          mask.rotation.x=-PI/2;mask.position.y=.001;mask.renderOrder=-1;crater.add(mask);
          const bg=new THREE.RingGeometry(0,CR+.2,48,14);bg.rotateX(-PI/2);const P=bg.attributes.position,cols=[],cA=new THREE.Color(0x3c3c3a),cD=new THREE.Color(0x2a2118),cK=new THREE.Color(0x120e0a);
          for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getZ(i),d=Math.hypot(x,z),an=Math.atan2(z,x),n=1+.18*Math.sin(an*5+1.3)+.1*Math.sin(an*11);
            let y=d<CR?-CD*(1-(d/CR)**2)*n:0;if(d>CR*.8)y+=.07*Math.max(0,1-Math.abs(d-CR*1.02)/(CR*.22))*n;P.setY(i,y);
            const c=d>CR*.88?cA:d<CR*.45?cK.clone().lerp(cD,d/(CR*.45)):cD;cols.push(c.r,c.g,c.b)}
          bg.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));bg.computeVertexNormals();
          crater.add(new THREE.Mesh(bg,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true})));
          for(let k=0;k<7;k++){const a=k/7*6.28+R()*.5,sl=box(.22+R()*.18,.04,.16+R()*.14,new THREE.MeshLambertMaterial({color:0x34343a,flatShading:true}));sl.position.set(Math.cos(a)*(CR+.05),.07,Math.sin(a)*(CR+.05));sl.rotation.set((R()-.5)*.9,a,(R()-.5)*.9);crater.add(sl)}}
        const part=(p,geo,c,o)=>{o=o||{};const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c,flatShading:!!o.debris}));m.position.copy(p);G.add(m);const d=new V3(p.x,0,p.z).normalize();
          const s=(o.sp??5)+Math.random()*(o.spr??5),a=(Math.random()-.5)*(o.spread??1.2);const ch={m,v:new V3((d.x*Math.cos(a)-d.z*Math.sin(a))*s,(o.up??4)+Math.random()*5,(d.z*Math.cos(a)+d.x*Math.sin(a))*s),w:new V3(Math.random()*12,Math.random()*12,Math.random()*12),tr:0,small:!!o.small,debris:!!o.debris};chunks.push(ch);
          if(!o.debris)PS.burst(p,o.small?1:3,{c:0x6a0a0a,c1:0x2a0606,op:.5,sp:1.5,drag:2,up:.2,upr:.4,life:1.3,s0:o.small?.1:.2,s1:o.small?.3:.7});return ch};
        const bits=(p,n)=>{for(let k=0;k<n;k++){const bone=Math.random()<.3,g=bone?geoBox(.025,.025,.07+Math.random()*.05):new THREE.SphereGeometry(.025+Math.random()*.03,6,5);
          part(p.clone().add(new V3((Math.random()-.5)*.3,(Math.random()-.5)*.5,(Math.random()-.5)*.3)),g,bone?0xe0d8c4:[0x7a1a14,0x5a0c0c,0x8a2a22][k%3],{small:true,sp:3,spr:7,spread:2.4,up:2.5})}};
        const pop=p=>{PS.burst(p,8,{c:0x8a0a0a,c1:0x3a0606,dissolve:true,sp:2.2,drag:2.5,up:.2,upr:.6,life:1.5,s0:.15,s1:.55});bits(p,4)};
        const reset=()=>{T=0;fired=false;PS.clear();crater.visible=false;chunks.forEach(c=>G.remove(c.m));chunks.length=0;splats.forEach(s=>G.remove(s));splats.length=0;
          Zs.forEach(q=>{q.o.visible=true;q.o.position.set(q.x,0,q.z);q.o.rotation.set(0,q.yaw,0);q.sh.position.set(q.x,.005,q.z);q.sh.visible=true;q.vy=0;q.fly=false;q.lie=0;if(q.d)q.d.visible=false;q.b=q.o})};
        let T=0,fired=false;reset();
        const fire=()=>{fired=true;blast(PS,ctr,1.4);crater.visible=true;
          for(let k=0;k<4;k++){const a=k/4*6.28+.4;part(new V3(Math.cos(a)*.6,.1,Math.sin(a)*.6),geoBox(.2,.04,.15),0x34343a,{debris:true,sp:3,spr:4,up:3})}
          Zs.forEach(q=>{const d=new V3(q.x,0,q.z).normalize();
            if(q.kind==="exp"||q.kind==="pulp"){q.o.visible=false;q.sh.visible=false;const p=new V3(q.x,1,q.z),sk=skin[Math.floor(Math.random()*3)];
              if(q.kind==="pulp"){pop(p.clone().setY(1.7));bits(p,20)}
              else{part(p.clone().setY(1.7),new THREE.SphereGeometry(.11,10,8),sk);part(p.clone().setY(1.25),geoBox(.3,.32,.2),0x3a3a44);part(p.clone().setY(.95),geoBox(.26,.18,.18),0x2a2e3a);bits(p,5)}
              [0,1,2,3].forEach(k=>part(p.clone().setY(k<2?1.3:.6),new THREE.CylinderGeometry(.05,.04,k<2?.55:.75,8),k<2?sk:0x2a2e3a));return}
            if(q.kind==="safe")return;
            const pow=q.kind==="dism"?(LET+1-q.r)*1.6:(WND+.5-q.r)*.55;q.fly=true;q.vx=d.x*pow;q.vz=d.z*pow;q.vy=q.kind==="dism"?3.5:1.6;
            if(q.pop)pop(new V3(q.x,1.7,q.z));
            if(q.d){q.o.visible=false;q.d.visible=true;q.d.position.copy(q.o.position);q.d.rotation.copy(q.o.rotation);q.b=q.d;
              const c=part(new V3(q.x,1.3,q.z),new THREE.CylinderGeometry(.05,.04,.55,8),skin[0]);c.v.multiplyScalar(.6)}})};
        const step=(dt,t)=>{T+=dt;if(T>9)reset();if(!fired&&T>1.5)fire();
          Zs.forEach(q=>{const Rg=q.b.userData.rig;
            if(q.fly){q.vy-=9.8*dt;q.b.position.x+=q.vx*dt;q.b.position.z+=q.vz*dt;const fy=floorY(q.b.position.x,q.b.position.z);q.b.position.y=Math.max(fy,q.b.position.y+q.vy*dt);
              q.lie=Math.min(1,q.lie+dt*(q.kind==="dism"?2.2:1.6));q.b.rotation.x=-q.lie*PI/2;q.sh.position.set(q.b.position.x,.005,q.b.position.z);
              if(q.b.position.y<=fy&&q.vy<0){q.fly=false;q.b.position.y=fy+.12;q.b.rotation.x=-PI/2;PS.burst(q.b.position.clone().setY(.2),7,{c:0x6a6258,dissolve:true,sp:1.6,drag:2.5,up:.1,upr:.3,life:1.8,s0:.25,s1:.8});
                if(q.kind==="dism"){splats.push(mark(G,q.b.position.x,q.b.position.z,.28+Math.random()*.15,0x5a0a0a,{dir:Math.atan2(-q.vz,q.vx),elong:1.5}))}}
              if(Rg){const s=Math.sin(t*14+q.x);setPose(Rg,{armR:-2.6+s*.6,armL:-2.2-s*.6,legL:.5+s*.4,legR:-.4-s*.4,headX:.5});cascade(Rg,dt)}}
            else if(q.lie===0&&Rg){animate(q.b,t);cascade(Rg,dt)}});
          chunks.forEach(c=>{const fy=floorY(c.m.position.x,c.m.position.z)+(c.small?.02:.05);if(c.done)return;c.v.y-=9.8*dt;c.m.position.addScaledVector(c.v,dt);c.m.rotation.x+=c.w.x*dt;c.m.rotation.z+=c.w.z*dt;
            if(!c.small&&!c.debris){c.tr-=dt;if(c.tr<=0){c.tr=.1;PS.emit({p:c.m.position,v:new V3(),c:0x5a0808,op:.4,s0:.07,s1:.2,life:.6})}}
            if(c.m.position.y<=fy&&c.v.y<0){c.m.position.y=fy;c.done=true;c.v.set(0,0,0);if(c.debris)return;
              splats.push(mark(G,c.m.position.x,c.m.position.z,c.small?.04+Math.random()*.05:.12+Math.random()*.12,0x6a0a0a,{dir:Math.atan2(-c.m.position.z,c.m.position.x),elong:1.8,sat:c.small?1:undefined}));splats[splats.length-1].position.y+=Math.min(0,fy)}});
          PS.step(dt)};
        if(reduce){for(let k=0;k<50;k++)step(.05,k*.05)}
        return{group:G,labels:[L("Estoura (25%)",0,0,-PUL-.3),L("Explodido (45%)",0,0,EXP+.35),L("Desmembrado (raio letal)",0,0,LET+.35),L("Arremessado (ferimento)",0,0,WND+.35)],cam:a=>fit(a,22,{min:14,elev:.62,lookY:0}),
          update:(dt,t)=>{if(!reduce)step(Math.min(dt,.05),t)}}}},
    impacto:{name:"Tiro por idade",cap:"O mesmo tiro no peito em cada idade. O Fresco solta névoa e gotas de sangue vivo para trás, o Recente sangue escuro, o Antigo um sangue grosso e pouco, e o Decrépito solta uma nuvem de pó com lascas de osso. O Carbonizado solta cinza e uma chuva de brasas, e brasas sobem dele o tempo todo junto com um fiapo de fumaça.",
      make(){const G=new THREE.Group(),PS=Particles(G),xs=row(5,2.3);
        const spec=[[{type:"Lento",decay:0},"Fresco"],[{type:"Lento",decay:1},"Recente"],[{type:"Lento",decay:2},"Antigo"],[{type:"Lento",decay:3},"Decrépito: pó"],[{type:"Carbonizado",decay:1},"Carbonizado: cinza e brasa"]];
        const Q=spec.map(([sp,t],i)=>{const o=build(Object.assign({seed:300+i},sp));G.add(at(o,xs[i],0,0));G.add(at(shadow(),xs[i],.005,0));return{o,i,cd:.6+i*.35,fl:0}});
        const hit=q=>{const p=new V3(xs[q.i],1.25,-.05),back=(sp,n,o)=>PS.burst(p,n,Object.assign({sp},o));q.fl=1;
          if(q.i<3){const c=[0x8a0a0a,0x5a0c10,0x3a1c12][q.i],n=[16,10,6][q.i];
            for(let k=0;k<n;k++)PS.emit({p,v:new V3((Math.random()-.5)*1.6,.4+Math.random()*1.4,-2.5-Math.random()*2.5),c,dissolve:true,s0:.08,s1:.3,life:.7+Math.random()*.4,drag:3});
            for(let k=0;k<n;k++)PS.emit({p,v:new V3((Math.random()-.5)*2,Math.random()*2,-3-Math.random()*3),c,spark:true,g:-9.8,s0:.05,s1:.04,life:1.1,floor:.02})}
          else if(q.i===3){back(1.4,14,{c:0x8a7a62,c1:0x6a5e4c,dissolve:true,up:.1,upr:.5,drag:1.8,g:.15,life:2,s0:.2,s1:.9});back(3,9,{c:0xd8d0b8,spark:true,up:.3,upr:.6,g:-9.8,life:1,s0:.05,s1:.04,floor:.02})}
          else{back(1.2,10,{c:0x2a2622,dissolve:true,up:.3,upr:.6,drag:1.5,g:.3,life:1.8,s0:.18,s1:.7});back(4,22,{c:0xffc060,c1:0xff3a10,spark:true,add:true,up:.3,upr:.9,g:-6,life:1.2,s0:.06,s1:.02,floor:.02})}};
        const step=(dt,t)=>{Q.forEach(q=>{q.cd-=dt;if(q.cd<=0){q.cd=2.6;hit(q)}const Rg=q.o.userData.rig;animate(q.o,t);q.fl=Math.max(0,q.fl-dt*3);Rg.upper.rotation.x-=q.fl*.45;Rg.headG.rotation.x-=q.fl*.3;cascade(Rg,dt)});PS.step(dt)};
        if(reduce){for(let k=0;k<20;k++)step(.05,k*.05)}
        return{group:G,labels:spec.map(([,t],i)=>L(t,xs[i],0,.85)),cam:a=>fit(a,5*2.3+1,{min:7,lookY:1}),update:(dt,t)=>{if(!reduce)step(Math.min(dt,.05),t)}}}},
    farejador:{name:"Farejador",cap:"Ele sente sangue a 60 m e segue o rastro de quem está ferido, puxando até 8 Lentos atrás de si. Curativo, água ou uma isca de carne quebram a trilha.",
      make(){const G=new THREE.Group(),R=rng(11);
        const px=3.6,pz=-2.6;G.add(at(build({type:"Lento",human:true,skin:0xd9a88a,clothIdx:4,bandage:true,pose:{lean:.08,armL:-.2,armR:.15,legL:-.3,legR:.25,headZ:0}}),px,0,pz,face(px,pz,7,-5)));G.add(at(shadow(),px,.005,pz));
        for(let k=0;k<16;k++){const t=k/15,x=-2.8+(px+2.8)*t+(R()-.5)*.3,z=2.4+(pz-2.4)*t+(R()-.5)*.3;mark(G,x,z,.05+R()*.05,0x8e1a12,{dir:Math.atan2(-(pz-2.4),px+2.8),elong:1.6,sat:2})}
        const fx=-1.4,fz=1.1;G.add(at(build({type:"Farejador",decay:1}),fx,0,fz,face(fx,fz,px,pz)));G.add(at(shadow(),fx,.005,fz));
        [[-2.6,2.2],[-2.2,3],[-3.3,1.5],[-3.4,2.9],[-2.8,3.8],[-4.1,2.3]].forEach(([x,z],i)=>{G.add(at(build({type:"Lento",decay:1+(i%2),clothIdx:i}),x,0,z,face(x,z,px,pz)));G.add(at(shadow(),x,.005,z))});
        return{group:G,animate:()=>true,labels:[L("Farejador",fx,0,fz+.75),L("Lentos que ele puxa",-3.2,0,4.5),L("Rastro de sangue",1.1,0,-.3),L("Sobrevivente ferido",px,0,pz+.8)],cam:a=>fit(a,13,{min:9,elev:.55,lookY:.4,x:-.3})}}},
    mordida:{name:"Da mordida ao zumbi",cap:"A mordida infecta 100%. Nas 48 h de jogo seguintes a pessoa passa por febre (stamina e mira pioram) e delírio (tosse e visão turva), morre e reanima em 2 a 4 minutos como Fresco, com a mesma roupa e mochila.",
      make(){const G=new THREE.Group(),xs=row(5,1.8),P0={headZ:0,legL:0,legR:.05};
        const add=(o,i)=>{G.add(at(o,xs[i],0,0));G.add(at(shadow(),xs[i],.005,0))};
        add(build({type:"Lento",seed:777,human:true,skin:0xd9a88a,clothIdx:6,bandage:true,pose:Object.assign({},P0,{lean:.04,armL:-.15,armR:.05})}),0);
        add(build({type:"Lento",seed:777,human:true,skin:0xd6c2ae,clothIdx:6,bandage:true,pose:Object.assign({},P0,{lean:.22,armL:-.4,armR:.05,headZ:.1})}),1);
        add(build({type:"Lento",seed:777,human:true,skin:0xb9b4a4,clothIdx:6,bandage:true,pose:Object.assign({},P0,{lean:.45,armL:.08,armR:.05,headX:.35,headZ:.15})}),2);
        G.add(at(build({type:"Lento",seed:777,human:true,lying:true,skin:0xa9a898,clothIdx:6,bandage:true}),xs[3],0,-.4,.3));
        add(build({type:"Lento",seed:777,decay:0,clothIdx:6,bandage:true}),4);
        const n=["Mordido · 0–30%","Febre · 30–70%","Delírio · 70–95%","Morte · 100%","Reanima em 2–4 min"];
        return{group:G,labels:n.map((t,i)=>L(t,xs[i],0,.85)),cam:a=>fit(a,5*1.8+.6,{min:6.5})}}},
    corpos:{name:"Corpos em 15 min",cap:"O ragdoll vira uma malha parada em 3 s, o que deixa o corpo quase sem custo. A poça nasce nas feridas e cresce em lóbulos no minuto 0, escura e grossa no meio e fina na borda; entre 5 e 15 min reais ela seca até o marrom fosco, a borda primeiro. O corpo escurece, aparecem moscas e no fim ele dissolve. O loot fica no corpo enquanto ele existir.",
      make(){const G=new THREE.Group(),xs=row(4,2.3),flies=[];
        // a poça nasce na ferida (peito e cabeça), cresce no minuto 0 e escurece até o marrom entre 5 e 15 min, borda primeiro
        const pools=[];
        [[1,.62,0x8a0a0a,1,1],[2,.6,0x8a0a0a,.5,1],[2,.58,0x5a0c10,.18,1],[3,.5,0x5a0c10,0,.35]].forEach(([d,r,c,wet,o],i)=>{
          const pm=poolMark(G,xs[i]+.18,-.62,r,c,0x3b1d14,.4+i*.7);pm.u.uWet.value=wet;pools.push(pm);const b=build({type:"Lento",lying:true,decay:d,eyesOff:true,clothIdx:0,opacity:o});G.add(at(b,xs[i],i===3?-.06:0,-.5,.2));
          if(i>=2)for(let k=0;k<7;k++){const f=box(.025,.025,.025,basic(0x050505));G.add(f);flies.push([f,xs[i],k])}});
        const n=["0 min · vira malha parada","5 min · escurece","10 min · moscas","14–15 min · dissolve"];
        return{group:G,labels:n.map((t,i)=>L(t,xs[i],0,.9)),cam:a=>fit(a,4*2.3+.6,{min:6,elev:.5,lookY:.2}),
          update:(dt,t)=>{flies.forEach(([f,x,k])=>{const a=t*(1.5+k*.2)+k;f.position.set(x+Math.cos(a)*(.3+k*.04),.35+.15*Math.sin(a*1.7),-.4+Math.sin(a)*(.35))});
            const k=reduce?1:Math.min(1,(t%8)/5);pools[0].g.scale.setScalar(.15+.85*(1-(1-k)*(1-k)))}}}},
    lod:{name:"Níveis de detalhe",cap:"Como milhares de zumbis cabem sem lag. Perto, cada zumbi tem IA completa e caixas de acerto por região (as linhas verdes). No médio, uma cápsula só. Longe, vira um cartão plano em grupo. Muito longe, nem existe na tela: é só um número por região do mapa.",
      make(){const G=new THREE.Group(),xs=row(4,2.4),wire=new THREE.LineBasicMaterial({color:0xb7c95a});
        const wbox=(w,h,d,x,y,z,parent)=>{const l=new THREE.LineSegments(new THREE.EdgesGeometry(geoBox(w,h,d)),wire);l.position.set(x,y,z);parent.add(l)};
        const z0=build({type:"Lento",decay:1,clothIdx:0,pose:{armL:-.15,armR:-.1,elbL:-.1,elbR:-.1,headZ:0,headX:0,lean:.02,legL:0,legR:0,kneeL:0,kneeR:0}});const h0=new THREE.Group();h0.add(z0);
        wbox(.34,.4,.36,0,1.79,.02,h0);wbox(.6,.72,.38,0,1.24,0,h0);[-1,1].forEach(s=>{wbox(.2,.9,.2,s*.105,.45,0,h0);wbox(.16,.66,.16,s*.36,1.15,.05,h0)});
        G.add(at(h0,xs[0],0,0));
        const h1=new THREE.Group();h1.add(build({type:"Lento",decay:1,clothIdx:0}));const cyl=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(.32,.32,1.85,10,1)),wire);cyl.position.y=.93;h1.add(cyl);G.add(at(h1,xs[1],0,0));
        const card=new THREE.Mesh(new THREE.PlaneGeometry(.6,1.95),new THREE.MeshLambertMaterial({color:0x3a4038,side:THREE.DoubleSide}));card.position.y=.97;const h2=new THREE.Group();h2.add(card);
        [-1,1].forEach(s=>{const e=glow(Z[0].eye,.18,.9);e.position.set(s*.06,1.8,.02);h2.add(e)});G.add(at(h2,xs[2],0,0));
        const h3=new THREE.Group();const tile=new THREE.LineSegments(new THREE.EdgesGeometry(geoBox(1.6,.01,1.6)),wire);h3.add(tile);
        for(let i=0;i<32;i++){const d=box(.05,.05,.05,basic(0xe3c341));d.position.set(((i%8)-3.5)*.18,.03,(Math.floor(i/8)-1.5)*.3);h3.add(d)}G.add(at(h3,xs[3],0,0));
        [0,1,2].forEach(i=>G.add(at(shadow(),xs[i],.005,0)));
        const n=["L0 · <35 m · completo","L1 · 35–120 m · simplificado","L2 · 120–400 m · cartão","L3 · >400 m · só números"];
        return{group:G,labels:n.map((t,i)=>L(t,xs[i],0,1)),cam:a=>fit(a,4*2.4+1.6,{min:6.5,lookY:.8})}}},
    horda:{name:"Horda de 100",cap:"Uma horda com a composição proposta: 48 Lentos, 14 Corredores, 9 Rastejantes, 5 Brutamontes, 5 Farejadores, 4 Saltadores, 3 Espreitadores, 3 Inchados, 3 Cegos, 2 Gritadores, 2 Carbonizados, 1 Afogado e 1 Devorador, com idades da infecção e da pessoa, altura e porte sorteados. Os olhos deixam ler os especiais no meio da massa.",
      make(){const G=new THREE.Group(),R=rng(42),cnt={Lento:48,Corredor:14,Rastejante:9,Brutamonte:5,Farejador:5,Espreitador:3,Inchado:3,Gritador:2,Saltador:4,Cego:3,Afogado:1,Carbonizado:2,Devorador:1},list=[];
        Object.entries(cnt).forEach(([t,n])=>{for(let i=0;i<n;i++)list.push(t)});
        for(let i=list.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
        const pts=[];
        list.forEach(t=>{let x,z,ok,tries=0;do{x=(R()-.5)*15;z=-7+R()*10;ok=pts.every(([a,b])=>(a-x)**2+(b-z)**2>.62);tries++}while(!ok&&tries<40);pts.push([x,z]);
          const r=R(),life=r<.25?0:r<.8?1:2,dr=R(),decay=dr<.35?0:dr<.7?1:dr<.9?2:3;
          G.add(at(build({type:t,decay:t==="Corredor"?Math.min(decay,1):decay,life,clothIdx:Math.floor(R()*8),h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6}),x,0,z,(R()-.5)*.8))});
        return{group:G,labels:[],cam:a=>fit(a,20,{min:13,elev:.42,lookY:.4,z:-2.5})}}},
    rio:{name:"Perseguição (rio e bola)",live:true,cap:"Simulação de verdade: cada zumbi corre atrás do sobrevivente, empurra os vizinhos e fica colado neles. Quem fica travado sobe em cima de quem está na frente, como em Guerra Mundial Z; quem cai de cima tropeça e rola, e os de trás passam por cima. No estreitamento entre os carros a horda vira um funil e escala os carros. Em Days Gone é esse mesmo rio, só que de 300 a 500.",
      make(){const G=new THREE.Group(),R=rng(5),RAD=11,W=3.4;
        const ring_=new THREE.Mesh(new THREE.RingGeometry(RAD-W-.6,RAD+W+.6,96),new THREE.MeshLambertMaterial({color:0x1d221f}));ring_.rotation.x=-PI/2;ring_.position.y=.004;G.add(ring_);
        for(let i=0;i<22;i++){const a=i/22*2*PI;[RAD-W-2.2,RAD+W+2.2].forEach((r,k)=>{const h=4+R()*6,b=box(3,h,3.2,new THREE.MeshLambertMaterial({color:k?0x262b28:0x2c302c}));b.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r);b.rotation.y=-a;G.add(b)})}
        const walls=[{x0:RAD-W,x1:RAD-.7,z0:-2.3,z1:2.3,h:1.45},{x0:RAD+.9,x1:RAD+W,z0:-1.2,z1:1.2,h:1.45}];
        walls.forEach(w=>{const c=new THREE.Group();c.add(at(box(w.x1-w.x0,.8,w.z1-w.z0,new THREE.MeshLambertMaterial({color:0x3a4250})),0,.55,0));c.add(at(box((w.x1-w.x0)*.85,.6,(w.z1-w.z0)*.5,new THREE.MeshLambertMaterial({color:0x252b33})),0,1.15,0));c.position.set((w.x0+w.x1)/2,0,(w.z0+w.z1)/2);G.add(c)});
        const runner=build({type:"Lento",human:true,seed:4242,skin:0xb98a64,pose:{lean:.35,headZ:0,headX:-.2}});runner.userData.rig.type="Corredor";G.add(runner);
        let th=-.9;const tgt=new V3();
        const crowd=Crowd({walls,trip:.35,pileAt:2,
          goal:(a,t)=>{const aa=Math.atan2(a.z,a.x);let d=((th-aa)%(2*PI)+3*PI)%(2*PI)-PI;
            if(Math.abs(d)<.18)return{x:tgt.x,z:tgt.z,slow:Math.hypot(a.x-tgt.x,a.z-tgt.z)<1.4?.92:1};
            const ang=aa+Math.max(-.5,Math.min(.5,d)),r=RAD+a.lane*W*1.3;return{x:Math.cos(ang)*r,z:Math.sin(ang)*r}},
          bound:(x,z)=>{const r=Math.hypot(x,z),k=Math.max(RAD-W,Math.min(RAD+W,r))/r;return{x:x*k,z:z*k}},
          after:a=>{const aa=Math.atan2(a.z,a.x);let d=((th-aa)%(2*PI)+3*PI)%(2*PI)-PI;if(d>3||d<-2){const ang=th-1.2-R()*.6;a.x=Math.cos(ang)*(RAD+a.lane*W);a.z=Math.sin(ang)*(RAD+a.lane*W);a.y=0}}});
        for(let i=0;i<150;i++){const ang=th-.25-R()*1.6,r=RAD+(R()-.5)*W*1.8,tp=R()<.75?"Corredor":R()<.6?"Lento":"Saltador";
          const o=build({type:tp,decay:Math.floor(R()*3),life:R()<.25?0:R()<.75?1:2,h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6});G.add(o);
          crowd.add(o,Math.cos(ang)*r,Math.sin(ang)*r,tp==="Lento"?3.9:4.6+R()*.7)}
        const SP=4.25;
        const step=(dt,t)=>{th+=SP/RAD*dt;const rr=RAD+Math.sin(t*.35)*1.6;tgt.set(Math.cos(th)*rr,0,Math.sin(th)*rr);
          runner.position.copy(tgt);runner.rotation.y=Math.atan2(-Math.sin(th),Math.cos(th));crowd.step(dt,t)};
        for(let k=0;k<160;k++)step(.05,k*.05);
        const tan=new V3(),out=new V3();
        return{group:G,crowd,labels:[L("Sobrevivente",0,2.2,0,()=>true)].map(l=>Object.assign(l,{track:runner})),
          cam:a=>{tan.set(-Math.sin(th),0,Math.cos(th));out.set(Math.cos(th),0,Math.sin(th));const d=a<1?14:10.5;
            return{pos:tgt.clone().addScaledVector(tan,-d).add(new V3(0,a<1?10:8,0)),look:tgt.clone().addScaledVector(tan,-3).add(new V3(0,.8,0))}},
          update:(dt,t)=>{if(reduce)return;step(dt,t);crowd.pose(t,dt);animate(runner,t);cascade(runner.userData.rig,dt)}}}},
    piramide:{name:"Pirâmide no muro",cap:"Simulação: a horda corre para o muro, os da frente ficam presos e os de trás sobem em cima deles. Quem fica travado vira degrau e fica preso se debatendo; os outros só conseguem subir meio corpo por vez, então a pilha cresce em rampa, mais alta encostada no muro e no centro e mais baixa atrás e nas bordas, até alcançar os 4 m. Ninguém atravessa o muro e os do topo passam por cima, caindo do outro lado. É a mesma regra da perseguição (travou, sobe em quem está na frente), só que contra um obstáculo fixo. A cada 16 s uma carga explode na base: a pilha desaba levantando poeira e começa a se formar de novo.",
      make(){const G=new THREE.Group(),R=rng(9),wz=-6;
        G.add(at(box(18,4,.5,new THREE.MeshLambertMaterial({color:0x3a3d38})),0,2,wz-.25));
        [-1.2,1.4].forEach((x,i)=>G.add(at(build({type:"Lento",human:true,seed:900+i,skin:0xc99a78,pose:{lean:.3,armL:-1.4,armR:-1.2,elbL:-.6,elbR:-.6,headX:.6,headZ:0,legL:-.1,legR:.1,kneeL:.1,kneeR:.1}}),x,4,wz-.3,0)));
        // a pilha é um mapa de altura feito de corpos: quem trava vira degrau, e só se sobe meio corpo por vez
        const C=.6,hf=new Map(),ck=(x,z)=>Math.floor(x/C)+":"+Math.floor((z-wz)/C),H=(x,z)=>hf.get(ck(x,z))||0;
        const face=wz+.6,STEP=.5,MAXPIN=160;let pins=0,bt=0;const A=[],PS=Particles(G);
        const spawn=(a,far)=>{a.x=(R()-.5)*10;a.z=wz+(far?11+R()*8:2+R()*16);a.y=0;a.vy=0;a.st="run";a.stuck=0;a.over=0};
        for(let i=0;i<205;i++){const tp=R()<.7?"Corredor":"Lento";
          const o=build({type:tp,decay:Math.floor(R()*3),life:R()<.25?0:R()<.75?1:2,h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6});G.add(o);
          const a={o,R:o.userData.rig,sp:tp==="Lento"?3:4.3+R()*.6,lane:(R()-.5)*4,yaw:PI,ph:R()*6};spawn(a,false);A.push(a)}
        const step=(dt,t)=>{
          A.forEach(a=>{if(a.st==="pin")return;
            if(a.st==="over"){a.z-=a.sp*.6*dt;if(a.z<wz-.6){a.vy-=9.8*dt;a.y=Math.max(0,a.y+a.vy*dt)}if(a.y===0&&a.z<wz-.6){a.over+=dt;if(a.over>1.2)spawn(a,true)}return}
            if(a.kx){a.x+=a.kx*dt;a.z=Math.max(face,a.z+a.kz*dt);a.kx*=Math.max(0,1-3*dt);a.kz*=Math.max(0,1-3*dt);if(Math.abs(a.kx)+Math.abs(a.kz)<.1)a.kx=a.kz=0}
            let dx=a.lane-a.x,dz=wz-1-a.z;const dl=Math.hypot(dx,dz)||1;let vx=dx/dl*a.sp,vz=dz/dl*a.sp,sx=0,sz=0,ahead=0;
            A.forEach(b=>{if(b===a||b.st!=="run"||Math.abs(b.y-a.y)>.45)return;const ex=b.x-a.x,ez=b.z-a.z,d=Math.hypot(ex,ez);if(d<.55&&d>1e-4){const f=(.55-d)/.55;sx-=ex/d*f;sz-=ez/d*f;if((ex*dx+ez*dz)/dl/d>.5)ahead++}});
            vx+=sx*3;vz+=sz*3;let nx=a.x+vx*dt,nz=a.z+vz*dt,blocked=ahead>=2;
            if(nz<face){if(a.y>=3.7&&Math.abs(nx)<9){a.st="over";a.y=4;a.vy=0;return}nz=face;blocked=true}
            const hN=H(nx,nz),hC=H(a.x,a.z);
            if(hN>a.y+STEP){blocked=true;nx=a.x;nz=a.z}
            // rampa: a célula nunca passa da que está mais perto do muro; no muro, no máximo 1 m acima da fileira de trás
            const nH=hC+.48,wallRow=a.z<face+C,okH=wallRow?nH<=Math.min(4.2,H(a.x,a.z+C)+1):nH<=H(a.x,a.z-C);
            if(blocked){a.stuck+=dt;if(pins<MAXPIN&&okH&&a.stuck>.35+R()*.5&&a.y<=hC+.15){a.st="pin";pins++;a.y=hC;hf.set(ck(a.x,a.z),nH);
                const yd=(R()-.5)*1.4,reach=Math.max(0,a.z-wz-.25)/(1.8*Math.max(.3,Math.cos(yd)));
                // o corpo deita na direção do muro só até onde cabe: colado no muro fica de pé, agarrado nele
                a.pin={yaw:PI+yd,tilt:Math.min(.7+R()*.8,Math.asin(Math.min(1,reach))),roll:(R()-.5)*.5,dy:-.15-R()*.15};return}}else a.stuck=Math.max(0,a.stuck-dt);
            a.x=nx;a.z=nz;const s=H(a.x,a.z);
            if(a.y<s){a.y=Math.min(s,a.y+3.2*dt);a.vy=0;a.climbing=1}else{a.climbing=Math.max(0,(a.climbing||0)-dt*3);a.vy-=9.8*dt;a.y=Math.max(s,a.y+a.vy*dt);if(a.y===s)a.vy=0}
            const ty=Math.atan2(vx,vz);a.yaw+=(((ty-a.yaw+PI)%(2*PI)+2*PI)%(2*PI)-PI)*Math.min(1,dt*8)});
          A.forEach(a=>{const o=a.o;
            if(a.st==="pin"){o.position.set(a.x,a.y+a.pin.dy,a.z+(a.pin.dz||0));o.rotation.set(a.pin.tilt,a.pin.yaw,a.pin.roll,"YXZ")}
            else{o.position.set(a.x,a.y,a.z);o.rotation.set(0,a.st==="over"?PI:a.yaw,0)}})};
        let pose=(t,dt)=>A.forEach(a=>{const Rg=a.R;if(!Rg)return;const s=Math.sin(t*7+a.ph);
          if(a.st==="pin")setPose(Rg,{lean:.4,armR:-2.6+s*.5,armL:-2.2-s*.5,elbR:-.4,elbL:-.7,legL:.6+s*.3,legR:-.3-s*.3,kneeL:1,kneeR:.8,headX:-.6+s*.2,drop:0});
          else if(a.climbing>.05||a.y>.3)setPose(Rg,{lean:.55,armR:-2.9+s*.4,armL:-2.6-s*.4,elbR:-.3,elbL:-.5,legL:.9+s*.5,legR:.5-s*.5,kneeL:1.1,kneeR:1.2,headX:-.9,drop:-.1});
          else if(a.st==="over")setPose(Rg,{lean:1,armR:-2.4,armL:-2,legL:-.6,legR:.4,kneeL:1.2,kneeR:.9,headX:.3});
          else animate(a.o,t,true);
          cascade(Rg,dt);
          // braços e cabeça esticados alcançam mais longe que os pés: mede o corpo e empurra para trás até nenhuma parte entrar no muro
          if(a.st!=="over"&&a.z-wz<2.4&&a.y<4.1&&(a.st!=="pin"||((fr+a.ph*10|0)%12===0))){a.o.updateMatrixWorld(true);let mn=99;a.o.traverse(m=>{if(m.isMesh){m.getWorldPosition(wp);if(wp.y<4.05)mn=Math.min(mn,wp.z)}});
            const need=wz+.22-mn;if(need>0){if(a.st==="pin")a.pin.dz=(a.pin.dz||0)+need;a.o.position.z+=need}}});
        let fr=0;const wp=new V3(),pose0=pose;pose=(t,dt)=>{fr++;pose0(t,dt)};
        for(let k=0;k<260;k++)step(.05,k*.05);for(let k=0;k<13;k++)pose(13+k*.05,.05);
        return{group:G,labels:[L("Muro de 4 m",-6.5,4.3,wz),L("Sobreviventes",0,5.2,wz-.3)],
          cam:a=>{const d=a<1?18:13;return{pos:new V3(d*.95,3,wz+3.5+d*.3),look:new V3(0,1.8,wz+3)}},
          update:(dt,t)=>{if(reduce)return;step(Math.min(dt,.05),t);pose(t,dt);PS.step(dt);
            // carga na base: a pilha desaba levantando poeira e começa a se formar de novo
            bt+=dt;if(bt>16){bt=0;const c=new V3(0,0,wz+1.4);blast(PS,c,1.3);hf.clear();pins=0;
              A.forEach(a=>{if(a.st==="over")return;const dx=a.x-c.x,dz=a.z-c.z,d=Math.hypot(dx,dz);if(d<1.4&&a.y<2.2){spawn(a,true);return}
                if(a.st==="pin"||d<5){a.st="run";a.stuck=0;a.vy=d<3?2.5:.5;const f=Math.max(.5,5-d);a.kx=dx/(d+.1)*f;a.kz=Math.abs(dz)/(d+.1)*f+.8}});
              PS.burst(new V3(0,2,wz+.8),26,{c:0x6a6258,c1:0x4a4640,dissolve:true,sp:3,drag:1.6,up:.1,upr:.4,g:-.4,life:4,s0:.6,s1:2,floor:.2})}}}}},
    mare:{name:"Maré na barricada",cap:"Simulação: a horda chega correndo e se amontoa contra as tábuas, cada um num ângulo, uns subindo nos ombros dos outros e esticando os braços por cima. Como a barricada não deixa passar, a pilha para abaixo do topo. A pressão é a soma de quem está encostado (zumbi 1, pesado 1,5, Brutamonte 3) e a barricada balança mais quanto maior ela é.",
      make(){const G=new THREE.Group(),R=rng(31),planks=new THREE.Group();
        const bar={x0:-3,x1:3,z0:-.12,z1:.12,h:2.1,noPass:true},walls=[bar,{x0:-4.6,x1:-3,z0:-4,z1:4,h:3.2,noPass:true},{x0:3,x1:4.6,z0:-4,z1:4,h:3.2,noPass:true}];
        [-1,1].forEach(s=>G.add(at(box(1.6,3.2,8,new THREE.MeshLambertMaterial({color:0x2c302c})),s*3.8,1.6,0)));
        for(let i=0;i<5;i++){const p=box(6,.32,.12,new THREE.MeshLambertMaterial({color:0x6a4a2c}));p.position.set(0,.4+i*.42,0);p.rotation.z=(R()-.5)*.08;planks.add(p)}
        [-2,2].forEach(x=>planks.add(at(box(.14,2.4,.14,new THREE.MeshLambertMaterial({color:0x5a3e24})),x,1.2,-.1)));G.add(planks);
        const crowd=Crowd({walls,trip:.2,pileAt:1,goal:a=>({x:a.lane*4,z:-3}),bound:(x,z)=>({x:Math.max(-2.85,Math.min(2.85,x)),z})});
        for(let i=0;i<70;i++){const x=(R()-.5)*5.4,z=.5+R()*9,tp=R()<.08?"Brutamonte":R()<.6?"Lento":"Corredor";
          const o=build({type:tp,decay:Math.floor(R()*3),life:R()<.25?0:R()<.75?1:2,h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6});G.add(o);crowd.add(o,x,z,tp==="Lento"?2.4:3.4+R()*.6)}
        for(let k=0;k<240;k++)crowd.step(.05,k*.05);
        return{group:G,crowd,labels:[L("Barricada",0,2.5,0),L("Pressão: 1 por zumbi, 3 por Brutamonte",0,0,9.5)],
          cam:a=>{const f=fit(a,9,{min:8,lookY:1});f.pos.set(-4,8,-10.5);f.look.set(0,1,2.5);return f},
          update:(dt,t)=>{if(reduce)return;crowd.step(dt,t);crowd.pose(t,dt);
            const press=crowd.A.filter(a=>a.z<1.2).length;planks.position.z=-.02-Math.abs(Math.sin(t*2.6))*.004*press;planks.rotation.x=Math.sin(t*2.6)*.0015*press}}}},
    ataque:{name:"Agarrão e mordida",live:true,cap:"Como a infecção acontece, em câmera um pouco lenta e em ciclo. 1) O zumbi corre e dá o bote. 2) Agarra pelos ombros: o jogador tem 3 s para se soltar com empurrão ou faca. 3) Se não soltar, ele puxa e morde o pescoço ou o ombro: infecção de 100%. 4) O jogador cai de joelhos e o zumbi vai junto. Cada parte do corpo chega na pose com atraso, do quadril para a cabeça, e o sangue escorre e pinga.",
      make(){const G=new THREE.Group();
        const hum=build({type:"Lento",human:true,seed:4321,skin:0xc68c62,pose:{lean:0,headZ:0,headX:0,armL:-.1,armR:.05,elbL:-.2,elbR:-.2,legL:-.05,legR:.05,kneeL:.05,kneeR:.05}});
        const zom=build({type:"Corredor",decay:1,seed:99});G.add(hum,zom);
        const H=hum.userData.rig,Zr=zom.userData.rig;hum.position.set(.45,0,0);hum.rotation.y=-PI/2;zom.rotation.y=PI/2;
        const bite=new THREE.Group();H.headG.add(bite);bite.position.set(.07,-.1,.03);
        const bm=basic(0x8a0a0a);const b0=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),bm);b0.scale.set(1,1.2,.35);b0.rotation.y=PI/2;bite.add(b0);bite.visible=false;
        const drip=new THREE.Object3D();drip.position.set(.07,-.18,.05);drip.userData.drip={kind:"blood",every:.25};H.headG.add(drip);drip.userData.drip.off=true;
        const HK=[[0,{lean:0,headY:0,armL:-.1,armR:.05,elbL:-.2,elbR:-.2,drop:0,kneeL:.05,kneeR:.05,legL:-.05,legR:.05,headX:0}],
          [1.5,{lean:-.1,headY:-.6,armL:-.1,armR:.05,elbL:-.2,elbR:-.2,drop:0,kneeL:.05,kneeR:.05,legL:-.05,legR:.05,headX:-.1}],
          [2.1,{lean:-.3,headY:-.2,armL:-1.3,armR:-1.2,elbL:-1.4,elbR:-1.5,drop:-.04,kneeL:.25,kneeR:.2,legL:-.3,legR:.25,headX:-.25}],
          [3.6,{lean:-.35,headY:.3,armL:-1.5,armR:-1.0,elbL:-.6,elbR:-1.8,drop:-.05,kneeL:.3,kneeR:.2,legL:-.4,legR:.35,headX:-.2}],
          [4.3,{lean:-.2,headY:.7,headZ:-.5,armL:-.6,armR:-1.9,elbL:-.4,elbR:-1.2,drop:-.06,kneeL:.3,kneeR:.3,legL:-.3,legR:.3,headX:-.3}],
          [5.6,{lean:.55,headY:.4,headZ:-.3,armL:-.3,armR:-.5,elbL:-.6,elbR:-.8,drop:-.5,kneeL:1.9,kneeR:1.7,legL:-1.1,legR:-.9,headX:.3}],
          [8,{lean:.6,headY:.4,headZ:-.3,armL:-.25,armR:-.45,elbL:-.6,elbR:-.8,drop:-.52,kneeL:1.95,kneeR:1.75,legL:-1.1,legR:-.95,headX:.4}]];
        const ZK=[[0,{x:-6,lean:.75,armL:-1.35,armR:-1.05,elbL:-.08,elbR:-.12,headX:-.55,drop:-.1,run:1}],
          [1.7,{x:-.9,lean:.75,armL:-1.35,armR:-1.05,elbL:-.08,elbR:-.12,headX:-.55,drop:-.1,run:1}],
          [2.1,{x:-.32,lean:.45,armL:-1.65,armR:-1.6,elbL:-.25,elbR:-.3,headX:-.3,drop:-.08,legL:-.6,legR:.4,kneeL:.5,kneeR:.6,run:0}],
          [3.6,{x:-.2,lean:.35,armL:-1.5,armR:-1.45,elbL:-1.1,elbR:-1.2,headX:-.2,drop:-.06,legL:-.4,legR:.3,kneeL:.4,kneeR:.4,run:0}],
          [4.3,{x:-.1,lean:.5,armL:-1.4,armR:-1.3,elbL:-1.5,elbR:-1.5,headX:.35,headY:.35,drop:-.08,legL:-.35,legR:.3,kneeL:.4,kneeR:.4,run:0}],
          [5.6,{x:0,lean:.95,armL:-1.2,armR:-1.0,elbL:-1.4,elbR:-1.3,headX:.5,headY:.3,drop:-.45,legL:-1.2,legR:-.8,kneeL:1.8,kneeR:1.5,run:0}],
          [8,{x:0,lean:1.0,armL:-1.15,armR:-.95,elbL:-1.4,elbR:-1.3,headX:.55,headY:.3,drop:-.47,legL:-1.2,legR:-.8,kneeL:1.85,kneeR:1.5,run:0}]];
        const sample=(K,t)=>{let i=0;while(i<K.length-2&&t>K[i+1][0])i++;const [t0,a]=K[i],[t1,b]=K[i+1],k=Math.min(1,Math.max(0,(t-t0)/(t1-t0)));const e=k*k*(3-2*k);return lerpPose(a,b,e)};
        const PH=[[0,"1. Aproximação"],[1.7,"2. O bote"],[2.1,"3. Agarrão: 3 s para se soltar"],[4.3,"4. Mordida: infecção 100%"],[5.6,"5. Queda"]];
        let lt=0;const phase=()=>{let s=PH[0][1];PH.forEach(([t,n])=>{if(lt>=t)s=n});return s};
        cascade(H,0);cascade(Zr,0);
        const step=(dt,t)=>{lt=(t*.8)%9;const T=Math.min(lt,8);
          const zq=sample(ZK,T);zom.position.x=zq.x;
          if(zq.run>.5){animate(zom,t)}else setPose(Zr,zq);
          setPose(H,sample(HK,T));
          bite.visible=T>4.4;drip.userData.drip.off=!(T>4.4);
          if(T<.1){bite.visible=false}
          cascade(H,dt);cascade(Zr,dt)};
        return{group:G,labels:[{text:"",fn:phase,p:new V3(0,2.4,0)}],cam:a=>fit(a,4,{min:4.2,lookY:1.1,elev:.12,x:-.4}),update:(dt,t)=>step(reduce?0:dt,reduce?3:t)}}},
    variedade:{name:"Ninguém é igual",fresh:true,cap:"24 Lentos, todos do mesmo tipo e com a mesma regra de jogo, mas cada um sorteia corpo masculino ou feminino, tom de pele, formato da cabeça, cabelo, barba, óculos, boné, mochila, manga, cores da roupa e do sapato, altura e porte. A cada vez que a cena abre, o sorteio é novo.",
      make(){const G=new THREE.Group(),R=rng(Math.random()*1e9|0);
        for(let i=0;i<24;i++){const x=((i%8)-3.5)*1.3,z=-Math.floor(i/8)*1.6+.8;
          G.add(at(build({type:"Lento",decay:Math.floor(R()*3),life:R()<.25?0:R()<.75?1:2,h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6,pose:{armL:-.9-R()*.3,armR:-.6-R()*.3}}),x,0,z,(R()-.5)*.5));G.add(at(shadow(),x,.005,z))}
        return{group:G,animate:()=>true,labels:[],cam:a=>fit(a,11,{min:8,elev:.32,lookY:.9,z:-.8})}}},
    corpo:{name:"Altura e porte",cap:"Cada zumbi sorteia altura (1,62 m a 1,98 m) e porte (magro, médio ou pesado). Pesado tem mais vida e empurra mais, mas é mais lento; magro é o contrário. A caixa de acerto cresce junto, então a cabeça de um zumbi alto fica mais acima da mira.",
      make(){const G=new THREE.Group(),hs=[.9,1,1.1],bs=[[.85,"magro"],[1,"médio"],[1.25,"pesado"]],items=[];
        hs.forEach(h=>bs.forEach(([b,n])=>items.push([h,b,n])));const xs=row(items.length,1.35);
        items.forEach(([h,b],i)=>{G.add(at(build({type:"Lento",decay:1,clothIdx:i%8,h,bulk:b,pose:{armL:-.9,armR:-.7}}),xs[i],0,0));G.add(at(shadow(),xs[i],.005,0))});
        const mark=new THREE.Mesh(new THREE.PlaneGeometry(items.length*1.35+.6,.012),basic(0xb7c95a,{transparent:true,opacity:.5}));G.add(at(mark,0,1.8,-.3));
        return{group:G,labels:items.map(([h,b,n],i)=>L(`${(1.8*h).toFixed(2).replace(".",",")} m ${n}`,xs[i],0,.8)).concat([L("1,80 m",xs[0]-.9,1.8,-.3)]),cam:a=>fit(a,items.length*1.35+1.2,{min:7,lookY:.95})}}},
    cerco:{name:"Vagas de ataque",cap:"Como em Left 4 Dead e Guerra Mundial Z: no máximo 6 zumbis atacam ao mesmo tempo, um em cada vaga ao redor do jogador (o Brutamonte ocupa 2). O resto forma uma fila que empurra e entra quando uma vaga abre. Isso evita um bolo injusto e deixa ler quem vai morder primeiro.",
      make(){const G=new THREE.Group(),R=rng(13);
        G.add(build({type:"Lento",human:true,skin:0x9c6b4c,clothIdx:5,pose:{lean:.05,armL:-1.4,armR:-1.3,elbL:-1,elbR:-1.1,headZ:0,headX:.1,legL:-.3,legR:.3,kneeL:.2,kneeR:.2}}));
        for(let i=0;i<6;i++){const a=i/6*Math.PI*2,x=Math.sin(a)*1.05,z=Math.cos(a)*1.05;
          G.add(at(ring(.32,0xb7c95a,.7),x,.012,z));
          G.add(at(build({type:i===3?"Corredor":"Lento",decay:Math.floor(R()*3),clothIdx:i,h:.94+R()*.12,bulk:.9+R()*.25,phase:R()*6,pose:{lean:.35,armL:-1.55,armR:-1.4,elbL:-.15,elbR:-.2,headX:-.2}}),x,0,z,face(x,z,0,0)))}
        for(let i=0;i<16;i++){const a=i/16*Math.PI*2+R()*.2,r=2.1+R()*.8,x=Math.sin(a)*r,z=Math.cos(a)*r;
          G.add(at(build({type:R()<.12?"Brutamonte":"Lento",decay:Math.floor(R()*3),clothIdx:Math.floor(R()*8),h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6,pose:{lean:.5,armL:-1.3,armR:-1.2}}),x,0,z,face(x,z,0,0)))}
        G.add(at(ring(1.8,0xe5392b,.3),0,.011,0));
        return{group:G,animate:()=>true,labels:[L("Jogador",0,2.1,0),L("6 vagas de ataque",0,0,1.5),L("Fila empurrando",0,0,3.3)],cam:a=>fit(a,10,{min:9,elev:.75,lookY:.2})}}},
    alerta:{name:"Alerta em cadeia",cap:"Um zumbi vê o jogador e geme. Os vizinhos a até 8 m se viram depois de 0,2 a 0,6 s e repassam o alerta, formando uma onda de cabeças virando. O anel mostra a onda passando. Com um Gritador no grupo, o alcance vai a 150 m.",
      make(){const G=new THREE.Group(),R=rng(21),src=new V3(-5,0,-2),player=new V3(7,0,5),Zs=[];
        G.add(at(build({type:"Lento",human:true,skin:0xd9a88a,clothIdx:3,pose:{lean:.05,armL:-.2,armR:.1,headZ:0,legL:0,legR:0,kneeL:0,kneeR:0}}),player.x,0,player.z,face(player.x,player.z,src.x,src.z)));
        for(let i=0;i<45;i++){const x=-9+R()*13,z=-6+R()*9,o=build({type:R()<.9?"Lento":"Corredor",decay:Math.floor(R()*3),clothIdx:Math.floor(R()*8),h:.93+R()*.14,bulk:.88+R()*.3,phase:R()*6});
          const y0=R()*6.28,y1=face(x,z,player.x,player.z);G.add(at(o,x,0,z,y0));
          Zs.push({o,y0,y1,d:Math.hypot(x-src.x,z-src.z)+R()*.8})}
        const wave=ring(1,0xe3c341,.6);G.add(at(wave,src.x,.012,src.z));
        const lerpA=(a,b,k)=>{let d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*k};
        return{group:G,labels:[L("Primeiro a ver",src.x,0,src.z+.8),L("Jogador",player.x,0,player.z+.8)],cam:a=>fit(a,16,{min:11,elev:.6,lookY:0,x:-1}),
          update:(dt,t)=>{const T=reduce?99:(t%7)*3.2;wave.scale.setScalar(Math.max(.01,T));wave.material.opacity=T<15?.6*(1-T/15):0;
            Zs.forEach(z=>{const k=Math.min(1,Math.max(0,(T-z.d)/1.2));z.o.rotation.y=lerpA(z.y0,z.y1,k);const R_=z.o.userData.rig;if(R_)R_.headG.rotation.x=R_.hxBase-k*.25})}}}},
  };
  const sv=Viewer(document.getElementById("sviewer"));
  if(sv){
    const cache={},capEl=document.getElementById("scap"),sel=document.getElementById("sscene");
    Object.entries(SCENES).forEach(([k,s],i)=>sel.insertAdjacentHTML("beforeend",`<button type="button" data-v="${k}" aria-pressed="${i===0}">${s.name}</button>`));
    const show=k=>{if(!cache[k]||SCENES[k].fresh)cache[k]=SCENES[k].make();sv.set(cache[k]);capEl.textContent=SCENES[k].cap;
      sel.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===k))};
    group("sscene",show);show("roupas");
    document.querySelectorAll("[data-scene]").forEach(b=>b.addEventListener("click",()=>{show(b.dataset.scene);document.getElementById("cenas").scrollIntoView({behavior:reduce?"auto":"smooth"})}));
    const CARD_SCENE={Gritador:"gritador",Inchado:"inchado",Carbonizado:"impacto",Espreitador:"espreitador",Farejador:"farejador"};
    document.querySelectorAll("#cards .card").forEach((c,i)=>{const k=CARD_SCENE[Z[i].n];if(!k)return;const b=document.createElement("button");b.type="button";b.className="see3d";b.textContent="Ver comportamento";
      b.addEventListener("click",()=>{show(k);document.getElementById("cenas").scrollIntoView({behavior:reduce?"auto":"smooth"})});c.querySelector(".card-head").appendChild(b)});
  }
})();
