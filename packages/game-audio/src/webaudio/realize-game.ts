// The game's routines (jogo.js), one builder each: the nodes are created, set and wired in the routine's own order, so the trace of a plan
// matches the trace of the team function. The level is already in the envelope; every builder connects straight to the bus.
import type { PlannedFilter, PlannedLayer, SoundPlan } from '../plan'
import { applyEnvelope, assign, noiseSource, rampTo, voiceOf } from './nodes'
import type { RealizedVoice, RealizeTarget } from './nodes'

const end = (layer: PlannedLayer, start: number): number => start + layer.duration + layer.tail
const firstFilter = (layer: PlannedLayer): PlannedFilter | undefined => layer.filters?.bank[0]
const offsetOf = (layer: PlannedLayer): number => (layer.source.kind === 'noise' ? layer.source.offset : 0)

function setFilter(node: BiquadFilterNode, filter: PlannedFilter | undefined, time: number): void {
  if (!filter) return
  node.type = filter.type
  assign(node.frequency, filter.frequency, time)
  if (filter.q !== undefined) node.Q.value = filter.q
}

/** `sfx` (L62089): gain to the bus first, then the noise, its lowpass, the envelope, and a random start in the noise. */
export function realizeBurst(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const gain = context.createGain()
  gain.connect(target.output)
  const source = noiseSource(target, layer.source.kind === 'noise' && layer.source.loop)
  const filter = context.createBiquadFilter()
  source.connect(filter)
  filter.connect(gain)
  setFilter(filter, firstFilter(layer), time)
  applyEnvelope(gain.gain, layer.envelope, time)
  source.start(time, offsetOf(layer))
  source.stop(end(layer, time))
  return voiceOf([source])
}

/** `grito` (L62128): noise through a parallel formant bank (each band with its own level), a gain LFO for roughness. */
export function realizeScream(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const source = noiseSource(target, layer.source.kind === 'noise' && layer.source.loop)
  const gain = context.createGain()
  gain.connect(target.output)
  for (const band of layer.filters?.bank ?? []) {
    const filter = context.createBiquadFilter()
    filter.type = band.type
    if (band.q !== undefined) filter.Q.value = band.q
    assign(filter.frequency, band.frequency, time)
    rampTo(filter.frequency, band.frequency, time)
    const level = context.createGain()
    level.gain.value = band.level ?? 1
    source.connect(filter)
    filter.connect(level)
    level.connect(gain)
  }
  const sources: AudioScheduledSourceNode[] = [source]
  const lfos = layer.modulators.map((modulator) => {
    const lfo = context.createOscillator()
    const depth = context.createGain()
    if (modulator.wave) lfo.type = modulator.wave
    lfo.frequency.value = modulator.rate
    depth.gain.value = modulator.depth
    lfo.connect(depth)
    depth.connect(gain.gain)
    return lfo
  })
  applyEnvelope(gain.gain, layer.envelope, time)
  source.start(time, offsetOf(layer))
  source.stop(end(layer, time))
  for (const lfo of lfos) {
    lfo.start(time)
    lfo.stop(end(layer, time))
    sources.push(lfo)
  }
  return voiceOf(sources)
}

/** `voz` (L62143): oscillator → bandpass → gain; the filter frequency is set after the pitch sweep. */
export function realizeGroan(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  const band = firstFilter(layer)
  if (layer.source.kind === 'osc') oscillator.type = layer.source.wave
  if (band) {
    filter.type = band.type
    if (band.q !== undefined) filter.Q.value = band.q
  }
  if (layer.source.kind === 'osc') {
    assign(oscillator.frequency, layer.source.frequency, time)
    rampTo(oscillator.frequency, layer.source.frequency, time)
  }
  if (band) assign(filter.frequency, band.frequency, time)
  applyEnvelope(gain.gain, layer.envelope, time)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(target.output)
  oscillator.start(time)
  oscillator.stop(end(layer, time))
  return voiceOf([oscillator])
}

/** `boom` (L68278): one oscillator sweeping down into a gain. */
export function realizeBoom(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  if (layer.source.kind === 'osc') {
    oscillator.type = layer.source.wave
    assign(oscillator.frequency, layer.source.frequency, time)
    rampTo(oscillator.frequency, layer.source.frequency, time)
  }
  applyEnvelope(gain.gain, layer.envelope, time)
  oscillator.connect(gain)
  gain.connect(target.output)
  oscillator.start(time)
  oscillator.stop(end(layer, time))
  return voiceOf([oscillator])
}

/** `chiado` (L69998): gain, noise and bandpass created first, then set, then wired. */
export function realizeStatic(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const gain = context.createGain()
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  source.buffer = target.noise()
  setFilter(filter, firstFilter(layer), time)
  applyEnvelope(gain.gain, layer.envelope, time)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(target.output)
  source.start(time, offsetOf(layer))
  source.stop(end(layer, time))
  return voiceOf([source])
}

/** `buzina` (L70272): one oscillator per layer into one gain with the first layer's envelope. */
export function realizeChord(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layers = plan.layers
  const oscillators = layers.map(() => context.createOscillator())
  const gain = context.createGain()
  // the team writes `o.type = o2.type = 'square'`, which assigns right to left
  for (let index = layers.length - 1; index >= 0; index--) {
    const source = (layers[index] as PlannedLayer).source
    if (source.kind === 'osc') (oscillators[index] as OscillatorNode).type = source.wave
  }
  layers.forEach((layer, index) => {
    if (layer.source.kind === 'osc') assign((oscillators[index] as OscillatorNode).frequency, layer.source.frequency, target.time + layer.at)
  })
  applyEnvelope(gain.gain, (layers[0] as PlannedLayer).envelope, target.time + (layers[0] as PlannedLayer).at)
  for (const oscillator of oscillators) oscillator.connect(gain)
  gain.connect(target.output)
  layers.forEach((layer, index) => (oscillators[index] as OscillatorNode).start(target.time + layer.at))
  layers.forEach((layer, index) => (oscillators[index] as OscillatorNode).stop(end(layer, target.time + layer.at)))
  return voiceOf(oscillators)
}

/**
 * `bichoSom` (L66625): gain and filter are created before the level is checked (a silent plan stops there), then each repeat is an oscillator
 * with its own envelope into the shared filter, whose frequency and Q are set again on every repeat.
 */
export function realizeCalls(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  if (plan.silent) return voiceOf([])
  const band = firstFilter(plan.layers[0] as PlannedLayer)
  if (band) filter.type = band.type
  filter.connect(gain)
  gain.connect(target.output)
  const oscillators = plan.layers.map((layer) => {
    const time = target.time + layer.at
    const oscillator = context.createOscillator()
    if (layer.source.kind === 'osc') {
      oscillator.type = layer.source.wave
      assign(oscillator.frequency, layer.source.frequency, time)
      rampTo(oscillator.frequency, layer.source.frequency, time)
    }
    if (band) {
      assign(filter.frequency, band.frequency, time)
      if (band.q !== undefined) filter.Q.value = band.q
    }
    const envelope = context.createGain()
    applyEnvelope(envelope.gain, layer.envelope, time)
    oscillator.connect(envelope)
    envelope.connect(filter)
    oscillator.start(time)
    oscillator.stop(end(layer, time))
    return oscillator
  })
  return voiceOf(oscillators)
}
