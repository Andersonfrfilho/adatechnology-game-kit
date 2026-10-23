// fonte: site/pages/zumbis-personagens/elenco.html
// texto visível: Elenco ZombiAdA ZombiAdA · arte de personagens · low poly sombrio Elenco do Vale Prova visual de tudo que a ficha de personagens propõe: o sobrevivente jogável vestido em cada uma das 12 profissões e os 8 sobreviventes com história. Corpo anatômico low poly: ombros, peito, cintura e quadril com curvas, e juntas no cotovelo e no joelho, para o movimento sair natural. Formas arredondadas com sombreado suave, na mesma luz da cena de teste. Arraste para girar, clique em alguém para focar, alterne entre parado e andando e use o controle de infecção para ver o corpo mudar até virar zumbi. Ficha do sobrevivente Cena de teste Dona Zilda Ramos 67 anos · enfermeira aposentada ◀ ▶ Fase da infecção Saudável Sobreviventes (8) Profissões (12) Partes do corpo e cortes Modo tiro Ver partes e juntas Arrancar braço Quebrar antebraço Arrancar perna Curar O corpo é dividido em segmentos presos a juntas. Quando um segmento é destruído, o corte acontece na junta acima do ponto atingido e cai tudo que vem depois: um acerto no braço leva o braço inteiro, um no antebraço leva o antebraço com a mão. Arma de corte ou tiro muito forte arranca; tiro comum quebra o osso, e aí o membro fica pendurado ou a perna manca. NPC único Dona Zilda Ramos Regras de arte para personagens Silhueta primeiro Cada personagem precisa ser reconhecido a 30 m, no escuro, só pela silhueta: chapéu de palha do Seu Dito, capacete do motoboy, jaleco do Dr. Sato, colete tático do Tenente Brasa. Detalhe pequeno não aparece no jogo, forma grande aparece. Uma cor de assinatura Roupa em tons apagados de cidade, com uma cor de assinatura por personagem (o lilás da Dona Zilda, a bandana vermelha da Rosa, a jaqueta jeans da Jéssica). Assim os jogadores falam “o de verde” na LAN e todo mundo entende. Corpo anatômico e modular Um esqueleto só para jogador, NPC e zumbi, com tronco curvo (peito, cintura, quadril), juntas no ombro, cotovelo, quadril e joelho, e peças trocáveis: cabelo, chapéu, tronco, pernas, calçado, costas e mãos. Zumbi reaproveita a roupa de quem morreu, então seu personagem morto aparece vestido igual, com a mochila. Infecção visível As fases mudam a pele de quente para cinza esverdeado, curvam a postura e, na reanimação, acendem os olhos vermelhos do corredor recém-transformado. Outros jogadores enxergam a febre antes que o infectado conte. Fase 0 · pele normal Fase 1 · mal-estar, olheiras Fase 2 · febre, pele amarelada, curva Fase 3 · delírio, cinza esverdeado Fase 4 · reanimado, olhos vermelhos Guia de estilo do corpo Vale para sobreviventes, jogador e zumbis, para todo mundo caber no mesmo mundo. Estilizado low poly, na linha dos pacotes estilo Synty: formas curvas e anatômicas, arredondadas, sem textura de foto. Roupa que passa do quadril (saia, jaleco, avental) é presa à coxa, para nunca atravessar a perna. Proporção Altura base 1,80 m, cabeça com cerca de 1/6 da altura (um pouco maior que o real para ler a expressão de longe). Ombros com 0,60 m de largura no homem e 0,55 m na mulher; qu

// ===== script 1 (64 KB)

(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!window.THREE){$('stage').innerHTML='<p class="err">Não foi possível carregar o motor 3D. Recarregue a página.</p>';return;}
const V=THREE.Vector3;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- data
const PROFS=[
 {n:"Enfermeira(o)",fem:1,sub:"Profissão · −2 pontos",skin:0x8d5a3b,hair:{s:"bun",c:0x1a1310},top:{c:0x3f8f8a,sl:"short"},pants:{c:0x3f8f8a},shoes:0xd8d8d0,ex:[["steth"],["mask_chin",0xaed0de]],hand:"medbag",
  parts:[[0x3f8f8a,"Pijama cirúrgico verde-água"],[0xd8d8d0,"Tênis branco de plantão"],[0x9aa0a6,"Estetoscópio no pescoço"],[0xaed0de,"Máscara no queixo"]],kit:"Leva: kit de primeiros socorros, luvas"},
 {n:"Policial militar",sub:"Profissão · −4 pontos",skin:0xc49a74,hair:{s:"buzz",c:0x2a1d14},hat:{k:"beret",c:0x23272c},top:{c:0x5d6e7a,sl:"long"},pants:{c:0x2a3038},shoes:0x111111,ex:[["vest",0x1b1d20],["belt",0x15161a],["holster"],["radio"]],hand:"baton",
  parts:[[0x5d6e7a,"Farda cinza-azulada"],[0x1b1d20,"Colete balístico preto"],[0x23272c,"Boina"],[0x15161a,"Cinto com coldre e rádio"]],kit:"Leva: revólver .38 com 6 balas, cassetete"},
 {n:"Bombeiro(a)",sub:"Profissão · −3 pontos",skin:0x6b4430,hair:{s:"buzz",c:0x111111},hat:{k:"fire",c:0x9a2a20},top:{c:0x8a7a52,sl:"long"},pants:{c:0x8a7a52},shoes:0x111111,ex:[["stripes",0xd8e04a],["legstripes",0xd8e04a]],hand:"axe",
  parts:[[0x8a7a52,"Roupa de aproximação caqui"],[0xd8e04a,"Faixas refletivas"],[0x9a2a20,"Capacete vermelho"]],kit:"Leva: machado de bombeiro"},
 {n:"Mecânico(a)",sub:"Profissão · −1 ponto",skin:0xa8754f,hair:{s:"short",c:0x1d140e},hat:{k:"cap",c:0x2d3a4f},top:{c:0x2d3a4f,sl:"long"},pants:{c:0x2d3a4f},shoes:0x2a2018,ex:[["stains"],["rag",0xb33a2a]],hand:"wrench",lhand:"toolbox",
  parts:[[0x2d3a4f,"Macacão azul-marinho"],[0x1a1a1a,"Manchas de graxa"],[0xb33a2a,"Pano vermelho no bolso"]],kit:"Leva: caixa de ferramentas"},
 {n:"Pedreiro / obras",sub:"Profissão · −1 ponto",skin:0x7a4c33,hair:{s:"buzz",c:0x111111},hat:{k:"hardhat",c:0xe0b020},top:{c:0xc8662a,sl:"short"},pants:{c:0x3b4a63},shoes:0x4a3524,ex:[["belt",0x5a4026],["pouches",0x5a4026]],hand:"hammer",
  parts:[[0xc8662a,"Camiseta laranja"],[0x3b4a63,"Calça jeans"],[0xe0b020,"Capacete amarelo"],[0x5a4026,"Cinto de couro com bolsas"]],kit:"Leva: martelo, pregos"},
 {n:"Cozinheiro(a)",sub:"Profissão · 0 pontos",skin:0xd2a885,hair:{s:"short",c:0x5a3a22},hat:{k:"bandana",c:0x2b2b2b},top:{c:0xe6e2d6,sl:"long"},pants:{c:0x4a4a4a},shoes:0x111111,ex:[["apron",0x3a3a3a],["buttons"]],hand:"knife",
  parts:[[0xe6e2d6,"Dólmã branco"],[0x3a3a3a,"Avental preto"],[0x2b2b2b,"Bandana"],[0x4a4a4a,"Calça de cozinha"]],kit:"Leva: faca de chef"},
 {n:"Atirador esportivo",sub:"Profissão · −4 pontos",skin:0xc9a07c,hair:{s:"short",c:0x3b2a1c},hat:{k:"cap",c:0x4b5236},face:["glasses_y"],top:{c:0x4b5236,sl:"long"},pants:{c:0x5f5a4a},shoes:0x3a2e22,ex:[["earpro",0x2a2a2a],["holster"],["belt",0x2a2a2a]],hand:"pistol",
  parts:[[0x4b5236,"Camisa tática oliva"],[0x5f5a4a,"Calça cargo"],[0xd8b030,"Óculos de tiro amarelos"],[0x2a2a2a,"Abafador no pescoço"]],kit:"Leva: pistola 9 mm sem munição"},
 {n:"Agricultor(a)",sub:"Profissão · 0 pontos",skin:0x9a6644,hair:{s:"short",c:0x2a2018},hat:{k:"straw",c:0xc9b06a},top:{c:0x8a2f2a,sl:"long",plaid:0x3a1612},pants:{c:0x3b4a63},shoes:0x4a3524,ex:[],hand:"hoe",
  parts:[[0x8a2f2a,"Camisa xadrez"],[0xc9b06a,"Chapéu de palha"],[0x3b4a63,"Calça jeans"],[0x4a3524,"Botina de couro"]],kit:"Leva: sementes, enxada"},
 {n:"Eletricista",sub:"Profissão · −1 ponto",skin:0xb7835c,hair:{s:"short",c:0x111111},hat:{k:"hardhat",c:0xe8e8e2},top:{c:0x6f7377,sl:"long"},pants:{c:0x2a3038},shoes:0x111111,ex:[["belt",0x5a4026],["pouches",0x5a4026],["coil",0xc06a2a]],hand:"pliers",
  parts:[[0x6f7377,"Uniforme cinza"],[0xe8e8e2,"Capacete branco"],[0xc06a2a,"Rolo de fio no ombro"],[0x5a4026,"Cinto de ferramentas"]],kit:"Leva: alicate, fita isolante"},
 {n:"Motoboy",sub:"Profissão · 0 pontos",skin:0x8d5a3b,hair:{s:"buzz",c:0x111111},hat:{k:"moto",c:0x1d1f22},top:{c:0x2a2c30,sl:"long"},pants:{c:0x3b4a63},shoes:0xe0e0e0,ex:[["stripes",0x9fd0a0],["deliverybox",0xb8322a]],hand:null,
  parts:[[0x1d1f22,"Capacete fechado (protege a cabeça)"],[0x2a2c30,"Jaqueta com refletivo"],[0xb8322a,"Baú de entregas nas costas"],[0xe0e0e0,"Tênis branco"]],kit:"Leva: capacete, moto sem gasolina"},
 {n:"Professor(a)",sub:"Profissão · +2 pontos",skin:0xd2a885,hair:{s:"bald",c:0x6a6a66},face:["glasses","beard_g"],top:{c:0x7a6a4e,sl:"long"},pants:{c:0x4a443c},shoes:0x3a2a1e,ex:[["sweatervest",0x4a5a3e],["collar",0xd8d4c8],["satchel",0x6a4a2a]],lhand:"book",
  parts:[[0x4a5a3e,"Colete de tricô"],[0xd8d4c8,"Camisa social"],[0x6a4a2a,"Bolsa carteiro"],[0x8a8a86,"Barba grisalha e óculos"]],kit:"Leva: livro de química vol. 1"},
 {n:"Desempregado(a)",sub:"Profissão · +8 pontos",skin:0xc49a74,hair:{s:"short",c:0x2a1d14},hat:{k:"capback",c:0x8a2a2a},top:{c:0x6a6e70,sl:"long"},pants:{c:0x3b4a63},shoes:0x2a2a2a,ex:[["hood",0x6a6e70],["pocket",0x5c6062]],
  parts:[[0x6a6e70,"Moletom cinza com capuz"],[0x8a2a2a,"Boné virado para trás"],[0x3b4a63,"Jeans gasto"]],kit:"Leva: nada"}
];
const NPCS=[
 {n:"Dona Zilda Ramos",fem:1,sub:"67 anos · enfermeira aposentada · Igreja Matriz",skin:0x7a4c33,h:.94,hunch:.08,hair:{s:"bun",c:0xbfbcb4},face:["glasses"],top:{c:0x8a6aa0,sl:"long"},pants:{c:0x3a3440,skirt:1},shoes:0x2a2220,ex:[["blouse",0xe4ddd0],["cross",0xd8b040]],hand:"medbag",
  note:"Cor de assinatura: lilás do cardigã. Silhueta baixa, coque branco e a bolsa de enfermagem que ela nunca larga.",
  parts:[[0x8a6aa0,"Cardigã lilás"],[0xe4ddd0,"Blusa clara"],[0x3a3440,"Saia longa escura"],[0xd8b040,"Crucifixo dourado"],[0xbfbcb4,"Coque grisalho e óculos"]],kit:"Carrega: bolsa médica com curativos e insulina que não acha"},
 {n:"Tenente Marcos “Brasa” Valença",sub:"41 anos · ex-PM · Delegacia do 4º DP",skin:0xb47a52,h:1.07,bulk:1.18,hair:{s:"bald",c:0x111111},face:["stubble","cig"],top:{c:0x2b2f2a,sl:"short"},pants:{c:0x2a3038},shoes:0x111111,ex:[["vest",0x1b1d20],["pouches",0x24282a],["belt",0x15161a],["holster"],["armband",0x9a2a20]],back:"shotgun",
  note:"Cor de assinatura: braçadeira vermelha de quem manda. O maior do elenco, cabeça raspada, escopeta nas costas e cigarro na boca.",
  parts:[[0x1b1d20,"Colete tático com bolsas"],[0x2b2f2a,"Camiseta preta"],[0x9a2a20,"Braçadeira vermelha"],[0x5a3a22,"Escopeta calibre 12 nas costas"]],kit:"Carrega: escopeta, revólver .38, chaves do armário de armas"},
 {n:"Kauã Ferreira",sub:"19 anos · motoboy · nômade de telhados",skin:0x5a3826,h:.98,bulk:.88,hair:{s:"short",c:0x111111},hat:{k:"cap",c:0x1d4a6a},top:{c:0x1e1f22,sl:"long"},pants:{c:0x4a4f58},shoes:0xe0e0e0,ex:[["hood",0x1e1f22],["backpack",0x3a5a3a],["helmetpack",0x1d1f22],["radio"]],hand:"machete",
  note:"Cor de assinatura: boné azul. Magro, moletom preto, mochila e facão. É o personagem mais rápido do elenco, e a pose deixa isso claro.",
  parts:[[0x1e1f22,"Moletom preto com capuz"],[0x1d4a6a,"Boné azul"],[0x3a5a3a,"Mochila verde"],[0xe0c020,"Capacete preto com adesivo amarelo pendurado na mochila"],[0x9aa0a6,"Facão e rádio no peito"]],kit:"Carrega: rádio que capta a Jéssica, mapa riscado à mão"},
 {n:"Rosa Tavares",fem:1,sub:"34 anos · mecânica · Auto Center Tavares",skin:0xa8754f,hair:{s:"long",c:0x2a1a10},hat:{k:"bandana",c:0xb8322a},face:["goggles"],top:{c:0xd8d4c8,sl:"tank"},pants:{c:0x2d3a4f},shoes:0x2a2018,ex:[["tiedsleeves",0x2d3a4f],["stains"]],hand:"wrench",
  note:"Cor de assinatura: bandana vermelha. Macacão amarrado na cintura, óculos de solda na testa e a chave inglesa grande.",
  parts:[[0xb8322a,"Bandana vermelha"],[0xd8d4c8,"Regata"],[0x2d3a4f,"Macacão amarrado na cintura"],[0x4a6a5a,"Óculos de solda na testa"]],kit:"Carrega: chave inglesa, diesel escondido (segredo)"},
 {n:"Otávio Lins",sub:"52 anos · professor de química · Colégio Estadual",skin:0xd2a885,h:.97,hunch:.12,hair:{s:"bald",c:0x5a4a3a},face:["glasses","mustache"],top:{c:0x6a7a8a,sl:"long"},pants:{c:0x4a443c},shoes:0x3a2a1e,ex:[["labcoat",0xd8d6cc],["stains_y"]],hand:"bottle",
  note:"Cor de assinatura: jaleco manchado de amarelo (enxofre). Curvado, óculos, garrafa na mão. A postura já conta que ele bebe.",
  parts:[[0xd8d6cc,"Jaleco de laboratório"],[0xc9b040,"Manchas de enxofre"],[0x6a7a8a,"Camisa azul por baixo"],[0x3a6a3a,"Garrafa de álcool"]],kit:"Carrega: pólvora em pote, diário dos alunos"},
 {n:"Seu Benedito “Dito” Alves",sub:"71 anos · agricultor e caçador · Sítio Boa Vista",skin:0x6b4430,h:.95,hunch:.1,hair:{s:"bald",c:0xd8d8d0},face:["mustache_w"],hat:{k:"straw",c:0xc9b06a},top:{c:0x5a6a3a,sl:"long",plaid:0x2a3418},pants:{c:0x5a4a32},shoes:0x4a3524,ex:[["suspenders",0x3a2a1a]],back:"shotgun",dog:1,
  note:"Cor de assinatura: chapéu de palha. Bigode branco, suspensório, espingarda e o cachorro Trovão sempre ao lado.",
  parts:[[0xc9b06a,"Chapéu de palha"],[0x5a6a3a,"Camisa xadrez verde"],[0x3a2a1a,"Suspensório de couro"],[0xb07a3e,"Trovão, o cachorro caramelo"]],kit:"Carrega: espingarda 12, faca de caça"},
 {n:"Jéssica Monteiro",fem:1,sub:"27 anos · locutora · Torre da Rádio Vale FM",skin:0x5a3826,hair:{s:"afro",c:0x1a1310},face:["earrings"],top:{c:0x4a6a9a,sl:"long"},pants:{c:0x1e1f22},shoes:0xb8322a,ex:[["shirtpeek",0xe0b030],["headphones",0xd8262a]],hand:"mic",
  note:"Cor de assinatura: jaqueta jeans com camiseta amarela. Cabelo black power e fone no pescoço; é a voz da cidade.",
  parts:[[0x4a6a9a,"Jaqueta jeans"],[0xe0b030,"Camiseta amarela"],[0xd8262a,"Fone vermelho no pescoço (é por ele que a reconhecem como zumbi)"],[0xb8322a,"Tênis vermelho"]],kit:"Carrega: microfone sem fio, caderno de roteiros"},
 {n:"Dr. Henrique Sato",sub:"45 anos · infectologista · Hospital Regional",skin:0xd8b48e,hair:{s:"short",c:0x111111},face:["glasses","mask"],top:{c:0x3a5a6a,sl:"long"},pants:{c:0x2a3038},shoes:0x111111,ex:[["labcoat",0xeceae2],["gloves",0x6a9ad0],["blood"]],lhand:"clipboard",
  note:"Cor de assinatura: jaleco branco impecável com respingo de sangue. Máscara cirúrgica e luvas azuis: ele chega perto dos zumbis.",
  parts:[[0xeceae2,"Jaleco branco"],[0x6a9ad0,"Luvas e máscara cirúrgica"],[0x3a5a6a,"Pijama cirúrgico azul"],[0x7a1a14,"Respingo de sangue"]],kit:"Carrega: prancheta de observação, seringas"}
];
let mode=matchMedia('(prefers-reduced-motion: reduce)').matches?'idle':'walk';
const STAGES=[
 {t:"Saudável",skin:0,hunch:0,arms:0},
 {t:"Mal-estar (2 a 12 h)",skin:.18,hunch:.04,arms:0},
 {t:"Febre alta (12 a 30 h)",skin:.42,hunch:.12,arms:.1},
 {t:"Delírio (30 a 48 h)",skin:.68,hunch:.22,arms:.25},
 {t:"Reanimado: corredor",skin:1,hunch:.38,arms:1}];
const ZSKIN=new THREE.Color(0x6f7a5c);

// ---------- renderer & scene (same look as the test scene)
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const NIGHT=0x0b1018;
scene.background=new THREE.Color(NIGHT);
scene.fog=new THREE.FogExp2(NIGHT,0.075);
const camera=new THREE.PerspectiveCamera(38,1,.05,120);

const cache={};
function mat(c,o){if(!o&&cache[c])return cache[c];const m=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:true},o||{}));if(!o)cache[c]=m;return m;}
const Bx=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
function add(parent,geo,m,x,y,z,rx,ry,rz){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(77);
function canvasTex(w,h,draw,rx,ry){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new THREE.CanvasTexture(cv);if(rx){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);}return t;}

scene.add(new THREE.HemisphereLight(0x3a4c6a,0x0b0b0c,.6));
const moon=new THREE.DirectionalLight(0x8aa6d6,.38);moon.position.set(-8,14,10);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);
Object.assign(moon.shadow.camera,{left:-8,right:8,top:8,bottom:-4,near:1,far:40});moon.shadow.bias=-.0008;scene.add(moon);scene.add(moon.target);
const key=new THREE.SpotLight(0xffd9a8,2.1,16,.42,.6,1.6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0006;scene.add(key);scene.add(key.target);
const rim=new THREE.PointLight(0x6fa3c7,1.1,8,2);scene.add(rim);

// ground: road + sidewalk + wall
const roadTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#202226';g.fillRect(0,0,w,h);for(let i=0;i<2400;i++){g.fillStyle=['#18191c','#2a2c30','#141517'][i%3];g.globalAlpha=.2+R()*.4;const s=1+R()*2;g.fillRect(R()*w,R()*h,s,s);}g.globalAlpha=1;},18,4);
const walkTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#37393a';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){g.fillStyle=['#2d2e2f','#424344'][i%2];g.globalAlpha=.25+R()*.3;g.fillRect(R()*w,R()*h,2,2);}g.globalAlpha=1;g.strokeStyle='rgba(15,15,15,.6)';g.lineWidth=2;g.strokeRect(0,0,w,h);},40,4);
const road=new THREE.Mesh(new THREE.PlaneGeometry(90,12).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:roadTex,roughness:.8}));road.position.set(0,0,6.5);road.receiveShadow=true;scene.add(road);
const walk=new THREE.Mesh(Bx(90,.15,4.2),new THREE.MeshStandardMaterial({map:walkTex,roughness:.92}));walk.position.set(0,.075,-.6);walk.receiveShadow=true;scene.add(walk);
add(scene,Bx(90,.17,.22),mat(0x5b5852),0,.085,1.5);
// puddles
for(let i=0;i<14;i++){const p=new THREE.Mesh(new THREE.CircleGeometry(.5,20).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x1c232c,roughness:.12,metalness:.35}));p.position.set(-26+R()*52,.155+(i>7?-.15+.005:0),i>7?3+R()*4:-1.6+R()*1.8);p.scale.set(1+R()*1.6,1,.6+R());p.receiveShadow=true;scene.add(p);}
// wall with bricks and posters
const brickTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#2a2422';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){for(let x=((y/16)%2)*16-16;x<w;x+=32){const c=40+Math.floor(R()*22);g.fillStyle=`rgb(${c+18},${c},${c-6})`;g.fillRect(x+1,y+1,30,14);}}for(let i=0;i<10;i++){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(R()*w,R()*h*.4+h*.6,8+R()*20,30+R()*50);}},12,2);
const wall=new THREE.Mesh(Bx(90,7,.4),new THREE.MeshStandardMaterial({map:brickTex,roughness:.95}));wall.position.set(0,3.5,-2.9);wall.receiveShadow=true;scene.add(wall);
function poster(x,y,txt,bg,fg,rot){const t=canvasTex(256,340,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.font='700 46px "Arial Narrow",Arial,sans-serif';g.textAlign='center';txt.split('|').forEach((l,i)=>g.fillText(l,w/2,70+i*52));g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,h-60,w,60);g.fillStyle='rgba(40,20,10,.35)';for(let i=0;i<14;i++)g.fillRect(R()*w,R()*h,4+R()*30,2+R()*6);});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.2),new THREE.MeshStandardMaterial({map:t,roughness:.9}));m.position.set(x,y,-2.68);m.rotation.z=rot||0;scene.add(m);}
poster(-3.6,2.0,'EVACUAÇÃO|PONTE|NORTE|18H','#d8d2c0','#8a1a14',.04);
poster(5.2,1.8,'DESAPA-|RECIDA|LÍVIA|9 ANOS','#e0dccb','#1a1a1a',-.05);
poster(13.8,2.1,'RÁDIO|VALE FM|20H','#2a3a5a','#ffd27a',.03);
poster(-12.5,1.9,'NÃO|ENTRE|MORDIDOS','#d8d2c0','#1a1a1a',-.02);
// lamps
function lamp(x){const g=new THREE.Group();g.position.set(x,.15,1.15);scene.add(g);const pm=mat(0x2b2d30,{metalness:.5,roughness:.6});
  add(g,new THREE.CylinderGeometry(.08,.12,5,6),pm,0,2.5,0);add(g,Bx(.1,.1,1.3),pm,0,4.95,.6);add(g,Bx(.42,.16,.62),new THREE.MeshBasicMaterial({color:0xffc98a}),0,4.85,1.2);
  const L=new THREE.PointLight(0xffa25a,1.3,14,2);L.position.set(x,4.5,2.3);scene.add(L);}
lamp(-9);lamp(9);
// trash and barrier props
add(scene,Bx(1.8,1.2,1.0),mat(0x2f4a35,{metalness:.3,roughness:.7}),-17,.75,-2.0);
for(const [x,z] of[[-15.8,-2.2],[-16.4,-1.5],[19,-2.1],[7.6,-2.3]]){const b=add(scene,new THREE.DodecahedronGeometry(.33,0),mat(0x101112,{roughness:.35}),x,.45,z);b.scale.set(1.2,.85,1.1);}
for(let i=0;i<2;i++){const g=new THREE.Group();g.position.set(22+i*2.05,0,.2);scene.add(g);add(g,Bx(2,.32,.62),mat(0x7a7873),0,.31,0);add(g,Bx(2,.55,.32),mat(0x7a7873),0,.75,0);}
// burnt car in the background road
{const g=new THREE.Group();g.position.set(-6,0,8.5);g.rotation.y=1.4;scene.add(g);add(g,Bx(1.9,.7,4.2),mat(0x2a2522,{roughness:.8,metalness:.3}),0,.6,0);add(g,Bx(1.7,.6,2.1),mat(0x0f1012),0,1.25,-.2);const wg=new THREE.CylinderGeometry(.38,.38,.3,8).rotateZ(Math.PI/2);for(const a of[-1,1])for(const b of[-1,1])add(g,wg,mat(0x111111),a*.95,.38,b*1.35);}

// ---------- character builder (low poly anatômico: lathe + cilindros afinados + juntas esféricas)
function chessTex(c1,c2){const a=new THREE.Color(c1),b=new THREE.Color(c2);return canvasTex(32,32,(g)=>{g.fillStyle='#'+a.getHexString();g.fillRect(0,0,32,32);g.fillStyle='#'+b.getHexString();g.globalAlpha=.75;g.fillRect(0,6,32,4);g.fillRect(0,22,32,4);g.fillRect(6,0,4,32);g.fillRect(22,0,4,32);g.globalAlpha=1;});}
const SEG=16;
const ccache={};function cmat(c,o){if(!o&&ccache[c])return ccache[c];const m=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.82,metalness:0,flatShading:false},o||{}));if(!o)ccache[c]=m;return m;}
const PI=Math.PI;
function limb(parent,r1,r2,len,m){return add(parent,new THREE.CylinderGeometry(r1,r2,len,SEG,1).translate(0,-len/2,0),m,0,0,0);}
function mlimb(parent,prof,len,m){const pts=prof.map((r,i)=>new THREE.Vector2(r,-len+i/(prof.length-1)*len)).reverse();pts.reverse();const sm=new THREE.SplineCurve(prof.slice().reverse().map((r,i)=>new THREE.Vector2(r,-len+i/(prof.length-1)*len))).getPoints(14);return add(parent,new THREE.LatheGeometry(sm,SEG),m,0,0,0);}
function ball(parent,r,m,x,y,z){return add(parent,new THREE.SphereGeometry(r,SEG,12),m,x||0,y||0,z||0);}
function ring(parent,r,h,m,y,sx,sz){const o=add(parent,new THREE.CylinderGeometry(r,r,h,20),m,0,y,0);o.scale.set(sx||1.12,1,sz||.7);return o;}
function cap(r,len){return new THREE.SphereGeometry(r,20,10,0,PI*2,0,len||PI/2);}
function torsoGeo(fem){
  const P=fem?[[.17,.86],[.215,.95],[.2,1.02],[.165,1.1],[.2,1.25],[.245,1.38],[.25,1.46],[.2,1.54],[.085,1.6]]
             :[[.18,.86],[.205,.95],[.195,1.03],[.19,1.12],[.225,1.27],[.26,1.4],[.265,1.47],[.21,1.55],[.085,1.6]];
  const pts=new THREE.SplineCurve(P.map(p=>new THREE.Vector2(p[0],p[1]))).getPoints(30);const g=new THREE.LatheGeometry(pts,24);g.scale(1.12,1,.64);return g;
}
function blobR(n,rough,seed){const f=[];const ph=[seed*1.7,seed*3.1,seed*5.3,seed*7.9];const sp=[];const ns=rough>.5?Math.floor(R()*4):0;for(let k=0;k<ns;k++)sp.push([R()*6.28,.45+R()*.7]);
  for(let i=0;i<n;i++){const a=i/n*PI*2;let r=1+.16*Math.sin(2*a+ph[0])+.1*Math.sin(3*a+ph[1])+rough*(.08*Math.sin(7*a+ph[2])+.05*Math.sin(13*a+ph[3]))+rough*.05*(R()-.5);
    sp.forEach(([sa,l])=>{const d=Math.atan2(Math.sin(a-sa),Math.cos(a-sa));r+=l*Math.exp(-d*d*90);});f.push(Math.max(.35,r));}return f;}
function blobGeo(rad,rx,ry){const sh=new THREE.Shape();rad.forEach((r,i)=>{const a=i/rad.length*PI*2;const x=Math.cos(a)*r*rx,y=Math.sin(a)*r*ry;i?sh.lineTo(x,y):sh.moveTo(x,y);});return new THREE.ShapeGeometry(sh);}
const stainMs={};function stainM(c,o){const k=c+'|'+o;return stainMs[k]||(stainMs[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide},o||{})));}
function splat(parent,x,y,z,r,color,n,out,kind){
  const skin=kind==='skin',fresh=color===0x8a0a0a,push=o=>{o.castShadow=false;if(out)out.push(o);return o;};
  const sy=.8+R()*.4,seed=R()*10;
  const core=skin?stainM(color,{roughness:.12,metalness:.1}):stainM(new THREE.Color(color).multiplyScalar(.72).getHex());
  const a=push(add(parent,blobGeo(blobR(40,skin?.4:.9,seed),r*.82,r*.82*sy),core,x,y,z+.004));
  if(!skin){push(add(parent,blobGeo(blobR(48,1.6,seed+.3),r*1.3,r*1.3*sy),stainM(color,{transparent:true,opacity:.5,depthWrite:false}),x,y,z+.002));}
  for(let k=0;k<(n||0);k++){const ang=R()*6.28,d=r*(1.2+R()*.9),rr=r*(.16+R()*.2);
    push(add(parent,blobGeo(blobR(14,.5,R()*10),rr,rr*(1+R()*.6)),core,x+Math.cos(ang)*d,y+Math.sin(ang)*d-(k===0?r*.6:0),z+.004,0,0,ang));}
  if(n&&(fresh||skin)){const L=r*(1.4+R()*1.2),w=r*.16;const g=new THREE.Shape();g.moveTo(-w,0);g.quadraticCurveTo(-w*.6,-L*.6,-w*.35,-L);g.absarc(0,-L,w*.6,PI,0,false);g.quadraticCurveTo(w*.6,-L*.6,w,0);
    push(add(parent,new THREE.ShapeGeometry(g),core,x+r*.15,y-r*.55,z+.005));}
  return a;}
function build(sp,idx){
  const root=new THREE.Group();
  const H=sp.h||1,B=sp.bulk||1,fem=!!sp.fem;
  const fig=new THREE.Group();fig.scale.set(B,H,Math.min(1.12,B));root.add(fig);
  const skinM=new THREE.MeshStandardMaterial({color:sp.skin,roughness:.8,flatShading:false});
  const topM=sp.top.plaid?new THREE.MeshStandardMaterial({map:chessTex(sp.top.c,sp.top.plaid),roughness:.9,flatShading:false}):cmat(sp.top.c);
  const pantsM=cmat(sp.pants.c),shoeM=cmat(sp.shoes);
  const exHas=k=>(sp.ex||[]).some(e=>e[0]===k);
  // pelvis + legs
  const pel=ball(fig,.2,sp.pants.skirt?cmat(sp.pants.c):pantsM,0,.92,0);pel.scale.set(fem?1.16:1.08,.62,.74);
  const legs=[];
  for(const s of[-1,1]){const g=new THREE.Group();g.position.set(s*(fem?.115:.105),.9,0);fig.add(g);
    const thighM=sp.pants.skirt?skinM:pantsM;
    mlimb(g,fem?[.113,.117,.106,.09,.078]:[.106,.112,.104,.09,.078],.42,thighM);
    const kn=new THREE.Group();kn.position.y=-.42;g.add(kn);
    ball(kn,.078,thighM);
    const shinM=sp.pants.skirt?skinM:pantsM;mlimb(kn,[.077,.081,.07,.058,.052],.38,shinM);
    const kc=ball(kn,.04,shinM,0,-.005,.058);kc.scale.set(1.05,1.15,.7);const calf=ball(kn,.05,shinM,0,-.13,-.03);calf.scale.set(1.05,1.8,1);
    const sh=ball(kn,.074,shoeM,0,-.425,.055);sh.scale.set(.95,.72,1.85);
    const so=add(kn,new THREE.CylinderGeometry(.071,.071,.022,18),cmat(0x161616),0,-.468,.055);so.scale.set(1,1,1.95);
    if(sp.pants.skirt)add(g,new THREE.CylinderGeometry(.135,.178,.62,20,1,true).translate(0,-.28,0),pantsM,0,0,0);
    legs.push({g,kn,s});}
  for(const s of[-1,1]){const gl=ball(fig,.1,pantsM,s*.085,.87,-.075);gl.scale.set(1,.9,.72);}
  if(sp.pants.skirt){const sk=add(fig,new THREE.CylinderGeometry(.2,.245,.2,24),pantsM,0,.87,0);sk.scale.set(1.12,1,.8);}
  // upper body pivots at the hips
  const upper=new THREE.Group();upper.position.y=.9;fig.add(upper);
  const U=new THREE.Group();U.position.y=-.9;upper.add(U);
  add(U,torsoGeo(fem),topM,0,0,0);
  {const trapM=sp.top.sl==='tank'?skinM:topM;for(const s of[-1,1]){const tp=ball(U,.1,trapM,s*.12,1.545,-.02);tp.scale.set(1.35,.5,.85);
    const pc=ball(U,fem?.072:.09,topM,s*(fem?.072:.085),fem?1.36:1.38,fem?.088:.1);pc.scale.set(fem?1:1.1,fem?.85:.55,fem?.6:.35);}
   if(sp.top.sl==='tank')for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.011,.011,.16,8),skinM,s*.08,1.565,.1,0,0,s*1.35);}
  add(U,new THREE.CylinderGeometry(.058,.068,.14,16),skinM,0,1.63,0);
  const headG=new THREE.Group();headG.position.set(0,1.64,0);U.add(headG);
  const Hd=new THREE.Group();Hd.position.y=-1.64;headG.add(Hd);
  const head=add(Hd,new THREE.SphereGeometry(.165,20,16),skinM,0,1.8,0);head.scale.set(.96,1.1,1.02);
  const jaw=add(Hd,new THREE.SphereGeometry(.12,16,12),skinM,0,1.715,.03);jaw.scale.set(1,.72,1);
  for(const s of[-1,1]){const e=ball(Hd,.038,skinM,s*.158,1.79,-.005);e.scale.set(.6,1,.9);}
  add(Hd,Bx(.045,.065,.05),skinM,0,1.765,.172);
  const eyeM=new THREE.MeshBasicMaterial({color:0x1a1a1a});
  const whiteM=cmat(0xe9e4d8);
  for(const s of[-1,1]){const w=add(Hd,new THREE.SphereGeometry(.022,12,8),whiteM,s*.058,1.815,.146);w.scale.set(1.25,.8,.6);w.castShadow=false;
    const e=add(Hd,new THREE.SphereGeometry(.011,10,8),eyeM,s*.058,1.814,.159);e.scale.set(1,1,.5);e.castShadow=false;
    const lid=add(Hd,new THREE.SphereGeometry(.024,12,6,0,PI*2,0,PI*.45),skinM,s*.058,1.818,.143);lid.scale.set(1.25,.85,.65);
    add(Hd,Bx(.058,.013,.022),cmat(sp.hair.c),s*.06,1.852,.155,0,0,-s*.12);
    const ck=ball(Hd,.045,skinM,s*.078,1.772,.098);ck.scale.set(1,.7,.8);}
  const ridge=ball(Hd,.1,skinM,0,1.842,.105);ridge.scale.set(1.3,.28,.55);
  add(Hd,new THREE.SphereGeometry(.021,10,8),skinM,0,1.762,.182);
  add(Hd,Bx(.064,.013,.02),cmat(new THREE.Color(sp.skin).multiplyScalar(.68).getHex()),0,1.703,.156);
  const bags=add(Hd,Bx(.2,.022,.012),new THREE.MeshBasicMaterial({color:0x3a2a2a,transparent:true,opacity:0}),0,1.79,.166);bags.castShadow=false;
  // hair
  const hc=cmat(sp.hair.c),hs=sp.hair.s;
  const hairCap=(r,len,tilt)=>{const o=add(Hd,cap(r,len),hc,0,1.8,-.004);o.scale.set(.97,1.1,1.04);o.rotation.x=tilt;return o;};
  const backBand=(t0,tl)=>{const o=add(Hd,new THREE.SphereGeometry(.172,20,10,PI*.85,PI*1.3,t0,tl),hc,0,1.8,0);o.scale.set(.97,1.1,1.04);return o;};
  if(hs==='short'||hs==='bun'||hs==='long'){hairCap(.174,PI/2,-.38);backBand(PI*.45,PI*.22);}
  if(hs==='bun')ball(Hd,.085,hc,0,1.92,-.15);
  if(hs==='long'){const l=add(Hd,new THREE.CylinderGeometry(.15,.12,.42,16,1,false,PI*.6,PI*.8),hc,0,1.66,-.02);l.scale.set(1.05,1,1.1);}
  if(hs==='buzz')hairCap(.17,PI*.45,-.32);
  if(hs==='bald')backBand(PI*.42,PI*.2);
  if(hs==='afro'){const a=add(Hd,new THREE.DodecahedronGeometry(.25,0),hc,0,1.9,-.045);a.scale.set(1.08,.9,1.02);}
  // face
  const f=sp.face||[];
  if(f.includes('glasses')||f.includes('glasses_y')){const lens=new THREE.MeshStandardMaterial({color:f.includes('glasses_y')?0xd8b030:0x8fb0c0,roughness:.15,metalness:.3,transparent:true,opacity:.35});
    add(Hd,Bx(.27,.012,.015),cmat(0x1a1a1a),0,1.84,.175);for(const s of[-1,1]){add(Hd,Bx(.09,.055,.012),lens,s*.06,1.817,.178);add(Hd,Bx(.012,.012,.17),cmat(0x1a1a1a),s*.15,1.83,.09);}}
  if(f.includes('mustache'))add(Hd,Bx(.13,.035,.03),hc,0,1.728,.165);
  if(f.includes('mustache_w'))add(Hd,Bx(.17,.045,.03),cmat(0xe6e4dc),0,1.726,.166);
  if(f.includes('beard_g')){const b=add(Hd,new THREE.SphereGeometry(.128,16,12),cmat(0x8a8a86),0,1.7,.035);b.scale.set(1.02,.78,1);}
  if(f.includes('stubble')){const b=add(Hd,new THREE.SphereGeometry(.123,16,12),cmat(new THREE.Color(sp.skin).multiplyScalar(.62).getHex()),0,1.705,.032);b.scale.set(1,.74,1);}
  if(f.includes('mask'))add(Hd,Bx(.24,.12,.04),cmat(0xaed0de),0,1.72,.15);
  if(f.includes('goggles')){const b=add(Hd,new THREE.CylinderGeometry(.168,.168,.035,20,1,true),cmat(0x1a1a1a),0,1.9,0);b.scale.set(.97,1,1.04);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.04,.04,.04,16).rotateX(PI/2),cmat(0x4a6a5a,{roughness:.2,metalness:.5}),s*.06,1.91,.165);}
  if(f.includes('earrings'))for(const s of[-1,1])add(Hd,new THREE.TorusGeometry(.028,.007,4,8),cmat(0xd8b040,{metalness:.8,roughness:.3}),s*.162,1.74,0,0,PI/2,0);
  if(f.includes('cig')){add(Hd,Bx(.014,.014,.09),cmat(0xeeeeee),.05,1.7,.19);const e=add(Hd,Bx(.017,.017,.017),new THREE.MeshBasicMaterial({color:0xff6a2a}),.05,1.7,.237);e.castShadow=false;}
  // hats
  if(sp.hat){const k=sp.hat.k,c=cmat(sp.hat.c);
    if(k==='cap'||k==='capback'){const o=add(Hd,cap(.182,PI/2),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,Bx(.28,.022,.17),c,0,1.85,k==='cap'?.2:-.2,k==='cap'?.12:-.12,0,0);}
    if(k==='beret'){const o=add(Hd,new THREE.CylinderGeometry(.2,.185,.07,20),c,.025,1.95,0,0,0,.16);o.scale.set(1,1,1.05);}
    if(k==='hardhat'){const o=add(Hd,cap(.198,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.08);add(Hd,new THREE.CylinderGeometry(.25,.25,.02,20),c,0,1.865,.02);add(Hd,Bx(.03,.06,.38),c,0,2.04,0);}
    if(k==='fire'){const o=add(Hd,cap(.205,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.1);const br=add(Hd,new THREE.CylinderGeometry(.27,.27,.02,20),c,0,1.86,-.06);br.scale.set(1,1,1.25);add(Hd,Bx(.09,.08,.02),cmat(0xd8b040,{metalness:.7}),0,1.96,.205);}
    if(k==='straw'){add(Hd,new THREE.CylinderGeometry(.38,.38,.022,24),c,0,1.93,0);add(Hd,new THREE.CylinderGeometry(.155,.18,.15,20),c,0,2.01,0);add(Hd,new THREE.CylinderGeometry(.182,.182,.03,20),cmat(0x5a3a22),0,1.955,0);}
    if(k==='moto'){const o=add(Hd,new THREE.SphereGeometry(.235,20,16),c,0,1.81,-.01);o.scale.set(.98,1.04,1.06);add(Hd,new THREE.SphereGeometry(.226,20,10,PI*.18,PI*.64,PI*.36,PI*.2),new THREE.MeshStandardMaterial({color:0x10141a,roughness:.1,metalness:.8,flatShading:false}),0,1.81,.02);add(Hd,new THREE.CylinderGeometry(.215,.2,.05,20),cmat(0xb8322a),0,1.6,-.01);}
    if(k==='bandana'){const o=add(Hd,cap(.18,PI*.48),c,0,1.8,-.005);o.scale.set(.98,1.1,1.05);o.rotation.x=-.4;add(Hd,Bx(.07,.12,.03),c,0,1.76,-.19,.3,0,0);}
  }
  // arms: shoulder -> elbow -> hand
  const arms=[];
  const glove=(sp.ex||[]).find(e=>e[0]==='gloves');
  for(const s of[1,-1]){const g=new THREE.Group();g.position.set(s*(fem?.285:.305),1.475,0);U.add(g);
    const sl=sp.top.sl;
    const upM=sl==='tank'?skinM:topM,foreM=sl==='long'?topM:skinM;
    const dl=ball(g,sl==='short'?.09:.083,upM,0,-.015,0);dl.scale.set(1.08,1.2,1.05);
    mlimb(g,sl==='short'?[.085,.089,.086,.08,.076]:[.074,.08,.078,.066,.06],.31,upM);const bi=ball(g,.042,upM,0,-.13,.026);bi.scale.set(1,1.7,1);
    const el=new THREE.Group();el.position.y=-.31;g.add(el);
    ball(el,.06,foreM);
    mlimb(el,[.06,.067,.06,.05,.044],.29,foreM);
    const hg=new THREE.Group();hg.position.y=-.3;el.add(hg);const handM=glove?cmat(glove[1]):skinM;const palm=ball(hg,.048,handM,0,-.035,0);palm.scale.set(.6,1.05,1);
    const fingers=[];for(let f=0;f<4;f++){const fg=new THREE.Group();fg.position.set(0,-.078,.027-f*.018);hg.add(fg);const len=[.034,.038,.036,.03][f];
      add(fg,new THREE.CylinderGeometry(.0105,.0105,len,8).translate(0,-len/2,0),handM,0,0,0);const f2=new THREE.Group();f2.position.y=-len;fg.add(f2);
      add(f2,new THREE.CylinderGeometry(.0105,.009,len*.85,8).translate(0,-len*.42,0),handM,0,0,0);add(f2,new THREE.SphereGeometry(.0095,8,6),handM,0,-len*.85,0);fingers.push(fg,f2);}
    const th=new THREE.Group();th.position.set(-s*.018,-.03,.034);th.rotation.set(-.5,0,-s*.45);hg.add(th);add(th,new THREE.CylinderGeometry(.012,.01,.045,8).translate(0,-.022,0),handM,0,0,0);add(th,new THREE.SphereGeometry(.01,8,6),handM,0,-.045,0);
    const mount=new THREE.Group();mount.position.set(0,-.04,.015);hg.add(mount);
    g.rotation.z=s*.07;
    arms.push({g,el,hg,mount,s,fingers,th});}
  // extras
  for(const e of sp.ex||[]){const [k,c]=e;const m=c!==undefined?cmat(c):null;
    switch(k){
    case'steth':add(U,Bx(.022,.24,.022),cmat(0x2a2c30),.085,1.45,.17);add(U,Bx(.022,.24,.022),cmat(0x2a2c30),-.085,1.45,.17);add(U,new THREE.CylinderGeometry(.038,.038,.02,16).rotateX(PI/2),cmat(0x9aa0a6,{metalness:.8,roughness:.3}),.03,1.31,.18);break;
    case'mask_chin':add(Hd,Bx(.24,.07,.04),m,0,1.645,.12);break;
    case'vest':{const v=add(U,new THREE.CylinderGeometry(.275,.24,.48,20),m,0,1.3,0);v.scale.set(1.12,1,.7);for(let i=0;i<3;i++)add(U,Bx(.11,.13,.05),m,-.15+i*.15,1.17,.17);break;}
    case'pouches':add(U,Bx(.1,.12,.09),m,.17,.95,-.15);add(U,Bx(.1,.12,.09),m,-.17,.95,-.15);break;
    case'belt':ring(U,.212,.07,m,.95,1.12,.72);break;
    case'holster':add(legs[1].g,Bx(.06,.2,.11),cmat(0x111111),.105,-.1,0);break;
    case'radio':add(U,Bx(.075,.12,.05),cmat(0x1a1a1a),.15,1.42,.18);add(U,Bx(.012,.1,.012),cmat(0x1a1a1a),.17,1.52,.18);break;
    case'stripes':ring(U,.205,.05,m,1.03,1.13,.68);ring(U,.268,.05,m,1.42,1.13,.67);arms.forEach(a=>{const r=add(a.el,new THREE.CylinderGeometry(.058,.054,.05,18),m,0,-.17,0);});break;
    case'legstripes':legs.forEach(l=>add(l.kn,new THREE.CylinderGeometry(.07,.067,.05,18),m,0,-.22,0));break;
    case'stains':for(let i=0;i<4;i++)splat(U,-.16+R()*.32,1.15+R()*.3,.158,.025+R()*.02,0x151515,2);break;
    case'stains_y':for(let i=0;i<4;i++)splat(U,-.2+R()*.4,1.0+R()*.4,.2,.03+R()*.02,0xc9b040,2);break;
    case'rag':add(U,Bx(.08,.16,.03),m,-.17,.92,.15);break;
    case'apron':add(U,Bx(.4,.38,.025),m,0,1.2,.158,-.07,0,0);add(U,Bx(.42,.2,.025),m,0,.95,.158);legs.forEach(l=>add(l.g,Bx(.2,.36,.025),m,-l.s*.01,-.19,.112));add(U,Bx(.02,.2,.02),m,.11,1.52,.15);add(U,Bx(.02,.2,.02),m,-.11,1.52,.15);break;
    case'buttons':for(let i=0;i<3;i++)add(U,Bx(.03,.03,.02),cmat(0x2a2a2a),.1,1.48-i*.08,.165);break;
    case'earpro':case'headphones':{const r=add(U,new THREE.TorusGeometry(.13,.022,8,20,PI),m,0,1.6,-.02,-PI/2+.3,0,0);for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.055,.055,.06,16).rotateZ(PI/2),m,s*.14,1.57,.05);break;}
    case'coil':add(U,new THREE.TorusGeometry(.16,.032,8,20),m,.2,1.38,0,0,PI/2,.5);break;
    case'deliverybox':add(U,Bx(.52,.5,.44),m,0,1.32,-.38);add(U,Bx(.53,.06,.45),cmat(0xe8e8e2),0,1.43,-.38);for(const s of[-1,1])add(U,Bx(.04,.46,.03),cmat(0x111111),s*.14,1.3,.17,-.1,0,0);break;
    case'backpack':{const b=add(U,new THREE.CylinderGeometry(.2,.22,.54,16),m,0,1.24,-.26);b.scale.set(1.15,1,.6);add(U,Bx(.3,.16,.07),m,0,1.08,-.4);for(const s of[-1,1])add(U,Bx(.045,.46,.03),cmat(0x1a1a1a),s*.15,1.3,.17,-.1,0,0);break;}
    case'helmetpack':{const h=add(U,new THREE.SphereGeometry(.15,18,14),m,.2,.98,-.42);h.scale.set(1,1.05,1.05);add(U,Bx(.09,.07,.02),cmat(0xe0c020),.24,1.0,-.565,0,.25,0);add(U,new THREE.CylinderGeometry(.14,.13,.04,18),cmat(0xb8322a),.2,.85,-.42);break;}
    case'hood':{const h=add(U,new THREE.TorusGeometry(.13,.06,8,20,PI*1.2),m,0,1.6,-.03,PI/2,0,PI*-.1);h.scale.set(1.1,1.2,1);break;}
    case'pocket':add(U,Bx(.32,.13,.03),m,0,1.03,.135);break;
    case'sweatervest':{const g=torsoGeo(fem);g.scale(1.04,1,1.1);add(U,g,m,0,0,0);break;}
    case'collar':add(U,Bx(.18,.05,.05),m,0,1.58,.1);break;
    case'satchel':add(U,Bx(.045,.82,.02),cmat(0x3a2a1a),0,1.2,.18,0,0,.68);add(U,Bx(.28,.24,.1),m,-.1,.92,-.2);break;
    case'blouse':add(U,Bx(.12,.26,.02),m,0,1.38,.157);break;
    case'cross':add(U,Bx(.022,.085,.015),m,0,1.37,.178);add(U,Bx(.055,.02,.015),m,0,1.39,.178);break;
    case'armband':add(arms[1].g,new THREE.CylinderGeometry(.08,.078,.08,18),m,0,-.12,0);break;
    case'tiedsleeves':ring(U,.215,.1,m,.95,1.12,.74);legs.forEach(l=>add(l.g,Bx(.1,.26,.05),m,l.s*.02,-.1,.105));break;
    case'labcoat':{const g=torsoGeo(fem);g.scale(1.06,1,1.12);add(U,g,m,0,0,0);ring(U,.22,.14,m,.9,1.12,.76);legs.forEach(l=>add(l.g,new THREE.CylinderGeometry(.145,.165,.46,20,1,true).translate(0,-.21,0),m,0,0,0));
      add(U,Bx(.025,.62,.012),cmat(0x9a9a92),0,1.2,.19);
      arms.forEach(a=>{add(a.g,new THREE.CylinderGeometry(.085,.075,.31,18).translate(0,-.155,0),m,0,0,0);add(a.el,new THREE.CylinderGeometry(.072,.064,.27,18).translate(0,-.135,0),m,0,0,0);});
      add(U,Bx(.1,.09,.02),m,-.15,1.4,.19);break;}
    case'gloves':break;
    case'blood':for(let i=0;i<3;i++)splat(U,.06+R()*.14,1.1+R()*.3,.2,.022+R()*.02,0x3b1d14,3);break;
    case'shirtpeek':add(U,Bx(.16,.26,.02),m,0,1.38,.163);break;
    case'suspenders':for(const s of[-1,1])add(U,Bx(.035,.3,.02),m,s*.11,1.4,.163);break;
    }}
  // back weapon
  if(sp.back==='shotgun'){const g=new THREE.Group();g.position.set(0,1.22,-.2-(exHas('backpack')?.22:0));g.rotation.z=.75;U.add(g);
    add(g,Bx(.05,.9,.05),cmat(0x1c1d1f,{metalness:.6,roughness:.45}),0,.15,0);add(g,Bx(.07,.36,.09),cmat(0x6a3a1c),0,-.45,0);add(g,Bx(.06,.22,.07),cmat(0x6a3a1c),0,.15,.03);
    add(U,Bx(.04,.9,.02),cmat(0x3a2a1a),0,1.22,.175,0,0,-.75);}
  // hand items
  function item(kind,mount){if(!kind)return;const g=new THREE.Group();mount.add(g);
    const metal=cmat(0x8a9096,{metalness:.7,roughness:.35}),dark=cmat(0x1c1d1f,{metalness:.6,roughness:.45}),woodM=cmat(0x6a3a1c);
    switch(kind){
    case'axe':add(g,Bx(.05,.78,.05),woodM,0,-.18,0);add(g,Bx(.04,.14,.26),cmat(0x9a2a20),0,-.55,.09);add(g,Bx(.045,.14,.05),metal,0,-.55,.23);break;
    case'machete':add(g,Bx(.05,.14,.06),cmat(0x111111),0,-.02,0);add(g,Bx(.015,.5,.08),metal,0,-.34,.015);break;
    case'wrench':add(g,Bx(.05,.5,.07),metal,0,-.18,0);add(g,Bx(.05,.08,.18),metal,0,-.45,.04);break;
    case'hammer':add(g,Bx(.04,.34,.04),woodM,0,-.13,0);add(g,Bx(.055,.07,.18),dark,0,-.3,.02);break;
    case'hoe':add(g,Bx(.04,1.42,.04),woodM,0,-.06,0);add(g,Bx(.24,.04,.14),metal,0,-.74,.07,.35,0,0);break;
    case'baton':add(g,new THREE.CylinderGeometry(.022,.022,.55,16),cmat(0x111111),0,-.2,0);break;
    case'knife':add(g,Bx(.035,.1,.04),cmat(0x111111),0,-.02,0);add(g,Bx(.01,.24,.05),metal,0,-.18,.005);break;
    case'pistol':add(g,Bx(.04,.11,.06),dark,0,-.04,0);add(g,Bx(.04,.06,.2),dark,0,.02,.07);break;
    case'pliers':add(g,Bx(.03,.2,.03),cmat(0xc0322a),.015,-.08,0);add(g,Bx(.03,.2,.03),cmat(0xc0322a),-.015,-.08,0);add(g,Bx(.04,.08,.03),metal,0,-.21,0);break;
    case'medbag':add(g,Bx(.36,.24,.18),cmat(0xe4e2da),0,-.16,0);add(g,Bx(.03,.09,.01),cmat(0xb8322a),0,-.16,.095);add(g,Bx(.09,.03,.01),cmat(0xb8322a),0,-.16,.095);add(g,Bx(.18,.04,.03),cmat(0x2a2a2a),0,-.02,0);break;
    case'toolbox':add(g,Bx(.42,.2,.2),cmat(0xb33a2a,{metalness:.3,roughness:.5}),0,-.14,0);add(g,Bx(.24,.04,.04),dark,0,-.01,0);break;
    case'book':add(g,Bx(.05,.26,.2),cmat(0x2a4a6a),0,-.12,.02);add(g,Bx(.052,.24,.01),cmat(0xe0dccb),0,-.12,.12);break;
    case'bottle':add(g,new THREE.CylinderGeometry(.045,.045,.2,16),new THREE.MeshStandardMaterial({color:0x3a6a3a,roughness:.15,metalness:.2,transparent:true,opacity:.85,flatShading:false}),0,-.1,.02);add(g,new THREE.CylinderGeometry(.018,.03,.08,16),cmat(0x3a6a3a),0,.03,.02);break;
    case'clipboard':add(g,Bx(.03,.32,.24),cmat(0x6a4a2a),0,-.12,.04);add(g,Bx(.035,.26,.2),cmat(0xe8e6dc),0,-.13,.04);break;
    case'mic':add(g,new THREE.CylinderGeometry(.022,.028,.18,16),cmat(0x1a1a1a),0,0,0);add(g,new THREE.DodecahedronGeometry(.045,0),cmat(0x6a6e72,{metalness:.6}),0,.1,0);g.rotation.x=-.4;break;
    }}
  item(sp.hand,arms[0].mount);item(sp.lhand,arms[1].mount);
  if(sp.hand)arms[0].hold=true;
  if(sp.lhand)arms[1].hold=true;
  // zombie blood + mouth (stage 4)
  const zb=[];for(let i=0;i<4;i++)splat(U,-.15+R()*.3,1.2+R()*.25,.17,.035+R()*.025,0x3b1d14,3,zb);{const mb=stainM(0x8a0a0a,{roughness:.1,metalness:.15});splat(Hd,0,1.672,.152,.026,0x8a0a0a,2,zb,'skin');
    const st=add(Hd,new THREE.CylinderGeometry(.0035,.0025,.05,6).translate(0,-.025,0),mb,.03,1.676,.15);zb.push(st);const dg=add(Hd,new THREE.SphereGeometry(.007,8,6),mb,.03,1.626,.15);dg.userData.zdrop=1;zb.push(dg);}zb.forEach(b=>b.visible=false);
  // body segments: each one hangs from a joint; a cut at a joint takes everything after it
  const tag=(o,seg)=>o.traverse(m=>{if(m.isMesh&&m.userData.seg===undefined)m.userData.seg=seg;});
  arms.forEach((a,k)=>{tag(a.mount,'item');tag(a.hg,'hand'+k);tag(a.el,'fArm'+k);tag(a.g,'uArm'+k);a.g.children[0].userData.joint=1;a.el.children[0].userData.joint=1;});
  legs.forEach((l,k)=>{tag(l.kn,'shin'+k);tag(l.g,'thigh'+k);l.kn.children[0].userData.joint=1;});
  tag(headG,'head');tag(U,'torso');tag(fig,'pelvis');
  const SIDE=['esquerdo','direito'],LSIDE=['direita','esquerda'];
  const segs={head:{node:headG,label:'Cabeça',hp:40,r:.07,flip:1},torso:{label:'Tronco',hp:120},pelvis:{label:'Quadril',hp:90}};
  arms.forEach((a,k)=>{segs['uArm'+k]={node:a.g,label:'Braço '+SIDE[k],hp:60,r:.085,arm:k,kind:'shoulder'};segs['fArm'+k]={node:a.el,label:'Antebraço '+SIDE[k],hp:45,r:.065,arm:k,kind:'elbow'};segs['hand'+k]={node:a.hg,label:'Mão '+SIDE[k],hp:25,r:.05,arm:k,kind:'wrist'};});
  legs.forEach((l,k)=>{segs['thigh'+k]={node:l.g,label:'Coxa '+LSIDE[k],hp:80,r:.1,leg:k};segs['shin'+k]={node:l.kn,label:'Canela e pé '+LSIDE[k],hp:55,r:.08,leg:k};});
  for(const k in segs){segs[k].max=segs[k].hp;segs[k].state='ok';}
  const mouth=add(Hd,Bx(.1,.04,.02),cmat(0x3a0a08),0,1.69,.145);mouth.visible=false;
  // dog
  let dog=null;
  if(sp.dog){dog=new THREE.Group();dog.position.set(.78,0,.3);dog.rotation.y=-.5;root.add(dog);const dm=cmat(0xb07a3e),dl=cmat(0xd8b07a);
    const body=add(dog,new THREE.CylinderGeometry(.12,.11,.56,16).rotateX(PI/2),dm,0,.42,0);body.scale.set(1,1.05,1);
    ball(dog,.12,dm,0,.43,.26);
    const hd=ball(dog,.1,dm,0,.6,.38);
    add(dog,new THREE.CylinderGeometry(.045,.055,.12,16).rotateX(PI/2),dl,0,.57,.5);
    add(dog,Bx(.03,.03,.02),cmat(0x111111),0,.585,.565);
    for(const s of[-1,1]){add(dog,new THREE.ConeGeometry(.035,.09,5),dm,s*.06,.7,.36,0,0,s*-.3);}
    const dlegs=[];for(const a of[-1,1])for(const b of[-1,1]){const lg=new THREE.Group();lg.position.set(a*.075,.36,b*.21);dog.add(lg);limb(lg,.035,.028,.34,dm);dlegs.push({lg,ph:(a*b>0?0:PI)});}
    const tail=new THREE.Group();tail.position.set(0,.48,-.28);dog.add(tail);add(tail,new THREE.CylinderGeometry(.02,.012,.24,16).rotateX(PI/2).translate(0,0,-.1),dm,0,0,0,.6,0,0);
    dog.userData={tail,dlegs};}
  root.traverse(o=>{if(o.isMesh)o.userData.idx=idx;});
  return {mv:Object.assign({},MOVES.idle),phase:0,turnA:0,segs,dmg:{leg:0,dead:0},pends:[],limp:[0,0],skirt:!!sp.pants.skirt,root,fig,upper,headG,arms,legs,skinM,base:new THREE.Color(sp.skin),eyeM,bags,zb,mouth,dog,hunch:sp.hunch||0,ph:R()*6};
}

// ---------- movement states (blended every frame)
const MOVES={
 idle:  {gait:0, freq:0,  amp:0,  knee:0,  bob:0,   lean:0,   arm:0,   elb:.12, crouch:0,  aim:0, turn:0, grip:.35},
 walk:  {gait:1, freq:5.6,amp:.42,knee:.85,bob:.035,lean:.05, arm:.42, elb:.3,  crouch:0,  aim:0, turn:0, grip:.4},
 run:   {gait:1, freq:9.2,amp:.72,knee:1.5,bob:.06, lean:.3,  arm:.85, elb:1.35,crouch:0,  aim:0, turn:0, grip:1.1},
 crouch:{gait:1, freq:3.8,amp:.3, knee:.6, bob:.02, lean:.42, arm:.15, elb:.7,  crouch:1,  aim:0, turn:0, grip:.8},
 aim:   {gait:0, freq:0,  amp:0,  knee:0,  bob:0,   lean:.06, arm:0,   elb:.2,  crouch:.25,aim:1, turn:0, grip:1.2},
 turn:  {gait:.5,freq:4.2,amp:.14,knee:.7, bob:.012,lean:.03, arm:.12, elb:.25, crouch:0,  aim:0, turn:1, grip:.4}};
// ---------- lineups
const SP=2.3;
let group='npc',list=NPCS,chars=[],sel=0,stage=0;
const lineup=new THREE.Group();scene.add(lineup);
function makeLineup(){
  while(lineup.children.length)lineup.remove(lineup.children[0]);
  chars=list.map((sp,i)=>{const c=build(sp,i);c.root.position.set((i-(list.length-1)/2)*SP,.15,-.6);c.root.rotation.y=0;lineup.add(c.root);return c;});
  applyStage();
}
function applyStage(){
  const st=STAGES[stage];
  chars.forEach(c=>{
    c.skinM.color.copy(c.base).lerp(ZSKIN,st.skin);
    c.bags.material.opacity=stage>=1?Math.min(.9,.3+stage*.2):0;
    const z=stage===4;
    c.eyeM.color.set(z?0xff3a2a:0x1a1a1a);
    c.zb.forEach(b=>b.visible=z);c.mouth.visible=z;
  });
  $('infTxt').textContent=st.t;$('infTxt').style.color=stage===0?'var(--fg)':stage<4?'var(--rot)':'var(--blood)';
}

// ---------- UI
function renderChips(){
  $('chips').innerHTML=list.map((s,i)=>`<button type="button" id="ch${i}" aria-pressed="${i===sel}">${s.n.replace(/ “.*”/,'').replace('Tenente Marcos','Ten. Brasa').replace('Seu Benedito','Seu Dito')}</button>`).join('');
  list.forEach((s,i)=>{$('ch'+i).onclick=()=>select(i);});
}
function renderInfo(){
  const s=list[sel];
  $('bName').textContent=s.n;$('bSub').textContent=s.sub;
  $('wTag').textContent=group==='npc'?'Sobrevivente único':'Roupa de profissão do jogador';
  $('wName').textContent=s.n;$('wSub').textContent=s.sub;
  $('wNote').textContent=s.note||'Visual inicial do personagem jogável com essa profissão. Corpo, rosto e tom de pele são escolhidos na criação; a roupa e o item vêm da profissão.';
  $('wParts').innerHTML=s.parts.map(p=>`<li><i style="background:#${new THREE.Color(p[0]).getHexString()}"></i><span>${p[1]}</span></li>`).join('');
  $('wKit').textContent=s.kit;
  list.forEach((_,i)=>{const b=$('ch'+i);if(b)b.setAttribute('aria-pressed',String(i===sel));});
}
function select(i){sel=(i+list.length)%list.length;renderInfo();renderDmg();}
const FLY=[],DROPS=[],POOLS=[],DRIPS=[];let dripT=0;
const dropGeo=new THREE.SphereGeometry(.02,8,6),dropM=new THREE.MeshStandardMaterial({color:0x7a0909,roughness:.35});
const markM=new THREE.MeshStandardMaterial({color:0x6e0808,roughness:.3,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
const poolM=new THREE.MeshStandardMaterial({color:0x6a0707,roughness:.22,metalness:0});
function groundAt(x,z){return z<1.5?.152:.002;}
const dryM=new THREE.MeshStandardMaterial({color:0x3b1d14,roughness:.92,metalness:0});
const DRY_S=30; // demo: 10 min de jogo comprimidos em 30 s
function fanGeo(n){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((n+1)*3),3));const idx=[];for(let i=0;i<n;i++)idx.push(0,(i+1)%n+1,i+1);g.setIndex(idx);g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((n+1)*3).map((v,i)=>i%3===1?1:0),3));return g;}
function addPool(x,z,r){const n=48,seed=Math.random()*10,rad=[],sp=[];r*=.8+Math.random()*.4;const lobes=2+Math.floor(Math.random()*3),la=[];for(let k=0;k<lobes;k++)la.push([Math.random()*6.28,.25+Math.random()*.55]);
  for(let i=0;i<n;i++){const a=i/n*PI*2;let q=.75+.12*Math.sin(3*a+seed)+.06*Math.sin(7*a+seed*2)+.03*Math.sin(17*a+seed*3);la.forEach(([sa,l])=>{const d=Math.atan2(Math.sin(a-sa),Math.cos(a-sa));q+=l*Math.exp(-d*d*4);});rad.push(q*r);
    let v=.55+.25*Math.sin(2*a+seed*1.3);la.forEach(([sa])=>{const d=Math.atan2(Math.sin(a-sa),Math.cos(a-sa));v+=.6*Math.exp(-d*d*6);});sp.push(v);}
  const G=new THREE.Group();G.position.set(x,groundAt(x,z)+.004+POOLS.length*.0002,z);G.rotation.y=Math.random()*6.28;
  const dry=new THREE.Mesh(fanGeo(n),dryM),wet=new THREE.Mesh(fanGeo(n),poolM);wet.position.y=.0012;dry.receiveShadow=wet.receiveShadow=true;G.add(dry,wet);
  G.userData={rad,sp,t:0,age:0,born:performance.now(),dry,wet,n};scene.add(G);POOLS.push(G);}
function poolShape(m,f){const u=m.userData,P=m.geometry.attributes.position;for(let i=0;i<u.n;i++){const a=i/u.n*PI*2,rr=u.rad[i]*f(i);P.setXYZ(i+1,Math.cos(a)*rr,0,Math.sin(a)*rr);}P.needsUpdate=true;m.geometry.computeBoundingSphere();}
function land(d,g){scene.remove(d.m);const p=d.m.position,v=d.v;
  for(const G of POOLS){const u=G.userData;const dx=p.x-G.position.x,dz=p.z-G.position.z;const ra=u.rad.reduce((a,b)=>a+b,0)/u.n;if(u.age<DRY_S*.5&&dx*dx+dz*dz<Math.pow(ra*1.15,2)){if(u.rad.length&&u.feed===undefined)u.feed=0;u.feed++;if(u.feed<40)for(let i=0;i<u.n;i++)u.rad[i]*=1.004;return;}}
  if(Math.random()<.5)return;
  const sp=Math.hypot(v.x,v.z),sn=Math.max(.25,Math.abs(v.y)/Math.hypot(v.x,v.y,v.z));const el=Math.min(3,1/sn),hd=Math.atan2(v.x,v.z);
  const m=new THREE.Group();m.position.set(p.x,g+.003,p.z);m.rotation.y=hd;scene.add(m);
  const r=.012+Math.random()*.012;const mk=(rx,rz,ox,oz)=>{const geo=blobGeo(blobR(16,.7,Math.random()*10),rx,rz).rotateX(-PI/2);const o=new THREE.Mesh(geo,markM);o.position.set(ox,0,oz);o.receiveShadow=true;m.add(o);};
  mk(r,r*el,0,0);const ns=1+(Math.random()<.5?1:0);for(let k=0;k<ns;k++){const rr=r*(.25+Math.random()*.25);mk(rr,rr*(1+el*.4),(Math.random()-.5)*r*1.4,r*el*(1.3+Math.random()*.8));}
  DROPS.push({m});while(DROPS.length>130)scene.remove(DROPS.shift().m);}
function burst(pos,dir,n){for(let i=0;i<n;i++){const m=new THREE.Mesh(dropGeo,dropM);m.position.copy(pos);scene.add(m);const v=new V(dir.x+(Math.random()-.5)*2.2,1+Math.random()*2.2,dir.z+(Math.random()-.5)*2.2);DROPS.push({m,v});}
  while(DROPS.length>200){scene.remove(DROPS.shift().m);}}
function fly(obj,dir,owner,r){obj.updateWorldMatrix(true,true);const cl=obj.clone(true);obj.matrixWorld.decompose(cl.position,cl.quaternion,cl.scale);scene.add(cl);
  if(r){if(cl.children[0]&&cl.children[0].userData.joint)cl.children[0].visible=false;makeCut(cl,r,true);}
  FLY.push({o:cl,v:new V(dir.x*1.6,2.6,dir.z*1.6+.6),w:new V((Math.random()-.5)*9,(Math.random()-.5)*6,(Math.random()-.5)*9),rest:false,owner});}
function worldSide(c,s){return new V(s,0,0).applyQuaternion(c.root.quaternion);}
const woundM=new THREE.MeshStandardMaterial({color:0x8a0a0a,roughness:.18,metalness:.08}),boneM=new THREE.MeshStandardMaterial({color:0xe8e0cc,roughness:.6});
const meatM=new THREE.MeshStandardMaterial({color:0x4a0606,roughness:.75,side:THREE.DoubleSide}),fatM=new THREE.MeshStandardMaterial({color:0xb7956a,roughness:.7}),rimM=new THREE.MeshStandardMaterial({color:0x8a0a0a,roughness:.3,side:THREE.DoubleSide});
function makeCut(g,r,up){const s=up?1:-1;
  const rim=new THREE.Mesh(blobGeo(blobR(30,1.4,Math.random()*10),r*1.12,r*1.12).rotateX(-s*PI/2),rimM);rim.position.y=s*.001;g.add(rim);
  const meat=new THREE.Mesh(blobGeo(blobR(24,.6,Math.random()*10),r*.9,r*.9).rotateX(-s*PI/2),meatM);meat.position.y=s*.004;g.add(meat);
  const fat=new THREE.Mesh(new THREE.TorusGeometry(r*.86,r*.06,6,22),fatM);fat.rotation.x=PI/2;fat.position.y=s*.005;g.add(fat);
  const b=new THREE.Mesh(new THREE.CylinderGeometry(r*.26,r*.3,r*.7,9),boneM);b.position.set(r*.12,s*r*.3,0);b.rotation.z=.12;g.add(b);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(r*.26,r*.35,7),boneM);tip.position.set(r*.16,s*r*.75,0);tip.rotation.set(up?0:PI,0,.3);g.add(tip);
  for(let k=0;k<5;k++){const a=k/5*PI*2+Math.random()*.6;const f=new THREE.Mesh(new THREE.ConeGeometry(r*.16,r*(.35+Math.random()*.35),4),k%2?rimM:meatM);f.position.set(Math.cos(a)*r*.98,s*r*.12,Math.sin(a)*r*.98);if(!up)f.rotation.x=PI;g.add(f);}
  const em=[];for(let k=0;k<2;k++){const a=Math.random()*PI*2,L=r*(.5+Math.random()*.6);const st=new THREE.Mesh(new THREE.CylinderGeometry(r*.05,r*.03,L,6).translate(0,-L/2,0),rimM);st.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.add(st);
    const e=new THREE.Object3D();e.position.set(Math.cos(a)*r,-L,Math.sin(a)*r);g.add(e);em.push(e);}
  g.traverse(o=>{o.userData.stump=1;if(o.isMesh)o.castShadow=true;});return em;}
function makeStump(parent,pos,r,flip){const g=new THREE.Group();g.position.copy(pos);if(flip)g.rotation.x=Math.PI;parent.add(g);
  makeCut(g,r,false).forEach(e=>DRIPS.push(e));return g;}
function ringWound(parent,r,y){const g=new THREE.Group();g.position.y=y||0;parent.add(g);const t=new THREE.Mesh(new THREE.TorusGeometry(r,.022,8,18),woundM);t.rotation.x=Math.PI/2;g.add(t);for(let k=0;k<3;k++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.12,6),woundM);c.position.set((k-1)*.03,.03,.02);g.add(c);}g.traverse(o=>o.userData.stump=1);return g;}
function shown(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
const BELOW={uArm:['fArm','hand'],fArm:['hand'],thigh:['shin']};
const FALLS={uArm:'o braço inteiro',fArm:'o antebraço com a mão',hand:'a mão',thigh:'a perna inteira',shin:'a canela com o pé',head:'a cabeça'};
function sever(c,id){const s=c.segs[id];if(!s||!s.node||s.state==='cut')return;
  const p=new V();s.node.getWorldPosition(p);const side=worldSide(c,s.node.position.x>=0?1:-1);
  fly(s.node,side,c,s.r);s.node.visible=false;makeStump(s.node.parent,s.node.position,s.r,s.flip);
  s.state='cut';s.hp=0;
  (BELOW[id.replace(/\d/,'')]||[]).forEach(b=>{const o=c.segs[b+id.slice(-1)];if(o){o.state='cut';o.hp=0;}});
  c.pends=c.pends.filter(P=>shown(P.node));
  if(s.leg!==undefined)c.dmg.leg=1;
  if(id==='head')c.dmg.dead=1;
  burst(p,side,id==='head'?60:40);addPool(p.x+side.x*.25,p.z+.15,id==='head'?.45:.32);}
function breakBone(c,id){const s=c.segs[id];if(s.state==='cut'||s.state==='quebrado')return;s.state='quebrado';s.hp=0;
  if(s.arm!==undefined&&s.kind!=='wrist'){const node=s.kind==='shoulder'?c.arms[s.arm].g:c.arms[s.arm].el;ringWound(node,s.kind==='shoulder'?.078:.064,s.kind==='shoulder'?-.06:-.01);c.pends=c.pends.filter(P=>P.node!==node);c.pends.push({node,kind:s.kind,arm:s.arm,a:node.rotation.x,v:6});}
  if(s.leg!==undefined){c.limp[s.leg]=1;if(c.limp[0]&&c.limp[1])c.dmg.leg=1;}}
const WEAPONS=[{id:'faca',n:'Faca',dmg:22,cut:.7},{id:'facao',n:'Facão',dmg:55,cut:1},{id:'machado',n:'Machado',dmg:85,cut:1},{id:'p9',n:'Pistola 9 mm',dmg:30,cut:.15},{id:'e12',n:'Espingarda 12',dmg:95,cut:.75},{id:'f762',n:'Fuzil 7,62',dmg:65,cut:.45}];
let weapon=WEAPONS[1],shootMode=false,viewParts=false,lastMsg='';
function hit(c,id,point,normal,obj){const s=c.segs[id];if(!s||s.state==='cut'||c.dmg.dead&&id!=='head')return;
  const d=weapon.dmg*(.85+Math.random()*.3);s.hp=Math.max(0,s.hp-d);
  const m=new THREE.Mesh(new THREE.SphereGeometry(.026+weapon.dmg/3000,12,8),woundM);obj.parent.add(m);m.position.copy(obj.parent.worldToLocal(point.clone()));m.lookAt(point.clone().add(normal));m.scale.z=.25;m.userData.stump=1;
  burst(point,normal,8+Math.round(weapon.dmg/6));
  let msg=`${weapon.n} no ${s.label.toLowerCase()}: −${Math.round(d)}, resta ${Math.round(s.hp)} de ${s.max}.`;
  const base=id.replace(/\d/,'');
  if(s.hp<=0&&id==='head'){if(weapon.cut>=.7||weapon.dmg>=90){sever(c,'head');msg+=' Cabeça arrancada.';}else{s.state='quebrado';c.dmg.dead=1;msg+=' Tiro na cabeça: abatido.';}}
  else if(s.hp<=0&&s.node){if(weapon.cut>=.5||d>=s.max*.9){sever(c,id);msg+=` Cortado na junta: cai ${FALLS[base]}.`;}else{breakBone(c,id);msg+=s.arm!==undefined&&s.kind!=='wrist'?' Osso quebrado: o membro fica pendurado.':s.leg!==undefined?' Osso quebrado: passa a mancar.':' Osso quebrado.';}}
  else if(s.hp<=0){s.state='quebrado';if(id==='torso'){c.dmg.dead=1;msg+=' Ferimento fatal no tronco (humano). Zumbi só cai com tiro na cabeça.';}else{c.dmg.leg=1;msg+=' Quadril destruído: rasteja.';}}
  else if(s.state==='ok')s.state='ferido';
  lastMsg=msg;renderDmg();}
const PART_COL={head:0xe0a548,torso:0x6fa3c7,pelvis:0x3f5f8f,uArm:0xc4483b,fArm:0xe0806a,hand:0xf2cc8f,thigh:0x4f8a4a,shin:0x9fc25a,item:0x555555,joint:0xffffff};
const partMats={};
function paintParts(on){chars.forEach(c=>c.root.traverse(o=>{if(!o.isMesh||o.userData.stump)return;
  if(on){if(!o.userData.orig)o.userData.orig=o.material;const key=o.userData.joint?'joint':(o.userData.seg||'item').replace(/\d/,'');partMats[key]=partMats[key]||new THREE.MeshStandardMaterial({color:PART_COL[key]||0x555555,roughness:.7,emissive:key==='joint'?0x777777:0});o.material=partMats[key];}
  else if(o.userData.orig)o.material=o.userData.orig;}));}
function heal(){const i=sel,c=chars[i];for(let k=FLY.length-1;k>=0;k--)if(FLY[k].owner===c){scene.remove(FLY[k].o);FLY.splice(k,1);}
  const n=build(list[i],i);n.root.position.copy(c.root.position);n.root.rotation.copy(c.root.rotation);lineup.remove(c.root);lineup.add(n.root);chars[i]=n;applyStage();if(viewParts)paintParts(true);lastMsg='Curado: corpo inteiro de novo.';renderDmg();}
function renderDmg(){const c=chars[sel];if(!c)return;const S=c.segs;
  $('d1').setAttribute('aria-pressed',String(S.uArm1.state==='cut'));$('d2').setAttribute('aria-pressed',String(S.fArm0.state==='quebrado'));$('d3').setAttribute('aria-pressed',String(S.thigh0.state==='cut'));
  const ST={ok:'inteiro',ferido:'ferido',quebrado:'osso quebrado',cut:'arrancado'};
  $('segList').innerHTML=['head','torso','pelvis','uArm0','fArm0','hand0','uArm1','fArm1','hand1','thigh1','shin1','thigh0','shin0'].map(k=>{const g=S[k];return `<div class="seg ${g.state}"><span>${g.label}</span><div class="sb"><i style="width:${Math.round(g.hp/g.max*100)}%"></i></div><b>${ST[g.state]}</b></div>`;}).join('');
  $('hitMsg').textContent=lastMsg||(shootMode?'Clique numa parte do corpo para acertar.':'Ligue o modo tiro e clique numa parte do corpo.');}
function renderWeapons(){$('weapons').innerHTML=WEAPONS.map(w=>`<button type="button" id="w_${w.id}" aria-pressed="${w===weapon}">${w.n}</button>`).join('');WEAPONS.forEach(w=>{$('w_'+w.id).onclick=()=>{weapon=w;renderWeapons();};});}
renderWeapons();
$('mShoot').onclick=()=>{shootMode=!shootMode;$('mShoot').setAttribute('aria-pressed',String(shootMode));canvas.classList.toggle('shoot',shootMode);lastMsg='';renderDmg();};
$('mParts').onclick=()=>{viewParts=!viewParts;$('mParts').setAttribute('aria-pressed',String(viewParts));paintParts(viewParts);};
$('d0').onclick=heal;
$('d1').onclick=()=>{sever(chars[sel],'uArm1');lastMsg='Braço direito cortado no ombro: cai o braço inteiro, com antebraço e mão.';renderDmg();};
$('d2').onclick=()=>{breakBone(chars[sel],'fArm0');lastMsg='Antebraço esquerdo com osso quebrado: fica pendurado no cotovelo.';renderDmg();};
$('d3').onclick=()=>{sever(chars[sel],'thigh0');lastMsg='Perna direita cortada no quadril: cai a perna inteira, e o corpo passa a rastejar.';renderDmg();};
function clearFx(){DRIPS.length=0;FLY.splice(0).forEach(f=>scene.remove(f.o));DROPS.splice(0).forEach(d=>scene.remove(d.m));POOLS.splice(0).forEach(m=>scene.remove(m));}
function updateFx(dt){
  chars.forEach(c=>c.zb.forEach(b=>{if(!b.userData.zdrop||!b.visible)return;const u=b.userData;u.t=((u.t||0)+dt*.45)%1;const s1=Math.min(1,u.t*1.6);b.scale.set(1-s1*.2,1+s1*1.4,1-s1*.2);b.position.y=1.626-Math.max(0,u.t-.62)*.5-s1*.006;}));
  dripT+=dt;if(dripT>.35&&DRIPS.length){dripT=0;const live=DRIPS.filter(g=>g.parent&&shown(g));if(live.length){const g=live[Math.floor(Math.random()*live.length)];const p=new V();g.getWorldPosition(p);const m=new THREE.Mesh(dropGeo,dropM);m.position.copy(p);scene.add(m);DROPS.push({m,v:new V((Math.random()-.5)*.2,-.2,(Math.random()-.5)*.2)});}}
  FLY.forEach(f=>{if(f.rest)return;f.v.y-=9.8*dt;f.o.position.addScaledVector(f.v,dt);const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(f.w.x*dt,f.w.y*dt,f.w.z*dt));f.o.quaternion.multiply(q);
    const g=groundAt(f.o.position.x,f.o.position.z)+.08;if(f.o.position.y<g){f.o.position.y=g;if(Math.abs(f.v.y)>1.2){f.v.y*=-.25;f.v.x*=.5;f.v.z*=.5;f.w.multiplyScalar(.4);}else{f.rest=true;const e=new THREE.Euler().setFromQuaternion(f.o.quaternion);f.o.rotation.set(Math.PI/2*(Math.random()<.5?1:-1),e.y,0);f.o.position.y=g;addPool(f.o.position.x,f.o.position.z,.22);}}});
  for(let i=DROPS.length-1;i>=0;i--){const d=DROPS[i];if(!d.v)continue;d.v.y-=9.8*dt;d.m.position.addScaledVector(d.v,dt);const g=groundAt(d.m.position.x,d.m.position.z);if(d.m.position.y<=g+.01){d.gone=g;}}
  const landed=DROPS.filter(d=>d.gone!==undefined);if(landed.length){for(let i=DROPS.length-1;i>=0;i--)if(DROPS[i].gone!==undefined)DROPS.splice(i,1);landed.forEach(d=>land(d,d.gone));}
  POOLS.forEach(G=>{const u=G.userData;u.age=(performance.now()-u.born)/1000; // secagem em tempo real, mesmo com FPS baixo
    if(u.t<1)u.t=Math.min(1,u.t+dt*.35);
    const grow=i=>{const e=Math.min(1,u.t*(.7+u.sp[i]));return 1-Math.pow(1-e,2.4);};
    const d=Math.max(0,Math.min(1,(u.age-1)/DRY_S));
    if(u.t<1||d<1){poolShape({userData:u,geometry:u.dry.geometry},grow);
      poolShape({userData:u,geometry:u.wet.geometry},i=>grow(i)*Math.max(0,1-d*(1+.5*(1-Math.min(u.sp[i],2)/2)))*Math.min(1,(1-d)*4));u.wet.visible=d<.98;}});
}
function setGroup(g){clearFx();lastMsg='';group=g;list=g==='npc'?NPCS:PROFS;sel=0;$('tNpc').setAttribute('aria-pressed',String(g==='npc'));$('tProf').setAttribute('aria-pressed',String(g!=='npc'));makeLineup();if(viewParts)paintParts(true);renderChips();renderInfo();renderDmg();camX=chars[0].root.position.x;}
$('tNpc').onclick=()=>setGroup('npc');$('tProf').onclick=()=>setGroup('prof');
const MODE_LIST=[['idle','Parado'],['walk','Andar'],['run','Correr'],['crouch','Agachado'],['aim','Mirar'],['turn','Virar']];
function setMode(md){mode=md;MODE_LIST.forEach(([id])=>$('mv_'+id).setAttribute('aria-pressed',String(id===md)));}
$('modes').innerHTML=MODE_LIST.map(([id,n])=>`<button type="button" id="mv_${id}" aria-pressed="false">${n}</button>`).join('');
MODE_LIST.forEach(([id])=>{$('mv_'+id).onclick=()=>setMode(id);});
setMode(mode);
$('prev').onclick=()=>select(sel-1);$('next').onclick=()=>select(sel+1);
$('inf').oninput=e=>{stage=+e.target.value;applyStage();};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowLeft')select(sel-1);if(e.key==='ArrowRight')select(sel+1);});

// ---------- camera control
let yaw=.38,yawT=.38,camX=0,dragging=false,moved=0,lx=0,idle=0;
canvas.addEventListener('pointerdown',e=>{dragging=true;moved=0;lx=e.clientX;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lx;lx=e.clientX;moved+=Math.abs(dx);yawT=Math.max(-1.25,Math.min(1.25,yawT-dx*.008));idle=0;});
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
canvas.addEventListener('pointerup',e=>{dragging=false;if(moved<5){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const h=ray.intersectObjects(lineup.children,true).find(x=>shown(x.object)&&!x.object.userData.stump&&x.object.userData.seg&&x.object.userData.seg!=='item');if(h&&h.object.userData.idx!==undefined){if(h.object.userData.idx!==sel)select(h.object.userData.idx);if(shootMode){const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);hit(chars[sel],h.object.userData.seg,h.point,n,h.object);}}}});

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);

setGroup('npc');resize();

// ---------- loop
const clock=new THREE.Clock();
function tick(){
  const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
  idle+=dt;
  if(!dragging&&idle>2.5&&!reduce)yawT=.38+Math.sin(t*.25)*.55;
  yaw+=(yawT-yaw)*Math.min(1,dt*4);
  const tx=chars[sel].root.position.x;camX+=(tx-camX)*Math.min(1,dt*3.5);
  const d=camera.aspect<.8?6.0:4.8;
  camera.position.set(camX+Math.sin(yaw)*d,1.55,-.6+Math.cos(yaw)*d);
  camera.lookAt(camX,1.05,-.6);
  key.position.set(camX+1.6,4.2,2.6);key.target.position.set(camX,1,-.6);
  rim.position.set(camX-1.2,2.2,-1.9);
  moon.position.set(camX-8,14,10);moon.target.position.set(camX,0,-.6);
  const st=STAGES[stage];
  const TGT=MOVES[mode];
  chars.forEach((c,i)=>{
    const p=c.ph+t;const focus=i===sel;const z=stage===4;const m=c.mv;
    for(const k in TGT)m[k]+=(TGT[k]-m[k])*Math.min(1,dt*4);
    c.phase+=dt*m.freq*(z?.62:1);const ph=c.phase+c.ph;
    const G=reduce?0:m.gait;const W=G;
    // pelvis: weight shift when still, sway toward the stance leg when moving, crouch drop
    const shift=reduce?0:Math.sin(t*.45+c.ph)*(1-G)*(1-m.aim);
    c.upper.scale.y=1+(reduce?0:Math.sin(p*(1.6+m.freq*.12))*(.012+m.freq*.0012));
    c.fig.position.x=shift*.025+G*Math.sin(ph)*.018;
    c.fig.position.y=-G*m.bob*Math.abs(Math.sin(ph))-m.crouch*.26;
    c.fig.rotation.z=shift*.02-G*Math.sin(ph)*.022;
    c.turnA+=dt*1.3*m.turn;if(m.turn<.5){const tg=Math.round(c.turnA/(PI*2))*PI*2;c.turnA+=(tg-c.turnA)*Math.min(1,dt*2);}
    c.fig.rotation.y=c.turnA;
    // spine lags the hips (cascade), leans with speed, turns to aim
    const hunch=c.hunch+st.hunch+m.lean;
    c.upper.rotation.x=hunch+m.crouch*.15+(stage>=3&&!reduce?Math.sin(p*2.3)*.03:0);
    c.upper.rotation.y=G*Math.sin(ph-.35)*(.08+m.arm*.12)-m.aim*.35+m.turn*.25;
    c.upper.rotation.z=-shift*.025+G*Math.sin(ph-.35)*.02+(z?.05+Math.sin(ph*.5)*.06*G:0);
    // head: steadies against the spine, leads a turn, follows the aim
    c.headG.rotation.y=(reduce?0:Math.sin(p*.5)*.25*(1-G)*(1-m.aim)*(z?.3:1))-c.upper.rotation.y*.75*(1-m.turn)+m.turn*.45+m.aim*.3;
    c.headG.rotation.x=-hunch*.6-m.crouch*.12+(z?.15:0)+G*Math.sin(ph*2-.6)*.02;
    c.headG.rotation.z=(z?.22:0)-c.upper.rotation.z*.6;
    // legs
    c.legs.forEach((l,k)=>{const phi=ph+(k?PI:0);
      const amp=m.amp*(z&&k===0?.45:1)*(c.skirt?.75:1);
      l.g.rotation.x=-G*Math.sin(phi)*amp-m.crouch*.95+(z&&!G?(k?-.1:.08):0);
      l.kn.rotation.x=G*(Math.max(0,Math.cos(phi))*m.knee*(z&&k===0?.3:1)+.06)+m.crouch*1.55+(1-G)*(.03+Math.max(0,shift*(k?1:-1))*.18);
      l.g.rotation.z=l.s*(.02+m.aim*.1+m.crouch*.06);});
    // arms: shoulder -> elbow -> wrist -> fingers, each a little behind the one before
    c.arms.forEach((a,k)=>{const raise=st.arms*(a.hold&&!z?.2:1);const base=a.hold?-.2:0;const sp=ph-.25;
      let ax=base-raise*(z?1.12:1.3)-a.s*Math.sin(sp)*m.arm*G*(z?.3:1)+(reduce||G?0:Math.sin(p*1.6+a.s)*.04)+(z&&!reduce?Math.sin(p*3+a.s*2)*.08:0);
      const aimX=k===0?-1.45:-1.32;
      a.g.rotation.x=ax*(1-m.aim)+aimX*m.aim;
      a.g.rotation.z=a.s*(.07+(z?.1:0))*(1-m.aim)-a.s*.32*m.aim;
      a.el.rotation.x=z?-.18:-((m.elb+(a.hold?.25:0)+G*Math.max(0,a.s*Math.sin(sp-.3))*.3)*(1-m.aim)+(k===0?.15:.55)*m.aim);
      a.hg.rotation.x=reduce?0:-G*Math.sin(sp-.6)*.15*a.s*(1-m.aim);
      const grip=(a.hold?1.25:m.grip)*(z?.5:1);
      a.fingers.forEach((f,j)=>f.rotation.z=-a.s*grip*(j%2?1.1:.9));a.th.rotation.z=-a.s*(.45+grip*.25);});
    if(c.dmg.leg&&!c.dmg.dead){ // prone crawl on the arms
      const cp=t*2.2+c.ph;c.fig.rotation.x+=(1.38-c.fig.rotation.x)*Math.min(1,dt*4);c.fig.position.y=.2+Math.abs(Math.sin(cp))*.02;c.fig.rotation.z=Math.sin(cp)*.05;
      c.upper.rotation.x=0;c.upper.rotation.y=Math.sin(cp)*.12;c.headG.rotation.x=-.95;c.headG.rotation.z=0;
      c.arms.forEach(a=>{a.g.rotation.x=-2.55+a.s*Math.sin(cp)*.45;a.g.rotation.z=a.s*.25;a.el.rotation.x=-.35-Math.max(0,-a.s*Math.sin(cp))*.6;});
      c.legs[1].g.rotation.x=.12+Math.sin(cp)*.08;c.legs[1].kn.rotation.x=.25;c.legs[0].g.rotation.x=.1;c.legs[0].kn.rotation.x=0;
    }else if(!c.dmg.dead)c.fig.rotation.x=0;
    c.limp.forEach((L,k)=>{if(L&&!c.dmg.leg){c.legs[k].g.rotation.x*=.3;c.legs[k].kn.rotation.x=.05;c.upper.rotation.z+=(k?-.07:.07);}});
    c.pends.forEach(P=>{const a=c.arms[P.arm];const base=P.kind==='shoulder'?c.upper.rotation.x+c.fig.rotation.x:a.g.rotation.x+c.upper.rotation.x+c.fig.rotation.x;
      const acc=-26*(P.a+base)-1.8*P.v+(W?Math.sin(ph*2)*9:0);P.v+=acc*dt;P.a+=P.v*dt;P.node.rotation.x=P.a;P.node.rotation.z=(P.kind==='shoulder'?a.s*.12:0)+Math.sin(P.a*3)*.12;if(P.kind==='shoulder')a.el.rotation.x=-.05;});
    if(c.dmg.dead){c.fig.rotation.x+=(-1.45-c.fig.rotation.x)*Math.min(1,dt*3);c.fig.position.y=.22;c.fig.rotation.z=0;c.upper.rotation.set(0,0,0);c.headG.rotation.set(0,.5,0);
      c.arms.forEach(a=>{a.g.rotation.x=-.2;a.g.rotation.z=a.s*1.1;a.el.rotation.x=-.3;});c.legs.forEach((l,k)=>{l.g.rotation.x=0;l.g.rotation.z=k?.15:-.15;l.kn.rotation.x=.1;});}
    c.root.rotation.y+=((focus?0:(i<sel?.35:-.35))-c.root.rotation.y)*Math.min(1,dt*3);
    if(c.dog&&!reduce){const d=c.dog.userData;d.tail.rotation.y=Math.sin(t*9)*.5;d.dlegs.forEach(l=>{l.lg.rotation.x=W*Math.sin(t*7+l.ph)*.45;});}
  });
  updateFx(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(tick);
}
tick();
})();
