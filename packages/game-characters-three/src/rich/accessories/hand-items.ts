/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html), kept as the team wrote it so a diff against the page stays readable.

export type HandItemContext = { THREE: any; PI: number; add: any; Bx: any; cmat: any; g: any; metal: any; dark: any; woodM: any }

/** Items held in a hand by kind (`sp.hand`, `sp.lhand`); `g` is the group on the hand's mount. */
export const HAND_ITEMS: Record<string, (context: HandItemContext) => void> = {
  axe: ({ Bx, add, cmat, g, metal, woodM }: HandItemContext) => {add(g,Bx(.05,.78,.05),woodM,0,-.18,0);add(g,Bx(.04,.14,.26),cmat(0x9a2a20),0,-.55,.09);add(g,Bx(.045,.14,.05),metal,0,-.55,.23);return;},
  machete: ({ Bx, add, cmat, g, metal }: HandItemContext) => {add(g,Bx(.05,.14,.06),cmat(0x111111),0,-.02,0);add(g,Bx(.015,.5,.08),metal,0,-.34,.015);return;},
  wrench: ({ Bx, add, g, metal }: HandItemContext) => {add(g,Bx(.05,.5,.07),metal,0,-.18,0);add(g,Bx(.05,.08,.18),metal,0,-.45,.04);return;},
  hammer: ({ Bx, add, dark, g, woodM }: HandItemContext) => {add(g,Bx(.04,.34,.04),woodM,0,-.13,0);add(g,Bx(.055,.07,.18),dark,0,-.3,.02);return;},
  hoe: ({ Bx, add, g, metal, woodM }: HandItemContext) => {add(g,Bx(.04,1.42,.04),woodM,0,-.06,0);add(g,Bx(.24,.04,.14),metal,0,-.74,.07,.35,0,0);return;},
  baton: ({ THREE, add, cmat, g }: HandItemContext) => {add(g,new THREE.CylinderGeometry(.022,.022,.55,16),cmat(0x111111),0,-.2,0);return;},
  knife: ({ Bx, add, cmat, g, metal }: HandItemContext) => {add(g,Bx(.035,.1,.04),cmat(0x111111),0,-.02,0);add(g,Bx(.01,.24,.05),metal,0,-.18,.005);return;},
  pistol: ({ Bx, add, dark, g }: HandItemContext) => {add(g,Bx(.04,.11,.06),dark,0,-.04,0);add(g,Bx(.04,.06,.2),dark,0,.02,.07);return;},
  pliers: ({ Bx, add, cmat, g, metal }: HandItemContext) => {add(g,Bx(.03,.2,.03),cmat(0xc0322a),.015,-.08,0);add(g,Bx(.03,.2,.03),cmat(0xc0322a),-.015,-.08,0);add(g,Bx(.04,.08,.03),metal,0,-.21,0);return;},
  medbag: ({ Bx, add, cmat, g }: HandItemContext) => {add(g,Bx(.36,.24,.18),cmat(0xe4e2da),0,-.16,0);add(g,Bx(.03,.09,.01),cmat(0xb8322a),0,-.16,.095);add(g,Bx(.09,.03,.01),cmat(0xb8322a),0,-.16,.095);add(g,Bx(.18,.04,.03),cmat(0x2a2a2a),0,-.02,0);return;},
  toolbox: ({ Bx, add, cmat, dark, g }: HandItemContext) => {add(g,Bx(.42,.2,.2),cmat(0xb33a2a,{metalness:.3,roughness:.5}),0,-.14,0);add(g,Bx(.24,.04,.04),dark,0,-.01,0);return;},
  book: ({ Bx, add, cmat, g }: HandItemContext) => {add(g,Bx(.05,.26,.2),cmat(0x2a4a6a),0,-.12,.02);add(g,Bx(.052,.24,.01),cmat(0xe0dccb),0,-.12,.12);return;},
  bottle: ({ THREE, add, cmat, g }: HandItemContext) => {add(g,new THREE.CylinderGeometry(.045,.045,.2,16),new THREE.MeshStandardMaterial({color:0x3a6a3a,roughness:.15,metalness:.2,transparent:true,opacity:.85,flatShading:false}),0,-.1,.02);add(g,new THREE.CylinderGeometry(.018,.03,.08,16),cmat(0x3a6a3a),0,.03,.02);return;},
  clipboard: ({ Bx, add, cmat, g }: HandItemContext) => {add(g,Bx(.03,.32,.24),cmat(0x6a4a2a),0,-.12,.04);add(g,Bx(.035,.26,.2),cmat(0xe8e6dc),0,-.13,.04);return;},
  shovel: ({ Bx, THREE, add, cmat, g, metal, woodM }: HandItemContext) => {add(g,new THREE.CylinderGeometry(.022,.022,1.3,6),woodM,0,-.3,0);add(g,Bx(.05,.18,.05),cmat(0xc4282a),0,.22,0);add(g,Bx(.22,.28,.03),metal,0,-1.0,.03);return;},
  slingshot: ({ Bx, add, cmat, g, woodM }: HandItemContext) => {add(g,Bx(.03,.16,.03),woodM,0,-.02,0);add(g,Bx(.03,.12,.03),woodM,-.04,-.14,0,0,0,-.4);add(g,Bx(.03,.12,.03),woodM,.04,-.14,0,0,0,.4);add(g,Bx(.1,.015,.015),cmat(0xc4282a),0,-.2,0);return;},
  bible: ({ Bx, add, cmat, g }: HandItemContext) => {add(g,Bx(.06,.24,.18),cmat(0x3a2416),0,-.12,.03);add(g,Bx(.062,.02,.182),cmat(0xd0a23a),0,-.02,.03);return;},
  flare: ({ THREE, add, cmat, g }: HandItemContext) => {{add(g,new THREE.CylinderGeometry(.03,.03,.26,6),cmat(0xe8662a),0,-.06,.02);add(g,new THREE.CylinderGeometry(.035,.02,.06,6),new THREE.MeshBasicMaterial({color:0xffb070}),0,.1,.02);const L=new THREE.PointLight(0xff6a2a,1.4,4,2);L.position.set(0,.15,.05);g.add(L);g.rotation.x=-.5;return;}},
  radio_h: ({ Bx, THREE, add, cmat, g }: HandItemContext) => {add(g,Bx(.07,.2,.11),cmat(0x3a3d40),0,-.08,.03);add(g,new THREE.CylinderGeometry(.008,.008,.34,4),cmat(0x9a9a9a),0,.15,.05);add(g,Bx(.075,.05,.115),cmat(0xd8c040),0,-.12,.03);return;},
  pump: ({ Bx, add, cmat, dark, g }: HandItemContext) => {add(g,Bx(.05,.82,.05),dark,0,-.22,.02);add(g,Bx(.07,.15,.09),cmat(0x2a2a2a),0,-.05,.02);add(g,Bx(.065,.14,.07),cmat(0x3a2a1c),0,-.5,.02);add(g,Bx(.03,.7,.03),dark,0,-.2,.07);return;},
  mic: ({ THREE, add, cmat, g }: HandItemContext) => {add(g,new THREE.CylinderGeometry(.022,.028,.18,16),cmat(0x1a1a1a),0,0,0);add(g,new THREE.DodecahedronGeometry(.045,0),cmat(0x6a6e72,{metalness:.6}),0,.1,0);g.rotation.x=-.4;return;},
}
