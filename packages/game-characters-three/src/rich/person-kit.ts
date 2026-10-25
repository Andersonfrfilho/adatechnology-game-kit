/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-expressions */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html), kept as the team wrote it so a diff against the page stays readable.
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import type { Three } from '../three'

export type PersonKitOptions = {
  /** The stream the blood stains and the person's own phase draw from. The page used one shared `rng(77)` for the whole cast. */
  readonly random: () => number
  /** A canvas for the plaid texture (default: the document's). */
  readonly createCanvas?: () => HTMLCanvasElement
}

/** The page's primitives: materials are cached by colour, `add` puts a mesh in a parent, and the `ball`/`ring`/`limb` shapes of the anatomical body. */
export const createPersonKit = (host: Three, { random: R, createCanvas = () => document.createElement('canvas') }: PersonKitOptions) => {
  const THREE = shapeGeometries(host)
  const T = THREE
  // The page multiplied the colour in sRGB (three r128 did not convert) and read the hex back truncating; r160 multiplies in linear space, which would darken differently.
  const scaleHex=(hex,factor)=>{const channel=(shift)=>((hex>>shift)&255)/255*factor*255;return (channel(16)<<16)^(channel(8)<<8)^(channel(0)<<0)};
const Bx=(x,y,z)=>new T.BoxGeometry(x,y,z);
function add(parent,geo,m,x,y,z,rx,ry,rz){const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function canvasTex(w,h,draw){const cv=createCanvas();cv.width=w;cv.height=h;const context=cv.getContext("2d");if(context)draw(context,w,h);return new T.CanvasTexture(cv)}
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
  const core=skin?stainM(color,{roughness:.12,metalness:.1}):stainM(scaleHex(color,.72));
  const a=push(add(parent,blobGeo(blobR(40,skin?.4:.9,seed),r*.82,r*.82*sy),core,x,y,z+.004));
  if(!skin){push(add(parent,blobGeo(blobR(48,1.6,seed+.3),r*1.3,r*1.3*sy),stainM(color,{transparent:true,opacity:.5,depthWrite:false}),x,y,z+.002));}
  for(let k=0;k<(n||0);k++){const ang=R()*6.28,d=r*(1.2+R()*.9),rr=r*(.16+R()*.2);
    push(add(parent,blobGeo(blobR(14,.5,R()*10),rr,rr*(1+R()*.6)),core,x+Math.cos(ang)*d,y+Math.sin(ang)*d-(k===0?r*.6:0),z+.004,0,0,ang));}
  if(n&&(fresh||skin)){const L=r*(1.4+R()*1.2),w=r*.16;const g=new THREE.Shape();g.moveTo(-w,0);g.quadraticCurveTo(-w*.6,-L*.6,-w*.35,-L);g.absarc(0,-L,w*.6,PI,0,false);g.quadraticCurveTo(w*.6,-L*.6,w,0);
    push(add(parent,new THREE.ShapeGeometry(g),core,x+r*.15,y-r*.55,z+.005));}
  return a;}
  return { THREE, PI, SEG, R, scaleHex, Bx, add, cmat, ball, ring, cap, limb, mlimb, torsoGeo, splat, stainM, chessTex }
}

export type PersonKit = ReturnType<typeof createPersonKit>
