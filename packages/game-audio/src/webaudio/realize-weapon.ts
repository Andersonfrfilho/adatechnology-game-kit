// The weapon audio of the kit (`weapons-three`, first written against raw WebAudio): per layer, either a noise burst (source, filter, envelope gain)
// or an oscillator (oscillator, envelope gain), created in that order and chained straight to the bus. The level is already in the envelope.
import type { PlannedLayer, SoundPlan } from '../plan'
import { applyEnvelope, assign, filterNode, noiseSource, rampTo, voiceOf } from './nodes'
import type { RealizedVoice, RealizeTarget } from './nodes'

function noiseLayer(layer: PlannedLayer, target: RealizeTarget, time: number): AudioScheduledSourceNode {
  const { context } = target
  const source = noiseSource(target, layer.source.kind === 'noise' && layer.source.loop)
  const filters = (layer.filters?.bank ?? []).map((filter) => filterNode(context, filter, time))
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  let tail: AudioNode = source
  for (const filter of filters) tail = tail.connect(filter)
  tail.connect(envelope).connect(target.output)
  source.start(time, layer.source.kind === 'noise' ? layer.source.offset : 0)
  source.stop(time + layer.duration + layer.tail)
  return source
}

function toneLayer(layer: PlannedLayer, target: RealizeTarget, time: number): AudioScheduledSourceNode {
  const { context } = target
  const oscillator = context.createOscillator()
  if (layer.source.kind === 'osc') {
    oscillator.type = layer.source.wave
    assign(oscillator.frequency, layer.source.frequency, time)
    rampTo(oscillator.frequency, layer.source.frequency, time)
  }
  const envelope = context.createGain()
  applyEnvelope(envelope.gain, layer.envelope, time)
  oscillator.connect(envelope).connect(target.output)
  oscillator.start(time)
  oscillator.stop(time + layer.duration + layer.tail)
  return oscillator
}

/** One noise burst or one tone per layer, in the order written. */
export function realizeWeapon(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  const sources = plan.layers.map((layer) => {
    const time = target.time + layer.at
    return layer.source.kind === 'noise' ? noiseLayer(layer, target, time) : toneLayer(layer, target, time)
  })
  return voiceOf(sources)
}
