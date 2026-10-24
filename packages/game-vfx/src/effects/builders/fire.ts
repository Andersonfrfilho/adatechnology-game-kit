import type { WorkshopEngine } from '../../workshop/engine'
import type { SpriteSpawn, Vec3Tuple } from '../../workshop/types'
import { normalized, plus } from '../vector-math'

const UP: Vec3Tuple = [0, 1, 0]
const ZERO: Vec3Tuple = [0, 0, 0]
const FULL_TURN_DRAWN = 6.283

export interface FireEmitOptions {
  readonly wind?: Vec3Tuple
  readonly dir?: Vec3Tuple
  readonly smoke?: number
  readonly smokeColor?: number
  readonly smokeAlpha?: number
  readonly noSmoke?: boolean
}

function scaledSizes(range: readonly [number, number], factor: number): readonly [number, number] {
  return [range[0] * Math.sqrt(factor), range[1] * Math.sqrt(factor)]
}

/** `fireEmit` (W399-405): flames, a hot core, embers and smoke for one frame, from a point and a radius, scaled by `factor`. */
export function fireEmit(engine: WorkshopEngine, key: string, dt: number, centre: Vec3Tuple, radius: number, factor: number, options: FireEmitOptions = {}): void {
  const wind = options.wind ?? ZERO
  const sqrtFactor = Math.sqrt(factor)
  engine.emit(`${key}f`, 'add', 90 * factor, dt, () => ({
    p: centre, r: radius, flat: true, dir: options.dir ?? UP, cone: 0.35, sp: [0.4, 1.4], v: wind, life: [0.35, 0.85], size: scaledSizes([0.22, 0.5], factor), grow: 0.35, c0: 0xffd27a, c1: 0x8a1a05, a: 0.85, fi: 0.15, g: -2.2,
  }))
  engine.emit(`${key}c`, 'add', 30 * factor, dt, () => ({
    p: centre, r: radius * 0.6, flat: true, dir: UP, cone: 0.3, sp: [0.3, 0.8], life: [0.2, 0.4], size: scaledSizes([0.25, 0.4], factor), grow: 0.6, c0: 0xfff2c0, c1: 0xff8a20, a: 0.8, fi: 0.1, g: -1,
  }))
  if (engine.quality < 2) {
    engine.emit(`${key}e`, 'streak', 10 * factor, dt, () => {
      const jitter = plus(wind, engine.random.between(-0.4, 0.4), 0, engine.random.between(-0.4, 0.4))
      return { p: centre, box: [radius, 0, radius], dir: UP, cone: 0.5, sp: [1.5, 3.5], v: jitter, life: [0.8, 1.8], len: 0.03, c0: 0xffb050, c1: 0x601000, g: -0.6, drag: 0.4 }
    })
  }
  if (options.noSmoke) return
  engine.emit(`${key}s`, 'normal', (options.smoke || 14) * factor, dt, () => ({
    p: plus(centre, 0, 0.8 * sqrtFactor, 0), r: radius * 0.7, dir: UP, cone: 0.35, sp: [0.6, 1.4], v: wind, drag: 0.15, life: [2.5, 4.5], size: scaledSizes([0.4, 0.8], factor), grow: 4, c0: options.smokeColor || 0x2a2522, c1: 0x121318, a: options.smokeAlpha || 0.42, fi: 0.2, g: -0.25,
  }))
}

function ringOfDust(engine: WorkshopEngine, point: Vec3Tuple, scale: number): void {
  for (let index = 0; index < engine.scaled(44); index++) {
    const angle = engine.random.next() * FULL_TURN_DRAWN
    const spec: SpriteSpawn = {
      p: plus(point, Math.cos(angle) * 0.5, 0.15, Math.sin(angle) * 0.5), dir: [Math.cos(angle), 0.08, Math.sin(angle)], cone: 0.15, sp: [4, 9 * scale], drag: 2.4, life: [1.4, 2.6], size: [0.5, 0.9], grow: 4, c0: 0x5d574d, c1: 0x2a2724, a: 0.5, fi: 0.1,
    }
    engine.spawn('normal', spec)
  }
}

/** `explode` (W406-416): the Workshop's blast, scaled by `scale`, that the Lab's profiles later replaced. `cameraPosition` turns the second ring to face the viewer. */
export function explode(engine: WorkshopEngine, point: Vec3Tuple, scale: number, cameraPosition: Vec3Tuple, chipColor?: number): void {
  engine.flash([plus(point, 0, 1, 0), 0xffa040, 14 * scale, 0.5, 30, 'boom'])
  engine.screen.shake += 0.7 * scale
  engine.screen.white += 0.18 * scale
  engine.burst('add', 55 * scale, { p: point, r: 0.3 * scale, sp: [2, 7 * scale], drag: 4, life: [0.25, 0.6], size: [0.7 * scale, 1.4 * scale], grow: 1.7, c0: 0xfff0b0, c1: 0x9a2a08, fi: 0.04 })
  engine.burst('add', 28 * scale, { p: plus(point, 0, 0.3, 0), r: 0.3, dir: UP, cone: 0.7, sp: [2, 5 * scale], drag: 1.5, life: [0.6, 1.1], size: [0.6 * scale, 1 * scale], grow: 1.3, c0: 0xffc060, c1: 0x5a1205, g: -2, fi: 0.05 })
  engine.ring([plus(point, 0, 0.05, 0), 0.3, 7 * scale, 0.55, 0xffd8a0])
  const toCamera = normalized([cameraPosition[0] - point[0], cameraPosition[1] - point[1], cameraPosition[2] - point[2]])
  engine.ring([plus(point, 0, 1, 0), 0.3, 5 * scale, 0.35, 0xfff0d0, toCamera])
  engine.burst('normal', 32 * scale, { p: plus(point, 0, 0.6, 0), r: 0.8 * scale, dir: UP, cone: 1.1, sp: [1, 3], drag: 1.2, life: [3, 6], size: [1 * scale, 1.8 * scale], grow: 2.6, c0: 0x2b2724, c1: 0x0f1013, a: 0.6, fi: 0.18, g: -0.35 })
  ringOfDust(engine, point, scale)
  if (engine.quality < 2) engine.burst('streak', 44 * scale, { p: point, dir: UP, cone: 1.45, sp: [10, 26], life: [0.3, 0.7], len: 0.03, c0: 0xffc070, c1: 0x802000, g: 9.8, gnd: 2 })
  for (let index = 0; index < engine.scaled(16 * scale); index++) {
    engine.debrisPiece({ p: point, dir: UP, cone: 1.2, sp: [3, 9], size: [0.12, 0.06, 0.1], k: [0.6, 1.6], c: chipColor || 0x2a2622, life: 9 })
  }
  engine.decal([point[0], engine.context.groundAt(point[0], point[2]), point[2], 3 * scale, 0x0a0a0a, { grow: 0.15, life: 60 }])
}
