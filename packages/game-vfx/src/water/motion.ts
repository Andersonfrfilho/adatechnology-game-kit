import type { WaterBubble, WaterColumn, WaterDrop, WaterFoam, WaterMist, WaterPools, WaterRing, WaterWave } from './records'

export const WATER_GRAVITY = 9.81
/** Per second, the share of a drop's speed the air takes. */
const DROP_DRAG = 0.25
/** Per second, the share of a puff of spray's speed the air takes. */
const MIST_DRAG = 1.2

/** Where a drop fell back on the surface, for the host's small ring. */
export type DropLanded = (drop: WaterDrop) => void

export interface MotionContext {
  dt: number
  landed: DropLanded
}

function moveDrop(drop: WaterDrop, context: MotionContext): boolean {
  const { dt } = context
  drop.age += dt
  const keep = Math.exp(-DROP_DRAG * dt)
  drop.vx *= keep
  drop.vz *= keep
  drop.vy = drop.vy * keep - WATER_GRAVITY * dt
  drop.x += drop.vx * dt
  drop.y += drop.vy * dt
  drop.z += drop.vz * dt
  if (drop.vy < 0 && drop.y <= drop.level) {
    context.landed(drop)
    return false
  }
  return drop.age < drop.life
}

function ageRing(ring: WaterRing, dt: number): boolean {
  if (ring.delay > 0) {
    ring.delay -= dt
    ring.alpha = 0
    return true
  }
  ring.age += dt
  const t = Math.min(1, ring.age / ring.life)
  // a ripple slows as it spreads; a shock ring is out at once; a wave crest goes at its own speed
  const spread = ring.kind === 2 ? t : ring.kind === 1 ? 1 - (1 - t) ** 4 : 1 - (1 - t) ** 2
  ring.radius = ring.startRadius + (ring.maxRadius - ring.startRadius) * spread
  ring.alpha = ring.strength * (1 - t) * (ring.kind === 1 ? 1 - t : 1)
  return ring.age < ring.life
}

function ageFoam(foam: WaterFoam, dt: number): boolean {
  foam.age += dt
  const t = Math.min(1, foam.age / foam.life)
  foam.radius = foam.startRadius + (foam.maxRadius - foam.startRadius) * (1 - (1 - t) ** 3)
  foam.alpha = t < 0.5 ? 0.85 : 0.85 * (1 - (t - 0.5) / 0.5)
  return foam.age < foam.life
}

function ageColumn(column: WaterColumn, dt: number): boolean {
  if (column.delay > 0) {
    column.delay -= dt
    column.height = 0
    column.alpha = 0
    return true
  }
  column.age += dt
  const t = column.age
  const fall = Math.max(1e-3, column.life - column.rise)
  column.height = t < column.rise ? column.peak * (1 - (1 - t / column.rise) ** 2) : column.peak * Math.max(0, 1 - ((t - column.rise) / fall) ** 1.6)
  column.radius = column.baseRadius * (1 + (column.dome ? 0.4 : 1.2) * Math.min(1, t / column.life))
  const share = t / column.life
  column.alpha = share < 0.6 ? 0.9 : 0.9 * Math.max(0, 1 - (share - 0.6) / 0.4)
  return t < column.life
}

function ageBubble(bubble: WaterBubble, dt: number): boolean {
  if (bubble.delay > 0) {
    bubble.delay -= dt
    bubble.alpha = 0
    return true
  }
  bubble.age += dt
  bubble.y += bubble.rise * dt
  bubble.size *= 1 + 0.15 * dt
  bubble.alpha = 0.7 * (1 - bubble.age / bubble.life)
  return bubble.age < bubble.life && bubble.y < bubble.level - bubble.size
}

function ageMist(mist: WaterMist, dt: number): boolean {
  mist.age += dt
  const keep = Math.exp(-MIST_DRAG * dt)
  mist.vx *= keep
  mist.vy = mist.vy * keep - 0.15 * dt
  mist.vz *= keep
  mist.x += mist.vx * dt
  mist.y += mist.vy * dt
  mist.z += mist.vz * dt
  mist.size *= 1 + 0.35 * dt
  const t = mist.age / mist.life
  mist.alpha = t < 0.15 ? (t / 0.15) * 0.45 : 0.45 * (1 - (t - 0.15) / 0.85)
  return mist.age < mist.life
}

function ageWave(wave: WaterWave, dt: number): boolean {
  if (wave.delay > 0) {
    wave.delay -= dt
    return true
  }
  wave.age += dt
  return wave.age < wave.life && wave.speed * wave.age < wave.reach + wave.width
}

/** One step of every pool: moves, ages, and drops what is spent. */
export function stepWaterPools(pools: WaterPools, context: MotionContext): void {
  const { dt } = context
  pools.drops.compact(moveDrop, context)
  pools.rings.compact(ageRing, dt)
  pools.foam.compact(ageFoam, dt)
  pools.columns.compact(ageColumn, dt)
  pools.bubbles.compact(ageBubble, dt)
  pools.mist.compact(ageMist, dt)
  pools.waves.compact(ageWave, dt)
}
