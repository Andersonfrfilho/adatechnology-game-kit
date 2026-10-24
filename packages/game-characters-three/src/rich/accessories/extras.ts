/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
// Literal port of the Retratos do Vale survivor builder (sobreviventes/retratos-do-vale.html), kept as the team wrote it so a diff against the page stays readable.

export type ExtraContext = { THREE: any; PI: number; U: any; Hd: any; root: any; add: any; Bx: any; cmat: any; ring: any; torsoGeo: any; legs: any[]; arms: any[]; fem: boolean; topM: any; m: any; e: any[]; k: string; sp: any; splat: any; R: () => number; ball: any; cap: any; hc: any; headG: any; fig: any; upper: any; skinM: any }

/** Clothing and gear by id (`sp.ex` entries `[id, colour?]`), each drawn onto the body parts it names. */
export const EXTRAS: Record<string, (context: ExtraContext) => void> = {
  steth: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {add(U,Bx(.022,.24,.022),cmat(0x2a2c30),.085,1.45,.17);add(U,Bx(.022,.24,.022),cmat(0x2a2c30),-.085,1.45,.17);add(U,new THREE.CylinderGeometry(.038,.038,.02,16).rotateX(PI/2),cmat(0x9aa0a6,{metalness:.8,roughness:.3}),.03,1.31,.18);return;},
  mask_chin: ({ Bx, Hd, add, m }: ExtraContext) => {add(Hd,Bx(.24,.07,.04),m,0,1.645,.12);return;},
  vest: ({ Bx, THREE, U, add, m }: ExtraContext) => {{const v=add(U,new THREE.CylinderGeometry(.275,.24,.48,20),m,0,1.3,0);v.scale.set(1.12,1,.7);for(let i=0;i<3;i++)add(U,Bx(.11,.13,.05),m,-.15+i*.15,1.17,.17);return;}},
  pouches: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.1,.12,.09),m,.17,.95,-.15);add(U,Bx(.1,.12,.09),m,-.17,.95,-.15);return;},
  belt: ({ U, m, ring }: ExtraContext) => {ring(U,.212,.07,m,.95,1.12,.72);return;},
  holster: ({ Bx, add, cmat, legs }: ExtraContext) => {add(legs[1].g,Bx(.06,.2,.11),cmat(0x111111),.105,-.1,0);return;},
  radio: ({ Bx, U, add, cmat }: ExtraContext) => {add(U,Bx(.075,.12,.05),cmat(0x1a1a1a),.15,1.42,.18);add(U,Bx(.012,.1,.012),cmat(0x1a1a1a),.17,1.52,.18);return;},
  stripes: ({ THREE, U, add, arms, m, ring }: ExtraContext) => {ring(U,.205,.05,m,1.03,1.13,.68);ring(U,.268,.05,m,1.42,1.13,.67);arms.forEach(a=>{const r=add(a.el,new THREE.CylinderGeometry(.058,.054,.05,18),m,0,-.17,0);});return;},
  legstripes: ({ THREE, add, legs, m }: ExtraContext) => {legs.forEach(l=>add(l.kn,new THREE.CylinderGeometry(.07,.067,.05,18),m,0,-.22,0));return;},
  stains: ({ R, U, splat }: ExtraContext) => {for(let i=0;i<4;i++)splat(U,-.16+R()*.32,1.15+R()*.3,.158,.025+R()*.02,0x151515,2);return;},
  stains_y: ({ R, U, splat }: ExtraContext) => {for(let i=0;i<4;i++)splat(U,-.2+R()*.4,1.0+R()*.4,.2,.03+R()*.02,0xc9b040,2);return;},
  rag: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.08,.16,.03),m,-.17,.92,.15);return;},
  apron: ({ Bx, U, add, legs, m }: ExtraContext) => {add(U,Bx(.4,.38,.025),m,0,1.2,.158,-.07,0,0);add(U,Bx(.42,.2,.025),m,0,.95,.158);legs.forEach(l=>add(l.g,Bx(.2,.36,.025),m,-l.s*.01,-.19,.112));add(U,Bx(.02,.2,.02),m,.11,1.52,.15);add(U,Bx(.02,.2,.02),m,-.11,1.52,.15);return;},
  buttons: ({ Bx, U, add, cmat }: ExtraContext) => {for(let i=0;i<3;i++)add(U,Bx(.03,.03,.02),cmat(0x2a2a2a),.1,1.48-i*.08,.165);return;},
  earpro: ({ PI, THREE, U, add, m }: ExtraContext) => {{const r=add(U,new THREE.TorusGeometry(.13,.022,8,20,PI),m,0,1.6,-.02,-PI/2+.3,0,0);for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.055,.055,.06,16).rotateZ(PI/2),m,s*.14,1.57,.05);return;}},
  coil: ({ PI, THREE, U, add, m }: ExtraContext) => {add(U,new THREE.TorusGeometry(.16,.032,8,20),m,.2,1.38,0,0,PI/2,.5);return;},
  deliverybox: ({ Bx, U, add, cmat, m }: ExtraContext) => {add(U,Bx(.52,.5,.44),m,0,1.32,-.38);add(U,Bx(.53,.06,.45),cmat(0xe8e8e2),0,1.43,-.38);for(const s of[-1,1])add(U,Bx(.04,.46,.03),cmat(0x111111),s*.14,1.3,.17,-.1,0,0);return;},
  backpack: ({ Bx, THREE, U, add, cmat, m }: ExtraContext) => {{const b=add(U,new THREE.CylinderGeometry(.2,.22,.54,16),m,0,1.24,-.26);b.scale.set(1.15,1,.6);add(U,Bx(.3,.16,.07),m,0,1.08,-.4);for(const s of[-1,1])add(U,Bx(.045,.46,.03),cmat(0x1a1a1a),s*.15,1.3,.17,-.1,0,0);return;}},
  helmetpack: ({ Bx, THREE, U, add, cmat, m }: ExtraContext) => {{const h=add(U,new THREE.SphereGeometry(.15,18,14),m,.2,.98,-.42);h.scale.set(1,1.05,1.05);add(U,Bx(.09,.07,.02),cmat(0xe0c020),.24,1.0,-.565,0,.25,0);add(U,new THREE.CylinderGeometry(.14,.13,.04,18),cmat(0xb8322a),.2,.85,-.42);return;}},
  hood: ({ PI, THREE, U, add, m }: ExtraContext) => {{const h=add(U,new THREE.TorusGeometry(.13,.06,8,20,PI*1.2),m,0,1.6,-.03,PI/2,0,PI*-.1);h.scale.set(1.1,1.2,1);return;}},
  pocket: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.32,.13,.03),m,0,1.03,.135);return;},
  sweatervest: ({ U, add, fem, m, torsoGeo }: ExtraContext) => {{const g=torsoGeo(fem);g.scale(1.04,1,1.1);add(U,g,m,0,0,0);return;}},
  collar: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.18,.05,.05),m,0,1.58,.1);return;},
  satchel: ({ Bx, U, add, cmat, m }: ExtraContext) => {add(U,Bx(.045,.82,.02),cmat(0x3a2a1a),0,1.2,.18,0,0,.68);add(U,Bx(.28,.24,.1),m,-.1,.92,-.2);return;},
  blouse: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.12,.26,.02),m,0,1.38,.157);return;},
  cross: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.022,.085,.015),m,0,1.37,.178);add(U,Bx(.055,.02,.015),m,0,1.39,.178);return;},
  armband: ({ THREE, add, arms, m }: ExtraContext) => {add(arms[1].g,new THREE.CylinderGeometry(.08,.078,.08,18),m,0,-.12,0);return;},
  tiedsleeves: ({ Bx, U, add, legs, m, ring }: ExtraContext) => {ring(U,.215,.1,m,.95,1.12,.74);legs.forEach(l=>add(l.g,Bx(.1,.26,.05),m,l.s*.02,-.1,.105));return;},
  labcoat: ({ Bx, THREE, U, add, arms, cmat, fem, legs, m, ring, torsoGeo }: ExtraContext) => {{const g=torsoGeo(fem);g.scale(1.06,1,1.12);add(U,g,m,0,0,0);ring(U,.22,.14,m,.9,1.12,.76);legs.forEach(l=>add(l.g,new THREE.CylinderGeometry(.145,.165,.46,20,1,true).translate(0,-.21,0),m,0,0,0));
      add(U,Bx(.025,.62,.012),cmat(0x9a9a92),0,1.2,.19);
      arms.forEach(a=>{add(a.g,new THREE.CylinderGeometry(.085,.075,.31,18).translate(0,-.155,0),m,0,0,0);add(a.el,new THREE.CylinderGeometry(.072,.064,.27,18).translate(0,-.135,0),m,0,0,0);});
      add(U,Bx(.1,.09,.02),m,-.15,1.4,.19);return;}},
  rosary: ({ Bx, PI, THREE, add, arms, m }: ExtraContext) => {add(arms[1].el,new THREE.TorusGeometry(.055,.012,4,10),m,0,-.27,0,PI/2,0,0);add(arms[1].el,Bx(.015,.06,.01),m,0,-.33,.06);return;},
  watch: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {{const g=cmat(0xd0a23a,{metalness:.8,roughness:.3});add(U,new THREE.CylinderGeometry(.05,.05,.02,10).rotateX(PI/2),g,.12,1.06,.135);add(U,Bx(.015,.14,.01),g,.06,1.1,.135,0,0,.9);return;}},
  chain: ({ PI, THREE, add, legs, m, root }: ExtraContext) => {{add(legs[0].kn,new THREE.TorusGeometry(.085,.015,4,8),m,0,-.34,0,PI/2,0,0);for(let i=0;i<6;i++)add(root,new THREE.TorusGeometry(.045,.012,4,8),m,.2+i*.07,.03,-.06-i*.06,i%2?PI/2:0,.6,0);return;}},
  unicorn: ({ Bx, THREE, U, add, cmat, m }: ExtraContext) => {add(U,Bx(.32,.36,.16),m,0,1.24,-.24);add(U,new THREE.ConeGeometry(.035,.16,5),cmat(0xf2c84a),0,1.5,-.24);for(const s of[-1,1]){add(U,Bx(.05,.07,.04),cmat(0xe88ab8),s*.09,1.45,-.24);add(U,Bx(.04,.42,.03),cmat(0xb06ac8),s*.13,1.3,.16,-.1,0,0);}return;},
  whistle: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x9aa0a6),s*.06,1.48,.17,0,0,-s*.35);add(U,new THREE.CylinderGeometry(.022,.022,.08,6).rotateZ(PI/2),cmat(0xd0d4d8,{metalness:.9,roughness:.2}),0,1.36,.19);return;},
  pen: ({ Hd, THREE, add, cmat }: ExtraContext) => {add(Hd,new THREE.CylinderGeometry(.01,.01,.26,5),cmat(0x2a50c8),0,1.92,-.15,0,0,1.3);return;},
  photo: ({ Bx, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0xd0a23a),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.07,.09,.01),cmat(0xf4f0e0),0,1.34,.185);return;},
  pins: ({ PI, THREE, U, add, cmat, k }: ExtraContext) => {[[0xd84a3a,.1,1.38],[0xf2d046,.17,1.3],[0x4ac08a,.12,1.22],[0xf0f0f0,-.15,1.36]].forEach(([k,x,y])=>add(U,new THREE.CylinderGeometry(.028,.028,.02,8).rotateX(PI/2),cmat(k),x,y,.185));return;},
  recorder: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {add(U,Bx(.13,.09,.05),cmat(0x1a1a1a),.15,1.28,.215);for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.02,.02,.052,8).rotateX(PI/2),cmat(0xd88a2a),.15+s*.03,1.29,.22);return;},
  beads: ({ Bx, PI, add, arms, cmat }: ExtraContext) => {{const cs=[0xe8483a,0xf2d046,0x4aa0e0,0x5ac06a,0xe88ab8,0xffffff];for(let i=0;i<8;i++){const a=i/8*PI*2;add(arms[0].el,Bx(.03,.03,.03),cmat(cs[i%6]),Math.cos(a)*.055,-.26,Math.sin(a)*.055);}return;}},
  badge: ({ Bx, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x2a5aa8),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.08,.11,.01),cmat(0xf4f4f4),0,1.34,.185);add(U,Bx(.04,.04,.012),cmat(0x5a8ac8),0,1.36,.19);return;},
  stethc: ({ Bx, PI, THREE, U, add, cmat, m }: ExtraContext) => {add(U,new THREE.TorusGeometry(.14,.018,5,10,PI),m,0,1.6,-.02,-PI/2+.3,0,0);add(U,Bx(.02,.2,.02),m,-.1,1.42,.19);add(U,new THREE.CylinderGeometry(.035,.035,.02,8).rotateX(PI/2),cmat(0xc0c4c8,{metalness:.9,roughness:.2}),-.1,1.31,.2);return;},
  bandolier: ({ Bx, U, add, cmat }: ExtraContext) => {for(let i=0;i<9;i++)add(U,Bx(.035,.08,.035),cmat(0xc4282a),-.22+i*.055,1.44-i*.055,.2,0,0,-.75);add(U,Bx(.05,.75,.02),cmat(0x4a3a22),0,1.22,.195,0,0,-.75);return;},
  scarf: ({ PI, THREE, U, add, m, ring }: ExtraContext) => {ring(U,.1,.08,m,1.57,1.3,1.2);add(U,new THREE.ConeGeometry(.08,.14,3),m,0,1.47,.15,PI,0,0);return;},
  feather: ({ Bx, Hd, add, cmat }: ExtraContext) => {add(Hd,Bx(.02,.24,.06),cmat(0x0a0a0c),.17,2.0,-.04,0,0,-.3);return;},
  amulet: ({ Bx, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x5a3a22),s*.05,1.48,.17,0,0,-s*.3);add(U,Bx(.07,.09,.03),cmat(0x7a4a2a),0,1.34,.19);return;},
  rifle_front: ({ Bx, THREE, U, add, arms, cmat, k }: ExtraContext) => {{const g=new THREE.Group();g.position.set(.02,1.15,.26);g.rotation.z=.95;U.add(g);const dk=cmat(0x1c1d1f,{metalness:.6,roughness:.45});
      add(g,Bx(.08,.3,.06),cmat(k==='dbl_front'?0x5a3a22:0x2a2c28),0,-.38,0);add(g,Bx(.05,.85,.05),dk,0,.2,0);if(k==='dbl_front'){add(g,Bx(.05,.6,.05),dk,.05,.3,0);add(g,Bx(.11,.06,.08),cmat(0xe8e4d8),0,-.25,0);}
      else{add(g,Bx(.07,.14,.09),dk,0,-.08,.04);if(k==='rifle_tape'){add(g,Bx(.08,.08,.08),cmat(0x4a5a3a),0,.3,0);add(g,Bx(.08,.08,.08),cmat(0x6a6a4a),0,.08,0);}}
      arms.forEach(a=>a.grip=true);return;}},
  belly: ({ U, ball, topM }: ExtraContext) => {{const b=ball(U,.16,topM,0,1.03,.105);b.scale.set(1.05,1.08,.95);return;}},
  refl: ({ Bx, THREE, U, add, cmat, m, ring }: ExtraContext) => {{const v=add(U,new THREE.CylinderGeometry(.287,.252,.46,20),m,0,1.3,0);v.scale.set(1.13,1,.72);ring(U,.29,.035,cmat(0xc8ccd0,{metalness:.3,roughness:.4}),1.2,1.13,.73);ring(U,.3,.035,cmat(0xc8ccd0,{metalness:.3,roughness:.4}),1.37,1.13,.73);add(U,Bx(.17,.055,.02),cmat(0x1a2a6a),0,1.47,.205);return;}},
  plate: ({ Bx, THREE, U, add, cmat, m }: ExtraContext) => {{const v=add(U,new THREE.CylinderGeometry(.28,.25,.44,20),m,0,1.3,0);v.scale.set(1.12,1,.72);for(let i=0;i<3;i++)add(U,Bx(.08,.14,.06),m,-.1+i*.1,1.16,.2);add(U,Bx(.07,.11,.045),cmat(0x1a1a1a),.16,1.42,.2);for(const s of[-1,1])add(U,Bx(.07,.04,.2),m,s*.17,1.53,0);return;}},
  keyring: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {{add(U,new THREE.TorusGeometry(.12,.009,4,14,PI),cmat(0x2a2a2a),0,1.5,.07,PI/2+.6,0,0);add(U,new THREE.TorusGeometry(.05,.008,4,12),cmat(0xb8b0a0,{metalness:.9,roughness:.25}),0,1.34,.2);for(let i=0;i<7;i++)add(U,Bx(.013,.075,.006),cmat(i%2?0xd0b060:0xb8bcc0,{metalness:.9,roughness:.3}),-.045+i*.015,1.28,.21,0,0,(i-3)*.18);return;}},
  satradio: ({ Bx, U, add, cmat, m }: ExtraContext) => {{add(U,Bx(.3,.4,.18),m,0,1.28,-.25);add(U,Bx(.012,.62,.012),cmat(0x1a1a1a),.1,1.72,-.3,0,0,.15);add(U,Bx(.08,.06,.03),cmat(0x3a3a3a),-.08,1.4,-.35);for(const s of[-1,1])add(U,Bx(.045,.46,.03),cmat(0x1a1a1a),s*.15,1.3,.17,-.1,0,0);return;}},
  binoc: ({ Bx, PI, THREE, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,new THREE.CylinderGeometry(.03,.034,.12,10).rotateX(PI/2),cmat(0x262824),s*.038,1.38,.26);add(U,Bx(.03,.03,.04),cmat(0x262824),0,1.38,.25);return;},
  tq: ({ Bx, THREE, add, arms, cmat }: ExtraContext) => {add(arms[1].g,new THREE.CylinderGeometry(.09,.087,.055,16),cmat(0xd8262a),0,-.05,0);add(arms[1].g,Bx(.03,.05,.04),cmat(0x1a1a1a),0,-.05,.09);return;},
  cuia: ({ THREE, U, add, cmat }: ExtraContext) => {add(U,new THREE.SphereGeometry(.055,12,10),cmat(0x6a7a3a),-.21,.9,.12);add(U,new THREE.CylinderGeometry(.006,.006,.13,6),cmat(0xc0c4c8,{metalness:.9,roughness:.2}),-.21,.99,.12,0,0,.3);add(U,new THREE.CylinderGeometry(.04,.04,.015,12),cmat(0xb8a070),-.21,.95,.12);return;},
  card: ({ Bx, U, add, cmat }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.012,.22,.01),cmat(0x2a2a2a),s*.05,1.5,.2,0,0,-s*.3);add(U,Bx(.08,.11,.01),cmat(0xd82020),0,1.36,.235);add(U,Bx(.05,.012,.012),cmat(0xf0f0f0),0,1.34,.24);return;},
  mapfold: ({ Bx, U, add, cmat }: ExtraContext) => {add(U,Bx(.1,.13,.025),cmat(0xe8dcb0),-.13,1.33,.215,0,0,.1);add(U,Bx(.1,.012,.027),cmat(0x8a6a3a),-.13,1.35,.215);return;},
  motoband: ({ Hd, THREE, add, cmat }: ExtraContext) => {add(Hd,new THREE.CylinderGeometry(.238,.238,.045,20),cmat(0xe0c020),0,1.84,-.01);return;},
  rifle_sup: ({ Bx, THREE, U, add, arms, cmat }: ExtraContext) => {{const g=new THREE.Group();g.position.set(.02,1.15,.27);g.rotation.z=.95;U.add(g);const dk=cmat(0x1c1d1f,{metalness:.6,roughness:.45});
      add(g,Bx(.07,.26,.06),cmat(0x3a3a34),0,-.36,0);add(g,Bx(.06,.5,.06),dk,0,0,0);add(g,Bx(.07,.14,.09),dk,0,-.06,.05);add(g,Bx(.05,.08,.07),cmat(0x2a2a2a),0,.12,.06);
      add(g,new THREE.CylinderGeometry(.03,.03,.24,10),cmat(0x2a2b2c,{metalness:.5,roughness:.5}),0,.37,0);add(g,Bx(.04,.08,.05),cmat(0x1a1a1a),0,.05,-.05);arms.forEach(a=>a.grip=true);return;}},
  gloves: () => {},
  blood: ({ R, U, splat }: ExtraContext) => {for(let i=0;i<3;i++)splat(U,.06+R()*.14,1.1+R()*.3,.2,.022+R()*.02,0x3b1d14,3);return;},
  shirtpeek: ({ Bx, U, add, m }: ExtraContext) => {add(U,Bx(.16,.26,.02),m,0,1.38,.163);return;},
  suspenders: ({ Bx, U, add, m }: ExtraContext) => {for(const s of[-1,1])add(U,Bx(.035,.3,.02),m,s*.11,1.4,.163);return;},
}
EXTRAS.headphones = EXTRAS.earpro
EXTRAS.rifle_tape = EXTRAS.rifle_front
EXTRAS.dbl_front = EXTRAS.rifle_front
