import type { Rgb } from '../color'
import { lerp } from '../vector'
import { OrderedPool } from '../pool'

/** The position a glow follows (a chunk, or anything with `x`, `y`, `z`). */
export interface FollowPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** An additive halo (L294-318). The last block is what the renderer reads after `update`: where it is, how big and how bright. */
export interface Glow {
  x: number
  y: number
  z: number
  s: number
  s1: number | null
  i: number
  t: number
  life: number
  color: Rgb
  curve: number
  flick: boolean
  follow: FollowPoint | null
  fx: number
  fy: number
  fz: number
  outX: number
  outY: number
  outZ: number
  outSize: number
  outIntensity: number
}

export type GlowInit = Partial<Omit<Glow, 't' | 'outX' | 'outY' | 'outZ' | 'outSize' | 'outIntensity'>>

const DEFAULT_COLOR: Rgb = [1, 0.6, 0.25]

export function createGlowPool(capacity: number): OrderedPool<Glow> {
  return new OrderedPool<Glow>(capacity, () => ({
    x: 0, y: 0, z: 0, s: 1, s1: null, i: 1, t: 0, life: 0.3, color: DEFAULT_COLOR, curve: 2, flick: false, follow: null, fx: 0, fy: 0, fz: 0,
    outX: 0, outY: 0, outZ: 0, outSize: 0, outIntensity: 0,
  }))
}

export function spawnGlow(pool: OrderedPool<Glow>, init: GlowInit): Glow {
  const glow = pool.acquire()
  glow.x = init.x ?? 0
  glow.y = init.y ?? 0
  glow.z = init.z ?? 0
  glow.s = init.s ?? 1
  glow.s1 = init.s1 ?? null
  glow.i = init.i ?? 1
  glow.t = 0
  glow.life = init.life ?? 0.3
  glow.color = init.color ?? DEFAULT_COLOR
  glow.curve = init.curve ?? 2
  glow.flick = init.flick ?? false
  glow.follow = init.follow ?? null
  glow.fx = init.fx ?? 0
  glow.fy = init.fy ?? 0
  glow.fz = init.fz ?? 0
  return glow
}

function ageOrKeep(glow: Glow, dt: number): boolean {
  glow.t += dt
  return glow.t < glow.life
}

const FLICKER_RATE = 40
const FLICKER_SPREAD = 9

/** `updateGlows` (L305-318). */
export function updateGlows(pool: OrderedPool<Glow>, dt: number): void {
  pool.compact(ageOrKeep, dt)
  for (const glow of pool.items) {
    const age = glow.t / glow.life
    let x = glow.x
    let y = glow.y
    let z = glow.z
    if (glow.follow) {
      x = glow.follow.x + glow.fx
      y = glow.follow.y + glow.fy
      z = glow.follow.z + glow.fz
    }
    glow.outX = x
    glow.outY = y
    glow.outZ = z
    glow.outSize = glow.s1 !== null ? lerp(glow.s, glow.s1, 1 - Math.pow(1 - age, 3)) : glow.s
    const flicker = glow.flick ? 0.75 + 0.25 * Math.sin(glow.t * FLICKER_RATE + glow.s * FLICKER_SPREAD) : 1
    glow.outIntensity = glow.i * Math.pow(1 - age, glow.curve) * flicker
  }
}
