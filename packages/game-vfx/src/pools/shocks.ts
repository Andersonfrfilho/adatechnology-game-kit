import { OrderedPool } from '../pool'
import type { Puff } from './puffs'

/** A shock wave: an air shell that grows to the lethal radius in 120 ms, and a dust ring on the ground (L319-348). The last block is what the renderer reads. */
export interface Shock {
  x: number
  y: number
  z: number
  Rs: number
  Rg: number
  t: number
  dur: number
  shellScale: number
  shellAlpha: number
  ringScale: number
  ringAlpha: number
}

const DEFAULT_DURATION = 0.3
const SHELL_GROWTH_SECONDS = 0.12
const SHELL_FADE_SECONDS = 0.16
const PUSH_BAND = 0.8
const PUSH_CEILING = 3
const PUSH_AGE_LIMIT = 2

export function createShockPool(capacity: number): OrderedPool<Shock> {
  return new OrderedPool<Shock>(capacity, () => ({ x: 0, y: 0, z: 0, Rs: 0, Rg: 0, t: 0, dur: DEFAULT_DURATION, shellScale: 0, shellAlpha: 0, ringScale: 0, ringAlpha: 0 }))
}

export function spawnShock(pool: OrderedPool<Shock>, spec: { x: number; y: number; z: number; shellRadius: number; groundRadius: number; duration: number }): Shock {
  const shock = pool.acquire()
  shock.x = spec.x
  shock.y = spec.y
  shock.z = spec.z
  shock.Rs = spec.shellRadius
  shock.Rg = spec.groundRadius
  shock.t = 0
  shock.dur = spec.duration || DEFAULT_DURATION
  shock.shellScale = 0
  shock.shellAlpha = 0
  shock.ringScale = 0
  shock.ringAlpha = 0
  return shock
}

function pushPuffs(puffs: readonly Puff[], shock: Shock, reach: number, dt: number, age: number): void {
  for (const puff of puffs) {
    if (puff.ring || puff.t > PUSH_AGE_LIMIT) continue
    const dx = puff.x - shock.x
    const dz = puff.z - shock.z
    const distance = Math.hypot(dx, dz) + 0.001
    if (Math.abs(distance - reach) < PUSH_BAND && puff.y < PUSH_CEILING) {
      const strength = 4 * dt * (1 - age)
      puff.vx += (dx / distance) * strength * 6
      puff.vz += (dz / distance) * strength * 6
    }
  }
}

/** `updateShocks` (L335-348), walking the list backwards like the Lab: the fronts push the smoke and dust they meet. */
export function updateShocks(pool: OrderedPool<Shock>, puffs: readonly Puff[], dt: number): void {
  for (let index = pool.items.length - 1; index >= 0; index--) {
    const shock = pool.items[index]!
    shock.t += dt
    const age = shock.t / shock.dur
    const shellEase = 1 - Math.pow(1 - Math.min(1, shock.t / SHELL_GROWTH_SECONDS), 3)
    shock.shellScale = Math.max(0.01, shock.Rs * shellEase)
    shock.shellAlpha = Math.max(0, 1 - shock.t / SHELL_FADE_SECONDS) * 0.9
    const ringEase = 1 - Math.pow(1 - Math.min(1, age), 2.2)
    shock.ringScale = Math.max(0.01, shock.Rg * ringEase)
    shock.ringAlpha = Math.max(0, 1 - age) * 0.85
    pushPuffs(puffs, shock, shock.Rg * ringEase, dt, age)
    if (age >= 1) pool.removeAt(index)
  }
}
