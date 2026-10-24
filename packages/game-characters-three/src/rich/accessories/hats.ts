/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html), kept as the team wrote it so a diff against the page stays readable.

export type HatContext = { THREE: any; PI: number; Hd: any; add: any; Bx: any; cmat: any; cap: any; c: any; k: string; sp: any }

/** Hats by kind (`sp.hat.k`); `c` is the hat's material. */
export const HATS = [
  {
    kinds: ['cap', 'capback'],
    apply: ({ Bx, Hd, PI, add, c, cap, k }: HatContext) => {const o=add(Hd,cap(.182,PI/2),c,0,1.84,0);o.scale.set(1,.78,1.02);add(Hd,Bx(.28,.022,.17),c,0,1.85,k==='cap'?.2:-.2,k==='cap'?.12:-.12,0,0);},
  },
  {
    kinds: ['beret'],
    apply: ({ Hd, THREE, add, c }: HatContext) => {const o=add(Hd,new THREE.CylinderGeometry(.2,.185,.07,20),c,.025,1.95,0,0,0,.16);o.scale.set(1,1,1.05);},
  },
  {
    kinds: ['hardhat'],
    apply: ({ Bx, Hd, PI, THREE, add, c, cap }: HatContext) => {const o=add(Hd,cap(.198,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.08);add(Hd,new THREE.CylinderGeometry(.25,.25,.02,20),c,0,1.865,.02);add(Hd,Bx(.03,.06,.38),c,0,2.04,0);},
  },
  {
    kinds: ['fire'],
    apply: ({ Bx, Hd, PI, THREE, add, c, cap, cmat }: HatContext) => {const o=add(Hd,cap(.205,PI/2),c,0,1.86,0);o.scale.set(1,1.02,1.1);const br=add(Hd,new THREE.CylinderGeometry(.27,.27,.02,20),c,0,1.86,-.06);br.scale.set(1,1,1.25);add(Hd,Bx(.09,.08,.02),cmat(0xd8b040,{metalness:.7}),0,1.96,.205);},
  },
  {
    kinds: ['straw'],
    apply: ({ Hd, THREE, add, c, cmat }: HatContext) => {add(Hd,new THREE.CylinderGeometry(.38,.38,.022,24),c,0,1.93,0);add(Hd,new THREE.CylinderGeometry(.155,.18,.15,20),c,0,2.01,0);add(Hd,new THREE.CylinderGeometry(.182,.182,.03,20),cmat(0x5a3a22),0,1.955,0);},
  },
  {
    kinds: ['moto'],
    apply: ({ Hd, PI, THREE, add, c, cmat }: HatContext) => {const o=add(Hd,new THREE.SphereGeometry(.235,20,16),c,0,1.81,-.01);o.scale.set(.98,1.04,1.06);add(Hd,new THREE.SphereGeometry(.226,20,10,PI*.18,PI*.64,PI*.36,PI*.2),new THREE.MeshStandardMaterial({color:0x10141a,roughness:.1,metalness:.8,flatShading:false}),0,1.81,.02);add(Hd,new THREE.CylinderGeometry(.215,.2,.05,20),cmat(0xb8322a),0,1.6,-.01);},
  },
  {
    kinds: ['bandana'],
    apply: ({ Bx, Hd, PI, add, c, cap }: HatContext) => {const o=add(Hd,cap(.18,PI*.48),c,0,1.8,-.005);o.scale.set(.98,1.1,1.05);o.rotation.x=-.4;add(Hd,Bx(.07,.12,.03),c,0,1.76,-.19,.3,0,0);},
  },
  {
    kinds: ['helmet'],
    apply: ({ Bx, Hd, PI, THREE, add, c, cap, cmat, sp }: HatContext) => {const o=add(Hd,cap(.205,PI/2),c,0,1.835,-.005);o.scale.set(1,.98,1.08);add(Hd,new THREE.CylinderGeometry(.208,.212,.04,20),c,0,1.84,-.005);
      if(sp.hat.tape)add(Hd,new THREE.CylinderGeometry(.205,.207,.035,20),cmat(sp.hat.tape),0,1.9,-.005);
      if(sp.hat.photo){add(Hd,Bx(.07,.08,.012),cmat(0xf4f0e0),.13,1.9,.14,0,.75,0);add(Hd,Bx(.05,.055,.014),cmat(0x8a6a50),.13,1.9,.141,0,.75,0);}
      if(sp.hat.nvg){add(Hd,Bx(.07,.05,.06),cmat(0x1a1a1a),0,2.0,.175);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.024,.024,.09,10).rotateX(PI/2),cmat(0x2a3a2a),s*.032,1.965,.235);}
      for(const s of[-1,1])add(Hd,Bx(.012,.15,.012),cmat(0x1a1a1a),s*.16,1.74,.04);},
  },
]
