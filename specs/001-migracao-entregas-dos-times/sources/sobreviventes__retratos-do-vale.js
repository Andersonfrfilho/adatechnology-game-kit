// fonte: site/pages/sobreviventes/retratos-do-vale.html
// texto visível: Retratos do Vale ZombiAdA · arte · sobreviventes e bases Retratos do Vale Os 31 sobreviventes e as 13 bases do elenco como modelos 3D no corpo anatômico do guia de estilo do projeto: low poly facetado com curvas, juntas e caminhada, na mesma noite de poste de sódio da cena de arte. Cada pessoa aparece com o item que sempre carrega e pode ser vista como zumbi nomeado, que é como o jogador vai reencontrá-la se ela morrer mordida. Modelos de referência montados no navegador com o mesmo construtor de corpo do Elenco do Vale (personagens/arte/guia-estilo-corpo.md). A proporção, a paleta de roupa e o item de cada um são o que deve passar para os modelos finais. Sobreviventes Bases Regras visuais 44 pessoas Sobreviventes Clique em um retrato para abrir no visualizador e arraste para girar. O botão de zumbi troca a pele, acende os olhos com a cor da categoria do bestiário e põe a pose e a caminhada de zumbi. Crianças nunca viram zumbi nomeado. arraste para girar Vivos Zumbis nomeados Renderizando retratos… 17 lugares Bases Maquetes de cada base no estado do começo do jogo, com defesa, luz e zumbis em volta na escala certa. Clique para abrir e arraste para girar a câmera. arraste para girar Renderizando maquetes… Para o time de arte Regras visuais Humano adulto 1,80 m · criança 0,55–0,72 do tamanho Tronco torneado, membros afinados de 9 lados, juntas esféricas Item marcado sempre visível de longe Zumbi: pele #6f7a5c, olhos emissivos, sangue no peito e na boca Lento #E3C341 · Corredor #E5392B · Brutamonte #EF8A2A Cor de grupo só em detalhe, nunca na roupa inteira Fardados: camuflado em xadrez de 2 tons, colete com porta-carregador, item marcado acima da cintura Mancha em tecido: borda difusa e irregular, mais escura no centro, semente diferente por pessoa Sangue fresco #8A0A0A brilhante, escorre · seco #3B1D14 fosco, após 10 min O item marcado é a peça mais importante do modelo: é o que faz o jogador reconhecer a Jéssica pelos fones vermelhos no meio de uma horda. Ele precisa ter cor saturada contra a roupa e ficar na metade de cima do corpo ou na mão. Sangue de sobrevivente ferido ou morto segue a regra dos fluidos da Oficina de VFX : fresco é vermelho brilhante, escorre e pinga; depois de 10 minutos seca em marrom fosco e para. Cenas de história com sangue antigo, como a fazenda dos Moreira depois do ataque dos Corvos ou o pátio da oficina, usam só o seco.

// ===== script 1 (83 KB)

(function(){
'use strict';
const $=s=>document.querySelector(s);
if(!window.THREE){$("#pload").textContent="Não foi possível carregar o motor 3D. Recarregue a página.";$("#bload").textContent="";return}
const T=THREE;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const EYE={lento:0xE3C341,corredor:0xE5392B,brutamonte:0xEF8A2A};
const ZSKIN=0x7d8b6a;

/* ---------- materiais e primitivas ---------- */
const mc={};
function M(c,o){const k=o?null:c;if(k!==null&&mc[k])return mc[k];const m=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:true},o||{}));if(k!==null)mc[k]=m;return m}
const bc={};function G(c){if(!bc[c])bc[c]=new T.MeshBasicMaterial({color:c});return bc[c]}
const gc={};function BG(w,h,d){const k=w+"|"+h+"|"+d;return gc[k]||(gc[k]=new T.BoxGeometry(w,h,d))}
function B(p,w,h,d,m,x,y,z,rx,ry,rz){const o=new T.Mesh(BG(w,h,d),typeof m==="number"?M(m):m);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=o.receiveShadow=true;p.add(o);return o}
function C(p,rt,rb,h,seg,m,x,y,z,rx,ry,rz){const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),typeof m==="number"?M(m):m);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=o.receiveShadow=true;p.add(o);return o}
function K(p,r,h,seg,m,x,y,z,ry){const o=new T.Mesh(new T.ConeGeometry(r,h,seg),typeof m==="number"?M(m):m);o.position.set(x,y,z);o.rotation.y=ry||0;o.castShadow=o.receiveShadow=true;p.add(o);return o}
function TR(p,r,t,m,x,y,z,rx,ry,rz,arc){const o=new T.Mesh(new T.TorusGeometry(r,t,4,10,arc||Math.PI*2),typeof m==="number"?M(m):m);o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);p.add(o);return o}
const mix=(a,b,t)=>new T.Color(a).lerp(new T.Color(b),t).getHex();
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- corpo anatômico (função build do Elenco do Vale, guia-estilo-corpo.md) ---------- */
function mat(c,o){return M(c,o)}
const Bx=(x,y,z)=>new T.BoxGeometry(x,y,z);
function add(parent,geo,m,x,y,z,rx,ry,rz){const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function canvasTex(w,h,draw){const cv=document.createElement("canvas");cv.width=w;cv.height=h;draw(cv.getContext("2d"),w,h);return new T.CanvasTexture(cv)}
const R=rng(77);
const THREE_=T;
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
  if(hs==='pony'){hairCap(.174,PI/2,-.38);backBand(PI*.45,PI*.22);const t=add(Hd,new THREE.CylinderGeometry(.04,.025,.3,6),hc,0,1.7,-.2);t.rotation.x=.25;}
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
  if(f.includes('mirror')){add(Hd,Bx(.27,.012,.015),cmat(0x1a1a1a),0,1.84,.175);for(const s of[-1,1]){add(Hd,Bx(.095,.06,.014),cmat(0xc8ccd0,{metalness:.95,roughness:.12}),s*.06,1.817,.179);add(Hd,Bx(.012,.012,.17),cmat(0x1a1a1a),s*.15,1.83,.09);}}
  if(f.includes('labgoggles')){const b=add(Hd,new THREE.CylinderGeometry(.168,.168,.03,10,1,true),cmat(0x2a6a8a),0,1.92,0);b.scale.set(.97,1,1.04);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.045,.045,.04,8).rotateX(PI/2),cmat(0x9fc4d8,{roughness:.1,transparent:true,opacity:.7}),s*.06,1.93,.165);}
  if(f.includes('beard')){const b=add(Hd,new THREE.SphereGeometry(.128,8,6),hc,0,1.7,.035);b.scale.set(1.02,.8,1);}
  // hats
  if(sp.hat){const k=sp.hat.k,c=cmat(sp.hat.c);
    if(k==='cap'||k==='capback'){const o=add(Hd,cap(.182,PI/2),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,Bx(.28,.022,.17),c,0,1.85,k==='cap'?.2:-.2,k==='cap'?.12:-.12,0,0);}
    if(k==='beret'){const o=add(Hd,new THREE.CylinderGeometry(.2,.185,.07,20),c,.025,1.95,0,0,0,.16);o.scale.set(1,1,1.05);}
    if(k==='hardhat'){const o=add(Hd,cap(.198,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.08);add(Hd,new THREE.CylinderGeometry(.25,.25,.02,20),c,0,1.865,.02);add(Hd,Bx(.03,.06,.38),c,0,2.04,0);}
    if(k==='fire'){const o=add(Hd,cap(.205,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.1);const br=add(Hd,new THREE.CylinderGeometry(.27,.27,.02,20),c,0,1.86,-.06);br.scale.set(1,1,1.25);add(Hd,Bx(.09,.08,.02),cmat(0xd8b040,{metalness:.7}),0,1.96,.205);}
    if(k==='straw'){add(Hd,new THREE.CylinderGeometry(.38,.38,.022,24),c,0,1.93,0);add(Hd,new THREE.CylinderGeometry(.155,.18,.15,20),c,0,2.01,0);add(Hd,new THREE.CylinderGeometry(.182,.182,.03,20),cmat(0x5a3a22),0,1.955,0);}
    if(k==='moto'){const o=add(Hd,new THREE.SphereGeometry(.235,20,16),c,0,1.81,-.01);o.scale.set(.98,1.04,1.06);add(Hd,new THREE.SphereGeometry(.226,20,10,PI*.18,PI*.64,PI*.36,PI*.2),new THREE.MeshStandardMaterial({color:0x10141a,roughness:.1,metalness:.8,flatShading:false}),0,1.81,.02);add(Hd,new THREE.CylinderGeometry(.215,.2,.05,20),cmat(0xb8322a),0,1.6,-.01);}
    if(k==='bandana'){const o=add(Hd,cap(.18,PI*.48),c,0,1.8,-.005);o.scale.set(.98,1.1,1.05);o.rotation.x=-.4;add(Hd,Bx(.07,.12,.03),c,0,1.76,-.19,.3,0,0);}
    if(k==='helmet'){const o=add(Hd,cap(.205,PI/2),c,0,1.835,-.005);o.scale.set(1,.98,1.08);add(Hd,new THREE.CylinderGeometry(.208,.212,.04,20),c,0,1.84,-.005);
      if(sp.hat.tape)add(Hd,new THREE.CylinderGeometry(.205,.207,.035,20),cmat(sp.hat.tape),0,1.9,-.005);
      if(sp.hat.photo){add(Hd,Bx(.07,.08,.012),cmat(0xf4f0e0),.13,1.9,.14,0,.75,0);add(Hd,Bx(.05,.055,.014),cmat(0x8a6a50),.13,1.9,.141,0,.75,0);}
      if(sp.hat.nvg){add(Hd,Bx(.07,.05,.06),cmat(0x1a1a1a),0,2.0,.175);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.024,.024,.09,10).rotateX(PI/2),cmat(0x2a3a2a),s*.032,1.965,.235);}
      for(const s of[-1,1])add(Hd,Bx(.012,.15,.012),cmat(0x1a1a1a),s*.16,1.74,.04);}
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
    case'rosary':add(arms[1].el,new THREE.TorusGeometry(.055,.012,4,10),m,0,-.27,0,PI/2,0,0);add(arms[1].el,Bx(.015,.06,.01),m,0,-.33,.06);break;
    case'watch':{const g=cmat(0xd0a23a,{metalness:.8,roughness:.3});add(U,new THREE.CylinderGeometry(.05,.05,.02,10).rotateX(PI/2),g,.12,1.06,.135);add(U,Bx(.015,.14,.01),g,.06,1.1,.135,0,0,.9);break;}
    case'chain':{add(legs[0].kn,new THREE.TorusGeometry(.085,.015,4,8),m,0,-.34,0,PI/2,0,0);for(let i=0;i<6;i++)add(root,new THREE.TorusGeometry(.045,.012,4,8),m,.2+i*.07,.03,-.06-i*.06,i%2?PI/2:0,.6,0);break;}
    case'unicorn':add(U,Bx(.32,.36,.16),m,0,1.24,-.24);add(U,new THREE.ConeGeometry(.035,.16,5),cmat(0xf2c84a),0,1.5,-.24);for(const s of[-1,1]){add(U,Bx(.05,.07,.04),cmat(0xe88ab8),s*.09,1.45,-.24);add(U,Bx(.04,.42,.03),cmat(0xb06ac8),s*.13,1.3,.16,-.1,0,0);}break;
    case'whistle':for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x9aa0a6),s*.06,1.48,.17,0,0,-s*.35);add(U,new THREE.CylinderGeometry(.022,.022,.08,6).rotateZ(PI/2),cmat(0xd0d4d8,{metalness:.9,roughness:.2}),0,1.36,.19);break;
    case'pen':add(Hd,new THREE.CylinderGeometry(.01,.01,.26,5),cmat(0x2a50c8),0,1.92,-.15,0,0,1.3);break;
    case'photo':for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0xd0a23a),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.07,.09,.01),cmat(0xf4f0e0),0,1.34,.185);break;
    case'pins':[[0xd84a3a,.1,1.38],[0xf2d046,.17,1.3],[0x4ac08a,.12,1.22],[0xf0f0f0,-.15,1.36]].forEach(([k,x,y])=>add(U,new THREE.CylinderGeometry(.028,.028,.02,8).rotateX(PI/2),cmat(k),x,y,.185));break;
    case'recorder':add(U,Bx(.13,.09,.05),cmat(0x1a1a1a),.15,1.28,.215);for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.02,.02,.052,8).rotateX(PI/2),cmat(0xd88a2a),.15+s*.03,1.29,.22);break;
    case'beads':{const cs=[0xe8483a,0xf2d046,0x4aa0e0,0x5ac06a,0xe88ab8,0xffffff];for(let i=0;i<8;i++){const a=i/8*PI*2;add(arms[0].el,Bx(.03,.03,.03),cmat(cs[i%6]),Math.cos(a)*.055,-.26,Math.sin(a)*.055);}break;}
    case'badge':for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x2a5aa8),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.08,.11,.01),cmat(0xf4f4f4),0,1.34,.185);add(U,Bx(.04,.04,.012),cmat(0x5a8ac8),0,1.36,.19);break;
    case'stethc':add(U,new THREE.TorusGeometry(.14,.018,5,10,PI),m,0,1.6,-.02,-PI/2+.3,0,0);add(U,Bx(.02,.2,.02),m,-.1,1.42,.19);add(U,new THREE.CylinderGeometry(.035,.035,.02,8).rotateX(PI/2),cmat(0xc0c4c8,{metalness:.9,roughness:.2}),-.1,1.31,.2);break;
    case'bandolier':for(let i=0;i<9;i++)add(U,Bx(.035,.08,.035),cmat(0xc4282a),-.22+i*.055,1.44-i*.055,.2,0,0,-.75);add(U,Bx(.05,.75,.02),cmat(0x4a3a22),0,1.22,.195,0,0,-.75);break;
    case'scarf':ring(U,.1,.08,m,1.57,1.3,1.2);add(U,new THREE.ConeGeometry(.08,.14,3),m,0,1.47,.15,PI,0,0);break;
    case'feather':add(Hd,Bx(.02,.24,.06),cmat(0x0a0a0c),.17,2.0,-.04,0,0,-.3);break;
    case'amulet':for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x5a3a22),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.07,.09,.03),cmat(0x7a4a2a),0,1.34,.19);break;
    case'rifle_front':case'rifle_tape':case'dbl_front':{const g=new THREE.Group();g.position.set(.02,1.15,.26);g.rotation.z=.95;U.add(g);const dk=cmat(0x1c1d1f,{metalness:.6,roughness:.45});
      add(g,Bx(.08,.3,.06),cmat(k==='dbl_front'?0x5a3a22:0x2a2c28),0,-.38,0);add(g,Bx(.05,.85,.05),dk,0,.2,0);if(k==='dbl_front'){add(g,Bx(.05,.6,.05),dk,.05,.3,0);add(g,Bx(.11,.06,.08),cmat(0xe8e4d8),0,-.25,0);}
      else{add(g,Bx(.07,.14,.09),dk,0,-.08,.04);if(k==='rifle_tape'){add(g,Bx(.08,.08,.08),cmat(0x4a5a3a),0,.3,0);add(g,Bx(.08,.08,.08),cmat(0x6a6a4a),0,.08,0);}}
      arms.forEach(a=>a.grip=true);break;}
    case'belly':{const b=ball(U,.16,topM,0,1.03,.105);b.scale.set(1.05,1.08,.95);break;}
    case'refl':{const v=add(U,new THREE.CylinderGeometry(.287,.252,.46,20),m,0,1.3,0);v.scale.set(1.13,1,.72);ring(U,.29,.035,cmat(0xc8ccd0,{metalness:.3,roughness:.4}),1.2,1.13,.73);ring(U,.3,.035,cmat(0xc8ccd0,{metalness:.3,roughness:.4}),1.37,1.13,.73);add(U,Bx(.17,.055,.02),cmat(0x1a2a6a),0,1.47,.205);break;}
    case'plate':{const v=add(U,new THREE.CylinderGeometry(.28,.25,.44,20),m,0,1.3,0);v.scale.set(1.12,1,.72);for(let i=0;i<3;i++)add(U,Bx(.08,.14,.06),m,-.1+i*.1,1.16,.2);add(U,Bx(.07,.11,.045),cmat(0x1a1a1a),.16,1.42,.2);for(const s of[-1,1])add(U,Bx(.07,.04,.2),m,s*.17,1.53,0);break;}
    case'keyring':{add(U,new THREE.TorusGeometry(.12,.009,4,14,PI),cmat(0x2a2a2a),0,1.5,.07,PI/2+.6,0,0);add(U,new THREE.TorusGeometry(.05,.008,4,12),cmat(0xb8b0a0,{metalness:.9,roughness:.25}),0,1.34,.2);for(let i=0;i<7;i++)add(U,Bx(.013,.075,.006),cmat(i%2?0xd0b060:0xb8bcc0,{metalness:.9,roughness:.3}),-.045+i*.015,1.28,.21,0,0,(i-3)*.18);break;}
    case'satradio':{add(U,Bx(.3,.4,.18),m,0,1.28,-.25);add(U,Bx(.012,.62,.012),cmat(0x1a1a1a),.1,1.72,-.3,0,0,.15);add(U,Bx(.08,.06,.03),cmat(0x3a3a3a),-.08,1.4,-.35);for(const s of[-1,1])add(U,Bx(.045,.46,.03),cmat(0x1a1a1a),s*.15,1.3,.17,-.1,0,0);break;}
    case'binoc':for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.03,.034,.12,10).rotateX(PI/2),cmat(0x262824),s*.038,1.38,.26);add(U,Bx(.03,.03,.04),cmat(0x262824),0,1.38,.25);break;
    case'tq':add(arms[1].g,new THREE.CylinderGeometry(.09,.087,.055,16),cmat(0xd8262a),0,-.05,0);add(arms[1].g,Bx(.03,.05,.04),cmat(0x1a1a1a),0,-.05,.09);break;
    case'cuia':add(U,new THREE.SphereGeometry(.055,12,10),cmat(0x6a7a3a),-.21,.9,.12);add(U,new THREE.CylinderGeometry(.006,.006,.13,6),cmat(0xc0c4c8,{metalness:.9,roughness:.2}),-.21,.99,.12,0,0,.3);add(U,new THREE.CylinderGeometry(.04,.04,.015,12),cmat(0xb8a070),-.21,.95,.12);break;
    case'card':for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x2a2a2a),s*.05,1.5,.2,0,0,-s*.3);add(U,Bx(.08,.11,.01),cmat(0xd82020),0,1.36,.235);add(U,Bx(.05,.012,.012),cmat(0xf0f0f0),0,1.34,.24);break;
    case'mapfold':add(U,Bx(.1,.13,.025),cmat(0xe8dcb0),-.13,1.33,.215,0,0,.1);add(U,Bx(.1,.012,.027),cmat(0x8a6a3a),-.13,1.35,.215);break;
    case'motoband':add(Hd,new THREE.CylinderGeometry(.238,.238,.045,20),cmat(0xe0c020),0,1.84,-.01);break;
    case'rifle_sup':{const g=new THREE.Group();g.position.set(.02,1.15,.27);g.rotation.z=.95;U.add(g);const dk=cmat(0x1c1d1f,{metalness:.6,roughness:.45});
      add(g,Bx(.07,.26,.06),cmat(0x3a3a34),0,-.36,0);add(g,Bx(.06,.5,.06),dk,0,0,0);add(g,Bx(.07,.14,.09),dk,0,-.06,.05);add(g,Bx(.05,.08,.07),cmat(0x2a2a2a),0,.12,.06);
      add(g,new THREE.CylinderGeometry(.03,.03,.24,10),cmat(0x2a2b2c,{metalness:.5,roughness:.5}),0,.37,0);add(g,Bx(.04,.08,.05),cmat(0x1a1a1a),0,.05,-.05);arms.forEach(a=>a.grip=true);break;}
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
    case'shovel':add(g,new THREE.CylinderGeometry(.022,.022,1.3,6),woodM,0,-.3,0);add(g,Bx(.05,.18,.05),cmat(0xc4282a),0,.22,0);add(g,Bx(.22,.28,.03),metal,0,-1.0,.03);break;
    case'slingshot':add(g,Bx(.03,.16,.03),woodM,0,-.02,0);add(g,Bx(.03,.12,.03),woodM,-.04,-.14,0,0,0,-.4);add(g,Bx(.03,.12,.03),woodM,.04,-.14,0,0,0,.4);add(g,Bx(.1,.015,.015),cmat(0xc4282a),0,-.2,0);break;
    case'bible':add(g,Bx(.06,.24,.18),cmat(0x3a2416),0,-.12,.03);add(g,Bx(.062,.02,.182),cmat(0xd0a23a),0,-.02,.03);break;
    case'flare':{add(g,new THREE.CylinderGeometry(.03,.03,.26,6),cmat(0xe8662a),0,-.06,.02);add(g,new THREE.CylinderGeometry(.035,.02,.06,6),new THREE.MeshBasicMaterial({color:0xffb070}),0,.1,.02);const L=new THREE.PointLight(0xff6a2a,1.4,4,2);L.position.set(0,.15,.05);g.add(L);g.rotation.x=-.5;break;}
    case'radio_h':add(g,Bx(.07,.2,.11),cmat(0x3a3d40),0,-.08,.03);add(g,new THREE.CylinderGeometry(.008,.008,.34,4),cmat(0x9a9a9a),0,.15,.05);add(g,Bx(.075,.05,.115),cmat(0xd8c040),0,-.12,.03);break;
    case'pump':add(g,Bx(.05,.82,.05),dark,0,-.22,.02);add(g,Bx(.07,.15,.09),cmat(0x2a2a2a),0,-.05,.02);add(g,Bx(.065,.14,.07),cmat(0x3a2a1c),0,-.5,.02);add(g,Bx(.03,.7,.03),dark,0,-.2,.07);break;
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
const MOVES={
 idle:  {gait:0, freq:0,  amp:0,  knee:0,  bob:0,   lean:0,   arm:0,   elb:.12, crouch:0,  aim:0, turn:0, grip:.35},
 walk:  {gait:1, freq:5.6,amp:.42,knee:.85,bob:.035,lean:.05, arm:.42, elb:.3,  crouch:0,  aim:0, turn:0, grip:.4},
 run:   {gait:1, freq:9.2,amp:.72,knee:1.5,bob:.06, lean:.3,  arm:.85, elb:1.35,crouch:0,  aim:0, turn:0, grip:1.1},
 crouch:{gait:1, freq:3.8,amp:.3, knee:.6, bob:.02, lean:.42, arm:.15, elb:.7,  crouch:1,  aim:0, turn:0, grip:.8},
 aim:   {gait:0, freq:0,  amp:0,  knee:0,  bob:0,   lean:.06, arm:0,   elb:.2,  crouch:.25,aim:1, turn:0, grip:1.2},
 turn:  {gait:.5,freq:4.2,amp:.14,knee:.7, bob:.012,lean:.03, arm:.12, elb:.25, crouch:0,  aim:0, turn:1, grip:.4}};



const ZSKIN2=new T.Color(0x6f7a5c);
function pose(c,z,W,t){
  const p=c.ph+t,freq=z?3.4:5.6,ph=t*freq+c.ph;
  const breathe=reduce?0:Math.sin(p*1.6)*.012;
  c.upper.scale.y=1+breathe;
  const hunch=c.hunch+(z?.38:0)+W*.05;
  c.upper.rotation.x=hunch;c.upper.rotation.y=W*Math.sin(ph)*.1;c.upper.rotation.z=z?Math.sin(ph*.5)*.06*W+.05:0;
  c.fig.position.y=-W*Math.abs(Math.sin(ph))*.035;
  c.headG.rotation.y=reduce?0:Math.sin(p*.5)*.25*(z?.3:1)*(W?.4:1)*(t?1:0);
  c.headG.rotation.x=-hunch*.6+(z?.15:0);c.headG.rotation.z=z?.22:0;
  c.legs.forEach((l,k)=>{const phi=ph+(k?Math.PI:0);const amp=z&&k===0?.18:(c.skirt?.3:.42);
    l.g.rotation.x=-W*Math.sin(phi)*amp+(z&&!W?(k?-.1:.08):0);
    l.kn.rotation.x=W*(Math.max(0,Math.cos(phi))*(z&&k===0?.25:.85)+.06)+(W?0:.03)});
  c.arms.forEach(a=>{const raise=z?1:0;const base=a.hold?-.2:0;const swing=-a.s*Math.sin(ph)*(z?.12:.42)*W*(a.grip?0:1);
    a.g.rotation.x=(a.grip&&!z?-.75:base-raise*(z?1.12:1.3))+swing+(z&&!reduce&&t?Math.sin(p*3+a.s*2)*.08:0);
    a.g.rotation.z=a.s*(.07+(z?.1:0))+(a.grip&&!z?-a.s*.35:0);
    a.el.rotation.x=z?-.18:(a.grip?-1.1:-(.12+(a.hold?.25:0)+W*(.25+Math.max(0,a.s*Math.sin(ph))*.3)));
    if(a.fingers){const gr=(a.hold||a.grip?1.25:.4)*(z?.5:1);a.fingers.forEach((f,j)=>f.rotation.z=-a.s*gr*(j%2?1.1:.9));a.th.rotation.z=-a.s*(.45+gr*.25);a.hg.rotation.x=reduce?0:-W*Math.sin(ph-.6)*.15*a.s}});
  if(c.dog&&!reduce&&t){const d=c.dog.userData;d.tail.rotation.y=Math.sin(t*9)*.5;d.dlegs.forEach(l=>{l.lg.rotation.x=W*Math.sin(t*7+l.ph)*.45})}
}
function zombify(c,cat){c.skinM.color.copy(c.base).lerp(ZSKIN2,1);c.eyeM.color.set(EYE[cat||"lento"]);c.zb.forEach(b=>b.visible=true);c.mouth.visible=true;c.bags.material.opacity=.9}

/* ---------- elenco ---------- */
const GC={igreja:"#e0a548",deleg:"#c4483b",radio:"#6fa3c7",oficina:"#a3836a",colegio:"#c9c26f",hospital:"#8fc9c0",vila:"#d27fa3",aurora:"#9aa0a6",fabril:"#e07b4f",armas:"#b58ad6",oeste:"#7fae73",serra:"#5fb08a",base:"#7d8a6a",nomade:"#d9dcd3",bloqueio:"#8f9a5c",prf:"#e0c341",penit:"#a3836a",falcao:"#5fb0a0"};
const PM={c:0x5d6e7a,sl:"long"};
const PEOPLE=[
 {id:"zilda",n:"Dona Zilda Ramos",a:"67 · enfermeira aposentada",g:"igreja",it:"Terço no pulso, crucifixo e bolsa de enfermagem",
  b:{fem:1,skin:0x7a4c33,h:.94,hunch:.08,hair:{s:"bun",c:0xbfbcb4},face:["glasses"],top:{c:0x8a6aa0,sl:"long"},pants:{c:0x3a3440,skirt:1},shoes:0x2a2220,ex:[["blouse",0xe4ddd0],["cross",0xd8b040],["rosary",0x6a4428]],hand:"medbag"}},
 {id:"arnaldo",n:"Seu Arnaldo Ramos",a:"70 · ferroviário (zumbi acorrentado)",g:"igreja",it:"Relógio de bolso da ferrovia",already:1,
  b:{skin:0xc49070,hair:{s:"bald",c:0xa8a8a0},face:["stubble"],top:{c:0x4a5a6a,sl:"long"},pants:{c:0x2a2d33},shoes:0x1b1714,ex:[["watch"],["chain",0x6a6a6a]]}},
 {id:"val",n:"Seu Valdir “Val” Cardoso",a:"58 · sacristão e coveiro",g:"igreja",it:"Pá com o cabo de fita vermelha",
  b:{skin:0x8a5a3c,hair:{s:"short",c:0xb0aca4},face:["mustache"],top:{c:0x5a5040,sl:"long"},pants:{c:0x3a3328},shoes:0x2a2018,hand:"shovel"}},
 {id:"mariana",n:"Mariana",a:"8 · órfã, diabética",g:"igreja",it:"Mochila de unicórnio",kid:1,
  b:{fem:1,h:.62,bulk:.74,skin:0xd8a888,hair:{s:"pony",c:0x5a3a22},top:{c:0xd88aa8,sl:"long"},pants:{c:0x4a6a9a},shoes:0xe0e0e0,ex:[["unicorn",0xf0d8e8]]}},
 {id:"criancas",n:"Theo, Duda e Pedrinho",a:"11, 9 e 6 · órfãos",g:"igreja",it:"Boné do Theo, do time da cidade",kid:1,wide:1,
  kids:[{x:-.55,h:.7,bulk:.76,skin:0xc89070,hair:{s:"short",c:0x2a2018},hat:{k:"cap",c:0xb02a2a},top:{c:0x2a2a2a,sl:"short"},pants:{c:0x3a4a6a},shoes:0xe0e0e0,ex:[["stripes",0xb02a2a]]},
    {x:.05,fem:1,h:.63,bulk:.72,skin:0x8a5a3a,hair:{s:"pony",c:0x111111},top:{c:0xe8c84a,sl:"short"},pants:{c:0x6a3a5a},shoes:0xd8d8d0},
    {x:.58,h:.55,bulk:.7,skin:0xd8b090,hair:{s:"short",c:0x6a4a2a},top:{c:0x4ac08a,sl:"short"},pants:{c:0x2a3a5a},shoes:0x3a6a8a}]},
 {id:"brasa",n:"Tenente “Brasa” Valença",a:"41 · ex-PM",g:"deleg",it:"Boina preta do batalhão",
  b:{skin:0xb47a52,h:1.07,bulk:1.18,hair:{s:"bald",c:0x111111},face:["stubble","cig"],hat:{k:"beret",c:0x0e0e10},top:{c:0x2b2f2a,sl:"short"},pants:{c:0x2a3038},shoes:0x111111,ex:[["vest",0x1b1d20],["pouches",0x24282a],["belt",0x15161a],["holster"],["armband",0x9a2a20]],back:"shotgun"}},
 {id:"bigode",n:"Sargento “Bigode” Nunes",a:"48 · PM",g:"deleg",it:"Óculos espelhados",
  b:{skin:0xc69072,h:1.02,bulk:1.14,hair:{s:"short",c:0x1a1410},face:["mustache","mirror"],top:PM,pants:{c:0x2a3038},shoes:0x111111,ex:[["vest",0x1b1d20],["belt",0x15161a],["holster"],["radio"]],hand:"baton"}},
 {id:"italo",n:"Soldado Ítalo Prates",a:"22 · PM recém-formado",g:"deleg",it:"Apito de metal no pescoço",
  b:{skin:0x7a4a30,bulk:.94,hair:{s:"buzz",c:0x111111},top:PM,pants:{c:0x2a3038},shoes:0x111111,ex:[["belt",0x15161a],["holster"],["whistle"]]}},
 {id:"rafa",n:"Rafaela “Rafa” Duarte",a:"36 · escrivã",g:"deleg",it:"Caneta presa no coque",
  b:{fem:1,skin:0xd2a07e,hair:{s:"bun",c:0x4a2e1c},top:{c:0x7a6a8a,sl:"long"},pants:{c:0x2a2a30},shoes:0x2a2220,ex:[["pen"]],lhand:"book"}},
 {id:"jessica",n:"Jéssica Monteiro",a:"27 · locutora",g:"radio",it:"Fone vermelho no pescoço",
  b:{fem:1,skin:0x5a3826,hair:{s:"afro",c:0x1a1310},face:["earrings"],top:{c:0x4a6a9a,sl:"long"},pants:{c:0x1e1f22},shoes:0xb8322a,ex:[["shirtpeek",0xe0b030],["headphones",0xd8262a]],hand:"mic"}},
 {id:"nelson",n:"Seu Nelson Kubo",a:"63 · radioamador",g:"radio",it:"Rádio amador com antena remendada",
  b:{skin:0xd8b090,hair:{s:"short",c:0xb8b4ac},face:["glasses"],top:{c:0xa8a090,sl:"long"},pants:{c:0x3a3a3a},shoes:0x2a2a2a,ex:[["sweatervest",0x6a6a52]],hand:"radio_h"}},
 {id:"rosa",n:"Rosa Tavares",a:"34 · mecânica",g:"oficina",it:"Macacão azul amarrado e bandana vermelha",
  b:{fem:1,skin:0xa8754f,hair:{s:"long",c:0x2a1a10},hat:{k:"bandana",c:0xb8322a},face:["goggles"],top:{c:0xd8d4c8,sl:"tank"},pants:{c:0x2d3a4f},shoes:0x2a2018,ex:[["tiedsleeves",0x2d3a4f],["stains"]],hand:"wrench"}},
 {id:"gil",n:"Gilmar “Gil” Batista",a:"44 · caminhoneiro",g:"oficina",it:"Boné de transportadora e foto das filhas",
  b:{skin:0xc08a68,bulk:1.1,hair:{s:"short",c:0x2a2018},hat:{k:"cap",c:0xe0d8c0},top:{c:0x7a3a2a,sl:"short",plaid:0x4a2018},pants:{c:0x34465e},shoes:0x3a2a1e,ex:[["photo"]]}},
 {id:"otavio",n:"Otávio Lins",a:"52 · professor de química",g:"colegio",it:"Óculos de proteção na testa e garrafa",
  b:{skin:0xd2a885,h:.97,hunch:.12,hair:{s:"bald",c:0x5a4a3a},face:["glasses","mustache","labgoggles"],top:{c:0x6a7a8a,sl:"long"},pants:{c:0x4a443c},shoes:0x3a2a1e,ex:[["labcoat",0xd8d6cc],["stains_y"]],hand:"bottle"}},
 {id:"bianca",n:"Bianca Rocha",a:"16 · estudante",g:"colegio",it:"Jaqueta do colégio com bottons",
  b:{fem:1,h:.95,bulk:.92,skin:0x9a6a48,hair:{s:"long",c:0x3a2416},top:{c:0x2a4a8a,sl:"long"},pants:{c:0x2a2a30},shoes:0xe0e0e0,ex:[["stripes",0xe8e8e8],["pins"]]}},
 {id:"sato",n:"Dr. Henrique Sato",a:"45 · infectologista",g:"hospital",it:"Gravador de fita no bolso do jaleco",
  b:{skin:0xd8b48e,hair:{s:"short",c:0x111111},face:["glasses","mask"],top:{c:0x3a5a6a,sl:"long"},pants:{c:0x2a3038},shoes:0x111111,ex:[["labcoat",0xeceae2],["gloves",0x6a9ad0],["blood"],["recorder"]],lhand:"clipboard"}},
 {id:"livia",n:"Lívia Ferreira",a:"14 · irmã do Kauã",g:"hospital",it:"Pulseira de miçangas",
  b:{fem:1,h:.88,bulk:.86,skin:0x5a3826,hair:{s:"pony",c:0x111111},top:{c:0xe0e0d8,sl:"short"},pants:{c:0x2a3a5a},shoes:0xe0e0e0,ex:[["stripes",0x2a4a8a],["beads"]]}},
 {id:"diego",n:"Diego Paiva",a:"24 · técnico de enfermagem",g:"hospital",it:"Crachá do pronto-socorro",
  b:{skin:0x7a4a2e,hair:{s:"short",c:0x111111},top:{c:0x4a7a6a,sl:"short"},pants:{c:0x4a7a6a},shoes:0xd8d8d0,ex:[["badge"]]}},
 {id:"nicole",n:"Nicole Andrade",a:"20 · estudante de medicina",g:"hospital",it:"Estetoscópio cor-de-rosa",zcat:"corredor",
  b:{fem:1,skin:0xe0b898,hair:{s:"long",c:0xa8844a},top:{c:0x8a9aa8,sl:"long"},pants:{c:0x2a2d33},shoes:0xd8d8d0,ex:[["labcoat",0xe8e6e0],["stethc",0xe87aa8]]}},
 {id:"kauan",n:"Kauã Ferreira",a:"19 · motoboy",g:"nomade",it:"Capacete de moto com adesivo, preso na mochila",zcat:"corredor",
  b:{skin:0x5a3826,h:.98,bulk:.88,hair:{s:"short",c:0x111111},hat:{k:"cap",c:0x1d4a6a},top:{c:0x1e1f22,sl:"long"},pants:{c:0x4a4f58},shoes:0xe0e0e0,ex:[["hood",0x1e1f22],["backpack",0x3a5a3a],["helmetpack",0x1d1f22],["radio"]],hand:"machete"}},
 {id:"biel",n:"Gabriel “Biel” Souza",a:"17 · moleque das lajes",g:"vila",it:"Estilingue de borracha de câmara",zcat:"corredor",
  b:{skin:0x5a3420,bulk:.9,h:.97,hair:{s:"buzz",c:0x111111},top:{c:0xd8c040,sl:"tank"},pants:{c:0x3a4a6a},shoes:0x3a6a8a,hand:"slingshot"}},
 {id:"neide",n:"Pastora Neide Santos",a:"50 · pastora",g:"vila",it:"Bíblia com capa de couro gasta",
  b:{fem:1,skin:0x6a4028,hair:{s:"bun",c:0x111111},top:{c:0x6a3a5a,sl:"long"},pants:{c:0x6a3a5a,skirt:1},shoes:0x2a2220,lhand:"bible"}},
 {id:"helena",n:"Helena Vieira",a:"31 · arquiteta, com Davi (6)",g:"aurora",it:"Sinalizador laranja de carro",wide:1,
  b:{fem:1,skin:0xd8b090,hair:{s:"long",c:0x4a2e1c},top:{c:0x8a8a7a,sl:"long"},pants:{c:0x3a3a44},shoes:0x2a2a2a,hand:"flare"},
  kids:[{x:.62,h:.52,bulk:.68,skin:0xd8b090,hair:{s:"short",c:0x4a2e1c},top:{c:0x4a8ac0,sl:"short"},pants:{c:0x3a3a44},shoes:0xe0e0e0}]},
 {id:"chico",n:"Chico Maranhão",a:"39 · metalúrgico",g:"fabril",it:"Capacete amarelo de EPI",
  b:{skin:0x8a5a3a,bulk:1.06,hair:{s:"short",c:0x111111},hat:{k:"hardhat",c:0xe8c020},top:{c:0x5a5e62,sl:"long"},pants:{c:0x5a5e62},shoes:0x2a2018,ex:[["stripes",0xd8e060],["legstripes",0xd8e060]]}},
 {id:"armando",n:"Armando Kessler",a:"60 · dono da loja de armas",g:"armas",it:"Colete de caça com cartucheira",zcat:"brutamonte",
  b:{skin:0xe0b898,bulk:1.12,hair:{s:"short",c:0xe0dcd4},face:["beard_g"],top:{c:0x8a7a5a,sl:"long"},pants:{c:0x3a3a30},shoes:0x3a2a1e,ex:[["vest",0x6a6a3a],["bandolier"]]}},
 {id:"dito",n:"Seu Benedito “Dito” Alves",a:"71 · agricultor, com Trovão",g:"oeste",it:"Chapéu de palha e o cachorro Trovão",wide:1,
  b:{skin:0x6b4430,h:.95,hunch:.1,hair:{s:"bald",c:0xd8d8d0},face:["mustache_w"],hat:{k:"straw",c:0xc9b06a},top:{c:0x5a6a3a,sl:"long",plaid:0x2a3418},pants:{c:0x5a4a32},shoes:0x4a3524,ex:[["suspenders",0x3a2a1a]],back:"shotgun",dog:1}},
 {id:"ivone",n:"Ivone Moreira",a:"49 · fazendeira",g:"oeste",it:"Espingarda de dois canos remendada",
  b:{fem:1,skin:0xd0a080,hair:{s:"pony",c:0x7a6a5a},top:{c:0x7a5a3a,sl:"long",plaid:0x3a2418},pants:{c:0x34465e},shoes:0x4a3524,ex:[["dbl_front"]]}},
 {id:"tadeu",n:"Tadeu Moreira",a:"22 · filho dos Moreira",g:"oeste",it:"Lenço vermelho no pescoço",
  b:{skin:0xc89070,hair:{s:"short",c:0x5a3a22},top:{c:0x6a7a8a,sl:"short"},pants:{c:0x34465e},shoes:0x4a3524,ex:[["scarf",0xc4282a]]}},
 {id:"profeta",n:"Wesley “Profeta” Lacerda",a:"36 · líder dos Corvos",g:"serra",it:"Pena preta presa no boné",
  b:{skin:0xb07a55,bulk:1.04,hair:{s:"short",c:0x111111},face:["beard"],hat:{k:"cap",c:0x111214},top:{c:0x1e1e22,sl:"long"},pants:{c:0x1e1e22},shoes:0x111111,ex:[["vest",0x2a2a26],["feather"],["rifle_front"]]}},
 {id:"cida",n:"Dona Cida Moura",a:"74 · raizeira",g:"serra",it:"Patuá de couro no pescoço",
  b:{fem:1,h:.9,hunch:.08,skin:0x6a4028,hair:{s:"bun",c:0xe0dcd4},hat:{k:"bandana",c:0x8a5a7a},top:{c:0x5a6a4a,sl:"long"},pants:{c:0x5a6a4a,skirt:1},shoes:0x2a2220,ex:[["amulet"]]}},
 {id:"renata",n:"Cabo Renata Lobo",a:"29 · atiradora do Exército",g:"base",it:"Fuzil com fita camuflada",
  b:{fem:1,skin:0xa87050,hair:{s:"bun",c:0x111111},top:{c:0x4a5a3a,sl:"long"},pants:{c:0x4a5a3a},shoes:0x111111,ex:[["vest",0x3a4a2e],["rifle_tape"]]}},
 {id:"taina",n:"Tainá Costa",a:"23 · cozinheira, grávida",g:"igreja",it:"Lenço amarelo na cabeça e a barriga de sete meses",
  b:{fem:1,skin:0x6b4430,hair:{s:"long",c:0x1a1310},hat:{k:"bandana",c:0xe8c030},top:{c:0xc86a4a,sl:"short"},pants:{c:0x3a3a44},shoes:0x2a2220,ex:[["belly"]]}},
 {id:"lucas",n:"Lucas “Gaúcho” Kraemer",a:"33 · caminhoneiro",g:"oficina",it:"Cuia de chimarrão no cinto e boné de transportadora",
  b:{skin:0xe0b090,bulk:1.06,hair:{s:"short",c:0x8a5a2a},face:["stubble"],hat:{k:"cap",c:0xe07a20},top:{c:0x3a4a5a,sl:"short",plaid:0x1e2630},pants:{c:0x34465e},shoes:0x3a2a1e,ex:[["belt",0x3a2a1a],["cuia"]]}},
 {id:"caio",n:"Tenente Caio Albuquerque",a:"27 · 2º tenente do Exército",g:"bloqueio",it:"Boina verde-oliva e mapa topográfico no bolso",
  b:{skin:0xb98a66,hair:{s:"buzz",c:0x2a1d14},hat:{k:"beret",c:0x3e4a26},top:{c:0x4f5a3c,sl:"long",plaid:0x343d26},pants:{c:0x4f5a3c},shoes:0x1a1612,ex:[["plate",0x3a4430],["mapfold"],["rifle_front"]]}},
 {id:"ferraz",n:"Sargento Edvaldo Ferraz",a:"44 · 1º sargento do Exército",g:"bloqueio",it:"Capacete com fita laranja e binóculo no peito",zcat:"brutamonte",
  b:{skin:0x6b4430,bulk:1.1,hair:{s:"buzz",c:0x111111},face:["mustache"],hat:{k:"helmet",c:0x4a553a,tape:0xe8762a},top:{c:0x4f5a3c,sl:"long",plaid:0x343d26},pants:{c:0x4f5a3c},shoes:0x1a1612,ex:[["plate",0x3a4430],["binoc"],["rifle_front"]]}},
 {id:"vinicius",n:"Soldado Vinícius Lopes",a:"19 · recruta do Exército",g:"bloqueio",it:"Foto da mãe presa no capacete",
  b:{skin:0x8d5a3b,h:.97,bulk:.9,hair:{s:"buzz",c:0x111111},hat:{k:"helmet",c:0x4a553a,photo:1},top:{c:0x4f5a3c,sl:"long",plaid:0x343d26},pants:{c:0x4f5a3c},shoes:0x1a1612,ex:[["plate",0x3a4430],["rifle_front"]]}},
 {id:"lucia",n:"Lúcia Bento",a:"38 · policial rodoviária federal",g:"prf",it:"Colete refletivo da PRF por cima do balístico",
  b:{fem:1,skin:0xa8754f,hair:{s:"bun",c:0x2a1a10},hat:{k:"cap",c:0x1e2a4a},top:{c:0x2a3450,sl:"long"},pants:{c:0x1e2436},shoes:0x111111,ex:[["refl",0xd8e030],["belt",0x15161a],["holster"]],hand:"pump"}},
 {id:"douglas",n:"Douglas Prado",a:"29 · PRF, motociclista",g:"prf",it:"Capacete de moto branco com faixa amarela",
  b:{skin:0xc49a74,hair:{s:"buzz",c:0x2a1d14},hat:{k:"moto",c:0xeeeeea},top:{c:0x2a3450,sl:"long"},pants:{c:0x1e2436},shoes:0x111111,ex:[["motoband"],["refl",0xd8e030],["belt",0x15161a],["holster"]]}},
 {id:"josue",n:"Josué Freitas",a:"46 · policial penal",g:"penit",it:"Chaveiro grande das celas no pescoço",
  b:{skin:0x7a4c33,bulk:1.08,hair:{s:"bald",c:0x111111},face:["mustache"],top:{c:0x1e2022,sl:"short"},pants:{c:0x1e2022},shoes:0x111111,ex:[["vest",0x2a2c2e],["keyring"],["belt",0x15161a]],hand:"baton"}},
 {id:"jacare",n:"Reinaldo “Jacaré” Lima",a:"41 · preso, liderança do bloco C",g:"penit",it:"Bandana vermelha e camiseta bege da unidade",
  b:{skin:0x5a3826,bulk:1.04,hair:{s:"buzz",c:0x111111},face:["beard"],hat:{k:"bandana",c:0xc4282a},top:{c:0xc8b890,sl:"short"},pants:{c:0xa89870},shoes:0x2a2a2a}},
 {id:"lince",n:"Capitão Rodrigo Sá “Lince”",a:"36 · forças especiais",g:"falcao",it:"Capacete com visão noturna e fuzil com supressor",
  b:{skin:0xc49a74,bulk:1.06,hair:{s:"short",c:0x2a1d14},face:["beard"],hat:{k:"helmet",c:0x5a5844,nvg:1},top:{c:0x5a5844,sl:"long",plaid:0x45432f},pants:{c:0x5a5844},shoes:0x2a2218,ex:[["plate",0x6a6448],["gloves",0x2a2a24],["rifle_sup"]]}},
 {id:"paula",n:"Sargento Paula Neves",a:"32 · sargento de saúde, forças especiais",g:"falcao",it:"Bolsa médica com cruz vermelha e torniquete no ombro",
  b:{fem:1,skin:0x8d5a3b,hair:{s:"bun",c:0x111111},hat:{k:"cap",c:0x5a5844},top:{c:0x5a5844,sl:"long",plaid:0x45432f},pants:{c:0x5a5844},shoes:0x2a2218,ex:[["plate",0x6a6448],["tq"]],hand:"medbag"}},
 {id:"kevin",n:"Cabo Kevin Araújo",a:"24 · comunicações, forças especiais",g:"falcao",it:"Rádio de satélite nas costas com antena",
  b:{skin:0xa8754f,h:.97,hair:{s:"buzz",c:0x111111},top:{c:0x5a5844,sl:"long",plaid:0x45432f},pants:{c:0x5a5844},shoes:0x2a2218,ex:[["plate",0x6a6448],["satradio",0x3a3d30],["headphones",0x2a2a2a]],hand:"radio_h"}},
 {id:"azevedo",n:"Major Hélio Azevedo",a:"52 · subcomandante do 7º BIS (zumbi no bunker)",g:"base",it:"Cartão de acesso vermelho no cordão e boina de oficial",already:1,zcat:"brutamonte",
  b:{skin:0xd0a080,bulk:1.15,hair:{s:"short",c:0x8a8680},hat:{k:"beret",c:0x2e3a1e},top:{c:0x4f5a3c,sl:"long",plaid:0x343d26},pants:{c:0x4f5a3c},shoes:0x1a1612,ex:[["plate",0x3a4430],["card"]]}}
];
const byP=Object.fromEntries(PEOPLE.map(p=>[p.id,p]));
// devolve {root, chars} já posado
function buildPerson(p,zed){
  const root=new T.Group(),chars=[];
  if(p.b){const c=build(p.b,0);chars.push(c);root.add(c.root);if(zed&&!p.kid)zombify(c,p.zcat);c.z=zed&&!p.kid}
  (p.kids||[]).forEach(k=>{const c=build(k,0);c.root.position.x=k.x;c.root.rotation.y=-k.x*.4;c.z=false;chars.push(c);root.add(c.root)});
  chars.forEach(c=>pose(c,c.z,0,0));
  return {root,chars};
}
function who(id){const o=buildPerson(byP[id],false);return o.root}

/* ---------- cena de retrato ---------- */
function portraitScene(obj,wide){
  const sc=new T.Scene();sc.background=new T.Color(0x0b1018);sc.fog=new T.FogExp2(0x0b1018,.07);
  sc.add(new T.HemisphereLight(0x3a4c6a,0x0b0b0c,.75));
  const key=new T.SpotLight(0xffb070,2.4,14,.7,.6,1.4);key.position.set(1.9,3.8,2.6);key.target.position.set(0,1,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0008;sc.add(key,key.target);
  const rim=new T.DirectionalLight(0x8aa6d6,.8);rim.position.set(-2.5,2.6,-3);sc.add(rim);
  const fill=new T.PointLight(0x6fa3c7,.35,8);fill.position.set(-2,1.4,2);sc.add(fill);
  const gr=new T.Mesh(new T.CircleGeometry(4,24).rotateX(-Math.PI/2),M(0x1b1e21));gr.receiveShadow=true;sc.add(gr);
  const curb=new T.Mesh(new T.BoxGeometry(8,.15,.25),M(0x4a4842));curb.position.set(0,.075,-1.4);curb.receiveShadow=true;sc.add(curb);
  sc.add(obj);
  return sc;
}
function portraitCam(wide,asp){const c=new T.PerspectiveCamera(30,asp,.05,60);const d=wide?5.2:4.2;c.position.set(.25*d,1.3,d);c.lookAt(0,.95,0);return c}

/* ---------- maquetes das bases ---------- */
function zed(p,x,z,ry,col,lying){const r=rng(Math.abs(Math.round(x*97+z*31))+3),pk=a=>a[Math.floor(r()*a.length)];
  const sp={fem:r()<.4?1:0,skin:pk([0x8d5a3b,0xc49a74,0x6b4430,0xa8754f,0xd2a885,0x5a3826]),hair:{s:pk(["short","buzz","bald","long","pony"]),c:pk([0x111111,0x2a1d14,0x5a3a22,0x8a8680])},
    top:{c:pk([0x3a3f38,0x4a3a30,0x2f3a44,0x5a4a3a,0x5d6e7a,0x6a2a24,0x8a8478]),sl:pk(["long","short"])},pants:{c:pk([0x2a2d33,0x34465e,0x3a3328,0x4a4f58])},shoes:0x1b1714};
  const c=build(sp,0);zombify(c,null);c.eyeM.color.set(col||EYE.lento);pose(c,true,0,0);
  c.root.position.set(x,0,z);c.root.rotation.y=ry||0;if(lying){c.root.rotation.set(-Math.PI/2,0,ry||0);c.root.position.y=.12}p.add(c.root);return c.root}
function horde(p,n,cx,cz,r,seed,run){const R=rng(seed);for(let i=0;i<n;i++){const a=R()*Math.PI*2,d=Math.sqrt(R())*r;zed(p,cx+Math.cos(a)*d,cz+Math.sin(a)*d,R()*6.3,R()<(run||.15)?EYE.corredor:R()<.06?EYE.brutamonte:EYE.lento)}}
function win(p,w,h,x,y,z,ry,lit){return B(p,w,h,.06,lit?G(lit===true?0xffb45e:lit):M(0x0d1217,{metalness:.5,roughness:.3}),x,y,z,0,ry||0)}
function lamp(p,x,z,on){C(p,.08,.1,5,6,M(0x2b2d30,{metalness:.5,roughness:.6}),x,2.5,z);B(p,.4,.16,.6,on?G(0xffc98a):M(0x3a3a3a),x,4.9,z+.3);if(on){const L=new T.PointLight(0xffa25a,1.6,16,2);L.position.set(x,4.6,z+.4);p.add(L)}}
function tree(p,x,z,s){C(p,.12*s,.16*s,1.6*s,5,0x3a2a1c,x,.8*s,z);const m=new T.Mesh(new T.IcosahedronGeometry(1.1*s,0),M(0x1f3324));m.position.set(x,2.2*s,z);m.castShadow=true;p.add(m)}
function pine(p,x,z,s){C(p,.1*s,.14*s,1*s,5,0x3a2a1c,x,.5*s,z);K(p,1.1*s,2.6*s,6,0x1a2c20,x,2.1*s,z);K(p,.8*s,2*s,6,0x1f3426,x,3.1*s,z)}
function car(p,x,z,ry,col,police){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;p.add(g);B(g,1.9,.7,4.2,M(col,{roughness:.55,metalness:.35}),0,.6,0);B(g,1.7,.6,2.1,M(0x15191d,{roughness:.3,metalness:.6}),0,1.25,-.2);
  const wg=new T.CylinderGeometry(.38,.38,.3,8).rotateZ(Math.PI/2);for(const a of[-1,1])for(const b of[-1,1]){const m=new T.Mesh(wg,M(0x111111));m.position.set(a*.95,.38,b*1.35);g.add(m)}
  if(police){B(g,1.94,.42,1.6,0x0d0e10,0,.62,.2);B(g,.5,.12,.28,G(0xff2020),-.28,1.62,-.2);B(g,.5,.12,.28,G(0x2050ff),.28,1.62,-.2);const L=new T.PointLight(0xff2020,1.2,10,2);L.position.set(0,2,-.2);g.add(L)}return g}
function roofGable(p,w,d,h,col,x,y,z,ry){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=ry||0;p.add(g);const s=Math.hypot(w/2,h);const a=Math.atan2(h,w/2);B(g,s+.2,.18,d+.3,col,-w/4,h/2,0,0,0,a);B(g,s+.2,.18,d+.3,col,w/4,h/2,0,0,0,-a);
  const tri=new T.Shape();tri.moveTo(-w/2,0);tri.lineTo(w/2,0);tri.lineTo(0,h);const geo=new T.ExtrudeGeometry(tri,{depth:d,bevelEnabled:false});geo.translate(0,0,-d/2);const m=new T.Mesh(geo,M(0x5a5048));m.castShadow=true;g.add(m);return g}
function fence(p,x0,z0,x1,z1,h,col){const L=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(L/1.6));for(let i=0;i<=n;i++){const t=i/n;B(p,.1,h,.1,col,x0+(x1-x0)*t,h/2,z0+(z1-z0)*t)}const a=Math.atan2(z1-z0,x1-x0);B(p,L,.08,.05,col,(x0+x1)/2,h*.75,(z0+z1)/2,0,-a,0);B(p,L,.08,.05,col,(x0+x1)/2,h*.35,(z0+z1)/2,0,-a,0)}
function wall(p,x0,z0,x1,z1,h,col){const L=Math.hypot(x1-x0,z1-z0),a=Math.atan2(z1-z0,x1-x0);return B(p,L,h,.25,col,(x0+x1)/2,h/2,(z0+z1)/2,0,-a,0)}
function crosses(p,list){list.forEach(([x,z])=>{B(p,.6,.25,1.4,0x3a2e22,x,.12,z);B(p,.08,.9,.08,0x8a7a5a,x,.6,z-.6);B(p,.45,.08,.08,0x8a7a5a,x,.85,z-.6)})}

const BASES=[
 {id:"igreja",n:"Igreja Matriz",r:"Centro",d:"Nave com torre do sino, bancos virados de barricada na porta, covas do Seu Val atrás. O porão do Arnaldo fica embaixo da sacristia.",gr:0x1d2023,build(g){
   B(g,8,6,14,0xb8ae98,0,3,0);roofGable(g,8,14,3,0x5a3a2c,0,6,0);B(g,3.2,13,3.2,0xc0b6a0,0,6.5,8.2);K(g,2.4,3,4,0x5a3a2c,0,14.5,8.2,Math.PI/4);B(g,1.4,1.8,.1,G(0xffb45e),0,10.5,9.85);
   B(g,1.6,2.8,.1,0x1a120c,0,1.4,9.85);[[0xd84a3a,-2.5],[0x3a7ad8,2.5]].forEach(([c,x])=>{win(g,1,2,x,3.6,7.05,0,c);win(g,1,2,x,3.6,-7.05,0,c)});
   for(let i=-2;i<=2;i++){win(g,.06,1.6,-4.04,3.4,i*2.6,0,i%2?0xffb45e:false);win(g,.06,1.6,4.04,3.4,i*2.6,0,0xd8b04a)}
   for(let i=0;i<4;i++)B(g,2.4,.5,.5,0x6a4a2a,(i-1.5)*1.1,.25+(i%2)*.5,10.6,0,(i-1.5)*.3);
   crosses(g,[[-3,-10],[-1.4,-10.2],[.4,-9.8],[2,-10.1],[3.4,-10]]);tree(g,-8,4,1.1);tree(g,8,-2,1);tree(g,-8,-6,.9);lamp(g,5,11,true);
   horde(g,6,4,14,4,11);zed(g,-6,10,1.5);}},
 {id:"deleg",n:"Delegacia do 4º DP",r:"Centro",d:"Muro alto de 2,8 m, portão de ferro, viatura no pátio e vigia no telhado. A mais segura do mapa enquanto o Brasa manda.",gr:0x1d2023,build(g){
   B(g,13,4.4,8,0x7a8a94,0,2.2,-2);B(g,13.2,.5,8.2,0xe8e8e0,0,3.4,-2);B(g,13.4,.3,8.4,0x2a2c30,0,4.55,-2);for(let i=-2;i<=2;i++){win(g,1.2,1.1,i*2.4,2,2.04,0,i===0?true:false)}
   B(g,3,1,.15,0x1a3a7a,0,3.9,2.1);
   wall(g,-11,-9,11,-9,2.8,0x8a8478);wall(g,-11,-9,-11,9,2.8,0x8a8478);wall(g,11,-9,11,9,2.8,0x8a8478);wall(g,-11,9,-2.5,9,2.8,0x8a8478);wall(g,2.5,9,11,9,2.8,0x8a8478);
   for(let i=-2;i<=2;i++)B(g,.1,2.6,.1,M(0x2a2c30,{metalness:.6}),i*.9,1.3,9);B(g,5,.12,.12,M(0x2a2c30,{metalness:.6}),0,2.5,9);
   car(g,-5,4,.3,0xe8e8e4,true);for(let i=0;i<8;i++)B(g,.55,.22,.32,0x8a7a5a,-3+i*.55,.11+(i%2)*.2,7.5);
   const v=who("bigode");v.position.set(4,4.7,0);g.add(v);
   lamp(g,-9,11,true);lamp(g,9,11,false);horde(g,7,0,13,4.5,22);zed(g,6,12,0,0,true);zed(g,-4,12.5,1,0,true);}},
 {id:"radio",n:"Rádio Vale FM",r:"Morro da antena",d:"Torre treliçada de 18 m no topo do morro, casinha do estúdio e o gerador barulhento. Ao pé do morro, a horda que a Jéssica não contou para ninguém.",gr:0x18201a,build(g){
   const hill=new T.Mesh(new T.CylinderGeometry(6,15,5,7),M(0x2a3424));hill.position.y=2.5;hill.castShadow=hill.receiveShadow=true;g.add(hill);
   for(let i=0;i<9;i++){const y=5+i*2;const c=i%2?0xd8d8d0:0xc4282a;for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]])B(g,.12,2,.12,c,a*(1-i*.08),y+1,b*(1-i*.08));B(g,2*(1-i*.08),.08,.08,c,0,y+1,1-i*.08,0,0,.6);B(g,.08,.08,2*(1-i*.08),c,1-i*.08,y+1,0,.6)}
   B(g,.25,.25,.25,G(0xff2020),0,23.2,0);const L=new T.PointLight(0xff3020,1.5,10,2);L.position.set(0,23.5,0);g.add(L);
   B(g,5,3,4,0x9a9484,-3.5,6.5,2);B(g,5.4,.3,4.4,0x3a3a3a,-3.5,8.1,2);win(g,1.4,1,-3.5,6.8,4.04,0,true);
   B(g,1.6,1.1,1,0x5a6a3a,3,5.55,2.6);C(g,.08,.08,1.2,6,0x2a2a2a,3.5,6.6,2.6);
   lamp(g,-1,4,true);horde(g,26,8,9,4.5,33,.12);horde(g,6,-10,6,3,34);}},
 {id:"oficina",n:"Auto Center Tavares",r:"Saída sul",d:"Galpão com chapas soldadas nas janelas, armadilhas de vergalhão no pátio e o ônibus blindado pela metade. O diesel está escondido no fosso de troca de óleo.",gr:0x1d2023,build(g){
   B(g,14,6,10,0x6a6e70,0,3,-3);B(g,14.4,.3,10.4,0x3a3d40,0,6.1,-3,0,0,.05);B(g,14.2,.9,.2,0x2c4a7a,0,5.2,2.1);
   for(let i=-2;i<=2;i++)B(g,1.8,1.4,.12,M(0x7a7e82,{metalness:.6,roughness:.4}),i*2.7,2.6,2.08,0,0,(i%2)*.1);
   B(g,4,4,.1,M(0x4a4e52,{metalness:.5}),-4.5,2,2.1);
   const bus=new T.Group();bus.position.set(3,0,6);bus.rotation.y=Math.PI/2+.1;g.add(bus);B(bus,2.6,2.8,10,0xd8b040,0,1.9,0);B(bus,2.62,.8,10,0x1a1c1e,0,2.6,0);
   for(let i=0;i<5;i++)B(bus,2.7,.9,1.8,M(0x8a8e92,{metalness:.6,roughness:.4}),0,2.6,-4+i*1.9,0,0,0);B(bus,2.7,.6,.15,M(0x6a6e72,{metalness:.6}),0,1.2,5.05);
   const wg=new T.CylinderGeometry(.55,.55,.4,8).rotateZ(Math.PI/2);for(const a of[-1,1])for(const b of[-3.4,3.4]){const m=new T.Mesh(wg,M(0x111));m.position.set(a*1.3,.55,b);bus.add(m)}
   for(let i=0;i<14;i++)K(g,.08,.7,4,M(0x6a5a4a,{metalness:.5}),-8+i*1.2,.35,10+(i%2)*.6);
   for(let i=0;i<3;i++)C(g,.4,.4,1,10,0x9b1c18,-6+i*.9,.5,-9);
   lamp(g,7,9,true);horde(g,5,-2,13,3,44);zed(g,-8,12,0,0,true);}},
 {id:"colegio",n:"Colégio Estadual",r:"Vila Esperança",d:"Prédio de dois andares com o laboratório aceso no segundo. A quadra coberta ao lado virou horda. Na caixa d'água fica a antena para onde a rádio pode mudar.",gr:0x1d2023,build(g){
   B(g,18,7,8,0xd8c8a0,-2,3.5,-4);B(g,18.2,.3,8.2,0x3a3a3a,-2,7.1,-4);B(g,18.1,.4,8.1,0x2a4a8a,-2,3.6,-4);
   for(let f=0;f<2;f++)for(let i=0;i<7;i++)win(g,1.6,1.3,-10+i*2.6,1.9+f*3.4,.04,0,f===1&&i===5?0xb8ffd0:false);
   C(g,1.2,1.2,2.2,10,0x7a8a94,4,8.4,-6);C(g,.05,.05,3,4,0x9a9a9a,4,11,-6);
   for(const x of[-9,-1,7])for(const z of[5,13])C(g,.15,.15,5,6,0x5a5e62,x,2.5,z);const rf=B(g,18,.3,9.5,0x6a6e72,-1,5.2,9,0,0,0);
   B(g,14,.05,7,0x3a5a7a,-1,.03,9);horde(g,14,-1,9,4,55,.25);
   lamp(g,10,2,true);tree(g,10,-8,1);}},
 {id:"hospital",n:"Hospital Regional",r:"Centro",d:"Bloco principal com heliponto, ala isolada acesa onde o Dr. Sato trabalha e fita de quarentena no corredor. Maior concentração de corredores do mapa.",gr:0x1d2023,build(g){
   B(g,20,12,10,0xc8ccc4,-2,6,-4);B(g,20.3,.4,10.3,0x4a4e52,-2,12.2,-4);B(g,8,6,8,0xb8bcb4,10,3,-3);
   for(let f=0;f<3;f++)for(let i=0;i<7;i++)win(g,1.6,1.4,-10+i*2.7,2.4+f*3.4,1.04,0,(f===1&&i>4)?0xcfe6ff:false);
   B(g,1.8,.5,.1,G(0xd8262a),-2,10.5,1.06);B(g,.5,1.8,.1,G(0xd8262a),-2,10.5,1.06);
   C(g,3.2,3.2,.1,16,0x2a2c30,-2,12.45,-4);B(g,.3,.02,2,0xe8e8e0,-2.7,12.52,-4);B(g,.3,.02,2,0xe8e8e0,-1.3,12.52,-4);B(g,1.2,.02,.3,0xe8e8e0,-2,12.52,-4);
   const amb=car(g,6,5,.4,0xf0f0ea);B(amb,1.95,.2,4.25,G(0xd8262a),0,.95,0);
   for(let i=0;i<5;i++)B(g,2,.05,.05,0xe8d020,10-i*.1,1+i*.25,1.05);
   lamp(g,-12,4,true);horde(g,12,0,7,6,66,.35);}},
 {id:"vila",n:"Igreja da Vila",r:"Vila Esperança",d:"Igreja evangélica pequena entre casas de laje empilhadas, caixas d'água azuis e varais. O Biel atravessa tudo isso sem pisar no chão.",gr:0x221d1a,build(g){
   const R=rng(7);const bricks=[0x8a4a32,0x9a5a3a,0xb8a890,0x7a4a3a,0xc8b8a0,0x6a7a8a];
   for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){if(Math.abs(i)<=1&&Math.abs(j)<=1)continue;const fl=1+Math.floor(R()*3);const w=2.6+R()*.8,x=i*3.4+(R()-.5),z=j*3.4+(R()-.5);
     for(let f=0;f<fl;f++){B(g,w,2.6,w,bricks[Math.floor(R()*6)],x,1.3+f*2.6,z);if(R()<.4)win(g,.7,.7,x,1.5+f*2.6,z+w/2+.04,0,R()<.3?true:false)}
     if(R()<.5)C(g,.5,.5,.8,8,0x2a6ab0,x+.5,fl*2.6+.4,z);if(R()<.3)B(g,.2,1,w,0x5a5a5a,x+w/2,fl*2.6+.5,z)}
   B(g,6,5,8,0xe8e0d0,0,2.5,0);roofGable(g,6,8,2,0x6a5a4a,0,5,0);B(g,.2,1.6,.2,G(0xffe0a0),0,7.8,3.5);B(g,.9,.2,.2,G(0xffe0a0),0,8.1,3.5);B(g,1.4,2.4,.1,0x1a120c,0,1.2,4.05);
   win(g,1,1.4,-1.8,3,4.04,0,true);win(g,1,1.4,1.8,3,4.04,0,true);const L=new T.PointLight(0xffd08a,1.2,10,2);L.position.set(0,3,6);g.add(L);
   const b=who("biel");b.position.set(6.8,7.8,-6.8);b.rotation.y=2.4;g.add(b);
   for(let i=0;i<6;i++)B(g,.4,.5,.02,[0xd84a3a,0x4aa0e0,0xf2d046][i%3],-8+i*.5,5.6,3.2);
   horde(g,4,0,11,2.5,77);}},
 {id:"aurora",n:"Sobrado da rua das Acácias",r:"Jardim Aurora",d:"Sobrado com muro de 1,8 m e garagem, na área de início. A luz de cima é a Helena chamando no rádio. Um zumbi da família vizinha ronda o quintal.",gr:0x1b221c,build(g){
   B(g,7,6,7,0xd8d0b8,0,3,-1);roofGable(g,7.4,7.4,2.2,0x8a3a2a,0,6,-1);B(g,3.4,3,5,0xc8c0a8,5.2,1.5,-.2);B(g,3,2.6,.08,M(0x6a6e72,{metalness:.5}),5.2,1.3,2.33);
   win(g,1.4,1.2,-1.5,4.4,2.54,0,true);win(g,1.4,1.2,1.5,4.4,2.54,0,false);win(g,1.4,1.2,-1.5,1.6,2.54,0,false);B(g,1.1,2.2,.08,0x3a2a1c,1.5,1.1,2.54);
   const L=new T.PointLight(0xffb06a,1.4,8,2);L.position.set(-1.5,4.4,3.5);g.add(L);
   wall(g,-6,6,-1,6,1.8,0xb8b0a0);wall(g,1,6,8,6,1.8,0xb8b0a0);wall(g,-6,6,-6,-7,1.8,0xb8b0a0);wall(g,8,6,8,-7,1.8,0xb8b0a0);
   B(g,8,5,7,0xc0c8b8,-14,2.5,-1);roofGable(g,8.4,7.4,2,0x6a4a3a,-14,5,-1);B(g,7,4,7,0xb8b0a0,14,2,-1);
   car(g,5.2,-.5,0,0x2d3d4a);zed(g,-3,4,.5);zed(g,2,9,2.6);zed(g,-8,10,1);tree(g,-4,-6,.9);lamp(g,0,10,true);
   B(g,12,.02,4,0x24262a,0,.01,10);}},
 {id:"fabril",n:"Depósito de combustível",r:"Distrito Fabril",d:"Três tanques, a guarita do Chico e o galpão vizinho com a linha de produção que nunca parou. O barulho segura os zumbis longe da porta, até o dia em que não segura mais.",gr:0x1d2023,build(g){
   for(let i=0;i<3;i++){C(g,2.4,2.4,5,14,0xc8c4b8,-7+i*5.2,2.5,-5);C(g,2.45,2.45,.3,14,0x8a5a3a,-7+i*5.2,3.6,-5);C(g,2.2,2.4,.4,14,0xb8b4a8,-7+i*5.2,5.1,-5)}
   B(g,14,7,10,0x5a5e62,6,3.5,6);B(g,14.4,.3,10.4,0x3a3d40,6,7.1,6);B(g,5,5,.1,M(0x7a7e82,{metalness:.5}),6,2.5,.95);for(let i=0;i<5;i++)B(g,5,.08,.12,0x4a4e52,6,.5+i*1,.95);
   win(g,3,1,2,5.5,.95,0,0xff9a3a);const L=new T.PointLight(0xff8a2a,1.6,12,2);L.position.set(2,5,-.5);g.add(L);
   B(g,2.4,2.6,2.4,0x8a8478,-8,1.3,4);win(g,1,.8,-8,1.6,5.24,0,true);B(g,2.6,.15,2.6,0x3a3a3a,-8,2.7,4);
   fence(g,-12,10,12,10,2.2,M(0x5a5e62,{metalness:.6}));for(let i=0;i<4;i++)C(g,.4,.4,1,10,0x2a5a3a,-3+i*.9,.5,1);
   horde(g,8,8,13,3.5,88);}},
 {id:"armas",n:"Kessler Armas e Caça",r:"Centro",d:"Loja de armas entre duas fachadas de aço baixadas. Porta de ferro meio aberta com seteira, cartuchos no chão e os corpos da multidão do segundo dia na calçada.",gr:0x1d2023,build(g){
   B(g,8,5,8,0x5a4a44,0,2.5,-3);B(g,8.2,1,.2,0x4a1a1a,0,4.2,1.1);B(g,6,1.6,.1,M(0x6a6e72,{metalness:.6}),0,3,1.06);B(g,6,.4,.12,0x1a1a1a,0,1.6,1.06);B(g,.6,.15,.12,G(0xffb45e),1.8,2,1.07);
   B(g,8,9,8,0x3b3f45,-8.2,4.5,-3);B(g,8,7,8,0x463a3a,8.2,3.5,-3);for(const x of[-8.2,8.2])B(g,5,3,.1,M(0x5a5e62,{metalness:.6}),x,1.5,1.06);
   for(let i=0;i<6;i++)zed(g,-3+i*1.3,3+(i%2)*1.2,i,0,true);
   const R=rng(9);for(let i=0;i<40;i++)B(g,.04,.04,.1,M(0xd0a23a,{metalness:.8}),(R()-.5)*7,.03,1.6+R()*3,0,R()*3,0);
   const a=who("armando");a.position.set(0,0,-.2);g.add(a);
   B(g,30,.02,6,0x24262a,0,.01,8);lamp(g,4,6,true);horde(g,6,-3,10,3,99);}},
 {id:"oeste",n:"Sítios do Oeste",r:"Sítios do Oeste",d:"Casa sede do Dito com varanda, celeiro, silo e o pomar com as cruzes da família. Trovão solto no terreiro. A fazenda dos Moreira aparece ao fundo, na estrada.",gr:0x1a2416,build(g){
   B(g,8,3.2,6,0xd8ccb0,-4,1.6,-2);roofGable(g,9,7,2,0x8a4a2a,-4,3.2,-2);B(g,8,.2,2.4,0x6a4a2a,-4,2.9,2.2);for(let i=0;i<4;i++)C(g,.1,.1,2.8,5,0x6a4a2a,-7.5+i*2.4,1.4,3.3);win(g,1,1,-2,1.6,1.04,0,true);
   B(g,6,4.5,7,0x8a2a22,6,2.25,-4);roofGable(g,6.4,7.4,2,0x3a3a3a,6,4.5,-4);B(g,2.4,3,.1,0x3a2216,6,1.5,-.44);
   C(g,1.8,1.8,8,10,0xb8b8b0,10.5,4,2);K(g,2,1.6,10,0x8a8e92,10.5,8.8,2);
   fence(g,-12,8,12,8,1.2,0x6a4a2a);fence(g,-12,-10,-12,8,1.2,0x6a4a2a);
   for(let i=0;i<6;i++)tree(g,-10+(i%3)*2.4,-8+Math.floor(i/3)*2.6,.7);crosses(g,[[-9,-4.5],[-7.5,-4.5],[-6,-4.5]]);
   const d=who("dito");d.position.set(-4,0,4.2);g.add(d);
   for(let i=0;i<7;i++)B(g,22,.25,.6,0x2a3a1e,0,.12,10+i*1.1);B(g,5,3,4,0xc8b8a0,-14,1.5,-14);
   zed(g,12,12,3.6);zed(g,-13,13,.6);}},
 {id:"serra",n:"Serra do Corvo",r:"Serra do Corvo",d:"Acampamento dos Corvos com lonas, fogueira e vigia entre os pinheiros. Mais acima, perto da cachoeira, a cabana da Dona Cida. Neblina o tempo todo.",gr:0x16201a,fog:.02,build(g){
   const R=rng(12);for(let i=0;i<34;i++){const x=(R()-.5)*30,z=(R()-.5)*30;if(Math.hypot(x+2,z-2)<6||Math.hypot(x-8,z+8)<4)continue;pine(g,x,z,.8+R()*.6)}
   for(let i=0;i<4;i++){const a=i/4*Math.PI*2;const t=new T.Group();t.position.set(-2+Math.cos(a)*4,0,2+Math.sin(a)*4);t.rotation.y=-a;g.add(t);B(t,2.6,.08,3,0x2a2a26,-.65,1,0,0,0,.8);B(t,2.6,.08,3,0x2a2a26,.65,1,0,0,0,-.8)}
   for(let i=0;i<6;i++){const a=i/6*Math.PI*2;B(g,.3,.2,.3,0x4a4a46,-2+Math.cos(a)*.6,.1,2+Math.sin(a)*.6)}
   for(let i=0;i<4;i++)K(g,.18,.7,5,G(i%2?0xffd27a:0xff8a2a),-2+(i-1.5)*.15,.45,2);const F=new T.PointLight(0xff7a2a,2.6,14,2);F.position.set(-2,1.2,2);g.add(F);
   const p=who("profeta");p.position.set(-2,0,-1);p.rotation.y=Math.PI;g.add(p);
   B(g,3.4,2.4,3,0x6a4a2a,8,1.2,-8);roofGable(g,3.8,3.4,1.2,0x4a3a2a,8,2.4,-8);win(g,.6,.6,8,1.4,-6.46,0,true);
   const rock=new T.Mesh(new T.DodecahedronGeometry(4,0),M(0x4a4e4a));rock.position.set(12,2,-12);rock.castShadow=true;g.add(rock);B(g,1.4,5,.3,M(0x8ab8d8,{transparent:true,opacity:.6}),10,2.5,-9.5);
   zed(g,12,8,4);zed(g,-12,-10,1);}},
 {id:"base",n:"Torre de vigia do 7º BIS",r:"Base 7º BIS",d:"A torre onde a Cabo Renata resiste, cercada por concertina e por milhares de zumbis fardados. As tendas de triagem LIMPO e MORDIDO estão cheias deles.",gr:0x1d211c,build(g){
   for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]])B(g,.3,10,.3,0x5a5a4a,a*1.4,5,b*1.4);for(let i=1;i<5;i++){B(g,3,.12,.12,0x5a5a4a,0,i*2,1.4,0,0,.5);B(g,3,.12,.12,0x5a5a4a,0,i*2,-1.4,0,0,-.5)}
   B(g,4.4,.3,4.4,0x4a4a3a,0,10.1,0);B(g,4.4,1.1,.12,0x3a4a2e,0,10.8,2.2);B(g,4.4,1.1,.12,0x3a4a2e,0,10.8,-2.2);B(g,.12,1.1,4.4,0x3a4a2e,2.2,10.8,0);B(g,.12,1.1,4.4,0x3a4a2e,-2.2,10.8,0);roofGable(g,4.8,4.8,1.2,0x2a3a22,0,12.2,0);
   const r=who("renata");r.position.set(0,10.25,1.2);g.add(r);
   const S=new T.SpotLight(0xe6eeff,3,40,.25,.5,1.2);S.position.set(1.8,11.5,1.8);S.target.position.set(9,0,9);g.add(S,S.target);
   for(let i=0;i<24;i++){const a=i/24*Math.PI*2;TR(g,.45,.03,M(0x9aa0a6,{metalness:.8,roughness:.3}),Math.cos(a)*6,.5,Math.sin(a)*6,0,-a,0)}
   [["LIMPO",0x6a8a5a,-9],["MORDIDO",0x8a3a32,9]].forEach(([t,c,x])=>{const tt=new T.Group();tt.position.set(x,0,-9);g.add(tt);B(tt,5,.1,5,c,-1.3,1.4,0,0,0,.7);B(tt,5,.1,5,c,1.3,1.4,0,0,0,-.7)});
   const tr=car(g,10,6,1.1,0x3a4a2e);
   horde(g,46,0,0,14,121,.1);}},
 {id:"bloqueio",n:"Bloqueio Norte",r:"Estrada do Quartel",d:"Contêineres e concertina atravessando a estrada norte, duas torres de andaime, sacos de areia e o jipe do pelotão. O sargento vigia do alto; o tenente fica na barreira. À frente, quem tentou passar.",gr:0x1c1f1b,build(g){
   B(g,7,.05,34,0x2a2c2e,0,.03,0);for(let i=-8;i<=8;i++)B(g,.18,.06,1.2,0xd8d0a0,0,.06,i*2);
   [[-6,0x6a3a2a],[-2.6,0x2e4a6a],[2.6,0x5a6a3a],[6,0x8a6a2a]].forEach(([x,c])=>{B(g,3.2,2.6,2.4,c,x,1.3,0);for(let k=-1;k<=1;k++)B(g,.06,2.4,2.42,M(new T.Color(c).multiplyScalar(.7).getHex()),x+k*1,1.3,0)});
   B(g,2.6,1.6,2.4,0x5a6a3a,-2.6,3.4,0);
   for(let i=0;i<20;i++){const x=-11+i*1.15;TR(g,.45,.03,M(0x9aa0a6,{metalness:.8,roughness:.3}),x,.5,2.4,0,0,0)}
   for(const tx of[-9.5,9.5]){for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]])B(g,.15,6,.15,0x7a7a72,tx+a*1,3,-3+b*1);for(let h=1;h<4;h++)B(g,2.2,.08,.08,0x9a5a2a,tx,h*1.6,-2,0,0,.6);B(g,2.4,.2,2.4,0x6a5a3a,tx,6.1,-3);B(g,2.4,.7,.1,0x5a6a3a,tx,6.55,-1.8)}
   for(let i=0;i<10;i++)B(g,.8,.35,.45,0x8a7a5a,-1.6+(i%5)*.8,.18+Math.floor(i/5)*.35,-3.4);
   const f=who("ferraz");f.position.set(-9.5,6.2,-2.6);g.add(f);const c=who("caio");c.position.set(.6,0,-3.9);c.rotation.y=Math.PI;g.add(c);const v=who("vinicius");v.position.set(9.5,6.2,-2.6);g.add(v);
   const j=car(g,4.5,-7,.2,0x3e4a2e);B(j,1.8,.08,1.8,0x2e3a22,0,1.62,-.4);
   const S=new T.SpotLight(0xe6eeff,2.6,36,.3,.5,1.2);S.position.set(-9.5,7,-2);S.target.position.set(-2,0,10);g.add(S,S.target);lamp(g,-4,-9,true);
   zed(g,-1.5,7,.4,EYE.lento,true);zed(g,2,9.5,2,EYE.lento,true);zed(g,.5,12,1,EYE.corredor);zed(g,-3,13,2.6);car(g,-2,10.5,2.6,0x6a6a66);}},
 {id:"prf",n:"Posto da PRF",r:"BR-Sul, saída sul de Santa Aurora",d:"O posto baixo com a faixa azul e amarela, a cobertura onde a Lúcia recebe quem chega, o pátio cercado com carros parados e a moto do Douglas pronta para a ronda.",gr:0x1d2023,build(g){
   B(g,34,.05,7,0x2a2c2e,0,.03,9);for(let i=-8;i<=8;i++)B(g,1.2,.06,.18,0xd8d0a0,i*2,.06,9);
   B(g,10,3.2,5,0xd8d6cc,-3,1.6,-4);B(g,10.1,.5,5.1,0x2a4aa8,-3,2.6,-4);B(g,10.1,.2,5.1,0xe0c020,-3,2.25,-4);B(g,10.4,.25,5.4,0x2a2c30,-3,3.3,-4);
   for(let i=-1;i<=1;i++)win(g,1.4,1,-3+i*3,1.6,-1.47,0,i===0?true:false);B(g,1.2,2.2,.1,0x1a2030,1,1.1,-1.46);
   B(g,8,.25,5,0xe8e8e0,-3,4.2,2);for(const x of[-6.5,.5])C(g,.15,.15,4.1,8,0xb8b8b0,x,2.05,3.8);
   const L=who("lucia");L.position.set(-2,0,2.5);L.rotation.y=.3;g.add(L);const D=who("douglas");D.position.set(4.2,0,3.4);D.rotation.y=-.5;g.add(D);
   car(g,-6,3,1.57,0xe8e8e4,true);
   {const m=new T.Group();m.position.set(5.5,0,2.4);m.rotation.y=.2;g.add(m);const wg=new T.CylinderGeometry(.34,.34,.14,10).rotateZ(Math.PI/2);for(const z of[-.7,.7]){const w=new T.Mesh(wg,M(0x111111));w.position.set(0,.34,z);m.add(w)}B(m,.3,.4,1.3,0xeeeeea,0,.72,0);B(m,.32,.1,.5,0xe0c020,0,.95,.35);B(m,.5,.06,.06,0x2a2a2a,0,1.05,.6)}
   fence(g,2,-9,12,-9,2,0x6a6a66);fence(g,12,-9,12,1,2,0x6a6a66);fence(g,2,-9,2,-3,2,0x6a6a66);
   car(g,5,-6,0,0x8a2a24);car(g,9,-6,.1,0x4a5a6a);car(g,7,-1.5,1.4,0xc8c4b8);
   B(g,6,.12,.4,0xd8d0a0,-1,.07,6.8);for(let i=0;i<6;i++)K(g,.18,.5,6,0xe8662a,-3.5+i*1.1,.25,6.2);
   lamp(g,-9,6,true);lamp(g,9,6,false);zed(g,13,10,4.4);zed(g,15,8,4,EYE.corredor);zed(g,-14,11,1.4);}},
 {id:"penit",n:"Penitenciária, bloco C",r:"Estrada da Penitenciária",d:"Muralha com guaritas, o pátio ainda cheio de zumbis da tropa de choque com escudo e capacete, a horta dos presos e o portão do bloco C, onde o Josué e o Jacaré dividem a comida.",gr:0x1b1d1f,build(g){
   const wc=0x9a968a;wall(g,-14,-14,14,-14,5,wc);wall(g,-14,14,14,14,5,wc);wall(g,-14,-14,-14,14,5,wc);wall(g,14,-14,14,14,5,wc);
   for(const[x,z]of[[-14,-14],[14,-14],[-14,14],[14,14]]){B(g,2.4,7,2.4,0x8a867a,x,3.5,z);B(g,3,1.4,3,0x6a665a,x,7.6,z);win(g,2.2,.6,x,7.7,z+1.52,0,true);B(g,3.4,.25,3.4,0x3a3a36,x,8.4,z)}
   B(g,16,6,6,0xb0aa9a,0,3,-8);for(let i=-3;i<=3;i++){win(g,.8,.5,i*2.1,4.6,-4.96,0,false);win(g,.8,.5,i*2.1,2.2,-4.96,0,i===0?true:false)}for(let i=-3;i<=3;i++)B(g,.06,.6,.05,0x2a2c30,i*2.1,4.6,-4.92);
   B(g,2.4,2.8,.2,M(0x2a2c30,{metalness:.6}),0,1.4,-4.9);
   for(let i=0;i<3;i++){B(g,1.6,.3,4,0x4a3a2a,-10+i*2.2,.15,-1);for(let k=0;k<5;k++)K(g,.18,.4,5,0x3a6a2a,-10+i*2.2,.5,-2.6+k*.8)}
   const J=who("josue");J.position.set(-1.2,0,-3.8);g.add(J);const R=who("jacare");R.position.set(1.2,0,-3.8);R.rotation.y=-.3;g.add(R);
   const rr=rng(9);for(let i=0;i<9;i++){const x=-6+rr()*16,z=1+rr()*11,ry=rr()*6.3;const zz=zed(g,x,z,ry,rr()<.2?EYE.brutamonte:EYE.lento);const sh=new T.Group();sh.position.set(x,0,z);sh.rotation.y=ry;g.add(sh);B(sh,.6,1,.05,M(0x9ac0d8,{transparent:true,opacity:.55,roughness:.2}),.25,1,.35);B(sh,.42,.3,.4,0x1a1a1a,0,1.95,0)}
   B(g,3.4,4,.3,M(0x2a2c30,{metalness:.6}),0,2,14);lamp(g,-4,12,true);car(g,10,18,.3,0x2a2c30);horde(g,5,0,19,3,31);}},
 {id:"falcao",n:"Esconderijo da Equipe Falcão",r:"Edifício-garagem ao lado do hospital",d:"Quatro andares de laje aberta com carros esquecidos, a antena do rádio de satélite no topo e o capitão de visão noturna olhando a ala isolada do outro lado da rua.",gr:0x1d2023,build(g){
   const fl=[0,3,6,9,12];fl.forEach((y,i)=>{B(g,16,.4,12,0x8a8a84,0,y+.2,0);if(i<4)for(const x of[-7.5,-2.5,2.5,7.5])for(const z of[-5.5,5.5])B(g,.5,2.6,.5,0x7a7a74,x,y+1.7,z);if(i>0)B(g,16,.9,.15,0x8a8a84,0,y+.85,6)});
   B(g,3,12.4,.2,0x6a6a64,9,6.2,-3,0,0,.25);
   [[-5,3.4,-2,0x8a2a24],[4,3.4,2,0x4a5a6a],[-3,6.4,2.2,0xc8c4b8],[5,9.4,-2,0x2a3a5a]].forEach(([x,y,z,c])=>{const k=car(g,x,y-3,0,c);k.position.y=y});
   B(g,.12,4,.12,0x2a2a2a,5,14.4,-3);for(let i=0;i<3;i++)B(g,1.2-i*.3,.04,.04,0x2a2a2a,5,13.4+i*1.2,-3);
   const l=who("lince");l.position.set(-2,12.4,4.6);g.add(l);const k=who("kevin");k.position.set(4,12.4,-2.2);k.rotation.y=.8;g.add(k);const p=who("paula");p.position.set(-4,9.4,-1);p.rotation.y=-.6;g.add(p);
   B(g,6,9,5,0x8fc9c0,-4,4.5,-14);for(let r=0;r<3;r++)for(let c=-1;c<=1;c++)win(g,1.2,1,-4+c*2,2+r*2.8,-11.46,0,r===1&&c===0?0xe8f0ff:false);
   lamp(g,10,8,false);horde(g,8,-6,10,4,57,.2);zed(g,9,-9,1);}}
];

/* ---------- cena de maquete ---------- */
function dioramaScene(b){
  const sc=new T.Scene();sc.background=new T.Color(0x0b1018);sc.fog=new T.FogExp2(0x0b1018,b.fog||.014);
  sc.add(new T.HemisphereLight(0x4a5c7a,0x111214,1.05));
  const moon=new T.DirectionalLight(0x9ab6e6,.85);moon.position.set(-22,40,-14);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:110});moon.shadow.bias=-.0008;sc.add(moon);
  const gr=new T.Mesh(new T.BoxGeometry(34,.6,34),M(b.gr||0x1d2023));gr.position.y=-.3;gr.receiveShadow=true;sc.add(gr);
  const edge=new T.Mesh(new T.BoxGeometry(34.4,.2,34.4),M(0x0d1012));edge.position.y=-.62;sc.add(edge);
  const g=new T.Group();sc.add(g);b.build(g);return sc;
}
function dioCam(asp,yaw,dist){const c=new T.PerspectiveCamera(32,asp,.5,200);const d=dist||46;c.position.set(Math.sin(yaw)*d,d*.62,Math.cos(yaw)*d);c.lookAt(0,2.5,0);return c}

/* ---------- renderizador de miniaturas ---------- */
const off=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
off.shadowMap.enabled=true;off.shadowMap.type=T.PCFSoftShadowMap;off.setPixelRatio(1);
function snap(sc,cam,w,h){off.setSize(w,h,false);off.render(sc,cam);const cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(off.domElement,0,0);return cv}
function dispose(sc){sc.traverse(o=>{if(o.geometry&&!Object.values(gc).includes(o.geometry))o.geometry.dispose()})}

/* ---------- visualizador ---------- */
function Viewer(canvas,mode){
  const r=new T.WebGLRenderer({canvas,antialias:true});r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
  let sc=null,cam=null,obj=null,yaw=mode==="dio"?.75:0,drag=null,auto=!reduce,visible=true,dirty=true,cur=null;
  function size(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;r.setSize(w,h,false);if(cam){cam.aspect=w/h;cam.updateProjectionMatrix()}dirty=true}
  function set(s,c,o,wide){if(sc)dispose(sc);sc=s;cam=c;obj=o;cur={wide};size();dirty=true}
  canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:yaw};auto=false;canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw=drag.y+(e.clientX-drag.x)*.01;dirty=true});
  canvas.addEventListener("pointerup",()=>drag=null);canvas.addEventListener("pointercancel",()=>drag=null);
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(canvas);
  let last=performance.now();
  function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;
    if(visible&&sc){if(auto){yaw+=dt*.35;dirty=true}if(api.anim&&mode!=="dio"){api.anim(t/1000);dirty=true}
      if(dirty){if(mode==="dio"){const d=56;cam.position.set(Math.sin(yaw)*d,d*.62,Math.cos(yaw)*d);cam.lookAt(0,2.5,0)}else{obj.rotation.y=yaw}r.render(sc,cam);dirty=false}}
    requestAnimationFrame(loop)}
  requestAnimationFrame(loop);
  const api={anim:null,set,resetYaw(){yaw=mode==="dio"?.75:0;auto=!reduce}};
  return api;
}

/* ---------- sobreviventes ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PV=Viewer($("#pv"),"por");
let selP=PEOPLE[0],zedOn=false,walkOn=!reduce;
function showPerson(p,z){selP=p;zedOn=z;
  const P=buildPerson(p,z),o=P.root;const sc=portraitScene(o,p.wide);PV.anim=t=>P.chars.forEach(c=>pose(c,c.z,walkOn?1:0,t));const c=portraitCam(p.wide,4/3);c.position.x*=.6;c.position.multiplyScalar(1.42);c.position.y=1.35;c.lookAt(0,1.0,0);
  PV.set(sc,c,o,p.wide);PV.resetYaw();
  const kidNote=p.kid?"<p class=\"note\">Crianças nunca viram zumbi nomeado. Se morrem, morrem fora da tela e o jogador encontra o túmulo.</p>":"";
  const cat=p.zcat||"lento";const catN={lento:"Lento",corredor:"Corredor",brutamonte:"Brutamonte"}[cat];
  $("#pinfo").innerHTML=`<span class="meta" style="display:flex;gap:6px;align-items:center"><span class="dot" style="background:${GC[p.g]}"></span>${esc(p.a)}</span>
   <h3>${esc(p.n)}</h3>
   <div><span class="lbl">Item marcado</span><p>${esc(p.it)}</p></div>
   ${p.kid?"":`<div><span class="lbl">Como zumbi nomeado</span><p>${p.id==="arnaldo"?"Já é zumbi no começo do jogo. A aba Vivo mostra como ele era antes da mordida.":"Reanima como "+catN+": olhos "+({lento:"amarelos",corredor:"vermelhos",brutamonte:"laranja"}[cat])+", com o mesmo item."}</p></div>`}
   <div class="seg" role="group" aria-label="Estado"><button type="button" id="vA" aria-pressed="${!z}">Vivo</button><button type="button" id="vZ" class="z" aria-pressed="${z}" ${p.kid?"disabled":""}>Zumbi nomeado</button></div>
   <div class="seg" role="group" aria-label="Movimento"><button type="button" id="mW" aria-pressed="${walkOn}">Andando</button><button type="button" id="mS" aria-pressed="${!walkOn}">Parado</button></div>${kidNote}`;
  $("#mW").onclick=()=>{walkOn=true;$("#mW").setAttribute("aria-pressed",true);$("#mS").setAttribute("aria-pressed",false)};
  $("#mS").onclick=()=>{walkOn=false;$("#mW").setAttribute("aria-pressed",false);$("#mS").setAttribute("aria-pressed",true)};
  $("#vA").onclick=()=>showPerson(p,false);if(!p.kid)$("#vZ").onclick=()=>showPerson(p,true);
  document.querySelectorAll("#pgrid .card").forEach(c=>c.setAttribute("aria-current",c.dataset.id===p.id));
}
const thumbs={};
function renderPeople(){
  const grid=$("#pgrid");grid.innerHTML="";
  PEOPLE.forEach(p=>{const b=document.createElement("button");b.type="button";b.className="card";b.dataset.id=p.id;
    b.innerHTML=`<div class="cv"></div><div class="cap"><b>${esc(p.n)}</b><span>${esc(p.it)}</span></div>`;
    b.onclick=()=>{showPerson(p,zedOn&&!p.kid);$("#pessoas").scrollIntoView({behavior:reduce?"auto":"smooth"})};grid.appendChild(b)});
  let i=0;
  function step(){if(i>=PEOPLE.length){$("#pload").textContent="";setGrid(false);return}
    const p=PEOPLE[i++];thumbs[p.id]={};
    for(const z of[false,true]){if(z&&p.kid){thumbs[p.id][1]=thumbs[p.id][0];continue}
      const o=buildPerson(p,z).root;const sc=portraitScene(o,p.wide);o.rotation.y=-.25;const c=portraitCam(p.wide,240/300);
      thumbs[p.id][z?1:0]=snap(sc,c,240,300);dispose(sc)}
    const host=document.querySelector(`#pgrid .card[data-id="${p.id}"] .cv`);host.appendChild(thumbs[p.id][0]);
    $("#pload").textContent=`Renderizando retratos… ${i}/${PEOPLE.length}`;
    setTimeout(step,0)}
  step();
}
function setGrid(z){$("#gAlive").setAttribute("aria-pressed",!z);$("#gZed").setAttribute("aria-pressed",z);
  PEOPLE.forEach(p=>{const host=document.querySelector(`#pgrid .card[data-id="${p.id}"] .cv`);if(!thumbs[p.id])return;host.innerHTML="";host.appendChild(thumbs[p.id][z?1:0])})}
$("#gAlive").onclick=()=>{zedOn=false;setGrid(false)};$("#gZed").onclick=()=>{zedOn=true;setGrid(true)};

/* ---------- bases ---------- */
const BV=Viewer($("#bv"),"dio");
function showBase(b){const sc=dioramaScene(b);BV.set(sc,dioCam(4/3,.75),null);BV.resetYaw();
  const ppl=PEOPLE.filter(p=>p.g===b.id).map(p=>p.n);
  $("#binfo").innerHTML=`<span class="meta" style="display:flex;gap:6px;align-items:center"><span class="dot" style="background:${GC[b.id]}"></span>${esc(b.r)}</span><h3>${esc(b.n)}</h3><p>${esc(b.d)}</p><div><span class="lbl">Quem mora aqui</span><p>${esc(ppl.join(", ")||"—")}</p></div>`;
  document.querySelectorAll("#bgrid .card").forEach(c=>c.setAttribute("aria-current",c.dataset.id===b.id))}
function renderBases(){const grid=$("#bgrid");
  BASES.forEach(b=>{const el=document.createElement("button");el.type="button";el.className="card";el.dataset.id=b.id;el.innerHTML=`<div class="cv"></div><div class="cap"><b>${esc(b.n)}</b><span>${esc(b.r)}</span></div>`;el.onclick=()=>{showBase(b);$("#bases").scrollIntoView({behavior:reduce?"auto":"smooth"})};grid.appendChild(el)});
  let i=0;function step(){if(i>=BASES.length){$("#bload").textContent="";return}const b=BASES[i++];const sc=dioramaScene(b);const cv=snap(sc,dioCam(400/260,.75),400,260);dispose(sc);
    document.querySelector(`#bgrid .card[data-id="${b.id}"] .cv`).appendChild(cv);$("#bload").textContent=`Renderizando maquetes… ${i}/${BASES.length}`;setTimeout(step,0)}
  step()}

showPerson(PEOPLE[9],false);
showBase(BASES[0]);
renderPeople();
setTimeout(renderBases,50);
})();
