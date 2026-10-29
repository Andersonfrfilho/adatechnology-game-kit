// fonte: site/pages/mapa/galeria-vale-cinzento.html
// texto visível: Galeria do Vale Cinzento ZOMBI AdA Galeria do mapa · low poly sombrio Girar sozinho Marcadores Hora: da cena Arraste para girar · roda ou pinça para zoom Loot Perigo Destrutível Cena Carregando o vale…

// ===== script 1 (286 KB)

(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!window.THREE){$('loadTxt').textContent='Não foi possível carregar o motor 3D. Recarregue a página.';return;}
const T=THREE,V3=T.Vector3;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- utilidades
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let R=rng(7);
const pick=a=>a[Math.floor(R()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};

// ---------- renderer
const canvas=$('c'),stage=$('stage');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(45,1,.1,2000);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);

// ---------- materiais e primitivas
const MC={},EC={};
function M(c,o){const k=c+(o?JSON.stringify(o):'');if(MC[k])return MC[k];return MC[k]=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:false},o||{}));}
function E(c){return EC[c]||(EC[c]=new T.MeshBasicMaterial({color:c}));}
const mt=c=>(c&&c.isMaterial)?c:M(c);
let root=null,ANIM=[],PINS=[],IT=[],WL=[],WD=[];
function grp(x,y,z,ry,p){const g=new T.Group();g.position.set(x,y,z);if(ry)g.rotation.y=ry;(p||root).add(g);return g;}
// caixa arredondada: grade 4x4 por face, vértices da borda empurrados para um arco de raio r (normais suaves)
const GC={};
function rbox(w,h,d,r){
  if(r===undefined)r=Math.min(Math.min(w,h,d)*.22,.15);
  if(r<.012)return new T.BoxGeometry(w,h,d);
  const k=[w,h,d,r].map(v=>v.toFixed(3)).join('|');if(GC[k])return GC[k];
  const g=new T.BoxGeometry(2,2,2,4,4,4),P=g.attributes.position,N=g.attributes.normal,H=[w/2,h/2,d/2],p=[0,0,0],q=[0,0,0];
  const mp=(v,hh)=>{const a=Math.abs(v),sg=Math.sign(v);return sg*(a<=.5?a*2*(hh-r):(hh-r)+(a-.5)*2*r);};
  for(let i=0;i<P.count;i++){const o=[P.getX(i),P.getY(i),P.getZ(i)];let l=0;
    for(let j=0;j<3;j++){p[j]=mp(o[j],H[j]);const c=Math.max(-(H[j]-r),Math.min(H[j]-r,p[j]));q[j]=p[j]-c;p[j]=c;l+=q[j]*q[j];}
    l=Math.sqrt(l);if(l<1e-6){q[0]=N.getX(i);q[1]=N.getY(i);q[2]=N.getZ(i);}else for(let j=0;j<3;j++)q[j]/=l;
    P.setXYZ(i,p[0]+q[0]*r,p[1]+q[1]*r,p[2]+q[2]*r);N.setXYZ(i,q[0],q[1],q[2]);}
  g.userData.keep=true;return GC[k]=g;}
const UB={};const ubox=r=>UB[r]||(UB[r]=rbox(1,1,1,r));
function bx(x,y,z,w,h,d,c,p,ry){const m=new T.Mesh(rbox(w,h,d),mt(c));m.position.set(x,y+h/2,z);if(ry)m.rotation.y=ry;m.castShadow=m.receiveShadow=true;(p||root).add(m);return m;}
function cyl(x,y,z,rt,rb,h,c,p,seg){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||14),mt(c));m.position.set(x,y+h/2,z);m.castShadow=m.receiveShadow=true;(p||root).add(m);return m;}
function cone(x,y,z,r,h,c,p,seg){const m=new T.Mesh(new T.ConeGeometry(r,h,seg||6),(c&&c.isMaterial)?c:M(c,{flatShading:true}));m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;(p||root).add(m);return m;}
function prismGeo(w,h,d){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.lineTo(-w/2,0);const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g;}
function prism(x,y,z,w,h,d,c,p,ry){const m=new T.Mesh(prismGeo(w,h,d),(c&&c.isMaterial)?c:M(c,{flatShading:true}));m.position.set(x,y,z);if(ry)m.rotation.y=ry;m.castShadow=m.receiveShadow=true;(p||root).add(m);return m;}
function plane(x,y,z,w,d,c,p){const m=new T.Mesh(new T.PlaneGeometry(w,d).rotateX(-Math.PI/2),mt(c));m.position.set(x,y,z);m.receiveShadow=true;(p||root).add(m);return m;}
function line(pts,c,p){const g=new T.BufferGeometry().setFromPoints(pts.map(a=>new V3(a[0],a[1],a[2])));const l=new T.Line(g,new T.LineBasicMaterial({color:c}));l.userData.own=true;(p||root).add(l);return l;}
function item(x,y,z,sx,sy,sz,c,ry,rx,rz){IT.push([x,y,z,sx,sy,sz,c,rx||0,ry||0,rz||0]);}
const _m=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_v=new V3(),_s=new V3();
function flush(){
  if(IT.length){const im=new T.InstancedMesh(ubox(.12),M(0xffffff),IT.length);const col=new T.Color();
    IT.forEach((a,i)=>{_e.set(a[7],a[8],a[9]);_q.setFromEuler(_e);_m.compose(_v.set(a[0],a[1]+a[4]/2,a[2]),_q,_s.set(a[3],a[4],a[5]));im.setMatrixAt(i,_m);im.setColorAt(i,col.set(a[6]));});
    im.castShadow=true;im.receiveShadow=true;root.add(im);IT=[];}
  const win=(list,m)=>{if(!list.length)return;const im=new T.InstancedMesh(new T.PlaneGeometry(1,1),m,list.length);list.forEach((a,i)=>{_q.setFromAxisAngle(_v.set(0,1,0),a[3]);_m.compose(new V3(a[0],a[1],a[2]),_q,_s.set(a[4],a[5],1));im.setMatrixAt(i,_m);});root.add(im);};
  win(WL,E(0xffb45e));win(WD,M(0x0d1217,{roughness:.3,metalness:.5}));WL=[];WD=[];
}
function texText(lines,o){o=o||{};const w=o.w||512,h=o.h||128;const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');
  if(o.bg){g.fillStyle=o.bg;g.fillRect(0,0,w,h);}g.fillStyle=o.fg||'#e8dfcf';g.font=o.font||'700 56px "Arial Narrow", Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';
  const L=Array.isArray(lines)?lines:[lines];const f0=g.font;L.forEach((t,i)=>{g.font=f0;const mw=g.measureText(t).width;if(mw>w*.92)g.font=f0.replace(/(\d+(?:\.\d+)?)px/,(m,n)=>(n*w*.92/mw).toFixed(1)+'px');g.fillText(t,w/2,h/2+(i-(L.length-1)/2)*(h/L.length));});
  if(o.drip){g.fillStyle=o.fg;for(let i=0;i<14;i++){const x=R()*w;g.fillRect(x,h*.62,3,R()*h*.35);}}
  const t=new T.CanvasTexture(cv);t.anisotropy=4;return t;}
function sign(lines,x,y,z,w,h,ry,o,p){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texText(lines,o),transparent:true}));m.userData.own=true;m.position.set(x,y,z);if(ry)m.rotation.y=ry;(p||root).add(m);return m;}
function pl(x,y,z,c,i,d,flick){const L=new T.PointLight(c,i,d,2);L.position.set(x,y,z);root.add(L);if(flick)ANIM.push(t=>{L.intensity=i*(Math.sin(t*23+x)>.3||Math.sin(t*3.1)>.85?.15:1);});return L;}
function pin(x,y,z,k,label,detail){PINS.push({p:new V3(x,y,z),k,label,detail});}
function blood(x,z,s,y){const m=new T.Mesh(new T.CircleGeometry(.5,9).rotateX(-Math.PI/2),M(0x4a0806,{roughness:.2,metalness:.1,flatShading:false}));m.position.set(x,(y||0)+.02+R()*.004,z);m.scale.set(s*(.8+R()*.5),1,s*(.6+R()*.5));m.rotation.y=R()*6;m.receiveShadow=true;root.add(m);}
function fire(x,y,z,s){s=s||1;const geo=new T.IcosahedronGeometry(.32*s,0);const C=[new T.Color(0xfff0a0),new T.Color(0xff8a2a),new T.Color(0xc23a12),new T.Color(0x2a2220)];const P=[];
  for(let i=0;i<16;i++){const m=new T.MeshBasicMaterial({color:0xffa040,transparent:true,depthWrite:false});const o=new T.Mesh(geo,m);o.userData.own=true;root.add(o);P.push([o,R(),(R()-.5)*.7*s,(R()-.5)*.7*s,.8+R()*.5]);}
  const em=[];for(let i=0;i<10;i++){const o=new T.Mesh(new T.BoxGeometry(.05,.05,.05),E(0xffb050));root.add(o);em.push([o,R(),(R()-.5)*2,(R()-.5)*2]);}
  const c=new T.Color();const L=(LB-->0)?pl(x,y+1.2*s,z,0xff7a2a,2.4*s,14*s):null;smoke(x,y+2.2*s,z,7,.45*s);
  const step=t=>{P.forEach(([o,ph,ox,oz,sp])=>{const k=(t*.9*sp+ph)%1;o.position.set(x+ox*(1-k*.5)+Math.sin(t*3+ph*9)*.08*s,y+.15*s+k*1.9*s,z+oz*(1-k*.5));o.scale.setScalar((1.1-k*.55)*(k<.1?k*10:1));
      const u=k*3,j=Math.min(2,Math.floor(u));c.copy(C[j]).lerp(C[j+1],u-j);o.material.color.copy(c);o.material.opacity=k<.66?.9:.9*(1-(k-.66)/.34);o.rotation.set(t*2+ph,t+ph,0);});
    em.forEach(([o,ph,dx,dz])=>{const k=(t*.5+ph)%1;o.position.set(x+dx*k*s*.8,y+.4*s+k*4*s,z+dz*k*s*.8);o.visible=k<.85;});
    if(L)L.intensity=2.4*s*(.75+Math.sin(t*17)*.15+Math.sin(t*7.3)*.1);};
  step(0);ANIM.push(step);}

// ---------- personagens
const CLOTH=[0x4a4038,0x3b4652,0x5a2a26,0x3f4a36,0x6a6458,0x2c2f35,0x7a6a4a,0x5b5f66,0x6b3b2b];
const PANTS=[0x2a2d33,0x3a3328,0x4a4a52,0x2f3a2c,0x24262b];
const ZSKIN=[0x7d8a6a,0x8a8f74,0x6f7a63,0x8d8070];
const HSKIN=[0xc49a74,0x8d5f3e,0xe0b896,0x6a4530];
const EYE={w:0xf2e86a,r:0xff3a2a,b:0xff8c1a};
// corpo arredondado (guia de estilo do corpo: tronco torneado, membros afinados com juntas esféricas)
let FG=null;
function figGeo(){if(FG)return FG;const k=g=>{g.userData.keep=true;return g;};
  const prof=[[.001,0],[.15,0],[.165,.08],[.135,.24],[.17,.4],[.2,.54],[.17,.62],[.07,.66],[.001,.66]].map(p=>new T.Vector2(p[0],p[1]));
  const tor=k(new T.LatheGeometry(prof,12));tor.scale(1.12,1,.66);
  const limb=(r1,r2,l)=>k(new T.CylinderGeometry(r1,r2,l,8,1).translate(0,-l/2,0));
  FG={tor,thigh:limb(.1,.074,.43),shin:limb(.074,.054,.4),arm:limb(.062,.05,.3),fore:limb(.05,.04,.28),neck:limb(.05,.055,.1),
    joint:k(new T.SphereGeometry(1,8,6)),head:k(new T.SphereGeometry(.12,12,10)),foot:k(new T.SphereGeometry(1,8,6))};return FG;}
function figure(x,z,ry,p,o){
  o=o||{};const t=o.t||'w',human=!!o.human,G=figGeo();
  const g=grp(x,o.y||0,z,ry,p);const s=t==='b'?1.25:t==='c'?.66:(.92+R()*.16);g.scale.setScalar(s);if(t==='b')g.scale.x=g.scale.z=s*1.2;
  const skin=o.skin||(human?pick(HSKIN):pick(ZSKIN)),cloth=o.cloth||pick(CLOTH),pants=o.pants||pick(PANTS);
  const ms=M(skin),mc=M(cloth),mp=M(pants);
  const mesh=(geo,m,par,px,py,pz,sx,sy,sz)=>{const e=new T.Mesh(geo,m);e.position.set(px||0,py||0,pz||0);if(sx)e.scale.set(sx,sy,sz);e.castShadow=(geo===G.tor||geo===G.shin||geo===G.head)&&!sx;par.add(e);return e;};
  const lean=human?0:(t==='r'?.42:.1+R()*.14);const RL=[],RA=[];
  for(const sd of[-1,1]){const th=grp(sd*.1,.86,0,0,g);
    th.rotation.x=human?0:(t==='r'?sd*.55:sd*.18+(R()-.5)*.14);mesh(G.thigh,mp,th);mesh(G.joint,mp,th,0,-.43,0,.074,.074,.074);
    const kn=grp(0,-.43,0,0,th);kn.rotation.x=human?0:Math.max(0,-th.rotation.x)*1.1+.05;RL.push([th,kn,th.rotation.x,kn.rotation.x,sd]);mesh(G.shin,mp,kn);mesh(G.foot,M(0x22201e),kn,0,-.41,.05,.06,.045,.12);}
  const tor=grp(0,.84,0,0,g);tor.rotation.x=lean;tor.rotation.z=human?0:(R()-.5)*.14;
  mesh(G.tor,mc,tor);
  if(!human){const b=mesh(G.joint,M(0x4a0806),tor,(R()-.5)*.14,.3+R()*.2,.115,.07,.06,.02);b.rotation.z=R()*3;}
  if(o.vest)mesh(G.tor,M(o.vest),tor,0,.02,0,1.06,.92,1.12);
  mesh(G.neck,ms,tor,0,.74,0);
  const hd=grp(0,.8,.01,0,tor);hd.rotation.x=human?0:-lean*.6+(R()-.5)*.3;hd.rotation.z=human?0:(R()-.5)*.5;
  mesh(G.head,ms,hd,0,.02,0,.95,1.1,1.02);mesh(G.joint,ms,hd,0,-.06,.03,.08,.05,.08);
  if(o.hat)mesh(G.joint,M(o.hat),hd,0,.1,0,.13,.06,.13);
  if(!human){const e=mesh(G.joint,E(EYE[t]||EYE.w),hd,0,.04,.105,.07,.012,.01);e.castShadow=false;}
  else for(const sd of[-1,1])mesh(G.joint,M(0x111111),hd,sd*.04,.04,.108,.012,.012,.01);
  for(const sd of[-1,1]){const a=grp(sd*.215,.58,0,0,tor);
    a.rotation.x=human?(o.aim?-1.45:-.08):(o.dead?0:(R()<.15?-.1:-(1.1+R()*.5)));a.rotation.z=sd*(human?.08:.12);
    mesh(G.joint,mc,a,0,0,0,.075,.075,.075);mesh(G.arm,mc,a);mesh(G.joint,ms,a,0,-.3,0,.05,.05,.05);
    const fa=grp(0,-.3,0,0,a);fa.rotation.x=human?(o.aim?0:-.15):-(R()*.35);RA.push([a,fa,a.rotation.x,fa.rotation.x,sd]);mesh(G.fore,ms,fa);mesh(G.joint,ms,fa,0,-.3,0,.05,.06,.035);
    if(human&&o.aim&&sd>0){bx(0,-.36,-.02,.06,.07,.7,0x1c1d1f,fa);}}
  if(!o.dead&&!o.still)gait(g,t,human,o,RL,RA,tor,hd,ry);
  if(o.dead){g.rotation.x=-Math.PI/2;g.rotation.z=(R()-.5)*.6;g.position.y=(o.y||0)+.17;}
  if(o.chained){line([[x,(o.y||0)+1.2,z],[o.cx,1.0,o.cz]],0x777777);}
  return g;
}
function dog(x,z,ry){const g=grp(x,0,z,ry);const c=0x5a4a3a;bx(0,.35,0,.34,.34,.9,c,g);bx(0,.5,.5,.26,.26,.34,c,g);bx(0,.52,.7,.18,.03,.02,E(EYE.r),g);for(const a of[-1,1])for(const b of[-1,1])bx(a*.12,0,b*.33,.08,.36,.08,c,g);const t=bx(0,.6,-.5,.06,.06,.32,c,g);t.rotation.x=.6;bx(0,.48,.2,.36,.06,.2,0x3a0a08,g);return g;}
let BLD=[];
// movimentação: Lento arrasta uma perna e balança, Corredor corre inclinado e bombeia os braços, Brutamonte pesa de lado a lado.
// o.walk=true anda de verdade na direção em que olha (velocidades do Bestiário) e volta ao início depois de o.wlen metros.
const GAIT={w:{f:1.5,l:.34,a:.12,r:.09,v:1.4},r:{f:5.2,l:.85,a:.6,r:.05,v:5.5},b:{f:1.1,l:.26,a:.1,r:.16,v:1.1},c:{f:2,l:.4,a:.15,r:.08,v:1.6},h:{f:2.2,l:.5,a:.35,r:.03,v:1.5}};
function gait(g,t,human,o,RL,RA,tor,hd,ry){const P=GAIT[human?'h':t]||GAIT.w,mv=!!o.walk,ph0=R()*6.28,x0=g.position.x,z0=g.position.z,len=o.wlen||30,fx=Math.sin(ry||0),fz=Math.cos(ry||0),v=(o.v||P.v),tr0=tor.rotation.z,hr0=hd.rotation.x,ty0=tor.position.y,dist0=R()*len;
  const f=mv?P.f*(v/P.v):P.f*.35,k=mv?1:(human?0:.18);
  ANIM.push(tt=>{const q=tt*f*2+ph0,s1=Math.sin(q);
    for(const[th,kn,b0,k0,sd]of RL){const d=(!human&&t==='w'&&sd<0)?.45:1;const w=Math.sin(q+(sd>0?0:Math.PI));th.rotation.x=b0+w*P.l*k*d;kn.rotation.x=k0+Math.max(0,-Math.cos(q+(sd>0?0:Math.PI)))*P.l*1.3*k*d;}
    for(const[a,fa,b0,k0,sd]of RA){const w=Math.sin(q+(sd>0?Math.PI:0));a.rotation.x=b0+w*P.a*(mv||human?1:.4)+(human?0:Math.sin(tt*1.3+sd)*.04);}
    tor.rotation.z=tr0+s1*P.r*(mv?1:.6);tor.position.y=ty0+Math.abs(Math.cos(q))*.03*k;hd.rotation.x=hr0+Math.sin(q*.5)*.06*(human?.3:1);
    if(mv){const dd=(tt*v+dist0)%len;g.position.x=x0+fx*dd;g.position.z=z0+fz*dd;}});}
const zombie=(x,z,ry,t,p,o)=>figure(x,z,ry,p,Object.assign({t},o||{}));
const human=(x,z,ry,p,o)=>figure(x,z,ry,p,Object.assign({human:true},o||{}));
function horde(n,x0,x1,z0,z1,face,o){for(let i=0;i<n;i++){const r=R();zombie(lerp(x0,x1,R()),lerp(z0,z1,R()),(face===undefined?R()*6.28:face+(R()-.5)*.9),r<.65?'w':r<.93?'r':'b',null,o);}}

// ---------- mobília
function sofa(x,z,ry,c){const g=grp(x,0,z,ry);bx(0,0,0,2.1,.45,.9,c,g);bx(0,.45,-.35,2.1,.5,.22,c,g);bx(-1,.45,0,.2,.3,.9,c,g);bx(1,.45,0,.2,.3,.9,c,g);return g;}
function bed(x,z,ry,dbl,c){const w=dbl?1.6:1.0;const g=grp(x,0,z,ry);bx(0,0,0,w,.35,2.0,0x5b4030,g);bx(0,.35,0,w-.05,.2,1.9,0xd8d2c4,g);bx(0,.55,.25,w-.03,.06,1.4,c||0x5a3a3a,g);bx(0,.55,-.75,w*.8,.12,.35,0xeeeeee,g);bx(0,0,-1.02,w,.9,.06,0x4a3324,g);return g;}
function table(x,z,w,d,c,chairs){const g=grp(x,0,z,0);bx(0,.72,0,w,.06,d,c||0x6b4a30,g);for(const a of[-1,1])for(const b of[-1,1])bx(a*(w/2-.06),0,b*(d/2-.06),.06,.72,.06,c||0x6b4a30,g);
  if(chairs)for(let i=0;i<chairs;i++){const side=i%2?1:-1,off=(Math.floor(i/2)-(Math.ceil(chairs/2)-1)/2)*.7;const ch=grp(off,0,side*(d/2+.35),side>0?Math.PI:0,g);if(R()<.25){ch.rotation.z=1.5;ch.position.y=.25;}bx(0,.42,0,.42,.05,.42,0x4a3324,ch);bx(0,.47,-.2,.42,.5,.05,0x4a3324,ch);for(const a of[-1,1])for(const b of[-1,1])bx(a*.18,0,b*.18,.04,.42,.04,0x4a3324,ch);}
  return g;}
function shelf(x,z,len,along,h,c,fill,cols,depth){depth=depth||.45;const g=grp(x,0,z,0);const W=along==='x'?len:depth,D=along==='x'?depth:len;bx(0,0,0,W,h,D,c||0x5d6063,g).material=mt(c||0x5d6063);
  const n=Math.floor(h/.45);for(let k=1;k<=n;k++){const y=k*.42-.02;for(let i=0;i<len/.22;i++){if(R()>fill)continue;const u=-len/2+.12+i*.22;const s=[.14+R()*.06,.16+R()*.14,.14];item(x+(along==='x'?u:(depth/2+.06)*(c===null?0:1)*0),y,z+(along==='x'?(depth/2+.05):u),along==='x'?s[0]:s[2],s[1],along==='x'?s[2]:s[0],pick(cols));}}
  return g;}
function shelfItems(x,z,len,along,h,fill,cols,side){const n=Math.floor(h/.45);for(let k=0;k<n;k++){const y=.05+k*.42;for(let i=0;i<len/.21;i++){if(R()>fill)continue;const u=-len/2+.11+i*.21;const sy=.14+R()*.18;
  if(along==='x')item(x+u,y,z+side*.12,.15,sy,.16,pick(cols));else item(x+side*.12,y,z+u,.16,sy,.15,pick(cols));}}}
function rack(x,z,len,along,h,c){const W=along==='x'?len:.5,D=along==='x'?.5:len;for(let k=0;k<=Math.floor(h/.45);k++)bx(x,k*.42,z,W,.04,D,c||0x6e7174);for(const a of[-1,1])for(const b of[-1,1])bx(x+a*(W/2-.03),0,z+b*(D/2-.03),.05,h,.05,c||0x55585b);}
function fridge(x,z,ry,c){const g=grp(x,0,z,ry);bx(0,0,0,.75,1.8,.7,c||0xdedad0,g);bx(.3,1.0,.36,.04,.5,.04,0x888888,g);return g;}
function stove(x,z,ry){const g=grp(x,0,z,ry);bx(0,0,0,.7,.9,.62,0xcac6bc,g);bx(0,.9,0,.7,.04,.62,0x222222,g);return g;}
function counter(x,z,w,d,c,top){bx(x,0,z,w,.88,d,c||0x6b5a48);bx(x,.88,z,w+.04,.05,d+.04,top||0x8a8478);}
function wardrobe(x,z,ry,c){const g=grp(x,0,z,ry);bx(0,0,0,1.4,2.1,.6,c||0x5b4030,g);bx(0,0,.31,.02,2.0,.02,0x2a1d14,g);return g;}
function tv(x,z,ry){const g=grp(x,0,z,ry);bx(0,0,0,1.5,.5,.4,0x3a2a20,g);bx(0,.5,0,1.1,.65,.06,0x111214,g);return g;}
function desk(x,z,ry,pc){const g=grp(x,0,z,ry);bx(0,.74,0,1.4,.05,.7,0x6a6a62,g);bx(-.62,0,0,.06,.74,.66,0x55554e,g);bx(.62,0,0,.06,.74,.66,0x55554e,g);if(pc){bx(0,.79,-.15,.5,.34,.04,0x18191b,g);bx(0,.79,.12,.45,.03,.15,0x2a2a2a,g);}return g;}
function locker(x,z,n,ry,c){const g=grp(x,0,z,ry);for(let i=0;i<n;i++){bx(i*.42,0,0,.4,1.8,.45,c||0x56606a,g);bx(i*.42,1.4,.23,.25,.04,.01,0x22262a,g);}return g;}
function crate(x,z,s,ry){bx(x,0,z,s,s,s,0x6a5236,null,ry);}
function barrel(x,z,c){cyl(x,0,z,.38,.38,.95,c||0x9b1c18,null,10);cyl(x,.62,z,.39,.39,.1,0xd8b02a,null,10);}
function car(x,z,ry,c,o){o=o||{};const g=grp(x,0,z,ry);bx(0,.3,0,1.9,.65,4.3,M(c,{roughness:.55,metalness:.35}),g);bx(0,.95,-.2,1.7,.55,2.2,M(0x15191d,{roughness:.3,metalness:.6}),g);
  for(const a of[-1,1])for(const b of[-1,1])cyl(a*.92,.0,b*1.4,.38,.38,.3,0x111111,g,8).rotation.z=Math.PI/2;
  g.children.slice(-4).forEach(w=>w.position.y=.38);
  if(o.police){bx(0,1.5,-.2,1.0,.14,.3,0x222222,g);const r=bx(-.27,1.55,-.2,.45,.12,.28,E(0xff2020),g),b=bx(.27,1.55,-.2,.45,.12,.28,E(0x2050ff),g);const L=new T.PointLight(0xff2020,1.6,14,2);L.position.set(x,2,z);root.add(L);ANIM.push(t=>{const on=Math.floor(t*4)%2;L.color.setHex(on?0xff2020:0x2050ff);r.visible=!!on;b.visible=!on;});}
  if(o.flip){g.rotation.z=Math.PI;g.position.y=1.6;}
  if(o.side){g.rotation.z=Math.PI/2;g.position.y=.95;}
  return g;}
function bus(x,z,ry,c,o){const g=grp(x,0,z,ry);bx(0,.4,0,2.5,2.6,11,c||0x8a6a2a,g);for(let i=0;i<6;i++)for(const s of[-1,1])bx(s*1.26,1.6,-4.4+i*1.7,.02,1.0,1.4,0x111518,g);for(const a of[-1,1])for(const b of[-4,4]){const w=cyl(a*1.1,.45,b,.45,.45,.35,0x111111,g,8);w.rotation.z=Math.PI/2;}if(o&&o.side){g.rotation.z=Math.PI/2;g.position.y=1.3;}return g;}
function smoke(x,y,z,n,sc){sc=sc||1;const m=M(0x2a2622,{transparent:true,opacity:.42,depthWrite:false});const P=[];for(let i=0;i<(n||9);i++){const o=new T.Mesh(new T.DodecahedronGeometry(1.2+i*.35,0),m);o.position.set(x,y+i*2.2,z);root.add(o);P.push([o,R()*6]);}ANIM.push(t=>{P.forEach(([o,ph],i)=>{const k=((t*.25+ph/6+i/P.length)%1);o.position.y=y+k*22*sc;o.position.x=x+k*6*sc+Math.sin(t+ph)*.6*sc;o.scale.setScalar((.5+k*1.6)*sc);});});}
function lampPost(x,z,dir,on,flick){cyl(x,0,z,.09,.13,6,M(0x2b2d30,{metalness:.5,roughness:.6}));bx(x+dir[0]*.7,5.9,z+dir[1]*.7,dir[0]?1.4:.1,.1,dir[1]?1.4:.1,0x2b2d30);bx(x+dir[0]*1.3,5.75,z+dir[1]*1.3,.5,.18,.5,on?E(0xffc98a):0x3a3a3a);if(on)pl(x+dir[0]*1.3,5.5,z+dir[1]*1.3,0xffa25a,1.6,22,flick);}
function sandbags(x,z,len,along,rows){for(let r=0;r<(rows||3);r++)for(let i=0;i<len/.56;i++){const u=-len/2+.28+i*.56+(r%2)*.28;item(along==='x'?x+u:x,r*.21,along==='x'?z:z+u,along==='x'?.55:.32,.22,along==='x'?.32:.55,0x8a7a5a);}}
function fence(x0,z0,x1,z1,h,c){const L=Math.hypot(x1-x0,z1-z0),n=Math.ceil(L/3);for(let i=0;i<=n;i++){const t=i/n;cyl(lerp(x0,x1,t),0,lerp(z0,z1,t),.05,.05,h,c||0x6a6c6e,null,5);}
  for(const y of[h*.35,h*.65,h*.98])line([[x0,y,z0],[x1,y,z1]],0x8a8c8e);}
function tent(x,z,ry,w,d,c){prism(x,0,z,w,w*.7,d,c||0x4f5638,null,ry);}
function pine(x,z,s,y){s=s||1;y=y||0;cyl(x,y,z,.12*s,.16*s,1*s,0x3a2a1c);const c=pick([0x1f3324,0x24382a,0x1b2d20]);cone(x,y+.8*s,z,1.1*s,2.2*s,c);cone(x,y+2.1*s,z,.8*s,1.8*s,c);}
function tree(x,z,s){s=s||1;cyl(x,0,z,.12*s,.18*s,1.8*s,0x3a2a1c);const m=new T.Mesh(new T.DodecahedronGeometry(1.3*s,0),M(pick([0x34452a,0x3d4a2c,0x2f3d26])));m.position.set(x,2.6*s,z);m.castShadow=true;root.add(m);}
function windowsOn(x,z,w,d,h,base,litP){const floors=Math.max(1,Math.floor((h-1)/3));const faces=[[0,d/2+.03,w,0],[0,-d/2-.03,w,Math.PI],[w/2+.03,0,d,Math.PI/2],[-w/2-.03,0,d,-Math.PI/2]];
  for(const[ox,oz,fw,rot]of faces){const cols=Math.max(1,Math.floor(fw/2.6));for(let f=0;f<floors;f++){const y=base+1.8+f*3;for(let c=0;c<cols;c++){const u=(c-(cols-1)/2)*2.6;const px=ox?x+ox:x+u,pz=ox?z+u:z+oz;(R()<(litP||.07)?WL:WD).push([px,y,pz,rot,1.2,1.4]);}}}}
function building(x,z,w,d,h,c,o){o=o||{};BLD.push({x,z,w,d,h});bx(x,0,z,w,h,d,c);bx(x,h,z,w+.3,.35,d+.3,0x2a2a2c);if(R()<.4)cyl(x+(R()-.5)*(w-3),h+.35,z+(R()-.5)*(d-3),.8,.8,1.4,0x4b4540);
  const shop=o.shop&&R()<o.shop;if(shop){for(const f of[1,-1]){const zf=z+f*(d/2);bx(x,4.5,zf+f*.8,w,.2,1.6,0x2a2a2c);bx(x,0,zf+f*.03,w*.6,3.5,.05,0x4a4c4e);sign(pick(['FARMÁCIA','MAGAZINE','LOTÉRICA','PADARIA','ÓTICA','CALÇADOS','BAR']),x,5.3,zf+f*.12,Math.min(w*.7,8),1,f>0?0:Math.PI,{bg:'#1a1a1c',fg:pick(['#ffd27a','#e8dfcf','#c4483b'])});}}
  windowsOn(x,z,w,d,h,shop?4.5:0,o.lit);}
function house(x,z,w,d,c,roof,ry,o){o=o||{};const g=grp(x,0,z,ry);bx(0,0,0,w,3,d,c,g);prism(0,3,0,w+.5,1.6,d+.5,roof||0x5a3a2a,g);bx(0,0,d/2+.02,1,2.1,.05,0x2a1d14,g);
  for(const s of[-1,1]){const wm=bx(s*w*.28,1.1,d/2+.03,1.1,1.1,.04,R()<.15?E(0xffb45e):M(0x10151b),g);if(o.boarded||R()<.3){for(const k of[-1,1]){const p=bx(s*w*.28,1.5+k*.25,d/2+.08,1.3,.14,.04,0x6b4a2a,g);p.rotation.z=k*.15;}}}return g;}
function ground(c,s){plane(0,0,0,s||600,s||600,c||0x15181a);}
function road(x,z,w,l,along){const g=plane(x,.02,z,along==='x'?l:w,along==='x'?w:l,0x222428);for(let u=-l/2+2;u<l/2;u+=5)item(along==='x'?x+u:x,.025,along==='x'?z:z+u,along==='x'?1.8:.16,.01,along==='x'?.16:1.8,0x8f7f4f);return g;}
function walk(x,z,w,d){bx(x,0,z,w,.15,d,0x3a3b3c).castShadow=false;}

// ---------- ambiente
let HORA='cena',LANTERNA=null;
function env(kind,sh){
  if(HORA!=='cena')kind=(kind==='inside'?'inside':'')+(HORA==='dia'?'Dia':'Noite');
  const fd=.5/(sh||60);
  const P={
    Dia:{bg:0x8c9196,fog:['e',fd],hemi:[0xb8c0c8,0x3a3a30,1.0],sun:[0xe8e2d4,.85,[-60,90,40]]},
    Noite:{bg:0x04060a,fog:['e',fd*1.2],hemi:[0x3a4c68,0x0c0c0a,.66],sun:[0x8aa6d6,.42,[-40,60,-25]]},
    insideDia:{bg:0x1a1d22,fog:null,hemi:[0x8a96a8,0x2a2620,.8],sun:[0xd8d4c8,.7,[-14,22,-12]]},
    insideNoite:{bg:0x020304,fog:null,hemi:[0x26324a,0x050505,.22],sun:[0x6a86b6,.16,[-14,22,-12]]},
    night:{bg:0x0b1018,fog:['e',.0042],hemi:[0x4a5c7a,0x14140f,.95],sun:[0x9ab6e6,.75,[-40,60,-25]]},
    dusk:{bg:0x2a2a30,fog:['l',300,800],hemi:[0x6d7486,0x2a2418,.75],sun:[0xd9925a,1.05,[-160,110,90]]},
    inside:{bg:0x07090c,fog:null,hemi:[0x40506a,0x0b0a09,.42],sun:[0x8aa6d6,.38,[-14,22,-12]]},
    fogRiver:{bg:0x5a6470,fog:['e',.02],hemi:[0x9aa8b8,0x2a2a24,.85],sun:[0xb8c0c8,.45,[-60,50,40]]},
    grey:{bg:0x4e555e,fog:['e',.0075],hemi:[0x9aa4b0,0x2a2a24,.8],sun:[0xc8c8c0,.5,[-40,70,30]]},
    dawn:{bg:0x34343a,fog:['e',.0055],hemi:[0x8890a0,0x302820,.75],sun:[0xe0a070,.95,[-90,70,60]]}
  }[kind];
  scene.background=new T.Color(P.bg);
  scene.fog=P.fog?(P.fog[0]==='e'?new T.FogExp2(P.bg,P.fog[1]):new T.Fog(P.bg,P.fog[1],P.fog[2])):null;
  root.add(new T.HemisphereLight(P.hemi[0],P.hemi[1],P.hemi[2]));
  const d=new T.DirectionalLight(P.sun[0],P.sun[1]);const k=(sh||60)/60;d.position.set(P.sun[2][0]*k,P.sun[2][1]*k,P.sun[2][2]*k);d.castShadow=true;d.shadow.mapSize.set(2048,2048);
  LANTERNA=null;if(kind==='Noite'||kind==='insideNoite'){LANTERNA=new T.SpotLight(0xfff2d8,2.2,0,.32,.55,1.2);root.add(LANTERNA);root.add(LANTERNA.target);}
  Object.assign(d.shadow.camera,{left:-(sh||60),right:sh||60,top:sh||60,bottom:-(sh||60),near:1,far:(sh||60)*5});d.shadow.bias=-.0006;root.add(d);root.add(d.target);
}

// ---------- quarto em corte (paredes do fundo e da esquerda inteiras, frente e direita baixas)
function room(w,d,h,wallC,floorC,o){o=o||{};h=h||2.8;const t=.16,low=.55;
  plane(0,.01,0,w,d,floorC||0x5e5448);
  bx(0,0,-d/2+t/2,w,h,t,wallC);bx(-w/2+t/2,0,0,t,h,d,wallC);
  bx(w/2-t/2,0,0,t,o.rightFull?h:low,d,wallC);bx(0,0,d/2-t/2,w,low,t,wallC);
  bx(0,-.2,0,w+.4,.2,d+.4,0x2a2826);
}
function wl(x0,z0,x1,z1,h,c){const t=.14;if(Math.abs(x0-x1)<.01)bx(x0,0,(z0+z1)/2,t,h,Math.abs(z1-z0),c);else bx((x0+x1)/2,0,z0,Math.abs(x1-x0),h,t,c);}
function backWin(x,z,w,h,y,boarded){bx(x,y,z+.09,w+.15,h+.15,.04,0x2b2b2d);const g=bx(x,y+.07,z+.1,w,h,.03,E(0x22344a));if(boarded)for(let k=0;k<3;k++){const p=bx(x,y+.2+k*(h/3),z+.15,w+.3,.16,.05,0x6b4a2a);p.rotation.z=(R()-.5)*.3;}return g;}
function leftWin(x,z,w,h,y,boarded){bx(x+.09,y,z,.04,h+.15,w+.15,0x2b2b2d);bx(x+.1,y+.07,z,.03,h,w,E(0x22344a));if(boarded)for(let k=0;k<3;k++){const p=bx(x+.15,y+.2+k*(h/3),z,.05,.16,w+.3,0x6b4a2a);p.rotation.x=(R()-.5)*.3;}}
function glass(x,z,n,s){for(let i=0;i<n;i++)item(x+(R()-.5)*s,0,z+(R()-.5)*s,.05+R()*.15,.01,.05+R()*.12,0x9fc4d8,R()*3);}
function papers(x,z,n,s){for(let i=0;i<n;i++)item(x+(R()-.5)*s,0,z+(R()-.5)*s,.22,.01,.3,0xb8b1a0,R()*3);}
function casings(x,z,n,s){for(let i=0;i<n;i++)item(x+(R()-.5)*s,0,z+(R()-.5)*s,.03,.03,.07,0xc9a24a,R()*3);}
const FOOD=[0xc0392b,0xe67e22,0xf1c40f,0x2e86c1,0x27ae60,0xecf0f1,0x8e44ad,0xd35400];
const MEDS=[0xf4f6f7,0x5dade2,0xa9cce3,0xf5b7b1,0x82e0aa,0xfdfefe];
const BOOKS=[0x6b3b2b,0x2c4a5a,0x4a5a2c,0x7a6a4a,0x3a3a5a,0x8a2a2a];

// =====================================================================
// MUNDO
// =====================================================================
// traçados gerados de mapa/mundo-terreno.json (mesmo sistema de px do mapa)
const RIOS={"Rio Turvo":[[630,152],[560,215],[470,265],[420,330],[360,390],[318,450],[330,520],[380,610],[420,680],[470,800]],"Rio Claro":[[800,255],[760,300],[720,350],[680,400],[660,440],[640,480],[600,540],[540,610],[480,665],[422,684]],"Córrego do Corvo":[[170,20],[185,90],[205,150],[235,215],[275,280],[320,340],[360,390]],"Ribeirão das Pedras":[[0,470],[90,478],[180,468],[260,455],[318,450]]};
const RIO_W={"Rio Turvo":[2,9],"Rio Claro":[1.5,5],"Córrego do Corvo":[1,4],"Ribeirão das Pedras":[1,4]};
const RIVER=RIOS["Rio Turvo"];
const LAGOS={"Represa do Turvo":[630,95,75,55],"Lagoa Escura":[300,640,38,24],"Açude da Cooperativa":[150,660,16,11],"Cava da Pedreira":[742,505,11,8]};
const ESTRADAS={"BR-101 (leste-oeste)":[[[0,570],[130,565],[330,400],[490,360],[650,420],[800,430]],true],"BR-Norte":[[[410,290],[300,100],[280,0]],true],"BR-Sul":[[[410,440],[470,700],[480,800]],true],"Estrada da Mansão":[[[140,310],[150,230],[165,145]],false],"Estrada da Penitenciária":[[[330,360],[160,300]],false],"Estrada do Quartel":[[[490,330],[620,230]],false],"Estrada da Mata":[[[655,425],[730,640]],false],"Estrada de Campo Largo":[[[130,565],[240,760]],false],"Estrada do Oeste":[[[0,380],[140,310]],false],"Estrada da Represa":[[[620,230],[630,152]],false]};
const FERROVIAS={"Linha Tronco":[[20,640],[200,600],[400,470],[640,430],[790,360]],"Ramal da Serra":[[640,430],[610,330],[585,250],[540,205],[480,170],[420,135],[360,105],[320,95]],"Ramal do Porto":[[440,463],[462,570],[492,650],[500,700]]};
const TUNEIS=[["Túnel do Espinhaço","Ramal da Serra",[470,164],[420,135],"ferroviário"],["Túnel da Pedra Furada","Ramal da Serra",[362,106],[338,99],"ferroviário"],["Túnel da BR-Norte","BR-Norte",[336,162],[318,131],"rodoviário"]];
const LINHAS_TX=[[[630,150],[560,230],[470,300],[420,330]],[[630,150],[700,260],[690,330],[665,420]]];
const LUGARES=[["Represa do Turvo","agua",598,92,"Lago da hidrelétrica, fechado por uma barragem de 1,6 km, com a Ilha do Farol no meio. Barco é o jeito seguro de cruzar. A ilha é a base mais segura do mapa, mas não tem comida: tudo vem de barco."],["Lagoa Escura","agua",300,640,"Lagoa funda e escura ao sul de Santa Aurora, com o Brejo do Sapo na margem sudoeste. Pesca e água em quantidade. Zumbis afogados ficam no fundo e agarram quem nada."],["Brejo do Sapo","agua",262,668,"Pântano raso com taboa alta, árvores mortas e passarelas de madeira podre. Todo mundo anda a 60%, inclusive zumbis. A visão cai para 30 m e a lama faz barulho. Bom para despistar a horda, ruim para fugir."],["Açude da Cooperativa","agua",150,660,"Açude de irrigação perto de Campo Largo, com bomba a diesel e casa do caseiro. Água para plantação. A bomba precisa de diesel para irrigar a horta da base."],["Cachoeira do Véu","agua",200,138,"Queda do Córrego do Corvo descendo a serra, com poço embaixo e trilha atrás da água. O barulho da água abafa o seu (raio de ruído cai pela metade). Atrás da queda há uma gruta pequena com um esconderijo."],["Rio Claro","agua",720,350,"Segundo rio do vale. Desce de nordeste, corta Três Pontes e deságua no Turvo em Porto Turvo. Dá nome às três pontes da cidade. Raso o bastante para vadear em dois pontos marcados por pedras."],["Córrego do Corvo","agua",245,230,"Afluente do Turvo que desce da serra pela Cachoeira do Véu e entra em Santa Aurora na Ponte Velha. Água corrente para beber depois de ferver. Leito raso: zumbis atravessam, mas devagar."],["Ribeirão das Pedras","agua",120,476,"Afluente do Turvo que vem dos campos do oeste, passando pela Ponte das Pedras. Alaga com chuva forte e corta a BR-101 a oeste da cidade."],["Gruta do Corvo","subsolo",130,95,"Caverna calcária com duas entradas (uma escondida no mato), salão com lago subterrâneo e morcegos. Escuridão total: lanterna e pilha viram recurso. Atravessa a serra por baixo. Um eremita vive no salão do lago."],["Mina São Jorge","subsolo",455,70,"Mina de ouro desativada. Galerias escoradas com madeira, trilho de vagonete, poço com elevador e paiol de dinamite. Fonte de dinamite e ferramentas. O elevador precisa de gerador. Escoras quebram com tiro e derrubam o teto sobre a horda (ou sobre você)."],["Lapa da Onça","subsolo",745,720,"Abrigo de rocha na Mata Funda, com pinturas rupestres e um ninho de rastejantes. Covil de zumbis rastejantes. Limpo, vira abrigo seco e escondido para uma base pequena."],["Galerias pluviais de Santa Aurora","subsolo",400,395,"Túneis de concreto de 2 m de altura sob o centro, com bueiros na rua e saída no Rio Turvo. Atravessar o centro sem passar pela rua. Alagam com chuva forte: dá para ficar preso."],["Bunker da Base 7º BIS","subsolo",645,248,"Abrigo de comando sob o quartel, com sala de rádio, arsenal e enfermaria. Classe D: porta blindada com gerador e código. O melhor loot militar do jogo e a pista final da evacuação."],["Ponte Velha","travessia",358,393,"Ponte de concreto da BR-101 sobre o Turvo, no centro de Santa Aurora, onde o Córrego do Corvo deságua. Gargalo principal da cidade. Carros batidos formam uma barricada que as hordas empurram."],["Ponte Férrea do Turvo","travessia",329,516,"Ponte ferroviária de treliça logo a sudoeste da cidade, com passarela lateral de serviço. Travessia a pé pela passarela estreita. Um trem pode vir: o jogador ouve o apito 20 s antes."],["Ponte do Quartel","travessia",554,219,"Ponte do ramal ferroviário sobre o Turvo, 240 m antes do portão da Base 7º BIS, com guarita do Exército. Tem cargas de demolição armadas. Explodir corta a rota de horda que desce da serra pelo ramal (a Estrada do Quartel continua aberta)."],["As três pontes de Três Pontes","travessia",668,428,"Rodoviária (BR-101), treliçada (Linha Tronco) e a Ponte de Ferro Velha (Estrada da Mata), todas sobre o Rio Claro. Três rotas paralelas: se uma cai ou entope, a horda procura a próxima."],["Ponte da Foz e Pontilhão do Porto","travessia",478,662,"Rodovia e ramal ferroviário cruzando o Rio Claro antes de Porto Turvo. Entrada norte de Porto Turvo. O pontilhão só passa a pé ou de trem."],["Ponte das Pedras","travessia",264,455,"Ponte baixa da BR-101 sobre o Ribeirão das Pedras, que alaga com chuva forte. Fica submersa na chuva forte: carro não passa; a pé só agarrado ao guarda-corpo, com risco de ser arrastado."],["Ponte pênsil do Véu","travessia",212,162,"Ponte de cordas e tábuas sobre o cânion abaixo da cachoeira. Aguenta 3 pessoas. Cortar as cordas derruba quem estiver nela, zumbi ou jogador."],["Balsa de Porto Turvo","travessia",452,760,"Balsa de cabo que liga as duas margens do Turvo em Porto Turvo. Precisa de diesel e de alguém na manivela de emergência. Zumbis não cruzam o rio sem ela."],["Túnel do Espinhaço","travessia",445,150,"Túnel ferroviário do Ramal da Serra sob a crista, escuro, com um trem de carga parado e a cauda saindo pelo portal sul. Atalho da base até a serra. Lá dentro o som ecoa e atrai tudo. Vagões com carga militar."],["Túnel da Pedra Furada","travessia",350,102,"Túnel curto do ramal, perto da Vila do Corvo, com nichos de manutenção nas paredes. Os nichos são o único lugar para escapar se um trem ou a horda vier."],["Túnel da BR-Norte","travessia",327,146,"Túnel rodoviário de duas pistas na subida da serra, com engavetamento na entrada sul. Só passa a pé ou de moto entre os carros. A luz de emergência pisca e às vezes apaga."],["Engavetamento da BR-101","estrada",560,385,"Fila de 200 carros parados na fuga do dia 1, com ônibus tombado e caminhão-tanque. Loot de estrada em quantidade e uma horda dormente entre os carros. O tanque explode com tiro."],["Trem descarrilado","estrada",520,451,"Trem de passageiros e carga tombado entre Santa Aurora e Três Pontes. Cada vagão é um interior estreito. Vagão-restaurante com comida, vagão postal com cartas e pistas."],["Pedágio do Oeste","estrada",230,482,"Praça de pedágio da BR-101, com cancelas, cofre e posto da polícia rodoviária. Gargalo de estrada fácil de barricar. Viatura com rádio e espingarda."],["Linhas de transmissão","estrada",520,261,"Torres de alta tensão da hidrelétrica até Santa Aurora e Três Pontes. Religar a hidrelétrica exige consertar torres caídas no caminho. Cabo solto no chão dá choque."],["Pedreira Boa Vista","marco",742,505,"Pedreira com cava alagada, britador, esteiras, caminhões fora de estrada e paiol. Explosivos e diesel. A cava tem uma só rampa de acesso: armadilha perfeita para hordas."],["Parque Mundo Mágico","marco",548,480,"Parque de diversões fechado às pressas, com roda-gigante, montanha-russa e trem fantasma. Gerador liga o parque inteiro: luzes e música atraem hordas de quilômetros. Roda-gigante é mirante."],["Área queimada da Mata Funda","marco",718,612,"Floresta carbonizada por um incêndio da semana 1: troncos pretos, cinzas e fumaça. Cinza mostra pegadas (de zumbi e de jogador). Visão longa, sem cobertura nenhuma."],["Torre de vigia florestal","marco",110,40,"Torre de bombeiro florestal no topo da serra oeste, com rádio e binóculo. O ponto mais alto do mapa: mostra hordas e fumaça de outros jogadores a 5 km."],["Mansão Valverde","marco",165,145,"Mansão da família Valverde na borda da mata, a noroeste de Santa Aurora. Jardim morto, cemitério com mausoléu, estufa, canil de cães infectados e alambrado com farpado nos fundos. Classe A + D. Loot raro (chave mestra, ervas, espingarda) e quebra-cabeças (4 brasões, partitura no piano). O mausoléu e o elevador oculto da biblioteca levam ao Laboratório Aurora, onde o vírus era estudado antes do surto."],["Fazenda Santa Clara","marco",35,590,"Fazenda infestada a oeste de Campo Largo: casa sede, celeiro com carcaças, chiqueiro e curral (gado morto, urubus) com alambrado farpado, milharal em labirinto, cata-vento, poço, capela e túmulos da família. Loot rural (ferramentas, querosene, água do cata-vento). Porcos zumbis no chiqueiro e gado morto com urubus no curral; galinhas vivas servem de alarme; um espantalho é zumbi; a barricada de caminhões na entrada é a defesa pronta para uma base."],["Trilha do Véu","marco",178,128,"Trilha da Vila do Corvo (260,100) pela Cachoeira do Véu (200,138) e a ponte pênsil (212,162) até a Gruta do Corvo (130,95), com degraus, corrimão, cabana do caçador, posto da polícia florestal, desabamento e avião caído. Rota a pé pela serra. Fitas vermelhas mostram a rota dos que fugiram. A ponte pênsil aguenta 3 pessoas e cortar as cordas derruba quem estiver nela; perto da cachoeira o barulho da água abafa o seu."]];
const TRILHAS={"Trilha do Véu":[[260,100],[232,120],[200,138],[212,162],[186,146],[156,116],[130,95]],"Trilha da Mina":[[260,100],[320,82],[390,62],[455,70]],"Trilha da Torre":[[130,95],[114,70],[110,40]],"Trilha da Mata Funda":[[690,560],[718,612],[736,668],[745,720]]};
function dPoly(px,py,P){let b=1e9;for(let i=0;i<P.length-1;i++){const[ax,ay]=P[i],[bx_,by]=P[i+1];const dx=bx_-ax,dy=by-ay;const t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy),0,1);const d=Math.hypot(px-ax-t*dx,py-ay-t*dy);if(d<b)b=d;}return b;}
const CITIES=[
  {n:'Santa Aurora',r:[300,290,500,490],c:900,h:4.2,risk:'alto'},
  {n:'Porto Turvo',r:[400,690,560,790],c:360,h:1.4,risk:'médio'},
  {n:'Três Pontes',r:[600,380,710,470],c:300,h:1.6,risk:'médio'},
  {n:'Campo Largo',r:[80,520,190,610],c:200,h:.9,risk:'baixo'},
  {n:'Vila do Corvo',r:[240,60,330,120],c:110,h:.7,risk:'baixo'}];
const VILLAGES=[[250,200],[460,230],[140,430],[260,500],[560,540],[720,560],[230,720],[775,330],[40,300],[395,575],[680,680],[420,160],[60,720],[560,330]];
function nearRiver(px,py,m){for(const n in RIOS)if(dPoly(px,py,RIOS[n])<m)return true;return false;}
function inBrejo(px,py){return Math.hypot((px-262)/55,(py-668)/35)<1;}
function inQueimada(px,py){return Math.hypot((px-718)/40,(py-612)/20)<1;}
function inRect(px,py,r,m){return px>r[0]-m&&px<r[2]+m&&py>r[1]-m&&py<r[3]+m;}
function forestF(px,py){const serra=sstep(230,60,py)*(px<540?1:sstep(640,540,px));const mf=sstep(600,700,px)*sstep(540,660,py);const patch=sstep(.62,.8,(Math.sin(px*.031)*Math.cos(py*.027)+Math.sin(px*.013+py*.019))*.5+.5)*.8;return Math.max(serra,mf,patch);}
function hW(px,py){
  let h=1.6+Math.sin(px*.021)*Math.cos(py*.018)*1.1+Math.sin(px*.05+py*.03)*.5;
  const serra=sstep(230,40,py)*(px<560?1:sstep(720,560,px));
  h+=serra*(9+3.5*Math.sin(px*.04)*Math.cos(py*.06)+2.5*Math.sin(px*.11+py*.07));
  const mf=sstep(580,720,px)*sstep(520,720,py);h+=mf*(4+2*Math.sin(px*.09)*Math.sin(py*.08));
  for(const c of CITIES){if(c.n==='Vila do Corvo')continue;if(inRect(px,py,c.r,30)){const f=Math.min(sstep(-30,10,Math.min(px-c.r[0],c.r[2]-px,py-c.r[1],c.r[3]-py)),1);h=lerp(h,1.8,f);}}
  const h0=h;for(const n in RIOS){const w=RIO_W[n];const bed=n==='Rio Turvo'?-1.6:Math.max(-1.0,h0-2.2);h=lerp(bed,h,sstep(w[0],w[1],dPoly(px,py,RIOS[n])));}
  for(const n in LAGOS){const[cx,cy,rx,ry]=LAGOS[n];const dl=Math.hypot((px-cx)/rx,(py-cy)/ry);if(dl<1.35)h=lerp(-1.8,h,sstep(.85,1.35,dl));}
  return h;
}
const W2=(px,py)=>[px*.4-160,py*.4-160];
function buildWorld(){
  env('dusk',190);
  const SEG=180,geo=new T.PlaneGeometry(320,320,SEG,SEG);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3),c=new T.Color();
  const FIELDS=[0x5b5a32,0x4a5a2c,0x6a5a38,0x3f4f2a,0x55502e,0x63603a];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),px=(x+160)/.4,py=(z+160)/.4;const h=hW(px,py);pos.setY(i,h);
    const ff=forestF(px,py);let urban=false;for(const ci of CITIES)if(inRect(px,py,ci.r,4))urban=true;
    if(h<.1)c.setHex(0x3a3a2e);else if(inBrejo(px,py))c.setHex(0x34402a);else if(inQueimada(px,py))c.setHex(0x26231f);else if(urban)c.setHex(0x4a4a46);else if(h>9.5)c.setHex(0x5a5a52);else if(ff>.5)c.setHex(0x22321e);else c.setHex(FIELDS[Math.floor(hash(Math.floor(px/16),Math.floor(py/11))*FIELDS.length)]);
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  geo.setAttribute('color',new T.BufferAttribute(col,3));geo.computeVertexNormals();
  const terr=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));terr.userData.own=true;terr.receiveShadow=true;terr.castShadow=true;root.add(terr);
  const water=plane(0,-.35,0,320,320,M(0x2b4452,{roughness:.3,metalness:.25,flatShading:false}));
  // árvores
  const trees=[];for(let i=0;i<9000&&trees.length<4200;i++){const px=R()*800,py=R()*800;const ff=forestF(px,py);if(ff<.5||R()>ff||inQueimada(px,py))continue;let bad=false;for(const ci of CITIES)if(inRect(px,py,ci.r,6))bad=true;if(bad)continue;const h=hW(px,py);if(h<.3)continue;const[x,z]=W2(px,py);trees.push([x,h,z,.6+R()*.8]);}
  const tm=new T.InstancedMesh(new T.ConeGeometry(.9,2.6,5),M(0xffffff),trees.length);const tc=new T.Color();
  trees.forEach((a,i)=>{_m.compose(_v.set(a[0],a[1]+1.2*a[3],a[2]),_q.identity(),_s.set(a[3],a[3],a[3]));tm.setMatrixAt(i,_m);tm.setColorAt(i,tc.setHex(pick([0x1d2e1c,0x23361f,0x1a2919,0x2a3a22])));});tm.castShadow=true;root.add(tm);
  // cidades
  const blds=[];const addB=(px,py,s,h,cc)=>{if(nearRiver(px,py,9))return;const[x,z]=W2(px,py);blds.push([x,Math.max(hW(px,py),0),z,s,h,cc]);};
  const UC=[0x77736a,0x6a665e,0x5d5a54,0x847c6e,0x6e6a64,0x8a8070,0x55524c];
  for(const ci of CITIES){const[x0,y0,x1,y1]=ci.r,cx=(x0+x1)/2,cy=(y0+y1)/2;for(let i=0;i<ci.c;i++){const px=lerp(x0,x1,R()),py=lerp(y0,y1,R());const center=1-Math.min(1,Math.hypot((px-cx)/((x1-x0)/2),(py-cy)/((y1-y0)/2)));addB(px,py,.7+R()*1.1,.35+Math.pow(R(),2)*ci.h*(.35+center*1.6),pick(UC));}}
  for(const[vx,vy]of VILLAGES)for(let i=0;i<14;i++)addB(vx+(R()-.5)*18,vy+(R()-.5)*14,.5+R()*.5,.3+R()*.3,pick(UC));
  for(let i=0;i<24;i++)addB(lerp(588,653,R()),lerp(210,250,R()),.9+R()*1.2,.3+R()*.4,0x4f5638);
  for(let i=0;i<5;i++)addB(lerp(146,174,R()),lerp(296,314,R()),1.6,.5,0x6a6862);
  const bm=new T.InstancedMesh(ubox(.06),M(0xffffff),blds.length);
  blds.forEach((a,i)=>{_m.compose(_v.set(a[0],a[1]+a[4]/2,a[2]),_q.setFromAxisAngle(_v.set(0,1,0),hash(a[0],a[2])*.3),_s.set(a[3],a[4],a[3]*(.7+hash(a[2],a[0])*.6)));bm.setMatrixAt(i,_m);bm.setColorAt(i,tc.setHex(a[5]));});bm.castShadow=true;bm.receiveShadow=true;root.add(bm);
  // muros: base e presídio
  const wall=(px0,py0,px1,py1,h,cc)=>{const[a,b]=W2(px0,py0),[e,f]=W2(px1,py1);const y=Math.max(hW((px0+px1)/2,(py0+py1)/2),0);bx((a+e)/2,y,(b+f)/2,Math.max(Math.abs(e-a),.3),h,Math.max(Math.abs(f-b),.3),cc);};
  wall(583,205,658,205,.5,0x6a6c6e);wall(583,255,658,255,.5,0x6a6c6e);wall(583,205,583,255,.5,0x6a6c6e);wall(658,205,658,255,.5,0x6a6c6e);
  wall(140,291,180,291,1,0x8a867c);wall(140,319,180,319,1,0x8a867c);wall(140,291,140,319,1,0x8a867c);wall(180,291,180,319,1,0x8a867c);
  // represa
  {const[a,b]=W2(630,152);bx(a,-1.5,b,16,4.5,1.6,0x8a8680);}
  // estradas e ferrovia
  const roadPts=(P,lift)=>{const out=[];for(let i=0;i<P.length-1;i++){const[ax,ay]=P[i],[bx_,by]=P[i+1];const n=Math.ceil(Math.hypot(bx_-ax,by-ay)/3);for(let k=0;k<n;k++){const t=k/n,px=lerp(ax,bx_,t),py=lerp(ay,by,t);const[x,z]=W2(px,py);out.push([x,Math.max(hW(px,py),.2)+lift,z]);}}const L=P[P.length-1];const[x,z]=W2(L[0],L[1]);out.push([x,Math.max(hW(L[0],L[1]),.2)+lift,z]);return out;};
  // túneis: trechos da linha que ficam dentro da serra
  const inTun=(name,px,py)=>{for(const t of TUNEIS){if(t[1]!==name)continue;const[A,B]=[t[2],t[3]];const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;const u=((px-A[0])*dx+(py-A[1])*dy)/L2;if(u<0||u>1)continue;if(Math.hypot(px-A[0]-u*dx,py-A[1]-u*dy)<5)return true;}return false;};
  const runs=(P,name,lift)=>{const out=[];let cur=[];for(let i=0;i<P.length-1;i++){const[ax,ay]=P[i],[bx_,by]=P[i+1];const n=Math.ceil(Math.hypot(bx_-ax,by-ay)/3);for(let k=0;k<=n;k++){if(k===n&&i<P.length-2)continue;const t=k/n,px=lerp(ax,bx_,t),py=lerp(ay,by,t);if(inTun(name,px,py)){if(cur.length>1)out.push(cur);cur=[];continue;}const[x,z]=W2(px,py);cur.push([x,Math.max(hW(px,py),.2)+lift,z]);}}if(cur.length>1)out.push(cur);return out;};
  for(const n in ESTRADAS){const[P,main]=ESTRADAS[n];runs(P,n,.3).forEach(r=>line(r,main?0xc9b58a:0x8a7f6a));}
  line(runs([[620,230],[630,152]],'',.3)[0],0x8a7f6a);
  for(const n in TRILHAS)runs(TRILHAS[n],n,.35).forEach(r=>{const g=new T.BufferGeometry().setFromPoints(r.map(a=>new V3(a[0],a[1],a[2])));const l=new T.Line(g,new T.LineDashedMaterial({color:0xd09a5a,dashSize:.6,gapSize:.6}));l.computeLineDistances();l.userData.own=true;root.add(l);});
  for(const n in FERROVIAS)runs(FERROVIAS[n],n,.45).forEach(r=>{const g=new T.BufferGeometry().setFromPoints(r.map(a=>new V3(a[0],a[1],a[2])));const l=new T.Line(g,new T.LineDashedMaterial({color:0xff9d3c,dashSize:2,gapSize:1.2}));l.computeLineDistances();l.userData.own=true;root.add(l);});
  for(const t of TUNEIS)for(const[Q,O]of[[t[2],t[3]],[t[3],t[2]]]){const[x,z]=W2(Q[0],Q[1]);const y=Math.max(hW(Q[0],Q[1]),0);const ang=Math.atan2(O[0]-Q[0],O[1]-Q[1]);const g=grp(x,y-.2,z,ang);bx(0,0,0,2.2,1.6,.5,0x6a665e,g);bx(0,0,.26,1.2,1.1,.05,E(0x050607),g);}
  // pontes onde estrada ou trilho cruza rio
  const segX=(p1,p2,p3,p4)=>{const d=(p2[0]-p1[0])*(p4[1]-p3[1])-(p2[1]-p1[1])*(p4[0]-p3[0]);if(Math.abs(d)<1e-9)return null;const t=((p3[0]-p1[0])*(p4[1]-p3[1])-(p3[1]-p1[1])*(p4[0]-p3[0]))/d,u=((p3[0]-p1[0])*(p2[1]-p1[1])-(p3[1]-p1[1])*(p2[0]-p1[0]))/d;return t>=0&&t<=1&&u>=0&&u<=1?[p1[0]+t*(p2[0]-p1[0]),p1[1]+t*(p2[1]-p1[1]),Math.atan2(p2[0]-p1[0],p2[1]-p1[1])]:null;};
  const LINES=[...Object.keys(ESTRADAS).map(n=>[ESTRADAS[n][0],0x6a665e]),...Object.keys(FERROVIAS).map(n=>[FERROVIAS[n],0x5a3a2a])];
  for(const[P,cc]of LINES)for(const rn in RIOS){const R_=RIOS[rn];for(let i=0;i<P.length-1;i++)for(let j=0;j<R_.length-1;j++){const X=segX(P[i],P[i+1],R_[j],R_[j+1]);if(!X)continue;const[x,z]=W2(X[0],X[1]);const L=rn==='Rio Turvo'?3.4:2.2;const g=grp(x,.5,z,X[2]);bx(0,0,0,.9,.25,L,cc,g);for(const k of[-1,1])bx(0,-1.6,k*L*.3,.3,1.6,.3,0x5a5a56,g);}}
  for(const n of['Córrego do Corvo','Ribeirão das Pedras'])line(runs(RIOS[n],'',0)[0].map(p=>{const px=(p[0]+160)/.4,py=(p[2]+160)/.4;return[p[0],Math.max(hW(px,py)+.15,-.3),p[2]];}),0x5a86a0);
  {const[x,z]=W2(200,138);const y=hW(200,138);bx(x,y-1.5,z,.8,2.2,.1,M(0xcfe0ea,{transparent:true,opacity:.75}));}
  // alta tensão
  for(const P of LINHAS_TX){const pts=[];for(let i=0;i<P.length-1;i++){const n=Math.ceil(Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1])/14);for(let k=0;k<n;k++){const px=lerp(P[i][0],P[i+1][0],k/n),py=lerp(P[i][1],P[i+1][1],k/n);const[x,z]=W2(px,py);const y=Math.max(hW(px,py),0);cyl(x,y,z,.08,.25,2.4,0x8a8c8e,null,4);pts.push([x,y+2.4,z]);}}line(pts,0x9a9c9e);}
  // ilha do farol, brejo e queimada
  {const[x,z]=W2(655,82);cyl(x,0,z,2.6,3.2,1.9,0x3a4a2c,null,10);cyl(x,1.9,z,.25,.3,1.6,0xd8d4c8,null,8);}
  for(let i=0;i<260;i++){const px=262+(R()-.5)*110,py=668+(R()-.5)*70;if(!inBrejo(px,py))continue;const[x,z]=W2(px,py);const y=Math.max(hW(px,py),-.3);if(R()<.25)cyl(x,y,z,.05,.09,1.2+R(),0x3a3428,null,4);else item(x,y,z,.18,.5+R()*.4,.18,pick([0x5a6a3a,0x4a5a2a,0x6a6a3a]));}
  for(let i=0;i<220;i++){const px=718+(R()-.5)*80,py=612+(R()-.5)*40;if(!inQueimada(px,py))continue;const[x,z]=W2(px,py);cyl(x,hW(px,py),z,.06,.1,1.4+R()*1.2,0x141210,null,4);}
  const lab=(px,py,up,k,label,detail)=>{const[x,z]=W2(px,py);pin(x,Math.max(hW(px,py),0)+up,z,k,label,detail);};
  lab(410,365,7,'local','Santa Aurora','Cidade principal, 8 × 8 km, onde o surto começou. Risco alto.');
  lab(480,740,5,'local','Porto Turvo','Porto fluvial e estaleiro. Barcos e frigorífico.');
  lab(655,425,5,'local','Três Pontes','Entroncamento ferroviário. Peças, combustível e trens.');
  lab(135,565,5,'local','Campo Largo','Cidade do agro. Sementes, silos e o avião do aeroclube.');
  lab(285,90,6,'local','Vila do Corvo','Vila de serra. Pousadas e teleférico parado.');
  lab(620,230,4,'perigo','Base 7º BIS','Quartel e evacuação que falhou. Risco máximo, loot militar.');
  lab(160,305,4,'perigo','Penitenciária','Rebelião no dia do surto. Presos zumbis e armaria.');
  lab(630,150,5,'loot','Hidrelétrica','Religar a casa de força devolve energia a partes do mapa.');
  lab(200,60,13,'cena','Serra do Corvo','Mata fechada, eremitas e grupo hostil acampado.');
  lab(700,700,8,'cena','Mata Funda','Floresta do sudeste, caça e esconderijos.');
  lab(470,265,2,'quebra','Rio Turvo','Pontes e balsas são gargalos de horda.');
  const KMAP={agua:'cena',subsolo:'loot',travessia:'quebra',estrada:'perigo',marco:'cena'};
  const SHOW=['Gruta do Corvo','Mina São Jorge','Cachoeira do Véu','Lagoa Escura','Brejo do Sapo','Túnel do Espinhaço','Ponte do Quartel','Trem descarrilado','Engavetamento da BR-101','Pedreira Boa Vista','Parque Mundo Mágico','Área queimada da Mata Funda','Lapa da Onça','Mansão Valverde','Fazenda Santa Clara','Trilha do Véu'];
  for(const L of LUGARES)if(SHOW.includes(L[0]))lab(L[2],L[3],3,KMAP[L[1]],L[0]+' (nº '+(LUGARES.indexOf(L)+1)+')',L[4].split('. ')[0]+'.');
  flush();
}

// =====================================================================
// CIDADES
// =====================================================================
function streetGrid(B,n,rw){for(let k=-n;k<=n;k++){road(k*B,0,rw,B*2*n+rw,'z');road(0,k*B,rw,B*2*n+rw,'x');}
  for(let i=-n;i<n;i++)for(let j=-n;j<n;j++)walk(i*B+B/2,j*B+B/2,B-rw,B-rw);}
function fillBlock(cx,cz,size,hmin,hmax,pal,o){o=o||{};const m=(size-2)/2;const k=o.k||2;const s=(size-2)/k;for(let i=0;i<k;i++)for(let j=0;j<k;j++){if(R()<(o.gap||.08))continue;const w=s-1.2-R()*1.5,d=s-1.2-R()*1.5;const h=lerp(hmin,hmax,Math.pow(R(),1.6));building(cx-m+s*(i+.5),cz-m+s*(j+.5),w,d,h,pick(pal),o);}}
const FAC=[0x3b3f45,0x4a4038,0x35403d,0x463a3a,0x3f3b34,0x2f3439,0x51493f,0x5a564e];
function buildSantaAurora(){
  env('night',90);ground(0x15181a);
  streetGrid(36,2,10);
  for(const[i,j]of[[-54,-54],[-54,-18],[-54,18],[-54,54],[-18,54],[18,54],[54,54],[54,18],[54,-18],[54,-54],[18,-54],[-18,-54],[18,-18],[18,18]])fillBlock(i,j,26,12,36,FAC,{lit:.05,shop:.5});
  // avenida central com canteiro e postes LED (padrão Avenida e centro)
  bx(0,0,0,2,.18,154,0x3a4a2c);
  const nearX=u=>[-72,-36,0,36,72].some(k=>Math.abs(u-k)<8);
  for(let u=-75;u<=75;u+=25){if(nearX(u)||u===25)continue;const on=R()<.7;poleLED(0,u,on,0,on&&R()<.25);}
  for(const k of[-72,-36,36,72])for(let u=-75;u<=75;u+=25){if(nearX(u))continue;for(const sd of[-1,1]){const on=R()<.7;poleLED(k+sd*5.6,u,on,0,on&&R()<.25);}}
  for(const k of[-72,-36,0,36,72])for(let u=-75;u<=75;u+=25){if(nearX(u)||(u>-30&&u<-6&&k===-36))continue;for(const sd of[-1,1]){const on=R()<.7;poleLED(u,k+sd*5.6,on,Math.PI/2,on&&R()<.25);}}
  smoke(1,2,20,10);if(BLD[3])smoke(BLD[3].x,BLD[3].h,BLD[3].z,8);if(BLD[9])smoke(BLD[9].x,BLD[9].h,BLD[9].z,8);
  for(const b of[BLD[3],BLD[9]])if(b)pl(b.x,b.h-2,b.z+b.d/2+1,0xff7a30,1.4,18,true);
  // praça da matriz
  plane(-18,.17,-18,24,24,0x2a3324);
  const ch=grp(-18,0,-22,0);bx(0,.15,0,9,9,14,0x8a8478,ch);prism(0,9.15,0,9.4,4,14.4,0x4a3a30,ch);bx(0,.15,7.5,3.4,17,3.4,0x8a8478,ch);cone(0,17.15,7.5,2.6,5,0x4a3a30,ch,4);bx(0,.15,9.25,1.6,3,.1,0x1a120c,ch);
  for(const[a,b]of[[-26,-11],[-10,-11],[-26,-26],[-10,-26]])tree(a,b,1.2);
  bx(-18,.15,-10,1.4,1.2,1.4,0x7a766c);
  // bloqueio policial no cruzamento
  for(let i=0;i<6;i++){const p=grp(-6+i*2.2,0,6,0);bx(0,0,0,2,.3,.62,0x7a7873,p);bx(0,.3,0,2,.6,.32,0x7a7873,p);}
  car(4,2,1.2,0xe8e8e4,{police:true});car(-5,-3,.4,0xe8e8e4,{police:true});
  bus(1,20,.15,0x8a6a2a,{side:true});fire(1,1,20,2);
  car(-3,32,2.6,0xd8d8d0,{side:true});sign('SAMU',-3,1.6,32.9,1.6,.5,2.6,{fg:'#c4483b',bg:'#d8d8d0'});
  car(14,-2,1.6,0x5a2b26);car(-22,3,-1.4,0x2d3d4a);car(3,-30,.1,0x6b6450);car(-2,48,3,0x3a3f2e,{flip:true});
  sign(['EVACUAÇÃO','PRAÇA DA MATRIZ'],-6,3.2,6.5,4,1.4,0,{bg:'#1a2a3a',fg:'#ffd27a',font:'700 44px Arial'});for(const a of[-1.6,1.6])cyl(-6+a,0,6.45,.06,.06,2.5,0x3a3c3e,null,6);
  for(let i=0;i<70;i++){let x=lerp(-5,5,R()),z=lerp(29,70,R());if(Math.abs(z-32)<3.5&&x<0)x+=5;const r=R()<.75;zombie(x,z,Math.PI+(R()-.5)*.08,r?'r':'w',null,{walk:true,v:r?3:1.4,wlen:Math.max(3,z-28)});}horde(25,8,30,-4,4,-Math.PI/2);
  for(let i=0;i<12;i++){zombie(lerp(-8,8,R()),lerp(-14,30,R()),R()*6,'w',null,{dead:true});blood(lerp(-8,8,R()),lerp(-14,30,R()),1.2);}
  {let n=0,fe=0;for(let i=0;i<BLD.length;i++)for(let j=i+1;j<BLD.length;j++){const a=BLD[i],b=BLD[j];if(Math.abs(a.z-b.z)<.8&&Math.abs(a.x-b.x)<14&&Math.abs(a.h-b.h)<4&&n<14){const y=Math.min(a.h,b.h)+.35;const x0=Math.min(a.x+a.w/2,b.x+b.w/2),x1=Math.max(a.x-a.w/2,b.x-b.w/2);const L=Math.abs(x1-x0)+.8;bx((x0+x1)/2,y,a.z+(R()-.5)*2,L,.08,.5,0x6b4a2a);n++;}}
    BLD.forEach(b=>{if(fe>=12||b.h<9||R()>.35)return;fe++;const fx=b.x+b.w/2+.55;for(let y=3;y<b.h-1;y+=3){bx(fx,y,b.z,1.1,.08,2.6,0x2a2b2d);const st=bx(fx,y-1.5,b.z,.9,.08,2.4,0x2a2b2d);st.rotation.x=(y/3)%2?.6:-.6;}bx(fx+.5,3,b.z,.05,b.h-4,.05,0x2a2b2d);});}
  pin(1,4,20,'perigo','Ônibus em chamas','Bloqueia a avenida e funciona como funil para a horda.');
  pin(-18,14,-22,'local','Igreja Matriz','Ponto de evacuação. O sino atrai hordas de longe.');
  pin(0,3,6,'quebra','Bloqueio policial','Barreiras de concreto e viaturas. Loot de policiais caídos.');
  pin(0,3,52,'perigo','Horda de corredores','Cerca de 70 zumbis descendo a avenida, três em cada quatro correndo.');
  pin(1,22,20,'cena','Fumaça do centro','Incêndios desde o dia 1. A fumaça corta a visão e marca o centro de longe.');
  pin(54,44,54,'cena','Prédios classe C','Torres de fachada com janelas escuras formam o skyline.');
  pin(18,26,18,'local','Rota pelos telhados','Tábuas ligam telhados vizinhos e escadas de incêndio sobem pela lateral. Fuga por cima da horda.');
  pin(-3,3,32,'loot','Ambulância tombada','Kit médico e maca no compartimento traseiro.');
  flush();
  return {r:90,th:.06,ph:.88,t:[0,2,24]};
}
function container(x,y,z,ry,c){const g=grp(x,y,z,ry);bx(0,0,0,2.44,2.6,6.06,M(c,{roughness:.7,metalness:.3}),g);for(let k=-2;k<=2;k++)bx(k*.5,0,3.04,.06,2.6,.04,0x1a1a1a,g);return g;}
function buildPorto(){
  env('fogRiver',90);ground(0x15181a);
  plane(0,-.6,-55,400,90,M(0x22343e,{roughness:.25,metalness:.3,flatShading:false}));
  bx(0,-1,-8,180,1.15,2,0x5a5852);plane(0,.16,25,180,64,0x2e3032);
  const CC=[0x8a2a22,0x2a4a6a,0x3a5a3a,0xa06a2a,0x5a5a5e,0x6a2a4a,0x2a6a6a];
  for(let r=0;r<5;r++)for(let i=0;i<9;i++){const st=(r===0||r===4)?4:1+Math.floor(R()*4);for(let s=0;s<st;s++)container(-50+i*7,.15+s*2.6,6+r*3.2,Math.PI/2,pick(CC));}
  // pórtico
  const gx=20;for(const a of[-1,1])for(const b of[-1,1])bx(gx+a*6,0,b*5+0,.8,22,.8,0xc0902a);bx(gx,22,0,13,1.4,12,0xc0902a);bx(gx,22,-16,2,1.4,32,0xc0902a);bx(gx,16,-10,3,2,3,0x2a2a2a);line([[gx,16,-10],[gx,4,-10]],0x999999);container(gx,1.5,-10,0,0x2a4a6a);
  // barco
  const bt=grp(-20,-.6,-24,0);bx(0,0,0,30,3.2,9,0x2a2e33,bt);bx(-8,3.2,0,8,4,7,0xd8d4cc,bt);bx(-8,7.2,0,6,1.6,5,0xd8d4cc,bt);cyl(2,3.2,0,.6,.6,8,0x8a2a22,bt);for(let i=0;i<3;i++)container(6+i*3,3.2,0,0,pick(CC)).parent=bt;
  // armazéns e frigorífico
  for(const x of[-48,-12]){bx(x,0,62,30,10,56,pick([0x5a564e,0x4a4038,0x3f4448]));prism(x,10,62,30.4,3,56.4,0x2f3236);bx(x,0,33.95,7,5.5,.1,0x2a2a2a);bx(x,6.5,33.95,10,1.2,.05,0xd8b02a);}
  bx(70,0,38,26,10,22,0xb8b4aa);sign('FRIGORÍFICO TURVO',70,8,49.1,14,1.8,0,{bg:'#1f2c38',fg:'#e8dfcf',font:'700 46px Arial'});
  for(const x of[-60,0,60])floodTower(x,-4,R()<.7);floodTower(-30,30,true);floodTower(70,54,R()<.5);
  {const bz=grp(62,-.3,-30,0);bx(0,0,0,8,.5,20,0x4a4e52,bz);for(const s2 of[-1,1])bx(0,.5,s2*10.6,7,.15,2.4,0x5a5e62,bz);bx(2.6,.5,0,2.4,2.4,3,0xd8d4cc,bz);line([[59,1.2,40],[59,1.2,-120]],0x8a8a8a);line([[65,1.2,40],[65,1.2,-120]],0x8a8a8a);car(61,-32,0,0x5a2b26).position.y=.2;}
  horde(40,-40,40,0,30,0);
  for(let i=0;i<4;i++)crate(30+R()*10,15+R()*6,1.2,R());
  zombie(-14,-24,0,'w',null,{y:3.2-.6});zombie(-18,-26,1,'w',null,{y:3.2-.6});
  {const mx=-75,mz=22;for(const a of[-1,1])for(const b of[-1,1])bx(mx+a*7,0,mz+b*5,.4,4.5,.4,0x6a6c6e);bx(mx,4.5,mz,15,.3,11,0x3a5a6a);for(let i=0;i<3;i++)for(const s2 of[-1,1]){bx(mx-4+i*4,0,mz+s2*2.4,3,.9,1.2,0xd8d8d0);for(let k=0;k<5;k++)item(mx-5+i*4+k*.5,.9,mz+s2*2.4,.4,.08,.18,pick([0x8a9aa0,0xa0a8b0,0x6a7a80]),R()*3);}sign('MERCADO DE PEIXE',mx,3.8,mz+5.6,8,1,0,{bg:'#1a2a3a',fg:'#e8dfcf'});zombie(mx,mz,1,'w',null,{cloth:0xe8e8e4});zombie(mx+3,mz-1,2,'w');}
  pin(20,24,0,'local','Pórtico de contêineres','Plataforma alta para atirador e rota por cima do pátio.');
  pin(-20,9,-24,'loot','Cargueiro ancorado','Combustível, rádio e uma rota pelo rio. Zumbis da tripulação a bordo.');
  pin(62,4,-30,'quebra','Balsa de cabo','Liga as duas margens do Turvo. Precisa de diesel e de alguém na manivela de emergência.');
  pin(-30,9,14,'quebra','Labirinto de contêineres','Portas abrem e fecham. Dá para criar corredores e armadilhas.');
  pin(70,12,38,'perigo','Frigorífico','Câmaras frias escuras com horda dormente. Muita carne estragada.');
  pin(-75,6,22,'perigo','Mercado de peixe','Gelo derretido e cheiro forte atraem zumbis. Facas de peixeiro nas bancas.');
  pin(-30,14,62,'loot','Armazéns do cais','Galpões de 30 × 60 m com mezanino. Ferramentas, cordas, peças de barco.');
  flush();
  return {r:120,th:.55,ph:1.0,t:[0,3,10]};
}
function rails(x0,x1,z){bx((x0+x1)/2,.05,z-.72,x1-x0,.12,.08,M(0x6a6c6e,{metalness:.6}));bx((x0+x1)/2,.05,z+.72,x1-x0,.12,.08,M(0x6a6c6e,{metalness:.6}));for(let x=x0;x<x1;x+=.8)item(x,0,z,.22,.08,2.2,0x3a2a1c);}
function wagon(x,z,c,ry){const g=grp(x,.4,z,ry||0);bx(0,.4,0,13,3,2.8,M(c,{roughness:.8,metalness:.2}),g);for(const a of[-5,5])bx(a,0,0,2.2,.5,2,0x1a1a1a,g);return g;}
function buildTresPontes(){
  env('night',100);ground(0x2a2620);lightning();dust(500,240,160);
  plane(0,-.8,0,400,26,M(0x22343e,{roughness:.25,metalness:.3,flatShading:false}));
  bx(0,-2,-14,400,2.2,2,0x3a3a36);bx(0,-2,14,400,2.2,2,0x3a3a36);
  // ponte rodoviária
  bx(-30,0,0,10,.6,34,0x6a6862);for(const z of[-6,0,6])bx(-30,-3,z,1.2,3,1.2,0x5a5852);bx(-34.6,.6,0,.3,1,34,0x8a8680);bx(-25.4,.6,0,.3,1,34,0x8a8680);
  car(-31,3,.1,0x5a2b26);car(-28.5,-6,3.1,0x6b6450,{side:true});
  // ponte férrea treliçada
  const STL=M(0x4a4e52,{metalness:.6,roughness:.5});bx(10,0,0,6,.6,40,0x3a3a36);for(let z=-18;z<=18;z+=4)for(const s of[-1,1]){bx(10+s*3,.6,z,.3,5,.3,STL);const d=bx(10+s*3,2.5,z+2,.2,.2,5.6,STL);d.rotation.x=.75;}for(const s of[-1,1])bx(10+s*3,5.6,0,.3,.3,40,STL);
  for(const sx of[-.72,.72])bx(10+sx,.62,-1,.08,.12,42,M(0x6a6c6e,{metalness:.6}));for(let z=-21;z<20;z+=.8)item(10,.6,z,2.2,.08,.22,0x3a2a1c);
  // passarela velha
  bx(48,1.2,0,4,.3,30,0x5a3a2a);for(const sd of[-1,1])bx(48+sd*2,1.5,0,.25,1.6,30,M(0x6a3a22,{metalness:.5,roughness:.7}));for(const z of[-14,14])bx(48,-1,z,.5,2.2,.5,M(0x6a3a22,{metalness:.5}));for(let i=0;i<6;i++)item(-60+i*1.4,-.75,-3+(R()-.5)*1.5+i*.9,.9,.4,.8,0x6a6660);
  road(-30,-36,8,40,'z');road(-30,36,8,40,'z');plane(48,.03,30,6,30,0x4a3a2a);plane(48,.03,-30,6,30,0x4a3a2a);
  // pátio de trens ao norte
  for(const z of[-34,-40,-46,-52])rails(-80,80,z);
  const WC=[0x6a3a2a,0x3a4a5a,0x4a4a3a,0x5a5a5e];for(let i=0;i<7;i++)wagon(-60+i*14.5,-40,pick(WC));wagon(-40,-52,0x6a3a2a);wagon(-26,-52,0x3a4a5a,0);
  const loco=grp(70,.4,-34,0);bx(0,.4,0,16,3.6,3,0xa08030,loco);bx(5,4,0,5,1.5,3,0xa08030,loco);
  for(let i=0;i<3;i++){const w=wagon(-30+i*14.5,-46,pick(WC));if(i===1){w.rotation.z=.25;w.position.y=1.2;}}
  rails(-80,10,-20);rails(10,80,-20);
  // estação
  const st=grp(-10,0,-66,0);bx(0,0,0,40,7,12,0x8a7a6a,st);bx(0,7,0,40,1,12,0x8a7a6a,st);bx(0,8,0,24,1,12,0x8a7a6a,st);bx(0,9,0,10,1,12,0x8a7a6a,st);bx(0,0,0,6,15,6,0x8a7a6a,st);for(const sd of[-1.6,0,1.6])bx(sd,6,3.05,.4,9,.3,0x9a8a78,st);bx(0,15,0,4,1.4,4,0x9a8a78,st);
  sign('ESTAÇÃO TRÊS PONTES',-10,5.5,-59.9,16,1.6,0,{bg:'#2a1f18',fg:'#e8dfcf',font:'700 46px Arial'});sign('11:47',-10,12,-62.9,2.2,1,0,{bg:'#e8dfcf',fg:'#1a1a1a',font:'700 70px Arial'});
  bx(-10,0,-55,40,3.6,.4,0x5a5a56);bx(-10,3.6,-56,40,.3,4,0x3a3a36);
  // centro velho da estação: comércio art déco de 2 a 4 andares e postes LED
  for(let i=0;i<6;i++){const h=6+Math.floor(R()*3)*3;building(-48+i*15,-84,12,10,h,pick([0xc8b89a,0xb8a888,0xa89a80]),{lit:.08,shop:.6});bx(-48+i*15,h,-84,4,1.6,10.2,pick([0xc8b89a,0xb8a888]));}
  for(let u=-50;u<=30;u+=25)poleLED(u,-75,R()<.7,Math.PI/2);
  // vila ferroviária: casas da companhia, todas iguais, em fila
  road(-30,42,6,80,'x');for(let i=0;i<8;i++)for(let j=0;j<2;j++){const g=companyHouse(-64+i*9,j?54:30,0xd8d0c0);if(j)g.rotation.y=Math.PI;}
  for(const u of[-62,-27,8])poleConcrete(u,38.5,1,R()<.7,u===-27);wires([[-66,38.5],[10,38.5]],6.9);
  // pátio: torres de refletor e galpão de manutenção
  for(const x of[-60,0,60])floodTower(x,-28,R()<.7);
  {const g=grp(-92,0,-44,0);bx(0,0,0,20,10,16,0x6a6c68,g);const rf=new T.Mesh(new T.CylinderGeometry(10,10,16,16,1,false,0,Math.PI),M(0x5a5c58));rf.rotation.set(Math.PI/2,0,Math.PI/2);rf.position.set(0,10,0);rf.scale.set(1,1,.25);g.add(rf);bx(0,0,8.05,6,6,.1,0x2a2a2a,g);}
  // beira-trilho: barracos e lajes ao lado da linha
  for(let i=0;i<7;i++){const x=-118+i*5;if(i%3===1){bx(x,0,-27,3,2.4,4,0x6a5a46);bx(x,2.4,-27,3.4,.08,4.4,0x2a5aa0);}else laje(x,-27,4.6,5,1+Math.floor(R()*2),0xa0624a);}
  for(const u of[-114,-86])poleConcrete(u,-23.5,1,R()<.5,true);
  // vau do Rio Claro
  for(let i=0;i<7;i++)item(-60+(R()-.5)*1.5,-.8,-10+i*3.2,1,.7,1,0x6a6660,R()*3);
  horde(35,-70,60,-30,-24,0);horde(18,-34,-27,-12,12,0);
  bx(45,0,42,26,3.6,14,0x7a766c);bx(45,3.6,34,30,.3,8,0x4a4a46);for(const a of[-14,-5,4,13])bx(45+a,0,31,.3,3.6,.3,0x5a5a56);bus(37,26,1.57,0x2a4a7a);bus(51,27,1.57,0x8a6a2a);sign('RODOVIÁRIA',45,4.6,30,8,1.2,0,{bg:'#1a2a3a',fg:'#ffd27a'});
  bx(80,0,40,30,10,24,0x8a8478);for(let i=0;i<5;i++)bx(68+i*6,0,27.95,4.4,4.6,.1,0x3a3a3a);sign('CENTRO DE DISTRIBUIÇÃO',80,8,27.9,14,1.4,0,{bg:'#2a2a2a',fg:'#e8dfcf',font:'700 40px Arial'});
  horde(10,36,54,22,30,0);
  pin(-30,4,0,'quebra','Ponte rodoviária (BR-101)','Gargalo principal. Carros abandonados viram barricada.');
  pin(10,8,0,'local','Ponte treliçada (Linha Tronco)','Única travessia de trem. Explodir corta a rota da horda.');
  pin(48,4,0,'perigo','Ponte de Ferro Velha','Estrada da Mata. Ferro enferrujado e tábuas soltas: cede com mais de 3 pessoas.');
  pin(-60,1.5,0,'local','Rio Claro','Corta a cidade. Raso para vadear neste ponto, marcado por pedras.');
  pin(-35,10,42,'local','Vila Ferroviária','Casas da companhia, todas iguais. Boa para aprender a saquear.');
  pin(-104,6,-27,'perigo','Beira-trilho','Barracos e lajes colados na linha. Risco alto, vielas estreitas.');
  pin(-20,14,-84,'loot','Centro Velho da Estação','Comércio art déco de 2 a 4 andares com loja no térreo.');
  pin(45,6,34,'local','Rodoviária','Ônibus com passageiros zumbis. Mapas de linhas para outras cidades.');
  pin(80,12,40,'loot','Centro de distribuição','Paletes de comida, água e produtos de limpeza. Docas trancadas.');
  pin(-26,5,-46,'loot','Vagão descarrilado','Carga de comida enlatada e peças. Horda dormente dentro.');
  pin(-10,18,-66,'cena','Relógio parado','A estação parou às 11:47, hora do último trem de evacuação.');
  flush();
  return {r:125,th:.95,ph:.95,t:[0,2,-18]};
}
function silo(x,z,r,h){cyl(x,0,z,r,r,h,M(0x9a9a92,{metalness:.5,roughness:.5}),null,12);cone(x,h,z,r*1.05,r*.7,M(0x8a8a82,{metalness:.5,roughness:.5}),null,12);}
function tractor(x,z,ry){const g=grp(x,0,z,ry);bx(0,.7,.4,1.4,1.0,2.4,0x2e6b2e,g);bx(0,1.7,-.4,1.3,1.3,1.2,0x1a2a1a,g);for(const s of[-1,1]){const w=cyl(s*.95,1.0,-.6,1,1,.5,0x111111,g,10);w.rotation.z=Math.PI/2;const f=cyl(s*.8,.55,1.2,.55,.55,.35,0x111111,g,8);f.rotation.z=Math.PI/2;}return g;}
function plane3(x,z,ry){const g=grp(x,0,z,ry);bx(0,1.2,0,1.1,1.1,7,0xd8b02a,g);bx(0,1.9,.6,10,.15,1.6,0xd8b02a,g);bx(0,1.6,-3.2,3.2,.12,1,0xd8b02a,g);bx(0,1.6,-3.3,.12,1.4,1,0xd8b02a,g);bx(0,1.4,3.6,.1,1.8,.2,0x222222,g);for(const s of[-1,1])cyl(s*1.2,0,.8,.35,.35,.25,0x111111,g).rotation.z=Math.PI/2;return g;}
function buildCampoLargo(){
  env('dusk',110);ground(0x3d3a26);
  const FC=[0x5b5a32,0x4a5a2c,0x6a5a38,0x6f6a3a];for(let i=0;i<6;i++)for(let j=0;j<3;j++){const p=plane(-150+i*50,.03,-90+j*40,48,38,pick(FC));for(let k=0;k<12;k++)item(-150+i*50,.03,-90+j*40-16+k*3,46,.08,.6,0x3a3a22);}
  road(0,10,8,300,'x');road(30,60,8,100,'z');
  // cooperativa
  for(let i=0;i<4;i++)silo(-40+i*10,40,4.2,25);floodTower(-25,30,true);bx(-25,0,56,40,8,16,0x8a8478);prism(-25,8,56,40.4,3,16.4,0x4a4440,null,Math.PI/2);sign('COOPERATIVA AGRÍCOLA',-25,6.5,64.1,18,1.5,0,{bg:'#2e4a2e',fg:'#e8dfcf',font:'700 46px Arial'});
  // aeroclube
  plane(70,.05,40,14,110,0x2a2a2a);for(let z=-6;z<95;z+=8)item(70,.06,z,.4,.01,3,0xd8d4cc);
  bx(92,0,30,18,7,16,0x6a6c6e);bx(92,0,38.05,14,6,.1,0x1a1a1a);plane3(72,22,.1);sign('AEROCLUBE',92,7.6,38.2,8,1.2,0,{bg:'#1a1a1a',fg:'#d8b02a'});
  // casas e caixa d'água
  // centro: praça com casas coloniais coladas e igreja
  plane(-50,.04,-32,24,24,0x3a4a2c);for(const[a,b]of[[-58,-40],[-42,-40],[-58,-24],[-42,-24]])tree(a,b,1.1);
  {let x=-72;while(x<-28){const w=5+Math.floor(R()*3);colonial(x+w/2,-52,w,pick([0xd8c8a0,0xe0b890,0xc0a8b8,0xd0d0c0]),true);x+=w;}}
  {let z=-46;while(z<-16){const w=5+Math.floor(R()*3);const g=colonial(-75,z+w/2,w,pick([0xd8c8a0,0xa8c0c0,0xe0b890]),true);g.rotation.y=Math.PI/2;z+=w;}}
  {const c=grp(-22,0,-32,-Math.PI/2);bx(0,0,0,8,7,12,0xe0d8c8,c);prism(0,7,0,8.4,3,12.4,0x7a4a32,c);bx(0,0,6.5,3,13,3,0xe0d8c8,c);cone(0,13,6.5,2.2,3,0x7a4a32,c,4);}
  for(const[a,b]of[[-64,-44],[-36,-44],[-64,-20],[-36,-20]])poleConcrete(a,b,1,R()<.7,false);
  // vila operária rural e chácara
  for(let i=0;i<6;i++)companyHouse(-140+i*9,-30,pick([0xd8d0c0,0xc8c0b0]));poleConcrete(-128,-23,1,R()<.5,true);poleConcrete(-92,-23,1,false,false);
  farmhouse(120,-40);poleWood(130,-30,true);
  poleWood(34,14,true);poleWood(34,6,R()<.5);
  {cyl(84,0,20,.15,.15,10,0x6a6c6e);const bc=bx(84,10,20,.6,.5,.6,E(0xfff2c0));const sp=new T.SpotLight(0xfff2c0,2,90,.18,.5);sp.position.set(84,10.4,20);root.add(sp);root.add(sp.target);ANIM.push(t=>{sp.target.position.set(84+Math.cos(t*1.5)*40,0,20+Math.sin(t*1.5)*40);bc.rotation.y=t*1.5;});}
  cyl(20,0,-30,.3,.3,14,0x6a6c6e);cyl(20,14,-30,3,3,4,0x8a8a82,null,10);
  tractor(-5,30,.6);tractor(10,-50,2);
  for(let i=0;i<14;i++)cyl(-20+R()*40,0,-60+R()*20,.8,.8,1.2,0xc0a050,null,10).rotation.z=Math.PI/2;
  // espantalho zumbi
  bx(40,0,-60,.15,2.6,.15,0x4a3324);bx(40,2.1,-60,2,.12,.12,0x4a3324);zombie(40,-59.8,Math.PI,'w',null,{y:.6,dead:false});
  horde(16,-60,40,-40,0,0);horde(30,-160,-120,5,15,Math.PI/2);
  bx(-70,0,40,22,6,12,0xb0aca2);bx(-70,0,46.05,18,4.5,.1,M(0x9fc4d8,{transparent:true,opacity:.3}));tractor(-75,40,.3);tractor(-66,40,-.3);sign('REVENDA DE TRATORES',-70,5.4,46.1,12,1.2,0,{bg:'#2e6b2e',fg:'#e8dfcf',font:'700 44px Arial'});
  pin(-50,8,-32,'local','Praça do Centro','Casas coloniais coladas, comércio térreo e a igreja.');
  pin(-118,6,-30,'cena','Vila Operária Rural','Casas da companhia dos boias-frias. Recados nas portas.');
  pin(120,6,-40,'loot','Chácara','Casa sede com varanda, poço e galinheiro.');
  pin(84,13,20,'local','Farol da pista','Gira à noite: atrai zumbis e guia o avião agrícola.');
  pin(-27,30,40,'loot','Silos e cooperativa','Sementes, fertilizante, ferramentas agrícolas e combustível de trator.');
  pin(-70,8,40,'loot','Revenda de tratores','Tratores novos com tanque cheio, peças e pneus.');
  pin(72,5,22,'loot','Avião agrícola','Fim de jogo: com combustível e peças, voa para fora do vale.');
  pin(40,4,-60,'cena','Espantalho','Um zumbi amarrado no lugar do espantalho. Ainda se mexe.');
  pin(-140,3,10,'perigo','Horda migratória','Grupos cruzam pela rodovia vindos de Santa Aurora.');
  pin(20,20,-30,'local','Caixa d\'água','Ponto alto com visão de quilômetros do campo.');
  flush();
  return {r:150,th:.6,ph:.98,t:[0,2,10]};
}
function buildVilaCorvo(){
  env('grey',80);scene.background.setHex(0x3e4652);scene.fog.color.setHex(0x3e4652);scene.fog.density=.011;
  const geo=new T.PlaneGeometry(300,300,80,80);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;const hf=(x,z)=>Math.max(0,(-z-10)*.28)+Math.sin(x*.07)*Math.cos(z*.05)*2+Math.sin(x*.21+z*.13)*.6;
  for(let i=0;i<p.count;i++)p.setY(i,hf(p.getX(i),p.getZ(i)));geo.computeVertexNormals();const tm=new T.Mesh(geo,M(0x2c3a26));tm.receiveShadow=true;root.add(tm);
  const hy=(x,z)=>hf(x,z);
  for(let i=0;i<260;i++){const x=(R()-.5)*260,z=(R()-.5)*260;if(Math.abs(x)<36&&z>-30&&z<30)continue;pine(x,z,1.2+R()*1.6,hy(x,z)-.2);}
  // vila
  for(let i=0;i<12;i++){const x=-30+(i%4)*18+(R()-.5)*3,z=-22+Math.floor(i/4)*18;const g=chalet(x,z,pick([0x6b4a30,0x5a3e28,0x7a5a3a]),R()*.3-.15);g.position.y=hy(x,z)-.2;bx(x,hy(x,z)-1,z,7.4,1.1,9.4,0x6a6a62);if(R()<.5)smoke(x+2.2,hy(x,z)+9.5,z-1,5);}
  sign('POUSADA DO CORVO',-30,hy(-30,-22)+3.8,-17.9,6,1,0,{bg:'#3a2a20',fg:'#e8dfcf',font:'700 46px Arial'});
  const ch=grp(30,hy(30,22),22,0);bx(0,-1,0,9,10,14,0x7a766c,ch);prism(0,9,0,9.6,4,14.6,0x3a3a3a,ch);bx(0,-1,-8,3.4,17,3.4,0x7a766c,ch);cone(0,16,-8,2.6,4,0x3a3a3a,ch,4);
  // teleférico
  const top=[-60,hy(-60,-110)+18,-110],bot=[0,hy(0,-30)+10,-30];bx(bot[0],hy(0,-30),bot[2],8,7,6,0x7a766c);prism(bot[0],hy(0,-30)+7,bot[2],8.4,2.4,6.4,0x3a3a3a);cyl(bot[0],0,bot[2]-2,.4,.4,bot[1],0x4a4c4e);
  bx(top[0],hy(-60,-110),top[2],8,8,6,0x7a766c);prism(top[0],hy(-60,-110)+8,top[2],8.4,2.4,6.4,0x3a3a3a);cyl(top[0],0,top[2]+2,.4,.4,top[1],0x4a4c4e);
  line([[bot[0],bot[1],bot[2]-2],[top[0],top[1],top[2]+2]],0x222222);line([[bot[0]+1.2,bot[1],bot[2]-2],[top[0]+1.2,top[1],top[2]+2]],0x222222);
  const t=.45,cxp=lerp(bot[0],top[0],t),cyp=lerp(bot[1],top[1],t),czp=lerp(bot[2]-2,top[2]+2,t);line([[cxp,cyp,czp],[cxp,cyp-2,czp]],0x222222);const cab=bx(cxp,cyp-4.2,czp,2.2,2.2,2,0xa02a22);
  ANIM.push(tt=>{cab.rotation.z=Math.sin(tt*.8)*.06;});
  // posto florestal
  bx(-50,hy(-50,30),30,10,4,7,0x5a4a32);prism(-50,hy(-50,30)+4,30,10.5,2.2,7.5,0x3a2a1c,null,Math.PI/2);
  for(let u=-36;u<=30;u+=20)for(const sd of[-1,1]){const x=u+(sd>0?10:0),z=-6+sd*3;atY(hy(x,z),()=>poleIron(x,z,R()<.7));}
  {const sy=hy(-10,48);const st=grp(-10,sy,48,0);bx(0,-1,0,16,6,7,0x7a766c,st);prism(0,5,0,16.4,2.6,7.4,0x3a3a3a,st);bx(0,-1,-4.5,16,.4,2,0x5a5a56,st);sign('ESTAÇÃO VILA DO CORVO',-10,sy+3.6,51.6,9,1,0,{bg:'#2a2a28',fg:'#e8dfcf'});}
  horde(14,-30,30,-10,10,0);human(30,14,0,null,{cloth:0x3a3a3a,y:hy(30,22)+15});human(31,14.5,0,null,{cloth:0x5a4a3a,y:hy(30,22)+15});
  pin(cxp,cyp-1,czp,'perigo','Cabine do teleférico','Presa no meio do cabo, com zumbis dentro. Cai se for atingida.');
  pin(-30,9,-22,'loot','Pousadas','Chalés de madeira e pedra. Roupas de frio, comida, mapas de trilha e lanternas.');
  pin(-10,hy(-10,48)+9,48,'local','Estação da ferrovia','Fim do Ramal da Serra, depois do Túnel da Pedra Furada.');
  pin(30,hy(30,22)+18,22,'cena','Igreja antiga','Sobreviventes da vila fazem vigília no campanário.');
  pin(-50,hy(-50,30)+8,30,'loot','Posto da polícia florestal','Rifle de caça, binóculo, rádio e mapas da serra.');
  pin(top[0],top[1]+3,top[2],'local','Estação do topo','Acesso à torre de observação e à trilha da serra.');
  flush();
  return {r:110,th:.4,ph:1.0,t:[-5,10,-10]};
}

// =====================================================================
// MARCOS
// =====================================================================
function watchtower(x,z,s){for(const a of[-1,1])for(const b of[-1,1])bx(x+a*1.2,0,z+b*1.2,.25,7,.25,0x4a3a2a);bx(x,7,z,3.2,1.2,3.2,0x4f5638);bx(x,8.2,z,3.6,.15,3.6,0x3a3a2a);for(const c of[[-1.5,0],[1.5,0]])bx(x+c[0],8.2,z,.15,1.6,.15,0x3a3a2a);if(s){const L=new T.SpotLight(0xe6eeff,2.4,70,.35,.5,1.2);L.position.set(x,9,z);const tg=new T.Object3D();tg.position.set(x+20,0,z+20);root.add(L,tg);L.target=tg;ANIM.push(t=>{tg.position.set(x+Math.sin(t*.5+x)*25,0,z+Math.cos(t*.5+x)*25);});}}
function buildBase(){
  env('night',100);ground(0x1b1e16);
  const X=60,Z=45;fence(-X,-Z,X,-Z,3.2);fence(-X,Z,-6,Z,3.2);fence(6,Z,X,Z,3.2);fence(-X,-Z,-X,Z,3.2);fence(X,-Z,X,Z,3.2);
  for(let x=-X;x<X;x+=1.2)item(x,3.2,-Z,.8,.5,.5,0x8a8c8e);
  bx(-8,0,Z,3,3,3,0x4f5638);bx(8,0,Z,3,3,3,0x4f5638);const bar=bx(0,1.2,Z+.5,12,.2,.2,0xd8d4cc);bar.rotation.z=.5;
  for(const[a,b]of[[-X,-Z],[X,-Z],[-X,Z],[X,Z]])watchtower(a,b,true);
  // hangar
  const hg=new T.Mesh(new T.CylinderGeometry(12,12,30,12,1,true,0,Math.PI),M(0x5a5e52,{side:T.DoubleSide}));hg.rotation.set(0,0,Math.PI/2);hg.position.set(-30,0,-22);hg.castShadow=true;root.add(hg);
  // tendas de triagem
  for(let i=0;i<4;i++)for(let j=0;j<2;j++)tent(-6+i*11,-6+j*14,0,8,11,0x4f5638);
  sign('LIMPO',-6,6,-.4,4,1.2,0,{bg:'#e8dfcf',fg:'#2e6b2e',font:'800 72px Arial'});sign('MORDIDO',-6,6,13.6,5,1.2,0,{bg:'#e8dfcf',fg:'#a3201c',font:'800 64px Arial'});
  // alojamentos e paiol
  for(let i=0;i<3;i++){bx(30+i*0,0,-30+i*14,24,4,9,0x6a6a5a);windowsOn(30,-30+i*14,24,9,4,0,.04);}
  bx(-45,0,25,10,3,8,0x4a4a42);sandbags(-45,30.2,12,'x',4);sign('PAIOL',-45,2.3,29.05,3,.8,0,{bg:'#a3201c',fg:'#e8dfcf'});
  // caminhões e helicóptero caído
  for(let i=0;i<3;i++){const g=grp(15+i*6,0,30,0);bx(0,.6,0,2.5,1.6,7,0x4f5638,g);prism(0,2.2,-1,2.5,1.2,4.5,0x5a6146,g);bx(0,.6,3,2.4,2.2,1.8,0x4f5638,g);}
  const hc=grp(-20,0,10,.5);bx(0,0,0,3,2.6,8,0x3a4030,hc);bx(0,1.2,-6,.8,.8,6,0x3a4030,hc);hc.rotation.z=.6;hc.position.y=.8;bx(0,2.7,0,.2,.2,14,0x222222,hc).rotation.y=.7;fire(-20,0,10,1.5);
  sandbags(0,-12,30,'x',3);sandbags(0,40,20,'x',3);
  horde(70,-50,50,-36,40,Math.PI*0,{cloth:0x4f5638,pants:0x3a4030});horde(40,-50,50,52,80,Math.PI);
  for(let i=0;i<10;i++){zombie(lerp(-30,30,R()),lerp(-10,30,R()),R()*6,'w',null,{dead:true,cloth:0x4f5638});}
  {const tx=45,tz=-35;for(let y=0;y<32;y+=4){const s2=2.2-y*.05;for(const a of[-1,1])for(const b of[-1,1])bx(tx+a*s2,y,tz+b*s2,.15,4,.15,0x8a2a22);bx(tx,y+4,tz,s2*2,.1,s2*2,0xd8d4cc);}const L=bx(tx,32,tz,.4,.4,.4,E(0xff2020));ANIM.push(t=>{L.visible=Math.floor(t*1.2)%2===0;});}
  pin(-6,8,6,'cena','Tendas de triagem','"LIMPO" e "MORDIDO". As duas estão cheias de zumbis.');
  pin(-45,5,25,'loot','Paiol (classe D)','Fuzis 5,56 e 7,62, granadas e munição. Abre com cartão do oficial.');
  pin(-30,14,-22,'loot','Hangar','Veículos militares e peças. Barulho alto ecoa e atrai a horda.');
  pin(-20,5,10,'perigo','Helicóptero caído','Destroço em chamas. Piloto zumbi preso no cinto.');
  pin(0,5,62,'perigo','Horda na cerca','Civis presos do lado de fora empurram a cerca. Ela cede com o tempo.');
  pin(45,34,-35,'loot','Torre de rádio','Rádio de longo alcance: contato com outros grupos e com o resgate.');
  pin(X,11,-Z,'quebra','Torres de vigia','Holofotes ainda funcionam no gerador. Podem ser desligados ou destruídos.');
  flush();
  return {r:135,th:.6,ph:.92,t:[0,2,5]};
}
function buildPrisao(){
  env('night',90);ground(0x1d1f20);
  const S=45;for(const[a,b,w,d]of[[0,-S,2*S,1.4],[0,S,2*S,1.4],[-S,0,1.4,2*S],[S,0,1.4,2*S]])bx(a,0,b,w,7.5,d,0x8a867c);
  for(let x=-S;x<S;x+=1)item(x,7.5,-S,.6,.4,.4,0x8a8c8e);
  for(const[a,b]of[[-S,-S],[S,-S],[-S,S]])watchtower(a,b,true);
  const ft=grp(S,0,S,0);ft.rotation.z=-.9;ft.position.y=2;for(const a of[-1,1])bx(a,0,0,.25,7,.25,0x4a3a2a,ft);bx(0,7,0,3.2,1.2,3.2,0x4f5638,ft);
  // pavilhões
  for(let i=0;i<3;i++){const z=-26+i*18;bx(-10,0,z,50,9,10,0x7a766c);for(let f=0;f<2;f++)for(let k=0;k<14;k++){item(-33+k*3.4,2+f*4,z+5.05,1,1.2,.05,0x10151b);for(let b=0;b<3;b++)item(-33.35+k*3.4+b*.33,2+f*4,z+5.1,.06,1.2,.06,0x6a6c6e);}sign('PAVILHÃO '+(i+1),-10,8,z+5.1,7,1,0,{bg:'#2a2a2a',fg:'#e8dfcf'});}
  // pátio, colchões queimando
  plane(15,.03,22,40,30,0x2e2f30);for(let i=0;i<8;i++)bx(20+R()*4,i*.25,30+R()*3,2,.25,1,0xb0a890);fire(21,1.5,31,1.8);
  sign('LIBERDADE',-10,4.5,-30.95,10,1.5,Math.PI,{fg:'#c4483b',font:'800 80px Arial',drip:true});
  // portão caído
  const gt=bx(0,0,S+4,12,.3,8,0x4a4c4e);gt.rotation.x=.1;
  bx(-38,0,30,10,4,10,0x5a5852);sign('ARMARIA',-38,3.2,35.05,4,.8,0,{bg:'#a3201c',fg:'#e8dfcf'});
  horde(60,-35,35,-12,40,0,{cloth:0xd06a1a,pants:0xd06a1a});horde(12,-35,35,-40,-34,0,{cloth:0x2a3a4a,pants:0x2a2d33});
  horde(25,-15,15,S+4,S+30,Math.PI,{cloth:0xd06a1a,pants:0xd06a1a});
  bx(30,0,-32,18,5,10,0x6a6862);bx(30,0,-26.95,6,4,.1,0x2a2a2a);for(let i=0;i<4;i++)bx(25+i*3.5,0,-34,1.6,1,1,0x4a5a6a);sign('OFICINA',30,4.4,-26.9,4,.8,0,{bg:'#2a2a2a',fg:'#e8dfcf'});
  pin(-38,6,30,'loot','Armaria (classe D)','Espingardas calibre 12, pistolas .40 e coletes dos agentes.');
  pin(30,7,-32,'loot','Oficina de presos','Serras, solda, chapas. Os presos fizeram armas improvisadas aqui.');
  pin(21,5,31,'perigo','Pátio em chamas','Colchões queimando desde a rebelião. Fumaça esconde corredores.');
  pin(-10,12,-8,'quebra','Pavilhões','Celas com grades indestrutíveis. Portas elétricas abrem com gerador.');
  pin(S,8,S,'cena','Torre derrubada','Os presos derrubaram a torre com um caminhão de lixo.');
  pin(0,4,S+12,'perigo','Fuga em massa','Presos zumbis de uniforme laranja descem a estrada.');
  flush();
  return {r:125,th:.7,ph:.95,t:[0,2,5]};
}
function pylon(x,z){for(const a of[-1,1])for(const b of[-1,1]){const l=bx(x+a*1.4,0,z+b*1.4,.2,18,.2,0x6a6c6e);l.rotation.z=-a*.07;l.rotation.x=b*.07;}bx(x,14,z,9,.25,.25,0x6a6c6e);bx(x,17,z,6,.25,.25,0x6a6c6e);}
function buildRepresa(){
  env('dawn',120);ground(0x2a3324);
  plane(0,22,-110,400,200,M(0x2f4a58,{roughness:.2,metalness:.35,flatShading:false}));
  for(const s of[-1,1])bx(s*120,0,-40,120,30,160,0x3a4a30);
  const dm=new T.Mesh(prismGeo(22,26,140),M(0x8a8680));dm.rotation.y=Math.PI/2;dm.position.set(0,0,-6);dm.castShadow=dm.receiveShadow=true;root.add(dm);
  bx(0,24,-6,140,2,6,0x7a766c);for(let x=-66;x<=66;x+=6)bx(x,26,-8.8,.2,1.1,.2,0x5a5852);
  for(let i=0;i<4;i++)bx(-24+i*16,2,5.2,5,8,.6,0x3a3a3a);
  plane(0,.5,60,30,120,M(0x2f4a58,{roughness:.2,metalness:.3,flatShading:false}));
  bx(30,0,20,26,12,16,0xb0aca2);windowsOn(30,20,26,16,12,0,.0);sign('CASA DE FORÇA',30,10,28.1,10,1.4,0,{bg:'#1a2a3a',fg:'#ffd27a'});
  for(let i=0;i<3;i++)cyl(16+i*4,0,22,1.2,1.2,6,0x5a5a5e);
  for(let i=0;i<4;i++)pylon(50+i*30,40+i*10);
  for(let i=0;i<6;i++)house(-40+(i%3)*12,40+Math.floor(i/3)*14,8,8,pick([0xc8c0b0,0xb0a890]),0x5a3a2a);
  car(-10,-5,1.57,0x6b6450).position.y=26;car(14,-6.5,1.4,0x2d3d4a).position.y=26;
  for(let i=0;i<12;i++)zombie(-50+R()*100,-6+(R()-.5)*3,R()*6,'w',null,{y:26});
  horde(14,10,50,30,50,0);
  pin(0,30,-6,'local','Barragem','Topo da barragem é estrada: 1,6 km sem ter onde se esconder. Aqui só um trecho.');
  pin(30,16,20,'loot','Casa de força','Religar as turbinas devolve energia a partes do vale. Missão longa.');
  pin(-10,4,10,'quebra','Comportas','Abrir as comportas inunda a várzea e afoga a horda que passa no rio.');
  pin(-28,5,47,'cena','Vila operária','Famílias dos técnicos deixaram recados de para onde foram.');
  pin(110,22,70,'perigo','Linhas de transmissão','Cabos caídos eletrocutam quando a energia volta.');
  flush();
  return {r:150,th:.75,ph:1.05,t:[0,10,10]};
}
function buildHospitalExt(){
  env('night',90);ground(0x15181a);
  road(0,30,10,200,'x');road(-50,0,10,120,'z');
  bx(0,0,-10,60,22,26,0xb8b4aa);windowsOn(0,-10,60,26,22,0,.06);bx(36,0,-6,14,10,18,0xa8a49a);windowsOn(36,-6,14,18,10,0,.05);
  bx(0,22,-10,18,.3,18,0x4a4a46);sign('H',0,22.4,-10,10,10,0,{fg:'#e8dfcf',font:'800 110px Arial',w:256,h:256}).rotation.x=-Math.PI/2;
  sign('HOSPITAL REGIONAL',0,18,3.1,22,2.4,0,{bg:'#1a3a5a',fg:'#e8dfcf',font:'700 46px Arial'});
  bx(0,0,3.6,14,4,4,0x8a8680);bx(0,4,5,16,.3,7,0x4a4a46);
  sign('PRONTO-SOCORRO',0,4.9,8.55,8,1,0,{bg:'#a3201c',fg:'#e8dfcf'});
  for(let i=0;i<3;i++){const a=car(-10+i*7,12,.3*i,0xe8e8e4);}car(14,16,1.4,0xe8e8e4,{side:true});
  for(let i=0;i<4;i++)tent(-20+i*10,22,Math.PI/2,6,7,0xe8e4dc);
  fence(-30,40,30,40,2.5);for(let x=-30;x<30;x+=1.2)item(x,1.2,40,.8,.05,.05,0xd8b02a);
  sign('QUARENTENA',0,2,40.1,6,1,0,{bg:'#d8b02a',fg:'#1a1a1a'});
  horde(45,-25,25,5,38,0,{cloth:0x8ab0c8});horde(20,-30,30,44,70,Math.PI);
  for(let i=0;i<4;i++)lampPost(-40+i*26,25,[0,-1],R()<.7,R()<.4);
  pin(0,26,-10,'local','Heliponto','Rota de fuga e ponto de missão de resgate.');
  pin(0,8,6,'perigo','Pronto-socorro','Maior concentração de corredores do mapa.');
  pin(-5,6,22,'cena','Tendas de triagem','Montadas no estacionamento antes da cerca de quarentena.');
  pin(36,13,-6,'loot','Farmácia hospitalar','Melhor material médico do jogo: sutura, soro, antibiótico forte.');
  pin(0,4,40,'quebra','Cerca de quarentena','Grades provisórias. A horda de fora derruba com pressão.');
  flush();
  return {r:110,th:.55,ph:1.0,t:[0,5,5]};
}
function buildShopping(){
  env('night',100);ground(0x15181a);
  // estacionamento
  plane(0,.03,40,120,50,0x26282c);for(let i=0;i<20;i++)for(let j=0;j<3;j++)item(-57+i*6,.04,24+j*14,.12,.01,5,0xd8d4cc);
  for(let i=0;i<36;i++)car(-55+Math.floor(R()*20)*6,24+Math.floor(R()*3)*14+(R()<.5?-2.6:2.6),R()<.85?0:R()*3,pick([0x5a2b26,0x2d3d4a,0x6b6450,0x3a3f2e,0x4b4f55,0x8a8a86]));
  // prédio com teto aberto à direita
  const W=90,D=50,H=12;bx(0,0,-D/2,W,H,1,0x6a665e);bx(-W/2,0,0,1,H,D,0x6a665e);bx(W/2,0,0,1,H*.4,D,0x6a665e);
  bx(-W/4,0,D/2-.5,W/2,H,1,0x6a665e);bx(W/4,0,D/2-.5,W/2,2,1,0x6a665e);for(let i=0;i<6;i++)bx(W/4-20+i*8,2,D/2-.5,6,6,.1,M(0x9fc4d8,{transparent:true,opacity:.3,roughness:.05,metalness:.6}));
  bx(-W/4,H,0,W/2,.6,D,0x3a3a3c);plane(0,.05,0,W,D,0x77746a);
  sign('SHOPPING VALE',-W/4,H-2,D/2+.1,22,3,0,{bg:'#2a1a3a',fg:'#ffd27a',font:'800 54px Arial'});
  // praça de alimentação
  for(let i=0;i<5;i++)for(let j=0;j<4;j++){const x=6+i*7,z=-14+j*8;table(x,z,1.2,1.2,0x8a8478,0);}
  for(let i=0;i<5;i++){bx(4+i*8,0,-23,6,3.5,3,pick([0xa0402a,0x2a6a3a,0xd8b02a,0x2a4a7a,0x7a2a5a]));sign(['LANCHES','PIZZA','PASTEL','CAFÉ','AÇAÍ'][i],4+i*8,3.2,-21.4,4,.8,0,{bg:'#1a1a1a',fg:'#e8dfcf'});}
  const esc=bx(-4,0,0,3,.4,12,0x8a8a86);esc.rotation.x=.45;esc.position.y=3;
  bx(-W/4,5.8,0,W/2,.3,D,0x5a5852);
  sign(['PONTO DE ENCONTRO','EVACUAÇÃO'],20,9,D/2-1.2,12,2.4,0,{bg:'#1a2a3a',fg:'#e8dfcf',font:'700 42px Arial'});
  pl(20,10,0,0xcfe3ff,1.2,40,true);pl(-20,10,0,0xcfe3ff,.8,30,true);
  horde(110,4,42,-20,22,R()*6);horde(14,-30,30,30,52,Math.PI);
  for(let i=0;i<6;i++)lampPost(-55+i*22,62,[0,-1],R()<.6,R()<.3);
  pin(24,4,0,'perigo','Praça de alimentação','Horda de 300+ no jogo final. Vidro quebrado acorda todo mundo.');
  pin(-W/4,14,0,'local','Lojas do 1º andar','Roupas, esporte, eletrônicos, ferragens. Seis lojas abertas.');
  pin(20,10,D/2-1,'cena','Ponto de encontro','Placas de evacuação ainda penduradas. Ninguém veio buscar.');
  pin(-30,4,40,'loot','Estacionamento','Carros com chave, combustível e mochilas no porta-malas.');
  pin(W/2,6,0,'quebra','Corredor de serviço','Única rota silenciosa entre as lojas. Portas de aço arrombáveis.');
  flush();
  return {r:115,th:.85,ph:.85,t:[5,2,5]};
}

// =====================================================================
// INTERIORES
// =====================================================================
const WALL=0x8a8274,FLOOR=0x5e5448;
function buildCasa(){
  env('inside',14);room(14,10,2.8,0x9a907c,0x6a5a44);
  wl(0,-5,0,.5,2.8,0x9a907c);wl(0,1.5,0,5,2.8,0x9a907c);wl(-7,0,-3,0,2.8,0x9a907c);wl(-2,0,0,0,2.8,0x9a907c);wl(0,-.5,1,-.5,2.8,0x9a907c);wl(2,-.5,7,-.5,2.8,0x9a907c);wl(4.5,-.5,4.5,2.5,2.8,0x9a907c);wl(4.5,3.5,4.5,5,2.8,0x9a907c);
  plane(5.75,.02,2.25,2.5,5.5,0xb0b4b0);plane(-3.5,.02,-2.5,7,5,0x8a8478);
  // cozinha
  counter(-4.5,-4.5,4.5,.62,0x6b5a48);stove(-1.6,-4.5,0);fridge(-6.4,-3.6,Math.PI/2);table(-3.5,-1.8,1.6,1,0x6b4a30,4);
  shelfItems(-4.5,-4.3,4,'x',.5,.6,FOOD,0);item(-6,.9,-4.5,.3,.25,.3,0xe8e8e4);
  sign(['Fomos pra casa','da vó. Não abre','pra ninguém.'],-6.0,1.3,-3.22,.5,.5,Math.PI/2,{bg:'#f2edd8',fg:'#2a2a2a',font:'600 34px Arial',w:256,h:256});
  backWin(-4.5,-5,1.4,1,1.2,false);
  // sala
  sofa(-4,3.4,Math.PI,0x4a5a6a);tv(-4,.5,0);plane(-4,.03,2,3,2,0x6a3a2a);sofa(-6.2,1.8,Math.PI/2,0x4a5a6a);
  leftWin(-7,2.5,1.6,1.2,1.1,true);glass(-6.4,2.5,25,1.2);
  // quarto do casal
  bed(3.5,-3.7,0,true,0x5a3a3a);wardrobe(6.2,-2.6,-Math.PI/2);bx(3.1,.75,-3.5,.7,.3,.5,0x2a4a6a);bx(3.8,.75,-3.2,.6,.25,.4,0x6a2a2a,null,.4);
  zombie(1.6,-1.8,.6,'w',null,{cloth:0x6a6458});blood(2.2,-2.6,1.4);backWin(3.5,-5,1.4,1,1.2,true);
  // quarto da criança
  bed(1,3.7,Math.PI,false,0x2a6a8a);desk(3.2,4.4,Math.PI,false);for(let i=0;i<8;i++)item(1+R()*3,0,.5+R()*2.2,.18,.18,.18,pick(FOOD),R()*3);
  // banheiro
  bx(6.3,0,.3,.5,.45,.7,0xe8e8e4);bx(6.4,0,4,1.1,.55,1.8,0xe8e8e4);bx(5.2,.8,.2,.6,.15,.4,0xe8e8e4);
  // porta de entrada aberta, chave
  bx(-1.2,0,5.1,.9,2.1,.05,0x4a3324).rotation.y=.9;item(-6.6,.9,-2.9,.06,.02,.12,0xd8b02a);
  plane(9.3,.01,0,4.4,10,0x4a4a48);bx(9.3,0,-4.92,4.4,2.8,.16,0x9a907c);bx(11.42,0,0,.16,.55,10,0x9a907c);bx(9.3,0,4.92,4.4,.55,.16,0x9a907c);
  car(9.3,.4,0,0x2d3d4a);bx(11,0,-3.6,.5,.9,1.6,0x5b4030);for(let i=0;i<6;i++)item(10.9,.9,-4.2+i*.25,.12,.05+R()*.15,.08,pick([0x8a8c8e,0xc0392b,0x2a2a2a]));rack(11.05,1.8,2,'z',1.8,0x55585b);for(let i=0;i<6;i++)item(11.05,.45+Math.floor(i/2)*.42,1.2+(i%2)*.9,.3,.25,.3,pick([0xc0392b,0x2e4a2e,0x6a5236]));
  plane(-3.5,.01,7.6,7,5,0x3d4a2c);fence(-7,10.1,0,10.1,1.4,0x6a4a30);fence(-7,5.1,-7,10.1,1.4,0x6a4a30);fence(0,5.1,0,10.1,1.4,0x6a4a30);
  bx(-6.2,0,6,.7,.9,.65,0xe8e8e4);bx(-5.3,0,6,.8,.85,.6,0xb0b0aa);line([[-6.5,1.8,8.5],[-1,1.8,8.5]],0xaaaaaa);for(let i=0;i<4;i++)bx(-5.6+i*1.2,1.1,8.5,.6,.7,.02,pick([0x8a2a2a,0x2a4a6a,0xd8d0c0]));
  dog(-2.5,8,2.4);blood(-2,8.6,.8);
  pl(-3.5,2.4,-2,0xffc98a,1.2,9);pl(3.5,2.4,-3,0x8aa6d6,.5,8);
  pin(-4.5,1.6,-4.4,'loot','Armário da cozinha','Enlatados, arroz, água, faca de cozinha.');
  pin(-6,1.6,-3.2,'cena','Bilhete na geladeira','"Fomos pra casa da vó. Não abre pra ninguém."');
  pin(11,1.8,-3.6,'loot','Garagem','Carro (chave na cozinha), martelo, chave de fenda, galão e tinta.');
  pin(-2.5,1.2,8,'perigo','Cachorro infectado','No quintal. Rápido e baixo, late e atrai zumbis.');
  pin(-5.8,1.6,6,'cena','Lavanderia','Roupa ainda no varal. Tanque com água parada.');
  pin(6.2,2.4,-2.6,'loot','Guarda-roupa do casal','1 em 12 casas: espingarda calibre 12 ou revólver .38.');
  pin(1.6,2.2,-1.8,'perigo','Pai zumbi','Trancado no quarto. Acorda com barulho de vidro.');
  pin(-6.6,1.2,2.5,'quebra','Janela da sala','Vidro quebrado faz barulho. Tábuas pregadas aguentam 3 golpes extras.');
  pin(3.4,1.3,-3.5,'cena','Malas na cama','Meio feitas. A família não chegou a sair.');
  pin(-6.6,1.2,-2.9,'loot','Chave do carro','Abre o carro da garagem.');
  flush();
  return {r:24,th:.55,ph:.85,t:[2,0,2]};
}
function buildApto(){
  env('inside',14);room(16,10,2.8,0xa09a8a,0x5a5a56);
  // corredor ao centro (z -1.2..1.2)
  wl(-8,-1.2,8,-1.2,2.8,0xa09a8a);wl(-8,1.2,-6,1.2,2.8,0xa09a8a);wl(-5,1.2,1,1.2,2.8,0xa09a8a);wl(2,1.2,8,1.2,2.8,0xa09a8a);
  wl(-2,-5,-2,-1.2,2.8,0xa09a8a);wl(3,-5,3,-1.2,2.8,0xa09a8a);wl(-1,1.2,-1,5,2.8,0xa09a8a);
  // fosso do elevador
  bx(-6.5,0,-3.2,2.6,2.8,.14,0x6a6c6e);plane(-6.5,.015,-3.1,2.4,3.5,0x050505);bx(-6.5,0,-1.3,1.4,2.2,.1,0x7a7c7e).rotation.y=.25;
  // escada bloqueada
  for(let i=0;i<8;i++)bx(7-.5*i*.1,i*.3,-3.3+i*.1,1.8,.3,2,0x7a766c);for(let i=0;i<12;i++)bx(6.4+R()*1.6,R()*.8,-2+R()*1,.4+R()*.6,.3+R()*.4,.3+R()*.5,pick([0x7a766c,0x6a5236,0x5a5a5e]),null,R()*3);
  // barricada de colchões
  for(let i=0;i<3;i++){const b=bx(-.5+i*.3,i*.25,0,.3,1.8,2.2,0xd8d2c4,null,(R()-.5)*.3);b.rotation.z=.2;}
  sign('INFECTADO NO 302',0.5,1.6,-1.12,3.4,.7,0,{fg:'#c4483b',font:'800 64px Arial',drip:true});
  // apto 301 (estudante) x -2..3 back
  bed(-1,-4,0,false,0x3a4a2a);desk(1.8,-4.4,0,true);for(let i=0;i<14;i++)item(-1.5+R()*4,0,-3+R()*1.6,.2,.02,.28,0xb8b1a0,R()*3);
  // apto 302 (infectado) x 3..8 back -> corpo e zumbis
  zombie(4.5,-3,.3,'r');zombie(5.4,-2.5,-.4,'w');blood(4.8,-3.5,1.6);bed(5.5,-4,0,true,0x6a2a2a);
  // apto 303 (família) front x -8..-1
  sofa(-5,4,Math.PI,0x6a5a3a);tv(-5,1.8,0);table(-2.6,3.4,1.2,.9,0x6b4a30,2);
  // apto 304 (idoso) front x -1..8
  bed(4,4,Math.PI,true,0x4a5a7a);shelf(1.2,4.7,1.6,'x',1.8,0x5b4030,0,BOOKS);shelfItems(1.2,4.6,1.6,'x',1.8,.75,BOOKS,0);cyl(6.8,0,2.2,.25,.25,1.3,0x2e6b2e);
  for(let i=0;i<6;i++)item(6.2+R()*.6,.75,4.6+R()*.2,.06,.1,.06,MEDS[i%MEDS.length]);
  backWin(.5,-5,1.4,1,1.2,false);backWin(5.5,-5,1.4,1,1.2,true);
  pl(0,2.4,0,0xcfe3ff,.9,9,true);pl(-5,2.3,3,0xffc98a,.7,7);
  cyl(-4,0,-1.0,.13,.13,.6,0xc0392b);cyl(6,0,1.0,.13,.13,.6,0xc0392b);
  pin(-4,1,-1,'quebra','Extintores','Um tiro vira nuvem branca que cega os zumbis por alguns segundos.');
  pin(.5,2.6,-1.1,'cena','"INFECTADO NO 302"','Pintado na parede do 3º andar por quem tentou isolar o corredor.');
  pin(0,2.2,0,'quebra','Barricada de colchões','Bloqueia o corredor. Dá para empurrar ou queimar.');
  pin(-6.5,1.2,-3.2,'perigo','Poço do elevador','Queda de 3 andares. Zumbis caem lá dentro e se acumulam.');
  pin(7,2.6,-2.5,'quebra','Escada com entulho','Bloqueia os andares de cima (classe B). Liberar faz muito barulho.');
  pin(4.8,2.2,-3,'perigo','Apartamento 302','Família infectada, um corredor recém-transformado.');
  pin(6.4,1.4,4.6,'loot','Apartamento do idoso','Remédios de uso contínuo, oxigênio portátil, livros.');
  pin(1.8,1.4,-4.4,'loot','Apartamento do estudante','Notebook, mochila, energético e cadernos com mapas do campus.');
  flush();
  return {r:20,th:.5,ph:.85,t:[0,0,0]};
}
function gondola(x,z,len,fill,fallen){if(fallen){const g=grp(x,.2,z,0);g.rotation.z=1.38;bx(0,0,0,.1,1.7,len,0x5d6063,g);for(const y of[.2,.65,1.1,1.55])bx(0,y,0,.9,.04,len,0x6e7174,g);for(let k=0;k<50;k++)item(x-.4+R()*3.6,0,z-len/2+R()*len,.2,.22,.18,pick(FOOD),R()*3,R()*3,R()*3);return;}
  bx(x,0,z,.1,1.7,len,0x5d6063);for(const y of[.1,.55,1.0,1.45])bx(x,y,z,.9,.04,len,0x6e7174);for(const y of[.14,.59,1.04,1.49])for(let k=0;k<len/.33;k++)if(R()<fill)for(const s of[-1,1])item(x+s*.25,y,z-len/2+.17+k*.33,.2,.22,.18,pick(FOOD));}
function buildMercado(){
  env('inside',16);room(18,13,3.4,0x8f8574,0x77746a);
  for(let i=0;i<4;i++){if(i===2){gondola(-5+i*3.2,-1,7,.3,true);continue;}gondola(-5+i*3.2,-1,7,i===0?.1:.55);}
  bx(-2,0,-6.05,12,2.1,.8,M(0x3b4045,{metalness:.4,roughness:.5}));bx(-2,.3,-5.63,11.6,1.6,.02,E(0x1f3b52));for(let k=0;k<30;k++)if(R()<.5)item(-7.6+k*.38,.5+Math.floor(R()*3)*.5,-6,.14,.3,.14,pick(FOOD));
  // caixas
  for(let i=0;i<3;i++){counter(-5+i*3.2,4.6,1.2,2,0x5b4636,0x3a3a3a);bx(-5+i*3.2,.93,4.2,.4,.3,.4,0x202224);}
  for(let i=0;i<5;i++){const c=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(.6,.5,.9)),new T.LineBasicMaterial({color:0x9aa0a6}));c.userData.own=true;c.position.set(-6+i*1.6+R(),.6,5.6+R()*.4);c.rotation.y=R()*2;root.add(c);for(let k=0;k<4;k++)item(c.position.x+(R()-.5)*.3,.5,c.position.z+(R()-.5)*.5,.18,.2,.16,pick(FOOD));}
  // açougue e câmara fria
  bx(6,0,-4,4.8,1.1,1,0xd8d8d0);bx(6,1.1,-4,4.8,.05,1,M(0xbfe6ff,{transparent:true,opacity:.35}));wl(4,-6.5,4,-2,3.4,0x9a9a92);wl(4,-2,8.8,-2,1.2,0x9a9a92);
  bx(8.4,0,-5.8,.9,2.3,.12,M(0x8a9aa0,{metalness:.6,roughness:.3}));item(6,1.2,-4,.1,.04,.5,0xc0c4c8,.3);
  // estoque
  wl(4,1,8.8,1,2.4,0x8f8574);rack(6.4,3.8,4.4,'x',2.4,0x2a4a8a);for(let k=0;k<10;k++)crate(5+R()*3,2.2+R()*.8,.5,R());
  // porta automática travada
  bx(-8,0,6.4,1.6,2.4,.05,M(0x9fc4d8,{transparent:true,opacity:.25}));glass(-7.6,5.8,40,1.6);
  zombie(-1.6,1.2,2,'w');zombie(1.5,-3,.5,'w');zombie(7.6,-5,-2.4,'r');zombie(-6,2,-1,'w',null,{dead:true});blood(-6,2,1.3);
  pl(-3,3.2,-1,0xcfe3ff,1.1,14,true);pl(6,3,3,0xffd27a,.5,8);
  bx(6.5,0,-.4,4,1,.8,0xd8d0c0);bx(6.5,1,-.4,4,.04,.82,M(0xbfe6ff,{transparent:true,opacity:.35}));for(let k=0;k<14;k++)item(4.9+R()*3.2,.85,-.6+R()*.4,.3,.12,.16,pick([0xa0702a,0x8a5a2a,0x6a7a4a]),R()*3);bx(6.5,0,-1.7,2.6,1.8,.7,0x5a5a5e);
  wl(7,4.6,7,6.5,2.4,0x8f8574);wl(7,4.6,9,4.6,2.4,0x8f8574);desk(8,5.7,0,true);bx(8.6,0,6.1,.5,.6,.4,0x2a2a2a);
  pin(-5,2.2,-1,'loot','Gôndola quase vazia','Comida saqueada primeiro. Sobram temperos, pilhas, produtos de limpeza.');
  pin(1.4,1.5,-1,'quebra','Gôndola derrubada','Faz barulho alto ao cair. Pode ser derrubada de propósito como obstáculo.');
  pin(8.4,2.8,-5.8,'perigo','Câmara fria','Escura, com zumbis presos. Carne estraga a partir da 2ª semana.');
  pin(6.5,1.6,-.4,'loot','Padaria','Farinha, fermento, açúcar. O pão já está mofado.');
  pin(8,1.8,5.6,'loot','Escritório do gerente','Chave da doca, cofre e a lista de fornecedores com endereços.');
  pin(6,1.6,-4,'loot','Açougue','Cutelo, faca de desossa e sacos de lixo.');
  pin(6.4,3,3.8,'loot','Estoque','Caixas de água, enlatados e a doca de carga dos fundos.');
  pin(-7.6,1.6,6,'cena','Porta automática travada','Meio aberta desde o surto. Carrinhos cheios abandonados na fila.');
  flush();
  return {r:23,th:.5,ph:.9,t:[0,0,0]};
}
function buildFarmacia(){
  env('inside',12);room(11,9,3.2,0x7d8a84,0x77746a);
  for(const s of[-1]){bx(-5.15,0,-.5,.5,2.2,6.4,0x5d6668);shelfItems(-4.85,-.5,6,'z',2.2,.55,MEDS,1);}
  bx(0,0,-1.5,6,1.05,.6,0x4a5550);bx(0,1.05,-1.5,6,.03,.62,M(0xbfe6ff,{transparent:true,opacity:.35}));shelfItems(0,-1.5,5.5,'x',.6,.6,MEDS,0);
  bx(0,0,-4.2,8.4,2.2,.4,0x5d6668);shelfItems(0,-3.9,8,'x',2.2,.4,MEDS,0);
  // depósito com grade
  wl(2.5,-4.4,2.5,-2.3,3.2,0x7d8a84);for(let x=2.6;x<5.4;x+=.18)cyl(x,0,-2.3,.025,.025,2.4,0x8a8c8e,null,4);bx(4,2.4,-2.3,2.8,.06,.06,0x8a8c8e);rack(4,-3.8,2.4,'x',2,0x5d6668);shelfItems(4,-3.8,2.2,'x',2,.8,MEDS,1);
  for(let i=0;i<40;i++)item(-3+R()*7,0,-1+R()*4,.12,.04,.08,pick(MEDS),R()*3);
  // porta de aço forçada
  const sh=bx(0,1.4,4.6,4,1.2,.08,M(0x6a6c6e,{metalness:.5}));sh.rotation.x=-.25;car(0,7.2,0,0x5a2b26).rotation.y=.12;glass(0,3.6,30,2);
  zombie(0,-2.6,0,'w',null,{cloth:0xe8e8e4});
  human(-3,2.6,.8,null,{cloth:0x3a4a5a,aim:true});human(1.6,1.2,-1,null,{cloth:0x5a4a3a});
  pl(0,2.8,-1,0xb8ffd0,1.0,10,true);
  bx(5.1,0,-2.95,.6,1.6,.6,0xe8e8e4);bx(4.8,.2,-2.64,.02,1.2,.5,E(0x9fd0e0));bx(3,0,-2.9,.6,.7,.5,0x3a3a3a);
  wl(2.5,2,2.5,4.5,2.2,0x7d8a84);wl(2.5,2,4.4,2,2.2,0x7d8a84);counter(4,3.9,2.6,.6,0xd8d8d0,0xe8e8e8);for(let i=0;i<10;i++)item(3+R()*2,.93,3.8+R()*.3,.08,.16,.08,pick(MEDS));bx(4.6,.93,3.9,.3,.1,.3,0x8a8c8e);
  pin(0,2.4,-2.6,'perigo','Farmacêutico zumbi','Ainda de jaleco, atrás do balcão.');
  pin(4,2.6,-3.6,'loot','Controlados atrás da grade','Antibiótico, analgésico forte. Precisa de pé de cabra.');
  pin(5.1,2,-2.95,'loot','Geladeira de vacinas','Insulina e vacinas. Estragam em 3 dias sem energia.');
  pin(3,1,-2.9,'loot','Cofre','Remédios controlados de alto valor. Precisa do segredo ou maçarico.');
  pin(4,1.6,3.9,'loot','Sala de manipulação','Álcool, balança e frascos: bancada para fabricar remédios.');
  pin(-4.8,2.6,-.5,'loot','Prateleira','Ataduras, álcool, antisséptico, vitaminas.');
  pin(0,2.6,4.6,'quebra','Porta de aço forçada','Arrombada por um carro. Agora a farmácia não fecha.');
  pin(-3,2.4,2.6,'cena','Outros sobreviventes','Chegaram antes. Podem negociar, roubar ou atirar.');
  flush();
  return {r:17,th:.55,ph:.88,t:[0,0,0]};
}
function rifle(x,y,z,ry,c){const g=grp(x,y,z,ry);bx(0,0,0,.06,.1,1.1,c||0x1c1d1f,g);bx(0,-.05,-.45,.07,.16,.3,0x6a3a20,g);return g;}
function buildArmas(){
  env('inside',12);room(12,9,3.2,0x5a4a3a,0x4a3a2c);
  // rack de armas longas na parede do fundo
  bx(0,.6,-4.3,9,2.2,.15,0x3a2a20);for(let i=0;i<14;i++){const r=rifle(-4+i*.62,1.2+(i%2)*.7,-4.15,0,i%3?0x1c1d1f:0x3a3a2a);r.rotation.x=Math.PI/2;r.position.y=1.7;}
  // balcão vitrine com pistolas
  bx(0,0,-1.5,7,1,.7,0x3a2a20);bx(0,1,-1.5,7,.04,.72,M(0xbfe6ff,{transparent:true,opacity:.3}));for(let i=0;i<10;i++){item(-3+i*.65,.9,-1.5,.18,.03,.28,0x1c1d1f,R()*.3);}
  // cabeças empalhadas na parede esquerda
  for(let i=0;i<3;i++){const z=-2.5+i*2.4;bx(-5.85,1.9,z,.15,.6,.6,0x3a2a20);bx(-5.6,2,z,.4,.45,.45,0x6a4a30);for(const s of[-1,1]){const a=bx(-5.5,2.4,z+s*.25,.05,.6,.05,0xd8d0c0);a.rotation.x=s*.4;}}
  // depósito blindado
  bx(4.6,0,-4.36,1.6,2.4,.1,M(0x6a6c6e,{metalness:.7,roughness:.3}));cyl(4.6,1.2,-4.25,.18,.18,.1,0x3a3a3a).rotation.x=Math.PI/2;bx(5.6,1.2,-4.3,.2,.3,.05,E(0xff3a2a));
  // bancada de recarga e caixas de munição
  counter(4.4,-.6,2.2,.8,0x4a3a2a,0x5a4a3a);for(let i=0;i<12;i++)item(3.6+R()*1.6,.93,-.8+R()*.4,.18,.12,.12,pick([0x2e4a2e,0x8a2a22,0xd8b02a]));
  casings(1,1.8,120,6);
  // dono entrincheirado
  human(0,-2.6,0,null,{cloth:0x3f4a36,hat:0x3a2a20,aim:true});
  for(let i=0;i<4;i++){bx(-1.2+i*.8,0,3.6,.8,.6,.8,0x6a5236);}crate(-1.6,2.8,.8,.3);
  zombie(-3,3.2,Math.PI,'w',null,{dead:true});zombie(2.4,3.6,1,'r',null,{dead:true});blood(-3,3.2,1.4);blood(2.4,3.6,1.2);
  pl(0,2.8,-1,0xffc98a,1.1,10);
  plane(10,.01,0,8,9,0x3a3a36);bx(10,0,-4.42,8,3.2,.16,0x5a4a3a);bx(13.92,0,0,.16,.55,9,0x5a4a3a);bx(10,0,4.42,8,.55,.16,0x5a4a3a);
  for(const z of[-3,-1,1,3]){bx(7,0,z+1,.9,1.6,.06,0x4a3a2a);bx(6.9,0,z,.5,1,.8,0x4a3a2a);bx(13.4,.6,z,.04,1.1,.7,0xe8e4dc);bx(13.37,1.05,z,.03,.2,.2,E(0xa3201c));line([[7.2,2.4,z],[13.4,2.4,z]],0x777777);}
  zombie(12,1,-Math.PI/2,'w');zombie(11,-2.6,-Math.PI/2,'w',null,{dead:true});
  line([[3.9,.2,-4.05],[5.3,.2,-4.05]],0xcccccc);bx(5.4,1.1,-4.2,.1,.1,.6,0x1c1d1f);
  bx(-4.5,0,2.6,1.6,1.5,.05,0x3a3a3a);for(let i=0;i<6;i++)bx(-5.1+i*.25,.6,2.6,.2,.8,.4,pick([0x4f5638,0x6a5a3a,0x3a4030]));
  pin(0,2.4,-4.1,'loot','Armas longas','Espingardas calibre 12, carabinas .22 e de caça. Munição separada por calibre.');
  pin(10,2.6,0,'loot','Estande de tiro','Munição .22 em caixas, protetor auricular e alvos. Treinar aqui faz barulho.');
  pin(4.6,1,-3.9,'perigo','Armadilha','Fio na porta do depósito dispara uma espingarda.');
  pin(-4.5,1.8,2.6,'loot','Roupa camuflada','Reduz a distância em que zumbis te veem no mato.');
  pin(0,1.6,-1.5,'loot','Vitrine de pistolas','Revólver .38, pistolas 9 mm e .40, coldres e miras.');
  pin(4.6,2.8,-4.3,'loot','Depósito blindado (classe D)','Abre com a chave do dono ou maçarico.');
  pin(0,2.4,-2.6,'perigo','Dono entrincheirado','NPC armado. Pode ser recrutado ou atirar à primeira vista.');
  pin(1,.6,2.6,'cena','Cartuchos no chão','Alguém segurou a porta por muito tempo.');
  pin(4.4,1.4,-.6,'loot','Bancada de recarga','Pólvora, espoletas e projéteis para recarregar munição.');
  flush();
  return {r:22,th:.5,ph:.88,t:[4,0,0]};
}
function bars(x0,x1,z,h){for(let x=x0;x<=x1;x+=.2)cyl(x,0,z,.03,.03,h,0x6a6c6e,null,4);bx((x0+x1)/2,h-.1,z,x1-x0,.08,.08,0x6a6c6e);bx((x0+x1)/2,1,z,x1-x0,.06,.06,0x6a6c6e);}
function buildDelegacia(){
  env('inside',14);room(16,11,3,0x7a8088,0x5a5a56);
  // recepção
  counter(-4,3,4,.8,0x5a5f66,0x3a3a3a);bx(-4,1.1,2.6,4,1,.04,M(0xbfe6ff,{transparent:true,opacity:.25}));
  // mesas com computadores
  for(let i=0;i<3;i++)desk(-5+i*2.6,-1,0,true);papers(-3,-.2,30,4);
  // quadro de investigação
  bx(-1,1,-5.38,3.6,1.6,.05,0xb08a5a);for(let i=0;i<10;i++){const px=-2.5+R()*3,py=1.2+R()*1.2;item(px,py,-5.33,.32,.4,.01,0xe8e4dc);}for(let i=0;i<7;i++){const a=[-2.5+R()*3,1.4+R()*1,-5.32],b=[-2.5+R()*3,1.4+R()*1,-5.32];line([a,b],0xa3201c);}
  sign('PESSOAS AGRESSIVAS',-1,2.75,-5.3,3.4,.35,0,{bg:'#e8e4dc',fg:'#1a1a1a',font:'700 52px Arial',w:512,h:64});
  // celas
  wl(3,-5.5,3,1,3,0x7a8088);wl(5.5,-5.5,5.5,1,3,0x7a8088);bars(3.1,7.9,1,2.8);
  for(const x of[4.25,6.7]){bx(x,0,-4.8,.9,.5,1.9,0x5a5a5e);bx(x,1.1,-4.8,.9,.1,1.9,0x5a5a5e);}
  zombie(4.2,-.4,0,'w',null,{cloth:0xd06a1a,pants:0xd06a1a});zombie(6.6,-1.5,.4,'r',null,{cloth:0x5a5f66});zombie(7,-.2,-.3,'w');
  // vestiário e arsenal
  locker(-7.3,-4.9,6,0,0x4a5560);bx(-7.6,0,1,.12,2.4,1.4,M(0x5a5c5e,{metalness:.7,roughness:.3}));bx(-7.5,1.3,2,.05,.25,.2,E(0xff3a2a));
  zombie(-4,-3.6,.4,'w',null,{cloth:0x2a3a4a,vest:0x1c1d1f});zombie(-1.4,1.8,2.6,'w',null,{cloth:0x2a3a4a,vest:0x1c1d1f,dead:true});blood(-1.4,1.8,1.3);
  pl(-2,2.6,-1,0xcfe3ff,.9,12,true);pl(5.5,2.6,-2,0xff3030,.6,8);
  wl(3.4,3.2,3.4,5.5,2.4,0x7a8088);wl(3.4,2,8,2,2.4,0x7a8088);desk(6,4.3,Math.PI,true);bx(7.6,0,4.8,.6,1.4,.5,0x4a4a46);bx(5.2,0,2.4,.12,1.8,.12,0x6a6c6e);item(6.2,.79,4.1,.08,.01,.05,0xe8e8e4);zombie(5.2,3.4,2.4,'w',null,{cloth:0x5a5f66});
  wl(-6.2,1.8,-6.2,5.5,2.4,0x7a8088);rack(-7.4,3.6,3,'z',2.2,0x5d6063);for(let k=0;k<12;k++)item(-7.4,.05+Math.floor(k/4)*.42,2.4+(k%4)*.75,.4,.3,.45,pick([0x8a7a5a,0x6a5236,0x5a5a5e]));
  car(-2,8.6,1.57,0xe8e8e4,{police:true});
  pin(-7.4,2.6,1,'loot','Arsenal (classe D)','Carabina, munição em quantidade. Abre com o cartão do delegado.');
  pin(6,2,4.3,'loot','Sala do delegado','O cartão do arsenal está na gaveta. O delegado virou e ainda está na sala.');
  pin(-7.4,2.6,3.6,'loot','Depósito de evidências','Remédios apreendidos, facões e uma pistola sem registro.');
  pin(-2,3,8.6,'loot','Pátio de viaturas','Rádio da viatura e espingarda presa no painel.');
  pin(-1,3.2,-5.3,'cena','Quadro de investigação','Fotos de "pessoas agressivas" ligadas por barbante. A última é de uma criança.');
  pin(5.5,3.2,0,'perigo','Celas','Presos zumbis. Abrir a porta errada solta todos.');
  pin(-4,2.2,-3.6,'perigo','Policiais zumbis','Com colete: só tiro na cabeça resolve.');
  pin(-6,2.2,-4.9,'loot','Vestiário','Pistola .40, tonfa, algemas, rádio portátil.');
  pin(-3,1.2,-1,'loot','Mesas','Mapas da cidade com rotas de evacuação anotadas.');
  flush();
  return {r:24,th:.5,ph:.88,t:[0,0,1.5]};
}
function stretcher(x,z,ry,c){const g=grp(x,0,z,ry);bx(0,.7,0,.75,.12,2,c||0xd8d8d0,g);for(const a of[-1,1])for(const b of[-1,1])bx(a*.32,0,b*.85,.05,.7,.05,0x8a8c8e,g);return g;}
function buildHospital(){
  env('inside',16);room(18,11,3,0xb8bcb4,0x8a9290);
  wl(-9,-1,-1,-1,3,0xb8bcb4);wl(1,-1,9,-1,3,0xb8bcb4);
  // leitos com cortinas na ala (fundo)
  for(let i=0;i<5;i++){const x=-7.4+i*3.4;if(i===2)continue;stretcher(x,-3.6,0);bx(x+1.5,0,-3.6,.04,2.3,2.4,0x7a9aa0);cyl(x-1.1,0,-4.6,.18,.18,1.3,0x2e6b2e);bx(x,1.2,-5.3,.5,.4,.1,0x18191b);}
  // UTI com vidro e arranhões
  wl(-1,-5.5,-1,-1,3,0xb8bcb4);wl(1,-5.5,1,-1,3,0xb8bcb4);bx(0,0,-1,2,2.3,.06,M(0x9fc4d8,{transparent:true,opacity:.25}));for(let i=0;i<6;i++)item(-.6+i*.25,1,-.93,.03,.6,.01,0x4a0806);
  zombie(0,-3,0,'r',null,{cloth:0x8ab0c8});zombie(-.3,-4.4,.4,'w',null,{cloth:0x8ab0c8});
  // corredor: macas empilhadas, fita de quarentena
  for(let i=0;i<4;i++){const s=stretcher(4+i*.25,.2+i*.05,1.5+R()*.3);s.position.y=i*.25;s.rotation.z=(R()-.5)*.3;}
  for(let i=0;i<3;i++)bx(2.8,.8+i*.4,0,.04,.06,2,0xd8b02a);
  sign('QUARENTENA — ALA B',6,2.4,-.85,4,.5,0,{bg:'#d8b02a',fg:'#1a1a1a',font:'700 50px Arial',w:512,h:64});
  // pronto-socorro (frente)
  for(let i=0;i<3;i++)stretcher(-6.5+i*2.5,3.2,Math.PI/2,i===1?0x8ab0c8:0xd8d8d0);
  for(let i=0;i<6;i++)cyl(6.5+(i%3)*.5,0,4.2-Math.floor(i/3)*.5,.18,.18,1.4,0x2e6b2e);
  bx(1.5,0,3.8,2,1,.8,0x7a7c7e);for(let i=0;i<8;i++)item(.8+R()*1.4,1,3.6+R()*.4,.18,.08,.12,pick(MEDS));
  zombie(-4,2,1.4,'w',null,{cloth:0x8ab0c8});zombie(2,1.4,-1,'r',null,{cloth:0xe8e8e4});zombie(-6.5,3.2,0,'w',null,{cloth:0x8ab0c8,dead:true,y:.8});
  for(let i=0;i<8;i++)blood(-6+i*1.6,.2+R()*.6,.6);
  pl(-3,2.6,2,0xcfe3ff,.9,12,true);pl(4,2.6,-3,0xff3030,.7,10);
  pin(6.6,2,4,'perigo','Cilindros de oxigênio','Explodem com tiro ou fogo. Armadilha útil.');
  pin(4.5,2.2,.2,'quebra','Barreira de macas','Bloqueia a ala B. Dá para desmontar sem barulho.');
  pin(0,2.8,-1,'cena','UTI arranhada','Marcas de unha no vidro por dentro.');
  pin(1.5,1.8,3.8,'loot','Carrinho de emergência','Kit de sutura, soro, analgésico forte.');
  pin(-5,2.5,-3.6,'loot','Ala de internação','Monitores, lençóis e remédios nos armários.');
  pin(-4,2.4,2,'perigo','Pacientes corredores','Maior concentração de zumbis rápidos do mapa.');
  flush();
  return {r:23,th:.5,ph:.9,t:[0,0,0]};
}
function buildEscola(){
  env('inside',18);room(18,15,3,0xc8c0a0,0x8a7a62);
  wl(1,-7.5,1,-1,3,0xc8c0a0);wl(1,1,1,7.5,3,0xc8c0a0);
  wl(-9,-1,-4,-1,3,0xc8c0a0);wl(-3,-1,1,-1,3,0xc8c0a0);
  wl(-9,1.6,-6,1.6,3,0xc8c0a0);wl(-5,1.6,-2,1.6,3,0xc8c0a0);wl(-1,1.6,1,1.6,3,0xc8c0a0);wl(-3.5,1.6,-3.5,7.5,3,0xc8c0a0);
  // sala de aula
  bx(-4,1,-7.38,5,1.4,.05,0x2a3a2e);sign(['DIA 6','abrigo lotado','não tem mais vaga'],-4,1.7,-7.33,4.6,1.3,0,{fg:'#e8e8e0',font:'600 44px "Comic Sans MS", Arial',w:512,h:160});
  desk(-4,-6.5,0,false);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x=-7.4+i*2,z=-5.4+j*1.25;if(R()<.15){bx(x,0,z,.7,.05,.5,0x8a6a4a).rotation.z=1.4;continue;}const g=grp(x,0,z,0);bx(0,.7,0,.7,.04,.5,0x8a6a4a,g);bx(0,0,0,.6,.7,.05,0x3a3a3a,g);bx(0,.42,.45,.4,.04,.36,0x6a6a62,g);}
  for(let i=0;i<4;i++)zombie(-7+i*1.6,-3+R()*.8,R()*6,'w',null,{t:'c'});
  // corredor com armários
  locker(-8.6,1.15,9,0,0x7a3a2a);papers(-4,0,20,6);
  // biblioteca
  bx(-8.7,0,4.6,.4,2,5,0x5b4030);shelfItems(-8.5,4.6,4.6,'z',2,.8,BOOKS,1);for(let k=0;k<2;k++){bx(-6.6+k*1.6,0,4.8,.4,1.6,3,0x5b4030);shelfItems(-6.6+k*1.6,4.8,2.8,'z',1.6,.7,BOOKS,1);shelfItems(-6.6+k*1.6,4.8,2.8,'z',1.6,.7,BOOKS,-1);}
  table(-6,6.9,2,.8,0x6b4a30,0);for(let i=0;i<10;i++)item(-8+R()*4,0,2.2+R()*5,.22,.05,.3,pick(BOOKS),R()*3);
  // cozinha e refeitório
  counter(-1.2,2.25,4,.7,0x8a8c8e,0xa0a2a4);for(let i=0;i<3;i++)cyl(-2.6+i*1.3,.93,2.25,.32,.32,.45,0x8a8c8e,null,10);
  table(-1.2,4.9,3,1,0x8a8478,6);table(-1.2,6.6,3,1,0x8a8478,6);for(let i=0;i<10;i++)item(-2.6+R()*2.8,0,3.2+R()*4,.3,.2,.3,pick(FOOD),R()*3);zombie(-.4,5.7,2,'w',null,{cloth:0xe8e8e4});
  // quadra-abrigo
  plane(5,.02,0,7.8,14.6,0x5a6a7a);for(let i=0;i<5;i++)for(let j=0;j<5;j++)bx(2.4+i*1.4,0,-6+j*2.6,1,.12,1.9,pick([0x2a5a8a,0x3a6a3a,0x8a3a2a]));
  sign(['ABRIGO','DEFESA CIVIL'],5,2.2,-7.32,5,1.2,0,{bg:'#d06a1a',fg:'#1a1a1a',font:'800 50px Arial'});
  horde(14,2,8,-5,6,0);for(let i=0;i<5;i++)zombie(2+R()*6,-5+R()*10,R()*6,'w',null,{t:'c'});
  for(let i=0;i<14;i++)item(2+R()*6,0,-6+R()*12,.3,.2,.4,pick(FOOD),R()*3);
  pl(-4,2.6,-4,0xffc98a,.8,10);pl(5,2.6,0,0xcfe3ff,.8,14,true);pl(-4,2.6,4.5,0xffc98a,.6,9);
  pin(-4,2.7,-7.3,'cena','Lousa','Contagem dos dias até o 6º. "Abrigo lotado, não tem mais vaga."');
  pin(-5,1.6,-2.8,'perigo','Zumbis infantis','Mais rápidos e menores. Difíceis de acertar na cabeça.');
  pin(-4,1.4,-6.5,'loot','Mesa do professor','Chave da cozinha e kit de primeiros socorros.');
  pin(-6.6,2.4,4.8,'loot','Biblioteca','Livros de habilidade: mecânica, primeiros socorros, agricultura.');
  pin(-1.2,1.8,2.3,'loot','Cozinha da merenda','Arroz, feijão e óleo em quantidade. Panelas industriais.');
  pin(-1.2,1.4,5.8,'cena','Refeitório','Pratos servidos e largados no meio do almoço.');
  pin(-5,2.2,1.2,'loot','Armários de alunos','Mochilas, lanches, lanternas e cadernos.');
  pin(5,2.2,0,'perigo','Quadra-abrigo','O abrigo da Defesa Civil virou horda.');
  flush();
  return {r:26,th:.5,ph:.9,t:[0,0,0]};
}
function buildPosto(){
  env('night',30);ground(0x1d1f22);plane(0,.02,4,30,16,0x2a2c30);
  const cg=grp(0,0,4,0);for(const a of[-1,1])for(const b of[-1,1])bx(a*6,0,b*3,.5,5,.5,0xd8d4cc,cg);bx(0,5,0,18,.8,10,0xd8d4cc,cg);bx(0,5.1,5.05,18,.6,.05,E(0x2a6a3a),cg);
  const PU=[];for(let i=0;i<3;i++){const x=-6+i*6;bx(x,0,4,1.2,.2,3.4,0x6a6c6e);const pg=grp(x,0,4,0);bx(0,.2,0,.9,1.7,.6,0xc0392b,pg);bx(0,1.9,0,.9,.3,.6,0xe8e8e4,pg);PU.push(pg);line([[x+.45,1.3,4.2],[x+1.5,.05,5],[x+3,.05,6]],0x111111);}
  pl(0,4.6,4,0xe8f0ff,1.3,20,true);
  // loja de conveniência em corte
  const g=grp(0,0,-6,0);bx(0,-.1,0,14,.15,7,0x77746a,g);bx(0,0,-3.42,14,3,.16,0x8a8474,g);bx(-6.92,0,0,.16,3,7,0x8a8474,g);bx(6.92,0,0,.16,.6,7,0x8a8474,g);bx(0,0,3.42,14,.6,.16,0x8a8474,g);
  for(let i=0;i<3;i++){bx(-4+i*3,0,-6,.5,1.6,4,0x5d6063);shelfItems(-4+i*3,-6,3.8,'z',1.6,.35,FOOD,1);shelfItems(-4+i*3,-6,3.8,'z',1.6,.35,FOOD,-1);}
  bx(4.5,0,-8.6,3.6,2,.7,M(0x3b4045,{metalness:.4}));bx(4.5,.3,-8.24,3.4,1.5,.02,E(0x1f3b52));counter(4.6,-5,2.2,.8,0x5b4636);
  // troca de óleo
  plane(11,.01,-6,6,7,0x4a4a48);bx(11,0,-9.42,6,4,.16,0x6a6c6e);bx(13.92,0,-6,.16,.6,7,0x6a6c6e);for(const a of[-1,1])bx(11+a*1.5,0,-6,.25,2.2,.25,0xc0392b);const lc=car(11,-6,0,0x6b6450);lc.position.y=1.7;bx(11,1.6,-6,3.2,.1,4.6,0x3a3a3a);rack(13.4,-8.5,1.6,'z',1.8,0x55585b);for(let i=0;i<4;i++)barrel(8.8+(i%2)*.85,-8.7+Math.floor(i/2)*.85,0x2a4a6a);
  // placa de giz
  bx(-9,0,9,.1,1.4,.1,0x4a3324);bx(-9,0,9.2,.1,1.4,.1,0x4a3324);sign(['SEM GASOLINA','EXÉRCITO LEVOU'],-9,1.1,9.25,1.6,1,0,{bg:'#2a3a2e',fg:'#e8e8e0',font:'600 46px Arial',w:256,h:160});
  // fila de carros
  for(let i=0;i<4;i++)car(-14+i*.3,10+i*5.2,.05*i+.05,pick([0x5a2b26,0x2d3d4a,0x6b6450,0x4b4f55]));const ca=car(-3,6.2,Math.PI/2,0x3a3f2e);
  // posto em cadeia (laboratório de explosões): vazamento vira maçarico, bombas em cadeia a cada 0,4 s, carro, tanque subterrâneo 2 s depois com cogumelo de 16 m
  {const FL=new T.PointLight(0xffa040,0,60,2);FL.position.set(0,4,4);root.add(FL);
   const jet=new T.Mesh(new T.ConeGeometry(.25,2.4,8),new T.MeshBasicMaterial({color:0xffc060,transparent:true,opacity:.9}));jet.rotation.z=Math.PI/2;jet.position.set(-4.6,1.1,4.3);jet.visible=false;root.add(jet);
   const mk=(c)=>{const m=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:c,transparent:true,depthWrite:false}));m.visible=false;root.add(m);return m;};
   const B=[[-6,1,4,2.2,5],[0,1,4,2.2,5.4],[6,1,4,2.2,5.8],[-3,1,6.2,2.6,6.2],[0,0,4,5,8.2]].map(b=>({x:b[0],y:b[1],z:b[2],r:b[3],t0:b[4],ball:mk(0xffb040),smk:mk(0x2a2420),deb:Array.from({length:6},()=>{const d=new T.Mesh(new T.BoxGeometry(.25,.12,.3),M(0x3a3a3a));d.visible=false;root.add(d);return[d,(R()-.5)*14,6+R()*10,(R()-.5)*14];})}));
   const ring=new T.Mesh(new T.TorusGeometry(1,.5,8,20),new T.MeshBasicMaterial({color:0x5a3a28,transparent:true,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.visible=false;root.add(ring);
   const CY=16;ANIM.push(t=>{const k=t%CY;jet.visible=k>3&&k<5;jet.scale.set(1,.6+(k-3)*.5+Math.sin(t*40)*.1,1);let fl=0;
     B.forEach((b,i)=>{const u=k-b.t0;const on=u>0&&u<CY-b.t0-1.5;b.ball.visible=b.smk.visible=on;if(i<3)PU[i].visible=!(u>0);if(i===3)ca.visible=!(u>0);
       if(on){const big=i===4;const g=Math.min(1,u/.25);b.ball.position.set(b.x,b.y+(big?Math.min(16,u*7):u*.8),b.z);b.ball.scale.setScalar(b.r*g*(1+u*.15));b.ball.material.opacity=Math.max(0,1-u/1.6);b.ball.material.color.setHSL(.08-.06*Math.min(1,u/1.2),1,.55-.3*Math.min(1,u/1.6));
         b.smk.position.set(b.x,b.y+(big?Math.min(18,u*6):u*2),b.z);b.smk.scale.setScalar(b.r*(.6+u*.5));b.smk.material.opacity=Math.min(.75,u*.6)*Math.max(0,1-(u-4)/4);
         b.deb.forEach(([d,vx,vy,vz])=>{const tt=Math.min(u,2.2);d.visible=true;d.position.set(b.x+vx*tt*.5,Math.max(.06,b.y+vy*tt-9.8*tt*tt*.5),b.z+vz*tt*.5);d.rotation.set(u*6,u*4,0);});
         if(u<.5)fl=Math.max(fl,(big?60:25)*(1-u/.5));}else b.deb.forEach(([d])=>d.visible=false);});
     const ub=k-8.2;ring.visible=ub>0&&ub<6;if(ring.visible){ring.position.set(0,Math.min(14,ub*6),4);ring.scale.setScalar(2+ub*1.4);ring.material.opacity=Math.max(0,.7-ub*.12);}
     cg.rotation.z=ub>0?Math.min(.5,ub*.8):0;cg.position.y=ub>0?-Math.min(3.2,ub*4):0;
     FL.intensity=fl;});}
  horde(14,-16,10,10,24,Math.PI);zombie(4,-6,1,'w');zombie(-2,-4.2,2,'w',null,{cloth:0xc0392b});
  bx(-8.5,0,-4,1.6,2.4,1.6,0x8a8474);bx(-8.5,0,-3.18,.8,2,.04,0x3a2a1c);sign('BANHEIRO',-8.5,2.1,-3.15,1.2,.3,0,{bg:'#1a1a1a',fg:'#e8dfcf',w:256,h:64});
  pin(-8.5,2.8,-4,'cena','Banheiro externo','Trancado por dentro. Algo ainda bate na porta.');
  pin(0,3,4,'perigo','Posto em cadeia','A cada 16 s: a bomba 1 vaza e vira maçarico, as bombas explodem em cadeia a cada 0,4 s, depois o carro e, 2 s mais tarde, o tanque subterrâneo sobe num cogumelo de 16 m e derruba a cobertura.');
  pin(-4,2.2,-6,'loot','Conveniência','Salgadinhos, isqueiros, cigarro, mapa rodoviário.');
  pin(11,4,-6,'loot','Troca de óleo','Carro no elevador, galões, óleo de motor e macaco hidráulico.');
  pin(-9,2.4,9,'cena','Placa de giz','"SEM GASOLINA — EXÉRCITO LEVOU".');
  pin(-13,3,18,'quebra','Fila de carros','Tanques abertos. Mangueira e galão sifonam o que sobrou.');
  flush();
  return {r:36,th:.6,ph:1.13,t:[0,1,-1]};
}
function buildIgreja(){
  env('inside',16);room(12,20,7,0x8a8478,0x5a4a3a,{rightFull:false});
  // vitrais
  for(let i=0;i<4;i++){const z=-7+i*4.4;bx(-5.9,2.2,z,.06,3,1.4,E(pick([0x5a2a6a,0x2a4a8a,0x8a2a2a,0x2a6a3a])));}
  // altar e cruz
  bx(0,0,-9,6,.4,2,0x6a5a48);bx(0,.4,-8.8,2.4,1,.9,0xd8d0c0);bx(0,1.5,-9.75,.25,3.4,.15,0x4a3324);bx(0,3.6,-9.75,1.6,.25,.15,0x4a3324);
  for(let i=0;i<10;i++){cyl(-1.1+i*.25,1.4,-8.7,.03,.03,.25,0xe8e0c8);}pl(0,2,-8,0xffb45e,1.2,10);
  // bancos
  for(let i=0;i<7;i++)for(const s of[-1,1]){if(R()<.15)continue;const g=grp(s*2.6,0,-5.5+i*1.8,0);bx(0,.45,0,3.6,.08,.5,0x5a3a24,g);bx(0,.5,-.25,3.6,.6,.06,0x5a3a24,g);for(const a of[-1.7,1.7])bx(a,0,0,.08,.45,.5,0x4a3020,g);}
  // sobreviventes religiosos
  human(-2,-7,0,null,{cloth:0x2a2a2a});human(2.2,-6.4,-.3,null,{cloth:0x6a5a48});human(0,-6.6,0,null,{cloth:0xd8d0c0});
  // doentes acorrentados no salão (frente)
  wl(-6,6,6,6,2.4,0x8a8478);for(let i=0;i<4;i++){const x=-4.5+i*3;zombie(x,8.4,Math.PI,'w');bx(x,0,9.8,.2,.2,.2,0x5a5a5e);line([[x,1.1,8.6],[x,.15,9.8]],0x777777);}
  for(let i=0;i<20;i++){const x=-3+R()*6;cyl(x,0,4+R()*1.6,.04,.04,.2,0xe8e0c8);}pl(0,1,5,0xffb45e,.6,6);
  // torre do sino (fora, à esquerda)
  bx(-8.5,0,-9,3,10,3,0x8a8478);cyl(-8.5,8,-9,.7,1,1.2,M(0x8a6a2a,{metalness:.7,roughness:.3}));
  wl(3.4,-10,3.4,-7.8,2.6,0x8a8478);wl(3.4,-6.8,6,-6.8,2.6,0x8a8478);wardrobe(5.2,-9.4,0,0x4a3324);table(4.6,-7.8,1,.6,0x5b4030,0);for(let i=0;i<4;i++)item(4.3+i*.2,.78,-7.8,.07,.3,.07,0x3a1a2a);
  bx(-5.5,0,4.5,.6,1.8,1.2,0x5b4030);for(let i=0;i<8;i++)item(-5.2,.1+Math.floor(i/4)*.5,4.05+(i%4)*.3,.3,.3,.25,pick([0x8a2a2a,0x2a4a6a,0xd8d0c0,0xc0392b]));
  pin(-8.5,10.5,-9,'perigo','Sino','Tocar atrai toda horda num raio de 1,5 km. Pode ser usado como isca.');
  pin(0,2.4,-6.6,'cena','Grupo de fé','Sobreviventes que vivem na igreja e se recusam a matar os "doentes".');
  pin(0,2.4,8.4,'perigo','Doentes acorrentados','Familiares infectados presos no salão paroquial.');
  pin(2.6,1.4,0,'quebra','Bancos','Viram tábuas para barricada.');
  pin(0,2.4,-8.8,'loot','Altar','Velas e fósforos.');
  pin(4.6,2.2,-8.4,'loot','Sacristia','Vinho, chave da torre do sino e o livro com os nomes de quem passou por ali.');
  pin(-5.5,2.2,4.5,'loot','Armário de doações','Comida enlatada e roupas.');
  flush();
  return {r:30,th:.55,ph:.85,t:[0,1,0]};
}
function buildGalpao(){
  env('inside',22);room(30,20,8,0x6a6458,0x4a4844);
  // prensas e tornos
  for(let i=0;i<4;i++){const x=-11+i*5;bx(x,0,-6,2.2,3.2,1.8,0x4a5a6a);bx(x,3.2,-6,1.6,.8,1.4,0x3a4a5a);bx(x,1.4,-5,1.4,.3,.4,0xd8b02a);}
  // porta-pallets
  for(let k=0;k<3;k++){rack(-10+k*6,4,4.5,'x',4,0x2a4a8a);for(let l=0;l<3;l++)for(let m=0;m<3;m++)if(R()<.75)bx(-11.5+k*6+m*1.5,.05+l*1.35,4,1.2,1,1,pick([0x6a5236,0x8a7a5a,0x5a5a5e]));}
  // empilhadeira
  const fk=grp(10,0,7.4,.5);bx(0,.2,0,1.3,1.2,2.2,0xd8b02a,fk);bx(0,1.4,-.3,1.2,1.2,1.2,0x1a1a1a,fk);bx(0,0,1.5,1,2.6,.1,0x3a3a3a,fk);bx(0,.1,1.9,1,.06,1,0x3a3a3a,fk);
  // linha de produção ligada no gerador
  bx(4,0,-2.5,16,1,1.2,0x3a3a3a);const rolls=[];for(let i=0;i<16;i++){const r=cyl(-3.5+i,1,-2.5,.12,.12,1.15,0x8a8c8e,null,6);r.rotation.x=Math.PI/2;rolls.push(r);}
  const boxes=[];for(let i=0;i<6;i++)boxes.push(bx(-3+i*2.5,1.1,-2.5,.7,.5,.7,0x8a7a5a));ANIM.push(t=>{boxes.forEach((b,i)=>{b.position.x=-4+((t*.8+i*2.5)%16);});rolls.forEach(r=>r.rotation.y=t*4);});
  bx(12.5,0,-8,2,1.4,1.4,0x8a2a22);fire(12.5,1.4,-8,.3);
  // mezanino do escritório
  bx(-10.5,3,-8.2,8,.2,3.4,0x5a5852);for(const x of[-14,-7])bx(x,0,-6.6,.2,3,.2,0x5a5852);for(let i=0;i<10;i++)bx(-6.2+i*.25,i*.3,-6.4,.6,.3,1,0x5a5852);bx(-10.5,3.2,-9.8,8,2.4,.1,M(0x9fc4d8,{transparent:true,opacity:.25}));desk(-11,-8.6,0,true);
  // tambores
  for(let i=0;i<6;i++)barrel(10+(i%3)*.9,4+Math.floor(i/3)*.9,i%2?0x2a4a8a:0x9b1c18);
  // horda dormente
  horde(30,-2,9,-.8,2.6,R()*6);
  locker(14.6,-3,6,-Math.PI/2,0x4a5560);table(-12,8.2,3,1,0x8a8478,6);table(-8,8.2,3,1,0x8a8478,6);bx(-14.4,0,6,.8,1.6,.6,0xd8d8d0);
  bx(9,0,-9.88,5,4.5,.08,M(0x6a6c6e,{metalness:.5}));for(let y=.4;y<4.5;y+=.5)bx(9,y,-9.82,5,.04,.02,0x3a3a3a);

  pl(-10,4,-8,0xcfe3ff,.6,12,true);pl(4,4,-6,0xffd27a,.8,14);
  pin(4,2.2,-2.5,'cena','Linha ligada no gerador','Gira sozinha há dias e chama zumbis da região.');
  pin(3,2.4,1,'perigo','Horda dormente','Acorda com barulho de máquina ou tiro. Escuridão total.');
  pin(14.4,2.2,-2,'loot','Vestiário','Botas, capacete, luvas e uniformes de operário.');
  pin(-10,1.6,8.2,'cena','Refeitório','Marmitas ainda nas mesas. O turno da noite não terminou o jantar.');
  pin(9,5,-9.8,'quebra','Porta de enrolar','Sai para o pátio de carga. Abre com muito barulho.');
  pin(-10,4.6,4,'loot','Porta-pallets','Chapas, pregos, parafusos, EPI. Material de base.');
  pin(-10.5,6,-8.2,'loot','Escritório no mezanino','Chave do gerador e mapa da rede de esgoto industrial.');
  pin(10.5,2,4.4,'quebra','Tambores','Alguns inflamáveis. Tiro neles vira explosão.');
  pin(10,2.2,7.4,'loot','Empilhadeira','Move pallets para fechar portões. Faz muito barulho.');
  flush();
  return {r:38,th:.5,ph:.88,t:[0,1,0]};
}
function buildFazenda(){
  env('dusk',50);ground(0x3d3a26);
  for(let i=0;i<14;i++)item(-30+i*2.4,0,-28,1.6,.3,30,0x4a5a2c);
  // casa sede
  {const hx=-10,hz=0;plane(hx,.02,hz,12,9,0x6a5a44);bx(hx,0,hz-4.42,12,3,.16,0xc8b898);bx(hx-5.92,0,hz,.16,3,9,0xc8b898);bx(hx+5.92,0,hz,.16,.6,9,0xc8b898);bx(hx,0,hz+4.42,12,.6,.16,0xc8b898);wl(hx+1,hz-4.5,hx+1,hz+.5,2.6,0xc8b898);
    bx(hx-4.5,0,hz-3.6,1.6,.9,.8,0x6a5a4a);bx(hx-4.5,.9,hz-4.1,.5,2.2,.4,0x7a5a4a);pl(hx-4.5,1.4,hz-3.2,0xff8a3a,1.2,6);table(hx-2.6,hz-.6,2,1,0x6b4a30,4);
    const rd=bx(hx+3.5,1,hz-2.2,.8,.06,2.6,0x8a2a22);rd.rotation.x=.1;line([[hx+3.5,1.05,hz-3.6],[hx+3.5,2.6,hz-4.3]],0x8a7a5a);bed(hx+3.8,hz+2.4,Math.PI,true,0x4a5a2a);
    for(let i=0;i<10;i++)item(hx-5.4,.1+Math.floor(i/5)*.4,hz+1+(i%5)*.4,.3,.3,.3,pick(FOOD));leftWin(hx-6,hz-1,1.4,1.1,1,true);backWin(hx+3,hz-4.5,1.4,1,1.2,true);}bx(-10,0,5.4,12,.25,2.4,0x6a4a30);for(const a of[-5.6,5.6])bx(-10+a,.25,6.4,.15,2.6,.15,0x6a4a30);bx(-10,2.8,5.6,12.6,.12,3,0x6a3a2a);
  human(-8,6,0,null,{cloth:0x5a4a3a,hat:0x8a7a5a,aim:true});human(-12.5,5.8,.3,null,{cloth:0x6a2a22,aim:true});
  // celeiro
  const bn=grp(14,0,-6,0);bx(0,0,0,10,6,14,0x7a2a22,bn);prism(0,6,0,10.6,4,14.6,0x3a2a22,bn);bx(0,0,7.05,4,4.5,.1,0x3a1a14,bn);
  for(let i=0;i<10;i++){const b=cyl(14+R()*8-4,0,4+R()*4,.6,.6,1.2,0xc0a050,null,10);b.rotation.z=Math.PI/2;b.position.y=.6;}
  silo(26,-12,3,12);
  // galinheiro e curral
  bx(4,0,12,4,1.6,3,0x8a7a5a);fence(-6,14,16,14,1.3,0x6a4a30);fence(16,14,16,24,1.3,0x6a4a30);fence(-6,24,16,24,1.3,0x6a4a30);fence(-6,14,-6,24,1.3,0x6a4a30);
  // poço
  cyl(-22,0,8,1,1,.9,0x7a766c,null,10);for(const a of[-1,1])bx(-22+a*.9,.9,8,.12,1.4,.12,0x4a3324);prism(-22,2.3,8,2.4,.8,1.4,0x6a3a2a);
  tractor(4,-2,1.2);
  // espantalho e zumbis na estrada
  bx(-24,0,-14,.15,2.6,.15,0x4a3324);bx(-24,2.1,-14,2,.12,.12,0x4a3324);zombie(-24,-13.8,0,'w',null,{y:.6,still:true,dead:false});
  plane(0,.02,36,80,8,0x4a4030);for(let i=0;i<20;i++){const r=R();zombie(lerp(-40,-10,R()),lerp(34,38,R()),Math.PI/2+(R()-.5)*.04,r<.7?'w':r<.93?'r':'b',null,{walk:true,wlen:70,v:r<.7?1.4:r<.93?1.6:1.1});}zombie(6,18,1,'w',null,{cloth:0x8a7a5a,t:'b'});vaca3(2,20,.5,{dead:true});blood(2,20,1.8);urubus3(2,20,4,9,5);cao3(10,17,1,{inf:true});cao3(12,21,-2,{inf:true});tfPig(-2,16,.4,{z:true});tfPig(0,22,2,{z:true});tfPig(13,16,-1,{z:true});human(-12,-1.5,.5,null,{cloth:0x4a5a6a});
  {const sx=-26,sz=-4;for(const a of[-1,1])for(const b of[-1,1])bx(sx+a*5,0,sz+b*4,.3,4,.3,0x4a3324);bx(sx,4,sz,11,.2,9,0x5a5a56);tractor(sx-2,sz,0);const pw=grp(sx+3,0,sz,0);for(let i=0;i<4;i++){const d=bx(i*.5-.75,0,0,.1,.6,1.2,0x6a6c6e,pw);d.rotation.z=.3;}bx(0,.5,0,2,.12,.2,0x6a6c6e,pw);}
  pin(-14.5,1.4,-3.2,'cena','Dentro da casa sede','Fogão a lenha aceso, redes, comida para semanas. Três pessoas vivem aqui.');
  pin(-26,5,-4,'loot','Galpão de máquinas','Segundo trator, arado, ferramentas e diesel.');
  pin(-5,3.6,6.5,'perigo','Casa pregada por dentro','Família viva que atira em quem chega pela estrada.');
  pin(14,11,-6,'loot','Celeiro','Ferramentas, foice, machado, combustível de trator, fardos (inflamáveis).');
  pin(-22,3.4,8,'loot','Poço','Água infinita. Motivo para fazer base aqui.');
  pin(5,1.6,19,'perigo','Animais infectados','Porcos e cachorros viram zumbis. O gado mordido morre, não levanta, e a carcaça chama zumbis e urubus.');
  pin(0,3,38,'perigo','Horda da estrada','Hordas migratórias passam pela rodovia ao sul.');
  pin(4,2.6,-2,'loot','Trator','Puxa carroça, derruba cercas e esmaga zumbis. Barulhento.');
  flush();
  return {r:62,th:.6,ph:.95,t:[0,2,6]};
}
function cot(x,z,ry){const g=grp(x,0,z,ry);bx(0,.45,0,.8,.08,1.9,0x5a6146,g);for(const a of[-1,1])for(const b of[-1,1]){const l=bx(a*.35,0,b*.85,.04,.45,.04,0x3a3a3a,g);l.rotation.x=b*.3;}return g;}
function buildTriagem(){
  env('inside',14);
  plane(0,.01,0,16,10,0x4a4a3a);
  // lona só do fundo
  bx(0,0,-5,16,3.8,.06,0x4f5638);bx(-8,0,0,.06,3.4,10,0x4f5638);
  wl(0,-5,0,5,1.6,0x5a6146);
  sign('LIMPO',-4,2.8,-4.9,3,.9,0,{bg:'#e8dfcf',fg:'#2e6b2e',font:'800 72px Arial'});sign('MORDIDO',4,2.8,-4.9,3.6,.9,0,{bg:'#e8dfcf',fg:'#a3201c',font:'800 64px Arial'});
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){cot(-6.4+i*2.1,-2.6+j*3.6,0);cot(2+i*2.1,-2.6+j*3.6,0);}
  for(let i=0;i<4;i++)zombie(-6+R()*5,-3+R()*6,R()*6,'w');for(let i=0;i<6;i++)zombie(1.5+R()*6,-3+R()*6,R()*6,R()<.5?'r':'w');
  zombie(3,1,0,'w',null,{dead:true,cloth:0x4f5638});blood(3,1,1.4);
  for(let i=0;i<6;i++)crate(7.2,-4.2+i*.9,.7,0);bx(-7.2,0,4,1,.6,1.6,0x5a6146);for(let i=0;i<4;i++){const r=rifle(-7.2+(i-1.5)*.2,1.2,4,0);r.rotation.x=-Math.PI/2+.2;}
  for(let i=0;i<12;i++)item(-1+R()*2,0,-4+R()*8,.25,.02,.35,0xe8e4dc,R()*3);
  pl(-3,3,0,0xe8f0ff,.7,10,true);pl(4,3,0,0xff3030,.5,10);
  pin(-4,3.6,-4.9,'cena','Lado "LIMPO"','Quem não tinha mordida. Os sintomas vieram depois.');
  pin(4,3.6,-4.9,'cena','Lado "MORDIDO"','Separados para observação. Ninguém saiu.');
  pin(7.2,1.6,-2,'loot','Caixas médicas','Ataduras, morfina, rações militares.');
  pin(-7.2,1.8,4,'loot','Fuzis no cavalete','Fuzil 5,56 e carregadores. Fica perto da saída.');
  pin(0,2.2,0,'quebra','Lona','Cortar a lona abre saída em qualquer lado.');
  flush();
  return {r:20,th:.5,ph:.9,t:[0,0,0]};
}

// =====================================================================
// REGISTRO DAS CENAS
// =====================================================================
// =====================================================================
// PADRÕES E TERRENO
// =====================================================================
// postes do padrão urbano (mapa, seção 05)
let LB=0;
function poleLED(x,z,on,ry,flick){const g=grp(x,0,z,ry||0);cyl(0,0,0,.1,.14,9,M(0x55595e,{metalness:.6,roughness:.5}),g);for(const s of[-1,1]){bx(s*.8,8.8,0,1.6,.1,.12,0x55595e,g);bx(s*1.5,8.6,0,.6,.12,.3,on?E(0xeef4ff):0x3a3a3a,g);}if(on&&LB-->0)pl(x,8,z,0xdfe8ff,1.3,24,flick);}
function poleConcrete(x,z,dir,on,tr){cyl(x,0,z,.12,.2,8,0x8a8a84,null,4);bx(x+dir*.7,7.6,z,1.4,.1,.1,0x6a6a66);bx(x+dir*1.35,7.45,z,.5,.16,.3,on?E(0xffa040):0x3a3a3a);if(tr)cyl(x-dir*.35,6.2,z,.28,.28,.7,0x5a5e62,null,8);if(on&&LB-->0)pl(x+dir*1.35,7.2,z,0xff9a40,1.3,20);}
function poleIron(x,z,on){cyl(x,0,z,.06,.12,4,0x1e2022,null,8);bx(x,4,z,.42,.5,.42,on?E(0xffd090):0x2a2a2a);cone(x,4.5,z,.36,.3,0x1e2022,null,4);if(on&&LB-->0)pl(x,3.9,z,0xffc880,1.0,14);}
function poleWood(x,z,on){cyl(x,0,z,.11,.14,7,0x5a4630,null,6);bx(x,6.6,z,1.2,.08,.08,0x4a3a28);bx(x+.5,6.35,z,.16,.22,.16,on?E(0xffe08a):0x3a3a3a);if(on&&LB-->0)pl(x+.5,6.2,z,0xffd27a,.9,16);}
function floodTower(x,z,on){for(const a of[-1,1])for(const b of[-1,1])bx(x+a*.4,0,z+b*.4,.12,12,.12,0x6a6c6e);bx(x,12,z,2,.15,1.2,0x6a6c6e);for(let i=0;i<3;i++)bx(x-.6+i*.6,12.2,z+.4,.45,.35,.2,on?E(0xfff2d8):0x3a3a3a);if(on&&LB-->0)pl(x,11.5,z+2,0xfff0d0,1.6,34);}
function atY(y,fn){const r0=root;root=grp(0,y,0,0,r0);fn();root=r0;}
function lightning(){const fl=new T.DirectionalLight(0xdfe6ff,0);fl.position.set(40,120,-30);root.add(fl);ANIM.push(t=>{const k=t%11;fl.intensity=(k<.1||(k>.22&&k<.3))?2.6:0;});}
function dust(n,sx,sz){const g=new T.BufferGeometry(),a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=(R()-.5)*sx;a[i*3+1]=R()*8;a[i*3+2]=(R()-.5)*sz;}g.setAttribute('position',new T.BufferAttribute(a,3));const pts=new T.Points(g,new T.PointsMaterial({color:0xb8a080,size:.35,transparent:true,opacity:.55,depthWrite:false}));pts.userData.own=true;root.add(pts);ANIM.push(t=>{pts.position.x=((t*6)%sx)-sx/2;});}
function wires(P,y,c){line(P.map(p=>[p[0],y,p[1]]),c||0x2a2a2a);}
function stripLabel(x,z,t,sub){sign([t,sub],x,2.4,z,22,4.4,0,{bg:'rgba(16,18,22,.9)',fg:'#e8dfcf',font:'700 44px "Arial Narrow", Arial, sans-serif',w:1024,h:200});}
function sobrado(x,z,w,d,c,roof,ry){const g=grp(x,0,z,ry);bx(0,0,0,w,6,d,c,g);prism(0,6,0,w+.4,1.4,d+.4,roof||0x5a3a2a,g);bx(0,3.1,d/2+.5,w*.6,.15,1,0x6a6a66,g);for(const f of[0,1])for(const s of[-1,1])bx(s*w*.26,1.1+f*3,d/2+.03,1.1,1.2,.04,R()<.12?E(0xffb45e):M(0x10151b),g);bx(0,0,d/2+.02,1,2.1,.05,0x2a1d14,g);return g;}
function laje(x,z,w,d,fl,c){const g=grp(x,0,z,0);for(let f=0;f<fl;f++){bx(0,f*2.9,0,w,2.9,d,f===fl-1&&R()<.5?0x9a6a50:c,g);bx(0,f*2.9+1.1,d/2+.03,1,1,.04,R()<.1?E(0xffb45e):M(0x10151b),g);}cyl(w*.25,fl*2.9,-d*.2,.55,.55,.9,0x2a5aa0,g,10);for(let k=0;k<fl;k++)bx(w/2+.4,k*2.9,0,.8,.18,1.2,0x7a7a74,g);if(R()<.6)for(let i=0;i<4;i++)bx(-w*.3+i*.4,fl*2.9,0,.02,1,.02,0x8a8a8a,g);return g;}
function colonial(x,z,w,c,door){const g=grp(x,0,z,0);bx(0,0,0,w,4.2,10,c,g);bx(0,4.2,4.6,w,.8,.25,c,g);prism(0,4.2,-.4,w,1.4,9.6,0x7a4a32,g);for(let i=0;i<Math.max(1,Math.floor(w/2.2));i++){const u=(i-(Math.floor(w/2.2)-1)/2)*2.2;bx(u,1.0,5.02,.9,2.0,.05,i===0&&door?0x3a2416:(R()<.15?E(0xffb45e):0x2a3a4a),g);}return g;}
function chalet(x,z,c,ry){const g=grp(x,0,z,ry);bx(0,0,0,7,.8,9,0x5a5650,g);bx(0,.8,0,7,4.2,9,c||0x6b4a30,g);prism(0,5,0,7.6,4,9.6,0x2c2a28,g);bx(2.2,5,-1,.8,4.2,.8,0x5a5650,g);bx(0,1.6,4.52,1.3,1.3,.04,R()<.3?E(0xffb45e):M(0x10151b),g);bx(0,6.2,4.6,1,1,.04,M(0x10151b),g);return g;}
function companyHouse(x,z,c){const g=grp(x,0,z,0);bx(0,0,0,6,3,9,c||0xd8d0c0,g);prism(0,3,0,6.4,1.6,9.4,0x8a4a32,g);bx(0,0,4.52,.9,2.1,.05,0x3a2a1c,g);bx(1.8,1.1,4.52,1,1,.04,M(0x10151b),g);fence(-3.2,6.5,3.2,6.5,.9,0xe0d8c8);return g;}
function stilt(x,z,c){const g=grp(x,0,z,0);for(const a of[-2,2])for(const b of[-3,3])cyl(a,-1.5,b,.12,.12,3.1,0x3a2a1c,g,6);bx(0,1.5,0,5,.2,7,0x5a4630,g);bx(0,1.7,0,4.6,2.6,6.4,c||0x6a5a46,g);prism(0,4.3,0,5.2,1.1,7,0x7a7a78,g);bx(0,1.5,5,1.2,.15,4,0x5a4630,g);return g;}
function farmhouse(x,z){const g=grp(x,0,z,0);bx(0,0,0,15,3.2,11,0xd8cfb8,g);prism(0,3.2,0,17,2.2,13,0x8a4a32,g);bx(0,0,6.8,15,.25,2.6,0x6a5a46,g);for(let i=0;i<6;i++)cyl(-7+i*2.8,0,7.8,.1,.1,3.2,0x5a4630,g,6);bx(-3,1.0,5.52,1.2,1.2,.04,E(0xffb45e),g);return g;}
function buildPadraoRuas(){
  env('dusk',140);ground(0x1e2124,500);LB=16;
  const cell=(i,j)=>[-80+i*80,-56+j*56];
  // 1. Centro
  {const[x0,z0]=cell(0,0);plane(x0,.02,z0,60,14,0x222428);bx(x0,0,z0,60,.18,1.6,0x3a4a2c);for(let u=-26;u<=26;u+=25)poleLED(x0+u,z0,true);
   for(let i=0;i<4;i++){const h=12+R()*24;building(x0-21+i*14,z0-18,12,12,h,pick(FAC),{lit:.1});building(x0-21+i*14,z0+18,12,12,12+R()*18,pick(FAC),{lit:.08});}
   walk(x0,z0-10,60,3);walk(x0,z0+10,60,3);car(x0-8,z0-3,1.57,0x6b6450);stripLabel(x0,z0+28,'CENTRO','avenida 2 × 7 m · LED branco a cada 25 m');}
  // 2. Subúrbio
  {const[x0,z0]=cell(1,0);road(x0,z0,7,60,'x');walk(x0,z0-4.5,60,2);walk(x0,z0+4.5,60,2);
   for(let i=0;i<5;i++){const x=x0-24+i*12;(i%2?sobrado:house)(x,z0-15,8,10,pick([0xc8b89a,0xa8b0a0,0xd0c0a0,0xb8a890]),0x6a3a2a,0);bx(x,0,z0-5.8,10,1.8,.2,0xbab2a0);bx(x+3.5,0,z0-5.7,2.4,1.6,.06,0x3a3a3a);bx(x,0,z0+5.8,10,1.8,.2,0xbab2a0);bx(x-3.5,0,z0+5.7,2.4,1.6,.06,0x3a3a3a);}
   for(const u of[-26,9])poleConcrete(x0+u,z0-4.8,1,R()<.75,u>0);wires([[x0-28,z0-4.8],[x0+28,z0-4.8]],6.9);
   for(let i=0;i<5;i++)house(x0-24+i*12,z0+15,8,10,pick([0xc8b89a,0xa8b0a0,0xd0c0a0]),0x6a3a2a,Math.PI);
   stripLabel(x0,z0+28,'SUBÚRBIO','casa térrea e sobrado · muro 1,8 m · sódio a cada 35 m');}
  // 3. Bairro popular
  {const[x0,z0]=cell(2,0);road(x0,z0,6,60,'x');
   for(let i=0;i<10;i++){laje(x0-27+i*6,z0-9,5.6,10,1+Math.floor(R()*3),pick([0xa0624a,0x9a6a54,0x8a5a44]));laje(x0-27+i*6,z0+9,5.6,10,1+Math.floor(R()*3),pick([0xa0624a,0x9a6a54,0xc8c0b0]));}
   for(let u=-24;u<=26;u+=36+R()*8)poleConcrete(x0+u,z0-3.5,1,R()<.5,true);for(let k=0;k<4;k++)wires([[x0-26,z0-3.5+k*.15],[x0+26,z0-3.5+(R()-.5)*2]],6.3+k*.25,0x1a1a1a);
   stripLabel(x0,z0+28,'BAIRRO POPULAR','lajes de 1 a 3 · caixa d\'água azul · metade das luzes queimadas');}
  // 4. Rua histórica
  {const[x0,z0]=cell(0,1);plane(x0,.03,z0,60,5,0x4a4642);for(let u=-28;u<28;u+=.9)item(x0+u,.03,z0+(R()-.5)*4,.8,.04,.6,pick([0x5a5650,0x4e4a46,0x625e58]));
   let x=x0-28;while(x<x0+26){const w=5+Math.floor(R()*3);colonial(x+w/2,z0-8,w,pick([0xd8c8a0,0xa8c0c0,0xe0b890,0xc0a8b8,0xd0d0c0]),true);x+=w;}
   x=x0-28;while(x<x0+26){const w=5+Math.floor(R()*3);const g=colonial(x+w/2,z0+8,w,pick([0xd8c8a0,0xa8c0c0,0xe0b890,0xc0a8b8]),true);g.rotation.y=Math.PI;x+=w;}
   for(let u=-25;u<=25;u+=20)for(const s of[-1,1])poleIron(x0+u+(s>0?10:0),z0+s*2.9,R()<.8);
   stripLabel(x0,z0+28,'RUA HISTÓRICA','casas coloniais coladas · pedra 5 m · ferro fundido a cada 20 m');}
  // 5. Industrial
  {const[x0,z0]=cell(1,1);plane(x0,.02,z0,60,40,0x2a2b2c);
   for(const s of[-1,1]){const g=grp(x0+s*15,0,z0-6,0);bx(0,0,0,26,10,30,0x6a6c68,g);const rf=new T.Mesh(new T.CylinderGeometry(13,13,30,16,1,false,0,Math.PI),M(0x5a5c58));rf.rotation.set(Math.PI/2,0,Math.PI/2);rf.position.set(0,10,0);rf.scale.set(1,1,.25);rf.castShadow=true;g.add(rf);bx(0,0,15.05,6,5,.1,0x3a3a3a,g);bx(0,6,15.06,10,1.2,.05,0xd8b02a,g);}
   floodTower(x0-30,z0+14,true);floodTower(x0+30,z0+14,false);container(x0+20,0,z0+14,.2,0x8a3a2a);
   stripLabel(x0,z0+28,'INDUSTRIAL E PORTO','galpão (amostra encurtada) · torre de refletor a cada 60 m');}
  // 6. Vila ferroviária
  {const[x0,z0]=cell(2,1);road(x0,z0,6,60,'x');for(let i=0;i<6;i++){companyHouse(x0-25+i*10,z0-12,pick([0xd8d0c0,0xd0c8b4]));const g=companyHouse(x0-25+i*10,z0+12,0xd8d0c0);g.rotation.y=Math.PI;}
   for(const u of[-26,9])poleConcrete(x0+u,z0-4,1,R()<.7,u>0);wires([[x0-26,z0-4],[x0+26,z0-4]],6.9);
   stripLabel(x0,z0+28,'VILA FERROVIÁRIA','casas da companhia, todas iguais · poste residencial a cada 35 m');}
  // 7. Serra
  {const[x0,z0]=cell(0,2);plane(x0,.02,z0,60,6,0x2a2a28);for(let i=0;i<5;i++){chalet(x0-24+i*12,z0-12,pick([0x6b4a30,0x5a3e28,0x7a5a3a]));chalet(x0-24+i*12+6,z0+12,pick([0x6b4a30,0x5a3e28]),Math.PI);}
   for(let u=-25;u<=25;u+=20)for(const s of[-1,1])poleIron(x0+u+(s>0?10:0),z0+s*2.6,R()<.7);for(let i=0;i<10;i++)pine(x0-28+R()*56,z0+(R()<.5?-22:22),1.4+R());
   stripLabel(x0,z0+28,'SERRA · RUA DAS POUSADAS','chalé de madeira e pedra · telhado 45° · ferro fundido a cada 20 m');}
  // 8. Palafitas
  {const[x0,z0]=cell(1,2);plane(x0,.04,z0-2,60,30,M(0x22343e,{roughness:.25,metalness:.3}));bx(x0,0,z0+14,60,.2,8,0x4a4436);
   bx(x0,1.3,z0,56,.2,2,0x5a4630);for(let u=-26;u<=26;u+=4)cyl(x0+u,-1.5,z0+.9,.1,.1,2.9,0x3a2a1c,null,5);
   for(let i=0;i<5;i++){stilt(x0-22+i*11,z0-7,pick([0x6a5a46,0x5a6a6a,0x7a5a46]));bx(x0-22+i*11+1.5,3.2,z0-3.4,.2,.28,.2,i%2?E(0xffc070):0x3a3a3a);}pl(x0-11,3,z0-3,0xffb060,.9,10);
   bx(x0+14,-.2,z0+6,1.6,.5,4.6,0x5a3a2a);stripLabel(x0,z0+28,'PALAFITAS','madeira sobre estacas · sem luz pública · lampião');}
  // 10. Militar
  {const x0=160,z0=0;plane(x0,.02,z0,60,40,0x3a3a30);for(let u=-28;u<=28;u+=4)cyl(x0+u,0,z0-12,.06,.06,3,0x6a6c6e,null,4);line([[x0-28,2.9,z0-12],[x0+28,2.9,z0-12]],0x9a9a9a);
   for(const u of[-20,20])watchtower(x0+u,z0-14,true);pl(x0,3,z0-10,0xff2a1a,1.2,16);bx(x0,2.6,z0-11.7,.3,.3,.3,E(0xff2a1a));sandbags(x0,z0-6,10,'x',3);for(let i=0;i<3;i++)tent(x0-14+i*14,z0+8,0,6,8);
   stripLabel(x0,z0+28,'MILITAR','torre de vigia e tripé · holofote branco · luz vermelha · a cada 40 m');}
  pin(160,12,-14,'local','Militar','Base, bloqueio e penitenciária: torres com holofote branco e luz vermelha de emergência no perímetro.');
  // 9. Rural
  {const[x0,z0]=cell(2,2);plane(x0,.02,z0,60,6,0x4a3a2a);plane(x0,.01,z0+15,60,22,0x3a4a2a);farmhouse(x0-10,z0-14);poleWood(x0+6,z0-4,true);fence(x0-28,z0-4,x0+28,z0-4,1.2,0x5a4630);
   for(let i=0;i<8;i++)tree(x0+8+R()*20,z0-16+R()*10,1+R()*.5);for(let r=0;r<6;r++)for(let i=0;i<20;i++)item(x0-26+i*2.7,0,z0+8+r*2.2,.4,.6+R()*.3,.4,0x4a5a2a);
   stripLabel(x0,z0+28,'RURAL','casa sede com varanda · poste de madeira só no cruzamento');}
  pin(-80,14,-56,'local','Centro','Prédio residencial e comercial de 4 a 12 andares. Poste metálico duplo, LED branco.');
  pin(0,10,-56,'local','Subúrbio','Casa térrea e sobrado, muro de 1,8 m. Poste de concreto com sódio laranja.');
  pin(80,10,-56,'local','Bairro popular','Casas geminadas de laje, fios emaranhados, metade das luzes queimadas.');
  pin(-80,8,0,'local','Rua histórica','Casas coloniais coladas, rua de pedra, luminária de ferro fundido.');
  pin(0,16,0,'local','Industrial e porto','Galpões e torres de refletor de 12 m.');
  pin(80,8,0,'local','Vila ferroviária','Casas da companhia em fila, todas iguais.');
  pin(-80,10,56,'local','Serra','Rua das Pousadas: chalés de madeira e pedra com telhado íngreme e luminária de ferro fundido. Na Encosta, sem iluminação.');
  pin(0,7,56,'local','Palafitas','Vila dos Pescadores: sem iluminação pública, só lampião.');
  pin(80,7,56,'local','Rural','Casa sede com varanda. Luz só em cruzamentos e sedes.');
  flush();
  return {r:250,th:.0,ph:.78,t:[-48,0,14]};
}
function buildMina(){
  env('inside',70);root.add(new T.HemisphereLight(0x8a7a64,0x1a1410,.7));plane(0,0,-60,300,108,0x2a2620);
  const ROCK=0x3a3530,ROCK2=0x2e2a26,WOOD=0x6a4a2a;
  // encosta com a boca da mina
  bx(0,0,-30,120,34,24,ROCK2);for(let i=0;i<14;i++)pine(-55+i*8+R()*3,-14+R()*2,1.6+R(),34*0);
  // castelete sobre o poço
  const hf=grp(26,0,-12,0);for(const a of[-1,1])for(const b of[-1,1]){const l=bx(a*2.2,0,b*2.2,.3,16,.3,0x5a3a2a,hf);l.rotation.z=-a*.06;l.rotation.x=b*.06;}cyl(0,16,0,1.6,1.6,.4,0x4a4a4a,hf,16).rotation.x=Math.PI/2;
  bx(10,0,-8,10,5,8,0x6a5a4a);prism(10,5,-8,10.4,2,8.4,0x4a3a2a);sign('MINA SÃO JORGE',10,3.4,-3.9,6,1,0,{bg:'#2a1f18',fg:'#e0c890'});
  // boca da galeria
  const pt=grp(-16,0,-17.9,0);bx(-1.8,0,0,.5,3.4,.5,WOOD,pt);bx(1.8,0,0,.5,3.4,.5,WOOD,pt);bx(0,3.4,0,4.4,.5,.5,WOOD,pt);bx(0,0,-.3,3.2,3.4,.1,E(0x050505),pt);
  // corte: três níveis abaixo do chão
  const lv=[{y:-8,n:'Nível 1'},{y:-16,n:'Nível 2'},{y:-24,n:'Nível 3'}];
  bx(0,-30,-20,120,30,30,ROCK2);bx(-55,-30,-2,.6,30,6,ROCK);
  for(const L of lv){const y=L.y;bx(-6,y-.4,-2,96,.4,6,ROCK);bx(-6,y+3,-4,96,1.2,2,ROCK2);bx(-6,y,-5,96,3,.4,ROCK);
    for(let x=-52;x<40;x+=3){bx(x,y,-4.4,.25,3,.25,WOOD);bx(x,y,.4,.25,3,.25,WOOD);bx(x,y+2.8,-2,.3,.25,5,WOOD);}
    rails(-50,38,y-.4+.4);for(let x=-46;x<36;x+=12){bx(x,y+2.6,-2,.15,.15,.15,R()<.6?E(0xffd08a):0x3a3a3a);}pl(-30,y+2.2,-1,0xffc070,1.5,24);pl(0,y+2.2,-1,0xffc070,1.3,22);}
  // poço e elevador
  bx(26,-28,-4.8,5,40,.3,0x3a3a3a);for(const L of lv)bx(26,L.y-.4,-2,4,.2,4,0x4a4a4a);const cage=grp(26,-15.6,-2,0);bx(0,0,0,2.4,2.6,2.4,M(0x6a6c6e,{metalness:.5}),cage);line([[26,-13,-2],[26,16,-12]],0x9a9a9a);
  // vagonetes
  for(const[x,y]of[[-30,-8],[-8,-16],[6,-16],[-40,-24]]){const g=grp(x,y,-2,0);bx(0,.3,0,1.6,1.0,1.1,M(0x5a4a3a,{metalness:.4}),g);for(let i=0;i<5;i++)item(x+(R()-.5)*1.2,y+1.3,-2+(R()-.5)*.8,.3,.25,.3,0x6a6050);}
  // paiol de dinamite
  for(let i=0;i<6;i++)bx(-48+i*1.1,-24,-2,.8,.8,.8,0x8a2a1a);sign('PERIGO EXPLOSIVOS',-46,-21.6,-4.7,4,.7,0,{bg:'#c4483b',fg:'#fff'});
  // desabamento no nível 2 e zumbis
  for(let i=0;i<40;i++)bx(-24+(R()-.5)*6,-16+R()*2.6,-2+(R()-.5)*4,.4+R()*.9,.4+R()*.7,.4+R()*.9,pick([ROCK,ROCK2,0x4a4038]),null,R()*3);
  horde(10,-40,-28,-3.6,-.6,1.57,{y:-16});for(let i=0;i<6;i++)zombie(0+R()*20,-2+(R()-.5)*2,R()*6,'w',null,{y:-8});
  // nível 3 alagado
  plane(-10,-23.3,-2,70,5.6,M(0x1e2e36,{roughness:.15,metalness:.4}));for(let i=0;i<5;i++)zombie(-20+R()*30,-2+(R()-.5)*2,R()*6,'w',null,{y:-24.6});
  human(-22,-2,1.57,null,{y:-8,cloth:0x5a4a2a,hat:0xd8b02a});pl(-21,-6.6,-1.6,0xfff0c0,.8,8);
  pin(-16,4,-17,'local','Boca da galeria','Entrada a pé. Lá dentro: escuridão total, lanterna obrigatória.');
  pin(26,18,-12,'loot','Castelete e elevador','Elevador do poço só funciona com gerador ligado na casa de máquinas.');
  pin(-46,-20,-2,'loot','Paiol de dinamite','Dinamite e espoleta. Um tiro perdido aqui derruba o nível inteiro.');
  pin(-24,-12,-2,'quebra','Escoras','Escora quebrada derruba o teto: tranca a horda (ou você) do outro lado.');
  pin(-34,-12.5,-2,'perigo','Mineiros no nível 2','Turno da noite que não saiu. Zumbis com capacete e lanterna acesa.');
  pin(-10,-20,-2,'perigo','Nível 3 alagado','Água no peito e zumbis afogados agarrando no escuro.');
  pin(-22,-5,-2,'cena','Seu Tião','Último mineiro vivo. Troca mapa das galerias por remédio.');
  flush();
  return {r:120,th:.12,ph:1.35,t:[-30,-10,0]};
}
function truss(x,z,len,ry,c){const g=grp(x,0,z,ry);bx(0,0,0,5,.6,len,0x3a2a1c,g);for(let u=-len/2;u<=len/2;u+=4)for(const s of[-1,1]){bx(s*2.5,.6,u,.3,5,.3,c,g);if(u<len/2){const d=bx(s*2.5,2.5,u+2,.2,.2,5.6,c,g);d.rotation.x=.75;}}for(const s of[-1,1])bx(s*2.5,5.6,0,.3,.3,len,c,g);return g;}
function buildRamal(){
  env('grey',110);plane(0,0,-130,500,246,0x2a3324);plane(0,0,150,500,246,0x2a3324);
  // vale do rio e serra ao fundo
  plane(0,-6,10,400,30,M(0x22343e,{roughness:.25,metalness:.3}));for(const s of[-1,1])bx(0,-6,10+s*17,400,6,4,0x4a4436);
  bx(0,0,-90,400,40,90,0x3a4a30);bx(-60,0,-70,120,22,40,0x34422c);bx(80,0,-60,100,14,30,0x3e4c32);
  for(let i=0;i<60;i++)pine(-180+R()*360,-44+R()*14,1.6+R()*1.2,R()<.5?0:0);
  // trilho do ramal: sai do túnel, cruza o rio na ponte e segue para a base
  for(let z=-44;z<44;z+=3)item(0,0,z,2.4,.12,.25,0x3a2a1c);for(const s of[-1,1])bx(s*.72,.05,0,.08,.12,88,M(0x6a6c6e,{metalness:.6}));
  truss(0,10,34,0,0x5a3a2a).position.y=-.55;for(const z of[0,20])bx(0,-6,z,2,6,2,0x6a665e);
  // túnel do espinhaço
  const tp=grp(0,0,-45,0);bx(0,0,0,12,9,3,0x7a766c,tp);bx(0,0,1.55,5.6,6.4,.1,E(0x040506),tp);bx(0,9,0,14,1.2,3.6,0x6a665e,tp);sign(['TÚNEL DO ESPINHAÇO','2.300 m'],0,7.4,-43.4,6,1.6,0,{bg:'#2a2a28',fg:'#e8dfcf'});
  // trem parado saindo do túnel
  const WC=[0x5a5a3a,0x4a4a3a,0x6a3a2a];for(let i=0;i<3;i++){const w=wagon(0,-40+i*14.5-14.5*0,pick(WC),Math.PI/2);}
  // guarita e cargas de demolição
  bx(9,0,-2,3,2.8,3,0x4f5638);prism(9,2.8,-2,3.4,1,3.4,0x3a3a2a);sandbags(6,-2,6,'z',3);
  for(const z of[2,10,18])bx(2.7,-1.4,z,.5,.5,.5,0x8a7a3a),line([[2.9,-1,z],[9,1,-2]],0x9a2a1a);
  sign('ÁREA MILITAR · 7º BIS',-6,2.2,-6,5,1,Math.PI/2,{bg:'#4f5638',fg:'#e8dfcf'});
  horde(18,-2,2,-36,-6,0);horde(8,-6,6,30,44,Math.PI);
  zombie(9,0,0,'b',null,{vest:0x4f5638,hat:0x4f5638});
  for(let i=0;i<4;i++)poleWood(-10,-30+i*20,false);
  pin(0,12,-45,'local','Túnel do Espinhaço','2,3 km de túnel escuro sob a crista. O trem de carga parou com a cauda para fora; o eco atrai a horda.');
  pin(0,9,-30,'loot','Vagões militares','Carga da evacuação: rações, munição e um vagão trancado (classe D).');
  pin(0,7,10,'quebra','Ponte do Quartel','Cargas de demolição já armadas. Explodir corta a horda que desce da serra pelo ramal; a Estrada do Quartel continua aberta.');
  pin(9,5,-2,'perigo','Guarita do Exército','Sargento zumbi com colete. O detonador está na guarita.');
  pin(0,3,38,'cena','Rumo à base','Os trilhos seguem 240 m até o portão da Base 7º BIS.');
  flush();
  return {r:115,th:.85,ph:1.0,t:[-22,0,-4]};
}
function buildLagoa(){
  env('grey',90);ground(0x34402a,400);
  plane(10,.05,-24,90,52,M(0x1a2a2e,{roughness:.12,metalness:.45}));
  // brejo: taboa, árvores mortas e lama
  for(let i=0;i<900;i++){const x=-70+R()*140,z=-10+R()*60;if(z<4&&x>-30&&R()<.8)continue;item(x,0,z,.3,.8+R()*1.1,.3,pick([0x5a6a3a,0x4a5a2a,0x6a6a3a,0x6a5a3a]),0,(R()-.5)*.3,(R()-.5)*.3);}
  for(let i=0;i<26;i++){const x=-70+R()*140,z=-6+R()*50;cyl(x,0,z,.12,.22,3+R()*4,0x3a3428,null,5);if(R()<.6){const b=bx(x,2.4+R()*2,z,.1,.1,1.6,0x3a3428);b.rotation.x=R()*1.4;b.rotation.y=R()*3;}}
  for(let i=0;i<14;i++)plane(-60+R()*120,.03,10+R()*30,3+R()*5,2+R()*4,M(0x2a2a1e,{roughness:.3,metalness:.2}));
  // passarela podre
  let px=-50,pz=36;for(let k=0;k<22;k++){const g=grp(px,0,pz,.4*Math.sin(k*.5));if(k!==9&&k!==10)bx(0,.6,0,1.4,.12,2,pick([0x5a4630,0x4a3a28]),g);cyl(-.6,0,0,.07,.07,.8,0x3a2a1c,g,4);cyl(.6,0,0,.07,.07,.8,0x3a2a1c,g,4);px+=1.8+.4*Math.cos(k*.5);pz-=1.4;}
  // casa do pescador na palafita e barco
  stilt(-26,-8,0x5a4a3a);bx(-23,3.6,-4.5,.2,.28,.2,E(0xffc070));pl(-23,3.4,-4,0xffb060,.9,12);
  const bt=grp(4,.1,-14,.6);bx(0,0,0,1.4,.5,4.2,0x5a3a2a,bt);bx(0,.5,0,1.2,.08,.3,0x4a3a28,bt);
  // zumbis afogados e na margem
  for(let i=0;i<9;i++)zombie(-10+R()*40,-30+R()*20,R()*6,'w',null,{y:-1.1});
  horde(10,-60,-30,20,44,0);
  human(-25,-4,2.6,null,{y:1.6,cloth:0x3a4a5a});
  for(let i=0;i<8;i++)tree(30+R()*30,-60+R()*14,1.2+R()*.5);
  pin(10,2,-24,'local','Lagoa Escura','Funda e escura. Pesca e água em quantidade.');
  pin(-10,2,30,'perigo','Brejo do Sapo','Tudo anda a 60%, inclusive zumbis. Visão de 30 m e barulho de lama.');
  pin(-34,2,22,'quebra','Passarela podre','Duas tábuas faltando. Quem cai afunda até a cintura.');
  pin(-26,6,-8,'cena','Casa do pescador','Seu Valdo vive aqui com um barco e uma rede. Troca peixe por munição.');
  pin(14,1,-24,'perigo','Afogados','Zumbis no fundo da lagoa agarram quem nada ou cai do barco.');
  pin(4,2,-14,'loot','Barco a remo','Leva 2 pessoas. Atravessar a lagoa evita o brejo inteiro.');
  flush();
  return {r:105,th:.45,ph:1.0,t:[-36,0,6]};
}

// ---------- mapa vivo: bichos e cena com hordas, clima e eventos andando
function vaca3(x,z,ry,o){o=o||{};const g=grp(x,0,z,ry);const c=o.c||pick([0x2a2622,0x8a5a3a,0xd8d0c0]),sp=0xe8e0d0;
  const body=new T.Mesh(new T.SphereGeometry(1,12,9),M(c));body.scale.set(.55,.55,1.05);body.position.set(0,1.05,0);body.castShadow=true;g.add(body);
  if(c!==0xd8d0c0)for(let i=0;i<3;i++){const s=new T.Mesh(new T.SphereGeometry(1,8,6),M(sp));const sd=R()<.5?-1:1;s.scale.set(.1,.24,.3);s.position.set(sd*.47,1.08+R()*.12,(R()-.5)*1.1);g.add(s);}
  const hd=grp(0,1.25,1.05,0,g);hd.rotation.x=o.graze?.9:.2;const h=new T.Mesh(new T.SphereGeometry(1,10,8),M(c));h.scale.set(.24,.26,.42);h.position.set(0,0,.25);hd.add(h);
  bx(0,-.2,.58,.3,.2,.22,0xc8a090,hd);for(const a of[-1,1]){const hn=cone(a*.2,.18,.15,.04,.28,0xe0d8c0,hd,5);hn.rotation.z=-a*1.1;bx(a*.27,.02,.1,.18,.06,.1,c,hd);}
  for(const a of[-1,1])for(const b of[-1,1]){const l=grp(a*.3,.95,b*.7,0,g);cyl(0,-.95,0,.09,.14,.95,c,l,7);bx(0,-.95,0,.16,.1,.18,0x1a1612,l);if(o.dead)l.rotation.x=b*.5;}
  const tl=grp(0,1.4,-1.05,0,g);cyl(0,-.8,0,.025,.03,.8,c,tl,4);tl.rotation.x=.25;
  if(o.dead){g.rotation.z=Math.PI/2;g.position.y=.55;}
  else ANIM.push(t=>{tl.rotation.z=Math.sin(t*2+x)*.35;hd.rotation.x=(o.graze?.9:.2)+Math.sin(t*.4+z)*.08;});
  return g;}
function cao3(x,z,ry,o){o=o||{};const c=o.c||pick([0x5a4a3a,0x2a2622,0x8a6a42]);const g=grp(x,0,z,ry);const inf=!!o.inf;
  const body=new T.Mesh(new T.SphereGeometry(1,10,8),M(c));body.scale.set(.2,.22,.5);body.position.set(0,.55,0);body.castShadow=true;g.add(body);
  const ch=new T.Mesh(new T.SphereGeometry(1,10,8),M(c));ch.scale.set(.22,.25,.25);ch.position.set(0,.6,.3);g.add(ch);
  const hd=grp(0,.78,.5,0,g);const h=new T.Mesh(new T.SphereGeometry(1,10,8),M(c));h.scale.set(.13,.13,.17);hd.add(h);bx(0,-.08,.18,.1,.09,.18,c,hd);
  for(const a of[-1,1]){cone(a*.08,.12,-.02,.04,.12,c,hd,4);bx(a*.055,.03,.14,.03,.02,.01,E(inf?EYE.r:0x111111),hd);}
  if(inf)bx(0,-.12,.25,.08,.03,.06,0x4a0806,hd);
  const L=[];for(const a of[-1,1])for(const b of[-1,1]){const l=grp(a*.11,.5,b*.32,0,g);cyl(0,-.25,0,.035,.045,.25,c,l,6);const k=grp(0,-.25,0,0,l);cyl(0,-.24,0,.03,.035,.24,c,k,6);L.push([l,k,a*b]);}
  const tl=grp(0,.62,-.48,0,g);cyl(0,-.3,0,.02,.03,.3,c,tl,4);tl.rotation.x=inf?-.2:-.9;
  const mv=!!o.walk,v=o.v||(inf?7:2.4),len=o.wlen||40,x0=x,z0=z,fx=Math.sin(ry||0),fz=Math.cos(ry||0),ph=R()*6.28,d0=R()*len;
  ANIM.push(t=>{const q=t*(mv?v*2.6:1.2)+ph;for(const[l,k,s]of L){l.rotation.x=(mv?Math.sin(q+(s>0?0:Math.PI))*.6:0);k.rotation.x=mv?Math.max(0,Math.sin(q+(s>0?1.2:4.3)))*.7:0;}
    tl.rotation.z=Math.sin(t*(inf?3:8)+ph)*.4;body.position.y=.55+(mv?Math.abs(Math.sin(q))*.04:0);hd.rotation.x=mv?Math.sin(q*2)*.05:Math.sin(t*.7+ph)*.15;
    if(mv){const dd=(t*v+d0)%len;g.position.x=x0+fx*dd;g.position.z=z0+fz*dd;}});
  return g;}
function ave3(c,s){const g=new T.Group();const b=new T.Mesh(new T.SphereGeometry(1,8,6),M(c));b.scale.set(.18*s,.14*s,.42*s);g.add(b);
  const W=[];for(const a of[-1,1]){const w=grp(a*.12*s,.04*s,0,0,g);bx(a*.55*s,0,0,1.1*s,.03*s,.36*s,c,w);W.push([w,a]);}
  const hd=new T.Mesh(new T.SphereGeometry(1,8,6),M(s>2?0x6a3a34:c));hd.scale.setScalar(.1*s);hd.position.set(0,.06*s,.42*s);g.add(hd);g.userData.W=W;root.add(g);return g;}
function bater3(g,t,sp,amp){for(const[w,a]of g.userData.W)w.rotation.z=a*Math.sin(t*sp)*amp;}
function urubus3(x,z,n,h,r){const B=[];for(let i=0;i<n;i++)B.push([ave3(0x16140f,.7),R()*6.28,h+R()*5,r*(.7+R()*.5),(R()<.5?1:-1)*(.25+R()*.15)]);
  ANIM.push(t=>{for(const[b,p,y,rr,w]of B){const a=p+t*w;b.position.set(x+Math.cos(a)*rr,y+Math.sin(t*.5+p)*.6,z+Math.sin(a)*rr);b.rotation.y=-a+(w>0?Math.PI:0);b.rotation.z=(w>0?-.35:.35);bater3(b,t+p,1.6,.12);}});}
function revoada3(x,z,n,y0,cycle,dir){const B=[];for(let i=0;i<n;i++)B.push([ave3(0x1a1c1e,.55),(R()-.5)*16,(R()-.5)*10,R()*.8,.8+R()*.6]);
  ANIM.push(t=>{const k=(t%cycle)/cycle;for(const[b,ox,oz,dl,sp]of B){const u=clamp((k*cycle-dl)/4,0,1);b.visible=u>0&&u<1;b.position.set(x+ox+dir[0]*u*45*sp,y0+u*u*30*sp+Math.sin(t*9+ox)*.2,z+oz+dir[1]*u*45*sp);b.rotation.y=Math.atan2(dir[0],dir[1]);bater3(b,t*1.3+ox,18,.7);}});}
function queroquero3(x,z){const g=grp(x,0,z,R()*6);const b=new T.Mesh(new T.SphereGeometry(1,8,6),M(0x8a8a82));b.scale.set(.09,.09,.17);b.position.y=.28;g.add(b);
  const c=new T.Mesh(new T.SphereGeometry(1,8,6),M(0x111111));c.scale.set(.09,.06,.08);c.position.set(0,.33,.06);g.add(c);bx(0,.38,.12,.06,.06,.06,0xd8d8d0,g);
  for(const a of[-1,1])cyl(a*.03,0,0,.008,.008,.22,0xb84a4a,g,4);cone(0,.36,.21,.012,.06,0xb84a4a,g,4).rotation.x=Math.PI/2;
  ANIM.push(t=>{const k=(t*1.3+x)%4;g.position.y=k<.3?Math.sin(k/.3*Math.PI)*.25:0;g.rotation.y+=k<.3?.04:0;});return g;}
function chuva3(x0,x1,z0,z1,n,move){const g=new T.BufferGeometry(),a=new Float32Array(n*6),W=x1-x0;
  for(let i=0;i<n;i++){const x=x0+R()*W,y=R()*30,z=z0+R()*(z1-z0);a.set([x,y,z,x-.15,y-1.1,z],i*6);}
  g.setAttribute('position',new T.BufferAttribute(a,3));const ls=new T.LineSegments(g,new T.LineBasicMaterial({color:0x9ab0c8,transparent:true,opacity:.22,depthWrite:false}));ls.userData.own=true;root.add(ls);
  const P=g.attributes.position;ANIM.push((t,dt)=>{const arr=P.array;for(let i=0;i<n;i++){let y=arr[i*6+1]-.9;if(y<0)y+=30;arr[i*6+1]=y;arr[i*6+4]=y-1.1;}P.needsUpdate=true;if(move)ls.position.x=((t*move)%(W*2))-W*.5;});}
function alambrado3(x0,z0,x1,z1,h,c){const L=Math.hypot(x1-x0,z1-z0),n=Math.ceil(L/3),ry=Math.atan2(x1-x0,z1-z0);
  for(let i=0;i<=n;i++){const t=i/n;cyl(lerp(x0,x1,t),0,lerp(z0,z1,t),.04,.04,h,M(0x7a7c7e,{metalness:.6,roughness:.5}),null,6);}
  line([[x0,h,z0],[x1,h,z1]],0x8a8c8e);
  const cv=document.createElement('canvas');cv.width=cv.height=32;const cx=cv.getContext('2d');cx.strokeStyle='#9a9c9e';cx.lineWidth=2;cx.beginPath();cx.moveTo(0,16);cx.lineTo(16,0);cx.lineTo(32,16);cx.lineTo(16,32);cx.closePath();cx.stroke();
  const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(L/.25,h/.25);
  const m=new T.Mesh(new T.PlaneGeometry(L,h),new T.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.3,side:T.DoubleSide,metalness:.5,roughness:.6}));m.userData.own=true;
  m.position.set((x0+x1)/2,h/2,(z0+z1)/2);m.rotation.y=ry+Math.PI/2;root.add(m);return m;}
function heli3(x,y,z,ry){const g=grp(x,y,z,ry);const c=0x3f4a36;
  const f=new T.Mesh(new T.SphereGeometry(1,12,9),M(c,{roughness:.6,metalness:.3}));f.scale.set(1.3,1.2,2.4);f.position.set(0,1.1,0);f.rotation.z=.5;f.castShadow=true;g.add(f);
  bx(0,1.4,1.6,1.6,.9,.6,M(0x22323c,{metalness:.6,roughness:.2}),g);const tb=cyl(0,1.2,-3.6,.18,.35,3.6,c,g,8);tb.rotation.x=Math.PI/2+.3;tb.rotation.z=.4;
  for(let i=0;i<4;i++){const b=bx((R()-.5)*8,.05,(R()-.5)*8,.25,.05,4.5,0x2a2a2a,g);b.rotation.y=R()*3;b.rotation.z=(R()-.5)*.3;}
  sign('EXÉRCITO',1.2,1.5,0,1.6,.4,Math.PI/2,{fg:'#d8d4c4',bg:'#3f4a36'},g);return g;}
function buildVivo(){
  env('dusk',90);ground(0x34331f);
  // rodovia velha com mato crescendo no asfalto (mudança com o tempo)
  plane(0,.02,10,240,8,0x2a2a2c);for(let u=-115;u<120;u+=6)plane(u,.03,10,2.5,.15,0x8a8a70);
  for(let i=0;i<140;i++){const x=lerp(-110,110,R()),z=R()<.5?lerp(6.1,7.4,R()):lerp(12.6,13.9,R());item(x,0,z,.08,.15+R()*.2,.4+R()*.5,pick([0x4a5a2c,0x3a4a24,0x5a5a30]),R()*3);item(x,0,z,.4+R()*.4,.08+R()*.1,.08,pick([0x4a5a2c,0x5a5a30]),R()*3);}
  car(36,12.5,1.62,0x5a3a26,{});car(-58,17,-1.4,0x3a4a3a,{});
  // horda migratória andando para leste pela rodovia
  for(let i=0;i<46;i++){const r=R();zombie(lerp(-110,-60,R()),lerp(8,12,R()),Math.PI/2+(R()-.5)*.03,r<.7?'w':r<.93?'r':'b',null,{walk:true,wlen:90,v:r<.7?1.4:r<.93?1.6:1.1});}
  // revoada sai das árvores 150 m à frente (aqui encurtado para caber)
  for(let i=0;i<14;i++)tree(lerp(-30,30,R()),lerp(-12,-2,R()),.9+R()*.5);revoada3(0,-6,22,4,9,[.6,-.8]);
  // pasto com alambrado, carcaça de vaca e urubus
  alambrado3(18,24,70,24,2,0);alambrado3(70,24,70,62,2,0);alambrado3(18,62,70,62,2,0);alambrado3(18,24,18,40,2,0);
  alambrado3(18,41,21.1,44.9,1.9);
  vaca3(44,44,1.2,{dead:true,c:0x8a5a3a});blood(44,44,2.2);blood(45,43,1.4);urubus3(44,44,6,13,7);
  zombie(20,46,1.5,'w',null,{walk:true,wlen:20});zombie(30,58,2.4,'w',null,{walk:true,wlen:14});zombie(60,30,-.8,'r',null,{walk:true,wlen:16,v:1.5});
  vaca3(56,54,-.4,{graze:true});vaca3(60,50,2.2,{});vaca3(28,30,.6,{graze:true,c:0xd8d0c0});
  // quero-queros no campo aberto
  for(const p of[[-20,36],[-22,38],[-18,39]])queroquero3(p[0],p[1]);
  // matilha de cães infectados na estrada de terra
  plane(-40,.02,-28,8,90,0x4a4030);for(let i=0;i<4;i++)cao3(-42+R()*3,-66+R()*4,0,{inf:i<2,walk:true,wlen:55,v:3.2});cao3(-24,40,2,{});
  // caravana de sobreviventes na estrada de terra (anda para o norte)
  {const cv=[car(-37,-60,Math.PI,0x6a6458,{}),car(-37,-50,Math.PI,0x2c2f35,{})];const z0=[-60,-50];
    const L1=new T.PointLight(0xfff2c0,1.2,24,2);root.add(L1);
    ANIM.push(t=>{cv.forEach((c,i)=>{c.position.z=-8-((t*4+i*10)%62);});L1.position.set(-37,1.2,cv[0].position.z-4);});}
  // bloqueio de sobreviventes com torre e holofote
  sandbags(-70,30,10,'x',3);sandbags(-75,25,10,'z',3);watchtower(-78,34,true);human(-71,31,Math.PI*.8,null,{cloth:0x3f4a36,aim:true});human(-68,31,Math.PI,null,{cloth:0x4a4038});
  fire(-74,0,26,.8);
  // helicóptero caído no morro, com fogo e coluna de fumaça visível de longe
  {const hy=0;for(let i=0;i<9;i++)cone(-90+i*16,0,-92-R()*10,24+R()*8,5+R()*4,0x262a1e,null,14);heli3(-56,0,-74,.6);fire(-56,1,-74,1.2);smoke(-56,3,-74,8,.55);}
  // frente de chuva chegando do oeste, com relâmpago
  chuva3(-50,0,-40,60,500,2.2);lightning();
  pin(-85,3,10,'perigo','Horda migratória','1.000+ zumbis cruzam o vale todo domingo de jogo pela rodovia. Lentos na frente, Corredores se espalham.');
  pin(0,10,-6,'cena','Revoada','Passarinhos levantam das árvores 150 m à frente da horda. É o aviso para sair da estrada.');
  pin(44,3,44,'perigo','Carcaça de vaca','Herbívoro mordido morre e não levanta. A carcaça chama zumbis num raio de 200 m por 1 dia.');
  pin(44,16,44,'cena','Urubus circulando','Visíveis a 1,5 km. Marcam onde há mortos e levantam voo quando alguém chega.');
  pin(18,2.4,40,'quebra','Alambrado do pasto','Tela de arame de 2 m com postes a cada 3 m. Corredor sobe em 2 s, Lento empurra até dobrar. Portão de correr.');
  pin(-20,1.4,37,'perigo','Quero-queros','Gritam com qualquer coisa a 25 m e acordam zumbis a 40 m.');
  pin(-41,1.4,-40,'perigo','Matilha','Cães viram zumbis e correm a 7 m/s. Latido atrai a 60 m.');
  pin(-37,2,-20,'cena','Caravana','Sobreviventes entre bases. Pode ser emboscada ou resgatada.');
  pin(-78,10,34,'local','Bloqueio de sobreviventes','Torre com holofote, sacos de areia e fogueira. Atiram em quem passa do arame.');
  pin(-56,6,-74,'loot','Helicóptero caído','Evento: cai a cada 2 dias longe dos jogadores. Fumaça visível a 3 km, loot militar.');
  pin(-30,14,10,'cena','Frente de chuva','O tempo muda a cada 2 a 6 h e chega de oeste. Na chuva a visão cai para 120 m e os passos fazem menos barulho.');
  pin(36,2,12.5,'cena','Mato no asfalto','Depois de semanas, mato cobre a rodovia; depois de 2 meses só resta uma trilha.');
  flush();
  return {r:140,th:.3,ph:.9,t:[-4,0,2]};
}

// =====================================================================
// MANSÃO VALVERDE (fachada e corte) — helpers com prefixo mv + chainlinkM()
// =====================================================================
const MVT={},MVM={};
function mvTex(key,w,h,draw){if(MVT[key])return MVT[key];const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');draw(g,w,h);const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return MVT[key]=t;}
function mvMat(key,make){return MVM[key]||(MVM[key]=make());}
// painel vertical centrado (x,y,z), virado para +z girado por ry, com UV em metros (u = metros por repetição)
function mvPanel(x,y,z,w,h,ry,mat,u,p){const g=new T.PlaneGeometry(w,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/(u||1),uv.getY(i)*h/(u||1));const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.rotation.y=ry||0;m.receiveShadow=true;(p||root).add(m);return m;}
function mvFloor(x,y,z,w,d,mat,u,p){const g=new T.PlaneGeometry(w,d);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/(u||1),uv.getY(i)*d/(u||1));g.rotateX(-Math.PI/2);const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.receiveShadow=true;(p||root).add(m);return m;}
// haste instanciada de p0 a p1 (galhos, barras, arames, vigas)
const _mvq=new T.Quaternion(),_mve=new T.Euler(),_mvd=new V3(),_mvY=new V3(0,1,0);
function mvStick(x0,y0,z0,x1,y1,z1,t,c){_mvd.set(x1-x0,y1-y0,z1-z0);const L=_mvd.length();if(L<1e-4)return;_mvd.multiplyScalar(1/L);_mvq.setFromUnitVectors(_mvY,_mvd);_mve.setFromQuaternion(_mvq,'XYZ');item((x0+x1)/2,(y0+y1)/2-L/2,(z0+z1)/2,t,L,t,c,_mve.y,_mve.x,_mve.z);}
// árvore morta: galhos recursivos instanciados
function mvDeadTree(x,y,z,s,c){c=c||pick([0x2e2822,0x342c25,0x29241f]);const br=(x0,y0,z0,len,th,az,el,d)=>{const ce=Math.cos(el);const x1=x0+Math.cos(az)*ce*len,y1=y0+Math.sin(el)*len,z1=z0+Math.sin(az)*ce*len;mvStick(x0,y0,z0,x1,y1,z1,th,c);if(d<=0)return;const n=d>2?3:2;for(let i=0;i<n;i++)br(x1,y1,z1,len*(.55+R()*.2),th*.62,az+(R()-.5)*2.4,Math.max(-.2,el-.25+(R()-.5)*.9),d-1);};
  const h=(3+R()*2)*s;mvStick(x,y-.2,z,x+(R()-.5)*.6*s,y+h,z+(R()-.5)*.6*s,.34*s,c);for(let i=0;i<4;i++)br(x,y+h*(.45+i*.15),z,1.6*s*(1-i*.15),.18*s,R()*6.28,.35+R()*.6,2+(i<2?1:0));}
// corvo com anatomia (corpo, cabeça, bico, cauda, asas); fly=true bate as asas
function mvCrow(x,y,z,ry,fly,p){const k=M(0x0b0b0d,{roughness:.55});const g=grp(x,y,z,ry,p);bx(0,0,0,.13,.13,.28,k,g);bx(0,.05,.17,.1,.1,.11,k,g);bx(0,.07,.25,.028,.03,.08,0x2a2622,g);bx(0,.02,-.2,.1,.025,.16,k,g);
  if(fly){for(const sd of[-1,1]){const w=grp(sd*.06,.08,0,0,g);bx(sd*.2,0,0,.4,.018,.18,k,w);bx(sd*.46,0,-.04,.18,.012,.12,k,w);ANIM.push(t=>{w.rotation.z=sd*Math.sin(t*9+x)*.7;});}}
  else{for(const sd of[-1,1])bx(sd*.04,-.1,.02,.015,.1,.015,0x2a2622,g);}return g;}
function mvCrowI(x,y,z,ry){const s=Math.sin(ry),c=Math.cos(ry),f=(dz,dy,sx,sy,sz,col)=>item(x+s*dz,y+dy,z+c*dz,sx,sy,sz,col,ry);f(0,0,.13,.13,.28,0x0b0b0d);f(.17,.05,.1,.1,.11,0x0b0b0d);f(.25,.08,.028,.03,.08,0x2a2622);f(-.2,.03,.1,.025,.16,0x0b0b0d);}
function mvFlock(x,y,z,n,rad){const g=grp(x,y,z,0);for(let i=0;i<n;i++){const a=i/n*6.28+R(),r=rad*(.6+R()*.5);const c=mvCrow(Math.cos(a)*r,(R()-.5)*3,Math.sin(a)*r,-a,true,g);c.rotation.z=.3;}ANIM.push(t=>{g.rotation.y=t*.25;});return g;}
// olhos no escuro (piscam)
function mvEyes(x,y,z,ry,c,s){const g=grp(x,y,z,ry);if(s)g.scale.setScalar(s);for(const sd of[-1,1]){const e=bx(sd*.09,0,0,.08,.05,.03,E(c||0xff2a1a),g);e.castShadow=false;}const ph=R()*20;ANIM.push(t=>{g.visible=((t+ph)%6)>.25;});return g;}
// cão infectado (dobermann) com anatomia: peito, cintura, quadril, pescoço, crânio, focinho, mandíbula aberta, orelhas, costelas expostas, patas articuladas
function mvCao(x,z,ry,o){o=o||{};const g=grp(x,o.y||0,z,ry);const C=o.c||0x1c1816,TAN=0x6a4024,RAW=0x6a3a36,BONE=0xcbbf9e;const s=o.s||1;g.scale.setScalar(s);
  const low=o.pose==='lunge'?-.08:0;
  bx(0,.44+low,.2,.3,.34,.44,C,g);bx(0,.5+low,-.17,.22,.24,.4,C,g);bx(0,.46+low,-.44,.28,.3,.26,C,g);
  for(let i=0;i<4;i++)bx(.152,.5+low,.06-i*.09,.02,.22,.03,BONE,g);bx(.14,.5+low,-.06,.03,.16,.26,RAW,g);
  const nk=grp(0,.66+low,.38,0,g);nk.rotation.x=o.pose==='eat'?1.3:o.pose==='lunge'?.25:-.55;bx(0,0,0,.16,.32,.17,C,nk);
  const hd=grp(0,.3,.02,0,nk);hd.rotation.x=o.pose==='eat'?.2:.55-(o.pose==='lunge'?.3:0);bx(0,-.04,.06,.19,.17,.22,C,hd);bx(0,-.07,.24,.11,.09,.2,TAN,hd);bx(0,-.04,.35,.06,.04,.03,0x0a0a0a,hd);
  const jw=grp(0,-.1,.16,0,hd);jw.rotation.x=.5;bx(0,-.03,.08,.1,.035,.2,0x5a1a1a,jw);for(let i=0;i<3;i++)for(const sd of[-1,1])bx(sd*.035,0,.03+i*.06,.015,.03,.015,0xe8e0c8,jw);
  for(const sd of[-1,1]){const ea=bx(sd*.06,.04,-.01,.05,.13,.03,C,hd);ea.rotation.z=-sd*.25;const ey=bx(sd*.065,-.02,.15,.04,.025,.02,E(0xff2a1a),hd);ey.castShadow=false;}
  const ph=R()*6;ANIM.push(t=>{jw.rotation.x=.35+Math.abs(Math.sin(t*(o.pose==='lunge'?8:3)+ph))*.35;});
  for(const sd of[-1,1]){const fl=grp(sd*.11,.42+low,.3,0,g);fl.rotation.x=o.pose==='lunge'?-.5:0;bx(0,-.2,0,.08,.24,.11,C,fl);bx(0,-.42,.02,.055,.24,.06,TAN,fl);bx(0,-.44,.05,.07,.035,.11,TAN,fl);
    const rl=grp(sd*.12,.48+low,-.46,0,g);rl.rotation.x=o.pose==='lunge'?.45:.15;bx(0,-.24,-.02,.1,.28,.15,C,rl);const hk=grp(0,-.24,-.06,0,rl);hk.rotation.x=-.55;bx(0,-.22,0,.055,.24,.06,TAN,hk);bx(0,-.24,.05,.07,.035,.11,TAN,hk);}
  const tl=bx(0,.56+low,-.6,.05,.05,.14,C,g);tl.rotation.x=.4;
  if(o.chain)line([[x+Math.sin(ry)*.5,.72,z+Math.cos(ry)*.5],[o.chain[0],.3,o.chain[1]]],0x8a8c8e);
  return g;}
// alambrado com postes, tela semitransparente, travessa e arame farpado/concertina no topo
function chainlinkM(x0,z0,x1,z1,h,barbed,c){h=h||2.4;const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz);if(L<.1)return;const ux=dx/L,uz=dz/L,nx=-uz,nz=ux;c=c||0x80868c;
  const mat=mvMat('chainlink',()=>new T.MeshStandardMaterial({map:mvTex('chainlink',64,64,(g,w,hh)=>{g.clearRect(0,0,w,hh);g.strokeStyle='#cfd4d8';g.lineWidth=5;g.beginPath();g.moveTo(0,0);g.lineTo(w,hh);g.moveTo(w,0);g.lineTo(0,hh);g.stroke();}),color:0xa0a6ac,transparent:true,opacity:.9,alphaTest:.04,side:T.DoubleSide,depthWrite:false,metalness:.5,roughness:.55}));
  const n=Math.max(1,Math.ceil(L/3));for(let i=0;i<=n;i++){const t=i/n,px=x0+dx*t,pz=z0+dz*t;item(px,0,pz,.07,h+(barbed?.05:0),.07,c);if(barbed)mvStick(px,h,pz,px+nx*.42,h+.42,pz+nz*.42,.04,c);}
  mvStick(x0,h-.04,z0,x1,h-.04,z1,.045,c);mvStick(x0,.1,z0,x1,.1,z1,.025,c);
  mvPanel(x0+dx/2,h/2+.05,z0+dz/2,L,h-.1,-Math.atan2(dz,dx),mat,.42);
  if(barbed){for(let k=1;k<=3;k++){const o=k*.14;line([[x0+nx*o,h+o,z0+nz*o],[x1+nx*o,h+o,z1+nz*o]],0x5a5e62);for(let u=.3;u<L;u+=.6)item(x0+ux*u+nx*o,h+o-.03,z0+uz*u+nz*o,.1,.06,.02,0x6a6e72,Math.atan2(ux,uz)+.8);}
    const P=[],coil=Math.ceil(L/.18);for(let i=0;i<=coil;i++){const u=i/coil*L,a=i*1.9;P.push([x0+ux*u+nx*(.1+Math.cos(a)*.22),h+.32+Math.sin(a)*.22,z0+uz*u+nz*(.1+Math.cos(a)*.22)]);}line(P,0x8a8e92);}}
// janela de fachada: moldura de pedra, verga, peitoril, caixilho em cruz; state: lit|dark|board|broken|shape (vulto)
function mvWin(x,y,z,face,w,h,state,trim){trim=trim||0x3e3a34;const rot=face==='x'?Math.PI/2:face==='-x'?-Math.PI/2:face==='-z'?Math.PI:0;const ox=face==='x'?1:face==='-x'?-1:0,oz=face==='z'?1:face==='-z'?-1:0;const along=ox?'z':'x';
  const P=(u,dy,out,sw,sh,sd,c,rz)=>{if(along==='x')item(x+u,y+dy,z+oz*out,sw,sh,sd,c,0,0,rz||0);else item(x+ox*out,y+dy,z+u,sd,sh,sw,c,0,rz||0,0);};
  P(0,-h/2-.22,.06,w+.5,.16,.22,trim);P(0,h/2,.05,w+.44,.3,.16,trim);P(0,h/2+.28,.07,.26,.22,.16,0x57524a);P(-w/2-.12,-h/2,.04,.18,h,.12,trim);P(w/2+.12,-h/2,.04,.18,h,.12,trim);
  const gx=x+ox*.03,gz=z+oz*.03;
  if(state==='lit'||state==='shape'){WL.push([gx,y,gz,rot,w,h]);if(state==='shape'){P(.05,-h/2,.045,.36,h*.62,.02,0x060606);P(.05,-h/2+h*.62,.045,.2,.24,.02,0x060606);}else{P(-w/2+.12,-h/2,.045,.2,h,.03,0x4a1612);P(w/2-.12,-h/2,.045,.2,h,.03,0x4a1612);}}
  else WD.push([gx,y,gz,rot,w,h]);
  P(0,-h/2,.05,.06,h,.04,0x24221f);P(0,h*.12,.05,w,.06,.04,0x24221f);
  if(state==='board')for(let k=0;k<3;k++)P((R()-.5)*.1,-h/2+.25+k*h/3,.1,w+.35,.17,.05,pick([0x5a4028,0x4a3420,0x6b4a2a]),(R()-.5)*.35);
  if(state==='broken'){P(-w/4,-h/2,.06,w/2,h*.55,.02,0x020202);P(w/5,h*.05,.07,.04,h*.3,.02,0x9fb0b8,.6);}}
// SUV preta do Instituto Valverde
function mvSUV(x,z,ry){const g=grp(x,0,z,ry);const B=M(0x0c0d10,{roughness:.32,metalness:.65}),GL=M(0x0a0e12,{roughness:.1,metalness:.8});
  bx(0,.42,0,2.02,.92,4.9,B,g);bx(0,1.3,-.35,1.92,.82,3.3,GL,g);bx(0,1.3,-.35,1.98,.1,3.36,B,g);bx(0,2.1,-.35,1.92,.08,3.2,B,g);for(const sd of[-1,1])bx(sd*.75,2.18,-.35,.05,.08,2.8,0x2a2a2a,g);
  bx(0,.3,2.5,1.9,.32,.12,0x1a1a1a,g);bx(-.7,.86,2.46,.36,.14,.04,E(0xfff2c8),g);bx(.7,.86,2.46,.36,.14,.04,0x202020,g);bx(-.7,.86,-2.46,.3,.18,.04,E(0x8a1010),g);
  for(const a of[-1,1])for(const b of[-1,1]){const w=cyl(a*.95,0,b*1.55,.42,.42,.34,0x0a0a0a,g,10);w.rotation.z=Math.PI/2;w.position.y=.42;}
  const d=grp(1.01,.5,.7,0,g);d.rotation.y=1.0;bx(0,0,-.55,.08,1.55,1.1,B,d);
  sign(['INSTITUTO','VALVERDE'],1.025,.95,-.75,1.1,.5,Math.PI/2,{bg:'rgba(0,0,0,0)',fg:'#c8c2b0',font:'700 46px Arial',w:256,h:128},g);
  sign(['INSTITUTO','VALVERDE'],-1.025,.95,-.2,1.1,.5,-Math.PI/2,{bg:'rgba(0,0,0,0)',fg:'#c8c2b0',font:'700 46px Arial',w:256,h:128},g);
  return g;}
// lápide torta
function mvTomb(x,z,c){const t=R(),rx=(R()-.5)*.35,rz=(R()-.5)*.35,ry=(R()-.5)*.3;c=c||pick([0x6e6a62,0x5e5a54,0x7a766c,0x55524c]);
  if(t<.45)item(x,-.1,z,.7,1.0+R()*.4,.18,c,ry,rx,rz);else if(t<.75){item(x,-.1,z,.14,1.5,.14,c,ry,rx,rz);item(x+Math.cos(ry)*0,.75,z,.7,.14,.14,c,ry,rx,rz);}else{item(x,-.1,z,.9,.5,.5,c,ry,rx,rz);item(x,.4,z,.4,.9,.3,c,ry,rx*1.5,rz*1.5);}
  item(x,0,z+.9,.8,.08,1.6,0x2a2a22,ry);}

function buildMansao(){
  env('grey',90);
  if(HORA==='cena'){scene.background.setHex(0x3a403e);scene.fog.color.setHex(0x3a403e);scene.fog.density=.0062;lightning();}
  const night=HORA==='noite';
  // terreno: planície do parque, subindo para a Serra do Corvo atrás
  const hf=(x,z)=>{const kx=Math.max(0,Math.abs(x)-64),kz=Math.max(0,-56-z,z-54);const k=Math.hypot(kx,kz);return k*.1+Math.max(0,-z-70)*.32+(Math.sin(x*.09)*Math.cos(z*.07)*1.6+Math.sin(x*.23+z*.17)*.5)*Math.min(1,k/8);};
  {const geo=new T.PlaneGeometry(420,420,110,110);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,hf(p.getX(i),p.getZ(i)));geo.computeVertexNormals();const tm=new T.Mesh(geo,M(0x2b2e24));tm.receiveShadow=true;root.add(tm);}
  // grama seca, folhas e manchas
  for(let i=0;i<900;i++){const x=(R()-.5)*124,z=-52+R()*104;if(Math.abs(x)<4&&z>8)continue;item(x,0,z,.06+R()*.08,.2+R()*.45,.06,pick([0x5a5434,0x4a4a2e,0x6a6040,0x3e4228]),R()*3,(R()-.5)*.5,(R()-.5)*.5);}
  for(let i=0;i<420;i++)item((R()-.5)*120,0,-50+R()*100,.18,.015,.14,pick([0x5a3a22,0x6a4a2a,0x4a3020,0x7a5a30]),R()*6);
  for(let i=0;i<10;i++)plane((R()-.5)*100,.015,-40+R()*80,4+R()*8,3+R()*6,0x24261e);
  // alameda de cascalho e rotatória do chafariz
  const GRAV=0x5a564e;plane(0,.03,32,6,26,GRAV);plane(0,.03,12.5,8,7,GRAV);{const r=new T.Mesh(new T.RingGeometry(5.2,8.6,28).rotateX(-Math.PI/2),M(GRAV));r.position.set(0,.035,24);r.receiveShadow=true;root.add(r);}
  for(let i=0;i<160;i++)item((R()-.5)*6,.03,20+R()*24,.08+R()*.1,.05,.08,pick([0x6a665e,0x4a4640,0x7a766c]),R()*3);
  // ---------------- muro de pedra e portão de ferro
  const STONE=0x5c5850,STONE2=0x4a4741,IRON=0x17181a;
  const wallSeg=(xa,za,xb,zb)=>{const L=Math.hypot(xb-xa,zb-za),n=Math.ceil(L/6);for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,xa_=lerp(xa,xb,t0),za_=lerp(za,zb,t0),xb_=lerp(xa,xb,t1),zb_=lerp(za,zb,t1);const cx=(xa_+xb_)/2,cz=(za_+zb_)/2,len=L/n;const brk=R()<.12;const h=brk?.9+R()*.8:2.5;
      if(Math.abs(xb-xa)>Math.abs(zb-za))bx(cx,0,cz,len,h,.6,STONE);else bx(cx,0,cz,.6,h,len,STONE);item(xa_,0,za_,.9,2.9,.9,STONE2);item(xa_,2.9,za_,1.0,.18,1.0,0x3a3832);
      if(brk)for(let k=0;k<7;k++)item(cx+(R()-.5)*3,0,cz+(R()-.5)*2.4,.5,.3,.35,pick([STONE,STONE2]),R()*3,R(),R());
      for(let k=0;k<3;k++)item(cx+(R()-.5)*len*.8,R()*1.6,cz+(Math.abs(xb-xa)>Math.abs(zb-za)?.31:0),.4+R()*.8,.5+R()*1.2,.04,0x2a3324);}};
  wallSeg(-54,46,-4,46);wallSeg(4,46,58,46);wallSeg(-54,46,-54,-22);wallSeg(58,46,58,6);
  for(const sd of[-1,1]){bx(sd*3.6,0,46,1.4,4.2,1.4,STONE2);bx(sd*3.6,4.2,46,1.7,.3,1.7,0x3a3832);const lm=grp(sd*3.6,4.5,46,0);bx(0,0,0,.5,.7,.5,0x1a1a1a,lm);bx(0,.1,0,.36,.48,.36,(night||HORA==='cena')&&sd<0?E(0xffb060):M(0x2a2a26),lm);cone(0,.7,0,.36,.4,0x1a1a1a,lm,4);
    for(let k=0;k<4;k++)mvCrowI(sd*3.6+(k-1.5)*.35,4.52+.0,46+(R()-.5)*.6,R()*6);}
  if(LB-->0)pl(-3.6,4.7,46.8,0xffa050,1.4,16,true);
  // folhas do portão: uma fechada com corrente, outra entreaberta
  for(const sd of[-1,1]){const a=sd>0?-.75:0,ox=sd*2.9;const P=(u)=>[ox-sd*Math.cos(a)*u,46+Math.sin(a)*u*sd*-1];
    for(let i=0;i<=13;i++){const u=i*.22;const[px,pz]=P(u);const top=3.4+Math.sin(i/13*Math.PI)*.5*(sd>0?1:1);item(px,0,pz,.05,top,.05,IRON);item(px,top,pz,.03,.22,.03,IRON,0,.0,.0);}
    for(const y of[.3,1.6,3.1]){const[a0,b0]=P(0),[a1,b1]=P(2.86);mvStick(a0,y,b0,a1,y,b1,.07,IRON);}
    const[c0,d0]=P(1.43);item(c0,1.7,d0,.7,.7,.06,0x24241f);}
  sign('V',-1.43,2.05,46.05,.5,.5,0,{fg:'#8a7a4a',font:'700 100px Georgia',w:128,h:128});
  for(let i=0;i<6;i++)item(-.1,1.0+i*.12,46.05,.06,.1,.06,0x6a6c6e,0,0,i%2?.6:-.6);item(-.1,.75,46.08,.16,.2,.08,0x8a7a3a);
  sign(['MANSÃO VALVERDE','PROPRIEDADE PARTICULAR'],0,5.8,46.1,4.6,1,0,{bg:'rgba(20,18,16,.85)',fg:'#b8ac8a',font:'700 40px Georgia',w:512,h:112});
  // ---------------- a mansão
  const WALL=0x6e685c,WALL2=0x625c52,TRIM=0x3e3a34,ROOF=0x23262b,BASE=0x48443c;const Y=1.2;
  bx(0,0,-7.2,33,Y,15,BASE);bx(0,Y,-7,32,10.8,14,WALL);bx(0,Y+3.5,.05,32.2,.22,.25,TRIM);bx(0,Y+7.1,.05,32.2,.22,.25,TRIM);bx(0,12,-7,33,.5,15,TRIM);
  prism(0,12.5,-7,15.2,4.6,33,ROOF,null,Math.PI/2);for(let i=0;i<30;i++)item(-16+R()*32,12.5+R()*1.5,-1-R()*3,.3,.04,.3,pick([0x2e3236,0x1c1e22,0x3a3e3a]),0,-.55,0);
  for(const sx of[-11,-6.5,6.5,11]){bx(sx,12.5,-1.9,1.8,2.4,2.2,WALL2);prism(sx,14.9,-1.9,2.3,1.2,2.6,ROOF);mvWin(sx,13.9,-.8,'z',.8,1.3,R()<.25?'lit':'dark',TRIM);}
  for(const sx of[-13,13]){bx(sx,12.5,-10,1.5,6.4,1.5,0x45352c);bx(sx,18.9,-10,1.9,.3,1.9,TRIM);for(const k of[-.35,.35])cyl(sx+k,19.2,-10,.18,.18,.6,0x3a2a22,null,6);}
  // torre central com relógio parado e coruchéu
  bx(0,0,-1.6,7.6,Y,7.6,BASE);bx(0,Y,-1.6,7,18.8,7,WALL2);for(const y of[Y+3.5,Y+7.1,Y+10.7,Y+14.3])bx(0,y,-1.6,7.3,.22,7.3,TRIM);
  bx(0,20,-1.6,7.6,.5,7.6,TRIM);for(const sd of[-1,1])for(const sz of[-1,1])bx(sd*3.4,20.5,-1.6+sz*3.4,.5,2.6,.5,TRIM);
  bx(0,20.5,-1.6,6.4,2.4,6.4,M(0x060606));bx(0,23.1,-1.6,7.8,.4,7.8,TRIM);
  const sp=cone(0,23.5,-1.6,5.6,9,ROOF,null,4);sp.rotation.y=Math.PI/4;mvStick(0,32.4,-1.6,0,35,-1.6,.06,IRON);mvCrow(0,34.2,-1.6,.6,false);
  {const cf=cyl(0,0,0,1.25,1.25,.12,0xbab4a0,null,24);cf.rotation.x=Math.PI/2;cf.position.set(0,17.3,1.95);const rim=cyl(0,0,0,1.4,1.4,.1,TRIM,null,24);rim.rotation.x=Math.PI/2;rim.position.set(0,17.3,1.92);
    item(0,17.3,2.03,.07,.9,.03,0x111111,0,0,.7);item(0,17.3,2.03,.07,.6,.03,0x111111,0,0,-2.3);for(let i=0;i<12;i++){const a=i/12*6.28;item(Math.sin(a)*1.05,17.3+Math.cos(a)*1.05-.06,2.02,.06,.12,.02,0x2a2a2a,0,0,-a);}}
  for(let f=0;f<4;f++)for(const sx of[-1.6,1.6]){if(f===0)continue;const st=f===2&&sx<0?'shape':f===3?'broken':(R()<.3?'lit':'dark');mvWin(sx,Y+1.9+f*3.6,1.92+.0,'z',1.0,2.0,st,TRIM);}
  for(let f=1;f<4;f++)mvWin(3.52,Y+1.9+f*3.6,-1.6,'x',1.0,2.0,R()<.3?'board':'dark',TRIM);
  // fachada: 3 andares × 5 janelas de cada lado da torre
  const st=['dark','dark','lit','board','dark','broken','dark','board','dark','lit','dark','dark','board','shape','dark','dark','board','dark','broken','dark','dark','lit','board','dark','dark','dark','board','dark','dark','broken'];let si=0;
  for(let f=0;f<3;f++)for(const sd of[-1,1])for(let c=0;c<5;c++){const x=sd*(5.6+c*2.15);mvWin(x,Y+1.85+f*3.6,0,'z',1.05,f===0?2.3:2.0,st[si++%st.length],TRIM);}
  // alas laterais com telhado de mansarda e oculus
  for(const sd of[-1,1]){const wx=sd*21.8;bx(wx,0,-9.2,11.4,Y,14.4,BASE);bx(wx,Y,-9,11,7.2,14,WALL);bx(wx,Y+3.5,-1.95,11.2,.22,.2,TRIM);bx(wx,8.4,-9,11.8,.4,14.8,TRIM);prism(wx,8.8,-9,11.8,4.6,14.8,ROOF);
    const oc=cyl(0,0,0,.6,.6,.1,night||R()<.5?E(0x9a5a2a):M(0x0d1217,{roughness:.3,metalness:.5}),null,14);oc.rotation.x=Math.PI/2;oc.position.set(wx,10.6,-1.55);const orim=cyl(0,0,0,.78,.78,.08,TRIM,null,14);orim.rotation.x=Math.PI/2;orim.position.set(wx,10.6,-1.6);
    for(let f=0;f<2;f++)for(let c=0;c<3;c++)mvWin(wx+(c-1)*3.2,Y+1.85+f*3.6,-2,'z',1.05,2.1,pick(['dark','dark','board','lit','broken','dark']),TRIM);
    for(let f=0;f<2;f++)for(let c=0;c<4;c++)mvWin(wx+sd*5.5,Y+1.85+f*3.6,-14+c*3.2,sd>0?'x':'-x',1.0,2.0,pick(['dark','board','dark','dark']),TRIM);
    bx(wx+sd*2.2,8.8,-12,1.3,5.2,1.3,0x45352c);
    for(let i=0;i<10;i++)item(wx+(R()-.5)*10,Y+R()*4,-1.98,.1+R()*.3,1.5+R()*3,.05,pick([0x26301e,0x1e2618,0x2e3a22]),0,0,(R()-.5)*.4);}
  // vinhas e manchas de umidade na fachada
  for(let i=0;i<34;i++)item(-16+R()*32,Y+R()*6,.04,.08+R()*.25,1+R()*4,.05,pick([0x26301e,0x1e2618,0x2e3a22,0x34342a]),0,0,(R()-.5)*.5);
  for(let i=0;i<16;i++)item(-16+R()*32,Y+R()*9,.03,.6+R()*1.4,.4+R()*1.6,.02,pick([0x4e4a40,0x56504a]),0);
  // pórtico: escadaria, colunas, varanda com balaústre, porta entreaberta
  bx(0,0,4,13,Y,5,BASE);for(let i=0;i<6;i++)bx(0,0,6.7+i*.42,8.2,Y-i*.2,.44,0x55514a);
  for(const sd of[-1,1]){bx(sd*4.4,0,7.6,.9,Y+.6,3.4,BASE);const u=grp(sd*4.4,Y+.6,8.6,0);cyl(0,0,0,.25,.35,.3,TRIM,u,10);cyl(0,.3,0,.45,.25,.5,TRIM,u,10);
    const gg=grp(sd*4.4,Y+.6,6.6,sd>0?.4:-.3);bx(0,0,0,.6,.5,.7,0x4e4a42,gg);bx(0,.5,.2,.4,.45,.35,0x4e4a42,gg);bx(0,.75,.45,.25,.22,.3,0x4e4a42,gg);for(const k of[-1,1])bx(k*.12,1,.35,.05,.18,.05,0x4e4a42,gg);bx(0,.82,.55,.2,.03,.02,night?E(0xff3a1a):M(0x2a2a2a),gg);}
  for(let i=0;i<6;i++){const x=-5.4+i*2.16;cyl(x,Y,6,.28,.32,4,0x8a8478,null,12);cyl(x,Y,6,.42,.42,.25,TRIM,null,12);cyl(x,Y+3.8,6,.45,.32,.3,TRIM,null,12);}
  bx(0,Y+4.1,4.1,13.4,.55,4.6,TRIM);for(let i=0;i<22;i++)item(-6.3+i*.6,Y+4.65,6.25,.12,.7,.12,0x7a746a);item(0,Y+5.35,6.25,13,.14,.25,TRIM);
  bx(-.55,Y,2.0,1.1,3.2,.12,0x2a1a12);const dr=bx(.55,Y,2.5,1.1,3.2,.12,0x2a1a12);dr.rotation.y=-1.1;dr.position.x=1.25;bx(.55,Y,1.98,1.1,3.2,.05,M(0x020202));
  bx(0,Y+3.2,1.98,2.2,.7,.06,night||HORA==='cena'?E(0x6a3a14):M(0x0d1217,{roughness:.3,metalness:.5}));
  if(LB-->0)pl(0,Y+2.6,3.4,0xffa040,.9,9,true);bx(-1.5,Y+2.6,2.0,.28,.4,.28,E(0xffb060));
  for(let i=0;i<9;i++)blood(.3+i*.9+R()*.3,3.2+i*1.1,.35+R()*.3,i<2?Y:(i<5?Y-(i-1)*.2:0));
  // ---------------- jardim formal morto e chafariz seco
  const HEDGE=[0x3a3e2a,0x34382a,0x42402c,0x4a4430];
  const hedge=(x,z,w,d)=>{for(let u=-w/2;u<w/2;u+=1.1)for(let v=-d/2;v<d/2;v+=1.1){if(R()<.08)continue;const hh=1.1+R()*.5;item(x+u+.55,0,z+v+.55,1.25,hh,1.25,pick(HEDGE),R()*.4);if(R()<.3)item(x+u+.55,hh,z+v+.55,.05,.4+R()*.3,.05,0x3a2e22,0,R()-.5,R()-.5);}};
  for(const sd of[-1,1]){hedge(sd*13,18,10,1.1);hedge(sd*13,30,10,1.1);hedge(sd*8.5,24,1.1,11);hedge(sd*17.5,24,1.1,11);
    for(const z of[20,28]){const tp=cone(sd*13,0,z,.9,2.6,0x3a3a28,null,7);tp.rotation.z=sd*.12;}
    for(let k=0;k<4;k++){const x=sd*(11+k*1.4),z=24+(R()-.5)*3;item(x,0,z,.6,.06,.4,0x2a2a1e,R()*3);}
    hedge(sd*13,38,12,1.1);hedge(sd*28,10,1.1,30);}
  {const fx=0,fz=24;cyl(fx,0,fz,4.2,4.4,.75,0x6a665e,null,22);cyl(fx,.2,fz,3.8,3.8,.6,0x2a2822,null,22);cyl(fx,.75,fz,.6,.8,1.6,0x6a665e,null,10);cyl(fx,2.3,fz,1.8,.5,.4,0x6a665e,null,14);cyl(fx,2.7,fz,.3,.4,.4,0x6a665e,null,8);
    for(let i=0;i<40;i++)item(fx+(R()-.5)*6.5,.8,fz+(R()-.5)*6.5,.18,.02,.14,pick([0x5a3a22,0x6a4a2a,0x3a2a1a]),R()*6);
    const an=human(fx,fz,Math.PI*.1,null,{y:3.1,cloth:0x7c786e,pants:0x7c786e,skin:0x7c786e});an.children.forEach(c=>{if(c.children)c.children.forEach(m=>{if(m.material&&m.material.isMeshBasicMaterial)m.visible=false;});});
    for(const sd of[-1,1]){const wg=bx(fx+sd*.45,4.3,fz-.25,.7,1.3,.08,0x7c786e);wg.rotation.y=sd*.5;wg.rotation.z=-sd*.35;}
    item(fx+.9,0,fz+4.6,.32,.3,.3,0x7c786e,R(),R(),R());
    for(let k=0;k<5;k++)mvCrowI(fx+Math.cos(k*1.3)*4.1,.76,fz+Math.sin(k*1.3)*4.1,R()*6);
    zombie(fx-1.4,fz+4.4,.2,'w',null,{dead:true,cloth:0x3a4652});blood(fx-1.4,fz+4.6,1.1);for(let k=0;k<3;k++)mvCrowI(fx-1.2+(R()-.5),.32,fz+4.6+(R()-.5)*.8,R()*6);}
  // alameda de árvores mortas e estátuas
  for(let i=0;i<5;i++)for(const sd of[-1,1])mvDeadTree(sd*(5.2+R()*.6),0,14+i*6.5+R()*1.5,1.1+R()*.3);
  for(const sd of[-1,1])for(const z of[14,34]){bx(sd*7,0,z,1,1.4,1,0x5a564e);const s=grp(sd*7,1.4,z,sd*-.5);bx(0,0,0,.42,1.2,.32,0x6a665e,s);bx(0,1.2,0,.26,.3,.26,0x6a665e,s);if(z===34&&sd>0){item(sd*7+.9,0,z+.6,.28,.28,.28,0x6a665e,1,.4,.6);}}
  // coreto em ruínas no gramado leste
  {const cx=22,cz=26;cyl(cx,0,cz,3.4,3.6,.5,0x55514a,null,8);for(let i=0;i<8;i++){const a=i/8*6.28;if(i===3)continue;cyl(cx+Math.cos(a)*3,.5,cz+Math.sin(a)*3,.12,.12,i===5?1.6:2.8,0x6a665c,null,6);}
    const rf=cone(cx,3.1,cz,4,1.8,0x2c2e30,null,8);rf.rotation.z=.18;rf.position.y=3.6;for(let i=0;i<5;i++)item(cx+(R()-.5)*5,.5,cz+(R()-.5)*5,.8,.06,.3,0x2c2e30,R()*3,R()*.5,R()*.5);
    for(let i=0;i<8;i++){const a=i/8*6.28;mvStick(cx+Math.cos(a)*3,1.1,cz+Math.sin(a)*3,cx+Math.cos(a+.785)*3,1.1,cz+Math.sin(a+.785)*3,.06,0x6a665c);}
    mvDeadTree(cx+5,0,cz-4,1.5);const sw=grp(cx+5.8,0,cz-3.2,0);line([[cx+5.6,3.9,cz-3.2],[cx+5.6,.6,cz-3.2]],0x6a6050);line([[cx+6.2,3.9,cz-3.2],[cx+6.2,.6,cz-3.2]],0x6a6050);bx(0,.55,0,.8,.05,.3,0x4a3a28,sw);
    mvTomb(cx-4,cz+5,0x7a766c);}
  // ---------------- SUV abandonada do Instituto Valverde
  mvSUV(8.4,13.5,-.55);blood(7.2,12.6,.9);papers(8,10.5,10,3);for(let i=0;i<5;i++)item(5.5+R()*2,0,11+R()*2,.12,.02,.1,0xa8b8c0,R()*3);
  {const bd=human(6.6,11.4,2,null,{dead:true,cloth:0x1a1c20,pants:0x1a1c20,skin:0xc49a74});blood(6.6,11.2,1.4);item(5.8,0,10.6,.4,.1,.3,0x1a1a1a,.4);}
  // ---------------- cemitério da família e mausoléu (oeste)
  const CX=-37,CZ=18;plane(CX,.02,CZ,22,26,0x262820);
  for(const[a,b,c,d]of[[CX-11,CZ-13,CX+11,CZ-13],[CX+11,CZ-13,CX+11,CZ+13],[CX-11,CZ+13,CX+11,CZ+13],[CX-11,CZ-13,CX-11,CZ+13]]){const L=Math.hypot(c-a,d-b);for(let u=0;u<=L;u+=.3){if(u>9&&u<11&&b===CZ+13&&d===CZ+13)continue;const x=lerp(a,c,u/L),z=lerp(b,d,u/L);item(x,0,z,.04,1.4+(Math.round(u/.3)%3===0?.2:0),.04,IRON,0,(R()-.5)*.1,(R()-.5)*.1);}mvStick(a,1.25,b,c,1.25,d,.05,IRON);mvStick(a,.25,b,c,.25,d,.04,IRON);}
  for(const sd of[-1,1]){item(CX+sd*1.2,0,CZ+13,.35,1.9,.35,STONE2);}
  for(let r=0;r<4;r++)for(let c=0;c<6;c++){if(R()<.12)continue;mvTomb(CX-8+c*3.2+(R()-.5),CZ-2+r*3.6+(R()-.5)*.6);}
  for(let k=0;k<2;k++){const gx=CX-4+k*7,gz=CZ+9.2;plane(gx,.03,gz,1,2,0x050504);for(let i=0;i<8;i++)item(gx+1+R()*.8,0,gz+(R()-.5)*2,.5,.3+R()*.3,.5,0x3a3024,R()*3);}
  {const sh=grp(CX+4.6,0,CZ+9,0);bx(0,0,0,.04,1.2,.04,0x4a3a28,sh).rotation.z=.4;}
  zombie(CX-4,CZ+9,0.4,'w',null,{y:-.7,cloth:0x2a2826});zombie(CX+5,CZ+3,2.6,'w',null,{cloth:0x1e1e22,pants:0x1e1e22});
  for(let i=0;i<4;i++)mvDeadTree(CX+(R()-.5)*20,0,CZ+(R()-.5)*22,1.2+R()*.4);
  // mausoléu
  {const mx=CX,mz=CZ-9;bx(mx,0,mz,7.2,.6,6.6,0x4e4a44);bx(mx,.6,mz-.6,6,4.2,5,0x66625a);for(const sd of[-1.5,-.5,.5,1.5]){cyl(mx+sd*1.7,.6,mz+2.4,.25,.3,3.9,0x7a766c,null,10);}
    bx(mx,4.5,mz+.2,7,.45,6.2,0x4e4a44);prism(mx,4.95,mz+.2,7,1.8,6.2,0x3e3c38);for(let i=0;i<4;i++)bx(mx,0,mz+3.6+i*.35,3,.6-i*.15,.35,0x55514a);
    bx(mx-.55,.6,mz+1.92,1.1,2.6,.1,0x2c2e2c);const md=bx(mx+.55,.6,mz+2.2,1.1,2.6,.1,0x2c2e2c);md.rotation.y=-1.2;md.position.x=mx+1.2;bx(mx+.4,.6,mz+1.9,1.1,2.6,.04,M(0x010101));
    for(let i=0;i<4;i++)bx(mx+.45,.6-i*.3,mz+1.3-i*.45,.9,.06,.45,0x3a3834);
    sign('VALVERDE',mx,4.15,mz+2.15,3.2,.55,0,{fg:'#b8ac8a',font:'700 80px Georgia',w:512,h:96});
    const ang=human(mx,mz+.8,0,null,{y:6.75,cloth:0x6a665e,pants:0x6a665e,skin:0x6a665e});ang.children.forEach(c=>{if(c.children)c.children.forEach(m=>{if(m.material&&m.material.isMeshBasicMaterial)m.visible=false;});});for(const sd of[-1,1]){const wg=bx(mx+sd*.5,7.9,mz+.6,.8,1.4,.08,0x6a665e);wg.rotation.y=sd*.55;}
    for(let i=0;i<6;i++){cyl(mx-.9+i*.35,.6,mz+2.9,.035,.035,.18+R()*.15,0xe8e0c8,null,5);item(mx-.9+i*.35,.82,mz+2.9,.03,.06,.03,0xffb050);}
    if(LB-->0)pl(mx+.4,1.6,mz+2.6,0xff9a40,1.1,8,true);mvEyes(mx+.3,1.5,mz+1.6,0,0xff3a1a);}
  // ---------------- estufa de vidro quebrado (noroeste)
  {const gx=-36,gz=-15,W=10,D=14,H=3,RH=2.2;const GL=mvMat('vidro',()=>new T.MeshStandardMaterial({color:0x9ab0b0,transparent:true,opacity:.22,roughness:.1,metalness:.3,side:T.DoubleSide,depthWrite:false}));
    bx(gx,0,gz,W+.4,.4,D+.4,0x55514a);const F=0x2a2c2a;
    for(let u=-D/2;u<=D/2+.01;u+=2){for(const sd of[-1,1]){mvStick(gx+sd*W/2,.4,gz+u,gx+sd*W/2,.4+H,gz+u,.08,F);mvStick(gx+sd*W/2,.4+H,gz+u,gx,.4+H+RH,gz+u,.08,F);}}
    for(const sd of[-1,1]){mvStick(gx+sd*W/2,.4+H,gz-D/2,gx+sd*W/2,.4+H,gz+D/2,.08,F);mvStick(gx+sd*W/4,.4+H+RH/2,gz-D/2,gx+sd*W/4,.4+H+RH/2,gz+D/2,.05,F);for(let u=-D/2;u<D/2;u+=2){if(R()<.35)continue;mvPanel(gx+sd*(W/2+.01),.4+H/2,gz+u+1,2,H,Math.PI/2,GL,1);}
      for(let u=-D/2;u<D/2;u+=2){if(R()<.45)continue;const pn=mvPanel(gx+sd*W/4,.4+H+RH/2,gz+u+1,2,Math.hypot(W/2,RH),0,GL,1);pn.rotation.order='YXZ';pn.rotation.y=sd*Math.PI/2;pn.rotation.x=-Math.atan2(RH,W/2);}}
    mvStick(gx,.4+H+RH,gz-D/2,gx,.4+H+RH,gz+D/2,.08,F);mvPanel(gx,.4+H/2,gz+D/2,W,H,0,GL,1);
    for(const sd of[-1,1]){bx(gx+sd*2.6,.4,gz,1.2,.8,D-3,0x4a3a2a);for(let i=0;i<14;i++){const px=gx+sd*2.6+(R()-.5)*.8,pz=gz-D/2+2+i*.75;cyl(px,1.2,pz,.16,.12,.24,0x8a4a2a,null,6);const herb=R()<.35?0x8a2a22:R()<.5?0x3e6a2a:0x5a5a30;item(px,1.44,pz,.28,.2+R()*.4,.28,herb,R()*3);}}
    for(let i=0;i<60;i++)item(gx+(R()-.5)*W,.4,gz+(R()-.5)*D,.4+R()*.5,.3+R()*2.4,.3,pick([0x2e3a22,0x3a4a2a,0x26301e]),R()*3,(R()-.5)*.5,(R()-.5)*.5);
    for(let i=0;i<14;i++)item(gx+(R()-.5)*(W+3),.4,gz+(R()-.5)*(D+3),.1+R()*.3,.02,.1+R()*.2,0xb0c4c8,R()*3);
    zombie(gx+1,gz+2,2.2,'w',null,{y:.4,cloth:0x4a5a3a});}
  // ---------------- área de serviço dos fundos (leste): alambrado com farpado, canil e garagem
  const AX0=28,AX1=54,AZ0=-36,AZ1=4;plane((AX0+AX1)/2,.025,(AZ0+AZ1)/2,AX1-AX0,AZ1-AZ0,0x3a3934);
  chainlinkM(AX0,AZ1,AX0+11,AZ1,2.6,true);chainlinkM(AX0+15,AZ1,AX1,AZ1,2.6,true);chainlinkM(AX1,AZ1,AX1,AZ0,2.6,true);chainlinkM(AX1,AZ0,AX0,AZ0,2.6,true);chainlinkM(AX0,AZ0,AX0,-16,2.6,true);
  // portão do alambrado aberto + placa
  {const g=grp(AX0+11,0,AZ1,0);g.rotation.y=-1.0;item(0,0,0,.08,2.6,.08,0x80868c);const m=mvMat('chainlink',null);mvPanel(2,1.3,0,4,2.5,0,m,.42,g);bx(2,2.5,0,4,.06,.06,0x80868c,g);bx(2,0,0,4,.06,.06,0x80868c,g);}
  sign(['ÁREA RESTRITA','INSTITUTO VALVERDE'],AX0+6,1.6,AZ1+.06,2.4,.9,0,{bg:'#c8b830',fg:'#1a1a1a',font:'700 40px Arial',w:512,h:192});
  sign(['CUIDADO','CÃES'],AX0+20,1.4,AZ1+.06,1.4,.8,0,{bg:'#8a1a14',fg:'#fff',font:'700 52px Arial',w:256,h:144});
  // buraco no alambrado com tela arrancada
  {const pn=mvPanel(AX1-.4,.7,-12,1.6,1.4,Math.PI/2,mvMat('chainlink',null),.42);pn.rotation.z=.6;pn.position.x=AX1+.6;}
  // canil: laje, baias de alambrado, casinhas
  {const kx=40,kz=-27;bx(kx,0,kz,16,.15,8,0x6a6862);bx(kx,0,kz-4,16,2.6,.3,0x5a5852);bx(kx,2.6,kz-1.5,16.6,.15,5.4,0x3a3a36);for(const sd of[-1,1])for(const u of[0,1])cyl(kx+sd*7.8,0,kz+1-u*2.6,.06,.06,2.6,0x80868c,null,6);
    for(let i=0;i<=4;i++)chainlinkM(kx-8+i*4,kz-4,kx-8+i*4,kz+4,1.9,false);chainlinkM(kx-8,kz+4,kx+8,kz+4,1.9,false);
    for(let i=0;i<4;i++){const dx=kx-6+i*4;bx(dx,0,kz-2.6,1.4,1.0,1.2,0x5a4028);prism(dx,1.0,kz-2.6,1.6,.6,1.3,0x3a2a1c);bx(dx,0,kz-1.99,.6,.7,.04,M(0x050505));cyl(dx+1,.15,kz+2.8,.18,.15,.1,0x8a8c8e,null,8);for(let k=0;k<3;k++)item(dx+(R()-.5)*2.6,.15,kz+(R()-.5)*4,.25,.04,.05,0xd8d0b8,R()*3);blood(dx+(R()-.5)*2,kz+1,.5,.15);}
    mvCao(kx-6,kz+1.4,.3,{y:.15,pose:'lunge'});mvCao(kx+2,kz,2.5,{y:.15,pose:'eat'});mvCao(kx+6.2,kz+2.2,0,{y:.15,pose:'lunge'});
    {const g=grp(kx-2,0,kz+4,0);g.rotation.x=.25;}item(kx-2.6,0,kz+4.6,1.4,.05,1.2,0x80868c,.3,1.2,0);
    zombie(kx-2,kz+1,1.2,'w',null,{dead:true,cloth:0x2a3040,y:.15});blood(kx-2,kz+1.2,1.2,.15);
    if(LB-->0)pl(kx,2.3,kz,0xd8e0ff,1.0,12,true);bx(kx,2.3,kz,.7,.12,.25,E(0xdfe8ff));}
  mvCao(46,-9,2.8,{pose:'lunge'});mvCao(AX1+2.6,-12.6,1.9,{pose:'stand'});mvCao(AX1+4.2,-10.8,1.4,{pose:'stand',s:.95});
  // garagem/casa de máquinas, gerador, tanque de diesel
  {bx(47,0,-4,10,4.4,8,0x5e5a52);bx(47,4.4,-4,10.6,.3,8.6,0x3a3834);bx(44.5,0,-.02,3.6,3.4,.1,0x4a4c4e);bx(49.6,0,-.02,3,1.2,.1,0x4a4c4e);mvWin(50.5,2.4,0,'z',1,1,'broken',0x3a3834);
    bx(38,0,-6,2.2,1.4,1.2,0x4a5a3a);bx(38,1.4,-6,.2,.8,.2,0x2a2a2a);const tk=cyl(0,0,0,.8,.8,3.4,0x6a6a62,null,12);tk.rotation.z=Math.PI/2;tk.position.set(38,1.3,-10);for(const k of[-1,1])bx(38+k*1.2,0,-10,.2,.6,1,0x3a3a3a);
    sign('DIESEL',38,1.3,-9.18,1,.35,0,{bg:'#c8b830',fg:'#111',font:'700 60px Arial',w:256,h:96});}
  // ---------------- casa da guarda (portaria)
  {const gx=10,gz=40.5;bx(gx,0,gz,4,3,3.4,0x6a665c);bx(gx,3,gz,4.6,.25,4,0x3a3834);mvWin(gx,1.7,gz+1.7,'z',1.6,1,R()<.5||night?'lit':'dark',0x3a3834);mvWin(gx-2,1.7,gz,'-x',1.2,1,'broken',0x3a3834);bx(gx+1.2,0,gz+1.72,.9,2.1,.06,0x2a2a26);
    sign('PORTARIA',gx,2.7,gz+1.75,1.6,.3,0,{fg:'#c8c0a8',font:'700 60px Arial',w:256,h:64});if(LB-->0)pl(gx,2.4,gz,0xffc070,.8,7,true);
    item(gx-5.5,0,gz+3.6,.25,1.1,.25,0x3a3a3a);mvStick(gx-5.5,1,gz+3.6,gx-2,1.6,gz+3.6,.08,0xd8c030);
    zombie(gx+2.6,gz+2.4,1.2,'w',null,{cloth:0x2a3040,pants:0x2a3040,hat:0x1a1c22});}
  // ---------------- floresta da Serra do Corvo em volta
  for(let i=0;i<150;i++){let x,z;do{x=(R()-.5)*260;z=-130+R()*230;}while(x>-58&&x<62&&z>-42&&z<52);pine(x,z,1.6+R()*1.8,hf(x,z)-.2);}
  for(let i=0;i<24;i++){let x,z;do{x=(R()-.5)*200;z=-100+R()*180;}while(x>-56&&x<60&&z>-40&&z<50);mvDeadTree(x,hf(x,z),z,1.4+R()*.6);}
  for(let i=0;i<10;i++){const x=-30+R()*58,z=-26-R()*14;mvDeadTree(x,0,z,1.2+R()*.5);}
  for(let i=0;i<9;i++){const a=R()*6.28;const x=(R()<.5?-1:1)*(60+R()*6),z=-40+R()*80;mvEyes(x,hf(x,z)+1.3+R()*.4,z,x>0?-Math.PI/2:Math.PI/2,0xff2a1a,2.6);}
  for(let i=0;i<4;i++){const x=-30+R()*60,z=-46-R()*6;mvEyes(x,hf(x,z)+1.4,z,0,0xff2a1a,2.6);}
  for(let i=0;i<6;i++){const x=-50+R()*104,z=63+R()*6;mvEyes(x,hf(x,z)+1.4,z,Math.PI,0xff2a1a,2.6);}
  // zumbis do parque
  zombie(-2,49,0,'w',null,{cloth:0x2a2826});zombie(1.2,50.5,-.3,'w');zombie(-9,8,.6,'r',null,{cloth:0x5a2a26});zombie(14,6,-.8,'w',null,{cloth:0xe0dcd0,pants:0x8a8a84});
  // corvos: bando sobre a torre e pousados no telhado
  mvFlock(0,30,-2,7,7);mvFlock(-38,9,10,4,5);
  for(let i=0;i<14;i++)mvCrowI(-15+R()*30,12.52,.4,R()*6);for(let i=0;i<6;i++)mvCrowI(-3+R()*6,23.5,1.9,R()*6);
  // luz quente de dentro (janelas acesas)
  if(LB-->0)pl(-8,6,1.6,0xffa050,.9,10);if(LB-->0)pl(11,9.5,1.6,0xffa050,.7,9,true);
  
  pin(0,6.5,46,'perigo','Portão principal','Portão de ferro acorrentado; a folha direita cede. O rangido atrai os zumbis da alameda. O lampião pisca a noite toda.');
  pin(10,4,40.5,'loot','Casa da guarda','Chave mestra da mansão no quadro de chaves, rádio do vigia e espingarda calibre 12 com 4 cartuchos. O vigia ainda está de uniforme.');
  pin(0,9,24,'cena','Chafariz seco','O anjo perdeu a cabeça. Corvos bicando um corpo na borda: o motorista da SUV não chegou até a porta.');
  pin(8.4,3,13.5,'loot','SUV do Instituto Valverde','Porta aberta, faróis fracos. Crachá de acesso nível 1, pasta com relatórios queimados e um rastro de sangue até a porta.');
  pin(0,9,4,'perigo','Pórtico e porta principal','Porta entreaberta para o hall escuro. Vultos aparecem nas janelas do 2º andar da torre.');
  pin(-37,4,18,'cena','Cemitério da família','Lápides tortas da família Valverde; duas covas abertas por dentro. Pelo menos um morto ainda está saindo.');
  pin(-37,8,9,'quebra','Mausoléu Valverde','Velas acesas por alguém. A escada atrás da porta leva a uma passagem secreta até o Laboratório Aurora.');
  pin(-36,6.5,-15,'loot','Estufa','Vidro quebrado e plantas tomando tudo. Ervas verdes e vermelhas: misture para curar mais.');
  pin(40,4,-27,'perigo','Canil','Dobermanns infectados: rápidos, baixos e em grupo. Três ainda presos nas baias, outros soltos pelo buraco no alambrado.');
  pin(54,4,-12,'local','Alambrado dos fundos','Tela de 2,6 m com farpado e concertina. Rasgada no lado leste: é por onde os cães saem para a mata.');
  flush();
  return {r:138,th:.66,ph:1.06,t:[-15,4,8]};
}

// chama de lareira/vela sem fumaça (cones emissivos + luz que tremula)
function mvFlame(x,y,z,s){s=s||1;const fl=[];for(let i=0;i<5;i++){const c=new T.Mesh(new T.ConeGeometry((.12+R()*.08)*s,(.5+R()*.3)*s,5),E(i%2?0xffd27a:0xff8a2a));c.position.set(x+(R()-.5)*.4*s,y+.25*s,z+(R()-.5)*.5*s);root.add(c);fl.push([c,R()*9]);}
  for(let i=0;i<3;i++)item(x+(R()-.5)*.4*s,y,z+(R()-.5)*.5*s,.5*s,.08*s,.1*s,0x2a1a10,R()*3);
  const L=LB-->0?pl(x+.3,y+.8*s,z,0xff7a2a,1.8*s,9*s):null;ANIM.push(t=>{fl.forEach(([c,p])=>{c.scale.y=.7+Math.abs(Math.sin(t*9+p))*.6;});if(L)L.intensity=1.8*s*(.75+Math.sin(t*17)*.15+Math.sin(t*7.3)*.1);});}
// ---------- texturas do interior
function mvMats(){
  const st=(key,draw,o)=>mvMat(key,()=>new T.MeshStandardMaterial(Object.assign({map:mvTex(key,128,128,draw),roughness:.85},o||{})));
  return {
    damask:st('damask',(g,w,h)=>{g.fillStyle='#3a1515';g.fillRect(0,0,w,h);g.fillStyle='#4c1d1a';for(const[cx,cy]of[[32,32],[96,96],[96,32-64],[32,96+0]]){g.beginPath();g.ellipse(cx,cy,14,24,0,0,6.3);g.fill();g.beginPath();g.moveTo(cx,cy-34);g.lineTo(cx+10,cy);g.lineTo(cx,cy+34);g.lineTo(cx-10,cy);g.fill();}
      g.fillStyle='#2a0f0e';for(let x=0;x<w;x+=64)g.fillRect(x,0,3,h);for(let i=0;i<60;i++){g.fillStyle='rgba(0,0,0,'+(Math.random()*.25)+')';g.fillRect(Math.random()*w,Math.random()*h,Math.random()*30,Math.random()*60);}}),
    wood:st('wood',(g,w,h)=>{for(let i=0;i<8;i++){const c=60+Math.floor(Math.random()*25);g.fillStyle='rgb('+c+','+Math.floor(c*.66)+','+Math.floor(c*.42)+')';g.fillRect(0,i*16,w,16);g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,i*16,w,1.5);const o=Math.random()*w;g.fillRect(o,i*16,1.5,16);}
      for(let i=0;i<40;i++){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(Math.random()*w,Math.random()*h,20+Math.random()*40,1);}}),
    marble:st('marble',(g,w,h)=>{for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.fillStyle=(i+j)%2?'#1c1c1e':'#bcb6aa';g.fillRect(i*64,j*64,64,64);}g.strokeStyle='rgba(120,110,100,.35)';for(let k=0;k<10;k++){g.beginPath();let x=Math.random()*w,y=Math.random()*h;g.moveTo(x,y);for(let s=0;s<5;s++){x+=(Math.random()-.5)*40;y+=Math.random()*25;g.lineTo(x,y);}g.stroke();}
      for(let i=0;i<30;i++){g.fillStyle='rgba(40,30,20,'+(Math.random()*.25)+')';g.fillRect(Math.random()*w,Math.random()*h,8+Math.random()*20,8+Math.random()*20);}},{roughness:.35}),
    tile:st('tile',(g,w,h)=>{g.fillStyle='#d6d9d6';g.fillRect(0,0,w,h);g.fillStyle='#9ea29e';for(let k=0;k<=4;k++){g.fillRect(k*32-1,0,2,h);g.fillRect(0,k*32-1,w,2);}for(let i=0;i<14;i++){g.fillStyle='rgba(90,80,60,'+(Math.random()*.2)+')';g.fillRect(Math.random()*w,Math.random()*h,6+Math.random()*30,6+Math.random()*30);}},{roughness:.4}),
    floorLab:st('floorLab',(g,w,h)=>{g.fillStyle='#6e7270';g.fillRect(0,0,w,h);g.fillStyle='#4a4e4c';for(let k=0;k<=2;k++){g.fillRect(k*64-1,0,2,h);g.fillRect(0,k*64-1,w,2);}for(let i=0;i<20;i++){g.fillStyle='rgba(20,20,20,'+(Math.random()*.25)+')';g.fillRect(Math.random()*w,Math.random()*h,10+Math.random()*30,10+Math.random()*30);}},{roughness:.5}),
    hazard:st('hazard',(g,w,h)=>{g.fillStyle='#d8b828';g.fillRect(0,0,w,h);g.fillStyle='#151515';for(let k=-4;k<6;k++){g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32+16,0);g.lineTo(k*32+16+h,h);g.lineTo(k*32+h,h);g.fill();}}),
    rock:st('rock',(g,w,h)=>{g.fillStyle='#3a3530';g.fillRect(0,0,w,h);for(let i=0;i<70;i++){const c=40+Math.floor(Math.random()*30);g.fillStyle='rgb('+c+','+(c-4)+','+(c-9)+')';g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,4+Math.random()*14,3+Math.random()*9,Math.random()*3,0,6.3);g.fill();}}),
  };}
function mvPortraitMat(k){return mvMat('portrait'+k,()=>new T.MeshStandardMaterial({roughness:.7,map:mvTex('portrait'+k,128,160,(g,w,h)=>{const bg=['#1e2a22','#2a1c18','#1c1e2a','#26201a'][k%4];g.fillStyle=bg;g.fillRect(0,0,w,h);
  g.fillStyle=['#1a1414','#2a2a3a','#3a1a1a','#141414'][k%4];g.beginPath();g.ellipse(64,170,62,70,0,0,6.3);g.fill();g.fillStyle='#c8b098';g.beginPath();g.ellipse(64,70,22,29,0,0,6.3);g.fill();g.fillStyle='#2a1a12';g.beginPath();g.ellipse(64,48,25,16,0,3.14,6.3);g.fill();
  if(k===3){g.fillStyle='#000';g.fillRect(48,62,12,8);g.fillRect(68,62,12,8);g.fillStyle='#7a1010';g.fillRect(50,70,3,30);g.fillRect(74,70,3,22);}else{g.fillStyle='#1a1410';g.fillRect(52,64,8,4);g.fillRect(68,64,8,4);}g.fillStyle='#5a3a30';g.fillRect(58,86,12,3);
  if(k===1){g.strokeStyle='#5a0c0a';g.lineWidth=4;g.beginPath();g.moveTo(10,20);g.lineTo(118,140);g.moveTo(20,10);g.lineTo(118,120);g.stroke();}})}));}
function mvPortrait(x,y,z,w,h,ry,k){const f=0x6a5420;const m=new T.Mesh(new T.PlaneGeometry(w,h),mvPortraitMat(k));m.position.set(x+Math.sin(ry||0)*.02,y,z+Math.cos(ry||0)*.02);m.rotation.y=ry||0;root.add(m);const s=Math.sin(ry||0),c=Math.cos(ry||0);
  for(const sd of[-1,1]){item(x+c*sd*(w/2+.06)-s*.01,y-h/2-.08,z-s*sd*(w/2+.06)-c*.01,.12,h+.16,.12,f,ry||0);item(x+s*0,y+sd*(h/2+.06)-.06,z,(w+.24)*Math.abs(c)+.12*Math.abs(s),.12,(w+.24)*Math.abs(s)+.12*Math.abs(c),f);}}
// tubo de contenção com brilho verde e espécime
function mvTube(x,y,z,o){o=o||{};const G=mvMat('tubeGlass',()=>new T.MeshStandardMaterial({color:0x5affa0,emissive:0x1a8a4a,transparent:true,opacity:.42,roughness:.05,metalness:.2,depthWrite:false}));
  cyl(x,y,z,.85,.95,.5,M(0x5a6064,{metalness:.7,roughness:.35}),null,16);cyl(x,y+.5,z,.8,.8,.08,E(0x3aff8a),null,16);cyl(x,y+3.0,z,.9,.85,.45,M(0x5a6064,{metalness:.7,roughness:.35}),null,16);
  for(const a of[0,2.1,4.2])mvStick(x+Math.cos(a)*.5,y+3.45,z+Math.sin(a)*.5,x+Math.cos(a)*.3,y+4.1,z-.6,.09,0x4a4e52);
  if(o.broken){const sh=cyl(x,y+.5,z,.8,.8,.7,G,null,16);sh.material=G;for(let i=0;i<5;i++){const a=i*1.3;item(x+Math.cos(a)*.78,y+.5,z+Math.sin(a)*.78,.3,.4+R()*.9,.03,0x9adcb8,-a,0,(R()-.5)*.4);}
    for(let i=0;i<22;i++)item(x+(R()-.5)*3.4,y,z+.6+R()*2,.08+R()*.18,.015,.06+R()*.14,0xa8e8c8,R()*3);const pd=new T.Mesh(new T.CircleGeometry(1.6,14).rotateX(-Math.PI/2),M(0x2a6a3a,{roughness:.1,metalness:.3}));pd.position.set(x+.3,y+.02,z+1.2);root.add(pd);return;}
  const gt=cyl(x,y+.58,z,.8,.8,2.42,G,null,16);gt.castShadow=false;
  if(o.spec){const sp=zombie(x,z,(R()-.5),'b',null,{y:y+.7,skin:0x8a6a6a,cloth:0x6a3a3a,pants:0x5a3030});sp.scale.setScalar(.82);const tor=sp.children[2];tor.rotation.x=.25;bx(.15,.2,.16,.16,.14,.05,E(0xb02020),tor);bx(-.38,-.4,0,.12,.5,.12,0x8a6a6a,tor);for(let k=0;k<3;k++){const cl=bx(-.38+(k-1)*.05,-.62,.06,.025,.22,.025,0xd8d0b8,tor);cl.rotation.x=.3;}
    ANIM.push(t=>{sp.position.y=y+.7+Math.sin(t*.8+x)*.06;});}
  else if(o.small){const b=bx(x,y+1.4,z,.4,.6,.35,0x7a5a5a);b.rotation.z=.4;bx(x,y+2.0,z,.3,.3,.3,0x7a5a5a).rotation.y=.6;}
  for(let i=0;i<6;i++)item(x+(R()-.5)*1,y+.7+R()*2.1,z+(R()-.5)*1,.04,.04,.04,0xc8ffd8);}
function mvRack(x,y,z){bx(x,y,z,.7,2.2,1.1,0x1a1c1f);for(let i=0;i<6;i++)item(x,y+.2+i*.32,z+.56,.6,.14,.02,0x2a2e33);const led=bx(x,y+.3,z+.575,.5,1.6,.01,E(pick([0x30ff60,0x30c0ff,0xff4020])));led.castShadow=false;led.scale.set(.06,1,1);led.position.x=x-.2;const ph=R()*7;ANIM.push(t=>{led.visible=Math.sin(t*5+ph)>-.6;});}
function mvHazmat(x,z,ry,y){const zz=zombie(x,z,ry,'w',null,{y,cloth:0xc8b028,pants:0xc8b028,skin:0x7d8a6a,hat:0xc8b028});const tor=zz.children[2];bx(0,.72,.17,.26,.16,.04,M(0x1a2a2e,{roughness:.1,metalness:.6}),tor);bx(0,.1,-.2,.3,.4,.14,0x8a8c8e,tor);bx(.1,.3,.16,.12,.2,.02,0x5a0a08,tor);return zz;}
function mvScientist(x,z,ry,y,dead){return zombie(x,z,ry,'w',null,{y,cloth:0xd8d8d0,pants:0x3a3d44,dead});}

function buildMansaoInterior(){
  env('inside',40);const MT=mvMats();const night=HORA==='noite';
  if(HORA==='cena')root.add(new T.HemisphereLight(0x6a5a50,0x141010,.35));
  const X0=-22,X1=20,Z0=-7,Z1=7,H1=4.2,H2=8.6,FL=.2;
  const ROCK=0x37322d,SOIL=0x3e3226,TRIM=0x2a1c14,WP=MT.damask,WOODM=MT.wood;
  const L1=-10,L2=-15.6,LH=3.6;
  // ---------------- terra e rocha em corte
  const RK=MT.rock;
  bx(-1,-17.4,-7.9,44+24,17.4,1.4,RK);bx(-34-1,-17.4,0,22,17.4,14.6,RK);bx(33,-17.4,0,26,7.4,14.6,RK);bx(33,-6.4,0,26,6.4,14.6,RK);bx(33,-10,-7.2,26,3.6,.6,RK);bx(33,-10,3.6,26,.5,7,RK);
  for(const sx of[-35,33]){bx(sx,-.6,0,sx<0?22:26,.6,14.6,SOIL);plane(sx,.01,0,sx<0?22:26,14.6,0x2b2e24);}
  bx(-1,-17.6,0,42,2,14.6,RK);bx(-1,L1-.3,0,42,.3,14.6,0x2a2622);bx(-1,L2+LH,-4.6,42,L1-.3-L2-LH,5.2,RK);
  bx(-1,-4.3,0,42,.3,14.6,0x2a2622);bx(-1,L1+LH,-4.6,42,-4.3-L1-LH,5.2,RK);bx(9,-4,-4.6,14,4,5.2,RK);bx(20.8,-4,0,1.6,4,14.6,RK);
  bx(-1,-.4,0,42.4,.4,14.6,0x2a2622);
  for(let i=0;i<70;i++){const x=R()<.5?-45+R()*22:21+R()*24;if(x>20&&R()<.5){item(x,-10+R()*3,7.32,.4,.3,.05,0x2a2622);continue;}item(x,-17+R()*16,7.32,.4+R()*1.2,.3+R()*.8,.05,pick([0x2e2a26,0x433d36,0x2a2622]),0);}
  // ---------------- casca da mansão (paredes do fundo e da esquerda inteiras)
  bx((X0+X1)/2,0,Z0-.08,X1-X0,H2,.16,0x4a3a2e);mvPanel((X0+X1)/2,H1/2+.0,Z0+.01,X1-X0-.3,H1,0,WP,1.4);mvPanel(-16,H1+FL+(H2-H1-FL)/2,Z0+.01,12,H2-H1-FL,0,WP,1.4);mvPanel(10.5,H1+FL+(H2-H1-FL)/2,Z0+.01,9,H2-H1-FL,0,WP,1.4);mvPanel(-2,H1+FL+(H2-H1-FL)/2,Z0+.01,16,H2-H1-FL,0,WP,1.4);
  bx(X0-.08,0,0,.16,H2,Z1-Z0,0x4a3a2e);mvPanel(X0+.01,H1/2,0,Z1-Z0,H1,Math.PI/2,WP,1.4);mvPanel(X0+.01,H1+FL+(H2-H1-FL)/2,0,Z1-Z0,H2-H1-FL,Math.PI/2,WP,1.4);
  bx((X0+X1)/2,0,Z1,X1-X0,.6,.16,0x4a3a2e);bx(X1,0,0,.16,.6,Z1-Z0,0x4a3a2e);
  bx((X0+X1)/2,H2,-6.5,X1-X0+.4,.3,1.2,TRIM);bx(X0-.2,H2,0,.5,.3,Z1-Z0,TRIM);
  for(const x of[X0+.5,X1-.5])item(x,0,Z0+.1,.3,1.1,.06,TRIM);bx((X0+X1)/2,0,Z0+.06,X1-X0,1.1,.06,0x2e1e14);bx((X0+X1)/2,1.1,Z0+.1,X1-X0,.08,.08,0x6a5420);bx(X0+.06,0,0,.06,1.1,Z1-Z0,0x2e1e14);
  // pisos
  mvFloor(-16,.01,0,12,14,WOODM,1.6);mvFloor(-2,.01,0,16,14,MT.marble,1.6);mvFloor(10.5,.01,0,9,14,WOODM,1.6);
  // paredes internas
  const IW=0x4a3a2e;const wallX=(x,y,h,za,zb)=>{bx(x,y,(za+zb)/2,.2,h,zb-za,IW);mvPanel(x+.11,y+h/2,(za+zb)/2,zb-za,h,Math.PI/2,WP,1.4);mvPanel(x-.11,y+h/2,(za+zb)/2,zb-za,h,-Math.PI/2,WP,1.4);};
  wallX(-10,0,H1,Z0,-1.5);wallX(-10,0,H1,1.2,Z1);bx(-10,3,0,.2,1.2,2.7,IW);
  wallX(6,0,H1,Z0,-1);wallX(6,0,H1,1.4,Z1);bx(6,3,.2,.2,1.2,2.4,IW);
  wallX(15,0,H1,-3.6,Z1);
  wallX(-10,H1+FL,H2-H1-FL,Z0,Z1);wallX(6,H1+FL,H2-H1-FL,Z0,Z1);
  // lajes do 2º andar (galeria e sala de música) e patamar do hall
  bx(-16,H1,0,12,FL,14,0x3a2a1e);mvFloor(-16,H1+FL+.01,0,12,14,WOODM,1.6);bx(13,H1,0,14,FL,14,0x3a2a1e);mvFloor(10.5,H1+FL+.01,0,9,14,WOODM,1.6);
  bx(-2,H1,-5.8,16,FL,2.4,0x3a2a1e);mvFloor(-2,H1+FL+.01,-5.8,16,2.4,WOODM,1.6);for(let x=-9.6;x<=5.6;x+=.4)item(x,H1+FL,-4.62,.06,.9,.06,0x3a2416);item(-2,H1+FL+.9,-4.62,16,.08,.12,0x3a2416);
  // ================= HALL PRINCIPAL
  {const steps=21,sh=(H1+FL)/steps,sd=.34;
    for(const fx of[-7.2,3.2]){for(let i=0;i<steps;i++){const z=2.6-i*sd;item(fx,0,z,2.2,(i+1)*sh,sd+.02,0x3a2a1e);item(fx,(i+1)*sh,z,1.4,.02,sd+.02,0x7a1414);}
      for(const s of[-1,1]){mvStick(fx+s*1.1,1,2.8,fx+s*1.1,H1+FL+1,-4.4,.1,0x3a2416);for(let i=0;i<steps;i+=2){const z=2.6-i*sd;item(fx+s*1.1,(i+1)*sh,z,.05,1,.05,0x3a2416);}}
      item(fx-1.1,0,2.9,.2,1.3,.2,0x3a2416);item(fx+1.1,0,2.9,.2,1.3,.2,0x3a2416);}}
  plane(-2,.02,3.2,2.2,7.6,0x6a1212);plane(-2,.025,-.5,10.4,1.6,0x6a1212);
  for(let i=0;i<7;i++)blood(-2.2+(R()-.5)*.6,6-i*1.1,.3+R()*.2);
  // lustre torto
  {const cx=-2,cy=6.2,cz=-.4;line([[cx,H2,cz],[cx+.3,cy+.4,cz]],0x6a5a3a);const ch=grp(cx+.3,cy,cz,0);ch.rotation.z=.18;
    const r1=new T.Mesh(new T.TorusGeometry(1.1,.05,6,18),M(0x8a7030,{metalness:.8,roughness:.3}));r1.rotation.x=Math.PI/2;ch.add(r1);const r2=new T.Mesh(new T.TorusGeometry(.6,.04,6,14),M(0x8a7030,{metalness:.8,roughness:.3}));r2.rotation.x=Math.PI/2;r2.position.y=.45;ch.add(r2);
    for(let i=0;i<10;i++){const a=i/10*6.28;bx(Math.cos(a)*1.1,0,Math.sin(a)*1.1,.05,.18,.05,0xe8e0c8,ch);if(i%3)bx(Math.cos(a)*1.1,.18,Math.sin(a)*1.1,.04,.06,.04,E(0xffc070),ch);bx(Math.cos(a)*1.1,-.35,Math.sin(a)*1.1,.04,.3,.04,M(0xd8f0ff,{transparent:true,opacity:.6}),ch);}
    if(LB-->0)pl(cx,cy-.2,cz,0xffb060,1.6,16,true);glass(cx+.6,cz+.6,22,2);}
  // relógio de pêndulo parado
  {const g=grp(-9.6,0,-3.4,Math.PI/2);bx(0,0,0,.7,2.4,.5,0x3a2216,g);bx(0,2.4,0,.8,.3,.55,0x2a180e,g);const fc=cyl(0,0,0,.24,.24,.04,0xd8d0b8,g,16);fc.rotation.x=Math.PI/2;fc.position.set(0,2.0,.27);bx(0,.4,.26,.36,1.2,.02,M(0x050505),g);bx(0,.55,.28,.18,.18,.02,0x8a7030,g);item(-9.32,1.98,-3.4,.02,.18,.02,0x111111);}
  // máquina de escrever (sala segura) sob a escada
  {table(-4.4,-5.6,1,.6,0x3a2216,0);bx(-4.4,.78,-5.6,.4,.16,.32,0x1a1a1a);item(-4.1,.78,-5.5,.08,.05,.08,0x2a2a2a);bx(-3.6,.78,-5.6,.12,.3,.12,E(0xffc070));}
  // estátua com brasões no patamar
  {const sx=-2,sy=H1+FL,sz=-6.2;bx(sx,sy,sz,1.2,1,1.2,0x6a665e);const st=human(sx,sz,0,null,{y:sy+1,cloth:0x8a867c,pants:0x8a867c,skin:0x8a867c});st.children.forEach(c=>{if(c.children)c.children.forEach(m=>{if(m.material&&m.material.isMeshBasicMaterial)m.visible=false;});});
    bx(sx,sy+2.2,sz+.45,.55,.65,.08,0x6a5420);
    const crest=['#8a1a14','#1a3a6a','#2a5a2a',''];['LOBO','CORVO','ÁGUIA','SERPENTE'].forEach((n,i)=>{const x=sx-4.5+i*3+(i>1?0:0);const cx=i<2?sx-5+i*2:sx+3+(i-2)*2;bx(cx,sy+2.2,Z0+.1,1,1.2,.1,0x2a1c14);if(i<3){sign(n,cx,sy+2.8,Z0+.17,1,.35,0,{bg:crest[i],fg:'#e8d8a8',font:'700 44px Georgia',w:256,h:96});bx(cx,sy+2.3,Z0+.16,.6,.5,.04,0x8a7030);}else bx(cx,sy+2.3,Z0+.16,.6,.5,.04,M(0x050505));});}
  for(const x of[-9,5])mvPortrait(x,6.4,Z0+.04,1.2,1.5,0,x>0?2:0);
  mvWin(-2,H1+FL+2.2,Z0-.02,'z',1.0,2.2,'dark',TRIM);
  zombie(-.2,1.6,2.8,'w',null,{cloth:0x2a2a2e,pants:0x2a2a2e});zombie(3.4,-2.3,3.2,'w',null,{y:1.9,cloth:0x5a4a3a});
  // ================= SALA DE JANTAR
  {const tx=-16,tz=.2;bx(tx,.72,tz,1.8,.08,8.6,0x3a2216);for(const a of[-1,1])for(const b of[-1,0,1])bx(tx+a*.75,0,tz+b*3.8,.12,.72,.12,0x2a180e);plane(tx,.81,tz,1.5,8.2,0xd8d0c0);
    for(let i=0;i<8;i++){const s=i%2?1:-1,z=tz-3.2+Math.floor(i/2)*2.1;const ch=grp(tx+s*1.25,0,z,s>0?-Math.PI/2:Math.PI/2);if(i===5){ch.rotation.z=1.4;ch.position.y=.25;}bx(0,.45,0,.5,.06,.5,0x3a2216,ch);bx(0,.5,-.23,.5,1.2,.06,0x3a2216,ch);for(const a of[-1,1])for(const b of[-1,1])bx(a*.2,0,b*.2,.05,.45,.05,0x2a180e,ch);}
    for(let i=0;i<10;i++){item(tx+(i%2?.45:-.45),.82,tz-3.6+Math.floor(i/2)*1.8,.36,.02,.36,0xd8d4c8);if(R()<.6)item(tx+(i%2?.45:-.45),.84,tz-3.6+Math.floor(i/2)*1.8,.18,.08,.14,pick([0x3a2a1a,0x4a1a1a,0x2a3a1a]),R()*3);}
    for(const z of[-2,2.4]){cyl(tx,.82,z,.06,.12,.5,0x8a7030,null,6);for(const k of[-1,0,1]){cyl(tx+k*.18,1.32,z,.025,.025,.2,0xe8e0c8,null,5);if(night||k)item(tx+k*.18,1.52,z,.03,.06,.03,0xffb050);}}
    zombie(tx+1.6,-3.6,-1.9,'w',null,{cloth:0x3a3a3a,pants:0x2a2a2a});human(tx+2.2,-4.2,.4,null,{dead:true,cloth:0x6a5a48});blood(tx+2.2,-4.4,1.4);
    bx(X0+.5,0,-1,1,2.2,3,0x4a443c);bx(X0+.62,0,-1,.8,1.4,1.8,M(0x050505));bx(X0+.6,2.2,-1,1.3,.2,3.4,0x3a342c);mvFlame(X0+.8,0,-1,.7);
    mvPortrait(X0+.05,3.0,-1,1.2,1.4,Math.PI/2,3);
    backWin(-19,Z0,1.2,2,1.1,false);backWin(-13,Z0,1.2,2,1.1,true);
    bx(-12.2,0,-6.4,2.2,1,.6,0x3a2216);for(let i=0;i<6;i++)item(-13+i*.3,1,-6.4,.1,.25,.1,pick([0x4a1a1a,0x2a3a2a,0xd8d0b8]));
    // descida para o porão
    plane(-12,.03,4.4,2,3.6,M(0x050505));for(let i=0;i<10;i++)item(-12,-.4-i*.36,5.8-i*.36,1.8,.36,.4,0x3a342c);
    sign(['PORÃO'],-12,2.2,Z1-.1,1,.3,Math.PI,{fg:'#c8b890',font:'700 50px Georgia',w:256,h:64});}
  // ================= PORÃO (adega) com porta dos brasões
  {const y=-4+.3;mvFloor(-10,y+.01,0,24,14,RK,2);
    for(let i=0;i<4;i++){const x=-20+i*3.2;bx(x,y,-5.8,2.6,3.2,.8,0x3a2216);for(let r=0;r<5;r++)for(let c=0;c<8;c++)if(R()<.75){const b=cyl(x-1.1+c*.31,y+.3+r*.6,-5.4,.07,.07,.3,pick([0x1a2a1a,0x2a1414,0x1a1a10]),null,6);b.rotation.x=Math.PI/2;}}
    for(let i=0;i<5;i++){const b=cyl(-18+i*2.4,y+.6,2,.55,.55,1.5,0x4a3220,null,10);b.rotation.z=Math.PI/2;}
    bx(.5,y,-1,.4,3.3,4,0x4a443c);bx(.75,y,-1,.12,2.6,1.6,0x2a2a2c);for(let i=0;i<4;i++)bx(.83,y+1.2+(i%2)*.7,-1.6+Math.floor(i/2)*1.2,.04,.4,.34,i<3?0x8a7030:M(0x050505));
    for(let i=0;i<5;i++){cyl(-6+i*.25,y,-6.2,.04,.04,.15+R()*.2,0xe8e0c8,null,5);}for(let i=0;i<5;i++)item(-6+i*.25,y+.3,-6.2,.03,.06,.03,0xffb050);if(LB-->0)pl(-7,y+1.2,-4.8,0xff9a40,1.1,11,true);mvEyes(-21,y+1.1,-5.6,Math.PI/2);mvEyes(-3,y+.5,-6.4,0,0xf2e86a);
    zombie(-14,.5,.8,'r',null,{y,cloth:0x3a3022});for(let i=0;i<6;i++)item(-8+(R()-.5)*5,y,1+(R()-.5)*4,.1,.02,.3,0x2a1a10,R()*3);}
  // ================= GALERIA DOS RETRATOS (2º andar, esquerda)
  {const y=H1+FL;for(let i=0;i<5;i++)mvPortrait(-20.4+i*2.6,y+2.1,Z0+.04,1.3,1.7,0,i===2?3:i%3);mvPortrait(X0+.05,y+2.1,-3,1.3,1.7,Math.PI/2,1);mvPortrait(X0+.05,y+2.1,1,1.3,1.7,Math.PI/2,2);
    plane(-16,y+.03,0,2.4,12,0x5a1010);for(let i=0;i<3;i++){bx(-18.5+i*4,y,-1.5,1.6,.45,.5,0x3a2216);}
    const ar=human(-11,4.2,-Math.PI/2,null,{y,cloth:0x6a6c70,pants:0x6a6c70,skin:0x5a5c60,hat:0x6a6c70});
    for(let i=0;i<6;i++)mvCrow(-20+R()*8,y+3.6,-6.4+R()*.3,R()*6,false);mvCrow(-15,y+2.6,1,1.2,true);mvCrow(-17,y+3,3,2.2,true);
    for(let i=0;i<14;i++)item(-21+R()*10,y,-3+R()*8,.12,.01,.12,0x1a1a1a,R()*3);blood(-16,1,1.2,y);zombie(-14,1.8,2.5,'w',null,{y,cloth:0x4a2a3a,pants:0x2a2a2a});
    if(LB-->0)pl(-16,y+3.4,-2,0x8aa0d8,.9,12);}
  // ================= BIBLIOTECA (térreo, direita) com estante deslizante
  {for(const[x,len]of[[8.4,4],[12.6,3.6]]){bx(x,0,Z0+.35,len,3.9,.5,0x2e1c12);for(let k=0;k<8;k++)for(let i=0;i<len/.14;i++)if(R()<.85)item(x-len/2+.1+i*.14,.1+k*.47,Z0+.52,.11,.3+R()*.1,.26,pick(BOOKS),0,0,R()<.08?.3:0);}
    bx(6.4,0,-2.8,.5,3.9,7,0x2e1c12);for(let k=0;k<8;k++)for(let i=0;i<40;i++)if(R()<.8)item(6.55,.1+k*.47,-6.2+i*.17,.26,.3+R()*.1,.13,pick(BOOKS));
    const bs=grp(14.2,0,-4.6,0);bs.position.z=-2.2;bx(0,0,0,.5,3.9,2.6,0x2e1c12,bs);for(let k=0;k<8;k++)for(let i=0;i<14;i++)if(R()<.8)item(14.05,.1+k*.47,-3.4+i*.17,.26,.3+R()*.1,.13,pick(BOOKS));
    for(let i=0;i<8;i++)item(13.6+R()*.4,0,-4.4-R()*2.6,.06,.005,.6,0x6a5a48,0);
    bx(15,0,-5.3,.2,H1,3.4,0x111111);
    bx(10.5,.72,-1,2,.08,1,0x3a2216);for(const a of[-1,1])for(const b of[-1,1])bx(10.5+a*.9,0,-1+b*.4,.08,.72,.08,0x2a180e);bx(10,.8,-1.1,.12,.5,.12,0x2a3a2a);bx(10,1.3,-1.1,.36,.16,.2,E(0x9adca0));if(LB-->0)pl(10,1.7,-.8,0xc8e8b0,.9,7);
    papers(10.6,.1,8,2);sofa(10.5,1.6,Math.PI,0x4a1a14);const gl=new T.Mesh(new T.SphereGeometry(.38,12,8),M(0x6a5a3a));gl.position.set(8,1.2,2.6);root.add(gl);cyl(8,0,2.6,.08,.1,.85,0x2a180e,null,6);
    for(let i=0;i<20;i++)item(8+R()*6,0,-2+R()*6,.2,.06,.28,pick(BOOKS),R()*3);
    sign(['"O conhecimento','abre caminhos"'],10.5,3.6,Z0+.62,2.4,.5,0,{bg:'#2a1a10',fg:'#c8b080',font:'italic 600 34px Georgia',w:512,h:112});}
  // ================= SALA DE MÚSICA (2º andar, direita) com piano
  {const y=H1+FL,px=10.5,pz=-2.2;const pg=grp(px,y,pz,.25);bx(0,.7,0,1.5,.32,2.2,0x0c0c0e,pg);for(const[a,b]of[[-.6,.9],[.6,.9],[0,-.9]])bx(a,0,b,.12,.7,.12,0x0c0c0e,pg);
    const lid=bx(0,0,0,1.45,.04,2.1,0x0c0c0e,pg);lid.position.set(-.45,1.5,0);lid.rotation.z=.75;mvStick(px+.5,y+1.02,pz,px+.1,y+1.6,pz,.03,0x0c0c0e);
    bx(0,.82,1.18,1.4,.08,.22,0xe8e4d8,pg);for(let i=0;i<9;i++)bx(-.6+i*.15,.9,1.12,.06,.05,.12,0x0c0c0e,pg);bx(0,1.02,1.0,.6,.4,.03,0xd8d0b8,pg);
    bx(0,0,1.75,1,.5,.4,0x2a180e,pg);sign(['♪ partitura ♪'],px,y+1.3,pz+1.25,.7,.25,.25,{bg:'#d8d0b8',fg:'#2a2a2a',font:'600 40px Georgia',w:256,h:96});
    for(let k=0;k<3;k++){cyl(px-.4+k*.2,y+1.02,pz-.6,.03,.03,.25,0xe8e0c8,null,5);item(px-.4+k*.2,y+1.27,pz-.6,.03,.06,.03,0xffb050);}if(LB-->0)pl(px-.2,y+1.8,pz-.4,0xffa850,1.1,9,true);
    const gr=grp(7.4,y,-5.6,0);bx(0,0,0,.6,.9,.6,0x3a2216,gr);cone(0,1.0,.15,.32,.6,0x8a7030,gr,10).rotation.x=-1.2;
    backWin(13,Z0,1.2,2.2,y+1.1,false);plane(10.5,y+.03,0,6,6,0x3a1414);
    human(13.4,1.6,-2.2,null,{y,dead:true,cloth:0x5a2a3a,skin:0xc49a74});blood(13.4,1.6,1,y);
    for(let i=0;i<12;i++)item(8+R()*6,y,-1+R()*6,.22,.01,.3,0xd8d0b8,R()*3);}
  // ================= POÇO DO ELEVADOR OCULTO
  {const ex=17.9,ez=-5;bx(ex,L2,Z0+.1,4.2,H2-L2,.2,0x24282c);bx(X1-.1,L2,ez,.2,H2-L2,4.2,0x24282c);bx(16,L2,-3,.15,H2-L2,.15,0x3a3e42);bx(19.9,L2,-3,.15,H2-L2,.15,0x3a3e42);
    for(let y=L2;y<H2;y+=1.2)item(ex,y,-3,4,.08,.08,0x3a3e42);line([[ex-.3,H2,ez],[ex-.3,L1+3,ez]],0x9a9a9a);line([[ex+.3,H2,ez],[ex+.3,L1+3,ez]],0x9a9a9a);cyl(ex,H2-.4,ez,.5,.5,.3,0x4a4e52,null,12).rotation.x=Math.PI/2;
    const cg=grp(ex,L1,ez,0);bx(0,0,0,3,.15,3,0x4a4e52,cg);bx(0,2.9,0,3,.15,3,0x4a4e52,cg);for(let i=0;i<9;i++){item(ex-1.45+i*.36,L1+.15,ez-1.45,.05,2.75,.05,0x6a6e72);item(ex+1.45,L1+.15,ez-1.45+i*.36,.05,2.75,.05,0x6a6e72);}
    bx(0,1.4,1.4,.25,.35,.08,0x2a2a2a,cg);bx(0,1.5,1.45,.1,.1,.02,E(0x30ff60),cg);
    for(const y of[0,L2]){bx(ex,y,-3,1.4,.1,.6,0x55595e);}
    item(ex,H1+FL,ez,4,.15,4,0x2a2e32);}
  // ================= LABORATÓRIO AURORA — NÍVEL 1
  {const y=L1;mvFloor(-1,y+.01,0,42,14,MT.floorLab,2);mvPanel(-1,y+LH/2,Z0+.01,42,LH,0,MT.tile,.8);mvPanel(X0+.01,y+LH/2,0,14,LH,Math.PI/2,MT.tile,.8);
    bx(-1,y+LH-.15,-6.5,42,.15,1,0xb8bcb8);for(let x=-20;x<16;x+=4){bx(x,y+LH-.12,-2,1.4,.06,.3,E(R()<.75?0xe8f4ff:0x2a2e30));}
    for(const x of[-12,-6,10]){bx(x,y,-3.6,.15,LH,6.8,0xd0d4d0);bx(x,y,3.4,.15,.9,7.2,0xd0d4d0);}
    sign(['LABORATÓRIO AURORA','NÍVEL 1 · ACESSO RESTRITO'],-17,y+2.6,Z0+.05,4.2,1,0,{bg:'#e8ece8',fg:'#1a3a2a',font:'700 40px Arial',w:512,h:128});
    {const lg=cyl(0,0,0,.6,.6,.04,0x1a5a3a,null,6);lg.rotation.x=Math.PI/2;lg.position.set(-20.6,y+2.6,Z0+.06);}
    // corredor: escritórios, freezer de amostras, cientistas
    locker(-21.4,-5.2,4,Math.PI/2,0xb8bcc0);fridge(-14,-6.4,0,0xe8eaea);fridge(-13.1,-6.4,0,0xe8eaea);desk(-18,-4.5,0,true);papers(-17,2,14,4);
    mvScientist(-16.5,-1,1.2,y);mvScientist(-19,2.6,0,y,true);blood(-19,2.6,1.4,y);
    // sala de cirurgia
    {const ox=-9,oz=-1.5;bx(ox,y,oz,1,.85,2.2,0x8a8e92);bx(ox,y+.85,oz,1.1,.12,2.3,0xd8dcd8);human(ox,oz+.9,Math.PI,null,{y:y+.97,dead:true,cloth:0xd8d8d0,skin:0x8d8070});plane(ox,y+1.2,oz,1.2,2.3,0xb8b0a8);blood(ox,oz,1.6,y);
      for(const s of[-1,1])bx(ox+s*.56,y+.75,oz,.04,.2,.4,0x3a2a1a);cyl(ox,y+LH-.9,oz,.5,.35,.25,0xc8ccd0,null,12);bx(ox,y+LH-.95,oz,.6,.02,.6,E(0xf4f8ff));if(LB-->0)pl(ox,y+LH-1.1,oz,0xe8f0ff,1.2,8,true);mvStick(ox,y+LH-.7,oz,ox,y+LH,oz,.05,0x8a8e92);
      bx(ox+1.3,y,oz+.6,.6,.9,.4,0x8a8e92);for(let i=0;i<5;i++)item(ox+1.1+i*.1,y+.9,oz+.6,.03,.01,.22,0xd8dcdf);cyl(ox-1.2,y,oz-.4,.03,.03,2,0x8a8e92,null,6);bx(ox-1.2,y+1.6,oz-.4,.2,.3,.08,M(0xd8f0ff,{transparent:true,opacity:.6}));}
    // tubos de contenção
    mvTube(-3.6,y,-5,{spec:true});mvTube(-.6,y,-5,{broken:true});mvTube(2.4,y,-5,{small:true});mvTube(5.4,y,-5,{spec:false});
    if(LB-->0)pl(-1,y+1.6,-3.6,0x3aff8a,1.6,10);if(LB-->0)pl(-16,y+3,0,0xe8f0ff,1.3,20);if(LB-->0)pl(5,y+3.2,1.5,0xe8f0ff,1.0,18);
    desk(1,1.2,Math.PI,true);desk(4,1.2,Math.PI,true);for(let i=0;i<12;i++)item(3.4+i*.12,y+.79,1.3,.04,.14,.04,pick([0x3aff8a,0xff3a3a,0x3a8aff,0xe8e8e8]));bx(1.4,y+.79,1.4,.18,.36,.18,0x2a2e32);
    sign(['PROJETO','VERDE'],-.6,y+2.9,Z0+.05,1.8,.6,0,{bg:'#1a3a2a',fg:'#9affc0',font:'700 48px Arial',w:256,h:128});
    zombie(-1,-1.6,.4,'r',null,{y,skin:0x7a8a6a,cloth:0xd8d8d0,pants:0x3a3d44});blood(0,-2.6,1.2,y);
    // ducha de descontaminação
    {mvFloor(13,y+.02,-3.2,6,7.6,MT.hazard,1);const GL=mvMat('vidro',()=>new T.MeshStandardMaterial({color:0x9ab0b0,transparent:true,opacity:.22,roughness:.1,metalness:.3,side:T.DoubleSide,depthWrite:false}));
      for(const x of[10.4,15.6]){mvPanel(x,y+1.6,-2.4,4.2,3.2,Math.PI/2,GL,1);bx(x,y,-.3,.1,3.2,.1,0x8a8e92);bx(x,y,-4.5,.1,3.2,.1,0x8a8e92);}
      for(let i=0;i<3;i++)for(const s of[-1,1]){cyl(13+(i-1)*1.4,y+LH-.5,-2.4+s*1.2,.12,.08,.2,0x9a9ea2,null,8);}for(let i=0;i<30;i++)item(13+(R()-.5)*4,y+LH-.9-R()*1.8,-2.4+(R()-.5)*3,.012,.12,.012,0xc8e8ff);
      sign('DESCONTAMINAÇÃO',13,y+3.1,Z0+.05,3.4,.45,0,{bg:'#d8b828',fg:'#111',font:'700 46px Arial',w:512,h:72});
      mvHazmat(12.4,-1.2,2.5,y);}
    // túnel para o mausoléu (sai pela direita)
    {for(let x=21.5;x<34;x+=2.4){for(const s of[-1,1])bx(x,y,-3.5+s*3.2,.25,3,.25,0x5a4a32);bx(x,y+3,-3.5,.3,.25,6.6,0x5a4a32);item(x,y+2.5,-.4,.2,.12,.08,R()<.7?0xffc070:0x3a3a3a);}
      mvFloor(28,y+.01,-3.5,14,6,RK,2);
      sign(['→ MAUSOLÉU'],22.4,y+2.2,-6.6,1.8,.4,0,{bg:'#2a2622',fg:'#c8b890',font:'700 50px Arial',w:256,h:64});zombie(27,-3,-1.6,'w',null,{y,cloth:0x2a2826});mvEyes(33,y+1.4,-4,-Math.PI/2);mvEyes(32.5,y+1.2,-2.4,-Math.PI/2);}}
  // ================= LABORATÓRIO AURORA — NÍVEL 2
  {const y=L2;mvFloor(-1,y+.01,0,42,14,MT.floorLab,2);mvPanel(-1,y+LH/2,Z0+.01,42,LH,0,MT.tile,.8);mvPanel(X0+.01,y+LH/2,0,14,LH,Math.PI/2,MT.tile,.8);
    for(const x of[-6,8]){bx(x,y,-3.6,.15,LH,6.8,0xc8ccc8);bx(x,y,3.4,.15,.9,7.2,0xc8ccc8);}
    sign(['NÍVEL 2 · CONTENÇÃO'],-17,y+2.8,Z0+.05,3.6,.55,0,{bg:'#e8ece8',fg:'#7a1a14',font:'700 44px Arial',w:512,h:80});
    // alarme vermelho girando
    const al=bx(-1,y+LH-.35,-6.6,.3,.3,.3,E(0xff2a1a));if(LB-->0){const L=pl(-1,y+2.6,-3,0xff2a1a,1.8,22);ANIM.push(t=>{L.intensity=1.8*(.35+.65*Math.abs(Math.sin(t*3)));al.visible=Math.sin(t*3)>-.3;});}
    for(let x=-20;x<16;x+=5)bx(x,y+LH-.12,-2,1.4,.06,.3,E(x<-5?0xd8e0e8:0x3a1010));if(LB-->0)pl(-15,y+3,0,0xd0d8e8,1.1,18,true);
    // celas de contenção (a do meio rompida)
    const GL=mvMat('vidroCela',()=>new T.MeshStandardMaterial({color:0xb8d0d8,transparent:true,opacity:.26,roughness:.05,metalness:.3,side:T.DoubleSide,depthWrite:false}));
    for(let i=0;i<3;i++){const cx=-3.6+i*4.6;if(i<2)bx(cx+2.3,y,-4.2,.25,LH,5.6,0xb8bcb8);bx(cx,y,-1.4,4.4,.3,.3,0x8a8e92);if(i!==1)mvPanel(cx,y+1.8,-1.4,4.2,3.3,0,GL,1);else{for(let k=0;k<5;k++)item(cx-1.8+k*.9,y+.3,-1.4,.6,.4+R()*.8,.03,0xb8d0d8,(R()-.5),0,(R()-.5)*.8);for(let k=0;k<40;k++)item(cx+(R()-.5)*5,y,-1+R()*3.6,.06+R()*.14,.015,.05+R()*.12,0xc8e0e8,R()*3);
        for(let k=0;k<18;k++)item(cx+(R()-.5)*3,y,-5.6+R()*1.4,.3+R()*.5,.2+R()*.5,.3+R()*.4,pick([0xb8bcb8,0x8a8e92,0x6a6a66]),R()*3,R(),R());bx(cx,y+.8,Z0+.03,1.6,2,.04,M(0x0a0a0a));for(let k=0;k<4;k++)item(cx-.6+k*.3,y+1.2,-1.38,.04,1.2,.02,0x5a0a08,0,0,.3);blood(cx,-1,1.8,y);blood(cx+1,1.2,1.2,y);}
      bx(cx-1.4,y,-6.2,.9,.4,1.9,0xa8acb0);sign('CELA 0'+(i+1),cx,y+3.1,-1.35,1,.3,0,{bg:'#1a1a1a',fg:i===1?'#ff4a3a':'#e8e8e8',font:'700 50px Arial',w:256,h:72});}
    zombie(-4.4,-3.6,.2,'w',null,{y,cloth:0x9a9a96,pants:0x9a9a96});
    // necrotério e incinerador com zumbis de traje
    for(let r=0;r<3;r++)for(let c=0;c<4;c++)item(-20.6+c*.9,y+.2+r*.9,Z0+.15,.8,.75,.3,0xa8acb0);for(let r=0;r<3;r++)for(let c=0;c<4;c++)item(-20.6+c*.9,y+.5+r*.9,Z0+.31,.2,.08,.04,0x5a5e62);
    for(let i=0;i<4;i++)item(-17+i*1.2,y,-1+(R()-.5)*2,.6,.3,1.9,0x1a1c1a,R()*.5);
    bx(-11,y,-6.4,3,3,1,0x4a4c4e);bx(-11,y+.6,-5.88,1.6,1.4,.04,E(0xff7a2a));if(LB-->0)pl(-11,y+1.4,-5,0xff6a1a,1.4,9,true);
    for(let i=0;i<3;i++){barrel(-8.2,-5.6+i*.9,0xd8b828);}
    mvHazmat(-14,0,.6,y);mvHazmat(-10,1.6,-.5,y);mvHazmat(-17.4,2.4,1.2,y);
    // sala dos servidores
    for(let r=0;r<2;r++)for(let i=0;i<5;i++)mvRack(9.6+i*1.1+(r?0:0),y,-5.6+r*2.4);for(let i=0;i<10;i++)mvStick(9+R()*6,y+.02,-3+R()*3,9+R()*6,y+.02,-3+R()*3,.05,0x1a1a1a);
    desk(12,1.6,Math.PI,true);bx(12,y+.79,1.45,.5,.34,.04,E(0x2a8aff));if(LB-->0)pl(12.5,y+2.4,-3,0x6aa8ff,1.2,10);mvScientist(13.6,1,2.6,y,true);blood(13.6,1,1,y);
    sign(['SERVIDORES','backup: projeto verde'],12,y+3,Z0+.05,3,.6,0,{bg:'#1a1e24',fg:'#6aa8ff',font:'700 36px Arial',w:512,h:100});}
  // ---------------- marcadores
  pin(-2,2.4,4,'cena','Hall principal','Escadaria dupla, lustre torto e tapete vermelho com sangue. Relógio de pêndulo parado às 4h12; máquina de escrever sob a escada para salvar.');
  pin(-2,H1+FL+3.6,-6.2,'quebra','Estátua dos 4 brasões','Lobo, Corvo e Águia estão na parede; a Serpente sai do piano da sala de música. Os 4 brasões na estátua destrancam a porta do porão.');
  pin(-16,2.2,-2,'perigo','Sala de jantar','Lareira acesa sem ninguém por perto. O primeiro zumbi da casa come o mordomo ao lado da mesa posta.');
  pin(-6,-1.2,-1,'loot','Porão e adega','Porta selada pelos brasões. Lá dentro: munição, querosene e a chave do elevador oculto.');
  pin(-16,H1+FL+3.8,-5,'cena','Galeria dos retratos','Retratos da família Valverde. Um teve os olhos arrancados por dentro da tela. Corvos entraram pelo telhado quebrado.');
  pin(10.5,H1+FL+2.4,-2.2,'quebra','Sala de música','Piano com a partitura "Lua Pálida". Tocar a melodia certa abre o fundo falso do armário com o brasão da Serpente, o que falta à estátua.');
  pin(14.2,4.2,-4.6,'loot','Biblioteca e estante deslizante','Empurre a estante marcada no chão: atrás dela está o poço do elevador oculto, que só anda com a chave do porão. O mausoléu é a outra entrada do laboratório. Mapa da mansão e diário do Dr. Valverde.');
  pin(-1,L1+4.4,-4,'perigo','Laboratório Aurora · nível 1','Tubos com espécimes do Projeto Verde, sala de cirurgia e ducha de descontaminação. O laboratório estudava o vírus anos antes do surto; um dos tubos está vazio e quebrado.');
  pin(1,L2+2.2,-3,'perigo','Nível 2 · cela rompida','A Cela 02 foi arrombada de dentro. Zumbis de traje de risco biológico vagam no necrotério. Nos servidores: o backup que prova a origem do surto.');
  flush();
  return {r:70,th:.24,ph:1.36,t:[-1,-4,0]};
}

// ---------------- entradas para SCENES (colar na lista)
// {id:'mansao',g:'Lugares assustadores',n:'Mansão Valverde',tag:'fachada',chip:['R','risco máximo'],d:'A mansão eclética da família Valverde na borda da mata da Serra do Corvo: torre com relógio parado, janelas pregadas, muro de pedra e portão de ferro, jardim formal morto com chafariz seco, cemitério da família com mausoléu, estufa de vidro quebrado, casa da guarda, canil de cães infectados atrás do alambrado com farpado e a SUV preta do Instituto Valverde.',b:buildMansao},
// {id:'mansao-interior',g:'Lugares assustadores',n:'Mansão Valverde · interior',tag:'corte',chip:['D','classe A + D'],d:'Corte da casa e do que existe embaixo dela: hall com escadaria dupla e lustre, sala de jantar, galeria dos retratos, biblioteca com estante deslizante, sala de música com o piano, estátua dos brasões e porão; pelo elevador oculto, os dois níveis do Laboratório Aurora com tubos de contenção, sala de cirurgia, servidores, ducha de descontaminação e uma cela rompida.',b:buildMansaoInterior},
// ---------------- linha para a lista do mapa do mundo (Python)
// dict(t='marco',ic='marco',n='Mansão Valverde',p=(175,195),tam='casa 32 × 15 m, 3 andares + torre de 32 m; parque murado de 110 × 70 m',o='Mansão da família Valverde na borda da mata, a noroeste de Santa Aurora. Jardim morto, cemitério com mausoléu, estufa, canil de cães infectados e alambrado com farpado nos fundos.',j='Classe A + D. Loot raro (chave mestra, ervas, espingarda) e quebra-cabeças (4 brasões, partitura no piano). O mausoléu e o elevador oculto da biblioteca levam ao Laboratório Aurora, onde o vírus era estudado antes do surto.'),

// =====================================================================
// TRILHA DO VÉU e FAZENDA SANTA CLARA (agente trilhas)
// helpers novos: chainlink, chainGate e prefixo tf*
// =====================================================================
const _tq=new T.Quaternion(),_te=new T.Euler();
// viga instanciada de A até B (barata: vai no item()/flush())
function tfBeam(ax,ay,az,bx_,by,bz,t,c,t2){const dx=bx_-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz)||.001;const yaw=Math.atan2(dx,dz),pit=-Math.asin(clamp(dy/L,-1,1));_te.set(pit,yaw,0,'YXZ');_tq.setFromEuler(_te);_te.setFromQuaternion(_tq,'XYZ');const s=t2||t;item((ax+bx_)/2,(ay+by)/2-s/2,(az+bz)/2,t,s,L,c,_te.y,_te.x,_te.z);}
// viga como malha (para pôr dentro de grupos que se mexem)
function tfRod(ax,ay,az,bx_,by,bz,t,c,p){const dx=bx_-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz)||.001;const m=new T.Mesh(ubox(.12),mt(c));m.scale.set(t,t,L);m.position.set((ax+bx_)/2,(ay+by)/2,(az+bz)/2);m.rotation.set(-Math.asin(clamp(dy/L,-1,1)),Math.atan2(dx,dz),0,'YXZ');m.castShadow=true;(p||root).add(m);return m;}
let TF_WIRE=null;
function tfWireMat(){if(TF_WIRE)return TF_WIRE;const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.strokeStyle='rgba(222,228,232,1)';g.lineWidth=4.5;g.beginPath();
  for(let k=-2;k<=2;k++){g.moveTo(k*64,0);g.lineTo(k*64+128,128);g.moveTo(k*64+128,0);g.lineTo(k*64,128);}g.stroke();
  g.fillStyle='rgba(120,70,40,.55)';for(let i=0;i<10;i++){g.fillRect(R()*128,R()*128,4,4);}
  const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;
  TF_WIRE=new T.MeshStandardMaterial({map:t,color:0xa4abb0,metalness:.55,roughness:.45,transparent:true,depthWrite:false,side:T.DoubleSide});return TF_WIRE;}
// tela em losango entre estações [x,y,z] (segue o terreno)
function tfMesh(P,h){const pos=[],uv=[],idx=[];let u=0;for(let i=0;i<P.length;i++){if(i)u+=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);pos.push(P[i][0],P[i][1],P[i][2],P[i][0],P[i][1]+h,P[i][2]);uv.push(u/.5,0,u/.5,h/.5);if(i){const a=(i-1)*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,tfWireMat());m.renderOrder=2;root.add(m);return m;}
// ALAMBRADO: postes galvanizados a cada ~2,5 m, tela de losango semitransparente, travessa no topo,
// 3 fios de arame farpado em braço inclinado quando barbed=true. yf = altura do chão (número ou função (x,z)=>y).
// o.gap=[t0,t1] abre um rombo na tela (fração do lado); o.out=1|-1 lado do braço do farpado.
function chainlink(x0,z0,x1,z1,h,barbed,yf,o){o=o||{};h=h||2;const Y=typeof yf==='function'?yf:(()=>yf||0);
  const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz);if(L<.2)return;const n=Math.max(1,Math.round(L/2.5));const PC=0x8d9498;
  const nx=dz/L*(o.out||1),nz=-dx/L*(o.out||1);const S=[];
  for(let i=0;i<=n;i++){const t=i/n;const x=x0+dx*t,z=z0+dz*t;S.push([x,Y(x,z),z,t]);}
  S.forEach((s,i)=>{const top=h+(barbed?.05:.1);item(s[0],s[1]-.3,s[2],.085,top+.3,.085,PC);if(i===0||i===n){item(s[0],s[1]+top,s[2],.12,.06,.12,0x6a7074);}
    if(barbed){tfBeam(s[0],s[1]+h,s[2],s[0]+nx*.38,s[1]+h+.42,s[2]+nz*.38,.05,PC);}});
  for(let i=0;i<n;i++){const a=S[i],b=S[i+1];tfBeam(a[0],a[1]+h,a[2],b[0],b[1]+h,b[2],.055,0x9aa1a5);tfBeam(a[0],a[1]+.08,a[2],b[0],b[1]+.08,b[2],.02,0x6a7074);
    if(barbed)for(let k=1;k<=3;k++){const f=k/3,ox=nx*.38*f,oy=h+.42*f,oz=nz*.38*f;tfBeam(a[0]+ox,a[1]+oy,a[2]+oz,b[0]+ox,b[1]+oy,b[2]+oz,.022,0x5a5e60);
      const seg=Math.hypot(b[0]-a[0],b[2]-a[2]);for(let u=.25;u<seg;u+=.5){const t=u/seg;item(lerp(a[0],b[0],t)+ox,lerp(a[1],b[1],t)+oy-.04,lerp(a[2],b[2],t)+oz,.09,.09,.02,0x4a4e50,R()*3,.78,0);}}}
  // tela (com rombo opcional)
  const fine=[];const m=Math.max(2,Math.ceil(L/1.2));for(let i=0;i<=m;i++){const t=i/m;const x=x0+dx*t,z=z0+dz*t;fine.push([x,Y(x,z)+.04,z,t]);}
  if(o.gap){const A=fine.filter(p=>p[3]<=o.gap[0]+1e-6),B=fine.filter(p=>p[3]>=o.gap[1]-1e-6);if(A.length>1)tfMesh(A,h-.06);if(B.length>1)tfMesh(B,h-.06);
    // aba arrancada caída no chão
    const tm=(o.gap[0]+o.gap[1])/2,cx=x0+dx*tm,cz=z0+dz*tm;const fl=tfMesh([[cx-dx/L*.9,Y(cx,cz)+.05,cz-dz/L*.9],[cx+dx/L*.9,Y(cx,cz)+.05,cz+dz/L*.9]],1.1);fl.rotation.set(0,0,0);fl.position.set(0,0,0);
    const g=fl.geometry,p=g.attributes.position;for(let i=0;i<p.count;i++){if(i%2){p.setXYZ(i,p.getX(i)+nx*1.0,Y(cx,cz)+.12,p.getZ(i)+nz*1.0);}}p.needsUpdate=true;g.computeVertexNormals();}
  else tfMesh(fine,h-.06);
}
// PORTÃO de alambrado: w largura total (1 ou 2 folhas), open = ângulo de abertura (rad), y0 chão
function chainGate(x,z,ry,w,h,open,y0,two){y0=y0||0;const g=grp(x,y0,z,ry);const PC=0x8d9498;
  for(const s of[-1,1])cyl(s*w/2,0,0,.07,.07,h+.2,M(PC,{metalness:.5,roughness:.5}),g,8);
  const leaves=two?[[-w/2,1],[w/2,-1]]:[[-w/2,1]];const lw=two?w/2-.08:w-.12;
  leaves.forEach(([hx,dir],k)=>{const lf=grp(hx,0,0,(k?-1:1)*open*dir*-1,g);const L=dir*lw;
    const fm=M(0x9aa1a5,{metalness:.5,roughness:.45});
    for(const yy of[.08,h-.05])bx(L/2,yy,0,Math.abs(L),.05,.05,fm,lf);for(const xx of[dir*.05,L-dir*.05])bx(xx,.08,0,.05,h-.1,.05,fm,lf);
    const br=bx(L/2,h/2-.1,0,Math.hypot(L,h)*.92,.04,.04,fm,lf);br.rotation.z=Math.atan2(h-.2,L)*(1);
    const mg=new T.Mesh(new T.PlaneGeometry(Math.abs(L)-.1,h-.15),tfWireMat());mg.position.set(L/2,h/2,0);
    const uv=mg.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(Math.abs(L)/.5),uv.getY(i)*(h/.5));lf.add(mg);
  });
  // corrente e cadeado
  if(!open){bx(0,h*.55,.04,.14,.18,.08,M(0x6a5a30,{metalness:.7,roughness:.4}),g);bx(0,h*.55+.18,.04,.08,.1,.03,0x8a8c8e,g);}
  else{const c=bx(w/2-.05,h*.4,.05,.03,.5,.03,0x6a6c6e,g);c.rotation.z=.2;}
  return g;}

// instâncias leves (caixa simples, sem sombra projetada) para vegetação densa
function tfInst(L){if(!L.length)return;const g=new T.BoxGeometry(1,1,1);const im=new T.InstancedMesh(g,M(0xffffff,{roughness:.95}),L.length);const col=new T.Color();
  L.forEach((a,i)=>{_e.set(a[7]||0,a[8]||0,a[9]||0);_q.setFromEuler(_e);_m.compose(_v.set(a[0],a[1]+a[4]/2,a[2]),_q,_s.set(a[3],a[4],a[5]));im.setMatrixAt(i,_m);im.setColorAt(i,col.set(a[6]));});im.receiveShadow=true;root.add(im);}
// pinheiros instanciados (3 draw calls para a mata inteira); L = [x,y,z,s]
function tfPines(L){if(!L.length)return;const tg=new T.CylinderGeometry(.12,.16,1,6),cg=new T.ConeGeometry(1,1,7);const tr=new T.InstancedMesh(tg,M(0x3a2a1c),L.length),c1=new T.InstancedMesh(cg,M(0xffffff,{flatShading:true}),L.length*2);const col=new T.Color();
  L.forEach(([x,y,z,s],i)=>{const k=pick([0x1f3324,0x24382a,0x1b2d20,0x2a3626,0x263024]);_q.set(0,0,0,1);_m.compose(_v.set(x,y+.5*s,z),_q,_s.set(s,s,s));tr.setMatrixAt(i,_m);
    _q.setFromAxisAngle(_v.set(0,1,0),R()*6);_m.compose(_v.set(x,y+1.9*s,z),_q,_s.set(1.1*s,2.2*s,1.1*s));c1.setMatrixAt(i*2,_m);c1.setColorAt(i*2,col.set(k));
    _m.compose(_v.set(x,y+3.0*s,z),_q,_s.set(.8*s,1.8*s,.8*s));c1.setMatrixAt(i*2+1,_m);c1.setColorAt(i*2+1,col.set(k));});
  for(const m of[tr,c1]){m.castShadow=m.receiveShadow=true;root.add(m);}}
// ---------- terreno com cores por vértice
function tfTerrain(S,N,hf,colf,cx,cz){cx=cx||0;cz=cz||0;const geo=new T.PlaneGeometry(S,S,N,N);geo.rotateX(-Math.PI/2);geo.translate(cx,0,cz);const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,hf(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();const nr=geo.attributes.normal;const col=new Float32Array(p.count*3);const c=new T.Color();
  for(let i=0;i<p.count;i++){colf(c,p.getX(i),p.getY(i),p.getZ(i),nr.getY(i));col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  geo.setAttribute('color',new T.BufferAttribute(col,3));const m=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.96,flatShading:true}));m.receiveShadow=true;m.castShadow=true;m.userData.own=true;root.add(m);return m;}
let TF_ROCK=null;
function tfRock(x,y,z,s,c,sy){if(!TF_ROCK){TF_ROCK=new T.DodecahedronGeometry(1,0);TF_ROCK.userData.keep=true;}const m=new T.Mesh(TF_ROCK,M(c||pick([0x55534e,0x4a4844,0x5e5a52,0x433f3a]),{flatShading:true}));m.position.set(x,y,z);m.scale.set(s*(.8+R()*.5),s*(sy||(.55+R()*.4)),s*(.8+R()*.5));m.rotation.set(R()*3,R()*3,R()*3);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
// árvore morta, devolve pontas de galho [x,y,z]
function tfDeadTree(x,y,z,s,c){s=s||1;c=c||pick([0x2e2a26,0x34302a,0x28251f]);const tips=[];const lx=(R()-.5)*.8*s,lz=(R()-.5)*.8*s;const H=(4.5+R()*2.5)*s;
  tfBeam(x,y-.4,z,x+lx*.5,y+H*.55,z+lz*.5,.34*s,c);tfBeam(x+lx*.5,y+H*.55,z+lz*.5,x+lx,y+H,z+lz,.2*s,c);
  const nb=3+Math.floor(R()*3);for(let i=0;i<nb;i++){const t=.4+R()*.55,hx=x+lx*t,hy=y+H*t,hz=z+lz*t;const a=R()*6.28,len=(1.4+R()*1.8)*s,up=.25+R()*.7;
    const ex=hx+Math.cos(a)*len,ey=hy+len*up,ez=hz+Math.sin(a)*len;tfBeam(hx,hy,hz,ex,ey,ez,.11*s,c);
    const a2=a+(R()-.5)*1.6,l2=len*.6;const fx=ex+Math.cos(a2)*l2,fy=ey+l2*(R()-.2),fz=ez+Math.sin(a2)*l2;tfBeam(ex,ey,ez,fx,fy,fz,.06*s,c);tips.push([ex,ey,ez],[fx,fy,fz]);}
  return tips;}
function tfRibbon(x,y,z,c){const ry=R()*3;item(x,y-.04,z,.09,.08,.09,c,ry);item(x,y-.62,z,.06,.6,.012,c,ry,(R()-.5)*.3,(R()-.5)*.4);item(x+.04,y-.48,z,.05,.46,.012,c,ry+.4,(R()-.5)*.3,.2);}
function tfEyes(x,y,z,ry,c,p){const g=grp(x,y,z,ry,p);for(const s of[-1,1]){const e=bx(s*.055,0,0,.05,.03,.02,E(c||0xff3a2a),g);e.castShadow=false;}return g;}
function tfCrowPerch(x,y,z,ry){ry=ry===undefined?R()*6.28:ry;const fx=Math.sin(ry),fz=Math.cos(ry);const K=0x0c0c0e;item(x,y,z,.13,.13,.3,K,ry);item(x+fx*.17,y+.08,z+fz*.17,.1,.1,.1,K,ry);item(x+fx*.25,y+.1,z+fz*.25,.03,.03,.08,0x2a2622,ry);item(x-fx*.22,y+.02,z-fz*.22,.12,.02,.2,K,ry,.3);}
function tfCrowFlock(cx,cy,cz,rad,n,o){o=o||{};const K=M(0x0c0c0e);const B=[];for(let i=0;i<n;i++){const g=grp(cx,cy,cz,0);if(o.vulture){g.scale.setScalar(2);bx(0,.06,.26,.07,.07,.08,0x8a6a6a,g);}bx(0,0,0,.16,.14,.38,K,g);bx(0,.06,.2,.11,.11,.12,K,g);bx(0,.06,.3,.03,.03,.09,0x2a2622,g);const w=[];for(const s of[-1,1]){const p=grp(s*.07,.08,0,0,g);bx(s*.32,0,0,.62,.02,.24,K,p);w.push([p,s]);}
    B.push([g,w,R()*6.28,rad*(.6+R()*.6),cy+(R()-.5)*8,.25+R()*.25]);}
  ANIM.push(t=>{for(const[g,w,ph,r,y,sp]of B){const a=ph+t*sp;g.position.set(cx+Math.cos(a)*r,y+Math.sin(t*.7+ph)*1.5,cz+Math.sin(a)*r);g.rotation.y=-a;g.rotation.z=.3;const f=Math.sin(t*9+ph)*.6;for(const[p,s]of w)p.rotation.z=s*f;}});}
// urubu pousado (cabeça pelada cinza-avermelhada, asas meio abertas)
function tfVulture(x,y,z,ry){const fx=Math.sin(ry),fz=Math.cos(ry),rx=Math.cos(ry),rz=-Math.sin(ry);const K=0x141210;item(x,y+.3,z,.32,.38,.62,K,ry,-.35);item(x+fx*.32,y+.62,z+fz*.32,.08,.22,.08,0x5a4a46,ry,.3);item(x+fx*.4,y+.72,z+fz*.4,.13,.12,.16,0x8a5a56,ry);item(x+fx*.5,y+.72,z+fz*.5,.04,.05,.09,0xd8d0b8,ry);
  for(const s of[-1,1])item(x+rx*s*.42,y+.5,z+rz*s*.42,.62,.04,.42,K,ry,0,s*.5);for(const s of[-1,1])item(x+rx*s*.08-fx*.05,y,z+rz*s*.08-fz*.05,.05,.3,.05,0x8a8a84,ry);}
// enforcado / pendurado que balança
function tfHanged(x,ytop,z,len,ry,o){o=o||{};const g=grp(x,ytop,z,ry);const cl=o.cloth||pick(CLOTH),sk=o.skin||pick(ZSKIN);
  bx(0,-len,0,.03,len,.03,0x8a7a5a,g);const b=grp(0,-len,0,0,g);bx(0,-.3,.02,.3,.3,.28,sk,b).rotation.z=.5;
  bx(0,-1.05,0,.48,.72,.28,cl,b);for(const s of[-1,1]){bx(s*.31,-1.05,0,.12,.66,.12,cl,b);bx(s*.12,-1.95,0,.18,.9,.2,o.pants||pick(PANTS),b);}
  if(o.zombie)tfEyes(0,-.2,.17,0,0xf2e86a,b);
  const ph=R()*6;ANIM.push(t=>{g.rotation.z=Math.sin(t*.9+ph)*.06;g.rotation.y=ry+Math.sin(t*.4+ph)*.35;});return g;}
function tfLantern(x,y,z,c,i,d,flick){bx(x,y,z,.18,.26,.18,E(c||0xffc070));bx(x,y+.26,z,.22,.04,.22,0x2a2622);if(LB-->0)pl(x,y-.1,z,c||0xffb060,i||1,d||12,flick);}
// fogo baixo sem coluna de fumaça (brasas + chamas curtas + luz trêmula)
function tfFire(x,y,z,s){const C=[];for(let i=0;i<5;i++){const c=cone(x+(R()-.5)*.5*s,y,z+(R()-.5)*.5*s,(.14+R()*.1)*s,(.5+R()*.4)*s,E(i%2?0xffb040:0xff6a1a),null,5);c.castShadow=false;C.push([c,R()*6]);}
  for(let i=0;i<6;i++){const e=bx(x+(R()-.5)*s,y,z+(R()-.5)*s,.14,.06,.14,E(0xc23a12));e.castShadow=false;}
  let L=null;if(LB-->0)L=pl(x,y+.9*s,z,0xff7a2a,1.8*s,12*s);ANIM.push(t=>{for(const[c,p]of C)c.scale.y=.6+Math.abs(Math.sin(t*8+p))*.6;if(L)L.intensity=1.8*s*(.75+Math.sin(t*17)*.15+Math.sin(t*6.3)*.1);});}
function tfCandles(x,y,z,n,s){for(let i=0;i<n;i++){const a=R()*6.28,r=R()*s;const h=.08+R()*.18;const cx=x+Math.cos(a)*r,cz=z+Math.sin(a)*r;bx(cx,y,cz,.05,h,.05,0xe8e0c8);bx(cx,y+h,cz,.025,.05,.025,E(0xffc060)).castShadow=false;}}

// ---------- animais com anatomia (zumbificados quando o.z)
function tfCow(x,z,ry,o){o=o||{};const g=grp(x,o.y||0,z,ry);const zb=o.z;const base=o.c||pick([0xd8d0c4,0x6a4a32,0x2a2622,0xb89a70]);const C=zb?new T.Color(base).lerp(new T.Color(0x6a6e58),.45).getHex():base;
  const eat=o.eat;
  bx(0,.78,-.05,.78,.72,1.55,C,g);bx(0,.72,.62,.74,.78,.5,C,g);bx(0,.76,-.78,.72,.66,.42,C,g);bx(0,.62,0,.66,.2,1.2,C,g);// tronco, peito, garupa, barriga
  bx(0,1.42,-.82,.5,.1,.3,C,g);// ossos do quadril
  const nk=grp(0,1.12,.82,0,g);nk.rotation.x=eat?.95:.15;bx(0,-.2,.18,.36,.42,.5,C,nk);
  const hd=grp(0,-.08,.48,0,nk);hd.rotation.x=eat?.35:.25;bx(0,-.18,.12,.3,.34,.5,C,hd);bx(0,-.26,.42,.26,.22,.16,zb?0x5a3a32:0xc89a8a,hd);
  for(const s of[-1,1]){const e=bx(s*.2,0,0,.18,.06,.1,C,hd);e.rotation.z=s*.4;if(o.horn!==false){const h=cone(s*.13,.12,-.02,.04,.22,0xd8d0b0,hd,5);h.rotation.z=-s*.6;}}
  if(zb){tfEyes(0,-.08,.37,0,0xff3a2a,hd);bx(0,-.38,.4,.18,.04,.1,0x4a0806,hd);}else for(const s of[-1,1])bx(s*.15,-.08,.3,.04,.04,.02,0x0a0a0a,hd);
  for(const[a,b]of[[-1,1],[1,1],[-1,-1],[1,-1]]){const lg=grp(a*.27,.62,b*.62,0,g);lg.rotation.x=(R()-.5)*.15;bx(0,-.34,0,.17,.36,.2,C,lg);bx(0,-.6,0,.12,.3,.13,C,lg);bx(0,-.62,0,.14,.08,.16,0x1a1612,lg);}
  const tl=grp(0,1.3,-.98,0,g);tl.rotation.x=-.25;bx(0,-.7,0,.05,.72,.05,C,tl);bx(0,-.78,0,.1,.2,.1,0x1a1612,tl);
  if(!zb||R()<.5)bx(0,.42,-.45,.3,.16,.26,0xd89a9a,g);// úbere
  if(base===0xd8d0c4)for(let i=0;i<4;i++){const s=R()<.5?-1:1;bx(s*.395,.8+R()*.3,(R()-.5)*1.4,.02,.3+R()*.2,.3+R()*.3,0x1a1816,g);}
  if(zb){// costelas expostas e feridas
    const s=R()<.5?-1:1;bx(s*.392,.65,.15,.02,.5,.7,0x5a0a08,g);for(let k=0;k<5;k++)bx(s*.405,.68,-.1+k*.13,.03,.42,.04,0xd8d0b8,g);
    bx(-s*.39,.9,-.4,.02,.22,.3,0x6a1010,g);bx(0,1.15,.2,.4,.02,.3,0x5a0a08,g);}
  if(o.dead){g.rotation.z=Math.PI/2*(R()<.5?-1:1);g.position.y=(o.y||0)+.4;}
  return g;}
function tfPig(x,z,ry,o){o=o||{};const g=grp(x,o.y||0,z,ry);const zb=o.z;const C=zb?pick([0xa88a7a,0x9a8070,0x8a7a6a]):pick([0xd8a898,0xc89888]);const mud=0x3a2e22;
  bx(0,.32,0,.56,.5,1.0,C,g);bx(0,.36,.42,.52,.46,.26,C,g);bx(0,.3,-.42,.5,.44,.22,C,g);bx(0,.28,0,.58,.22,.9,mud,g).scale.y=.6;
  const hd=grp(0,.55,.58,0,g);hd.rotation.x=o.eat?.7:.1;bx(0,-.2,.08,.38,.34,.32,C,hd);bx(0,-.16,.3,.22,.16,.1,zb?0x7a4a4a:0xe0a0a0,hd);for(const s of[-1,1]){bx(s*.06,-.1,.355,.04,.04,.01,0x2a1a18,hd);const e=bx(s*.14,.1,-.02,.14,.04,.14,C,hd);e.rotation.x=.6;e.rotation.z=s*.3;}
  if(zb){tfEyes(0,-.02,.245,0,0xff3a2a,hd);bx(0,-.33,.28,.2,.06,.08,0x4a0806,hd);bx(.29,.35,-.1,.02,.25,.35,0x5a0a08,g);}else for(const s of[-1,1])bx(s*.1,-.02,.245,.03,.03,.01,0x0a0a0a,hd);
  for(const[a,b]of[[-1,1],[1,1],[-1,-1],[1,-1]]){bx(a*.18,0,b*.36,.11,.22,.12,C,g);bx(a*.18,0,b*.36,.12,.05,.13,0x2a2018,g);}
  const t=bx(0,.5,-.56,.04,.04,.14,C,g);t.rotation.x=-.8;
  if(o.dead){g.rotation.z=Math.PI/2;g.position.y=(o.y||0)+.28;}
  return g;}
function tfDog(x,z,ry,o){o=o||{};const g=grp(x,o.y||0,z,ry);const C=o.c||0x4a3a2c,zb=o.z!==false;
  bx(0,.46,-.05,.3,.3,.62,C,g);bx(0,.44,.28,.34,.36,.26,C,g);bx(0,.5,-.36,.28,.28,.2,C,g);
  const nk=grp(0,.7,.38,0,g);nk.rotation.x=o.lunge?-.3:-.6;bx(0,0,0,.2,.2,.3,C,nk);const hd=grp(0,.06,.26,0,nk);hd.rotation.x=o.lunge?.2:.55;bx(0,-.04,.04,.24,.22,.24,C,hd);bx(0,-.1,.22,.13,.12,.2,C,hd);
  const jw=bx(0,-.19,.2,.12,.04,.18,0x6a2a22,hd);jw.rotation.x=.35;for(const s of[-1,1]){const e=bx(s*.08,.12,-.04,.06,.12,.04,C,hd);e.rotation.z=s*.25;}
  if(zb){tfEyes(0,.02,.165,0,0xff3a2a,hd);bx(.155,.42,0,.02,.18,.3,0x5a0a08,g);for(let k=0;k<4;k++)bx(.165,.42,-.12+k*.08,.02,.16,.025,0xd8d0b8,g);}
  for(const[a,b,f]of[[-1,1,1],[1,1,1],[-1,-1,0],[1,-1,0]]){const lg=grp(a*.11,.4,b*.28,0,g);lg.rotation.x=o.lunge?(f?-.5:.5):0;bx(0,-.2,f?0:-.03,.09,.22,.12,C,lg);bx(0,-.4,f?.02:-.05,.06,.22,.07,C,lg);}
  const t=bx(0,.62,-.5,.05,.05,.32,C,g);t.rotation.x=.9;
  return g;}
function tfChicken(x,z,ry,dead){const fx=Math.sin(ry),fz=Math.cos(ry);if(dead){item(x,0,z,.22,.14,.3,0xe8e0d0,ry,0,1.5);item(x+.1,0,z+.04,.1,.06,.06,0xb83a2a,ry);for(let i=0;i<4;i++)item(x+(R()-.5)*.8,0,z+(R()-.5)*.8,.08,.01,.03,0xe8e0d0,R()*3);return;}
  item(x,.22,z,.2,.2,.3,0xd8cfc0,ry);item(x+fx*.16,.38,z+fz*.16,.1,.13,.1,0xd8cfc0,ry);item(x+fx*.16,.5,z+fz*.16,.03,.05,.08,0xb83a2a,ry);item(x+fx*.22,.42,z+fz*.22,.04,.03,.05,0xd8a030,ry);item(x-fx*.16,.3,z-fz*.16,.04,.16,.12,0x3a2a1c,ry,-.4);
  for(const s of[-1,1])item(x+fz*s*.05,0,z-fx*s*.05,.025,.22,.025,0xd8a030,ry);}

// galinhas vivas e agitadas (aves são imunes): pulam e batem asa, alarme da horda
function tfChickens(cx,cz,r,n){const P=[];for(let i=0;i<n;i++){const g=grp(cx+(R()-.5)*r*2,0,cz+(R()-.5)*r*2,R()*6.28);const W=pick([0xd8cfc0,0xd8cfc0,0x8a5a32,0x2a2622]);
    bx(0,.16,0,.2,.2,.3,W,g);bx(0,.32,.15,.1,.13,.1,W,g);bx(0,.45,.15,.03,.06,.09,0xb83a2a,g);bx(0,.35,.22,.04,.03,.06,0xd8a030,g);const t=bx(0,.24,-.17,.04,.16,.12,W,g);t.rotation.x=-.4;
    const w=[];for(const s of[-1,1]){const p=grp(s*.1,.3,0,0,g);bx(s*.1,0,0,.2,.02,.2,W,p);w.push([p,s]);}for(const s of[-1,1])bx(s*.05,0,0,.025,.17,.025,0xd8a030,g);P.push([g,w,R()*6]);}
  ANIM.push(t=>{for(const[g,w,ph]of P){const k=Math.max(0,Math.sin(t*5+ph));g.position.y=k*k*.35;g.rotation.y+=Math.sin(t*2+ph)*.02;const f=Math.sin(t*22+ph)*.7;for(const[p,s]of w)p.rotation.z=s*(.3+f);}});}
// ---------- construções
function tfCabin(x,y,z,ry){const g=grp(x,y,z,ry);const W=0x4a3424,W2=0x3a281c;
  bx(0,-2.2,0,7.4,2.3,6.4,0x55524c,g);bx(0,0,0,7,2.7,6,W,g);
  for(let k=0;k<9;k++){const yy=.15+k*.3;for(const s of[-1,1]){const lg=bx(0,yy,s*3.03,7.3,.2,.1,k%2?W:W2,g);lg.castShadow=false;const lg2=bx(s*3.53,yy,0,.1,.2,6.3,k%2?W2:W,g);lg2.castShadow=false;}}
  prism(0,2.7,0,8,2.2,7.2,0x2c2a24,g,Math.PI/2);bx(-2.4,2.5,-1.6,.9,3.2,.9,0x5a5650,g);
  bx(0,0,3.05,1,2,.06,0x120d0a,g);const dr=bx(.45,0,3.4,.08,2,.9,0x3a281c,g);dr.rotation.y=.9;
  for(const s of[-1,1])bx(s*2.2,1.1,3.06,.9,.8,.04,s>0?E(0xffb45e):M(0x0c0f12),g);
  bx(0,0,4.2,7,.15,2.2,0x3a2c20,g);for(const s of[-1,1])cyl(s*3.3,0,5.1,.08,.1,2.5,W2,g,6);const rf=bx(0,2.45,4.3,7.6,.12,2.6,0x2c2a24,g);rf.rotation.x=.18;
  // crânio com galhada acima da porta
  bx(0,2.2,3.12,.3,.35,.22,0xd8d0b8,g);for(const s of[-1,1]){const a=bx(s*.3,2.45,3.14,.5,.05,.05,0xc8bca0,g);a.rotation.z=s*.6;bx(s*.5,2.65,3.14,.05,.3,.05,0xc8bca0,g);}
  return g;}
function tfTower(x,y,z,ry){const g=grp(x,y,z,ry);const S=M(0x5a5e60,{metalness:.5,roughness:.6});const H=13;
  for(const a of[-1,1])for(const b of[-1,1]){tfRod(a*2.1,0,b*2.1,a*1.3,H,b*1.3,.18,S,g);}
  for(let k=0;k<4;k++){const y0=k*H/4,y1=(k+1)*H/4,w0=lerp(2.1,1.3,k/4),w1=lerp(2.1,1.3,(k+1)/4);
    for(const[ax,az,bx_,bz]of[[-1,1,1,1],[1,1,1,-1],[1,-1,-1,-1],[-1,-1,-1,1]]){tfRod(ax*w0,y0,az*w0,bx_*w1,y1,bz*w1,.07,S,g);tfRod(bx_*w0,y0,bz*w0,ax*w1,y1,az*w1,.07,S,g);}}
  // escada em zigue-zague
  for(let k=0;k<4;k++){const y0=k*H/4,s=k%2?-1:1;tfRod(2.3,y0,-1.6*s,2.3,y0+H/4,1.6*s,.35,0x4a3a28,g);tfRod(2.75,y0+1,-1.6*s,2.75,y0+H/4+1,1.6*s,.05,0x6a6c6e,g);}
  bx(0,H,0,4.4,.2,4.4,0x4a3a28,g);bx(0,H+.2,0,3.2,1.1,3.2,0x5a4a34,g);
  for(const[s,r]of[[0,0],[1,Math.PI/2],[2,Math.PI],[3,-Math.PI/2]]){const w=bx(Math.sin(r)*1.62,H+1.3,Math.cos(r)*1.62,2.6,.9,.04,M(0x0d1217,{roughness:.2,metalness:.6}),g);w.rotation.y=r;}
  for(const a of[-1,1])for(const b of[-1,1])bx(a*1.55,H+1.3,b*1.55,.12,1,.12,0x5a4a34,g);bx(0,H+2.3,0,3.4,.12,3.4,0x5a4a34,g);const rf=cone(0,H+2.4,0,2.7,1.4,0x2e3a2c,g,4);rf.rotation.y=Math.PI/4;
  for(const a of[-1,1]){bx(a*2.15,H+.2,0,.06,1,4.4,0x4a3a28,g);bx(0,H+.2,a*2.15,4.4,1,.06,0x4a3a28,g);}
  cyl(-1,H+3.6,-1,.03,.03,4,0x8a8c8e,g,4);
  return g;}
function tfPlaneCrash(x,y,z,ry){const g=grp(x,y,z,ry);const Wc=0xd8d4c8,Rc=0x8a2a22;const b=grp(0,1.2,0,0,g);b.rotation.x=.38;b.rotation.z=.22;
  bx(0,0,0,1.2,1.3,4,Wc,b);bx(0,.05,-3.3,.7,.8,2.8,Wc,b);bx(0,-.05,-5,.35,.45,1,Wc,b);bx(0,.1,2.2,1,1,.6,0x9a9a92,b);bx(0,.3,2.55,.5,.5,.2,0x2a2a2a,b);
  for(const s of[-1,1]){const p=bx(s*.4,.3,2.7,.9,.12,.05,0x2a2a2a,b);p.rotation.z=s*.9;p.rotation.x=s*.4;}
  bx(0,.6,.4,1.24,.12,3.2,Rc,b);for(const s of[-1,1])bx(s*.61,.7,.6,.03,.45,1.6,M(0x0d1217,{roughness:.2,metalness:.6}),b);
  bx(-2.6,1.3,.4,4.4,.14,1.5,Wc,b);// asa esquerda inteira (asa alta)
  const st=bx(-1.3,.2,.6,.06,1.2,.06,0x9a9a92,b);st.rotation.z=-1;
  bx(0,.4,-5.4,.08,1.5,.9,Wc,b);bx(0,.3,-5.3,2.6,.08,.8,Wc,b);bx(0,1.4,-5.5,.1,.3,.5,Rc,b);
  sign('PT-KVR',.0,.4,-1.4,1.6,.4,0,{fg:'#2a2a2a',font:'700 70px Arial'},null);
  return g;}
function tfTent(x,y,z,ry,c,o){o=o||{};const g=grp(x,y,z,ry);const p=prism(0,0,0,2.4,o.fallen?.5:1.5,2.6,c,g);if(o.fallen){p.rotation.z=.4;}
  else{const f=bx(.55,0,1.32,.7,1.1,.03,c,g);f.rotation.y=-1.0;f.rotation.z=.15;bx(0,0,1.29,.8,1.2,.02,0x0a0a0a,g);if(o.torn){bx(-.6,.5,0,.03,.6,1.1,0x0a0a0a,g).rotation.z=.55;}}
  return g;}
function tfTruck(x,z,ry,c,o){o=o||{};const g=grp(x,o.y||0,z,ry);const cm=M(c,{roughness:.6,metalness:.3});
  bx(0,.55,1.9,2.3,1.3,2.2,cm,g);bx(0,1.85,1.7,2.2,1.1,1.8,cm,g);bx(0,1.95,2.62,2,.7,.04,M(0x10151b,{roughness:.2,metalness:.6}),g);for(const s of[-1,1])bx(s*1.11,2,1.7,.04,.6,1.1,M(0x10151b,{roughness:.2,metalness:.6}),g);
  bx(0,.55,3.05,2.3,.5,.12,0x2a2a2a,g);bx(0,.9,-1.6,2.4,.15,4.8,0x2a2a2a,g);
  for(const s of[-1,1])bx(s*1.17,1.05,-1.6,.08,1,4.8,o.bed||0x5a4630,g);bx(0,1.05,-3.98,2.4,1,.08,o.bed||0x5a4630,g);
  for(const s of[-1,1])for(const zz of[1.9,-.6,-2.6]){const w=cyl(s*1.05,.48,zz,.48,.48,.32,0x111111,g,10);w.rotation.z=Math.PI/2;w.position.y=.48;}
  for(const s of[-1,1])bx(s*.8,.7,3.12,.3,.2,.04,E(o.lights?0xfff2c0:0x222222),g);
  return g;}
function tfHarvester(x,z,ry){const g=grp(x,0,z,ry);const Gc=M(0x3a6a2a,{roughness:.6,metalness:.3}),Yc=M(0xc8a020,{roughness:.6,metalness:.3});
  bx(0,1,0,3,2.4,5,Gc,g);bx(0,3.4,1.2,2.2,2,2.2,Gc,g);bx(0,3.6,2.32,2,1.4,.04,M(0x10151b,{roughness:.2,metalness:.6}),g);bx(0,3.4,-1.2,2.8,1.4,2.2,Gc,g);
  for(const s of[-1,1]){const w=cyl(s*1.6,.9,1.4,.9,.9,.6,0x111111,g,12);w.rotation.z=Math.PI/2;w.position.y=.9;const r=cyl(s*1.4,.55,-1.8,.55,.55,.45,0x111111,g,10);r.rotation.z=Math.PI/2;r.position.y=.55;}
  bx(0,.3,4,7,.9,1.6,Yc,g);for(let i=0;i<14;i++)bx(-3.3+i*.5,.25,4.85,.06,.3,.3,0x8a8c8e,g);
  const reel=grp(0,1.5,4.2,0,g);for(let k=0;k<5;k++){const b=bx(0,0,0,6.8,.08,.08,0xc8a020,reel);b.position.set(0,Math.cos(k*1.25)*.6,Math.sin(k*1.25)*.6);}ANIM.push(t=>{reel.rotation.x=t*.4;});
  bx(0,.3,4.86,6.6,.2,.04,0x5a0a08,g);
  const au=bx(1.6,3.8,-1.6,.3,.3,4,Yc,g);au.rotation.y=-1.2;au.position.set(3.2,4.4,-1);
  return g;}
// espantalho (zumbi=true: um zumbi amarrado na cruz)
function tfScarecrow(x,z,ry,zb){const g=grp(x,0,z,ry);bx(0,0,0,.14,2.9,.14,0x4a3324,g);bx(0,2.15,-.02,2.1,.12,.12,0x4a3324,g);
  if(zb){const f=figure(0,.06,0,g,{t:'w',y:.55});cone(0,2.75,.06,.42,.42,0x8a7440,g,8);cyl(0,2.68,.06,.55,.55,.04,0x8a7440,g,10);for(const s of[-1,1]){line([[x+Math.cos(ry)*s*.6,2.2,z-Math.sin(ry)*s*.6],[x+Math.cos(ry)*s*.6,1.9,z-Math.sin(ry)*s*.6]],0x8a7a5a);}return g;}
  const sh=pick([0x6a2a22,0x3a4a5a,0x5a4a2a]);bx(0,1.35,0,.5,.8,.26,sh,g);bx(0,2.1,0,2,.2,.2,sh,g);for(const s of[-1,1]){for(let k=0;k<3;k++)item(x+Math.cos(ry)*s*(1.05+k*.04),2.05+k*.03,z-Math.sin(ry)*s*(1.05+k*.04),.04,.3,.04,0xc8b060,ry,0,s*(.4+k*.2));}
  bx(0,2.25,0,.36,.4,.34,0xb8a070,g);bx(0,2.42,.18,.24,.04,.01,0x1a1a1a,g);for(const s of[-1,1])bx(s*.08,2.5,.18,.06,.06,.01,0x0a0a0a,g);
  cone(0,2.7,0,.36,.4,0x7a6440,g,8);cyl(0,2.62,0,.5,.5,.04,0x7a6440,g,10);
  for(const s of[-1,1]){bx(s*.12,.6,0,.18,.75,.2,0x3a3a4a,g);item(x+Math.cos(ry)*s*.12,.45,z-Math.sin(ry)*s*.12,.06,.2,.06,0xc8b060,ry);}
  return g;}

// =====================================================================
// TRILHA DO VÉU (Serra do Corvo)
// =====================================================================
function buildTrilhas(){
  env('grey',120);
  if(HORA==='cena'){scene.background.setHex(0x4a5352);scene.fog.color.setHex(0x4a5352);scene.fog.density=.0038;}
  else if(HORA==='dia'){scene.fog.density*=1.05;}
  const gc=z=>6+Math.sin(z*.025)*8;
  const Bz=z=>12-z*.3;
  const nz=(x,z)=>Math.sin(x*.09+z*.05)*1.4+Math.sin(x*.23-z*.17)*.5+Math.cos(z*.11+x*.03)*.9;
  const ZF=-54;// queda d'água
  const cliff=z=>16*sstep(-49,-57,z);
  const Fz=z=>Bz(z)-28;
  function hf(x,z){const d=Math.abs(x-gc(z));const P=Bz(z)+cliff(z)+nz(x,z);
    const gorge=lerp(Fz(z)+nz(x,z)*.15,P,sstep(7,35,d));const chan=P-3.2*(1-sstep(3,10,d));
    return lerp(chan,gorge,sstep(ZF-1.5,ZF+1,z));}
  const hy=hf;
  // trilhas (polilinhas x,z)
  const G=(o,z)=>[gc(z)+o,z];
  const zb=-8,xa=gc(zb)-36,xb=gc(zb)+36;
  const trE=[G(66,70),G(43,60),G(64,48),G(42,36),G(63,22),G(42,8),[xb+2,zb]];
  const trN=[[xb+2,zb],G(46,-22),G(50,-40),G(52,-47),G(52,-58),G(56,-62)];
  const trV=[G(52,-58),G(32,-62),G(12,-60)];
  const trW=[[xa-2,zb],G(-42,-18),G(-50,-32),G(-47,-46)];
  const trC=[G(-42,-18),G(-52,-12)];
  const trOld=[G(78,72),G(78,38),G(66,4),G(54,-12)];
  const TR=[trE,trN,trV,trW,trC];const near=(x,z,m)=>{for(const P of TR)if(dPoly(x,z,P)<m)return true;return false;};
  tfTerrain(330,190,hf,(c,x,y,z,ny)=>{const d=Math.abs(x-gc(z));
    if(ny<.72)c.setHex(pick([0x4f4c45,0x58544b,0x47443e]));else if(ny<.86)c.setHex(0x41432f);else c.setHex(pick([0x353a28,0x3a3c2a,0x30362a,0x3f3d2c]));
    if(d<8&&z>ZF)c.setHex(0x3a3a34);
    let t=1e9;for(const P of TR)t=Math.min(t,dPoly(x,z,P));if(t<1.9)c.setHex(R()<.5?0x5a4a34:0x544632);else if(dPoly(x,z,trOld)<1.6)c.setHex(0x4a4436);
    if(y>40&&ny>.8)c.offsetHSL(0,-.05,-.02);},0,0);
  // água: poço, rio no fundo do cânion e a queda
  const wm=M(0x2c5458,{roughness:.06,metalness:.35});
  {const pz=ZF+6,px=gc(pz);const m=new T.Mesh(new T.CircleGeometry(11,22).rotateX(-Math.PI/2),wm);m.position.set(px,Fz(pz)+.55,pz);root.add(m);
    const L=210,g=new T.PlaneGeometry(13,L,1,70).rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i)+pz+L/2;p.setX(i,p.getX(i)+gc(z));p.setZ(i,z);p.setY(i,Fz(z)+.5);}g.computeVertexNormals();const rv=new T.Mesh(g,wm);root.add(rv);
    const cv=document.createElement('canvas');cv.width=64;cv.height=256;const c2=cv.getContext('2d');c2.fillStyle='rgba(190,205,210,.45)';c2.fillRect(0,0,64,256);for(let i=0;i<90;i++){c2.fillStyle='rgba(235,244,246,'+(.3+R()*.7)+')';c2.fillRect(R()*64,R()*256,1+R()*3,30+R()*90);}
    const tx=new T.CanvasTexture(cv);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(2,3);
    {const t2=tx.clone();t2.needsUpdate=true;t2.repeat.set(1,24);const rf=new T.Mesh(g,new T.MeshBasicMaterial({map:t2,transparent:true,opacity:.22,depthWrite:false}));rf.position.y=.04;rf.userData.own=true;root.add(rf);ANIM.push(t=>{t2.offset.y=-t*.25;});}
    const top=[gc(ZF-1.6),hf(gc(ZF-1.6),ZF-1.6)+.4,ZF-1.6],bot=[gc(ZF+2.2),Fz(ZF+2.2)+.5,ZF+2.6];const len=Math.hypot(top[1]-bot[1],top[2]-bot[2]);
    for(const[w,op,off]of[[6,.82,.9],[8,.35,1.6]]){const fm=new T.Mesh(new T.PlaneGeometry(w,len),new T.MeshStandardMaterial({map:tx,transparent:true,opacity:op,emissive:0x1c262a,roughness:.3,depthWrite:false,side:T.DoubleSide}));fm.userData.own=true;
      fm.position.set((top[0]+bot[0])/2,(top[1]+bot[1])/2,(top[2]+bot[2])/2+off);fm.rotation.x=-Math.atan2(bot[2]-top[2],top[1]-bot[1]);root.add(fm);}
    ANIM.push(t=>{tx.offset.y=(t*.9)%1;});
    // espuma e névoa
    const mm=M(0xc8d4d8,{transparent:true,opacity:.28,depthWrite:false});const P=[];for(let i=0;i<9;i++){const o=new T.Mesh(new T.DodecahedronGeometry(1.6+R()*1.6,0),mm);o.position.set(bot[0]+(R()-.5)*8,bot[1]+R()*2,bot[2]+R()*6);root.add(o);P.push([o,R()*6]);}
    ANIM.push(t=>{for(const[o,ph]of P){const s=.8+Math.sin(t*1.3+ph)*.25;o.scale.setScalar(s);o.position.y=bot[1]+1+Math.sin(t*.7+ph)*.8;}});
    for(let i=0;i<14;i++)tfRock(bot[0]+(R()-.5)*16,Fz(pz)+.2,bot[2]+R()*12,.8+R()*1.4);
    for(let i=0;i<10;i++){const s=R()<.5?-1:1;tfRock(top[0]+s*(4+R()*3),top[1]-R()*30,top[2]+2+R()*2,1.4+R()*1.5);}
  }
  // árvores: pinheiros no planalto, mortas perto das trilhas
  {const PN=[];for(let i=0;i<520;i++){const x=-150+R()*300,z=-150+R()*290;const d=Math.abs(x-gc(z));if(d<38||near(x,z,3.2)||dPoly(x,z,trOld)<2.4)continue;PN.push([x,hy(x,z)-.25,z,1.4+R()*1.8]);}tfPines(PN);}
  const TIPS=[];
  for(let i=0;i<70;i++){const P=pick(TR),k=Math.floor(R()*(P.length-1)),t=R();const x0=lerp(P[k][0],P[k+1][0],t),z0=lerp(P[k][1],P[k+1][1],t);const a=R()*6.28,r=3.2+R()*6;const x=x0+Math.cos(a)*r,z=z0+Math.sin(a)*r;if(near(x,z,2.6)||Math.abs(x-gc(z))<36)continue;TIPS.push(...tfDeadTree(x,hy(x,z),z,.8+R()*.6));}
  for(let i=0;i<30;i++){const x=-150+R()*300,z=-150+R()*290;if(Math.abs(x-gc(z))<38||near(x,z,3))continue;tfDeadTree(x,hy(x,z),z,1+R()*.5);}
  // corvos pousados nos galhos e um bando circulando sobre o cânion
  for(let i=0;i<26&&TIPS.length;i++){const p=pick(TIPS);tfCrowPerch(p[0],p[1]+.05,p[2]);}
  tfCrowFlock(gc(-20),36,-20,22,9);
  // fitas: rota dos que fugiram (vermelhas) e da busca (amarelas)
  for(const P of TR)for(let k=0;k<P.length-1;k++){const L=Math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1]);for(let u=4;u<L;u+=11){const t=u/L;const x=lerp(P[k][0],P[k+1][0],t),z=lerp(P[k][1],P[k+1][1],t);const dx=(P[k+1][0]-P[k][0])/L,dz=(P[k+1][1]-P[k][1])/L;const s=(Math.floor(u)%2)?1:-1;const sx=x+dz*1.9*s,sz=z-dx*1.9*s;const y=hy(sx,sz);
    tfBeam(sx,y-.3,sz,sx+(R()-.5)*.3,y+2.1,sz+(R()-.5)*.3,.07,0x3a2e22);tfBeam(sx,y+1.8,sz,sx+dz*s*.7,y+2.2,sz-dx*s*.7,.04,0x3a2e22);tfRibbon(sx+dz*s*.55,y+2.12,sz-dx*s*.55,R()<.78?0xb8241c:0xd8b02a);}}
  for(let i=0;i<22&&TIPS.length;i++){const p=pick(TIPS);tfRibbon(p[0],p[1],p[2],R()<.7?0xb8241c:0xd8b02a);}
  // degraus de madeira nas rampas íngremes e corrimão
  const stepPath=(P,rail)=>{for(let k=0;k<P.length-1;k++){const L=Math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1]);const dx=(P[k+1][0]-P[k][0])/L,dz=(P[k+1][1]-P[k][1])/L;const yaw=Math.atan2(dx,dz);let last=null;
    for(let u=0;u<L;u+=.5){const x=P[k][0]+dx*u,z=P[k][1]+dz*u,y=hy(x,z);const y2=hy(x+dx*.5,z+dz*.5);const sl=Math.abs(y2-y)/.5;
      if(sl>.2&&(u%(sl>.6?.5:1)<.01||sl>.6)){item(x,y-.12,z,1.7,.2,.24,pick([0x4a3a28,0x5a4630,0x3e3022]),yaw);item(x-dz*.9,y-.3,z+dx*.9,.08,.45,.08,0x3a2e22);}
      if(rail&&Math.abs(u%2)<.01){const rx=x+dz*1.15,rz=z-dx*1.15,ry_=hy(rx,rz);item(rx,ry_-.2,rz,.1,1.25,.1,0x4a3a28);if(last)tfBeam(last[0],last[1]+1.0,last[2],rx,ry_+1.0,rz,.07,0x5a4630);last=[rx,ry_,rz];}}}};
  stepPath(trE,false);stepPath(trN,true);stepPath(trW,true);stepPath(trV,true);stepPath(trC,false);
  // ===== PONTE PÊNSIL (70 m)
  const ya=hy(xa,zb),yb=hy(xb,zb),sag=4.2;const dk=t=>lerp(ya,yb,t)+.25-sag*4*t*(1-t);const bxp=t=>lerp(xa,xb,t);
  {const N=150,miss=new Set([55,56,92]);for(let i=0;i<=N;i++){const t=i/N;if(miss.has(i))continue;const br=(i===70);item(bxp(t),dk(t)-.06,zb+(br?.3:0),.34,.06,br?1.0:1.55,pick([0x5a4630,0x4a3a28,0x6a5238,0x3e3022]),(R()-.5)*.08,0,br?.25:0);}
    for(const s of[-1,1]){let p=null,q=null;for(let i=0;i<=40;i++){const t=i/40,x=bxp(t);const hr=[x,dk(t)+1.15,zb+s*.85],ft=[x,dk(t)-.08,zb+s*.8];if(p){tfBeam(p[0],p[1],p[2],hr[0],hr[1],hr[2],.05,0x8a7a5a);tfBeam(q[0],q[1],q[2],ft[0],ft[1],ft[2],.06,0x7a6a4a);}
      if(i%2===0&&i>0&&i<40)tfBeam(hr[0],hr[1],hr[2],ft[0],ft[1]+.05,ft[2],.02,0x8a7a5a);if(i%2===1)tfBeam(hr[0],hr[1]-.55,hr[2],x+.8,dk(t)-.05,zb+s*.8,.015,0x6a5a3a);p=hr;q=ft;}}
    for(const[x,y,dir]of[[xa,ya,-1],[xb,yb,1]])for(const s of[-1,1]){bx(x,y-.6,zb+s*.95,.3,2.2,.3,0x3a2e22);bx(x+dir*.3,y-.5,zb+s*1.25,.2,1.4,.2,0x3a2e22);tfBeam(x,y+1.55,zb+s*.95,x+dir*4,y+hy(x+dir*4,zb+s*1.6)-y-.1,zb+s*1.6,.06,0x8a7a5a);item(x+dir*4,hy(x+dir*4,zb+s*1.6)-.3,zb+s*1.6,.18,.6,.18,0x3a2e22);}
    bx(xa,ya+1.5,zb,.2,.2,2.1,0x3a2e22);bx(xb,yb+1.5,zb,.2,.2,2.1,0x3a2e22);
    sign(['PONTE PÊNSIL','MÁX. 3 PESSOAS'],xb+.2,yb+2.3,zb,2.2,.9,Math.PI/2,{bg:'#3a2a1c',fg:'#e8dfcf',font:'700 40px Arial',w:512,h:200});
    sign(['NÃO','ATRAVESSE'],xa-.2,ya+2.3,zb,2,.8,-Math.PI/2,{bg:'rgba(0,0,0,0)',fg:'#9a1a14',font:'700 54px Arial',drip:true,w:512,h:200});
    tfLantern(xb+.3,yb+1.6,zb+1.05,0xffb060,1.1,14,true);
    // zumbi no meio da ponte, outro entrando pelo leste, corpo pendurado embaixo
    zombie(bxp(.53),zb,-Math.PI/2,'w',null,{y:dk(.53)});zombie(bxp(.9),zb+.2,-Math.PI/2+.2,'r',null,{y:dk(.9)});
    tfHanged(bxp(.42),dk(.42)-.1,zb+.6,6,0,{cloth:0x3a4a5a,zombie:true});
  }
  // ===== placas da trilha
  {const sx=xb+5,sz=zb+5,y=hy(sx,sz);bx(sx,y-.3,sz,.16,3,.16,0x3a2e22);
    const o={bg:'#4a3624',fg:'#e8dfcf',font:'700 38px Arial',w:512,h:96};
    sign('◄ CACHOEIRA DO VÉU 1,2 km',sx,y+2.3,sz+.09,2.4,.45,.6,o);sign('GRUTA DO CORVO ►',sx,y+1.8,sz+.09,2.2,.42,-.5,o);sign('▼ VILA DO CORVO 3,4 km',sx,y+1.3,sz+.09,2.3,.42,.1,o);
    tfRibbon(sx,y+2.75,sz,0xb8241c);
    const tx=gc(70)+66,tz=70,ty=hy(tx,tz);bx(tx-1.4,ty-.4,tz,.2,3.2,.2,0x3a2e22);bx(tx+1.4,ty-.4,tz,.2,3.2,.2,0x3a2e22);sign(['TRILHA DO VÉU','Serra do Corvo'],tx,ty+2.2,tz+.12,3,1,0,{bg:'#3a2a1c',fg:'#d8c8a0',font:'700 40px Arial',w:512,h:170});
    sign('ELES ESTÃO NA ÁGUA',gc(-30)+40,hy(gc(-30)+40,-30)+1.4,-30,2.4,.5,-1.2,{fg:'#9a1a14',font:'700 46px Arial',drip:true});}
  // ===== cabana do caçador
  {const P=G(-54,-10),cx=P[0],cz=P[1];let y=-1e9;for(const a of[-3.5,3.5])for(const b of[-3,3])y=Math.max(y,hy(cx+a,cz+b));const cab=tfCabin(cx,y,cz,1.25);
    if(LB-->0)pl(cx+3.2,y+1.6,cz+1.6,0xffa050,1.3,14,true);
    // varal de peles e carcaça de veado pendurada
    const gx=cx+6,gz=cz+5,gy=hy(gx,gz);tfBeam(gx-1.4,gy-.2,gz,gx-1.4,gy+2.8,gz,.14,0x3a2e22);tfBeam(gx+1.4,gy-.2,gz,gx+1.4,gy+2.8,gz,.14,0x3a2e22);tfBeam(gx-1.6,gy+2.75,gz,gx+1.6,gy+2.75,gz,.12,0x3a2e22);
    const dg=grp(gx,gy+2.7,gz,0);bx(0,-.6,0,.02,.6,.02,0x8a7a5a,dg);bx(0,-1.9,0,.42,1.3,.36,0x7a2a1e,dg);for(let k=0;k<5;k++)bx(0,-1.4-k*.2,.17,.4,.04,.03,0xd8d0b8,dg);bx(0,-2.4,.05,.2,.4,.3,0x6a4a32,dg);ANIM.push(t=>{dg.rotation.y=Math.sin(t*.5)*.4;});
    for(let k=0;k<3;k++){const st=[cx-5+k*1.2,cz+6];const sy=hy(st[0],st[1]);tfBeam(st[0],sy-.3,st[1],st[0],sy+1.6,st[1],.06,0x3a2e22);item(st[0],sy+1.55,st[1],.24,.26,.32,0xd8d0b8,R()*3);}
    zombie(cx+4,cz-4,2.2,'w',null,{y:hy(cx+4,cz-4),hat:0x5a4a2a,cloth:0x4a5a3a});blood(cx+3,cz+2,1.2,hy(cx+3,cz+2));blood(cx+4.5,cz+1.4,.8,hy(cx+4.5,cz+1.4));}
  // ===== torre da polícia florestal com alambrado
  {const P=G(58,-72),tx=P[0],tz=P[1];const ty=hy(tx,tz);const tw=tfTower(tx,ty,tz,.2);
    const S=8;const C=[[tx-S,tz-S],[tx+S,tz-S],[tx+S,tz+S],[tx-S,tz+S]];
    chainlink(C[0][0],C[0][1],C[1][0],C[1][1],2.2,true,hy,{out:-1});chainlink(C[1][0],C[1][1],C[2][0],C[2][1],2.2,true,hy,{out:-1});
    chainlink(C[3][0],C[3][1],C[0][0],C[0][1],2.2,true,hy,{out:-1});
    chainlink(C[2][0],C[2][1],tx+1.8,tz+S,2.2,true,hy,{out:-1});chainlink(tx-1.8,tz+S,C[3][0],C[3][1],2.2,true,hy,{out:-1,gap:[.35,.7]});
    chainGate(tx,tz+S,0,3.6,2.2,1.1,hy(tx,tz+S),true);
    sign(['POLÍCIA FLORESTAL','POSTO 3 · ÁREA RESTRITA'],tx+4,hy(tx+4,tz+S)+1.3,tz+S+.08,2.8,.9,0,{bg:'#2e4a2e',fg:'#e8dfcf',font:'700 36px Arial',w:512,h:170});
    bx(tx+1.3,ty+15.6,tz+1.3,.18,.18,.18,E(0xfff0c0));if(LB-->0)pl(tx+1.4,ty+15.3,tz+1.5,0xffe8b0,1.6,26,true);
    zombie(tx+2,tz+S+3,Math.PI,'w',null,{y:hy(tx+2,tz+S+3),cloth:0x4f5638,hat:0x4f5638});human(tx-.4,tz+.6,0,null,{y:ty+13.2,dead:true,cloth:0x4f5638});
    blood(tx,tz+S+1,1.6,hy(tx,tz+S+1));}
  // ===== desabamento na trilha antiga
  {const P=G(78,34);const rx=P[0],rz=P[1];for(let i=0;i<34;i++){const a=R()*6.28,r=R()*7;const x=rx+Math.cos(a)*r,z=rz+Math.sin(a)*r*.7;tfRock(x,hy(x,z)+R()*1.2,z,.7+R()*1.4*(1-r/9));}
    for(let i=0;i<60;i++){const x=rx+(R()-.5)*20,z=rz+(R()-.5)*14;item(x,hy(x,z)-.05,z,.3+R()*.4,.2+R()*.3,.3+R()*.4,0x55524c,R()*3,R(),R());}
    for(let i=0;i<4;i++){const x=rx+4+R()*4,z=rz-8-R()*6;tfBeam(x,hy(x,z),z,x+(R()-.5)*6,hy(x,z)+.3,z+(R()-.5)*6,.35,0x3a2a1c);}
    sign(['TRILHA ANTIGA','INTERDITADA'],rx-3,hy(rx-3,rz+9)+1.2,rz+9,2,.8,-.3,{bg:'#c8a020',fg:'#1a1a1a',font:'700 44px Arial',w:512,h:200});
    const lx=rx-1.5,lz=rz+5.5;item(lx,hy(lx,lz),lz,.18,.18,.7,0x2a2d33,.3);item(lx+.3,hy(lx,lz),lz+.1,.18,.18,.7,0x2a2d33,.5);item(lx-.4,hy(lx,lz)+.3,lz-.5,.5,.6,.35,0xa04a1a,.4);blood(lx,lz+.6,1,hy(lx,lz));}
  // ===== Gruta do Corvo (boca escura na escarpa oeste)
  {const cx=gc(-50)-46,cz=-50.2;const y0=hy(cx,cz+1.5);const dm=new T.Mesh(new T.CircleGeometry(4.2,16,0,Math.PI),new T.MeshBasicMaterial({color:0x020203}));dm.userData.own=true;dm.position.set(cx,y0-.4,cz+1.4);dm.rotation.x=-.42;dm.scale.set(1.25,1,1);root.add(dm);
    for(let i=0;i<16;i++){const a=i/15*Math.PI;tfRock(cx+Math.cos(a)*5.6,y0-.4+Math.sin(a)*4.6,cz+1+Math.sin(a)*-.4,1.1+R()*.9);}
    for(let i=0;i<6;i++){const st=cone(cx-3+i*1.2,y0+2.2-R()*.6,cz+1.9,.22,.9,0x4a4740,null,5);st.rotation.x=Math.PI;}
    for(const[ex,ey]of[[-1.4,1.0],[.9,1.4],[2.2,.7],[-.2,2.1]])tfEyes(cx+ex,y0+ey,cz+1.2,0,ey>1.2?0xf2e86a:0xff3a2a);
    for(let i=0;i<20;i++)item(cx+(R()-.5)*7,hy(cx,cz+4)-.05,cz+3+R()*4,.05,.05,.35,0xd8d0b8,R()*3);item(cx+1,hy(cx,cz+4),cz+4,.25,.22,.25,0xd8d0b8);
    sign('GRUTA DO CORVO',cx+6.5,hy(cx+6.5,cz+5)+1.1,cz+5,2.4,.5,-.3,{bg:'#3a2a1c',fg:'#d8c8a0',font:'700 44px Arial'});bx(cx+6.5,hy(cx+6.5,cz+5)-.3,cz+4.95,.12,1.3,.12,0x3a2e22);
    // morcegos
    const BT=[];for(let i=0;i<12;i++){const g=grp(cx,y0+3,cz+3,0);for(const s of[-1,1]){const w=bx(s*.13,0,0,.24,.02,.14,0x0a0a0a,g);w.rotation.z=s*.4;}bx(0,-.03,0,.07,.07,.12,0x0a0a0a,g);BT.push([g,R()*6,2+R()*5]);}
    ANIM.push(t=>{for(const[g,ph,r]of BT){const a=t*1.6+ph;g.position.set(cx+Math.cos(a)*r,y0+3+Math.sin(a*2.3)*1.5,cz+5+Math.sin(a)*r*.6);g.rotation.y=-a;}});}
  // ===== avião caído na mata oeste
  {const P=G(-47,18),px=P[0],pz=P[1],py=hy(px,pz);tfPlaneCrash(px,py-.6,pz,2.4);
    const wx=px+7,wz=pz+5;const wg=grp(wx,hy(wx,wz)+.2,wz,.8);bx(0,0,0,4.2,.14,1.5,0xd8d4c8,wg).rotation.z=.25;
    for(let i=0;i<5;i++){const x=px-4+R()*10,z=pz-10+R()*8;tfBeam(x,hy(x,z)+.3,z,x+(R()-.5)*8,hy(x,z)+.4,z+(R()-.5)*8,.4,0x3a2a1c);item(x,hy(x,z)-.2,z,.5,1.1,.5,0x5a4a32);}
    for(let i=0;i<8;i++){const x=px+(R()-.5)*10,z=pz+(R()-.5)*10;item(x,hy(x,z)-.02,z,.5,.32,.7,pick([0x6a2a22,0x2a3a4a,0x3a3a3a]),R()*3);}
    zombie(px+2.5,pz+3,2,'w',null,{y:hy(px+2.5,pz+3),cloth:0xd8d4c8});}
  // ===== acampamento que deu errado (início da trilha)
  {const P=G(68,62),cx=P[0],cz=P[1],cy=hy(cx,cz);
    tfTent(cx-4,hy(cx-4,cz-2)-.05,cz-2,.3,0xa04a1a,{torn:true});tfTent(cx+3,hy(cx+3,cz-3)-.05,cz-3,-.4,0x2a5a6a,{fallen:true});tfTent(cx+.5,hy(cx+.5,cz+4)-.05,cz+4,2.9,0x4f5638,{torn:true});
    for(let i=0;i<9;i++){const a=i/9*6.28;item(cx+Math.cos(a)*.7,cy-.05,cz+Math.sin(a)*.7,.25,.2,.25,0x55524c,a);}
    tfFire(cx,cy,cz,.8);
    for(let i=0;i<5;i++){const x=cx+(R()-.5)*8,z=cz+(R()-.5)*8;item(x,hy(x,z)-.02,z,.4,.5,.3,pick([0xa04a1a,0x3a4a2a,0x2a3a5a]),R()*3,(R()-.5)*.6);}
    item(cx-2,hy(cx-2,cz+1)-.02,cz+1,.8,.18,2,0x2a4a6a,.8);for(let k=0;k<6;k++)blood(cx-2-k*1.4,cz+1.8+k*.9,.6,hy(cx-2-k*1.4,cz+1.8+k*.9));
    human(cx+2,cz+1.5,1,null,{y:hy(cx+2,cz+1.5),dead:true,cloth:0xa04a1a});blood(cx+2,cz+1.5,1.6,hy(cx+2,cz+1.5));
    zombie(cx+2.8,cz+.4,-.6,'w',null,{y:hy(cx+2.8,cz+.4)});zombie(cx+1.2,cz+2.8,2.6,'r',null,{y:hy(cx+1.2,cz+2.8)});
    const tr=G(74,56);tfHanged(tr[0],hy(tr[0],tr[1])+4.4,tr[1],1.2,.6,{cloth:0x2a5a6a,zombie:true});tfBeam(tr[0],hy(tr[0],tr[1])-.3,tr[1]-.5,tr[0],hy(tr[0],tr[1])+5,tr[1]-.5,.3,0x2e2a26);tfBeam(tr[0]-1.6,hy(tr[0],tr[1])+4.5,tr[1]-.5,tr[0]+1.4,hy(tr[0],tr[1])+4.7,tr[1]-.3,.13,0x2e2a26);
    tfLantern(cx-4.2,cy+1.9,cz+.2,0xffc070,.8,9,false);}
  // zumbis no cânion (andando na água) e na mata
  for(let i=0;i<7;i++){const z=-30+R()*80,x=gc(z)+(R()-.5)*7;zombie(x,z,R()*6.28,'w',null,{y:Fz(z)-.35});}
  for(let i=0;i<6;i++){const P=pick([trE,trW,trN]);const k=Math.floor(R()*(P.length-1));const x=lerp(P[k][0],P[k+1][0],.5)+(R()-.5)*14,z=lerp(P[k][1],P[k+1][1],.5)+(R()-.5)*14;if(Math.abs(x-gc(z))<37)continue;zombie(x,z,R()*6.28,R()<.8?'w':'r',null,{y:hy(x,z)});}
  // olhos na mata
  for(let i=0;i<14;i++){const x=-120+R()*240,z=-90+R()*170;if(Math.abs(x-gc(z))<38)continue;tfEyes(x,hy(x,z)+1.5+R()*.3,z,R()*6.28,R()<.7?0xff3a2a:0xf2e86a);}
  // talismãs de ossos pendurados (alguém marca território)
  for(let i=0;i<10&&TIPS.length;i++){const p=pick(TIPS);tfBeam(p[0],p[1],p[2],p[0],p[1]-.9,p[2],.02,0x8a7a5a);item(p[0],p[1]-1.3,p[2],.2,.4,.06,0xd8d0b8,R()*3);item(p[0],p[1]-1.55,p[2],.3,.05,.05,0xd8d0b8,R()*3);item(p[0],p[1]-1.0,p[2],.12,.12,.12,0x9a1a14);}
  const MX=xa+36;
  pin(bxp(.5),dk(.5)+2.8,zb,'perigo','Ponte pênsil do Véu','70 m de corda e tábua a 28 m do rio. Aguenta 3 pessoas: a quarta parte as tábuas. Faltam três tábuas no meio, e tem um zumbi parado bem ali.');
  pin(xb,yb+2.6,zb+1,'quebra','Cordas da ponte','Cortar as cordas derruba quem estiver nela, zumbi ou jogador. Do outro lado não há outra travessia por 2 km.');
  pin(gc(ZF),hy(gc(ZF-2),ZF-2)+2,ZF,'local','Cachoeira do Véu','Queda de 40 m. O barulho da água abafa o seu: raio de ruído cai pela metade perto do poço. Atrás da água há um nicho seco.');
  pin(G(42,36)[0],hy(G(42,36)[0],36)+3,36,'cena','Fitas nos galhos','Fitas vermelhas amarradas pelos que fugiram da Vila do Corvo marcam a rota até a gruta. As amarelas são da equipe de busca, que não voltou.');
  pin(G(-54,-10)[0],hy(G(-54,-10)[0],-10)+5,-10,'loot','Cabana do caçador','Rifle .22, armadilhas, carne seca e mapa da serra. O lampião continua aceso. O caçador está do lado de fora.');
  pin(G(58,-72)[0],hy(G(58,-72)[0],-72)+17,-72,'loot','Torre da polícia florestal','Rádio, binóculo e sinalizador. Alambrado com arame farpado, portão aberto e um rombo cortado na tela.');
  pin(G(78,34)[0],hy(G(78,34)[0],34)+5,34,'quebra','Desabamento','Bloqueia o atalho antigo. Dinamite da Mina São Jorge reabre o caminho; tiro perto da encosta solta mais pedra.');
  pin(gc(-50)-46,hy(gc(-50)-46,-48)+5,-50,'perigo','Gruta do Corvo','Escuridão total e olhos lá dentro. Lanterna e pilha viram recurso. Atravessa a serra por baixo.');
  pin(G(68,62)[0],hy(G(68,62)[0],62)+3,62,'cena','Acampamento','Barracas rasgadas e um saco de dormir arrastado para o mato. A fogueira ainda queima.');
  pin(G(-47,18)[0],hy(G(-47,18)[0],18)+4,18,'loot','Avião caído','Monomotor PT-KVR. Kit de primeiros socorros, sinalizador e combustível de aviação. O piloto ainda está por perto.');
  flush();
  const th=.3;return {r:232,th,ph:1.08,t:[MX+2,0,14]};
}

// =====================================================================
// FAZENDA SANTA CLARA (a oeste de Campo Largo)
// =====================================================================
function buildFazendaSantaClara(){
  env('grey',90);
  if(HORA==='cena'){scene.background.setHex(0x51544d);scene.fog.color.setHex(0x51544d);scene.fog.density=.0056;}
  else if(HORA==='dia'){scene.fog.density*=1.1;scene.background.setHex(0x8a8c88);scene.fog.color.setHex(0x8a8c88);}
  const hf=(x,z)=>Math.sin(x*.035)*Math.cos(z*.03)*.5+Math.max(0,(-z-55))*.12;
  tfTerrain(360,90,(x,z)=>hf(x,z)-.05,(c,x,y,z,ny)=>{c.setHex(R()<.5?0x3e3c2a:0x44402c);if(R()<.15)c.setHex(0x4a4430);},0,0);
  // terreiro de terra batida e estradinha
  plane(-6,.02,-8,70,46,0x4a4232);plane(70,.03,2,60,8,0x3e3a2e);plane(-6,.025,-6,6,40,0x524838);
  for(let i=0;i<40;i++)item(30+R()*60,.02,-1+R()*6,.6+R()*1.4,.03,.2,0x2e2a22,R()*.3);
  // ===== casa sede com varanda
  {const g=grp(-28,0,-14,0);const Wc=0xb8ae98;bx(0,0,0,15,.5,10,0x5a5650,g);bx(0,.5,0,14,3.4,9,Wc,g);bx(0,.5,4.52,14,.9,.04,0x5a4a3a,g);
    const rf=prism(0,3.9,0,15.4,3.4,10.4,0x5e3226,g,0);rf.rotation.y=0;bx(4,3.9,-2.5,1,3.4,1,0x6a6660,g);
    bx(3,4.6,4.6,2.2,1.4,.3,0x241410,g);// buraco no telhado
    bx(0,.5,7,14.4,.18,4.6,0x4a3a2a,g);for(let i=0;i<7;i++)cyl(-6.9+i*2.3,.68,9.1,.09,.11,2.9,0x5a4630,g,6);
    const pr=bx(0,3.55,6.9,15,.14,5,0x4a2e24,g);pr.rotation.x=.2;
    for(let i=0;i<34;i++){if(i>14&&i<19)continue;item(-28-7+i*.42,1.0,-14+9.15,.06,.75,.06,0x5a4630);}item(-28-3.5,1.7,-14+9.15,7,.08,.1,0x5a4630);item(-28+4.4,1.7,-14+9.15,5.2,.08,.1,0x5a4630);
    for(let k=0;k<3;k++)bx(0,k*.18,9.6+k*.32,2.2,.18,.4,0x4a3a2a,g);
    bx(0,.5,4.53,1.2,2.3,.05,0x0a0806,g);const dr=bx(-.55,.5,5.0,.06,2.3,1.1,0x4a3020,g);dr.rotation.y=.4;
    for(const s of[-4.6,-2.6,2.6,4.6]){const lit=s===4.6;bx(s,1.6,4.53,1.1,1.4,.04,lit?E(0xffb45e):M(0x0c0f12),g);for(const k of[-1,1]){const sh=bx(s+k*.75,1.6,4.6+(s===-2.6&&k>0?.3:0),.4,1.5,.05,0x2e4a3a,g);if(s===-2.6&&k>0)sh.rotation.y=.9;}if(!lit&&s!==-2.6)for(let k=0;k<3;k++){const p=bx(s,1.75+k*.4,4.62,1.4,.14,.05,0x6b4a2a,g);p.rotation.z=(R()-.5)*.4;}}
    for(const s of[-1,1])for(const zz of[-2.5,1.5])bx(s*7.02,1.6,zz,.04,1.4,1.1,M(0x0c0f12),g);
    sign('DEUS NOS PROTEJA',0,3.1,4.56,4.4,.6,0,{fg:'#8a1a14',font:'700 52px Arial',drip:true},g);
    // cadeira de balanço com a avó e mensageiro de ossos
    const rc=grp(-4,.68,7.6,.4,g);bx(0,.4,0,.6,.08,.6,0x3a281c,rc);bx(0,.4,-.28,.6,.8,.06,0x3a281c,rc);for(const s of[-1,1]){const r=bx(s*.3,0,0,.05,.05,.9,0x3a281c,rc);r.rotation.x=.1;}
    figure(0,.05,0,rc,{t:'w',y:-.4,cloth:0x3a3a4a,skin:0x9a9a84}).rotation.x=-.2;
    for(let k=0;k<5;k++){bx(4-k*.12,2.6-k*.03,8.6,.02,.6,.02,0x8a7a5a,g);bx(4-k*.12,2.2-k*.05,8.6,.06,.2,.04,0xd8d0b8,g);}
    // lampião na varanda (único quente) e luz piscando dentro
    bx(1.6,2.6,8.4,.2,.3,.2,E(0xffc070),g);if(LB-->0)pl(-26.4,2.4,-5.6,0xffb060,1.3,14,false);if(LB-->0)pl(-23.4,1.8,-10,0xffa050,1.1,10,true);
    // varal com lençóis manchados
    for(const xx of[-9,-1])cyl(xx,0,-1+0,.05,.05,2.2,0x5a4630,g,5);line([[-28-9,2.1,-15],[-28-1,2.1,-15]],0x8a8a7a);
    for(let k=0;k<4;k++){const sh=new T.Mesh(new T.PlaneGeometry(1.4,1.2),M(k===2?0x8a3a2e:0xc8c0a8,{side:T.DoubleSide}));sh.position.set(-28-8+k*2,1.5,-15);root.add(sh);const ph=R()*6;ANIM.push(t=>{sh.rotation.x=Math.sin(t*1.2+ph)*.18;});}
    zombie(-27,-3,.3,'w',null,{cloth:0x5a4a3a});}
  // ===== celeiro com carcaças e jirau aberto
  {const cx=12,cz=-24;const g=grp(cx,0,cz,0);const Rd=0x6a2a22,Rd2=0x5a2420;
    bx(-5,0,7.95,4,7,.2,Rd,g);bx(5,0,7.95,4,7,.2,Rd,g);bx(0,4.6,7.95,6,2.4,.2,Rd,g);bx(0,0,-8,14,7,.2,Rd,g);for(const s of[-1,1])bx(s*6.9,0,0,.2,7,16,Rd2,g);
    // telhado de quebra (gambrel)
    for(const s of[-1,1]){const a=bx(s*5.1,7.6,0,4.2,.18,16.6,0x3a3a3c,g);a.rotation.z=-s*1.05;const b=bx(s*2.1,9.7,0,4.4,.18,16.6,0x3a3a3c,g);b.rotation.z=-s*.38;}
    for(const zz of[8.05,-8.1]){const tri=prism(0,7,zz,13.8,3.6,.2,Rd,g);}
    bx(0,7.2,8.12,2.2,2,.04,0x0a0806,g);// jirau aberto
    const hb=bx(0,9.4,9.4,.25,.25,3,0x4a3a28,g);
    bx(0,0,7.9,5.8,4.6,.04,0x0a0806,g);// vão escuro
    for(const s of[-1,1]){const d=grp(s*3,0,8.05,s*(s<0?-1.1:.7),g);bx(-s*1.5,0,.1,3,4.5,.12,Rd,d);for(const k of[-1,1]){const x=bx(-s*1.5,2.25,.18,3.2,.14,.04,0xd8d0c0,d);x.rotation.z=k*.98;}bx(-s*1.5,0,.18,3,.14,.04,0xd8d0c0,d);bx(-s*1.5,4.36,.18,3,.14,.04,0xd8d0c0,d);}
    for(const s of[-1,1])bx(s*4.2,0,7.98,.14,7,.06,0xd8d0c0,g);
    sign('VOLTEM',0,6,8.1,3,.8,0,{fg:'#d8d0c0',font:'700 70px Arial',drip:true},g);
    // corda do guincho com carcaça balançando
    const hg=grp(cx,9.3,cz+10.6,0);bx(0,-3.1,0,.03,3.1,.03,0x8a7a5a,hg);bx(0,-4.8,0,.5,1.7,.36,0x8a3a2a,hg);for(let k=0;k<6;k++)bx(0,-4.3-k*.22,.17,.46,.05,.04,0xd8d0b8,hg);bx(0,-5.1,.1,.3,.5,.3,0x6a1a14,hg);ANIM.push(t=>{hg.rotation.z=Math.sin(t*.8)*.08;hg.rotation.y=Math.sin(t*.3)*.5;});
    // carcaças penduradas lá dentro
    bx(0,4.3,3,13,.25,.25,0x3a2a1c,g);for(let k=0;k<4;k++){const x=-4.5+k*3;bx(x,3.3,3,.03,1,.03,0x6a6c6e,g);bx(x,1.6,3,.55,1.7,.4,pick([0x8a3a2a,0x9a4a3a,0x7a2a22]),g);for(let j=0;j<5;j++)bx(x,2.0-j*.25,3.21,.5,.05,.03,0xd8d0b8,g);bx(x,1.3,3.2,.4,.4,.03,0x4a0806,g);}
    for(let i=0;i<14;i++){const b=cyl(-5+R()*10,0,-3-R()*4,.55,.55,1.1,0xb8a060,g,10);b.rotation.z=Math.PI/2;b.position.y=.55+(i>9?1.1:0);}
    bx(0,.02,3,6,.02,2,0x3a0806,g);
    if(LB-->0){bx(cx,4,cz+5.5,.15,.2,.15,E(0xfff0c0));pl(cx,3.6,cz+5.5,0xffe0a0,1.6,16,true);}
    // fardos de feno no jirau e lá fora
    for(let i=0;i<5;i++)bx(-.8+i*.4,7.25,7.6,.4,.4,.6,0xb8a060,g);
    for(let i=0;i<8;i++){const b=cyl(cx+8+R()*4,0,cz+2+R()*8,.6,.6,1.2,0xb09a58,null,10);b.rotation.z=Math.PI/2;b.position.y=.6;}}
  silo(26,-34,3,13);silo(32,-30,2.6,10);
  // ===== chiqueiro com alambrado e farpado
  {const x0=30,x1=46,z0=-2,z1=12;plane((x0+x1)/2,.04,(z0+z1)/2,15.6,13.6,M(0x2a2018,{roughness:.25,metalness:.15}));
    chainlink(x0,z0,x1,z0,2,true,0);chainlink(x1,z0,x1,z1,2,true,0);chainlink(x1,z1,x0+6.2,z1,2,true,0);chainlink(x0+3.8,z1,x0,z1,2,true,0);chainlink(x0,z1,x0,z0,2,true,0,{gap:[.35,.6]});
    chainGate(x0+5,z1,0,2.4,2,0,0);
    bx(x1-3,0,z0+3,5,1.6,5,0x4a3a2a);const rf=bx(x1-3,1.7,z0+3,5.6,.12,5.6,0x5a5a56);rf.rotation.x=.12;
    bx(x0+3,0,z0+1.2,4,.4,.6,0x6a6c6e);
    human(x0+7,z0+6,1,null,{dead:true,cloth:0x3a4a5a});blood(x0+7,z0+6,2.2);
    tfPig(x0+6,z0+5,.8,{z:true,eat:true});tfPig(x0+8.2,z0+6.8,-2.2,{z:true,eat:true});tfPig(x0+7.6,z0+4.5,-.5,{z:true,eat:true});tfPig(x0+11,z0+9,2.5,{z:true});tfPig(x0+3,z0+9,.4,{z:true});tfPig(x0+12,z0+2,0,{dead:true});
    tfPig(x0-1.5,z0+6,-1.4,{z:true});// fugiu pelo rombo
    sign('CHIQUEIRO',x0+5,2.4,z1+.08,2,.45,0,{bg:'#3a2a1c',fg:'#d8c8a0',font:'700 48px Arial'});}
  // ===== curral do gado com alambrado
  {const x0=2,x1=26,z0=14,z1=32;plane((x0+x1)/2,.035,(z0+z1)/2,23.6,17.6,0x3a3022);
    chainlink(x0,z0,x0+10,z0,2.2,true,0);chainlink(x0+13,z0,x1,z0,2.2,true,0);chainlink(x1,z0,x1,z1,2.2,true,0,{gap:[.55,.75]});chainlink(x1,z1,x0,z1,2.2,true,0);chainlink(x0,z1,x0,z0,2.2,true,0);
    chainGate(x0+11.5,z0,0,3,2.2,.9,0,false);
    // gado morto pela mordida (não levanta): carcaças com urubus
    const CW=[[x0+9,z0+9,0,0xd8d0c4],[x0+5,z0+5,1.1,0x6a4a32],[x0+15,z0+11,-2.4,0x2a2622],[x0+19,z0+5,.7,0xb89a70],[x0+6,z0+14,2.2,0xd8d0c4],[x1+2.2,z0+12,1.4,0xb89a70]];
    for(const[x,z,r,c]of CW){tfCow(x,z,r,{dead:true,c});blood(x,z,2+R());const s=R()<.5?-1:1;bx(x,.95,z,.9,.04,.7,0x5a0a08);for(let k=0;k<4;k++)item(x-.3+k*.2,.9,z,.04,.25,.5,0xd8d0b8);
      for(let k=0;k<2+Math.floor(R()*2);k++)tfVulture(x+(R()-.5)*1.8,R()<.5?1.0:0,z+(R()-.5)*1.8,R()*6.28);}
    tfCrowFlock(14,22,23,14,8,{vulture:true});
    bx(x0+20,0,z0+3,4,.6,1,0x6a6c6e);for(let i=0;i<4;i++){const b=cyl(x0+17+i*1.3,0,z0+1.5,.5,.5,1,0xb09a58,null,10);b.rotation.z=Math.PI/2;b.position.y=.5;}}
  // ===== milharal (labirinto) com espantalhos
  {const X0=-82,X1=-16,Z0=8,Z1=66,cs=6;const nx=Math.floor((X1-X0)/cs),nzz=Math.floor((Z1-Z0)/cs);const vis=new Set(),open=new Set();
    const key=(i,j)=>i+','+j;const st=[[Math.floor(nx/2),0]];vis.add(key(st[0][0],0));
    while(st.length){const[i,j]=st[st.length-1];const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[i+a,j+b]).filter(([a,b])=>a>=0&&b>=0&&a<nx&&b<nzz&&!vis.has(key(a,b)));if(!nb.length){st.pop();continue;}const n=nb[Math.floor(R()*nb.length)];vis.add(key(n[0],n[1]));open.add([key(i,j),key(n[0],n[1])].sort().join('|'));st.push(n);}
    const W=new Uint8Array((X1-X0)*(Z1-Z0));const mark=(x,z)=>{const a=Math.floor(x-X0),b=Math.floor(z-Z0);if(a>=0&&b>=0&&a<X1-X0&&b<Z1-Z0)W[b*(X1-X0)+a]=1;};
    const cc=(i,j)=>[X0+cs*(i+.5),Z0+cs*(j+.5)];
    for(const o of open){const[p,q]=o.split('|').map(s=>s.split(',').map(Number));const A=cc(p[0],p[1]),B=cc(q[0],q[1]);for(let t=0;t<=1;t+=.05)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)mark(lerp(A[0],B[0],t)+a*.9,lerp(A[1],B[1],t)+b*.9);}
    {const A=cc(Math.floor(nx/2),0);for(let z=Z0-1;z<A[1];z+=.5)for(let a=-1;a<=1;a++)mark(A[0]+a*.9,z);}
    plane((X0+X1)/2,.03,(Z0+Z1)/2,X1-X0,Z1-Z0,0x2e2a1c);const CN=[];
    for(let x=X0+.4;x<X1;x+=.95)for(let z=Z0+.4;z<Z1;z+=.95){const px=x+(R()-.5)*.3,pz=z+(R()-.5)*.3;const a=Math.floor(px-X0),b=Math.floor(pz-Z0);if(W[b*(X1-X0)+a])continue;const h=2.2+R()*.9;const lean=(R()-.5)*.12;const C=pick([0x6a6438,0x5e5a32,0x726a3c,0x58542e,0x4a4a2a]);
      CN.push([px,0,pz,.07,h,.07,C,lean,0,lean],[px,h*.45,pz,.9,.03,.12,C,0,R()*3,(R()-.5)*.6],[px,h*.7,pz,.75,.03,.1,C,0,R()*3,(R()-.5)*.6]);if(R()<.5)CN.push([px+.06,h*.55,pz,.09,.28,.09,0xa89048,.2,0,.3]);}
    tfInst(CN);
    // espantalhos: um é zumbi
    const C1=cc(2,3),C2=cc(7,6),C3=cc(5,1);tfScarecrow(C1[0],C1[1],.3,false);tfScarecrow(C2[0],C2[1],-.6,false);tfScarecrow(C3[0],C3[1],.1,true);
    for(const c of[C1,C2])for(const s of[-1,1])tfCrowPerch(c[0]+s*.8,2.3,c[1],R()*6.28);
    tfEyes(C3[0],2.0,C3[1]+.3,.1,0xf2e86a);
    for(let i=0;i<10;i++){const x=X0+2+R()*(X1-X0-4),z=Z0+2+R()*(Z1-Z0-4);tfEyes(x,1.3+R()*.4,z,R()*6.28,0xff3a2a);}
    const E1=cc(4,2),E2=cc(3,5);zombie(E1[0],E1[1],1,'w',null,{cloth:0x5a4a2a});zombie(E2[0],E2[1],2,'r',null,{cloth:0x3a4a5a});
    sign('MILHARAL',(X0+X1)/2+3,1.2,Z0-1.2,2,.45,0,{bg:'#3a2a1c',fg:'#d8c8a0',font:'700 48px Arial'});}
  // ===== cata-vento e caixa d'água
  {const wx=-6,wz=-44,H=13;const S=0x6a6c6e;for(const a of[-1,1])for(const b of[-1,1])tfBeam(wx+a*1.8,-.2,wz+b*1.8,wx+a*.35,H,wz+b*.35,.12,S);
    for(let k=0;k<4;k++){const y0=k*H/4+.5,w=lerp(1.8,.35,(k*H/4+.5)/H),y1=(k+1)*H/4,w1=lerp(1.8,.35,y1/H);for(const[a,b,c,d]of[[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]]){tfBeam(wx+a*w,y0,wz+b*w,wx+c*w1,y1,wz+d*w1,.05,S);tfBeam(wx+a*w,y0,wz+b*w,wx+c*w,y0,wz+d*w,.05,S);}}
    for(let k=0;k<26;k++)item(wx+.42,k*.5,wz,.4,.04,.04,S);
    const rt=grp(wx,H+.4,wz+.9,0);cyl(0,-.2,0,.25,.25,.5,0x4a4c4e,rt).rotation.x=Math.PI/2;
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const b=bx(0,0,0,.36,1.9,.03,M(0x8a8c88,{metalness:.5,roughness:.5}),rt);b.position.set(Math.cos(a)*1.45,Math.sin(a)*1.45,0);b.rotation.z=a-Math.PI/2;b.rotation.y=.35;}
    for(const r of[.6,2.3]){const ring=new T.Mesh(new T.TorusGeometry(r,.03,4,24),M(0x6a6c6e));rt.add(ring);}
    if(!reduce)ANIM.push(t=>{rt.rotation.z=t*.9+Math.sin(t*.5)*.3;});
    bx(wx,H+.25,wz-1.4,.08,.08,2.8,S);bx(wx,H,wz-2.9,.04,1.2,1.4,0x8a8c88);
    // caixa d'água sobre estacas
    const tx=wx+6,tz=wz+1;for(const a of[-1,1])for(const b of[-1,1])bx(tx+a*1.4,0,tz+b*1.4,.25,5,.25,0x4a3a28);bx(tx,5,tz,3.6,.2,3.6,0x4a3a28);cyl(tx,5.2,tz,1.8,1.8,3,M(0x8a8c88,{metalness:.5,roughness:.55}),null,16);cone(tx,8.2,tz,1.9,.6,0x6a6c6e,null,16);
    for(let k=0;k<6;k++)bx(tx+1.5,6+k*.4,tz+.6,.08,.3,.05,0x4a0806);tfBeam(tx-1,5,tz,wx+.4,.3,wz,.08,0x3a3a3a);tfBeam(tx+1.8,7.4,tz,tx+1.8,0,tz+.5,.04,0x8a7a5a);}
  // ===== poço
  {const px=-10,pz=4;cyl(px,0,pz,1.1,1.15,.9,0x6a665e,null,12);const m=new T.Mesh(new T.CircleGeometry(.9,12).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x020203}));m.position.set(px,.91,pz);m.userData.own=true;root.add(m);
    for(const a of[-1,1])bx(px+a*1,.9,pz,.14,1.6,.14,0x4a3324);prism(px,2.5,pz,2.6,.9,1.6,0x5a3a2a,null,Math.PI/2);bx(px,2.2,pz,2.2,.1,.1,0x3a2a1c);
    line([[px,2.2,pz],[px+.3,1.2,pz+.4]],0x8a7a5a);bx(px+.6,.9,pz+.5,.3,.3,.3,0x5a4a3a);
    tfEyes(px+.2,.35,pz,.4,0xf2e86a);tfEyes(px-.3,.3,pz+.3,2,0xff3a2a);
    for(let k=0;k<5;k++)blood(px+1.4+k*1.0,pz+.4+k*.5,.5);bx(px+.9,.5,pz+.6,.08,.4,.2,0x4a0806);}
  // ===== galinheiro com tela
  {const cx=-48,cz=-28;bx(cx,0,cz,4,.6,3,0x3a2a1c);bx(cx,.6,cz,4,1.8,3,0x8a7a5a);prism(cx,2.4,cz,4.4,1,3.4,0x4a3a2a,null,Math.PI/2);bx(cx,.6,cz+1.52,.6,.6,.04,0x0a0806);
    chainlink(cx-2,cz+1.5,cx-2,cz+7,1.6,false,0);chainlink(cx-2,cz+7,cx+4,cz+7,1.6,false,0);chainlink(cx+4,cz+7,cx+4,cz+1.5,1.6,false,0,{gap:[.3,.7]});
    for(let i=0;i<3;i++)tfChicken(cx-1+R()*4.5,cz+2+R()*4.5,R()*6,true);tfChickens(cx+1,cz+4.2,2.4,14);for(let i=0;i<40;i++)item(cx-3+R()*9,0,cz+R()*10,.07,.01,.03,0xe8e0d0,R()*3);
    tfChicken(cx+5.5,cz+5,2,false);tfChicken(cx+6.4,cz+3.4,1,false);
    tfDog(cx+5.6,cz+9,3.3,{c:0x6a5a46,lunge:true});}
  // ===== trator e colheitadeira
  tractor(24,-14,1.9);tfHarvester(36,-26,-.6);
  // ===== canil com cão zumbi acorrentado
  {const kx=-14,kz=-6;bx(kx,0,kz,1.4,1.0,1.6,0x6a5a46);prism(kx,1.0,kz,1.6,.7,1.8,0x4a2e24);bx(kx,0,kz+.81,.6,.7,.03,0x0a0806);sign('REX',kx,1.2,kz+.83,.6,.25,0,{bg:'#4a3020',fg:'#e8dfcf',font:'700 70px Arial'});
    tfDog(kx+1.8,kz+2.2,.6,{lunge:true,c:0x3a2e22});line([[kx+.7,.3,kz+.6],[kx+2,.55,kz+2.5]],0x8a8c8e);for(let i=0;i<10;i++)item(kx+.5+R()*2.6,0,kz+1+R()*2.6,.05,.05,.3,0xd8d0b8,R()*3);
    bx(kx+.9,0,kz+1.3,.3,.12,.3,0x7a2a1e);}
  // ===== capela da família, cruz com velas e túmulos
  {const cx=-58,cz=-46;const g=grp(cx,0,cz,.3);bx(0,0,0,4.6,.4,6.6,0x5a5650,g);bx(0,.4,0,4,3.4,6,0xd0c8b8,g);prism(0,3.8,0,4.6,2,6.6,0x5e3226,g,0);
    bx(0,.4,3.02,1.1,2.2,.04,0x0a0806,g);bx(0,3.8,3.2,.9,1.4,.4,0xd0c8b8,g);bx(0,5.8,3.1,.1,1,.1,0x3a2a1c,g);bx(0,6.3,3.1,.6,.1,.1,0x3a2a1c,g);cyl(0,4.2,3.3,.18,.25,.35,M(0x6a5a30,{metalness:.6}),g,8);
    for(const s of[-1,1])bx(s*2.02,1.6,0,.04,1.2,.6,E(0x6a3a1a),g);
    tfCandles(cx+.8,0.4,cz+1,8,.6);if(LB-->0)pl(cx+.6,1.4,cz+1.5,0xffa040,.9,9,true);
    const kx=cx+6,kz=cz+6;bx(kx,0,kz,.25,3.2,.25,0x3a2a1c);bx(kx,2.2,kz,1.6,.22,.22,0x3a2a1c);tfCandles(kx,0,kz+.5,14,.9);item(kx,2.6,kz,.06,.5,.06,0xb8241c,0,0,.3);
    for(let i=0;i<4;i++){const gx=kx-3+i*2,gz=kz+4;if(i===2){plane(gx,.03,gz,1.2,2.2,0x1a1410);bx(gx+1,0,gz,.8,.4,1.6,0x4a4032);item(gx+.9,.4,gz-.6,.06,1,.06,0x6a6c6e,0,.5);}else bx(gx,0,gz,1,.3,2,0x4a4032);
      bx(gx,0,gz-1.2,.12,1.1,.08,0x5a4630);bx(gx,.75,gz-1.2,.6,.1,.08,0x5a4630);if(i!==2)tfCandles(gx,.3,gz,2,.3);}
    sign(['AQUI JAZ A FAMÍLIA','SANTA CLARA'],kx,.9,kz+7.4,2.2,.6,0,{bg:'#2a2622',fg:'#d8d0c0',font:'700 34px Arial',w:512,h:140});
    tfHanged(cx-4.5,5.2,cz+4,1.4,1,{cloth:0xd8d0c0,zombie:false});tfBeam(cx-4.5,-.3,cz+3.4,cx-4.6,6.2,cz+3.4,.35,0x2e2a26);tfBeam(cx-6.5,5.3,cz+3.4,cx-2.6,5.5,cz+3.6,.15,0x2e2a26);}
  // ===== barricada de caminhões na entrada (onde a família resistiu)
  {tfTruck(50,-5,1.75,0x8a6a2a,{bed:0x6a5a3a});tfTruck(51.5,3.8,1.25,0x3a4a5a,{lights:true});tfTruck(55,12,2.5,0x6a2a22);
    car(48,13,.2,0x8a8478);sandbags(48,0,3,'z',3);sign('VOLTEM',51.5,2.4,3.8+1.35,2,.6,1.25,{fg:'#c8241a',font:'700 70px Arial',drip:true});
    // porteira e arco
    for(const s of[-1,1])bx(44,0,1+s*4.6,.35,4.6,.35,0x3a2a1c);bx(44,4.4,1,.3,.3,9.6,0x3a2a1c);sign('FAZENDA SANTA CLARA',44.2,3.8,1,6.4,.9,Math.PI/2,{bg:'#3a2a1c',fg:'#d8c8a0',font:'700 48px Arial',w:1024,h:150});
    const pt=grp(44,0,-3.6,.9);for(let k=0;k<4;k++)bx(0,.3+k*.35,1.9,.08,.12,3.8,0x5a4630,pt);
    tfBeam(44,4.3,-2,44,1.6,-2,.03,0x8a7a5a);// corda vazia no arco
    for(let i=0;i<9;i++)zombie(54+R()*14,-8+R()*24,R()*6,'w',null,{dead:true});for(let i=0;i<8;i++)blood(52+R()*12,-6+R()*20,1+R());casings(48,6,80,8);
    human(47.6,5,1.6,null,{dead:true,cloth:0x5a4a3a,hat:0x8a7a5a});
    for(const z of[-12,-4,4,12])for(let k=0;k<6;k++)item(58,.1+k*.002,z,.03,.03,8,0x5a5e60);
    horde(14,72,96,-8,12,-Math.PI/2);
    for(let i=0;i<4;i++)poleWood(64+i*14,-5,i===1);}
  // ===== pira de corpos queimados
  {const bx0=-6,bz0=36;for(let i=0;i<34;i++){const a=R()*6.28,r=R()*2.6;item(bx0+Math.cos(a)*r,R()*1.2*(1-r/3),bz0+Math.sin(a)*r,.5,.3,1.6,pick([0x1a1714,0x2a2420,0x14110e]),R()*3,(R()-.5)*.6);}
    for(let i=0;i<6;i++)item(bx0+(R()-.5)*3,.6+R()*.5,bz0+(R()-.5)*3,.3,.08,.3,0xd8d0b8,R()*3);
    for(let i=0;i<10;i++){const e=bx(bx0+(R()-.5)*4,.1+R()*.6,bz0+(R()-.5)*4,.15,.08,.15,E(0xff5a1a));e.castShadow=false;}
    tfFire(bx0,.5,bz0,1.3);
    for(let i=0;i<6;i++){const t=cyl(bx0+3.6+(i%3)*.2,i*.18,bz0+2,.4,.4,.2,0x111111,null,10);t.rotation.x=Math.PI/2;}
    bx(bx0-3.5,0,bz0+1,.5,.9,.5,0x9b1c18);}
  // ===== bando de corvos sobre o celeiro, corvos pousados
  tfCrowFlock(12,18,-22,12,10);for(let i=0;i<10;i++)tfCrowPerch(6+R()*12,10.1,-30+R()*14);
  for(let i=0;i<6;i++)tfCrowPerch(4+R()*20,2.25,14.1+(R()<.5?0:18));
  // árvores mortas e eucaliptos no fundo
  for(let i=0;i<26;i++){const a=R()*6.28,r=90+R()*60;tfDeadTree(Math.cos(a)*r,0,Math.sin(a)*r*.8,1.3+R()*.6);}
  for(let i=0;i<12;i++){const x=-80+R()*150,z=-70-R()*30;tfDeadTree(x,hf(x,z),z,1.4+R()*.5);}
  for(const[x,z]of[[-40,-4],[-14,-30],[-66,-18],[30,22]])tfDeadTree(x,0,z,1.2);
  {const PN=[];for(let i=0;i<60;i++){const x=-130+R()*260,z=-110-R()*40;PN.push([x,hf(x,z)-.2,z,2+R()*1.6]);}tfPines(PN);}
  zombie(-36,-2,.8,'w',null,{cloth:0x6a5a3a,hat:0x8a7440});zombie(-2,-12,2,'r');zombie(8,4,-2.6,'w',null,{cloth:0x2e4a6a});
  // olhos no escuro perto da casa
  for(const[x,z]of[[-44,-22],[-40,4],[-60,-8],[18,-10],[60,-20]])tfEyes(x,1.55,z,R()*6.28,0xff3a2a);
  pin(-28,5.8,-6,'cena','Casa sede','A avó na cadeira de balanço ainda se mexe. Lampião aceso, janelas pregadas e DEUS NOS PROTEJA na parede.');
  pin(12,11.5,-14,'loot','Celeiro','Foice, machado, querosene e fardos. Carcaças penduradas lá dentro e no guincho do jirau. O jirau aberto é a melhor vista da fazenda.');
  pin(38,3.4,5,'perigo','Chiqueiro','Porcos zumbis comendo o caseiro. O alambrado tem farpado, mas há um rombo no lado oeste: um já escapou.');
  pin(14,3.6,23,'cena','Curral dos urubus','O gado morreu das mordidas e não levantou: boi não vira. Os urubus denunciam o lugar de longe. A tela leste está rompida.');
  pin(-49,4,37,'perigo','Milharal','Labirinto de milho de 3 m de altura. Visão de 2 m e olhos entre os pés de milho. Um dos três espantalhos é um zumbi.');
  pin(-6,15,-43,'loot','Cata-vento e caixa d\'água','Água limpa e bomba que funciona sem energia. O rangido da hélice cobre seus passos.');
  pin(52,4,4,'cena','Barricada dos caminhões','Onde a família resistiu: caminhões atravessados, cápsulas e corpos. VOLTEM pintado na lataria.');
  pin(-47,2.4,-24,'cena','Galinheiro','Aves são imunes. As galinhas agitadas cacarejam quando a horda se aproxima: alarme de graça para a base.');
  pin(-52,6.4,-41,'cena','Capela da família','Velas acesas por alguém. Quatro túmulos; um foi aberto por dentro.');
  flush();
  const th=.55,ox=4;return {r:150,th,ph:.95,t:[-8+ox*Math.cos(th),0,2-ox*Math.sin(th)]};
}

/* ===== entradas para SCENES (colar no array):
  {id:'trilhas',g:'Lugares assustadores',n:'Trilha do Véu',tag:'serra',chip:['R','risco médio'],d:'Trilha de terra na Serra do Corvo, da Vila do Corvo até a Gruta do Corvo, em zigue-zague pela encosta com degraus e corrimão. Passa pela Cachoeira do Véu (40 m), cruza o cânion na ponte pênsil de 70 m e sobe a escarpa até a torre da polícia florestal. Fitas vermelhas nos galhos marcam a rota de quem fugiu da vila. No caminho: a cabana do caçador, um desabamento na trilha antiga, um avião caído e um acampamento destruído.',b:buildTrilhas},
  {id:'fazenda-santa-clara',g:'Lugares assustadores',n:'Fazenda Santa Clara',tag:'fazenda',chip:['R','risco alto'],d:'Fazenda infestada a oeste de Campo Largo. Casa sede com varanda, celeiro com carcaças penduradas e o jirau aberto, chiqueiro com porcos zumbis e curral com o gado morto e urubus, ambos cercados de alambrado com arame farpado. Milharal em labirinto com três espantalhos (um é zumbi), cata-vento, poço, galinheiro, canil, capela da família com túmulos e a barricada de caminhões onde a família resistiu.',b:buildFazendaSantaClara},
*/
/* ===== linhas Python para a lista do mundo:
dict(t='marco',ic='marco',n='Fazenda Santa Clara',p=(35,590),tam='300 × 200 m',o='Fazenda infestada a oeste de Campo Largo: casa sede, celeiro com carcaças, chiqueiro e curral (gado morto, urubus) com alambrado farpado, milharal em labirinto, cata-vento, poço, capela e túmulos da família.',j='Loot rural (ferramentas, querosene, água do cata-vento). Porcos zumbis no chiqueiro e gado morto com urubus no curral; galinhas vivas servem de alarme; um espantalho é zumbi; a barricada de caminhões na entrada é a defesa pronta para uma base.'),
dict(t='marco',ic='trilha',n='Trilha do Véu',p=(200,138),tam='3,4 km',o='Trilha da Vila do Corvo (260,100) pela Cachoeira do Véu (200,138) e a ponte pênsil (212,162) até a Gruta do Corvo (130,95), com degraus, corrimão, cabana do caçador, torre florestal, desabamento e avião caído.',j='Rota a pé pela serra. Fitas vermelhas mostram a rota dos que fugiram. A ponte pênsil aguenta 3 pessoas e cortar as cordas derruba quem estiver nela; perto da cachoeira o barulho da água abafa o seu.'),
*/

const SCENES=[
  {id:'mundo',g:'Mundo',n:'Vale Cinzento',tag:'32 × 32 km',chip:['R','1.024 km²'],d:'O mundo inteiro em relevo, com exagero vertical: serra ao norte cortada por três túneis, os rios Turvo e Claro com afluentes, a represa, a Lagoa Escura e o brejo, cinco cidades, base e penitenciária. As pontes estão onde estrada ou trilho cruzam rio. A linha tracejada é a ferrovia (tronco e dois ramais), por onde as hordas migram.',b:()=>{buildWorld();return {r:330,th:.35,ph:.82,t:[0,0,10]};}},
  {id:'vale-vivo',g:'Mundo',n:'Vale vivo',tag:'mapa vivo',chip:['R','eventos'],d:'Um trecho de campo no fim da tarde mostrando o que se move no mapa: a horda migratória andando pela rodovia, a revoada que avisa 150 m antes, a carcaça de vaca com urubus e zumbis chegando, o alambrado do pasto, quero-queros, uma matilha infectada, a caravana de sobreviventes, um bloqueio com holofote, o helicóptero caído e a frente de chuva chegando do oeste.',b:buildVivo},
  {id:'santa-aurora',g:'Cidades',n:'Santa Aurora',tag:'centro',chip:['R','risco alto'],d:'Centro da cidade principal na noite 3. Prédios altos, praça da matriz, bloqueio policial abandonado e uma horda descendo a avenida.',b:buildSantaAurora},
  {id:'porto-turvo',g:'Cidades',n:'Porto Turvo',tag:'cais',chip:['R','risco médio'],d:'Porto fluvial com labirinto de contêineres, pórtico, balsa ancorada, armazéns e o frigorífico.',b:buildPorto},
  {id:'tres-pontes',g:'Cidades',n:'Três Pontes',tag:'ferrovia',chip:['R','risco médio'],d:'As três pontes sobre o Rio Claro: rodoviária da BR-101, treliçada da Linha Tronco e a Ponte de Ferro Velha da Estrada da Mata. Também o vau do rio, a Vila Ferroviária, o Beira-trilho e o Centro Velho da Estação. Na margem oeste, o pátio de trens e a estação art déco. Clima seco, com poeira e raios.',b:buildTresPontes},
  {id:'campo-largo',g:'Cidades',n:'Campo Largo',tag:'agro',chip:['R','risco baixo'],d:'Plantações, silos da cooperativa, aeroclube com o avião agrícola e as casas da cidade pequena.',b:buildCampoLargo},
  {id:'vila-do-corvo',g:'Cidades',n:'Vila do Corvo',tag:'serra',chip:['R','risco baixo'],d:'Vila turística na encosta, com neblina, pinheiros, pousadas, igreja antiga e o teleférico parado no meio do cabo.',b:buildVilaCorvo},
  {id:'padrao-ruas',g:'Padrões',n:'Padrão de ruas',tag:'9 bairros',chip:['R','padrão urbano'],d:'Uma rua de amostra de cada padrão urbano do mapa: tipologia de casa ou prédio, largura da rua, tipo de poste, cor da luz e espaçamento. São nove bairros e a cerca militar, de onde toda cidade monta suas ruas.',b:buildPadraoRuas},
  {id:'mansao',g:'Lugares assustadores',n:'Mansão Valverde',tag:'fachada',chip:['R','risco máximo'],d:'A mansão eclética da família Valverde na borda da mata da Serra do Corvo: torre com relógio parado, janelas pregadas, muro de pedra e portão de ferro, jardim formal morto com chafariz seco, cemitério da família com mausoléu, estufa de vidro quebrado, casa da guarda, canil de cães infectados atrás do alambrado com farpado e a SUV preta do Instituto Valverde.',b:buildMansao},
  {id:'mansao-interior',g:'Lugares assustadores',n:'Mansão Valverde · interior',tag:'corte',chip:['D','classe A + D'],d:'Corte da casa e do que existe embaixo dela: hall com escadaria dupla e lustre, sala de jantar, galeria dos retratos, biblioteca com estante deslizante, sala de música com o piano, estátua dos brasões e porão; pelo elevador oculto, os dois níveis do Laboratório Aurora com tubos de contenção, sala de cirurgia, servidores, ducha de descontaminação e uma cela rompida.',b:buildMansaoInterior},
  {id:'trilhas',g:'Lugares assustadores',n:'Trilha do Véu',tag:'serra',chip:['R','risco médio'],d:'Trilha de terra na Serra do Corvo, da Vila do Corvo até a Gruta do Corvo, em zigue-zague pela encosta com degraus e corrimão. Passa pela Cachoeira do Véu (40 m), cruza o cânion na ponte pênsil de 70 m e sobe a escarpa até a torre da polícia florestal. Fitas vermelhas nos galhos marcam a rota de quem fugiu da vila. No caminho: a cabana do caçador, um desabamento na trilha antiga, um avião caído e um acampamento destruído.',b:buildTrilhas},
  {id:'fazenda-santa-clara',g:'Lugares assustadores',n:'Fazenda Santa Clara',tag:'fazenda',chip:['R','risco alto'],d:'Fazenda infestada a oeste de Campo Largo. Casa sede com varanda, celeiro com carcaças penduradas e o jirau aberto, chiqueiro com porcos zumbis e curral com o gado morto e urubus, ambos cercados de alambrado com arame farpado. Milharal em labirinto com três espantalhos (um é zumbi), cata-vento, poço, galinheiro, canil, capela da família com túmulos e a barricada de caminhões onde a família resistiu.',b:buildFazendaSantaClara},
  {id:'base',g:'Marcos',n:'Base 7º BIS',tag:'militar',chip:['R','risco máximo'],d:'Quartel cercado e ponto de evacuação que falhou. Torres com holofotes, tendas de triagem, hangar, paiol e uma horda empurrando a cerca.',b:buildBase},
  {id:'penitenciaria',g:'Marcos',n:'Penitenciária',tag:'presídio',chip:['R','risco alto'],d:'Presídio estadual depois da rebelião: muralhas, pavilhões, torre derrubada, pátio em chamas e presos zumbis fugindo.',b:buildPrisao},
  {id:'represa',g:'Marcos',n:'Hidrelétrica',tag:'represa',chip:['R','risco médio'],d:'A barragem, o lago acima, a casa de força e as linhas de transmissão. Religar as turbinas é uma meta de longo prazo.',b:buildRepresa},
  {id:'hospital-ext',g:'Marcos',n:'Hospital Regional',tag:'fachada',chip:['B','classe B'],d:'O hospital visto de fora: heliponto, pronto-socorro, ambulâncias, tendas de triagem e a cerca de quarentena.',b:buildHospitalExt},
  {id:'shopping',g:'Marcos',n:'Shopping Vale',tag:'corte',chip:['B','classe B'],d:'O shopping com o teto aberto para ver a praça de alimentação tomada pela horda. Estacionamento lotado de carros.',b:buildShopping},
  {id:'mina',g:'Terreno',n:'Mina São Jorge',tag:'subsolo',chip:['R','risco alto'],d:'A mina de ouro da serra em corte: castelete e elevador no poço, três níveis de galeria escorada, trilho de vagonete, paiol de dinamite, um desabamento e o nível 3 alagado.',b:buildMina},
  {id:'ramal',g:'Terreno',n:'Ramal da Serra',tag:'túnel e ponte',chip:['R','risco alto'],d:'A saída sul do Túnel do Espinhaço com o trem de carga parado e a Ponte do Quartel, armada para explodir. Vista encurtada: no mapa os dois ficam a cerca de 3 km.',b:buildRamal},
  {id:'lagoa',g:'Terreno',n:'Lagoa Escura e brejo',tag:'água',chip:['R','risco médio'],d:'A lagoa ao sul de Santa Aurora, o Brejo do Sapo com taboa e árvores mortas, a passarela podre e a casa do pescador na palafita.',b:buildLagoa},
  {id:'casa',g:'Interiores',n:'Casa de subúrbio',tag:'A',chip:['A','classe A'],d:'Sala, cozinha, quarto do casal, quarto da criança, banheiro, garagem, lavanderia e quintal. Vista em corte, como uma casa de bonecas.',b:buildCasa},
  {id:'apartamento',g:'Interiores',n:'Apartamentos',tag:'B',chip:['B','classe B'],d:'Um andar com quatro apartamentos, corredor barricado, poço do elevador e escada bloqueada por entulho.',b:buildApto},
  {id:'mercado',g:'Interiores',n:'Mercado',tag:'A',chip:['A','classe A'],d:'Gôndolas saqueadas, uma derrubada, freezers, caixas, açougue, padaria, câmara fria, estoque e escritório do gerente.',b:buildMercado},
  {id:'farmacia',g:'Interiores',n:'Farmácia',tag:'A',chip:['A','classe A'],d:'Prateleiras, balcão, depósito de controlados atrás da grade com geladeira de vacinas e cofre, sala de manipulação e a porta de aço arrombada por um carro.',b:buildFarmacia},
  {id:'loja-armas',g:'Interiores',n:'Loja de armas',tag:'A + D',chip:['A','classe A + D'],d:'Rack de armas longas, vitrine de pistolas, bancada de recarga, depósito blindado com armadilha, estande de tiro nos fundos e o dono entrincheirado.',b:buildArmas},
  {id:'delegacia',g:'Interiores',n:'Delegacia',tag:'A + D',chip:['A','classe A + D'],d:'Recepção, mesas, quadro de investigação, celas, vestiário, arsenal trancado, sala do delegado, depósito de evidências e pátio de viaturas.',b:buildDelegacia},
  {id:'hospital',g:'Interiores',n:'Pronto-socorro',tag:'B',chip:['B','classe B'],d:'Ala de internação, UTI arranhada, corredor bloqueado por macas e o pronto-socorro tomado.',b:buildHospital},
  {id:'escola',g:'Interiores',n:'Escola Estadual',tag:'A',chip:['A','classe A'],d:'Sala de aula com a lousa do dia 6, corredor de armários, biblioteca, cozinha da merenda, refeitório e a quadra que virou abrigo da Defesa Civil.',b:buildEscola},
  {id:'posto',g:'Interiores',n:'Posto de gasolina',tag:'A',chip:['A','classe A'],d:'Pista com bombas, loja de conveniência em corte, troca de óleo com carro no elevador, banheiro externo e a fila de carros sem gasolina.',b:buildPosto},
  {id:'igreja',g:'Interiores',n:'Igreja',tag:'A',chip:['A','classe A'],d:'Nave com bancos e vitrais, altar, sacristia, armário de doações, grupo de fé, doentes acorrentados no salão e a torre do sino.',b:buildIgreja},
  {id:'galpao',g:'Interiores',n:'Metalúrgica',tag:'A',chip:['A','classe A'],d:'Chão de fábrica com prensas, porta-pallets, empilhadeira, mezanino, vestiário, refeitório, porta para o pátio de carga e uma linha de produção que não para.',b:buildGalpao},
  {id:'fazenda',g:'Interiores',n:'Fazenda',tag:'A',chip:['A','classe A'],d:'Casa sede em corte (fogão a lenha, redes, despensa), varanda, celeiro, galpão de máquinas, silo, galinheiro, curral, poço e a estrada das hordas.',b:buildFazenda},
  {id:'triagem',g:'Interiores',n:'Tenda de triagem',tag:'B',chip:['B','classe B'],d:'Dentro da tenda da base militar: os lados "LIMPO" e "MORDIDO", catres, caixas médicas e fuzis.',b:buildTriagem}
];

// ---------- navegação
const nav=$('nav');const groups={};
SCENES.forEach(s=>{if(!groups[s.g]){const d=document.createElement('div');d.className='grp';d.innerHTML='<h2>'+s.g+'</h2><div class="list"></div>';nav.appendChild(d);groups[s.g]=d.lastChild;}
  const b=document.createElement('button');b.type='button';b.id='s-'+s.id;b.innerHTML='<span>'+s.n+'</span><small>'+s.tag+'</small>';b.addEventListener('click',()=>load(s.id,true));groups[s.g].appendChild(b);s.btn=b;});

// ---------- órbita
const orb={r:100,th:.6,ph:.9,t:new V3(),tr:100};let auto=!reduce,showPins=true,lastInput=0;
$('bRot').setAttribute('aria-pressed',auto);
$('bRot').onclick=()=>{auto=!auto;$('bRot').setAttribute('aria-pressed',auto);};
const HN={cena:'Hora: da cena',dia:'Hora: dia',noite:'Hora: noite'};
$('bHora').onclick=()=>{HORA=HORA==='cena'?'dia':HORA==='dia'?'noite':'cena';$('bHora').textContent=HN[HORA];$('bHora').setAttribute('aria-pressed',HORA!=='cena');if(current){const k={r:orb.r,tr:orb.tr,th:orb.th,ph:orb.ph,t:orb.t.clone()};load(current.id,false);Object.assign(orb,{r:k.r,tr:k.tr,th:k.th,ph:k.ph});orb.t.copy(k.t);}};
$('bPins').onclick=()=>{showPins=!showPins;$('bPins').setAttribute('aria-pressed',showPins);$('pins').hidden=!showPins;};
const ptrs=new Map();let pinchD=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);lastInput=performance.now();});
canvas.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const p=ptrs.get(e.pointerId);const dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);lastInput=performance.now();
  if(ptrs.size===1){orb.th-=dx*.006;orb.ph=clamp(orb.ph-dy*.005,.15,1.45);}else if(ptrs.size===2){const a=[...ptrs.values()];const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinchD)orb.tr=clamp(orb.tr*pinchD/d,orb.min,orb.max);pinchD=d;}});
const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinchD=0;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
canvas.addEventListener('wheel',e=>{e.preventDefault();orb.tr=clamp(orb.tr*(1+Math.sign(e.deltaY)*.1),orb.min,orb.max);lastInput=performance.now();},{passive:false});

// ---------- carregar cena
let current=null;
function dispose(){if(!root)return;root.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep)o.geometry.dispose();if(o.userData.own&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});scene.remove(root);root=null;}
function load(id,push){
  const s=SCENES.find(x=>x.id===id)||SCENES[0];current=s;
  SCENES.forEach(x=>x.btn.setAttribute('aria-current',x===s?'true':'false'));
  dispose();root=new T.Group();scene.add(root);ANIM=[];PINS=[];IT=[];WL=[];WD=[];BLD=[];R=rng(s.id.split('').reduce((a,c)=>a*31+c.charCodeAt(0)|0,7));
  LB=14;const cam=s.b()||{r:100,th:.6,ph:.9,t:[0,0,0]};
  orb.r=orb.tr=cam.r;orb.th=cam.th;orb.ph=cam.ph;orb.t.set(cam.t[0],cam.t[1],cam.t[2]);orb.min=cam.r*.25;orb.max=cam.r*1.8;camera.far=Math.max(400,cam.r*6);camera.updateProjectionMatrix();
  // marcadores
  const pd=$('pins');pd.innerHTML='';PINS.forEach((p,i)=>{const el=document.createElement('div');el.className='pin k-'+p.k+(p.k==='local'?' local':'');el.innerHTML='<i></i>'+(p.k==='local'?'':'<b>'+(i+1)+'</b>')+'<span>'+p.label+'</span>';pd.appendChild(el);p.el=el;});
  // ficha
  const KN={loot:'Loot',perigo:'Perigo',cena:'Cena',quebra:'Destrutível',local:'Local'};
  $('card').innerHTML='<div class="eyebrow"><span>'+s.g+'</span><span class="chip c-'+s.chip[0]+'">'+s.chip[1]+'</span></div><h3>'+s.n+'</h3><p>'+s.d+'</p><ul>'+PINS.map((p,i)=>'<li class="k-'+p.k+'"><i></i><div><b>'+(p.k==='local'?'':(i+1)+'. ')+p.label+'</b> <span>'+KN[p.k]+'. '+p.detail+'</span></div></li>').join('')+'</ul>';
  if(push){try{history.replaceState(null,'','#'+s.id);}catch(e){}}
  resize();
}

// ---------- laço
const clock=new T.Clock();const pv=new V3();
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(auto&&performance.now()-lastInput>2500)orb.th+=dt*.06;
  orb.r+=(orb.tr-orb.r)*Math.min(1,dt*8);
  camera.position.set(orb.t.x+orb.r*Math.sin(orb.ph)*Math.sin(orb.th),orb.t.y+orb.r*Math.cos(orb.ph),orb.t.z+orb.r*Math.sin(orb.ph)*Math.cos(orb.th));camera.lookAt(orb.t);
  if(LANTERNA){LANTERNA.position.copy(camera.position);LANTERNA.target.position.copy(orb.t);LANTERNA.distance=orb.r*2.2;}
  if(!reduce)for(const a of ANIM)a(t);
  renderer.render(scene,camera);
  if(showPins){const w=stage.clientWidth,h=stage.clientHeight;for(const p of PINS){pv.copy(p.p).project(camera);if(pv.z>1||pv.x<-1.1||pv.x>1.1||pv.y<-1.1||pv.y>1.1){p.el.style.display='none';continue;}p.el.style.display='';p.el.style.transform='translate('+((pv.x+1)/2*w-6).toFixed(1)+'px,'+((1-pv.y)/2*h).toFixed(1)+'px) translateY(-50%)';}}
}
const start=(location.hash||'').replace('#','');
load(SCENES.some(s=>s.id===start)?start:'mundo',false);
$('loader').classList.add('done');
frame();
addEventListener('hashchange',()=>{const h=location.hash.replace('#','');if(h&&h!==current.id&&SCENES.some(s=>s.id===h))load(h,false);});
})();
