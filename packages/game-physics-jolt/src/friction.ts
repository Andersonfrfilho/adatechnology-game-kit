import type { BodyId } from '@adatechnology/game-physics'

import type { JoltWorld } from './world'

/** One more (or one fewer) contact between `key` and `other`: `touching`, and the partners `updateFriction` compares speeds with. */
export const touch = (w: JoltWorld, key: number, other: number, by: number): void => {
  const n = (w.touches.get(key) ?? 0) + by
  if (n > 0) w.touches.set(key, n)
  else w.touches.delete(key)
  let mine = w.partners.get(key)
  if (!mine) {
    if (by < 0) return
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

/** The foot `updateFriction` is looking at: its world, its speed, and the fastest it slips against a partner so far. */
const foot = { world: null as JoltWorld | null, vx: 0, vy: 0, vz: 0, slip: 0 }

/** The foot's speed against one partner, at the foot (a fixed body has none); skipped once it already slips. */
const slipAgainst = (_count: number, other: number): void => {
  const w = foot.world
  if (!w || foot.slip > w.slipSpeed) return
  const o = w.bodies.get(other)
  if (!o) return
  if (o.invMass === 0 && o.layer === 'static') {
    foot.slip = Math.max(foot.slip, Math.sqrt(foot.vx * foot.vx + foot.vy * foot.vy + foot.vz * foot.vz))
    return
  }
  const u = w.bi.GetPointVelocity(o.id, w.r1)
  const dx = foot.vx - u.GetX(), dy = foot.vy - u.GetY(), dz = foot.vz - u.GetZ()
  foot.slip = Math.max(foot.slip, Math.sqrt(dx * dx + dy * dy + dz * dz))
}

/**
 * Coulomb by body (spec 008 D1.1, owner's B6 decision), after each `step`: an awake dynamic body whose foot (the point under its centre of mass at the bottom of
 * its bounds) moves against what it touches faster than `slipSpeed` slides, and holds its material's dynamic coefficient; slower, it sticks, and holds the
 * static one. Jolt mixes the two bodies' coefficients (geometric mean), a fixed body entering with its static one. The foot's speed has the body's turning in
 * it, so a can rolling without slipping sticks; against a moving body it is the difference of the two bodies' speeds at that point. A body touching nothing
 * keeps its state.
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
    if (!e || !mine || e.invMass === 0 || e.material.frictionStatic === e.material.frictionDynamic) continue
    const c = e.body.GetCenterOfMassPosition()
    w.r1.Set(c.GetX(), e.body.GetWorldSpaceBounds().mMin.GetY(), c.GetZ())
    const v = w.bi.GetPointVelocity(e.id, w.r1)
    foot.world = w
    foot.vx = v.GetX()
    foot.vy = v.GetY()
    foot.vz = v.GetZ()
    foot.slip = 0
    // a callback made once: a for-of over the partners made an iterator per awake body per step
    mine.forEach(slipAgainst)
    const sliding = foot.slip > w.slipSpeed
    if (sliding === e.sliding) continue
    e.sliding = sliding
    w.bi.SetFriction(e.id, sliding ? e.material.frictionDynamic : e.material.frictionStatic)
  }
  // the scratch lets go of the world: a disposed world is not kept by it
  foot.world = null
}

/**
 * Rolling resistance, after each fixed step: a body that touches something loses the angular impulse C_rr m g r dt against its spin, through its own inverse
 * inertia, and never more than stops the spin. Its contact's friction carries the change to its speed, as a rolling body's does.
 */
export const roll = (w: JoltWorld, dt: number): void => {
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
    const impulse = Math.min((rolling.coefficient * w.gravity * rolling.radius * dt) / e.invMass, spin / per)
    w.v2.Set((-wx / spin) * impulse, (-wy / spin) * impulse, (-wz / spin) * impulse)
    w.bi.AddAngularImpulse(e.id, w.v2)
  }
}
