/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions, no-unused-labels */
// @ts-nocheck
// Literal port of the game's Bestiário v17 body builder (G 65787-66014 `BEST`, from implementacao/zumbi-arte/bestiario-zombiada.html `build()`), kept as the team
// wrote it so a diff against the game stays readable. Changes from the source, all listed in KNOWN_DEVIATIONS: three.js and the type cards come in as
// parameters; the random look comes from the engine's `drawAppearance` (the same `VR` draws in the same order), the blood stream from `createBloodStream`.
import { createBloodStream, createRng, drawAppearance } from '@adatechnology/game-characters'

import type { Three } from '../three'

export type BestTypeCard = {
  /** The name `spec.type` looks the type up by (the Bestiário's `nome`). */
  readonly name: string
  /** Eye colour as a number (0xRRGGBB). */
  readonly eye: number
}

export type BestBuilderOptions = {
  readonly types: readonly BestTypeCard[]
  /** Draws a phase or a seed when the spec has none. Default `Math.random`. */
  readonly random?: () => number
}

export type BestBuilder = {
  build(spec: Record<string, any>): any
  TYPES: Record<string, Record<string, number | boolean>>
  /** Level of detail: 1 full, 0.5, 0.28 (segments and sphere resolution scale with it). */
  setLOD(factor: number): void
  /** The shirt material of the last body built (the bake marks it as material 1). */
  topM(): any
}

export const createBestBuilder = (THREE: Three, { types, random = Math.random }: BestBuilderOptions): BestBuilder => {
  const options = { types, random }
  let LK = 1, topM_ref = null;
  const SPH = (r, w = 8, h = 6, ...a) => new THREE.SphereGeometry(r, Math.max(4, Math.round(w * LK)), Math.max(3, Math.round(h * LK)), ...a);
  const CYL = (a, b, h, rs = 8, ...x) => new THREE.CylinderGeometry(a, b, h, Math.max(4, Math.round(rs * LK)), ...x);
  const TOR = (r, t, rs = 8, ts = 6, ...x) => new THREE.TorusGeometry(r, t, Math.max(3, Math.round(rs * LK)), Math.max(4, Math.round(ts * LK)), ...x);
  const BCARDS = options.types.map(c => ({ n: c.name, eye: '#' + c.eye.toString(16).padStart(6, '0') }));
  const glowTex = null;
  const rng = createRng;
  const BLOB=(()=>{const sh=new THREE.Shape(),N=24,R=rng(123),a=[R()*6,R()*6,R()*6];
    for(let i=0;i<N;i++){const t=i/N*6.2832,r=1+.14*Math.sin(3*t+a[0])+.08*Math.sin(5*t+a[1])+.05*Math.sin(9*t+a[2])+(R()-.5)*.1+(i%5===0?R()*.22:0);
      i?sh.lineTo(Math.cos(t)*r,Math.sin(t)*r):sh.moveTo(Math.cos(t)*r,Math.sin(t)*r)}
    sh.closePath();const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);return g})();
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
  const PI=Math.PI; let SEG=16;
  const TORSO_P=[[.18,.86],[.205,.95],[.195,1.03],[.19,1.12],[.225,1.27],[.26,1.4],[.265,1.47],[.21,1.55],[.085,1.6]];
  const TORSO_F=[[.17,.86],[.215,.95],[.2,1.02],[.165,1.1],[.2,1.25],[.245,1.38],[.25,1.46],[.2,1.54],[.085,1.6]];
  const torsoGeo=(sx,sz,fem)=>{const g=new THREE.LatheGeometry(new THREE.SplineCurve((fem?TORSO_F:TORSO_P).map(p=>new THREE.Vector2(p[0],p[1]))).getPoints(Math.max(8,Math.round(30*LK))),Math.max(6,Math.round(24*LK)));g.scale(1.12*(sx||1),1,.64*(sz||1));return g};
  const cylDown=(r1,r2,len)=>CYL(r1,r2,len,SEG,1).translate(0,-len/2,0);
  const capGeo=(r,len)=>SPH(r,20,10,0,PI*2,0,len||PI/2);

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
    const ti=Math.max(0,BCARDS.findIndex(x=>x.n===spec.type)), z=BCARDS[ti];
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
    const BR=createBloodStream(spec.seed??7); // sangue igual nos três LODs
    const uni=!!spec.uniform;
    const { traits: T, random: VR } = drawAppearance({ seed: spec.seed??(options.random()*1e9|0), outfit: { cloth: O.cloth, pants: O.pants, hat: O.hat }, uniform: uni, typeIndex: ti, clothIndex: spec.clothIdx,
      female: spec.fem, allowFemale: spec.type!=="Brutamonte", tone: spec.tone, hairStyle: spec.hs||undefined, hairColor: spec.hair, wet: !!P.wet, charred: !!P.char, human: !!spec.human, life });
    const fem=T.female, tone=T.tone;
    const skinC=spec.skin??(uni?SKIN[d]:col(tone,SKIN[d],[.45,.65,.8,.88][d]));
    const topC=T.topColor, pantC=T.pantsColor;
    const V={sleeve:T.sleeve,hair:T.hair,hx:T.headWidth,hy:T.headHeight,jaw:T.jaw,nose:T.nose,beard:T.beard,glasses:T.glasses,cap:T.cap,capC:T.capColor,bag:T.bag,bagC:T.bagColor,torn:T.torn,apron:T.apron};
    const hairC=T.hairColor;
    const skinFinal=P.char?0x1c1612:P.wet?col(skinC,0x7a8fa0,.55):skinC;
    const skinM=M(skinFinal);
    const topM=M(P.char?col(topC,0x151210,.75):P.wet?col(topC,0x1a2230,.45):col(topC,GRAY,d*.3)), pantsM=M(col(pantC,GRAY,d*.3)), shoeM=M(T.shoeColor), red=M(RED);
    const add=(p,geo,m,x,y,z,rx,ry,rz)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);p.add(o);return o};
    const ball=(p,r,m,x,y,z)=>add(p,SPH(r,SEG,12),m,x,y,z);
    topM_ref=topM;
    // sangue no corpo: mancha plana irregular colada na roupa (mesma forma BLOB do chão), com satélites; n>0 deixa um filete escorrendo
    const SKM={},skM=c=>SKM[c]||(SKM[c]=new THREE.MeshStandardMaterial({color:c,roughness:.3,metalness:0,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
    const flat=(p,x,y,zz,sx,sy,c)=>{const m=new THREE.Mesh(BLOB,skM(c));m.rotation.set(PI/2,0,BR()*6.28);m.scale.set(sx,1,sy);m.position.set(x,y,zz);p.add(m);return m};
    const splat=(p,x,y,zz,r,c,n)=>{const a=flat(p,x,y,zz+.004,r,r*(.7+BR()*.5),c);
      for(let k=0;k<(n||0);k++){const an=BR()*6.28,dd=r*(1.2+BR()*.9),q=r*(.12+BR()*.18);flat(p,x+Math.cos(an)*dd,y+Math.sin(an)*dd,zz+.004,q,q*.7,c)}
      if(n)run(p,x+r*.15,y-r*.5,y-r*(2.2+BR()*1.2),zz+.003,zz,c,r*.35);return a};
    // filete: desce pela pele/roupa afinando e termina num bulbo (é dali que a gota cai)
    const run=(p,x,y0,y1,z0,z1,c,w)=>{const L=y0-y1,sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.quadraticCurveTo(w*.3,-L*.5,w*.18,-L);sh.lineTo(-w*.12,-L);sh.quadraticCurveTo(-w*.35,-L*.5,-w/2,0);
      const g=new THREE.ShapeGeometry(sh),m=new THREE.Mesh(g,skM(c));m.position.set(x,y0,z0);m.rotation.x=-Math.atan2(z0-z1,L);p.add(m);
      const bl=new THREE.Mesh(SPH(w*.42,10,8),skM(c));bl.scale.set(1,1.35,.5);bl.position.set(x+w*.03,y1,z1);p.add(bl);return bl};
    const stump=(p,r,y,up)=>{const st=ball(p,r*1.02,red,0,y,0);st.scale.set(1,.35,1);add(p,CYL(r*.32,r*.36,.07,10),M(0xe8e0cc),0,y+(up?.04:-.04),0)};
    const ring=(p,r,h,m,y,sx,sz)=>{const o=add(p,CYL(r,r,h,24),m,0,y,0);o.scale.set(sx||1.12,1,sz||.7);return o};
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
      const belly=add(U,SPH(.34,24,18),sickM,0,1.06,.1);belly.scale.set(1.12,1,1.08);
      const shirt=add(U,SPH(.355,24,10,0,PI*2,0,PI*.42),topM,0,1.08,.1);shirt.scale.set(1.12,1,1.08);
      for(let k=0;k<7;k++){const a=-1+k*.33+Math.sin(k*3.1)*.12,b=.05+((k*37)%5)*.11;const vv=add(U,SPH(.012,8,6),veinM,Math.sin(a)*.36,1.0-b*.5,.1+Math.cos(a)*.36);vv.scale.set(1,6,1);vv.rotation.z=a*.8}
      const pus=[[.12,1.0],[-.17,.92],[.02,.86],[-.06,1.12],[.2,.88],[-.22,1.05]];
      drip(U,.05,.8,.3,"bile",1.6);pus.forEach(([x,y],k)=>{const zz=.1+Math.sqrt(Math.max(.01,.34*.34-x*x/1.25-(y-1.06)**2))*1.08;const r=.022+(k%3)*.01;
        add(U,SPH(r,10,8),basic(z.eye),x,y,zz).userData.eye=1;const g=glow(z.eye,r*5,.55);g.position.set(x,y,zz+.02);U.add(g)});
      add(U,CYL(.09,.1,.12,16),sickM,0,1.62,0);
      frontZ=.38;
    }else add(U,torsoGeo(1,1,fem),topM);
    if(P.char){const emb=[[.1,1.2,.17],[-.12,1.35,.17],[.02,1.02,.16],[-.15,1.08,.15],[.16,1.42,.15],[0,1.5,-.15],[.12,1.1,-.16]];
      emb.forEach(([x,y,zz])=>{const c=add(U,SPH(.018,8,6),basic(0xff6a1a),x,y,zz);c.userData.eye=1;c.scale.set(2.2,.6,.5);const g=glow(0xff5a10,.12,.7);g.position.set(x,y,zz*1.1);U.add(g)});
      emb.forEach(([x,y,zz],k)=>{if(k%2)return;const o=new THREE.Object3D();o.position.set(x,y,zz*1.1);o.userData.ember={smoke:k===0||k===4};U.add(o)})}
    if(P.gore){splat(U,0,1.4,frontZ+.01,.07,0x8a0a0a,5);splat(U,-.08,1.18,frontZ+.01,.05,0x8a0a0a,3)}
    if(V.bag&&!P.bloat){const bm=M(V.bagC),sm=M(col(V.bagC,0x111111,.5));const b=ball(U,.2,bm,0,1.22,-.25);b.scale.set(1.05,1.25,.62);const f=ball(U,.12,bm,0,1.12,-.36);f.scale.set(1.2,.8,.5);
      [-1,1].forEach(sx=>{const st=add(U,TOR(.2,.018,6,18,PI*1.1),sm,sx*.14,1.3,0);st.rotation.set(0,PI/2,0)})}
    if(spec.type==="Brutamonte"){[-1,1].forEach(sx=>{const t=ball(U,.17,topM,sx*.2,1.53,-.03);t.scale.set(1.2,.8,1)});const hb=ball(U,.2,topM,0,1.45,-.12);hb.scale.set(1.5,.9,.8)}
    if(O.vest){const v=add(U,CYL(.275,.24,.48,24),M(O.vest),0,1.3,0);v.scale.set(1.12,1,.7);for(let i=0;i<3;i++)add(U,geoBox(.11,.13,.05),M(O.vest),-.15+i*.15,1.17,.17)}
    if(O.stripes){ring(U,.205,.05,M(O.stripes),1.03,1.13,.68);ring(U,.268,.05,M(O.stripes),1.42,1.13,.67)}
    if(d===3&&!P.bloat)[0,1,2].forEach(k=>add(U,geoBox(.2,.022,.02),M(0xd8cfb8),0,1.3+k*.065,.168));
    if(!spec.human){const bk=new THREE.Group();bk.rotation.y=PI;U.add(bk);splat(bk,-.05,1.3,frontZ+.01,.07,col(BLOOD[Math.min(d,2)],0x1a0806,.2),2)} // mancha nas costas: lê-se também rastejando ou de costas
    if(!spec.human){const wy=P.bloat?1.25:1.36,hy=P.bloat?1.02:.98;run(U,.08,wy-.03,hy,frontZ+.012,frontZ-.01,col(BLOOD[d],0x1a0806,.35),.022);drip(U,.083,hy-.012,frontZ-.005);const bs=.07+.05*(3-d);splat(U,.07,P.bloat?1.25:1.36,frontZ+(O.vest?.02:0),bs*.42,col(BLOOD[d],0x1a0806,.35),d<2?3:1)}
    for(let k=0;k<(spec.wounds||0);k++)splat(U,-.13+k*.13,1.15+.13*(k%2),frontZ+.012,.032,0x2a0503,2);
    if(cut.gut){const gm=M(0xb04a50);for(let k=0;k<6;k++){const q=add(U,TOR(.05,.022,6,10),gm,(k%2?.04:-.03),1.0-k*.06,frontZ+.02,0,k*.7,0);q.userData.flap=true}
      const hole=ball(U,.1,red,0,1.05,frontZ-.03);hole.scale.set(1.2,1,.3);drip(U,0,.75,frontZ+.02,null,.5)}
    if(cut.flaps){[[.12,1.2],[-.1,1.35],[.02,.98]].forEach(([x,y],k)=>{const f=add(U,geoBox(.07,.12,.012),k%2?skinM:M(0x9a2a2a),x,y,frontZ+.03);f.geometry.translate(0,-.06,0);f.userData.flap=true;drip(U,x,y-.12,frontZ+.03,null,1.5)})}
    // pescoço e cabeça
    const neckLen=.14+Math.max(0,P.neck);
    if(!cut.head)add(U,CYL(.058,.068,neckLen,SEG),skinM,0,1.63+Math.max(0,P.neck)/2,0);
    const headG=new THREE.Group();headG.position.set(0,1.64+P.neck,P.headFwd||0);headG.rotation.x=P.headX;headG.rotation.z=P.headZ;U.add(headG);
    const Hd=new THREE.Group();Hd.position.y=-1.64;headG.add(Hd);
    if(cut.head){
      const jaw=add(Hd,SPH(.12,16,12),skinM,0,1.69,.03);jaw.scale.set(1,.6,1);
      drip(U,0,1.6,.1,null,.6);const hst=ball(Hd,.11,red,0,1.74,.02);hst.scale.set(1,.35,1);add(Hd,CYL(.03,.035,.08,10),M(0xe8e0cc),0,1.78,0);splat(U,0,1.5,.2,.05,BLOOD[0],3);
    }else{
      if(cut.blown){head0:{const hb=add(Hd,SPH(.165,20,16,0,PI*2,PI*.55,PI*.45),skinM,0,1.8,0);hb.scale.set(.96,1.1,1.02);const cv=ball(Hd,.15,red,0,1.82,0);cv.scale.set(.95,.3,.95);
        for(let k=0;k<5;k++){const f=ball(Hd,.03,k%2?M(0xe8e0cc):red,Math.cos(k*1.3)*.13,1.86,Math.sin(k*1.3)*.13);f.scale.set(1.4,.6,.9)};drip(Hd,0,1.7,.1,null,.4)}}
      const head=add(Hd,SPH(.165,20,16),skinM,0,1.8,0);if(cut.blown)head.visible=false;head.scale.set(.96*V.hx*(P.bloat?1.12:1),1.1*V.hy,1.02*(P.bloat?1.08:1));
      const jaw=add(Hd,SPH(.12,16,12),skinM,0,1.715,.03);jaw.userData.bone=11;jaw.scale.set(V.jaw*(P.bloat?1.3:1),.72*(P.bloat?1.25:1),1);
      if(cut.jaw){jaw.geometry.translate(0,0,.06);jaw.position.set(.03,1.70,-.04);jaw.rotation.set(.75,0,.35);add(Hd,SPH(.07,10,8),red,0,1.72,.11).scale.set(1.3,.5,.4);drip(Hd,.02,1.6,.12,null,.6);jaw.userData.flap=true}
      [-1,1].forEach(s=>{const e=ball(Hd,.038,skinM,s*.158,1.79,-.005);e.scale.set(.6,1,.9)});
      const nose=add(Hd,geoBox(.045,.065,.05),skinM,0,1.765,.172);nose.scale.set(V.nose,V.nose,1);if(P.nose)nose.scale.set(1.5,1.4,2.2);
      let covered=false;
      if(O.hat){const c=M(O.hatC);covered=true;
        if(O.hat==="cap"){const o=add(Hd,capGeo(.182),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,geoBox(.28,.022,.17),c,0,1.85,.2,.12,0,0)}
        if(O.hat==="helmet"){const o=add(Hd,capGeo(.205,PI*.55),c,0,1.82,-.01);o.scale.set(1,1,1.08)}
        if(O.hat==="hardhat"){const o=add(Hd,capGeo(.198),c,0,1.86,0);o.scale.set(1,1.02,1.08);add(Hd,CYL(.25,.25,.02,24),c,0,1.865,.02)}
        if(O.hat==="fire"){const o=add(Hd,capGeo(.205),c,0,1.86,0);o.scale.set(1,1.02,1.1);const br=add(Hd,CYL(.27,.27,.02,24),c,0,1.86,-.06);br.scale.set(1,1,1.25);add(Hd,geoBox(.09,.08,.02),M(0xd8b040),0,1.96,.205)}
        if(O.hat==="moto"){const o=add(Hd,SPH(.235,20,16),c,0,1.81,-.01);o.scale.set(.98,1.04,1.06);add(Hd,SPH(.226,20,6,PI*.18,PI*.64,PI*.36,PI*.2),new THREE.MeshLambertMaterial({color:0x22303c}),0,1.81,.02)}}
      if(O.mask)add(Hd,geoBox(.24,.12,.04),M(0xe8eef0),0,1.72,.15);
      if(!covered&&V.cap){const c=M(V.capC);const o=add(Hd,capGeo(.182),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,geoBox(.28,.022,.17),c,0,1.85,.2,.12,0,0);covered=true}
      const hc=M(hairC);
      if(!cut.blown&&!(d===3&&VR()<.6)){
        const hairCap=(r,len,tilt)=>{const o=add(Hd,capGeo(r+.008,len),hc,0,1.8,-.004);o.scale.set(.97*V.hx,1.15*V.hy,1.04);o.rotation.x=tilt;return o};
        const backBand=(t0,tl)=>{const o=add(Hd,SPH(.172,20,8,PI*.85,PI*1.3,t0,tl),hc,0,1.8,0);o.scale.set(.97*V.hx,1.1*V.hy,1.04);return o};
        const hs=V.hair;
        if(!covered&&(hs==="short"||hs==="bun"||hs==="long"))hairCap(.174,PI/2,-.38);
        if(hs==="short"||hs==="bun"||hs==="long")backBand(PI*.45,PI*.22);
        if(!covered&&hs==="bun")ball(Hd,.085,hc,0,1.92,-.15);
        if(hs==="long"){const l=add(Hd,CYL(.15,.12,.42,16,1,false,PI*.6,PI*.8),hc,0,1.66,-.02);l.scale.set(1.05,1,1.1)}
        if(!covered&&hs==="buzz")hairCap(.17,PI*.45,-.32);
        if(hs==="bald")backBand(PI*.42,PI*.2);
        if(!covered&&hs==="afro"){const a=add(Hd,SPH(.23,16,12,0,PI*2,0,PI*.62),hc,0,1.93,-.08);a.scale.set(1.08,.85,.95)} // não cobre os olhos
      }
      if(V.beard){const b=add(Hd,SPH(.128,16,12),hc,0,1.7,.035);b.scale.set(1.02*V.jaw,.78,1)}
      if(V.glasses){add(Hd,geoBox(.27,.012,.015),M(0x1a1a1a),0,1.84,.175);[-1,1].forEach(s=>{add(Hd,geoBox(.09,.055,.012),new THREE.MeshLambertMaterial({color:0x8fb0c0,transparent:true,opacity:.3}),s*.06,1.817,.18);add(Hd,geoBox(.012,.012,.17),M(0x1a1a1a),s*.15,1.83,.09)})}
      if(P.mouth){const m=add(Hd,geoBox(.1,.09,.03),basic(0x050505),0,1.69,.14)}
      if(P.gore)splat(Hd,0,1.7,.15,.05,0x8a0a0a,3);
      else if(!spec.human){add(Hd,geoBox(.125,.055,.014),M(0x9a5a52),0,1.69,.143);add(Hd,geoBox(.085,.03,.014),M(0x140303),0,1.69,.151)} // boca aberta: lábio claro em volta da abertura escura
      const moto=O.hat==="moto", eyeZ=moto?.245:.162, dim=spec.eyeDim??(P.dim||moto), eye=spec.eye??z.eye;
      [-1,1].forEach(s=>{
        if(cut.blown)return;
        if(P.blind&&!spec.human){add(Hd,SPH(.03,10,8),M(0xe8e4d8),s*.058,1.815,.152);return}
        if(spec.human){add(Hd,geoBox(.05,.03,.012),M(0xe8e4dc),s*.058,1.815,.156);add(Hd,geoBox(.022,.024,.012),M(0x1a1412),s*.058,1.814,.163);add(Hd,geoBox(.06,.012,.02),M(hairC),s*.058,1.85,.158,0,0,-s*.12);return}
        if(spec.eyesOff){add(Hd,geoBox(.05,.028,.02),basic(0x2a2a22),s*.058,1.815,.158);return}
        add(Hd,geoBox(.052,.03,.02),basic(eye),s*.058,1.815,eyeZ).userData.eye=1;
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
        if(spec.bandage&&s<0)add(el,CYL(.068,.064,.09,SEG),M(0xe8e4d8),0,-.17,0)}
      const dang=(s>0?cut.dangleR:cut.dangleL);if(dang&&!isCut){const fl=add(el,CYL(.065,.05,.06,10),red,0,.01,0);drip(el,0,-.33,0,null,.8);el.userData.dangle=true}
      if((s>0?cut.shoulderR:cut.shoulderL)){g.children.slice().forEach(c=>{if(c!==el)g.remove(c)});el.visible=false;stump(g,.085,0);drip(g,0,-.05,0,null,.7)}
      g.rotation.x=r;g.rotation.z=s*(.07+(P.armOut||0));el.rotation.x=isCut?0:er;
      arms.push({g,el,s,base:r,eBase:el.rotation.x});
    });
    const flaps=[];root.traverse(o=>{if(o.userData.flap)flaps.push(o)});
    const rig={flaps,dangles:arms.filter(a=>a.el.userData.dangle),type:spec.type||"Lento",fig,upper,headG,arms,legs,P,ph:(spec.phase??options.random()*6),dropBase:fig.position.y,leanBase:P.lean,hxBase:P.headX};
    if(spec.lying){root.rotation.x=-PI/2;root.position.set(0,.16*P.s,.9*P.s);const w=new THREE.Group();w.add(root);return w}
    root.userData.rig=rig;return root;
  }


  return { build, TYPES, setLOD(k) { LK = k; SEG = Math.max(5, Math.round(16 * k)); }, topM: () => topM_ref };
}
