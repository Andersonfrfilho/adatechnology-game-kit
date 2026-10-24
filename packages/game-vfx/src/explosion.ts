import { hexToLinearRgb, hexToRgb } from './color'
import { SMOKE_COLORS } from './constants'
import type { VfxCore } from './core'
import { lightBlast } from './lights'
import { lodScale } from './lod'
import { addCrater, addScorch } from './marks'
import { spawnRing } from './pools/rings'
import { spawnShock } from './pools/shocks'
import type { RandomStream, MutableVec3 } from './random'
import { addFire } from './emitters/fire'
import { addChunk, addGlow, addPuff, addSpark } from './spawn'
import type { ExplosionDef, MushroomSpec } from './types'
import { addScaled, createVec3, distanceBetween, normalize } from './vector'

/** Where and how one explosion goes off. */
export interface ExplosionCall {
  readonly x: number
  readonly y: number
  readonly z: number
  /** Where it is aimed (a rocket's direction, a charge's face). */
  readonly direction?: MutableVec3
  /** The stream the whole effect draws from: the world's in `shared` mode, the event's own in `per_event`. */
  readonly random: RandomStream
  readonly handle: number
}

interface Context {
  readonly core: VfxCore
  readonly def: ExplosionDef
  readonly call: ExplosionCall
  readonly random: RandomStream
  readonly x: number
  readonly y: number
  readonly z: number
  /** Fireball radius. */
  readonly size: number
  /** LOD scale of this explosion. */
  readonly scale: number
  readonly direction: MutableVec3 | undefined
  readonly smokeColor: readonly [number, number, number]
  /** Where the camera is (for the screen flash), distance to the blast. */
  readonly cameraDistance: number
}

const DEFAULT_LIGHT = 40
const DEFAULT_LIGHT_LIFE = 0.45
const DEFAULT_LIGHT_COLOR = 0xffa050
const DEFAULT_FLASH_INTENSITY = 6
const DEFAULT_SHOCK_DURATION = 0.32
const DEFAULT_CHUNK_COLOR = 0x47423d
const ROCK_COLORS = [0x2b2c2f, 0x4a3a2c] as const
const SCRATCH = createVec3()

function pick<T>(random: RandomStream, items: readonly T[]): T {
  return items[Math.floor(random.next() * items.length)]!
}

function composeFlash(context: Context): void {
  const { core, def, x, y, z, size } = context
  if (!core.layers.flash) return
  const flash = def.flash
  const light = { x, y: y + size * 0.6, z, peak: (flash.light || DEFAULT_LIGHT) * 0.7, distance: (def.injury || 10) * 2.4, life: flash.life || DEFAULT_LIGHT_LIFE, color: flash.color || DEFAULT_LIGHT_COLOR }
  core.trace?.light?.(light)
  lightBlast(core.lights, light)
  core.spawned.lights++
  const blinding = flash.blinding === true
  addGlow(core, { x, y: y + size * 0.4, z, s: size * 1.4, s1: size * 3.2, i: flash.intensity || DEFAULT_FLASH_INTENSITY, life: 0.22, color: [1, 0.92, 0.75], curve: 2.5 })
  if (!blinding) addGlow(core, { x, y: y + size * 0.5, z, s: size * 2.2, s1: size * 3.6, i: 2.2, life: def.fuel ? 1.4 : 0.6, color: [1, 0.45, 0.15], curve: 1.6 })
  if (core.reducedMotion) return
  const distance = context.cameraDistance
  const screen = core.screen
  if (distance < 15) {
    screen.flash = Math.max(screen.flash, (blinding ? 1 : 0.32) * (1 - distance / 15))
    screen.flashDecay = blinding ? 0.55 : 7
  }
  if (blinding && distance < 40) {
    screen.flash = Math.max(screen.flash, 1)
    screen.flashDecay = 0.5
  }
}

function composeFireballs(context: Context): void {
  const { core, def, random, x, y, z, size, scale, direction } = context
  if (!core.layers.fire || !def.fireballs) return
  const count = Math.round(def.fireballs * Math.max(scale, 0.35))
  const fuel = def.fuel === true
  const heat = def.heat ?? 1
  for (let index = 0; index < count; index++) {
    const d = random.direction(SCRATCH)
    d.y = fuel ? Math.abs(d.y) * 0.5 + 0.05 : Math.abs(d.y) * 0.8 + 0.1
    if (direction) normalize(addScaled(d, direction, def.directionBias ?? 1.2))
    const speed = size * random.between(4.5, 7.5) * (fuel ? 0.75 : 1)
    const s1 = size * random.between(0.42, 0.62)
    const sg = size * random.between(0.12, 0.22)
    const life = random.between(def.smoke.life * 0.7, def.smoke.life)
    const h0 = random.between(1.05, 1.35) * heat
    const hl = fuel ? random.between(0.8, 1.4) * (def.heatLifeScale ?? 1) : random.between(0.22, 0.42)
    addPuff(core, random, {
      x: x + d.x * size * 0.15, y: y + size * 0.25 + d.y * size * 0.1, z: z + d.z * size * 0.15,
      vx: d.x * speed, vy: d.y * speed + (fuel ? size * 1.4 : size * 0.6), vz: d.z * speed,
      s0: size * 0.22, s1, sg, gk: 9, life, h0, hl, drag: fuel ? 4.2 : 6.5, buoy: fuel ? 2.2 : 1.2, color: context.smokeColor, kind: 0,
    })
  }
}

function composeSmoke(context: Context): void {
  const { core, def, random, x, y, z, size, scale } = context
  if (!core.layers.smoke || !def.smoke.count) return
  const count = Math.round(def.smoke.count * Math.max(scale, 0.3))
  for (let index = 0; index < count; index++) {
    const d = random.direction(SCRATCH)
    d.y = Math.abs(d.y)
    const vy = size * random.between(0.6, 2.2)
    const s1 = size * random.between(0.55, 0.85)
    const sg = size * random.between(0.18, 0.3)
    const life = random.between(def.smoke.life * 0.7, def.smoke.life * 1.1)
    addPuff(core, random, {
      x: x + d.x * size * 0.6, y: y + size * 0.4 + d.y * size * 0.5, z: z + d.z * size * 0.6,
      vx: d.x * size * 2.4, vy, vz: d.z * size * 2.4, s0: size * 0.25, s1, sg, gk: 4, life, h0: 0.32, hl: 0.25, drag: 3, buoy: 0.45, color: context.smokeColor, kind: def.smoke.kind ?? 0,
    })
  }
}

function composeShock(context: Context): void {
  const { core, def, x, y, z, size, scale } = context
  if (!core.layers.shock || def.shock === false || !(scale > 0.15)) return
  const duration = def.shock ? def.shock.duration : DEFAULT_SHOCK_DURATION
  const spec = { x, y: y + size * 0.3, z, shellRadius: def.lethal * 0.9, groundRadius: def.injury * 0.6, duration }
  core.trace?.shock?.(spec)
  spawnShock(core.shocks, spec)
}

function composeDust(context: Context): void {
  const { core, def, random, x, z, size, scale } = context
  if (!core.layers.smoke || !def.dust.count || !(scale > 0.15)) return
  const count = Math.round(def.dust.count * scale)
  const color = hexToLinearRgb(def.dust.color)
  const cone = def.cone
  for (let index = 0; index < count; index++) {
    let angle = random.next() * Math.PI * 2
    if (cone) angle = coneAngle(context) + random.between(-cone.half, cone.half)
    const speed = random.between(0.6, 1) * def.injury * (cone ? 1.6 : 0.9)
    const vy = random.between(0.2, 1.2)
    const s1 = size * random.between(0.5, 0.8)
    const sg = size * random.between(0.2, 0.35)
    const life = random.between(2.2, 4)
    addPuff(core, random, {
      x: x + Math.cos(angle) * 0.3, y: 0.15, z: z + Math.sin(angle) * 0.3,
      vx: Math.cos(angle) * speed, vy, vz: Math.sin(angle) * speed, s0: size * 0.2, s1, sg, gk: 5, life, drag: 3.6, buoy: 0.2, color, kind: 1,
    })
  }
}

/** The angle of the cone's axis: the direction it is aimed at, else the one in its profile. */
function coneAngle(context: Context): number {
  const cone = context.def.cone
  if (!cone) return 0
  return context.direction ? Math.atan2(context.direction.z, context.direction.x) : cone.angle
}

function sparkDirection(context: Context): MutableVec3 {
  const { def, random, direction } = context
  const cone = def.cone
  if (cone) {
    const angle = coneAngle(context) + random.between(-cone.half, cone.half)
    SCRATCH.x = Math.cos(angle)
    SCRATCH.y = random.between(-0.05, 0.25)
    SCRATCH.z = Math.sin(angle)
    return SCRATCH
  }
  const d = random.direction(SCRATCH)
  d.y = Math.abs(d.y) * 0.9 + 0.05
  if (direction) normalize(addScaled(d, direction, def.directionBias ?? 1))
  return d
}

function composeEmbers(context: Context): void {
  const { core, def, random, x, y, z, size, scale } = context
  const embers = def.shrapnel.embers
  if (!embers) return
  for (let index = 0; index < embers * scale; index++) {
    const d = random.direction(SCRATCH)
    d.y = Math.abs(d.y)
    const vx = d.x * random.between(2, 6)
    const vy = random.between(3, 8)
    const vz = d.z * random.between(2, 6)
    addSpark(core, { x, y: y + size * 0.5, z, vx, vy, vz, life: random.between(1.2, 2.6), w: 0.04, st: 0.02, kind: 4, drag: 1.6, g: 2.5 })
  }
}

function composeShrapnel(context: Context): void {
  const { core, def, random, x, y, z, size, scale } = context
  if (!core.layers.shrapnel || !def.shrapnel.count) return
  const count = Math.round(def.shrapnel.count * scale)
  for (let index = 0; index < count; index++) {
    const d = sparkDirection(context)
    const speed = def.shrapnel.speed * random.between(0.45, 1)
    addSpark(core, {
      x: x + d.x * 0.1, y: y + size * 0.25, z: z + d.z * 0.1, vx: d.x * speed, vy: d.y * speed, vz: d.z * speed,
      life: random.between(0.35, 1.1), w: def.shrapnel.width ?? 0.035, st: 0.03, kind: def.shrapnel.kind, drag: def.shrapnel.kind === 1 ? 0.15 : 0.9,
    })
  }
  composeEmbers(context)
}

function composeDebris(context: Context): void {
  const { core, def, random, x, y, z, scale, direction } = context
  const chunks = def.chunks
  if (!core.layers.shrapnel || !chunks.count || scale < 0.5) return
  const count = Math.round(chunks.count * (scale >= 1 ? 1 : 0.5))
  for (let index = 0; index < count; index++) {
    const d = random.direction(SCRATCH)
    d.y = Math.abs(d.y) * 0.9 + 0.2
    if (direction) normalize(addScaled(d, direction, 0.8))
    const speed = random.between(4, 11) * (chunks.speed ?? 1)
    const s = random.between(0.07, 0.2) * (chunks.size ?? 1)
    const plate = chunks.plate ? random.next() < 0.6 : random.next() < 0.15
    const sy = plate ? s * 0.3 : s * random.between(0.6, 1)
    const color = hexToRgb(chunks.colors.length > 0 ? pick(random, chunks.colors) : DEFAULT_CHUNK_COLOR)
    const hot = random.next() < chunks.hot
    addChunk(core, random, {
      x: x + d.x * 0.2, y: y + 0.2, z: z + d.z * 0.2, vx: d.x * speed, vy: d.y * speed + 2, vz: d.z * speed,
      sx: plate ? s * 1.6 : s, sy, sz: plate ? s * 1.1 : s, color, plate, hot,
    })
  }
}

function composeRimDebris(context: Context): void {
  const { core, random, x, z } = context
  const radius = context.def.mark.crater ?? 0
  if (!core.layers.shrapnel) return
  const speedScale = context.def.chunks.speed ?? 1
  const count = Math.round(4 + radius * 4)
  for (let index = 0; index < count; index++) {
    const angle = random.next() * Math.PI * 2
    const speed = random.between(3, 8) * speedScale
    const s = random.between(0.12, 0.28)
    const vy = random.between(4, 10)
    const color = hexToRgb(random.next() < 0.6 ? ROCK_COLORS[0] : ROCK_COLORS[1])
    addChunk(core, random, {
      x: x + Math.cos(angle) * 0.3, y: 0.1, z: z + Math.sin(angle) * 0.3, vx: Math.cos(angle) * speed * 0.6, vy, vz: Math.sin(angle) * speed * 0.6,
      sx: s * 1.6, sy: s * 0.35, sz: s * 1.2, color, plate: true,
    })
  }
}

function composeMushroom(context: Context, spec: MushroomSpec): void {
  const { core, random, x, y, z } = context
  core.trace?.mushroom?.(x, y, z, spec)
  const color = spec.color !== undefined ? hexToLinearRgb(spec.color) : SMOKE_COLORS.black
  const ring = spawnRing(core.rings, {
    x, z, y0: y + spec.height * 0.15, rise: spec.height, rk: spec.riseRate ?? 0.55, R0: spec.radius * 0.3, R1: spec.radius, r: spec.radius * 0.42, roll: spec.roll ?? 2.4, life: spec.life || 7,
  })
  const lod = core.clock.lod
  const count = Math.round((spec.count || 40) * Math.max(lod, 0.4))
  for (let index = 0; index < count; index++) {
    const s1 = spec.radius * random.between(0.35, 0.5)
    const life = random.between(ring.life * 0.75, ring.life)
    const h0 = random.between(1, 1.25)
    const hl = random.between(0.9, 1.6)
    const puff = addPuff(core, random, { x, y, z, s0: spec.radius * 0.2, s1, sg: spec.radius * 0.06, gk: 3, life, h0, hl, color, kind: 0 })
    puff.ring = ring
    puff.ph = random.next() * Math.PI * 2
    puff.th = random.next() * Math.PI * 2
  }
  const stemCount = Math.round((spec.stem || 18) * Math.max(lod, 0.4))
  for (let index = 0; index < stemCount; index++) {
    const spread = random.next() * 0.6
    const px = x + random.between(-0.4, 0.4) * spec.radius * 0.2
    const pz = z + random.between(-0.4, 0.4) * spec.radius * 0.2
    const vx = random.between(-0.3, 0.3)
    const vy = spec.height * random.between(0.6, 1.4) * (1 - spread)
    const vz = random.between(-0.3, 0.3)
    const s1 = spec.radius * random.between(0.22, 0.32)
    const life = random.between(3, 5)
    const h0 = random.between(0.9, 1.2)
    const hl = random.between(0.6, 1.1)
    addPuff(core, random, { x: px, y: y + 0.3, z: pz, vx, vy, vz, s0: spec.radius * 0.12, s1, sg: spec.radius * 0.05, gk: 4, life, h0, hl, drag: 1.2, buoy: 0.5, color })
  }
}

function composeAfterEffects(context: Context): void {
  const { core, def, random, x, y, z } = context
  const mark = def.mark
  if (mark.crater && mark.dent && y < 1.2) {
    core.emit({ type: 'crater', x, z, radius: mark.crater, depth: mark.dent })
    core.trace?.crater?.(x, z, mark.crater, mark.dent)
    addCrater(core.marks, core.ground, random, { x, z, radius: mark.crater, depth: mark.dent, marks: core.layers.mark })
    if (core.layers.shrapnel) composeRimDebris(context)
  }
  if (mark.scorch && y < 1.2 && core.layers.mark) {
    core.trace?.scorch?.(x, z, mark.scorch)
    addScorch(core.marks, random, x, z, mark.scorch)
  }
  if (def.mushroom && core.layers.fire) composeMushroom(context, def.mushroom)
  if (def.residualFires && core.layers.fire) {
    for (const fire of def.residualFires) {
      addFire(core, random, {
        x: x + (fire.dx ?? 0), y: 0, z: z + (fire.dz ?? 0), r: fire.radius, life: fire.life, rate: fire.rate, smoke: fire.smoke, startRadius: fire.startRadius, grow: fire.grow,
        color: fire.smokeColor !== undefined ? hexToLinearRgb(fire.smokeColor) : undefined,
      }, context.call.handle)
    }
  }
}

function emitRequests(context: Context): void {
  const { core, def, x, y, z } = context
  const point = [x, y, z] as const
  core.emit({
    type: 'blast_front', explosion: def.id, point, glassRadius: Math.min(def.injury, 20) * 0.85, speed: 340, lethal: def.lethal, injury: def.injury, push: def.push,
    hotParts: def.hotParts === true, blinding: def.flash.blinding === true, cone: def.cone ? { angle: coneAngle(context), half: def.cone.half, length: def.cone.length } : undefined,
  })
  if (def.ignite) core.emit({ type: 'ignite', point, radius: def.ignite })
}

/**
 * The Lab's layer compositor (`blast`, L642-714), layer by layer in the Lab's order and drawing from the stream in the Lab's order: flash, fireball,
 * its own smoke, shock wave, dust, shrapnel, debris, then marks, mushroom and lingering fires, and last what the host does (glass, characters).
 */
export function composeExplosion(core: VfxCore, def: ExplosionDef, call: ExplosionCall): number {
  const cameraDistance = distanceBetween(core.camera.x, core.camera.y, core.camera.z, call.x, call.y, call.z)
  const forced = core.clock.forcedLod
  const bandScale = forced ?? lodScale(core.bands, cameraDistance, def.visualRadius)
  const capScale = core.areaCap ? core.areaCap.register(core.clock.time, call.x, call.z) : 1
  const scale = forced ?? bandScale * capScale
  core.clock.lod = scale
  core.clock.lastBlast = core.clock.time
  core.spawned.puffs = core.spawned.sparks = core.spawned.chunks = core.spawned.lights = 0
  const context: Context = {
    core, def, call, random: call.random, x: call.x, y: call.y, z: call.z, size: def.visualRadius, scale, direction: call.direction,
    smokeColor: hexToLinearRgb(def.smoke.color), cameraDistance,
  }
  composeFlash(context)
  core.screen.shake = Math.max(core.screen.shake, (def.shake || 1) / (1 + cameraDistance * 0.12))
  composeFireballs(context)
  composeSmoke(context)
  composeShock(context)
  composeDust(context)
  composeShrapnel(context)
  composeDebris(context)
  composeAfterEffects(context)
  emitRequests(context)
  return scale
}
