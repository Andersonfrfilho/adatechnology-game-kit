import type { Rgb } from '../color'
import { SMOKE_COLORS } from '../constants'
import type { VfxCore } from '../core'
import { OrderedPool } from '../pool'
import { spawnPuff } from '../pools/puffs'
import { spawnSpark } from '../pools/sparks'
import type { RandomStream } from '../random'
import type { Follow } from '../types'
import { lerp } from '../vector'

/** A lingering fire (L424-442): it grows, gives flames that cool into smoke, and fades out. */
export interface Fire {
  x: number
  y: number
  z: number
  r: number
  r0: number
  grow: number
  life: number
  t: number
  rate: number
  acc: number
  smoke: number
  smokeAcc: number
  fade: number
  follow: Follow | null
  fx: number
  fy: number
  fz: number
  color: Rgb
  rng: RandomStream
  handle: number
}

export type FireInit = Partial<Pick<Fire, 'x' | 'y' | 'z' | 'r' | 'grow' | 'life' | 'rate' | 'smoke' | 'follow' | 'fx' | 'fy' | 'fz' | 'color'>> & { startRadius?: number }

export function createFirePool(capacity: number, placeholder: RandomStream): OrderedPool<Fire> {
  return new OrderedPool<Fire>(capacity, () => ({
    x: 0, y: 0, z: 0, r: 0.6, r0: 0.6, grow: 0, life: 6, t: 0, rate: 22, acc: 0, smoke: 0.6, smokeAcc: 0, fade: 1, follow: null, fx: 0, fy: 0, fz: 0, color: SMOKE_COLORS.black,
    rng: placeholder, handle: 0,
  }))
}

export function spawnFire(pool: OrderedPool<Fire>, random: RandomStream, init: FireInit, handle: number): Fire {
  const fire = pool.acquire()
  fire.x = init.x ?? 0
  fire.y = init.y ?? 0
  fire.z = init.z ?? 0
  fire.r = init.r ?? 0.6
  fire.r0 = init.startRadius ?? fire.r
  fire.grow = init.grow ?? 0
  fire.life = init.life ?? 6
  fire.t = 0
  fire.rate = init.rate ?? 22
  fire.acc = 0
  fire.smoke = init.smoke ?? 0.6
  fire.smokeAcc = 0
  fire.fade = 1
  fire.follow = init.follow ?? null
  fire.fx = init.fx ?? 0
  fire.fy = init.fy ?? 0
  fire.fz = init.fz ?? 0
  fire.color = init.color ?? SMOKE_COLORS.black
  fire.rng = random
  fire.handle = handle
  return fire
}

function positionOf(follow: Follow): { x: number; y: number; z: number } {
  return 'position' in follow ? follow.position : follow
}

function emitFlames(core: VfxCore, fire: Fire, radius: number, dt: number): void {
  const random = fire.rng
  fire.acc += dt * fire.rate * (0.5 + radius * 0.9) * fire.fade * core.clock.lod
  while (fire.acc >= 1) {
    fire.acc -= 1
    const angle = random.next() * Math.PI * 2
    const distance = Math.sqrt(random.next()) * radius
    spawnPuff(core.puffs, random, {
      x: fire.x + Math.cos(angle) * distance, y: fire.y + 0.05, z: fire.z + Math.sin(angle) * distance,
      vx: random.between(-0.2, 0.2), vy: random.between(0.6, 1.4), vz: random.between(-0.2, 0.2),
      s0: 0.1, s1: random.between(0.28, 0.46) * (0.8 + Math.min(radius, 3) * 0.22), sg: -0.08,
      life: random.between(0.45, 0.85), h0: random.between(1, 1.25), hl: random.between(0.35, 0.6),
      drag: 1.5, buoy: 3.2, color: fire.color, kind: 0, wind: 0.4,
    })
    core.spawned.puffs++
  }
}

function emitSmoke(core: VfxCore, fire: Fire, radius: number, dt: number): void {
  const random = fire.rng
  fire.smokeAcc += dt * fire.smoke * (1 + radius * 0.8) * fire.fade * core.clock.lod
  while (fire.smokeAcc >= 1 && core.layers.smoke) {
    fire.smokeAcc -= 1
    spawnPuff(core.puffs, random, {
      x: fire.x + random.between(-radius, radius) * 0.5, y: fire.y + 0.6 + radius * 0.3, z: fire.z + random.between(-radius, radius) * 0.5,
      vy: random.between(0.8, 1.5), s0: 0.25, s1: 0.6 + Math.min(radius, 2) * 0.3, sg: 0.3, life: random.between(4, 6.5),
      h0: 0.25, hl: 0.25, drag: 0.6, buoy: 0.55, color: fire.color, kind: 0,
    })
    core.spawned.puffs++
  }
}

function emitEmber(core: VfxCore, fire: Fire, radius: number, dt: number): void {
  const random = fire.rng
  if (!(random.next() < dt * 6 * fire.fade && core.layers.shrapnel)) return
  spawnSpark(core.sparks, {
    x: fire.x + random.between(-radius, radius) * 0.6, y: fire.y + 0.4, z: fire.z + random.between(-radius, radius) * 0.6,
    vx: random.between(-0.4, 0.4), vy: random.between(1.5, 3.2), vz: random.between(-0.4, 0.4),
    life: random.between(0.8, 1.6), w: 0.025, st: 0.02, kind: 4, g: -0.6, drag: 1.2,
  })
  core.spawned.sparks++
}

/** `updateFires` (L430-442), walking the list backwards like the Lab. */
export function updateFires(core: VfxCore, dt: number): void {
  const pool = core.fires
  for (let index = pool.items.length - 1; index >= 0; index--) {
    const fire = pool.items[index]!
    fire.t += dt
    if (fire.follow) {
      const point = positionOf(fire.follow)
      fire.x = point.x + fire.fx
      fire.y = point.y + fire.fy
      fire.z = point.z + fire.fz
    }
    const radius = fire.grow ? lerp(fire.r0, fire.r, Math.min(1, fire.t / fire.grow)) : fire.r
    fire.fade = fire.t < fire.life - 1.5 ? Math.min(1, fire.t * 3) : Math.max(0, (fire.life - fire.t) / 1.5)
    if (fire.t >= fire.life) {
      pool.removeAt(index)
      continue
    }
    if (!core.layers.fire) continue
    emitFlames(core, fire, radius, dt)
    emitSmoke(core, fire, radius, dt)
    emitEmber(core, fire, radius, dt)
  }
}
