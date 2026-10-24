import { quadrupedLayout } from '@adatechnology/game-animals'
import type { QuadrupedSpec } from '@adatechnology/game-animals'
import type * as THREE_NS from 'three'

import { addMesh, createRigTools } from './context'
import { createCoatTexture } from './textures'
import { profileGeometry } from './profile'
import type { AnimalRig, DocumentLike, Three } from './types'
import type { QuadrupedExtra } from './extras'

const RIB_COUNT = 4

type LegDefinition = readonly [number, number, 'F' | 'H']

const LEG_DEFINITIONS: readonly LegDefinition[] = [
  [1, 1, 'F'],
  [-1, 1, 'F'],
  [1, -1, 'H'],
  [-1, -1, 'H'],
]

/** The body and the four legs of a quadruped (page: the first half of `quad`). */
const buildBodyAndLegs = (THREE: Three, rig: AnimalRig, spec: QuadrupedSpec, main: THREE_NS.MeshStandardMaterial, belly: THREE_NS.MeshStandardMaterial, dark: THREE_NS.MeshStandardMaterial) => {
  const tools = createRigTools(THREE, rig)
  const { L, R: radius } = spec
  const leg = spec.leg
  const layout = quadrupedLayout(spec)
  const { frontHipHeight, hindHipHeight, footHeight, bodyHeight, span } = layout
  const frontAngle1 = leg.fa1 ?? 0.06
  const frontAngle2 = leg.fa2 ?? -0.08
  const hindAngle1 = leg.ha1 ?? -0.32
  const hindAngle2 = leg.ha2 ?? 0.58
  rig.size = layout.size
  const bodyGroup = tools.pivot(rig.trunk, 0, bodyHeight, 0)
  rig.bodyGroup = bodyGroup
  const body = addMesh(THREE, bodyGroup, profileGeometry(THREE, L, spec.prof.map((value) => value * radius)), main)
  body.scale.set(spec.sx || 1, spec.sy || 1, 1)
  body.rotation.x = Math.atan2(hindHipHeight - frontHipHeight, span) * 0.6
  rig.body = body
  const belt = addMesh(THREE, bodyGroup, profileGeometry(THREE, L * 0.8, spec.prof.map((value) => value * 0.8 * radius)), belly)
  belt.scale.set((spec.sx || 1) * 0.92, (spec.sy || 1) * 0.85, 1)
  belt.position.y = -radius * 0.2
  LEG_DEFINITIONS.forEach(([sx, sz, kind]) => {
    const front = kind === 'F'
    const upper = front ? leg.fu : leg.hu
    const lower = front ? leg.fl : leg.hl
    const height = front ? frontHipHeight : hindHipHeight
    const hip = tools.pivot(rig.trunk, sx * radius * (spec.sx || 1) * 0.55, height, (sz * span) / 2, new THREE.Vector3(sx * 0.18, -0.06, sz * 0.12).multiplyScalar(rig.size))
    tools.ball(hip, leg.r * (front ? 1.9 : 2.3), main, 0, -upper * 0.18, front ? 0 : -leg.r * 0.3, 0.75, 1.25, 1)
    tools.joint(hip, leg.r * 1.15, main, 0, 0, 0)
    tools.limb(hip, leg.r * 1.25, leg.r * 0.95, upper, main)
    const knee = tools.pivot(hip, 0, -upper, 0, new THREE.Vector3(0, -0.07 * rig.size, 0))
    tools.joint(knee, leg.r * 0.95, main, 0, 0, 0)
    tools.limb(knee, leg.r * 0.92, leg.r * 0.68, lower, main)
    const foot = tools.pivot(knee, 0, -lower, 0, new THREE.Vector3(0, -0.05 * rig.size, 0))
    if (leg.hoof) {
      tools.joint(foot, leg.r * 0.72, dark, 0, 0, 0)
      addMesh(THREE, foot, new THREE.CylinderGeometry(leg.r * 0.8, leg.r * 1.05, footHeight, 12).translate(0, -footHeight / 2, 0), dark)
    } else {
      tools.joint(foot, leg.r * 0.66, main, 0, 0, 0)
      tools.ball(foot, leg.r * 0.95, leg.dark ? dark : main, 0, -footHeight * 0.55, leg.r * 0.5, 1, 0.62, 1.45)
    }
    rig.legs.push({ hip, knee, foot, isFront: front, angle1: front ? frontAngle1 : hindAngle1, angle2: front ? frontAngle2 : hindAngle2, side: sx })
  })
  return { bodyGroup, bodyHeight }
}

const buildHead = (THREE: Three, rig: AnimalRig, spec: QuadrupedSpec, parts: { bodyGroup: THREE_NS.Group; main: THREE_NS.MeshStandardMaterial; belly: THREE_NS.MeshStandardMaterial; nose: THREE_NS.MeshStandardMaterial }) => {
  const tools = createRigTools(THREE, rig)
  const { bodyGroup, main, belly, nose } = parts
  const { L, R: radius } = spec
  const neckSpec = spec.neck
  const headSpec = spec.head
  const neck = tools.pivot(bodyGroup, 0, radius * (spec.sy || 1) * (neckSpec.y ?? 0.35), (L / 2) * (neckSpec.z ?? 0.78), new THREE.Vector3(0, 0.05, 0.12).multiplyScalar(rig.size))
  neck.rotation.x = neckSpec.ang
  rig.neck = neck
  rig.neckAngle = neckSpec.ang
  tools.joint(neck, neckSpec.r * 1.05, main, 0, 0, 0)
  addMesh(THREE, neck, new THREE.CylinderGeometry(neckSpec.r2 || neckSpec.r * 0.85, neckSpec.r, neckSpec.len, 14).translate(0, neckSpec.len / 2, 0), main)
  const head = tools.pivot(neck, 0, neckSpec.len, 0, new THREE.Vector3(0, 0.06, 0.08).multiplyScalar(rig.size))
  head.rotation.x = -neckSpec.ang + (headSpec.down || 0)
  rig.head = head
  rig.headAngle = head.rotation.x
  tools.joint(head, neckSpec.r2 || neckSpec.r * 0.85, main, 0, 0, 0)
  tools.ball(head, headSpec.r, main, 0, headSpec.r * 0.25, headSpec.r * 0.25, headSpec.s[0], headSpec.s[1], headSpec.s[2])
  const snoutZ = headSpec.r * 0.25 + headSpec.r * headSpec.s[2] * 0.55
  const snout = addMesh(THREE, head, new THREE.CylinderGeometry(headSpec.sr2, headSpec.sr1, headSpec.sl, 14).rotateX(Math.PI / 2), headSpec.muzzle ? tools.material(headSpec.muzzle) : main, 0, headSpec.r * (headSpec.sy ?? 0), snoutZ + headSpec.sl / 2)
  snout.scale.set(1, headSpec.sq || 1, 1)
  tools.ball(head, headSpec.sr2 * 1.02, nose, 0, headSpec.r * (headSpec.sy ?? 0) + headSpec.sr2 * 0.1, snoutZ + headSpec.sl, 1, 0.85 * (headSpec.sq || 1), 0.45)
  const jaw = tools.pivot(head, 0, headSpec.r * (headSpec.sy ?? 0) - headSpec.sr1 * 0.55 * (headSpec.sq || 1), snoutZ - headSpec.sr1 * 0.2, new THREE.Vector3(0, -0.04, 0.04).multiplyScalar(rig.size))
  rig.jaw = jaw
  addMesh(THREE, jaw, new THREE.CylinderGeometry(headSpec.sr2 * 0.7, headSpec.sr1 * 0.75, headSpec.sl * 0.92, 12).rotateX(Math.PI / 2).translate(0, 0, headSpec.sl * 0.46), belly).scale.set(1, 0.45, 1)
  const blood = tools.ball(jaw, headSpec.sr2 * 0.9, rig.woundMaterial || (rig.woundMaterial = new THREE.MeshStandardMaterial({ color: 0x6a100c, roughness: 0.3 })), 0, 0.0, headSpec.sl * 0.9, 1.1, 0.6, 0.6)
  tools.eyes(head, headSpec.r * 0.13, headSpec.r * headSpec.s[0] * 0.52, headSpec.r * 0.5, headSpec.r * 0.25 + headSpec.r * headSpec.s[2] * 0.55)
  const ears = spec.ears
  for (const side of [-1, 1]) {
    const earGroup = tools.pivot(head, side * headSpec.r * headSpec.s[0] * 0.55, headSpec.r * (0.25 + headSpec.s[1] * 0.75), headSpec.r * 0.1, new THREE.Vector3(side * 0.04, 0.04, 0).multiplyScalar(rig.size))
    rig.ears.push(earGroup)
    if (ears.t === 'cone') addMesh(THREE, earGroup, new THREE.ConeGeometry(ears.s * 0.45, ears.s, 8).translate(0, ears.s / 2, 0), main, 0, 0, 0, ears.fwd || 0, 0, side * -(ears.tilt ?? 0.3))
    else if (ears.t === 'round') tools.ball(earGroup, ears.s, main, 0, ears.s * 0.4, 0, 1, 1, 0.35)
    else if (ears.t === 'flop') {
      const ear = tools.ball(earGroup, ears.s, main, side * ears.s * 0.9, -ears.s * 0.1, 0, 1.5, 0.45, 0.7)
      ear.rotation.z = side * -0.25
    }
  }
  return { neck, head, blood, neckSpec, headSpec }
}

const buildTail = (THREE: Three, rig: AnimalRig, spec: QuadrupedSpec, parts: { bodyGroup: THREE_NS.Group; main: THREE_NS.MeshStandardMaterial; dark: THREE_NS.MeshStandardMaterial }): void => {
  const tools = createRigTools(THREE, rig)
  const tailSpec = spec.tail
  if (!tailSpec || !tailSpec.n) return
  const { bodyGroup, main, dark } = parts
  const { L, R: radius } = spec
  let parent = tools.pivot(bodyGroup, 0, radius * (spec.sy || 1) * (tailSpec.y ?? 0.3), (-L / 2) * 0.95, new THREE.Vector3(0, 0.02, -0.12).multiplyScalar(rig.size))
  parent.rotation.x = tailSpec.ang
  rig.tailRoot = parent
  const segmentLength = tailSpec.len / tailSpec.n
  for (let index = 0; index < tailSpec.n; index++) {
    const radius1 = tailSpec.r * (1 - (index / tailSpec.n) * 0.6)
    const radius2 = tailSpec.r * (1 - ((index + 1) / tailSpec.n) * 0.6)
    tools.limb(parent, radius1, radius2, segmentLength, tailSpec.dark && index === tailSpec.n - 1 ? dark : main)
    tools.joint(parent, radius1, main, 0, 0, 0)
    rig.tail.push(parent)
    if (index < tailSpec.n - 1) {
      const next = tools.pivot(parent, 0, -segmentLength, 0)
      next.rotation.x = tailSpec.curl || 0
      parent = next
    } else if (tailSpec.tuft) tools.ball(parent, tailSpec.r * 2.2, dark, 0, -segmentLength - tailSpec.r, 0, 1, 1.8, 1)
  }
  if (tailSpec.bushy) tools.ball(rig.tail[0] as THREE_NS.Group, tailSpec.r * 2.2, dark, 0, -tailSpec.len * 0.55, 0, 1, (tailSpec.len * 2.2) / tailSpec.r / 6, 1)
}

/** Wounds, ribs and the blood of the jaw: shown only while the animal is infected (page: the end of `quad`). */
const buildInfectionParts = (THREE: Three, rig: AnimalRig, spec: QuadrupedSpec, parts: { bodyGroup: THREE_NS.Group; neck: THREE_NS.Group; blood: THREE_NS.Mesh; neckSpec: QuadrupedSpec['neck'] }): void => {
  const tools = createRigTools(THREE, rig)
  const { bodyGroup, neck, blood, neckSpec } = parts
  const { L, R: radius } = spec
  const sideX = radius * (spec.sx || 1)
  const sideY = radius * (spec.sy || 1)
  const list: THREE_NS.Object3D[] = [blood]
  const wound = (parent: THREE_NS.Object3D, size: number, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE_NS.Mesh =>
    tools.ball(parent, size, rig.woundMaterial || (rig.woundMaterial = new THREE.MeshStandardMaterial({ color: 0x5a120e, roughness: 0.45 })), x, y, z, sx || 1, sy || 1, sz || 1)
  list.push(wound(bodyGroup, radius * 0.28, sideX * 0.92, sideY * 0.15, L * 0.05, 0.35, 1, 1.3))
  list.push(wound(bodyGroup, radius * 0.2, -sideX * 0.9, sideY * 0.3, -L * 0.2, 0.35, 1, 1.1))
  list.push(wound(neck, neckSpec.r * 0.5, neckSpec.r * 0.85, neckSpec.len * 0.5, 0, 0.4, 1, 1))
  const bone = tools.material(0xd9cfb8, { roughness: 0.6 })
  for (let index = 0; index < RIB_COUNT; index++) {
    const rib = addMesh(THREE, bodyGroup, new THREE.TorusGeometry(radius * 0.95, radius * 0.035, 6, 16, Math.PI * 0.42), bone, sideX * 0.12, sideY * 0.05, L * 0.12 - index * L * 0.07, 0, Math.PI / 2, -0.3)
    rib.scale.set(1, 1.02 * (spec.sy || 1), spec.sx || 1)
    list.push(rib)
  }
  rig.infectionParts.push(...list)
  list.forEach((part) => (part.visible = false))
}

/** Builds a quadruped: body, four legs on hip-knee-foot pivots, neck, head with jaw and eyes, ears, tail, the species' extra parts, and the infection parts. */
export const buildQuadruped = (THREE: Three, rig: AnimalRig, options: { document: DocumentLike; extra?: QuadrupedExtra }): AnimalRig => {
  const spec = rig.species.body as QuadrupedSpec
  const tools = createRigTools(THREE, rig)
  const colors = spec.c
  const texture = spec.texture ? createCoatTexture(THREE, options.document, spec.texture) : undefined
  const main = tools.material(texture ? 0xffffff : colors.main, texture ? { map: texture } : undefined)
  const belly = tools.material(colors.belly)
  const dark = tools.material(colors.dark)
  const nose = tools.material(colors.nose || colors.dark, { roughness: 0.4 })
  rig.main = main
  rig.dark = dark
  const { bodyGroup, bodyHeight } = buildBodyAndLegs(THREE, rig, spec, main, belly, dark)
  const { neck, head, blood, neckSpec, headSpec } = buildHead(THREE, rig, spec, { bodyGroup, main, belly, nose })
  buildTail(THREE, rig, spec, { bodyGroup, main, dark })
  options.extra?.({ THREE, rig, tools }, { bodyGroup, head, neck, main, belly, dark, L: spec.L, Rb: spec.R, bodyY: bodyHeight, hd: headSpec, nk: neckSpec })
  if (rig.species.outcome === 'turns') buildInfectionParts(THREE, rig, spec, { bodyGroup, neck, blood, neckSpec })
  else blood.visible = false
  return rig
}
