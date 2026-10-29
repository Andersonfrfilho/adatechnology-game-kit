/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Literal port of the Retratos do Vale hand (palm, four fingers of two joints each, thumb), the part of the survivor that only reads close up: the builder draws
// it at the highest level of detail only.
export type HandParams = { THREE: any; add: any; hg: any; handM: any; s: number; detailed: boolean }

export const buildHand = ({ THREE, add, hg, handM, s, detailed }: HandParams) => {
  const fingers = []
  if (!detailed) return { fingers, th: null }
  for(let f=0;f<4;f++){const fg=new THREE.Group();fg.position.set(0,-.078,.027-f*.018);hg.add(fg);const len=[.034,.038,.036,.03][f];
    add(fg,new THREE.CylinderGeometry(.0105,.0105,len,8).translate(0,-len/2,0),handM,0,0,0);const f2=new THREE.Group();f2.position.y=-len;fg.add(f2);
    add(f2,new THREE.CylinderGeometry(.0105,.009,len*.85,8).translate(0,-len*.42,0),handM,0,0,0);add(f2,new THREE.SphereGeometry(.0095,8,6),handM,0,-len*.85,0);fingers.push(fg,f2);}
  const th=new THREE.Group();th.position.set(-s*.018,-.03,.034);th.rotation.set(-.5,0,-s*.45);hg.add(th);add(th,new THREE.CylinderGeometry(.012,.01,.045,8).translate(0,-.022,0),handM,0,0,0);add(th,new THREE.SphereGeometry(.01,8,6),handM,0,-.045,0);
  return { fingers, th }
}
