import type { BodyId, Material } from '@adatechnology/game-physics'

import { vec3At } from './vec3'
import type { JoltWorld } from './world'

/**
 * One more (or one fewer) contact between `key` and `other`: the partners `updateFriction` compares speeds with, and `touching` (a body with a partner). One fewer counts only for a
 * pair that was counted: a sensor's pair never is, and a body already removed has no entry left to say which kind its pair was (Jolt reports the removal a step
 * later).
 */
export const touch = (w: JoltWorld, key: number, other: number, by: number): void => {
  let mine = w.partners.get(key)
  if (by < 0 && !mine?.has(other)) return
  if (!mine) {
    mine = new Map()
    w.partners.set(key, mine)
  }
  const k = (mine.get(other) ?? 0) + by
  if (k > 0) mine.set(other, k)
  else {
    mine.delete(other)
    if (mine.size === 0) w.partners.delete(key)
  }
}

/**
 * The foot `updateFriction` is looking at: its world, its speed, the fastest it slips against a partner so far, and the one material all its partners share
 * when they are all fixed (`null` before the first, `false` once a partner moves or has another material).
 */
const foot = { world: null as JoltWorld | null, vx: 0, vy: 0, vz: 0, slip: 0, ground: null as Material | null | false }

/** The foot's speed against one partner, at the foot (a fixed body has none), until it already slips; and whether the partners are one fixed material. */
const slipAgainst = (_count: number, other: number): void => {
  const w = foot.world
  if (!w) return
  const o = w.bodies.get(other)
  if (!o) return
  const fixed = o.invMass === 0 && o.layer === 'static'
  if (!fixed || (foot.ground !== null && foot.ground !== o.material)) foot.ground = false
  else if (foot.ground === null) foot.ground = o.material
  if (foot.slip > w.slipSpeed) return
  if (fixed) {
    foot.slip = Math.max(foot.slip, Math.sqrt(foot.vx * foot.vx + foot.vy * foot.vy + foot.vz * foot.vz))
    return
  }
  const heap = w.J.HEAPF32
  const at = vec3At(w.J, w.bi.GetPointVelocity(o.id, w.r1))
  const dx = foot.vx - (heap[at] as number), dy = foot.vy - (heap[at + 1] as number), dz = foot.vz - (heap[at + 2] as number)
  foot.slip = Math.max(foot.slip, Math.sqrt(dx * dx + dy * dy + dz * dz))
}

/**
 * The coefficient a body holds (design `atrito-por-corpo.md` §3): sticking, its static one; sliding, its dynamic one, or, when everything it touches is fixed and of
 * one material, `mu_d1 mu_d2 / mu_s2`, so that Jolt's geometric mean with the fixed body's static coefficient is the kit's `sqrt(mu_d1 mu_d2)` exactly.
 */
const coefficientOf = (material: Material, sliding: boolean, ground: Material | null | false): number => {
  if (!sliding) return material.frictionStatic
  if (!ground || ground.frictionStatic <= 0) return material.frictionDynamic
  return (material.frictionDynamic * ground.frictionDynamic) / ground.frictionStatic
}

/**
 * Coulomb by body (spec 008 D1.1, owner's B6 decision), after each fixed step: an awake dynamic body whose foot (the point under its centre of mass at the bottom
 * of its bounds) moves against what it touches faster than `slipSpeed` slides; slower, it sticks. Its coefficient is `coefficientOf`; Jolt mixes the two bodies'
 * (geometric mean), a fixed body entering with its static one. The foot's speed has the body's turning in it, so a can rolling without slipping on flat ground
 * sticks; on a slope, or bouncing, the speed along the contact normal counts too (design §2). A body touching nothing keeps its state. Each body's result reads
 * only speeds after the step, never another body's friction: the order bodies and partners are visited in does not change it.
 */
export const updateFriction = (w: JoltWorld): void => {
  const J = w.J
  const ids = w.activeIds
  w.system.GetActiveBodies(J.EBodyType_RigidBody, ids)
  const n = ids.size()
  for (let i = 0; i < n; i++) {
    const key = ids.at(i).GetIndexAndSequenceNumber()
    const e = w.bodies.get(key)
    const mine = w.partners.get(key)
    if (!e || !mine || e.invMass === 0) continue
    const heap = J.HEAPF32
    let at = vec3At(J, e.body.GetCenterOfMassPosition())
    const cx = heap[at] as number, cz = heap[at + 2] as number
    at = vec3At(J, e.body.GetWorldSpaceBounds().mMin)
    w.r1.Set(cx, heap[at + 1] as number, cz)
    at = vec3At(J, w.bi.GetPointVelocity(e.id, w.r1))
    foot.world = w
    foot.vx = heap[at] as number
    foot.vy = heap[at + 1] as number
    foot.vz = heap[at + 2] as number
    foot.slip = 0
    foot.ground = null
    // a callback made once: a for-of over the partners made an iterator per awake body per step
    mine.forEach(slipAgainst)
    e.sliding = foot.slip > w.slipSpeed
    const friction = coefficientOf(e.material, e.sliding, foot.ground)
    if (friction === e.friction) continue
    e.friction = friction
    w.bi.SetFriction(e.id, friction)
  }
  // the scratch lets go of the world and its materials: a disposed world is not kept by it
  foot.world = null
  foot.ground = null
}

/** The largest rolling resistance among the surfaces a rolling body touches so far, and the world it is read in. */
const surface = { world: null as JoltWorld | null, rolling: 0 }

const softest = (_count: number, other: number): void => {
  const o = surface.world?.bodies.get(other)
  if (o?.material.rolling !== undefined && o.material.rolling > surface.rolling) surface.rolling = o.material.rolling
}

/**
 * Rolling resistance, after each fixed step: a body that touches something loses the angular impulse C_rr m g r dt against its spin, through its own inverse
 * inertia, and never more than stops the spin. C_rr is the larger of the body's own and of what it touches (`Material.rolling`: the softer surface decides). Its
 * contact's friction carries the change to its speed, as a rolling body's does.
 */
export const roll = (w: JoltWorld, dt: number): void => {
  surface.world = w
  for (const [key, rolling] of w.rollers) {
    const e = w.bodies.get(key)
    if (!e || e.invMass === 0 || !e.body.IsActive() || !w.touching(key as BodyId)) continue
    const a = e.body.GetAngularVelocity()
    const wx = a.GetX(), wy = a.GetY(), wz = a.GetZ()
    const spin = Math.hypot(wx, wy, wz)
    if (spin < 1e-6) continue
    // spin taken away per unit of angular impulse against it: n . I^-1 n
    w.v2.Set(wx / spin, wy / spin, wz / spin)
    const iw = e.body.GetInverseInertia().Multiply3x3(w.v2)
    const per = (iw.GetX() * wx + iw.GetY() * wy + iw.GetZ() * wz) / spin
    if (per <= 0) continue
    surface.rolling = rolling.coefficient
    w.partners.get(key)?.forEach(softest)
    const impulse = Math.min((surface.rolling * w.gravity * rolling.radius * dt) / e.invMass, spin / per)
    w.v2.Set((-wx / spin) * impulse, (-wy / spin) * impulse, (-wz / spin) * impulse)
    w.bi.AddAngularImpulse(e.id, w.v2)
  }
  surface.world = null
}
