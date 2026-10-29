// fonte: site/pages/animais/bichos-do-vale.html
// texto visível: Bichos do Vale ZombiAdA · Vale Cinzento · fauna Bichos do Vale Vale a pena ter animais, desde que cada um tenha função. Todo bicho no Vale serve para pelo menos uma de quatro coisas: avisar, alimentar, ameaçar ou acompanhar. Nada de fauna só de enfeite que gaste rede. São 13 espécies da fauna do interior brasileiro. Só os mamíferos que caçam e comem carne viram zumbi. Os herbívoros morrem da mordida e viram isca. Aves e cobras são imunes. Estúdio 3D Regra da infecção Elenco Onde vivem Sistemas Desempenho Ordem de produção Elenco humano Para que serve cada bicho Alarme quero-quero · galinha · cão · urubu Gritam, cacarejam, latem ou circulam no céu. Avisam o jogador, mas o barulho também acorda zumbis por perto. Comida e material vaca · capivara · porco · javali · galinha Carne que estraga em 2 dias, ovos, leite, couro e penas para flecha. Caçar faz barulho e sangue chama zumbis. Ameaça cão infectado · javali · onça · jararaca · ratos Perigos que não são horda: bote, investida, emboscada e enxame. Cada um quebra a rotina de um jeito diferente. Companhia cão · cavalo · gato O cão é o parceiro, o cavalo leva você sem combustível e sem motor, e o gato protege o estoque da base contra ratos. Estúdio 3D Mesmo estilo do elenco humano: formas arredondadas com sombreado suave e corpo montado por juntas (quadril, joelho, jarrete, pescoço, mandíbula, cauda). Escolha o bicho e o movimento. Em Juntas a pele fica translúcida e as articulações acendem. Em Separar cada parte se afasta da junta, como o desmembramento. Cão vira-lata caramelo Noite Dia Parado Andar Correr Infectado Juntas Separar arraste para girar · role para aproximar Regra da infecção Uma regra só, fácil de aprender olhando: o vírus pega em mamífero que morde e come carne . A mordida continua sendo o único jeito de virar zumbi, para humano e para bicho. Vira zumbi cão · gato · porco · javali · rato · onça Vira em 10 a 30 min (rato em 2 min, onça em 1 h). Mordida de bicho infectado infecta o jogador igual à de humano. Usa os mesmos estados dos zumbis: fresco, podre, seco. Rápido quando fresco. Pele cinza esverdeada, falhas no pelo, costela à mostra, olho leitoso, boca com sangue. Morre da mordida vaca · cavalo · capivara Morre em 2 a 6 h e não levanta. A carcaça cheira: chama zumbis num raio de 200 m por 1 dia e urubus em 10 min. Dá para usar como isca e desviar uma horda da base. Cavalo mordido: o jogador decide sacrificar ou montar até ele cair. Imune galinha · urubu · quero-quero · jararaca Aves e répteis não pegam o vírus. Urubus comem carniça infectada sem efeito e marcam no céu onde há mortos. A picada da jararaca é veneno, não infecção. Ícone e som diferentes da mordida para o jogador não confundir. Comer carne de bicho infectado nunca transforma. Mal passada, dá intoxicação (vômito, sede, 30% menos vigor por 6 h). Bem cozida, é segura. Assim a regra do jogo continua clara: mordeu, já era. Comeu, só passa mal. Elenco Toque numa ficha para ver o bicho no estúdio. Sem modelo próprio, só como 

// ===== script 1 (47 KB)

'use strict';
const PI=Math.PI;
// ---------- dados ----------
const SPECIES=[
 {id:'cao',nome:'Cão',sub:'vira-lata caramelo',sci:'Canis familiaris',grupo:'Doméstico',fase:'MVP',inf:'vira',
  onde:'Quintais e ruas das cinco cidades. Matilhas soltas na periferia a partir da semana 2.',
  papel:'Companheiro. Fareja loot e rastro, guarda a base e rosna para zumbi a 40 m.',
  cuidado:'Infectado: corre a 9 m/s, baixo demais para tiro na cabeça fácil, late e chama a horda.',
  rende:'Nada. Cão não é comida no Vale.',som:'Latido atrai zumbis a 60 m. Rosnado não atrai.'},
 {id:'gato',nome:'Gato',sub:'gato de rua rajado',sci:'Felis catus',grupo:'Doméstico',fase:'Fase 2',inf:'vira',
  onde:'Telhados, mercados, depósitos e casas abandonadas das cidades.',
  papel:'Na base, caça ratos e derruba a perda de comida. Chia para zumbi que se aproxima.',
  cuidado:'Infectado: pula do alto (telhado, armário) no rosto. Pouco dano, mas infecta.',
  rende:'Nada.',som:'Chiado curto, não atrai.'},
 {id:'galinha',nome:'Galinha',sub:'caipira',sci:'Gallus gallus',grupo:'Fazenda',fase:'MVP',inf:'imune',
  onde:'Quintais de chácara, sítios e todas as fazendas.',
  papel:'1 ovo por dia no galinheiro. Cacarejo assustado é alarme da base.',
  cuidado:'O mesmo cacarejo atrai zumbis a 30 m.',
  rende:'1 kg de carne, ovos e penas para flecha.',som:'Cacarejo de alarme, alcance 30 m.'},
 {id:'vaca',nome:'Vaca',sub:'nelore',sci:'Bos indicus',grupo:'Fazenda',fase:'MVP',inf:'morre',
  onde:'Pastos entre Santa Aurora e Campo Largo e as fazendas de Três Pontes.',
  papel:'Carne, leite e couro. Carcaça de vaca é a melhor isca para desviar horda.',
  cuidado:'Tiro perto do rebanho provoca estouro de boiada, que derruba zumbis e jogadores.',
  rende:'120 kg de carne, leite com bezerro, couro para armadura leve.',som:'Mugido de sede atrai zumbis a 80 m.'},
 {id:'cavalo',nome:'Cavalo',sub:'crioulo baio',sci:'Equus caballus',grupo:'Fazenda',fase:'Fase 2',inf:'morre',
  onde:'Haras ao lado do aeroclube de Campo Largo e fazendas grandes.',
  papel:'Montaria silenciosa sem combustível. Galope de 12 m/s e 60 kg de carga.',
  cuidado:'Assusta com tiro e derruba quem tem pouca prática. Zumbis perseguem cavalo.',
  rende:'Transporte. Comer cavalo é possível, mas é o último recurso.',som:'Relincho atrai a 50 m.'},
 {id:'porco',nome:'Porco',sub:'caipira',sci:'Sus domesticus',grupo:'Fazenda',fase:'Fase 2',inf:'vira',
  onde:'Chiqueiros de sítios e fazendas da zona rural oeste e leste.',
  papel:'Come restos e corpos. Um chiqueiro tira da base o cheiro que atrai hordas.',
  cuidado:'Infectado: pesado, investida derruba e atravessa cerca de arame.',
  rende:'50 kg de carne e banha para conservar.',som:'Guincho alto quando ferido.'},
 {id:'javali',nome:'Javali',sub:'javaporco',sci:'Sus scrofa',grupo:'Selvagem',fase:'Fase 2',inf:'vira',
  onde:'Mata Funda, milharais de Campo Largo e pomares abandonados.',
  papel:'Caça de risco, em bandos de 4 a 10. Praga real do interior.',
  cuidado:'Investida a 8 m/s e presas que causam sangramento. Infectado derruba barricada de madeira.',
  rende:'40 kg de carne e couro grosso.',som:'Grunhido grave; bando fuçando faz barulho a 40 m.'},
 {id:'capivara',nome:'Capivara',sub:'beira de rio',sci:'Hydrochoerus hydrochaeris',grupo:'Selvagem',fase:'MVP',inf:'morre',
  onde:'Margens do Rio Turvo e do Rio Claro, Lagoa Escura, Brejo do Sapo e açudes.',
  papel:'Caça fácil e mansa. Capivara calma na margem quer dizer que não há zumbi perto.',
  cuidado:'Foge mergulhando. Zumbis afogados na Lagoa Escura pegam capivara e jogador.',
  rende:'25 kg de carne e couro.',som:'Assobio de alerta quando o bando foge.'},
 {id:'onca',nome:'Onça',sub:'pintada da Lapa',sci:'Panthera onca',grupo:'Selvagem',fase:'Fase 3',inf:'vira',
  onde:'Lapa da Onça e Mata Funda. Depois de 2 meses sai da Mata Funda para os sítios.',
  papel:'Predador de emboscada. Só ataca quem anda sozinho à noite e foge de grupo de 3.',
  cuidado:'Salto de 6 m, mata em dois golpes. A Onça da Lapa infectada é um encontro raro e silencioso.',
  rende:'Nada. Matar a onça é sobrevivência, não caça.',som:'Esturro grave; sem som quando infectada.'},
 {id:'urubu',nome:'Urubu',sub:'cabeça-preta',sci:'Coragyps atratus',grupo:'Ambiente',fase:'MVP',inf:'imune',
  onde:'Sobre o engavetamento da BR-101, o trem descarrilado, o centro de Santa Aurora e a área queimada.',
  papel:'Leitura de mapa: urubus circulando a até 1,5 km marcam mortos, horda comendo ou base caída.',
  cuidado:'Pousados, levantam voo quando alguém chega e denunciam a sua posição.',
  rende:'Nada.',som:'Bater de asas na revoada.'},
 {id:'queroquero',nome:'Quero-quero',sub:'sentinela do campo',sci:'Vanellus chilensis',grupo:'Ambiente',fase:'MVP',inf:'imune',
  onde:'Campo aberto: aeroclube, campos de futebol, beira da BR e pastos.',
  papel:'Grita com qualquer coisa a 25 m. Perto da base, avisa de zumbi chegando.',
  cuidado:'O grito acorda zumbis num raio de 40 m. Mergulha em quem chega perto do ninho.',
  rende:'Nada.',som:'O grito que dá nome ao bicho, alcance 40 m.'},
 {id:'jararaca',nome:'Jararaca',sub:'cobra da mata',sci:'Bothrops jararaca',grupo:'Selvagem',fase:'Fase 3',inf:'imune',
  onde:'Brejo do Sapo, Mata Funda, pilhas de lenha, paióis e celeiros.',
  papel:'Ameaça silenciosa que faz o jogador olhar para o chão no mato.',
  cuidado:'Picada é veneno: perde vida e a visão turva por 20 min. Soro no posto de saúde.',
  rende:'Nada.',som:'Nenhum. Só o farfalhar no mato a 3 m.'},
 {id:'rato',nome:'Rato',sub:'ratazana de esgoto',sci:'Rattus norvegicus',grupo:'Ambiente',fase:'Fase 2',inf:'vira',
  onde:'Galerias pluviais de Santa Aurora, cais de Porto Turvo e silos da cooperativa.',
  papel:'Come 2% do estoque da base por dia sem gato ou lata fechada.',
  cuidado:'Enxame infectado de 40 a 80 ratos. Cada mordida tem 5% de chance de infectar. Fogo espanta.',
  rende:'Nada.',som:'Chiado em massa nas galerias.'}
];
const ZONES={
 cao:[[400,390,70,'Santa Aurora'],[35,590,10,'Fazenda Santa Clara'],[165,145,12,'canil da Mansão Valverde'],[320,92,24,'Vila do Corvo'],[668,428,34,'Três Pontes'],[480,722,32,'Porto Turvo'],[130,560,34,'Campo Largo']],
 gato:[[400,390,48,'Santa Aurora'],[668,428,22,'Três Pontes'],[480,722,22,'Porto Turvo']],
 galinha:[[215,560,34,'sítios da BR-101 oeste'],[35,590,10,'Fazenda Santa Clara'],[95,615,30,'Campo Largo sul'],[585,560,26,'sítios do Parque'],[705,330,24,'fazendas de Três Pontes']],
 vaca:[[200,610,62,'pastos de Campo Largo'],[35,590,10,'Fazenda Santa Clara (carcaças)'],[90,420,46,'campos do oeste'],[575,560,40,'pastos do Rio Claro']],
 cavalo:[[105,600,26,'haras do aeroclube']],
 porco:[[235,535,26,'sítios da BR-101 oeste'],[35,590,10,'Fazenda Santa Clara (infectados)'],[620,525,22,'sítios do Rio Claro']],
 javali:[[718,640,72,'Mata Funda'],[170,700,40,'milharais de Campo Largo']],
 capivara:[[300,640,40,'Lagoa Escura'],[262,668,28,'Brejo do Sapo'],[345,470,22,'Rio Turvo'],[545,605,26,'Rio Claro'],[150,660,16,'Açude da Cooperativa']],
 onca:[[745,720,30,'Lapa da Onça'],[710,640,46,'Mata Funda']],
 urubu:[[560,385,26,'Engavetamento da BR-101'],[35,590,12,'Fazenda Santa Clara'],[520,451,18,'Trem descarrilado'],[400,390,30,'centro de Santa Aurora'],[718,612,28,'Área queimada']],
 queroquero:[[95,535,34,'aeroclube'],[455,560,32,'campos do Parque'],[230,470,26,'beira da BR-101']],
 jararaca:[[262,668,32,'Brejo do Sapo'],[735,665,48,'Mata Funda'],[130,95,20,'Gruta do Corvo']],
 rato:[[400,395,34,'galerias pluviais'],[480,735,20,'cais de Porto Turvo'],[150,605,16,'silos da cooperativa']]
};
const GCOL={'Doméstico':'#e0a548','Fazenda':'#c98a5a','Selvagem':'#9fc25a','Ambiente':'#8fb3c9'};

// ---------- 3D ----------
const cv=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,.02,400);
const hemi=new THREE.HemisphereLight(0x8aa0c0,0x1a140e,.45);scene.add(hemi);
const moon=new THREE.DirectionalLight(0x9fb4d8,.7);moon.position.set(-8,14,10);moon.castShadow=true;
moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-18,right:18,top:10,bottom:-10,near:1,far:60});moon.shadow.bias=-.0006;scene.add(moon);scene.add(moon.target);
const lampL=new THREE.PointLight(0xffb060,1.6,22,1.6);lampL.position.set(2,5.2,-3.2);lampL.castShadow=true;lampL.shadow.mapSize.set(1024,1024);scene.add(lampL);

const ccache={};
function mat(c,o){const k=c+JSON.stringify(o||{});if(ccache[k])return ccache[k];return ccache[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.92,metalness:0,flatShading:true},o||{}));}
function add(p,geo,m,x,y,z,rx,ry,rz){const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(7);
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}

// cenário: terreiro de fazenda à noite
const groundTex=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#4a3f30';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=R();g.fillStyle=v<.5?'rgba(60,72,40,.5)':v<.8?'rgba(38,30,22,.45)':'rgba(110,96,74,.35)';g.beginPath();g.arc(R()*w,R()*h,2+R()*14,0,7);g.fill();}});
groundTex.wrapS=groundTex.wrapT=THREE.RepeatWrapping;groundTex.repeat.set(10,6);
const ground=add(scene,new THREE.PlaneGeometry(80,46).rotateX(-PI/2),new THREE.MeshStandardMaterial({map:groundTex,roughness:1}),0,0,0);ground.castShadow=false;
// tufos de capim
{const geo=new THREE.ConeGeometry(.07,.32,4);const tuft=new THREE.InstancedMesh(geo,mat(0x3d4a26),600);const m4=new THREE.Matrix4();const q=new THREE.Quaternion();
 for(let i=0;i<600;i++){let x=(R()-.5)*60,z=-14+R()*26;if(Math.abs(z)<2.2&&Math.abs(x)<16)z+=z<0?-2.4:2.4;q.setFromEuler(new THREE.Euler((R()-.5)*.5,R()*6,(R()-.5)*.5));const s=.6+R()*1.2;m4.compose(new THREE.Vector3(x,.12*s,z),q,new THREE.Vector3(s,s,s));tuft.setMatrixAt(i,m4);}
 tuft.receiveShadow=true;scene.add(tuft);}
// cerca de curral
{const wood=mat(0x5a4632),dark=mat(0x3a2e22);for(let x=-20;x<=20;x+=2.5){add(scene,new THREE.CylinderGeometry(.07,.08,1.5,6),dark,x,.75,-3.4,0,0,(R()-.5)*.08);}
 for(const y of[.45,.85,1.25])for(let x=-20;x<20;x+=2.5){if(R()<.12)continue;add(scene,new THREE.BoxGeometry(2.55,.12,.05),wood,x+1.25,y+(R()-.5)*.06,-3.36,0,0,(R()-.5)*.05);}
 // poste de luz
 add(scene,new THREE.CylinderGeometry(.06,.09,5.4,8),mat(0x2b2d30),2,2.7,-3.9);add(scene,new THREE.BoxGeometry(.9,.06,.06),mat(0x2b2d30),2,5.35,-3.6);
 const bulb=add(scene,new THREE.SphereGeometry(.12,10,8),new THREE.MeshBasicMaterial({color:0xffc070}),2,5.25,-3.25);bulb.castShadow=false;
 // galpão ao fundo
 const barn=new THREE.Group();barn.position.set(-9,0,-9);scene.add(barn);add(barn,new THREE.BoxGeometry(7,3.2,5),mat(0x5c2f22),0,1.6,0);
 const roof=add(barn,new THREE.CylinderGeometry(.01,4.1,1.6,4,1),mat(0x3b3f42,{metalness:.4}),0,4,0,0,PI/4,0);roof.scale.set(1,1,.75);
 add(barn,new THREE.BoxGeometry(1.8,2.4,.1),mat(0x2a1a12),1.2,1.2,2.52);
 // caixa d'água e árvore seca
 add(scene,new THREE.CylinderGeometry(1,1,1.4,10),mat(0x4a5560,{metalness:.3}),10,4.2,-10);for(const a of[-1,1])for(const b of[-1,1])add(scene,new THREE.CylinderGeometry(.06,.06,3.5,5),mat(0x2b2d30),10+a*.7,1.75,-10+b*.7);
 const tr=add(scene,new THREE.CylinderGeometry(.12,.25,4.5,6),mat(0x2a221a),-15,2.25,-6);for(let i=0;i<5;i++){add(scene,new THREE.CylinderGeometry(.03,.07,1.8,5),mat(0x2a221a),-15+(R()-.5)*1.4,3.4+i*.35,-6+(R()-.5)*.6,(R()-.5)*1.4,0,(R()-.5)*1.6);}
}
// régua de 1,80 m
const ruler=new THREE.Group();scene.add(ruler);
{add(ruler,new THREE.BoxGeometry(.04,1.8,.04),mat(0x8f978f),0,.9,0);for(let i=0;i<=6;i++){add(ruler,new THREE.BoxGeometry(i%2?.1:.18,.015,.05),mat(i===6?0xe0a548:0x8f978f),0,i*.3,0);}}

// ---------- montagem dos corpos ----------
function profileGeo(len,prof,seg){ // perfil de raio ao longo do comprimento (traseira -> frente)
 const pts=prof.map((r,i)=>new THREE.Vector2(i/(prof.length-1),r));const sp=new THREE.SplineCurve(pts);const out=[];
 out.push(new THREE.Vector2(.001,-len/2-0.0));
 for(let i=0;i<=30;i++){const p=sp.getPoint(i/30);out.push(new THREE.Vector2(Math.max(.001,p.y),-len/2+p.x*len));}
 out.push(new THREE.Vector2(.001,len/2));
 return new THREE.LatheGeometry(out,seg||22).rotateX(PI/2);
}
function Animal(sp){
 const A={sp,root:new THREE.Group(),trunk:new THREE.Group(),mats:[],joints:[],piv:[],legs:[],tail:[],ears:[],inf:[],eyes:[],ph:R()*6,size:1};
 A.root.add(A.trunk);
 A.M=function(c,o){const m=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:0,flatShading:false},o||{}));m.userData.base=m.color.clone();A.mats.push(m);return m;};
 A.ball=function(p,r,m,x,y,z,sx,sy,sz){const o=add(p,new THREE.SphereGeometry(r,16,12),m,x,y,z);if(sx)o.scale.set(sx,sy,sz);return o;};
 A.limb=function(p,r1,r2,len,m){return add(p,new THREE.CylinderGeometry(r2,r1,len,14,1).translate(0,-len/2,0),m);}; // r1 em cima
 A.joint=function(p,r,m,x,y,z){const j=A.ball(p,r,m,x,y,z);j.userData.joint=1;A.joints.push(j);return j;};
 A.pivot=function(parent,x,y,z,off){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);A.piv.push({g,p0:g.position.clone(),off:off||new THREE.Vector3()});return g;};
 return A;
}
function eyes(A,head,r,x,y,z){const em=A.M(0x111111,{roughness:.25});A.eyeM=em;for(const s of[-1,1]){const e=A.ball(head,r,em,s*x,y,z);A.eyes.push(e);}}
function infDecor(A,list){A.inf.push(...list);list.forEach(o=>o.visible=false);}
function wound(A,p,r,x,y,z,sx,sy,sz){const m=A.woundM||(A.woundM=new THREE.MeshStandardMaterial({color:0x5a120e,roughness:.45}));const w=A.ball(p,r,m,x,y,z,sx||1,sy||1,sz||1);return w;}

// quadrúpede
function quad(sp){
 const A=Animal(sp),q=sp.q,c=q.c;
 const main=A.M(q.tex?0xffffff:c.main,q.tex?{map:q.tex}:null),belly=A.M(c.belly),dark=A.M(c.dark),nose=A.M(c.nose||c.dark,{roughness:.4});
 A.main=main;A.dark=dark;
 const L=q.L,Rb=q.R,span=L*q.span;
 const lg=q.leg,fa1=lg.fa1??.06,fa2=lg.fa2??-.08,ha1=lg.ha1??-.32,ha2=lg.ha2??.58;
 const footH=lg.hoof?lg.r*1.1:lg.r*.7;
 const hF=lg.fu*Math.cos(fa1)+lg.fl*Math.cos(fa1+fa2)+footH, hH=lg.hu*Math.cos(ha1)+lg.hl*Math.cos(ha1+ha2)+footH;
 const bodyY=(hF+hH)/2+(q.up||0)*Rb;
 A.size=Math.max(L,bodyY+Rb);
 // tronco
 const bodyG=A.pivot(A.trunk,0,bodyY,0);A.bodyG=bodyG;
 const body=add(bodyG,profileGeo(L,q.prof.map(v=>v*Rb)),main);body.scale.set(q.sx||1,q.sy||1,1);body.rotation.x=Math.atan2(hH-hF,span)*.6;A.body=body;
 const bel=add(bodyG,profileGeo(L*.8,q.prof.map(v=>v*.8*Rb)),belly);bel.scale.set((q.sx||1)*.92,(q.sy||1)*.85,1);bel.position.y=-Rb*.2;
 // patas
 const legDefs=[[1,1,'F'],[-1,1,'F'],[1,-1,'H'],[-1,-1,'H']];
 legDefs.forEach(([sx,sz,k],i)=>{
  const front=k==='F',u=front?lg.fu:lg.hu,l=front?lg.fl:lg.hl,h=front?hF:hH;
  const hip=A.pivot(A.trunk,sx*Rb*(q.sx||1)*.55,h,sz*span/2,new THREE.Vector3(sx*.18,-.06,sz*.12).multiplyScalar(A.size));
  // massa muscular do ombro / coxa
  const mus=A.ball(hip,lg.r*(front?1.9:2.3),main,0,-u*.18,front?0:-lg.r*.3,.75,1.25,1);
  A.joint(hip,lg.r*1.15,main,0,0,0);
  A.limb(hip,lg.r*1.25,lg.r*.95,u,main);
  const knee=A.pivot(hip,0,-u,0,new THREE.Vector3(0,-.07*A.size,0));A.joint(knee,lg.r*.95,main,0,0,0);
  A.limb(knee,lg.r*.92,lg.r*.68,l,front?main:main);
  const foot=A.pivot(knee,0,-l,0,new THREE.Vector3(0,-.05*A.size,0));
  if(lg.hoof){A.joint(foot,lg.r*.72,dark,0,0,0);add(foot,new THREE.CylinderGeometry(lg.r*.8,lg.r*1.05,footH,12).translate(0,-footH/2,0),dark);}
  else{A.joint(foot,lg.r*.66,main,0,0,0);A.ball(foot,lg.r*.95,lg.dark?dark:main,0,-footH*.55,lg.r*.5,1,.62,1.45);}
  A.legs.push({hip,knee,foot,front,a1:front?fa1:ha1,a2:front?fa2:ha2,sx});
 });
 // pescoço e cabeça
 const nk=q.neck,hd=q.head;
 const neck=A.pivot(bodyG,0,Rb*(q.sy||1)*(nk.y??.35),L/2*(nk.z??.78),new THREE.Vector3(0,.05,.12).multiplyScalar(A.size));neck.rotation.x=nk.ang;A.neck=neck;A.neckA=nk.ang;
 A.joint(neck,nk.r*1.05,main,0,0,0);
 add(neck,new THREE.CylinderGeometry(nk.r2||nk.r*.85,nk.r,nk.len,14).translate(0,nk.len/2,0),main);
 const head=A.pivot(neck,0,nk.len,0,new THREE.Vector3(0,.06,.08).multiplyScalar(A.size));head.rotation.x=-nk.ang+(hd.down||0);A.head=head;A.headA=head.rotation.x;
 A.joint(head,nk.r2||nk.r*.85,main,0,0,0);
 const cr=A.ball(head,hd.r,main,0,hd.r*.25,hd.r*.25,hd.s[0],hd.s[1],hd.s[2]);
 const snz=hd.r*.25+hd.r*hd.s[2]*.55;
 const snout=add(head,new THREE.CylinderGeometry(hd.sr2,hd.sr1,hd.sl,14).rotateX(PI/2),hd.muzzle?A.M(hd.muzzle):main,0,hd.r*(hd.sy??0),snz+hd.sl/2);snout.scale.set(1,hd.sq||1,1);
 const nb=A.ball(head,hd.sr2*1.02,nose,0,hd.r*(hd.sy??0)+hd.sr2*.1,snz+hd.sl,1,.85*(hd.sq||1),.45);
 // mandíbula
 const jaw=A.pivot(head,0,hd.r*(hd.sy??0)-hd.sr1*.55*(hd.sq||1),snz-hd.sr1*.2,new THREE.Vector3(0,-.04,.04).multiplyScalar(A.size));A.jaw=jaw;
 add(jaw,new THREE.CylinderGeometry(hd.sr2*.7,hd.sr1*.75,hd.sl*.92,12).rotateX(PI/2).translate(0,0,hd.sl*.46),belly).scale.set(1,.45,1);
 const blood=A.ball(jaw,hd.sr2*.9,A.woundM||(A.woundM=new THREE.MeshStandardMaterial({color:0x6a100c,roughness:.3})),0,.0,hd.sl*.9,1.1,.6,.6);
 eyes(A,head,hd.r*.13,hd.r*hd.s[0]*.52,hd.r*.5,hd.r*.25+hd.r*hd.s[2]*.55);
 // orelhas
 const et=q.ears;
 for(const s of[-1,1]){const eg=A.pivot(head,s*hd.r*hd.s[0]*.55,hd.r*(.25+hd.s[1]*.75),hd.r*.1,new THREE.Vector3(s*.04,.04,0).multiplyScalar(A.size));A.ears.push(eg);
  if(et.t==='cone'){add(eg,new THREE.ConeGeometry(et.s*.45,et.s,8).translate(0,et.s/2,0),main,0,0,0,et.fwd||0,0,s*-(et.tilt??.3));}
  else if(et.t==='round'){const e=A.ball(eg,et.s,main,0,et.s*.4,0,1,1,.35);}
  else if(et.t==='flop'){const e=A.ball(eg,et.s,main,s*et.s*.9,-et.s*.1,0,1.5,.45,.7);e.rotation.z=s*-.25;}
 }
 // cauda
 const tl=q.tail;
 if(tl&&tl.n){let par=A.pivot(bodyG,0,Rb*(q.sy||1)*(tl.y??.3),-L/2*.95,new THREE.Vector3(0,.02,-.12).multiplyScalar(A.size));par.rotation.x=tl.ang;A.tailRoot=par;
  const segL=tl.len/tl.n;for(let i=0;i<tl.n;i++){const r1=tl.r*(1-i/tl.n*.6),r2=tl.r*(1-(i+1)/tl.n*.6);A.limb(par,r1,r2,segL,tl.dark&&i===tl.n-1?dark:main);A.joint(par,r1,main,0,0,0);A.tail.push(par);if(i<tl.n-1){const nx=A.pivot(par,0,-segL,0);nx.rotation.x=tl.curl||0;par=nx;}else if(tl.tuft){A.ball(par,tl.r*2.2,dark,0,-segL-tl.r,0,1,1.8,1);}}
  if(tl.bushy){A.ball(A.tail[0],tl.r*2.2,dark,0,-tl.len*.55,0,1,tl.len*2.2/tl.r/6,1);}
 }
 if(q.extra)q.extra(A,{bodyG,head,neck,main,belly,dark,L,Rb,bodyY,hd,nk});
 // decoração de infecção: falhas no pelo, costelas à mostra, sangue
 if(sp.inf==='vira'){
  const sxb=Rb*(q.sx||1),syb=Rb*(q.sy||1),list=[blood];
  list.push(wound(A,bodyG,Rb*.28,sxb*.92,syb*.15,L*.05,.35,1,1.3));
  list.push(wound(A,bodyG,Rb*.2,-sxb*.9,syb*.3,-L*.2,.35,1,1.1));
  list.push(wound(A,neck,nk.r*.5,nk.r*.85,nk.len*.5,0,.4,1,1));
  const bone=A.M(0xd9cfb8,{roughness:.6});
  for(let i=0;i<4;i++){const rb=add(bodyG,new THREE.TorusGeometry(Rb*.95,Rb*.035,6,16,PI*.42),bone,sxb*.12,syb*.05,L*.12-i*L*.07,0,PI/2,-.3);rb.scale.set(1,1.02*(q.sy||1),(q.sx||1));list.push(rb);}
  infDecor(A,list);
 } else {blood.visible=false;}
 return A;
}
// ave
function bird(sp){
 const A=Animal(sp),b=sp.b,c=b.c;
 const main=A.M(c.main),dark=A.M(c.dark),leg=A.M(c.leg),beakM=A.M(c.beak,{roughness:.5}),belly=A.M(c.belly||c.main);
 A.main=main;
 const hipY=b.tars+b.shank*.9;A.size=Math.max(b.r*3,hipY+b.r*2);
 const bodyG=A.pivot(A.trunk,0,hipY+b.r*.55,0);A.bodyG=bodyG;bodyG.rotation.x=b.pitch||0;
 A.ball(bodyG,b.r,main,0,0,0,b.s[0],b.s[1],b.s[2]);
 A.ball(bodyG,b.r*.9,belly,0,-b.r*.22,b.r*.15,b.s[0]*.9,b.s[1]*.8,b.s[2]*.85);
 // cauda
 const tail=A.pivot(bodyG,0,b.r*.15,-b.r*b.s[2]*.85,new THREE.Vector3(0,0,-.08).multiplyScalar(A.size));tail.rotation.x=b.tailA||-.3;A.tailRoot=tail;
 add(tail,new THREE.BoxGeometry(b.tailW,b.r*.08,b.tailL).translate(0,0,-b.tailL/2),b.tailM?A.M(b.tailM):dark);
 // asas
 A.wings=[];
 for(const s of[-1,1]){const sh=A.pivot(bodyG,s*b.r*b.s[0]*1.02,b.r*.22,b.r*.3,new THREE.Vector3(s*.12,.03,0).multiplyScalar(A.size));
  A.joint(sh,b.r*.14,main,0,0,0);
  A.ball(sh,.5,b.wingM?A.M(b.wingM):dark,s*b.wi*.5,0,-b.wc*.3,b.wi*1.05,b.r*.16,b.wc);
  const el=A.pivot(sh,s*b.wi,0,0,new THREE.Vector3(s*.06,0,0).multiplyScalar(A.size));A.joint(el,b.r*.1,main,0,0,0);
  const ow=A.ball(el,.5,dark,s*b.wo*.45,0,-b.wc*.32,b.wo*1.05,b.r*.12,b.wc*.75);
  if(b.fingers){for(let k=0;k<4;k++)add(el,new THREE.BoxGeometry(b.wo*.35,b.r*.03,b.wc*.12),dark,s*(b.wo+b.wo*.12),0,-b.wc*.05-k*b.wc*.18,0,s*(.05+k*.12),0);}
  if(b.spur)add(el,new THREE.ConeGeometry(b.r*.06,b.r*.25,5),A.M(0xc0302a),0,0,b.wc*.2,PI/2,0,0);
  A.wings.push({sh,el,s});}
 // pescoço e cabeça
 const neck=A.pivot(bodyG,0,b.r*.45,b.r*b.s[2]*.75,new THREE.Vector3(0,.05,.08).multiplyScalar(A.size));neck.rotation.x=b.neckA;A.neck=neck;A.neckA=b.neckA;
 A.joint(neck,b.nr*1.1,b.neckM?A.M(b.neckM):main,0,0,0);
 add(neck,new THREE.CylinderGeometry(b.nr*.85,b.nr,b.nl,12).translate(0,b.nl/2,0),b.neckM?A.M(b.neckM):main);
 const head=A.pivot(neck,0,b.nl,0,new THREE.Vector3(0,.05,.05).multiplyScalar(A.size));head.rotation.x=-b.neckA+(b.headA||0);A.head=head;A.headA=head.rotation.x;
 const hm=b.headM?A.M(b.headM):main;
 A.ball(head,b.hr,hm,0,0,0,b.hs?b.hs[0]:1,b.hs?b.hs[1]:1,b.hs?b.hs[2]:1.1);
 add(head,new THREE.ConeGeometry(b.br,b.bl,8).rotateX(PI/2).translate(0,0,b.bl/2),beakM,0,-b.hr*.1,b.hr*.85,b.hook||0,0,0);
 const jaw=A.pivot(head,0,-b.hr*.25,b.hr*.8);A.jaw=jaw;add(jaw,new THREE.ConeGeometry(b.br*.7,b.bl*.85,8).rotateX(PI/2).translate(0,0,b.bl*.42),beakM).scale.set(1,.5,1);
 eyes(A,head,b.hr*.17,b.hr*.68,b.hr*.2,b.hr*.35);
 if(b.eyeC){A.eyeM.color.set(b.eyeC);A.eyeM.userData.base=A.eyeM.color.clone();}
 if(b.extra)b.extra(A,{bodyG,head,neck,main,dark});
 // pernas
 for(const s of[-1,1]){const hip=A.pivot(bodyG,s*b.r*.38,-b.r*.55,b.r*.05,new THREE.Vector3(s*.06,-.05,0).multiplyScalar(A.size));A.joint(hip,b.r*.18,main,0,0,0);
  A.limb(hip,b.r*.16,b.r*.09,b.shank,b.featherLeg?main:leg);
  const ank=A.pivot(hip,0,-b.shank,0,new THREE.Vector3(0,-.04,0).multiplyScalar(A.size));A.joint(ank,b.r*.06,leg,0,0,0);
  A.limb(ank,b.r*.055,b.r*.05,b.tars,leg);
  const ft=A.pivot(ank,0,-b.tars,0);
  for(const a of[-.45,0,.45])add(ft,new THREE.BoxGeometry(b.r*.05,b.r*.04,b.r*.55).translate(0,0,b.r*.25),leg,0,-b.r*.02,0,0,a,0);
  add(ft,new THREE.BoxGeometry(b.r*.05,b.r*.04,b.r*.25).translate(0,0,-b.r*.12),leg,0,-b.r*.02,0);
  A.legs.push({hip,knee:ank,foot:ft,a1:.35,a2:-.5,sx:s});}
 return A;
}
// cobra
function snake(sp){
 const A=Animal(sp),n=34,seg=.042;A.size=.5;A.seg=seg;A.n=n;
 const c1=A.M(0x7a6a4a),c2=A.M(0x3a2e22),bel=A.M(0xb8a888);A.main=c1;
 A.segs=[];
 for(let i=0;i<n;i++){const t=i/(n-1);const r=.012+.03*Math.sin(Math.min(1,t*1.15)*PI)*(t<.1?.75+t*2.5:1)+(t<.05?.012:0);
  const m=(i%4===1||i%4===2)?c2:c1;const g=new THREE.Group();A.trunk.add(g);
  const s=A.ball(g,r,m,0,r,0,1,.78,1.5);s.userData.joint=i%3===0?1:0;if(i%3===0)A.joints.push(s);A.segs.push({g,r});}
 const head=new THREE.Group();A.trunk.add(head);A.head=head;
 A.ball(head,.032,c1,0,.03,.025,1.25,.6,1.45);A.ball(head,.024,c2,0,.04,.0,1.3,.4,.9);
 A.ball(head,.02,c1,0,.028,.06,.85,.55,1.1);
 const jaw=new THREE.Group();jaw.position.set(0,.018,.0);head.add(jaw);A.jaw=jaw;A.ball(jaw,.026,bel,0,0,.035,1.1,.35,1.5);
 eyes(A,head,.006,.03,.04,.045);
 const tongue=add(head,new THREE.BoxGeometry(.004,.002,.05),A.M(0xb02020),0,.024,.1);A.tongue=tongue;
 return A;
}

// ---------- espécies ----------
function spotsTex(base,spot){return canvasTex(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);const r=rng(11);for(let i=0;i<70;i++){const x=r()*w,y=r()*h,s=5+r()*7;g.strokeStyle=spot;g.lineWidth=3;g.beginPath();g.arc(x,y,s,0,7);g.stroke();g.fillStyle='rgba(120,70,20,.45)';g.beginPath();g.arc(x,y,s*.6,0,7);g.fill();}for(let i=0;i<60;i++){g.fillStyle=spot;g.beginPath();g.arc(r()*w,r()*h,1.5+r()*2.5,0,7);g.fill();}});}
function stripeTex(base,str){return canvasTex(128,128,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);g.fillStyle=str;for(let i=0;i<9;i++){g.fillRect(0,i*14+(i%2)*3,w,4);}});}
const SPEC={
 cao:{q:{L:.62,R:.12,sx:.95,sy:1.05,span:.72,prof:[.45,.85,.95,.9,.88,1,1.05,.9,.55],c:{main:0xb07a3e,belly:0xd8b07a,dark:0x2a1c12,nose:0x161010},
   leg:{fu:.21,fl:.22,hu:.22,hl:.24,r:.04},neck:{len:.12,r:.07,r2:.06,ang:.95},head:{r:.085,s:[1,.95,1.08],sl:.11,sr1:.05,sr2:.04,down:.15,sy:-.15},
   ears:{t:'cone',s:.06,tilt:.35,fwd:.3},tail:{n:3,len:.26,r:.02,ang:2.1,curl:-.25}},walkHz:1.6,runHz:2.9,gallop:true},
 gato:{q:{L:.36,R:.065,sy:1.05,span:.72,tex:stripeTex('#77706a','#3e3a36'),prof:[.6,.9,.95,.9,.85,.92,.95,.8,.5],c:{main:0x77706a,belly:0xc8c0b2,dark:0x2a2622,nose:0xb0706a},
   leg:{fu:.11,fl:.12,hu:.12,hl:.13,r:.018},neck:{len:.06,r:.035,ang:.9},head:{r:.055,s:[1.08,.95,1],sl:.03,sr1:.03,sr2:.025,down:.1,sy:-.25},
   ears:{t:'cone',s:.045,tilt:.2},tail:{n:5,len:.28,r:.012,ang:2.5,curl:-.18}},walkHz:1.9,runHz:3.4,gallop:true},
 vaca:{q:{L:1.65,R:.37,sx:.95,sy:1.12,span:.7,up:.15,prof:[.55,.85,.97,1,.98,.95,.97,.9,.55],c:{main:0xd4d0c6,belly:0xe2dfd6,dark:0x2b2826,nose:0x3a3432},
   leg:{fu:.42,fl:.44,hu:.44,hl:.47,r:.075,hoof:1},neck:{len:.36,r:.19,r2:.14,ang:1.15,y:.2,z:.74},head:{r:.15,s:[.95,1,1.05],sl:.3,sr1:.13,sr2:.11,down:.55,sy:-.3,muzzle:0x9a948c},
   ears:{t:'flop',s:.09},tail:{n:3,len:.75,r:.03,ang:.22,y:.55,tuft:1},
   extra:(A,k)=>{A.ball(k.bodyG,.2,k.main,0,k.Rb*1.1,k.L*.33,.95,1.1,1.1);/* cupim */const bar=A.ball(k.neck,.13,k.main,0,.12,.08,.55,1.4,1.05);/* barbela */for(const s of[-1,1])add(k.head,new THREE.ConeGeometry(.025,.13,8),A.M(0xcfc6a8),s*.12,k.hd.r*1.05,k.hd.r*.05,0,0,s*-.9);}},walkHz:1,runHz:2,gallop:true},
 cavalo:{q:{L:1.45,R:.3,sx:.92,sy:1.15,span:.68,up:.05,prof:[.55,.88,.97,.95,.9,.93,1,.92,.55],c:{main:0x7a4a28,belly:0x6a3e22,dark:0x1a120e,nose:0x2a1c16},
   leg:{fu:.5,fl:.52,hu:.52,hl:.56,r:.065,hoof:1},neck:{len:.6,r:.19,r2:.11,ang:.6,y:.3,z:.72},head:{r:.12,s:[.85,1,1.1],sl:.42,sr1:.1,sr2:.085,down:1.25,sy:-.1},
   ears:{t:'cone',s:.1,tilt:.15},tail:{n:3,len:.25,r:.05,ang:.5,y:.45,bushy:0},
   extra:(A,k)=>{for(let i=0;i<9;i++){add(k.neck,new THREE.BoxGeometry(.035,.16,.08),k.dark,0,.06+i*.065,-.12+i*.004,-.25,0,0);} add(k.head,new THREE.BoxGeometry(.03,.12,.06),k.dark,0,k.hd.r*1.05,k.hd.r*.3,.6,0,0);
     const t=A.tail[A.tail.length-1];const tf=A.ball(t,.08,k.dark,0,-.42,0,.7,4.5,.7);}},walkHz:1,runHz:2.1,gallop:true},
 porco:{q:{L:1,R:.28,sx:1.05,sy:1.02,span:.66,prof:[.65,.95,1,1,1,1,.98,.9,.6],c:{main:0xdba596,belly:0xe5b5a6,dark:0x5a3a34,nose:0xc8847a},
   leg:{fu:.19,fl:.19,hu:.2,hl:.21,r:.05,hoof:1},neck:{len:.08,r:.2,r2:.18,ang:1.35,y:.15,z:.8},head:{r:.16,s:[1,.95,1],sl:.15,sr1:.1,sr2:.085,down:.2,sy:-.25},
   ears:{t:'cone',s:.1,tilt:.5,fwd:.9},tail:{n:4,len:.14,r:.012,ang:1.2,curl:1.4}},walkHz:1.4,runHz:2.6},
 javali:{q:{L:1.05,R:.27,sx:.88,sy:1.15,span:.66,prof:[.55,.8,.85,.9,.95,1.05,1.1,1,.6],c:{main:0x3e322a,belly:0x4a3c32,dark:0x1a1410,nose:0x2a1e18},
   leg:{fu:.24,fl:.25,hu:.24,hl:.26,r:.045,hoof:1},neck:{len:.1,r:.21,r2:.19,ang:1.4,y:.1,z:.8},head:{r:.16,s:[.9,1,1.1],sl:.24,sr1:.1,sr2:.07,down:.35,sy:-.25},
   ears:{t:'cone',s:.08,tilt:.4},tail:{n:3,len:.2,r:.012,ang:.6,tuft:1},
   extra:(A,k)=>{for(let i=0;i<12;i++)add(k.bodyG,new THREE.BoxGeometry(.03,.1,.06),k.dark,0,k.Rb*1.12-i*.004,k.L*.38-i*.06,-.2,0,0);for(const s of[-1,1])add(k.head,new THREE.ConeGeometry(.012,.09,6),A.M(0xe8e0cc),s*.07,k.hd.r*(-.25)+.03,k.hd.r*.25+k.hd.r*k.hd.s[2]*.55+.13,-.6,0,s*.5);}},walkHz:1.5,runHz:3,gallop:true},
 capivara:{q:{L:.95,R:.26,sx:.95,sy:1.05,span:.62,up:.1,prof:[.75,.98,1.02,1,.98,.96,.92,.85,.6],c:{main:0x7a5a3a,belly:0x8c6a48,dark:0x2a1e16,nose:0x2a1e16},
   leg:{fu:.16,fl:.17,hu:.17,hl:.17,r:.045,dark:1},neck:{len:.07,r:.17,r2:.16,ang:1.3,y:.25,z:.8},head:{r:.14,s:[.9,1.1,1.25],sl:.14,sr1:.12,sr2:.11,down:.15,sy:-.05,sq:1.3},
   ears:{t:'round',s:.035},tail:null},walkHz:1.2,runHz:2.6,gallop:true},
 onca:{q:{L:1.1,R:.19,sx:.95,sy:1.1,span:.7,tex:spotsTex('#c99a48','#24170c'),prof:[.6,.88,.92,.88,.85,.95,1.02,.9,.55],c:{main:0xc99a48,belly:0xeadfc8,dark:0x24170c,nose:0x5a3a30},
   leg:{fu:.27,fl:.27,hu:.28,hl:.3,r:.05},neck:{len:.18,r:.1,r2:.095,ang:.95},head:{r:.12,s:[1.1,.95,1],sl:.07,sr1:.07,sr2:.065,down:.2,sy:-.25},
   ears:{t:'round',s:.035},tail:{n:6,len:.72,r:.03,ang:.55,curl:-.12,dark:1}},walkHz:1.1,runHz:2.6,gallop:true},
 rato:{q:{L:.17,R:.036,sy:1,span:.6,prof:[.65,.95,1.05,1,.92,.82,.7,.5,.25],c:{main:0x4f4640,belly:0x8a7e72,dark:0x2a2420,nose:0xc89088},
   leg:{fu:.022,fl:.024,hu:.026,hl:.028,r:.008},neck:{len:.015,r:.022,ang:1.3,y:.2,z:.85},head:{r:.026,s:[.95,.9,1.1],sl:.03,sr1:.018,sr2:.008,down:.15,sy:-.1},
   ears:{t:'round',s:.012},tail:{n:6,len:.17,r:.005,ang:1.45,curl:-.08}},walkHz:4,runHz:7},
 galinha:{b:{r:.12,s:[.85,.9,1.15],tars:.1,shank:.09,pitch:-.12,tailA:-.95,tailW:.1,tailL:.16,wi:.1,wo:.1,wc:.16,nr:.04,nl:.08,neckA:.35,headA:.25,hr:.045,br:.015,bl:.035,
   c:{main:0xa85a32,dark:0x5a2c18,leg:0xd8b040,beak:0xd8b040,belly:0xb8683a},tailM:0x2a1a12,
   extra:(A,k)=>{const red=A.M(0xc0281e);for(let i=0;i<4;i++)A.ball(k.head,.014,red,0,.045,-.012+i*.014,.5,1,.8);A.ball(k.head,.012,red,0,-.04,.04,.5,1.3,.7);}},walkHz:2.2,runHz:4},
 urubu:{b:{r:.16,s:[.85,.8,1.35],tars:.09,shank:.1,pitch:-.25,tailA:-.25,tailW:.18,tailL:.2,wi:.28,wo:.38,wc:.26,fingers:1,nr:.04,nl:.1,neckA:.6,headA:.35,hr:.05,hs:[.9,.9,1.25],br:.018,bl:.06,hook:.25,
   c:{main:0x161616,dark:0x101010,leg:0x8a8680,beak:0x4a4a48},neckM:0x3a3a38,headM:0x2e2d2b},walkHz:1.4,runHz:1},
 queroquero:{b:{r:.075,s:[.85,.85,1.35],tars:.12,shank:.08,pitch:-.05,tailA:-.1,tailW:.06,tailL:.08,wi:.08,wo:.1,wc:.1,spur:1,nr:.025,nl:.07,neckA:.15,headA:.0,hr:.03,br:.008,bl:.03,eyeC:0xc0201a,
   c:{main:0x8a8f86,dark:0x2a2a2a,leg:0xc08a80,beak:0xc08a80,belly:0xe8e6e0},neckM:0x9a9e96,
   extra:(A,k)=>{const blk=A.M(0x161616);A.ball(k.bodyG,.05,blk,0,.03,.08,1.1,.9,.6);add(k.head,new THREE.BoxGeometry(.006,.006,.06).translate(0,0,-.03),blk,0,.025,-.01,.5,0,0);A.ball(k.head,.026,blk,0,-.005,.02,1.05,.7,.9);}},walkHz:2.5,runHz:1.6},
 jararaca:{snake:1,walkHz:1,runHz:1}
};
SPECIES.forEach(s=>Object.assign(s,SPEC[s.id]));

const ANIMALS=[];
let xcur=-19;
const ORDER=['vaca','cavalo','porco','javali','capivara','onca','cao','gato','galinha','queroquero','urubu','jararaca','rato'];
for(const id of ORDER){const sp=SPECIES.find(s=>s.id===id);const A=sp.snake?snake(sp):sp.b?bird(sp):quad(sp);
 const len=sp.q?sp.q.L*1.3:sp.snake?.9:sp.b.r*4;
 xcur+=len/2;A.root.position.set(xcur,0,0);A.home=A.root.position.clone();A.root.rotation.y=sp.snake?2.2:1.1;xcur+=len/2+.85;
 A.root.traverse(o=>{if(o.isMesh)o.userData.aid=id;});scene.add(A.root);ANIMALS.push(A);A.id=id;
 // contagem de triângulos e juntas
 let tri=0;A.root.traverse(o=>{if(o.isMesh){const g=o.geometry;tri+=g.index?g.index.count/3:g.attributes.position.count/3;}});A.tris=Math.round(tri);
}
const offX=-(xcur-.85-19)/2;ANIMALS.forEach(A=>{A.root.position.x+=offX;A.home.x+=offX;});
// urubus circulando no céu
const flock=[];for(let i=0;i<3;i++){const sp=SPECIES.find(s=>s.id==='urubu');const A=bird(sp);A.root.scale.setScalar(1);scene.add(A.root);A.wings.forEach(w=>{w.sh.rotation.y=0;});flock.push({A,r:5+i*1.6,h:8+i*1.4,sp:.18+i*.04,o:i*2.1});}

// ---------- estado ----------
const st={sel:'cao',clip:'walk',inf:false,joint:false,split:false,night:true};
const jointMat=new THREE.MeshStandardMaterial({color:0xe0a548,emissive:0xe0a548,emissiveIntensity:.8,roughness:.4});
ANIMALS.forEach(A=>A.joints.forEach(j=>{j.userData.m0=j.material;}));
function curA(){return ANIMALS.find(a=>a.id===st.sel);}
function setInfected(A,on){
 const sp=A.sp;A.infected=on&&sp.inf==='vira';A.dead=on&&sp.inf==='morre';
 const tint=new THREE.Color(0x7d8a66);
 A.mats.forEach(m=>{if(m===A.eyeM||m===A.woundM)return;m.color.copy(m.userData.base);if(A.infected){m.color.lerp(tint,.45).multiplyScalar(.72);}});
 if(A.eyeM){if(A.infected){A.eyeM.color.set(0xdcd8b0);A.eyeM.emissive=new THREE.Color(0x8a8660);A.eyeM.emissiveIntensity=.8;}else{A.eyeM.color.copy(A.eyeM.userData.base);A.eyeM.emissive=new THREE.Color(0);}}
 A.inf.forEach(o=>o.visible=A.infected);
 if(A.ears.length)A.ears[0].visible=!A.infected;
 if(!A.dead){A.root.rotation.z=0;A.root.position.y=0;}
 if(A.pool){A.pool.visible=A.dead;}
 else if(A.dead){A.pool=add(scene,new THREE.CircleGeometry(1,22).rotateX(-PI/2),new THREE.MeshStandardMaterial({color:0x3a0806,roughness:.25}),A.home.x,.005,A.home.z+.1);A.pool.scale.setScalar(A.size*.45);A.pool.castShadow=false;}
}
function setJoint(on){ANIMALS.forEach(A=>{A.mats.forEach(m=>{if(m===A.eyeM)return;m.transparent=on;m.opacity=on?.28:1;m.depthWrite=!on;m.needsUpdate=true;});A.joints.forEach(j=>{j.material=on?jointMat:j.userData.m0;j.renderOrder=on?2:0;});});}
function setSplit(on){ANIMALS.forEach(A=>A.piv.forEach(p=>{p.g.userData.tgt=on?p.p0.clone().add(p.off):p.p0.clone();}));}
setSplit(false);

// ---------- animação ----------
const GAIT={walk:[PI/2,3*PI/2,0,PI],trot:[0,PI,PI,0],gallop:[PI*.92,PI*1.18,0,PI*.28]};
function animQuad(A,t,dt){
 const sp=A.sp,q=sp.q;let clip=st.clip;if(A.id!==st.sel&&clip!=='idle')clip='walk';
 if(A.dead){A.root.rotation.z+= (PI/2*.97-A.root.rotation.z)*Math.min(1,dt*3);A.root.position.y+=((q.R*(q.sx||1))*.85-A.root.position.y)*Math.min(1,dt*3);
  A.legs.forEach((L,i)=>{L.hip.rotation.x=L.a1+(L.front?-.5:.4);L.knee.rotation.x=.05;L.foot.rotation.x=0;});if(A.neck)A.neck.rotation.x=A.neckA+.35;if(A.jaw)A.jaw.rotation.x=.25;return;}
 const hz=(clip==='run'?sp.runHz:clip==='walk'?sp.walkHz:0)*(A.infected?1.2:1);
 A.ph+=dt*hz*2*PI;
 const g=clip==='run'?(sp.gallop?GAIT.gallop:GAIT.trot):GAIT.walk;
 const amp=clip==='run'?.62:.34,flex=clip==='run'?1.15:.75;
 A.legs.forEach((L,i)=>{
  if(clip==='idle'){L.hip.rotation.x=L.a1;L.knee.rotation.x=L.a2;}
  else{const p=A.ph+g[i];const lim=A.infected&&i===1?.35:1;L.hip.rotation.x=L.a1-Math.sin(p)*amp*lim;L.knee.rotation.x=L.a2+Math.max(0,Math.cos(p))*flex*lim;}
  L.foot.rotation.x=-(L.hip.rotation.x+L.knee.rotation.x)*.85;
 });
 const bob=clip==='idle'?0:Math.abs(Math.sin(A.ph))*(clip==='run'?.05:.018)*A.size;
 A.trunk.position.y=bob*.6;
 A.bodyG.rotation.x=clip==='run'&&sp.gallop?Math.sin(A.ph+PI*.4)*.07:0;
 A.bodyG.scale.y=1+(clip==='idle'?Math.sin(t*2.2)*.012:0);
 // cabeça e pescoço
 const low=A.infected?.35:0;
 if(A.neck){A.neck.rotation.x=A.neckA+low+(clip==='idle'?Math.sin(t*.7)*.08:Math.sin(A.ph*2)*.04);A.neck.rotation.y=clip==='idle'?Math.sin(t*.45)*.35:0;}
 if(A.head){A.head.rotation.z=A.infected?Math.sin(t*11)*Math.sin(t*1.7)*.12:0;}
 if(A.jaw)A.jaw.rotation.x=A.infected?.25+Math.max(0,Math.sin(t*6))*.25:(clip==='run'?.12:0);
 // cauda
 A.tail.forEach((s,i)=>{s.rotation.z=Math.sin(t*(sp.id==='cao'&&!A.infected?9:2.2)-i*.6)*(sp.id==='cao'&&!A.infected?.35:.12);});
}
function animBird(A,t,dt){
 const sp=A.sp,b=sp.b;let clip=st.clip;if(A.id!==st.sel&&clip!=='idle')clip='walk';
 const fly=clip==='run'&&sp.id!=='galinha';
 const hz=(clip==='run'&&!fly?sp.runHz:clip==='walk'?sp.walkHz:0);
 A.ph+=dt*(fly?(sp.id==='urubu'?1.1:4.5):hz)*2*PI;
 // corpo sobe no voo
 const ty=fly?A.size*1.2:0;A.trunk.position.y+=(ty-A.trunk.position.y)*Math.min(1,dt*3);
 A.legs.forEach((L,i)=>{if(fly){L.hip.rotation.x=1.2;L.knee.rotation.x=-1.6;}else if(clip==='idle'){L.hip.rotation.x=0;L.knee.rotation.x=0;}else{const p=A.ph+i*PI;L.hip.rotation.x=-Math.sin(p)*.45;L.knee.rotation.x=-Math.max(0,Math.cos(p))*.7;}L.foot.rotation.x=-(L.hip.rotation.x+L.knee.rotation.x);});
 A.wings.forEach(w=>{const s=w.s;
  if(fly){const f=sp.id==='urubu'?.25+Math.sin(A.ph)*.18:Math.sin(A.ph)*.9;w.sh.rotation.y+=(0-w.sh.rotation.y)*Math.min(1,dt*6);w.sh.rotation.z=s*f;w.el.rotation.z=s*(sp.id==='urubu'?.08:Math.sin(A.ph-.6)*.4);w.el.rotation.y=0;w.sh.scale.x+=(1-w.sh.scale.x)*Math.min(1,dt*6);}
  else{const alert=sp.id==='queroquero'&&clip==='idle'?Math.max(0,Math.sin(t*1.3))*.9:0;const flap=sp.id==='galinha'&&clip==='run'?Math.abs(Math.sin(A.ph*1.5))*.8:0;
   w.sh.rotation.y+=(s*PI/2*.97-alert*s*.9-w.sh.rotation.y)*Math.min(1,dt*6);w.sh.rotation.z=s*(-.06+flap+alert*.6);w.el.rotation.z=s*.04;w.el.rotation.y=0;w.sh.scale.x+=((alert>.1?1:.58)-w.sh.scale.x)*Math.min(1,dt*6);}});
 const peck=sp.id==='galinha'&&clip==='idle'?Math.max(0,Math.sin(t*1.6))**8*1.2:0;
 if(A.neck){A.neck.rotation.x=A.neckA+(clip==='walk'&&sp.id!=='urubu'?Math.max(0,Math.sin(A.ph*2))*.35:0)+peck+(fly?.6:0);A.neck.rotation.y=clip==='idle'?Math.sin(t*.9)*.5:0;}
 if(A.jaw)A.jaw.rotation.x=sp.id==='queroquero'&&clip==='idle'?Math.max(0,Math.sin(t*1.3))*Math.abs(Math.sin(t*14))*.5:0;
 if(A.tailRoot)A.tailRoot.rotation.x=(b.tailA||0)+(fly?.6:0);
}
function animSnake(A,t,dt){
 let clip=st.clip;if(A.id!==st.sel&&clip!=='idle')clip='walk';
 const n=A.n,seg=A.seg*(st.split?1.5:1);
 if(clip==='walk'){A.ph+=dt*2.4;}
 const pts=[];
 for(let i=0;i<n;i++){let x,z,y=0;
  if(clip==='walk'){z=.6-i*seg;x=Math.sin(A.ph*2.2-i*.42)*.08*Math.min(1,i/6+.3);}
  else{ // enrolada com a cabeça em S para o bote
   const strike=clip==='run'?Math.max(0,Math.sin(t*2.2))**6:0;
   if(i<9){const k=i/9;z=.08+(1-k)*.12+strike*(1-k)*.35;y=(1-k)*.13*(1-strike*.6);x=Math.sin(k*PI*1.6)*.05*(1-strike);}
   else{const a=(i-9)*.36,r=.16-(i-9)*.0045;x=Math.cos(a)*r;z=Math.sin(a)*r-.05;y=(i-9)*.0012;}}
  pts.push(new THREE.Vector3(x,y,z));}
 for(let i=0;i<n;i++){const s=A.segs[i];s.g.position.copy(pts[i]);const d=i===0?pts[0].clone().sub(pts[1]):pts[i-1].clone().sub(pts[i]);s.g.rotation.set(0,Math.atan2(d.x,d.z),0);s.g.rotateX(-Math.atan2(d.y,Math.hypot(d.x,d.z)));}
 const d0=pts[0].clone().sub(pts[1]).normalize();A.head.position.copy(pts[0]).addScaledVector(d0,.02);A.head.rotation.set(0,Math.atan2(d0.x,d0.z),0);A.head.rotateX(-Math.atan2(d0.y,Math.hypot(d0.x,d0.z))*.5);
 A.jaw.rotation.x=clip==='run'?Math.max(0,Math.sin(t*2.2))**6*.9:0;
 A.tongue.visible=Math.sin(t*5)>.3;A.tongue.scale.z=1+Math.sin(t*20)*.3;
 // juntas visíveis/separar: aumenta espaçamento já feito acima
}

// ---------- câmera ----------
let yaw=.3,pitch=.26,dist=2.4,target=new THREE.Vector3(),tgtGoal=new THREE.Vector3(),distGoal=2.4;
function focus(){const A=curA();tgtGoal.copy(A.home).add(new THREE.Vector3(0,A.size*.42,0));distGoal=Math.max(.55,A.size*2.6+.4);ruler.position.set(A.home.x+A.size*.75+.2,0,A.home.z-.9);}
let drag=null;
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.006;pitch=Math.max(.02,Math.min(1.2,pitch+(e.clientY-drag.y)*.004));drag={x:e.clientX,y:e.clientY};});
cv.addEventListener('pointerup',()=>drag=null);cv.addEventListener('pointercancel',()=>drag=null);
cv.addEventListener('wheel',e=>{e.preventDefault();distGoal=Math.max(.35,Math.min(30,distGoal*(1+Math.sign(e.deltaY)*.12)));},{passive:false});
const ray=new THREE.Raycaster();
cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},camera);const h=ray.intersectObjects(ANIMALS.map(a=>a.root),true).find(h=>h.object.userData.aid);if(h)select(h.object.userData.aid);});

function setLight(night){st.night=night;
 if(night){scene.background=new THREE.Color(0x0b1018);scene.fog=new THREE.Fog(0x0b1018,10,34);hemi.intensity=.42;hemi.color.set(0x8aa0c0);moon.color.set(0x9fb4d8);moon.intensity=.75;lampL.intensity=1.7;renderer.toneMappingExposure=1;}
 else{scene.background=new THREE.Color(0x9aa49c);scene.fog=new THREE.Fog(0x9aa49c,14,48);hemi.intensity=.85;hemi.color.set(0xd8dccf);moon.color.set(0xfff0d8);moon.intensity=1.25;lampL.intensity=0;}
 document.getElementById('bNight').setAttribute('aria-pressed',night);document.getElementById('bDay').setAttribute('aria-pressed',!night);}
document.getElementById('bNight').onclick=()=>setLight(true);document.getElementById('bDay').onclick=()=>setLight(false);

// ---------- UI ----------
const infLabel={vira:'vira zumbi',morre:'morre da mordida',imune:'imune'};
const chips=document.getElementById('chips');
SPECIES.forEach(s=>{const b=document.createElement('button');b.textContent=s.nome;b.dataset.id=s.id;b.setAttribute('aria-pressed','false');b.onclick=()=>select(s.id);chips.appendChild(b);});
const cards=document.getElementById('cards');
SPECIES.forEach(s=>{const c=document.createElement('button');c.className='card';c.dataset.id=s.id;
 c.innerHTML=`<div><h3>${s.nome}</h3><span class="sci">${s.sub} · <i>${s.sci}</i></span></div><div class="tags"><span class="tag">${s.grupo}</span><span class="tag ${s.inf}">${infLabel[s.inf]}</span><span class="tag ${s.fase==='MVP'?'mvp':''}">${s.fase==='MVP'?'fatia vertical':s.fase}</span></div><dl><div><dt>Onde vive</dt><dd>${s.onde}</dd></div><div><dt>Papel</dt><dd>${s.papel}</dd></div><div><dt>Cuidado</dt><dd>${s.cuidado}</dd></div><div><dt>Rende</dt><dd>${s.rende}</dd></div><div><dt>Som</dt><dd>${s.som}</dd></div></dl>`;
 c.onclick=()=>{select(s.id);document.getElementById('estudio').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};cards.appendChild(c);});
function renderFicha(){const s=SPECIES.find(x=>x.id===st.sel),A=curA();
 const parts=A.piv.length,j=A.joints.length;
 const infTxt=s.inf==='vira'?'Infectado':s.inf==='morre'?'Mordido':'Imune';
 const bi=document.getElementById('bInf');bi.textContent=infTxt;bi.disabled=s.inf==='imune';bi.setAttribute('aria-pressed',st.inf&&s.inf!=='imune');
 document.getElementById('bRun').textContent=s.snake?'Bote':s.b&&s.id!=='galinha'?'Voar':'Correr';
 document.querySelector('[data-clip="idle"]').textContent=s.snake?'Enrolada':s.id==='queroquero'?'Alerta':'Parado';
 document.querySelector('[data-clip="walk"]').textContent=s.snake?'Rastejar':'Andar';
 document.getElementById('bName').textContent=s.nome;document.getElementById('bSub').textContent=s.sub+' · '+infLabel[s.inf];
 document.getElementById('ficha').innerHTML=`<div><h3>${s.nome}</h3><span class="sci">${s.sub} · <i>${s.sci}</i></span></div><div class="tags"><span class="tag">${s.grupo}</span><span class="tag ${s.inf}">${infLabel[s.inf]}</span><span class="tag ${s.fase==='MVP'?'mvp':''}">${s.fase==='MVP'?'fatia vertical':s.fase}</span></div><dl><div><dt>Onde vive</dt><dd>${s.onde}</dd></div><div><dt>Papel</dt><dd>${s.papel}</dd></div><div><dt>Cuidado</dt><dd>${s.cuidado}</dd></div><div><dt>Som</dt><dd>${s.som}</dd></div></dl><div class="anat"><span>Partes com junta: ${parts}</span><span>Articulações: ${j}</span><span>Triângulos na prévia: ${A.tris.toLocaleString('pt-BR')}</span><span>Altura do corpo: ${(A.size).toFixed(2).replace('.',',')} m (régua de 1,80 m ao lado)</span></div>`;
 chips.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===st.sel));
 cards.querySelectorAll('.card').forEach(b=>b.setAttribute('aria-current',b.dataset.id===st.sel));
 highlightMap();}
function select(id){if(st.inf){const P=curA();setInfected(P,false);}st.sel=id;if(st.inf)setInfected(curA(),true);focus();renderFicha();}
document.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>{st.clip=b.dataset.clip;document.querySelectorAll('[data-clip]').forEach(x=>x.setAttribute('aria-pressed',x===b));});
document.getElementById('bInf').onclick=()=>{st.inf=!st.inf;setInfected(curA(),st.inf);renderFicha();};
document.getElementById('bJoint').onclick=e=>{st.joint=!st.joint;setJoint(st.joint);e.currentTarget.setAttribute('aria-pressed',st.joint);};
document.getElementById('bSplit').onclick=e=>{st.split=!st.split;setSplit(st.split);e.currentTarget.setAttribute('aria-pressed',st.split);};

// ---------- mapa de habitats ----------
const TER={rios:{"Rio Turvo":[[630,152],[560,215],[470,265],[420,330],[360,390],[318,450],[330,520],[380,610],[420,680],[470,800]],"Rio Claro":[[800,255],[760,300],[720,350],[680,400],[660,440],[640,480],[600,540],[540,610],[480,665],[422,684]],"Córrego do Corvo":[[170,20],[185,90],[205,150],[235,215],[275,280],[320,340],[360,390]],"Ribeirão das Pedras":[[0,470],[90,478],[180,468],[260,455],[318,450]]},
 lagos:[[630,95,75,55],[300,640,38,24],[150,660,16,11],[742,505,11,8]],
 estradas:[[[0,570],[130,565],[330,400],[490,360],[650,420],[800,430]],[[410,290],[300,100],[280,0]],[[410,440],[470,700],[480,800]]],
 cidades:[[400,390,'Santa Aurora'],[480,722,'Porto Turvo'],[668,428,'Três Pontes'],[130,560,'Campo Largo'],[320,92,'Vila do Corvo']]};
const svg=document.getElementById('map');const NS='http://www.w3.org/2000/svg';
function el(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e;}
el('rect',{x:0,y:0,width:800,height:800,fill:'#121713'});
el('path',{d:'M0 0 L800 0 L800 150 Q600 210 420 170 Q250 150 0 210 Z',fill:'#1a1f19'}); // serra
el('ellipse',{cx:725,cy:660,rx:95,ry:135,fill:'#162016'}); // mata funda
el('text',{x:20,y:40,fill:'#5f675f','font-family':'JetBrains Mono, monospace','font-size':15}).textContent='Serra do Corvo';
el('text',{x:665,y:795,fill:'#5f675f','font-family':'JetBrains Mono, monospace','font-size':15}).textContent='Mata Funda';
for(const r of TER.estradas)el('polyline',{points:r.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#3a3f39','stroke-width':3});
for(const k in TER.rios)el('polyline',{points:TER.rios[k].map(p=>p.join(',')).join(' '),fill:'none',stroke:'#3f6a82','stroke-width':k.startsWith('Rio')?5:2.5,'stroke-linejoin':'round','stroke-linecap':'round'});
for(const l of TER.lagos)el('ellipse',{cx:l[0],cy:l[1],rx:l[2],ry:l[3],fill:'#2c4c5e'});
const zoneG=el('g',{});
const zoneEls=[];
for(const s of SPECIES){for(const z of ZONES[s.id]){const c=el('circle',{cx:z[0],cy:z[1],r:z[2],fill:GCOL[s.grupo],'fill-opacity':.1,stroke:GCOL[s.grupo],'stroke-opacity':.35,'stroke-width':1.2},zoneG);const ti=document.createElementNS(NS,'title');ti.textContent=s.nome+': '+z[3];c.appendChild(ti);zoneEls.push({c,s,z});}}
for(const cty of TER.cidades){el('rect',{x:cty[0]-5,y:cty[1]-5,width:10,height:10,fill:'#d9dcd3'});const t=el('text',{x:cty[0]+9,y:cty[1]-8,fill:'#d9dcd3','font-family':'Barlow, sans-serif','font-size':17,'font-weight':600,'paint-order':'stroke',stroke:'#121713','stroke-width':4});t.textContent=cty[2];}
const labG=el('g',{});
function highlightMap(){const s=SPECIES.find(x=>x.id===st.sel);labG.innerHTML='';
 zoneEls.forEach(({c,s:zs,z})=>{const on=zs.id===s.id;c.setAttribute('fill-opacity',on?.38:.06);c.setAttribute('stroke-opacity',on?1:.18);c.setAttribute('stroke-width',on?2.5:1);
  if(on){const t=el('text',{x:z[0],y:z[1]+z[2]+16,fill:GCOL[s.grupo],'text-anchor':'middle','font-family':'JetBrains Mono, monospace','font-size':13,'paint-order':'stroke',stroke:'#121713','stroke-width':4},labG);t.textContent=z[3];}});
 document.getElementById('zones').innerHTML=`<h3 style="color:${GCOL[s.grupo]}">${s.nome}</h3>`+ZONES[s.id].map(z=>`<div class="z"><span class="dot" style="background:${GCOL[s.grupo]}"></span><div><b>${z[3]}</b> <span class="mono">· px ${z[0]}, ${z[1]} · raio ${(z[2]*40/1000).toLocaleString('pt-BR')} km</span></div></div>`).join('')+
 `<p class="muted" style="margin-top:6px">${s.onde}</p><div class="tags" style="margin-top:8px">${Object.entries(GCOL).map(([k,v])=>`<span class="tag" style="color:${v};border-color:${v}">${k}</span>`).join('')}</div>`;}

// ---------- loop ----------
function resize(){const w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.floor(w*renderer.getPixelRatio())||cv.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
const clock=new THREE.Clock();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(){const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;resize();
 for(const A of ANIMALS){if(A.sp.snake)animSnake(A,t,dt);else if(A.sp.b)animBird(A,t,dt);else animQuad(A,t,dt);
  A.piv.forEach(p=>{const tg=p.g.userData.tgt;if(tg)p.g.position.lerp(tg,Math.min(1,dt*5));});}
 flock.forEach((f,i)=>{const a=t*f.sp+f.o;f.A.root.position.set(Math.cos(a)*f.r-4,f.h,Math.sin(a)*f.r-8);f.A.root.rotation.set(0,-a,.35);f.A.ph+=dt*1.2*2*PI;f.A.wings.forEach(w=>{w.sh.rotation.y=0;w.el.rotation.y=0;w.sh.rotation.z=w.s*(.18+Math.sin(f.A.ph*.4)*.05);});f.A.legs.forEach(L=>{L.hip.rotation.x=1.2;L.knee.rotation.x=-1.6;});});
 target.lerp(tgtGoal,Math.min(1,dt*4));dist+=(distGoal-dist)*Math.min(1,dt*4);
 camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*dist,target.y+Math.sin(pitch)*dist,target.z+Math.cos(yaw)*Math.cos(pitch)*dist);camera.lookAt(target);
 moon.position.set(target.x-8,14,10);moon.target.position.copy(target);
 renderer.render(scene,camera);requestAnimationFrame(frame);}
setLight(true);select('cao');target.copy(tgtGoal);dist=distGoal;frame();
