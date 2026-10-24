import { birdSize } from '@adatechnology/game-animals'
import type { BirdSpec } from '@adatechnology/game-animals'
import type * as THREE_NS from 'three'

import { addMesh, createRigTools } from './context'
import type { BirdExtra } from './extras'
import type { AnimalRig, Three } from './types'

const buildWings = (THREE: Three, rig: AnimalRig, spec: BirdSpec, parts: { bodyGroup: THREE_NS.Group; main: THREE_NS.MeshStandardMaterial; dark: THREE_NS.MeshStandardMaterial }): void => {
  const tools = createRigTools(THREE, rig)
  const { bodyGroup, main, dark } = parts
  for (const side of [-1, 1]) {
    const shoulder = tools.pivot(bodyGroup, side * spec.r * spec.s[0] * 1.02, spec.r * 0.22, spec.r * 0.3, new THREE.Vector3(side * 0.12, 0.03, 0).multiplyScalar(rig.size))
    tools.joint(shoulder, spec.r * 0.14, main, 0, 0, 0)
    tools.ball(shoulder, 0.5, spec.wingM ? tools.material(spec.wingM) : dark, side * spec.wi * 0.5, 0, -spec.wc * 0.3, spec.wi * 1.05, spec.r * 0.16, spec.wc)
    const elbow = tools.pivot(shoulder, side * spec.wi, 0, 0, new THREE.Vector3(side * 0.06, 0, 0).multiplyScalar(rig.size))
    tools.joint(elbow, spec.r * 0.1, main, 0, 0, 0)
    tools.ball(elbow, 0.5, dark, side * spec.wo * 0.45, 0, -spec.wc * 0.32, spec.wo * 1.05, spec.r * 0.12, spec.wc * 0.75)
    if (spec.fingers) {
      for (let finger = 0; finger < 4; finger++) {
        addMesh(THREE, elbow, new THREE.BoxGeometry(spec.wo * 0.35, spec.r * 0.03, spec.wc * 0.12), dark, side * (spec.wo + spec.wo * 0.12), 0, -spec.wc * 0.05 - finger * spec.wc * 0.18, 0, side * (0.05 + finger * 0.12), 0)
      }
    }
    if (spec.spur) addMesh(THREE, elbow, new THREE.ConeGeometry(spec.r * 0.06, spec.r * 0.25, 5), tools.material(0xc0302a), 0, 0, spec.wc * 0.2, Math.PI / 2, 0, 0)
    rig.wings.push({ shoulder, elbow, side })
  }
}

const buildLegs = (THREE: Three, rig: AnimalRig, spec: BirdSpec, parts: { bodyGroup: THREE_NS.Group; main: THREE_NS.MeshStandardMaterial; leg: THREE_NS.MeshStandardMaterial }): void => {
  const tools = createRigTools(THREE, rig)
  const { bodyGroup, main, leg } = parts
  for (const side of [-1, 1]) {
    const hip = tools.pivot(bodyGroup, side * spec.r * 0.38, -spec.r * 0.55, spec.r * 0.05, new THREE.Vector3(side * 0.06, -0.05, 0).multiplyScalar(rig.size))
    tools.joint(hip, spec.r * 0.18, main, 0, 0, 0)
    tools.limb(hip, spec.r * 0.16, spec.r * 0.09, spec.shank, spec.featherLeg ? main : leg)
    const ankle = tools.pivot(hip, 0, -spec.shank, 0, new THREE.Vector3(0, -0.04, 0).multiplyScalar(rig.size))
    tools.joint(ankle, spec.r * 0.06, leg, 0, 0, 0)
    tools.limb(ankle, spec.r * 0.055, spec.r * 0.05, spec.tars, leg)
    const foot = tools.pivot(ankle, 0, -spec.tars, 0)
    for (const angle of [-0.45, 0, 0.45]) addMesh(THREE, foot, new THREE.BoxGeometry(spec.r * 0.05, spec.r * 0.04, spec.r * 0.55).translate(0, 0, spec.r * 0.25), leg, 0, -spec.r * 0.02, 0, 0, angle, 0)
    addMesh(THREE, foot, new THREE.BoxGeometry(spec.r * 0.05, spec.r * 0.04, spec.r * 0.25).translate(0, 0, -spec.r * 0.12), leg, 0, -spec.r * 0.02, 0)
    rig.legs.push({ hip, knee: ankle, foot, isFront: false, angle1: 0.35, angle2: -0.5, side })
  }
}

/** Builds a bird: body, tail, two wings with shoulder and elbow pivots, neck, head with beak and jaw, eyes, the species' extra parts, and two legs. */
export const buildBird = (THREE: Three, rig: AnimalRig, options: { extra?: BirdExtra }): AnimalRig => {
  const spec = rig.species.body as BirdSpec
  const tools = createRigTools(THREE, rig)
  const colors = spec.c
  const main = tools.material(colors.main)
  const dark = tools.material(colors.dark)
  const leg = tools.material(colors.leg)
  const beak = tools.material(colors.beak, { roughness: 0.5 })
  const belly = tools.material(colors.belly || colors.main)
  rig.main = main
  const hipY = spec.tars + spec.shank * 0.9
  rig.size = birdSize(spec)
  const bodyGroup = tools.pivot(rig.trunk, 0, hipY + spec.r * 0.55, 0)
  rig.bodyGroup = bodyGroup
  bodyGroup.rotation.x = spec.pitch || 0
  tools.ball(bodyGroup, spec.r, main, 0, 0, 0, spec.s[0], spec.s[1], spec.s[2])
  tools.ball(bodyGroup, spec.r * 0.9, belly, 0, -spec.r * 0.22, spec.r * 0.15, spec.s[0] * 0.9, spec.s[1] * 0.8, spec.s[2] * 0.85)
  const tail = tools.pivot(bodyGroup, 0, spec.r * 0.15, -spec.r * spec.s[2] * 0.85, new THREE.Vector3(0, 0, -0.08).multiplyScalar(rig.size))
  tail.rotation.x = spec.tailA || -0.3
  rig.tailRoot = tail
  addMesh(THREE, tail, new THREE.BoxGeometry(spec.tailW, spec.r * 0.08, spec.tailL).translate(0, 0, -spec.tailL / 2), spec.tailM ? tools.material(spec.tailM) : dark)
  buildWings(THREE, rig, spec, { bodyGroup, main, dark })
  const neck = tools.pivot(bodyGroup, 0, spec.r * 0.45, spec.r * spec.s[2] * 0.75, new THREE.Vector3(0, 0.05, 0.08).multiplyScalar(rig.size))
  neck.rotation.x = spec.neckA
  rig.neck = neck
  rig.neckAngle = spec.neckA
  tools.joint(neck, spec.nr * 1.1, spec.neckM ? tools.material(spec.neckM) : main, 0, 0, 0)
  addMesh(THREE, neck, new THREE.CylinderGeometry(spec.nr * 0.85, spec.nr, spec.nl, 12).translate(0, spec.nl / 2, 0), spec.neckM ? tools.material(spec.neckM) : main)
  const head = tools.pivot(neck, 0, spec.nl, 0, new THREE.Vector3(0, 0.05, 0.05).multiplyScalar(rig.size))
  head.rotation.x = -spec.neckA + (spec.headA || 0)
  rig.head = head
  rig.headAngle = head.rotation.x
  const headMaterial = spec.headM ? tools.material(spec.headM) : main
  tools.ball(head, spec.hr, headMaterial, 0, 0, 0, spec.hs ? spec.hs[0] : 1, spec.hs ? spec.hs[1] : 1, spec.hs ? spec.hs[2] : 1.1)
  addMesh(THREE, head, new THREE.ConeGeometry(spec.br, spec.bl, 8).rotateX(Math.PI / 2).translate(0, 0, spec.bl / 2), beak, 0, -spec.hr * 0.1, spec.hr * 0.85, spec.hook || 0, 0, 0)
  const jaw = tools.pivot(head, 0, -spec.hr * 0.25, spec.hr * 0.8)
  rig.jaw = jaw
  addMesh(THREE, jaw, new THREE.ConeGeometry(spec.br * 0.7, spec.bl * 0.85, 8).rotateX(Math.PI / 2).translate(0, 0, spec.bl * 0.42), beak).scale.set(1, 0.5, 1)
  tools.eyes(head, spec.hr * 0.17, spec.hr * 0.68, spec.hr * 0.2, spec.hr * 0.35)
  if (spec.eyeC && rig.eyeMaterial) {
    rig.eyeMaterial.color.set(spec.eyeC)
    rig.eyeMaterial.userData.base = rig.eyeMaterial.color.clone()
  }
  options.extra?.({ THREE, rig, tools }, { bodyGroup, head, neck, main, dark })
  buildLegs(THREE, rig, spec, { bodyGroup, main, leg })
  return rig
}
