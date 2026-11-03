// Loop nodes in the two team orders: the game's `loopSet` (jogo L62109–62127) and the art scene's loops in `initAudio` (cena L1314–1316).
import type { Automation, LoopRecipe, Range } from '../recipe'
import { filterNode, gainNode, noiseSource } from './nodes'
import type { RealizeTarget } from './nodes'

export type RealizedLoop = {
  readonly gain: GainNode
  /** The node wired to the bus: the panner when the recipe pans, else the gain. */
  readonly out: AudioNode
  readonly panner?: StereoPannerNode
  readonly source: AudioScheduledSourceNode
  readonly frequency?: AudioParam
  /** The first filter's cutoff, for `set({ cutoff })`. */
  readonly cutoff?: AudioParam
  stop(): void
}

// a panning loop goes gain → panner → bus; the others keep the team wiring (gain → bus)
function outputStage(recipe: LoopRecipe, target: RealizeTarget, gain: GainNode): { out: AudioNode; panner?: StereoPannerNode } {
  if (!recipe.pan) {
    gain.connect(target.output)
    return { out: gain }
  }
  const panner = target.context.createStereoPanner()
  gain.connect(panner)
  panner.connect(target.output)
  return { out: panner, panner }
}

// loops take fixed numbers: a range or a param in a loop recipe reads as 0
const fixed = (range: Range | undefined): number => (typeof range === 'number' ? range : 0)
const fixedFrequency = (automation: Automation): number => fixed('set' in automation ? automation.set : automation.from)

function sourceOf(recipe: LoopRecipe, target: RealizeTarget): { source: AudioScheduledSourceNode; frequency?: AudioParam } {
  if (recipe.source.kind === 'noise') return { source: noiseSource(target, true) }
  const oscillator = target.context.createOscillator()
  oscillator.type = recipe.source.wave
  if (recipe.source.frequency) oscillator.frequency.value = fixedFrequency(recipe.source.frequency)
  return { source: oscillator, frequency: oscillator.frequency }
}

function stopAll(sources: readonly AudioScheduledSourceNode[]): () => void {
  return () => {
    for (const source of sources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
    }
  }
}

/** `loopSet` on first use: gain from 0 and filter wired first, the source and filter set, an optional blade-beat stage, then the source starts. */
export function realizeGameLoop(recipe: LoopRecipe, target: RealizeTarget): RealizedLoop {
  const { context } = target
  const gain = context.createGain()
  const filters = (recipe.filters?.bank ?? []).map(() => context.createBiquadFilter())
  gain.gain.value = 0
  const last = filters.reduce<AudioNode | undefined>((previous, filter) => (previous ? previous.connect(filter) : filter), undefined)
  last?.connect(gain)
  const output = outputStage(recipe, target, gain)
  const { source, frequency } = sourceOf(recipe, target)
  recipe.filters?.bank.forEach((spec, index) => {
    const filter = filters[index] as BiquadFilterNode
    filter.type = spec.type
    filter.frequency.value = fixedFrequency(spec.frequency)
    if (spec.q !== undefined) filter.Q.value = fixed(spec.q)
  })
  const sources: AudioScheduledSourceNode[] = [source]
  for (const modulator of recipe.modulators ?? []) {
    const lfo = context.createOscillator()
    const depth = context.createGain()
    const stage = context.createGain()
    if (modulator.wave) lfo.type = modulator.wave
    lfo.frequency.value = fixed(modulator.rate)
    depth.gain.value = fixed(modulator.depth as Range)
    stage.gain.value = modulator.base ?? 0
    lfo.connect(depth)
    depth.connect(stage.gain)
    last?.disconnect()
    last?.connect(stage)
    stage.connect(gain)
    lfo.start()
    sources.push(lfo)
  }
  source.connect(filters[0] ?? gain)
  source.start()
  return { gain, ...output, source, ...(frequency ? { frequency } : {}), ...(filters[0] ? { cutoff: filters[0].frequency } : {}), stop: stopAll(sources) }
}

/** The art scene's loops: source, filters, gain at its starting volume, a gain LFO, wired, started. */
export function realizeChainLoop(recipe: LoopRecipe, target: RealizeTarget, volume: number): RealizedLoop {
  const { context } = target
  const { source, frequency } = sourceOf(recipe, target)
  const filters = (recipe.filters?.bank ?? []).map((spec) =>
    filterNode(context, { type: spec.type, frequency: { value: fixedFrequency(spec.frequency) }, ...(spec.q === undefined ? {} : { q: fixed(spec.q) }) }, target.time),
  )
  const gain = gainNode(context, volume)
  const lfos = (recipe.modulators ?? []).map((modulator) => {
    const lfo = context.createOscillator()
    if (modulator.wave) lfo.type = modulator.wave
    lfo.frequency.value = fixed(modulator.rate)
    const depth = gainNode(context, fixed(modulator.depth as Range))
    lfo.connect(depth)
    depth.connect(gain.gain)
    return lfo
  })
  let tail: AudioNode = source
  for (const filter of filters) tail = tail.connect(filter)
  tail.connect(gain)
  const output = outputStage(recipe, target, gain)
  source.start()
  for (const lfo of lfos) lfo.start()
  return { gain, ...output, source, ...(frequency ? { frequency } : {}), ...(filters[0] ? { cutoff: filters[0].frequency } : {}), stop: stopAll([source, ...lfos]) }
}
