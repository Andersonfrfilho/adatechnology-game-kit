/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html), kept as the team wrote it so a diff against the page stays readable.

export type FaceContext = { THREE: any; PI: number; Hd: any; add: any; Bx: any; cmat: any; hc: any; sp: any; f: string[]; scaleHex: (hex: number, factor: number) => number }

/** Face features in the order the page draws them (the order is part of the scene hash): `ids` are the `sp.face` entries that switch one on. */
export const FACE_FEATURES = [
  {
    ids: ['glasses', 'glasses_y'],
    apply: ({ Bx, Hd, THREE, add, cmat, f }: FaceContext) => {const lens=new THREE.MeshStandardMaterial({color:f.includes('glasses_y')?0xd8b030:0x8fb0c0,roughness:.15,metalness:.3,transparent:true,opacity:.35});
    add(Hd,Bx(.27,.012,.015),cmat(0x1a1a1a),0,1.84,.175);for(const s of[-1,1]){add(Hd,Bx(.09,.055,.012),lens,s*.06,1.817,.178);add(Hd,Bx(.012,.012,.17),cmat(0x1a1a1a),s*.15,1.83,.09);};},
  },
  {
    ids: ['mustache'],
    apply: ({ Bx, Hd, add, hc }: FaceContext) => {add(Hd,Bx(.13,.035,.03),hc,0,1.728,.165);},
  },
  {
    ids: ['mustache_w'],
    apply: ({ Bx, Hd, add, cmat }: FaceContext) => {add(Hd,Bx(.17,.045,.03),cmat(0xe6e4dc),0,1.726,.166);},
  },
  {
    ids: ['beard_g'],
    apply: ({ Hd, THREE, add, cmat }: FaceContext) => {const b=add(Hd,new THREE.SphereGeometry(.128,16,12),cmat(0x8a8a86),0,1.7,.035);b.scale.set(1.02,.78,1);},
  },
  {
    ids: ['stubble'],
    apply: ({ Hd, THREE, add, cmat, scaleHex, sp }: FaceContext) => {const b=add(Hd,new THREE.SphereGeometry(.123,16,12),cmat(scaleHex(sp.skin,.62)),0,1.705,.032);b.scale.set(1,.74,1);},
  },
  {
    ids: ['mask'],
    apply: ({ Bx, Hd, add, cmat }: FaceContext) => {add(Hd,Bx(.24,.12,.04),cmat(0xaed0de),0,1.72,.15);},
  },
  {
    ids: ['goggles'],
    apply: ({ Hd, PI, THREE, add, cmat }: FaceContext) => {const b=add(Hd,new THREE.CylinderGeometry(.168,.168,.035,20,1,true),cmat(0x1a1a1a),0,1.9,0);b.scale.set(.97,1,1.04);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.04,.04,.04,16).rotateX(PI/2),cmat(0x4a6a5a,{roughness:.2,metalness:.5}),s*.06,1.91,.165);},
  },
  {
    ids: ['earrings'],
    apply: ({ Hd, PI, THREE, add, cmat }: FaceContext) => {for(const s of[-1,1])add(Hd,new THREE.TorusGeometry(.028,.007,4,8),cmat(0xd8b040,{metalness:.8,roughness:.3}),s*.162,1.74,0,0,PI/2,0);},
  },
  {
    ids: ['cig'],
    apply: ({ Bx, Hd, THREE, add, cmat }: FaceContext) => {add(Hd,Bx(.014,.014,.09),cmat(0xeeeeee),.05,1.7,.19);const e=add(Hd,Bx(.017,.017,.017),new THREE.MeshBasicMaterial({color:0xff6a2a}),.05,1.7,.237);e.castShadow=false;},
  },
  {
    ids: ['mirror'],
    apply: ({ Bx, Hd, add, cmat }: FaceContext) => {add(Hd,Bx(.27,.012,.015),cmat(0x1a1a1a),0,1.84,.175);for(const s of[-1,1]){add(Hd,Bx(.095,.06,.014),cmat(0xc8ccd0,{metalness:.95,roughness:.12}),s*.06,1.817,.179);add(Hd,Bx(.012,.012,.17),cmat(0x1a1a1a),s*.15,1.83,.09);};},
  },
  {
    ids: ['labgoggles'],
    apply: ({ Hd, PI, THREE, add, cmat }: FaceContext) => {const b=add(Hd,new THREE.CylinderGeometry(.168,.168,.03,10,1,true),cmat(0x2a6a8a),0,1.92,0);b.scale.set(.97,1,1.04);for(const s of[-1,1])add(Hd,new THREE.CylinderGeometry(.045,.045,.04,8).rotateX(PI/2),cmat(0x9fc4d8,{roughness:.1,transparent:true,opacity:.7}),s*.06,1.93,.165);},
  },
  {
    ids: ['beard'],
    apply: ({ Hd, THREE, add, hc }: FaceContext) => {const b=add(Hd,new THREE.SphereGeometry(.128,8,6),hc,0,1.7,.035);b.scale.set(1.02,.8,1);},
  },
]
