import { lehmer } from '../random'
import type { RandomStream } from '../random'
import type { Follow } from '../types'
import type { Placement, WorkshopEngine } from '../workshop/engine'
import type { Vec3Tuple } from '../workshop/types'
import type { Behavior } from './behavior'
import { WORKSHOP_BEHAVIORS } from './behaviors'
import { EffectInstance } from './instance'
import type { EffectView } from './instance'
import type { CueRequest, EffectDef } from './types'

const ORIGIN: Vec3Tuple = [0, 0, 0]
const DEFAULT_HEADING: Vec3Tuple = [0, 0, -1]
const DEFAULT_MAX_INSTANCES = 48
/** A recipe with no end of its own (`loop: 0`: a campfire, a fire in a building) plays this long unless it is stopped. */
const ENDLESS_SECONDS = 60

export interface PlayOptions {
  /** Which way the effect points in the world (the muzzle's barrel, the spray of a jet). */
  readonly direction?: Vec3Tuple
  /** Which way the thing it belongs to is turned, as a unit quaternion `[x, y, z, w]`: the effect is placed with this turn, pitch and roll included, in place of the turn about the vertical axis `direction` gives. */
  readonly orientation?: readonly [number, number, number, number]
  /** The surface it hit. */
  readonly normal?: Vec3Tuple
  /** Repeats the same visual: a LAN client draws the same numbers from the same seed. */
  readonly seed?: number
  /** The recipe's parameter (age, material, weapon...). */
  readonly param?: number | string
  /** Named numbers the recipe reads with `variable(name)` (a size, a length of time): set before its `setup` runs, and again whenever its loop starts over. */
  readonly values?: Readonly<Record<string, number>>
  /** Moves with a thing: the effect sits at its position plus the point it was played at. */
  readonly follow?: Follow
  /** Stops after this many seconds (default: the recipe's loop). */
  readonly seconds?: number
}

export interface EffectPlayerOptions {
  readonly engine: WorkshopEngine
  readonly effects: Readonly<Record<string, EffectDef>>
  readonly behaviors?: Readonly<Record<string, () => Behavior>>
  /** Where the viewer is, for the recipes that read it. */
  readonly view: EffectView
  /** A stream for a seed (default `lehmer`). */
  readonly streamFor?: (seed: number) => RandomStream
  readonly maxInstances?: number
  readonly onCue?: (cue: CueRequest) => void
}

export interface EffectPlayer {
  /** Plays `id` at `point`; `null` when no recipe has that id or the cap of live effects is reached. Returns a handle for `stop`. */
  play(id: string, point: Vec3Tuple, options?: PlayOptions): number | null
  stop(handle: number): void
  /** Runs the timers and ticks of every live effect (the engine's pools are aged by its owner). */
  update(dt: number): void
  clear(): void
  readonly active: number
  has(id: string): boolean
  ids(): readonly string[]
}

interface Playing {
  readonly handle: number
  readonly instance: EffectInstance
  readonly random: RandomStream | undefined
  readonly follow: Follow | undefined
  readonly origin: Vec3Tuple
  readonly anchor: Vec3Tuple
  readonly yaw: number
  readonly orientation: readonly [number, number, number, number] | undefined
  readonly seconds: number
}

const positionOf = (follow: Follow): Vec3Tuple => {
  const source = 'position' in follow ? follow.position : follow
  return [source.x, source.y, source.z]
}

/** A parameter given by its option id (`'ak'`, `'concrete'`) as the index of the option; a number is taken as it is. */
function paramIndex(def: EffectDef, param: number | string | undefined): number | undefined {
  if (typeof param !== 'string') return param
  const index = def.params?.options.indexOf(param) ?? -1
  return index >= 0 ? index : undefined
}

/** The turn about the vertical axis that takes the recipe's `heading` onto `direction` (three.js turns by `x' = cos x + sin z`). */
function yawOf(heading: Vec3Tuple, direction: Vec3Tuple | undefined): number {
  if (!direction || (direction[0] === 0 && direction[2] === 0)) return 0
  return Math.atan2(direction[0], direction[2]) - Math.atan2(heading[0], heading[2])
}

/**
 * Plays the Workshop's recipes anywhere in the world, many at once, each with its own clock, variables and props, a place and a way it faces. They all
 * spawn into the one engine, so the pools stay shared and bounded. This is what `VfxWorld.play` and the host's `EffectSink` use.
 */
export function createEffectPlayer(options: EffectPlayerOptions): EffectPlayer {
  const { engine, view } = options
  const factories = options.behaviors ?? WORKSHOP_BEHAVIORS
  const streamOf = options.streamFor ?? ((seed: number) => lehmer(seed))
  const limit = options.maxInstances ?? DEFAULT_MAX_INSTANCES
  const playing: Playing[] = []
  let next = 0

  function makeInstance(): EffectInstance {
    const made = new Map<string, Behavior>()
    return new EffectInstance({
      engine,
      view,
      behavior: (id) => {
        let behavior = made.get(id)
        if (!behavior) {
          const make = factories[id]
          if (!make) throw new Error(`no behaviour ${id}`)
          behavior = make()
          made.set(id, behavior)
        }
        return behavior
      },
      behaviors: () => made.values(),
      ...(options.onCue ? { onCue: options.onCue } : {}),
    })
  }

  function placementOf(entry: Playing): Placement {
    const origin = entry.follow ? [entry.origin[0] + positionOf(entry.follow)[0], entry.origin[1] + positionOf(entry.follow)[1], entry.origin[2] + positionOf(entry.follow)[2]] as const : entry.origin
    return { origin, anchor: entry.anchor, yaw: entry.yaw, ...(entry.orientation ? { orientation: entry.orientation } : {}) }
  }

  /** Runs `action` drawing from the effect's own stream, if it has one. */
  function drawing(entry: Playing, action: () => void): void {
    const context = engine.context
    const shared = context.random
    if (entry.random) context.random = entry.random
    try {
      action()
    } finally {
      context.random = shared
    }
  }

  return {
    play(id, point, playOptions = {}) {
      const def = options.effects[id]
      if (!def || playing.length >= limit) return null
      const heading = def.heading ?? DEFAULT_HEADING
      const instance = makeInstance()
      const entry: Playing = {
        handle: ++next,
        instance,
        random: playOptions.seed !== undefined ? streamOf(playOptions.seed) : undefined,
        follow: playOptions.follow,
        origin: point,
        anchor: def.anchor ?? ORIGIN,
        yaw: yawOf(heading, playOptions.direction),
        orientation: playOptions.orientation,
        seconds: playOptions.seconds ?? (def.loop && def.loop > 0 ? def.loop : ENDLESS_SECONDS),
      }
      playing.push(entry)
      drawing(entry, () =>
        instance.begin(def, paramIndex(def, playOptions.param), {
          placement: placementOf(entry),
          ...(playOptions.direction ? { direction: playOptions.direction } : {}),
          ...(playOptions.normal ? { normal: playOptions.normal } : {}),
          ...(playOptions.values ? { values: playOptions.values } : {}),
        }),
      )
      return entry.handle
    },
    stop(handle) {
      const index = playing.findIndex((entry) => entry.handle === handle)
      if (index >= 0) playing.splice(index, 1)
    },
    update(dt) {
      for (let index = playing.length - 1; index >= 0; index--) {
        const entry = playing[index]!
        const instance = entry.instance
        instance.setup = { ...instance.setup, placement: placementOf(entry) }
        drawing(entry, () => instance.step(dt))
        if (instance.time >= entry.seconds) playing.splice(index, 1)
      }
    },
    clear() {
      playing.length = 0
    },
    get active() {
      return playing.length
    },
    has: (id) => id in options.effects,
    ids: () => Object.keys(options.effects),
  }
}
