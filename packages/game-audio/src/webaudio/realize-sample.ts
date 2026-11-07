import { OPEN_CUTOFF } from '../sample'
import type { SamplePlan } from '../sample'
import { gainNode, voiceOf } from './nodes'
import type { RealizedVoice } from './nodes'

/** Seconds a trimmed take fades out over at its cut. */
export const TRIM_FADE = 0.04

export type SampleTarget = {
  readonly context: BaseAudioContext
  readonly output: AudioNode
  readonly buffer: (url: string) => AudioBuffer | undefined
  readonly time: number
}

/** A sample voice can also be faded out (the choke of its sound). */
export type RealizedSampleVoice = RealizedVoice & { fade(at: number, seconds: number): void }

/**
 * Builds a sample plan: each layer is a buffer source at the planned rate with its own gain, the layers meet in one voice gain (the choke fades it),
 * one lowpass (left out when open) and one stereo panner (when the plan has a pan), then the bus. A layer whose buffer is not loaded is skipped.
 */
export function realizeSample(plan: SamplePlan, target: SampleTarget): RealizedSampleVoice {
  const context = target.context
  let head: AudioNode = target.output
  if (plan.pan !== undefined && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner()
    panner.pan.value = plan.pan
    panner.connect(head)
    head = panner
  }
  if (plan.cutoff < OPEN_CUTOFF) {
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = plan.cutoff
    lowpass.Q.value = 0.7
    lowpass.connect(head)
    head = lowpass
  }
  const voice = context.createGain()
  voice.connect(head)
  head = voice
  const sources: AudioBufferSourceNode[] = []
  for (const layer of plan.layers) {
    const buffer = target.buffer(layer.url)
    if (!buffer) continue
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = layer.rate
    const gain = gainNode(context as BaseAudioContext, layer.gain)
    source.connect(gain)
    gain.connect(head)
    const at = target.time + layer.at
    const offset = Math.max(0, Math.min(layer.offset ?? 0, buffer.duration))
    if (layer.duration === undefined) source.start(at, offset)
    else {
      // a take cut out of a longer file fades over its last 40 ms (of the clock: the rate shortens it)
      const duration = Math.max(0, Math.min(layer.duration, buffer.duration - offset))
      const end = at + duration / layer.rate
      const fade = Math.min(TRIM_FADE, (end - at) / 4)
      gain.gain.setValueAtTime(layer.gain, end - fade)
      gain.gain.linearRampToValueAtTime(0, end)
      source.start(at, offset, duration)
    }
    sources.push(source)
  }
  const realized = voiceOf(sources)
  return {
    ...realized,
    fade(at, seconds) {
      voice.gain.setValueAtTime(1, at)
      voice.gain.linearRampToValueAtTime(0, at + seconds)
      for (const source of sources) {
        try {
          source.stop(at + seconds)
        } catch {
          // already stopped
        }
      }
    },
  }
}

/** Seconds a sample plan lasts with its buffers (the longest layer, at its rate). */
export function sampleLength(plan: SamplePlan, seconds: (url: string) => number | undefined): number {
  let length = 0
  for (const layer of plan.layers) {
    const file = seconds(layer.url) ?? 0
    const played = layer.duration === undefined ? file - (layer.offset ?? 0) : Math.min(layer.duration, file - (layer.offset ?? 0))
    length = Math.max(length, layer.at + Math.max(0, played) / layer.rate)
  }
  return length
}
