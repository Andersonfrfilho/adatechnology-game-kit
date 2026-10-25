/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html `build`, `pose`, `zombify`, `buildPerson`), kept as the team wrote it so a diff
// against the page stays readable. The accessories (face, hats, clothing and gear, hand items) are registries in `./accessories`; the primitives are in `./person-kit`;
// the hands are in `./accessories/hands` and have fingers only at the highest level of detail. Changes from the page, all listed in KNOWN_DEVIATIONS: three.js, the random
// stream and the canvas come in as options; the walk blend is the engine's `MOVES`.
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import { MOVES, createRng } from '@adatechnology/game-characters'

import type { Three } from '../three'

import { FACE_FEATURES } from './accessories/face-features'
import { buildHand } from './accessories/hands'
import { HAND_ITEMS } from './accessories/hand-items'
import { HATS } from './accessories/hats'
import { EXTRAS } from './accessories/extras'
import { createPersonKit } from './person-kit'

export type PersonBuilderOptions = {
  /** The stream for stains and phases. The page shared one `rng(77)` across the cast, built in order; default the same. */
  readonly random?: () => number
  readonly createCanvas?: () => HTMLCanvasElement
  /** 0 is the highest level of detail (fingers drawn); anything above skips the fingers. Default 0. */
  readonly detail?: number
  /** `prefers-reduced-motion`: no idle motion in `pose`. */
  readonly reducedMotion?: boolean
  /** Eye colour of a zombified body by category (default the page's: lento, corredor, brutamonte). */
  readonly zombieEyes?: Readonly<Record<string, number>>
}

export type PersonBuilder = {
  build(spec: Record<string, any>, index?: number): any
  pose(character: any, zombie: boolean, walk: number, time: number): void
  zombify(character: any, category?: string): void
  buildPerson(person: Record<string, any>, zombie: boolean): { root: any; chars: any[] }
}

const PAGE_EYES = { lento: 0xe3c341, corredor: 0xe5392b, brutamonte: 0xef8a2a }

export const createPersonBuilder = (host: Three, options: PersonBuilderOptions = {}): PersonBuilder => {
  const THREE = shapeGeometries(host)
  const kit = createPersonKit(THREE, { random: options.random ?? createRng(77), createCanvas: options.createCanvas })
  const { PI, R, scaleHex, Bx, add, cmat, ball, ring, cap, limb, mlimb, torsoGeo, splat, stainM, chessTex } = kit
  const reduce = options.reducedMotion ?? false
  const detailed = (options.detail ?? 0) === 0
  const EYE = { ...PAGE_EYES, ...options.zombieEyes }
  const T = THREE
  const ZSKIN2 = new T.Color(0x6f7a5c)
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
  add(Hd,Bx(.064,.013,.02),cmat(scaleHex(sp.skin,.68)),0,1.703,.156);
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
  for (const feature of FACE_FEATURES) if (feature.ids.some((id) => f.includes(id))) feature.apply({ THREE, PI, Hd, add, Bx, cmat, hc, sp, f, scaleHex });
  // hats
  if(sp.hat){const k=sp.hat.k,c=cmat(sp.hat.c);
    HATS.find((hat) => hat.kinds.includes(k))?.apply({ THREE, PI, Hd, add, Bx, cmat, cap, c, k, sp });
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
    const { fingers, th } = buildHand({ THREE, add, hg, handM, s, detailed });
    const mount=new THREE.Group();mount.position.set(0,-.04,.015);hg.add(mount);
    g.rotation.z=s*.07;
    arms.push({g,el,hg,mount,s,fingers,th});}
  // extras
  for(const e of sp.ex||[]){const [k,c]=e;const m=c!==undefined?cmat(c):null;
    EXTRAS[k]?.({ THREE, PI, U, Hd, root, add, Bx, cmat, ring, torsoGeo, legs, arms, fem, topM, m, e, k, headG, fig, upper, skinM, sp, splat, R, ball, cap, hc });
  }
  // back weapon
  if(sp.back==='shotgun'){const g=new THREE.Group();g.position.set(0,1.22,-.2-(exHas('backpack')?.22:0));g.rotation.z=.75;U.add(g);
    add(g,Bx(.05,.9,.05),cmat(0x1c1d1f,{metalness:.6,roughness:.45}),0,.15,0);add(g,Bx(.07,.36,.09),cmat(0x6a3a1c),0,-.45,0);add(g,Bx(.06,.22,.07),cmat(0x6a3a1c),0,.15,.03);
    add(U,Bx(.04,.9,.02),cmat(0x3a2a1a),0,1.22,.175,0,0,-.75);}
  // hand items
  function item(kind,mount){if(!kind)return;const g=new THREE.Group();mount.add(g);
    const metal=cmat(0x8a9096,{metalness:.7,roughness:.35}),dark=cmat(0x1c1d1f,{metalness:.6,roughness:.45}),woodM=cmat(0x6a3a1c);
    HAND_ITEMS[kind]?.({ THREE, PI, add, Bx, cmat, g, metal, dark, woodM });
  }
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
  return {mv:Object.assign({},MOVES_IDLE),phase:0,turnA:0,segs,dmg:{leg:0,dead:0},pends:[],limp:[0,0],skirt:!!sp.pants.skirt,root,fig,upper,headG,arms,legs,skinM,base:new THREE.Color(sp.skin),eyeM,bags,zb,mouth,dog,hunch:sp.hunch||0,ph:R()*6};
}
  const MOVES_IDLE = MOVES.idle
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
  function buildPerson(p,zed){
  const root=new THREE.Group(),chars=[];
  if(p.b){const c=build(p.b,0);chars.push(c);root.add(c.root);if(zed&&!p.kid)zombify(c,p.zcat);c.z=zed&&!p.kid}
  (p.kids||[]).forEach(k=>{const c=build(k,0);c.root.position.x=k.x;c.root.rotation.y=-k.x*.4;c.z=false;chars.push(c);root.add(c.root)});
  chars.forEach(c=>pose(c,c.z,0,0));
  return {root,chars};
}
  return { build, pose, zombify, buildPerson }
}
