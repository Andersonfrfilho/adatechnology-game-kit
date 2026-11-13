import { appendFileSync } from 'node:fs'

import { createRig, describeBody, GUIDE, SEGMENT_TREE } from '@adatechnology/game-characters'
import type { BodyDesc, BodyId, JointDesc, JointId, PhysicsWorld, Quat, Vec3 } from '@adatechnology/game-physics'

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

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
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

/** Cone and twist per joint kind (radians): hinge for knee and elbow, swing-twist elsewhere. */
const LIMITS: Record<string, { cone: number; plane: number; twist: number } | { hingeMin: number; hingeMax: number }> = {
  spine: { cone: 0.35, plane: 0.35, twist: 0.3 },
  neck: { cone: 0.5, plane: 0.5, twist: 0.6 },
  head: { cone: 0.3, plane: 0.3, twist: 0.3 },
  jaw: { hingeMin: 0, hingeMax: 0.3 },
  shoulder: { cone: 1.4, plane: 1.4, twist: 0.8 },
  elbow: { hingeMin: -2.5, hingeMax: 0 },
  wrist: { cone: 0.7, plane: 0.7, twist: 0.4 },
  hip: { cone: 1.2, plane: 1.0, twist: 0.5 },
  knee: { hingeMin: 0, hingeMax: 2.4 },
  ankle: { cone: 0.5, plane: 0.5, twist: 0.3 },
}

/**
 * The 17-segment body of game-characters (`describeBody` of the guide rig, 1.80 m): capsules and spheres with its masses, at `at`, standing.
 * Neighbouring segments do not collide (a group).
 */
export const ragdoll = (world: PhysicsWorld, at: Vec3, user: number): Ragdoll => {
  const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })
  const spec = describeBody({ rig, body: GUIDE, build: 1 })
  const index = new Map<string, number>(SEGMENT_TREE.map((n, i) => [n.id, i]))
  const pairs = SEGMENT_TREE.filter((n) => n.parent).map((n) => [index.get(n.parent as string) ?? 0, index.get(n.id) ?? 0] as const)
  // the upper arms also touch the neck and the thighs touch each other at the hip: kept apart like neighbours
  const group = world.createGroup(SEGMENT_TREE.length, [...pairs, [index.get('thighL') ?? 0, index.get('thighR') ?? 0], [index.get('neck') ?? 0, index.get('upperArmL') ?? 0], [index.get('neck') ?? 0, index.get('upperArmR') ?? 0]])
  const descs: BodyDesc[] = SEGMENT_TREE.map((node, i) => {
    const part = spec.parts.find((p) => p.id === node.id)
    if (!part) throw new Error(node.id)
    const pos = part.position ?? [0, 0, 0]
    const rot = part.rotation ?? [0, 0, 0]
    const shape = part.shape
    const radius = shape.kind === 'sphere' || shape.kind === 'cylinder' ? shape.radius : 0.05
    const half = shape.kind === 'cylinder' ? Math.max(0.01, shape.height / 2 - radius) : 0
    return {
      shape: half > 0.01 ? { kind: 'capsule', halfHeight: half, radius } : { kind: 'sphere', radius },
      motion: 'dynamic',
      position: [at[0] + pos[0], at[1] + pos[1], at[2] + pos[2]],
      rotation: eulerXYZ(rot[0], rot[1], rot[2]),
      mass: part.mass,
      layer: 'character',
      group: { id: group, sub: i },
      angularDamping: 0.3,
      continuous: node.kind === 'foot' || node.kind === 'hand',
      linearDamping: 0.05,
      material: { frictionStatic: 0.8, frictionDynamic: 0.6, restitution: 0.05 },
      user: user * 32 + i,
    }
  })
  const bodies = world.createBodies(descs)
  const joints: Ragdoll['joints'] = []
  SEGMENT_TREE.forEach((node, i) => {
    if (!node.parent) return
    const parent = bodies[index.get(node.parent) ?? 0]
    const j = rig.joints[node.joint]
    const point: Vec3 = [at[0] + j[0], at[1] + j[1], at[2] + j[2]]
    const child = SEGMENT_TREE.find((n) => n.parent === node.id)
    const end = child ? rig.joints[child.joint] : ([j[0], j[1] - 0.1, j[2]] as Vec3)
    // the head turns about the neck's line, not toward the jaw
    const along = node.id === 'head' ? ([0, 1, 0] as Vec3) : norm(sub(end, j))
    // the plane axis must be square to the twist axis (Jolt builds the joint frame from both)
    const seed: Vec3 = Math.abs(along[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]
    const d = seed[0] * along[0] + seed[1] * along[1] + seed[2] * along[2]
    const plane = norm([seed[0] - d * along[0], seed[1] - d * along[1], seed[2] - d * along[2]])
    const kind = node.joint.replace(/[LR]$/, '')
    const limit = LIMITS[kind] ?? LIMITS.spine
    const desc: JointDesc =
      'hingeMin' in limit
        ? { kind: 'hinge', a: parent, b: bodies[i], point, axis: [1, 0, 0], normal: plane, min: limit.hingeMin, max: limit.hingeMax, friction: 2 }
        : {
            kind: 'swingTwist', a: parent, b: bodies[i], point, twistAxis: along, planeAxis: plane,
            normalHalfCone: limit.cone, planeHalfCone: limit.plane, twistMin: -limit.twist, twistMax: limit.twist, friction: 2,
          }
    joints.push({ id: world.createJoint(desc), desc })
  })
  return { bodies, joints }
}

/** The compact hatch of game-vehicles-fleet (1034 kg; 4.212 x 1.919 x 1.472 m; wheelbase 2.551, track 1.51, tyre 0.622 m, clearance 0.128). */
export const HATCH = { mass: 1034, length: 4.212, width: 1.73, height: 1.472, wheelbase: 2.551, track: 1.51, tyre: 0.622, clearance: 0.128 } as const
