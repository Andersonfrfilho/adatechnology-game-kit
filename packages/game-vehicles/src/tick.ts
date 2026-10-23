/** Per-frame update loop for particles, fluids, spinning parts and rollover. */
import type { Kit } from './types'

export function installTick(kit: Kit): void {
  const I = kit._

  /* ================= per-frame loop ================= */
  kit.tick = function (c: any, dt: any) {
    c.time += dt
    if (c.rollState) I.tickRoll(c, dt)
    if (c.blast) I.tickBoom(c, dt)
    if (c.flying || c.bigFx) I.tickFlying(c, dt)
    if (c.hood) {
      const h = c.hood
      const tg = Math.max(h.target, h.latch)
      h.ang += (tg - h.ang) * Math.min(1, dt * 4.5)
      h.piv.rotation.z = h.ang * (h.sign || 1)
    }
    c.spin.forEach(function (s: any) {
      s.o.rotation[s.axis] += dt * s.v
      if (s.decay) s.v *= Math.max(0, 1 - s.decay * dt)
    })
    I.tickEmit(c, dt)
    I.tickParticles(c, dt)
    I.updateFluids(c, dt)
    if (c.meta.kind === 'boat' && !c.flipped && !c.rollState) {
      c.vehicle.position.y = (c.sunk || 0) + Math.sin(c.time * 1.3) * 0.04
      c.vehicle.rotation.z = Math.sin(c.time * 0.9) * 0.02
    }
  }
  kit.settle = function (c: any, sec: any) {
    const n = Math.round(sec * 30)
    for (let i = 0; i < n; i++) kit.tick(c, 1 / 30)
  }
  kit.setHood = function (c: any, open: any) {
    if (!c.hood) return false
    c.hood.target = open ? c.hood.open : 0
    return true
  }

  Object.assign(I, {})
}
