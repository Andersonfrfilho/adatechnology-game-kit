import type { VfxCore } from '../core'
import type { Chunk } from './chunks'
import { addBloodSplat } from '../marks'
import { SMOKE_COLORS } from '../constants'
import { addPuff, addSpark } from '../spawn'

const RESTITUTION = -0.32
const GROUND_FRICTION = 0.5
const REST_SPEED = 0.6
const REST_SLIDE = 0.5
const TRAIL_SECONDS = 1.8
const TRAIL_STEP = 0.025
const QUARTER_TURN = Math.PI / 2

function bounce(core: VfxCore, chunk: Chunk, floor: number): void {
  chunk.y = floor
  if (chunk.blood && !chunk.splat && core.layers.mark) {
    chunk.splat = true
    addBloodSplat(core.marks, core.ground, chunk.rng, { x: chunk.x, z: chunk.z, radius: chunk.rng.between(0.06, 0.13) })
  }
  chunk.vy *= RESTITUTION
  chunk.vx *= GROUND_FRICTION
  chunk.vz *= GROUND_FRICTION
  chunk.ax *= GROUND_FRICTION
  chunk.ay *= GROUND_FRICTION
  chunk.az *= GROUND_FRICTION
  if (Math.abs(chunk.vy) < REST_SPEED && Math.hypot(chunk.vx, chunk.vz) < REST_SLIDE) {
    chunk.rest = true
    chunk.rx = Math.round(chunk.rx / QUARTER_TURN) * QUARTER_TURN
    chunk.rz = Math.round(chunk.rz / QUARTER_TURN) * QUARTER_TURN
  }
}

function leaveTrail(core: VfxCore, chunk: Chunk, dt: number): void {
  chunk.trail -= dt
  if (chunk.trail > 0) return
  chunk.trail = TRAIL_STEP
  const random = chunk.rng
  addSpark(core, {
    x: chunk.x, y: chunk.y, z: chunk.z, vx: chunk.vx * 0.15, vy: chunk.vy * 0.15, vz: chunk.vz * 0.15,
    life: random.between(0.25, 0.45), w: 0.05 + chunk.sx * 0.2, st: 0.05, kind: 0, g: 0, drag: 1,
  })
  if (random.next() < 0.25) {
    addPuff(core, random, { x: chunk.x, y: chunk.y, z: chunk.z, s0: 0.04, s1: 0.14 + chunk.sx * 0.3, sg: 0.15, life: random.between(1, 1.6), drag: 2, buoy: 0.6, color: SMOKE_COLORS.grey, kind: 0 })
  }
}

/** `updateChunks` (L383-398): gravity, spin, a bounce that kills speed, a rest pose on a quarter turn, and the ember trail of a hot piece. */
export function updateChunks(core: VfxCore, dt: number): void {
  for (const chunk of core.chunks.items) {
    chunk.t += dt
    if (chunk.rest) continue
    chunk.vy -= core.gravity * dt
    chunk.x += chunk.vx * dt
    chunk.y += chunk.vy * dt
    chunk.z += chunk.vz * dt
    chunk.rx += chunk.ax * dt
    chunk.ry += chunk.ay * dt
    chunk.rz += chunk.az * dt
    const floor = chunk.sy * 0.45 + core.groundAt(chunk.x, chunk.z)
    if (chunk.y < floor) bounce(core, chunk, floor)
    if (chunk.hot && chunk.t < TRAIL_SECONDS && core.layers.smoke) leaveTrail(core, chunk, dt)
  }
}
