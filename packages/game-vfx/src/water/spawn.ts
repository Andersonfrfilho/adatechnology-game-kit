import type { RandomStream } from '../random'
import { WATER_GRAVITY } from './motion'
import type { WaterPools } from './records'
import type { WaterBlastPlan, WaterShotPlan, WaterVec3 } from './types'

/** Most bubbles one round leaves under the water. */
const TRAIL_BUBBLES_MAX = 40
/** Seconds the slick of foam a blast leaves on the water lasts. */
const BLAST_FOAM_LIFE = 8
/** Crests of the waves a blast sends out, one after another. */
const BLAST_WAVE_CRESTS = 3
const BLAST_WAVE_GAP = 0.35
const BLAST_WAVE_LIFE = 6
/** Jets thrown around the main column of a blast (the crown of the plume). */
const BLAST_SIDE_JETS = 4

export interface SpawnContext {
  readonly pools: WaterPools
  readonly random: RandomStream
  /** 0..1 share of the particles drawn at this distance from the camera. */
  readonly detail: number
  /** Metres the water goes from (x, z) before the shore, up to `limit`. */
  readonly reach: (x: number, z: number, limit: number) => number
}

type RingSpec = { x: number; y: number; z: number; kind: 0 | 1 | 2; start: number; max: number; life: number; delay: number; strength: number }

export function addRing(context: SpawnContext, spec: RingSpec): void {
  const ring = context.pools.rings.acquire()
  ring.x = spec.x
  ring.y = spec.y
  ring.z = spec.z
  ring.kind = spec.kind
  ring.startRadius = spec.start
  ring.radius = spec.start
  ring.maxRadius = Math.max(spec.start, Math.min(spec.max, context.reach(spec.x, spec.z, spec.max)))
  ring.delay = spec.delay
  ring.age = 0
  ring.life = spec.life
  ring.strength = spec.strength
  ring.alpha = 0
}

function addFoam(context: SpawnContext, at: WaterVec3, radius: number, life: number): void {
  const foam = context.pools.foam.acquire()
  foam.x = at[0]
  foam.y = at[1]
  foam.z = at[2]
  foam.maxRadius = Math.min(radius, Math.max(0.05, context.reach(at[0], at[2], radius)))
  foam.startRadius = foam.maxRadius * 0.35
  foam.radius = foam.startRadius
  foam.age = 0
  foam.life = life
  foam.alpha = 0.85
}

type ColumnSpec = { at: WaterVec3; peak: number; radius: number; tilt: readonly [number, number]; dome: boolean; delay: number; rise?: number }

function addColumn(context: SpawnContext, spec: ColumnSpec): void {
  if (spec.peak < 0.02) return
  const column = context.pools.columns.acquire()
  column.x = spec.at[0]
  column.y = spec.at[1]
  column.z = spec.at[2]
  column.dome = spec.dome
  column.peak = spec.peak
  column.baseRadius = spec.radius
  column.tiltX = spec.tilt[0]
  column.tiltZ = spec.tilt[1]
  // water thrown up slows like a stone: it takes about as long to fall back as it took to rise
  const flight = Math.sqrt((2 * spec.peak) / WATER_GRAVITY)
  column.rise = spec.rise ?? Math.max(0.06, flight * 0.6)
  column.life = column.rise + Math.max(0.2, flight * 1.3) + 0.15
  column.delay = spec.delay
  column.age = 0
  column.height = 0
  column.radius = spec.radius
  column.alpha = 0
}

type DropSpec = { at: WaterVec3; velocity: WaterVec3; size: number; level: number }

function addDrop(context: SpawnContext, spec: DropSpec): void {
  const drop = context.pools.drops.acquire()
  drop.x = spec.at[0]
  drop.y = spec.at[1]
  drop.z = spec.at[2]
  drop.vx = spec.velocity[0]
  drop.vy = spec.velocity[1]
  drop.vz = spec.velocity[2]
  drop.size = spec.size
  drop.level = spec.level
  drop.age = 0
  drop.life = 6
}

function addBubble(context: SpawnContext, at: WaterVec3, level: number, delay: number, size: number): void {
  const { random } = context
  const bubble = context.pools.bubbles.acquire()
  bubble.x = at[0]
  bubble.y = at[1]
  bubble.z = at[2]
  bubble.size = size
  bubble.rise = random.between(0.2, 0.45)
  bubble.delay = delay
  bubble.age = 0
  bubble.life = random.between(0.8, 2.2)
  bubble.level = level
  bubble.alpha = 0
}

/** The splash of one round: its column, its crown of drops, its rings, its foam and its trail of bubbles. */
export function spawnShot(context: SpawnContext, point: WaterVec3, plan: WaterShotPlan): void {
  const { random, detail } = context
  const [x, y, z] = point
  const profile = plan.profile
  addColumn(context, { at: point, peak: plan.columnHeight, radius: plan.columnRadius, tilt: plan.tilt, dome: false, delay: 0 })
  const drops = Math.round(plan.drops * detail)
  const steep = plan.ricochet ? 0.3 : 0.4 + 0.6 * Math.sin((plan.angleDeg * Math.PI) / 180)
  for (let index = 0; index < drops; index++) {
    const angle = random.next() * Math.PI * 2
    const speed = random.between(profile.dropSpeed[0], profile.dropSpeed[1])
    const out = speed * random.between(0.2, 0.55)
    const lean = speed * random.between(0.3, 0.9)
    addDrop(context, {
      at: [x + Math.cos(angle) * plan.columnRadius, y, z + Math.sin(angle) * plan.columnRadius],
      velocity: [Math.cos(angle) * out + plan.tilt[0] * lean, speed * steep * random.between(0.7, 1), Math.sin(angle) * out + plan.tilt[1] * lean],
      size: profile.dropSize * random.between(0.6, 1.4),
      level: y,
    })
  }
  for (let index = 0; index < plan.rings; index++) {
    addRing(context, { x, y, z, kind: 0, start: plan.columnRadius, max: plan.ringRadius * (1 - index * 0.22), life: profile.ringLife * (1 - index * 0.15), delay: index * 0.12, strength: 0.6 })
  }
  // a round that skips off leaves the marks of its slide along the surface
  if (plan.ricochet) {
    for (let step = 1; step <= 2; step++) {
      const sx = x + plan.tilt[0] * 0.3 * step
      const sz = z + plan.tilt[1] * 0.3 * step
      addRing(context, { x: sx, y, z: sz, kind: 0, start: plan.columnRadius, max: plan.ringRadius * 0.6, life: profile.ringLife * 0.8, delay: 0.02 * step, strength: 0.45 })
    }
  }
  addFoam(context, point, plan.foamRadius, profile.foamLife)
  spawnTrail(context, point, plan)
}

function spawnTrail(context: SpawnContext, point: WaterVec3, plan: WaterShotPlan): void {
  if (plan.trailLength <= 0) return
  const { random } = context
  const count = Math.min(TRAIL_BUBBLES_MAX, Math.round(plan.profile.bubblesPerMetre * plan.trailLength * context.detail))
  const [ex, ey, ez] = plan.trailEnd
  for (let index = 0; index < count; index++) {
    // more of them near the surface, where the round was fastest
    const along = random.next() ** 1.6
    const jitter = 0.01 + 0.02 * along
    const at: WaterVec3 = [point[0] + (ex - point[0]) * along + random.between(-jitter, jitter), point[1] + (ey - point[1]) * along, point[2] + (ez - point[2]) * along + random.between(-jitter, jitter)]
    addBubble(context, at, point[1], along * 0.05, random.between(0.003, 0.01))
  }
}

/** A blast in or over the water: columns and dome, shock ring, waves, falling rain of drops, spray, a slick of foam, the boil under. */
export function spawnBlast(context: SpawnContext, point: WaterVec3, level: number, plan: WaterBlastPlan): void {
  const { random, detail } = context
  const surface: WaterVec3 = [point[0], level, point[2]]
  const scale = Math.cbrt(plan.tnt)
  addColumn(context, { at: surface, peak: plan.columnHeight, radius: plan.columnRadius, tilt: [0, 0], dome: false, delay: plan.domeRadius > 0 ? 0.08 : 0 })
  for (let index = 0; index < BLAST_SIDE_JETS && plan.columnHeight > 0; index++) {
    const angle = (index / BLAST_SIDE_JETS) * Math.PI * 2 + random.next()
    const off = plan.columnRadius * random.between(0.6, 1.1)
    const lean = random.between(0.1, 0.25)
    addColumn(context, { at: [surface[0] + Math.cos(angle) * off, level, surface[2] + Math.sin(angle) * off], peak: plan.columnHeight * random.between(0.45, 0.75), radius: plan.columnRadius * 0.45, tilt: [Math.cos(angle) * lean, Math.sin(angle) * lean], dome: false, delay: 0.05 + random.next() * 0.08 })
  }
  if (plan.domeRadius > 0) addColumn(context, { at: surface, peak: plan.domeHeight, radius: plan.domeRadius, tilt: [0, 0], dome: true, delay: 0, rise: 0.25 })
  addRing(context, { x: surface[0], y: level, z: surface[2], kind: 1, start: 0.2, max: plan.shockRadius, life: 0.45, delay: 0, strength: 0.95 })
  spawnWaves(context, surface, plan)
  spawnRain(context, surface, plan, detail)
  spawnSpray(context, surface, plan, scale)
  addFoam(context, surface, plan.foamRadius, BLAST_FOAM_LIFE)
  const bubbles = Math.round(plan.bubbles * detail)
  for (let index = 0; index < bubbles; index++) {
    const at: WaterVec3 = [point[0] + random.between(-0.5, 0.5) * scale, Math.min(level - 0.02, point[1] + random.between(-0.2, 0.3) * scale), point[2] + random.between(-0.5, 0.5) * scale]
    addBubble(context, at, level, random.next() * 1.2, random.between(0.01, 0.04) * Math.max(1, scale))
  }
}

function spawnWaves(context: SpawnContext, surface: WaterVec3, plan: WaterBlastPlan): void {
  if (plan.waveAmplitude <= 0) return
  const reach = context.reach(surface[0], surface[2], plan.waveSpeed * BLAST_WAVE_LIFE)
  for (let crest = 0; crest < BLAST_WAVE_CRESTS; crest++) {
    const wave = context.pools.waves.acquire()
    wave.x = surface[0]
    wave.z = surface[2]
    wave.speed = plan.waveSpeed
    wave.amplitude = plan.waveAmplitude * (1 - crest * 0.3)
    wave.width = 0.25 + 0.3 * Math.cbrt(plan.tnt)
    wave.reach = reach
    wave.delay = crest * BLAST_WAVE_GAP
    wave.age = 0
    wave.life = BLAST_WAVE_LIFE
    addRing(context, { x: surface[0], y: surface[1], z: surface[2], kind: 2, start: 0.1, max: plan.waveSpeed * BLAST_WAVE_LIFE, life: BLAST_WAVE_LIFE, delay: wave.delay, strength: 0.5 * (1 - crest * 0.3) })
  }
}

function spawnRain(context: SpawnContext, surface: WaterVec3, plan: WaterBlastPlan, detail: number): void {
  const { random } = context
  const drops = Math.round(plan.drops * detail)
  const top = Math.max(0.5, plan.columnHeight)
  const launch = Math.sqrt(2 * WATER_GRAVITY * top)
  const scale = Math.cbrt(plan.tnt)
  for (let index = 0; index < drops; index++) {
    const angle = random.next() * Math.PI * 2
    const out = random.between(0.4, 3) * scale
    const r = random.next() * plan.columnRadius
    addDrop(context, {
      at: [surface[0] + Math.cos(angle) * r, surface[1] + random.next() * top * 0.2, surface[2] + Math.sin(angle) * r],
      velocity: [Math.cos(angle) * out, launch * random.between(0.45, 1.02), Math.sin(angle) * out],
      size: random.between(0.012, 0.035),
      level: surface[1],
    })
  }
}

function spawnSpray(context: SpawnContext, surface: WaterVec3, plan: WaterBlastPlan, scale: number): void {
  const { random } = context
  const top = Math.max(0.4, plan.columnHeight)
  for (let index = 0; index < plan.mist; index++) {
    const mist = context.pools.mist.acquire()
    const angle = random.next() * Math.PI * 2
    const r = random.next() * (plan.columnRadius + 0.5 * scale)
    mist.x = surface[0] + Math.cos(angle) * r
    mist.y = surface[1] + random.next() * top * 0.6
    mist.z = surface[2] + Math.sin(angle) * r
    const out = random.between(0.5, 1.8) * scale
    mist.vx = Math.cos(angle) * out
    mist.vy = random.between(0.3, 1)
    mist.vz = Math.sin(angle) * out
    mist.size = random.between(0.4, 1.2) * scale
    mist.age = 0
    mist.life = random.between(2.5, 4.5)
    mist.alpha = 0
  }
}
