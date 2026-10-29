import { OrderedPool } from '../pool'
import type { Ring } from './puffs'

export function createRingPool(capacity: number): OrderedPool<Ring> {
  return new OrderedPool<Ring>(capacity, () => ({ x: 0, z: 0, y0: 0, rise: 0, rk: 0, R0: 0, R1: 0, r: 0, roll: 0, t: 0, life: 0 }))
}

function ageOrKeep(ring: Ring, dt: number): boolean {
  ring.t += dt
  return ring.t <= ring.life + 1
}

/** `updateRings` (L736): a ring is kept one second past the life of its puffs. */
export function updateRings(pool: OrderedPool<Ring>, dt: number): void {
  pool.compact(ageOrKeep, dt)
}

export function spawnRing(pool: OrderedPool<Ring>, spec: Omit<Ring, 't'>): Ring {
  const ring = pool.acquire()
  ring.x = spec.x
  ring.z = spec.z
  ring.y0 = spec.y0
  ring.rise = spec.rise
  ring.rk = spec.rk
  ring.R0 = spec.R0
  ring.R1 = spec.R1
  ring.r = spec.r
  ring.roll = spec.roll
  ring.t = 0
  ring.life = spec.life
  return ring
}
