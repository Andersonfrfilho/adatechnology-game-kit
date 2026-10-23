// fonte: site/pages/efeitos/oficina-vfx.html
// texto visível: Oficina de VFX ZombiAdA ZombiAdA · time central de VFX · revisão 1 Oficina de VFX Todos os efeitos de partículas e efeitos especiais do jogo, time por time, com prévia 3D ao vivo no mesmo low poly sombrio da cena de teste. Cada ficha diz quando o efeito dispara, como ele é, quanto custa e o que vai pela rede LAN. A regra que manda em tudo: com 2.000 zumbis na tela, o VFX inteiro cabe em 2,5 ms de GPU numa GTX 1060 . -- fps · 0 draw calls partículas 0 / 0 · decalques 0 Repetir Repetição automática LOD 0–15 m 15–40 m 40–80 m Regra dos fluidos Fluido nunca fica parado enquanto está molhado. Só para quando seca, e seco tem outra cor e outro acabamento. Vale para sangue, bile, óleo, gasolina e água, em todos os times. Fluido Fresco Comportamento Seco Tempo no jogo Sangue Fresco (0–3 dias) Vermelho vivo #8A0A0A, brilhante Espalha, ondula, escorre em parede, corre em declive, pinga em borda Marrom #3B1D14, fosco seca em 10 min Sangue Recente / Antigo Bordô #5A0C10 / marrom #3A1C12, brilho menor Igual, mais lento e em menor quantidade Marrom-escuro fosco seca em 6 min Decrépito Pó preto, não é líquido Cai e assenta, não escorre Igual — Bile do Inchado Verde-amarelo #8A9A2A, grosso, borbulha Escorre devagar, bolhas estourando Crosta verde-oliva #3E4220 seca em 15 min Óleo de motor Preto com reflexo de arco-íris Espalha devagar e corre em declive Nunca seca; mancha permanente — Gasolina Quase transparente, ar tremulando em cima Espalha rápido, inflamável Evapora sem marca evapora em 60 s Água Escurece o chão, reflete Poça com anéis na chuva Volta à cor do chão 3 min sem chuva Unity Cada superfície com sangue perto do jogador ganha uma grade de altura 2×2 m (células de 1,25 cm, altura em mm) simulada em compute shader: o líquido só corre quando a camada passa do limiar de viscosidade, segue o declive pela normal e pinga em bordas. No máximo 6 grades ativas; longe ou velha vira decal assado. Filetes de parede: contas com massa que descem serpenteando e deixam película; param quando a massa acaba. Gotas penduradas crescem, afinam no pescoço, soltam, esticam na queda e respingam. Respingo nunca redondo: corpo alongado na direção do impacto, cauda do lado oposto, pontas afinando, gotas satélite com rabo e pontinhos. Shader _Wetness (0 a 1) lê a altura: normal, brilho, fresnel, película iridescente no óleo e mistura da cor fresca para a seca. Interações Chuva lava: o sangue clareia, espalha 50% a mais e não seca enquanto chove. Pisar no fresco deixa pegadas (6 decalques, somem com a secagem) e o Farejador segue o cheiro. Fogo seca na hora e escurece; gasolina e óleo pegam fogo. Custo Um decalque por poça ou fio, até 6 fios por respingo. Fluido a mais de 30 m não anima e mostra só o estado atual. Secagem calculada pela hora do evento: nada novo na rede. Cada elemento destrutível Regra geral: todo objeto que quebra tem pelo menos 3 estados visíveis, solta partículas do seu material a cada dano e deixa marca que fica. Furos e amassados são presos ao pedaço (não ao 

// ===== script 2 (142 KB)

(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!window.THREE){$('note').textContent='Não foi possível carregar o motor 3D. Recarregue a página.';return;}
const V=THREE.Vector3,Col=THREE.Color;
const rnd=(a,b)=>a+Math.random()*(b-a);
const rg=v=>Array.isArray(v)?rnd(v[0],v[1]):(v||0);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<0?0:t>1?1:t*t*(3-2*t);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const UP=new V(0,1,0),ZV=new V(0,0,1);

// ---------- renderer
const stage=$('stage'),canvas=$('c'),lens=$('lens'),lg=lens.getContext('2d');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
const scene=new THREE.Scene();const NIGHT=0x0b1018;scene.background=new Col(NIGHT);
const FOG0=.035;scene.fog=new THREE.FogExp2(NIGHT,FOG0);
const camera=new THREE.PerspectiveCamera(48,1.6,.05,220);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.495;controls.minDistance=.3;controls.maxDistance=40;
let uScale=600;const PS=[];
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();uScale=h*renderer.getPixelRatio()*.5/Math.tan(camera.fov*Math.PI/360);PS.forEach(s=>s.mat.uniforms.uScale.value=uScale);lens.width=w;lens.height=h;}
new ResizeObserver(resize).observe(stage);

const hemi=new THREE.HemisphereLight(0x3a4c6a,0x0b0b0c,.6);scene.add(hemi);
const moon=new THREE.DirectionalLight(0x8aa6d6,.42);moon.position.set(-20,30,14);scene.add(moon);
const mat=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:true},o||{}));
const Bx=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
function mesh(geo,m,x,y,z,parent){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);(parent||scene).add(o);return o;}
function ctex(w,h,draw){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');draw&&draw(g,w,h);const t=new THREE.CanvasTexture(cv);t.cv=cv;t.g=g;return t;}

// ---------- set
const GROUND=0x15181c,GCOL=new Col(GROUND);
const ground=mesh(new THREE.PlaneGeometry(90,90).rotateX(-Math.PI/2),mat(GROUND,{roughness:.85}),0,0,0);
mesh(new THREE.PlaneGeometry(90,7).rotateX(-Math.PI/2),mat(0x1c1f23,{roughness:.8}),0,.005,1.2);
for(let x=-40;x<=40;x+=4)mesh(Bx(1.6,.01,.14),mat(0x6f6542),x,.012,1.2);
const walk=mesh(Bx(26,.12,1.6),mat(0x34363a),0,.06,-3.7);
const WALL=0x3b3f45;
const wall=mesh(Bx(26,7.5,1),mat(WALL),0,3.75,-5);
mesh(Bx(26.4,.35,1.3),mat(0x26282b),0,7.5,-5);
const groundAt=(x,z)=>(z<-2.9&&z>-4.5&&Math.abs(x)<13)?.12:0;
// shop window
const glassTex=ctex(256,180);
const glassMat=new THREE.MeshStandardMaterial({map:glassTex,transparent:true,roughness:.05,metalness:.5,depthWrite:false,side:THREE.DoubleSide});
const glass=mesh(new THREE.PlaneGeometry(2.6,1.8),glassMat,-5,1.9,-4.46);
mesh(Bx(2.9,.15,.15),mat(0x2a2c2f),-5,.95,-4.44);mesh(Bx(2.9,.15,.15),mat(0x2a2c2f),-5,2.85,-4.44);
mesh(Bx(.15,2,.15),mat(0x2a2c2f),-6.4,1.9,-4.44);mesh(Bx(.15,2,.15),mat(0x2a2c2f),-3.6,1.9,-4.44);
mesh(new THREE.PlaneGeometry(2.6,1.8),new THREE.MeshBasicMaterial({color:0x07090c}),-5,1.9,-4.49);
const glassCracks=[];
function drawGlass(){const g=glassTex.g,w=256,h=180;g.clearRect(0,0,w,h);g.fillStyle='rgba(150,190,210,.22)';g.fillRect(0,0,w,h);g.strokeStyle='rgba(235,245,255,.85)';g.lineWidth=1.2;
  for(const c of glassCracks){for(const r of c.rays){g.beginPath();g.moveTo(c.x,c.y);let x=c.x,y=c.y;for(const s of r){x+=s[0];y+=s[1];g.lineTo(x,y);}g.stroke();}
    for(const ring of c.rings){g.beginPath();g.arc(c.x,c.y,ring,0,7);g.globalAlpha=.4;g.stroke();g.globalAlpha=1;}
    g.fillStyle='rgba(240,250,255,.9)';g.beginPath();g.arc(c.x,c.y,2.5,0,7);g.fill();}
  glassTex.needsUpdate=true;}
function crackAt(cx,cy,big){const rays=[];const n=big?12:7;for(let i=0;i<n;i++){const a=i/n*6.28+rnd(-.3,.3);const segs=[];let len=big?rnd(40,110):rnd(15,45);let ca=a;while(len>0){const s=rnd(6,14);ca+=rnd(-.35,.35);segs.push([Math.cos(ca)*s,Math.sin(ca)*s]);len-=s;}rays.push(segs);}
  return{x:cx,y:cy,rays,rings:big?[12,26]:[8]};}
drawGlass();
// door (3 planks), hinge at bottom
const doorG=new THREE.Group();doorG.position.set(2,.12,-4.45);scene.add(doorG);
const planks=[0,1,2].map(i=>{const p=mesh(Bx(1.2,.72,.08),mat(0x6b4a2a),0,.37+i*.74,.04,doorG);p.userData.y0=p.position.y;return p;});
mesh(new THREE.PlaneGeometry(1.25,2.25),new THREE.MeshBasicMaterial({color:0x050608}),2,1.24,-4.49);
mesh(Bx(.12,2.4,.15),mat(0x2a2c2f),1.32,1.3,-4.44);mesh(Bx(.12,2.4,.15),mat(0x2a2c2f),2.68,1.3,-4.44);mesh(Bx(1.5,.12,.15),mat(0x2a2c2f),2,2.48,-4.44);
// awning slab that collapses
const slab=mesh(Bx(4.4,.25,1.5),mat(0x6e6a63),-1.4,3.35,-3.75);
// upper windows that catch fire
const fireWins=[[4.6,5],[-1.6,5]].map(([x,y])=>mesh(new THREE.PlaneGeometry(1.4,1.2),new THREE.MeshBasicMaterial({color:0x0d1217}),x,y,-4.48));
for(const [x,y] of[[8.6,5],[-5.6,5],[8.6,1.9]])mesh(new THREE.PlaneGeometry(1.4,1.2),new THREE.MeshBasicMaterial({color:0x0d1217}),x,y,-4.48);
// lamp post
mesh(new THREE.CylinderGeometry(.08,.12,4.8,6),mat(0x2b2d30,{metalness:.5,roughness:.6}),-9,2.4,-2.6);
mesh(Bx(.1,.1,1.2),mat(0x2b2d30),-9,4.75,-2.0);
mesh(Bx(.42,.16,.6),new THREE.MeshBasicMaterial({color:0xffc98a}),-9,4.65,-1.45);
const lampL=new THREE.PointLight(0xffa25a,1.4,16,2);lampL.position.set(-9,4.3,-1.45);scene.add(lampL);
const lampCone=mesh(new THREE.ConeGeometry(2.1,4.4,20,1,true),new THREE.MeshBasicMaterial({color:0xffb070,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}),-9,2.4,-1.45);
// car
const car=new THREE.Group();scene.add(car);
const carBodyMat=mat(0x5a2b26,{roughness:.55,metalness:.35}),carCabMat=mat(0x15191d,{roughness:.3,metalness:.6});
mesh(Bx(1.9,.7,4.2),carBodyMat,0,.62,0,car);
mesh(Bx(1.7,.6,2.1),carCabMat,0,1.27,-.25,car);
mesh(Bx(1.92,.12,4.22),mat(0x1b1c1e),0,.33,0,car);
const wg=new THREE.CylinderGeometry(.38,.38,.3,8).rotateZ(Math.PI/2);
for(const a of[-1,1])for(const b of[-1,1])mesh(wg,mat(0x111111),a*.95,.38,b*1.35,car);
const hlMat=new THREE.MeshBasicMaterial({color:0x3a3a34});
for(const a of[-1,1])mesh(Bx(.35,.15,.05),hlMat,a*.65,.74,2.11,car);
for(const a of[-1,1])mesh(Bx(.35,.15,.05),new THREE.MeshBasicMaterial({color:0x8a1a14}),a*.65,.76,-2.11,car);
const wsTex=ctex(256,112);
const ws=mesh(new THREE.PlaneGeometry(1.62,.72),new THREE.MeshStandardMaterial({map:wsTex,transparent:true,roughness:.05,metalness:.4,depthWrite:false,side:THREE.DoubleSide}),0,1.25,.83,car);ws.rotation.x=-.5;
const wsMarks=[];
function drawWS(){const g=wsTex.g,w=256,h=112;g.clearRect(0,0,w,h);g.fillStyle='rgba(120,150,170,.28)';g.fillRect(0,0,w,h);
  for(const m of wsMarks){if(m.t==='s'){g.save();g.globalAlpha=.75;g.strokeStyle='#5a0b0d';g.lineCap='round';for(const s of m.st){g.lineWidth=s.w;g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x+s.dx,s.y+s.dy);g.stroke();}g.restore();}}
  g.strokeStyle='rgba(240,248,255,.95)';g.lineWidth=2.2;
  for(const m of wsMarks){if(m.t!=='c')continue;const c=m.c;for(const r of c.rays){g.beginPath();g.moveTo(c.x,c.y);let x=c.x,y=c.y;for(const s of r){x+=s[0];y+=s[1];g.lineTo(x,y);}g.stroke();}for(const ring of c.rings){g.globalAlpha=.45;g.beginPath();g.arc(c.x,c.y,ring,0,7);g.stroke();g.globalAlpha=1;}}
  wsTex.needsUpdate=true;}
drawWS();
const headSpots=[],headCones=[];
for(const a of[-1,1]){const S=new THREE.SpotLight(0xfff1d0,0,26,.33,.5,1.6);S.position.set(a*.65,.74,2.15);const tg=new THREE.Object3D();tg.position.set(a*.65,.2,12);car.add(S,tg);S.target=tg;headSpots.push(S);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(2.4,9,18,1,true).translate(0,-4.5,0).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff1d0,transparent:true,opacity:.06,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));cone.position.set(a*.65,.74,2.15);cone.visible=false;car.add(cone);headCones.push(cone);}
const CAR0={x:5.6,z:.8,ry:-.4};
const carW=(lx,ly,lz)=>{car.updateMatrixWorld();return new V(lx,ly,lz).applyMatrix4(car.matrixWorld);};
// barrel
const barrel=new THREE.Group();barrel.position.set(-4.4,0,1.4);scene.add(barrel);
mesh(new THREE.CylinderGeometry(.4,.4,1,12),mat(0x9b1c18,{roughness:.5,metalness:.3}),0,.5,0,barrel);
mesh(new THREE.CylinderGeometry(.405,.405,.14,12),mat(0xd8b02a),0,.7,0,barrel);
// gun on stand (for muzzle / casings)
const gun=new THREE.Group();gun.position.set(-.8,1.35,3.4);scene.add(gun);
const gm=mat(0x1c1d1f,{metalness:.6,roughness:.45});
mesh(Bx(.07,.14,.7),gm,0,0,0,gun);mesh(new THREE.CylinderGeometry(.018,.018,.45,6).rotateX(Math.PI/2),gm,0,.03,-.55,gun);
mesh(Bx(.06,.22,.08),mat(0x6a3a1c),0,-.14,.08,gun);mesh(Bx(.06,.12,.3),mat(0x6a3a1c),0,-.02,.45,gun);
mesh(Bx(.05,.22,.1),gm,0,-.16,-.12,gun).rotation.x=.25;
const gunTip=()=>new V(-.8,1.38,3.4-.78),gunPort=()=>new V(-.76,1.4,3.32);
// campfire
const camp=new THREE.Group();camp.position.set(-1.4,0,3.0);scene.add(camp);
for(let i=0;i<3;i++){const l=mesh(Bx(.12,.12,.9),mat(0x3a2716),0,.08,0,camp);l.rotation.y=i*1.05;}
for(let i=0;i<9;i++){const a=i/9*6.28;mesh(new THREE.DodecahedronGeometry(.11,0),mat(0x4a4a48),Math.cos(a)*.5,.06,Math.sin(a)*.5,camp);}
// survivor
function makeSurvivor(){const g=new THREE.Group(),b=new THREE.Group();g.add(b);const skin=mat(0xc49a74),jk=mat(0x4d5536),pn=mat(0x2a2d33);
  for(const s of[-1,1])mesh(Bx(.21,.84,.24),pn,s*.12,.42,0,b);
  const torso=mesh(Bx(.56,.7,.32),jk,0,1.2,0,b);mesh(Bx(.48,.58,.24),mat(0x3d3328),0,1.22,-.27,b);
  const head=mesh(Bx(.3,.32,.3),skin,0,1.74,0,b);mesh(Bx(.33,.1,.33),mat(0x1d1f22),0,1.92,0,b);
  for(const s of[-1,1]){const a=mesh(Bx(.12,.62,.13),jk,s*.35,1.2,.04,b);a.rotation.x=-.25;}
  return{g,b,torso,head};}
const surv=makeSurvivor();scene.add(surv.g);
const flashSpot=new THREE.SpotLight(0xe6eeff,0,20,.3,.5,1.5);const fsT=new THREE.Object3D();surv.g.add(flashSpot,fsT);flashSpot.position.set(.3,1.2,.3);fsT.position.set(.6,.2,8);flashSpot.target=fsT;
const flashCone=new THREE.Mesh(new THREE.ConeGeometry(1.6,6,16,1,true).translate(0,-3,0).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xdfe8ff,transparent:true,opacity:.055,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
flashCone.position.set(.3,1.2,.3);flashCone.lookAt(new V(.6,.2,8).add(new V(.3,1.2,.3)));surv.g.add(flashCone);
// glow texture
const glowTex=ctex(64,64,(g)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.6)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});
// zombies
const BLOOD=[0x8a0a0a,0x5a0c10,0x3a1c12,0x1d1914];
const AGE=['Fresco','Recente','Antigo','Decrépito'];
function makeZombie(skin,cloth,eye){
  const g=new THREE.Group(),b=new THREE.Group();g.add(b);
  const mS=mat(skin),mC=mat(cloth),mP=mat(0x24262b);
  const legs=[-1,1].map(s=>{const l=new THREE.Group();l.position.set(s*.12,.82,0);b.add(l);mesh(Bx(.2,.8,.24).translate(0,-.4,0),mP,0,0,0,l);return l;});
  const torso=mesh(Bx(.52,.7,.3),mC,0,1.17,0,b);
  const head=mesh(Bx(.3,.32,.3),mS,0,1.7,.02,b);
  const arms=[-1,1].map(s=>{const a=new THREE.Group();a.position.set(s*.33,1.46,0);b.add(a);mesh(Bx(.12,.12,.66).translate(0,0,.3),mS,0,0,0,a);a.rotation.x=.25;return a;});
  const eM=new THREE.MeshBasicMaterial({color:eye});
  const eyes=[-1,1].map(s=>mesh(Bx(.07,.035,.02),eM,s*.07,1.74,.175,b));
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:eye,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,transparent:true}));glow.position.set(0,1.74,.2);glow.scale.set(.45,.2,1);b.add(glow);
  scene.add(g);
  return{g,b,legs,torso,head,arms,eyes,glow,eM,mS,mC,skin0:skin,eye0:eye,st:{},ph:Math.random()*6};
}
const Z=makeZombie(0x6d7a5a,0x3f3a34,0xe3c341);
const EYES=[0xe3c341,0xe5392b,0xe3c341,0xef8a2a,0xe3c341,0xe5392b,0xe3c341,0x4fc6d6,0xe3c341,0xe5392b];
const H=EYES.map((e,i)=>makeZombie([0x6d7a5a,0x7a7460,0x5f6b55][i%3],[0x3f3a34,0x2f3a44,0x4a3a2a,0x3a3f30][i%4],e));
function resetZombie(z){z.g.visible=true;z.g.position.set(0,0,0);z.g.rotation.set(0,0,0);z.g.scale.set(1,1,1);z.b.rotation.set(0,0,0);z.b.position.set(0,0,0);z.b.scale.set(1,1,1);
  z.head.visible=true;z.head.rotation.set(0,0,0);z.arms.forEach(a=>{a.visible=true;a.rotation.set(.25,0,0);});z.eyes.forEach(e=>e.visible=true);z.glow.visible=true;z.glow.scale.set(.45,.2,1);
  z.torso.scale.set(1,1,1);z.mS.color.setHex(z.skin0);z.mS.emissive.setHex(0);z.mC.color.copy(z.mC.userData.c0||(z.mC.userData.c0=z.mC.color.clone()));z.eM.color.setHex(z.eye0);z.glow.material.color.setHex(z.eye0);z.glow.material.opacity=1;z.st={};}
function setEye(z,hex){z.eM.color.setHex(hex);z.glow.material.color.setHex(hex);}
function zfall(z,delay,dur,dir){z.st.fall={t:-(delay||0),d:dur||.7,dir:dir||-1};}
function zwalk(z,to,sp){z.st.walk={to:to.clone(),sp};}
function updateZombie(z,dt,t){if(!z.g.visible)return;const s=z.st;
  const sw=Math.sin(t*2+z.ph);
  if(!s.fall&&!s.lie){z.arms[0].rotation.x=.25+sw*.08;z.arms[1].rotation.x=.25-sw*.08;z.b.rotation.z=Math.sin(t*1.3+z.ph)*.04;}
  if(s.walk){const p=z.g.position,dx=s.walk.to.x-p.x,dz=s.walk.to.z-p.z,d=Math.hypot(dx,dz);if(d>.05){const m=Math.min(d,s.walk.sp*dt);p.x+=dx/d*m;p.z+=dz/d*m;z.g.rotation.y=Math.atan2(dx,dz);const f=t*s.walk.sp*4.5+z.ph;z.legs[0].rotation.x=Math.sin(f)*.6;z.legs[1].rotation.x=-Math.sin(f)*.6;z.b.position.y=Math.abs(Math.cos(f))*.04;}else{s.walk=null;z.legs.forEach(l=>l.rotation.x=0);}}
  if(s.swing){s.swing.t+=dt;const k=s.swing.t/.35;if(k<1){const a=z.arms[s.swing.side];a.rotation.x=.25-Math.sin(k*Math.PI)*1.1;}else s.swing=null;}
  if(s.fall){s.fall.t+=dt;const k=ease(s.fall.t/s.fall.d);z.b.rotation.x=s.fall.dir*k*Math.PI/2;z.b.position.y=-.02*k;z.legs.forEach(l=>l.rotation.x=0);if(s.fall.t>s.fall.d){s.lie=true;}}
}
const ZS=[Z,...H];

// ---------- particle systems
const VS=`attribute float size;attribute float alpha;attribute vec3 pcol;varying vec3 vC;varying float vA;uniform float uScale;
void main(){vC=pcol;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*uScale/-mv.z,1.,512.);gl_Position=projectionMatrix*mv;}`;
const FSs=`uniform float uSoft;varying vec3 vC;varying float vA;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.)discard;float a=mix(smoothstep(1.,.78,r),pow(1.-r,1.5),uSoft);gl_FragColor=vec4(vC,vA*a);}`;
const tc=new Col();
function randUnit(o){const u=Math.random()*2-1,a=Math.random()*6.2832,s=Math.sqrt(1-u*u);return o.set(s*Math.cos(a),u,s*Math.sin(a));}
const _d=new V(),_t1=new V(),_t2=new V();
function coneDir(dir,cone,out){if(cone>=3.1)return randUnit(out);const ct=1-Math.random()*(1-Math.cos(cone)),st=Math.sqrt(1-ct*ct),ph=Math.random()*6.2832;
  _t1.set(1,0,0);if(Math.abs(dir.x)>.9)_t1.set(0,1,0);_t2.crossVectors(dir,_t1).normalize();_t1.crossVectors(_t2,dir).normalize();
  return out.copy(dir).multiplyScalar(ct).addScaledVector(_t1,st*Math.cos(ph)).addScaledVector(_t2,st*Math.sin(ph));}
class PSys{
  constructor(cap,add,soft){this.cap=cap;this.n=0;
    this.pos=new Float32Array(cap*3);this.col=new Float32Array(cap*3);this.siz=new Float32Array(cap);this.alp=new Float32Array(cap);
    this.vel=new Float32Array(cap*3);this.c0=new Float32Array(cap*3);this.c1=new Float32Array(cap*3);
    this.life=new Float32Array(cap);this.max=new Float32Array(cap);this.s0=new Float32Array(cap);this.gr=new Float32Array(cap);this.a0=new Float32Array(cap);
    this.g=new Float32Array(cap);this.dr=new Float32Array(cap);this.fi=new Float32Array(cap);this.gm=new Uint8Array(cap);this.ds=new Float32Array(cap);
    this.arrs=[[this.pos,3],[this.vel,3],[this.c0,3],[this.c1,3],[this.life,1],[this.max,1],[this.s0,1],[this.gr,1],[this.a0,1],[this.g,1],[this.dr,1],[this.fi,1],[this.gm,1],[this.ds,1]];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcol',new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size',new THREE.BufferAttribute(this.siz,1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha',new THREE.BufferAttribute(this.alp,1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0,0);this.geo=geo;
    this.mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:uScale},uSoft:{value:soft}},vertexShader:VS,fragmentShader:FSs,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending});
    this.obj=new THREE.Points(geo,this.mat);this.obj.frustumCulled=false;this.obj.renderOrder=add?3:2;scene.add(this.obj);PS.push(this);}
  spawn(o){if(this.n>=this.cap)return;const i=this.n++,i3=i*3;let x=o.p.x,y=o.p.y,z=o.p.z;
    if(o.r){randUnit(_d);const k=Math.cbrt(Math.random())*o.r;x+=_d.x*k;y+=_d.y*k*(o.flat?0:1);z+=_d.z*k;}
    if(o.box){x+=rnd(-o.box[0],o.box[0]);y+=rnd(-o.box[1],o.box[1]);z+=rnd(-o.box[2],o.box[2]);}
    this.pos[i3]=x;this.pos[i3+1]=y;this.pos[i3+2]=z;
    coneDir(o.dir||UP,o.cone==null?3.2:o.cone,_d);const s=rg(o.sp);
    this.vel[i3]=_d.x*s+(o.v?o.v.x:0);this.vel[i3+1]=_d.y*s+(o.v?o.v.y:0);this.vel[i3+2]=_d.z*s+(o.v?o.v.z:0);
    tc.setHex(o.c0==null?0xffffff:o.c0);this.c0[i3]=tc.r;this.c0[i3+1]=tc.g;this.c0[i3+2]=tc.b;
    if(o.c1!=null)tc.setHex(o.c1);this.c1[i3]=tc.r;this.c1[i3+1]=tc.g;this.c1[i3+2]=tc.b;
    this.life[i]=this.max[i]=rg(o.life||1);this.s0[i]=rg(o.size||.1);this.gr[i]=o.grow||1;this.a0[i]=o.a==null?1:o.a;
    this.g[i]=o.g||0;this.dr[i]=o.drag||0;this.fi[i]=o.fi==null?.1:o.fi;this.gm[i]=o.gnd||0;this.ds[i]=o.ds?rg(o.ds):.1;}
  kill(i){const j=--this.n;if(i===j)return;for(const[a,s]of this.arrs){for(let k=0;k<s;k++)a[i*s+k]=a[j*s+k];}}
  clear(){this.n=0;}
  update(dt){const P=this.pos,Vv=this.vel;
    for(let i=this.n-1;i>=0;i--){this.life[i]-=dt;if(this.life[i]<=0){this.kill(i);continue;}
      const i3=i*3,k=1-this.life[i]/this.max[i];
      Vv[i3+1]-=this.g[i]*dt;const f=Math.max(0,1-this.dr[i]*dt);Vv[i3]*=f;Vv[i3+1]*=f;Vv[i3+2]*=f;
      P[i3]+=Vv[i3]*dt;P[i3+1]+=Vv[i3+1]*dt;P[i3+2]+=Vv[i3+2]*dt;
      const gm=this.gm[i];if(gm){const gy=groundAt(P[i3],P[i3+2]);if(P[i3+1]<gy){
        if(gm===1){this.kill(i);continue;}
        if(gm===2){P[i3+1]=gy+.001;Vv[i3+1]*=-.3;Vv[i3]*=.55;Vv[i3+2]*=.55;}
        if(gm===3){if(Q.level<2)decal(P[i3],gy,P[i3+2],this.ds[i],(this.c0[i3]*255<<16)|(this.c0[i3+1]*255<<8)|(this.c0[i3+2]*255),{grow:.15,fluid:'blood'});this.kill(i);continue;}}}
      this.siz[i]=this.s0[i]*(1+(this.gr[i]-1)*k);const fi=this.fi[i];
      this.alp[i]=this.a0[i]*(fi>0&&k<fi?k/fi:1-(k-fi)/(1-fi));
      for(let c=0;c<3;c++)this.col[i3+c]=lerp(this.c0[i3+c],this.c1[i3+c],k);}
    const at=this.geo.attributes;at.position.needsUpdate=at.pcol.needsUpdate=at.size.needsUpdate=at.alpha.needsUpdate=true;at.position.updateRange.count=-1;
    this.geo.setDrawRange(0,this.n);}
}
const addP=new PSys(9000,true,1),norP=new PSys(9000,false,.55);

class Streaks{
  constructor(cap){this.cap=cap;this.n=0;this.pos=new Float32Array(cap*6);this.col=new Float32Array(cap*6);
    this.p=new Float32Array(cap*3);this.v=new Float32Array(cap*3);this.c0=new Float32Array(cap*3);this.c1=new Float32Array(cap*3);this.life=new Float32Array(cap);this.max=new Float32Array(cap);this.len=new Float32Array(cap);this.g=new Float32Array(cap);this.dr=new Float32Array(cap);this.gm=new Uint8Array(cap);this.a0=new Float32Array(cap);
    this.arrs=[[this.p,3],[this.v,3],[this.c0,3],[this.c1,3],[this.life,1],[this.max,1],[this.len,1],[this.g,1],[this.dr,1],[this.gm,1],[this.a0,1]];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));geo.setDrawRange(0,0);this.geo=geo;
    this.obj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.obj.frustumCulled=false;this.obj.renderOrder=4;scene.add(this.obj);}
  spawn(o){if(this.n>=this.cap)return;const i=this.n++,i3=i*3;let x=o.p.x,y=o.p.y,z=o.p.z;if(o.box){x+=rnd(-o.box[0],o.box[0]);y+=rnd(-o.box[1],o.box[1]);z+=rnd(-o.box[2],o.box[2]);}
    this.p[i3]=x;this.p[i3+1]=y;this.p[i3+2]=z;coneDir(o.dir||UP,o.cone==null?3.2:o.cone,_d);const s=rg(o.sp);
    this.v[i3]=_d.x*s+(o.v?o.v.x:0);this.v[i3+1]=_d.y*s+(o.v?o.v.y:0);this.v[i3+2]=_d.z*s+(o.v?o.v.z:0);
    tc.setHex(o.c0==null?0xffd080:o.c0);this.c0[i3]=tc.r;this.c0[i3+1]=tc.g;this.c0[i3+2]=tc.b;if(o.c1!=null)tc.setHex(o.c1);this.c1[i3]=tc.r;this.c1[i3+1]=tc.g;this.c1[i3+2]=tc.b;
    this.life[i]=this.max[i]=rg(o.life||.4);this.len[i]=o.len||.02;this.g[i]=o.g||0;this.dr[i]=o.drag||0;this.gm[i]=o.gnd||0;this.a0[i]=o.a==null?1:o.a;}
  kill(i){const j=--this.n;if(i===j)return;for(const[a,s]of this.arrs){for(let k=0;k<s;k++)a[i*s+k]=a[j*s+k];}}
  clear(){this.n=0;}
  update(dt){const p=this.p,v=this.v;
    for(let i=this.n-1;i>=0;i--){this.life[i]-=dt;if(this.life[i]<=0){this.kill(i);continue;}const i3=i*3,k=1-this.life[i]/this.max[i];
      v[i3+1]-=this.g[i]*dt;const f=Math.max(0,1-this.dr[i]*dt);v[i3]*=f;v[i3+1]*=f;v[i3+2]*=f;p[i3]+=v[i3]*dt;p[i3+1]+=v[i3+1]*dt;p[i3+2]+=v[i3+2]*dt;
      if(this.gm[i]){const gy=groundAt(p[i3],p[i3+2]);if(p[i3+1]<gy){if(this.gm[i]===1){this.kill(i);continue;}p[i3+1]=gy+.001;v[i3+1]*=-.35;v[i3]*=.6;v[i3+2]*=.6;}}
      const L=this.len[i],a=this.a0[i]*(1-k),o=i*6;
      this.pos[o]=p[i3];this.pos[o+1]=p[i3+1];this.pos[o+2]=p[i3+2];this.pos[o+3]=p[i3]-v[i3]*L;this.pos[o+4]=p[i3+1]-v[i3+1]*L;this.pos[o+5]=p[i3+2]-v[i3+2]*L;
      for(let c=0;c<3;c++){const cc=lerp(this.c0[i3+c],this.c1[i3+c],k)*a;this.col[o+c]=cc;this.col[o+3+c]=cc*.15;}}
    this.geo.attributes.position.needsUpdate=this.geo.attributes.color.needsUpdate=true;this.geo.setDrawRange(0,this.n*2);}
}
const streak=new Streaks(3000);

// debris
const DMAX=500;
const debIM=new THREE.InstancedMesh(Bx(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:.25,flatShading:true}),DMAX);
debIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);debIM.frustumCulled=false;scene.add(debIM);
const DB=[];const ZERO=new THREE.Matrix4().makeScale(0,0,0);
for(let i=0;i<DMAX;i++){debIM.setMatrixAt(i,ZERO);debIM.setColorAt(i,new Col(0xffffff));DB.push({on:false});}
let dbI=0,dbN=0;const dq=new THREE.Quaternion(),de=new THREE.Euler(),dv=new V(),dsv=new V(),dm=new THREE.Matrix4();
function debris(o){const i=dbI++%DMAX,d=DB[i];coneDir(o.dir||UP,o.cone==null?3.2:o.cone,_d);const s=rg(o.sp);const sz=o.size||[.05,.05,.05];const k=o.k?rg(o.k):1;
  Object.assign(d,{on:true,x:o.p.x+(o.box?rnd(-o.box[0],o.box[0]):0),y:o.p.y+(o.box?rnd(-o.box[1],o.box[1]):0),z:o.p.z+(o.box?rnd(-o.box[2],o.box[2]):0),vx:_d.x*s+(o.v?o.v.x:0),vy:_d.y*s+(o.v?o.v.y:0),vz:_d.z*s+(o.v?o.v.z:0),
    sx:sz[0]*k,sy:sz[1]*k,sz:sz[2]*k,rx:rnd(0,6),ry:rnd(0,6),rz:rnd(0,6),ax:rnd(-1,1)*(o.spin||12),ay:rnd(-1,1)*(o.spin||12),az:rnd(-1,1)*(o.spin||12),life:o.life||8,b:o.bounce==null?.3:o.bounce,rest:false});
  debIM.setColorAt(i,tc.setHex(o.c==null?0x888888:o.c));debIM.instanceColor.needsUpdate=true;}
function updateDebris(dt){dbN=0;for(let i=0;i<DMAX;i++){const d=DB[i];if(!d.on)continue;dbN++;d.life-=dt;if(d.life<=0){d.on=false;debIM.setMatrixAt(i,ZERO);continue;}
  if(!d.rest){d.vy-=9.8*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.rx+=d.ax*dt;d.ry+=d.ay*dt;d.rz+=d.az*dt;const gy=groundAt(d.x,d.z)+Math.min(d.sx,d.sy,d.sz)*.5;
    if(d.y<gy){d.y=gy;d.vy*=-d.b;d.vx*=.55;d.vz*=.55;d.ax*=.5;d.ay*=.5;d.az*=.5;if(Math.abs(d.vy)<.5&&Math.hypot(d.vx,d.vz)<.3){d.rest=true;d.rx=Math.round(d.rx/1.5708)*1.5708;d.rz=Math.round(d.rz/1.5708)*1.5708;}}}
  const sh=Math.min(1,d.life/.5);de.set(d.rx,d.ry,d.rz);dq.setFromEuler(de);dm.compose(dv.set(d.x,d.y,d.z),dq,dsv.set(d.sx*sh,d.sy*sh,d.sz*sh));debIM.setMatrixAt(i,dm);}
  debIM.instanceMatrix.needsUpdate=true;}

// decals
const DCMAX=400;
const blobGeo=new THREE.CircleGeometry(.5,12);{const p=blobGeo.attributes.position;for(let i=1;i<p.count;i++){const k=.72+Math.random()*.4;p.setXY(i,p.getX(i)*k,p.getY(i)*k);}}
// fluids: wet decals are glossy and keep moving (spread, wobble, run down walls and slopes); dried ones are matte with their own colour
const decIM=new THREE.InstancedMesh(blobGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.1,metalness:.3,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),DCMAX);
const decIMd=new THREE.InstancedMesh(blobGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,flatShading:true,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),DCMAX);
[decIM,decIMd].forEach(m=>{m.frustumCulled=false;m.renderOrder=1;scene.add(m);});
const DC=[];for(let i=0;i<DCMAX;i++){for(const m of[decIM,decIMd]){m.setMatrixAt(i,ZERO);m.setColorAt(i,new Col(0));}DC.push({on:false,c:new Col(),f:new Col()});}
// fresh -> dried colours (fuel evaporates, oil never dries)
const FLUID={
  blood:{creep:.3,dryAt:40,dryT:30},
  oil:{creep:.5,sheen:true},
  fuel:{creep:.7,evap:[6,5]},
  bile:{creep:.25,dryAt:40,dryT:30,dryC:0x3e4220,bubbles:true},
  water:{creep:.2,evap:[40,20]}
};
const BROWN=new Col(0x2a1610);
let dcI=0,dcN=0;const dqn=new THREE.Quaternion(),dqr=new THREE.Quaternion(),bX=new V(),bM=new THREE.Matrix4();
function decal(x,y,z,size,color,o){o=o||{};const i=dcI++%DCMAX,d=DC[i];const n=o.n||UP;
  if(o.dark&&!o.fluid){o.fluid='blood';o.dryAt=0;o.dryT=o.dark;}
  if(o.run){const dir=o.run.dir;bX.crossVectors(dir,n);bM.makeBasis(bX,dir,n);d.q=new THREE.Quaternion().setFromRotationMatrix(bM);}
  else{dqn.setFromUnitVectors(ZV,n);dqr.setFromAxisAngle(ZV,rnd(0,6.28));d.q=dqn.clone().multiply(dqr);}
  const off=.004+(i%40)*.0004;d.on=true;d.x=x+n.x*off;d.y=y+n.y*off;d.z=z+n.z*off;d.sx=size*(o.ar?1:rnd(.8,1.2));d.sy=size*(o.ar||rnd(.65,1.1));
  d.t=-(o.delay||0);d.grow=o.grow==null?1.2:o.grow;d.life=o.life||60;d.c.setHex(color);d.age=0;d.dried=false;d.i=i;
  d.run=o.run?{dir:o.run.dir.clone(),sp:o.run.sp,max:o.run.max,len:.01,w:size,onEnd:o.run.onEnd,ended:false}:null;
  if(o.fluid){const F=FLUID[o.fluid];d.fl=Object.assign({},F,{dryAt:o.dryAt!=null?o.dryAt:F.dryAt,dryT:o.dryT!=null?o.dryT:F.dryT});
    if(o.dry!=null)d.f.setHex(o.dry);else if(F.dryC)d.f.setHex(F.dryC);else d.f.copy(d.c).multiplyScalar(.45).lerp(BROWN,.45);}
  else{d.fl=null;d.f.copy(d.c);}}
function updateDecals(dt){dcN=0;let ch=false;for(let i=0;i<DCMAX;i++){const d=DC[i];if(!d.on)continue;dcN++;d.t+=dt;if(d.t<0){continue;}d.life-=dt;
  if(d.life<=0){d.on=false;decIM.setMatrixAt(i,ZERO);decIMd.setMatrixAt(i,ZERO);continue;}
  const e=d.grow>0?1-Math.pow(1-Math.min(1,d.t/d.grow),2.4):1;let sx=d.sx*e,sy=d.sy*e,px=d.x,py=d.y,pz=d.z;const f=d.fl,ta=d.t;
  tc.copy(d.c);
  if(f){if(!d.dried){const cr=1+f.creep*(1-Math.exp(-ta/6));sx*=cr*(1+.04*Math.sin(ta*1.9+i));sy*=cr*(1+.04*Math.cos(ta*1.5+i*.7));}else{const cr=1+f.creep;sx*=cr;sy*=cr;}
    if(f.evap){const ev=clamp((ta-f.evap[0])/f.evap[1],0,1);sx*=1-ev*.85;sy*=1-ev*.85;tc.lerp(GCOL,ev*.8);if(ev>=1){d.on=false;decIM.setMatrixAt(i,ZERO);decIMd.setMatrixAt(i,ZERO);continue;}}
    if(f.dryT){const k=clamp((ta-f.dryAt)/f.dryT,0,1);tc.copy(d.c).lerp(d.f,k);if(k>.85)d.dried=true;}
    else if(f.sheen)tc.setHSL((.62+.2*Math.sin(ta*.7+i))%1,.55,.1+.03*Math.sin(ta*1.3+i));}
  if(d.run){const r=d.run;if(!d.dried&&r.len<r.max){r.len=Math.min(r.max,r.len+r.sp*dt*Math.pow(Math.max(.05,1-r.len/r.max),.7));}else if(!r.ended){r.ended=true;if(r.len>=r.max&&r.onEnd)r.onEnd(px+r.dir.x*r.len,py+r.dir.y*r.len,pz+r.dir.z*r.len);}
    px+=r.dir.x*r.len*.5;py+=r.dir.y*r.len*.5;pz+=r.dir.z*r.len*.5;sx=r.w*(d.dried?1:1+.12*Math.sin(ta*3+i));sy=r.len;}
  dm.compose(dv.set(px,py,pz),d.q,dsv.set(Math.max(.001,sx),Math.max(.001,sy),1));
  const A=d.dried?decIMd:decIM,B=d.dried?decIM:decIMd;A.setMatrixAt(i,dm);B.setMatrixAt(i,ZERO);
  if(f||d.age===0||d.dried!==d.wasDried){A.setColorAt(i,tc);ch=true;}d.age=1;d.wasDried=d.dried;}
  for(const m of[decIM,decIMd]){m.instanceMatrix.needsUpdate=true;if(ch)m.instanceColor.needsUpdate=true;}}

// rings
const RMAX=120;
const ringIM=new THREE.InstancedMesh(new THREE.RingGeometry(.86,1,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),RMAX);
ringIM.frustumCulled=false;scene.add(ringIM);const RG=[];for(let i=0;i<RMAX;i++){ringIM.setMatrixAt(i,ZERO);ringIM.setColorAt(i,new Col(0));RG.push({on:false,c:new Col()});}
let rgI=0;
function ring(p,r0,r1,dur,color,n,hold){const i=rgI++%RMAX,d=RG[i];d.on=true;d.p=p.clone();d.r0=r0;d.r1=r1;d.t=0;d.dur=dur;d.c.setHex(color);d.q=new THREE.Quaternion().setFromUnitVectors(ZV,n||UP);d.hold=hold||0;}
function updateRings(dt){for(let i=0;i<RMAX;i++){const d=RG[i];if(!d.on)continue;d.t+=dt;const k=d.t/d.dur;if(k>=1&&!d.hold){d.on=false;ringIM.setMatrixAt(i,ZERO);continue;}const kk=Math.min(1,k);const r=lerp(d.r0,d.r1,1-Math.pow(1-kk,2));
  dm.compose(d.p,d.q,dsv.set(r,r,1));ringIM.setMatrixAt(i,dm);ringIM.setColorAt(i,tc.copy(d.c).multiplyScalar(d.hold?d.hold:1-kk));}ringIM.instanceMatrix.needsUpdate=true;ringIM.instanceColor.needsUpdate=true;}

// rain
const RAINMAX=4000;const rainPos=new Float32Array(RAINMAX*6);const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3).setUsage(THREE.DynamicDrawUsage));
const rainMat=new THREE.LineBasicMaterial({color:0x9fb3cf,transparent:true,opacity:.35,depthWrite:false});
const rain=new THREE.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;rain.visible=false;scene.add(rain);
const RN={n:0,wind:1,on:false,cx:0,cz:0};
function initRain(n,wind){RN.n=Math.round(n*Q.mult);RN.wind=wind;RN.on=true;rain.visible=true;for(let i=0;i<RN.n;i++){const o=i*6;const x=rnd(-15,15),y=rnd(0,16),z=rnd(-6,16);rainPos.set([x,y,z,x+wind*.04,y-.6,z],o);}rainGeo.setDrawRange(0,RN.n*2);}
function updateRain(dt,splash){if(!RN.on)return;const fall=15*dt,wx=RN.wind*fall*.07;const cp=camera.position;
  for(let i=0;i<RN.n;i++){const o=i*6;rainPos[o]+=wx;rainPos[o+3]+=wx;rainPos[o+1]-=fall;rainPos[o+4]-=fall;const gy=groundAt(rainPos[o],rainPos[o+2]);
    if(rainPos[o+4]<gy){const x=rainPos[o],z=rainPos[o+2];
      if(splash&&Math.random()<.35){const d=Math.hypot(x-cp.x,z-cp.z);if(d<12/(1+Q.level)){
        if(Math.random()<.5)norP.spawn({p:new V(x,gy+.01,z),dir:UP,cone:.6,sp:[.6,1.3],life:[.18,.3],size:.035,c0:0xb8c8dc,a:.6,g:9.8,fi:0});
        if(inPuddle(x,z))ring(new V(x,gy+.012,z),.01,rnd(.12,.25),rnd(.4,.6),0x6a7a90);}}
      const nx=rnd(-15,15)+RN.cx,ny=rnd(14,17),nz=rnd(-6,16)+RN.cz;rainPos.set([nx,ny,nz,nx+RN.wind*.04,ny-.6,nz],o);}}
  rainGeo.attributes.position.needsUpdate=true;}
const PUD=[[-1.5,2.2,1.6,.9],[3.0,3.6,1.1,.7],[-6,3.2,1.3,.8],[1.4,-2.2,.9,.5]];
const inPuddle=(x,z)=>PUD.some(p=>((x-p[0])/p[2])**2+((z-p[1])/p[3])**2<1);

// lights pool
const LP=[0,1,2,3].map(()=>{const L=new THREE.PointLight(0xffc070,0,14,2);scene.add(L);return{L,t:0,d:1,I:0};});
let lpI=0;
function flash(p,color,I,dur,dist,force){if(Q.level>=1&&!force)return;if(Q.level>=2&&force!=='boom')return;const l=LP[lpI++%LP.length];l.L.position.copy(p);l.L.color.setHex(color);l.L.distance=dist||14;l.I=I;l.d=dur;l.t=0;l.L.intensity=I;}
function updateLights(dt){for(const l of LP){if(l.L.intensity<=0)continue;l.t+=dt;const k=l.t/l.d;l.L.intensity=k>=1?0:l.I*(1-k)*(1-k);}}
const fireL=new THREE.PointLight(0xff7a2a,0,12,2);scene.add(fireL);const fireL2=new THREE.PointLight(0xff7a2a,0,12,2);scene.add(fireL2);

// quality / LOD
const Q={level:0,mult:1};
const n=c=>Math.max(c>0?1:0,Math.round(c*Q.mult));
function burst(sys,c,o){const m=n(c);for(let i=0;i<m;i++)sys.spawn(o);}
const acc={};
function emit(key,sys,rate,dt,o){acc[key]=(acc[key]||0)+rate*Q.mult*dt;while(acc[key]>=1){acc[key]-=1;sys.spawn(typeof o==='function'?o():o);}}

// ---------- screen effects
const S={shake:0,white:0,red:0,dirL:0,dirR:0,chroma:0,desat:0,gas:0,beat:0};
let P0={};
const ov={dir:$('ovDir'),cold:$('ovCold'),tint:$('ovTint'),vig:$('ovVig'),white:$('ovWhite')};
const lensBlobs=[];
function lensBlob(x,y,r,c,a){lensBlobs.push({x,y,r,c,a,vy:rnd(2,8)});}
function updateScreen(dt){
  for(const k of['shake','white','red','dirL','dirR','chroma'])S[k]*=Math.exp(-dt*(k==='red'?2.2:k==='shake'?5:k==='white'?7:3));
  S.desat*=Math.exp(-dt*.7);S.gas=Math.max(0,S.gas-dt/5);S.beat*=Math.exp(-dt*6);
  const p=P0;const blur=(p.blur||0)+S.gas*7;const desat=clamp((p.desat||0)+S.desat+S.gas*.4,0,1);const chroma=(p.chroma||0)+S.chroma;
  let f='';if(blur>.05)f+=`blur(${blur.toFixed(2)}px) `;if(desat>.01)f+=`saturate(${(1-desat).toFixed(2)}) `;if(p.hue)f+=`hue-rotate(${p.hue.toFixed(1)}deg) `;
  if(chroma>.4)f+=`drop-shadow(${chroma.toFixed(1)}px 0 0 rgba(255,40,40,.55)) drop-shadow(${(-chroma).toFixed(1)}px 0 0 rgba(40,220,255,.5)) `;
  canvas.style.filter=f||'none';
  const tun=clamp((p.tunnel||0)+S.beat*.35,0,1),red=clamp(S.red+(p.red||0),0,1);
  ov.vig.style.background=`radial-gradient(ellipse at center, transparent ${Math.round(62-tun*40)}%, rgba(0,0,0,${(.35+tun*.6).toFixed(2)}) 100%), radial-gradient(ellipse at center, transparent 40%, rgba(170,16,12,${(red*.85).toFixed(2)}) 100%)`;
  ov.dir.style.background=`linear-gradient(90deg, rgba(190,20,14,${(S.dirL*.8).toFixed(2)}) 0%, transparent 35%, transparent 65%, rgba(190,20,14,${(S.dirR*.8).toFixed(2)}) 100%)`;
  const cold=p.cold||0;ov.cold.style.boxShadow=cold>.01?`inset 0 0 ${Math.round(60+cold*80)}px ${Math.round(cold*30)}px rgba(150,200,240,${(cold*.55).toFixed(2)})`:'none';
  const g=S.gas,tA=(p.tintA||0);ov.tint.style.background=g>.01?`rgba(90,130,40,${(g*.55).toFixed(2)})`:tA>0?`rgba(${p.tintC||'90,130,40'},${tA.toFixed(2)})`:'transparent';
  ov.white.style.background=`rgba(235,240,255,${clamp(S.white,0,1).toFixed(2)})`;
  // lens
  const w=lens.width,h=lens.height;lg.clearRect(0,0,w,h);
  for(let i=lensBlobs.length-1;i>=0;i--){const b=lensBlobs[i];b.a-=dt*.16;b.y+=b.vy*dt;if(b.a<=0){lensBlobs.splice(i,1);continue;}
    const gr=lg.createRadialGradient(b.x*w,b.y*h,0,b.x*w,b.y*h,b.r*h);gr.addColorStop(0,`rgba(${b.c},${(b.a*.9).toFixed(2)})`);gr.addColorStop(.7,`rgba(${b.c},${(b.a*.6).toFixed(2)})`);gr.addColorStop(1,`rgba(${b.c},0)`);lg.fillStyle=gr;lg.beginPath();lg.arc(b.x*w,b.y*h,b.r*h,0,7);lg.fill();}
}
function clearScreen(){for(const k in S)S[k]=0;P0={};lensBlobs.length=0;}

// ---------- shared effect builders
const IMP={
  concreto:{dust:0x8a857a,chip:0x6e6a63,spark:2},
  metal:{dust:0,chip:0,spark:18},
  madeira:{dust:0x6a5038,chip:0x7a5530,spark:0},
  vidro:{dust:0xbfd6e2,chip:0xa8c8d8,spark:0},
  carne:{dust:0,chip:0,spark:0},
  agua:{dust:0,chip:0,spark:0}
};
function impact(kind,p,nrm,scale,age){scale=scale||1;const m=IMP[kind];
  if(kind==='carne'){bloodHit(p,nrm.clone().negate(),age||0,scale);return;}
  if(kind==='agua'){burst(norP,22*scale,{p,dir:UP,cone:.5,sp:[1.5,3.5],life:[.4,.7],size:[.03,.06],c0:0xc8d6e6,a:.7,g:9.8,fi:0,gnd:1});ring(p.clone().add(new V(0,.012,0)),.02,.6,.7,0x8090a8);ring(p.clone().add(new V(0,.013,0)),.02,.35,.5,0x8090a8);return;}
  if(m.dust)burst(norP,14*scale,{p,dir:nrm,cone:.6,sp:[.6,2.4],drag:2.5,life:[.6,1.2],size:[.08,.16],grow:4,c0:m.dust,c1:0x3a3936,a:.55,g:-.1});
  if(m.chip)for(let i=0;i<n(kind==='madeira'?8:6)*scale;i++)debris({p,dir:nrm,cone:.8,sp:[1.5,4],size:kind==='madeira'?[.015,.015,.09]:kind==='vidro'?[.03,.004,.03]:[.03,.03,.03],k:[.6,1.4],c:m.chip,life:6});
  if(m.spark&&Q.level<2){burst(streak,m.spark*scale,{p,dir:nrm,cone:kind==='metal'?.9:.5,sp:[3,9],life:[.15,.45],len:.025,c0:0xfff0c0,c1:0xff5a10,g:9.8,gnd:2});
    burst(addP,kind==='metal'?3:1,{p,size:[.12,.2],life:.06,c0:0xffe0a0,fi:0});if(kind==='metal')flash(p.clone().addScaledVector(nrm,.2),0xffb060,2,.06,5);}
  if(kind==='vidro'){burst(addP,5,{p,r:.15,size:[.02,.05],life:[.2,.5],c0:0xffffff,a:.9,fi:.3});}
  if(Q.level<2)decal(p.x,p.y,p.z,kind==='vidro'?.07:kind==='metal'?.05:.06,kind==='metal'?0x2a2522:0x0e0d0c,{n:nrm,grow:0,life:60});
}
function bloodHit(p,exitDir,age,scale){scale=scale||1;const a=[1,.7,.35,.1][age],c=BLOOD[age];
  if(age===3){burst(norP,16*scale,{p,dir:exitDir,cone:1,sp:[.5,1.6],drag:2,life:[.9,1.6],size:[.1,.2],grow:4,c0:0x2e2822,c1:0x15130f,a:.6,g:-.15});
    for(let i=0;i<n(5);i++)debris({p,dir:exitDir,cone:1,sp:[.5,2],size:[.03,.008,.03],c:0x1c1916,life:6});decal(p.x,0,p.z+exitDir.z*.6,.25,0x1a1714,{grow:.4,ar:.7});return;}
  burst(norP,10*a*scale,{p,dir:exitDir.clone().negate(),cone:.9,sp:[.2,.9],drag:3,life:[.25,.5],size:[.08,.14],grow:3,c0:c,a:.65});
  burst(norP,45*a*scale,{p,dir:exitDir,cone:.45,sp:[2.5,6],life:[1,1.6],size:[.035,.07],c0:c,a:.95,g:9.8,fi:0,gnd:3,ds:[.06,.16]});
  burst(norP,14*a*scale,{p,dir:exitDir,cone:.5,sp:[1,2.5],drag:2.5,life:[.4,.8],size:[.1,.18],grow:3,c0:c,a:.45});
}
function fireEmit(key,dt,c,r,k,o){o=o||{};const wind=o.wind||new V(0,0,0);
  emit(key+'f',addP,90*k,dt,()=>({p:c,r,flat:true,dir:o.dir||UP,cone:.35,sp:[.4,1.4],v:wind,life:[.35,.85],size:[.22,.5].map(s=>s*Math.sqrt(k)),grow:.35,c0:0xffd27a,c1:0x8a1a05,a:.85,fi:.15,g:-2.2}));
  emit(key+'c',addP,30*k,dt,()=>({p:c,r:r*.6,flat:true,dir:UP,cone:.3,sp:[.3,.8],life:[.2,.4],size:[.25,.4].map(s=>s*Math.sqrt(k)),grow:.6,c0:0xfff2c0,c1:0xff8a20,a:.8,fi:.1,g:-1}));
  if(Q.level<2)emit(key+'e',streak,10*k,dt,()=>({p:c,box:[r,0,r],dir:UP,cone:.5,sp:[1.5,3.5],v:wind.clone().add(new V(rnd(-.4,.4),0,rnd(-.4,.4))),life:[.8,1.8],len:.03,c0:0xffb050,c1:0x601000,g:-.6,drag:.4}));
  if(!o.nosmoke)emit(key+'s',norP,(o.smoke||14)*k,dt,()=>({p:c.clone().add(new V(0,.8*Math.sqrt(k),0)),r:r*.7,dir:UP,cone:.35,sp:[.6,1.4],v:wind,drag:.15,life:[2.5,4.5],size:[.4,.8].map(s=>s*Math.sqrt(k)),grow:4,c0:o.smokeC||0x2a2522,c1:0x121318,a:o.smokeA||.42,fi:.2,g:-.25}));
}
function fireLight(L,p,I,t){L.position.copy(p);L.intensity=I*(.75+.25*Math.sin(t*23)*Math.sin(t*7.3)+rnd(-.08,.08));}
function explode(p,s,o){o=o||{};
  flash(p.clone().add(new V(0,1,0)),0xffa040,14*s,.5,30,'boom');S.shake+=.7*s;S.white+=.18*s;
  burst(addP,55*s,{p,r:.3*s,sp:[2,7*s],drag:4,life:[.25,.6],size:[.7*s,1.4*s],grow:1.7,c0:0xfff0b0,c1:0x9a2a08,fi:.04});
  burst(addP,28*s,{p:p.clone().add(new V(0,.3,0)),r:.3,dir:UP,cone:.7,sp:[2,5*s],drag:1.5,life:[.6,1.1],size:[.6*s,1*s],grow:1.3,c0:0xffc060,c1:0x5a1205,g:-2,fi:.05});
  ring(p.clone().add(new V(0,.05,0)),.3,7*s,.55,0xffd8a0);ring(p.clone().add(new V(0,1,0)),.3,5*s,.35,0xfff0d0,camera.position.clone().sub(p).normalize());
  burst(norP,32*s,{p:p.clone().add(new V(0,.6,0)),r:.8*s,dir:UP,cone:1.1,sp:[1,3],drag:1.2,life:[3,6],size:[1*s,1.8*s],grow:2.6,c0:0x2b2724,c1:0x0f1013,a:.6,fi:.18,g:-.35});
  for(let i=0;i<n(44);i++){const a=Math.random()*6.283;norP.spawn({p:p.clone().add(new V(Math.cos(a)*.5,.15,Math.sin(a)*.5)),dir:new V(Math.cos(a),.08,Math.sin(a)),cone:.15,sp:[4,9*s],drag:2.4,life:[1.4,2.6],size:[.5,.9],grow:4,c0:0x5d574d,c1:0x2a2724,a:.5,fi:.1});}
  if(Q.level<2)burst(streak,44*s,{p,dir:UP,cone:1.45,sp:[10,26],life:[.3,.7],len:.03,c0:0xffc070,c1:0x802000,g:9.8,gnd:2});
  for(let i=0;i<n(16*s);i++)debris({p,dir:UP,cone:1.2,sp:[3,9],size:[.12,.06,.1],k:[.6,1.6],c:o.chip||0x2a2622,life:9});
  decal(p.x,groundAt(p.x,p.z),p.z,3*s,0x0a0a0a,{grow:.15,life:60});
}
function muzzle(w,tip,dir){
  const W={glock:[.35,4,3,3,.25],ak:[.6,5,5,5,.45],r870:[.95,8,7,10,.6],barrett:[1.45,6,11,14,.5]}[w];const [fs,pet,li,sm,len]=W;
  burst(addP,3,{p:tip,size:[fs*.45,fs*.75],life:.055,c0:0xfff4d0,fi:0});
  for(let i=0;i<n(pet*2);i++)addP.spawn({p:tip.clone().addScaledVector(dir,rnd(0,len)),r:.03,size:[fs*.22,fs*.38],life:.06,c0:0xffb050,c1:0xff7020,fi:0});
  burst(streak,pet,{p:tip,dir,cone:.55,sp:[6,12],life:.05,len:.025,c0:0xffd080});
  if(w==='barrett'){const side=new V(dir.z,0,-dir.x).normalize();for(const s of[-1,1]){for(let i=0;i<n(8);i++)addP.spawn({p:tip.clone().addScaledVector(side,s*.06),dir:side.clone().multiplyScalar(s),cone:.25,sp:[2,5],drag:6,life:.09,size:[.25,.4],c0:0xffc070,c1:0xff6010,fi:0});
      burst(norP,10,{p:tip,dir:side.clone().multiplyScalar(s).add(new V(0,.2,0)).normalize(),cone:.3,sp:[1.5,3],drag:2,life:[1.2,2],size:[.15,.25],grow:5,c0:0x8a8a86,a:.3,g:-.2});}
    for(let i=0;i<n(26);i++){const a=Math.random()*6.283;norP.spawn({p:new V(tip.x+Math.cos(a)*.3,.05,tip.z+Math.sin(a)*.3),dir:new V(Math.cos(a),.15,Math.sin(a)),cone:.2,sp:[1.5,3.5],drag:2,life:[1,1.8],size:[.2,.35],grow:3,c0:0x5a554b,a:.4});}}
  burst(norP,sm,{p:tip,dir,cone:.45,sp:[.4,1.6],drag:2.2,life:[1,2.2],size:[.06,.14],grow:6,c0:0x8a8a86,c1:0x55565a,a:.22,g:-.25,fi:.05});
  flash(tip,0xffc070,li,.05,10);
}
function casing(port,type){const sz=type==='shell'?[.03,.03,.07]:type==='50'?[.024,.024,.13]:[.014,.014,.05];debris({p:port,dir:new V(.8,.6,.2).normalize(),cone:.3,sp:[1.6,2.6],size:sz,c:type==='shell'?0xb5281e:0xc9a24a,spin:20,bounce:.45,life:20});}

// ---------- props reset
function resetProps(){
  ZS.forEach(resetZombie);H.forEach(z=>z.g.visible=false);Z.g.position.set(0,0,0);
  glass.visible=true;glassCracks.length=0;drawGlass();
  doorG.rotation.set(0,0,0);doorG.position.set(2,.12,-4.45);planks.forEach(p=>{p.visible=true;p.rotation.set(0,0,0);p.position.set(0,p.userData.y0,.04);p.material.color.setHex(0x6b4a2a);});
  slab.visible=true;fireWins.forEach(w=>w.material.color.setHex(0x0d1217));
  car.position.set(CAR0.x,0,CAR0.z);car.rotation.set(0,CAR0.ry,0);car.userData.vy=null;car.visible=true;carBodyMat.color.setHex(0x5a2b26);carCabMat.color.setHex(0x15191d);ws.visible=true;wsMarks.length=0;drawWS();
  headSpots.forEach(s=>s.intensity=0);headCones.forEach(c=>c.visible=false);hlMat.color.setHex(0x3a3a34);
  barrel.visible=true;bwReset();destReset();tbReset();cyReset();can.visible=false;fluidL.intensity=0;gun.visible=false;camp.visible=false;surv.g.visible=false;surv.b.rotation.set(0,0,0);flashSpot.intensity=0;flashCone.visible=false;
  lampCone.visible=false;scene.fog.density=FOG0;hemi.intensity=.6;scene.background.setHex(NIGHT);
  fireL.intensity=0;fireL2.intensity=0;rain.visible=false;RN.on=false;
  setNote('');
}
function clearFX(){addP.clear();norP.clear();streak.clear();for(const d of DB)if(d.on){d.on=false;}for(let i=0;i<DMAX;i++)debIM.setMatrixAt(i,ZERO);for(const d of DC)d.on=false;for(let i=0;i<DCMAX;i++){decIM.setMatrixAt(i,ZERO);decIMd.setMatrixAt(i,ZERO);}
  for(const r of RG)r.on=false;for(let i=0;i<RMAX;i++)ringIM.setMatrixAt(i,ZERO);LP.forEach(l=>l.L.intensity=0);for(const k in acc)delete acc[k];timers.length=0;clearScreen();}
const timers=[];function at(t,fn){timers.push({t,fn});}
function setNote(t){$('note').textContent=t;}
const zone=new V();

// ---------- effect catalogue
const TEAMS=[
  {k:'z',n:'Zumbis',c:'#9fc25a',page:'Bestiário ZombiAdA',url:'../zumbis-personagens/bestiario.html'},
  {k:'a',n:'Armas e explosivos',c:'#ff9d3c',page:'Arsenal ZombiAdA',url:'../armas-itens/arsenal.html'},
  {k:'m',n:'Mapa, clima e destruição',c:'#c9c2b4',page:'Mapa do Vale Cinzento',url:'../mapa/mapa-vale-cinzento.html'},
  {k:'d',n:'Destruição de cenário',c:'#d0b48a',page:'Galeria 3D · Destruição',url:'../armas-itens/galeria-3d-arsenal.html'},
  {k:'v',n:'Veículos',c:'#7fb0d6',page:'Frota ZombiAdA',url:'../../../veiculos/frota.html'},
  {k:'p',n:'Personagens e efeitos de tela',c:'#e8a3c0',page:'ZombiAdA Personagens',url:'../zumbis-personagens/personagens.html'}
];
const FX=[];
function def(o){FX.push(o);}
const zp=()=>Z.g.position;

// ZUMBIS
def({id:'sangue',team:'z',name:'Sangue por idade da infecção',short:'Névoa na entrada, jato na saída, poça que cresce. A idade muda cor e quantidade.',cost:'≤ 70 part.',costb:'1 poça · 6 respingos',
  cam:[2.6,1.9,3.4],tgt:[0,1,-.6],loop:3.2,param:{lbl:'Idade',opts:AGE,def:0},
  q:'Cada acerto de bala ou golpe em zumbi. O valor de sangue vem da idade do bestiário: 1,0 · 0,7 · 0,35 · 0,1.',
  v:'Fresco espirra vermelho vivo e pinga. Recente sai bordô. Antigo sai marrom e pouco. Decrépito não sangra: solta pó preto e lascas secas. A poça cresce por 2 a 4 s e escurece em 60 s.',
  b:'Até 70 partículas por acerto (Fresco), 1 poça e até 6 respingos no chão. Gotas que caem viram decalque.',
  r:'Cosmético. Vai no evento de impacto com 2 bits de idade e a semente.',
  run(pr){const age=pr;at(.3,()=>{bloodHit(new V(0,1.3,.1),new V(.15,.1,-1).normalize(),age);});at(1.5,()=>{bloodHit(new V(.1,1.05,.1),new V(-.2,.05,-1).normalize(),age,.8);});
    if(age<3)at(.7,()=>decal(0,0,-.2,.5+.7*[1,.7,.35][age],BLOOD[age],{grow:2+2*[1,.7,.35][age],dark:60,dry:0x3b1d14}));
    setNote('Idade: '+AGE[age]+' · valor de sangue '+[1,.7,.35,.1][age].toFixed(2).replace('.',','));},
  tick(dt,t,pr){if(pr<2&&t>.3)emit('drip',norP,pr===0?7:3,dt,()=>({p:new V(.05,1.15,.17),box:[.08,.05,0],dir:UP,cone:.2,sp:[0,.2],life:1.2,size:.03,c0:BLOOD[pr],g:9.8,fi:0,gnd:3,ds:[.04,.08]}));}
});
def({id:'headshot',team:'z',name:'Headshot',short:'A cabeça estoura, os olhos apagam no mesmo quadro e o corpo cai.',cost:'≤ 70 part.',costb:'8 detritos · 1 poça',
  cam:[2.2,1.8,3],tgt:[0,1.2,-.5],loop:3.2,
  q:'Acerto na cabeça que mata (regra do bestiário: cabeça mata na hora).',
  v:'Névoa vermelha em volta da cabeça, jato de gotas para trás, 6 a 8 pedaços de osso e pele, troca pela malha de pescoço estourado. O brilho dos olhos apaga no mesmo quadro, que é o sinal mais legível de longe.',
  b:'20 de névoa + 35 gotas + 8 detritos + 1 poça. Na horda, só os 12 mais próximos ganham detritos.',
  r:'Cosmético. O servidor já manda “morte por cabeça”.',
  run(){at(.45,()=>{const hp=new V(0,1.7,0);Z.head.visible=false;Z.eyes.forEach(e=>e.visible=false);Z.glow.visible=false;
      burst(norP,20,{p:hp,r:.1,sp:[.4,1.8],drag:3,life:[.4,.75],size:[.12,.2],grow:3,c0:BLOOD[0],a:.7});
      burst(norP,35,{p:hp,dir:new V(0,.45,-1).normalize(),cone:.8,sp:[2,5],life:1.5,size:[.035,.065],c0:BLOOD[0],g:9.8,fi:0,gnd:3,ds:[.06,.14]});
      for(let i=0;i<n(8);i++)debris({p:hp,dir:new V(0,.6,-1).normalize(),cone:.9,sp:[1.5,4],size:[.06,.05,.06],k:[.5,1.2],c:i%2?0xd9cfbf:0x6d7a5a,life:8});
      flash(hp,0xff3020,1.2,.08,4);zfall(Z,.05,.7);});
    at(1.4,()=>decal(0,0,-1.5,.9,BLOOD[0],{grow:2.4,dark:60,dry:0x3b1d14}));}
});
def({id:'membro',team:'z',name:'Desmembramento',short:'O braço sai inteiro com física e o ombro jorra por meio segundo.',cost:'≤ 60 part.',costb:'1 membro · 4 respingos',
  cam:[3,1.8,2.2],tgt:[.4,1.1,0],loop:3.6,
  q:'Dano no membro acima do limite (multiplicadores por região do bestiário) ou golpe de machado.',
  v:'O membro vira peça solta com física e quica. Jato curto do ombro em pulsos, gotas que formam um rastro até a poça. O zumbi cambaleia mas continua andando.',
  b:'1 membro com física (conta no teto de 300), jato de até 60 gotas em 0,7 s.',
  r:'O servidor manda qual membro saiu. A peça é local; cada cliente simula a sua.',
  run(){at(.4,()=>{Z.arms[1].visible=false;const sp=new V(.36,1.46,.05);debris({p:sp,v:new V(2.2,2.5,-.6),sp:0,size:[.12,.12,.66],c:0x6d7a5a,spin:9,life:12,bounce:.25});
      burst(norP,12,{p:sp,r:.05,sp:[.3,1.2],drag:3,life:[.3,.6],size:[.1,.16],grow:3,c0:BLOOD[0],a:.6});Z.b.rotation.z=-.15;});},
  tick(dt,t){if(t>.4&&t<1.1){const pulse=Math.sin((t-.4)*28)>0?1:.2;emit('jet',norP,90*pulse,dt,()=>({p:new V(.36,1.46,.05),dir:new V(1,.35,.1).normalize(),cone:.25,sp:[1.5,3],life:1.4,size:[.03,.055],c0:BLOOD[0],g:9.8,fi:0,gnd:3,ds:[.05,.12]}));}}
});
def({id:'inchado',team:'z',name:'Nuvem do Inchado',short:'Barriga pulsa por 0,5 s, estoura e deixa 4 m de gás por 8 s.',cost:'≤ 180 part.',costb:'entidade no servidor',
  cam:[5.5,3.2,6],tgt:[0,1,0],loop:9,
  q:'Morte do Inchado, por qualquer causa.',
  v:'Aviso de 0,5 s com a barriga inchando, estouro com pedaços e jato esverdeado, e uma nuvem baixa verde-musgo que ondula no chão por 8 s. Brilhos verdes soltos dentro da nuvem marcam a área.',
  b:'40 sprites grandes no estouro e até 60 vivos na nuvem, em meia resolução. Fade perto da câmera para não pintar a tela inteira.',
  r:'Entidade no servidor (raio 4 m, 8 s): cega por 5 s, dobra o rastro de cheiro e faz tossir. O cliente só desenha.',
  setup(){Z.torso.scale.set(1.4,1.25,1.6);Z.mS.color.setHex(0x6b7a52);setEye(Z,0x5fe08a);},
  run(){at(1.0,()=>{Z.g.visible=false;const c=new V(0,1.1,0);
      burst(norP,40,{p:c,r:.4,sp:[1.5,4],drag:2.2,life:[4,6],size:[1,2.2],grow:2,c0:0x6f8a3c,c1:0x3b4a26,a:.32,fi:.08,g:.05});
      burst(norP,30,{p:c,dir:UP,cone:1.3,sp:[2,4],life:1.4,size:[.04,.08],c0:0x4a5a1c,g:9.8,fi:0,gnd:3,ds:[.1,.2]});
      for(let i=0;i<n(10);i++)debris({p:c,dir:UP,cone:1.2,sp:[2,5],size:[.07,.05,.07],k:[.6,1.4],c:i%2?0x6b7a52:0x4a1a12,life:9});
      decal(0,0,0,1.6,0x6a7a24,{grow:.6,life:60,fluid:'bile'});ring(new V(0,.02,0),4,4,8,0x3a5a20,UP,.35);S.shake+=.15;});},
  tick(dt,t){if(t<1){const k=t;Z.torso.scale.set(1.4+Math.sin(k*30)*.08*k,1.25,1.6+Math.sin(k*30)*.1*k);}
    if(t>1&&t<8){emit('gas',norP,7,dt,()=>({p:new V(0,.4,0),r:3.4,flat:true,dir:UP,cone:1.3,sp:[.1,.35],drag:.4,life:[3,5],size:[1.2,2.2],grow:1.5,c0:0x6f8a3c,c1:0x3b4a26,a:.22,fi:.3}));
      emit('mote',addP,10,dt,()=>({p:new V(0,.6,0),r:3.6,flat:true,dir:UP,cone:.6,sp:[.05,.25],life:[1.5,2.5],size:[.04,.07],c0:0x5fe08a,a:.7,fi:.4}));}}
});
def({id:'grito',team:'z',name:'Grito do Gritador',short:'Preparo de 1,5 s com vapor, onda no chão e os olhos da horda acendem.',cost:'≤ 150 part.',costb:'3 anéis · aberração',
  cam:[6,3,7],tgt:[0,1,-1],loop:5,
  q:'O Gritador avista o jogador e começa o grito (preparo de 1,5 s, chama todos num raio de 150 m).',
  v:'Cabeça para trás e vapor saindo da boca durante o preparo. No grito, três anéis de pressão no chão, poeira levantada no raio, aberração cromática curta na tela de quem está perto e os olhos dos zumbis próximos piscam forte quando escutam.',
  b:'3 anéis, até 150 partículas de poeira. A aberração na tela é um efeito de pós de 0,4 s.',
  r:'O servidor manda “grito em X”. O efeito de tela depende da distância local.',
  setup(){setEye(Z,0xf2f2ea);[[-6,-1],[7,-2],[-4,6],[6,5]].forEach(([x,z],i)=>{const h=H[i];h.g.visible=true;h.g.position.set(x,0,z);h.g.rotation.y=Math.atan2(-x,-z)+1.2;});},
  run(){at(1.7,()=>{for(let i=0;i<3;i++)at(1.7+i*.18,()=>ring(new V(0,.03,0),.3,9,.9,0xe8e2d0));S.chroma+=7;S.shake+=.25;
      H.slice(0,4).forEach((h,i)=>at(1.9+i*.12,()=>{h.glow.scale.set(1.2,.5,1);h.g.rotation.y=Math.atan2(-h.g.position.x,-h.g.position.z);}));});},
  tick(dt,t){if(t<1.7){Z.head.rotation.x=-ease(t/1.2)*.6;emit('vap',norP,18,dt,()=>({p:new V(0,1.68,.2),dir:new V(0,.5,1).normalize(),cone:.3,sp:[.6,1.2],drag:1.5,life:[.8,1.3],size:[.05,.1],grow:5,c0:0xd8dde2,a:.2}));}
    else if(t<2.6){const r=(t-1.7)/.9*8;emit('dust',norP,140,dt,()=>{const a=Math.random()*6.283;return{p:new V(Math.cos(a)*r,.05,Math.sin(a)*r),dir:new V(Math.cos(a),.6,Math.sin(a)).normalize(),cone:.3,sp:[.6,1.6],drag:2,life:[.8,1.4],size:[.2,.35],grow:3,c0:0x5d574d,a:.35};});Z.head.rotation.x=-.6+Math.sin(t*60)*.05;}
    H.slice(0,4).forEach(h=>{h.glow.scale.x=Math.max(.45,h.glow.scale.x-dt*.5);h.glow.scale.y=Math.max(.2,h.glow.scale.y-dt*.2);});}
});
def({id:'olhos',team:'z',name:'Olhos na neblina',short:'Brilho dos olhos que fura a neblina; os corredores deixam rastro vermelho.',cost:'2 sprites/zumbi',costb:'0 luzes',
  cam:[-9,1.7,2],tgt:[6,1.3,2],loop:0,
  q:'Sempre, em todo zumbi. É o sistema de leitura do bestiário: cor do olho diz a categoria.',
  v:'Dois pontos emissivos com bloom que ignoram a neblina. O corpo some na névoa a 25 m, os olhos continuam legíveis a 60 m. Corredores deixam um rastro curto da cor do olho quando correm.',
  b:'2 sprites por zumbi no mesmo lote instanciado do corpo. Rastro só para corredores a menos de 30 m. Nenhuma luz real.',
  r:'Nada vai pela rede: sai da categoria do zumbi.',
  setup(){scene.fog.density=.065;H.forEach((h,i)=>{h.g.visible=true;h.g.position.set(rnd(4,34),0,rnd(-1.5,5.5));h.run=EYES[i]===0xe5392b;h.g.rotation.y=-Math.PI/2;zwalk(h,new V(-12,0,h.g.position.z),h.run?3.8:.7);});},
  tick(dt){H.forEach(h=>{if(h.g.position.x<-8){h.g.position.x=rnd(28,36);zwalk(h,new V(-12,0,h.g.position.z),h.run?3.8:.7);}else if(!h.st.walk)zwalk(h,new V(-12,0,h.g.position.z),h.run?3.8:.7);
      if(h.run&&Q.level<2){h.g.updateMatrixWorld();const ep=new V(0,1.74,.2).applyMatrix4(h.b.matrixWorld);streak.spawn({p:ep,dir:new V(1,0,0),cone:0,sp:3.8,v:new V(-3.8,0,0),life:.25,len:.06,c0:0xe5392b,c1:0x400000,a:.8});}});}
});
def({id:'corpo',team:'z',name:'Corpo: escurecer e dissolver',short:'15 minutos em 8 segundos: queda, escurece, moscas e vira pó.',cost:'≤ 40 part.',costb:'pool de 400 corpos',
  cam:[2.4,1.6,2.6],tgt:[0,.3,-.6],loop:8.5,
  q:'Morte do zumbi. Linha do tempo do bestiário: ragdoll 3 s, malha congelada, escurece, dissolve entre 14 e 15 min.',
  v:'A pele perde a cor até ficar quase preta, a poça seca para marrom, aparecem moscas a partir do minuto 5 e no último minuto o corpo afunda e solta pó escuro.',
  b:'Moscas: 6 partículas por corpo, só a menos de 10 m. Pó: 40 partículas uma vez. O corpo usa o shader de dissolve, sem partícula extra.',
  r:'O servidor manda a hora da morte; cada cliente calcula o estado.',
  run(){zfall(Z,.2,.7);at(.8,()=>decal(0,0,-.9,1.1,BLOOD[1],{grow:1.5,dark:5,dry:0x3b1d14}));},
  tick(dt,t){const min=Math.min(15,t<1?0:(t-1)/6.5*15);setNote('minuto '+min.toFixed(0)+' de 15');
    const k=clamp((t-1.5)/4,0,1);Z.mS.color.setHex(0x6d7a5a).lerp(tc.setHex(0x1f221b),k);Z.mC.color.setHex(0x3f3a34).lerp(tc.setHex(0x1a1816),k);
    if(t>2.5&&t<7)emit('fly',norP,6,dt,()=>({p:new V(0,.35,-.8),r:.5,sp:[.3,.8],life:[.6,1.2],size:.02,c0:0x050505,a:1,fi:.2}));
    if(t>6.8){const d=clamp((t-6.8)/1.2,0,1);Z.g.position.y=-.28*d;Z.g.scale.set(1,1-d*.6,1);if(t<7.6)emit('dust',norP,40,dt,()=>({p:new V(0,.15,-.8),box:[.25,.05,.8],dir:UP,cone:.6,sp:[.2,.6],drag:1,life:[1,1.8],size:[.12,.22],grow:3,c0:0x2b2722,a:.5}));if(d>=1)Z.g.visible=false;}}
});
def({id:'reanima',team:'z',name:'Reanimação',short:'Veias acendem, espasmos, os olhos ligam e o corpo levanta.',cost:'≤ 30 part.',costb:'emissivo no shader',
  cam:[2.4,1.4,2.4],tgt:[0,.6,-.4],loop:6.5,
  q:'Fim da infecção de jogador ou NPC: reanima em 2 a 6 min como Fresco (70% Lento, 30% Corredor).',
  v:'Pulsos verdes pela pele (emissivo no shader, não partícula), espasmos nos braços e na cabeça, os olhos acendem de dentro para fora e o corpo se levanta. Respiração em vapor no primeiro grito.',
  b:'Só emissivo animado e 30 partículas. É raro e importante, então pode ser caro.',
  r:'O servidor manda “reanimou”. Para o amigo que vê o colega levantar, é o momento mais forte do coop.',
  setup(){Z.b.rotation.x=-Math.PI/2;Z.st.lie=true;Z.eyes.forEach(e=>e.visible=false);Z.glow.material.opacity=0;Z.mS.color.setHex(0xb59072);},
  tick(dt,t){if(t<3.4){const pul=Math.max(0,Math.sin(t*(4+t*3)));Z.mS.emissive.setRGB(.05*pul,.22*pul,.04*pul);if(t>1){Z.arms.forEach((a,i)=>a.rotation.x=.25+Math.sin(t*37+i)*.3*Math.random());Z.head.rotation.y=Math.sin(t*41)*.2;}
      if(t>.6)emit('mote',addP,8,dt,()=>({p:new V(0,.2,-.8),box:[.25,.05,.6],dir:UP,cone:.4,sp:[.2,.5],life:[.6,1],size:[.03,.05],c0:0x9fc25a,a:.7,fi:.3}));}
    if(t>2.8&&t<3.6){Z.eyes.forEach(e=>e.visible=true);Z.glow.material.opacity=clamp((t-2.8)/.6,0,1);Z.mS.color.setHex(0x8a9070);}
    if(t>=3.6){Z.mS.emissive.setHex(0);Z.st.lie=false;const k=ease((t-3.6)/1.2);Z.b.rotation.x=-Math.PI/2*(1-k);}
    if(t>5&&t<5.6)emit('br',norP,20,dt,()=>({p:new V(0,1.68,.2),dir:new V(0,.3,1).normalize(),cone:.3,sp:[.6,1.1],drag:1.5,life:1.2,size:[.05,.1],grow:5,c0:0xd8dde2,a:.2}));}
});

// ---------- fluid props
const can=new THREE.Group();scene.add(can);const canM=mat(0xa3201c,{roughness:.5,metalness:.3});mesh(Bx(.32,.42,.16),canM,0,.21,0,can);mesh(Bx(.05,.1,.05),mat(0x2a2a2a),.12,.47,0,can);can.visible=false;
const fluidL=new THREE.PointLight(0xdfe6f0,0,9,1.6);scene.add(fluidL);
// fluid film: one grid folded over wall (rows 0-159), sidewalk (160-287), curb face (288-296) and road (297-447); 1.25 cm cells, thickness in mm.
// Flat film: thickness only changes colour, opacity and normal. Model and numbers follow the fluid review reference (Padrão de fluidos).
const FW=160,FC=.0125,FX0=-2.2,ROWW=160,ROWS=288,ROWC=297,FH=448,FN=FW*FH;
const FWT=2.12,FWZ=-4.497,FSY=.1235,FRY=.009,FZC=FWZ+(ROWS-ROWW)*FC,FCH=(FSY-FRY)/(ROWC-ROWS),FMM=FC*1000;
const fh=new Float32Array(FN),fdry=new Float32Array(FN),fwg=new Float32Array(FN),fdel=new Float32Array(FN),fb=new Float32Array(FN),fpn=new Float32Array(FN),fvert=new Float32Array(FN);
function fhash(x,y){let n=(x*374761393+y*668265263)|0;n=(n^(n>>>13))*1274126177|0;return((n^(n>>>16))>>>0)/4294967296;}
function fnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=fhash(xi,yi),b=fhash(xi+1,yi),c=fhash(xi,yi+1),d=fhash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fReg(r){return r<ROWW?0:r<ROWS?1:r<ROWC?2:3;}
for(let r=0;r<FH;r++)for(let c=0;c<FW;c++){const i=r*FW+c,g=fReg(r),x=FX0+(c+.5)*FC;let b,rough=.2;
  if(g===0){b=(FWT-(r+.5)*FC)*1000;rough=.3;}
  else if(g===1){const z=(r-ROWW+.5)*FC;b=FSY*1000-z*6;const jx=Math.abs(((x-FX0)%.5+.5)%.5-.25),jz=Math.abs((z%.5+.5)%.5-.25);if(jx>.25-FC*.6||jz>.25-FC*.6)b-=.9;rough=.18;}
  else if(g===2)b=FSY*1000-(r-ROWS+.5)*FCH*1000;
  else{const z=(r-ROWC+.5)*FC;b=FRY*1000+z*14-(x+1.2)*5;rough=.55;}
  const n=fnoise(c*.35,r*.35)*.6+fnoise(c*1.3,r*1.3)*.4;fb[i]=b+(n-.5)*rough*2;
  fvert[i]=(g===0||g===2)?.95:1;fpn[i]=.62+.76*(fnoise(c*.21+40,r*.21)*.5+fhash(c,r)*.5)*(g===3?1.25:1);}
const fC=hex=>{const c=new Col(hex);return new V(c.r,c.g,c.b);};
// K flow, pin = film that stays behind, front = thickness needed to wet a dry cell (gives the bulb at the tip), dryT game seconds, spd = drying speed-up in the preview
const FT={blood:{K:.05,pin:.33,front:.58,h0:.6,gcap:1.1,dryT:600,evap:0,opK:3.2,F0:.045,nrm:16,thin:fC(0x7a0a0e),thick:fC(0x2a0204),dry:fC(0x3b1d14),dryThin:fC(0x6a3626),drop:0x7a0a0d,vol:1,fl:0,spd:50,spk:1},
  bile:{K:.02,pin:.8,front:1.2,h0:1.2,gcap:.9,dryT:900,evap:0,opK:7,F0:.04,nrm:12,thin:fC(0xa9b43c),thick:fC(0x6d781b),dry:fC(0x3e4220),dryThin:fC(0x565a2c),drop:0x8a9a2a,vol:1.3,fl:2,spd:70,spk:.3},
  oil:{K:.03,pin:.12,front:.22,h0:.5,gcap:1,dryT:0,evap:0,opK:4.5,F0:.06,nrm:18,thin:fC(0x15130f),thick:fC(0x040405),dry:fC(0x040405),dryThin:fC(0x15130f),drop:0x0a0a0c,vol:1,fl:3,spd:1,spk:1},
  fuel:{K:.2,pin:.035,front:.07,h0:.2,gcap:1.2,dryT:0,evap:.02,opK:.25,F0:.04,nrm:0,thin:fC(0x9a9070),thick:fC(0x6e6446),dry:fC(0),dryThin:fC(0),drop:0xb8b090,vol:1.4,fl:4,spd:4,spk:1}};
let FL=FT.blood;
function fDep(r,c,a){r=Math.round(r);c=Math.round(c);if(r<0||c<0||r>=FH||c>=FW||!(a>0))return;const i=r*FW+c;fh[i]+=a;if(a>.02)fdry[i]*=.15;fwg[i]=1;}
// filled ellipse with a noisy outline; a along (ux,uy) [cols,rows], b across; amt = centre thickness in mm
function fBlob(cr,cc,a,b,ux,uy,amt,rough){const R=Math.random,p0=R()*6.28,p1=R()*6.28,p2=R()*6.28,p3=R()*6.28,E=Math.ceil(Math.max(a,b)*(1+rough)+1.5);
  for(let rr=Math.floor(cr-E);rr<=cr+E;rr++)for(let c=Math.floor(cc-E);c<=cc+E;c++){const dx=c+.5-cc,dy=rr+.5-cr,al=dx*ux+dy*uy,ac=-dx*uy+dy*ux,ang=Math.atan2(ac/b,al/a);
    const e=1+rough*(.45*Math.sin(3*ang+p0)+.3*Math.sin(5*ang+p1)+.18*Math.sin(8*ang+p2)+.12*Math.sin(13*ang+p3));const q=((al/a)**2+(ac/b)**2)/(e*e);if(q<1)fDep(rr,c,amt*Math.sqrt(1-q));}}
// tapered stroke
function fStroke(r0,c0,r1,c1,w0,w1,amt){const L=Math.hypot(r1-r0,c1-c0),n=Math.max(2,Math.ceil(L*2.5));
  for(let k=0;k<=n;k++){const t=k/n,r=r0+(r1-r0)*t,c=c0+(c1-c0)*t,w=w0+(w1-w0)*t,E=Math.ceil(w+1);
    for(let rr=Math.floor(r-E);rr<=r+E;rr++)for(let cc=Math.floor(c-E);cc<=c+E;cc++){if(rr<0||cc<0||rr>=FH||cc>=FW)continue;const d=Math.hypot(rr+.5-r,cc+.5-c);if(d<w){const i=rr*FW+cc,v=amt*(1-d/w)*.5;if(fh[i]<v)fDep(rr,cc,v-fh[i]);}}}}
// impact: body stretched by 1/sin of the angle, short tapering spikes (long only along travel), satellites with tails. spk<1 = thick blobs (bile)
function fSplat(cr,cc,size,ux,uy,sinA,amt){const R=Math.random,sk=FL.spk;
  sinA=clamp(sinA,.17,1);const el=Math.min(5.5,1/sinA),a=size*Math.pow(el,.75),b=size/Math.pow(el,.25);const fr=cr+uy*a*.25,fc=cc+ux*a*.25;
  fBlob(fr,fc,a,b,ux,uy,amt,.1+.12*(1-sinA)+(size<1.4?0:.06));const vx=-uy,vy=ux;
  const ns=Math.round(Math.min(18,(size<1.2?1:4)+size*1.6+5*(1-sinA))*sk);
  for(let k=0;k<ns;k++){const spread=Math.PI*(.25+.75*sinA*sinA);let th=(R()*2-1)*spread;if(sinA>.9)th=R()*6.283;
    const ct=Math.cos(th),st=Math.sin(th),dx=ct*ux+st*vx,dy=ct*uy+st*vy;const len=size*(.25+R()*.55)*(1+2.6*(1-sinA)*Math.max(0,ct))*(sinA>.9?.6:1)*(.5+.5*sk);
    const sr=fr+(a*ct*uy+b*st*vy)*.75,sc=fc+(a*ct*ux+b*st*vx)*.75,er=sr+dy*len,ec=sc+dx*len;
    fStroke(sr,sc,er,ec,Math.max(.55,size*.22),.42,amt*.75);if(R()<.5){const g=1+R()*2.2;fBlob(er+dy*g,ec+dx*g,.55+R()*.7,.5+R()*.4,dx,dy,amt*.55,.08);}}
  const nsat=Math.round((1+size*.9)*(1.4-sinA*.6)*(.5+.5*sk));
  for(let k=0;k<nsat;k++){const cone=sinA>.9?Math.PI:(.18+.6*sinA),th=(R()*2-1)*cone,ct=Math.cos(th),st=Math.sin(th),dx=ct*ux+st*vx,dy=ct*uy+st*vy;
    const d=a+size*(.8+R()*3.2),s=.45+R()*Math.min(1.2,size*.22),r=fr+dy*d,c=fc+dx*d;fBlob(r,c,s*Math.sqrt(el),s,dx,dy,amt*.6,.08);
    if(sinA<.8)fStroke(r+dy*s*el*.7,c+dx*s*el*.7,r+dy*s*el*1.8,c+dx*s*el*1.8,.5,.3,amt*.35);}}
// thin-film flow on the bed; only film above the pin moves, a dry cell needs the front thickness, walls move sideways at 0.22x
let fbb={r0:0,r1:-1,c0:0,c1:-1};
function fBox(){let r0=FH,r1=-1,c0=FW,c1=-1;for(let r=0;r<FH;r++){const o=r*FW;let any=false;for(let c=0;c<FW;c++)if(fh[o+c]>0){any=true;if(c<c0)c0=c;if(c>c1)c1=c;}if(any){if(r<r0)r0=r;r1=r;}}
  fbb=r1<0?{r0:0,r1:-1,c0:0,c1:-1}:{r0:Math.max(0,r0-8),r1:Math.min(FH-1,r1+8),c0:Math.max(0,c0-8),c1:Math.min(FW-1,c1+8)};}
function fMob(i){const d=fdry[i];return d<.25?1:d>.6?0:1-(d-.25)/.35;}
function fStep(){const{r0,r1,c0,c1}=fbb;if(r1<0)return;const F=FL,K=F.K,h0s=F.h0*F.h0,gc=F.gcap,pin=F.pin,fr=F.front;
  for(let r=r0;r<=r1;r++){const o=r*FW;for(let c=c0;c<=c1;c++)fdel[o+c]=0;}
  for(let r=r0;r<=r1;r++){const o=r*FW;for(let c=c0;c<=c1;c++){const i=o+c,hi=fh[i];
    for(let e=0;e<2;e++){let j;if(e===0){if(c>=c1)continue;j=i+1;}else{if(r>=r1)continue;j=i+FW;}
      const hj=fh[j];if(hi<.005&&hj<.005)continue;let db=fb[i]-fb[j];if(db>gc)db=gc;else if(db<-gc)db=-gc;let dh=db+hi-hj,s=i,d=j;if(dh<0){dh=-dh;s=j;d=i;}
      const hs=fh[s],pv=fvert[s],po=pin*fpn[s]*(pv<1?.5:1);if(hs<=po)continue;if(fh[d]<.03&&hs<fr*fpn[s]*pv)continue;const m=fMob(s);if(m<=0)continue;
      let f=K*m*(hs*hs/(hs*hs+h0s))*dh*(pv<1?(e===0?.22:1):4);const lim=(hs-po)*.24;if(f>lim)f=lim;fdel[s]-=f;fdel[d]+=f;}}}
  for(let r=r0;r<=r1;r++){const o=r*FW;for(let c=c0;c<=c1;c++){const i=o+c;let v=fh[i]+fdel[i];if(v<1e-4)v=0;else fwg[i]=1;fh[i]=v;}}}
// drying from the thin edge inward; gasoline evaporates from the edge
function fAge(dtg){const{r0,r1,c0,c1}=fbb;if(r1<0)return;const F=FL;
  for(let r=r0;r<=r1;r++){const o=r*FW;for(let c=c0;c<=c1;c++){const i=o+c,hi=fh[i];
    if(hi>0){const thin=1-Math.min(1,hi/1.6);if(F.dryT>0&&fdry[i]<1)fdry[i]=Math.min(1,fdry[i]+dtg/F.dryT*(.45+1.7*thin));
      if(F.evap>0){const v=hi-F.evap*dtg*(.5+1.5*thin);fh[i]=v>.004?v:0;}}
    else if(fwg[i]>0)fwg[i]=Math.max(0,fwg[i]-dtg/(F.evap>0?25:1e9));}}}
const ftexD=new Uint8Array(FN*4);const ftex=new THREE.DataTexture(ftexD,FW,FH,THREE.RGBAFormat);ftex.magFilter=THREE.LinearFilter;ftex.minFilter=THREE.LinearFilter;ftex.needsUpdate=true;
function fUpload(){for(let i=0,j=0;i<FN;i++,j+=4){const v=fh[i];ftexD[j]=v>0?Math.min(255,Math.sqrt(Math.min(6,v)/6)*255+.5):0;ftexD[j+1]=fdry[i]*255;ftexD[j+2]=fwg[i]*255;ftexD[j+3]=255;}ftex.needsUpdate=true;}
function fClear(){fh.fill(0);fdry.fill(0);fwg.fill(0);fUpload();fBox();}
const FU={tF:{value:ftex},tx:{value:new THREE.Vector2(1/FW,1/FH)},uT:{value:0},uFl:{value:0},cThin:{value:new V()},cThick:{value:new V()},cDry:{value:new V()},cDryThin:{value:new V()},
  opK:{value:3},F0:{value:.04},nrm:{value:16},camP:{value:new V()},lampP:{value:new V()}};
const fluidMat=new THREE.ShaderMaterial({uniforms:FU,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
  vertexShader:`attribute vec3 aB;varying vec2 vUv;varying vec3 vPos,vN,vB;void main(){vUv=uv;vPos=position;vN=normal;vB=aB;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;uniform sampler2D tF;uniform vec2 tx;uniform float uT;uniform int uFl;uniform vec3 cThin,cThick,cDry,cDryThin,camP,lampP;uniform float opK,F0,nrm;varying vec2 vUv;varying vec3 vPos,vN,vB;
  float hsh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  vec2 hsh2(vec2 p){return vec2(hsh(p),hsh(p+17.7));}
  float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
  float vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 r=o+hsh2(i+o)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(d2)-sqrt(d1);}
  float hs(vec2 u){float r=texture2D(tF,u).r;return r*r*6.;}
  void main(){vec4 S=texture2D(tF,vUv);vec2 q=tx*.5;float h=.25*(hs(vUv+q)+hs(vUv-q)+hs(vUv+vec2(q.x,-q.y))+hs(vUv+vec2(-q.x,q.y)));float dry=S.g,wg=S.b;
    vec2 o1=vec2(tx.x*1.5,0.),o2=vec2(0.,tx.y*1.5);float hl=hs(vUv-o1),hr=hs(vUv+o1),hd=hs(vUv-o2),hu=hs(vUv+o2);vec2 g=vec2(hr-hl,hu-hd)/37.5;
    vec2 cp=vUv*vec2(160.,448.);float n1=nz(cp*2.3),n2=nz(cp*7.1);float m=smoothstep(.035,.08,h+(n1-.5)*.045+(n2-.5)*.02);
    if(uFl==4){float wa=.25*(texture2D(tF,vUv+q).b+texture2D(tF,vUv-q).b+texture2D(tF,vUv+vec2(q.x,-q.y)).b+texture2D(tF,vUv+vec2(-q.x,q.y)).b);m=smoothstep(.35,.75,wa+(n1-.5)*.25)*smoothstep(0.,.012,h);wg=smoothstep(.2,.8,wa+(n1-.5)*.2);}
    else wg=0.;
    if(m<.004&&wg<.004)discard;
    vec3 T=vec3(1.,0.,0.),Bv=normalize(vB),N0=normalize(vN);vec3 nt=vec3(-g*nrm*m,1.);float dryM=smoothstep(.5,.95,dry);float wet=(1.-dryM)*m;
    float bub=0.;
    if(uFl==2){vec2 bp=cp/2.6;vec2 bi=floor(bp);vec2 bf=fract(bp)-.5;float rnd=hsh(bi);
      if(rnd>.5&&h>1.1){float t=fract(uT*(.18+.25*hsh(bi+3.1))+rnd*7.);float rad=.42*smoothstep(0.,.8,t);float d=length(bf-(hsh2(bi+9.)-.5)*.2);
        if(t<.86&&d<rad){float z=sqrt(max(0.,rad*rad-d*d));nt.xy+=(bf/max(rad,.01))*2.2*(1.-dryM);bub=z/rad;}
        else if(t>=.86){float rr=.42*1.15;float ring=1.-smoothstep(0.,.07,abs(d-rr*(.9+(t-.86)*.8)));nt.xy-=normalize(bf+.0001)*ring*.8*(1.-dryM);bub=-ring;}}}
    if(uFl==4){vec2 wp=cp*.0125;nt.xy+=.05*wg*vec2(nz(wp*9.+vec2(uT*1.7,0.))-.5,nz(wp*9.+vec2(0.,uT*1.4)+7.)-.5)*2.;}
    vec3 Nf=normalize(T*nt.x+Bv*nt.y+N0*nt.z);
    float th=smoothstep(.1,1.7,h);vec3 alb=mix(cThin,cThick,th);float op=clamp(1.-exp(-h*opK),0.,1.);float a=m*mix(.55,1.,op);
    if(uFl==2&&bub>0.)alb=mix(alb,cThin*1.25,bub*.5);
    float rim=smoothstep(.01,.05,length(g))*(1.-smoothstep(.4,1.,h));vec3 dc=mix(cDryThin,cDry,smoothstep(.06,.8,h))*(1.-.42*rim);
    float crk=(1.-smoothstep(.015,.05,vor(cp*(uFl==2?.42:.65))))*smoothstep(.9,1.6,h);
    if(uFl<3){alb=mix(alb*mix(.62,1.,dryM),dc,dryM);a=mix(a,m*clamp(.5+h*1.4,0.,1.)*(1.-crk*.7),dryM);}
    if(uFl==4){alb=vec3(0.);a=.45*wg;}
    vec3 V=normalize(camP-vPos),Lv=lampP-vPos;float dl=length(Lv);vec3 L=Lv/dl;float att=1.7/(1.+dl*dl*.12);vec3 lampC=vec3(1.,.9,.75),L2=normalize(vec3(-.4,.8,.45));
    vec3 dif=alb*(vec3(.16,.17,.2)+lampC*att*max(dot(Nf,L),0.)+vec3(.22,.25,.32)*max(dot(Nf,L2),0.));
    float wv=uFl==4?wg*.7:wet;float shin=mix(30.,320.,wv);float sp=pow(max(dot(Nf,normalize(L+V)),0.),shin)*shin*.011*att;
    vec3 R=reflect(-V,Nf);vec3 env=mix(vec3(.03,.035,.04),vec3(.15,.17,.21),clamp(R.y*1.4,0.,1.))+lampC*(pow(max(dot(R,L),0.),500.)*7.+pow(max(dot(R,L),0.),40.)*.6)*att;
    float fr=F0+(1.-F0)*pow(1.-max(dot(Nf,V),0.),5.);
    vec3 col=dif*a*(1.-fr*wv*.7)+(env*min(1.,fr*(uFl==4?1.6:3.4))+min(lampC*sp,vec3(.85)))*wv*max(a,wg);
    if(uFl==3){float film=(1.-smoothstep(.04,.55,h))*m;vec3 ir=.5+.5*cos(6.283*(h*7.+n1*.5+uT*.03+vec3(0.,.33,.67)));col+=ir*film*(.10+.5*fr)*(.6+att*.4);}
    if(uFl==4){float film=wg*(.4+.6*(1.-smoothstep(.02,.2,h)));vec3 ir=.5+.5*cos(6.283*(nz(cp*.075)*1.4+uT*.02+vec3(0.,.33,.67)));col+=ir*film*.05*(.3+fr*3.);}
    gl_FragColor=vec4(col,a);}`});
function fStrip(r0,r1,posFn,nrm,bdir,sv){const g=new THREE.BufferGeometry(),P=[],NN=[],UV=[],BB=[],I=[],su=8;
  for(let j=0;j<=sv;j++){const t=j/sv;for(let i=0;i<=su;i++){const u=i/su,p=posFn(u,t);P.push(p.x,p.y,p.z);NN.push(nrm.x,nrm.y,nrm.z);BB.push(bdir.x,bdir.y,bdir.z);UV.push(u,(r0+(r1-r0)*t)/FH);}}
  for(let j=0;j<sv;j++)for(let i=0;i<su;i++){const a=j*(su+1)+i,b=a+1,c=a+su+1,d=c+1;I.push(a,c,b,b,c,d);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(NN,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('aB',new THREE.Float32BufferAttribute(BB,3));g.setIndex(I);
  const m=new THREE.Mesh(g,fluidMat);m.renderOrder=2;m.frustumCulled=false;m.visible=false;scene.add(m);return m;}
const fx=u=>FX0+u*FW*FC;
const FPL=[fStrip(0,ROWW,(u,t)=>new V(fx(u),FWT-t*ROWW*FC,FWZ+.002),ZV,new V(0,-1,0),8),
  fStrip(ROWW,ROWS,(u,t)=>new V(fx(u),FSY+.0015,FWZ+t*(ROWS-ROWW)*FC),UP,ZV,8),
  fStrip(ROWS,ROWC,(u,t)=>new V(fx(u),FSY-t*(FSY-FRY),FZC+.002),ZV,new V(0,-1,0),1),
  fStrip(ROWC,FH,(u,t)=>new V(fx(u),FRY+.0015,FZC+t*(FH-ROWC)*FC),UP,ZV,8)];
// drops in flight: stretch with speed, land as an impact shaped by angle and direction
const FDM=400,fDropMat=new THREE.MeshStandardMaterial({color:0x7a0a0d,roughness:.12,metalness:.15,transparent:true,opacity:1});
const fDropIM=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),fDropMat,FDM);fDropIM.frustumCulled=false;scene.add(fDropIM);
const FDR=[];const fZero=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<FDM;i++){FDR.push({on:false,p:new V(),v:new V(),r:0});fDropIM.setMatrixAt(i,fZero);}
const fq=new THREE.Quaternion(),fm=new THREE.Matrix4(),fs=new V(),fv=new V();let fdI=0;
function fLaunch(p,v,rmm){const d=FDR[fdI++%FDM];d.on=true;d.p.copy(p);d.v.copy(v);d.r=rmm;}
function fLand(p,v,rmm,g){let r,c=(p.x-FX0)/FC,ux=v.x,uy,vn;
  if(g===0){r=(FWT-p.y)/FC;uy=-v.y;vn=-v.z;}else if(g===1){r=ROWW+(p.z-FWZ)/FC;uy=v.z;vn=-v.y;}else{r=ROWC+(p.z-FZC)/FC;uy=v.z;vn=-v.y;}
  const vt=Math.hypot(ux,uy)||1e-6,sinA=Math.abs(vn)/Math.hypot(vt,vn);const vol=(4/3*Math.PI*rmm**3)/(FMM*FMM)*(rmm>3?7:4)*FL.vol;
  const size=Math.max(.6,rmm*2/FMM*(1+.2*v.length()));const amt=Math.min(FL.fl===2?4:2.6,Math.max(.25,vol/(Math.PI*size*size*1.6/(sinA<.3?.6:1))));if(FL.fl>=3){fBlob(r,c,size*1.3,size*1.1,ux/vt,uy/vt,amt,.2);return;}fSplat(r,c,size,ux/vt,uy/vt,sinA,amt);}
function fDrops(dt){for(let i=0;i<FDM;i++){const d=FDR[i];if(!d.on)continue;const pz=d.p.z;d.v.y-=9.8*dt;d.v.multiplyScalar(1-dt*.25);d.p.addScaledVector(d.v,dt);const p=d.p;let g=-1;
  if(p.z<=FWZ&&p.y>FSY){p.z=FWZ;g=0;}else if(p.z<FZC&&p.y<=FSY){p.y=FSY;g=1;}else if(p.z>=FZC&&p.y<=FRY){p.y=FRY;g=3;}
  if(g>=0){if(p.x>FX0&&p.x<FX0+FW*FC)fLand(p,d.v,d.r,g);d.on=false;fDropIM.setMatrixAt(i,fZero);continue;}
  if(p.y<-1){d.on=false;fDropIM.setMatrixAt(i,fZero);continue;}
  const sp=d.v.length();fv.copy(d.v).normalize();fq.setFromUnitVectors(UP,fv);const s=d.r*.0013;fs.set(s,s*(1+Math.min(3.5,sp*.35)),s);fm.compose(p,fq,fs);fDropIM.setMatrixAt(i,fm);}
  fDropIM.instanceMatrix.needsUpdate=true;}
function fDropsOff(){for(let i=0;i<FDM;i++){FDR[i].on=false;fDropIM.setMatrixAt(i,fZero);}fDropIM.instanceMatrix.needsUpdate=true;}
// drip: bead swells at the source, necks, detaches and falls
const fBead=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),fDropMat);fBead.visible=false;scene.add(fBead);let fDrip=null;
function fDripUpd(dt,src){if(!fDrip){fBead.visible=false;return;}fDrip.t+=dt;const k=Math.min(1,fDrip.t/fDrip.every),r=fDrip.r*(.35+.65*k);
  fBead.visible=true;fBead.position.copy(src).add(new V(0,-r*.0012*(1+k*.7),0));fBead.scale.set(r*.0011,r*.0011*(1+k*.9),r*.0011);
  if(fDrip.t>=fDrip.every){fLaunch(fBead.position.clone().add(new V(0,-r*.001,0)),new V(rnd(-.025,.025),-.2,rnd(-.025,.025)),fDrip.r*rnd(.85,1.15));fDrip.t=0;fDrip.every=fDrip.base*rnd(.75,1.25);}}
// continuous source (wound at the feet, tipped can)
let fSrc=[];
function fSrcUpd(dt){fSrc.forEach(s=>{s.t+=dt;if(s.t<0||s.t>s.dur)return;const a=s.rate*dt*(.6+.4*Math.max(0,Math.sin(s.t*5.2)));
  for(let k=0;k<3;k++){const ang=Math.random()*6.28,d=Math.random()*s.rad;fDep(s.r+Math.sin(ang)*d,s.c+Math.cos(ang)*d,a/3);}});}
let fAcc=0,flG=0;
function fCell(x,z){return[ROWW+Math.round((z-FWZ)/FC),Math.round((x-FX0)/FC)];}
window.__fluid={fh,FDR,ROWW,FW,get FL(){return FL}};
def({id:'fluidos',team:'z',name:'Fluidos vivos',short:'Película de verdade: tiro na parede vira campo de gotas alongadas, fios com gota na ponta descem até o rodapé, poça segue o declive e desce o meio-fio, seca pela borda.',cost:'1 grade 160×448',costb:'shader de umidade',
  cam:[-2.3,1.25,-.9],tgt:[-1.05,.75,-4.1],loop:22,param:{lbl:'Fluido',opts:['Sangue','Óleo','Gasolina','Bile'],def:0},
  q:'Todo fluido que cai em superfície: sangue (pela idade), bile do Inchado, óleo e gasolina dos carros.',
  v:'Película plana sobre a superfície: a espessura muda só a cor (fina clara, grossa escura), a opacidade e a normal; o contorno é liso com ruído fino, sem degraus. O tiro vira um campo de gotas de tamanhos variados, cada uma esticada por 1/seno do ângulo em que bateu, com espetos curtos e afinando (longos só no sentido do tiro) e satélites com rabo. Só onde sobra volume o fluido escorre: fio fino com gota grossa na ponta, que para quando o volume acaba; os maiores chegam ao rodapé e formam a poça ali. No chão a poça avança em lóbulos pelo declive e pelo rejunte e desce o meio-fio para a sarjeta. Molhado brilha e reflete; seca pela borda fina primeiro, fica fosco, escurece e racha onde era grosso. Óleo é preto espelhado com arco-íris só na borda fina e nunca seca. Gasolina quase não se vê: escurece o chão, reflete forte, tremula e evapora pela borda. Bile cai em blocos grossos com espetos curtos, quase sem fio, borbulha e vira crosta oliva rachada.',
  b:'Uma grade de película por superfície (1,25 cm por célula) só onde há fluido recente perto da câmera: até 6 grades de 2×2 m em compute shader, 0,3 ms de GPU. Longe ou antigo vira decalque estático com o estado final. Gotas em voo: até 400 instâncias, um draw call.',
  r:'Cosmético. Semente e hora do evento bastam; cada cliente simula o seu.',
  setup(pr){Z.g.visible=false;fClear();fDropsOff();fDrip=null;fBead.visible=false;fSrc=[];fAcc=0;flG=0;
    FL=[FT.blood,FT.oil,FT.fuel,FT.bile][pr];FU.uFl.value=FL.fl;FU.cThin.value.copy(FL.thin);FU.cThick.value.copy(FL.thick);FU.cDry.value.copy(FL.dry);FU.cDryThin.value.copy(FL.dryThin);FU.opK.value=FL.opK;FU.F0.value=FL.F0;FU.nrm.value=FL.nrm;
    fDropMat.color.setHex(FL.drop);fDropMat.opacity=pr===2?.45:1;FPL.forEach(m=>m.visible=true);
    if(pr===1||pr===2){fluidL.intensity=2.4;fluidL.position.set(-2.05,1.1,-4.4);}else{fluidL.intensity=2.1;fluidL.position.set(-1.95,2.0,-3.35);}
    if(pr===0||pr===3){const h=H[0];h.g.visible=true;h.g.position.set(-.3,.12,-3.8);h.g.rotation.y=.35;}
    if(pr===1||pr===2){can.visible=true;canM.color.setHex(pr===1?0x1d2a3a:0xa3201c);can.position.set(-1.65,.28,-4.2);can.rotation.set(0,0,-1.25);}},
  run(pr){const tag=['sangue','óleo','gasolina','bile'][pr];
    if(pr===0||pr===3){const O=new V(-1.3,1.42,-3.7),bile=pr===3;
      at(.3,()=>{burst(norP,bile?8:16,{p:O.clone().add(new V(0,0,-.35)),r:.12,sp:[.2,.8],drag:3,life:[.3,.6],size:[.08,.16],grow:3,c0:bile?0x8a9a2a:0x7a0a0d,a:.5});
        if(bile){for(let k=0;k<26;k++){const d=new V(rnd(-.3,.3),rnd(-.18,.22),-1).normalize();fLaunch(O.clone(),d.multiplyScalar(rnd(3,4.5)),k<12?rnd(9,13):rnd(4,7));}}
        else{for(let k=0;k<220;k++){const d=new V(rnd(-.65,.65),rnd(-.4,.6),-1).normalize();fLaunch(O.clone(),d.multiplyScalar(rnd(4,10)),rnd(.5,1.6));}
          for(let k=0;k<110;k++){const d=new V(rnd(-.45,.45),rnd(-.35,.35)+.0,-1).normalize(),big=k<8;fLaunch(O.clone().add(new V(rnd(-.02,.02),rnd(-.02,.02),0)),d.multiplyScalar(big?5:rnd(3,8)),big?rnd(5.5,8.5):1+Math.random()*Math.random()*4.5);}}});
      at(.37,()=>{for(let k=0;k<(bile?10:26);k++){const d=new V(rnd(-.6,.6),rnd(.15,.55),-rnd(.4,.8)).normalize();fLaunch(O.clone(),d.multiplyScalar(rnd(1.5,3.5)),bile?rnd(3,6):rnd(1.5,4));}});
      const[r,c]=fCell(-.32,-3.7);fSrc.push({r,c,rate:bile?320:220,t:-2,dur:12,rad:3});
      at(.6,()=>{fDrip={every:.45,base:.45,t:0,r:bile?5.5:4.4};});}
    if(pr===1||pr===2){const[r,c]=fCell(-1.3,-4.02);at(.1,()=>fBlob(r+8,c+2,17,14,.6,.8,pr===1?1.3:.7,.22));fSrc.push({r,c,rate:pr===1?450:700,t:0,dur:pr===1?18:8,rad:2});}
    if(this.fresh&&(pr===1||pr===2))camTo(new V(-.45,.42,-3.35),new V(-1.35,.12,-3.98));
    setNote(tag+(pr===0||pr===3?' fresco · brilhante, escorrendo':pr===1?' · preto espelhado, arco-íris só na borda fina, nunca seca':' · escurece o chão, reflete, tremula e evapora pela borda'));},
  tick(dt,t,pr){const src=new V();if(pr===0||pr===3){const h=H[0];h.g.updateMatrixWorld();src.set(0,-.04,.68).applyMatrix4(h.arms[1].matrixWorld);if(t>12){fDrip=null;}}
    fDrops(dt);fDripUpd(dt,src);fSrcUpd(dt);fBox();fAcc+=dt;let n=0;while(fAcc>=1/180&&n<9){fStep();fAcc-=1/180;n++;}if(n===9)fAcc=0;const sp=t<5?3:FL.spd;flG+=dt*sp;fAge(dt*sp);fUpload();
    FU.uT.value=t;FU.camP.value.copy(camera.position);FU.lampP.value.copy(fluidL.position);
    if(pr===1&&t<16&&Math.random()<dt*14)fLaunch(new V(-1.3,.3,-4.05),new V(rnd(-.05,.05),-.2,rnd(0,.1)),rnd(2,3.5));
    if(pr===2&&t<12)emit('haze',norP,12,dt,()=>({p:new V(-1.2,.15,-3.6),r:.7,flat:true,dir:UP,cone:.3,sp:[.15,.35],life:[1.2,2],size:[.4,.7],grow:1.5,c0:0x9aa4b4,a:.025,fi:.4}));
    if(pr===0||pr===3){const g=flG;setNote((pr===0?'sangue':'bile')+(g<160?' fresco · brilhante, escorrendo':g<700?' · secando pela borda: perde o brilho, escurece, para':' · seco: fosco, '+(pr===0?'marrom, rachado onde era grosso':'crosta oliva rachada'))+' · secagem ×'+FL.spd+' (no jogo: '+(pr===0?'10':'15')+' min)');}},
  stop(){FPL.forEach(m=>m.visible=false);fDropsOff();fDrip=null;fBead.visible=false;fSrc=[];}
});
// ARMAS
const WN={glock:'Glock 17 · 9×19mm',ak:'AK-47 · 7,62×39mm',r870:'Remington 870 · calibre 12',barrett:'Barrett M82A1 · .50 BMG'};
def({id:'muzzle',team:'a',name:'Clarão de disparo',short:'Núcleo, pétalas e fumaça com escala por arma. A Barrett levanta poeira.',cost:'≤ 60 part.',costb:'1 luz · 50 ms',
  cam:[1.8,1.8,5.2],tgt:[-.8,1.3,1.4],loop:2.4,param:{lbl:'Arma',opts:['Glock','AK-47','Rem. 870','Barrett'],def:1},
  q:'Cada disparo. Em primeira pessoa usa o modelo da arma; de longe vira só o sprite do núcleo.',
  v:'Três camadas: núcleo branco-amarelo de 1 quadro, pétalas na direção do cano e fumaça cinza que fica 1 a 2 s. A 12 tem clarão largo e fumaça grossa. A Barrett solta dois jatos laterais pelo freio de boca e levanta um anel de poeira do chão. A luz ilumina o cômodo por 50 ms (pedido do brief do mapa).',
  b:'Até 60 partículas e 1 luz por tiro. Rajada de AK usa a mesma luz em loop. Pistola sem luz a mais de 15 m.',
  r:'Cosmético. Sai do evento de tiro que o servidor já manda (arma, origem, direção).',
  setup(){gun.visible=true;Z.g.visible=false;},
  run(pr){const w=['glock','ak','r870','barrett'][pr];setNote(WN[w]);const tip=gunTip(),dir=new V(0,0,-1);
    const shots=w==='ak'?[0,.1,.2,.3,.4,.5,.6]:w==='glock'?[0,.45,.9]:[0];
    shots.forEach(s=>at(.2+s,()=>{muzzle(w,tip,dir);if(w!=='r870')casing(gunPort(),w==='barrett'?'50':'');gun.position.z=3.4+(w==='barrett'?.12:.05);
      const tg=new V(-.8+rnd(-.4,.4),1.4+rnd(-.3,.3),-4.45);if(w==='r870'){for(let i=0;i<8;i++)impact('concreto',new V(-.8+rnd(-.5,.5),1.4+rnd(-.4,.4),-4.45),new V(0,0,1),.35);}else impact('concreto',tg,new V(0,0,1),w==='barrett'?2:1);
      if(w==='ak'&&Math.round(s*10)%3===0)streak.spawn({p:tip,dir,cone:0,sp:90,life:.09,len:.025,c0:0xffa040,a:1});}));
    if(w==='r870')at(.75,()=>casing(gunPort(),'shell'));},
  tick(dt){gun.position.z=lerp(gun.position.z,3.4,Math.min(1,dt*14));}
});
def({id:'impacto',team:'a',name:'Impacto por material',short:'Concreto, metal, madeira, vidro, carne e água: cada um com sua resposta.',cost:'≤ 40 part.',costb:'1 furo',
  cam:[0,1.8,4.5],tgt:[0,1.2,-2],loop:2.6,param:{lbl:'Material',opts:['Concreto','Metal','Madeira','Vidro','Carne','Água'],def:0},
  q:'Toda bala que acerta algo. O material vem da tag de superfície da malha.',
  v:'Concreto: pó claro em cone e lascas cinza. Metal: chuva de faíscas que quicam, sem pó, com luz curta. Madeira: lascas finas e pó marrom. Vidro: brilho, cacos e rachadura. Carne: sangue pela idade. Água: coroa de gotas e dois anéis.',
  b:'14 de pó + 6 lascas + até 18 faíscas + 1 furo. A 40 m sobra só o pó.',
  r:'Evento de impacto de 12 bytes com material em 4 bits.',
  run(pr){const k=['concreto','metal','madeira','vidro','carne','agua'][pr];Z.g.visible=k==='carne';
    const pts={concreto:[new V(-2,1.6,-4.45),new V(0,0,1)],metal:[carW(.96,.7,.4),new V(Math.cos(CAR0.ry),0,-Math.sin(CAR0.ry))],madeira:[new V(2,1.3,-4.36),new V(0,0,1)],vidro:[new V(-5,1.9,-4.45),new V(0,0,1)],carne:[new V(0,1.25,.16),new V(0,0,1)],agua:[new V(-1.5,.012,2.2),UP]}[k];
    if(k==='agua')decal(-1.5,0,2.2,3.2,0x0d1218,{grow:0,life:60,ar:.55});
    if(k==='vidro'){glassCracks.length=0;drawGlass();}
    [0,.55,1.1].forEach((s,i)=>at(.2+s,()=>{const p=pts[0].clone().add(k==='agua'?new V(rnd(-.6,.6),0,rnd(-.3,.3)):k==='carne'?new V(rnd(-.1,.1),rnd(-.15,.15),0):new V(rnd(-.4,.4),rnd(-.3,.3),0));
      impact(k,p,pts[1],1,0);if(k==='vidro'){glassCracks.push(crackAt(((p.x+5)/2.6+.5)*256,(1-((p.y-1.9)/1.8+.5))*180,i===2));drawGlass();}}));
    setNote('Material: '+['concreto','metal','madeira','vidro','carne','água'][pr]);
    const c={concreto:[-2,1.6,-1.8],metal:null,madeira:[2,1.3,-1.6],vidro:[-5,1.9,-1.8],carne:[0,1.2,2.6],agua:[-1.5,.8,4.6]}[k];
    if(this.fresh){if(c)camTo(new V(...c),pts[0]);else camTo(carW(3,1.4,1.5),pts[0]);}}
});
def({id:'penetra',team:'a',name:'Bala que atravessa a horda',short:'Traçante da Barrett passando por 5 zumbis, em câmera lenta 10×.',cost:'≤ 250 part.',costb:'evento agregado',
  cam:[4.2,2.2,6.5],tgt:[0,1.2,-.5],loop:4.2,
  q:'Arma com penetração: AK atravessa 2, Remington 700 atravessa 3, Barrett atravessa 6 e carros.',
  v:'Traçante com rastro de ar quente, saída de sangue em cada corpo na ordem em que a bala passa (cada um com a cor da sua idade), corpos caindo um atrás do outro e impacto final no concreto.',
  b:'Todos os acertos de um tiro saem num único evento agregado com a lista de pontos. 5 corpos = 5 saídas + 5 poças.',
  r:'O servidor manda o tiro e a lista ordenada de acertos.',
  setup(){Z.g.visible=false;[2.2,1,-.2,-1.4,-2.6].forEach((z,i)=>{const h=H[i];h.g.visible=true;h.g.position.set(rnd(-.05,.05),0,z);h.g.rotation.y=rnd(-.3,.3);h.hitDone=false;});},
  run(){setNote('câmera lenta 10×');this.b={z:8.5,on:true};muzzle('barrett',new V(0,1.45,8.5),new V(0,0,-1));},
  tick(dt){const b=this.b;if(!b||!b.on)return;const z0=b.z;b.z-=12*dt;const p=new V(0,1.45,b.z);
    streak.spawn({p,dir:new V(0,0,-1),cone:0,sp:12,life:.04,len:.07,c0:0xffd090});addP.spawn({p,size:.09,life:.05,c0:0xffc070,fi:0});
    norP.spawn({p,r:.02,sp:[0,.05],life:[1.2,2],size:.05,grow:3,c0:0xc8ccd2,a:.12,fi:.1});
    H.slice(0,5).forEach((h,i)=>{const hz=h.g.position.z;if(!h.hitDone&&z0>hz&&b.z<=hz){h.hitDone=true;bloodHit(new V(0,1.45,hz-.1),new V(0,.05,-1),i%4,.8);zfall(h,.05,.6);at(this.tl+.6,()=>decal(h.g.position.x,0,hz-1.2,.6,BLOOD[i%4],{grow:2,dark:60,dry:0x3b1d14}));}});
    if(b.z<-4.4){b.on=false;impact('concreto',new V(0,1.45,-4.45),new V(0,0,1),2.2);}}
});
def({id:'capsulas',team:'a',name:'Cápsulas e carregador',short:'Latão que quica e fica no chão, carregador vazio caindo, fumaça do cano quente.',cost:'200/jogador',costb:'física 1,5 s',
  cam:[.9,1.3,4.6],tgt:[-.6,.6,3.1],loop:4.6,
  q:'Cada disparo de arma semiautomática, recarga, e bombeada da 12 ou ferrolho do rifle.',
  v:'Cápsula sai pela janela de ejeção girando, quica no asfalto duas ou três vezes e fica. O carregador vazio cai na recarga. Depois da rajada, fumaça fina sobe do cano quente por 2 s.',
  b:'Física só por 1,5 s, depois vira instância estática. Teto de 200 por jogador, o mais antigo some primeiro.',
  r:'Cosmético, cada cliente gera as suas. Não sincroniza posição no chão.',
  setup(){gun.visible=true;Z.g.visible=false;},
  run(){for(let i=0;i<12;i++)at(.2+i*.1,()=>{muzzle('ak',gunTip(),new V(0,0,-1));casing(gunPort(),'');gun.position.z=3.45;});
    at(1.8,()=>debris({p:new V(-.8,1.15,3.3),v:new V(.1,-.5,.1),sp:0,size:[.05,.2,.09],c:0x2a2a2a,spin:3,life:20,bounce:.2}));},
  tick(dt,t){gun.position.z=lerp(gun.position.z,3.4,Math.min(1,dt*14));if(t>1.4&&t<3.6)emit('hot',norP,10,dt,()=>({p:gunTip(),dir:UP,cone:.25,sp:[.2,.5],life:[1.4,2.2],size:[.03,.06],grow:5,c0:0x9a9a96,a:.18,g:-.2,fi:.2}));}
});
def({id:'molotov',lab:1,team:'a',name:'Coquetel molotov',short:'Pavio aceso no arco, vidro quebrando e poça de fogo que espalha.',cost:'≤ 300 part.',costb:'2 luzes · entidade',
  cam:[5,3,6.5],tgt:[0,.6,-.5],loop:9.5,
  q:'Molotov atingindo o chão ou um zumbi.',
  v:'Garrafa em arco com pavio soltando chama e fumaça. Ao bater, cacos verdes e um respingo de fogo que abre de 0,5 m para 2,2 m em 0,8 s. Chamas baixas, brasas, fumaça escura e luz tremendo por 6 s, depois brasa e mancha queimada.',
  b:'Fogo de área com até 300 partículas e 1 luz de fogo. Zumbis em chamas usam um emissor pequeno preso ao corpo (40 partículas) e só os 8 mais próximos.',
  r:'Fogo é entidade no servidor: área, dano por segundo, tempo. O cliente desenha a partir dela.',
  setup(){Z.g.visible=false;this.bt=this.bt||mesh(Bx(.08,.22,.08),new THREE.MeshStandardMaterial({color:0x3a6a3a,transparent:true,opacity:.8}),0,0,0);},
  run(){this.fr=0;this.fly=0;this.bt.visible=true;},
  tick(dt,t){const A=new V(-4,1.6,5),B=new V(0,0,-.5);if(t<1){const k=t;const p=A.clone().lerp(B,k);p.y=lerp(A.y,B.y,k)+Math.sin(k*Math.PI)*2.2;this.bt.position.copy(p);this.bt.rotation.x+=dt*10;
      emit('wick',addP,40,dt,()=>({p:p.clone().add(new V(0,.12,0)),r:.03,sp:[.1,.3],life:[.15,.3],size:[.08,.14],grow:.5,c0:0xffd27a,c1:0xff5010,fi:0,g:-1}));emit('wsm',norP,14,dt,()=>({p,size:[.06,.1],grow:4,life:[.8,1.2],c0:0x3a3530,a:.3,sp:[0,.2]}));}
    else if(!this.fly){this.fly=1;this.bt.visible=false;for(let i=0;i<n(12);i++)debris({p:B.clone().add(new V(0,.1,0)),dir:UP,cone:1.3,sp:[1,3],size:[.04,.01,.04],c:0x3a6a3a,life:12});
      burst(addP,45,{p:B.clone().add(new V(0,.15,0)),dir:UP,cone:1.35,sp:[2,4],drag:2,life:[.3,.6],size:[.3,.5],c0:0xffd27a,c1:0xa02008,fi:.05});flash(B.clone().add(new V(0,.6,0)),0xff8a30,6,.3,12,true);decal(B.x,0,B.z,4.2,0x0d0b09,{grow:.8,life:60});}
    if(t>1&&t<8.2){const r=Math.min(2.2,.5+(t-1)*2.1);const k=t>7?Math.max(.1,1-(t-7)/1.2):1;fireEmit('mol',dt,B.clone().add(new V(0,.05,0)),r,1.6*k,{smoke:16});fireLight(fireL,B.clone().add(new V(0,1,0)),3.2*k,t);}
    else if(t>=8.2){fireL.intensity=0;emit('emb',addP,6,dt,()=>({p:B,r:2,flat:true,size:[.04,.07],life:[.6,1.2],c0:0xff6a20,a:.8,fi:.3}));}}
});
def({id:'granada',lab:1,team:'a',name:'Granada de fragmentação',short:'Quique no asfalto, clarão, onda de choque, estilhaços e anel de poeira.',cost:'≤ 400 part.',costb:'evento agregado',
  cam:[7,3.4,7.5],tgt:[0,.8,-.2],loop:6.5,
  q:'Granada explodindo (pavio de 1,8 s após o arremesso).',
  v:'Granada quica duas vezes. Explosão em camadas: clarão branco que pinta a tela, bola de fogo curta, anel de choque no chão e outro de frente para a câmera, estilhaços brilhantes que quicam, anel de poeira rasteira, fumaça cinza que sobe e marca queimada. Zumbis no raio caem para fora.',
  b:'Até 400 partículas, 1 luz forte de 0,5 s, 16 detritos, 1 marca. Os 40 zumbis atingidos entram num único evento agregado.',
  r:'O servidor manda a explosão e a lista de atingidos. Visual local.',
  setup(){Z.g.visible=false;[[1.6,.8],[-1.8,1.2],[.6,-2],[-1,-1.8],[2.4,-1.2]].forEach(([x,z],i)=>{const h=H[i];h.g.visible=true;h.g.position.set(x,0,z);h.g.rotation.y=Math.atan2(-x,-z);});
    this.gn=this.gn||mesh(new THREE.DodecahedronGeometry(.07,0),mat(0x3a4a2a),0,0,0);},
  run(){this.gs={p:new V(-4,1.4,4.5),v:new V(3.2,2.4,-3.6)};this.gn.visible=true;this.boom=0;},
  tick(dt,t){const g=this.gs;if(!g)return;if(t<1.8){g.v.y-=9.8*dt;g.p.addScaledVector(g.v,dt);if(g.p.y<.07){g.p.y=.07;g.v.y*=-.4;g.v.x*=.5;g.v.z*=.5;}this.gn.position.copy(g.p);}
    else if(!this.boom){this.boom=1;this.gn.visible=false;const p=g.p.clone();p.y=0;explode(p,1);H.slice(0,5).forEach(h=>{const dx=h.g.position.x-p.x,dz=h.g.position.z-p.z;h.g.rotation.y=Math.atan2(-dx,-dz);zfall(h,.02,.45);});}}
});
def({id:'barril',lab:1,team:'a',name:'Barril explosivo',short:'Cogumelo de fogo, tampa voando, gasolina queimando no chão e coluna de fumaça.',cost:'≤ 450 part.',costb:'2 luzes · entidade de fogo',
  cam:[2.4,3,7.5],tgt:[-4.4,1.6,1.4],loop:9,
  q:'Barril vermelho com dano acima do limite, tiro ou fogo encostado.',
  v:'Tudo da granada, mais: bola de fogo que sobe em cogumelo, tampa e pedaços vermelhos voando alto, três poças de gasolina queimando por 5 s e coluna de fumaça preta que serve de referência de longe.',
  b:'Pico de 450 partículas. A coluna de fumaça fica visível além de 80 m com 6 sprites grandes.',
  r:'Explosão + entidade de fogo nas poças.',
  setup(){Z.g.visible=false;},
  run(){at(.4,()=>{barrel.visible=false;const p=barrel.position.clone();explode(p,1.3,{chip:0x9b1c18});
      burst(addP,30,{p:p.clone().add(new V(0,.8,0)),r:.4,dir:UP,cone:.25,sp:[3,5],drag:1.2,life:[1,1.6],size:[.9,1.4],grow:1.4,c0:0xffb050,c1:0x3a0d05,g:-1,fi:.05});
      debris({p:p.clone().add(new V(0,1,0)),v:new V(.6,9,.3),sp:0,size:[.7,.05,.7],c:0x9b1c18,spin:8,life:12});for(let i=0;i<n(8);i++)debris({p,dir:UP,cone:1,sp:[3,7],size:[.25,.04,.18],c:i%2?0x9b1c18:0xd8b02a,life:12});
      this.pools=[0,1,2].map(i=>{const a=i*2.1+rnd(0,.6);return p.clone().add(new V(Math.cos(a)*1.4,.05,Math.sin(a)*1.4));});});},
  tick(dt,t){if(this.pools&&t>.5&&t<6){const k=t>5?1-(t-5):1;this.pools.forEach((pp,i)=>fireEmit('bp'+i,dt,pp,.45,.6*k,{smoke:6}));fireLight(fireL,barrel.position.clone().add(new V(0,1,0)),2.6*k,t);}
    if(t>.6&&t<8)emit('col',norP,6,dt,()=>({p:barrel.position.clone().add(new V(0,1.5,0)),r:.6,dir:UP,cone:.2,sp:[1.5,2.5],v:new V(.4,0,0),drag:.05,life:[4,6],size:[1.2,1.8],grow:3,c0:0x1a1817,c1:0x0c0d10,a:.5,fi:.2}));
    if(t>=6)fireL.intensity=0;},
  stop(){this.pools=null;}
});

// MAPA
def({id:'vidro',team:'d',name:'Vitrine estourando',short:'Duas trincas, depois a placa inteira desce em cacos que ficam na calçada.',cost:'≤ 80 detritos',costb:'1 rachadura',
  cam:[-2.4,1.8,1.2],tgt:[-5,1.4,-4],loop:5,
  q:'Vidro com dano acumulado (tiro, golpe, horda empurrando). Barulho de 20 m que atrai a horda.',
  v:'Primeiros golpes abrem trincas em estrela na textura do vidro. No estouro a placa some e vira 60 a 80 cacos que caem girando, brilhando na luz, e ficam na calçada. Um véu de pó de vidro fino na frente.',
  b:'Cacos com física contam no teto de 300 e viram estáticos em 2 s. 3 estágios de rachadura numa máscara só.',
  r:'O servidor manda o estado do vidro (0 a 3). Cacos são locais.',
  run(){at(.3,()=>{impact('vidro',new V(-5.4,2.2,-4.45),new V(0,0,1));glassCracks.push(crackAt(97,59,false));drawGlass();});
    at(1,()=>{impact('vidro',new V(-4.5,1.6,-4.45),new V(0,0,1));glassCracks.push(crackAt(177,108,true));drawGlass();});
    at(1.8,()=>{glass.visible=false;S.shake+=.08;for(let i=0;i<n(75);i++)debris({p:new V(-5,1.9,-4.42),box:[1.25,.85,.02],v:new V(rnd(-.4,.4),rnd(-.5,.8),rnd(.6,2)),sp:0,size:[rnd(.05,.18),.006,rnd(.05,.18)],c:0xa8c8d8,spin:14,life:30,bounce:.15});
      burst(addP,30,{p:new V(-5,1.9,-4.3),box:[1.2,.8,.05],size:[.02,.05],life:[.2,.6],c0:0xffffff,a:.9,fi:.3});burst(norP,20,{p:new V(-5,1.3,-4.2),box:[1.2,.5,.1],sp:[.2,.6],drag:2,life:[.8,1.4],size:[.12,.2],grow:3,c0:0xbfd6e2,a:.2});});}
});
def({id:'porta',team:'d',name:'Porta cedendo em 3 estágios',short:'Pancadas soltam pó do batente, uma tábua racha e a porta cai.',cost:'≤ 120 part.',costb:'3 estágios',
  cam:[4.2,1.7,1.4],tgt:[2,1.1,-4],loop:7.5,
  q:'Horda batendo em porta ou barricada (o Brutamonte faz 3× dano). Estágios: 66%, 33%, 0% de vida.',
  v:'Cada pancada sacode a porta e solta pó do batente e lascas. No estágio 2 a tábua do meio racha e cai. No 3 a porta tomba e levanta uma nuvem de poeira rasteira, e o zumbi sai do escuro.',
  b:'Pó: 12 partículas por pancada. Queda: 40 de poeira e 6 detritos. Pancadas a mais de 15 m sem partícula, só som.',
  r:'O servidor manda a vida da porta. Estágio visual sai do valor.',
  setup(){const h=H[0];h.g.visible=true;h.g.position.set(2,0,-5.4);h.g.rotation.y=0;},
  run(){const hit=(big)=>{this.sh=.25;burst(norP,12*(big?2:1),{p:new V(2,2.3,-4.38),box:[.6,.05,.02],dir:new V(0,-.3,1).normalize(),cone:.6,sp:[.2,.8],drag:1.5,life:[.8,1.4],size:[.08,.16],grow:3,c0:0x7a7366,a:.45,g:.4});
      for(let i=0;i<n(big?5:2);i++)debris({p:new V(2+rnd(-.5,.5),rnd(.4,2),-4.36),dir:new V(0,.3,1).normalize(),cone:.6,sp:[1,2.5],size:[.015,.015,.1],c:0x7a5530,life:12});};
    [.5,1.2].forEach(t=>at(t,()=>hit(false)));at(1.9,()=>{hit(true);planks[1].rotation.z=.06;planks[1].material.color.setHex(0x5a3c22);setNote('estágio 1 · 66%');});
    at(2.7,()=>hit(false));at(3.3,()=>{hit(true);planks[1].visible=false;for(let i=0;i<3;i++)debris({p:new V(2+(i-1)*.4,1.1,-4.3),v:new V(rnd(-.3,.3),.5,1.2),sp:0,size:[.38,.68,.07],c:0x5a3c22,spin:4,life:20,bounce:.15});setNote('estágio 2 · 33%');});
    at(4.4,()=>{this.fall=0;setNote('estágio 3 · porta caiu');});
    at(4.6,()=>zwalk(H[0],new V(2,0,-2.2),.9));},
  tick(dt,t){if(this.sh>0){this.sh-=dt;doorG.position.z=-4.45+Math.sin(t*90)*.02*this.sh*4;}
    if(this.fall!=null){this.fall+=dt;const k=Math.min(1,this.fall/.4);doorG.rotation.x=k*k*Math.PI/2;if(k>=1&&!this.landed){this.landed=1;S.shake+=.2;
      burst(norP,45,{p:new V(2,.15,-3.4),box:[.7,.05,1],dir:UP,cone:1.4,sp:[.6,2],drag:1.8,life:[1.5,2.8],size:[.25,.5],grow:3,c0:0x6a645a,a:.45});}}},
  stop(){this.fall=null;this.landed=0;this.sh=0;}
});
def({id:'desaba',team:'d',name:'Desabamento',short:'Pó escorrendo da marquise, blocos caindo e nuvem de poeira que rola pela rua.',cost:'≤ 350 part.',costb:'26 detritos',
  cam:[4,2.4,5],tgt:[-1.4,1.4,-2.8],loop:8,
  q:'Estrutura que perde a vida: explosão, veículo batendo, horda grande empurrando (destruição de prédios do mapa).',
  v:'Antes: pó fino escorrendo e pedrinhas caindo por 1 s, como aviso. Depois: blocos grandes e pequenos caem, a câmera treme e uma nuvem de poeira cinza-bege rola pelo chão e fica no ar por 5 s, escondendo zumbis.',
  b:'26 detritos (6 grandes), 70 sprites de poeira em meia resolução. É evento raro, cabe no orçamento.',
  r:'O servidor manda o colapso e a área de poeira, que bloqueia visão de zumbi por 4 s.',
  setup(){Z.g.visible=false;},
  run(){at(1.5,()=>{slab.visible=false;S.shake+=.3;const c=new V(-1.4,3.35,-3.75);for(let i=0;i<6;i++)debris({p:c,box:[2,.05,.6],v:new V(rnd(-.5,.5),rnd(-.5,0),rnd(0,.8)),sp:0,size:[rnd(.5,1.1),.25,rnd(.4,.8)],c:0x6e6a63,spin:3,life:30,bounce:.1});
      for(let i=0;i<n(20);i++)debris({p:c,box:[2.1,.1,.7],v:new V(rnd(-1,1),rnd(-1,1),rnd(0,1.5)),sp:0,size:[.12,.1,.12],k:[.5,1.5],c:0x5e5a54,life:30});});
    at(2.15,()=>{S.shake+=.45;for(let i=0;i<n(70);i++){const a=rnd(-.4,3.5);norP.spawn({p:new V(-1.4+rnd(-2,2),.2,-3.4+rnd(-.5,.5)),dir:new V(Math.cos(a)*.6,.25,Math.abs(Math.sin(a))).normalize(),cone:.5,sp:[1,3.2],drag:1.1,life:[3,6],size:[.7,1.2],grow:3,c0:0x7a7268,c1:0x4a4640,a:.5,fi:.12});}});},
  tick(dt,t){if(t>.3&&t<1.5){emit('trk',norP,30,dt,()=>({p:new V(-1.4+rnd(-2,2),3.2,-3.05),dir:new V(0,-1,0),cone:.1,sp:[.2,.5],life:[1,1.6],size:[.04,.08],grow:2.5,c0:0x8a8478,a:.5,g:1}));if(Math.random()<dt*6)debris({p:new V(-1.4+rnd(-2,2),3.2,-3.05),sp:.2,size:[.04,.04,.04],c:0x6e6a63,life:10});}}
});
// free-standing wall made of blocks; bullet holes are children of the blocks so they stay on the debris
const bw=new THREE.Group();bw.position.set(-2.2,0,2.6);scene.add(bw);bw.visible=false;
const BWM=[0x99938a,0x8c877e,0xa39c90].map(c=>mat(c));
const bwBlocks=[];for(let r=0;r<5;r++)for(let c=0;c<6;c++){const b=mesh(Bx(.5,.44,.25),BWM[(r*7+c*3)%3],(c-2.5)*.5+(r%2?.12:0),.22+r*.44,0,bw);b.userData.p0=b.position.clone();bwBlocks.push(b);}
const holeGeo=new THREE.CircleGeometry(.03,7),chipGeo=new THREE.CircleGeometry(.07,7);
const holeM=new THREE.MeshBasicMaterial({color:0x0b0a09}),chipM=new THREE.MeshStandardMaterial({color:0x4a4640,flatShading:true});
function bwReset(){bw.visible=false;bwBlocks.forEach(b=>{b.position.copy(b.userData.p0);b.rotation.set(0,0,0);b.userData.ph=null;for(let i=b.children.length-1;i>=0;i--)b.remove(b.children[i]);});}
function bwHit(lx,ly,scale){let best=null,bd=9;bwBlocks.forEach(b=>{const d=Math.hypot(b.position.x-lx,b.position.y-ly);if(d<bd){bd=d;best=b;}});if(!best)return;
  const ox=clamp(lx-best.position.x,-.2,.2),oy=clamp(ly-best.position.y,-.17,.17);
  const ch=new THREE.Mesh(chipGeo,chipM);ch.position.set(ox,oy,.126);ch.rotation.z=rnd(0,6);ch.scale.setScalar(rnd(.8,1.3)*scale);best.add(ch);
  const h=new THREE.Mesh(holeGeo,holeM);h.position.set(ox,oy,.128);h.scale.setScalar(scale);best.add(h);
  impact('concreto',new V(bw.position.x+lx,ly,bw.position.z+.13),new V(0,0,1),.8);}
def({id:'parede',team:'d',name:'Parede derrubada com furos',short:'Rajada deixa furos e lascas; a parede cai em blocos e os furos continuam neles.',cost:'≤ 300 part.',costb:'30 blocos · furos presos',
  cam:[.4,1.7,6.6],tgt:[-2.2,.9,2.4],loop:8,
  q:'Parede, mureta ou barricada de concreto que perde a vida por tiros, explosão, Brutamonte ou carro (destruição do mapa e do arsenal).',
  v:'Cada bala abre um furo escuro com borda lascada, solta pó e pedrinhas. Quando a parede cede, ela se parte em blocos que tombam com física e uma nuvem de poeira rola pelo chão. Os furos de bala estão presos aos blocos: ficam nos pedaços caídos, girados junto com eles, e não somem quando a parede quebra.',
  b:'Furos são decalques filhos do pedaço (não do mundo), até 12 por bloco e 128 no total. Blocos contam no teto de 300 detritos e viram estáticos em repouso. Poeira: 60 sprites em meia resolução.',
  r:'O servidor manda vida da parede e a lista de furos (posição local de 2 bytes por furo). Quem entra depois vê os mesmos furos nos mesmos pedaços. Queda dos blocos usa semente comum.',
  setup(){Z.g.visible=false;bwReset();bw.visible=true;workL.intensity=2.2;},
  run(){for(let i=0;i<14;i++)at(.3+i*.11,()=>{const tip=new V(.6,1.3,7);muzzle('ak',tip,new V(-2.8,-.4,-4.4).normalize());bwHit(rnd(-1.3,1.3),rnd(.4,1.9),1);});
    at(2.2,()=>bwHit(-.2,1.1,2.2));
    at(3,()=>{S.shake+=.4;const c=new V(-.2,1.1,0);bwBlocks.forEach(b=>{const d=b.position.clone().sub(c);b.userData.ph={v:new V(d.x*rnd(.8,2),rnd(.5,2.5)+d.y*.5,rnd(-2.2,-.4)),w:new V(rnd(-4,4),rnd(-3,3),rnd(-4,4)),rest:false};});
      burst(norP,30,{p:new V(-2.2,1,2.6),box:[1.4,.8,.2],sp:[.3,1.2],drag:1.5,life:[1.5,2.6],size:[.4,.7],grow:3,c0:0x8a857a,c1:0x4a4640,a:.45});
      for(let i=0;i<n(16);i++)debris({p:new V(-2.2,1,2.6),box:[1.3,.8,.1],sp:[1,3],size:[.08,.07,.08],k:[.5,1.5],c:0x6e6a63,life:20});});
    at(3.6,()=>{S.shake+=.25;for(let i=0;i<n(60);i++){const a=rnd(0,6.283);norP.spawn({p:new V(-2.2+rnd(-1.4,1.4),.2,2.4+rnd(-.6,.4)),dir:new V(Math.cos(a),.3,Math.sin(a)).normalize(),cone:.4,sp:[.8,2.4],drag:1.3,life:[2.5,4.5],size:[.6,1],grow:3,c0:0x7a7268,c1:0x4a4640,a:.45,fi:.12});}
      setNote('furos de bala continuam nos blocos caídos');});},
  tick(dt){bwBlocks.forEach(b=>{const u=b.userData.ph;if(!u||u.rest)return;u.v.y-=9.8*dt;b.position.addScaledVector(u.v,dt);b.rotation.x+=u.w.x*dt;b.rotation.y+=u.w.y*dt;b.rotation.z+=u.w.z*dt;
    if(b.position.y<.13){b.position.y=.13;u.v.y*=-.25;u.v.x*=.5;u.v.z*=.5;u.w.multiplyScalar(.5);if(Math.abs(u.v.y)<.4&&Math.hypot(u.v.x,u.v.z)<.3){u.rest=true;b.rotation.x=Math.round(b.rotation.x/1.5708)*1.5708;b.rotation.z=Math.round(b.rotation.z/1.5708)*1.5708;}}});}
});
// deformable metal + fences (all at the same free spot as the block wall)
function keep(geo){geo.userData.p0=geo.attributes.position.array.slice();return geo;}
function restoreGeo(geo){geo.attributes.position.array.set(geo.userData.p0);geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();}
function dentAt(geo,lx,ly,r,depth){const a=geo.attributes.position.array;for(let i=0;i<a.length;i+=3){const d=Math.hypot(a[i]-lx,a[i+1]-ly);if(d<r){const f=1-d/r;a[i+2]+=depth*f*f*(1.2-.4*Math.random()*f);}}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();}
const SPOT=new V(-2.2,0,2.6);
// metal door
const md=new THREE.Group();md.position.copy(SPOT);scene.add(md);
const mdFrame=mat(0x2a2c2f,{metalness:.5,roughness:.5});mesh(Bx(.1,2.3,.12),mdFrame,-.62,1.15,0,md);mesh(Bx(.1,2.3,.12),mdFrame,.62,1.15,0,md);mesh(Bx(1.34,.1,.12),mdFrame,0,2.3,0,md);
mesh(Bx(4,2.4,.2),mat(0x8c877e),-2.7,1.2,-.05,md);mesh(Bx(4,2.4,.2),mat(0x8c877e),2.7,1.2,-.05,md);mesh(Bx(9.4,.3,.2),mat(0x8c877e),0,2.45,-.05,md);
const mdLeaf=new THREE.Group();mdLeaf.position.set(-.56,.02,0);md.add(mdLeaf);
const mdGeo=keep(new THREE.BoxGeometry(1.1,2.2,.05,14,24,1).translate(.56,1.1,0));
const mdMat=new THREE.MeshStandardMaterial({color:0x51625a,metalness:.55,roughness:.45,flatShading:true});
mesh(mdGeo,mdMat,0,0,0,mdLeaf);const mdKnob=mesh(Bx(.06,.06,.08),mdFrame,1,1.05,.06,mdLeaf);
// iron railing
const gr=new THREE.Group();gr.position.copy(SPOT);scene.add(gr);const grM=mat(0x2a2c2e,{metalness:.6,roughness:.5});
const grPosts=[-1.5,0,1.5].map(x=>mesh(Bx(.08,1.3,.08),grM,x,.65,0,gr));
const grBars=[.25,.75,1.2].map(y=>{const g=keep(new THREE.BoxGeometry(3.1,.045,.045,60,1,1));const m=mesh(g,grM,0,y,0,gr);return m;});
const grBal=[];for(let i=0;i<19;i++){const x=-1.42+i*.158;if(Math.abs(x)<.05||Math.abs(Math.abs(x)-1.5)<.05)continue;grBal.push(mesh(Bx(.025,1.0,.025),grM,x,.72,0,gr));}
// wooden fence
const fc=new THREE.Group();fc.position.copy(SPOT);scene.add(fc);const fcM=[0x8a6a44,0x7a5c3a,0x93744c].map(c=>mat(c));
const fcRails=[.35,1.0].map(y=>mesh(Bx(3.3,.08,.05),fcM[1],0,y,-.05,fc));
const fcPick=[];for(let i=0;i<12;i++){const m=mesh(Bx(.17,1.3,.035),fcM[i%3],-1.43+i*.26,.65,0,fc);m.userData.x0=m.position.x;fcPick.push(m);}
[-1.6,1.6].forEach(x=>mesh(Bx(.1,1.4,.1),fcM[1],x,.7,-.08,fc));
const workL=new THREE.PointLight(0xcfd8e8,0,14,1.6);workL.position.set(SPOT.x+1.6,3.2,SPOT.z+2.6);scene.add(workL);
function destReset(){workL.intensity=0;md.visible=false;restoreGeo(mdGeo);mdLeaf.rotation.set(0,0,0);mdLeaf.position.set(-.56,.02,0);mdMat.color.setHex(0x51625a);mdKnob.visible=true;
  gr.visible=false;gr.rotation.set(0,0,0);gr.position.copy(SPOT);grBars.forEach(b=>restoreGeo(b.geometry));grBal.forEach(b=>{b.position.z=0;b.rotation.set(0,0,0);});grPosts.forEach(p=>p.rotation.set(0,0,0));
  fc.visible=false;fc.rotation.set(0,0,0);fcRails.forEach(r=>r.rotation.set(0,0,0));fcPick.forEach(m=>{m.visible=true;m.scale.set(1,1,1);m.position.set(m.userData.x0,.65,0);m.rotation.set(0,0,0);});}
function sparkAt(p,dir,c,k){burst(streak,c,{p,dir,cone:k||.8,sp:[2.5,7],life:[.2,.5],len:.025,c0:0xfff0c0,c1:0xff5010,g:9.8,gnd:2});burst(addP,2,{p,size:[.1,.18],life:.06,c0:0xffd8a0,fi:0});}
function rustAt(p,c){burst(norP,c,{p,r:.1,sp:[.1,.5],life:[1,1.6],size:[.02,.035],c0:0x7a4a2a,a:.9,g:6,fi:0,gnd:1});burst(norP,Math.ceil(c/2),{p,r:.08,sp:[.2,.5],drag:2,life:[.8,1.3],size:[.08,.14],grow:3,c0:0x6a4a34,a:.3});}
def({id:'portametal',team:'d',name:'Porta de metal amassando',short:'Cada pancada afunda a chapa, descasca a tinta e solta faísca; a dobradiça arrebenta.',cost:'≤ 160 part.',costb:'malha deformável',
  cam:[.6,1.6,6.2],tgt:[-2.2,1.1,2.6],loop:7.5,
  q:'Porta, portão ou chapa de aço levando golpe de zumbi (Brutamonte 3×), tiro de 12 ou batida de carro.',
  v:'A chapa afunda onde apanha (malha deformada, não troca de modelo), com 3 níveis visíveis. Cada pancada solta faísca, lasca de tinta verde e pó de ferrugem. Quando a vida acaba, a dobradiça de cima estoura em faíscas, a porta tomba e raspa no chão soltando mais faísca.',
  b:'Deformação por vértice só na hora do golpe (CPU, 400 vértices). Por golpe: 8 faíscas, 5 lascas, 6 de ferrugem. Queda: 30 faíscas e 40 de poeira.',
  r:'O servidor guarda 3 bits de amassado por zona da porta (9 zonas). Quem entra depois vê a mesma porta amassada.',
  setup(){Z.g.visible=false;destReset();md.visible=true;workL.intensity=2.2;const h=H[3];h.g.visible=true;h.g.position.set(SPOT.x+.1,0,SPOT.z-.7);h.g.scale.set(1.3,1.3,1.3);h.g.rotation.y=0;this.fall=null;this.sh=0;},
  run(){const hits=[[.4,1.4],[.75,1.0],[.3,.7],[.6,1.7],[.5,1.2]];hits.forEach((h,i)=>at(.5+i*.75,()=>{H[3].st.swing={t:0,side:i%2};
      at(.5+i*.75+.15,()=>{dentAt(mdGeo,h[0],h[1],.42,.09+i*.025);this.sh=.2;const w=new V(SPOT.x-.56+h[0],h[1],SPOT.z+.06);sparkAt(w,new V(0,.3,1).normalize(),8);
        for(let k=0;k<n(5);k++)debris({p:w,dir:new V(0,.2,1).normalize(),cone:.9,sp:[.8,2.2],size:[.035,.004,.03],k:[.6,1.4],c:k%2?0x51625a:0x8a8f86,life:20,spin:16});rustAt(w,6);
        mdMat.color.lerp(tc.setHex(0x5a5048),.12);setNote('amassado '+Math.min(3,1+Math.floor(i/1.7))+' de 3');});}));
    at(4.4,()=>{sparkAt(new V(SPOT.x-.6,2.05,SPOT.z+.05),new V(1,.3,1).normalize(),30,1.2);S.shake+=.15;this.fall=0;setNote('dobradiça arrebentou');});
    at(5.2,()=>zwalk(H[3],new V(SPOT.x,0,SPOT.z+2.4),.8));},
  tick(dt,t){if(this.sh>0){this.sh-=dt;mdLeaf.position.z=Math.sin(t*80)*.03*this.sh*5;}
    if(this.fall!=null){this.fall+=dt;const k=Math.min(1,this.fall/.45);mdLeaf.rotation.x=k*k*Math.PI/2;mdLeaf.rotation.y=-k*.15;
      if(k>=1&&!this.landed){this.landed=1;S.shake+=.3;for(let i=0;i<5;i++)sparkAt(new V(SPOT.x-.5+i*.27,.03,SPOT.z+2.1),new V(0,.4,1).normalize(),8,1);
        burst(norP,40,{p:new V(SPOT.x,.15,SPOT.z+1.2),box:[.6,.05,1],dir:UP,cone:1.4,sp:[.6,2],drag:1.8,life:[1.4,2.4],size:[.25,.5],grow:3,c0:0x6a645a,a:.45});}}},
  stop(){this.fall=null;this.landed=0;this.sh=0;H[3].g.scale.set(1,1,1);}
});
def({id:'grade',team:'d',name:'Grade de ferro entortando',short:'A horda empurra, as barras envergam, a solda estoura em faísca e a grade tomba.',cost:'≤ 200 part.',costb:'3 barras deformáveis',
  cam:[1.4,1.8,6.4],tgt:[-2.2,.7,2.4],loop:7.5,
  q:'Grade, portão de ferro, corrimão ou alambrado com zumbis empurrando (pressão da horda) ou carro batendo.',
  v:'As barras envergam aos poucos no ponto de pressão e as verticais inclinam junto. Ferrugem cai em fio durante o esforço. Em dois momentos a solda estoura com um estalo de faíscas. No fim o poste do meio cede e a grade tomba, deixando o ferro torto no chão.',
  b:'Curvatura calculada só quando a pressão muda, até 180 vértices. Ferrugem: 10 por segundo durante o esforço. Estouro de solda: 20 faíscas.',
  r:'O servidor manda a pressão (0 a 1) e quando cede. A curva sai do valor, igual em todos os clientes.',
  setup(){Z.g.visible=false;destReset();gr.visible=true;workL.intensity=2.2;this.A=0;this.fall=null;[[-.6,.45],[.1,.5],[.6,.42],[-.1,1]].forEach(([x,dz],i)=>{const h=H[i];h.g.visible=true;h.g.position.set(SPOT.x+x,0,SPOT.z-dz);h.g.rotation.y=0;});},
  run(){at(1.6,()=>{sparkAt(new V(SPOT.x,.75,SPOT.z+.05),new V(0,.3,1).normalize(),20,1);S.shake+=.08;setNote('solda estourou');});
    at(3.2,()=>{sparkAt(new V(SPOT.x+.02,1.2,SPOT.z+.1),new V(0,.3,1).normalize(),20,1);S.shake+=.1;});
    at(4.3,()=>{this.fall=0;sparkAt(new V(SPOT.x-1.5,.25,SPOT.z),new V(-.3,.5,1).normalize(),14,1);sparkAt(new V(SPOT.x+1.5,.25,SPOT.z),new V(.3,.5,1).normalize(),14,1);setNote('grade cedeu');});
    at(4.9,()=>H.slice(0,4).forEach((h,i)=>zwalk(h,new V(h.g.position.x,0,SPOT.z+2.6+i*.3),.7)));},
  tick(dt,t){if(t<4.3){const A=Math.min(.42,t*.1);if(A-this.A>.004){this.A=A;
      grBars.forEach((b,j)=>{const a=b.geometry.attributes.position.array,p0=b.geometry.userData.p0;for(let i=0;i<a.length;i+=3){const f=Math.exp(-((p0[i]-.05)**2)/.55);a[i+2]=p0[i+2]+A*f*(1-j*.18);a[i+1]=p0[i+1]-A*.08*f;}b.geometry.attributes.position.needsUpdate=true;b.geometry.computeVertexNormals();});
      grBal.forEach(b=>{const f=Math.exp(-((b.position.x-.05)**2)/.55);b.position.z=A*f*.85;b.rotation.x=A*f*.25;});grPosts[1].rotation.x=A*.5;}
      emit('rust',norP,10,dt,()=>({p:new V(SPOT.x+rnd(-.6,.6),rnd(.3,1.2),SPOT.z+this.A*.8),sp:[0,.2],life:[.8,1.2],size:[.015,.03],c0:0x7a4a2a,a:.9,g:6,fi:0,gnd:1}));
      H.slice(0,3).forEach((h,i)=>{h.arms.forEach(a=>a.rotation.x=-.1+Math.sin(t*9+i)*.1);});}
    if(this.fall!=null){this.fall+=dt;const k=Math.min(1,this.fall/.55);gr.rotation.x=k*k*1.45;
      if(k>=1&&!this.landed){this.landed=1;S.shake+=.25;for(let i=0;i<4;i++)sparkAt(new V(SPOT.x-1.2+i*.8,.04,SPOT.z+1.2),new V(0,.5,1).normalize(),6,1);
        burst(norP,30,{p:new V(SPOT.x,.12,SPOT.z+.8),box:[1.4,.05,.5],dir:UP,cone:1.4,sp:[.5,1.6],drag:1.8,life:[1.2,2.2],size:[.2,.4],grow:3,c0:0x6a645a,a:.4});}}},
  stop(){this.fall=null;this.landed=0;}
});
def({id:'cerca',team:'d',name:'Cerca de madeira quebrando',short:'Tábuas partem uma a uma, lascas e pó, e a seção tomba com a horda passando.',cost:'≤ 150 part.',costb:'12 tábuas',
  cam:[1,1.6,6],tgt:[-2.2,.7,2.4],loop:7.5,
  q:'Cerca, portão de quintal ou barricada de tábuas recebendo tiro, golpe ou pressão da horda.',
  v:'Cada tábua parte num ponto aleatório: o toco fica preso no trilho e o pedaço de cima voa com lascas e pó de madeira. O zumbi aparece pelo vão. No fim o trilho racha e a seção inteira tomba para frente.',
  b:'Cada tábua é uma peça: quebra troca para toco + pedaço com física. Por quebra: 6 lascas, 8 de pó. Tombo: 35 de poeira.',
  r:'O servidor manda quais tábuas quebraram (12 bits) e quando a seção cai.',
  setup(){Z.g.visible=false;destReset();fc.visible=true;workL.intensity=2.2;this.fall=null;[[-.8,.6],[.5,.7],[0,1.2]].forEach(([x,dz],i)=>{const h=H[i];h.g.visible=true;h.g.position.set(SPOT.x+x,0,SPOT.z-dz);h.g.rotation.y=0;});},
  run(){const order=[3,4,8,5,9,2,7];order.forEach((pi,i)=>at(.4+i*.5,()=>{const m=fcPick[pi];const cut=rnd(.32,.6);const top=1.3-cut;m.scale.y=cut/1.3;m.position.y=cut/2;
      const w=new V(SPOT.x+m.position.x,cut,SPOT.z);H[i%3].st.swing={t:0,side:i%2};
      debris({p:w.clone().add(new V(0,top/2,0)),v:new V(rnd(-.8,.8),rnd(1.5,3),rnd(1.5,3)),sp:0,size:[.17,top,.035],c:0x8a6a44,spin:7,life:20,bounce:.2});
      for(let k=0;k<n(6);k++)debris({p:w,dir:new V(0,.4,1).normalize(),cone:.9,sp:[1,3],size:[.012,.012,.1],k:[.6,1.4],c:0xb08a5a,life:20});
      burst(norP,8,{p:w,dir:new V(0,0,1),cone:.8,sp:[.4,1.4],drag:2,life:[.8,1.4],size:[.1,.18],grow:3,c0:0x7a6048,a:.4});}));
    at(4.2,()=>{this.fall=0;for(let k=0;k<n(10);k++)debris({p:new V(SPOT.x+rnd(-1.4,1.4),1,SPOT.z),dir:new V(0,.4,1).normalize(),cone:.9,sp:[1,3],size:[.012,.012,.1],c:0xb08a5a,life:20});setNote('trilho rachou · seção tombou');});
    at(4.8,()=>H.slice(0,3).forEach((h,i)=>zwalk(h,new V(h.g.position.x,0,SPOT.z+2.5),.75)));},
  tick(dt){if(this.fall!=null){this.fall+=dt;const k=Math.min(1,this.fall/.5);fc.rotation.x=k*k*1.5;
      if(k>=1&&!this.landed){this.landed=1;S.shake+=.2;burst(norP,35,{p:new V(SPOT.x,.12,SPOT.z+.8),box:[1.5,.05,.5],dir:UP,cone:1.4,sp:[.5,1.6],drag:1.8,life:[1.2,2.2],size:[.25,.45],grow:3,c0:0x6a5a48,a:.4});}}},
  stop(){this.fall=null;this.landed=0;}
});
// table made of parts: damage goes to the part that was hit
const tb=new THREE.Group();tb.position.copy(SPOT);scene.add(tb);const tbM=[0x7a5530,0x6b4a2a,0x845c36].map(c=>mat(c));
const tbQ=[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],i)=>{const m=mesh(Bx(.6,.06,.4),tbM[i%3],sx*.3,.78,sz*.2,tb);m.userData.p0=m.position.clone();return m;});
const tbL=[];[[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sz])=>{for(const [y,h] of[[.2,.4],[.575,.35]]){const m=mesh(Bx(.07,h,.07),tbM[1],sx*.52,y,sz*.32,tb);m.userData.p0=m.position.clone();m.userData.h=h;tbL.push(m);}});
function tbReset(){tb.visible=false;tb.rotation.set(0,0,0);tb.position.copy(SPOT);[...tbQ,...tbL].forEach(m=>{m.visible=true;m.position.copy(m.userData.p0);m.rotation.set(0,0,0);for(let i=m.children.length-1;i>=0;i--)m.remove(m.children[i]);});}
function tbW(m){m.updateMatrixWorld();return new V().setFromMatrixPosition(m.matrixWorld);}
function tbDetach(m,v,size){const p=tbW(m);m.visible=false;debris({p,v,sp:0,size,c:0x7a5530,spin:6,life:20,bounce:.25});}
function chips(p,dir,c,k){for(let i=0;i<n(c);i++)debris({p,dir,cone:k||.9,sp:[1,3],size:[.012,.012,.09],k:[.6,1.4],c:0xb08a5a,life:20});burst(norP,c,{p,dir,cone:.8,sp:[.3,1.2],drag:2,life:[.8,1.4],size:[.08,.15],grow:3,c0:0x7a6048,a:.4});}
def({id:'pontos',team:'d',name:'Quebra pelo ponto atingido',short:'Tiro na perna, facão na quina, taco no tampo e 12 de perto: cada arma quebra a parte que pegou.',cost:'≤ 120 part.',costb:'peças com vida própria',
  cam:[.2,1.6,5.4],tgt:[-2.2,.6,2.6],loop:7.5,
  q:'Qualquer item destrutível. O dano vai para a peça que foi atingida, não para o item inteiro.',
  v:'Tiro de 9 mm na perna da frente: a parte de baixo da perna parte e a mesa tomba para aquele canto. Facão na quina do tampo: a quina sai inteira num corte reto, com lascas em linha. Taco no outro canto: o tampo racha e se desfaz em pedaços com pó. 12 de perto no que sobrou: 9 furos agrupados que ficam na madeira.',
  b:'Cada peça tem vida e material. Item comum: 4 a 12 peças. Partículas só da peça atingida, pelo material dela.',
  r:'O servidor manda qual peça perdeu vida e quanto. Peça solta simula no cliente; a posição final é mandada uma vez.',
  setup(){Z.g.visible=false;tbReset();tb.visible=true;workL.intensity=2.2;},
  run(){at(.6,()=>{const leg=tbL[0];const p=tbW(leg);muzzle('glock',new V(-.4,1,6),p.clone().sub(new V(-.4,1,6)).normalize());chips(p,new V(0,.2,1).normalize(),6);tbDetach(leg,new V(.4,.6,1.4),[.07,.4,.07]);this.tilt=0;setNote('9 mm na perna · a peça de baixo partiu');});
    at(2.2,()=>{const q=tbQ[1];const p=tbW(q);for(let i=0;i<8;i++){const pp=p.clone().add(new V(-.3+i*.08,.03,0));chips(pp,new V(0,.6,1).normalize(),1,.4);}tbDetach(q,new V(1.2,1.5,1),[.6,.06,.4]);setNote('facão na quina · corte reto, a quina saiu');});
    at(3.8,()=>{const q=tbQ[2];const p=tbW(q);S.shake+=.12;chips(p,UP,10,1.3);q.visible=false;for(let i=0;i<4;i++)debris({p:p.clone().add(new V(rnd(-.2,.2),0,rnd(-.1,.1))),dir:UP,cone:1.2,sp:[1,2.5],size:[rnd(.15,.3),.06,rnd(.12,.25)],c:0x6b4a2a,spin:8,life:20,bounce:.2});
      burst(norP,20,{p,r:.2,sp:[.3,1],drag:2,life:[1,1.8],size:[.2,.35],grow:3,c0:0x7a6048,a:.4});setNote('taco no tampo · rachou em pedaços');});
    at(5.3,()=>{const q=tbQ[3];const tip=new V(.2,1.1,4.6),p=tbW(q);muzzle('r870',tip,p.clone().sub(tip).normalize());
      for(let i=0;i<9;i++){const ox=rnd(-.15,.15),oz=rnd(-.1,.1);const h=new THREE.Mesh(holeGeo,holeM);h.rotation.x=-Math.PI/2;h.position.set(ox,.032,oz);q.add(h);const c=new THREE.Mesh(chipGeo,new THREE.MeshStandardMaterial({color:0xb08a5a,flatShading:true}));c.rotation.x=-Math.PI/2;c.scale.setScalar(.6);c.position.set(ox,.031,oz);q.add(c);}
      chips(p,UP,10,1);setNote('12 de perto · 9 furos agrupados que ficam');});},
  tick(dt){if(this.tilt!=null&&this.tilt<1){this.tilt=Math.min(1,this.tilt+dt*3);const k=ease(this.tilt);tb.rotation.x=.2*k;tb.rotation.z=.17*k;tb.position.y=SPOT.y-.03*k;}},
  stop(){this.tilt=null;}
});
// pressure cylinders: extinguisher spins in a powder cloud, oxygen bottle turns into a rocket
const cy=new THREE.Group();scene.add(cy);const cyM=new THREE.MeshStandardMaterial({color:0xb3221c,roughness:.4,metalness:.4,flatShading:true});
const cyBody=mesh(new THREE.CylinderGeometry(.09,.09,.5,10),cyM,0,.25,0,cy);const cyCap=mesh(new THREE.CylinderGeometry(.04,.05,.1,8),mat(0x2a2a2a,{metalness:.6}),0,.55,0,cy);
function cyReset(){cy.visible=false;cy.position.copy(SPOT);cy.rotation.set(0,0,0);}
def({id:'pressao',team:'d',name:'Extintor e cilindro de oxigênio',short:'Tiro no extintor faz nuvem branca e giro; no oxigênio a válvula quebra e o cilindro vira foguete.',cost:'≤ 250 part.',costb:'entidade de nuvem',
  cam:[1.6,1.5,6.4],tgt:[-1.6,.4,2.4],loop:7,param:{lbl:'Cilindro',opts:['Extintor','Oxigênio'],def:0},
  q:'Tiro, golpe forte ou fogo em extintor, cilindro de oxigênio ou de solda (chaves extintor e cilindro_oxigenio do catálogo do mapa).',
  v:'Extintor: o furo solta um jato de pó branco, o extintor cai, gira no chão empurrado pelo jato e enche uma área de 5 m de nuvem que tapa a visão por 6 s. Oxigênio: a válvula quebra com estalo, o jato vira propulsão, o cilindro dispara rente ao chão raspando e soltando faísca, quica e para numa parede. Com fogo por perto, o oxigênio estoura como o barril.',
  b:'Jato: 60 partículas por segundo por 3 s. Nuvem do extintor: até 40 sprites grandes. Faísca de raspagem como a do carro.',
  r:'Nuvem do extintor é entidade no servidor (bloqueia visão de zumbi e de jogador). A trajetória do cilindro usa semente comum e o servidor corrige a posição final.',
  setup(pr){Z.g.visible=false;cyReset();cy.visible=true;workL.intensity=2.2;const ox=pr===1;cyM.color.setHex(ox?0x2f6a3a:0xb3221c);cyBody.scale.set(ox?1.3:1,ox?2.4:1,ox?1.3:1);cyBody.position.y=ox?.6:.25;cyCap.position.y=ox?1.25:.55;
    this.st={p:SPOT.clone(),v:new V(),ang:0,w:0,on:false,ox};},
  run(pr){at(.6,()=>{const s=this.st;muzzle('glock',new V(.4,1.2,6.4),new V(-.5,-.15,-1).normalize());S.shake+=.1;s.on=true;
      if(s.ox){sparkAt(new V(SPOT.x,1.3,SPOT.z),UP,20,1.2);setNote('válvula quebrou · vira foguete');s.v.set(-5,0,-.3);}else{setNote('extintor furado · nuvem de pó, 6 s sem visão');s.w=9;}});},
  tick(dt,t,pr){const s=this.st;if(!s||!s.on)return;const k=clamp(1-(t-.6)/3.4,0,1);
    if(!s.ox){cy.rotation.z=lerp(cy.rotation.z,Math.PI/2,dt*8);cy.position.y=lerp(cy.position.y,.09,dt*8);s.ang+=s.w*k*dt;cy.rotation.y=s.ang;
      const dir=new V(Math.cos(s.ang),0,-Math.sin(s.ang));cy.position.addScaledVector(dir,-.6*k*dt);
      const tip=cy.position.clone().addScaledVector(dir,.3).setY(.1);
      if(k>0){emit('jet',norP,60,dt,()=>({p:tip,dir,cone:.3,sp:[3,6],drag:2.5,life:[2,3.5],size:[.15,.3],grow:6,c0:0xeeeeea,c1:0xbfc3c8,a:.45,g:-.05,fi:.05}));}
      if(t<7)emit('cloud',norP,4,dt,()=>({p:SPOT.clone().setY(.6),r:2.5,flat:true,sp:[.05,.2],life:[3,5],size:[1.5,2.5],grow:1.3,c0:0xe2e2de,a:.18*Math.min(1,(t-.6)),fi:.3}));}
    else{if(k>0){s.v.x-=4*k*dt;}s.v.multiplyScalar(Math.exp(-dt*(k>0?.3:3)));cy.rotation.z=lerp(cy.rotation.z,-Math.PI/2,dt*10);cy.position.y=lerp(cy.position.y,.12,dt*10);cy.position.addScaledVector(s.v,dt);
      if(cy.position.x<-8.2){cy.position.x=-8.2;s.v.x*=-.3;S.shake+=.08;sparkAt(cy.position.clone(),new V(1,.5,0).normalize(),16,1);}
      const back=cy.position.clone().add(new V(1.1,0,0));
      if(k>0){emit('jet',norP,50,dt,()=>({p:back,dir:new V(1,0,0),cone:.25,sp:[2,4],drag:3,life:[.5,.9],size:[.1,.2],grow:4,c0:0xdde6ee,a:.2}));}
      if(Math.abs(s.v.x)>.5)emit('scr',streak,120,dt,()=>({p:cy.position.clone().setY(.03),dir:new V(1,.4,0).normalize(),cone:.6,sp:[2,6],v:new V(s.v.x*.5,0,0),life:[.2,.45],len:.02,c0:0xfff0c0,c1:0xff5010,g:9.8,gnd:2}));}}
});
def({id:'incendio',team:'m',name:'Prédio em chamas',short:'Fogo saindo pelas janelas, lambendo a fachada, brasas e fumaça com vento.',cost:'≤ 600 part.',costb:'2 luzes · referência',
  cam:[3,2.4,6.5],tgt:[1.5,4,-4],loop:0,
  q:'Incêndio de prédio (molotov, explosão, veículo). Dura minutos e espalha para o vizinho.',
  v:'Janelas acesas em laranja que tremem, línguas de fogo saindo pela parte de cima de cada janela e subindo pela fachada, brasas levadas pelo vento e uma coluna de fumaça grossa inclinada. A luz pinta a rua.',
  b:'Até 600 partículas por prédio e 2 luzes de fogo. Além de 80 m fica só a coluna de fumaça e o brilho das janelas, que viram ponto de referência.',
  r:'Entidade de fogo no servidor por prédio, com estado de espalhar.',
  setup(){Z.g.visible=false;},
  tick(dt,t){const wind=new V(.9,0,0);fireWins.forEach((w,i)=>{const f=.6+.4*Math.sin(t*(9+i*3))*Math.sin(t*5.7+i);w.material.color.setRGB(1,.42*f+.1,.05*f);
      const c=w.position.clone().add(new V(0,.55,.12));fireEmit('w'+i,dt,c,.55,1.1,{dir:new V(0,1,.35).normalize(),wind,smoke:22,smokeA:.5});
      fireLight(i?fireL2:fireL,w.position.clone().add(new V(0,0,1.4)),3,t+i);});}
});
def({id:'chuva',team:'m',name:'Chuva, respingos e poças',short:'Gotas com vento, respingos e anéis só perto da câmera, relâmpago no temporal.',cost:'≤ 4.000 gotas',costb:'respingo até 12 m',
  cam:[2,2,7],tgt:[-1,.6,1],loop:0,param:{lbl:'Intensidade',opts:['Garoa','Chuva','Temporal'],def:1},
  q:'Clima do mundo. Chuva aumenta o ruído de fundo e mascara passos (dá para usar na furtividade).',
  v:'Garoa fina quase vertical. Chuva com respingos no asfalto e anéis nas poças, que ficam escuras e espelhadas. Temporal com gotas inclinadas pelo vento, cortinas de água passando e relâmpago duplo que clareia a cena por 0,2 s e revela a horda.',
  b:'Até 4.000 gotas presas à câmera numa caixa de 30 m. Respingos e anéis só a menos de 12 m e só em cima do que a câmera vê.',
  r:'O servidor manda o clima e a semente do relâmpago, para todos verem o mesmo clarão.',
  setup(){lampCone.visible=true;PUD.forEach(p=>decal(p[0],0,p[1],p[2]*2,0x0c1016,{grow:0,life:1e6,ar:p[3]/p[2]}));},
  run(pr){const n0=[900,2200,4000][pr],w=[.3,1.2,4.5][pr];initRain(n0,w);this.nl=rnd(2,4);setNote(['Garoa','Chuva','Temporal'][pr]);},
  tick(dt,t,pr){updateRain(dt,pr>0);
    if(pr===2){if(t>this.nl){this.nl=t+rnd(3.5,6);this.lf=0;}
      if(this.lf!=null){this.lf+=dt;const k=this.lf;const I=(k<.08?1:k<.16?.2:k<.26?.8:0);hemi.intensity=.6+I*3.2;scene.background.setRGB(.043+I*.25,.063+I*.27,.094+I*.32);S.white=Math.max(S.white,I*.12);if(k>.4){this.lf=null;hemi.intensity=.6;scene.background.setHex(NIGHT);}}
      emit('sheet',norP,2.5,dt,()=>({p:new V(-12,2.5,rnd(-1,8)),box:[0,2,0],v:new V(7,-.5,0),sp:0,life:[3,4],size:[3,5],grow:1.3,c0:0x8a9ab0,a:.06,fi:.3}));}}
});
def({id:'neblina',team:'m',name:'Neblina e cinzas',short:'Névoa rasteira em camadas, cinza caindo e o poste com cone de luz.',cost:'≤ 120 sprites',costb:'1 cone de luz',
  cam:[3,1.8,7.5],tgt:[-3,1.2,-1],loop:0,
  q:'Madrugada, perto de rio e em zonas queimadas (cinza). Reduz a visão dos zumbis e do jogador.',
  v:'Neblina do motor mais uma camada de névoa baixa que se move devagar, cinza fina caindo em espiral e o feixe dos postes visível. Silhuetas de zumbis aparecem antes dos detalhes.',
  b:'Até 60 sprites grandes de névoa (meia resolução) e 60 de cinza. O cone do poste é uma malha aditiva, não luz volumétrica real.',
  r:'Clima vem do servidor. Densidade é local por zona.',
  setup(){scene.fog.density=.075;lampCone.visible=true;Z.g.visible=false;[[-3,-1],[1,-2.4],[5,.4]].forEach(([x,z],i)=>{const h=H[i];h.g.visible=true;h.g.position.set(x,0,z);h.g.rotation.y=rnd(-.6,.6);});},
  tick(dt){emit('fog',norP,5,dt,()=>({p:new V(rnd(-14,10),rnd(.2,1.1),rnd(-3,8)),v:new V(rnd(.15,.35),0,rnd(-.05,.05)),sp:0,life:[9,13],size:[3,5],grow:1.4,c0:0x7d8aa0,a:.13,fi:.35}));
    emit('ash',norP,14,dt,()=>({p:new V(rnd(-10,8),rnd(4,6),rnd(-3,7)),v:new V(rnd(.1,.4),-.35,rnd(-.1,.1)),sp:[.05,.15],life:[8,12],size:[.025,.04],c0:0xa09a90,a:.75,fi:.1,gnd:1}));}
});

// VEÍCULOS
def({id:'faisca',team:'v',name:'Faíscas de raspagem',short:'Para-choque arrastando no asfalto: rio de faíscas que quicam e marca no chão.',cost:'≤ 200 faíscas/s',costb:'1 luz',
  cam:[2,1.6,5.5],tgt:[3,.3,1.5],loop:4.4,
  q:'Peça de carro em contato com o chão ou com parede (para-choque caído, roda sem pneu, carro capotado deslizando).',
  v:'Jato de faíscas para trás do movimento, que quicam no asfalto e apagam do branco para o laranja. Brilho e luz curta no ponto de contato. Marca escura riscada no chão.',
  b:'Até 200 faíscas por segundo, 1 luz. A mais de 40 m vira só o brilho do ponto.',
  r:'Cosmético, a partir do estado da peça e da velocidade que já são replicados.',
  setup(){Z.g.visible=false;car.rotation.y=-Math.PI/2;car.position.set(10,0,1.5);},
  tick(dt,t){const x=10-t*2.4;car.position.x=x;const p=carW(.6,.06,2.15);p.y=.04;
    emit('sp',streak,200,dt,()=>({p,dir:new V(1,.35,0).normalize(),cone:.55,sp:[3,8],v:new V(-2.4,0,0),life:[.2,.5],len:.02,c0:0xfff0c0,c1:0xff5010,g:9.8,gnd:2}));
    emit('gl',addP,40,dt,()=>({p,r:.05,size:[.08,.16],life:.05,c0:0xffd8a0,fi:0}));
    if(Math.random()<dt*14)decal(p.x,0,p.z+rnd(-.05,.05),.12,0x0a0a0a,{grow:0,life:60,ar:.25});
    fireLight(fireL,p.clone().add(new V(0,.3,0)),1.6,t*3);}
});
def({id:'motor',team:'v',name:'Fumaça do motor',short:'Vapor branco, fumaça cinza, depois preta com fogo, conforme a condição.',cost:'≤ 120 part.',costb:'contínuo',
  cam:[9.5,2.6,5.2],tgt:[5.2,.9,1.5],loop:0,param:{lbl:'Condição',opts:['100','60','30','10'],def:2},
  q:'Sempre que o motor está ligado ou quente, a partir da condição da peça (0 a 100) do brief da frota.',
  v:'100: só escapamento. 60: fio de vapor branco saindo pelo capô. 30: fumaça cinza constante e faísca de vez em quando. 10: fumaça preta grossa, chamas na grade e luz de fogo, aviso de que vai explodir.',
  b:'Contínuo, então barato: até 40 partículas por segundo e 1 luz só no estado crítico.',
  r:'Sai da condição do motor, que já é replicada.',
  setup(){Z.g.visible=false;},
  run(pr){setNote('Condição do motor: '+['100','60','30','10'][pr]+'/100');},
  tick(dt,t,pr){const hood=carW(0,1.02,1.4),ex=carW(.5,.3,-2.2);
    emit('ex',norP,pr===3?6:3,dt,()=>({p:ex,dir:carW(.5,.3,-3).sub(ex).normalize(),cone:.3,sp:[.6,1.2],drag:1.2,life:[1,1.8],size:[.06,.12],grow:5,c0:pr>1?0x55524e:0x9a9a96,a:.18,g:-.2}));
    if(pr===1)emit('st',norP,14,dt,()=>({p:hood,box:[.4,0,.3],dir:UP,cone:.35,sp:[.5,1],drag:.8,life:[1.4,2.4],size:[.15,.25],grow:4,c0:0xc8ccd0,a:.22,g:-.3}));
    if(pr===2){emit('st',norP,22,dt,()=>({p:hood,box:[.4,0,.3],dir:UP,cone:.35,sp:[.6,1.2],drag:.6,life:[2,3],size:[.2,.35],grow:4,c0:0x6a6a68,c1:0x3a3a3c,a:.4,g:-.35}));if(Math.random()<dt*.8)burst(streak,8,{p:carW(0,.7,2.1),dir:carW(0,.9,3).sub(carW(0,.7,2.1)).normalize(),cone:.6,sp:[2,4],life:.3,len:.02,c0:0xffd080,c1:0xff4000,g:9.8});}
    if(pr===3){emit('st',norP,34,dt,()=>({p:hood,box:[.5,0,.4],dir:UP,cone:.3,sp:[.8,1.6],drag:.4,life:[2.5,3.8],size:[.3,.5],grow:4.5,c0:0x1c1b1b,c1:0x0e0e10,a:.6,g:-.4}));fireEmit('hood',dt,carW(0,.8,2.0),.3,.45,{nosmoke:true});fireLight(fireL,carW(0,1.2,2.6),2.2,t);}
    else fireL.intensity=0;}
});
def({id:'vazamento',team:'v',name:'Vazamento e incêndio do tanque',short:'Gasolina pingando, poça, uma faísca e o fogo correndo até o tanque.',cost:'≤ 400 part.',costb:'entidade de fogo',
  cam:[10,2.4,4.2],tgt:[5.6,.4,0],loop:11,
  q:'Tanque furado por tiro ou batida. Faísca, tiro ou fogo próximo acende a poça.',
  v:'Pingos de gasolina com brilho oleoso formando uma poça que cresce. Um tiro no metal solta faísca, o fogo acende na poça, corre até o carro e, se ninguém apagar, o carro explode.',
  b:'Pingos: 12 por segundo. Fogo de poça como o do molotov. A explosão final é o efeito seguinte.',
  r:'Poça e fogo são entidades no servidor (podem queimar zumbis e jogadores).',
  setup(){Z.g.visible=false;},
  run(){this.tank=carW(-.6,.25,-1.3);this.pool=this.tank.clone().setY(0).add(new V(-1.2,0,-.6));decal(this.pool.x,0,this.pool.z,2.2,0x1f2230,{grow:3,life:60,ar:.6,fluid:'oil'});
    at(3.4,()=>{const p=carW(-.96,.6,-1.2);impact('metal',p,carW(-2,.6,-1.2).sub(p).normalize(),1.5);burst(streak,14,{p:this.pool.clone().add(new V(0,.05,0)),cone:1.4,sp:[1,3],life:.3,len:.02,c0:0xffd080,c1:0xff4000,g:9.8});});
    at(7.2,()=>vehicleBoom());},
  tick(dt,t){if(t<7.2)emit('drip',norP,12,dt,()=>({p:this.tank,box:[.05,0,.05],sp:0,life:1,size:.03,c0:0x5a5a7a,a:.9,g:9.8,fi:0,gnd:1}));
    if(t>3.5&&t<7.2){const k=clamp((t-3.5)/2.5,0,1);const c=this.pool.clone().lerp(this.tank.clone().setY(0),k*.8);fireEmit('vz',dt,c,.6+k*.4,1.1,{smoke:14});fireEmit('vz2',dt,this.pool,.7,.8,{smoke:6});fireLight(fireL,c.clone().add(new V(0,1,0)),3,t);}
    if(t>=7.2)this.wreck(dt,t);},
  wreck(dt,t){fireEmit('wr',dt,car.position.clone().add(new V(0,.9,0)),.8,1.4,{smoke:18,smokeA:.55});fireLight(fireL,car.position.clone().add(new V(0,1.6,0)),3.4,t);carTick(dt);}
});
function vehicleBoom(){const p=car.position.clone().add(new V(0,.6,0));explode(p,1.8,{chip:0x2a1a14});carBodyMat.color.setHex(0x1f1813);carCabMat.color.setHex(0x0b0b0b);ws.visible=false;car.userData.vy=4.5;car.userData.spin=.9;
  for(let i=0;i<n(30);i++)debris({p:p.clone().add(new V(0,.7,0)),dir:UP,cone:1.3,sp:[2,6],size:[.06,.006,.06],c:0xa8c8d8,life:20});
  debris({p:carW(0,1,1.4),v:new V(rnd(-1,1),9,rnd(-1,1)),sp:0,size:[1.6,.06,1.2],c:0x3a1d18,spin:6,life:20,bounce:.2});
  for(const s of[-1,1])debris({p:carW(s*.95,.7,.3),v:carW(s*4,3,.3).sub(carW(0,0,.3)).setY(3),sp:0,size:[.06,.7,1.1],c:0x3a1d18,spin:5,life:20,bounce:.2});
  debris({p:carW(.95,.38,1.35),v:new V(3,4,2),sp:0,size:[.3,.76,.76],c:0x111111,spin:8,life:20,bounce:.4});}
function carTick(dt){const u=car.userData;if(u.vy==null)return;u.vy-=9.8*dt;car.position.y=Math.max(0,car.position.y+u.vy*dt);car.rotation.z+=(u.spin||0)*dt;u.spin*=Math.exp(-dt*2);if(car.position.y===0&&u.vy<0){u.vy=null;car.rotation.z=clamp(car.rotation.z,-.25,.25);}}
def({id:'explosao',lab:1,team:'v',name:'Explosão do carro',short:'Bola de fogo, carro pulando, capô e portas voando, carcaça queimando.',cost:'≤ 600 part.',costb:'evento raro',
  cam:[12,4.2,8],tgt:[5.6,1,.8],loop:10,
  q:'Tanque em chamas por mais de 4 s, ou dano acima do limite em carro com combustível.',
  v:'Explosão grande (escala 1,8 da granada), o carro pula e cai torto, capô, portas e uma roda saem voando, vidro estoura em cacos. A lataria fica preta e a carcaça queima com fumaça preta por minutos.',
  b:'Pico de 600 partículas e 34 detritos. É evento raro e pode passar do teto por evento, nunca do teto global.',
  r:'Explosão no servidor. O carro vira carcaça (outro prefab) para todos.',
  setup(){Z.g.visible=false;car.userData.vy=null;},
  run(){at(.4,()=>vehicleBoom());},
  tick(dt,t){if(t>.5){fireEmit('wr',dt,car.position.clone().add(new V(0,.9,0)),.8,1.4,{smoke:18,smokeA:.55});fireLight(fireL,car.position.clone().add(new V(0,1.6,0)),3.4,t);}carTick(dt);}
});
def({id:'parabrisa',team:'v',name:'Para-brisa: sangue e rachadura',short:'Visão de dentro do carro: pancadas, trincas em 4 estágios e mão de sangue.',cost:'0 partículas',costb:'máscara 4 estágios',
  cam:null,tgt:null,loop:5.8,
  q:'Zumbi batendo no para-brisa ou no vidro lateral (brief da frota: vidro aguenta 8 golpes).',
  v:'Cada golpe treme a câmera e soma uma trinca em estrela. Estágio 2 e 4 deixam mancha de sangue com marca de mão escorrendo. No estágio 4 o vidro está branco de rachadura e o próximo golpe quebra.',
  b:'Só textura: uma máscara de rachadura com 4 estágios e um decal de sangue no vidro. Pó de vidro: 6 partículas por golpe.',
  r:'O servidor manda a vida do vidro. Sangue no vidro é local.',
  setup(){Z.g.visible=false;const h=H[0];h.g.visible=true;const p=carW(0,0,3.1);h.g.position.copy(p);h.g.rotation.y=CAR0.ry+Math.PI;
    camera.position.copy(carW(-.3,1.35,-.2));controls.target.copy(carW(0,1.2,2.2));this.camSet=1;},
  run(){const hits=[[90,40],[170,60],[120,75],[60,50]];hits.forEach((hp,i)=>at(.6+i*.85,()=>{H[0].st.swing={t:0,side:i%2};
      at(.6+i*.85+.15,()=>{wsMarks.push({t:'c',c:crackAt(hp[0],hp[1],i>1)});if(i===1||i===3){const st=[];for(let k=0;k<5;k++)st.push({x:hp[0]-18+k*8,y:hp[1]-10,dx:rnd(-3,3),dy:rnd(18,40),w:rnd(5,9)});wsMarks.push({t:'s',st});}
        drawWS();S.shake+=.18;burst(addP,6,{p:carW(-.1,1.25,.75),box:[.4,.1,.05],size:[.01,.03],life:[.2,.5],c0:0xffffff,a:.8,fi:.2});setNote('golpe '+(i+1)+' · estágio '+(i+1)+' de 4');});}));}
});
def({id:'farol',team:'v',name:'Faróis na chuva',short:'Feixe visível, gotas acesas dentro do cone e a horda entrando na luz.',cost:'≤ 600 gotas acesas',costb:'2 spots sem sombra',
  cam:[-2.5,2,5.5],tgt:[4,1,6],loop:0,
  q:'Faróis ligados à noite, com chuva ou neblina.',
  v:'Dois cones de luz visíveis no ar, gotas de chuva que brilham só dentro do feixe e silhuetas de zumbi que acendem quando entram na luz. Fora do cone, a chuva quase some.',
  b:'2 spotlights sem sombra, 2 cones aditivos e até 600 gotas extras só dentro do cone. Faróis de carros a mais de 40 m ficam só como cone, sem luz real.',
  r:'Estado do farol já é replicado com o carro.',
  setup(){scene.fog.density=.05;headSpots.forEach(s=>s.intensity=2.4);headCones.forEach(c=>c.visible=true);hlMat.color.setHex(0xfff1d0);initRain(1800,.8);
    H.forEach((h,i)=>{if(i>5)return;h.g.visible=true;const p=carW(rnd(-2,2),0,rnd(8,18));h.g.position.copy(p);zwalk(h,carW(rnd(-.6,.6),0,2.6),.7);});},
  tick(dt){updateRain(dt,true);const o=carW(0,.74,2.15),f=carW(0,.74,3.15).sub(o).normalize(),side=new V(f.z,0,-f.x);
    emit('lit',streak,600,dt,()=>{const d=rnd(1,13),r=d*.33*Math.sqrt(Math.random()),a=rnd(0,6.283);const p=o.clone().addScaledVector(f,d).addScaledVector(side,Math.cos(a)*r);p.y+=Math.sin(a)*r*.6;return{p,v:new V(.8,-14,0),sp:0,life:.06,len:.035,c0:0xcfdcf0,a:.9};});
    H.forEach((h,i)=>{if(i>5||!h.g.visible)return;if(!h.st.walk){const p=carW(rnd(-2,2),0,rnd(12,18));h.g.position.copy(p);zwalk(h,carW(rnd(-.6,.6),0,2.6),.7);}});}
});

// PERSONAGENS / TELA
def({id:'dano',team:'p',name:'Dano e mordida',short:'Borda vermelha do lado do golpe, sangue na lente e o pulso da mordida.',cost:'pós-processo',costb:'só local',
  cam:[0,1.6,1.7],tgt:[0,1.5,0],loop:5.6,
  q:'Jogador recebe golpe (com direção) ou mordida (infecção 100%, regra dos personagens).',
  v:'Golpe: borda vermelha do lado de onde veio, tremor curto e respingos na lente. Mordida: clarão vermelho na tela inteira, a cor some por 2 s, batimento pulsando no túnel escuro e sangue grande na lente que escorre.',
  b:'Efeito de pós-processo e uma camada de lente. Nenhuma partícula no mundo além do sangue normal.',
  r:'Só na tela de quem levou. Os outros veem o sangue no mundo.',
  run(){const swing=(side,dirKey)=>{Z.st.swing={t:0,side};at(this.tl+.18,()=>{S[dirKey]=1;S.shake+=.3;for(let i=0;i<4;i++)lensBlob(dirKey==='dirL'?rnd(.05,.3):rnd(.7,.95),rnd(.3,.8),rnd(.02,.05),'110,8,8',.8);burst(norP,12,{p:new V(0,1.4,.9),dir:new V(0,.2,1),cone:.6,sp:[1,2],life:1,size:[.03,.05],c0:BLOOD[0],g:9.8,fi:0,gnd:3,ds:[.05,.1]});});};
    at(.3,()=>swing(0,'dirL'));at(1.6,()=>swing(1,'dirR'));
    at(3,()=>{Z.g.position.z=.45;});at(3.15,()=>{S.red=1;S.desat=.9;S.shake+=.6;setNote('MORDIDA · infecção 100%');for(let i=0;i<7;i++)lensBlob(rnd(.2,.8),rnd(.2,.7),rnd(.04,.1),'100,6,6',1);});},
  tick(dt,t){if(t>3.2&&t<5.4){const ph=(t*1.9)%1;if(ph<dt*1.9)S.beat=1;}if(t>3.6)Z.g.position.z=lerp(Z.g.position.z,0,dt*2);}
});
def({id:'infeccao',team:'p',name:'Fases da infecção',short:'Mal-estar, febre com borda fria, delírio com fantasmas e o fim.',cost:'pós-processo',costb:'só local',
  cam:[2,1.7,7],tgt:[0,1.2,-1],loop:0,param:{lbl:'Fase',opts:['Mal-estar','Febre','Delírio','48 h'],def:1},
  q:'Fases do brief de personagens: 2–12 h mal-estar, 12–30 h febre, 30–48 h delírio, 48 h morte.',
  v:'Mal-estar: cor um pouco lavada e vinheta que respira devagar. Febre: borda fria azulada só para o infectado, desfoque em ondas, tosse que treme a câmera. Delírio: aberração de cor, matiz que oscila e zumbis falsos que piscam na neblina. 48 h: quase sem cor, tom verde, túnel escuro e batimento.',
  b:'Só pós-processo. Os fantasmas do delírio são 3 instâncias do zumbi sem colisão, só no cliente infectado.',
  r:'Nunca vai pela rede. O outro jogador percebe só a tosse e a respiração (ver “Tosse e respiração”).',
  setup(){Z.g.visible=false;[[-3,-1.8],[3.5,-2.4],[-6,1.5]].forEach(([x,z],i)=>{const h=H[i];h.g.position.set(x,0,z);h.g.rotation.y=rnd(-.4,.4);h.g.visible=false;});},
  run(pr){setNote(['Mal-estar · 2–12 h','Febre · 12–30 h','Delírio · 30–48 h','48 h · reanimação iminente'][pr]);this.nc=2;},
  tick(dt,t,pr){const p=P0;
    if(pr===0){p.desat=.25;p.tunnel=.15+.12*Math.sin(t*1.2);p.blur=.3*Math.max(0,Math.sin(t*.7));}
    if(pr===1){p.cold=.8+.15*Math.sin(t*2);p.blur=.6+.6*Math.sin(t*1.6);p.desat=.3;if(t>this.nc){this.nc=t+rnd(3,5);S.shake+=.25;burst(norP,10,{p:camera.position.clone().add(new V(0,-.15,-.6).applyQuaternion(camera.quaternion)),dir:new V(0,0,-1).applyQuaternion(camera.quaternion),cone:.4,sp:[.6,1.2],drag:1.5,life:1.2,size:[.05,.1],grow:5,c0:0xdfe6ee,a:.2});}}
    if(pr===2){p.chroma=2+3*(.5+.5*Math.sin(t*1.7));p.hue=22*Math.sin(t*.6);p.tunnel=.3;p.desat=.15;H.slice(0,3).forEach((h,i)=>{h.g.visible=Math.sin(t*(1.3+i*.7)+i*2)>.6;});if(Math.random()<dt*.3)S.white=.12;}
    if(pr===3){p.desat=.85;p.tintA=.22;p.tintC='70,110,40';p.tunnel=.55;p.blur=1.2;const ph=(t*2.2)%1;if(ph<dt*2.2){S.beat=1;S.shake+=.05;}}}
});
def({id:'panico',team:'p',name:'Pânico',short:'A mira treme, o túnel fecha conforme a horda chega e o coração acelera.',cost:'pós-processo',costb:'só local',
  cam:[0,1.65,6],tgt:[0,1.3,-2],loop:8,
  q:'Medidor de pânico dos personagens (sobe com zumbis visíveis, corredores e companheiro morto). Efeitos acima de 60 e de 90.',
  v:'Tremor fino e constante na câmera (a mira treme), vinheta escura que fecha conforme o zumbi mais próximo chega e pulsa com o batimento, que acelera de 70 para 150 bpm. A cor perde força.',
  b:'Só pós-processo e ruído de câmera.',
  r:'Local. O pânico dos outros aparece na mira deles e no grito (som).',
  setup(){Z.g.visible=false;H.slice(0,6).forEach((h,i)=>{h.g.visible=true;h.g.position.set(rnd(-4,4),0,rnd(-4,-2)-i*.6);zwalk(h,new V(rnd(-1.2,1.2),0,5),i%3===1?1.6:.7);});},
  tick(dt,t){let dmin=99;H.slice(0,6).forEach(h=>{dmin=Math.min(dmin,h.g.position.distanceTo(camera.position));});const k=clamp((9-dmin)/7,0,1);
    const bpm=70+80*k;const ph=(t*bpm/60)%1;if(ph<dt*bpm/60)S.beat=.4+.6*k;P0.tunnel=.1+.65*k;P0.desat=.45*k;this.trem=.012+.035*k;setNote('pânico '+Math.round(30+70*k)+' · '+Math.round(bpm)+' bpm');}
});
def({id:'cegueira',team:'p',name:'Cegueira do Inchado',short:'Gás verde na cara: tela turva por 5 s e muco na lente.',cost:'pós + 30 part.',costb:'entidade do servidor',
  cam:[0,1.6,2.6],tgt:[0,1.3,0],loop:7.5,
  q:'Jogador dentro da nuvem do Inchado (raio 4 m) quando ela nasce.',
  v:'Nuvem verde explode entre o zumbi e a câmera, a tela fica verde e desfocada e clareia em 5 s, com gotas de muco verde na lente que escorrem. Tosse treme a câmera duas vezes.',
  b:'Pós-processo + 30 sprites de gás perto da câmera, com fade para não cobrir a tela inteira de partícula.',
  r:'A cegueira vem da entidade no servidor; o visual é local.',
  setup(){Z.torso.scale.set(1.4,1.25,1.6);Z.mS.color.setHex(0x6b7a52);setEye(Z,0x5fe08a);},
  run(){at(.7,()=>{Z.g.visible=false;S.gas=1;S.shake+=.3;burst(norP,30,{p:new V(0,1.3,.8),r:.6,sp:[.5,2],drag:2,life:[3,5],size:[.8,1.6],grow:1.6,c0:0x6f8a3c,c1:0x3b4a26,a:.3,fi:.05});
      for(let i=0;i<8;i++)lensBlob(rnd(.15,.85),rnd(.15,.7),rnd(.03,.08),'110,150,50',.9);setNote('cego por 5 s · cheiro +100%');});
    at(2,()=>S.shake+=.2);at(3.4,()=>S.shake+=.2);},
  tick(dt,t){if(t<.7)Z.torso.scale.z=1.6+Math.sin(t*30)*.1;}
});
def({id:'fogueira',team:'p',name:'Fogueira do acampamento',short:'Chama baixa, brasas subindo em espiral e luz quente tremendo.',cost:'≤ 120 part.',costb:'1 luz de fogo',
  cam:[1.4,1.6,6.4],tgt:[-1.4,.6,3],loop:0,
  q:'Fogueira acesa pelo grupo ou por NPCs. Esquenta, ilumina e atrai zumbis de longe (luz).',
  v:'Chamas pequenas e baixas, brasas que sobem girando e somem, fumaça fina e uma luz quente que treme e pinta o sobrevivente.',
  b:'120 partículas e 1 luz de fogo. Várias fogueiras do acampamento dividem a mesma luz se estiverem a menos de 6 m.',
  r:'Objeto de cena replicado (aceso ou apagado). Visual local.',
  setup(){Z.g.visible=false;camp.visible=true;surv.g.visible=true;surv.g.position.set(-2.6,0,3.6);surv.g.rotation.y=2.2;},
  tick(dt,t){const c=camp.position.clone().add(new V(0,.1,0));fireEmit('camp',dt,c,.25,.55,{smoke:8,smokeC:0x4a4642,smokeA:.25});fireLight(fireL,c.clone().add(new V(0,.8,0)),2.4,t);}
});
def({id:'tosse',team:'p',name:'Tosse, respiração e lanterna',short:'Vapor da respiração no frio, tosse da febre visível para os outros e feixe da lanterna.',cost:'≤ 40 part.',costb:'1 spot com sombra',
  cam:[2.4,1.8,6.5],tgt:[-1.4,1.3,1.6],loop:0,
  q:'Noite fria: respiração sempre. Febre da infecção: tosse a cada poucos segundos, audível a 10 m.',
  v:'Sopro curto de vapor a cada 2,4 s. Na tosse, três sopros rápidos e maiores e o corpo dá um tranco. A lanterna mostra o feixe na neblina e é a única luz com sombra.',
  b:'Vapor: 8 partículas por sopro, só a menos de 15 m. Lanterna: 1 spot com sombra por jogador, só a do jogador local projeta sombra.',
  r:'A tosse é o sinal social da infecção: o servidor manda o evento de tosse (sem dizer que é infecção) e os outros veem o vapor e ouvem.',
  setup(){Z.g.visible=false;surv.g.visible=true;surv.g.position.set(-1.6,0,1.8);surv.g.rotation.y=.5;scene.fog.density=.06;flashSpot.intensity=2.6;flashCone.visible=true;this.nb=.5;this.nc=3;},
  tick(dt,t){surv.g.updateMatrixWorld();const mouth=new V(0,1.68,.2).applyMatrix4(surv.g.matrixWorld),fw=new V(0,-.15,1).applyQuaternion(surv.g.quaternion).normalize();
    const puff=(k)=>burst(norP,8*k,{p:mouth,dir:fw,cone:.35,sp:[.5,1.1*k],drag:1.6,life:[1.2,1.8],size:[.05,.09],grow:6,c0:0xdfe6ee,a:.22,g:-.1});
    if(t>this.nb){this.nb=t+2.4;puff(1);}
    if(t>this.nc){this.nc=t+6.5;[0,.25,.5].forEach(d=>at(this.tl+d,()=>{puff(1.6);surv.b.rotation.x=.25;}));setNote('tosse · audível a 10 m');}
    surv.b.rotation.x=lerp(surv.b.rotation.x,0,dt*6);}
});

// ---------- UI
const cat=$('catalog');
TEAMS.forEach(T=>{const sec=document.createElement('section');sec.className='team';sec.id='time-'+T.k;
  const list=FX.filter(f=>f.team===T.k);
  sec.innerHTML=`<div class="team-head"><h2 style="color:${T.c}">${T.n}</h2><a href="${T.url}" target="_blank" rel="noopener">${T.page} ↗</a></div><ul class="fx-list"></ul>`;
  const ul=sec.querySelector('ul');
  list.forEach(f=>{const li=document.createElement('li');li.className='fx';li.tabIndex=0;li.setAttribute('role','button');li.dataset.id=f.id;
    li.innerHTML=`<span class="nm">${f.name}</span><span class="cost"><b>${f.cost}</b>${f.costb}</span><span class="ds">${f.short}</span>`;
    const go=()=>{select(f.id);if(innerWidth<=1000)stage.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});};
    li.addEventListener('click',go);li.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});ul.appendChild(li);f.li=li;});
  cat.appendChild(sec);});
let cur=null,pr=0,tl=0,el=0,auto=true;
function camTo(pos,tgt){camAnim={p0:camera.position.clone(),t0:controls.target.clone(),p1:pos.clone(),t1:tgt.clone(),k:0};}
let camAnim=null;
function startLoop(){const f=cur;if(f.stop)f.stop();clearFX();resetProps();f.camSet=0;f.b=null;f.gs=null;f.pools=null;if(f.setup)f.setup(pr);tl=0;f.tl=0;if(f.run)f.run(pr);f.fresh=false;}
function select(id,keepParam){const f=FX.find(x=>x.id===id);if(!f)return;if(cur&&cur.stop)cur.stop();if(cur&&cur.bt)cur.bt.visible=false;if(cur&&cur.gn)cur.gn.visible=false;cur=f;f.fresh=true;
  if(!keepParam)pr=f.param?f.param.def:0;el=0;FX.forEach(x=>x.li.classList.toggle('on',x===f));
  if(f.cam)camTo(new V(...f.cam),new V(...f.tgt));else camAnim=null;
  startLoop();renderSheet();renderParams();}
function renderParams(){const box=$('params');box.innerHTML='';const f=cur;if(!f.param)return;const l=document.createElement('span');l.className='lbl';l.textContent=f.param.lbl;box.appendChild(l);
  f.param.opts.forEach((o,i)=>{const b=document.createElement('button');b.textContent=o;b.setAttribute('aria-pressed',String(i===pr));b.addEventListener('click',()=>{pr=i;select(f.id,true);});box.appendChild(b);});}
function renderSheet(){const f=cur,T=TEAMS.find(t=>t.k===f.team);
  $('sheet').innerHTML=`<div class="top"><h3>${f.name}</h3><span class="team-chip" style="color:${T.c}">${T.n}</span></div>
  <dl class="spec"><dt>Quando</dt><dd>${f.q}</dd><dt>Visual</dt><dd>${f.v}</dd><dt>Orçamento</dt><dd>${f.b}</dd><dt>Rede</dt><dd>${f.r}</dd>${f.lab?'<dt>Versão final</dt><dd><a href="laboratorio-explosoes.html" target="_blank" rel="noopener">Laboratório de Explosões</a> e brief em vfx/explosoes/brief-explosoes.md</dd>':''}</dl>`;}
$('bReplay').addEventListener('click',()=>{if(cur){el=0;startLoop();}});
$('bAuto').addEventListener('click',()=>{auto=!auto;$('bAuto').setAttribute('aria-pressed',String(auto));});
document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{Q.level=+b.dataset.q;Q.mult=[1,.5,.2][Q.level];document.querySelectorAll('[data-q]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(cur){startLoop();}}));
canvas.addEventListener('pointerdown',()=>{camAnim=null;});
$('pcap').textContent=(addP.cap+norP.cap+streak.cap).toLocaleString('pt-BR');

// ---------- main loop
const clock=new THREE.Clock();let fpsT=0,fpsN=0;const shakeOff=new V();
function frame(){requestAnimationFrame(frame);let dt=Math.min(.05,clock.getDelta());if(reduce)dt*=.6;
  P0={};
  if(cur){tl+=dt;el+=dt;cur.tl=tl;
    for(let i=timers.length-1;i>=0;i--){if(tl>=timers[i].t){const fn=timers[i].fn;timers.splice(i,1);fn();}}
    if(cur.tick)cur.tick(dt,tl,pr);
    if(cur.loop&&auto&&tl>=cur.loop)startLoop();}
  ZS.forEach(z=>updateZombie(z,dt,el));
  addP.update(dt);norP.update(dt);streak.update(dt);updateDebris(dt);updateDecals(dt);updateRings(dt);updateLights(dt);
  if(camAnim){camAnim.k=Math.min(1,camAnim.k+dt*1.4);const k=ease(camAnim.k);camera.position.lerpVectors(camAnim.p0,camAnim.p1,k);controls.target.lerpVectors(camAnim.t0,camAnim.t1,k);if(camAnim.k>=1)camAnim=null;}
  controls.update();
  updateScreen(dt);
  const sh=S.shake*.06+(cur&&cur.id==='panico'?cur.trem||0:0);shakeOff.set(rnd(-1,1)*sh,rnd(-1,1)*sh,rnd(-1,1)*sh*.5);camera.position.add(shakeOff);
  renderer.render(scene,camera);camera.position.sub(shakeOff);
  fpsN++;fpsT+=dt;if(fpsT>.5){$('fps').textContent=Math.round(fpsN/fpsT);fpsN=0;fpsT=0;$('calls').textContent=renderer.info.render.calls;
    $('pc').textContent=(addP.n+norP.n+streak.n+dbN).toLocaleString('pt-BR');$('dc').textContent=dcN;}
}
let first='sangue';try{const h=location.hash.slice(1);if(FX.some(f=>f.id===h))first=h;}catch(e){}
resize();select(first);frame();
})();
