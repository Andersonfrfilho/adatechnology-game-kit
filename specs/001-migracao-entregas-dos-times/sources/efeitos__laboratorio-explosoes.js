// fonte: site/pages/efeitos/laboratorio-explosoes.html
// texto visível: Laboratório de Explosões ZombiAdA · Time de explosões e partículas · revisão 1 · 22/10/2026 Laboratório de Explosões Os 12 explosivos do Arsenal, o barril, o carro, o posto de gasolina em cadeia e a granada no meio da horda, montados camada por camada em 3D: clarão, bola de fogo que vira fumaça, onda de choque, poeira rasteira, estilhaços, detritos em brasa, cogumelo, fogo residual e marca no chão . Escolha um explosivo, gire a câmera, ligue a câmera lenta e desligue camadas para ver cada uma sozinha. Oficina de VFX Arsenal Bestiário Garagem Galeria do Vale Granada M67 t = 0,000 s Pronto puffs 0 · faíscas 0 detritos 0 · luzes 0 ragdolls 0 · LOD 100% Arraste para girar · role para aproximar Detonar de novo Câmera lenta 0,25× Distância Perto 12 m Médio 30 m Longe 70 m Camadas Clarão e luz Bola de fogo Onda de choque Fumaça e poeira Estilhaços e detritos Marcas Receita de uma explosão de qualidade O que a revisão da Oficina apontou como fraco (explosão de barril com 5 bolas de fumaça e uma mancha) vira isto: nove camadas, cada uma com um trabalho. Os tempos valem para a granada; os outros explosivos mudam escala, cor e duração pela ficha. Tudo cabe nos tetos da Oficina (400 partículas de GPU por evento, 4 luzes de explosão, 40 detritos por evento). Camada Quando Como fica Na Unity 6 (URP) Por evento 1. Clarão 0–50 ms Núcleo branco-amarelo #FFF4D6 que aparece num quadro só, luz pontual que pinta chão, paredes e zumbis e some em 300 ms. Perto de 15 m a tela pisca. VFX Graph burst de 1 quad aditivo + Light sem sombra animada por curva no ExplosionDirector . Piscar de tela no Renderer Feature. 1 luz 2. Bola de fogo 0–350 ms (combustível até 1,4 s) 12 a 40 malhas facetadas (icosaedro) que nascem a 25% do tamanho, chegam ao raio visual em 120 ms e sobem por empuxo. A cor vem do calor em 5 faixas posterizadas: #FFF4D6, #FFD36B, #FF8A2A, #C2361A e fuligem. Output Particle Mesh com Shader Graph HeatRamp : atributo heat por partícula, gradiente de 5 chaves com Posterize, emissão ×1,2 a ×3,8 para o Bloom do URP pegar. 12–40 3. Fogo vira fumaça 0,2–12 s A mesma partícula esfria e escurece até a cor da fumaça do explosivo, cresce 3×, deriva com o vento e some por erosão (buracos de ruído), nunca por transparência. Sem sprite borrado: a borda é dura, no estilo do jogo. Mesmo sistema da camada 2: heat cai por curva, Dissolve por Noise 3D no Shader Graph (alpha clip). Fica opaca, então não ordena nem pesa overdraw. +20–60 4. Halo de calor 0–600 ms Brilho aditivo grande atrás da bola de fogo e nos pedaços em brasa. Faz o papel do bloom em máquina fraca. Quad aditivo com falloff radial, ou só o Bloom do URP no preset Alto. 1–6 5. Onda de choque 20–300 ms Esfera de ar que cresce até o raio letal em 120 ms (borda clara, centro vazio) e anel de poeira no chão até 60% do raio de ferimento. A fumaça e a poeira ganham velocidade para fora quando o anel passa. Malha de esfera com fresnel e distorção pela Opaque Texture ; anel no chão como decal animado. 2 malhas 6. Poeira r

// ===== script 2 (93 KB)

(function(){
'use strict';
const $=id=>document.getElementById(id);
const stageEl=$('stage');
if(!window.THREE){stageEl.insertAdjacentHTML('beforeend','<p class="nogl">Não foi possível carregar o visualizador 3D. Recarregue a página.</p>');return;}
const T=THREE,V=T.Vector3,PI=Math.PI;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
let seed=1;
function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
const rr=(a,b)=>a+(b-a)*rnd();
function rdir(){const u=rnd()*2-1,a=rnd()*PI*2,s=Math.sqrt(1-u*u);return new V(s*Math.cos(a),u,s*Math.sin(a));}
function lin(hex){return new T.Color(hex).convertSRGBToLinear();}

/* ================= renderer ================= */
const canvas=$('cv');
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(e){stageEl.insertAdjacentHTML('beforeend','<p class="nogl">Este navegador não abriu o WebGL.</p>');return;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();
const SKY=0x10141c;
scene.background=new T.Color(SKY);
scene.fog=new T.FogExp2(SKY,0.012);
const camera=new T.PerspectiveCamera(48,16/10,.1,600);
camera.position.set(10,6.5,14);
const controls=new T.OrbitControls(camera,canvas);
controls.target.set(0,1.6,0);controls.enableDamping=true;controls.dampingFactor=.08;
controls.maxPolarAngle=PI*.495;controls.minDistance=3;controls.maxDistance=160;
function resize(){const w=stageEl.clientWidth,h=stageEl.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stageEl);resize();

/* ================= luzes e cenário ================= */
const hemi=new T.HemisphereLight(0x51607a,0x15120f,.55);scene.add(hemi);
const moon=new T.DirectionalLight(0x9db4d8,.55);moon.position.set(-14,26,12);moon.castShadow=true;
moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:1,far:90});moon.shadow.bias=-.0006;
scene.add(moon);
const LIGHT_DIR=moon.position.clone().normalize();
const matCache={};
function M(c,o){const k=c+(o?JSON.stringify(o):'');if(!matCache[k])matCache[k]=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:true},o||{}));return matCache[k];}
function mesh(geo,m,x,y,z,parent){const o=new T.Mesh(geo,m);o.position.set(x||0,y||0,z||0);o.castShadow=true;o.receiveShadow=true;(parent||scene).add(o);return o;}
const Box=(w,h,d)=>new T.BoxGeometry(w,h,d);
function canvasTex(w,h,draw,rep){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;if(rep){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);}return t;}
seed=77;
const asphalt=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#2b2c2f';g.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const c=rnd();g.fillStyle=c<.5?'#232427':c<.85?'#35363a':'#3f3f42';g.globalAlpha=.25+rnd()*.5;const s=1+rnd()*2;g.fillRect(rnd()*w,rnd()*h,s,s);}g.globalAlpha=1;g.strokeStyle='rgba(12,12,14,.7)';g.lineWidth=1.4;for(let i=0;i<8;i++){g.beginPath();let x=rnd()*w,y=rnd()*h;g.moveTo(x,y);for(let k=0;k<7;k++){x+=(rnd()-.5)*60;y+=(rnd()-.5)*60;g.lineTo(x,y);}g.stroke();}},14);
asphalt.repeat.set(1,1);
const groundMat=new T.MeshStandardMaterial({map:asphalt,roughness:.93,flatShading:true});
function worldUV(geo,ox,oz){const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+ox)/17,(p.getZ(i)+oz)/17);uv.needsUpdate=true;}
// miolo de 60 m deformável (malha de 33 cm) + moldura plana
const GP={size:60,seg:180},GSTEP=60/180,GH0=-30,GN=181;
const patchGeo=new T.PlaneGeometry(GP.size,GP.size,GP.seg,GP.seg).rotateX(-PI/2);worldUV(patchGeo,0,0);
const ground=new T.Mesh(patchGeo,groundMat);ground.receiveShadow=true;scene.add(ground);
[[0,-75,240,90],[0,75,240,90],[-75,0,90,60],[75,0,90,60]].forEach(([x,z,w,d])=>{const g=new T.PlaneGeometry(w,d).rotateX(-PI/2);worldUV(g,x,z);const m=new T.Mesh(g,groundMat);m.position.set(x,0,z);m.receiveShadow=true;scene.add(m);});
const GH=new Float32Array(GN*GN);
function groundH(x,z){const fx=(x-GH0)/GSTEP,fz=(z-GH0)/GSTEP;if(fx<0||fz<0||fx>=GP.seg||fz>=GP.seg)return 0;
  const c=fx|0,r=fz|0,tx=fx-c,tz=fz-r,i=r*GN+c;return (GH[i]*(1-tx)+GH[i+1]*tx)*(1-tz)+(GH[i+GN]*(1-tx)+GH[i+GN+1]*tx)*tz;}
/* buraco: bacia com fundo irregular e borda levantada (asfalto empurrado para fora) */
function dent(x,z,r,depth){
  const pos=patchGeo.attributes.position,Rm=r*1.5;
  const c0=Math.max(0,Math.floor((x-Rm-GH0)/GSTEP)),c1=Math.min(GP.seg,Math.ceil((x+Rm-GH0)/GSTEP));
  const r0=Math.max(0,Math.floor((z-Rm-GH0)/GSTEP)),r1=Math.min(GP.seg,Math.ceil((z+Rm-GH0)/GSTEP));
  const s1=rnd()*6,s2=rnd()*6;
  for(let rw=r0;rw<=r1;rw++)for(let c=c0;c<=c1;c++){
    const px=GH0+c*GSTEP,pz=GH0+rw*GSTEP,d=Math.hypot(px-x,pz-z),a=Math.atan2(pz-z,px-x);
    const q=d/(r*(1+.13*Math.sin(a*5+s1)+.07*Math.sin(a*11+s2)));let h=0;
    if(q<1)h=-depth*(1-q*q)*(.85+rnd()*.3);
    else if(q<1.45){const k=(q-1)/.45;h=depth*.3*Math.sin(k*PI)*(1-k*.3)*(.6+rnd()*.8);}
    if(!h)continue;const i=rw*GN+c;GH[i]=Math.max(-3,GH[i]+h);pos.setY(i,GH[i]);
  }
  pos.needsUpdate=true;patchGeo.computeBoundingSphere();
}
function resetGround(){GH.fill(0);const p=patchGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,0);p.needsUpdate=true;}
const walk=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#4a4945';g.fillRect(0,0,w,h);for(let i=0;i<2500;i++){g.fillStyle=rnd()<.5?'#3e3d3a':'#56544f';g.globalAlpha=.3;g.fillRect(rnd()*w,rnd()*h,2,2);}g.globalAlpha=1;g.strokeStyle='rgba(20,20,20,.6)';g.lineWidth=3;g.strokeRect(0,0,w,h);g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();});
walk.wrapS=walk.wrapT=T.RepeatWrapping;walk.repeat.set(60,3);
const side=mesh(Box(120,.16,6),new T.MeshStandardMaterial({map:walk,roughness:.95}),0,.08,-11);side.castShadow=false;
mesh(Box(120,.18,.25),M(0x6a6660),0,.09,-7.9).castShadow=false;
{const dash=[];for(let x=-58;x<=58;x+=5)dash.push(x);dash.forEach(x=>{const d=mesh(Box(2.2,.012,.16),M(0x9a8a55),x,.008,-1);d.castShadow=false;});}
// fachadas com janelas que quebram
const WINDOWS=[];
const winGlass=new T.MeshStandardMaterial({color:0x223241,roughness:.15,metalness:.6,flatShading:true});
const winLit=new T.MeshStandardMaterial({color:0x2a2216,emissive:0xffa64a,emissiveIntensity:.55,roughness:.4,flatShading:true});
const winHole=M(0x07080a);
function building(x0,x1,h,col,litP){
  const w=x1-x0,cx=(x0+x1)/2,z=-15.5;
  mesh(Box(w,h,6),M(col),cx,h/2,z-3+.0);
  mesh(Box(w+.3,.35,6.3),M(0x24252a),cx,h-.1,z-3);
  mesh(Box(w,.7,.12),M(0x2a2b2f),cx,.35,z+.03);
  const floors=Math.floor((h-1.5)/2.7),cols=Math.max(1,Math.floor(w/2.2));
  for(let f=0;f<floors;f++)for(let c=0;c<cols;c++){
    const x=cx+(c-(cols-1)/2)*2.2,y=1.9+f*2.7;
    const lit=rnd()<litP;
    const g=mesh(Box(1.1,1.4,.08),lit?winLit:winGlass,x,y,z+.03);g.castShadow=false;
    mesh(Box(1.3,.12,.18),M(0x26272a),x,y-.76,z+.06).castShadow=false;
    WINDOWS.push({m:g,base:g.material,x,y,z:z+.1,broken:false});
  }
  const door=mesh(Box(1.3,2.3,.1),M(0x15110d),cx+(rnd()-.5)*w*.5,1.15,z+.06);door.castShadow=false;
}
seed=11;
building(-30,-19,8.5,0x3e4148,.2);building(-18.6,-9,11,0x4a3f37,.12);building(-8.6,1.5,7.2,0x37403c,.18);building(2,12,9.8,0x453a3a,.15);building(12.4,24,7,0x3f3b34,.2);building(24.4,34,12,0x30353b,.1);
// poste
{const g=new T.Group();g.position.set(7,0,-8.6);scene.add(g);mesh(new T.CylinderGeometry(.09,.13,6,6),M(0x2b2d30,{metalness:.5,roughness:.6}),0,3,0,g);mesh(Box(.12,.12,1.6),M(0x2b2d30),0,5.95,.75,g);mesh(Box(.45,.16,.7),new T.MeshBasicMaterial({color:0xffc98a}),0,5.85,1.45,g);
 const L=new T.PointLight(0xffa25a,1.1,20,2);L.position.set(7,5.5,-7.1);scene.add(L);}

/* ================= shaders comuns ================= */
const GL_NOISE=`
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const U={
  uLight:{value:LIGHT_DIR},
  uSky:{value:lin(0x6f7c92).multiplyScalar(.55)},
  uGround:{value:lin(0x2a241f).multiplyScalar(.6)},
  uGlowPos:{value:new V()},uGlowCol:{value:new T.Color(1,.5,.2)},uGlowI:{value:0},
  uTime:{value:0}
};

/* ================= PUFFS: fogo, fumaça, poeira, sangue, gás ================= */
const PMAX=2600;
const puffGeo=new T.InstancedBufferGeometry();
{const ico=new T.IcosahedronGeometry(1,1);puffGeo.setAttribute('position',ico.getAttribute('position'));}
const pA=new Float32Array(PMAX*4),pD=new Float32Array(PMAX*4),pC=new Float32Array(PMAX*3);
const pAttrA=new T.InstancedBufferAttribute(pA,4).setUsage(T.DynamicDrawUsage);
const pAttrD=new T.InstancedBufferAttribute(pD,4).setUsage(T.DynamicDrawUsage);
const pAttrC=new T.InstancedBufferAttribute(pC,3).setUsage(T.DynamicDrawUsage);
puffGeo.setAttribute('aP',pAttrA);puffGeo.setAttribute('aD',pAttrD);puffGeo.setAttribute('aC',pAttrC);
puffGeo.instanceCount=0;
const puffMat=new T.ShaderMaterial({
  uniforms:U,extensions:{derivatives:true},
  vertexShader:GL_NOISE+`
attribute vec4 aP;attribute vec4 aD;attribute vec3 aC;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;
void main(){
  vec3 p=position;
  float s=aD.z;
  float n=vn(p*1.6+vec3(s*11.0,s*7.0,s*3.0));
  p*=0.78+0.5*n;
  float a=s*6.2831;float c=cos(a),si=sin(a);p.xz=mat2(c,-si,si,c)*p.xz;
  vL=p;
  vec3 wp=aP.xyz+p*aP.w;
  vWP=wp;vD=aD;vC=aC;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);
}`,
  fragmentShader:GL_NOISE+`
uniform vec3 uLight;uniform vec3 uSky;uniform vec3 uGround;uniform vec3 uGlowPos;uniform vec3 uGlowCol;uniform float uGlowI;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;
vec3 L(vec3 c){return pow(c,vec3(2.2));}
vec3 ramp(float h){
  vec3 c0=L(vec3(.36,.07,.03)),c1=L(vec3(.76,.21,.1)),c2=L(vec3(1.,.54,.16)),c3=L(vec3(1.,.83,.42)),c4=L(vec3(1.,.96,.84));
  if(h<.25)return mix(c0,c1,h/.25);
  if(h<.5)return mix(c1,c2,(h-.25)/.25);
  if(h<.8)return mix(c2,c3,(h-.5)/.3);
  return mix(c3,c4,clamp((h-.8)/.4,0.,1.));
}
void main(){
  vec3 N=normalize(cross(dFdx(vWP),dFdy(vWP)));
  float age=vD.x,heat=vD.y,kind=vD.w;
  float n=vn(vL*2.4+vD.z*13.0);
  float diss=smoothstep(.5,1.,age);
  if(n<diss*1.08-.04)discard;
  float lam=max(dot(N,uLight),0.);
  float band=lam>.55?1.:lam>.15?.68:.42;
  vec3 col=vC*(vec3(.5,.56,.7)*band*1.05+vec3(.2,.19,.18)+uGround*(.4-.4*N.y));
  vec3 tg=uGlowPos-vWP;float dg=length(tg)+.001;
  float gi=uGlowI/(1.+dg*dg*.05)*(.3+.7*max(dot(N,tg/dg),0.));
  col+=uGlowCol*gi*vC*1.6;
  float h=heat*(.72+.56*n)+heat*(-N.y)*.18;
  if(h>.05){
    float hq=floor(h*5.+.5)/5.;
    vec3 fc=ramp(clamp(hq,0.,1.2))*(1.1+3.1*hq);
    col=mix(col,fc,smoothstep(.04,.2,h));
  }
  if(kind>2.5&&kind<3.5){col+=vec3(.02,.025,.03);}
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`
});
const puffMesh=new T.Mesh(puffGeo,puffMat);puffMesh.frustumCulled=false;scene.add(puffMesh);
const P=[];
/* kind: 0 fogo->fumaça, 1 poeira, 2 sangue, 3 gás/pólvora branca, 4 bile */
function puff(o){
  if(P.length>=PMAX)P.shift();
  const p=Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,s0:.2,s1:1,sg:.1,gk:6,life:3,t:0,h0:0,hl:.4,drag:3,buoy:.5,grav:0,kind:0,c:SMOKE.grey,seed:rnd(),ring:null,follow:null,wind:1},o);
  P.push(p);evCount.p++;return p;
}
const SMOKE={
  grey:lin(0x6a655f),dark:lin(0x4a4440),black:lin(0x3a3431),brown:lin(0x7a5c3e),dust:lin(0x7d7368),concrete:lin(0x8f8a82),
  white:lin(0xb4b0a8),blood:lin(0x5a0b0b),bile:lin(0x7a8a2a),gas:lin(0xe8ecef)
};
const WIND=new V(.55,0,.2);
function updatePuffs(dt){
  let n=0;
  for(let i=P.length-1;i>=0;i--){
    const p=P[i];p.t+=dt;
    if(p.t>=p.life){P.splice(i,1);continue;}
  }
  for(let i=0;i<P.length;i++){
    const p=P[i],a=p.t/p.life;
    const heat=p.h0>0?p.h0*Math.pow(Math.max(0,1-p.t/p.hl),1.25):0;
    if(p.ring){
      const R=p.ring,rt=R.t;
      const cy=R.y0+R.rise*(1-Math.exp(-rt*R.rk));
      const Rmaj=R.R0+(R.R1-R.R0)*(1-Math.exp(-rt*1.6));
      const th=p.th+rt*R.roll;
      const rm=R.r*(.8+.4*Math.min(1,rt));
      const rad=Rmaj+rm*Math.cos(th);
      p.x=R.x+Math.cos(p.ph)*rad+WIND.x*rt*.6;p.z=R.z+Math.sin(p.ph)*rad+WIND.z*rt*.6;p.y=cy+rm*Math.sin(th);
    }else{
      const dr=Math.exp(-p.drag*dt);
      p.vx*=dr;p.vy*=dr;p.vz*=dr;
      p.vy+=(p.buoy*(heat>0?1.6:1)-p.grav)*dt;
      p.x+=(p.vx+WIND.x*p.wind*a)*dt;p.y+=p.vy*dt;p.z+=(p.vz+WIND.z*p.wind*a)*dt;
      if(p.y<p.s0*.4){p.y=p.s0*.4;if(p.vy<0)p.vy*=-.2;}
    }
    if(p.follow){p.x+=p.follow.dx||0;}
    const s=p.s0+(p.s1-p.s0)*(1-Math.exp(-p.t*p.gk))+p.sg*Math.min(p.t,3.5);
    pA[n*4]=p.x;pA[n*4+1]=p.y;pA[n*4+2]=p.z;pA[n*4+3]=s*Math.min(1,p.t*30+.3);
    pD[n*4]=a;pD[n*4+1]=heat;pD[n*4+2]=p.seed;pD[n*4+3]=p.kind;
    pC[n*3]=p.c.r;pC[n*3+1]=p.c.g;pC[n*3+2]=p.c.b;
    n++;
  }
  puffGeo.instanceCount=n;
  pAttrA.needsUpdate=pAttrD.needsUpdate=pAttrC.needsUpdate=true;
}

/* ================= FAÍSCAS e estilhaços (riscos esticados pela velocidade) ================= */
const SMAX=3200;
const sparkGeo=new T.InstancedBufferGeometry();
sparkGeo.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0, .5,0,0, .5,1,0, -.5,1,0],3));
sparkGeo.setIndex([0,1,2,0,2,3]);
const sA=new Float32Array(SMAX*3),sB=new Float32Array(SMAX*3),sE=new Float32Array(SMAX*4);
const sAttA=new T.InstancedBufferAttribute(sA,3).setUsage(T.DynamicDrawUsage),sAttB=new T.InstancedBufferAttribute(sB,3).setUsage(T.DynamicDrawUsage),sAttE=new T.InstancedBufferAttribute(sE,4).setUsage(T.DynamicDrawUsage);
sparkGeo.setAttribute('aPos',sAttA);sparkGeo.setAttribute('aVel',sAttB);sparkGeo.setAttribute('aE',sAttE);sparkGeo.instanceCount=0;
const sparkMat=new T.ShaderMaterial({
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:`
attribute vec3 aPos;attribute vec3 aVel;attribute vec4 aE;varying vec2 vU;varying vec4 vE;
void main(){
  float sp=length(aVel)+1e-4;vec3 d=aVel/sp;
  vec3 tc=normalize(cameraPosition-aPos);
  vec3 sd=normalize(cross(d,tc)+vec3(1e-5));
  float len=max(aE.y*2.5,min(sp*aE.z,2.2));
  vec3 wp=aPos+sd*position.x*aE.y-d*position.y*len;
  vU=position.xy;vE=aE;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`,
  fragmentShader:`
varying vec2 vU;varying vec4 vE;
void main(){
  float age=vE.x,k=vE.w;
  float w=1.-abs(vU.x)*2.;w=w*w;
  float tail=1.-vU.y;
  vec3 c;
  if(k<.5){c=mix(vec3(4.,3.3,2.2),vec3(2.4,.7,.12),smoothstep(0.,.55,age));c=mix(c,vec3(.5,.06,.02),smoothstep(.55,1.,age));}
  else if(k<1.5){c=mix(vec3(1.6,1.6,1.6),vec3(.35,.35,.36),smoothstep(0.,.4,age));}
  else if(k<2.5){c=mix(vec3(5.,5.,6.),vec3(1.,1.3,2.),smoothstep(0.,.5,age));}
  else if(k<3.5){c=vec3(.9,1.2,1.4)*(1.-age);}
  else {c=mix(vec3(3.2,1.4,.3),vec3(1.2,.25,.05),age);}
  float a=w*(.35+.65*tail)*(1.-smoothstep(.75,1.,age));
  gl_FragColor=vec4(c*a,1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`
});
const sparkMesh=new T.Mesh(sparkGeo,sparkMat);sparkMesh.frustumCulled=false;sparkMesh.renderOrder=5;scene.add(sparkMesh);
const S=[];
/* kind: 0 fragmento quente, 1 esfera de aço/prego, 2 faísca branca (granada de luz), 3 vidro, 4 brasa lenta */
function spark(o){if(S.length>=SMAX)S.shift();const s=Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,t:0,life:.8,w:.04,st:.035,kind:0,drag:.6,g:9.8,bounce:.35},o);S.push(s);evCount.s++;return s;}
function updateSparks(dt){
  let n=0;
  for(let i=S.length-1;i>=0;i--){const s=S[i];s.t+=dt;if(s.t>=s.life){S.splice(i,1);}}
  for(let i=0;i<S.length;i++){const s=S[i];
    const dr=Math.exp(-s.drag*dt);s.vx*=dr;s.vy*=dr;s.vz*=dr;s.vy-=s.g*dt;
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
    const sgh=groundH(s.x,s.z)+.02;if(s.y<sgh){s.y=sgh;if(s.vy<0){s.vy*=-s.bounce;s.vx*=.55;s.vz*=.55;}}
    sA[n*3]=s.x;sA[n*3+1]=s.y;sA[n*3+2]=s.z;sB[n*3]=s.vx;sB[n*3+1]=s.vy;sB[n*3+2]=s.vz;
    sE[n*4]=s.t/s.life;sE[n*4+1]=s.w;sE[n*4+2]=s.st;sE[n*4+3]=s.kind;n++;}
  sparkGeo.instanceCount=n;sAttA.needsUpdate=sAttB.needsUpdate=sAttE.needsUpdate=true;
}

/* ================= HALOS (brilho aditivo) ================= */
const GMAX=320;
const glowGeo=new T.InstancedBufferGeometry();
glowGeo.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],3));glowGeo.setIndex([0,1,2,0,2,3]);
const gA=new Float32Array(GMAX*4),gB=new Float32Array(GMAX*4);
const gAttA=new T.InstancedBufferAttribute(gA,4).setUsage(T.DynamicDrawUsage),gAttB=new T.InstancedBufferAttribute(gB,4).setUsage(T.DynamicDrawUsage);
glowGeo.setAttribute('aP',gAttA);glowGeo.setAttribute('aC',gAttB);glowGeo.instanceCount=0;
const glowMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:`attribute vec4 aP;attribute vec4 aC;varying vec2 vU;varying vec4 vC;
void main(){vec3 R=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);vec3 Up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
vec3 wp=aP.xyz+(R*position.x+Up*position.y)*aP.w;vU=position.xy;vC=aC;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
  fragmentShader:`varying vec2 vU;varying vec4 vC;void main(){float r=dot(vU,vU);if(r>1.)discard;float f=exp(-r*4.2)-.015;gl_FragColor=vec4(vC.rgb*vC.a*max(f,0.),1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`});
const glowMesh=new T.Mesh(glowGeo,glowMat);glowMesh.frustumCulled=false;glowMesh.renderOrder=6;scene.add(glowMesh);
const GL=[];
function glow(o){if(GL.length>=GMAX)GL.shift();const g=Object.assign({x:0,y:0,z:0,s:1,s1:null,i:1,t:0,life:.3,c:[1,.6,.25],follow:null,fx:0,fy:0,fz:0,curve:2},o);GL.push(g);return g;}
function updateGlows(dt){let n=0;
  for(let i=GL.length-1;i>=0;i--){const g=GL[i];g.t+=dt;if(g.t>=g.life||(g.follow&&g.follow.dead)){GL.splice(i,1);}}
  for(const g of GL){const a=g.t/g.life;let x=g.x,y=g.y,z=g.z;if(g.follow){const p=g.follow.obj?g.follow.obj.position:g.follow;x=p.x+g.fx;y=p.y+g.fy;z=p.z+g.fz;}
    const s=g.s1!=null?lerp(g.s,g.s1,1-Math.pow(1-a,3)):g.s;const I=g.i*Math.pow(1-a,g.curve)*(g.flick?(.75+.25*Math.sin(g.t*40+g.s*9)):1);
    gA[n*4]=x;gA[n*4+1]=y;gA[n*4+2]=z;gA[n*4+3]=s;gB[n*4]=g.c[0];gB[n*4+1]=g.c[1];gB[n*4+2]=g.c[2];gB[n*4+3]=I;n++;}
  glowGeo.instanceCount=n;gAttA.needsUpdate=gAttB.needsUpdate=true;}

/* ================= ONDA DE CHOQUE ================= */
const shockGeo=new T.SphereGeometry(1,28,18);
const ringGeo=new T.PlaneGeometry(2,2).rotateX(-PI/2);
function shockMat(){return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uA:{value:0}},
  vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:`uniform float uA;varying vec3 vN;varying vec3 vV;void main(){float f=1.-abs(dot(vN,vV));f=pow(f,5.);gl_FragColor=vec4(vec3(1.,.93,.82)*f*uA*.45,1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`});}
function ringMat(){return new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uA:{value:0},uW:{value:.12},uC:{value:new T.Color(.55,.5,.44)}},
  vertexShader:`varying vec2 vU;void main(){vU=position.xz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uA;uniform float uW;uniform vec3 uC;varying vec2 vU;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){float r=length(vU);float b=smoothstep(1.,1.-uW,r)*smoothstep(1.-uW*3.5,1.-uW,r);float a=atan(vU.y,vU.x);float n=.7+.3*h(vec2(floor(a*14.),1.));gl_FragColor=vec4(uC,b*uA*n);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`});}
const SHOCKS=[];
function shock(x,y,z,Rs,Rg,dur){
  const sm=new T.Mesh(shockGeo,shockMat());sm.position.set(x,y,z);sm.renderOrder=4;scene.add(sm);
  const rm=new T.Mesh(ringGeo,ringMat());rm.position.set(x,.05,z);rm.renderOrder=3;scene.add(rm);
  SHOCKS.push({sm,rm,Rs,Rg,t:0,dur:dur||.3,x,z});
}
function updateShocks(dt){for(let i=SHOCKS.length-1;i>=0;i--){const s=SHOCKS[i];s.t+=dt;const a=s.t/s.dur;
  const e=1-Math.pow(1-Math.min(1,s.t/.12),3);s.sm.scale.setScalar(Math.max(.01,s.Rs*e));s.sm.material.uniforms.uA.value=Math.max(0,1-s.t/.16)*.9;
  const e2=1-Math.pow(1-Math.min(1,a),2.2);s.rm.scale.setScalar(Math.max(.01,s.Rg*e2));s.rm.material.uniforms.uA.value=Math.max(0,1-a)*.85;
  // empurra fumaça e poeira que a frente encontra
  const R=s.Rg*e2;for(const p of P){if(p.ring||p.t>2)continue;const dx=p.x-s.x,dz=p.z-s.z,d=Math.hypot(dx,dz)+.001;if(Math.abs(d-R)<.8&&p.y<3){const k=4*dt*(1-a);p.vx+=dx/d*k*6;p.vz+=dz/d*k*6;}}
  if(a>=1){scene.remove(s.sm);scene.remove(s.rm);s.sm.material.dispose();s.rm.material.dispose();SHOCKS.splice(i,1);}}}

/* ================= LUZES (pool de 4 de explosão + 2 de fogo) ================= */
const XL=[],FL=[];
for(let i=0;i<4;i++){const l=new T.PointLight(0xffa050,0,30,2);l.position.set(0,-50,0);scene.add(l);XL.push({l,t:9,life:1,peak:0,col:new T.Color()});}
for(let i=0;i<2;i++){const l=new T.PointLight(0xff7a2a,0,16,2);l.position.set(0,-50,0);scene.add(l);FL.push(l);}
let xlIdx=0;
function boomLight(x,y,z,peak,dist,life,hex){const L=XL[xlIdx++%XL.length];L.l.position.set(x,y,z);L.l.distance=dist;L.peak=peak;L.life=life;L.t=0;L.col.set(hex||0xffa050);L.l.color.copy(L.col);evCount.l++;}
function updateLights(dt){
  let best=null,bi=0;
  for(const L of XL){L.t+=dt;const a=L.t/L.life;const I=a<1?L.peak*(L.t<.05?1:Math.pow(1-a,2.2))*(.85+.15*Math.sin(L.t*60)):0;L.l.intensity=I*layers.clarao;if(I>bi){bi=I;best=L;}}
  // fogo residual: 2 luzes vão para os 2 fogos mais fortes
  const fires=FIRES.slice().sort((a,b)=>b.r-a.r);
  for(let i=0;i<2;i++){const f=fires[i],l=FL[i];if(f){l.position.set(f.x,f.y+Math.max(.8,f.r*.6),f.z);l.intensity=(1.4+f.r*.6)*(.75+.25*Math.sin(clock*17+i*3)+.1*Math.sin(clock*41))*f.fade;l.distance=10+f.r*4;}else l.intensity=0;}
  if(best&&bi>.05){U.uGlowPos.value.copy(best.l.position);U.uGlowCol.value.copy(best.col).convertSRGBToLinear();U.uGlowI.value=bi*.06*layers.clarao;}
  else if(fires[0]){const f=fires[0];U.uGlowPos.value.set(f.x,f.y+.5,f.z);U.uGlowCol.value.setRGB(1,.42,.12);U.uGlowI.value=(.35+f.r*.12)*f.fade;}
  else U.uGlowI.value=0;
}

/* ================= DETRITOS instanciados ================= */
const CMAX=300;
const rockGeo=new T.DodecahedronGeometry(.5,0),plateGeo=new T.BoxGeometry(1,1,1);
const chunkMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.85,flatShading:true});
const rockIM=new T.InstancedMesh(rockGeo,chunkMat,CMAX),plateIM=new T.InstancedMesh(plateGeo,chunkMat.clone(),CMAX);
[rockIM,plateIM].forEach(im=>{im.instanceMatrix.setUsage(T.DynamicDrawUsage);im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;im.count=0;for(let i=0;i<CMAX;i++)im.setColorAt(i,new T.Color(1,1,1));scene.add(im);});
const CH=[];
const _m=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_v=new V(),_s=new V();
function chunk(o){
  if(CH.length>=CMAX){const k=CH.findIndex(c=>c.rest);CH.splice(k>=0?k:0,1);}
  const c=Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,rx:rnd()*6,ry:rnd()*6,rz:rnd()*6,ax:rr(-12,12),ay:rr(-12,12),az:rr(-12,12),sx:.2,sy:.2,sz:.2,col:new T.Color(0x555555),plate:false,hot:false,rest:false,t:0,trail:0},o);
  CH.push(c);evCount.c++;
  if(c.hot&&layers.estilhaco){c.glow=glow({follow:c,s:.35+c.sx,i:2.2,life:rr(1,2.2),c:[1,.45,.12],curve:1.5});}
  return c;
}
function updateChunks(dt){
  let nr=0,np=0;
  for(const c of CH){
    c.t+=dt;
    if(!c.rest){
      c.vy-=9.8*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;c.rx+=c.ax*dt;c.ry+=c.ay*dt;c.rz+=c.az*dt;
      const gy=c.sy*.45+groundH(c.x,c.z);
      if(c.y<gy){c.y=gy;if(c.blood&&!c.splat&&layers.marca){c.splat=true;bloodSplat(c.x,c.z,rr(.06,.13));}c.vy*=-.32;c.vx*=.5;c.vz*=.5;c.ax*=.5;c.ay*=.5;c.az*=.5;if(Math.abs(c.vy)<.6&&Math.hypot(c.vx,c.vz)<.5){c.rest=true;c.rx=Math.round(c.rx/(PI/2))*(PI/2);c.rz=Math.round(c.rz/(PI/2))*(PI/2);}}
      if(c.hot&&c.t<1.8&&layers.fumaca){c.trail-=dt;if(c.trail<=0){c.trail=.025;spark({x:c.x,y:c.y,z:c.z,vx:c.vx*.15,vy:c.vy*.15,vz:c.vz*.15,life:rr(.25,.45),w:.05+c.sx*.2,st:.05,kind:0,g:0,drag:1});if(rnd()<.25)puff({x:c.x,y:c.y,z:c.z,s0:.04,s1:.14+c.sx*.3,sg:.15,life:rr(1,1.6),drag:2,buoy:.6,c:SMOKE.grey,kind:0});}}
    }
    _e.set(c.rx,c.ry,c.rz);_q.setFromEuler(_e);_m.compose(_v.set(c.x,c.y,c.z),_q,_s.set(c.sx,c.sy,c.sz));
    const im=c.plate?plateIM:rockIM,idx=c.plate?np++:nr++;
    im.setMatrixAt(idx,_m);im.setColorAt(idx,c.hot&&c.t<1.6?_hotCol(c):c.col);
  }
  rockIM.count=nr;plateIM.count=np;
  [rockIM,plateIM].forEach(im=>{im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;});
}
const _hc=new T.Color();
function _hotCol(c){const k=Math.max(0,1-c.t/1.6);return _hc.copy(c.col).lerp(new T.Color(1,.42,.1),k*.85);}

/* ================= CORPOS SOLTOS (peças de carro, partes de zumbi, blocos) ================= */
const BODIES=[];
function body(obj,o){
  stage.attach(obj);
  const b=Object.assign({obj,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,r:.2,bounce:.3,rest:false,trail:null,tt:0,t:0,blood:false},o);
  BODIES.push(b);return b;
}
function updateBodies(dt){
  for(const b of BODIES){
    if(b.rest)continue;b.t+=dt;
    b.vy-=9.8*dt;const o=b.obj;
    o.position.x+=b.vx*dt;o.position.y+=b.vy*dt;o.position.z+=b.vz*dt;
    o.rotation.x+=b.wx*dt;o.rotation.y+=b.wy*dt;o.rotation.z+=b.wz*dt;
    const gb=b.r+groundH(o.position.x,o.position.z);if(o.position.y<gb){o.position.y=gb;if(b.vy<0)b.vy*=-b.bounce;b.vx*=.55;b.vz*=.55;b.wx*=.5;b.wy*=.5;b.wz*=.5;
      if(b.blood&&!b.splat){b.splat=true;bloodSplat(o.position.x,o.position.z,rr(.25,.5));}
      if(Math.abs(b.vy)<.7&&Math.hypot(b.vx,b.vz)<.4){b.rest=true;}}
    if(b.trail&&b.t<(b.trailDur||2.5)){b.tt-=dt;if(b.tt<=0){b.tt=b.trail==='fire'?.03:.05;
      if(b.trail==='fire'&&layers.fogo){spark({x:o.position.x,y:o.position.y,z:o.position.z,vx:b.vx*.2,vy:b.vy*.2,vz:b.vz*.2,life:rr(.3,.5),w:.12,st:.06,kind:0,g:0,drag:1});if(rnd()<.45)puff({x:o.position.x,y:o.position.y,z:o.position.z,s0:.08,s1:.26,sg:.2,life:rr(.9,1.4),h0:.8,hl:.12,drag:2.4,buoy:.9,c:SMOKE.dark});}
      else if(b.trail==='blood'&&layers.fumaca&&b.t<.5&&rnd()<.5)puff({x:o.position.x,y:o.position.y,z:o.position.z,s0:.03,s1:.07,sg:.01,life:.5,drag:3,buoy:-1.5,c:SMOKE.blood,kind:2});
      else if(b.trail==='smoke'&&layers.fumaca)puff({x:o.position.x,y:o.position.y,z:o.position.z,s0:.08,s1:.3,sg:.2,life:1.6,drag:2,buoy:.5,c:SMOKE.dark});}}
  }
}

/* ================= FOGO residual ================= */
const FIRES=[];
function fire(o){const f=Object.assign({x:0,y:0,z:0,r:.6,r0:null,grow:0,life:6,t:0,rate:22,acc:0,smoke:.6,smokeAcc:0,fade:1,follow:null,col:SMOKE.black},o);if(f.r0==null)f.r0=f.r;FIRES.push(f);return f;}
function updateFires(dt){
  for(let i=FIRES.length-1;i>=0;i--){const f=FIRES[i];f.t+=dt;
    if(f.follow){const p=f.follow.position||f.follow;f.x=p.x+(f.fx||0);f.y=p.y+(f.fy||0);f.z=p.z+(f.fz||0);}
    const R=f.grow?lerp(f.r0,f.r,Math.min(1,f.t/f.grow)):f.r;
    f.fade=f.t<f.life-1.5?Math.min(1,f.t*3):Math.max(0,(f.life-f.t)/1.5);
    if(f.t>=f.life){FIRES.splice(i,1);continue;}
    if(!layers.fogo)continue;
    f.acc+=dt*f.rate*(.5+R*.9)*f.fade*lodK();
    while(f.acc>=1){f.acc-=1;const a=rnd()*PI*2,d=Math.sqrt(rnd())*R;
      puff({x:f.x+Math.cos(a)*d,y:f.y+.05,z:f.z+Math.sin(a)*d,vx:rr(-.2,.2),vy:rr(.6,1.4),vz:rr(-.2,.2),s0:.1,s1:rr(.28,.46)*(.8+Math.min(R,3)*.22),sg:-.08,life:rr(.45,.85),h0:rr(1,1.25),hl:rr(.35,.6),drag:1.5,buoy:3.2,c:f.col,kind:0,wind:.4});}
    f.smokeAcc+=dt*f.smoke*(1+R*.8)*f.fade*lodK();
    while(f.smokeAcc>=1&&layers.fumaca){f.smokeAcc-=1;puff({x:f.x+rr(-R,R)*.5,y:f.y+.6+R*.3,z:f.z+rr(-R,R)*.5,vy:rr(.8,1.5),s0:.25,s1:.6+Math.min(R,2)*.3,sg:.3,life:rr(4,6.5),h0:.25,hl:.25,drag:.6,buoy:.55,c:f.col,kind:0});}
    if(rnd()<dt*6*f.fade&&layers.estilhaco)spark({x:f.x+rr(-R,R)*.6,y:f.y+.4,z:f.z+rr(-R,R)*.6,vx:rr(-.4,.4),vy:rr(1.5,3.2),vz:rr(-.4,.4),life:rr(.8,1.6),w:.025,st:.02,kind:4,g:-.6,drag:1.2});
  }
}

/* ================= DECALS: marca queimada, cratera, sangue ================= */
seed=5;
function scorchTex(){return canvasTex(256,256,(g,w,h)=>{g.clearRect(0,0,w,h);const c=w/2;
  for(let k=0;k<60;k++){const a=rnd()*PI*2,l=c*(.55+rnd()*.42);g.strokeStyle='rgba(8,6,5,'+(.25+rnd()*.35)+')';g.lineWidth=2+rnd()*6;g.beginPath();g.moveTo(c,c);g.lineTo(c+Math.cos(a)*l,c+Math.sin(a)*l);g.stroke();}
  const gr=g.createRadialGradient(c,c,0,c,c,c*.72);gr.addColorStop(0,'rgba(4,3,3,.96)');gr.addColorStop(.55,'rgba(10,8,7,.85)');gr.addColorStop(1,'rgba(14,11,9,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let k=0;k<26;k++){g.fillStyle='rgba(60,40,28,'+(.15+rnd()*.2)+')';g.beginPath();g.arc(c+rr(-.4,.4)*c,c+rr(-.4,.4)*c,2+rnd()*7,0,7);g.fill();}});}
const SCORCH=[scorchTex(),scorchTex(),scorchTex()];
const decalGeo=new T.PlaneGeometry(1,1).rotateX(-PI/2);
let decalY=0;
const SCORCH_MAT=SCORCH.map(t=>new T.MeshStandardMaterial({map:t,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
const DIRT_MAT=new T.MeshStandardMaterial({map:canvasTex(256,256,(g,w,h)=>{const c=w/2;g.clearRect(0,0,w,h);
  const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'rgba(92,72,52,1)');gr.addColorStop(.6,'rgba(118,92,64,1)');gr.addColorStop(.82,'rgba(80,64,50,.8)');gr.addColorStop(1,'rgba(40,36,34,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let k=0;k<420;k++){const a=rnd()*PI*2,d=Math.sqrt(rnd())*c*.8;g.fillStyle=rnd()<.5?'rgba(40,30,22,.5)':'rgba(160,132,96,.5)';g.beginPath();g.arc(c+Math.cos(a)*d,c+Math.sin(a)*d,1+rnd()*3.5,0,7);g.fill();}}),
  transparent:true,depthWrite:false,roughness:1,flatShading:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
/* malha que copia a altura do chão embaixo dela */
function conform(x,z,R,mat,lift,rot){const n=Math.max(16,Math.min(48,Math.round(R*8)));const g=new T.PlaneGeometry(2,2,n,n).rotateX(-PI/2);const p=g.attributes.position;const ca=Math.cos(rot),sa=Math.sin(rot);
  for(let i=0;i<p.count;i++){const lx=p.getX(i)*R,lz=p.getZ(i)*R,wx=x+lx*ca-lz*sa,wz=z+lx*sa+lz*ca;p.setXYZ(i,wx,groundH(wx,wz)+lift,wz);}
  g.computeVertexNormals();const m=new T.Mesh(g,mat);m.receiveShadow=true;stage.add(m);return m;}
function scorch(x,z,r){if(!layers.marca)return;conform(x,z,r,SCORCH_MAT[Math.floor(rnd()*3)],.03+(decalY++%20)*.001,rnd()*6);}
function crater(x,z,r,depth){
  dent(x,z,r,depth);
  if(!layers.marca)return;
  conform(x,z,r*1.02,DIRT_MAT,.045,rnd()*6);
  // pedaços de asfalto quebrado na borda
  const n=Math.round(6+r*7);for(let i=0;i<n;i++){const a=i/n*PI*2+rr(-.15,.15),d=r*rr(.95,1.3);const s=rr(.12,.26)*Math.min(1.6,.6+r*.4);
    const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;const c=new T.Mesh(rnd()<.6?plateGeo:rockGeo,M(rnd()<.5?0x2b2c2f:0x3a3836));
    c.position.set(px,groundH(px,pz)+s*.12,pz);c.scale.set(s*2,s*.35,s*1.4);c.rotation.set(rr(-.5,.5),a,rr(-.6,.2));c.castShadow=true;c.receiveShadow=true;stage.add(c);}
}
const BLOOD=[];
const bloodMat=new T.MeshStandardMaterial({color:0x5c0a0a,roughness:.15,metalness:.1,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const bloodGeo=new T.CircleGeometry(.5,9).rotateX(-PI/2);
function bloodSplat(x,z,r){if(BLOOD.length>450)return;const m=new T.Mesh(bloodGeo,bloodMat);m.position.set(x,groundH(x,z)+.03+(decalY++%20)*.0008,z);m.scale.set(r*rr(1.6,2.4),1,r*rr(1.2,2));m.rotation.y=rnd()*6;m.receiveShadow=true;stage.add(m);BLOOD.push({m,t:0,s:m.scale.clone()});m.scale.multiplyScalar(.05);}
function updateBlood(dt){for(const b of BLOOD){if(b.t>1)continue;b.t+=dt*1.2;const e=1-Math.pow(1-Math.min(1,b.t),2.5);b.m.scale.set(b.s.x*Math.max(.05,e),1,b.s.z*Math.max(.05,e));}}

/* ================= camadas, LOD, contadores ================= */
const layers={clarao:1,fogo:1,choque:1,fumaca:1,estilhaco:1,marca:1};
['clarao','fogo','choque','fumaca','estilhaco','marca'].forEach(k=>{const el=$('L-'+k);el.addEventListener('change',()=>{layers[k]=el.checked?1:0;});});
let lodNow=1;
function lodFor(p,vis){const d=camera.position.distanceTo(p)-(vis||0)*3;return d<20?1:d<45?.5:d<85?.2:.08;}
function lodK(){return lodNow;}
const evCount={p:0,s:0,c:0,l:0};
let evMark=null;

/* ================= personagens: zumbis, sobrevivente ================= */
const SKIN=[0x94a084,0x7b744a,0x8c7c5e,0xa3a08a],CLOTH=[0x4a6f96,0x8e3b3b,0x5d4a3a,0x4f7a43,0x6b6f78,0x3f5f3a,0x5a4a6e,0x8a6a3a],PANTS=[0x2c3340,0x3a3128,0x2b2b2b,0x3d4436];
const eyeMat=new T.MeshBasicMaterial({color:0xffd84a});
const charMat=M(0x1b1714);
let ZS=[];
function zombie(x,z,ry,o){const surv=!!(o&&o.surv);
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;stage.add(g);
  const sk=surv?M(0xc49a74):M(SKIN[Math.floor(rnd()*SKIN.length)]),cl=surv?M(0x4d5536):M(CLOTH[Math.floor(rnd()*CLOTH.length)]),pa=surv?M(0x2a2d33):M(PANTS[Math.floor(rnd()*PANTS.length)]);
  const sc=rr(.92,1.08);g.scale.setScalar(sc);
  const parts={};
  const piv=(px,py,pz)=>{const p=new T.Group();p.position.set(px,py,pz);g.add(p);return p;};
  parts.legL=piv(-.11,.92,0);mesh(new T.CylinderGeometry(.085,.065,.9,7),pa,0,-.45,0,parts.legL);mesh(Box(.13,.08,.24),M(0x1c1a17),0,-.88,.05,parts.legL);
  parts.legR=piv(.11,.92,0);mesh(new T.CylinderGeometry(.085,.065,.9,7),pa,0,-.45,0,parts.legR);mesh(Box(.13,.08,.24),M(0x1c1a17),0,-.88,.05,parts.legR);
  parts.torso=piv(0,.92,0);mesh(Box(.38,.18,.22),pa,0,.04,0,parts.torso);mesh(new T.CylinderGeometry(.23,.18,.58,8),cl,0,.42,0,parts.torso).scale.z=.65;
  parts.head=piv(0,1.6,0);const hd=mesh(new T.DodecahedronGeometry(.135,1),sk,0,.08,.02,parts.head);hd.scale.set(.95,1.1,1);
  if(surv){mesh(Box(.3,.08,.3),M(0x1d1f22),0,.22,0,parts.head);mesh(Box(.34,.46,.18),M(0x3d3328),0,.45,-.2,parts.torso);}
  else{const e1=mesh(Box(.04,.025,.02),eyeMat,-.045,.1,.14,parts.head),e2=mesh(Box(.04,.025,.02),eyeMat,.045,.1,.14,parts.head);e1.castShadow=e2.castShadow=false;}
  parts.armL=piv(-.27,1.46,0);mesh(new T.CylinderGeometry(.065,.05,.66,7),cl,0,-.33,0,parts.armL);mesh(Box(.08,.1,.08),sk,0,-.7,0,parts.armL);
  parts.armR=piv(.27,1.46,0);mesh(new T.CylinderGeometry(.065,.05,.66,7),cl,0,-.33,0,parts.armR);mesh(Box(.08,.1,.08),sk,0,-.7,0,parts.armR);
  if(surv){parts.armL.rotation.x=-.15;parts.armR.rotation.x=-.9;}else{parts.armL.rotation.x=-1.2+rr(-.2,.2);parts.armR.rotation.x=-1.0+rr(-.2,.2);parts.head.rotation.z=rr(-.2,.25);}
  const zz={surv,g,parts,state:'idle',ph:rnd()*9,sc,ry,vx:0,vz:0,vy:0,fall:0,fallAxis:new V(1,0,0),stun:0,burn:0,ragdoll:false,charT:0};
  ZS.push(zz);return zz;
}
function zMeshes(z){const out=[];z.g.traverse(o=>{if(o.isMesh&&o.material!==eyeMat)out.push(o);});return out;}
function detach(z,key,dir,power,hot){
  const p=z.parts[key];if(!p||!p.parent||p.userData.gone)return;p.userData.gone=true;
  const b=body(p,{vx:dir.x*power*rr(.6,1.2)+rr(-1.5,1.5),vy:rr(3,7)*Math.min(1.4,power/8),vz:dir.z*power*rr(.6,1.2)+rr(-1.5,1.5),wx:rr(-12,12),wy:rr(-8,8),wz:rr(-12,12),r:.12,bounce:.25,trail:hot?'fire':'blood',trailDur:hot?1.2:.8,blood:true});
  if(layers.fumaca)for(let i=0;i<4;i++){const q=p.getWorldPosition(new V());puff({x:q.x,y:q.y,z:q.z,vx:dir.x*rr(1,4)+rr(-1,1),vy:rr(-.5,2),vz:dir.z*rr(1,4)+rr(-1,1),s0:.05,s1:rr(.12,.24),sg:.05,life:rr(.5,1.1),drag:4,buoy:-1,c:SMOKE.blood,kind:2});}
  return b;
}
function hitZombie(z,cx,cz,E){
  if(z.state==='dead'||z.state==='gone')return null;
  const dx=z.g.position.x-cx,dz=z.g.position.z-cz,d=Math.hypot(dx,dz)+.001;
  if(E.cone){const a=Math.atan2(dz,dx)-E.cone.a;const aa=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(aa)>E.cone.half||d>E.cone.len)return null;}
  const dir=new V(dx/d,0,dz/d);
  if(E.flash){if(d<E.injury){z.state='stun';z.stun=4;}return null;}
  if(d>E.injury)return null;
  const hot=!!E.hotParts;
  if(d<E.lethal*.45){
    const q=z.g.position.clone();q.y+=1.1;
    if(d<E.lethal*.25){headBurst(z,dir,hot);gibs(q,dir,10,hot);}else gibs(q,dir,5,hot);
    ['head','armL','armR','legL','legR'].forEach(k=>detach(z,k,dir,E.push*1.3,hot&&rnd()<.5));
    const tb=detach(z,'torso',dir,E.push,hot);
    z.state='gone';if(hot)charZ(z);
    if(layers.marca){bloodSplat(z.g.position.x,z.g.position.z,.6);}
    return 'explodido';
  }
  if(d<E.lethal){
    const keys=['armL','armR','legL','legR','head'].sort(()=>rnd()-.5);const n=2+Math.floor(rnd()*3);
    for(let i=0;i<n;i++){if(keys[i]==='head'&&d<E.lethal*.7)headBurst(z,dir,hot);else detach(z,keys[i],dir,E.push*.9,hot&&rnd()<.4);}
    const q=z.g.position.clone();q.y+=1;gibs(q,dir,3,hot);
    knock(z,dir,E.push*(1-d/E.injury)+3,true);if(hot)charZ(z);
    if(layers.marca)bloodSplat(z.g.position.x+dir.x*.6,z.g.position.z+dir.z*.6,.45);
    return 'desmembrado';
  }
  if(rnd()<.5*(1-d/E.injury))detach(z,rnd()<.5?'armL':'armR',dir,E.push*.6,false);
  knock(z,dir,E.push*(1-d/E.injury)+1.5,false);
  return 'arremessado';
}
const GIBC=[0x6a1410,0x4a0c0a,0x8a2a20,0x7a3a2a,0xd8cfb8];
function gibs(q,dir,n,hot){if(!layers.estilhaco)return;for(let i=0;i<n;i++){const d=rdir();d.y=Math.abs(d.y)+.35;d.addScaledVector(dir,.9).normalize();const v=rr(3,10),s=rr(.035,.09);
  chunk({x:q.x,y:q.y,z:q.z,vx:d.x*v,vy:d.y*v,vz:d.z*v,sx:s,sy:s*rr(.5,1),sz:s*rr(.8,1.3),col:new T.Color(hot?0x241a16:GIBC[Math.floor(rnd()*GIBC.length)]),plate:rnd()<.3,blood:!hot});}}
function headBurst(z,dir,hot){const h=z.parts.head;if(!h||h.userData.gone)return;h.userData.gone=true;const q=h.getWorldPosition(new V());h.visible=false;
  gibs(q,dir,10,hot);
  if(layers.fumaca)for(let i=0;i<8;i++)puff({x:q.x,y:q.y,z:q.z,vx:dir.x*rr(1,5)+rr(-1.5,1.5),vy:rr(-.5,2.5),vz:dir.z*rr(1,5)+rr(-1.5,1.5),s0:.06,s1:rr(.15,.3),sg:.06,life:rr(.6,1.2),drag:4,buoy:-1,c:SMOKE.blood,kind:2});
  if(layers.marca)bloodSplat(q.x+dir.x*1.2,q.z+dir.z*1.2,.35);}
function knock(z,dir,power,ragdoll){z.state='fall';z.vx=dir.x*power;z.vz=dir.z*power;z.vy=ragdoll?rr(2.5,4.5):rr(.8,2);z.fall=0;z.fallAxis.set(dir.z,0,-dir.x);z.ragdoll=ragdoll;z.spin=rr(-3,3);}
function charZ(z){zMeshes(z).forEach(m=>{m.material=charMat;});}
function burnZ(z){if(z.burn>0||z.state==='gone'||z.state==='dead')return;z.burn=rr(3,5);z.fire=fire({follow:z.g,fy:1.1,r:.28,life:z.burn+2.5,rate:26,smoke:.7});}
const _qa=new T.Quaternion();
function updateZombies(dt){
  for(const z of ZS){
    z.ph+=dt;
    if(z.state==='idle'||z.state==='stun'){
      const k=z.state==='stun'?1:0;
      if(!z.surv||k){z.parts.armL.rotation.x=k?-2.6+Math.sin(z.ph*6)*.2:-1.2+Math.sin(z.ph*1.7)*.12;
      z.parts.armR.rotation.x=k?-2.5+Math.sin(z.ph*5)*.2:-1.0+Math.sin(z.ph*1.9+1)*.12;
      z.parts.head.rotation.x=k?.4:Math.sin(z.ph*1.3)*.08;
      z.g.rotation.z=k?Math.sin(z.ph*7)*.12:Math.sin(z.ph*1.1)*.03;}
      z.g.position.y=groundH(z.g.position.x,z.g.position.z);
      if(z.state==='stun'){z.stun-=dt;if(z.stun<=0)z.state='idle';}
      if(z.burn>0){z.burn-=dt;z.charT+=dt;zMeshes(z).forEach(m=>{if(m.material!==charMat&&z.charT>1.5)m.material=charMat;});z.g.rotation.z=Math.sin(z.ph*9)*.2;if(z.burn<=0){knock(z,new V(rr(-1,1),0,rr(-1,1)).normalize(),1,false);}}
    }else if(z.state==='fall'){
      z.vy-=9.8*dt;const p=z.g.position;p.x+=z.vx*dt;p.z+=z.vz*dt;p.y+=z.vy*dt;
      const gz=groundH(p.x,p.z);const dr=p.y<=gz+.01?Math.exp(-6*dt):1;z.vx*=dr;z.vz*=dr;
      if(p.y<gz){p.y=gz;z.vy=0;}
      z.fall=Math.min(PI/2*.96,z.fall+dt*(z.ragdoll?5.5:3.4));
      _qa.setFromAxisAngle(z.fallAxis,z.fall);z.g.quaternion.setFromEuler(new T.Euler(0,z.ry,0)).premultiply(_qa);
      if(z.fall>=PI/2*.96&&p.y<=gz+.01&&Math.hypot(z.vx,z.vz)<.15){z.state='dead';}
    }
  }
}
function survivor(x,z,ry,pose){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;stage.add(g);
  const j=M(0x4d5536),pn=M(0x2a2d33),sk=M(0xc49a74);
  mesh(new T.CylinderGeometry(.09,.07,.9,7),pn,-.11,.45,0,g);mesh(new T.CylinderGeometry(.09,.07,.9,7),pn,.11,.45,0,g);
  mesh(Box(.44,.6,.26),j,0,1.22,0,g);mesh(new T.DodecahedronGeometry(.13,1),sk,0,1.68,0,g);mesh(Box(.3,.08,.3),M(0x1d1f22),0,1.82,0,g);
  mesh(Box(.36,.5,.2),M(0x3d3328),0,1.25,-.24,g);
  if(pose==='throw'){const a=new T.Group();a.position.set(.27,1.45,0);a.rotation.x=-2.6;g.add(a);mesh(new T.CylinderGeometry(.06,.05,.62,7),j,0,-.31,0,a);}
  return g;
}

/* ================= objetos de cena ================= */
let stage=new T.Group();scene.add(stage);
function car(x,z,ry,col){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;stage.add(g);
  const paint=new T.MeshStandardMaterial({color:col,roughness:.45,metalness:.35,flatShading:true});
  const parts={paint};
  parts.body=mesh(Box(4.1,.62,1.72),paint,0,.62,0,g);
  mesh(Box(4.14,.14,1.76),M(0x18191b),0,.34,0,g);
  parts.cabin=mesh(Box(2.1,.56,1.5),paint,-.25,1.2,0,g);
  parts.glass=mesh(Box(2.14,.4,1.52),new T.MeshStandardMaterial({color:0x101820,roughness:.08,metalness:.7,flatShading:true}),-.25,1.22,0,g);parts.glass.scale.set(.98,1,1.005);
  parts.hood=mesh(Box(1.05,.08,1.6),paint,1.45,.96,0,g);
  parts.trunk=mesh(Box(.7,.08,1.6),paint,-1.7,.96,0,g);
  parts.doorL=mesh(Box(1,.5,.06),paint,.25,.72,.88,g);parts.doorR=mesh(Box(1,.5,.06),paint,.25,.72,-.88,g);
  parts.wheels=[];for(const a of[-1.35,1.35])for(const s of[-1,1]){const w=mesh(new T.CylinderGeometry(.36,.36,.26,10).rotateX(PI/2),M(0x111111),a,.36,s*.82,g);parts.wheels.push(w);}
  const hl=new T.MeshBasicMaterial({color:0xfff1d0});for(const s of[-1,1]){mesh(Box(.05,.13,.32),hl,2.06,.72,s*.6,g).castShadow=false;mesh(Box(.05,.13,.3),new T.MeshBasicMaterial({color:0x8a1a14}),-2.06,.74,s*.6,g).castShadow=false;}
  return {g,parts,col};
}
function concreteWall(cx,cz,ry){
  const g=new T.Group();g.position.set(cx,0,cz);g.rotation.y=ry;stage.add(g);
  const blocks=[];const cm=M(0x8a857c),cm2=M(0x7d7871);
  for(let r=0;r<3;r++)for(let c=0;c<5;c++){const b=mesh(Box(.98,.78,.32),(r+c)%2?cm:cm2,(c-2)*1+(r%2?.12:0),.4+r*.8,0,g);blocks.push(b);}
  return {g,blocks};
}
function barrel(x,z){const g=new T.Group();g.position.set(x,0,z);stage.add(g);
  mesh(new T.CylinderGeometry(.3,.3,.88,12),M(0x9b1c18,{roughness:.5,metalness:.3}),0,.44,0,g);mesh(new T.CylinderGeometry(.305,.305,.1,12),M(0xd8b02a),0,.62,0,g);
  const lid=mesh(new T.CylinderGeometry(.29,.29,.04,12),M(0x7a1612,{roughness:.5,metalness:.3}),0,.9,0,g);return {g,lid};}
function p13(x,z){const g=new T.Group();g.position.set(x,0,z);stage.add(g);
  const m=M(0x3b5f9a,{roughness:.45,metalness:.35});mesh(new T.CylinderGeometry(.18,.18,.3,14),m,0,.24,0,g);const top=mesh(new T.SphereGeometry(.18,14,8,0,PI*2,0,PI/2),m,0,.39,0,g);
  mesh(new T.CylinderGeometry(.17,.17,.06,14),m,0,.03,0,g);mesh(new T.CylinderGeometry(.03,.03,.06,8),M(0x9a9da0,{metalness:.8,roughness:.3}),0,.6,0,g);
  const h=new T.Mesh(new T.TorusGeometry(.1,.014,6,14,PI),m);h.position.set(0,.55,0);g.add(h);return {g};}
function posto(){
  const g=new T.Group();stage.add(g);
  const can={};
  can.roof=mesh(Box(13,.5,7),M(0xd9d4c8),0,5,0,g);
  can.band=mesh(Box(13.1,.55,7.1),M(0x1f6a3a),0,4.7,0,g);
  can.pillars=[];for(const x of[-5,5])for(const z of[-2.4,2.4]){can.pillars.push(mesh(Box(.4,4.5,.4),M(0xc9c4b8),x,2.25,z,g));}
  can.pumps=[];for(const x of[-3.4,0,3.4]){const pg=new T.Group();pg.position.set(x,0,0);g.add(pg);mesh(Box(1.4,.25,.9),M(0x8f8a82),0,.12,0,pg);mesh(Box(.8,1.7,.55),M(0xd8d2c4),0,1.1,0,pg);mesh(Box(.82,.35,.57),M(0x1f6a3a),0,1.8,0,pg);mesh(Box(.5,.3,.02),new T.MeshBasicMaterial({color:0x8fd0a0}),0,1.35,.29,pg).castShadow=false;can.pumps.push(pg);}
  // loja
  mesh(Box(10,3.6,5),M(0xb8b1a2),-1,1.8,-8.5,g);mesh(Box(10.2,.5,5.2),M(0x1f6a3a),-1,3.75,-8.5,g);
  can.shop=[];for(let i=0;i<4;i++){const w=mesh(Box(1.8,1.6,.06),winGlass,-4.6+i*2.2,1.6,-5.97,g);w.castShadow=false;can.shop.push(w);}
  // respiros do tanque subterrâneo
  for(let i=0;i<3;i++)mesh(new T.CylinderGeometry(.06,.06,3.2,6),M(0x8a8d90,{metalness:.6}),-7.5+i*.35,1.6,-4.6,g);
  mesh(Box(2.4,.06,1.6),M(0x3a3c40,{metalness:.5}),-7,.03,3.6,g);
  return can;
}

/* ================= tarefas de roteiro ================= */
let TASKS=[],EVENTS=[],clock=0,simT=0,blastT=null,blastAt=null,activeKey=null;
function at(t,fn){EVENTS.push({t,fn});}
function task(fn){TASKS.push(fn);}

/* ================= EXPLOSÃO: compositor de camadas ================= */
/* E: {lethal, injury, vis (raio visual da bola de fogo), fb:n, fuel:bool, smoke:cor, smokeN, dust:cor, dustN, sparks, sparkKind, sparkSpeed, chunks, chunkCol, plate, hot, scorch, crater, shake, light, flash, push, mushroom, residual, cone, dir, columnDur} */
let shakeAmp=0,flashV=0,flashDecay=6;
function blast(x,y,z,E){
  const pos=new V(x,y,z);const k=lodFor(pos,E.vis);lodNow=k;
  evCount.p=evCount.s=evCount.c=evCount.l=0;evMark={E,t:simT};
  const sc=E.vis;
  const dir=E.dir||null;
  // 1. clarão
  if(layers.clarao){
    boomLight(x,y+sc*.6,z,(E.light||40)*.7,(E.injury||10)*2.4,E.lightLife||.45,E.lightCol||0xffa050);
    glow({x,y:y+sc*.4,z,s:sc*1.4,s1:sc*3.2,i:E.flashI||6,life:.22,c:[1,.92,.75],curve:2.5});
    if(!E.flash)glow({x,y:y+sc*.5,z,s:sc*2.2,s1:sc*3.6,i:2.2,life:E.fuel?1.4:.6,c:[1,.45,.15],curve:1.6});
    const dc=camera.position.distanceTo(pos);if(dc<15&&!reduce){flashV=Math.max(flashV,(E.flash?1:.32)*(1-dc/15));flashDecay=E.flash?.55:7;}
    if(E.flash&&dc<40&&!reduce){flashV=Math.max(flashV,1);flashDecay=.5;}
  }
  shakeAmp=Math.max(shakeAmp,(E.shake||1)/(1+camera.position.distanceTo(pos)*.12));
  // 2-3. bola de fogo que vira fumaça
  if(layers.fogo&&E.fb){
    const n=Math.round(E.fb*Math.max(k,.35));
    for(let i=0;i<n;i++){
      let d=rdir();if(!E.fuel)d.y=Math.abs(d.y)*.8+.1;else d.y=Math.abs(d.y)*.5+.05;
      if(dir){d.addScaledVector(dir,E.dirBias||1.2).normalize();}
      const v=sc*rr(4.5,7.5)*(E.fuel?.75:1);
      puff({x:x+d.x*sc*.15,y:y+sc*.25+d.y*sc*.1,z:z+d.z*sc*.15,vx:d.x*v,vy:d.y*v+(E.fuel?sc*1.4:sc*.6),vz:d.z*v,
        s0:sc*.22,s1:sc*rr(.42,.62),sg:sc*rr(.12,.22),gk:9,life:rr(E.smokeLife*.7,E.smokeLife),h0:rr(1.05,1.35)*(E.heat||1),hl:E.fuel?rr(.8,1.4)*(E.hlK||1):rr(.22,.42),
        drag:E.fuel?4.2:6.5,buoy:E.fuel?2.2:1.2,c:E.smoke,kind:0});
    }
  }
  // fumaça própria (sobe depois)
  if(layers.fumaca&&E.smokeN){
    const n=Math.round(E.smokeN*Math.max(k,.3));
    for(let i=0;i<n;i++){const d=rdir();d.y=Math.abs(d.y);
      puff({x:x+d.x*sc*.6,y:y+sc*.4+d.y*sc*.5,z:z+d.z*sc*.6,vx:d.x*sc*2.4,vy:sc*rr(.6,2.2),vz:d.z*sc*2.4,s0:sc*.25,s1:sc*rr(.55,.85),sg:sc*rr(.18,.3),gk:4,life:rr(E.smokeLife*.7,E.smokeLife*1.1),h0:.32,hl:.25,drag:3,buoy:.45,c:E.smoke,kind:E.smokeKind||0});}
  }
  // 5. onda de choque
  if(layers.choque&&E.shock!==false&&k>.15)shock(x,y+sc*.3,z,E.lethal*.9,E.injury*.6,E.shockDur||.32);
  // 6. poeira rasteira
  if(layers.fumaca&&E.dustN&&k>.15){
    const n=Math.round(E.dustN*k);
    for(let i=0;i<n;i++){let a=rnd()*PI*2;if(E.cone){a=E.cone.a+rr(-E.cone.half,E.cone.half);}
      const v=rr(.6,1)*E.injury*(E.cone?1.6:.9);
      puff({x:x+Math.cos(a)*.3,y:.15,z:z+Math.sin(a)*.3,vx:Math.cos(a)*v,vy:rr(.2,1.2),vz:Math.sin(a)*v,s0:sc*.2,s1:sc*rr(.5,.8),sg:sc*rr(.2,.35),gk:5,life:rr(2.2,4),drag:3.6,buoy:.2,c:E.dust||SMOKE.dust,kind:1});}
  }
  // 7. estilhaços
  if(layers.estilhaco&&E.sparks){
    const n=Math.round(E.sparks*k);
    for(let i=0;i<n;i++){let d;
      if(E.cone){const a=E.cone.a+rr(-E.cone.half,E.cone.half);d=new V(Math.cos(a),rr(-.05,.25),Math.sin(a));}
      else {d=rdir();d.y=Math.abs(d.y)*.9+.05;if(dir)d.addScaledVector(dir,E.dirBias||1).normalize();}
      const v=(E.sparkSpeed||28)*rr(.45,1);
      spark({x:x+d.x*.1,y:y+sc*.25,z:z+d.z*.1,vx:d.x*v,vy:d.y*v,vz:d.z*v,life:rr(.35,1.1),w:E.sparkW||.035,st:.03,kind:E.sparkKind||0,drag:E.sparkKind===1?.15:.9});}
    if(E.embers)for(let i=0;i<E.embers*k;i++){const d=rdir();d.y=Math.abs(d.y);spark({x,y:y+sc*.5,z,vx:d.x*rr(2,6),vy:rr(3,8),vz:d.z*rr(2,6),life:rr(1.2,2.6),w:.04,st:.02,kind:4,drag:1.6,g:2.5});}
  }
  // 8. detritos
  if(layers.estilhaco&&E.chunks&&k>=.5){
    const n=Math.round(E.chunks*(k>=1?1:.5));
    for(let i=0;i<n;i++){let d=rdir();d.y=Math.abs(d.y)*.9+.2;if(dir)d.addScaledVector(dir,.8).normalize();
      const v=rr(4,11)*(E.chunkV||1);const s=rr(.07,.2)*(E.chunkS||1);const pl=E.plate?rnd()<.6:rnd()<.15;
      chunk({x:x+d.x*.2,y:y+.2,z:z+d.z*.2,vx:d.x*v,vy:d.y*v+2,vz:d.z*v,sx:pl?s*1.6:s,sy:pl?s*.3:s*rr(.6,1),sz:pl?s*1.1:s,col:new T.Color(E.chunkCols?E.chunkCols[Math.floor(rnd()*E.chunkCols.length)]:0x47423d),plate:pl,hot:rnd()<(E.hot||.3)});}
  }
  // 9. depois: marcas, fogo residual, cogumelo
  if(E.crater&&E.dent&&y<1.2){crater(x,z,E.crater,E.dent);
    if(layers.estilhaco)for(let i=0;i<Math.round(4+E.crater*4);i++){const a=rnd()*PI*2,v=rr(3,8)*(E.chunkV||1);const s=rr(.12,.28);chunk({x:x+Math.cos(a)*.3,y:.1,z:z+Math.sin(a)*.3,vx:Math.cos(a)*v*.6,vy:rr(4,10),vz:Math.sin(a)*v*.6,sx:s*1.6,sy:s*.35,sz:s*1.2,col:new T.Color(rnd()<.6?0x2b2c2f:0x4a3a2c),plate:true});}}
  if(E.scorch&&y<1.2)scorch(x,z,E.scorch);
  if(E.mushroom&&layers.fogo)mushroom(x,y,z,E.mushroom);
  if(E.residual&&layers.fogo){E.residual.forEach(r=>fire(Object.assign({x:x+(r.dx||0),y:0,z:z+(r.dz||0)},r)));}
  // vidros das fachadas e da loja
  const wr=Math.min(E.injury,20)*.85;for(const w of WINDOWS){if(w.broken)continue;const d=Math.hypot(w.x-x,w.y-y,w.z-z);if(E.cone){const a=Math.atan2(w.z-z,w.x-x)-E.cone.a;if(Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))>E.cone.half)continue;}if(d<wr){at(simT+d/340+.03,()=>breakWindow(w,x,z));}}
  // zumbis
  let rag=0,fallen=0;
  const near=ZS.filter(zz=>zz.state==='idle'||zz.state==='stun').map(zz=>({zz,d:Math.hypot(zz.g.position.x-x,zz.g.position.z-z)})).sort((a,b)=>a.d-b.d);
  for(const o of near){const r=hitZombie(o.zz,x,z,E);if(r==='explodido'||r==='desmembrado'){if(rag<12)rag++;else{o.zz.ragdoll=false;}}else if(r==='arremessado')fallen++;
    if(E.ignite&&o.d<E.ignite&&o.zz.state!=='gone')burnZ(o.zz);}
  RAG+=rag;FALLEN+=fallen;
}
let RAG=0,FALLEN=0;
function breakWindow(w,x,z){if(w.broken)return;w.broken=true;w.m.material=winHole;
  if(!layers.estilhaco)return;
  const out=new V(w.x-x,0,w.z-z).normalize();
  for(let i=0;i<24;i++)spark({x:w.x+rr(-.5,.5),y:w.y+rr(-.6,.6),z:w.z+.05,vx:rr(-1.5,1.5)+out.x*.5,vy:rr(-1,2),vz:rr(.5,3.5),life:rr(.6,1.4),w:.03,st:.02,kind:3,drag:.4});
  for(let i=0;i<4;i++)chunk({x:w.x+rr(-.4,.4),y:w.y+rr(-.4,.4),z:w.z+.1,vx:rr(-1,1),vy:rr(0,1.5),vz:rr(.5,2.5),sx:rr(.12,.25),sy:.02,sz:rr(.1,.2),col:new T.Color(0x9fc4d8),plate:true});
}
const RINGS=[];
function mushroom(x,y,z,m){
  const R={x,z,y0:y+m.h*.15,rise:m.h,rk:m.rk||.55,R0:m.r*.3,R1:m.r,r:m.r*.42,roll:m.roll||2.4,t:0,life:m.life||7};
  RINGS.push(R);
  const n=Math.round((m.n||40)*Math.max(lodNow,.4));
  for(let i=0;i<n;i++){
    const p=puff({x,y,z,s0:m.r*.2,s1:m.r*rr(.35,.5),sg:m.r*.06,gk:3,life:rr(R.life*.75,R.life),h0:rr(1,1.25),hl:rr(.9,1.6),c:m.col||SMOKE.black,kind:0});
    p.ring=R;p.ph=rnd()*PI*2;p.th=rnd()*PI*2;
  }
  // tronco
  const stemN=Math.round((m.stem||18)*Math.max(lodNow,.4));
  for(let i=0;i<stemN;i++){const d=rnd()*.6;puff({x:x+rr(-.4,.4)*m.r*.2,y:y+.3,z:z+rr(-.4,.4)*m.r*.2,vx:rr(-.3,.3),vy:m.h*rr(.6,1.4)*(1-d),vz:rr(-.3,.3),s0:m.r*.12,s1:m.r*rr(.22,.32),sg:m.r*.05,gk:4,life:rr(3,5),h0:rr(.9,1.2),hl:rr(.6,1.1),drag:1.2,buoy:.5,c:m.col||SMOKE.black});}
}
function updateRings(dt){for(let i=RINGS.length-1;i>=0;i--){const R=RINGS[i];R.t+=dt;if(R.t>R.life+1)RINGS.splice(i,1);}}

/* ================= projéteis ================= */
function throwArc(obj,from,to,dur,opts){
  opts=opts||{};stage.add(obj);obj.position.copy(from);
  const h=opts.h||3.2;let t=0;const bounce=opts.bounce||0;let phase=0,p0=from.clone(),p1=to.clone(),d=dur;
  task(dt=>{t+=dt;const a=Math.min(1,t/d);
    obj.position.lerpVectors(p0,p1,a);obj.position.y=lerp(p0.y,p1.y,a)+h*4*a*(1-a);
    obj.rotation.x+=dt*(opts.spin||10);obj.rotation.z+=dt*(opts.spin||10)*.6;
    if(opts.onStep)opts.onStep(obj,dt);
    if(a>=1){if(phase<bounce){phase++;p0=p1.clone();const k=.55/phase;p1=p1.clone().add(new V(rr(-.6,.9)*k,0,rr(-.5,.5)*k));d=.32/phase;t=0;return true;}
      if(opts.onLand)opts.onLand(obj);return false;}
    return true;});
}
function aimVel(from,to,T){return new V((to.x-from.x)/T,(to.y-from.y+4.9*T*T)/T,(to.z-from.z)/T);}
/* arremesso com física: voa, quica no chão (restituição e atrito), rola até parar; pavio conta desde o arremesso */
function physThrow(obj,from,vel,o){
  o=o||{};stage.add(obj);obj.position.copy(from);const v=vel.clone(),rad=o.rad||.07;let t=0,done=false;
  const spin=new V(rr(-14,14),rr(-6,6),rr(-14,14)),ax=new V();
  task(dt=>{if(done)return false;t+=dt;
    v.y-=9.8*dt;obj.position.addScaledVector(v,dt);
    const gh=groundH(obj.position.x,obj.position.z)+rad;
    if(obj.position.y<=gh){obj.position.y=gh;
      if(v.y<-1.1){const imp=-v.y;
        if(o.onImpact){done=true;o.onImpact(obj,imp);return false;}
        v.y=imp*(o.e||.4);const f=o.fric||.66;v.x*=f;v.z*=f;spin.multiplyScalar(.45);
        const q=obj.position;
        if(layers.fumaca)for(let i=0;i<Math.min(5,1+imp*.6);i++)puff({x:q.x,y:q.y-rad+.03,z:q.z,vx:rr(-1,1)+v.x*.25,vy:rr(.2,.9),vz:rr(-1,1)+v.z*.25,s0:.03,s1:rr(.08,.16),sg:.08,life:rr(.6,1.1),drag:4,buoy:.1,c:SMOKE.dust,kind:1});
        if(layers.estilhaco&&imp>3)for(let i=0;i<4;i++)spark({x:q.x,y:q.y-rad+.03,z:q.z,vx:rr(-2,2)+v.x*.4,vy:rr(.5,2),vz:rr(-2,2)+v.z*.4,life:rr(.1,.25),w:.015,st:.02,kind:0,drag:2});
      }else{v.y=0;const k=Math.exp(-(o.roll||1.7)*dt);v.x*=k;v.z*=k;
        const sp=Math.hypot(v.x,v.z);if(sp>.03){ax.set(v.z,0,-v.x).normalize();obj.rotateOnWorldAxis(ax,sp*dt/rad);}else{v.x=v.z=0;}}
    }else{obj.rotation.x+=spin.x*dt;obj.rotation.y+=spin.y*dt;obj.rotation.z+=spin.z*dt;}
    if(o.onStep)o.onStep(obj,dt);
    if(o.fuse!=null&&t>=o.fuse){done=true;o.onFuse(obj);return false;}
    return true;});
}
function rocket(from,to,o){
  const g=new T.Group();stage.add(g);g.position.copy(from);
  const body=mesh(new T.CylinderGeometry(o.r||.045,o.r||.045,o.len||.7,8).rotateZ(PI/2),M(o.col||0x4d5a2c),0,0,0,g);
  mesh(new T.ConeGeometry((o.r||.045)*1.9,.28,8).rotateZ(-PI/2),M(o.col||0x4d5a2c),(o.len||.7)/2+.14,0,0,g);
  for(let i=0;i<4;i++){const f=mesh(Box(.16,.005,.12),M(0x2a2a2a),-(o.len||.7)/2+.05,0,0,g);f.rotation.x=i*PI/2;}
  const dirv=to.clone().sub(from).normalize();g.quaternion.setFromUnitVectors(new V(1,0,0),dirv);
  const flame=glow({follow:{position:g.position},fx:-dirv.x*.5,fy:-dirv.y*.5,fz:-dirv.z*.5,s:.6,i:3.5,life:99,c:[1,.7,.35],curve:0,flick:true});
  const dist=from.distanceTo(to);const sp=o.speed||40;let t=0,acc=0;const right=new V().crossVectors(dirv,new V(0,1,0)).normalize();
  task(dt=>{t+=dt;const s=Math.min(dist,sp*t*(o.boost?Math.min(1,.35+t*2.2):1));
    const p=from.clone().addScaledVector(dirv,s);
    if(o.cork){const w=Math.min(1,s/4)*.22;p.addScaledVector(right,Math.sin(t*22)*w);p.y+=Math.cos(t*22)*w;}
    g.position.copy(p);
    const lp=g.userData.lp||from.clone();const seg=p.distanceTo(lp);const nseg=Math.floor(seg/.14);for(let k=1;k<=nseg&&layers.fumaca;k++){const q=lp.clone().lerp(p,k/nseg).addScaledVector(dirv,-.4);puff({x:q.x,y:q.y,z:q.z,vx:rr(-.3,.3),vy:rr(-.1,.3),vz:rr(-.3,.3),s0:(o.trail||.32)*.5,s1:o.trail||.32,sg:.14,gk:6,life:rr(2.4,3.4),h0:.6,hl:.08,drag:2,buoy:.12,c:SMOKE.white,kind:3,wind:.6});}if(nseg>0)g.userData.lp=p.clone();
    if(s>=dist){scene.remove(g);stage.remove(g);flame.life=0;o.onHit(p,dirv);return false;}
    return true;});
  return g;
}
function backblast(p,dir,n){if(!layers.fumaca)return;for(let i=0;i<n;i++){const d=dir.clone().negate();d.x+=rr(-.35,.35);d.y+=rr(-.1,.3);d.z+=rr(-.35,.35);d.normalize();const v=rr(6,14);
  puff({x:p.x,y:p.y,z:p.z,vx:d.x*v,vy:d.y*v,vz:d.z*v,s0:.15,s1:rr(.5,.9),sg:.25,life:rr(2,3.5),h0:i<6?1:0,hl:.12,drag:4,buoy:.25,c:SMOKE.dust,kind:1});}
  glow({x:p.x-dir.x*.6,y:p.y,z:p.z-dir.z*.6,s:.8,s1:1.6,i:3,life:.15,c:[1,.8,.5]});boomLight(p.x-dir.x,p.y,p.z-dir.z,10,8,.18,0xffc070);}

/* ================= perfis dos explosivos ================= */
const HE={smoke:SMOKE.grey,smokeLife:6,heat:1,dust:SMOKE.dust,sparkKind:0,chunkCols:[0x3b3a38,0x2c2b2a,0x4a4642],shake:1};
function prof(o){return Object.assign({},HE,o);}
const PROF={
  granada:prof({lethal:5,injury:15,vis:1.3,fb:16,smokeN:18,dustN:30,sparks:150,sparkSpeed:34,chunks:14,hot:.25,scorch:1.7,crater:.9,dent:.25,light:45,shake:1.1,push:9,smokeLife:5.5}),
  molotov:prof({lethal:0,injury:4,vis:1.1,fb:24,fuel:true,smoke:SMOKE.black,smokeN:3,dustN:0,sparks:0,chunks:0,scorch:2.4,light:22,lightLife:1.2,lightCol:0xff8a3a,shake:.25,push:0,smokeLife:3.5,heat:.95,shock:false,ignite:4.2,hlK:1.5}),
  caseira:prof({lethal:3,injury:10,vis:1,fb:8,smoke:SMOKE.white,smokeKind:3,smokeN:26,dustN:22,sparks:220,sparkKind:1,sparkSpeed:30,sparkW:.03,chunks:8,plate:true,chunkCols:[0x4e5256,0x3a3d40],hot:.2,scorch:1.3,crater:.7,dent:.18,light:30,push:7,smokeLife:6}),
  p13:prof({lethal:5,injury:14,vis:2.2,fb:34,fuel:true,smoke:SMOKE.black,smokeN:10,dustN:26,sparks:70,chunks:8,plate:true,chunkCols:[0x3b5f9a,0x2b4570],hot:.5,scorch:2.6,light:70,lightLife:1.1,lightCol:0xff9a40,shake:1.4,push:8,smokeLife:8,mushroom:{h:7,r:2.6,n:36,stem:16,life:8},residual:[{r:1.4,life:7,rate:20}],ignite:5,hotParts:true,embers:30}),
  dinamite:prof({lethal:4,injury:12,vis:1.4,fb:12,smoke:SMOKE.brown,smokeN:24,dust:SMOKE.brown,dustN:46,sparks:90,chunks:26,chunkCols:[0x6a4a2e,0x7a5a3a,0x4a3626],hot:.15,chunkV:1.2,scorch:2.4,crater:1.8,dent:.7,light:55,shake:1.5,push:10,smokeLife:7}),
  c4:prof({lethal:6,injury:18,vis:1.6,fb:20,heat:1.25,smoke:SMOKE.grey,smokeN:22,dust:SMOKE.concrete,dustN:50,sparks:200,sparkSpeed:42,chunks:32,chunkCols:[0x8a857c,0x6f6a62,0x3b3a38],hot:.3,chunkV:1.4,scorch:3,crater:2.3,dent:.9,light:90,lightLife:.35,lightCol:0xfff0d0,flashI:9,shake:2.2,push:13,smokeLife:7,shockDur:.28}),
  claymore:prof({lethal:15,injury:50,vis:.7,fb:6,smokeN:8,dustN:34,sparks:700,sparkKind:1,sparkSpeed:55,sparkW:.025,chunks:6,scorch:.9,light:28,push:8,smokeLife:4,cone:{a:0,half:PI/6,len:50},dirBias:2}),
  flash:prof({lethal:0,injury:10,vis:.5,fb:0,smoke:SMOKE.white,smokeKind:3,smokeN:10,dustN:0,sparks:60,sparkKind:2,sparkSpeed:12,chunks:0,scorch:.4,light:160,lightLife:.2,lightCol:0xf4f6ff,flashI:14,shake:.4,push:0,smokeLife:5,flash:true,shock:false}),
  m79:prof({lethal:4,injury:12,vis:1.1,fb:14,smokeN:14,dustN:24,sparks:130,chunks:12,hot:.3,scorch:1.5,crater:.8,dent:.22,light:40,push:8,smokeLife:5}),
  m72:prof({lethal:5,injury:15,vis:1.5,fb:22,smokeN:16,dust:SMOKE.concrete,dustN:30,sparks:180,sparkSpeed:40,chunks:24,chunkCols:[0x8a857c,0x6f6a62],hot:.3,scorch:2,light:60,shake:1.5,push:11,smokeLife:6,dirBias:1.4}),
  at4:prof({lethal:5,injury:16,vis:1.7,fb:26,heat:1.15,smokeN:18,dust:SMOKE.concrete,dustN:34,sparks:220,sparkSpeed:46,chunks:30,chunkCols:[0x8a857c,0x6f6a62],hot:.35,scorch:2.2,crater:1.4,dent:.5,light:70,shake:1.7,push:12,smokeLife:6.5,dirBias:1.6}),
  rpg:prof({lethal:5,injury:16,vis:1.8,fb:28,smokeN:18,dust:SMOKE.concrete,dustN:34,sparks:200,sparkSpeed:42,chunks:28,chunkCols:[0x8a857c,0x6f6a62],hot:.4,scorch:2.2,light:70,shake:1.7,push:12,smokeLife:7,dirBias:1.2,embers:20}),
  barril:prof({lethal:4,injury:12,vis:1.9,fb:28,fuel:true,smoke:SMOKE.black,smokeN:8,dustN:22,sparks:60,chunks:10,plate:true,chunkCols:[0x9b1c18,0x5a1210],hot:.6,scorch:2.4,light:60,lightLife:1,lightCol:0xff9040,shake:1.2,push:8,smokeLife:8,mushroom:{h:6,r:2.1,n:30,stem:14,life:8},residual:[{dx:1.6,dz:.4,r:.9,life:6},{dx:-1.1,dz:1.2,r:.7,life:5.5},{dx:-.4,dz:-1.5,r:.8,life:6.5}],ignite:4,hotParts:true,embers:24}),
  carro:prof({lethal:5,injury:14,vis:2.3,fb:36,fuel:true,smoke:SMOKE.black,smokeN:12,dustN:30,sparks:90,chunks:14,plate:true,hot:.5,scorch:3.2,light:80,lightLife:1.2,lightCol:0xff9040,shake:1.8,push:9,smokeLife:9,mushroom:{h:7.5,r:2.8,n:40,stem:16,life:9},ignite:5,hotParts:true,embers:36}),
  bomba:prof({lethal:4,injury:12,vis:1.7,fb:24,fuel:true,smoke:SMOKE.black,smokeN:6,dustN:16,sparks:60,chunks:12,plate:true,chunkCols:[0xd8d2c4,0x1f6a3a,0x8f8a82],hot:.5,scorch:2.4,light:55,lightLife:.9,lightCol:0xff9040,shake:1.2,push:8,smokeLife:7,mushroom:{h:5,r:1.8,n:22,stem:10,life:7},residual:[{r:1.1,life:14,rate:22}],ignite:4,hotParts:true,embers:16}),
  tanque:prof({lethal:12,injury:30,vis:4.5,fb:44,fuel:true,smoke:SMOKE.black,smokeN:20,dustN:46,sparks:160,sparkSpeed:40,chunks:30,chunkCols:[0x8f8a82,0x3b3a38,0x1f6a3a],hot:.5,scorch:6,crater:4,dent:1.6,light:140,lightLife:1.8,lightCol:0xff9040,flashI:8,shake:3,push:14,smokeLife:11,mushroom:{h:16,r:5.5,n:60,stem:26,life:12,rk:.42},residual:[{r:3.2,life:20,rate:26,smoke:1.4},{dx:4,dz:3,r:1.4,life:16},{dx:-4,dz:2,r:1.2,life:15}],ignite:12,hotParts:true,embers:60})
};

/* ================= cenários ================= */
const SC={};
function zRing(n,r0,r1,cx,cz,face){for(let i=0;i<n;i++){const a=rnd()*PI*2,d=Math.sqrt(rr(r0*r0,r1*r1));const x=(cx||0)+Math.cos(a)*d,z=(cz||0)+Math.sin(a)*d;zombie(x,z,face!=null?face:Math.atan2(8-x,14-z)+rr(-.4,.4));}}
const CAM_DEF={pos:[10,6.5,14],tgt:[0,1.6,0]};
SC.granada={g:'Arremesso',name:'Granada M67',cam:CAM_DEF,
  info:'Seca e cinza. Quica no asfalto e rola até parar; o clarão pinta a rua, o chão afunda num buraco de 25 cm, o anel de poeira corre pelo chão e os estilhaços riscam o ar. Zumbis no raio letal perdem partes; no de ferimento são derrubados.',
  seq:[['0,0 s','arremesso com física: quica, perde força e rola'],['2,4 s','clarão #FFF4D6 + luz de 45 por 50 ms'],['+0–300 ms','bola de fogo curta, 16 malhas'],['+20–300 ms','esfera de choque e anel de poeira'],['+0–1,1 s','150 estilhaços e 14 detritos (25% em brasa)'],['+0,3–6 s','fumaça cinza sobe e deriva'],['fica','buraco de 0,9 m com 25 cm de fundo, asfalto quebrado e marca de 1,7 m']],
  colors:[['#FFF4D6','clarão'],['#FF8A2A','fogo'],['#6A655F','fumaça'],['#7D7368','poeira']],
  note:'Pavio real de 4 s; aqui 2,4 s depois do arremesso. Tem um sobrevivente perto do ponto de queda.',
  setup(){zRing(10,1.5,9);zombie(2.6,-1.4,-2.2,{surv:true});survivor(-9,7,PI*.75,'throw');},
  run(){const g=new T.Group();mesh(new T.SphereGeometry(.07,10,8),M(0x4d5a2c),0,0,0,g);mesh(Box(.03,.09,.04),M(0x4d5a2c),.05,.06,0,g);
    const from=new V(-8.6,1.9,6.7);physThrow(g,from,aimVel(from,new V(-4.2,.07,3.4),.8),{rad:.07,fuse:2.4,onFuse:o=>{stage.remove(o);blast(o.position.x,.1,o.position.z,PROF.granada);}});}
};
SC.molotov={g:'Arremesso',name:'Coquetel molotov',cam:CAM_DEF,
  info:'Larga e baixa. O pano aceso deixa rastro no arco, a garrafa estoura em cacos, a gasolina vira uma onda de fogo rente ao chão e a poça queima espalhando até 4 m. Quem está dentro pega fogo.',
  seq:[['0,0 s','arremesso; pano aceso solta chama e fumaça'],['1,0 s','vidro estoura: 30 cacos'],['+0–1,2 s','onda de fogo baixa (combustível, 22 malhas)'],['+0–1,2 s','poça cresce de 0,5 a 4 m'],['+1–8 s','fogo de poça, fumaça preta oleosa'],['+3–5 s','zumbis em chamas caem carbonizados'],['fica','marca larga de 2,4 m']],
  colors:[['#FF7A1E','fogo'],['#2A2420','fumaça'],['#9FC4D8','vidro']],
  note:'Fogo residual é entidade do servidor (área, dano 15/s, espalha em madeira).',
  setup(){zRing(9,.8,6);survivor(-9,7,PI*.75,'throw');},
  run(){const g=new T.Group();mesh(new T.CylinderGeometry(.05,.05,.22,8),new T.MeshStandardMaterial({color:0x2f5a34,transparent:true,opacity:.75,roughness:.1}),0,0,0,g);
    let acc=0;const from=new V(-8.6,1.9,6.7);physThrow(g,from,aimVel(from,new V(.3,.1,.2),1.0),{rad:.05,onStep:(o,dt)=>{acc+=dt;while(acc>.03){acc-=.03;if(layers.fogo)puff({x:o.position.x,y:o.position.y+.1,z:o.position.z,s0:.04,s1:.14,sg:.05,life:.5,h0:1.1,hl:.25,drag:3,buoy:2,c:SMOKE.black});}},
      onImpact:o=>{stage.remove(o);const p=o.position;
        if(layers.estilhaco)for(let i=0;i<30;i++)spark({x:p.x,y:.15,z:p.z,vx:rr(-4,4),vy:rr(1,4),vz:rr(-4,4),life:rr(.5,1),w:.03,st:.02,kind:3});
        blast(p.x,.05,p.z,PROF.molotov);
        fire({x:p.x,y:0,z:p.z,r0:.5,r:4,grow:1.2,life:9,rate:30,smoke:.9});
      }});}
};
SC.flash={g:'Arremesso',name:'Granada de luz',cam:CAM_DEF,
  info:'Sem fogo e sem dano. Um estalo branco de 160 de luz, faíscas azuladas, um pouco de fumaça branca e a tela estourada em branco por 2 s para quem olha de perto. Os zumbis num raio de 10 m ficam atordoados 4 s, e todos num raio de 400 m vêm para cá.',
  seq:[['0,0 s','arremesso: quica e rola'],['2,1 s','estalo: luz de 160 por 200 ms'],['+0–2,5 s','tela branca local que some devagar'],['+0–0,6 s','60 faíscas branco-azuladas'],['+0–5 s','fumaça branca pequena'],['+0–4 s','zumbis atordoados, mãos na cabeça']],
  colors:[['#FFFFFF','estalo'],['#D8D4CC','fumaça'],['#C8D8FF','faíscas']],
  note:'O branco na tela é local de quem olha; os outros jogadores só veem o estalo.',
  setup(){zRing(10,1.5,9);survivor(-9,7,PI*.75,'throw');},
  run(){const g=new T.Group();mesh(new T.CylinderGeometry(.03,.03,.12,8),M(0x4d5a2c),0,0,0,g);
    const from=new V(-8.6,1.9,6.7);physThrow(g,from,aimVel(from,new V(-4,.04,3.3),.8),{rad:.04,fuse:2.1,onFuse:o=>{stage.remove(o);blast(o.position.x,.3,o.position.z,PROF.flash);}});}
};
SC.caseira={g:'Arremesso',name:'Bomba caseira',cam:CAM_DEF,
  info:'Cano de ferro com pólvora e pregos. Pouco fogo, muita fumaça branca de pólvora e uma nuvem de pregos que fura tudo em 10 m. O pavio chia e solta faísca antes.',
  seq:[['0,0 s','arremesso com o pavio chiando; o cano quica e rola'],['2,6 s','estouro: luz de 30'],['+0–200 ms','bola de fogo pequena, 8 malhas'],['+0–1 s','220 pregos (riscos cinza)'],['+0–6 s','fumaça branca densa de pólvora'],['fica','buraco de 0,7 m e marca de 1,3 m']],
  colors:[['#CFCAC0','fumaça de pólvora'],['#8E949A','pregos'],['#FF8A2A','fogo']],
  note:'Feita na bancada: cano, pólvora e pregos.',
  setup(){zRing(9,1.2,7.5);survivor(-9,7,PI*.75,'throw');},
  run(){const g=new T.Group();mesh(new T.CylinderGeometry(.05,.05,.3,8),M(0x3a3c40,{metalness:.6,roughness:.5}),0,0,0,g);mesh(new T.CylinderGeometry(.056,.056,.04,8),M(0x2a2c30),0,.15,0,g);mesh(new T.CylinderGeometry(.008,.008,.08,4),M(0x8a7a5a),0,.2,0,g);
    const tip=new V(),from=new V(-8.6,1.9,6.7);
    physThrow(g,from,aimVel(from,new V(-4.2,.05,3.4),.8),{rad:.055,roll:2.6,fuse:2.6,onStep:o=>{tip.set(0,.24,0).applyMatrix4(o.matrixWorld);if(layers.estilhaco&&rnd()<.7)spark({x:tip.x,y:tip.y,z:tip.z,vx:rr(-1,1),vy:rr(1,2.5),vz:rr(-1,1),life:rr(.2,.4),w:.02,st:.02,kind:0,drag:2});glowOnce(tip.x,tip.y,tip.z,.18,2.4);},
      onFuse:o=>{stage.remove(o);blast(o.position.x,.1,o.position.z,PROF.caseira);}});}
};
function glowOnce(x,y,z,s,i){glow({x,y,z,s,i,life:.05,c:[1,.7,.35],curve:0});}
SC.dinamite={g:'Cargas',name:'Dinamite',cam:CAM_DEF,
  info:'Feixe de 3 bananas com pavio. A explosão é marrom: levanta terra, pedra e poeira, abre cratera com borda e tem fogo curto. Detritos voam mais longe que na granada.',
  seq:[['0,0 s','faísca corre pelo pavio'],['2,2 s','clarão + luz de 55'],['+0–250 ms','bola de fogo curta'],['+0–2,5 s','26 pedras e torrões, 46 puffs de terra rasteira'],['+0,3–7 s','nuvem marrom que assenta'],['fica','buraco de 1,8 m com 70 cm de fundo e borda de terra']],
  colors:[['#7A5C3E','terra'],['#6A4A2E','torrões'],['#FFE3A0','clarão']],
  note:'Pedreira, mineração e fazenda.',
  setup(){zRing(9,1.2,8);const g=new T.Group();stage.add(g);[[-.03,0],[.03,0],[0,.05]].forEach(p=>mesh(new T.CylinderGeometry(.028,.028,.2,8).rotateZ(PI/2),M(0x9e2a1f),0,.03+p[1],p[0],g));SC.dinamite.dev=g;},
  run(){const g=SC.dinamite.dev;let t=0;task(dt=>{t+=dt;const fx=.12+Math.max(0,.6-t*.27);if(layers.estilhaco)for(let i=0;i<2;i++)spark({x:fx,y:.06,z:0,vx:rr(-1.2,1.2),vy:rr(.5,2.4),vz:rr(-1.2,1.2),life:rr(.15,.35),w:.02,st:.02,kind:0,drag:2});glowOnce(fx,.07,0,.16,2.6);if(t>2.2){stage.remove(g);blast(0,.05,0,PROF.dinamite);return false;}return true;});}
};
SC.c4={g:'Cargas',name:'C4 com detonador',cam:{pos:[12,6,12],tgt:[0,1.4,0]},
  info:'Curta, branca e violenta. Três bipes, um clarão branco de 90, bola de fogo quase branca que dura 200 ms, o muro de concreto vira blocos voando, cratera com borda e muita poeira de concreto.',
  seq:[['0,0 s','3 bipes com LED vermelho'],['1,0 s','clarão branco #FFFFFF, luz de 90'],['+0–200 ms','bola de fogo branca e amarela'],['+20–280 ms','choque mais forte da bancada'],['+0–2,5 s','muro em blocos, 32 detritos'],['+0,3–7 s','poeira de concreto'],['fica','buraco de 2,3 m com 90 cm de fundo']],
  colors:[['#FFFFFF','clarão'],['#FFD36B','fogo'],['#8F8A82','concreto']],
  note:'Destruição nível 3: derruba muro, porta de metal e barricada.',
  setup(){const w=concreteWall(0,0,0);SC.c4.wall=w;zRing(8,2,9,0,-5);zRing(4,2,5,0,4);const g=new T.Group();g.position.set(0,.04,.3);stage.add(g);mesh(Box(.28,.06,.11),M(0x6d6a4c),0,0,0,g);SC.c4.led=mesh(Box(.03,.02,.03),new T.MeshBasicMaterial({color:0x330000}),.06,.04,0,g);SC.c4.dev=g;},
  run(){const s=SC.c4;let t=0;task(dt=>{t+=dt;const on=(t%.33)<.12;s.led.material.color.setHex(on?0xff2020:0x330000);if(on)glowOnce(.06,.08,.3,.2,2);if(t>1){stage.remove(s.dev);wallBlast(s.wall,new V(0,.3,.3),new V(0,0,-1),PROF.c4,true);blast(0,.15,.3,PROF.c4);return false;}return true;});}
};
function wallBlast(w,p,dir,E,full){
  w.blocks.forEach(b=>{const q=b.getWorldPosition(new V());const d=q.distanceTo(p);if(d<(full?3.4:2.2)){const v=dir.clone().multiplyScalar(rr(6,13)*(1.6-d/3)).add(new V(rr(-2,2),rr(1,4),rr(-2,2)));
      body(b,{vx:v.x,vy:v.y,vz:v.z,wx:rr(-6,6),wy:rr(-6,6),wz:rr(-6,6),r:.3,bounce:.2,trail:rnd()<.3?'smoke':null});}
    else{b.rotation.z+=rr(-.15,.15);b.position.y-=rr(0,.1);}});
}
SC.claymore={g:'Cargas',name:'Mina Claymore',cam:{pos:[-6,5,13],tgt:[5,1,0]},
  info:'Direcional: 700 esferas de aço num cone de 60° até 50 m. Atrás dela é seguro. Pouco fogo, poeira em leque e tudo dentro do cone é rasgado.',
  seq:[['0,0 s','fio esticado; alguém tropeça'],['0,6 s','estalo, luz de 28'],['+0–1,2 s','700 esferas num cone de 60°'],['+0–3 s','leque de poeira para a frente'],['fica','marca pequena atrás da mina']],
  colors:[['#C8CCD0','esferas'],['#7D7368','poeira'],['#FF8A2A','fogo']],
  note:'Letal 15 m e 50 m no cone. Atrás da caixa, nada.',
  setup(){const g=new T.Group();g.position.set(-3,0,0);g.rotation.y=PI/2;stage.add(g);[-1,0,1].forEach(i=>{const b=mesh(Box(.075,.085,.035),M(0x4d5a2c),i*.07,.16,Math.abs(i)*.012,g);b.rotation.y=-i*.25;});for(const p of[[-.07,.03],[-.07,-.03],[.07,.03],[.07,-.03]])mesh(Box(.006,.12,.006),M(0x777777),p[0],.06,p[1],g);
    const wire=mesh(Box(4,.01,.01),M(0x8a2020),-1,.12,1.5);wire.rotation.y=-.6;
    seed=31;for(let i=0;i<12;i++){const a=rr(-.45,.45),d=rr(2.5,13);zombie(-3+Math.cos(a)*d,Math.sin(a)*d,-PI/2+rr(-.5,.5));}
    for(let i=0;i<4;i++)zombie(-7-rnd()*3,rr(-3,3),PI/2);},
  run(){at(simT+.6,()=>{const E=Object.assign({},PROF.claymore,{dir:new V(1,0,0)});blast(-2.9,.2,0,E);});}
};
SC.p13={g:'Cargas',name:'Botijão de gás P13',cam:CAM_DEF,
  info:'Um tiro abre o vazamento: jato branco que chia e empurra o botijão, o jato pega fogo e vira maçarico, e o botijão estoura numa bola de fogo que sobe em cogumelo. O botijão rasgado sai voando com rastro de fogo.',
  seq:[['0,0 s','tiro: faísca no metal'],['+0–0,8 s','jato de gás branco'],['+0,8–1,4 s','jato pega fogo (maçarico)'],['1,4 s','bola de fogo de combustível, luz de 70'],['+0,2–8 s','cogumelo sobe 7 m'],['+0–2 s','botijão voa com rastro de fogo'],['+0–7 s','fogo residual de 1,4 m']],
  colors:[['#E8ECEF','jato de gás'],['#FF8A2A','fogo'],['#1E1A18','fumaça']],
  note:'Toda cozinha tem um. Explode com tiro ou fogo, e entra em cadeia.',
  setup(){const b=p13(0,0);SC.p13.b=b;zRing(10,1.6,8);},
  run(){const s=SC.p13,g=s.b.g;let t=0;
    if(layers.estilhaco)for(let i=0;i<14;i++)spark({x:.18,y:.3,z:0,vx:rr(1,4),vy:rr(-1,3),vz:rr(-2,2),life:rr(.2,.5),w:.025,st:.02,kind:0});
    task(dt=>{t+=dt;g.rotation.z=Math.sin(t*40)*.03;g.position.x-=dt*.06;
      const lit=t>.8;const n=lit?3:2;
      for(let i=0;i<n;i++){const v=rr(5,8);if(lit){if(layers.fogo)puff({x:g.position.x+.2,y:.32,z:0,vx:v,vy:rr(-.3,.6),vz:rr(-.5,.5),s0:.05,s1:rr(.18,.3),sg:.05,life:rr(.3,.5),h0:1.25,hl:.35,drag:3.5,buoy:1.5,c:SMOKE.black});}
        else if(layers.fumaca)puff({x:g.position.x+.2,y:.32,z:0,vx:v,vy:rr(-.2,.4),vz:rr(-.4,.4),s0:.04,s1:rr(.15,.25),sg:.15,life:rr(.6,1),drag:3.2,buoy:.2,c:SMOKE.gas,kind:3});}
      if(lit)glowOnce(g.position.x+.6,.32,0,.7,1.6);
      if(t>1.4){const q=g.position.clone();blast(q.x,.3,q.z,PROF.p13);body(g,{vx:rr(-2,2),vy:13,vz:rr(-2,2),wx:rr(-9,9),wy:rr(-5,5),wz:rr(-9,9),r:.2,bounce:.2,trail:'fire',trailDur:1.8});return false;}
      return true;});}
};
SC.m79={g:'Lançadores',name:'Lança-granadas M79',cam:{pos:[4,6,16],tgt:[-3,1.4,0]},
  info:'Granada de 40 mm em arco tenso, com rastro fino. Na chegada parece uma granada de mão menor, com um pouco mais de fogo.',
  seq:[['0,0 s','disparo: clarão pequeno no cano'],['+0–0,9 s','voo em arco com rastro fino'],['0,9 s','impacto: luz de 40'],['+0–300 ms','bola de fogo de 14 malhas'],['+0–1 s','130 estilhaços'],['fica','marca de 1,5 m']],
  colors:[['#FF8A2A','fogo'],['#6A655F','fumaça'],['#D6D2CA','rastro']],
  note:'Velocidade real 76 m/s; aqui 24 m/s para ver o arco.',
  setup(){zRing(10,1.2,8);survivor(-15,6,PI*.62);},
  run(){const from=new V(-14.4,1.4,5.6);glow({x:from.x,y:from.y,z:from.z,s:.6,i:4,life:.08,c:[1,.75,.4]});boomLight(from.x,from.y,from.z,8,6,.12);if(layers.fumaca)for(let i=0;i<6;i++)puff({x:from.x,y:from.y,z:from.z,vx:rr(0,2),vy:rr(0,1),vz:rr(-1,0),s0:.08,s1:.3,sg:.15,life:2,drag:3,buoy:.3,c:SMOKE.white,kind:3});
    const g=new T.Group();mesh(new T.SphereGeometry(.035,8,6),M(0x8a8a50),0,0,0,g);let acc=0;
    throwArc(g,from,new V(0,.05,0),.75,{h:1.4,spin:0,onStep:(o,dt)=>{acc+=dt;while(acc>.004){acc-=.004;if(layers.fumaca)puff({x:o.position.x,y:o.position.y,z:o.position.z,s0:.06,s1:.14,sg:.06,life:1.6,drag:2,buoy:.1,c:SMOKE.white,kind:3});}},onLand:o=>{stage.remove(o);blast(o.position.x,.1,o.position.z,PROF.m79);}});}
};
function launcherScene(key,o){
  SC[key]={g:'Lançadores',name:o.name,cam:{pos:[-8,8,22],tgt:[-8,1.5,2]},info:o.info,seq:o.seq,colors:o.colors,note:o.note,
    setup(){const from=new V(-20,1.5,7),to=new V(0,1.2,0);const ry=Math.atan2(-(to.x-from.x),-(to.z-from.z));const w=concreteWall(0,0,ry+PI/2);SC[key].wall=w;SC[key].from=from;SC[key].to=to;
      survivor(-20.3,7.2,Math.atan2(to.x-from.x,to.z-from.z));seed=41;for(let i=0;i<9;i++){const d=rr(1.5,8),a=rr(-.9,.9)+Math.atan2(to.z-from.z,to.x-from.x);zombie(Math.cos(a)*d,Math.sin(a)*d,rr(0,6));}},
    run(){const s=SC[key];const dir=s.to.clone().sub(s.from).normalize();backblast(s.from,dir,o.bb);
      rocket(s.from.clone().addScaledVector(dir,.6),s.to,Object.assign({onHit:(p,d)=>{wallBlast(s.wall,p,d,PROF[key],false);const E=Object.assign({},PROF[key],{dir:d});blast(p.x,p.y,p.z,E);
        if(layers.estilhaco)for(let i=0;i<60;i++){const v=d.clone();v.x+=rr(-.25,.25);v.y+=rr(-.15,.2);v.z+=rr(-.25,.25);v.normalize().multiplyScalar(rr(30,60));spark({x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z,life:rr(.2,.5),w:.05,st:.02,kind:0,drag:.4});}}},o.rocket));}};
}
launcherScene('m72',{name:'Bazuca M72 LAW',bb:22,rocket:{speed:38,r:.033,len:.5,trail:.26,col:0x4d5a2c},
  info:'Tubo descartável. Sopro para trás que levanta poeira por 5 m, foguete com rastro fino e reto, carga oca: o jato atravessa o muro e a bola de fogo sai para a frente.',
  seq:[['0,0 s','sopro traseiro: poeira e clarão atrás'],['+0–0,5 s','foguete com rastro branco fino'],['0,5 s','impacto: luz de 60, muro abre'],['+0–200 ms','jato de faíscas atravessa o muro'],['+0–6 s','fumaça e poeira de concreto'],['fica','blocos caídos e marca de 2 m']],
  colors:[['#D8D4CC','rastro'],['#FF8A2A','fogo'],['#8F8A82','concreto']],note:'Velocidade real 145 m/s; aqui 38 m/s. Sopro fere quem está a 5 m atrás.'});
launcherScene('at4',{name:'AT4',bb:30,rocket:{speed:42,r:.045,len:.62,trail:.38,col:0x4d5a2c},
  info:'O mais forte dos descartáveis: rastro mais grosso, impacto maior, cratera pequena e mais detritos em brasa. Atravessa veículo blindado.',
  seq:[['0,0 s','sopro traseiro forte'],['+0–0,5 s','rastro grosso e reto'],['0,5 s','impacto: luz de 70'],['+0–200 ms','jato perfurante à frente'],['+0–2,5 s','30 detritos, 35% em brasa'],['fica','cratera de 1,4 m']],
  colors:[['#D8D4CC','rastro'],['#FFD36B','núcleo'],['#8F8A82','concreto']],note:'Velocidade real 285 m/s; aqui 42 m/s.'});
launcherScene('rpg',{name:'RPG-7',bb:18,rocket:{speed:36,r:.05,len:.7,trail:.34,col:0x55603a,cork:true,boost:true},
  info:'O foguete sai devagar, acende o motor depois de 2 m e voa em parafuso, deixando o rastro torto que todo mundo reconhece. Bola de fogo grande e brasas que caem.',
  seq:[['0,0 s','expulsão: estalo e fumaça curta'],['+0,1 s','motor acende, acelera'],['+0–0,6 s','rastro em espiral'],['0,6 s','impacto: luz de 70'],['+0–2,6 s','brasas caindo'],['fica','marca de 2,2 m']],
  colors:[['#D8D4CC','rastro'],['#FF8A2A','fogo'],['#6A655F','fumaça']],note:'Reutilizável; recarga 4,5 s. Velocidade aqui 36 m/s.'});
SC.barril={g:'Cenário',name:'Barril de combustível',cam:CAM_DEF,
  info:'O que a revisão da Oficina pediu: tiro abre um furo que vaza e pega fogo, o barril explode em cogumelo, a tampa voa alto com rastro, três poças queimam e a coluna preta sobe.',
  seq:[['0,0 s','tiro: faíscas e vazamento'],['+0,3–1,2 s','vazamento pega fogo'],['1,2 s','explosão de combustível, luz de 60'],['+0,2–8 s','cogumelo de 6 m'],['+0–2 s','tampa voa com rastro de fogo'],['+0–6,5 s','3 poças queimando'],['fica','marca de 2,4 m e barril aberto']],
  colors:[['#FF7A1E','fogo'],['#1E1A18','fumaça'],['#9B1C18','barril']],
  note:'Substitui o barril da Oficina (5 bolas e 24 detritos).',
  setup(){SC.barril.b=barrel(0,0);zRing(10,1.4,8);},
  run(){const b=SC.barril.b;let t=0;if(layers.estilhaco)for(let i=0;i<12;i++)spark({x:.3,y:.5,z:0,vx:rr(1,4),vy:rr(-1,3),vz:rr(-2,2),life:rr(.2,.4),w:.025,st:.02,kind:0});
    task(dt=>{t+=dt;if(t>.3&&layers.fogo){puff({x:.32,y:.45,z:rr(-.05,.05),vx:rr(.4,1),vy:rr(.2,.8),vz:rr(-.3,.3),s0:.05,s1:rr(.15,.28),sg:0,life:rr(.4,.7),h0:1.2,hl:.4,drag:2,buoy:2.4,c:SMOKE.black});}
      if(t>1.2){blast(0,.5,0,PROF.barril);body(b.lid,{vx:rr(-1,1),vy:16,vz:rr(-1,1),wx:rr(-10,10),wz:rr(-10,10),r:.03,bounce:.3,trail:'fire',trailDur:1.6});b.g.children.forEach(c=>{if(c.material&&c!==b.lid)c.material=charMat;});b.g.scale.set(1.1,.85,1.1);return false;}return true;});}
};
SC.carro={g:'Cenário',name:'Carro explodindo',cam:{pos:[11,6,12],tgt:[0,1.2,0]},
  info:'Motor pega fogo e solta fumaça preta, o fogo chega ao tanque, o carro pula e cai torto, capô, portas, porta-malas e uma roda voam em brasa, os vidros estouram e a carcaça fica queimando.',
  seq:[['0,0 s','motor em chamas, fumaça preta'],['3,0 s','tanque explode, luz de 80'],['+0–150 ms','carro pula 1,5 m'],['+0–2 s','capô, 2 portas, porta-malas e roda voam'],['+0,2–9 s','cogumelo de 7,5 m'],['fica','carcaça queimando 2 fogos']],
  colors:[['#FF7A1E','fogo'],['#1E1A18','fumaça'],['#1B1714','carcaça']],
  note:'No jogo o tempo entre incêndio e explosão é de 3 a 8 s.',
  setup(){SC.carro.c=car(0,0,.2,0x7a2b22);zRing(10,2.5,9);},
  run(){const c=SC.carro.c,g=c.g;const eng=new V(1.4,1,0).applyMatrix4(g.matrixWorld);
    const f1=fire({x:eng.x,y:.9,z:eng.z,r:.35,life:3.2,rate:28,smoke:2.2});
    at(simT+3,()=>{const q=new V(-.6,.6,0).applyMatrix4(g.matrixWorld);
      blast(q.x,.6,q.z,PROF.carro);
      const P=c.parts;const fly=(m,vx,vy,vz)=>{const d=m.getWorldPosition(new V()).sub(q).setY(0).normalize();body(m,{vx:d.x*vx+rr(-1,1),vy,vz:d.z*vx+rr(-1,1),wx:rr(-8,8),wy:rr(-8,8),wz:rr(-8,8),r:.06,bounce:.25,trail:'fire',trailDur:1.4});};
      fly(P.hood,5,11,0);fly(P.doorL,7,6,0);fly(P.doorR,7,6,0);fly(P.trunk,4,10,0);fly(P.wheels[0],8,7,0);
      P.glass.visible=false;if(layers.estilhaco)for(let i=0;i<40;i++)spark({x:q.x+rr(-1,1),y:1.2,z:q.z+rr(-.7,.7),vx:rr(-5,5),vy:rr(1,5),vz:rr(-5,5),life:rr(.6,1.2),w:.03,st:.02,kind:3});
      P.paint.color.setHex(0x1b1714);P.paint.metalness=.1;P.paint.roughness=1;
      let vy=5.5,wz=rr(-1,1);task(dt=>{vy-=9.8*dt;g.position.y=Math.max(0,g.position.y+vy*dt);g.rotation.z+=wz*dt*.6;g.rotation.x+=dt*.25;if(g.position.y<=0&&vy<0){g.rotation.z=clamp(g.rotation.z,-.12,.12);g.rotation.x=.08;return false;}return true;});
      fire({follow:g,fy:1.1,fx:0,r:1.1,life:30,rate:24,smoke:1.4});fire({x:q.x+1.6,y:0,z:q.z+.3,r:.6,life:20,rate:18});
    });}
};
SC.posto={g:'Cenário',name:'Posto em cadeia',cam:{pos:[22,11,22],tgt:[0,3,0]},
  info:'Um tiro na bomba 1. O jato vira maçarico, a bomba explode e pega a vizinha, o carro no abastecimento explode, a terceira bomba vai, e 2 s depois o tanque subterrâneo sobe num cogumelo de 16 m que derruba a cobertura e estoura os vidros da loja.',
  seq:[['0,0 s','tiro na bomba 1: vazamento'],['+0,4–1 s','maçarico de gasolina'],['1,0 s','bomba 1 explode'],['1,4 s','bomba 2 (cadeia 0,4 s)'],['1,9 s','carro no abastecimento'],['2,3 s','bomba 3'],['4,3 s','tanque subterrâneo: letal 12 m, ferimento 30 m'],['+0–1,5 s','cobertura desaba'],['fica','incêndio, coluna preta de 10 min']],
  colors:[['#FF7A1E','fogo'],['#151210','coluna'],['#1F6A3A','posto']],
  note:'Cada explosão da cadeia é um evento de rede próprio, abaixo de 400 partículas.',
  setup(){const p=posto();SC.posto.p=p;SC.posto.c=car(3.4,2.6,0,0x2d3d4a);seed=51;for(let i=0;i<22;i++){const a=rnd()*PI*2,d=rr(4,16);zombie(Math.cos(a)*d,Math.sin(a)*d+3,rr(0,6));}},
  run(){const s=SC.posto,p=s.p;const pumpPos=i=>p.pumps[i].getWorldPosition(new V());
    const a=pumpPos(0);if(layers.estilhaco)for(let i=0;i<14;i++)spark({x:a.x+.4,y:1.2,z:a.z+.3,vx:rr(1,4),vy:rr(-1,3),vz:rr(-2,2),life:rr(.2,.5),w:.025,st:.02,kind:0});
    let t=0;task(dt=>{t+=dt;if(t>.4&&layers.fogo)for(let i=0;i<2;i++)puff({x:a.x+.4,y:1,z:a.z+.3,vx:rr(4,7),vy:rr(-.2,.6),vz:rr(.5,2),s0:.05,s1:rr(.2,.32),sg:.04,life:rr(.3,.5),h0:1.25,hl:.35,drag:3.5,buoy:1.5,c:SMOKE.black});return t<1;});
    const pumpBoom=i=>{const q=pumpPos(i);blast(q.x,1,q.z,PROF.bomba);body(p.pumps[i],{vx:rr(-2,2),vy:rr(6,9),vz:rr(-2,2),wx:rr(-4,4),wz:rr(-4,4),r:.4,bounce:.15,trail:'fire',trailDur:1.5});};
    at(simT+1,()=>pumpBoom(0));at(simT+1.4,()=>pumpBoom(1));
    at(simT+1.9,()=>{const c=s.c,q=c.g.position.clone();blast(q.x,.6,q.z,Object.assign({},PROF.carro,{mushroom:{h:6,r:2.2,n:24,stem:10,life:8}}));c.parts.paint.color.setHex(0x1b1714);c.parts.glass.visible=false;
      body(c.parts.hood,{vx:rr(-2,2),vy:10,vz:rr(1,4),wx:rr(-8,8),wz:rr(-8,8),r:.06,trail:'fire'});body(c.parts.doorL,{vx:rr(-2,2),vy:6,vz:6,wx:rr(-8,8),wz:rr(-8,8),r:.06,trail:'fire'});
      let vy=5;task(dt=>{vy-=9.8*dt;c.g.position.y=Math.max(0,c.g.position.y+vy*dt);c.g.rotation.x+=dt*.4;if(c.g.position.y<=0&&vy<0){c.g.rotation.x=.1;return false;}return true;});fire({follow:c.g,fy:1,r:1,life:30,rate:22});});
    at(simT+2.3,()=>pumpBoom(2));
    at(simT+4.3,()=>{blast(-7,.4,-1,PROF.tanque);
      p.pillars.forEach((pl,i)=>{const d=pl.getWorldPosition(new V()).sub(new V(-7,0,-1)).setY(0).normalize();body(pl,{vx:d.x*rr(3,6),vy:rr(2,5),vz:d.z*rr(3,6),wx:rr(-3,3),wz:rr(-3,3),r:.2,bounce:.1});});
      [p.roof,p.band].forEach((m,i)=>body(m,{vx:2.2,vy:6.5,vz:1.4,wx:.1,wz:-.55-i*.02,r:.3,bounce:.08,trail:'smoke'}));
      p.shop.forEach(w=>{w.material=winHole;if(layers.estilhaco){const q=w.getWorldPosition(new V());for(let i=0;i<20;i++)spark({x:q.x+rr(-.8,.8),y:q.y+rr(-.7,.7),z:q.z+.1,vx:rr(-2,2),vy:rr(-1,2),vz:rr(-6,-1),life:rr(.6,1.2),w:.03,st:.02,kind:3});}});
    });}
};
SC.horda={g:'Cenário',name:'Granada na horda',cam:{pos:[13,9,15],tgt:[0,1,0]},
  info:'Cenário de estresse 2 da Oficina: granada no meio de 40 zumbis e 2 sobreviventes. Um evento agregado, 12 ragdolls para os mais próximos e queda animada para o resto. Veja o contador no canto do visor.',
  seq:[['0,0 s','arremesso: quica e rola para o meio da horda'],['2,5 s','explosão de granada'],['+0 ms','servidor manda 1 evento com 40 atingidos'],['+0–3 s','12 ragdolls + quedas animadas'],['fica','sangue e marca']],
  colors:[['#FF8A2A','fogo'],['#5A0B0B','sangue'],['#6A655F','fumaça']],
  note:'Aceite: sem queda abaixo de 30 FPS com 2.000 zumbis na tela.',
  setup(){seed=61;zRing(40,.9,9);zombie(1.8,1.2,2.4,{surv:true});zombie(-2.2,-2.6,.6,{surv:true});survivor(-11,8,PI*.75,'throw');},
  run(){const g=new T.Group();mesh(new T.SphereGeometry(.07,10,8),M(0x4d5a2c),0,0,0,g);const from=new V(-10.6,1.9,7.7);physThrow(g,from,aimVel(from,new V(-4.8,.07,3.9),.9),{rad:.07,fuse:2.5,onFuse:o=>{stage.remove(o);blast(o.position.x,.1,o.position.z,PROF.granada);}});}
};
const ORDER=['granada','molotov','flash','caseira','dinamite','c4','claymore','p13','m79','m72','at4','rpg','barril','carro','posto','horda'];

/* ================= reset e seleção ================= */
function clearAll(){
  P.length=0;S.length=0;GL.length=0;CH.length=0;BODIES.length=0;FIRES.length=0;RINGS.length=0;BLOOD.length=0;TASKS=[];EVENTS=[];
  SHOCKS.forEach(s=>{scene.remove(s.sm);scene.remove(s.rm);});SHOCKS.length=0;
  XL.forEach(L=>{L.t=9;L.l.intensity=0;});
  scene.remove(stage);stage.traverse(o=>{if(o.geometry&&o.geometry!==decalGeo&&o.geometry!==bloodGeo&&o.geometry!==rockGeo&&o.geometry!==plateGeo)o.geometry.dispose();});resetGround();
  stage=new T.Group();scene.add(stage);ZS=[];RAG=0;FALLEN=0;
  WINDOWS.forEach(w=>{w.broken=false;w.m.material=w.base;});
  shakeAmp=0;flashV=0;blastT=null;evMark=null;simT=0;
}
let distMode='perto';
function applyCam(s){const c=s.cam||CAM_DEF;const tgt=new V(...c.tgt),pos=new V(...c.pos);
  const dir=pos.clone().sub(tgt).normalize();const base=pos.distanceTo(tgt);
  const d=distMode==='perto'?base:distMode==='medio'?30:70;
  camera.position.copy(tgt).addScaledVector(dir,d);controls.target.copy(tgt);controls.update();}
function select(key,detonate){
  activeKey=key;const s=SC[key];seed=1000+ORDER.indexOf(key)*97;
  clearAll();s.setup();applyCam(s);renderFicha(key);$('hName').textContent=s.name;
  document.querySelectorAll('#paiol button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===key?'true':'false'));
  runAt=detonate===false?null:.5;
}
let runAt=null;
function rerun(){select(activeKey,true);}

/* ================= UI ================= */
const paiol=$('paiol');
{const groups={};ORDER.forEach(k=>{const g=SC[k].g;(groups[g]=groups[g]||[]).push(k);});
  Object.keys(groups).forEach(g=>{const d=document.createElement('div');d.className='grp';d.innerHTML='<h4>'+g+'</h4><div></div>';
    groups[g].forEach(k=>{const b=document.createElement('button');b.type='button';b.id='x-'+k;b.dataset.k=k;b.textContent=SC[k].name;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>select(k,true));d.lastChild.appendChild(b);});
    paiol.appendChild(d);});}
function profOf(k){return k==='barril'?PROF.barril:k==='carro'?PROF.carro:k==='posto'?PROF.tanque:k==='horda'?PROF.granada:PROF[k];}
function fmt(n){return String(n).replace('.',',');}
function renderFicha(k){
  const s=SC[k],E=profOf(k);
  const est=Math.round(E.fb+(E.smokeN||0)+(E.dustN||0)+(E.sparks||0)+(E.mushroom?(E.mushroom.n+E.mushroom.stem):0)+(E.embers||0));
  const lethal=k==='claymore'?'15 m (cone)':k==='molotov'?'área 4 m':k==='flash'?'—':E.lethal+' m';
  const inj=k==='claymore'?'50 m (cone)':k==='molotov'?'fogo 15/s':k==='flash'?'atordoa 10 m':E.injury+' m';
  const nivel={granada:'2',molotov:'fogo',flash:'—',caseira:'2',dinamite:'3',c4:'3',claymore:'1',p13:'2 + fogo',m79:'2',m72:'3',at4:'3',rpg:'3',barril:'2 + fogo',carro:'2 + fogo',posto:'3 + fogo',horda:'2'}[k];
  $('ficha').innerHTML=`<span class="k">${s.g} · ficha de explosão</span><h3>${s.name}</h3><p>${s.info}</p>
  <div class="nums"><div><small>Letal</small><b>${lethal}</b></div><div><small>Ferimento</small><b>${inj}</b></div><div><small>Destruição</small><b>${nivel}</b></div><div><small>Buraco no chão</small><b>${E.crater&&E.dent&&!['m72','at4','rpg'].includes(k)?fmt(E.crater)+' m · '+Math.round(E.dent*100)+' cm':'—'}</b></div></div>
  <ol class="seq">${s.seq.map(r=>`<li><span>${r[0]}</span>${r[1]}</li>`).join('')}</ol>
  <div class="sw">${s.colors.map(c=>`<span><i style="background:${c[0]}"></i>${c[1]} ${c[0]}</span>`).join('')}</div>
  <div class="meter">
    <div class="mrow"><span>Partículas GPU</span><span class="bar"><i id="mP" style="width:${Math.min(100,est/4)}%"${est>400?' class="over"':''}></i></span><b id="mPv">${est} / 400</b></div>
    <div class="mrow"><span>Detritos com física</span><span class="bar"><i style="width:${Math.min(100,(E.chunks||0)/40*100)}%"></i></span><b>${E.chunks||0} / 40</b></div>
    <div class="mrow"><span>Luzes</span><span class="bar"><i style="width:${(E.residual||k==='molotov'||k==='carro'||k==='posto'?2:1)/6*100}%"></i></span><b>${E.residual||k==='molotov'||k==='carro'||k==='posto'?'1 + 2 fogo':'1'} / 4+2</b></div>
  </div>
  <p class="net"><b>Rede:</b> ${k==='posto'?'6 eventos de 16 bytes com atraso de cadeia; fogo e coluna como entidades do servidor.':E.residual||k==='molotov'||k==='carro'?'1 evento de 16 bytes + entidade de fogo do servidor.':k==='horda'?'1 evento agregado com a lista de 40 atingidos.':'1 evento de 16 bytes; visual local pela semente.'} ${s.note}</p>`;
}
// linha do tempo das camadas
const PH=[['Clarão',0,.05,'#fff4d6'],['Bola de fogo',0,.35,'#ff8a2a'],['Choque',.02,.3,'#d8c8a8'],['Estilhaços',0,1.2,'#ffd36b'],['Detritos',.05,2.5,'#a59c8c'],['Fumaça',.3,8,'#6a655f'],['Fogo residual',1,8,'#c2361a']];
const strip=$('strip');const tx=t=>Math.sqrt(Math.min(t,8)/8)*100;
{let h='';PH.forEach((p,i)=>{const row=i%2;h+=`<div class="seg" style="left:${tx(p[1])}%;width:${Math.max(.8,tx(p[2])-tx(p[1]))}%;top:${6+row*13}px;background:${p[3]}"></div><div class="lab" style="left:calc(${tx(p[1])}% + 4px);top:17px;display:${[1,5,6].includes(i)?'block':'none'}">${p[0]}</div>`;});
  [0,.05,.3,1,2,4,8].forEach(t=>{h+=`<span class="tick" style="left:${Math.max(3,Math.min(97,tx(t)))}%">${t<1?Math.round(t*1000)+' ms':t+' s'}</span>`;});
  h+='<div class="head" id="head" style="left:0"></div>';strip.innerHTML=h;}
const head=$('head');
$('bGo').addEventListener('click',rerun);
let slow=false;$('bSlow').addEventListener('click',e=>{slow=!slow;e.currentTarget.setAttribute('aria-pressed',slow?'true':'false');});
document.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{distMode=b.dataset.d;document.querySelectorAll('[data-d]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));applyCam(SC[activeKey]);rerun();}));

/* ================= auditoria ================= */
const AUD=[
 ['Bestiário','Olhos com halo, pústulas e brasas do Carbonizado como malha parada. Cena do Inchado mostra só o raio da nuvem.','Estouro do Inchado (nuvem de bile #8A9A2A com puffs opacos, aviso de 0,5 s inchando), brasas soltando faísca no Carbonizado, grito do Gritador com 3 anéis, pó do Decrépito ao levar tiro, poeira na Pirâmide quando a base explode.','a','Categorias de zumbis'],
 ['Galeria do Arsenal','Clarão do tiro (cone + esfera), 3 bolas de fumaça por tiro, cápsulas com física. Granada: 8 esferas de fumaça e um disco preto.','Aba Explosivos sem detonar: cada um dos 12 precisa de botão Detonar com a camada da ficha. Granada do desmembramento troca pela receita da granada daqui. Clarão por arma (freio de boca da Barrett levanta poeira), fumaça do cano depois de rajada.','a','Armas, dano e modificações'],
 ['Garagem','Fumaça do radiador e do motor em 7 esferas que sobem em loop; brilho da bateria.','Explosão do carro (aqui, item Carro explodindo), faísca de raspagem quando bate, cacos ao estourar vidro, vazamento de gasolina que pega fogo, fumaça do escapamento por condição (100/60/30/10).','a','Veículos'],
 ['Galeria do Vale','Fogo em cones parados nas cenas (ônibus, pátio do presídio), cilindros e bombas que "explodem com tiro" só como alfinete.','Cones de fogo viram o fogo residual daqui (puffs que viram fumaça + coluna). Posto com a cadeia daqui. Cilindros de oxigênio com o foguete rente ao chão. Poeira e cinzas no ar na área queimada.','m','Design do mapa e ambientes'],
 ['Cena de teste (rua 14)','Explosão do barril com 5 esferas, 24 detritos e uma mancha; tambor de fogo com 5 cones.','Trocar pelo Barril de combustível daqui (já é o pedido da revisão da Oficina). Tambor de fogo com puffs e faíscas de brasa. Clarão do tiro com luz que ilumina a fumaça.','a','Plano do jogo de zumbi'],
 ['Elenco e Retratos do Vale','Chuva e neblina; fogueira do acampamento dos Corvos parada.','Fogueira com o fogo residual pequeno (r 0,4 m, 1 luz), fumaça subindo da serra, respiração no frio. Itens de baixa prioridade: são páginas de personagem.','b','Personagens e atributos · Sobreviventes'],
 ['Oficina de VFX','Catálogo de 38 efeitos e orçamento.','Granada, molotov, barril e explosão do carro passam a apontar para este laboratório. Nada mais muda: catálogo e orçamento continuam lá.','m','Efeitos de partículas']
];
$('audit').innerHTML=AUD.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td><span class="st ${r[3]}">${r[3]==='a'?'alta':r[3]==='m'?'média':'baixa'}</span></td><td>${r[4]}</td></tr>`).join('');

/* ================= laço ================= */
let last=performance.now(),vis=true;
new IntersectionObserver(e=>{vis=e[0].isIntersecting;},{threshold:.01}).observe(stageEl);
const flashEl=$('flash');
const basePos=new V();
function phaseName(t){if(t<0)return 'Pronto';if(t<.05)return 'Clarão';if(t<.35)return 'Bola de fogo e choque';if(t<1.2)return 'Estilhaços e detritos';if(t<2.5)return 'Detritos pousando';if(t<8)return 'Fumaça';return 'Depois: fogo e marcas';}
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(.05,(now-last)/1000);last=now;
  if(!vis)return;
  const ts=slow?.25:1;const sdt=dt*ts;
  clock+=sdt;simT+=sdt;U.uTime.value=clock;
  if(runAt!=null){runAt-=dt;if(runAt<=0){runAt=null;SC[activeKey].run();}}
  for(let i=EVENTS.length-1;i>=0;i--){if(EVENTS[i].t<=simT){const e=EVENTS[i];EVENTS.splice(i,1);e.fn();}}
  TASKS=TASKS.filter(f=>f(sdt));
  updateRings(sdt);updatePuffs(sdt);updateSparks(sdt);updateGlows(sdt);updateShocks(sdt);updateChunks(sdt);updateBodies(sdt);updateFires(sdt);updateBlood(sdt);updateZombies(sdt);updateLights(sdt);
  controls.update();
  // tremor de câmera
  if(shakeAmp>.001&&!reduce){basePos.copy(camera.position);const a=shakeAmp*.18;camera.position.x+=Math.sin(clock*71)*a;camera.position.y+=Math.sin(clock*53+1)*a*.7;camera.position.z+=Math.sin(clock*67+2)*a;shakeAmp*=Math.exp(-5*sdt);renderer.render(scene,camera);camera.position.copy(basePos);}
  else renderer.render(scene,camera);
  flashV*=Math.exp(-flashDecay*sdt);flashEl.style.opacity=flashV.toFixed(3);
  // HUD
  const bt=evMark?simT-evMark.t:-1;
  $('hTime').textContent=bt>=0?'t = +'+bt.toFixed(3).replace('.',',')+' s':'t = 0,000 s';
  $('hPhase').textContent=evMark?phaseName(bt):(runAt!=null||TASKS.length?'Armando…':'Pronto');
  head.style.left=(bt>=0?tx(bt):0)+'%';
  $('sP').textContent=P.length;$('sS').textContent=S.length;$('sC').textContent=CH.length+BODIES.filter(b=>!b.rest).length;$('sL').textContent=XL.filter(L=>L.l.intensity>.05).length+'+'+FL.filter(l=>l.intensity>.05).length;
  $('sR').textContent=Math.min(12,RAG)+(FALLEN?' · quedas '+FALLEN:'');$('sLod').textContent=Math.round(lodNow*100)+'%';
}
select('granada',true);
requestAnimationFrame(frame);
window.__lab={select,SC,P,S,camera,controls,get simT(){return simT;}};
})();

