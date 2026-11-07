import type { Vec3 } from '@adatechnology/game-contracts'

import { cutoffDivisor, falloffGain } from '../falloff'
import { listenerDistance, panFor } from '../listener'
import type { DistanceMode, Listener } from '../listener'
import { LOOP_SMOOTHING, createLoopState } from '../loops'
import type { BusId, LoopRecipe } from '../recipe'
import type { RealizeTarget } from './nodes'
import { realizeChainLoop, realizeGameLoop } from './realize-loop'
import type { RealizedLoop } from './realize-loop'

/**
 * What one `set` changes. `volume` and `frequency` glide as in the team loops. `position` places the loop: with a recipe `falloff` the level falls
 * with the distance from the listener (and the cutoff with `cutoffK`), with `pan` it goes to the listener's side. `cutoff` glides the first filter
 * (an engine opening up under load, a skid getting brighter).
 */
export type LoopSet = { readonly volume?: number; readonly frequency?: number; readonly position?: Vec3; readonly cutoff?: number }

/** A continuous sound: `set` glides the volume and, for an oscillator, the frequency; `stop` tears the nodes down. */
export type AudioLoopHandle = {
  set(state: LoopSet): void
  stop(): void
}

export type LoopEntry = { rewire(): void; stop(): void; readonly created: boolean }

/** What a loop needs from its engine. */
export type LoopHost = {
  ready(): BaseAudioContext | null
  output(bus: BusId): AudioNode
  prepareNoise(): unknown
  noise(): AudioBuffer
  register(loop: LoopEntry): void
  unregister(loop: LoopEntry): void
  /** Where the ears are now, for a loop with a `falloff` or `pan`. */
  listener?(): Listener
  readonly distance?: DistanceMode
}

const INERT: AudioLoopHandle = { set() {}, stop() {} }

/** A `game_loop` makes its nodes on the first audible `set`; a `chain_loop` makes them when it opens, at `volume` (default the recipe's). */
export function createLoopHandle(recipe: LoopRecipe | undefined, host: LoopHost, volume?: number): AudioLoopHandle {
  if (!recipe) return INERT
  const loopRecipe = recipe
  const isChain = loopRecipe.order === 'chain_loop'
  const opening = volume ?? loopRecipe.volume ?? 0
  const smoothing = loopRecipe.smoothing ?? LOOP_SMOOTHING
  let state = createLoopState(loopRecipe)
  let nodes: RealizedLoop | undefined

  const entry: LoopEntry = {
    get created() {
      return nodes !== undefined
    },
    rewire() {
      nodes?.out.disconnect()
      nodes?.out.connect(host.output(loopRecipe.bus))
    },
    stop() {
      nodes?.stop()
      nodes?.out.disconnect()
      nodes = undefined
      state = createLoopState(loopRecipe)
      host.unregister(entry)
    },
  }

  const create = (context: BaseAudioContext, startVolume: number): RealizedLoop => {
    if (loopRecipe.source.kind === 'noise') host.prepareNoise()
    const target: RealizeTarget = { context, output: host.output(loopRecipe.bus), noise: host.noise, time: context.currentTime }
    const made = isChain ? realizeChainLoop(loopRecipe, target, startVolume) : realizeGameLoop(loopRecipe, target)
    host.register(entry)
    return made
  }

  const open = (): void => {
    const context = host.ready()
    if (!context) return
    nodes = create(context, opening)
    state = createLoopState({ ...loopRecipe, volume: opening }, true)
  }
  if (isChain) open()

  let position: Vec3 | undefined
  let cutoff: number | undefined
  const placed = loopRecipe.falloff !== undefined || loopRecipe.pan === true
  return {
    set(next) {
      if (isChain && !nodes) open()
      const context = host.ready()
      if (!context) return
      position = next.position ?? position
      cutoff = next.cutoff ?? cutoff
      const action = state.set(next)
      if (!action) return
      nodes ??= create(context, 0)
      const listener = placed && position ? host.listener?.() : undefined
      const distance = listener && position ? listenerDistance(listener, position, host.distance) : 0
      const level = listener ? falloffGain(loopRecipe.falloff, action.volume, distance) : action.volume
      nodes.gain.gain.setTargetAtTime(level, context.currentTime, smoothing.volume)
      if (action.frequency !== undefined && nodes.frequency) nodes.frequency.setTargetAtTime(action.frequency, context.currentTime, smoothing.frequency)
      if (cutoff !== undefined && nodes.cutoff) nodes.cutoff.setTargetAtTime(cutoff / cutoffDivisor(loopRecipe.falloff, distance), context.currentTime, smoothing.frequency)
      if (listener && position && nodes.panner) nodes.panner.pan.setTargetAtTime(panFor(listener, position), context.currentTime, smoothing.frequency)
    },
    stop: entry.stop,
  }
}
