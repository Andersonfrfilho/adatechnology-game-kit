import { appendFileSync } from 'node:fs'

import { createRig, GUIDE, ragdollOfRig, SEGMENT_TREE } from '@adatechnology/game-characters'
import type { BodyId, CharacterDesc, JointDesc, JointId, PhysicsWorld, Quat, RagdollDesc, Vec3 } from '@adatechnology/game-physics'

/** A person: 0.3 m radius, 1.8 m tall, 75 kg, pushes with 400 N. */
export const WALKER: CharacterDesc = { position: [0, 0, 0], radius: 0.3, halfHeight: 0.6, mass: 75, strength: 400 }

/** Measurements go to the file in SPIKE_OUT (one JSON line each), and to the console. */
export const report = (name: string, value: Record<string, unknown>): void => {
  const line = JSON.stringify({ name, ...value })
  console.log(line)
  const out = process.env.SPIKE_OUT
  if (out) appendFileSync(out, `${line}\n`)
}

export const stats = (samples: readonly number[]): { median: number; p90: number; p99: number; max: number } => {
  const s = [...samples].sort((a, b) => a - b)
  const at = (q: number): number => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0
  const r = (x: number): number => Math.round(x * 1000) / 1000
  return { median: r(at(0.5)), p90: r(at(0.9)), p99: r(at(0.99)), max: r(s[s.length - 1] ?? 0) }
}

export const eulerXYZ = (x: number, y: number, z: number): Quat => {
  const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2), c2 = Math.cos(y / 2), s2 = Math.sin(y / 2), c3 = Math.cos(z / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}

export const ground = (world: PhysicsWorld, half = 50): BodyId =>
  world.createBody({ shape: { kind: 'box', half: [half, 0.5, half] }, motion: 'static', position: [0, -0.5, 0], user: -1 })

/** Five steps 0.18 m high, 0.28 m deep, 1.2 m wide, rising toward -z from z = 0. */
export const stairs = (world: PhysicsWorld, at: Vec3): void => {
  for (let i = 0; i < 5; i++) {
    const h = 0.18 * (i + 1)
    world.createBody({ shape: { kind: 'box', half: [0.6, h / 2, 0.14] }, motion: 'static', position: [at[0], at[1] + h / 2, at[2] - 0.14 - 0.28 * i], user: -1 })
  }
}

export interface Ragdoll {
  readonly bodies: BodyId[]
  readonly joints: Array<{ id: JointId; desc: JointDesc }>
}

/** Pairs of parts that do not meet when made as loose bodies: neighbours, the thighs, the neck and the upper arms (the engine's ragdoll does this itself). */
const apartPairs = (): Array<readonly [number, number]> => {
  const index = new Map<string, number>(SEGMENT_TREE.map((n, i) => [n.id, i]))
  const at = (id: string): number => index.get(id) ?? 0
  const neighbours = SEGMENT_TREE.filter((n) => n.parent).map((n) => [at(n.parent as string), at(n.id)] as const)
  return [...neighbours, [at('thighL'), at('thighR')], [at('neck'), at('upperArmL')], [at('neck'), at('upperArmR')]]
}

/** The 17-segment body of game-characters (`ragdollOfRig` of the guide rig, 1.80 m), at `at`, standing. */
const ragdollDesc = (at: Vec3, user: number): RagdollDesc => {
  const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })
  return ragdollOfRig({ rig, body: GUIDE, build: 1, at, user })
}

/** The 17-segment body as loose bodies and joints (the spike's first try). Neighbouring segments do not collide (a group). */
export const ragdoll = (world: PhysicsWorld, at: Vec3, user: number): Ragdoll => {
  const { parts } = ragdollDesc(at, user)
  const group = world.createGroup(SEGMENT_TREE.length, apartPairs())
  const bodies = world.createBodies(parts.map((p, i) => ({ ...p.body, motion: 'dynamic', group: { id: group, sub: i } })))
  const joints: Ragdoll['joints'] = []
  parts.forEach((part, i) => {
    if (!part.joint) return
    const desc: JointDesc = { ...part.joint, a: bodies[part.parent], b: bodies[i] }
    joints.push({ id: world.createJoint(desc), desc })
  })
  return { bodies, joints }
}

/** The 17-segment body as the engine's own ragdoll (`createRagdoll`), stabilized unless told not to. Parts are in the tree's order, parents first. */
export const engineRagdoll = (world: PhysicsWorld, at: Vec3, user: number, stabilize = true, solverSteps?: { velocity: number; position: number }): Ragdoll => {
  const { parts } = ragdollDesc(at, user)
  const made = world.createRagdoll(solverSteps ? { parts, stabilize, solverSteps } : { parts, stabilize })
  const joints: Ragdoll['joints'] = []
  let k = 0
  parts.forEach((part, i) => {
    if (!part.joint) return
    joints.push({ id: made.joints[k++], desc: { ...part.joint, a: made.bodies[part.parent], b: made.bodies[i] } })
  })
  return { bodies: [...made.bodies], joints }
}

/** The compact hatch of game-vehicles-fleet (1034 kg; 4.212 x 1.919 x 1.472 m; wheelbase 2.551, track 1.51, tyre 0.622 m, clearance 0.128). */
export const HATCH = { mass: 1034, length: 4.212, width: 1.73, height: 1.472, wheelbase: 2.551, track: 1.51, tyre: 0.622, clearance: 0.128 } as const
