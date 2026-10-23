// fonte: site/pages/armas-itens/galeria-3d-arsenal.html
// texto visível: Galeria 3D do Arsenal ZombiAdA · Arte de referência · low poly Galeria 3D do Arsenal Abrir o documento Arsenal Armas Munições Explosivos Desmembramento Veículo Destruição Arraste para girar · role ou pince para aproximar · régua em escala real Girar sozinho Categoria lado a lado Atirar Rajada Recarregar Destravar Modelos de referência gerados a partir das medidas da ficha técnica (comprimento total e cano reais), no estilo low poly arredondado do jogo, com peças móveis animadas. Servem para validar proporção, silhueta e as etapas de dano antes da modelagem final pelos artistas. Detalhes finos, marcações e texturas ficam para a arte definitiva.

// ===== script 4 (116 KB)

(function(){
const T = THREE, PI = Math.PI;
const $ = s => document.querySelector(s);

/* ---------- materiais ---------- */
function mat(c, r, m, extra){ const o=new T.MeshStandardMaterial(Object.assign({color:c, roughness:r==null?.7:r, metalness:m==null?.2:m}, extra||{})); o.color.convertSRGBToLinear(); o.emissive.convertSRGBToLinear(); return o; }
function basic(c,extra){ const o=new T.MeshBasicMaterial(Object.assign({color:c},extra||{})); o.color.convertSRGBToLinear(); return o; }
const M = {
  metal:mat(0x34373a,.42,.75), steel:mat(0x6c6f72,.32,.85), steelL:mat(0x8a8d90,.28,.9), dark:mat(0x1a1c1d,.55,.5), poly:mat(0x242622,.8,.05),
  olive:mat(0x4b5231,.8,.05), tan:mat(0x9c8a63,.8,.05), wood:mat(0x4a2c17,.55,0), woodL:mat(0x5e3a1f,.55,0),
  brass:mat(0xc39a45,.28,.9), copper:mat(0xb06a3b,.3,.85), lead:mat(0x6d6f73,.5,.5), shell:mat(0xa3271c,.5,.05),
  glass:mat(0x7fa3a8,.05,.1,{transparent:true,opacity:.42}), crack:mat(0xc9d6d6,.3,0,{transparent:true,opacity:.78}),
  lens:mat(0x23465a,.05,.3,{transparent:true,opacity:.9,emissive:0x061820}),
  skin:mat(0x7d8a6a,.75,0), skinD:mat(0x5d6a50,.8,0), flesh:mat(0x7a1610,.35,0), bone:mat(0xd8cfb8,.6,0), hair:mat(0x1d1a16,.9,0),
  shirt:mat(0x3c4a5a,.9,0), shirtD:mat(0x2a333d,.9,0), pants:mat(0x4a3d2e,.9,0), shoe:mat(0x1c1a17,.8,0),
  blood:mat(0x8a0a0a,.12,0), pool:mat(0x8a0a0a,.12,0,{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
  eye:basic(0xd8c46a),
  fire:basic(0xff7a22), fire2:basic(0xffcf5a),
  flashA:basic(0xffb347,{transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}),
  flashB:basic(0xfff1c0,{transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}),
  smokeP:mat(0x8a8a86,1,0,{transparent:true,opacity:.35,depthWrite:false}),
  smoke:mat(0x2c2c2a,1,0,{transparent:true,opacity:.55}), car:mat(0x7a2b22,.45,.35), charred:mat(0x1b1816,1,0),
  rubber:mat(0x151515,.85,0), chrome:mat(0x9a9da0,.2,.95), lamp:mat(0xe8e2c0,.2,0,{emissive:0x2a2618}), tail:mat(0x8a1a12,.3,0),
  white:mat(0xcfc8b4,.8,0), bottle:mat(0x2f5a34,.1,.1,{transparent:true,opacity:.72}), concrete:mat(0x7d7b74,.95,0),
  brick:mat(0x8b4a33,.95,0), brick2:mat(0x7a3f2b,.95,0), plank:mat(0x7a5634,.85,0), plank2:mat(0x684727,.85,0),
  rebar:mat(0x5a3a25,.6,.6), gas:mat(0x3b4e6b,.45,.4), dyn:mat(0x9e2a1f,.7,0), c4:mat(0x6d6a4c,.95,0), wire:mat(0xb02020,.5,0),
  hole:mat(0x080807,1,0), bruise:mat(0x2a0e14,.8,0,{polygonOffset:true,polygonOffsetFactor:-1}), rimD:mat(0x2a0d0a,.7,0), soak:mat(0x230605,.85,0,{polygonOffset:true,polygonOffsetFactor:-1}), soakF:mat(0x330403,.3,0,{polygonOffset:true,polygonOffsetFactor:-2}), bake:mat(0x5a3220,.55,0), rust:mat(0x6b3a1e,.95,.3), rustD:mat(0x4a2a18,.95,.25), worn:mat(0x55585a,.6,.6), ruler:basic(0xcdbf8f), frame:mat(0x3a3d3f,.45,.65)
};

/* ---------- primitivas ---------- */
function G(){ return new T.Group(); }
function sh(o){ o.castShadow = true; o.receiveShadow = true; return o; }
const gcache={}; let RF=null;
function rbox(w,h,d){ const r=Math.min(w,h,d)*(RF==null?.2:RF); const k=w.toFixed(4)+','+h.toFixed(4)+','+d.toFixed(4)+','+r.toFixed(5); if(!gcache[k]) gcache[k]=(T.RoundedBoxGeometry&&r>.00025)?new T.RoundedBoxGeometry(w,h,d,2,r):new T.BoxGeometry(w,h,d); return gcache[k]; }
function B(g,w,h,d,m,x,y,z,rz,ry,rx){ const o=sh(new T.Mesh(rbox(w,h,d),m)); o.position.set(x,y,z); o.rotation.set(rx||0,ry||0,rz||0); g.add(o); return o; }
function CX(g,r,len,m,x,y,z,seg,r2){ const o=sh(new T.Mesh(new T.CylinderGeometry(r2==null?r:r2,r,len,seg||16),m)); o.rotation.z=-PI/2; o.position.set(x,y,z); g.add(o); return o; }
function CY(g,r,h,m,x,y,z,seg,r2){ const o=sh(new T.Mesh(new T.CylinderGeometry(r2==null?r:r2,r,h,seg||16),m)); o.position.set(x,y,z); g.add(o); return o; }
function CZ(g,r,len,m,x,y,z,seg){ const o=sh(new T.Mesh(new T.CylinderGeometry(r,r,len,seg||16),m)); o.rotation.x=PI/2; o.position.set(x,y,z); g.add(o); return o; }
function SP(g,r,m,x,y,z,d){ const o=sh(new T.Mesh(new T.IcosahedronGeometry(r,d==null?1:d),m)); o.position.set(x,y,z); g.add(o); return o; }
function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%10000)/10000; }; }
function fitLength(g,L){ const b=new T.Box3().setFromObject(g); const len=b.max.x-b.min.x; const k=L/len; g.scale.x=k; g.position.x=-b.min.x*k; const w=G(); w.add(g); return w; }

/* ---------- armas ---------- */
function mark(g,x,y,z){ const o=new T.Object3D(); o.position.set(x,y,z); g.add(o); return o; }
function piv(g,x,y,z){ const o=G(); o.position.set(x||0,y||0,z||0); g.add(o); return o; }
function rail(g,x,len,y,z,w,rx){ const p=piv(g,0,y,z); p.rotation.x=rx||0; B(p,len,.005,w,M.dark,x+len/2,0,0); const n=Math.floor(len/.0095); for(let i=0;i<n;i++) B(p,.0052,.0035,w*1.12,M.metal,x+.006+i*.0095,.0035,0); return p; }
function vents(g,x,len,y,z,n,h){ for(let i=0;i<n;i++) B(g,len/n*.45,h,.003,M.hole,x+(i+.5)*len/n,y,z); }
function scope(g,kind,cx,cy,cz){
  cz=cz||0;
  if(kind===1){ B(g,.044,.01,.028,M.dark,cx,cy+.005,cz); CX(g,.0155,.034,M.dark,cx+.004,cy+.026,cz,18); CX(g,.0125,.002,M.lens,cx+.022,cy+.026,cz,18); CY(g,.004,.006,M.dark,cx+.004,cy+.044,cz,10); return; }
  if(kind===2){ B(g,.07,.012,.026,M.dark,cx,cy+.006,cz); CX(g,.016,.1,M.dark,cx-.01,cy+.032,cz,18); CX(g,.016,.035,M.dark,cx+.055,cy+.032,cz,18,.02); CX(g,.017,.002,M.lens,cx+.073,cy+.032,cz,18); CY(g,.007,.012,M.dark,cx,cy+.052,cz,12); B(g,.03,.01,.012,M.dark,cx-.01,cy+.054,cz); return; }
  const sl=kind===4?.2:.32;
  CX(g,.0135,sl*.55,M.dark,cx,cy+.045,cz,18);
  CX(g,.0135,sl*.25,M.dark,cx+sl*.36,cy+.045,cz,18,.026); CX(g,.026,.05,M.dark,cx+sl*.5,cy+.045,cz,18); CX(g,.024,.002,M.lens,cx+sl*.5+.026,cy+.045,cz,18);
  CX(g,.019,.06,M.dark,cx-sl*.38,cy+.045,cz,18,.0135); CX(g,.019,.035,M.rubber,cx-sl*.38-.045,cy+.045,cz,18); CX(g,.017,.002,M.lens,cx-sl*.38-.063,cy+.045,cz,18);
  CY(g,.01,.022,M.dark,cx,cy+.066,cz,14); CY(g,.011,.004,M.metal,cx,cy+.078,cz,14); CZ(g,.01,.022,M.dark,cx,cy+.045,cz+.022,14);
  [-.07,.07].forEach(d=>{ const t=sh(new T.Mesh(new T.TorusGeometry(.0155,.003,8,20),M.dark)); t.rotation.y=PI/2; t.position.set(cx+d,cy+.045,cz); g.add(t); B(g,.016,.03,.022,M.dark,cx+d,cy+.018,cz); });
}
function buttpad(g,x,y,h,w){ B(g,.012,h,w,M.rubber,x,y,0); }
function swivel(g,x,y){ const t=sh(new T.Mesh(new T.TorusGeometry(.006,.0015,6,12),M.metal)); t.position.set(x,y,0); g.add(t); }

function heatify(P,mesh){ mesh.material=mesh.material.clone(); (P.glow=P.glow||[]).push(mesh); return mesh; }
const PSTY={
  glock:{rf:.07,ga:-.36,grip:'finger',guard:'square',rail:1,sight:'u',port:.2,slideM:'metal',frame:'poly'},
  taurus:{rf:.16,ga:-.3,grip:'panel',guard:'square',rail:1,sight:'3dot',port:.18,frontSer:1,frame:'poly'},
  g2c:{rf:.2,ga:-.3,grip:'panel',guard:'round',rail:0,sight:'3dot',port:.17,frame:'poly',safety:'thumb'},
  beretta:{rf:.28,ga:-.27,grip:'wood',guard:'round',hammer:'spur',sight:'3dot',open:1,decock:'slide',port:0,frame:'metal'},
  pt100:{rf:.25,ga:-.27,grip:'rubber',guard:'round',hammer:'spur',sight:'3dot',port:.17,decock:'frame',frame:'metal'},
  sig:{rf:.14,ga:-.3,grip:'rubber',guard:'hook',hammer:'spur',sight:'3dot',port:.19,decock:'frame',rail:1,tall:1.12,frame:'metal'},
  cz:{rf:.32,ga:-.3,grip:'rubber',guard:'round',hammer:'spur',sight:'3dot',port:.15,inset:1,safety:'thumb',frame:'metal'},
  m1911:{rf:.24,ga:-.2,grip:'wood',guard:'round',hammer:'ring',sight:'small',port:.12,bushing:1,beaver:1,safety:'thumb',slideStop:1,frame:'metal'},
  makarov:{rf:.48,ga:-.24,grip:'star',guard:'round',hammer:'ring',sight:'small',port:.14,flush:1,safety:'slide',lanyard:1,frame:'metal'},
  fiveseven:{rf:.2,ga:-.4,grip:'chunky',guard:'square',rail:1,sight:'3dot',port:.18,slope:1,frame:'poly'},
  deagle:{rf:.08,ga:-.28,grip:'rubber',guard:'round',hammer:'big',sight:'small',port:.16,tri:1,safety:'slide',frame:'metal'}
};
function pistol(o){
  const sty=Object.assign({},PSTY[o.st||'glock']), g=G(), P={fam:'pistol',kick:o.deagle?1.8:.6}; g.userData=P;
  const L=o.L/1000*.97, h=(o.h||.031)*(sty.tall||1), w=o.deagle?.032:(sty.flush?.024:.025);
  const sm=o.steel?M.steel:(o.stain?M.steelL:M.metal), fm=sty.frame==='poly'?M.poly:sm;
  const gm=sty.grip==='wood'?M.wood:(sty.grip==='star'?M.bake:(sty.grip==='rubber'?M.rubber:M.poly));
  const S=piv(g); P.slide=S; P.stroke=L*.15;
  const sw=sty.inset?w*.86:w, sh0=sty.inset?h*.92:h;
  RF=sty.rf;
  if(sty.tri){ B(S,L*.42,sh0,sw,sm,L*.21,0,0); }
  else if(sty.open){ B(S,L*.45,sh0,sw,sm,L*.225,0,0); B(S,L*.55,sh0*.62,sw,sm,L*.72,-sh0*.19,0); }
  else B(S,L,sh0,sw,sm,L/2,0,0);
  if(sty.slope) B(S,L*.25,sh0*.5,sw*.98,sm,L*.86,sh0*.35,0,-.22);
  RF=null;
  for(let i=0;i<(sty.flush?9:7);i++) B(S,.0022,sh0*.72,sw+.0014,M.dark,.007+i*.0052,-.002,0, sty.slope?0:(o.st==='glock'?0:.0));
  if(sty.frontSer) for(let i=0;i<5;i++) B(S,.0022,sh0*.6,sw+.0014,M.dark,L*.76+i*.0052,-.003,0);
  if(sty.port) { B(S,L*sty.port,.004,sw*.55,M.hole,L*.6,sh0/2-.001,sw*.12); B(S,L*sty.port*.85,.003,sw*.4,M.steelL,L*.6,sh0/2-.0004,sw*.1); B(S,.012,.004,.002,M.dark,L*.55,sh0*.15,sw/2+.0008); }
  if(sty.open){ heatify(P,CX(S,.0062,L*.56,M.steelL,L*.7,sh0*.12,0,18)); B(S,.03,.004,sw*.6,M.hole,L*.48,sh0/2-.001,0); }
  if(sty.tri){ const tb=sh(new T.Mesh(new T.CylinderGeometry(.016,.016,L*.6,3),sm)); tb.rotation.set(0,0,-PI/2); tb.rotateY(PI/6); tb.position.set(L*.7,sh0*.08,0); S.add(tb); heatify(P,tb); B(S,L*.6,.006,.012,sm,L*.7,sh0*.38,0); for(let i=0;i<6;i++) B(S,.008,.003,.013,M.hole,L*.45+i*.04,sh0*.41,0); }
  if(sty.bushing){ heatify(P,CX(S,.0078,.006,M.steelL,L+.002,.001,0,18)); CX(S,.0045,.004,M.steel,L+.002,-.012,0,12); }
  heatify(P,CX(S,sty.tri?.0072:.0062,.004,M.dark,L+.0015,sty.tri?sh0*.08:.002,0,18)); CX(S,.0034,.005,M.hole,L+.0025,sty.tri?sh0*.08:.002,0,12);
  const top=sh0/2;
  if(sty.sight==='u'){ B(S,.004,.007,.004,M.dark,L-.008,top+.0035,0); B(S,.0022,.0022,.0046,M.white,L-.008,top+.0058,0); B(S,.008,.007,.016,M.dark,.009,top+.0035,0); B(S,.004,.002,.0122,M.white,.009,top+.006,0); }
  else if(sty.sight==='3dot'){ B(S,.004,.007,.004,M.dark,L-.008,top+.0035,0); B(S,.0022,.0022,.0046,M.white,L-.008,top+.0058,0); B(S,.008,.007,.016,M.dark,.009,top+.0035,0); B(S,.0022,.0022,.0166,M.white,.009,top+.0058,0); }
  else { B(S,.006,.004,.003,M.dark,L-.006,top+.002,0); B(S,.006,.004,.012,M.dark,.008,top+.002,0); }
  if(sty.decock==='slide'){ B(S,.012,.008,.004,M.dark,.02,sh0*.15,sw/2+.002,.3); B(S,.012,.008,.004,M.dark,.02,sh0*.15,-sw/2-.002,.3); }
  if(sty.safety==='slide') B(S,.012,.008,.004,M.dark,.018,sh0*.1,-sw/2-.002,.2);
  if(o.sel) B(S,.01,.008,.003,M.dark,.014,-sh0*.2,sw/2+.0014);
  if(sty.inset){ B(g,L*.9,h*.35,w*.12,fm,L*.47,-h*.32,w*.47); B(g,L*.9,h*.35,w*.12,fm,L*.47,-h*.32,-w*.47); }
  const fl=sty.tri?L*.66:L*.8;
  RF=sty.rf; B(g,fl,.016,w*.92,fm,fl/2+L*.06,-h/2-.008,0); RF=null;
  if(sty.rail) for(let i=0;i<(sty.slope?5:3);i++) B(g,.004,.003,w*.96,M.dark,L*.62+i*.009,-h/2-.017,0);
  if(o.st==='glock'||!o.st){ B(g,.008,.004,.003,M.dark,L*.5,-h/2-.003,-w/2-.0012); B(g,.008,.004,.003,M.dark,L*.5,-h/2-.003,w/2+.0012); }
  if(sty.slideStop){ B(g,.03,.006,.003,M.dark,L*.42,-h/2-.002,-w/2-.0014); SP(g,.0028,M.dark,L*.55,-h/2-.003,w/2+.001,1); } else B(g,.012,.004,.003,M.dark,L*.45,-h/2-.003,-w/2-.0012);
  if(sty.decock==='frame') B(g,.01,.012,.003,M.dark,L*.38,-h/2-.012,-w/2-.0014,.6);
  if(sty.safety==='thumb') B(g,.014,.006,.004,M.dark,.02,-h/2-.002,-w/2-.0016);
  const gl=o.gl||.105, ga=sty.ga, gx=.034+(L-.2)*.15, gy=-h/2-gl/2+.006;
  const grip=piv(g,gx,gy,0); grip.rotation.z=ga;
  const gw=sty.grip==='chunky'?w*1.18:w*1.06, gd=sty.grip==='chunky'?.036:.032;
  RF=.3;
  if(sty.grip==='wood'||sty.grip==='star'){ B(grip,gd*.86,gl,w*.9,fm,0,0,0); B(grip,gd*.8,gl*.86,.004,gm,.001,-.002,w*.47); B(grip,gd*.8,gl*.86,.004,gm,.001,-.002,-w*.47);
    if(sty.grip==='wood'){ for(let i=0;i<6;i++) for(let j=0;j<2;j++) B(grip,.003,.003,.0012,M.woodL,-.006+j*.012,-gl*.3+i*.012,w*.495,0,0,0); CZ(grip,.0035,.0015,M.brass,.0,gl*.25,w*.5,10); CZ(grip,.0035,.0015,M.brass,.0,-gl*.3,w*.5,10); }
    else { CZ(grip,.008,.0015,M.dark,0,gl*.1,w*.5,5); } }
  else B(grip,gd,gl,gw,gm,0,0,0);
  RF=null;
  if(sty.grip==='finger'){ for(let i=0;i<3;i++) B(grip,.006,.012,gw*.98,gm,gd/2+.002,gl*.18-i*.022,0); for(let i=0;i<5;i++) for(let j=0;j<3;j++) B(grip,.003,.003,.0012,M.dark,-.008+j*.008,-gl*.25+i*.012,gw/2+.0004); }
  if(sty.grip==='panel'||sty.grip==='rubber'||sty.grip==='chunky') for(let i=0;i<6;i++) B(grip,gd*.75,.0025,gw+.001,M.dark,.002,-gl/2+.018+i*.013,0);
  if(sty.grip==='chunky') B(grip,.008,gl*.8,gw*.9,gm,gd/2+.002,-.004,0);
  if(sty.beaver){ B(g,.026,.008,w*.9,fm,-.004,-h/2-.004,0,.25); B(grip,.006,gl*.55,w*.9,fm,-gd*.5-.002,gl*.18,0); }
  else B(g,.02,.009,w*.9,fm,.004,-h/2-.006,0);
  if(sty.lanyard){ const t=sh(new T.Mesh(new T.TorusGeometry(.005,.0013,6,12),M.dark)); t.position.set(-.012,-gl/2+.004,0); grip.add(t); }
  const Mg=piv(grip); P.mag=Mg; P.magDrop=gl*1.15;
  B(Mg,.022,gl*.94,w*.72,M.dark,.003,-.004,0);
  if(sty.grip==='chunky') B(Mg,.04,.01,gw*1.02,M.poly,.003,-gl/2-.004,0); else if(sty.flush||sty.grip==='wood') B(Mg,.028,.004,w*.9,M.steel,.003,-gl/2-.001,0); else B(Mg,.031,.006,gw*1.02,M.dark,.003,-gl/2-.002,0);
  const ty=-h/2;
  if(sty.guard==='square'){ B(g,.046,.004,.009,fm,gx+.05,ty-.034,0); B(g,.004,.03,.009,fm,gx+.074,ty-.02,0); B(g,.006,.004,.009,fm,gx+.075,ty-.034,0); }
  else if(sty.guard==='hook'){ B(g,.046,.004,.009,fm,gx+.05,ty-.034,0); B(g,.004,.03,.009,fm,gx+.073,ty-.02,0,.2); B(g,.008,.006,.009,fm,gx+.074,ty-.037,0,.4); }
  else { const t=sh(new T.Mesh(new T.TorusGeometry(.019,.0022,6,16,PI),fm)); t.rotation.z=PI; t.scale.set(1.2,1,1); t.position.set(gx+.05,ty-.014,0); g.add(t); }
  P.trigger=B(g,.004,.014,.004,o.st==='glock'||!o.st?M.dark:M.steel,gx+.042,ty-.022,0,.2);
  if(o.st==='glock'||!o.st) B(P.trigger,.0015,.008,.0045,M.metal,0,-.001,0);
  if(sty.hammer){ const hm=piv(g,.003,h/2-.008,0); P.hammer=hm;
    if(sty.hammer==='ring'){ B(hm,.006,.012,.006,M.dark,-.002,.004,0,.3); const t=sh(new T.Mesh(new T.TorusGeometry(.0045,.0016,6,12),M.dark)); t.position.set(-.004,.012,0); hm.add(t); }
    else if(sty.hammer==='big') B(hm,.014,.02,.009,M.dark,-.004,.007,0,.35);
    else { B(hm,.008,.016,.007,M.dark,-.002,.006,0,.3); B(hm,.008,.004,.008,M.dark,-.006,.013,0,.3); } }
  P.muzzle=mark(g,L+.006,sty.tri?h*.08:.002,0); P.eject=mark(g,L*.6,h/2,w*.25);
  return g;
}
function revolver(o){
  const g=G(), P={fam:'revolver',kick:o.cal==='.44 Magnum'?1.5:.9}; g.userData=P; const b=o.B/1000, s=o.steel?M.steel:M.metal;
  B(g,.08,.044,.024,s,.07,0,0); B(g,.036,.012,.022,s,.096,.022,0);
  B(g,.024,.012,.004,M.dark,.055,.006,-.013);
  const cr=piv(g,.077,-.024,0); P.crane=cr; const cy=piv(cr,0,.022,0); P.cyl=cy;
  CX(cy,.0215,.042,s,0,0,0,24);
  for(let i=0;i<6;i++){ const a=i*PI/3; B(cy,.026,.005,.005,M.dark,0,Math.cos(a)*.0205,Math.sin(a)*.0205,0,0,a); }
  P.ch=[]; for(let i=0;i<6;i++){ const a=i*PI/3+PI/6; P.ch.push(mark(cy,-.022,Math.cos(a)*.013,Math.sin(a)*.013)); CX(cy,.0046,.002,M.brass,-.0215,Math.cos(a)*.013,Math.sin(a)*.013,12); }
  heatify(P,CX(g,.0088,b,s,.112+b/2,.009,0,18)); B(g,b*.92,.015,.013,s,.112+b*.46,-.005,0);
  CX(g,.004,.005,M.hole,.112+b+.0015,.009,0,12);
  B(g,.012,.009,.004,M.dark,.112+b-.008,.021,0,-.3); B(g,.012,.006,.012,M.dark,.105,.031,0);
  const hm=piv(g,.036,.018,0); B(hm,.01,.02,.008,M.dark,-.004,.008,0,.45); P.hammer=hm;
  const grip=piv(g,.024,-.062,0); grip.rotation.z=-.38; B(grip,.034,.1,.031,o.wood?M.wood:M.rubber,0,0,0);
  if(!o.wood) for(let i=0;i<4;i++) B(grip,.006,.07,.033,M.dark,-.012+i*.008,0,0);
  B(g,.038,.004,.008,s,.062,-.036,0); B(g,.004,.022,.008,s,.08,-.026,0,.2);
  P.trigger=B(g,.004,.015,.004,M.dark,.06,-.027,0,.2);
  P.muzzle=mark(g,.112+b+.006,.009,0); P.eject=mark(g,.077,0,0);
  return g;
}
function rifle(o){
  const g=G(), L=o.L/1000, Bl=o.B/1000, P={}; g.userData=P;
  const furn = o.wood?M.wood:(o.olive?M.olive:(o.tan?M.tan:M.poly));
  const trad = o.stock==='trad' || o.stock==='straight';
  const S = o.stock==='none'?0:(o.stockLen||Math.min(.36,Math.max(.2,.3*L)));
  const x0=S, x1=Math.max(x0+.12, L-Bl*.92);
  const hR=o.hR||.06, wR=o.wR||.034, r=o.br||.0085, by=hR*.15, RL=x1-x0;
  const recM = o.tan?M.tan:M.metal;
  if(o.round){ CX(g,hR*.36,RL,M.steel,(x0+x1)/2,by,0,20); CX(g,hR*.32,.05,M.steel,x0-.01,by,0,18); }
  else if(o.ar){ B(g,RL,hR*.5,wR,recM,(x0+x1)/2,hR*.25,0); B(g,RL*.92,hR*.52,wR*.96,recM,(x0+x1)/2-RL*.02,-hR*.24,0); B(g,.05,.03,wR*1.15,recM,x0+RL*.62,-hR*.5-.01,0); CZ(g,.006,.012,M.metal,x1-.03,hR*.28,wR/2+.006,12); B(g,.012,.01,.012,M.metal,x1-.05,hR*.12,wR/2+.006); B(g,.03,.008,.012,M.dark,x0+.02,hR/2+.004,0); B(g,.012,.006,.004,M.dark,x0+RL*.55,-hR*.15,-wR/2-.002); }
  else { B(g,RL,hR,wR,recM,(x0+x1)/2,0,0); }
  if(o.ak){ B(g,RL*.86,hR*.28,wR*.95,M.metal,(x0+x1)/2-.008,hR/2+.004,0); for(let i=0;i<3;i++) B(g,.004,hR*.3,wR*.97,M.dark,x0+RL*.25+i*.02,hR/2+.004,0); B(g,RL*.5,.012,.003,M.metal,x0+RL*.55,-hR*.02,wR/2+.0015,-.05); B(g,.012,.014,.003,M.dark,x0+RL*.32,-hR*.05,wR/2+.002); }
  if(o.g3){ CX(g,.009,(L-x1)*.6,M.metal,x1+(L-x1)*.28,hR*.48,0,14); B(g,.012,.024,.008,M.dark,x1+(L-x1)*.5,hR*.48,-.012); CY(g,.012,.016,M.dark,x0+.03,hR/2+.008,0,12); }
  const ex=x1-(o.ejectBack||.07), ey=o.ar?hR*.2:by;
  B(g,.05,hR*.36,.004,M.hole,ex,ey,wR/2-.0004);
  const bolt=piv(g); P.bolt=bolt; P.stroke=Math.min(.1,RL*.32);
  B(bolt,.044,hR*.26,.006,M.steelL,ex,ey,wR/2-.0012);
  if(o.charge) { B(bolt,.012,.01,.03,M.metal,ex+.04,ey+.004,wR/2+.012); SP(bolt,.0065,M.metal,ex+.04,ey+.004,wR/2+.028,1); }
  if(o.ar) B(g,.012,.016,.006,recM,ex-.03,ey+.004,wR/2+.004);
  if(o.rail) rail(g,x0-.005,RL+.07,hR/2+(o.ar?.0:.003),0,wR*.68);
  heatify(P,CX(g,r,Bl,M.metal,L-Bl/2,by,0,16));
  if(o.jacket){ CX(g,r*2,(L-x1)*.6,M.dark,x1+(L-x1)*.3,by,0,16); for(let i=0;i<6;i++) CX(g,r*2.15,.004,M.metal,x1+(L-x1)*(.05+i*.09),by,0,16); }
  if(o.gas) CX(g,r*.75,(L-x1)*.55,M.metal,x1+(L-x1)*.3,by+r*2.2,0,14);
  if(o.brake){ const k=o.brake===2?3.2:2.0, bl=o.brake===2?.12:.06; heatify(P,CX(g,r*k,bl,M.dark,L-bl/2,by,0,o.brake===2?8:16)); for(let i=0;i<3;i++) B(g,bl*.16,r*k*1.3,r*k*2.2,M.hole,L-bl*.25-i*bl*.25,by,0); }
  else if(!o.noFH){ heatify(P,CX(g,r*1.45,.042,M.dark,L-.021,by,0,16)); for(let i=0;i<4;i++){ const a=i*PI/2+PI/4; B(g,.026,.0025,.004,M.hole,L-.02,by+Math.cos(a)*r*1.42,Math.sin(a)*r*1.42,0,0,a); } }
  CX(g,r*.55,.004,M.hole,L+.0005,by,0,12);
  const fore = trad ? 0 : (o.hgFrac||.5);
  if(!trad && o.hg!=='none'){
    const hl=(L-x1)*fore, hx=x1+hl/2, hh=hR*.8;
    if(o.hg==='rail'){ B(g,hl,hh,wR*1.04,M.dark,hx,by-.002,0); rail(g,x1,hl,by+hh/2,0,wR*.66); rail(g,x1+.01,hl-.02,by-.002,wR*.54,wR*.4,PI/2); rail(g,x1+.01,hl-.02,by-.002,-wR*.54,wR*.4,-PI/2); rail(g,x1+.01,hl-.02,by-hh/2,0,wR*.6,PI); }
    else { const hm=o.hg==='wood'?M.wood:furn; if(o.ak){ B(g,hl,hh*.55,wR*1.08,hm,hx,by-hh*.22,0); B(g,hl*.75,hh*.35,wR*.7,hm,hx-hl*.1,by+r*2.2,0); } else { B(g,hl,hh,wR*1.08,hm,hx,by-.002,0); vents(g,x1+.01,hl-.02,by+hh*.15,wR*.54+.001,Math.round(hl/.025),hh*.3); vents(g,x1+.01,hl-.02,by+hh*.15,-wR*.54-.001,Math.round(hl/.025),hh*.3); } }
    if(!(o.scope>=3) && !o.rail) { if(o.ak){ B(g,.03,.016,wR*.6,M.metal,x1+.02,by+r*2.5+.01,0); B(g,.012,.004,wR*.5,M.dark,x1+.03,by+r*2.5+.019,0); } }
  }
  if(!(o.scope>=3)){
    const fsx=L-(o.ak?.06:.08);
    if(o.ak){ B(g,.022,.022,wR*.6,M.metal,fsx,by+.008,0); B(g,.006,.024,.004,M.metal,fsx,by+.026,.008); B(g,.006,.024,.004,M.metal,fsx,by+.026,-.008); B(g,.003,.016,.003,M.dark,fsx,by+.022,0); }
    else if(!o.rail || o.carry){ B(g,.018,.014,wR*.55,M.dark,fsx,by+.008,0); B(g,.012,.034,.008,M.dark,fsx,by+.03,0,-.25); }
    else { B(g,.012,.024,.012,M.dark,fsx-.04,by+hR*.4+.012,0); }
  }
  if(!trad && !o.hg==='none') {}
  const gx=x0+(o.gripAt||.07);
  if(!trad && o.grip!=='none'){ const gp=piv(g,gx-.012,-hR/2-.046,0); gp.rotation.z=-.3; B(gp,.032,.105,.028,furn,0,0,0); for(let i=0;i<3;i++) B(gp,.006,.012,.026,furn,.017,.022-i*.02,0); B(gp,.034,.008,.03,furn,0,-.052,0); }
  B(g,.06,.004,.01,M.metal,gx+.03,-hR/2-.024,0); B(g,.004,.022,.01,M.metal,gx+.06,-hR/2-.013,0);
  P.trigger=B(g,.004,.016,.004,M.dark,gx+.024,-hR/2-.012,0,.15);
  if(o.sel){ B(g,.016,.005,.003,M.dark,gx+.005,-hR*.15,-wR/2-.002,.4); }
  const mx=o.magAt!=null?x0+o.magAt:gx+.075, ml=o.magLen||1;
  const Mg=piv(g,mx,-hR/2,0); P.mag=Mg;
  if(o.mag==='curved'){ let px=0, py=0; const mm=o.magMat||M.metal; [.06,.22,.38].forEach((a,i)=>{ const l=.07*ml; const cx=px+Math.sin(a)*l/2, cy=py-Math.cos(a)*l/2; B(Mg,.052,l+.004,.024,mm,cx,cy,0,a); B(Mg,.04,l*.8,.026,M.dark,cx,cy,0,a); px+=Math.sin(a)*l; py-=Math.cos(a)*l; }); B(Mg,.058,.008,.028,mm,px,py,0,.38); P.magDrop=.07*ml*3+.04; }
  else if(o.mag==='box'){ const l=.13*ml, cv=o.curve||0, sl=l/3, mm=o.magMat||M.dark; let px=0,py=0,a=.08; for(let i=0;i<3;i++){ a=.08+cv*i; const cx=px+Math.sin(a)*sl/2, cy=py-Math.cos(a)*sl/2; B(Mg,.05,sl+.004,.024,mm,cx,cy,0,a); B(Mg,.04,.003,.026,M.metal,cx,cy,0,a); px+=Math.sin(a)*sl; py-=Math.cos(a)*sl; } B(Mg,.056,.007,.028,mm,px,py-.002,0,a); P.magDrop=l+.03; }
  else if(o.mag==='drum'){ CZ(Mg,.075,.07,M.dark,.02,-.085,0,22); CZ(Mg,.05,.074,M.metal,.02,-.085,0,18); B(Mg,.05,.04,.03,M.dark,0,-.02,0); P.magDrop=.2; }
  else if(o.mag==='internal'){ B(g,.08,.025,.03,trad?furn:M.metal,mx,-hR/2-.012,0); P.mag=null; }
  else P.mag=null;
  if(o.mag==='belt'){ const Bt=piv(g,mx+.02,-hR/2-.05,-.045); P.belt=Bt; B(Bt,.11,.1,.08,M.olive,0,0,0); B(Bt,.112,.012,.082,M.dark,0,.046,0); for(let i=0;i<7;i++){ CX(Bt,.0042,.034,M.brass,-.04+i*.012,.07,.035,10); B(Bt,.006,.006,.012,M.metal,-.04+i*.012,.066,.035); }
    const Cv=piv(g,x0+.01,hR/2,0); P.cover=Cv; B(Cv,RL-.03,.014,wR*1.05,M.metal,(RL-.03)/2,.007,0); B(Cv,.02,.012,wR*.6,M.dark,RL-.04,.016,0); }
  if(trad){
    buttpad(g,.006,-.04,.13,.038); B(g,.03,.13,.038,furn,.024,-.04,0);
    B(g,S,.055,.034,furn,S/2,-.012,0,.06); B(g,.09,.05,.032,furn,x0-.02,-.035,0,.25);
    const fl=(x1-x0)+(L-x1)*(o.fore==null?.62:o.fore); if(fl>0) B(g,fl,.045,.04,furn,x0+fl/2,-hR/2+.004,0);
    if(o.stock==='straight'){ B(g,.15,.04,.035,furn,x1+.08,-hR/2,0); }
    B(g,.04,.004,.03,M.metal,mx,-hR/2-.022,0);
    swivel(g,.2,-.08); swivel(g,x1+(L-x1)*.45,-hR/2-.03);
    if(o.bands){ [.35,.75].forEach(f=>CX(g,.024,.008,M.metal,x1+(L-x1)*f*(o.fore||.62),-.004,0,16)); }
  } else if(o.stock==='fixed'||o.stock==='wood'){
    B(g,S,.05,.03,furn,S/2,-.008,0,.05); B(g,.03,.13,.036,furn,.022,-.035,0); buttpad(g,.004,-.035,.13,.036);
    if(o.stock==='wood') B(g,S*.6,.03,.028,furn,S*.55,-.045,0,.2);
    swivel(g,.08,-.09);
  } else if(o.stock==='skeleton'){
    B(g,S,.014,.026,furn,S/2,.012,0,.03); B(g,S,.014,.026,furn,S/2,-.05,0,-.08); B(g,.03,.12,.034,furn,.02,-.025,0); buttpad(g,.004,-.025,.12,.034);
  } else if(o.stock==='retract'){
    CX(g,.013,S,M.metal,S/2,0,0,16); for(let i=0;i<5;i++) B(g,.003,.003,.008,M.dark,S*.2+i*.015,-.013,0);
    B(g,.034,.11,.036,furn,.02,-.025,0); B(g,S*.55,.032,.03,furn,S*.35,.0,0); buttpad(g,.003,-.025,.11,.036);
  } else if(o.stock==='fold'){
    B(g,S,.006,.006,M.metal,S/2,.01,.012); B(g,S,.006,.006,M.metal,S/2,-.04,.012,-.12); B(g,.012,.1,.03,M.metal,.006,-.02,.012);
  }
  const sx=(x0+x1)/2+.03, sy=(o.ar?hR/2:hR/2)+(o.rail?.006:0);
  if(o.scope) scope(g,o.scope,sx,sy,o.scope===4?-.02:0);
  if(o.carry){ B(g,.15,.026,.014,M.metal,(x0+x1)/2,hR/2+.03,0); B(g,.012,.03,.014,M.metal,(x0+x1)/2+.07,hR/2+.014,0); B(g,.012,.03,.014,M.metal,(x0+x1)/2-.07,hR/2+.014,0); }
  if(o.bipod){ const bx=x1+(L-x1)*.45; CX(g,.008,.02,M.dark,bx+.04,by-.012,0,12); [-1,1].forEach(s=>{ const lg=piv(g,bx+.04,by-.012,s*.012); lg.rotation.set(s*.15,0,-.35); B(lg,.006,.2,.006,M.dark,0,-.1,0); B(lg,.01,.006,.01,M.rubber,0,-.2,0); }); }
  if(o.bolt){ const bh=piv(g,x1-.045,by,0); P.boltHandle=bh; bh.userData.x0=bh.position.x; CZ(bh,.0042,.05,M.steelL,0,0,wR/2+.022,12); SP(bh,.0095,M.dark,0,-.004,wR/2+.048,1); CX(g,hR*.3,.03,M.steel,x0+.005,by,0,16); }
  if(o.lever){ const lv=piv(g,gx-.02,-hR/2-.01,0); P.lever=lv; B(lv,.11,.006,.012,M.metal,.055,-.052,0); B(lv,.006,.05,.012,M.metal,.003,-.028,0); B(lv,.006,.05,.012,M.metal,.108,-.028,0); B(lv,.04,.006,.012,M.metal,.08,-.002,0); B(g,.03,.012,.003,M.dark,x1-.04,by,wR/2+.001); }
  if(o.tube){ const tl=(L-x1)*(o.tubeLen||.8); CX(g,.0105,tl,M.metal,x1+tl/2,by-.023,0,16); CX(g,.0125,.02,M.dark,x1+tl+.006,by-.023,0,16); }
  if(o.pump){ const pp=piv(g); P.pump=pp; B(pp,.17,.042,.046,furn,x1+.14,by-.022,0); for(let i=0;i<8;i++) B(pp,.006,.044,.048,M.dark,x1+.07+i*.02,by-.022,0); }
  if(o.heat){ CX(g,r*1.75,(L-x1)*.7,M.dark,x1+(L-x1)*.4,by,0,12); for(let i=0;i<10;i++) B(g,.008,r*1.5,.004,M.hole,x1+(L-x1)*(.1+i*.06),by+r*.8,r*1.5); }
  if(o.bayo) B(g,.025,.008,.01,M.metal,L-.07,by-.016,0);
  if(o.rod) CX(g,.003,(L-x1)*.85,M.steel,x1+(L-x1)*.45,by-.014,0,8);
  P.muzzle=mark(g,L+.01,by,0); P.eject=mark(g,ex,ey,wR/2+.006); P.loadPort=mark(g,x1-.05,-hR/2-.004,0); P.topLoad=mark(g,ex,hR/2+.004,0);
  P.fam = o.mag==='belt'?'belt' : o.pump?'pump' : o.lever?'lever' : o.tube?'semi12' : o.bolt?(o.mag==='box'?'boltmag':'bolt') : (o.mag==='internal'?'semiint':'rifle');
  return g;
}
function bullpup(o){
  const g=G(), L=o.L/1000, Bl=o.B/1000, bl=Math.max(.32,L-Bl*.72), body=o.shot?M.poly:M.olive, P={fam:o.shot?'pump':'rifle',stroke:.06}; g.userData=P;
  B(g,bl,.075,.042,body,bl/2,0,0); B(g,bl*.9,.02,.044,M.dark,bl*.5,-.02,0);
  B(g,.032,.13,.044,M.rubber,.016,-.025,0);
  const gx=bl*.8; const gp=piv(g,gx,-.085,0); gp.rotation.z=-.25; B(gp,.03,.1,.03,M.poly,0,0,0);
  B(g,.1,.006,.03,body,gx+.01,-.06,0); P.trigger=B(g,.004,.016,.004,M.dark,gx+.02,-.05,0,.15);
  heatify(P,CX(g,o.shot?.0105:.0085,Bl,M.metal,L-Bl/2,.012,0,16)); CX(g,.006,.004,M.hole,L+.001,.012,0,12);
  B(g,.05,.024,.004,M.hole,bl*.25,.005,.0212); const bolt=piv(g); P.bolt=bolt; B(bolt,.044,.02,.006,M.steelL,bl*.25,.005,.02);
  if(o.shot){ CX(g,.012,bl*.75,M.metal,bl*.55,-.025,.014,14); CX(g,.012,bl*.75,M.metal,bl*.55,-.025,-.014,14); const pp=piv(g); P.pump=pp; B(pp,.15,.045,.052,M.poly,bl+.06,-.015,0); for(let i=0;i<6;i++) B(pp,.006,.047,.054,M.dark,bl+.005+i*.022,-.015,0); rail(g,bl*.15,bl*.8,.04,0,.02); P.loadPort=mark(g,bl*.2,-.04,0); }
  else { const Mg=piv(g,gx-.11,-.03,0); Mg.rotation.z=.14; P.mag=Mg; B(Mg,.05,.14,.026,M.glass,0,-.07,0); for(let i=0;i<6;i++) CX(Mg,.003,.04,M.brass,0,-.01-i*.02,0,6); P.magDrop=.18; scope(g,2,bl*.5,.04,0); B(g,.2,.03,.02,body,bl*.62,.048,0); B(g,.026,.075,.026,body,bl+.05,-.05,0,.1); }
  P.muzzle=mark(g,L+.01,.012,0); P.eject=mark(g,bl*.25,.005,.03);
  return g;
}
function p90(){
  const g=G(), P={fam:'p90',stroke:.04,kick:.6}; g.userData=P;
  B(g,.4,.07,.055,M.poly,.2,0,0); B(g,.12,.075,.05,M.poly,.2,-.07,0); B(g,.08,.04,.03,M.hole,.21,-.06,0);
  B(g,.06,.13,.056,M.poly,.03,-.03,0); B(g,.05,.03,.056,M.poly,.33,-.04,0); heatify(P,CX(g,.008,.09,M.metal,.43,.0,0,16));
  const Mg=piv(g,.22,.047,0); P.mag=Mg; P.magDir=1; P.magDrop=.08; B(Mg,.3,.022,.05,M.glass,0,0,0); for(let i=0;i<12;i++) CX(Mg,.0028,.02,M.brass,-.12+i*.022,0,0,6);
  scope(g,1,.24,.06,0);
  const bolt=piv(g); P.bolt=bolt; B(bolt,.02,.012,.012,M.dark,.3,.02,.03);
  P.trigger=B(g,.004,.016,.004,M.dark,.24,-.045,0);
  P.muzzle=mark(g,.48,0,0); P.eject=mark(g,.2,-.07,0);
  return g;
}
function shotgunBreak(o){
  const g=G(), L=o.L/1000, Bl=o.B/1000, P={fam:'break',kick:1.6}; g.userData=P;
  B(g,.09,.05,.042,M.steel,L-Bl-.04,-.005,0); for(let i=0;i<4;i++) B(g,.05,.002,.043,M.dark,L-Bl-.04,.01-i*.008,0);
  const bp=piv(g,L-Bl,-.01,0); P.barrels=bp;
  heatify(P,CX(bp,.0105,Bl,M.steel,Bl/2,.01,.011,18)); heatify(P,CX(bp,.0105,Bl,M.steel,Bl/2,.01,-.011,18)); B(bp,Bl,.004,.008,M.metal,Bl/2,.022,0); SP(bp,.002,M.white,Bl-.01,.026,0,1);
  CX(bp,.0075,.004,M.hole,Bl+.001,.01,.011,12); CX(bp,.0075,.004,M.hole,Bl+.001,.01,-.011,12);
  B(bp,.22,.03,.038,M.wood,.12,-.01,0);
  P.breech=[mark(bp,.004,.01,.011),mark(bp,.004,.01,-.011)];
  B(g,.12,.042,.032,M.wood,L-Bl-.14,-.022,0,.14); B(g,.28,.07,.036,M.wood,.15,-.05,0,.08); buttpad(g,.006,-.06,.13,.04);
  B(g,.004,.014,.004,M.dark,L-Bl-.05,-.04,0); P.trigger=B(g,.004,.014,.004,M.dark,L-Bl-.035,-.04,0);
  B(g,.04,.004,.01,M.steel,L-Bl-.045,-.05,0);
  B(g,.012,.016,.006,M.dark,L-Bl-.08,.022,.012,.5); B(g,.012,.016,.006,M.dark,L-Bl-.08,.022,-.012,.5);
  B(g,.02,.006,.008,M.steel,L-Bl-.07,.025,0);
  P.muzzle=mark(bp,Bl+.01,.01,0); P.eject=P.breech[0];
  return g;
}
function m2(){
  const g=G(), P={fam:'belt',kick:2.2,stroke:.08}; g.userData=P;
  B(g,.52,.13,.12,M.metal,.36,0,0); for(let i=0;i<5;i++) CZ(g,.006,.124,M.dark,.15+i*.1,-.03,0,10);
  heatify(P,CX(g,.016,1.14,M.metal,1.14,.01,0,16)); CX(g,.034,.24,M.dark,.74,.01,0,16);
  for(let i=0;i<6;i++) CX(g,.036,.012,M.metal,.66+i*.035,.01,0,16);
  CX(g,.022,.05,M.dark,1.69,.01,0,16);
  B(g,.04,.09,.03,M.wood,.05,-.02,.05); B(g,.04,.09,.03,M.wood,.05,-.02,-.05); B(g,.06,.02,.12,M.metal,.09,-.02,0);
  const Bt=piv(g,.38,-.05,-.12); P.belt=Bt; B(Bt,.16,.12,.09,M.olive,0,0,0); for(let i=0;i<8;i++) CX(Bt,.006,.05,M.brass,-.08+i*.02,.08,.04,8);
  const Cv=piv(g,.12,.065,0); P.cover=Cv; B(Cv,.4,.012,.12,M.metal,.2,.006,0);
  B(g,.04,.05,.04,M.dark,.66,.1,0);
  const bolt=piv(g); P.bolt=bolt; B(bolt,.03,.03,.02,M.metal,.5,.0,.07);
  const t=G(); t.position.set(.42,-.1,0); g.add(t);
  B(t,.03,.06,.03,M.metal,0,0,0); B(t,.012,.62,.012,M.metal,-.2,-.25,0,.75); B(t,.012,.62,.012,M.metal,.22,-.25,.16,-.75,0,.3); B(t,.012,.62,.012,M.metal,.22,-.25,-.16,-.75,0,-.3);
  P.muzzle=mark(g,1.72,.01,0); P.eject=mark(g,.3,-.07,0);
  return g;
}

/* nome, categoria, calibre, capacidade, comprimento mm, cano mm, peso kg, construtor, opções */
const WEAP = [
 ['Glock 17','pis','9×19','17',202,114,.63,'pistol',{st:'glock',rel:.7}],
 ['Glock 18','pis','9×19','17/33',202,114,.62,'pistol',{st:'glock',sel:1,rpm:1200,rel:.9}],
 ['Glock 19','pis','9×19','15',185,102,.60,'pistol',{st:'glock',gl:.095,rel:.7}],
 ['Taurus G2C','pis','9×19','12',159,81,.62,'pistol',{st:'g2c',gl:.085,rel:1.5}],
 ['Taurus TS9','pis','9×19','17',194,104,.68,'pistol',{st:'taurus',rel:1.2}],
 ['Beretta 92FS','pis','9×19','15',217,125,.95,'pistol',{st:'beretta',h:.032,rel:.9}],
 ['SIG Sauer P226','pis','9×19','15',196,112,.96,'pistol',{st:'sig',h:.034,rel:.8}],
 ['CZ 75','pis','9×19','16',206,120,1.0,'pistol',{st:'cz',h:.03,rel:.9}],
 ['Taurus PT100','pis','.40 S&W','11',216,127,1.0,'pistol',{st:'pt100',stain:1,rel:1.2}],
 ['Colt M1911','pis','.45 ACP','7',216,127,1.10,'pistol',{st:'m1911',h:.029,gl:.1,rel:1.1}],
 ['Makarov PM','pis','9×18','8',161,94,.73,'pistol',{st:'makarov',h:.028,gl:.088,rel:.8}],
 ['FN Five-seveN','pis','5,7×28','20',208,122,.61,'pistol',{st:'fiveseven',gl:.12,rel:.9}],
 ['Desert Eagle Mark XIX','pis','.50 AE','7',270,152,1.99,'pistol',{st:'deagle',h:.04,gl:.125,deagle:1,steel:1,rel:1.8}],
 ['Taurus 82','rev','.38 SPL','6',240,102,.95,'revolver',{wood:1}],
 ['S&W 686','rev','.357 Magnum','7',244,102,1.14,'revolver',{steel:1}],
 ['S&W Model 29','rev','.44 Magnum','6',302,165,1.40,'revolver',{wood:1}],
 ['HK MP5A3','smg','9×19','30',700,225,2.54,'rifle',{mag:'curved',magLen:.72,stock:'retract',stockLen:.22,hR:.055,hg:'poly',hgFrac:.85,g3:1,rpm:800,sel:1}],
 ['Taurus SMT9','smg','9×19','30',660,200,2.5,'rifle',{mag:'box',stock:'retract',stockLen:.2,hg:'rail',hgFrac:.8,rail:1,rpm:750,sel:1}],
 ['HK UMP-45','smg','.45 ACP','25',690,200,2.30,'rifle',{mag:'box',magLen:1.1,stock:'skeleton',stockLen:.22,hR:.07,hg:'poly',hgFrac:.85,rpm:600,sel:1,rail:1}],
 ['Uzi','smg','9×19','32',650,260,3.50,'rifle',{mag:'box',magAt:.06,magLen:1.3,stock:'fold',stockLen:.2,hR:.065,hg:'poly',hgFrac:.4,grip:'none',rpm:600}],
 ['FN P90','smg','5,7×28','50',500,264,2.60,'p90',{rpm:900}],
 ['Kriss Vector','smg','.45 ACP','25',622,140,2.70,'rifle',{mag:'box',magLen:1.1,stock:'retract',stockLen:.2,hR:.085,hg:'rail',hgFrac:.9,rail:1,scope:1,rpm:1100}],
 ['Thompson M1A1','smg','.45 ACP','30',813,267,4.80,'rifle',{wood:1,mag:'box',magLen:1.2,stock:'fixed',stockLen:.3,hg:'none',hR:.055,jacket:1,rpm:700,charge:1}],
 ['CZ Scorpion EVO 3','smg','9×19','30',670,196,2.77,'rifle',{mag:'box',curve:0.05,magLen:1.2,stock:'fold',stockLen:.22,hg:'rail',hgFrac:.85,rail:1,scope:1,rpm:1150}],
 ['MAC-10','smg','.45 ACP','30',548,146,2.84,'rifle',{mag:'box',magAt:.04,magLen:1.2,stock:'fold',stockLen:.22,hR:.075,hg:'none',grip:'none',brake:2,rpm:1090,rel:1.4}],
 ['Remington 870','esc','12 ga','6+1',990,470,3.6,'rifle',{wood:1,stock:'wood',mag:'none',tube:1,pump:1,hg:'none',br:.0105,hR:.055,noFH:1}],
 ['Mossberg 500','esc','12 ga','5+1',990,470,3.2,'rifle',{stock:'fixed',mag:'none',tube:1,pump:1,hg:'none',br:.0105,hR:.055,noFH:1}],
 ['CBC Pump Military 3.0','esc','12 ga','7+1',1000,480,3.4,'rifle',{stock:'fixed',mag:'none',tube:1,tubeLen:.95,pump:1,hg:'none',br:.0105,hR:.055,rail:1,noFH:1}],
 ['Benelli M4','esc','12 ga','7+1',1010,470,3.82,'rifle',{stock:'retract',mag:'none',tube:1,hg:'poly',hgFrac:.55,br:.0105,hR:.06,rail:1,scope:1,noFH:1,charge:1}],
 ['Franchi SPAS-12','esc','12 ga','8+1',1041,546,4.40,'rifle',{stock:'fold',mag:'none',tube:1,pump:1,hg:'none',br:.0105,hR:.06,heat:1,noFH:1}],
 ['Kel-Tec KSG','esc','12 ga','7+7+1',660,470,3.10,'bullpup',{shot:1}],
 ['Saiga-12','esc','12 ga','8',1000,430,3.6,'rifle',{mag:'box',magLen:1.15,stock:'fixed',hg:'poly',br:.0105,hR:.07,gas:1,charge:1,ak:1,rel:1.3}],
 ['AA-12','esc','12 ga','8/20',966,457,5.2,'rifle',{mag:'drum',stock:'fixed',hg:'poly',hgFrac:.6,br:.0105,hR:.085,carry:1,rpm:300}],
 ['Boito (2 canos)','esc','12 ga','2',1130,710,3.2,'break',{}],
 ['AK-47','fuz','7,62×39','30',880,415,4.3,'rifle',{wood:1,stock:'wood',mag:'curved',hg:'wood',hgFrac:.42,gas:1,charge:1,ak:1,rod:1,bayo:1,rpm:600,rel:.4}],
 ['AKM','fuz','7,62×39','30',880,415,3.1,'rifle',{wood:1,stock:'wood',mag:'curved',hg:'wood',hgFrac:.42,gas:1,charge:1,ak:1,rod:1,rpm:600,magMat:'bakelite',rel:.45}],
 ['AK-74','fuz','5,45×39','30',943,415,3.3,'rifle',{stock:'fixed',mag:'curved',hg:'poly',hgFrac:.42,gas:1,charge:1,brake:1,ak:1,rod:1,rpm:650,magMat:'bakelite'}],
 ['AK-12','fuz','5,45×39','30',945,415,3.5,'rifle',{stock:'retract',mag:'curved',hg:'rail',hgFrac:.5,rail:1,brake:1,scope:1,charge:1,ak:1,rpm:700,magMat:'poly'}],
 ['IMBEL IA2','fuz','5,56×45','30',850,330,3.4,'rifle',{stock:'fold',mag:'box',curve:0.07,magLen:1.25,hg:'poly',hgFrac:.6,rail:1,charge:1,rpm:700}],
 ['Taurus T4','fuz','5,56×45','30',840,368,3.0,'rifle',{stock:'retract',mag:'box',curve:0.07,magLen:1.3,hg:'rail',hgFrac:.7,rail:1,scope:1,ar:1,rpm:750}],
 ['Colt M4A1','fuz','5,56×45','30',840,368,2.9,'rifle',{stock:'retract',mag:'box',curve:0.07,magLen:1.3,hg:'rail',hgFrac:.6,rail:1,scope:2,ar:1,rpm:800}],
 ['Colt M16A2','fuz','5,56×45','30',1000,508,3.4,'rifle',{stock:'fixed',mag:'box',curve:0.07,magLen:1.3,hg:'poly',hgFrac:.55,carry:1,ar:1,rpm:800,burst:3}],
 ['HK416','fuz','5,56×45','30',900,368,3.5,'rifle',{stock:'retract',mag:'box',curve:0.07,magLen:1.3,hg:'rail',hgFrac:.75,rail:1,scope:1,ar:1,rpm:850}],
 ['Steyr AUG A1','fuz','5,56×45','30',790,508,3.6,'bullpup',{rpm:680}],
 ['FN FAL','fuz','7,62×51','20',1090,533,4.3,'rifle',{stock:'fixed',mag:'box',curve:0.05,magLen:1.05,hg:'poly',hgFrac:.45,carry:1,brake:1,charge:1,rpm:650}],
 ['HK G3A3','fuz','7,62×51','20',1025,450,4.4,'rifle',{stock:'fixed',mag:'box',curve:0.07,magLen:1.05,hg:'poly',hgFrac:.55,hR:.058,g3:1,rpm:550}],
 ['SKS','fuz','7,62×39','10',1020,520,3.85,'rifle',{wood:1,stock:'trad',mag:'internal',fore:.55,gas:1,charge:1,bayo:1}],
 ['M14 EBR','dmr','7,62×51','20',1000,457,5.1,'rifle',{stock:'retract',mag:'box',curve:0.035,magLen:1.05,hg:'rail',hgFrac:.7,rail:1,scope:3,olive:1,charge:1}],
 ['SVD Dragunov','dmr','7,62×54R','10',1225,620,4.3,'rifle',{wood:1,stock:'skeleton',stockLen:.32,mag:'box',curve:0.09,magLen:.9,hg:'wood',hgFrac:.4,scope:4,brake:1,ak:1,charge:1}],
 ['FN SCAR-H','dmr','7,62×51','20',965,400,3.6,'rifle',{tan:1,stock:'fold',mag:'box',magLen:1.05,hg:'rail',hgFrac:.7,hR:.07,rail:1,scope:2,charge:1,rpm:600}],
 ["Knight's SR-25 (Mk 11)",'dmr','7,62×51','20',1156,508,4.5,'rifle',{stock:'fixed',mag:'box',magLen:1.0,hg:'rail',hgFrac:.75,rail:1,scope:3,bipod:1,ar:1}],
 ['HK PSG-1','dmr','7,62×51','5/20',1208,650,7.2,'rifle',{stock:'fixed',stockLen:.3,mag:'box',curve:0.06,magLen:.75,hg:'poly',hgFrac:.55,hR:.058,g3:1,scope:3,rel:.7}],
 ['Steyr SSG 69','snp','7,62×51','5',1140,650,3.9,'rifle',{olive:1,stock:'trad',mag:'internal',scope:3,bolt:1,round:1,rel:.6}],
 ['Barrett MRAD','snp','.338 Lapua','10',1260,686,6.9,'rifle',{tan:1,stock:'fold',stockLen:.33,mag:'box',magLen:.75,hg:'rail',hgFrac:.55,rail:1,scope:3,bolt:1,bipod:1,brake:1,round:1}],
 ['CheyTac M200','snp','.408 CheyTac','7',1397,737,14,'rifle',{stock:'retract',stockLen:.3,mag:'box',magLen:.85,hg:'poly',hgFrac:.55,hR:.07,scope:4,bolt:1,bipod:1,brake:1,round:1}],
 ['Remington 700','snp','.308','4',1100,610,3.6,'rifle',{wood:1,stock:'trad',mag:'internal',scope:3,bolt:1,round:1}],
 ['M24 SWS','snp','7,62×51','5',1092,610,5.4,'rifle',{olive:1,stock:'trad',mag:'internal',scope:3,bolt:1,bipod:1,round:1}],
 ['Mosin-Nagant 91/30','snp','7,62×54R','5',1232,730,4.0,'rifle',{wood:1,stock:'trad',mag:'internal',fore:.85,bolt:1,round:1,bands:1}],
 ['Accuracy AWM','snp','.338 Lapua','5',1230,686,6.9,'rifle',{olive:1,stock:'skeleton',stockLen:.34,mag:'box',magLen:.6,hg:'poly',hgFrac:.3,scope:3,bolt:1,bipod:1,brake:1,round:1}],
 ['Sako TRG-42','snp','.338 Lapua','5',1200,690,5.1,'rifle',{stock:'fixed',stockLen:.33,mag:'box',magLen:.6,hg:'poly',hgFrac:.3,scope:3,bolt:1,bipod:1,brake:1,round:1}],
 ['Barrett M82A1','snp','.50 BMG','10',1448,737,14,'rifle',{stock:'fixed',stockLen:.3,mag:'box',magLen:.8,hg:'poly',hgFrac:.55,hR:.1,wR:.05,br:.014,scope:3,bipod:1,brake:2,carry:1,charge:1}],
 ['Ruger 10/22','cac','.22 LR','10/25',940,470,2.3,'rifle',{wood:1,stock:'trad',mag:'internal',hR:.05,br:.007,charge:1}],
 ['CBC 7022','cac','.22 LR','10',1000,530,2.0,'rifle',{stock:'trad',mag:'internal',hR:.05,br:.007,charge:1}],
 ['CBC 122','cac','.22 LR','10',1030,590,2.4,'rifle',{wood:1,stock:'trad',mag:'internal',hR:.045,br:.007,bolt:1,round:1}],
 ['Winchester 1894','cac','.30-30','7',965,508,3.0,'rifle',{wood:1,stock:'straight',mag:'none',tube:1,lever:1,hR:.05,fore:0,bands:1}],
 ['Rossi Puma','cac','.38 SPL / .357','10',950,508,2.7,'rifle',{wood:1,stock:'straight',mag:'none',tube:1,lever:1,hR:.048,fore:0}],
 ['Rifle de caça .30-06','cac','.30-06','4',1100,560,3.6,'rifle',{wood:1,stock:'trad',mag:'internal',scope:3,bolt:1,round:1}],
 ['FN Minimi','mtr','5,56×45','200',1040,465,7.1,'rifle',{stock:'fixed',mag:'belt',hg:'poly',hgFrac:.35,bipod:1,hR:.08,carry:1,charge:1,rpm:850}],
 ['PKM','mtr','7,62×54R','100',1173,658,7.5,'rifle',{wood:1,stock:'skeleton',mag:'belt',hg:'none',bipod:1,hR:.08,br:.01,charge:1,rpm:650}],
 ['M60','mtr','7,62×51','100',1105,560,10.5,'rifle',{stock:'fixed',mag:'belt',hg:'poly',hgFrac:.3,bipod:1,hR:.085,br:.011,charge:1,rpm:550,rel:1.3}],
 ['RPG-7','lan','PG-7V 40/85 mm','1',950,950,6.3,'launcher',{lt:'rpg'}],
 ['M72 LAW','lan','66 mm HEAT','1',881,881,2.5,'launcher',{lt:'m72'}],
 ['AT4','lan','84 mm HEAT','1',1020,1020,6.7,'launcher',{lt:'at4'}],
 ['Carl Gustaf M4','lan','84 mm (HE / HEAT)','1',950,950,6.6,'launcher',{lt:'carl'}],
 ['Lança-chamas M2','lan','Napalm / gasolina gel','9 s',1000,620,32,'launcher',{lt:'flame'}],
 ['Lança-chamas caseiro','lan','Gasolina + extintor pressurizado','5 s',800,660,6,'launcher',{lt:'flameDIY'}],
 ['Browning M2 .50','mtr','.50 BMG','100',1650,1140,38,'m2',{rpm:550}]
];
const CATS = {pis:'Pistolas',rev:'Revólveres',smg:'Submetralhadoras',esc:'Escopetas',fuz:'Fuzis',dmr:'Fuzis de precisão',snp:'Snipers',cac:'Caça e civil',mtr:'Metralhadoras',lan:'Lança-foguetes e chamas'};
const MAGMAT = {bakelite:mat(0x6a2e1c,.6,0), poly:mat(0x2a2a26,.85,0)};
/* ---------- lança-foguetes e lança-chamas (medidas reais, em metros) ---------- */
const LM={yel:mat(0xb08f22,.6,0), red:mat(0x8e1c14,.45,.1), redP:mat(0xa3231a,.35,.2), tape:mat(0x8a8c88,.9,0), copper:mat(0x9a5a32,.35,.8), green:mat(0x3a4428,.75,.05)};
function hose(g,pts,r,m){ const c=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))); const o=sh(new T.Mesh(new T.TubeGeometry(c,40,r,8,false),m)); g.add(o); return o; }
function pilot(g,x,y){ const f=CX(g,.006,.03,M.fire2,x+.015,y,0,6,0); f.userData.flame=1; const f2=CX(g,.004,.022,M.fire,x+.012,y,0,6,0); f2.userData.flame=1; }
function pg7(){ const r=G(); CX(r,.018,.15,M.olive,-.05,0,0,14); CX(r,.02,.07,M.olive,.035,0,0,18,.0425); CX(r,.0425,.12,M.olive,.13,0,0,20); CX(r,.0428,.012,M.dark,.09,0,0,20); CX(r,.0425,.13,M.olive,.255,0,0,20,.011); CX(r,.011,.03,M.metal,.335,0,0,10,.004); return r; }
function ffv(){ const r=G(); CX(r,.041,.32,LM.green,-.16,0,0,20); CX(r,.0415,.02,LM.yel,-.05,0,0,20); CX(r,.041,.12,LM.green,.06,0,0,20,.012); CX(r,.043,.03,M.brass,-.33,0,0,20); return r; }
function rocketBody(t){ const r=G(); const d=t==='at4'||t==='carl'?.041:.032; CX(r,d*.5,.2,M.dark,-.1,0,0,10); CX(r,d,.3,M.olive,.15,0,0,18); CX(r,d,.12,M.olive,.36,0,0,18,d*.25); for(let i=0;i<4;i++){ const f=B(r,.06,.002,d*1.4,M.metal,-.17,0,0); f.rotation.x=i*PI/4; } return r; }
function launcher(o){
  const g=G(), P=g.userData, t=o.lt; P.fam=t==='flame'||t==='flameDIY'?'flame':'rocket'; P.lt=t; P.glow=[];
  if(t==='rpg'){ P.kick=1.6;
    CX(g,.036,.13,M.dark,.065,0,0,20,.021); CX(g,.038,.012,M.metal,.0,0,0,20);
    heatify(P,CX(g,.021,.83,M.steel,.545,0,0,18));
    CX(g,.03,.3,M.wood,.47,0,0,16); CX(g,.031,.012,M.metal,.32,0,0,16); CX(g,.031,.012,M.metal,.62,0,0,16); CX(g,.024,.02,M.metal,.94,0,0,16);
    B(g,.09,.03,.032,M.metal,.46,-.028,0);
    const g1=piv(g,.40,-.04,0); g1.rotation.z=-.22; B(g1,.03,.1,.03,M.wood,0,-.05,0);
    const g2=piv(g,.5,-.04,0); g2.rotation.z=-.18; B(g2,.03,.1,.03,M.wood,0,-.05,0);
    B(g,.06,.004,.012,M.metal,.53,-.05,0); B(g,.004,.025,.012,M.metal,.56,-.04,0); P.trigger=B(g,.004,.018,.004,M.dark,.535,-.045,0,.15);
    const hm=piv(g,.44,-.012,0); P.hammer=hm; B(hm,.012,.02,.01,M.dark,0,0,0);
    B(g,.006,.03,.006,M.dark,.78,.032,0); B(g,.02,.022,.014,M.dark,.46,.032,0);
    B(g,.12,.042,.032,M.dark,.5,.04,-.04); CX(g,.013,.05,M.rubber,.42,.048,-.04,14); CX(g,.016,.004,M.lens,.565,.048,-.04,14); B(g,.04,.012,.012,M.metal,.5,.016,-.03);
    P.round=pg7(); P.round.position.x=.95; g.add(P.round); P.round.userData.x0=.95; P.mkRound=pg7;
    P.muzzle=piv(g,.95,0,0); P.rear=piv(g,0,0,0); }
  if(t==='m72'){ P.kick=1.1; P.disp=1;
    heatify(P,CX(g,.0365,.6,M.olive,.58,0,0,20)); CX(g,.032,.32,M.olive,.16,0,0,20);
    CX(g,.039,.03,M.rubber,.866,0,0,20); CX(g,.035,.025,M.rubber,.012,0,0,20); CX(g,.037,.015,LM.yel,.8,0,0,20); CX(g,.037,.012,M.dark,.3,0,0,20);
    B(g,.004,.05,.05,M.dark,.79,.055,0); B(g,.004,.006,.04,M.dark,.79,.078,0); B(g,.004,.035,.024,M.dark,.38,.05,0); CY(g,.004,.006,M.lens,.38,.064,0,8);
    P.trigger=B(g,.05,.016,.024,M.rubber,.5,.042,0); B(g,.1,.01,.03,M.dark,.47,.036,0);
    B(g,.02,.03,.01,M.dark,.66,-.035,.03); B(g,.008,.03,.008,M.metal,.25,-.04,.03);
    P.muzzle=piv(g,.881,0,0); P.rear=piv(g,0,0,0); }
  if(t==='at4'){ P.kick=1.3; P.disp=1;
    heatify(P,CX(g,.05,.86,M.olive,.51,0,0,24));
    CX(g,.056,.08,M.dark,.98,0,0,24); CX(g,.058,.07,M.dark,.04,0,0,24,.05); CX(g,.051,.015,LM.yel,.86,0,0,24);
    B(g,.16,.026,.05,M.dark,.42,.058,0); B(g,.03,.012,.016,LM.red,.47,.075,0); P.trigger=B(g,.022,.012,.018,M.rubber,.5,.074,0);
    B(g,.012,.07,.02,M.dark,.35,.09,-.035); B(g,.012,.05,.02,M.dark,.71,.08,-.035);
    const fg=piv(g,.68,-.05,0); fg.rotation.z=-.15; B(fg,.035,.11,.032,M.dark,0,-.05,0);
    B(g,.14,.035,.06,M.rubber,.32,-.06,0); B(g,.3,.012,.055,M.dark,.5,-.05,0);
    P.muzzle=piv(g,1.02,0,0); P.rear=piv(g,0,0,0); }
  if(t==='carl'){ P.kick=1.4;
    heatify(P,CX(g,.045,.72,M.dark,.59,0,0,24)); CX(g,.05,.04,M.rubber,.93,0,0,24);
    const br=piv(g,.21,0,.05); P.breech=br; CX(br,.06,.16,M.dark,-.1,0,-.05,24,.046); CX(br,.062,.015,M.metal,-.18,0,-.05,24);
    B(g,.025,.03,.02,M.metal,.22,0,.052);
    const fg=piv(g,.62,-.05,0); fg.rotation.z=-.2; B(fg,.035,.11,.034,M.dark,0,-.05,0); P.trigger=B(g,.004,.018,.004,M.dark,.66,-.06,0,.15); B(g,.06,.004,.012,M.metal,.66,-.07,0);
    const rg=piv(g,.4,-.05,0); rg.rotation.z=-.25; B(rg,.035,.1,.034,M.dark,0,-.05,0); B(g,.13,.04,.07,M.rubber,.28,-.065,0);
    B(g,.16,.05,.045,M.dark,.56,.07,-.035); CX(g,.016,.05,M.rubber,.46,.075,-.035,14); CX(g,.02,.004,M.lens,.645,.075,-.035,14); B(g,.06,.02,.02,M.metal,.56,.04,-.03);
    B(g,.22,.01,.02,M.dark,.6,.06,.03); B(g,.01,.03,.02,M.dark,.5,.05,.03); B(g,.01,.03,.02,M.dark,.7,.05,.03);
    P.mkRound=ffv; P.muzzle=piv(g,.95,0,0); P.rear=piv(g,.05,0,0); }
  if(t==='flame'){ P.kick=.15;
    heatify(P,CX(g,.016,.62,M.steel,.42,0,0,14)); CX(g,.022,.1,M.dark,.78,0,0,14); heatify(P,CX(g,.013,.1,M.steel,.88,0,0,12,.009)); CX(g,.018,.02,M.metal,.73,0,0,14);
    CX(g,.012,.06,M.metal,.84,-.025,0,10); pilot(g,.92,-.012);
    const fg=piv(g,.6,-.02,0); fg.rotation.z=-.1; B(fg,.03,.1,.03,M.wood,0,-.05,0); const lv=piv(g,.62,-.02,0); P.trigger=B(lv,.008,.05,.006,M.metal,.02,-.03,0,.3);
    const rg=piv(g,.17,-.02,0); rg.rotation.z=-.28; B(rg,.03,.1,.03,M.wood,0,-.05,0); B(g,.05,.004,.012,M.metal,.2,-.035,0);
    CX(g,.02,.04,M.metal,.1,0,0,12); hose(g,[[.08,0,0],[.0,-.04,0],[-.08,-.2,.05],[-.18,-.32,.08],[-.25,-.33,.08]],.011,M.rubber);
    [-.1,.1].forEach(z=>{ CY(g,.085,.5,M.olive,-.3,-.05,z,20); SP(g,.085,M.olive,-.3,.2,z,2).scale.y=.45; SP(g,.085,M.olive,-.3,-.3,z,2).scale.y=.45; CY(g,.03,.03,M.metal,-.3,.24,z,12); });
    SP(g,.075,M.olive,-.3,.1,0,2).position.x=-.39; B(g,.03,.6,.24,M.dark,-.4,-.05,0); CY(g,.03,.012,M.metal,-.39,.18,0,14); const gz=piv(g,-.39,.18,.003); P.gauge=gz; B(gz,.002,.022,.002,LM.red,0,.008,.012);
    P.muzzle=piv(g,.94,0,0); P.rear=piv(g,.1,0,0); }
  if(t==='flameDIY'){ P.kick=.12;
    heatify(P,CX(g,.011,.66,LM.copper,.38,0,0,12)); heatify(P,CX(g,.015,.06,M.steel,.74,0,0,12,.01)); CX(g,.006,.05,M.metal,.735,-.02,0,8); pilot(g,.77,-.02);
    CY(g,.012,.04,LM.redP,.72,-.055,0,10); B(g,.02,.03,.012,M.dark,.72,-.085,0);
    CX(g,.06,.42,LM.redP,.3,-.09,0,22); SP(g,.06,LM.redP,.51,-.09,0,2).scale.x=.5; SP(g,.06,LM.redP,.09,-.09,0,2).scale.x=.5; CX(g,.02,.04,M.dark,.04,-.09,0,12); B(g,.02,.06,.005,M.white,.3,-.09,.06);
    [.15,.3,.45].forEach(x=>CX(g,.063,.03,LM.tape,x,-.09,0,22)); CX(g,.016,.03,LM.tape,.3,0,0,12);
    hose(g,[[.04,-.09,0],[-.02,-.06,.02],[.0,0,.02],[.05,0,0]],.007,M.rubber);
    const rg=piv(g,.12,-.01,0); rg.rotation.z=-.3; B(rg,.03,.1,.03,M.wood,0,-.05,0); const lv=piv(g,.17,-.02,0); P.trigger=B(lv,.008,.04,.006,M.metal,0,-.02,0,.2);
    P.muzzle=piv(g,.78,0,0); P.rear=piv(g,.05,0,0); }
  P.eject=P.muzzle; return g;
}
const FLM=[basic(0xff7a22,{transparent:true,opacity:.9,depthWrite:false}),basic(0xffc040,{transparent:true,opacity:.9,depthWrite:false}),basic(0xc8361a,{transparent:true,opacity:.8,depthWrite:false}),basic(0xfff0b0,{transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false})];
function flameBit(p,v,s,life){ const m=new T.Mesh(new T.IcosahedronGeometry(s,1),FLM[Math.random()*4|0].clone()); m.position.copy(p); m.rotation.set(Math.random()*3,Math.random()*3,0); particle(m,v,{grav:-1.4,life,fade:1,op0:.9,grow:2.2,drag:1.4,r:-1,w:new T.Vector3(3,4,2)}); }
function smokeBit(p,v,s,life,op,dark){ const m=new T.Mesh(new T.SphereGeometry(s,8,6),(dark?M.smoke:M.smokeP).clone()); m.position.copy(p); particle(m,v,{grav:-.15,life,fade:1,op0:op,grow:1.4,drag:1.2,r:-1}); }
function groundFire(p){ const g=G(); g.position.set(p.x,groundY+.005,p.z); fx.add(g); const fl=[]; for(let i=0;i<3;i++){ const f=new T.Mesh(new T.ConeGeometry(.02,.07,6),FLM[i%2].clone()); f.position.set((Math.random()-.5)*.04,.035,(Math.random()-.5)*.04); g.add(f); fl.push(f); }
  tw(0,4,(e,p)=>{ fl.forEach((f,i)=>{ f.scale.set(1-p*.7,(.6+Math.sin(performance.now()*.02+i*2)*.35)*(1-p),1-p*.7); }); if(Math.random()<.08) smokeBit(g.position.clone().add(new T.Vector3(0,.08,0)),new T.Vector3(0,.15,0),.015,1.2,.25,1); if(p>=1) fx.remove(g); }); }
function fireHeavy(){
  const P=W.P,f=P.fam; W.busy=true; stopRot(); if(P.trigger) pull(P.trigger); W.ammo--;
  const fwd=new T.Vector3(1,0,0).transformDirection(W.wrap.matrixWorld).normalize(), mp=()=>P.muzzle.getWorldPosition(new T.Vector3());
  if(f==='flame'){ const S=P.lt==='flame'?1:.6; let last=0; status('Jato de fogo');
    tw(0,1,(e,p)=>{ const dp=p-last, n=Math.floor(dp*420*S); if(n<=0) return; last=p; const m=mp(); W.heat=Math.min(140,W.heat+.4);
      mflash.position.copy(m).addScaledVector(fwd,.5*S); mflash.intensity=3+Math.random()*2; mflash.distance=3;
      for(let i=0;i<n;i++){ const sp=(2.2+Math.random()*1.1)*S; flameBit(m.clone().addScaledVector(fwd,Math.random()*sp*Math.min(dp,.3)),fwd.clone().multiplyScalar(sp).add(new T.Vector3((Math.random()-.5)*.35,(Math.random()-.3)*.3,(Math.random()-.5)*.35)),.02+Math.random()*.022,.4+Math.random()*.35); }
      if(Math.random()<.5) smokeBit(m.clone().addScaledVector(fwd,1.1*S+Math.random()*.4),new T.Vector3(fwd.x*.6,.35,fwd.z*.6),.03,1.6,.4,1);
      if(Math.random()<.18){ const d=new T.Mesh(new T.SphereGeometry(.006,6,4),FLM[0].clone()); d.position.copy(m).addScaledVector(fwd,.3+Math.random()*.5); particle(d,fwd.clone().multiplyScalar(1.2*S).add(new T.Vector3(0,.2,0)),{life:3,r:.003,onGround:groundFire}); }
      if(p>=1){ mflash.intensity=0; } });
    tw(1.05,0,()=>{ W.busy=false; status(W.ammo?'':'Combustível acabou. Aperte Recarregar.'); updAmmo(); }); updAmmo(); return true; }
  const m0=mp(); muzzleFlash(m0,2.2); recoil(); W.heat=Math.min(140,W.heat+35);
  const rear=P.rear.getWorldPosition(new T.Vector3());
  for(let i=0;i<26;i++){ smokeBit(rear.clone(),fwd.clone().multiplyScalar(-(1.5+Math.random()*3)).add(new T.Vector3((Math.random()-.5)*1.4,(Math.random()-.3)*.8,(Math.random()-.5)*1.4)),.03+Math.random()*.03,1.8+Math.random()*1.4,.5); }
  for(let i=0;i<14;i++) flameBit(rear.clone(),fwd.clone().multiplyScalar(-(2+Math.random()*2)).add(new T.Vector3((Math.random()-.5),(Math.random()-.5)*.6,(Math.random()-.5))),.02,.25);
  let rk; if(P.round){ rk=P.mkRound(); P.round.visible=false; } else rk=P.mkRound?P.mkRound():rocketBody(P.lt);
  rk.quaternion.copy(W.wrap.getWorldQuaternion(new T.Quaternion())); rk.position.copy(m0); fx.add(rk);
  const ex=new T.Mesh(new T.ConeGeometry(.018,.12,8,1,true),FLM[1]); ex.rotation.z=PI/2; ex.position.x=-.08; rk.add(ex);
  const lt=new T.PointLight(0xff9a40,3,2.5); rk.add(lt);
  tw(0,1.6,(e,p)=>{ const tt=p*1.6, d=1.2*tt+(tt>.25?9*(tt-.25)*(tt-.25):0); rk.position.copy(m0).addScaledVector(fwd,d); rk.rotation.x+=.25; ex.scale.set(1,.6+Math.random()*.8,1);
    if(Math.random()<.9) smokeBit(rk.position.clone().addScaledVector(fwd,-.12),new T.Vector3((Math.random()-.5)*.1,.05,(Math.random()-.5)*.1),.02+Math.random()*.015,2.2,.5);
    if(p>=1){ fx.remove(rk); } });
  if(P.disp){ status('Tubo descartável vazio. Aperte Recarregar para pegar outro.'); }
  tw(.4,0,()=>{ W.busy=false; updAmmo(); }); updAmmo(); return true;
}
function heavyReload(){
  const P=W.P; W.busy=true; stopRot(); let t=0;
  if(P.fam==='flame'){ status('Trocando o tanque…'); const gz=P.gauge; if(gz) tw(0,1,e=>gz.rotation.z=-2.4*(1-e)); t=1.1; }
  else if(P.disp){ status('Largando o tubo vazio…'); const old=W.wrap.clone(); old.position.copy(W.wrap.getWorldPosition(new T.Vector3())); old.quaternion.copy(W.wrap.getWorldQuaternion(new T.Quaternion())); W.wrap.visible=false;
    particle(old,new T.Vector3(.2,.4,.6),{w:new T.Vector3(0,.8,2.5),life:8,r:.05,bounce:.2,onRest:o=>{}});
    const y0=W.wrap.position.y; tw(.6,0,()=>{ W.wrap.position.y=y0-.6; W.wrap.visible=true; }); tw(.6,.5,e=>W.wrap.position.y=y0-.6*(1-e)); t=1.15; }
  else if(P.round){ status('Encaixando o foguete…'); const r=P.round, x0=r.userData.x0; r.visible=true; tw(0,.55,e=>{ r.position.x=x0+.45*(1-e); r.position.y=.12*(1-e); }); t=.6; }
  else if(P.breech){ status('Abrindo a culatra…'); const br=P.breech; tw(0,.25,e=>br.rotation.y=-1.6*e);
    const rd=P.mkRound(); tw(.3,0,()=>{ W.wrap.userData.inner.add(rd); rd.position.set(-.25,0,0); rd.userData.k=1; });
    tw(.32,.4,e=>{ rd.position.x=-.25+.6*e; }); tw(.74,0,()=>rd.parent&&rd.parent.remove(rd)); tw(.76,.22,e=>br.rotation.y=-1.6*(1-e)); t=1.05; }
  tw(t,0,()=>{ W.ammo=W.cap; updAmmo(); W.busy=false; status(''); });
}

function buildWeapon(w){
  const [n,c,cal,cap,L,Bl,kg,k,o0]=w, o=Object.assign({L:L,B:Bl,cal:cal},o0);
  if(typeof o.magMat==='string') o.magMat=MAGMAT[o.magMat];
  if(k==='launcher'){ const g=launcher(o), wr=G(); wr.add(g); const b=new T.Box3().setFromObject(g); g.position.x=-b.min.x; wr.userData.inner=g; return wr; }
  const g = k==='pistol'?pistol(o):k==='revolver'?revolver(o):k==='bullpup'?bullpup(o):k==='p90'?p90():k==='break'?shotgunBreak(o):k==='m2'?m2():rifle(o);
  const wr=fitLength(g,L/1000); wr.userData.inner=g; return wr;
}
function caseType(cal){ if(/12 ga/.test(cal)) return 'shell'; if(/\.50 BMG|\.408/.test(cal)) return 'big'; if(/\.22/.test(cal)) return 'tiny'; if(/×19|×18|ACP|S&W|SPL|Magnum|AE|\.357|\.380/.test(cal)) return 'pistol'; return 'rifle'; }
function kickOf(cal){ return {shell:1.6,big:2.4,tiny:.3,pistol:.7,rifle:1.1}[caseType(cal)]; }
function capOf(s){ return String(s).split('/')[0].split('+').reduce((a,b)=>a+parseInt(b,10),0); }

/* ---------- munições (medidas em mm) ---------- */
/* nome, diâmetro do estojo, comprimento total, comprimento do estojo, diâmetro do projétil, tipo */
const AMMO = [
 ['.22 LR',5.7,25.4,15.6,5.7,'rim'], ['.380 ACP',9.5,25,17.3,9.0,'p'], ['9×18 Makarov',9.9,25.3,18,9.3,'p'],
 ['9×19 mm',9.9,29.7,19.15,9.0,'p'], ['.40 S&W',10.8,28.6,21.6,10.2,'p'], ['.45 ACP',12.0,32.4,22.8,11.5,'p'],
 ['5,7×28 mm',7.9,40.5,28.9,5.7,'r'], ['.38 SPL',9.6,39.4,29.3,9.1,'rimp'], ['.357 Magnum',9.6,40.0,33.0,9.1,'rimp'],
 ['.44 Magnum',11.6,40.9,32.6,10.9,'rimp'], ['.50 AE',13.9,40.9,32.6,12.7,'p'], ['12 ga',20.0,70,70,18.5,'shell'],
 ['5,56×45 mm',9.6,57.4,44.7,5.7,'r'], ['5,45×39 mm',10.0,57,39.8,5.6,'r'], ['7,62×39 mm',11.3,56,38.7,7.9,'r'],
 ['.30-30 Win',10.7,64.8,51.8,7.8,'rr'], ['7,62×51 mm',12.0,71.1,51.2,7.8,'r'], ['7,62×54R',12.4,77.2,53.7,7.9,'rr'],
 ['.30-06',12.0,84.8,63.3,7.8,'r'], ['.300 Win Mag',13.0,84.8,66.5,7.8,'r'], ['.338 Lapua',14.9,93.5,69.2,8.6,'r'],
 ['.50 BMG',20.4,138,99,13.0,'r']
];
function cartridge(a){
  const [n,d,oal,cl,bd,t]=a, g=G(), R=d/2, br=bd/2;
  if(t==='shell'){ CY(g,R,cl*.8,M.shell,0,cl*.6,0,14); CY(g,R*1.03,cl*.22,M.brass,0,cl*.11,0,14); CY(g,R*1.08,1.2,M.brass,0,.6,0,14); return g; }
  if(t==='rim'||t==='rimp'||t==='rr') CY(g,R*1.15,1.2,M.brass,0,.6,0,14);
  if(t==='r'||t==='rr'){
    const bodyH=cl*.78, sh=cl*.08, neck=cl-bodyH-sh, nr=br+.35;
    CY(g,R,bodyH,M.brass,0,bodyH/2,0,14); CY(g,nr,sh,M.brass,0,bodyH+sh/2,0,14,R); CY(g,nr,neck,M.brass,0,bodyH+sh+neck/2,0,14);
    const ex=oal-cl; CY(g,br,ex*.3,M.copper,0,cl+ex*.15,0,14); CY(g,br,ex*.7,M.copper,0,cl+ex*.3+ex*.35,0,14,br*.12);
  } else {
    CY(g,R,cl,M.brass,0,cl/2,0,14); const ex=oal-cl;
    CY(g,br,ex*.45,t==='rim'||t==='rimp'?M.lead:M.copper,0,cl+ex*.225,0,14);
    CY(g,br,ex*.55,t==='rim'||t==='rimp'?M.lead:M.copper,0,cl+ex*.45+ex*.275,0,14,br*.45);
  }
  return g;
}

/* ---------- explosivos ---------- */
const EXP = [
 ['Granada M67','granada', '300 no centro · letal 5 m · ferimento 15 m · destruição nível 2', 'Esfera de 64 mm, cerca de 400 g. Pavio de 4 s.'],
 ['Coquetel molotov','molotov', '15 de fogo por segundo · área 4 m · queima madeira', 'Garrafa de vidro, gasolina e pano. Feito na bancada.'],
 ['Bomba caseira','pipe', '220 no centro · letal 3 m · ferimento 10 m · nível 2', 'Cano de ferro com tampas, pólvora e pregos.'],
 ['Botijão de gás P13','p13', '350 no centro · letal 5 m · ferimento 14 m · nível 2 e fogo', 'Cerca de 36 cm de diâmetro e 46 cm de altura. Explode com tiro ou fogo.'],
 ['Dinamite','dyn', '400 no centro · letal 4 m · ferimento 12 m · nível 3', 'Feixe de 3 bananas com pavio. Pedreiras e mineração.'],
 ['C4 com detonador','c4', '600 no centro · letal 6 m · ferimento 18 m · nível 3', 'Bloco de 0,57 kg com detonador e fios. Base militar.'],
 ['Mina Claymore','claymore', '250 em cone de 60° · letal 15 m · nível 1', 'Caixa curva de 216 × 83 mm sobre 4 pés. Disparo por fio.'],
 ['Granada de luz','flash', 'Sem dano · atordoa por 4 s num raio de 10 m', 'Atrai todos os zumbis num raio de 400 m.'],
 ['Lança-granadas M79','m79', '200 no centro · letal 4 m · ferimento 12 m · nível 2', 'Arma basculante de 40 mm, cerca de 730 mm.'],
 ['Bazuca M72 LAW','m72', '500 no centro · letal 5 m · ferimento 15 m · nível 3', 'Tubo descartável estendido com 881 mm. Um tiro.'],
 ['AT4','at4', '650 no centro · letal 5 m · ferimento 16 m · nível 3', 'Tubo descartável de 1.020 mm. Fura blindados.'],
 ['RPG-7','rpg', '600 no centro · letal 5 m · ferimento 16 m · nível 3', 'Lançador de 950 mm com foguete PG-7V. Recarga de 4,5 s.']
];
function buildExp(k){
  const g=G();
  if(k==='granada'){ SP(g,.032,M.olive,0,.032,0,1); CY(g,.011,.022,M.metal,0,.072,0); B(g,.012,.07,.006,M.metal,.016,.05,0,.2); const t=new T.Mesh(new T.TorusGeometry(.0085,.0016,6,12),M.steel); t.position.set(-.012,.082,0); g.add(t); }
  if(k==='molotov'){ CY(g,.036,.17,M.bottle,0,.085,0,10); CY(g,.012,.06,M.bottle,0,.2,0,8,.036); B(g,.03,.08,.02,M.white,.005,.25,0,.3); const f=CY(g,.02,.07,M.fire,.01,.31,0,6,0); f.userData.flame=1; }
  if(k==='pipe'){ CX(g,.025,.2,M.metal,0,.03,0,8); CX(g,.031,.025,M.dark,-.1,.03,0,6); CX(g,.031,.025,M.dark,.1,.03,0,6); CY(g,.002,.06,M.white,.1,.07,0); }
  if(k==='p13'){ CY(g,.18,.3,M.gas,0,.21,0,14); SP(g,.18,M.gas,0,.36,0,1).scale.y=.4; CY(g,.17,.06,M.gas,0,.03,0,14); CY(g,.03,.05,M.steel,0,.45,0,8); const t=new T.Mesh(new T.TorusGeometry(.1,.012,6,14,PI),M.gas); t.position.set(0,.44,0); g.add(t); }
  if(k==='dyn'){ [[-.015,0],[.015,0],[0,.026]].forEach(p=>CX(g,.014,.2,M.dyn,0,.016+p[1],p[0],8)); CX(g,.031,.03,M.dark,-.04,.025,0,8); CX(g,.031,.03,M.dark,.05,.025,0,8); CX(g,.002,.1,M.white,.14,.03,0,4); }
  if(k==='c4'){ B(g,.28,.05,.11,M.c4,0,.025,0); B(g,.05,.03,.04,M.dark,.06,.065,0); CY(g,.004,.05,M.metal,.03,.07,0); B(g,.24,.003,.003,M.wire,.18,.055,.02); B(g,.24,.003,.003,M.metal,.18,.055,.03); }
  if(k==='claymore'){ [-1,0,1].forEach(i=>B(g,.075,.083,.035,M.olive,i*.072,.12,Math.abs(i)*.012,0,-i*.25)); [[-.07,.03],[-.07,-.03],[.07,.03],[.07,-.03]].forEach(p=>B(g,.004,.09,.004,M.metal,p[0],.04,p[1],p[0]>0?-.25:.25)); }
  if(k==='flash'){ CY(g,.022,.13,M.olive,0,.065,0,10); for(let i=0;i<4;i++) CY(g,.023,.008,M.dark,0,.025+i*.028,0,10); CY(g,.012,.02,M.metal,0,.14,0); B(g,.01,.08,.005,M.metal,.024,.1,0,.15); }
  if(k==='m79'){ const r=rifle({L:730,B:356,stock:'fixed',wood:1,mag:'none',hg:'wood',hgFrac:.4,br:.022,hR:.05}); g.add(fitLength(r,.73)); }
  if(k==='m72'){ CX(g,.033,.88,M.olive,.44,.05,0,12); CX(g,.038,.06,M.dark,.02,.05,0,12); CX(g,.038,.06,M.dark,.86,.05,0,12); B(g,.02,.05,.01,M.dark,.55,.1,0); B(g,.02,.05,.01,M.dark,.3,.1,0); }
  if(k==='at4'){ CX(g,.042,1.02,M.olive,.51,.06,0,12); CX(g,.048,.08,M.dark,.04,.06,0,12); CX(g,.052,.08,M.dark,.98,.06,0,12); B(g,.03,.09,.025,M.dark,.42,-.02,0,-.2); B(g,.12,.03,.02,M.dark,.55,.12,0); }
  if(k==='rpg'){ CX(g,.02,.95,M.metal,.475,.06,0,10); B(g,.3,.05,.05,M.wood,.45,.06,0); B(g,.03,.09,.028,M.wood,.42,-.01,0,-.2); B(g,.03,.08,.028,M.wood,.32,-.0,0,-.15); CX(g,.035,.12,M.dark,.0,.06,0,10,.022); CX(g,.042,.12,M.olive,1.0,.06,0,10); CX(g,.042,.22,M.olive,1.17,.06,0,10,0); B(g,.04,.05,.02,M.dark,.55,.11,0); }
  return g;
}

/* ---------- veículo ---------- */
const CST = [
 ['Intacto','Carro popular. Motor 300, tanque 150, pneus 60 cada, vidros 40, portas 200.'],
 ['Amassado','Para-choque e capô amassados por atropelar zumbis. Para-brisa trincado.'],
 ['Pneu furado, porta caída','Pneu dianteiro furado puxa o carro para o lado. A porta caiu e os vidros laterais quebraram: zumbis alcançam o motorista.'],
 ['Motor em chamas','Motor destruído pega fogo. Se o fogo chegar ao tanque, explode como um botijão grande.'],
 ['Queimado','Carcaça queimada. Sem rodas e sem vidros; serve só como barricada e para tirar peças.']
];
function car(st){
  const root=G(), g=G(); root.add(g);
  const cm = st>=4?M.charred:M.car, gl = st>=4?null:(st>=1?M.crack:M.glass), dark=st>=4?M.charred:M.poly;
  B(g,3.9,.62,1.66,cm,0,.6,0);
  const hood=B(g,.95,.1,1.6,cm,1.45,.95,0,-.1); if(st>=1){ hood.rotation.z=-.28; hood.position.y=1.0; }
  B(g,.55,.1,1.6,cm,-1.65,.95,0,.06);
  B(g,1.7,.07,1.42,cm,-.25,1.46,0);
  [[.62,.1],[-.25,0],[-1.1,-.1]].forEach(p=>{ B(g,.07,.5,.05,cm,p[0],1.18,.72,p[1]); B(g,.07,.5,.05,cm,p[0],1.18,-.72,p[1]); });
  if(gl){ B(g,.03,.6,1.36,gl,.83,1.18,0,.85); B(g,.03,.5,1.36,M.glass,-1.28,1.18,0,-.7); }
  if(st<2) B(g,1.5,.42,.02,M.glass,-.25,1.18,.715);
  if(st<4) B(g,1.5,.42,.02,M.glass,-.25,1.18,-.715);
  if(st<2) B(g,1.0,.72,.05,cm,.15,.75,.84); else if(st<4) B(root,1.0,.05,.72,cm,-.1,.03,1.75,0,.25);
  B(g,.12,.17,1.72,dark,1.98,.42,0, 0, st>=1?.14:0); B(g,.12,.17,1.72,dark,-1.98,.42,0);
  if(st<4){ B(g,.04,.12,.32,M.lamp,1.96,.74,.58); B(g,.04,.12,.32,st>=1?M.dark:M.lamp,1.96,.74,-.58); B(g,.04,.1,.3,M.tail,-1.96,.75,.6); B(g,.04,.1,.3,M.tail,-1.96,.75,-.6); }
  [[1.25,.79],[1.25,-.79],[-1.25,.79],[-1.25,-.79]].forEach((p,i)=>{
    if(st>=4){ CZ(g,.2,.12,M.charred,p[0],.2,p[1],8); return; }
    const flat = st>=2 && i===0;
    const w=CZ(g,.31,.21,M.rubber,p[0],flat?.22:.31,p[1],12); if(flat) w.scale.set(1.15,1,.6);
    CZ(g,.17,.22,M.chrome,p[0],flat?.22:.31,p[1],8);
  });
  if(st>=1){ const r=rng(3); for(let i=0;i<7;i++) B(g,.2+r()*.4,.015,.01,M.dark,-1.3+r()*2.6,.5+r()*.3,-.835); }
  if(st>=2) g.rotation.set(.025,0,.03);
  if(st>=3){ B(g,.6,.25,1.1,M.dark,1.4,.95,0); const r=rng(9); for(let i=0;i<9;i++){ const f=CY(root,.08+r()*.1,.35+r()*.4,i%2?M.fire:M.fire2,1.15+r()*.6,1.15,-.5+r(),6,0); f.position.y+=.15; f.userData.flame=1; } for(let i=0;i<10;i++){ const s=SP(root,.18+r()*.2,M.smoke,1.3+r()*.4,1.4+r()*2.4,-.3+r()*.6,0); s.castShadow=false; s.userData.smoke={base:1.4,spd:.25+r()*.3,h:2.6}; } }
  if(st>=4){ g.position.y=-.12; g.rotation.set(.03,0,-.02); const r=rng(5); for(let i=0;i<6;i++){ const e=SP(root,.03,M.fire,-1.5+r()*3,.08,-.9+r()*1.8,0); e.userData.flame=1; } }
  return root;
}

/* ---------- paredes e materiais ---------- */
const WMAT = {
  vidro:{n:'Vidro',d:'Vida 10 por placa · PEN 0,2 · barulho de vidro chama zumbis a 60 m'},
  madeira:{n:'Madeira',d:'Vida 200 por placa · PEN 1,0 · fraca contra machado, fogo e escopeta'},
  tijolo:{n:'Tijolo',d:'Vida 800 por placa · PEN 4,0 · marreta lenta ou explosivo nível 3'},
  concreto:{n:'Concreto armado',d:'Vida 2.000 por placa · PEN 6,0 · só C4, AT4 e RPG-7. Ferragem aparece quando rompe'}
};
const WST = [['Intacta','Sem dano.'],['Nível 1','Marcas de tiro e trincas. Peças soltas se mexem.'],['Nível 2','Rompida no centro: dá para passar e atirar pelo buraco.'],['Nível 3','Desabada. Os pedaços bloqueiam o chão e podem prender zumbis.']];
function wall(mk,st){
  const root=G(), r=rng(11+st), W=2.4, H=2.1; let pieces=[];
  if(mk==='tijolo'){ const bw=.23,bh=.075,bd=.11; const rows=Math.round(H/(bh+.01)), cols=10; for(let j=0;j<rows;j++) for(let i=0;i<cols+(j%2);i++){ const x=-W/2+(i+(j%2?0:.5))*(bw+.01); if(x<-W/2+.02||x>W/2-.02) continue; pieces.push({x,y:j*(bh+.01)+bh/2,w:bw,h:bh,d:bd,m:(i+j)%3?M.brick:M.brick2}); } }
  if(mk==='concreto'){ const bw=.6,bh=.42,bd=.2; for(let j=0;j<5;j++) for(let i=0;i<4;i++) pieces.push({x:-W/2+bw/2+i*bw,y:bh/2+j*bh,w:bw-.005,h:bh-.005,d:bd,m:M.concrete}); }
  if(mk==='madeira'){ const bw=.14,bh=H/4; for(let i=0;i<17;i++) for(let j=0;j<4;j++) pieces.push({x:-W/2+bw/2+i*bw,y:bh/2+j*bh,w:bw-.012,h:bh-.004,d:.03,m:i%2?M.plank:M.plank2}); B(root,W,.08,.05,M.plank2,0,.5,-.04); B(root,W,.08,.05,M.plank2,0,1.6,-.04); }
  if(mk==='vidro'){ const bw=1.1,bh=.95; B(root,W,.08,.08,M.frame,0,.04,0); B(root,W,.08,.08,M.frame,0,H-.04,0); B(root,.08,H,.08,M.frame,-W/2,H/2,0); B(root,.08,H,.08,M.frame,W/2,H/2,0); B(root,W,.06,.06,M.frame,0,H/2,0); B(root,.06,H,.06,M.frame,0,H/2,0);
    for(let j=0;j<2;j++) for(let i=0;i<2;i++){ const pane={x:-.575+i*1.15,y:.55+j*1.0}; const broken = st===3 || (st===2 && i===0); if(!broken) B(root,bw,bh,.01,st>=1&&i===1&&j===1?M.crack:M.glass,pane.x,pane.y,0);
      else { for(let k=0;k<24;k++) B(root,.04+r()*.12,.006,.03+r()*.1,M.glass,pane.x+(r()-.5)*1.2,.004,.2+r()*1.1,0,r()*PI); if(r()>.5) B(root,.3,.25,.01,M.glass,pane.x-.35,pane.y+.3,0,.3); } }
    if(st>=1) for(let k=0;k<5;k++) B(root,.015,.015,.012,M.hole,.3+r()*.5,1.2+r()*.5,0);
    return root; }
  const cx=0, cy=H*.45;
  pieces.forEach(p=>{
    const d=Math.hypot(p.x-cx,(p.y-cy)*1.1), q=r();
    let falls = (st===2 && d<.55+q*.15) || (st===3 && (p.y>H*(.18+q*.3) || d<.9));
    if(!falls){ const o=B(root,p.w,p.h,p.d,p.m,p.x,p.y,0); if(st>=1 && q>.9){ o.position.z=.01+q*.02; o.rotation.z=(q-.95)*.4; } return; }
    const fx=p.x*.8+(r()-.5)*.7, fz=.2+r()*(st===3?1.8:1.1);
    const o=B(root,p.w,p.h,p.d,p.m,fx,Math.min(p.w,p.h,p.d)/2,fz,(r()-.5)*.4,r()*PI,PI/2*(r()>.5?1:0));
    if(mk==='concreto' && r()>.4) o.scale.set(.5+r()*.5,.6+r()*.4,1);
  });
  if(st>=1){ for(let k=0;k<10;k++) B(root,.03,.03,.012,M.hole,(r()-.5)*1.6,.6+r()*1.2,(mk==='madeira'?.017:mk==='concreto'?.102:.057)); }
  if(mk==='concreto' && st>=2){ for(let k=-3;k<=3;k++) CY(root,.007,H*(st===3?.5:1),M.rebar,k*.18,H*(st===3?.25:.5),0,5); for(let k=1;k<6;k++) CX(root,.007,st===3?1.4:1.2,M.rebar,0,k*(st===3?.18:.33),0,5); }
  return root;
}

/* ---------- etiquetas e régua ---------- */
function label(text,h){
  const c=document.createElement('canvas'), x=c.getContext('2d'); const fs=44;
  x.font='500 '+fs+'px "IBM Plex Mono", monospace'; const tw=Math.ceil(x.measureText(text).width);
  c.width=tw+24; c.height=fs+20; x.font='500 '+fs+'px "IBM Plex Mono", monospace'; x.fillStyle='#e6e1d0'; x.textBaseline='middle'; x.fillText(text,12,c.height/2);
  const tex=new T.CanvasTexture(c); tex.anisotropy=4;
  const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false})); s.scale.set(h*c.width/c.height,h,1); s.renderOrder=5; s.userData.w=h*c.width/c.height; return s;
}
function ruler(len,step,txt,k){
  const g=G(); const t=.0018*k;
  const base=new T.Mesh(new T.BoxGeometry(len,t,t*2.5),M.ruler); base.position.set(len/2,0,0); g.add(base);
  const n=Math.round(len/step);
  for(let i=0;i<=n;i++){ const big=i%5===0; const m=new T.Mesh(new T.BoxGeometry(t*.8,t,big?t*14:t*7),M.ruler); m.position.set(Math.min(i*step,len),0,(big?t*7:t*3.5)); g.add(m); }
  const e=new T.Mesh(new T.BoxGeometry(t*.8,t,t*16),M.ruler); e.position.set(len,0,t*8); g.add(e);
  const lb=label(txt,.022*k); lb.position.set(len/2,t*4,t*26); g.add(lb);
  return g;
}

/* ---------- cena ---------- */
const host=$('#viewer');
const renderer=new T.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
host.insertBefore(renderer.domElement,host.firstChild);
const scene=new T.Scene(); scene.background=new T.Color(0x0d0f0b); scene.fog=new T.Fog(0x0d0f0b,10,40);
if(T.RoomEnvironment){ const pm=new T.PMREMGenerator(renderer); scene.environment=pm.fromScene(new T.RoomEnvironment(),.04).texture; }
const cam=new T.PerspectiveCamera(35,1,.01,100);
const ctl=new T.OrbitControls(cam,renderer.domElement); ctl.enableDamping=true; ctl.autoRotate=true; ctl.autoRotateSpeed=1.1;
scene.add(new T.HemisphereLight(0xa9ad96,0x1c1813,.35));
const sun=new T.DirectionalLight(0xffe3b8,1.6); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun); scene.add(sun.target);
const rim=new T.DirectionalLight(0x7f9bb8,.5); scene.add(rim);
const mflash=new T.PointLight(0xffb060,0,3,2); scene.add(mflash);
const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:new T.Color(0x16190f).convertSRGBToLinear(),roughness:1})); ground.rotation.x=-PI/2; ground.receiveShadow=true; scene.add(ground);
const fx=G(); scene.add(fx);
let grid=null, current=null, groundY=0, parts=[], tasks=[];

function clear(){ if(current){ scene.remove(current); current.traverse(o=>{ if(o.material&&o.material.map) o.material.map.dispose(); }); current=null; } fx.clear(); parts=[]; tasks=[]; mflash.intensity=0; }
function show(obj,view){
  clear(); current=obj; scene.add(obj);
  const b=new T.Box3().setFromObject(obj), size=new T.Vector3(), c=new T.Vector3(); b.getSize(size); b.getCenter(c);
  const R=Math.max(size.x,size.y,size.z);
  ground.position.y=b.min.y-R*.002; ground.scale.set(R*40,R*40,1); groundY=ground.position.y;
  if(grid){ scene.remove(grid); grid.geometry.dispose(); }
  const cell=Math.pow(10,Math.floor(Math.log10(R/2))); const gs=cell*40;
  grid=new T.GridHelper(gs,40,0x2c3224,0x1c2017); grid.position.set(c.x,ground.position.y+R*.001,c.z); scene.add(grid);
  const v=view||new T.Vector3(.35,.32,1); const dist=R/(2*Math.tan(cam.fov*PI/360))*1.15;
  cam.near=dist/200; cam.far=dist*30; cam.updateProjectionMatrix();
  scene.fog.near=dist*1.6; scene.fog.far=dist*6;
  ctl.target.copy(c); cam.position.copy(c).add(v.clone().normalize().multiplyScalar(dist)); ctl.minDistance=dist*.15; ctl.maxDistance=dist*4;
  sun.position.copy(c).add(new T.Vector3(R*.8,R*1.6,R*.9)); sun.target.position.copy(c);
  const sc=sun.shadow.camera; sc.left=-R*1.5;sc.right=R*1.5;sc.top=R*1.5;sc.bottom=-R*1.5;sc.near=R*.1;sc.far=R*6; sc.updateProjectionMatrix(); sun.shadow.bias=-.0004;
  rim.position.copy(c).add(new T.Vector3(-R,R*.5,-R));
}
function resize(){ const w=host.clientWidth,h=host.clientHeight; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host); resize();
const clock=new T.Clock();

/* ---------- efeitos e animação ---------- */
function ease(p){ return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2; }
function tw(delay,dur,fn){ tasks.push({s:clock.elapsedTime+delay,d:dur,fn}); }
function particle(o,v,opt){ if(o.parent!==fx) fx.add(o); parts.push(Object.assign({o,v,w:new T.Vector3(),life:2,age:0,grav:9.8,bounce:.3,drag:0,r:.003},opt||{})); if(parts.length>900){ const p=parts.shift(); fx.remove(p.o); } }
function stepParticles(dt){
  for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.age+=dt;
    if(p.age>p.life){ fx.remove(p.o); parts.splice(i,1); continue; }
    if(p.fade) p.o.material.opacity=Math.max(0,p.op0*(1-p.age/p.life));
    if(p.rest) continue;
    p.v.y-=p.grav*dt; if(p.drag) p.v.multiplyScalar(Math.max(0,1-p.drag*dt));
    p.o.position.addScaledVector(p.v,dt); p.o.rotation.x+=p.w.x*dt; p.o.rotation.y+=p.w.y*dt; p.o.rotation.z+=p.w.z*dt;
    if(p.grow) p.o.scale.multiplyScalar(1+p.grow*dt);
    if(p.r>=0 && p.o.position.y<groundY+p.r && p.v.y<0){
      if(p.onGround){ p.onGround(p.o.position.clone(),p.v.clone()); fx.remove(p.o); parts.splice(i,1); continue; }
      p.o.position.y=groundY+p.r; p.v.y*=-p.bounce; p.v.x*=.45; p.v.z*=.45; p.w.multiplyScalar(.45);
      if(Math.abs(p.v.y)<.18){ p.rest=true; if(p.onRest) p.onRest(p.o); }
    }
  }
}
function muzzleFlash(pos,k){
  const f=G(); f.position.copy(pos);
  const c=new T.Mesh(new T.ConeGeometry(.013*k,.085*k,10,1,true),M.flashA); c.rotation.z=-PI/2; c.position.x=.042*k; f.add(c);
  for(let i=0;i<4;i++){ const a=i*PI/2+Math.random()*.6; const s=new T.Mesh(new T.ConeGeometry(.005*k,.04*k,6),M.flashA); s.position.set(.012*k,Math.cos(a)*.016*k,Math.sin(a)*.016*k); s.rotation.set(a,0,0); s.rotateZ(-PI/2+.0); f.add(s); }
  const s=new T.Mesh(new T.SphereGeometry(.016*k,12,8),M.flashB); s.position.x=.008*k; f.add(s); f.rotation.x=Math.random()*PI;
  fx.add(f); mflash.position.copy(pos); mflash.intensity=4*k; mflash.distance=2*k;
  tw(0,.055,(e,p)=>{ f.scale.setScalar(.6+p*.9); if(p>=1){ fx.remove(f); mflash.intensity=0; } });
  for(let i=0;i<6;i++){ const m=new T.Mesh(new T.SphereGeometry(.013*k,10,8),M.smokeP.clone()); m.position.copy(pos); particle(m,new T.Vector3(.15+Math.random()*.35,.03+Math.random()*.12,(Math.random()-.5)*.14),{grav:-.08,life:1.3+Math.random()*.6,fade:1,op0:.45,grow:2.1,drag:2.2,r:-1}); }
}
function casingMesh(t){
  const g=G();
  if(t==='shell'){ CX(g,.0105,.05,M.shell,.008,0,0,14); CX(g,.011,.016,M.brass,-.025,0,0,14); return {g,r:.0105}; }
  const d={tiny:[.0029,.0156],pistol:[.0049,.0195],rifle:[.0056,.046],big:[.0102,.099]}[t]||[.005,.02];
  if(t==='rifle'||t==='big'){ CX(g,d[0],d[1]*.75,M.brass,-d[1]*.12,0,0,12); CX(g,d[0]*.62,d[1]*.25,M.brass,d[1]*.37,0,0,12,d[0]*.55); } else CX(g,d[0],d[1],M.brass,0,0,0,12);
  return {g,r:d[0],len:d[1]};
}
function cartridgeMesh(t){ const c=casingMesh(t); if(t!=='shell'){ const br=t==='rifle'||t==='big'?c.r*.55:c.r*.9, bl=c.len*(t==='rifle'||t==='big'?.45:.5); CX(c.g,br,bl,t==='tiny'?M.lead:M.copper,c.len*.5+bl/2,0,0,12,br*.3); } return c; }
function restFlat(o){ o.rotation.x=0; o.rotation.z=0; }
let W=null;
function ejectCase(down){
  if(!W) return; const p=W.P.eject.getWorldPosition(new T.Vector3()); const c=casingMesh(W.ctype); c.g.position.copy(p); c.g.rotation.y=Math.random()*.6-.3;
  const s=Math.max(.55,Math.min(1.2,W.L));
  const v=down?new T.Vector3((Math.random()-.5)*.3,-.4,(Math.random()-.5)*.3):new T.Vector3(-.2-Math.random()*.4,(.9+Math.random()*.5)*s,(1+Math.random()*.6)*s);
  particle(c.g,v,{w:new T.Vector3(Math.random()*30,Math.random()*30,Math.random()*30),life:25,r:c.r,bounce:.35,onRest:restFlat});
}
function pull(t){ if(t.userData.r0==null) t.userData.r0=t.rotation.z; const r0=t.userData.r0; tw(0,.04,e=>t.rotation.z=r0+.35*e); tw(.06,.08,e=>t.rotation.z=r0+.35*(1-e)); }
function recoil(){ const w=W.wrap, a=W.kick; tw(0,.03,e=>{ w.position.x=-.014*a*e; w.rotation.z=.045*a*e; }); tw(.03,.18,e=>{ w.position.x=-.014*a*(1-e); w.rotation.z=.045*a*(1-e); }); }
function cycleBolt(t0,ej){ const P=W.P,h=P.boltHandle,b=P.bolt,x0=h.userData.x0,d=-.07;
  tw(t0,.09,e=>h.rotation.x=-1.15*e);
  tw(t0+.1,.12,e=>{ h.position.x=x0+d*e; b.position.x=d*e; });
  if(ej) tw(t0+.2,0,()=>ejectCase());
  tw(t0+.26,.12,e=>{ h.position.x=x0+d*(1-e); b.position.x=d*(1-e); });
  tw(t0+.4,.09,e=>h.rotation.x=-1.15*(1-e)); }
function charge(t){ const b=W.P.bolt; if(!b) return; const d=-(W.P.stroke||.06); tw(t,.12,e=>b.position.x=d*e); tw(t+.18,.06,e=>b.position.x=d*(1-e)); }
const QUAL={nova:{n:'Nova',p:.3},usada:{n:'Usada',p:1.5},gasta:{n:'Gasta',p:5},enferrujada:{n:'Enferrujada',p:12}};
const JN={nega:'nega: o cartucho não disparou',chamine:'chaminé: a cápsula ficou presa na janela',dupla:'dupla alimentação: dois cartuchos na câmara',extracao:'falha de extração: o estojo ficou na câmara'};
let curQ='usada';
function jamRoll(){ const p=QUAL[W.q].p/100*(W.rel||1)*(1+Math.max(0,W.heat-60)/40); if(Math.random()>=p) return null; const f=W.P.fam, r=Math.random(); if(f==='revolver'||f==='break'||r<.35) return 'nega'; return r<.8?'chamine':'dupla'; }
function setJam(t,mesh){ W.jam={t,n:JN[t],mesh}; status('Engasgou! '+JN[t]+'.'); $('#b-clear').hidden=false; }
function stuckCase(){ const p=W.P.eject.getWorldPosition(new T.Vector3()); const c=casingMesh(W.ctype); c.g.position.copy(p).add(new T.Vector3(0,(c.len||.05)*.35,0)); c.g.rotation.set(0,0,PI/2-.25); fx.add(c.g); if(W.jam) W.jam.mesh=c.g; return c.g; }
function ejectRound(){ const p=W.P.eject.getWorldPosition(new T.Vector3()); const c=cartridgeMesh(W.ctype); c.g.position.copy(p); particle(c.g,new T.Vector3(-.2,1.1,1.2),{w:new T.Vector3(8,12,6),life:25,r:c.r,bounce:.3,onRest:restFlat}); }
function fire(fromBurst){
  if(!W||(W.busy&&!fromBurst)) return false;
  const P=W.P, f=P.fam;
  if(W.jam){ status('Engasgada ('+W.jam.n+'). Aperte Destravar.'); if(P.trigger) pull(P.trigger); return false; }
  if(W.ammo<=0){ status('Vazio. Aperte Recarregar.'); if(P.trigger) pull(P.trigger); return false; }
  if(f==='rocket'||f==='flame') return fireHeavy();
  const jr=jamRoll(); stopRot(); if(P.trigger) pull(P.trigger);
  if(jr==='nega'){
    if(P.hammer){ const h=P.hammer; tw(0,.03,e=>h.rotation.z=-.5*e); }
    if(f==='revolver'||f==='break'){ W.ammo--; if(f==='revolver'){ const c=P.cyl,r0=c.rotation.x; tw(0,.07,e=>c.rotation.x=r0+PI/3*e); } status('Nega: o cartucho não disparou.'); return false; }
    setJam('nega'); return false; }
  W.ammo--; W.heat=Math.min(140,W.heat+W.heatPer); status('');
  muzzleFlash(P.muzzle.getWorldPosition(new T.Vector3()),W.flashK); recoil();
  if(P.hammer && f!=='revolver'){ const h=P.hammer; tw(0,.02,e=>h.rotation.z=-.5*e); tw(.05,.06,e=>h.rotation.z=-.5*(1-e)); }
  const stuck=jr==='chamine'||jr==='dupla', semi=['rifle','semiint','semi12','p90','belt'].includes(f);
  if(f==='pistol'||semi){
    const part=f==='pistol'?P.slide:P.bolt, d=-(P.stroke||.06);
    if(part) tw(0,.025,e=>part.position.x=d*e);
    if(stuck){ const k=jr==='chamine'?.35:.6; if(part) tw(.025,.04,e=>part.position.x=d*(1-(1-k)*e)); setJam(jr); if(jr==='chamine') tw(.03,0,()=>stuckCase()); }
    else { tw(.012,0,()=>ejectCase(f==='p90'||f==='belt')); if(f==='pistol'&&W.ammo===0) W.locked=true; else if(part) tw(.025,.045,e=>part.position.x=d*(1-e)); }
  }
  else if(stuck){ setJam('extracao'); }
  else if(f==='pump'){ W.busy=true; const pp=P.pump; tw(.22,.11,e=>pp.position.x=-.075*e); tw(.3,0,()=>ejectCase()); tw(.36,.11,e=>pp.position.x=-.075*(1-e)); tw(.5,0,()=>{ if(!fromBurst) W.busy=false; }); }
  else if(f==='bolt'||f==='boltmag'){ W.busy=true; cycleBolt(.3,true); tw(.82,0,()=>W.busy=false); }
  else if(f==='lever'){ W.busy=true; const lv=P.lever; tw(.22,.13,e=>lv.rotation.z=-.85*e); tw(.3,0,()=>ejectCase()); tw(.38,.13,e=>lv.rotation.z=-.85*(1-e)); tw(.55,0,()=>W.busy=false); }
  else if(f==='revolver'){ const c=P.cyl, r0=c.rotation.x, h=P.hammer; tw(0,.05,e=>{ c.rotation.x=r0+PI/3*e; h.rotation.z=.5*e; }); tw(.05,.03,e=>h.rotation.z=.5-1.0*e); tw(.12,.08,e=>h.rotation.z=-.5*(1-e)); }
  updAmmo(); return true;
}
function clearJam(){
  if(!W||!W.jam||W.busy) return; W.busy=true; stopRot(); const P=W.P,f=P.fam,j=W.jam; let t=0; status('Destravando…');
  if(j.t==='dupla'&&P.mag) t=magSwap(0);
  const fly=()=>{ if(j.mesh){ particle(j.mesh,new T.Vector3(-.2,1.2,1.3),{w:new T.Vector3(9,14,7),life:25,r:.006,bounce:.3,onRest:restFlat}); } else if(j.t==='nega'){ ejectRound(); W.ammo=Math.max(0,W.ammo-1); } else ejectCase(); };
  if(f==='pump'){ const pp=P.pump; tw(t,.12,e=>pp.position.x=-.075*e); tw(t+.12,0,fly); tw(t+.2,.12,e=>pp.position.x=-.075*(1-e)); t+=.4; }
  else if(f==='bolt'||f==='boltmag'){ const h=P.boltHandle,b=P.bolt,x0=h.userData.x0,d=-.07; tw(t,.09,e=>h.rotation.x=-1.15*e); tw(t+.1,.12,e=>{h.position.x=x0+d*e;b.position.x=d*e;}); tw(t+.22,0,fly); tw(t+.3,.12,e=>{h.position.x=x0+d*(1-e);b.position.x=d*(1-e);}); tw(t+.44,.09,e=>h.rotation.x=-1.15*(1-e)); t+=.6; }
  else if(f==='lever'){ const lv=P.lever; tw(t,.13,e=>lv.rotation.z=-.85*e); tw(t+.1,0,fly); tw(t+.16,.13,e=>lv.rotation.z=-.85*(1-e)); t+=.35; }
  else { const part=f==='pistol'?P.slide:P.bolt; if(f==='belt'&&P.cover){ const cv=P.cover; tw(t,.18,e=>cv.rotation.z=.9*e); tw(t+.3,.15,e=>cv.rotation.z=.9*(1-e)); t+=.5; }
    if(part){ const x0=part.position.x, d=-(P.stroke||.06); tw(t,.12,e=>part.position.x=x0+(d-x0)*e); tw(t+.1,0,fly); tw(t+.2,.07,e=>part.position.x=d*(1-e)); t+=.32; } else { tw(t,0,fly); t+=.1; } }
  tw(t,0,()=>{ W.jam=null; $('#b-clear').hidden=true; W.busy=false; status('Destravada.'); });
}
function wisp(p,k){ const m=new T.Mesh(new T.SphereGeometry(.007*k*W.flashK,8,6),M.smokeP.clone()); m.position.copy(p); particle(m,new T.Vector3((Math.random()-.5)*.03,.07+Math.random()*.08,(Math.random()-.5)*.03),{grav:-.04,life:1.6+Math.random(),fade:1,op0:Math.min(.42,.14+k*.1),grow:1.5,drag:.4,r:-1}); }
function stepWeapon(dt,t){
  if(!W) return; W.heat=Math.max(0,W.heat-dt*(1.6+W.heat*.03)); const k=Math.max(0,Math.min(1,(W.heat-50)/50));
  (W.P.glow||[]).forEach(m=>{ m.material.emissive.setRGB(1*k,.2*k*k,.02*k*k); m.material.emissiveIntensity=2.2*k; });
  if(W.heat>10){ W.smAcc=(W.smAcc||0)+dt*W.heat*.1; while(W.smAcc>1){ W.smAcc--; wisp(W.P.muzzle.getWorldPosition(new T.Vector3()),.5+W.heat/60); } }
  if(t-(W.ui||0)>.25){ W.ui=t; updAmmo(); }
}
function applyQuality(){ if(!W) return; const q=W.q, map=q==='enferrujada'?new Map([[M.metal,M.rust],[M.dark,M.rustD],[M.steel,M.rust],[M.steelL,M.rust]]):q==='gasta'?new Map([[M.metal,M.worn],[M.dark,M.worn]]):null;
  W.wrap.traverse(o=>{ if(!o.isMesh) return; if(!o.userData.bm) o.userData.bm=o.material; if((W.P.glow||[]).includes(o)){ if(!o.userData.c0) o.userData.c0=o.material.color.clone(); o.material.color.copy(q==='enferrujada'?M.rust.color:q==='gasta'?M.worn.color:o.userData.c0); return; } o.material=map&&map.get(o.userData.bm)||o.userData.bm; }); }
function burst(){ if(!W||W.busy||!W.rpm) return; const n=Math.min(W.burstN||10,W.ammo); if(!n){ fire(); return; } W.busy=true; const dt=60/W.rpm; for(let i=0;i<n;i++) tw(i*dt,0,()=>fire(true)); tw(n*dt+.12,0,()=>W.busy=false); }
function magSwap(t0){ const P=W.P,m=P.mag,b0=m.position.clone(),dir=P.magDir||-1,D=P.magDrop||.15;
  tw(t0,.16,e=>m.position.y=b0.y+dir*D*.6*e);
  tw(t0+.16,0,()=>{ m.updateWorldMatrix(true,true); const c=m.clone(true); m.matrixWorld.decompose(c.position,c.quaternion,c.scale); fx.add(c);
    particle(c,new T.Vector3(dir>0?-.25:.05,dir>0?.9:-.3,.18),{w:new T.Vector3(1.5,.5,2.5),life:25,r:.014,bounce:.15,onRest:o=>o.rotation.set(0,o.rotation.y,PI/2)});
    m.position.y=b0.y+dir*D*2.2; });
  tw(t0+.45,.3,e=>m.position.y=b0.y+dir*D*2.2*(1-e));
  return t0+.82; }
function moveIn(type,from,to,rz){ const c=cartridgeMesh(type); c.g.position.copy(from); c.g.rotation.z=rz||0; fx.add(c.g); tw(0,.24,e=>{ c.g.position.lerpVectors(from,to,e); if(e>=1) fx.remove(c.g); }); }
function tubeLoad(t0,n,type){ const P=W.P; for(let i=0;i<n;i++) tw(t0+i*.42,0,()=>{ const port=P.loadPort.getWorldPosition(new T.Vector3()); moveIn(type,port.clone().add(new T.Vector3(-.03,-.08,.07)),port,.25); }); return t0+n*.42+.1; }
function topLoad(t0,n){ const P=W.P; for(let i=0;i<n;i++) tw(t0+i*.3,0,()=>{ const p=P.topLoad.getWorldPosition(new T.Vector3()); moveIn(W.ctype,p.clone().add(new T.Vector3(0,.07,0)),p,0); }); return t0+n*.3+.05; }
function revolverReload(t0){ const P=W.P,cr=P.crane;
  tw(t0,.22,e=>cr.rotation.x=-1.25*e);
  tw(t0+.32,0,()=>P.ch.forEach(m=>{ const p=m.getWorldPosition(new T.Vector3()); const c=casingMesh('pistol'); c.g.position.copy(p); particle(c.g,new T.Vector3(-.5-Math.random()*.3,-.1+Math.random()*.3,(Math.random()-.5)*.25),{w:new T.Vector3(10,20,5),life:25,r:c.r,onRest:restFlat}); }));
  tw(t0+.7,0,()=>P.ch.forEach(m=>{ const p=m.getWorldPosition(new T.Vector3()); moveIn('pistol',p.clone().add(new T.Vector3(-.07,0,0)),p.clone().add(new T.Vector3(.006,0,0)),0); }));
  tw(t0+1.05,.2,e=>cr.rotation.x=-1.25*(1-e));
  return t0+1.3; }
function breakReload(t0){ const P=W.P,bp=P.barrels;
  tw(t0,.2,e=>bp.rotation.z=-.5*e);
  tw(t0+.25,0,()=>P.breech.forEach(m=>{ const p=m.getWorldPosition(new T.Vector3()); const c=casingMesh('shell'); c.g.position.copy(p); c.g.rotation.z=-.5; particle(c.g,new T.Vector3(-1,.9,(Math.random()-.5)*.2),{w:new T.Vector3(3,8,12),life:25,r:c.r,onRest:restFlat}); }));
  tw(t0+.65,0,()=>P.breech.forEach(m=>{ const p=m.getWorldPosition(new T.Vector3()); moveIn('shell',p.clone().add(new T.Vector3(-.09,.05,0)),p.clone().add(new T.Vector3(.02,-.01,0)),-.5); }));
  tw(t0+1.0,.15,e=>bp.rotation.z=-.5*(1-e));
  return t0+1.2; }
function beltReload(t0){ const P=W.P,cv=P.cover,bt=P.belt,b0=bt.position.clone();
  tw(t0,.2,e=>cv.rotation.z=.9*e);
  tw(t0+.2,.25,e=>bt.position.z=b0.z-.3*e);
  tw(t0+.55,.3,e=>bt.position.z=b0.z-.3*(1-e));
  tw(t0+.9,.18,e=>cv.rotation.z=.9*(1-e)); charge(t0+1.15); return t0+1.55; }
function reload(){
  if(!W||W.busy) return; const P=W.P,f=P.fam;
  if(W.jam){ status('Destrave a arma antes de recarregar.'); return; }
  if(W.ammo>=W.cap && !W.locked){ status('Já está cheio.'); return; }
  if(f==='rocket'||f==='flame'){ heavyReload(); return; }
  W.busy=true; stopRot(); status('Recarregando…'); const empty=W.ammo===0, need=W.cap-W.ammo; let t=0;
  if(P.mag){ t=magSwap(0);
    if(f==='pistol'){ if(W.locked){ tw(t,.05,e=>P.slide.position.x=-P.stroke*(1-e)); W.locked=false; t+=.12; } }
    else if(f==='boltmag'){ cycleBolt(t,false); t+=.55; }
    else if(empty){ charge(t); t+=.35; } }
  else if(f==='revolver') t=revolverReload(0);
  else if(f==='break') t=breakReload(0);
  else if(f==='belt') t=beltReload(0);
  else if(f==='pump'||f==='semi12'||f==='lever'){ t=tubeLoad(0,Math.min(need,5),f==='lever'?'rifle':'shell');
    if(empty){ if(f==='pump'){ const pp=P.pump; tw(t,.11,e=>pp.position.x=-.075*e); tw(t+.14,.11,e=>pp.position.x=-.075*(1-e)); t+=.3; } else if(f==='lever'){ const lv=P.lever; tw(t,.13,e=>lv.rotation.z=-.85*e); tw(t+.16,.13,e=>lv.rotation.z=-.85*(1-e)); t+=.32; } else { charge(t); t+=.3; } } }
  else if(f==='bolt'){ const h=P.boltHandle,b=P.bolt,x0=h.userData.x0,d=-.07;
    tw(0,.09,e=>h.rotation.x=-1.15*e); tw(.1,.12,e=>{ h.position.x=x0+d*e; b.position.x=d*e; }); t=topLoad(.3,Math.min(need,5));
    tw(t,.12,e=>{ h.position.x=x0+d*(1-e); b.position.x=d*(1-e); }); tw(t+.14,.09,e=>h.rotation.x=-1.15*(1-e)); t+=.3; }
  else if(f==='semiint'){ const b=P.bolt,d=-(P.stroke||.06); tw(0,.12,e=>b.position.x=d*e); t=topLoad(.2,Math.min(need,5)); tw(t,.06,e=>b.position.x=d*(1-e)); t+=.15; }
  tw(t,0,()=>{ W.ammo=W.cap; updAmmo(); W.busy=false; status(''); });
}

/* ---------- zumbi ---------- */
const BLEED={head:40,neck:46,jaw:8,torso:10,pelvis:12,upperArm:15,forearm:8,hand:3,thigh:19,shin:9,foot:3};
const MULT={head:3,jaw:2,neck:2,torso:1,pelvis:1,upperArm:.6,forearm:.6,hand:.6,thigh:.7,shin:.7,foot:.7};
const HPS={head:40,jaw:12,neck:25,torso:150,pelvis:90,upperArm:45,forearm:30,hand:12,thigh:55,shin:40,foot:15};
const NAMES={head:'Cabeça',jaw:'Mandíbula',neck:'Pescoço',torso:'Tronco',pelvis:'Quadril',upperArm:'Braço',forearm:'Antebraço',hand:'Mão',thigh:'Coxa',shin:'Canela',foot:'Pé'};
const ZW={pistola:{n:'Pistola 9×19',dmg:35,pel:1},fuzil:{n:'Fuzil 7,62×39',dmg:55,pel:1},escopeta:{n:'Escopeta 12 ga',dmg:12,pel:9},cinquenta:{n:'.50 BMG',dmg:180,pel:1},granada:{n:'Granada',dmg:300,pel:0}};
let Z=null, zw='fuzil', lastHit=''; const FRESH=new T.Color(0x8a0a0a).convertSRGBToLinear(), DRY=new T.Color(0x3b1d14).convertSRGBToLinear();
function blobShape(r,amp,n){ const L=lobes(n||20,amp); return new T.ShapeGeometry(new T.Shape(L.map((l,i)=>{ const t=i/L.length*PI*2; return new T.Vector2(Math.cos(t)*r*l,Math.sin(t)*r*l); })),2); }
function clothWound(g,x,y,z,r,ry){ const w=G(); w.position.set(x,y,z); w.rotation.y=ry||0; g.add(w); const a=new T.Mesh(blobShape(r,.3,22),M.soak); w.add(a); const b=new T.Mesh(blobShape(r*.55,.25,16),M.soakF); b.position.z=.0005; w.add(b); const h=new T.Mesh(blobShape(r*.2,.2,10),M.hole); h.position.z=.001; w.add(h); const k=new T.Mesh(new T.RingGeometry(r*.2,r*.28,10),M.rimD); k.position.z=.0008; w.add(k); return w; }
function zb(g,w,h,d,m,x,y,z,rz,ry,rx){ RF=.42; const o=B(g,w,h,d,m,x,y,z,rz,ry,rx); RF=null; return o; }
function zseg(parent,type,side,x,y,z){ const g=G(); g.position.set(x,y,z); parent.add(g); const s={type,side,hp:HPS[type],max:HPS[type],g,attached:true}; g.userData.seg=s; Z.segs.push(s); return g; }
function buildZombie(){
  const root=G(); Z={root,segs:[],life:100,alive:true,state:'Em pé',bleeders:[],pools:[]};
  const body=G(); root.add(body); Z.body=body;
  const pel=zseg(body,'pelvis',0,0,.95,0); zb(pel,.34,.2,.21,M.pants,0,0,0); zb(pel,.36,.035,.225,M.dark,0,.085,0); B(pel,.04,.03,.01,M.brass,0,.085,.113);
  [1,-1].forEach(s=>{
    const th=zseg(pel,'thigh',s,s*.1,-.06,0); th.rotation.x=s>0?.12:-.14; zb(th,.15,.43,.16,M.pants,0,-.21,0); if(s>0) clothWound(th,.02,-.24,.081,.04);
    const sn=zseg(th,'shin',s,0,-.42,0); sn.rotation.x=.12; zb(sn,.13,.3,.14,M.pants,0,-.15,0); zb(sn,.115,.13,.125,M.skinD,0,-.33,0);
    const ft=zseg(sn,'foot',s,0,-.42,0); zb(ft,.13,.08,.26,M.shoe,0,-.005,.05); B(ft,.13,.015,.26,M.dark,0,-.04,.05);
  });
  const to=zseg(pel,'torso',0,0,.09,0); to.rotation.x=.25; zb(to,.42,.52,.24,M.shirt,0,.26,0); clothWound(to,.09,.22,.121,.06); zb(to,.12,.3,.02,M.shirtD,-.12,.2,.121); zb(to,.3,.06,.25,M.shirtD,0,.47,0);
  const nk=zseg(to,'neck',0,0,.53,0); zb(nk,.11,.11,.11,M.skin,0,.04,0);
  const hd=zseg(nk,'head',0,0,.09,.01); zb(hd,.23,.26,.25,M.skin,0,.12,0); zb(hd,.24,.07,.25,M.hair,0,.235,-.015); zb(hd,.08,.06,.03,M.hair,.06,.25,.09);
  B(hd,.05,.024,.012,M.eye,.055,.14,.123); B(hd,.05,.024,.012,M.eye,-.055,.14,.123); zb(hd,.04,.05,.045,M.skinD,0,.09,.13); zb(hd,.03,.06,.04,M.skinD,.12,.11,0); zb(hd,.03,.06,.04,M.skinD,-.12,.11,0); clothWound(hd,-.07,.18,.126,.025);
  const jw=zseg(hd,'jaw',0,0,.0,.035); zb(jw,.18,.065,.18,M.skinD,0,0,0); for(let i=0;i<5;i++) B(jw,.018,.016,.012,M.bone,-.04+i*.02,.03,.088);
  [1,-1].forEach(s=>{
    const ua=zseg(to,'upperArm',s,s*.27,.44,0); ua.rotation.set(-1.25,0,s*.1); zb(ua,.11,.31,.11,M.shirt,0,-.15,0);
    const fa=zseg(ua,'forearm',s,0,-.3,0); fa.rotation.x=-.25; zb(fa,.095,.28,.095,M.skin,0,-.14,0); if(s<0) clothWound(fa,0,-.12,.0485,.03);
    const hn=zseg(fa,'hand',s,0,-.29,0); zb(hn,.095,.11,.05,M.skin,0,-.05,0); for(let i=0;i<3;i++) zb(hn,.022,.065,.028,M.skinD,-.03+i*.03,-.125,0); zb(hn,.022,.05,.026,M.skinD,s*.05,-.06,.02,s*.5);
  });
  root.traverse(o=>{ if(o.isMesh){ let p=o; while(p&&!p.userData.seg) p=p.parent; o.userData.segOwner=p?p.userData.seg:null; } });
  return root;
}
function addBleeder(obj,worldPoint,rate,dur,outW,spurt){
  const q=obj.getWorldQuaternion(new T.Quaternion()).invert();
  Z.bleeders.push({obj,local:worldPoint?obj.worldToLocal(worldPoint.clone()):new T.Vector3(),outL:outW.clone().normalize().applyQuaternion(q),rate,dur,t:0,acc:0,spurt});
}
const dropGeo=new T.IcosahedronGeometry(1,0);
const PN=28, DRYR=new T.Color(0x2a140e).convertSRGBToLinear();
function fanGeo(n){ const g=new T.BufferGeometry(), pos=new Float32Array((n+1)*3), col=new Float32Array((n+1)*3), idx=[]; for(let i=0;i<n;i++) idx.push(0,1+i,1+(i+1)%n); g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setAttribute('color',new T.BufferAttribute(col,3)); const nr=new Float32Array((n+1)*3); for(let i=0;i<=n;i++) nr[i*3+2]=1; g.setAttribute('normal',new T.BufferAttribute(nr,3)); g.setIndex(idx); return g; }
function lobes(n,amp){ const k=[2+Math.random()*2|0,4+Math.random()*3|0,7+Math.random()*4|0], ph=k.map(()=>Math.random()*6.3), a=[amp,amp*.6,amp*.35]; return Array.from({length:n},(_,i)=>{ const t=i/n*PI*2; return 1+k.reduce((s,kk,j)=>s+Math.sin(t*kk+ph[j])*a[j],0)+(Math.random()-.5)*amp*.4; }); }
function paintFan(m){ const u=m.userData, g=m.geometry, P=g.attributes.position.array, C=g.attributes.color.array, n=u.r.length;
  const kc=Math.min(1,u.age/600), ke=Math.min(1,u.age/240); const cC=FRESH.clone().lerp(DRY,kc), cE=FRESH.clone().lerp(DRY,ke).lerp(DRYR,ke*.6);
  C[0]=cC.r*.3; C[1]=cC.g*.3; C[2]=cC.b*.3;
  for(let i=0;i<n;i++){ const t=i/n*PI*2, r=u.r[i]; P[3+i*3]=Math.cos(t)*r*(u.sx||1); P[4+i*3]=Math.sin(t)*r; P[5+i*3]=0; const c=(r<.012?cE:cE.clone().lerp(cC,.25)).multiplyScalar(.5); C[3+i*3]=c.r; C[4+i*3]=c.g; C[5+i*3]=c.b; }
  g.attributes.position.needsUpdate=true; g.attributes.color.needsUpdate=true; g.computeBoundingSphere();
  m.material.roughness=.12+.75*kc; }
function poolMat(){ const m=M.pool.clone(); m.vertexColors=true; m.color.setRGB(1,1,1); m.metalness=0; m.envMapIntensity=.35; return m; }
function bloodPool(pos,amt){
  let best=null,bd=1e9; Z.pools.forEach(p=>{ if(p.userData.stain) return; const d=Math.hypot(p.position.x-pos.x,p.position.z-pos.z), R=p.userData.mean+.02; if(d<R&&d<bd){ bd=d; best=p; } });
  if(best){ const u=best.userData, a=Math.atan2(-(pos.z-best.position.z),pos.x-best.position.x); const add=amt*.06/Math.max(.02,u.mean);
    for(let i=0;i<PN;i++){ let da=Math.abs(i/PN*PI*2-a)%(PI*2); if(da>PI) da=PI*2-da; u.tg[i]+=add*(.35+1.4*Math.max(0,Math.cos(da))**3)*(.6+Math.random()*.8); }
    u.age=Math.min(u.age,30); return; }
  const m=new T.Mesh(fanGeo(PN),poolMat()); const L=lobes(PN,.22), r0=.012+amt*.05;
  m.userData={age:0,r:L.map(l=>r0*.5*l),tg:L.map(l=>r0*l),sp:L.map(()=>.6+Math.random()*.9),mean:r0}; m.rotation.x=-PI/2; m.position.set(pos.x,groundY+.0015+Z.pools.length*.00002,pos.z); m.receiveShadow=true; fx.add(m); Z.pools.push(m); paintFan(m);
}
function splat(pos,v,size){
  const h=Math.hypot(v.x,v.z), sinA=Math.max(.22,Math.abs(v.y)/Math.max(.001,Math.hypot(h,v.y))), el=Math.min(4.5,1/sinA), r=Math.max(.004,size*1.6);
  if(h<.35){ bloodPool(pos,.06); return; }
  const m=new T.Mesh(fanGeo(PN),poolMat()); const L=lobes(PN,.12);
  for(let i=0;i<PN;i++){ const t=i/PN*PI*2, front=Math.max(0,Math.cos(t)); L[i]*=1+(Math.random()<.18?front*front*(.25+Math.random()*.55)*Math.min(1,el*.5):0); }
  m.userData={age:0,r:L.map(l=>l*r),stain:1,sx:el}; m.rotation.x=-PI/2; m.rotation.z=Math.atan2(-v.z,v.x); m.position.set(pos.x,groundY+.0012+Math.random()*.0002,pos.z); fx.add(m); Z.pools.push(m); paintFan(m);
  const dir=new T.Vector3(v.x,0,v.z).normalize(), ns=1+(el>1.6?Math.random()*3|0:0);
  for(let i=0;i<ns;i++){ const s=new T.Mesh(fanGeo(10),poolMat()); const d=r*el*(1.4+Math.random()*1.8); s.userData={age:0,r:lobes(10,.15).map(l=>l*r*(.18+Math.random()*.2)),stain:1,sx:1.5}; s.rotation.x=-PI/2; s.rotation.z=m.rotation.z; s.position.set(pos.x+dir.x*d+(Math.random()-.5)*r,groundY+.0012,pos.z+dir.z*d+(Math.random()-.5)*r); fx.add(s); Z.pools.push(s); paintFan(s); }
  if(Z.pools.length>420){ const o=Z.pools.find(p=>p.userData.stain); if(o){ fx.remove(o); o.geometry.dispose(); Z.pools.splice(Z.pools.indexOf(o),1); } }
}
function stepPools(dt){ Z.pools.forEach(p=>{ const u=p.userData; u.age+=dt; if(u.stain){ if((u.pa=(u.pa||0)+dt)>2){ u.pa=0; paintFan(p); } return; }
  let s=0; for(let i=0;i<PN;i++){ u.tg[i]+=dt*.0004*Math.max(0,1-u.age/120)*u.sp[i]; u.r[i]+=(u.tg[i]-u.r[i])*Math.min(1,dt*.7*u.sp[i]); s+=u.r[i]; }
  for(let i=0;i<PN;i++){ const a=u.r[(i+PN-1)%PN], b=u.r[(i+1)%PN]; u.r[i]+=((a+b)/2-u.r[i])*Math.min(1,dt*.15); }
  u.mean=s/PN; if(u.age<200||(u.pa=(u.pa||0)+dt)>2){ u.pa=0; paintFan(p); } }); }
function drop(pos,v,size){ const m=new T.Mesh(dropGeo,M.blood); m.scale.setScalar(size); m.position.copy(pos); particle(m,v,{life:3,r:.002,onGround:(p,vel)=>splat(p,vel||new T.Vector3(0,-1,0),size)}); }
function starGeo(r,n){ const pts=[]; for(let i=0;i<n*2;i++){ const t=i/(n*2)*PI*2+(Math.random()-.5)*.25, rr=i%2?r*(.3+Math.random()*.2):r*(.7+Math.random()*.6); pts.push(new T.Vector2(Math.cos(t)*rr,Math.sin(t)*rr)); } return new T.ShapeGeometry(new T.Shape(pts)); }
function woundDecal(g,p,nrm,r){
  const m=new T.Mesh(new T.CircleGeometry(r*.62,14),M.bruise); g.add(m); m.position.copy(g.worldToLocal(p.clone().addScaledVector(nrm,.002))); m.lookAt(p.clone().addScaledVector(nrm,1));
  const rim=new T.Mesh(new T.RingGeometry(r*.2,r*.34,12),M.rimD); m.add(rim); rim.position.z=.0003; const h=new T.Mesh(new T.CircleGeometry(r*.22,10),M.hole); m.add(h); h.position.z=.0005; }
function exitWound(s,p,dir,d){
  const meshes=[]; s.g.traverse(o=>{ if(o.isMesh&&o.userData.segOwner===s) meshes.push(o); }); const rc=new T.Raycaster(p.clone().addScaledVector(dir,.6),dir.clone().negate(),0,.6); const h=rc.intersectObjects(meshes)[0]; if(!h) return;
  const n=h.face.normal.clone().transformDirection(h.object.matrixWorld), r=.012+Math.min(.035,d*.00028);
  const st=new T.Mesh(starGeo(r,5+Math.random()*3|0),M.flesh); s.g.add(st); st.position.copy(s.g.worldToLocal(h.point.clone().addScaledVector(n,.002))); st.lookAt(h.point.clone().addScaledVector(n,1)); st.rotateZ(Math.random()*6);
  const ih=new T.Mesh(starGeo(r*.45,4),M.hole); st.add(ih); ih.position.z=.0005;
  for(let i=0;i<Math.min(14,4+d/12);i++){ const v=dir.clone().multiplyScalar(1.2+Math.random()*2.2).add(new T.Vector3((Math.random()-.5)*.7,Math.random()*.5,(Math.random()-.5)*.7)); drop(h.point.clone(),v,.002+Math.random()*.005); } }
function bloodBurst(p,nrm,n,dir){ for(let i=0;i<n;i++){ const v=nrm.clone().multiplyScalar(.6+Math.random()*1.6).add(dir.clone().multiplyScalar(.6)).add(new T.Vector3((Math.random()-.5)*.9,Math.random()*.7,(Math.random()-.5)*.9)); drop(p,v,.003+Math.random()*.006); } }
function stepBleed(dt,t){
  if(!Z) return; const q=new T.Quaternion();
  Z.bleeders.forEach(b=>{ if(b.t>b.dur||!b.obj.parent) return; b.t+=dt; const k=1-b.t/b.dur; const pulse=b.spurt?(.45+.55*Math.max(0,Math.sin(t*7.5))):1;
    b.acc+=b.rate*k*pulse*dt; while(b.acc>=1){ b.acc--; const wp=b.obj.localToWorld(b.local.clone()); const out=b.outL.clone().applyQuaternion(b.obj.getWorldQuaternion(q));
      const sp=b.spurt?(.7+Math.random()*1.1)*pulse:.15+Math.random()*.3; drop(wp,out.multiplyScalar(sp).add(new T.Vector3((Math.random()-.5)*.2,0,(Math.random()-.5)*.2)),.0025+Math.random()*.004); } });
  stepPools(dt);
  if(Z.alive && (Z.state==='Em pé'||Z.state==='Mancando')) zWalk(dt); else if(Z.alive && Z.state==='Rastejador') zCrawl(dt);
}
function zWalk(dt){ const L=Z.limp||0; Z.ph=(Z.ph||0)+dt*(L?3:4.2); const ph=Z.ph;
  Z.segs.forEach(s=>{ if(!s.attached) return; const g=s.g; if(g.userData.r0==null) g.userData.r0=g.rotation.x; const a=Math.sin(ph+(s.side>0?0:PI));
    if(s.type==='thigh') g.rotation.x=g.userData.r0-a*(L===s.side?.16:.38);
    else if(s.type==='shin') g.rotation.x=g.userData.r0+Math.max(0,a)*(L===s.side?.25:.6);
    else if(s.type==='upperArm') g.rotation.x=g.userData.r0+Math.sin(ph*.5+s.side)*.12; });
  const step=L?Math.max(0,Math.sin(ph+(L>0?0:PI))):0;
  Z.body.position.y=Math.abs(Math.sin(ph))*.022-step*.07; Z.body.rotation.z=Math.sin(ph)*.035+step*.1*L; Z.body.rotation.y=Math.sin(ph*.5)*.05; }
function zCrawl(dt){ Z.ph=(Z.ph||0)+dt*2.2; Z.segs.forEach(s=>{ if(s.attached&&s.type==='upperArm') s.g.rotation.x=-2.65+Math.sin(Z.ph+(s.side>0?0:PI))*.4; }); Z.body.position.y=.02+Math.max(0,Math.sin(Z.ph*2))*.015; }
function gouge(s,p,nrm,dir,dmg){
  const n=dmg>=150?7:dmg>=55?4:2;
  for(let i=0;i<n;i++){ const g=G(); const sz=.012+Math.random()*(dmg>=150?.04:.022); zb(g,sz,sz*(.6+Math.random()*.6),sz*(.6+Math.random()*.6),[M.flesh,M.skin,M.flesh,M.bone,M.skinD][i%5],0,0,0); g.position.copy(p);
    const v=dir.clone().multiplyScalar(.8+Math.random()*1.5).add(nrm.clone().multiplyScalar(.6+Math.random())).add(new T.Vector3((Math.random()-.5)*.8,Math.random()*.8,(Math.random()-.5)*.8));
    particle(g,v,{w:new T.Vector3(Math.random()*14,Math.random()*14,Math.random()*14),life:120,r:sz*.4,bounce:.12,onRest:o=>{ if(sz>.02&&!o.userData.split){ o.userData.split=1; for(let k=0;k<3;k++){ const b=G(); zb(b,sz*.45,sz*.35,sz*.4,M.flesh,0,0,0); b.position.copy(o.position); particle(b,new T.Vector3((Math.random()-.5)*.5,.4+Math.random()*.4,(Math.random()-.5)*.5),{w:new T.Vector3(9,9,9),life:120,r:sz*.15,bounce:.1}); } o.scale.multiplyScalar(.6); } bloodPool(o.position,.05); }}); }
  const cr=new T.Mesh(new T.CircleGeometry(.018+Math.min(.04,dmg*.00025),12),M.hole); s.g.add(cr); cr.position.copy(s.g.worldToLocal(p.clone().addScaledVector(nrm,.003))); cr.lookAt(p.clone().addScaledVector(nrm,1));
  const rim=new T.Mesh(new T.RingGeometry(cr.geometry.parameters.radius,cr.geometry.parameters.radius*1.5,12),M.flesh); cr.add(rim); rim.position.z=-.0005;
  if(['upperArm','forearm','thigh','shin'].includes(s.type)&&dmg>=55){ const b=new T.Mesh(new T.CylinderGeometry(.006,.006,.03,6),M.bone); cr.add(b); b.rotation.x=PI/2; b.position.z=-.004; }
}
function markOff(s){ s.g.traverse(o=>{ if(o.userData.seg) o.userData.seg.attached=false; }); }
function detachToFx(g){ g.updateWorldMatrix(true,true); const m=g.matrixWorld.clone(); g.parent.remove(g); m.decompose(g.position,g.quaternion,g.scale); fx.add(g); }
function stumpAt(s){ const parent=s.g.parent; const st=G(); st.position.copy(s.g.position); st.quaternion.copy(s.g.quaternion); parent.add(st); zb(st,.085,.03,.085,M.flesh,0,0,0); CY(st,.012,.035,M.bone,0,-.008,0,8);
  const wp=s.g.getWorldPosition(new T.Vector3()), pp=parent.getWorldPosition(new T.Vector3()); let out=wp.clone().sub(pp); if(out.lengthSq()<1e-6) out.set(0,1,0); out.normalize();
  addBleeder(st,null,BLEED[s.type]*(s.type==='neck'||s.type==='head'?1.5:1),45,out,true); return out; }
function sever(s,dir){ const out=stumpAt(s); const wp=s.g.getWorldPosition(new T.Vector3()); markOff(s); detachToFx(s.g);
  particle(s.g,dir.clone().multiplyScalar(1.1).add(new T.Vector3((Math.random()-.5)*.6,1+Math.random(),(Math.random()-.5)*.6)),{w:new T.Vector3(Math.random()*7,Math.random()*7,Math.random()*7),life:120,r:.05,bounce:.2});
  addBleeder(s.g,null,BLEED[s.type]*.35,15,out.clone().negate(),true); bloodBurst(wp,out,24,dir); }
function explodeSeg(s,dir){ const wp=s.g.getWorldPosition(new T.Vector3()); const b=new T.Box3().setFromObject(s.g); const c=b.getCenter(new T.Vector3()); const sz=b.getSize(new T.Vector3()).length();
  stumpAt(s); markOff(s); s.g.parent.remove(s.g);
  for(let i=0;i<14;i++){ const g=G(); const m=[M.flesh,M.skin,M.bone,M.flesh,M.skinD][i%5]; zb(g,.015+Math.random()*sz*.18,.015+Math.random()*sz*.14,.015+Math.random()*sz*.14,m,0,0,0); g.position.copy(c).add(new T.Vector3((Math.random()-.5)*sz*.4,(Math.random()-.5)*sz*.4,(Math.random()-.5)*sz*.4));
    particle(g,dir.clone().multiplyScalar(1.5).add(new T.Vector3((Math.random()-.5)*3,Math.random()*2.5,(Math.random()-.5)*3)),{w:new T.Vector3(Math.random()*15,Math.random()*15,Math.random()*15),life:120,r:.012,bounce:.15}); }
  bloodBurst(c,dir.clone().negate().add(new T.Vector3(0,.8,0)).normalize(),50,dir); }
function zFall(rx,y,dur){ const b=Z.body, r0=b.rotation.x, y0=b.position.y; tw(0,dur||.7,e=>{ b.rotation.x=r0+(rx-r0)*e; b.position.y=y0+(y-y0)*e; b.rotation.z*=.9; }); }
function kill(why){ if(!Z.alive) return; Z.alive=false; Z.why=why; if(Z.state==='Rastejador'){ Z.state='Morto'; return; } Z.state='Morto'; Z.body.rotation.y=0; zFall(-1.45,.12,.75); Z.segs.forEach(s=>{ if(s.type==='upperArm'&&s.attached){ const r0=s.g.rotation.x; tw(.15,.5,e=>s.g.rotation.x=r0+(-.25-r0)*e); } }); }
function legLost(){ if(!Z.alive||(Z.state!=='Em pé'&&Z.state!=='Mancando')) return; Z.body.position.y=0; Z.body.rotation.z=0; Z.body.rotation.y=0; Z.state='Rastejador'; zFall(1.42,.02,.65); Z.segs.forEach(s=>{ if(s.type==='upperArm'&&s.attached) tw(.2,.4,e=>s.g.rotation.x=-1.25-1.4*e); }); }
function splitTorso(dir){ const to=Z.segs.find(s=>s.type==='torso'); if(!to||!to.attached) return; sever(to,dir); kill('Partido ao meio'); }
function damage(s,dmg,dir,p,nrm,big){
  if(!s.attached) return; const d=dmg*MULT[s.type];
  if(p){ bloodBurst(p,nrm,Math.min(30,6+d*.25),dir); woundDecal(s.g,p,nrm,.01+Math.min(.028,d*.0004)); addBleeder(s.g,p,BLEED[s.type]*.3,10,nrm,false); if(d>=30&&s.attached) exitWound(s,p,dir,d); if(dmg>=45) gouge(s,p,nrm,dir,dmg); }
  s.hp-=d; let res='';
  if(s.type==='head'){ if(dmg>=30||s.hp<=0){ explodeSeg(s,dir); res='crânio estourou'; kill('Tiro na cabeça'); } else res='ferido'; }
  else if(s.type==='jaw'){ if(s.hp<=0){ sever(s,dir); res='arrancada'; } }
  else if(s.type==='neck'){ if(s.hp<=0){ sever(s,dir); res='cabeça arrancada'; kill('Sem cabeça'); } }
  else if(s.type==='torso'||s.type==='pelvis'){ Z.life-=d; if(dmg>=150||s.hp<=0){ splitTorso(dir); res='partido ao meio'; } }
  else { Z.life-=d*.3; if(s.hp<=0){ if(big||-s.hp>s.max) { explodeSeg(s,dir); res='estourou'; } else { sever(s,dir); res='arrancado'; } if(['thigh','shin'].includes(s.type)) legLost(); else if(s.type==='foot'&&Z.alive&&Z.state==='Em pé'){ Z.limp=s.side; Z.state='Mancando'; res+=' · passa a mancar'; } } }
  if(Z.alive&&Z.life<=0) kill('Dano acumulado');
  return NAMES[s.type]+' · '+Math.round(d)+' de dano'+(res?' · '+res:'');
}
const ray=new T.Raycaster(), ndc=new T.Vector2();
function zMeshes(){ const a=[]; Z.root.traverse(o=>{ if(o.isMesh&&o.userData.segOwner&&o.userData.segOwner.attached) a.push(o); }); return a; }
function shootZombie(cx,cy){
  if(!Z) return; const rect=renderer.domElement.getBoundingClientRect(); const bx=((cx-rect.left)/rect.width)*2-1, byy=-((cy-rect.top)/rect.height)*2+1; const w=ZW[zw];
  if(zw==='granada'){ ndc.set(bx,byy); ray.setFromCamera(ndc,cam); const h=ray.intersectObjects(zMeshes().concat([ground]))[0]; if(h) grenadeAt(h.point); renderZInfo(); return; }
  const msgs=[];
  for(let i=0;i<w.pel;i++){ const j=w.pel>1?.03:0; ndc.set(bx+(Math.random()-.5)*j*2,byy+(Math.random()-.5)*j*2); ray.setFromCamera(ndc,cam);
    const h=ray.intersectObjects(zMeshes())[0]; if(!h) continue; const s=h.object.userData.segOwner;
    const nrm=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):ray.ray.direction.clone().negate();
    msgs.push(damage(s,w.dmg,ray.ray.direction.clone(),h.point,nrm,zw==='cinquenta')); }
  lastHit=msgs.length?(w.pel>1?msgs.length+' bagos acertaram · '+msgs[0]:msgs[0]):'Errou';
  renderZInfo();
}
function grenadeAt(pt){
  muzzleFlash(pt.clone().add(new T.Vector3(0,.15,0)),9); mflash.intensity=30; mflash.distance=8;
  const sm=M.smokeP.clone(); sm.color.set(0x2e2d2a); for(let i=0;i<8;i++){ const m=new T.Mesh(new T.SphereGeometry(.05,10,8),sm.clone()); m.position.copy(pt); particle(m,new T.Vector3((Math.random()-.5)*2.2,.6+Math.random()*1.4,(Math.random()-.5)*2.2),{grav:-.15,life:1.8,fade:1,op0:.4,grow:1.1,drag:1.8,r:-1}); }
  const sc=new T.Mesh(new T.CircleGeometry(.6,18),M.hole); sc.rotation.x=-PI/2; sc.position.set(pt.x,groundY+.001,pt.z); fx.add(sc);
  const hit=[]; Z.segs.forEach(s=>{ if(!s.attached) return; const p=s.g.getWorldPosition(new T.Vector3()); const d=p.distanceTo(pt); const dmg=300*Math.max(0,1-d/1.6); if(dmg>8) hit.push([s,dmg,p.clone().sub(pt).normalize()]); });
  hit.sort((a,b)=>b[1]-a[1]).forEach(([s,dmg,dir])=>{ if(!s.attached) return; if(s.type==='head'&&dmg>40){ explodeSeg(s,dir); kill('Explosão'); } else damage(s,dmg/MULT[s.type],dir,null,null,dmg>120); });
  lastHit='Granada · '+hit.length+' partes atingidas';
}

(function loop(){ requestAnimationFrame(loop); const dt=Math.min(clock.getDelta(),.05), t=clock.elapsedTime;
  const cur=tasks; tasks=[]; const keep=[]; cur.forEach(k=>{ if(t<k.s){ keep.push(k); return; } const p=k.d>0?Math.min(1,(t-k.s)/k.d):1; k.fn(ease(p),p); if(p<1) keep.push(k); }); tasks=keep.concat(tasks);
  stepParticles(dt); stepBleed(dt,t); stepWeapon(dt,t);
  if(current) current.traverse(o=>{ if(o.userData.flame) o.scale.set(1,.8+Math.sin(t*14+o.id)*.25,1); if(o.userData.smoke){ const s=o.userData.smoke; o.position.y+=s.spd*.016; if(o.position.y>s.base+s.h) o.position.y=s.base; } });
  ctl.update(); renderer.render(scene,cam); })();

/* ---------- interface ---------- */
let tab='armas', sel=0, stage=0, wm='tijolo', side=false;
const info=$('#info'), list=$('#list'), stages=$('#stages'), bSide=$('#b-side'), bRot=$('#b-rot'), wctl=$('#wctl'), wstat=$('#wstat'), hint=$('#hint');
const FAM={rocket:'Carregado pela boca ou tubo descartável',flame:'Tanque pressurizado, jato contínuo',pistol:'Carregador na empunhadura, corrediça',revolver:'Tambor de 6 ou 7, dupla ação',rifle:'Carregador destacável',pump:'Bomba, tubo sob o cano',semi12:'Semiautomática, tubo sob o cano',lever:'Alavanca, tubo sob o cano',bolt:'Ferrolho, alimentação por cima',boltmag:'Ferrolho, carregador destacável',semiint:'Semiautomática, alimentação por cima',break:'Basculante, 2 canos',belt:'Cinta de munição',p90:'Carregador horizontal no topo'};
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function fmt(n){ return n.toLocaleString('pt-BR'); }
function setInfo(cat,title,rows,p,extra){ info.innerHTML='<div class="cat">'+esc(cat)+'</div><h2>'+esc(title)+'</h2>'+(rows.length?'<dl>'+rows.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join('')+'</dl>':'')+(p?'<p>'+esc(p)+'</p>':'')+(extra||''); }
function setStages(arr,onPick,cur){ stages.innerHTML=''; (arr||[]).forEach((s,i)=>{ const b=document.createElement('button'); b.type='button'; b.id='st-'+i; b.textContent=s[0]; b.setAttribute('aria-pressed',(cur==null?i===stage:cur===i)?'true':'false'); b.onclick=()=>{ if(onPick) onPick(i); else { stage=i; render(); } }; stages.appendChild(b); }); }
function listItems(groups){ list.innerHTML=''; groups.forEach(gr=>{ if(gr.h){ const h=document.createElement('h3'); h.textContent=gr.h; list.appendChild(h); } gr.items.forEach(it=>{ const b=document.createElement('button'); b.type='button'; b.innerHTML=esc(it.t)+(it.s?'<span>'+esc(it.s)+'</span>':''); if(it.cur) b.setAttribute('aria-current','true'); b.onclick=it.on; list.appendChild(b); }); }); }
function stopRot(){ ctl.autoRotate=false; bRot.setAttribute('aria-pressed','false'); }
function status(s){ W&&(W.msg=s); updAmmo(); }
function updAmmo(){ if(!W){ wstat.hidden=true; return; } wstat.hidden=false; const h=Math.round(Math.min(100,W.heat/1.2)); wstat.innerHTML='<b>'+W.ammo+'</b> / '+W.cap+' <span>'+esc(W.data[2])+' · '+QUAL[W.q].n+'</span><i class="heat"><u style="width:'+h+'%"></u></i><span>Calor '+h+'%'+(h>=42?' · cano em brasa':'')+'</span>'+(W.msg?'<em>'+esc(W.msg)+'</em>':''); }

function renderArmas(){
  const w=WEAP[sel], cat=w[1]; W=null;
  if(side){
    const grp=G(), items=WEAP.filter(x=>x[1]===cat); let z=0; const sp=cat==='pis'||cat==='rev'?.17:(cat==='mtr'?.42:.3);
    items.forEach(x=>{ const m=buildWeapon(x); m.position.z=z; grp.add(m); const lb=label(x[0]+' · '+fmt(x[4])+' mm',sp*.3); lb.position.set(-lb.userData.w/2-.02,.0,z); grp.add(lb); z-=sp; });
    const L=Math.max(...items.map(x=>x[4]))/1000; const rl=ruler(Math.ceil(L*10)/10,.1,Math.ceil(L*10)*100+' mm',Math.max(L,.3)); rl.position.set(0,-.12*Math.max(L,.3)*.5,sp*.6); grp.add(rl);
    show(grp,new T.Vector3(.05,1,.35)); stopRot();
    setInfo(CATS[cat]+' · lado a lado',items.length+' armas em escala real',[],'Todas alinhadas pela coronha, na mesma escala, para comparar comprimento e silhueta. A régua marca 10 cm por divisão.');
  } else {
    const m=buildWeapon(w), grp=G(); grp.add(m); const L=w[4]/1000;
    const k=Math.max(L,.25); const rl=ruler(L,L<.4?.01:.1,fmt(w[4])+' mm',k); const b=new T.Box3().setFromObject(m); rl.position.set(0,b.min.y-.01*k,.06*k+.03); grp.add(rl);
    show(grp);
    const inner=m.userData.inner, ct=caseType(w[2]);
    W={wrap:m,P:inner.userData,data:w,cap:capOf(w[3]),ammo:capOf(w[3]),ctype:ct,kick:inner.userData.kick||kickOf(w[2]),flashK:{shell:1.6,big:2.6,tiny:.5,pistol:.8,rifle:1.2}[ct],L:L,rpm:w[8].rpm||0,burstN:w[8].burst||0,busy:false,locked:false,msg:'',q:curQ,rel:w[8].rel||1,heat:0,heatPer:{shell:6,big:9,tiny:1.2,pistol:3,rifle:4.5}[ct],jam:null};
    applyQuality(); $('#b-clear').hidden=true;
    stages.innerHTML=''; Object.keys(QUAL).forEach(k=>{ const b=document.createElement('button'); b.type='button'; b.id='q-'+k; b.textContent=QUAL[k].n; b.setAttribute('aria-pressed',k===curQ?'true':'false'); b.onclick=()=>{ curQ=k; W.q=k; applyQuality(); [...stages.querySelectorAll('[id^=q-]')].forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); updAmmo(); }; stages.appendChild(b); });
    setInfo(CATS[w[1]],w[0],[['Calibre',w[2]],['Capacidade',w[3]],['Comprimento',fmt(w[4])+' mm'],['Cano',fmt(w[5])+' mm'],['Peso vazio',String(w[6]).replace('.',',')+' kg'],['Alimentação',FAM[W.P.fam]||''],['Confiabilidade',W.rel<=.6?'muito alta':W.rel<=.9?'alta':W.rel<=1.2?'média':'baixa']],'Atire várias vezes seguidas: o cano esquenta, solta fumaça e fica em brasa. A qualidade (nova, usada, gasta, enferrujada) e o calor aumentam a chance de falha: nega, chaminé ou dupla alimentação, que se resolvem com Destravar. Teclado: espaço atira, R recarrega, B rajada, D destrava.','<p class="links">Comparar com a real: <a href="https://www.google.com/search?tbm=isch&q='+encodeURIComponent(w[0]+' '+w[2])+'" target="_blank" rel="noopener">fotos reais</a> · <a href="https://pt.wikipedia.org/w/index.php?search='+encodeURIComponent(w[0])+'" target="_blank" rel="noopener">Wikipédia</a></p>');
  }
  $('#b-burst').hidden=!(W&&W.rpm); updAmmo();
  const groups=Object.keys(CATS).map(c=>({h:CATS[c],items:WEAP.map((x,i)=>[x,i]).filter(p=>p[0][1]===c).map(p=>({t:p[0][0],s:p[0][2],cur:p[1]===sel,on:()=>{ sel=p[1]; render(); }}))}));
  listItems(groups);
}
function renderAmmo(){
  const grp=G(); let x=0; const pos=[];
  AMMO.forEach((a,i)=>{ const c=cartridge(a); c.position.x=x+a[1]/2; grp.add(c); pos.push(x+a[1]/2); const lb=label(a[0],4.5); lb.position.set(x+a[1]/2,1,12+(i%2)*7); grp.add(lb); x+=a[1]+7; });
  const rl=ruler(100,10,'100 mm',300); rl.position.set(0,0,30); grp.add(rl);
  grp.scale.setScalar(.001);
  show(grp,new T.Vector3(0,.42,1)); stopRot();
  const a=AMMO[sel]||AMMO[0];
  setInfo('Munições · tamanho real',a[0],[['Diâmetro do estojo',String(a[1]).replace('.',',')+' mm'],['Comprimento total',String(a[2]).replace('.',',')+' mm'],['Estojo',String(a[3]).replace('.',',')+' mm'],['Projétil',String(a[4]).replace('.',',')+' mm']],'Todos os calibres lado a lado na mesma escala, do .22 LR ao .50 BMG. Medidas nominais (CIP/SAAMI, arredondadas).');
  listItems([{h:'Calibres',items:AMMO.map((x,i)=>({t:x[0],s:String(x[2]).replace('.',',')+' mm',cur:i===sel,on:()=>{ sel=i; ammoFocus(pos); }}))}]);
}
function ammoFocus(pos){
  const a=AMMO[sel]; const t=new T.Vector3(pos[sel]*.001,a[2]*.0005,0); ctl.target.copy(t); const d=a[2]*.001*4.2; cam.position.set(t.x+d*.3,t.y+d*.35,t.z+d); stopRot();
  setInfo('Munições · tamanho real',a[0],[['Diâmetro do estojo',String(a[1]).replace('.',',')+' mm'],['Comprimento total',String(a[2]).replace('.',',')+' mm'],['Estojo',String(a[3]).replace('.',',')+' mm'],['Projétil',String(a[4]).replace('.',',')+' mm']],'Arraste para comparar com os vizinhos.');
  [...list.querySelectorAll('button')].forEach((b,i)=>b.toggleAttribute('aria-current',i===sel));
}
function renderExp(){
  const e=EXP[sel], grp=G(); const m=buildExp(e[1]); grp.add(m);
  const b=new T.Box3().setFromObject(m), L=b.max.x-b.min.x, H=b.max.y-b.min.y, len=Math.max(L,H);
  const step=len>.5?.1:.01; const rl=ruler(Math.ceil(len/step)*step,step,Math.round(Math.ceil(len/step)*step*1000)+' mm',Math.max(len,.25)); rl.position.set(b.min.x,b.min.y+.001,b.max.z+.03*Math.max(len,.25)); grp.add(rl);
  show(grp);
  setInfo('Explosivos',e[0],[['Efeito',e[2]]],e[3]);
  listItems([{h:'Explosivos e lança-foguetes',items:EXP.map((x,i)=>({t:x[0],cur:i===sel,on:()=>{ sel=i; render(); }}))}]);
}
function renderZInfo(){
  if(!Z) return;
  const parts=['head','jaw','neck','torso','pelvis'].map(k=>Z.segs.find(s=>s.type===k)).concat(['upperArm','forearm','hand','thigh','shin','foot'].flatMap(k=>Z.segs.filter(s=>s.type===k)));
  const rows=parts.map(s=>[NAMES[s.type]+(s.side?(s.side>0?' esq.':' dir.'):''), s.attached?Math.max(0,Math.round(s.hp))+' / '+s.max:'perdido']);
  setInfo('Zumbi · '+ZW[zw].n, Z.alive?Z.state+' · vida '+Math.max(0,Math.round(Z.life)):'Morto · '+(Z.why||''), rows, lastHit?'Último tiro: '+lastHit:'Toque em qualquer parte do zumbi para atirar com a arma escolhida. Cada parte tem vida própria: estoura ou é arrancada e sangra conforme a região (pescoço e coxa jorram muito, mãos e pés quase nada).');
}
function renderZumbi(){
  lastHit=''; show(buildZombie(),new T.Vector3(.8,.35,1)); Z.pools=[]; stopRot();
  const ks=Object.keys(ZW);
  stages.innerHTML='';
  ks.forEach(k=>{ const b=document.createElement('button'); b.type='button'; b.id='zw-'+k; b.textContent=ZW[k].n; b.setAttribute('aria-pressed',k===zw?'true':'false'); b.onclick=()=>{ zw=k; [...stages.querySelectorAll('[id^=zw-]')].forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); renderZInfo(); }; stages.appendChild(b); });
  const acts=[['Reiniciar',()=>render()],['Sem cabeça',()=>{ const s=Z.segs.find(x=>x.type==='neck'); if(s&&s.attached){ lastHit=damage(s,999,new T.Vector3(0,.3,-1),null,null); renderZInfo(); } }],['Mancando',()=>{ const s=Z.segs.find(x=>x.type==='foot'&&x.side<0); if(s&&s.attached){ lastHit=damage(s,999,new T.Vector3(1,0,0),null,null); renderZInfo(); } }],['Rastejador',()=>{ const s=Z.segs.find(x=>x.type==='thigh'&&x.side<0); if(s&&s.attached){ lastHit=damage(s,999,new T.Vector3(1,0,0),null,null); renderZInfo(); } }],['Partido ao meio',()=>{ const s=Z.segs.find(x=>x.type==='torso'); if(s&&s.attached){ lastHit=damage(s,999,new T.Vector3(0,.5,-1),null,null); renderZInfo(); } }]];
  acts.forEach(([n,f],i)=>{ const b=document.createElement('button'); b.type='button'; b.className='act'; b.id='za-'+i; b.textContent=n; b.onclick=f; stages.appendChild(b); });
  renderZInfo();
  listItems([{h:'Sangramento por região',items:[['Pescoço e cabeça','jorra muito'],['Coxa','jorra (artéria)'],['Braço','alto'],['Tronco e quadril','médio'],['Antebraço e canela','baixo'],['Mão, pé e mandíbula','quase nada']].map(x=>({t:x[0],s:x[1],on:()=>{}}))}]);
}
function renderCarro(){
  const st=Math.min(stage,4); show(car(st),new T.Vector3(1,.45,.9));
  setInfo('Veículo destrutível',CST[st][0],[['Etapa',(st+1)+' de 5']],CST[st][1],'<p>Os modelos novos de veículos estão sendo feitos pelo time de Veículos.</p>');
  listItems([{h:'Etapas de dano',items:CST.map((x,i)=>({t:x[0],cur:i===st,on:()=>{ stage=i; render(); }}))}]);
}
function renderParede(){
  const st=Math.min(stage,3); show(wall(wm,st),new T.Vector3(.55,.35,1));
  setInfo('Cenário destrutível · '+WMAT[wm].n,WST[st][0],[['Material',WMAT[wm].d]],WST[st][1],'<p>Destruição com partículas, furos de bala presos nos blocos, portas e ferro amassando e cercas quebrando: <a href="../efeitos/oficina-vfx.html" style="color:var(--brass)">Oficina de VFX</a>.</p>');
  listItems([{h:'Material',items:Object.keys(WMAT).map(k=>({t:WMAT[k].n,cur:k===wm,on:()=>{ wm=k; render(); }}))}]);
}
function render(){
  W=null; Z=null;
  bSide.hidden = tab!=='armas'; bSide.setAttribute('aria-pressed',side?'true':'false');
  wctl.hidden = !(tab==='armas'&&!side);
  hint.textContent = tab==='zumbi'?'Toque no zumbi para atirar · arraste para girar':'Arraste para girar · role ou pince para aproximar · régua em escala real';
  if(tab==='armas'){ setStages(null); renderArmas(); }
  if(tab==='ammo'){ setStages(null); renderAmmo(); }
  if(tab==='exp'){ setStages(null); renderExp(); }
  if(tab==='zumbi'){ renderZumbi(); }
  if(tab==='carro'){ setStages(CST); renderCarro(); }
  if(tab==='parede'){ setStages(WST); renderParede(); }
  updAmmo();
  if(tab!=='zumbi'&&tab!=='ammo'&&!(tab==='armas'&&side)) ctl.autoRotate = bRot.getAttribute('aria-pressed')==='true';
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  tab=b.dataset.t; sel=0; stage=0; side=false; bRot.setAttribute('aria-pressed',(tab==='ammo'||tab==='zumbi')?'false':'true'); render();
});
bRot.onclick=()=>{ const on=bRot.getAttribute('aria-pressed')!=='true'; bRot.setAttribute('aria-pressed',on?'true':'false'); ctl.autoRotate=on; };
bSide.onclick=()=>{ side=!side; if(!side) bRot.setAttribute('aria-pressed','true'); render(); };
$('#b-fire').onclick=()=>fire(); $('#b-clear').onclick=()=>clearJam(); $('#b-burst').onclick=()=>burst(); $('#b-reload').onclick=()=>reload();
document.addEventListener('keydown',e=>{ if(tab!=='armas'||side||!W||e.target.closest('input,textarea')) return; if(e.code==='Space'){ e.preventDefault(); fire(); } else if(e.key==='r'||e.key==='R') reload(); else if(e.key==='b'||e.key==='B') burst(); else if(e.key==='d'||e.key==='D') clearJam(); });
let down=null; renderer.domElement.addEventListener('pointerdown',e=>{ down={x:e.clientX,y:e.clientY}; });
renderer.domElement.addEventListener('pointerup',e=>{ if(!down) return; const m=Math.hypot(e.clientX-down.x,e.clientY-down.y); down=null; if(m<6&&tab==='zumbi') shootZombie(e.clientX,e.clientY); });
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(render,render);
})();
