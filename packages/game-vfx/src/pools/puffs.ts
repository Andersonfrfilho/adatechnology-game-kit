import type { Rgb } from '../color'
import { SMOKE_COLORS } from '../constants'
import { OrderedPool } from '../pool'
import type { RandomStream } from '../random'

/** The ring a mushroom cloud's puffs travel on (L722-735). */
export interface Ring {
  x: number
  z: number
  y0: number
  rise: number
  rk: number
  R0: number
  R1: number
  r: number
  roll: number
  t: number
  life: number
}

/**
 * Fire, smoke, dust, blood and gas (L193-238). `kind`: 0 fire that turns into smoke, 1 dust, 2 blood, 3 gas or white powder smoke, 4 bile.
 * The last block is what the renderer reads after `update`.
 */
export interface Puff {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  s0: number
  s1: number
  sg: number
  gk: number
  life: number
  t: number
  h0: number
  hl: number
  drag: number
  buoy: number
  grav: number
  kind: number
  seed: number
  wind: number
  color: Rgb
  ring: Ring | null
  ph: number
  th: number
  rng: RandomStream
  age: number
  heat: number
  size: number
}

export type PuffInit = Partial<Omit<Puff, 'seed' | 'age' | 'heat' | 'size' | 't' | 'rng'>>

const FLOOR_FRACTION = 0.4
const FLOOR_BOUNCE = -0.2
const ARRIVAL_FRAME = 30
const ARRIVAL_BASE = 0.3
const GROWTH_CAP_SECONDS = 3.5

export function createPuffPool(capacity: number): OrderedPool<Puff> {
  const placeholder: RandomStream = { next: () => 0, between: (min) => min, direction: (out) => out, state: 0 }
  return new OrderedPool<Puff>(capacity, () => ({
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.2, s1: 1, sg: 0.1, gk: 6, life: 3, t: 0, h0: 0, hl: 0.4, drag: 3, buoy: 0.5, grav: 0, kind: 0, seed: 0, wind: 1,
    color: SMOKE_COLORS.grey, ring: null, ph: 0, th: 0, rng: placeholder, age: 0, heat: 0, size: 0,
  }))
}

/** `puff()` of the Lab: draws `seed` first, always, even when the caller gives one (L196), and drops the oldest puff when the pool is full. */
export function spawnPuff(pool: OrderedPool<Puff>, random: RandomStream, init: PuffInit): Puff {
  const puff = pool.acquire()
  puff.x = init.x ?? 0
  puff.y = init.y ?? 0
  puff.z = init.z ?? 0
  puff.vx = init.vx ?? 0
  puff.vy = init.vy ?? 0
  puff.vz = init.vz ?? 0
  puff.s0 = init.s0 ?? 0.2
  puff.s1 = init.s1 ?? 1
  puff.sg = init.sg ?? 0.1
  puff.gk = init.gk ?? 6
  puff.life = init.life ?? 3
  puff.t = 0
  puff.h0 = init.h0 ?? 0
  puff.hl = init.hl ?? 0.4
  puff.drag = init.drag ?? 3
  puff.buoy = init.buoy ?? 0.5
  puff.grav = init.grav ?? 0
  puff.kind = init.kind ?? 0
  puff.seed = random.next()
  puff.wind = init.wind ?? 1
  puff.color = init.color ?? SMOKE_COLORS.grey
  puff.ring = init.ring ?? null
  puff.ph = init.ph ?? 0
  puff.th = init.th ?? 0
  puff.rng = random
  puff.age = 0
  puff.heat = 0
  puff.size = 0
  return puff
}

function ageOrKeep(puff: Puff, dt: number): boolean {
  puff.t += dt
  return puff.t < puff.life
}

function moveOnRing(puff: Puff, ring: Ring, wind: { x: number; z: number }): void {
  const ringTime = ring.t
  const centerY = ring.y0 + ring.rise * (1 - Math.exp(-ringTime * ring.rk))
  const majorRadius = ring.R0 + (ring.R1 - ring.R0) * (1 - Math.exp(-ringTime * 1.6))
  const theta = puff.th + ringTime * ring.roll
  const minorRadius = ring.r * (0.8 + 0.4 * Math.min(1, ringTime))
  const radius = majorRadius + minorRadius * Math.cos(theta)
  puff.x = ring.x + Math.cos(puff.ph) * radius + wind.x * ringTime * 0.6
  puff.z = ring.z + Math.sin(puff.ph) * radius + wind.z * ringTime * 0.6
  puff.y = centerY + minorRadius * Math.sin(theta)
}

function moveFree(puff: Puff, dt: number, age: number, heat: number, wind: { x: number; z: number }): void {
  const damping = Math.exp(-puff.drag * dt)
  puff.vx *= damping
  puff.vy *= damping
  puff.vz *= damping
  puff.vy += (puff.buoy * (heat > 0 ? 1.6 : 1) - puff.grav) * dt
  puff.x += (puff.vx + wind.x * puff.wind * age) * dt
  puff.y += puff.vy * dt
  puff.z += (puff.vz + wind.z * puff.wind * age) * dt
  if (puff.y < puff.s0 * FLOOR_FRACTION) {
    puff.y = puff.s0 * FLOOR_FRACTION
    if (puff.vy < 0) puff.vy *= FLOOR_BOUNCE
  }
}

/** `updatePuffs` (L205-238): ages, removes what ended, then moves the rest with the wind (or along their mushroom ring) and derives what the shader reads. */
export function updatePuffs(pool: OrderedPool<Puff>, dt: number, wind: { x: number; z: number }): void {
  pool.compact(ageOrKeep, dt)
  for (const puff of pool.items) {
    const age = puff.t / puff.life
    const heat = puff.h0 > 0 ? puff.h0 * Math.pow(Math.max(0, 1 - puff.t / puff.hl), 1.25) : 0
    if (puff.ring) moveOnRing(puff, puff.ring, wind)
    else moveFree(puff, dt, age, heat, wind)
    const size = puff.s0 + (puff.s1 - puff.s0) * (1 - Math.exp(-puff.t * puff.gk)) + puff.sg * Math.min(puff.t, GROWTH_CAP_SECONDS)
    puff.size = size * Math.min(1, puff.t * ARRIVAL_FRAME + ARRIVAL_BASE)
    puff.age = age
    puff.heat = heat
  }
}
