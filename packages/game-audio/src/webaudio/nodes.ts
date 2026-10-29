import type { PlannedAutomation, PlannedEnvelopePoint, PlannedFilter } from '../plan'

/** Where a plan is built: the context, the bus it plays into, the reverb send (if the mix has one), the shared noise and the start time. */
export type RealizeTarget = {
  readonly context: AudioContext
  readonly output: AudioNode
  readonly wet?: AudioNode
  /** The noise buffer; made on the first call when the mix makes it on demand. */
  readonly noise: () => AudioBuffer
  readonly time: number
}

/** What `realize` built: every scheduled source (so the voice can be cut short) and `stop`. */
export type RealizedVoice = { readonly sources: readonly AudioScheduledSourceNode[]; stop(): void }

/** `.value = value`, or `setValueAtTime(from)` at `time`. */
export function assign(param: AudioParam, automation: PlannedAutomation, time: number): void {
  if (automation.value !== undefined) param.value = automation.value
  if (automation.from !== undefined) param.setValueAtTime(automation.from, time)
}

export function ramp(param: AudioParam, curve: 'set' | 'linear' | 'exp', value: number, at: number): void {
  if (curve === 'set') param.setValueAtTime(value, at)
  else if (curve === 'exp') param.exponentialRampToValueAtTime(value, at)
  else param.linearRampToValueAtTime(value, at)
}

/** The ramp of an automation, if it has one. */
export function rampTo(param: AudioParam, automation: PlannedAutomation, time: number): void {
  if (automation.to !== undefined && automation.at !== undefined) ramp(param, automation.curve ?? 'linear', automation.to, time + automation.at)
}

export function applyEnvelope(param: AudioParam, points: readonly PlannedEnvelopePoint[], time: number): void {
  for (const point of points) ramp(param, point.curve, point.value, time + point.time)
}

/** A noise source on the shared buffer (`loop` set only when asked, as the art scene's `nsrc` does). */
export function noiseSource(target: RealizeTarget, loop: boolean): AudioBufferSourceNode {
  const source = target.context.createBufferSource()
  source.buffer = target.noise()
  if (loop) source.loop = true
  return source
}

/** The art scene's `bq`: type, frequency, then Q and gain when given. The frequency ramp is left to the caller. */
export function filterNode(context: AudioContext, filter: PlannedFilter, time: number): BiquadFilterNode {
  const node = context.createBiquadFilter()
  node.type = filter.type
  assign(node.frequency, filter.frequency, time)
  if (filter.q !== undefined) node.Q.value = filter.q
  if (filter.gain !== undefined) node.gain.value = filter.gain
  return node
}

export function gainNode(context: AudioContext, value: number): GainNode {
  const node = context.createGain()
  node.gain.value = value
  return node
}

export function voiceOf(sources: readonly AudioScheduledSourceNode[]): RealizedVoice {
  return {
    sources,
    stop() {
      for (const source of sources) {
        try {
          source.stop()
        } catch {
          // already stopped
        }
      }
    },
  }
}
