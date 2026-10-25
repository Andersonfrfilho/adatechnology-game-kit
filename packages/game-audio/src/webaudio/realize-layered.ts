// The art scene's primitives (cena L1319–1328, L1369): `sNoise`, `sTone` and `voice`, each layer with its own output stage (`outAt`: distance
// gain, pan, reverb send), and the siren straight to the bus. Built in the team's order so the traces match node for node.
import type { PlannedLayer, SoundPlan } from '../plan'
import { applyEnvelope, assign, filterNode, gainNode, noiseSource, rampTo, voiceOf } from './nodes'
import type { RealizedVoice, RealizeTarget } from './nodes'

const end = (layer: PlannedLayer, start: number): number => start + layer.duration + layer.tail

/** `outAt`: the layer level, the stereo panner when the plan pans and the context has one, the bus, then the reverb send. */
function outputStage(plan: SoundPlan, layer: PlannedLayer, target: RealizeTarget): GainNode {
  const { context } = target
  const level = gainNode(context, layer.level)
  let node: AudioNode = level
  if (plan.pan !== undefined && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner()
    panner.pan.value = plan.pan
    level.connect(panner)
    node = panner
  }
  node.connect(target.output)
  if (layer.wet && target.wet) {
    const send = gainNode(context, layer.wet)
    node.connect(send)
    send.connect(target.wet)
  }
  return level
}

function realizeNoiseLayer(plan: SoundPlan, layer: PlannedLayer, target: RealizeTarget): AudioScheduledSourceNode[] {
  const { context } = target
  const time = target.time + layer.at
  const source = noiseSource(target, layer.source.kind === 'noise' && layer.source.loop)
  const filters = (layer.filters?.bank ?? []).map((filter) => {
    const node = filterNode(context, filter, time)
    rampTo(node.frequency, filter.frequency, time)
    return node
  })
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  let tail: AudioNode = source
  for (const filter of filters) tail = tail.connect(filter)
  tail.connect(envelope)
  envelope.connect(outputStage(plan, layer, target))
  source.start(time, layer.source.kind === 'noise' ? layer.source.offset : 0)
  source.stop(end(layer, time))
  return [source]
}

function realizeToneLayer(plan: SoundPlan, layer: PlannedLayer, target: RealizeTarget): AudioScheduledSourceNode[] {
  const { context } = target
  const time = target.time + layer.at
  const oscillator = context.createOscillator()
  if (layer.source.kind === 'osc') {
    oscillator.type = layer.source.wave
    assign(oscillator.frequency, layer.source.frequency, time)
    rampTo(oscillator.frequency, layer.source.frequency, time)
  }
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  oscillator.connect(envelope)
  envelope.connect(outputStage(plan, layer, target))
  oscillator.start(time)
  oscillator.stop(end(layer, time))
  return [oscillator]
}

function realizeVoiceLayer(plan: SoundPlan, layer: PlannedLayer, target: RealizeTarget): AudioScheduledSourceNode[] {
  const source = layer.source
  if (source.kind !== 'formant_voice') return []
  const { context } = target
  const time = target.time + layer.at
  const oscillator = context.createOscillator()
  oscillator.type = source.wave
  assign(oscillator.frequency, source.frequency, time)
  rampTo(oscillator.frequency, source.frequency, time)
  const vibrato = context.createOscillator()
  vibrato.frequency.value = source.vibrato.rate
  const vibratoDepth = gainNode(context, source.vibrato.depth)
  vibrato.connect(vibratoDepth)
  vibratoDepth.connect(oscillator.frequency)
  const formants = source.formants.map((formant) => filterNode(context, { type: 'bandpass', frequency: { value: formant.frequency }, q: formant.q }, time))
  const breath = noiseSource(target, true)
  const breathBand = filterNode(context, { type: 'bandpass', frequency: { value: source.breath.frequency }, q: source.breath.q }, time)
  const breathLevel = gainNode(context, source.breath.gain)
  const mix = gainNode(context, source.mix)
  for (const formant of formants) oscillator.connect(formant)
  breath.connect(breathBand)
  breathBand.connect(breathLevel)
  for (const formant of formants) formant.connect(mix)
  breathLevel.connect(mix)
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  mix.connect(envelope)
  envelope.connect(outputStage(plan, layer, target))
  const stop = end(layer, time)
  oscillator.start(time)
  vibrato.start(time)
  breath.start(time, source.breath.offset)
  oscillator.stop(stop)
  vibrato.stop(stop)
  breath.stop(stop)
  return [oscillator, vibrato, breath]
}

/** Every layer in order, each with its own output stage. */
export function realizeLayered(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const sources = plan.layers.flatMap((layer) => {
    if (layer.source.kind === 'noise') return realizeNoiseLayer(plan, layer, target)
    if (layer.source.kind === 'osc') return realizeToneLayer(plan, layer, target)
    return realizeVoiceLayer(plan, layer, target)
  })
  return voiceOf(sources)
}

/** The siren: oscillator with a frequency LFO, envelope, lowpass, straight to the bus with a reverb send. */
export function realizeSiren(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const { context } = target
  const layer = plan.layers[0] as PlannedLayer
  const time = target.time + layer.at
  const oscillator = context.createOscillator()
  if (layer.source.kind === 'osc') {
    oscillator.type = layer.source.wave
    assign(oscillator.frequency, layer.source.frequency, time)
    rampTo(oscillator.frequency, layer.source.frequency, time)
  }
  const depths = layer.modulators.map((modulator) => {
    const lfo = context.createOscillator()
    if (modulator.wave) lfo.type = modulator.wave
    lfo.frequency.value = modulator.rate
    const depth = gainNode(context, modulator.depth)
    lfo.connect(depth)
    if (modulator.target === 'frequency') depth.connect(oscillator.frequency)
    return { lfo, depth, target: modulator.target }
  })
  const lfos = depths.map(({ lfo }) => lfo)
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  for (const { depth, target: modulated } of depths) if (modulated === 'gain') depth.connect(envelope.gain)
  const filters = (layer.filters?.bank ?? []).map((filter) => filterNode(context, filter, time))
  let tail: AudioNode = oscillator
  for (const filter of filters) tail = tail.connect(filter)
  tail.connect(envelope)
  envelope.connect(target.output)
  if (layer.wet && target.wet) {
    const send = gainNode(context, layer.wet)
    envelope.connect(send)
    send.connect(target.wet)
  }
  const stop = end(layer, time)
  oscillator.start(time)
  for (const lfo of lfos) lfo.start(time)
  oscillator.stop(stop)
  for (const lfo of lfos) lfo.stop(stop)
  return voiceOf([oscillator, ...lfos])
}
