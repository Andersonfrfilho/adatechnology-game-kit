// fonte: site/pages/efeitos/padrao-fluidos.html
// texto visível: Padrão de Fluidos ZombiAdA ZombiAdA · revisão de fluidos · referência Padrão de fluidos Esta é a régua para sangue, bile, óleo e gasolina em todas as páginas. O líquido aqui é simulado como uma película com espessura: bate e espirra com forma de impacto, escorre em fio com gota na ponta, segue rejunte e declive, desce o meio-fio, brilha enquanto está molhado e seca pela borda . Nenhuma mancha é um disco. Clique na cena para atirar uma gota grande do ângulo da câmera. — fps sim — ms 0 células molhadas Arraste para girar · roda para zoom · clique para atirar uma gota Fluido Cena Tempo de secagem No jogo 00:00 Estado — O movimento é sempre em tempo real. Só a secagem é acelerada. Ver Repetir cena Limpar Espessura Critérios de aceite Cada fluido de cada página tem que passar nos doze. Os códigos F1 a F12 são os que aparecem no placar e nas correções enviadas aos times. F1 · forma Nunca um disco Borda recortada, espetos, gotas satélite, fios. Nenhum círculo ou elipse perfeitos e nenhuma mancha repetida: cada uma nasce de uma semente. F2 · direção O impacto mostra de onde veio Comprimento ÷ largura = 1 ÷ seno do ângulo. Espetos e satélites ficam do lado para onde a gota ia. Gota vertical vira coroa com borda serrilhada. F3 · volume Espessura de verdade Centro grosso e escuro, borda fina mais clara e translúcida. A espessura gera a normal, então a borda tem menisco que pega luz. F4 · escorrer Fio com gota na ponta Desce pela gravidade, afina, carrega um bulbo na frente e para quando o volume acaba. Passa da parede para o chão, segue rejunte e declive, desce o meio-fio e corre na sarjeta. F5 · espalhar Frente de fluxo, não escala A poça avança em lóbulos e dedos, rápido no começo e devagar depois. Proibido escalar a malha inteira ou pulsar com seno. F6 · pingar Gota cresce, solta e espirra A gota incha na borda, se solta, cai esticada e, ao bater, faz coroa com satélites. As batidas se somam numa poça. F7 · brilho Molhado reflete a cena Reflexo especular nítido do poste e da lanterna, fresnel forte em ângulo raso. O brilho vai embora junto com a secagem. F8 · secar Seca pela borda As partes finas secam primeiro, sem trocar de material de uma vez. Seco é fosco, mais escuro, com borda mais escura (anel) e rachaduras onde era grosso. Para de mexer. F9 · identidade Cada fluido é um material Sangue fresco vivo e antigo bordô. Bile grossa, com bolhas que estouram, vira crosta oliva rachada. Óleo preto espelhado com arco-íris de película fina na borda, nunca seca. Gasolina quase transparente, escurece o chão, tremula e evapora pela borda sem marca. F10 · superfície Gruda na geometria Segue parede, chão, meio-fio, corpo e lataria. Nada flutua, nada pisca por z-fighting. Asfalto rugoso deixa a borda mais irregular que o piso liso. F11 · luz e cor Iluminado e na paleta Nada de material sem luz. Cores da regra: fresco #8A0A0A, seco #3B1D14, bile #8A9A2A para #3E4220. F12 · custo Barato e igual na LAN Sem objeto ou material novo por gota. Formas saem da semente do e

// ===== script 2 (32 KB)

(function(){
'use strict';
const $=id=>document.getElementById(id);
const V3=THREE.Vector3;

// ---------- grid: one strip folded over wall, sidewalk, curb face and road ----------
const CS=0.0125, W=256, RW=144, RS=128, RC=12, RR=112, H=RW+RS+RC+RR, N=W*H;
const X0=-1.6, TOP=1.95, SWY=0.15, ZC=1.6, ZR=ZC+RR*CS;
const V_W=RW/H, V_S=(RW+RS)/H, V_C=(RW+RS+RC)/H;
const CELLMM=CS*1000;

let seed=1;
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function hash2(x,y){let n=(x*374761393+y*668265263)|0;n=(n^(n>>>13))*1274126177|0;return((n^(n>>>16))>>>0)/4294967296;}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi),b=hash2(xi+1,yi),c=hash2(xi,yi+1),d=hash2(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}

// world position of a grid point (r,c may be fractional)
function region(r){return r<RW?0:r<RW+RS?1:r<RW+RS+RC?2:3;}
function cellWorld(r,c){const x=X0+c*CS;const g=region(r);
  if(g===0)return new V3(x,TOP-r*CS,0);
  if(g===1)return new V3(x,SWY,(r-RW)*CS);
  if(g===2)return new V3(x,SWY-(r-RW-RS)*CS,ZC);
  return new V3(x,0,ZC+(r-RW-RS-RC)*CS);}

const h=new Float32Array(N), dry=new Float32Array(N), wg=new Float32Array(N), dH=new Float32Array(N);
const B=new Float32Array(N), PN=new Float32Array(N), VERT=new Float32Array(N);
for(let r=0;r<H;r++)for(let c=0;c<W;c++){const i=r*W+c;const x=X0+(c+.5)*CS;const g=region(r);let b=0,rough=.2;
  if(g===0){b=(TOP-(r+.5)*CS)*1000;rough=.3;}
  else if(g===1){const z=(r-RW+.5)*CS;b=150-z*6;const jx=Math.abs(((x-X0)%.5+.5)%.5-.25),jz=Math.abs((z%.5+.5)%.5-.25);if(jx>.25-CS*.6||jz>.25-CS*.6)b-=.9;rough=.18;}
  else if(g===2){b=150-(r-RW-RS+.5)*CS*1000;rough=.2;}
  else{const z=(r-RW-RS-RC+.5)*CS;b=z*14-x*5;rough=.55;}
  const n=vnoise(c*.35,r*.35)*.6+vnoise(c*1.3,r*1.3)*.4;
  B[i]=b+(n-.5)*rough*2;
  VERT[i]=(g===0||g===2)?.95:1;
  PN[i]=.62+.76*(vnoise(c*.21+40,r*.21)*.5+hash2(c,r)*.5)*(g===3?1.25:1);}

// ---------- fluids ----------
const C=hex=>{const c=new THREE.Color(hex);return[c.r,c.g,c.b];};
const FL={
  sangue:{nome:'Sangue fresco',K:.05,pin:.33,front:.58,h0:.6,gcap:1.1,dryT:600,evap:0,opK:3.2,F0:.045,nrm:16,
    thin:C(0x7a0a0e),thick:C(0x2a0204),dry:C(0x3b1d14),dryThin:C(0x6a3626),drop:0x7a0a0d,vol:1},
  antigo:{nome:'Sangue antigo',K:.032,pin:.42,front:.7,h0:.7,gcap:1,dryT:360,evap:0,opK:3.8,F0:.03,nrm:14,
    thin:C(0x6c1c16),thick:C(0x2c140d),dry:C(0x2a160e),dryThin:C(0x4a2a1c),drop:0x4a120e,vol:.6},
  bile:{nome:'Bile do Inchado',K:.02,pin:.8,front:1.2,h0:1.2,gcap:.9,dryT:900,evap:0,opK:7,F0:.04,nrm:12,
    thin:C(0xa9b43c),thick:C(0x6d781b),dry:C(0x3e4220),dryThin:C(0x565a2c),drop:0x8a9a2a,vol:1.3},
  oleo:{nome:'Óleo de motor',K:.03,pin:.12,front:.22,h0:.5,gcap:1,dryT:0,evap:0,opK:4.5,F0:.06,nrm:18,
    thin:C(0x15130f),thick:C(0x040405),dry:C(0x040405),dryThin:C(0x15130f),drop:0x0a0a0c,vol:1},
  gasolina:{nome:'Gasolina',K:.2,pin:.035,front:.07,h0:.2,gcap:1.2,dryT:0,evap:.02,opK:.25,F0:.04,nrm:0,
    thin:C(0x9a9070),thick:C(0x6e6446),dry:C(0x000000),dryThin:C(0x000000),drop:0xb8b090,vol:1.4}
};
const FKEYS=['sangue','antigo','bile','oleo','gasolina'];
let fk='sangue', F=FL[fk];

function dep(r,c,a){if(r<0||c<0||r>=H||c>=W||!(a>0))return;const i=r*W+c;h[i]+=a;if(a>.02){dry[i]*=.15;}wg[i]=1;}
// filled ellipse with noisy outline; a along (ux,uy) [cols,rows], b across. amt = center thickness in mm
function blob(cr,cc,a,b,ux,uy,amt,rough){
  const p0=rng()*6.28,p1=rng()*6.28,p2=rng()*6.28,p3=rng()*6.28;const R=Math.ceil(Math.max(a,b)*(1+rough)+1.5);
  for(let rr=Math.floor(cr-R);rr<=cr+R;rr++)for(let c=Math.floor(cc-R);c<=cc+R;c++){
    const dx=c+.5-cc,dy=rr+.5-cr;const al=dx*ux+dy*uy,ac=-dx*uy+dy*ux;const ang=Math.atan2(ac/b,al/a);
    const e=1+rough*(.45*Math.sin(3*ang+p0)+.3*Math.sin(5*ang+p1)+.18*Math.sin(8*ang+p2)+.12*Math.sin(13*ang+p3));
    const q=((al/a)*(al/a)+(ac/b)*(ac/b))/(e*e);if(q<1)dep(rr,c,amt*Math.sqrt(1-q));}}
// tapered stroke from (r0,c0) to (r1,c1)
function stroke(r0,c0,r1,c1,w0,w1,amt){const L=Math.hypot(r1-r0,c1-c0);const n=Math.max(2,Math.ceil(L*2.5));
  for(let k=0;k<=n;k++){const t=k/n;const r=r0+(r1-r0)*t,c=c0+(c1-c0)*t,w=w0+(w1-w0)*t;const R=Math.ceil(w+1);
    for(let rr=Math.floor(r-R);rr<=r+R;rr++)for(let cc=Math.floor(c-R);cc<=c+R;cc++){const d=Math.hypot(rr+.5-r,cc+.5-c);if(d<w){const i=rr*W+cc;if(rr<0||cc<0||rr>=H||cc>=W)continue;const v=amt*(1-d/w)*.5;if(h[i]<v){dep(rr,cc,v-h[i]);}}}}}
// splat: size = radius in cells of the main body, (ux,uy) travel direction on the surface, sinA = sine of impact angle
function splat(cr,cc,size,ux,uy,sinA,amt){
  sinA=Math.max(.17,Math.min(1,sinA));const el=Math.min(5.5,1/sinA);const a=size*Math.pow(el,.75),b=size/Math.pow(el,.25);
  const fr=cr+uy*a*.25,fc=cc+ux*a*.25;
  blob(fr,fc,a,b,ux,uy,amt,.1+.12*(1-sinA)+(size<1.4?0:.06));
  const vx=-uy,vy=ux;
  const ns=Math.round(Math.min(18,(size<1.2?1:4)+size*1.6+5*(1-sinA)));
  for(let k=0;k<ns;k++){
    const spread=Math.PI*(.25+.75*sinA*sinA);let th=(rng()*2-1)*spread;if(sinA>.9)th=rng()*6.283;
    const ct=Math.cos(th),st=Math.sin(th);const dx=ct*ux+st*vx,dy=ct*uy+st*vy;
    const len=size*(.25+rng()*.55)*(1+2.6*(1-sinA)*Math.max(0,ct))*(sinA>.9?.6:1);
    const sr=fr+(a*ct*uy+b*st*vy)*.75,sc=fc+(a*ct*ux+b*st*vx)*.75;
    const er=sr+dy*len,ec=sc+dx*len;
    stroke(sr,sc,er,ec,Math.max(.55,size*.22),.42,amt*.75);
    if(rng()<.5){const g=1+rng()*2.2;blob(er+dy*g,ec+dx*g,.55+rng()*.7,.5+rng()*.4,dx,dy,amt*.55,.08);}}
  const nsat=Math.round((1+size*.9)*(1.4-sinA*.6));
  for(let k=0;k<nsat;k++){const cone=sinA>.9?Math.PI:(.18+.6*sinA);const th=(rng()*2-1)*cone;const ct=Math.cos(th),st=Math.sin(th);
    const dx=ct*ux+st*vx,dy=ct*uy+st*vy;const d=a+size*(.8+rng()*3.2);const s=.45+rng()*Math.min(1.2,size*.22);
    const r=fr+dy*d,c=fc+dx*d;blob(r,c,s*Math.sqrt(el),s,dx,dy,amt*.6,.08);
    if(sinA<.8)stroke(r+dy*s*el*.7,c+dx*s*el*.7,r+dy*s*el*1.8,c+dx*s*el*1.8,.5,.3,amt*.35);}}

// ---------- simulation ----------
let bb={r0:0,r1:-1,c0:0,c1:-1};
function bbox(){let r0=H,r1=-1,c0=W,c1=-1;for(let r=0;r<H;r++){const o=r*W;let any=false;for(let c=0;c<W;c++){if(h[o+c]>0){any=true;if(c<c0)c0=c;if(c>c1)c1=c;}}if(any){if(r<r0)r0=r;r1=r;}}
  if(r1<0){bb={r0:0,r1:-1,c0:0,c1:-1};return;}const g=8;bb={r0:Math.max(0,r0-g),r1:Math.min(H-1,r1+g),c0:Math.max(0,c0-g),c1:Math.min(W-1,c1+g)};}
function mob(i){const d=dry[i];return d<.25?1:d>.6?0:1-(d-.25)/.35;}
function step(){
  const {r0,r1,c0,c1}=bb;if(r1<0)return;const K=F.K,h0s=F.h0*F.h0,gc=F.gcap,pin=F.pin,fr=F.front;
  for(let r=r0;r<=r1;r++){const o=r*W;for(let c=c0;c<=c1;c++)dH[o+c]=0;}
  for(let r=r0;r<=r1;r++){const o=r*W;for(let c=c0;c<=c1;c++){const i=o+c;const hi=h[i];
    for(let e=0;e<2;e++){let j;if(e===0){if(c>=c1)continue;j=i+1;}else{if(r>=r1)continue;j=i+W;}
      const hj=h[j];if(hi<.005&&hj<.005)continue;let db=B[i]-B[j];if(db>gc)db=gc;else if(db<-gc)db=-gc;let dh=db+hi-hj;let s=i,d=j;if(dh<0){dh=-dh;s=j;d=i;}
      const hs=h[s],pv=VERT[s],po=pin*PN[s]*(pv<1?.5:1);if(hs<=po)continue;if(h[d]<.03&&hs<fr*PN[s]*pv)continue;
      const m=mob(s);if(m<=0)continue;
      let f=K*m*(hs*hs/(hs*hs+h0s))*dh*(pv<1?(e===0?.22:1):4);const lim=(hs-po)*.24;if(f>lim)f=lim;dH[s]-=f;dH[d]+=f;}}}
  for(let r=r0;r<=r1;r++){const o=r*W;for(let c=c0;c<=c1;c++){const i=o+c;let v=h[i]+dH[i];if(v<1e-4)v=0;else wg[i]=1;h[i]=v;}}}
function age(dtg){const {r0,r1,c0,c1}=bb;if(r1<0)return;
  for(let r=r0;r<=r1;r++){const o=r*W;for(let c=c0;c<=c1;c++){const i=o+c;const hi=h[i];
    if(hi>0){const thin=1-Math.min(1,hi/1.6);
      if(F.dryT>0&&dry[i]<1)dry[i]=Math.min(1,dry[i]+dtg/F.dryT*(.45+1.7*thin));
      if(F.evap>0){const v=hi-F.evap*dtg*(.5+1.5*thin);h[i]=v>.004?v:0;}}
    else if(wg[i]>0)wg[i]=Math.max(0,wg[i]-dtg/(F.evap>0?25:1e9));}}}

// ---------- renderer ----------
const cv=$('cv'),view=$('view');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
const scene=new THREE.Scene();scene.background=new THREE.Color(0x07080a);scene.fog=new THREE.Fog(0x07080a,6,14);
const cam=new THREE.PerspectiveCamera(45,1.6,.03,40);
const ctl=new THREE.OrbitControls(cam,cv);ctl.enableDamping=true;ctl.maxPolarAngle=1.5;ctl.minDistance=.35;ctl.maxDistance=7;
const LAMP=new V3(.9,2.9,2.55);
scene.add(new THREE.AmbientLight(0x8a96a8,.42));
const lampL=new THREE.PointLight(0xffe0b0,2.2,10,1.4);lampL.position.copy(LAMP);scene.add(lampL);
const moon=new THREE.DirectionalLight(0x8aa0c8,.45);moon.position.set(-3,5,4);scene.add(moon);

const tex=new Uint8Array(N*4);const dtex=new THREE.DataTexture(tex,W,H,THREE.RGBAFormat);dtex.magFilter=THREE.LinearFilter;dtex.minFilter=THREE.LinearFilter;dtex.needsUpdate=true;
const U={tF:{value:dtex},tx:{value:new THREE.Vector2(1/W,1/H)},uT:{value:0},uFl:{value:0},
  cThin:{value:new V3()},cThick:{value:new V3()},cDry:{value:new V3()},cDryThin:{value:new V3()},opK:{value:3},F0:{value:.03},nrm:{value:16},
  vW:{value:V_W},vS:{value:V_S},vC:{value:V_C},camP:{value:new V3()},lampP:{value:LAMP.clone()},flashP:{value:new V3()},flashD:{value:new V3()},dbg:{value:0}};
const VS=`attribute vec3 aB;varying vec2 vUv;varying vec3 vPos;varying vec3 vN;varying vec3 vB;
void main(){vUv=uv;vPos=position;vN=normal;vB=aB;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`;
const FS=`precision highp float;
uniform sampler2D tF;uniform vec2 tx;uniform float uT;uniform int uFl;uniform vec3 cThin,cThick,cDry,cDryThin;uniform float opK,F0,nrm,vW,vS,vC,dbg;
uniform vec3 camP,lampP,flashP,flashD;varying vec2 vUv;varying vec3 vPos;varying vec3 vN;varying vec3 vB;
float hsh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hsh2(vec2 p){return vec2(hsh(p),hsh(p+17.7));}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 r=o+hsh2(i+o)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(d2)-sqrt(d1);}
float hs(vec2 u){float r=texture2D(tF,u).r;return r*r*6.;}
vec3 baseCol(vec2 p,float v){
  if(v<vW){float n=nz(p*3.)*.5+nz(p*11.)*.3+nz(p*41.)*.2;vec3 c=vec3(.30,.32,.35)*(.82+.32*n);
    c*=1.-.32*smoothstep(vW-.05,vW,v)*nz(p*vec2(5.,1.5));c*=1.-.1*smoothstep(.62,1.,nz(vec2(p.x*13.,p.y*.7)));return c;}
  if(v<vS){vec2 q=vec2(p.x+1.6,p.y-1.8);vec2 f=mod(q,.5);float j=min(min(f.x,.5-f.x),min(f.y,.5-f.y));float jm=1.-smoothstep(.003,.0075,j);
    float tone=hsh(floor(q/.5))*.12;float n=nz(p*22.)*.6+nz(p*95.)*.4;vec3 c=vec3(.40,.40,.38)*(.8+tone+.22*n);return c*(1.-.55*jm);}
  if(v<vC){return vec3(.50,.49,.46)*(.78+.28*nz(p*31.));}
  float n=nz(p*60.)*.5+nz(p*210.)*.5;vec3 c=vec3(.13,.135,.14)*(.72+.55*n)+step(.84,nz(p*160.))*.05;
  return c*(1.-.28*(1.-smoothstep(0.,.28,p.y-3.55)));}
void main(){
  vec4 S=texture2D(tF,vUv);vec2 q=tx*.5;float h=.25*(hs(vUv+q)+hs(vUv-q)+hs(vUv+vec2(q.x,-q.y))+hs(vUv+vec2(-q.x,q.y)));float dry=S.g;float wg=S.b;
  vec2 o1=vec2(tx.x*1.5,0.),o2=vec2(0.,tx.y*1.5);
  float hl=hs(vUv-o1),hr=hs(vUv+o1),hd=hs(vUv-o2),hu=hs(vUv+o2);
  vec2 g=vec2(hr-hl,hu-hd)/37.5;
  vec2 cellp=vUv*vec2(256.,396.);
  float n1=nz(cellp*2.3),n2=nz(cellp*7.1);
  float hn=h+(n1-.5)*.045+(n2-.5)*.02;
  float m=smoothstep(.035,.08,hn);
  if(uFl==4){float wa=.25*(texture2D(tF,vUv+q).b+texture2D(tF,vUv-q).b+texture2D(tF,vUv+vec2(q.x,-q.y)).b+texture2D(tF,vUv+vec2(-q.x,q.y)).b);m=smoothstep(.35,.75,wa+(n1-.5)*.25)*smoothstep(.0,.012,h);wg=smoothstep(.2,.8,wa+(n1-.5)*.2);}
  vec2 p=vec2(vPos.x,vUv.y*4.95);
  vec3 base=baseCol(p,vUv.y);
  vec3 T=vec3(1.,0.,0.),Bv=normalize(vB),N0=normalize(vN);
  vec3 nt=vec3(-g*nrm*m,1.);
  float dryM=smoothstep(.5,.95,dry);
  float wet=(1.-dryM)*m;
  // bile bubbles
  float bub=0.;
  if(uFl==2){vec2 bp=cellp/2.6;vec2 bi=floor(bp);vec2 bf=fract(bp)-.5;float rnd=hsh(bi);
    if(rnd>.5&&h>1.1){float t=fract(uT*(.18+.25*hsh(bi+3.1))+rnd*7.);float rad=.42*smoothstep(0.,.8,t);float d=length(bf-(hsh2(bi+9.)-.5)*.2);
      if(t<.86&&d<rad){float z=sqrt(max(0.,rad*rad-d*d));nt.xy+=(bf/max(rad,.01))*2.2*(1.-dryM);bub=z/rad;}
      else if(t>=.86){float rr=.42*1.15;float ring=1.-smoothstep(0.,.07,abs(d-rr*(.9+(t-.86)*.8)));nt.xy-=normalize(bf+.0001)*ring*.8*(1.-dryM);bub=-ring;}}}
  if(uFl==4){vec2 wp=vec2(vPos.x,vUv.y*4.95);nt.xy+=.05*m*vec2(nz(wp*9.+vec2(uT*1.7,0.))-.5,nz(wp*9.+vec2(0.,uT*1.4)+7.)-.5)*2.;}
  vec3 Nf=normalize(T*nt.x+Bv*nt.y+N0*nt.z);
  // albedo
  float th=smoothstep(.1,1.7,h);
  vec3 fc=mix(cThin,cThick,th);
  float op=clamp(1.-exp(-h*opK),0.,1.);
  vec3 alb;
  if(uFl==4){alb=base*mix(vec3(1.),cThin*1.15,clamp(h*.9,0.,1.));}
  else{alb=mix(base*mix(vec3(1.),fc*1.6,clamp(h*2.,0.,1.)),fc,op);}
  if(uFl==2&&bub>0.)alb=mix(alb,cThin*1.25,bub*.5);
  // dried look: matte, darker rim, cracks where it was thick
  float rim=smoothstep(.01,.05,length(g))*(1.-smoothstep(.4,1.,h));
  vec3 dc=mix(cDryThin,cDry,smoothstep(.06,.8,h))*(1.-.42*rim);
  float crk=(1.-smoothstep(.015,.05,vor(p*(uFl==2?34.:52.))))*smoothstep(.9,1.6,h);
  dc=mix(dc,base*.55,crk*.75);
  if(uFl!=3&&uFl!=4)alb=mix(alb,mix(base,dc,clamp(.4+h*1.4,0.,1.)),dryM);
  // gasoline darkens the ground while wet
  float gw=0.;if(uFl==4){gw=wg*(1.-m*.0);base*=mix(1.,.45,gw);alb=mix(base,alb,m);}
  vec3 col0=mix(base,alb*(uFl<2?mix(.62,1.,dryM):1.),m);
  // lighting
  vec3 V=normalize(camP-vPos);
  vec3 Lv=lampP-vPos;float dl=length(Lv);vec3 L=Lv/dl;float att=2.2/(1.+dl*dl*.12);
  vec3 lampC=vec3(1.,.88,.7);vec3 moonD=normalize(vec3(-3.,5.,4.));vec3 moonC=vec3(.11,.14,.19);vec3 amb=vec3(.14,.15,.17);
  vec3 Fv=flashP-vPos;float fd=length(Fv);vec3 FL=Fv/fd;float cone=smoothstep(.86,.97,dot(-FL,flashD));float fatt=cone*1.1/(1.+fd*fd*.6);
  vec3 dif=col0*(amb+lampC*att*max(dot(Nf,L),0.)+moonC*max(dot(Nf,moonD),0.)+vec3(.95,.97,1.)*fatt*max(dot(Nf,FL),0.));
  float wv=max(wet,gw*.7);
  float shin=mix(30.,320.,wv);
  vec3 Hh=normalize(L+V);vec3 Hf=normalize(FL+V);
  float sp=pow(max(dot(Nf,Hh),0.),shin)*shin*.011*att;float spf=pow(max(dot(Nf,Hf),0.),shin)*shin*.008*fatt;
  vec3 R=reflect(-V,Nf);
  vec3 env=mix(vec3(.03,.035,.04),vec3(.15,.17,.21),clamp(R.y*1.4,0.,1.));
  if(R.z<-.02&&vPos.z>.01){float tw=-vPos.z/R.z;float yw=vPos.y+R.y*tw;if(yw>.15&&yw<1.95)env=vec3(.30,.32,.35)*(.75+.35*nz(vec2(vPos.x+R.x*tw,yw)*3.));}if(R.y<-.02&&vPos.z<.01)env=vec3(.16,.16,.15);env+=lampC*(pow(max(dot(R,L),0.),500.)*7.+pow(max(dot(R,L),0.),40.)*.6)*att;
  float fr=F0+(1.-F0)*pow(1.-max(dot(Nf,V),0.),5.);
  vec3 col=dif*(1.-fr*wv*.7)+(env*min(1.,fr*(uFl==4?1.6:3.4))+min(lampC*sp+vec3(.9,.95,1.)*spf,vec3(.85)))*wv;
  if(uFl==3){float film=(1.-smoothstep(.04,.55,h))*m;vec3 ir=.5+.5*cos(6.283*(h*7.+n1*.5+uT*.03+vec3(0.,.33,.67)));col+=ir*film*(.10+.5*fr)*(.6+att*.4);}
  if(uFl==4){vec2 wp=vec2(vPos.x,vUv.y*4.95);float film=m*(.4+.6*(1.-smoothstep(.02,.2,h)));vec3 ir=.5+.5*cos(6.283*(nz(wp*6.)*1.4+uT*.02+vec3(0.,.33,.67)));col+=ir*film*.05*(.3+fr*3.);}
  if(dbg>.5){float k=clamp(h/3.,0.,1.);vec3 hc=mix(vec3(.05,.1,.5),vec3(1.,.9,.2),k);hc=mix(hc,vec3(1.,.2,.1),step(.66,k));col=mix(base*.25,mix(hc,vec3(.6),dryM*.7),step(.004,h));}
  gl_FragColor=vec4(col,1.);}`;
const fmat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VS,fragmentShader:FS});
function strip(v0,v1,posFn,nrm,bdir,segU,segV){const g=new THREE.BufferGeometry();const P=[],NN=[],UV=[],BB=[],I=[];
  for(let j=0;j<=segV;j++){const t=j/segV;for(let i=0;i<=segU;i++){const u=i/segU;const p=posFn(u,t);P.push(p.x,p.y,p.z);NN.push(nrm.x,nrm.y,nrm.z);BB.push(bdir.x,bdir.y,bdir.z);UV.push(u,v0+(v1-v0)*t);}}
  for(let j=0;j<segV;j++)for(let i=0;i<segU;i++){const a=j*(segU+1)+i,b=a+1,c=a+segU+1,d=c+1;I.push(a,c,b,b,c,d);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(NN,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('aB',new THREE.Float32BufferAttribute(BB,3));g.setIndex(I);
  const m=new THREE.Mesh(g,fmat);scene.add(m);return m;}
const xs=u=>X0+u*W*CS;
const surf=[
  strip(0,V_W,(u,t)=>new V3(xs(u),TOP-t*RW*CS,0),new V3(0,0,1),new V3(0,-1,0),8,8),
  strip(V_W,V_S,(u,t)=>new V3(xs(u),SWY,t*RS*CS),new V3(0,1,0),new V3(0,0,1),8,8),
  strip(V_S,V_C,(u,t)=>new V3(xs(u),SWY-t*RC*CS,ZC),new V3(0,0,1),new V3(0,-1,0),8,1),
  strip(V_C,1,(u,t)=>new V3(xs(u),0,ZC+t*RR*CS),new V3(0,1,0),new V3(0,0,1),8,8)];

// ---------- props (low poly) ----------
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,flatShading:true},o||{}));
function add(par,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);par.add(m);return m;}
const world=new THREE.Group();scene.add(world);
add(world,new THREE.BoxGeometry(3.4,.4,.25),M(0x23272d),0,TOP+.2,-.06);
const post=add(world,new THREE.CylinderGeometry(.05,.07,3,7),M(0x2b2f35,{metalness:.4,roughness:.6}),LAMP.x,1.5,LAMP.z+.2);
add(world,new THREE.BoxGeometry(.12,.06,.5),M(0x2b2f35),LAMP.x,3,LAMP.z-.02);
add(world,new THREE.BoxGeometry(.18,.06,.26),new THREE.MeshBasicMaterial({color:0xffe9c4}),LAMP.x,2.94,LAMP.z-.1);
const bin=add(world,new THREE.CylinderGeometry(.2,.17,.62,8),M(0x33402e),1.35,SWY+.31,.35);
const props=new THREE.Group();scene.add(props);
const skin=M(0x6c7662),cloth=M(0x262a31),cloth2=M(0x3b2e24);
function capsule(par,r,len,mat,x,y,z,rx,ry,rz){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.set(rx||0,ry||0,rz||0);
  add(g,new THREE.CylinderGeometry(r,r,len,7),mat,0,0,0);add(g,new THREE.SphereGeometry(r,7,5),mat,0,len/2,0);add(g,new THREE.SphereGeometry(r,7,5),mat,0,-len/2,0);par.add(g);return g;}
function bodyLying(bile){const g=new THREE.Group();const s=bile?M(0x8a9470):skin;
  capsule(g,bile?.19:.14,.42,cloth,0,SWY+.09,0,0,0,Math.PI/2).scale.set(1,1,.62);
  add(g,new THREE.SphereGeometry(.1,8,6),s,-.42,SWY+.09,.03);
  capsule(g,.06,.42,cloth2,.47,SWY+.06,-.07,0,0,Math.PI/2);capsule(g,.06,.42,cloth2,.47,SWY+.06,.09,0,.1,Math.PI/2);
  capsule(g,.05,.36,s,-.1,SWY+.06,-.24,Math.PI/2,0,.25);capsule(g,.05,.36,s,.05,SWY+.06,.25,Math.PI/2,0,-.4);
  const sh=add(g,new THREE.CircleGeometry(.55,16),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.35,depthWrite:false}),0,SWY+.004,0);sh.rotation.x=-Math.PI/2;sh.scale.set(1.5,.55,1);
  return g;}
function canTipped(red){const g=new THREE.Group();
  if(red){const m=M(0xa3201c,{roughness:.5,metalness:.3});add(g,new THREE.BoxGeometry(.32,.14,.24),m,0,.07,0);const sp=add(g,new THREE.CylinderGeometry(.022,.022,.08,6),M(0x222222),.1,.06,.15);sp.rotation.x=Math.PI/2;}
  else{const m=M(0x1c1e22,{roughness:.35,metalness:.4});const b=add(g,new THREE.CylinderGeometry(.065,.065,.2,10),m,0,.065,0);b.rotation.x=Math.PI/2;const sp=add(g,new THREE.CylinderGeometry(.018,.018,.05,6),M(0xb08a2a,{metalness:.6}),0,.05,.12);sp.rotation.x=Math.PI/2;}
  g.position.y=SWY;return g;}
function balcony(kind){const g=new THREE.Group();add(g,new THREE.BoxGeometry(.9,.07,.42),M(0x2a2e33),0,1.2,.21);
  if(kind==='arm'){add(g,new THREE.BoxGeometry(.5,.12,.3),cloth,-.05,1.3,.2);capsule(g,.045,.26,skin,.02,1.13,.43,.1,0,.05);capsule(g,.04,.12,skin,.025,.95,.44,.2,0,0);}
  else add(g,new THREE.CylinderGeometry(.022,.022,.32,6),M(0x3a3a3a,{metalness:.5}),.02,1.03,.44);return g;}

// ---------- drops in flight ----------
const DMAX=600;const dropMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.12,metalness:.15,transparent:true,opacity:1});
const dropIM=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),dropMat,DMAX);dropIM.frustumCulled=false;scene.add(dropIM);
const DR=[];for(let i=0;i<DMAX;i++){DR.push({on:false,p:new V3(),v:new V3(),r:0});}
const ZERO=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<DMAX;i++)dropIM.setMatrixAt(i,ZERO);
const tq=new THREE.Quaternion(),tm=new THREE.Matrix4(),ts=new V3(),UPV=new V3(0,1,0),tv=new V3();
let dI=0;function launch(p,v,rmm){const d=DR[dI++%DMAX];d.on=true;d.p.copy(p);d.v.copy(v);d.r=rmm;}
// hit a surface: convert to grid row/col and make a splat with incidence from the velocity
function land(p,v,rmm,g){let r,c=(p.x-X0)/CS,ux=v.x,uy,vn;
  if(g===0){r=(TOP-p.y)/CS;uy=-v.y;vn=-v.z;}
  else if(g===1){r=RW+p.z/CS;uy=v.z;vn=-v.y;}
  else if(g===2){r=RW+RS+(SWY-p.y)/CS;uy=-v.y;vn=-v.z;}
  else{r=RW+RS+RC+(p.z-ZC)/CS;uy=v.z;vn=-v.y;}
  const vt=Math.hypot(ux,uy)||1e-6;const sinA=Math.abs(vn)/Math.hypot(vt,vn);
  const vol=(4/3*Math.PI*rmm*rmm*rmm)/(CELLMM*CELLMM)*(rmm>3?7:4)*F.vol;
  const sp=v.length();const size=Math.max(.6,rmm*2/CELLMM*(1+.2*sp));
  const amt=Math.min(2.6,Math.max(.25,vol/(Math.PI*size*size*1.6/ (sinA<.3?.6:1))));
  splat(r,c,size,ux/vt,uy/vt,sinA,amt);}
function updDrops(dt){for(let i=0;i<DMAX;i++){const d=DR[i];if(!d.on)continue;const px=d.p.x,pz=d.p.z;
  d.v.y-=9.8*dt;d.v.multiplyScalar(1-dt*.25);d.p.addScaledVector(d.v,dt);const p=d.p;let g=-1;
  if(p.z<=0&&p.y>SWY){p.z=0;g=0;}
  else if(p.z<ZC&&p.z>=0&&p.y<=SWY){p.y=SWY;g=1;}
  else if(p.z>=ZC&&pz<ZC&&p.y<SWY){p.z=ZC;g=2;}
  else if(p.z>=ZC&&p.y<=0){p.y=0;g=3;}
  if(g>=0){if(p.x>X0&&p.x<-X0&&p.z<ZR)land(p,d.v,d.r,g);d.on=false;dropIM.setMatrixAt(i,ZERO);continue;}
  if(p.y<-1||Math.abs(p.x)>3||p.z>ZR+1){d.on=false;dropIM.setMatrixAt(i,ZERO);continue;}
  const sp=d.v.length();tv.copy(d.v).normalize();tq.setFromUnitVectors(UPV,tv);const s=d.r*.0013;ts.set(s,s*(1+Math.min(3.5,sp*.35)),s);tm.compose(p,tq,ts);dropIM.setMatrixAt(i,tm);}
  dropIM.instanceMatrix.needsUpdate=true;}

// ---------- drip source: bead swells, detaches, falls ----------
const bead=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),dropMat);bead.visible=false;scene.add(bead);
let drip=null;// {p,every,t,r}
function updDrip(dt){if(!drip){bead.visible=false;return;}drip.t+=dt;const k=Math.min(1,drip.t/drip.every);const r=drip.r*(.35+.65*k);
  bead.visible=true;bead.position.copy(drip.p).add(new V3(0,-r*.0012,0));bead.scale.set(r*.0011,r*.0011*(1+k*.7),r*.0011);
  if(drip.t>=drip.every){launch(bead.position.clone().add(new V3(0,-r*.001,0)),new V3((rng()-.5)*.05,-.2,(rng()-.5)*.05),drip.r*(.85+rng()*.3));drip.t=0;drip.every=drip.base*(.75+rng()*.5);}}

// ---------- continuous sources and drags ----------
let srcs=[];// {r,c,rate,t,dur,rad}
function updSrc(dt){srcs.forEach(s=>{s.t+=dt;if(s.t>s.dur)return;const pulse=.6+.4*Math.max(0,Math.sin(s.t*5.2));const a=s.rate*dt*pulse;const n=3;
  for(let k=0;k<n;k++){const ang=rng()*6.28,d=rng()*s.rad;const r=Math.round(s.r+Math.sin(ang)*d),c=Math.round(s.c+Math.cos(ang)*d);dep(r,c,a/n);}});}
let drags=[];// path smear
function updDrag(dt){drags.forEach(g=>{if(g.done)return;g.t+=dt;const t=Math.min(1,g.t/g.dur);const P=g.path(t),P2=g.path(Math.min(1,t+.01));
  let ux=P2.c-P.c,uy=P2.r-P.r;const L=Math.hypot(ux,uy)||1;ux/=L;uy/=L;const vx=-uy,vy=ux;const load=Math.pow(1-t,1.3);
  for(let k=-g.w;k<=g.w;k+=.5){const across=k/g.w;const stripe=g.str[Math.round((k+g.w)*2)];const edge=1-across*across;
    let a=g.amt*load*(.25+.75*stripe)*edge;if(load<.45&&rng()>load*2.2)continue;dep(Math.round(P.r+vy*k),Math.round(P.c+vx*k),a*dt*30);}
  if(g.hand&&rng()<dt*14*load+.02){const w=cellWorld(P.r,P.c);const vel=new V3(ux,0,uy).multiplyScalar(g.speed);launch(new V3(w.x+(rng()-.5)*.06,SWY+.55+rng()*.3,w.z+(rng()-.5)*.06),vel.add(new V3((rng()-.5)*.3,.2,(rng()-.5)*.3)),2+rng()*2.2);}
  if(t>=1)g.done=true;});}

// ---------- scenes ----------
let timeline=[],sT=0;const at=(t,fn)=>timeline.push({t,fn,done:false});
let labels=[];
const SCENES={
  parede:{nome:'Tiro na parede',nota:'Saída de tiro a 80 cm da parede. Respingo direcional, fios que afinam com gota na ponta, poça na base e algumas gotas no chão.',cam:[[.7,1.15,2.1],[-.25,.95,0]],
    run(){const O=new V3(-.25,1.3,.75);
      at(.05,()=>{for(let k=0;k<220;k++){const dir=new V3((rng()-.5)*1.3,(rng()-.4)*1.0,-1).normalize();launch(O.clone(),dir.multiplyScalar(4+rng()*6),.5+rng()*1.1);}for(let k=0;k<110;k++){const dir=new V3((rng()-.5)*.9,(rng()-.35)*.7,-1).normalize();const big=k<7;launch(O.clone().add(new V3((rng()-.5)*.04,(rng()-.5)*.04,0)),dir.multiplyScalar(big?5:3+rng()*5),big?5.5+rng()*2.5:1+rng()*rng()*4.5);}});
      at(.12,()=>{for(let k=0;k<26;k++){const dir=new V3((rng()-.5)*1.2,.15+rng()*.4,-.4-rng()*.4).normalize();launch(O.clone(),dir.multiplyScalar(1.5+rng()*2),1.5+rng()*2.5);}});}},
  fonte:{nome:'Fonte contínua',nota:'',cam:[[.95,.75,2.25],[.15,.1,1.2]],
    run(){const r=RW+Math.round(1.02/CS),c=Math.round((.12-X0)/CS);
      if(fk==='oleo'||fk==='gasolina'){const cn=canTipped(fk==='gasolina');cn.position.set(fk==='gasolina'?.02:.12,SWY,.8);props.add(cn);srcs.push({r:RW+Math.round(1.0/CS),c,rate:fk==='gasolina'?700:300,t:0,dur:fk==='gasolina'?8:20,rad:2});}
      else{const b=bodyLying(fk==='bile');b.position.set(.1,0,.82);props.add(b);srcs.push({r:fk==='bile'?r+4:r-2,c,rate:fk==='bile'?320:240,t:0,dur:fk==='bile'?24:22,rad:3});}}},
  pinga:{nome:'Gotejando',nota:'Gota incha na ponta do dedo, solta, cai 70 cm e bate vertical: coroa com borda serrilhada e satélites. As batidas formam a poça.',cam:[[.4,.95,1.6],[-.45,.55,.42]],
    run(){const kind=(fk==='oleo'||fk==='gasolina')?'pipe':'arm';props.add(balcony(kind));props.children[0].position.x=-.5;
      drip={p:new V3(-.47,kind==='arm'?.87:.86,.45),every:.5,base:.5,t:0,r:4.4};}},
  arrasto:{nome:'Arrasto',nota:'Corpo arrastado pela calçada: faixa com estrias que perde carga e esfarela no fim, e gotas laterais esticadas no sentido do movimento.',cam:[[.6,1.6,2.3],[-.1,.15,.8]],
    run(){const str=[];for(let k=0;k<64;k++)str.push(Math.pow(rng(),.7));
      drags.push({t:0,dur:5,w:4,amt:1.6,str,hand:true,speed:.7,path:t=>{const x=-1.25+t*2.2,z=.35+.55*t+.12*Math.sin(t*5);return{r:RW+z/CS,c:(x-X0)/CS};}});}},
  formas:{nome:'Formas',nota:'Vocabulário de formas com a mesma gota: o ângulo muda tudo. Na calçada, impactos a 90°, 60°, 35° e 15° indo para a direita, rastro de quem anda, pingos e mão arrastada. Na parede, golpe em arco e escorrido.',cam:[[-.15,1.5,2.05],[-.15,.45,.5]],
    run(){const row=RW+Math.round(.55/CS);const L=[];const angs=[90,60,35,15];
      angs.forEach((a,k)=>{const x=-1.0+k*.4;const c=(x-X0)/CS;const s=Math.sin(a*Math.PI/180);splat(row,c,3.1,1,0,s,1.5);L.push([cellWorld(row,c),a+'°']);});
      for(let k=0;k<7;k++){const x=.65+k*.11;const c=(x-X0)/CS;splat(RW+Math.round((.4+k*.035)/CS),c,1.2,1,.3,.42,.9);}L.push([new V3(.95,SWY,.5),'rastro andando']);
      const ar=[];for(let k=0;k<14;k++){const t=k/13;const ang=-.3+t*1.9;const cx=-.6+Math.cos(ang)*.55,cy=1.05+Math.sin(ang)*.5;const c=(cx-X0)/CS,r=(TOP-cy)/CS;splat(r,c,1.1,-Math.sin(ang),-Math.cos(ang),.3,.9);ar.push(1);}L.push([new V3(-.35,1.6,0),'cast-off (golpe)']);
      for(let k=0;k<4;k++){const c=(.55+k*.07-X0)/CS;splat(Math.round((TOP-1.45)/CS),c,2.4,0,1,1,1.6);}L.push([new V3(.65,1.5,0),'escorrido']);
      const r2=RW+Math.round(1.2/CS);const c2=(-.9-X0)/CS;splat(r2,c2,2.6,1,0,1,1.3);for(let k=0;k<10;k++){splat(r2+(rng()-.5)*8,c2+(rng()-.5)*8,1.2+rng()*1.2,1,0,1,1);}srcs.push({r:r2,c:c2,rate:40,t:0,dur:6,rad:2});L.push([cellWorld(r2,c2),'pingos + poça']);
      const str=[];for(let k=0;k<64;k++)str.push(Math.pow(rng(),.7));drags.push({t:0,dur:1.4,w:3,amt:1.5,str,hand:false,speed:0,path:t=>({r:r2-6+t*4,c:(.05-X0)/CS+t*48})});L.push([new V3(.3,SWY,1.15),'mão arrastada']);
      labels=L;}}
};
const SKEYS=['parede','fonte','pinga','arrasto','formas'];
let sk='parede';

function clearAll(){h.fill(0);dry.fill(0);wg.fill(0);for(let i=0;i<DMAX;i++){DR[i].on=false;dropIM.setMatrixAt(i,ZERO);}dropIM.instanceMatrix.needsUpdate=true;
  while(props.children.length)props.remove(props.children[0]);srcs=[];drags=[];drip=null;timeline=[];labels=[];sT=0;gT=0;$('labels').innerHTML='';}
function noteFor(){const S=SCENES[sk];if(sk!=='fonte')return S.nota;
  return fk==='gasolina'?'Galão tombado. Gasolina espalha rápido e fina, escurece o chão, tremula e evapora pela borda.':fk==='oleo'?'Lata de óleo tombada. Poça preta espelhada que corre devagar para o meio-fio, arco-íris na borda fina, nunca seca.':fk==='bile'?'Inchado estourado. Bile grossa avança devagar em lóbulos, borbulha e vira crosta oliva rachada.':'Zumbi caído sangrando. A poça segue o rejunte e o declive, chega ao meio-fio, desce em fios e corre na sarjeta.';}
function runScene(moveCam){clearAll();seed=(sk.length*7919+fk.length*104729+runN*31)>>>0;SCENES[sk].run();$('sceneNote').textContent=noteFor();
  if(moveCam){const c=SCENES[sk].cam;cam.position.set(...c[0]);ctl.target.set(...c[1]);ctl.update();}
  const f=FL[fk];dropMat.color.setHex(f.drop);dropMat.opacity=fk==='gasolina'?.45:1;bbox();}
let runN=0;
function setFluid(k){fk=k;F=FL[k];U.uFl.value=FKEYS.indexOf(k);U.cThin.value.fromArray(F.thin);U.cThick.value.fromArray(F.thick);U.cDry.value.fromArray(F.dry);U.cDryThin.value.fromArray(F.dryThin);
  U.opK.value=F.opK;U.F0.value=F.F0;U.nrm.value=F.nrm;}

// ---------- UI ----------
function btnRow(el,items,cur,on){el.innerHTML='';items.forEach(([k,t])=>{const b=document.createElement('button');b.textContent=t;b.setAttribute('aria-pressed',String(k===cur));b.addEventListener('click',()=>{[...el.children].forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');on(k);});el.appendChild(b);});}
btnRow($('bFluid'),FKEYS.map(k=>[k,FL[k].nome]),fk,k=>{setFluid(k);runN++;runScene(false);});
btnRow($('bScene'),SKEYS.map(k=>[k,SCENES[k].nome]),sk,k=>{sk=k;runN++;runScene(true);});
let speed=20;btnRow($('bSpeed'),[[1,'Tempo real'],[20,'×20'],[60,'×60']],20,k=>{speed=k;});
btnRow($('bCam'),[['a','Câmera da cena'],['b','Visão geral'],['c','Meio-fio']],'a',k=>{const c=k==='a'?SCENES[sk].cam:k==='b'?[[2.4,2.3,3.9],[0,.4,1]]:[[.9,.42,2.25],[.1,.05,1.6]];cam.position.set(...c[0]);ctl.target.set(...c[1]);ctl.update();});
$('bRe').addEventListener('click',()=>{runN++;runScene(false);});
$('bClear').addEventListener('click',()=>{clearAll();bbox();});
$('bDbg').addEventListener('click',e=>{const on=U.dbg.value<.5;U.dbg.value=on?1:0;e.currentTarget.setAttribute('aria-pressed',String(on));});

// click: shoot a big drop from the camera direction
const ray=new THREE.Raycaster(),mv=new THREE.Vector2();let downAt=null;
cv.addEventListener('pointerdown',e=>{downAt=[e.clientX,e.clientY];});
cv.addEventListener('pointerup',e=>{if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5)return;const rc=cv.getBoundingClientRect();mv.set((e.clientX-rc.left)/rc.width*2-1,-(e.clientY-rc.top)/rc.height*2+1);ray.setFromCamera(mv,cam);
  const hit=ray.intersectObjects(surf)[0];if(!hit)return;const dir=ray.ray.direction.clone();const p0=hit.point.clone().addScaledVector(dir,-.25);
  launch(p0,dir.clone().multiplyScalar(6),6.5);for(let k=0;k<14;k++){launch(p0.clone().add(new V3((rng()-.5)*.03,(rng()-.5)*.03,(rng()-.5)*.03)),dir.clone().add(new V3((rng()-.5)*.35,(rng()-.5)*.35,(rng()-.5)*.35)).normalize().multiplyScalar(4+rng()*3),1+rng()*2.5);}});

function resize(){const w=view.clientWidth,hh=view.clientHeight;renderer.setSize(w,hh,false);cam.aspect=w/hh;cam.updateProjectionMatrix();}
window.addEventListener('resize',resize);

function upload(){const n=N;for(let i=0,j=0;i<n;i++,j+=4){const v=h[i];tex[j]=v>0?Math.min(255,Math.sqrt(Math.min(6,v)/6)*255+.5):0;tex[j+1]=dry[i]*255;tex[j+2]=wg[i]*255;tex[j+3]=255;}dtex.needsUpdate=true;}

let gT=0,last=performance.now(),acc=0,fpsT=0,fpsN=0,simMs=0,frame=0;
const fwd=new V3();
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;sT+=dt;gT+=dt*speed;U.uT.value=now/1000;
  timeline.forEach(e=>{if(!e.done&&sT>=e.t){e.done=true;e.fn();}});
  updDrops(dt);updDrip(dt);updSrc(dt);updDrag(dt);
  const t0=performance.now();acc+=dt;let n=0;bbox();while(acc>=1/180&&n<6){step();acc-=1/180;n++;}if(n===6)acc=0;age(dt*speed);simMs=simMs*.9+(performance.now()-t0)*.1;
  upload();
  ctl.update();U.camP.value.copy(cam.position);cam.getWorldDirection(fwd);U.flashP.value.copy(cam.position).add(new V3(.12,-.15,0));U.flashD.value.copy(fwd);
  renderer.render(scene,cam);
  // labels
  const L=$('labels');if(labels.length&&L.children.length!==labels.length){L.innerHTML='';labels.forEach(l=>{const s=document.createElement('span');s.textContent=l[1];L.appendChild(s);});}
  if(labels.length){const rc=view.getBoundingClientRect();labels.forEach((l,k)=>{const p=l[0].clone().add(new V3(0,.04,.0)).project(cam);const s=L.children[k];s.style.left=((p.x+1)/2*rc.width)+'px';s.style.top=((1-p.y)/2*rc.height-6)+'px';s.hidden=p.z>1;});}
  fpsN++;fpsT+=dt;frame++;
  if(fpsT>.5){$('cFps').innerHTML='<b>'+Math.round(fpsN/fpsT)+'</b> fps';fpsN=0;fpsT=0;$('cSim').innerHTML='sim <b>'+simMs.toFixed(1)+'</b> ms';
    let wc=0,ds=0;const {r0,r1,c0,c1}=bb;for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const i=r*W+c;if(h[i]>.035){wc++;ds+=dry[i];}}
    $('cCells').textContent=wc.toLocaleString('pt-BR')+' células molhadas';
    const s=Math.floor(gT),mm=String(Math.floor(s/60)).padStart(2,'0'),ss=String(s%60).padStart(2,'0');$('sClock').textContent=mm+':'+ss;
    let st,fr=0;if(!wc){st=fk==='gasolina'&&gT>5?'evaporou, sem marca':'—';}else if(fk==='oleo'){st='molhado · nunca seca';}else if(fk==='gasolina'){st='evaporando pela borda';fr=Math.min(1,gT/60);}
    else{fr=ds/wc;st=fr<.35?'fresco · brilhante':fr<.85?'secando pela borda':'seco · fosco';}
    $('sState').textContent=st;$('sMeter').style.width=(fr*100).toFixed(0)+'%';}}
setFluid(fk);resize();runScene(true);requestAnimationFrame(loop);
window.__fluid={h,dry,setFluid,runScene,SCENES,get sk(){return sk},set sk(v){sk=v}};
})();
