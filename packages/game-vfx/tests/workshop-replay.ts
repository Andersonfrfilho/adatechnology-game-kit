import { createSeededRandom, hashText } from '@adatechnology/golden-tool'

import { EffectRunner } from '../src/effects/runner'
import type { EffectRunnerOptions } from '../src/effects/runner'
import type { EffectDef } from '../src/effects/types'
import type { RandomStream } from '../src/random'
import { WorkshopEngine } from '../src/workshop/engine'
import type { TraceKind } from '../src/workshop/types'

export const FRAME_MS = 1000 / 60
export const INSTANT_FRAMES = [6, 30, 60, 120] as const
const DEFAULT_SECONDS = 6
const MAX_SPAWNS = 300
const MAX_FRAME_SECONDS = 0.05

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0

/** The page's `clean` (capture `vfx-workshop.js`): numbers to 4 decimals, vectors as arrays, in the order the keys were written. */
export function clean(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return round4(value)
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((entry) => clean(entry) ?? null)
  return Object.fromEntries(Object.entries(value as object).map(([key, entry]) => [key, clean(entry)]))
}

/** A stream the golden can count: `Math.random` of the page, seeded per effect and option, plus how many draws were taken. */
export function createCountedStream(): RandomStream & { reseed(seed: number): void; calls: number } {
  let source = createSeededRandom(1)
  const stream = {
    calls: 0,
    reseed(seed: number) {
      source = createSeededRandom(seed)
      stream.calls = 0
    },
    next() {
      stream.calls++
      return source()
    },
    between(min: number, max: number) {
      return min + (max - min) * stream.next()
    },
    direction() {
      throw new Error('the Workshop never draws a direction this way')
    },
    state: 0,
  }
  return stream as unknown as RandomStream & { reseed(seed: number): void; calls: number }
}

const hashArray = (array: ArrayLike<number>, count: number): string => hashText(Array.from({ length: count }, (_, index) => round4(array[index]!)).join(','))
const hashStrided = (parts: readonly (readonly [string, ArrayLike<number>, number])[], count: number): string => hashText(parts.map(([name, array, stride]) => `${name}:${hashArray(array, count * stride)}`).join('|'))

export interface WorkshopInstant {
  readonly counts: string
  readonly add: string
  readonly normal: string
  readonly streak: string
  readonly debris: string
  readonly decals: string
  readonly screen: string
}

export interface WorkshopRun {
  readonly spawns: readonly string[]
  readonly frames: string
  readonly instants: ReadonlyMap<number, WorkshopInstant>
}

/** Runs the effects one after the other in one engine, as the capture did (the camera and the clock carry over from one run to the next). */
export function createWorkshopReplay(effects: Readonly<Record<string, EffectDef>>, extra: Pick<EffectRunnerOptions, 'behaviors'> = {}) {
  const random = createCountedStream()
  let frame = 0
  let spawns: string[] = []
  let recording = false
  const trace = (kind: TraceKind, args: readonly unknown[]): void => {
    if (recording && spawns.length < MAX_SPAWNS) spawns.push(`${frame} ${kind} ${random.calls} ${JSON.stringify(clean(args))}`)
  }
  const engine = new WorkshopEngine({ random, trace })
  const runner = new EffectRunner({ engine, effects, ...extra })
  let elapsedMs = 0

  const counts = (): string => [engine.add.count, engine.normal.count, engine.streaks.count, engine.debris.pieces.filter((piece) => piece.on).length, engine.decals.decals.filter((decal) => decal.on).length, engine.rings.rings.filter((ring) => ring.on).length, engine.lights.lit].join('.')
  const instant = (): WorkshopInstant => {
    const { add, normal, streaks } = engine
    const sprite = (pool: typeof add): string => hashStrided([['pos', pool.position, 3], ['vel', pool.velocity, 3], ['c0', pool.colorStart, 3], ['c1', pool.colorEnd, 3], ['life', pool.life, 1], ['max', pool.maxLife, 1], ['s0', pool.startSize, 1], ['gr', pool.growth, 1], ['a0', pool.startAlpha, 1], ['g', pool.gravity, 1], ['dr', pool.drag, 1], ['fi', pool.fadeIn, 1], ['ds', pool.decalSize, 1]], pool.count)
    const screen = engine.screen
    return {
      counts: counts().replaceAll('.', '/'),
      add: sprite(add),
      normal: sprite(normal),
      streak: hashStrided([['p', streaks.point, 3], ['v', streaks.velocity, 3], ['life', streaks.life, 1], ['len', streaks.length, 1]], streaks.count),
      debris: hashText(engine.debris.pieces.filter((piece) => piece.on).map((piece) => [piece.x, piece.y, piece.z, piece.sx, piece.life, piece.rest ? 1 : 0].map(round4).join(',')).join('|')),
      decals: hashText(engine.decals.decals.filter((decal) => decal.on).map((decal) => [decal.x, decal.y, decal.z, decal.sx, decal.sy, decal.t, decal.life].map(round4).join(',')).join('|')),
      screen: [screen.shake, screen.white, screen.red, screen.directionLeft, screen.directionRight, screen.chroma, screen.desat, screen.gas, screen.beat].map(round4).join(' '),
    }
  }

  return {
    engine,
    runner,
    run(id: string, option: number): WorkshopRun {
      const def = Object.values(effects).find((effect) => effect.pageId === id)!
      random.reseed(parseInt(hashText(`${id}:${option}`), 16))
      frame = 0
      spawns = []
      // the capture clears its log after `select`: whatever the start itself spawns is in the pools, not in the list
      recording = false
      runner.start(def.id, option)
      recording = true
      const seconds = def.loop && def.loop > 0 ? def.loop : DEFAULT_SECONDS
      const total = Math.round(seconds * 60) - 1
      const timeline: string[] = []
      const instants = new Map<number, WorkshopInstant>()
      for (frame = 1; frame <= total; frame++) {
        const previous = elapsedMs
        elapsedMs += FRAME_MS
        runner.update(Math.min(MAX_FRAME_SECONDS, (elapsedMs - previous) / 1000))
        timeline.push(counts())
        if ((INSTANT_FRAMES as readonly number[]).includes(frame)) instants.set(round4(frame / 60), instant())
      }
      instants.set(round4(total / 60), instant())
      return { spawns, frames: timeline.join(' '), instants }
    },
  }
}
