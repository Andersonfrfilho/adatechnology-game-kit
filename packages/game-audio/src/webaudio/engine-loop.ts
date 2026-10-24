import { LOOP_SMOOTHING, createLoopState } from '../loops'
import type { BusId, LoopRecipe } from '../recipe'
import type { RealizeTarget } from './nodes'
import { realizeChainLoop, realizeGameLoop } from './realize-loop'
import type { RealizedLoop } from './realize-loop'

/** A continuous sound: `set` glides the volume and, for an oscillator, the frequency; `stop` tears the nodes down. */
export type AudioLoopHandle = {
  set(state: { readonly volume?: number; readonly frequency?: number }): void
  stop(): void
}

export type LoopEntry = { rewire(): void; stop(): void; readonly created: boolean }

/** What a loop needs from its engine. */
export type LoopHost = {
  ready(): AudioContext | null
  output(bus: BusId): AudioNode
  prepareNoise(): unknown
  noise(): AudioBuffer
  register(loop: LoopEntry): void
  unregister(loop: LoopEntry): void
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
      nodes?.gain.disconnect()
      nodes?.gain.connect(host.output(loopRecipe.bus))
    },
    stop() {
      nodes?.stop()
      nodes?.gain.disconnect()
      nodes = undefined
      state = createLoopState(loopRecipe)
      host.unregister(entry)
    },
  }

  const create = (context: AudioContext, startVolume: number): RealizedLoop => {
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

  return {
    set(next) {
      if (isChain && !nodes) open()
      const context = host.ready()
      if (!context) return
      const action = state.set(next)
      if (!action) return
      nodes ??= create(context, 0)
      nodes.gain.gain.setTargetAtTime(action.volume, context.currentTime, smoothing.volume)
      if (action.frequency !== undefined && nodes.frequency) nodes.frequency.setTargetAtTime(action.frequency, context.currentTime, smoothing.frequency)
    },
    stop: entry.stop,
  }
}
