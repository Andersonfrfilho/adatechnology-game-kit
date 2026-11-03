/**
 * A continuous sound played from files (fire, rain, an engine idling): `SampleSound.loop` turns a sample sound into a loop that `engine.loop(id)` plays.
 * The takes are chained without a seam: each one starts `crossfade` seconds before the last one ends, the two crossed with equal-power ramps, and
 * the next take is drawn by the round-robin (never the same twice in a row while there are two or more). A take shorter than two crossfades
 * loops on itself (`AudioBufferSourceNode.loop`). While the files are not decoded the recipe loop of the fallback (or of the same id) plays, and
 * the files take over when they are ready, at the volume the loop has then.
 */
import { pickTake } from '../sample'
import type { BusId, SampleSound } from '../recipe'
import type { AudioLoopHandle, LoopEntry } from './engine-loop'

/** The crossfade between two takes of a loop, in seconds, when `loop: true` gives none. */
export const DEFAULT_LOOP_CROSSFADE = 0.25
/** Takes are scheduled until this far (seconds) past the clock, so a busy main thread (a heavy frame, a late timer) never leaves a gap. */
const LOOKAHEAD = 1.5
const VOLUME_SMOOTHING = 0.05

/** The crossfade of a looping sample sound, or `undefined` when it does not loop. */
export function loopCrossfade(sound: SampleSound): number | undefined {
  if (!sound.loop) return undefined
  return sound.loop === true ? DEFAULT_LOOP_CROSSFADE : Math.max(0, sound.loop.crossfade ?? DEFAULT_LOOP_CROSSFADE)
}

/** Steps of the equal-power ramps (straight lines between points of the sine and cosine quarter). */
export const CROSSFADE_STEPS = 8

/** The gain of an equal-power crossfade at `t` (0..1) for the take coming in; the take going out has the gain at `1 − t`. */
export const equalPowerIn = (t: number): number => Math.sin((Math.max(0, Math.min(1, t)) * Math.PI) / 2)

// a quarter sine (in) or cosine (out) drawn as straight ramps, so it runs on any AudioParam (and on the recorder of the tests)
const ramp = (param: AudioParam, direction: 'in' | 'out', at: number, seconds: number): void => {
  const value = (t: number): number => (direction === 'in' ? equalPowerIn(t) : equalPowerIn(1 - t))
  param.setValueAtTime(value(0), at)
  for (let step = 1; step <= CROSSFADE_STEPS; step++) param.linearRampToValueAtTime(value(step / CROSSFADE_STEPS), at + (seconds * step) / CROSSFADE_STEPS)
}

/** What a sample loop needs from its engine. */
export type SampleLoopHost = {
  ready(): AudioContext | null
  /** The node sample voices of a bus go to (the limiter of the bus). */
  output(bus: BusId): AudioNode
  buffer(url: string): AudioBuffer | undefined
  isReady(sound: SampleSound): boolean
  /** Loads the files of the sound (resolves when they are decoded or failed). */
  load(sound: SampleSound): Promise<unknown>
  /** The recipe loop that plays while the files are not ready. */
  fallback(volume: number): AudioLoopHandle
  random(): number
  register(loop: LoopEntry): void
  unregister(loop: LoopEntry): void
  /** Whether a bus is muted now. */
  muted(bus: BusId): boolean
}

type Segment = { readonly source: AudioBufferSourceNode; readonly gain: GainNode; readonly end: number }

/** Plays a looping sample sound; falls back to the recipe loop while its files load. `volume` is the opening level (default 0, opened by `set`). */
export function createSampleLoopHandle(sound: SampleSound, host: SampleLoopHost, volume = 0): AudioLoopHandle {
  const crossfade = loopCrossfade(sound) ?? DEFAULT_LOOP_CROSSFADE
  let level = volume
  let stopped = false
  let fallback: AudioLoopHandle | undefined
  let master: GainNode | undefined
  let segments: Segment[] = []
  let last: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const entry: LoopEntry = {
    get created() {
      return master !== undefined
    },
    rewire() {
      master?.disconnect()
      master?.connect(host.output(sound.bus))
    },
    stop() {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      for (const segment of segments) {
        try {
          segment.source.stop()
        } catch {
          // already stopped
        }
        segment.source.disconnect()
        segment.gain.disconnect()
      }
      segments = []
      master?.disconnect()
      master = undefined
      fallback?.stop()
      fallback = undefined
      host.unregister(entry)
    },
  }

  const nextBuffer = (): AudioBuffer | undefined => {
    const takes = sound.close
    const take = pickTake(takes.length, last, host.random)
    last = take
    const ref = takes[take]
    return ref ? host.buffer(ref.url) : undefined
  }

  // schedules one take from `at`; returns when the next one starts
  const schedule = (context: AudioContext, output: AudioNode, at: number, first: boolean): number | undefined => {
    const buffer = nextBuffer()
    if (!buffer) return undefined
    const source = context.createBufferSource()
    source.buffer = buffer
    const gain = context.createGain()
    source.connect(gain)
    gain.connect(output)
    const fade = Math.min(crossfade, buffer.duration / 2)
    if (buffer.duration < 2 * crossfade || sound.close.length === 1) {
      // one take (or a take too short to cross): it loops on itself
      source.loop = true
      if (!first) ramp(gain.gain, 'in', at, Math.max(0.001, fade))
      source.start(at)
      segments.push({ source, gain, end: Number.POSITIVE_INFINITY })
      return undefined
    }
    if (first) gain.gain.setValueAtTime(1, at)
    else ramp(gain.gain, 'in', at, fade)
    const end = at + buffer.duration
    ramp(gain.gain, 'out', end - fade, fade)
    source.start(at)
    source.stop(end)
    segments.push({ source, gain, end })
    source.onended = () => {
      segments = segments.filter((segment) => segment.source !== source)
      source.disconnect()
      gain.disconnect()
    }
    return end - fade
  }

  const pump = (context: AudioContext, output: AudioNode, at: number, first: boolean): void => {
    if (stopped) return
    let next = schedule(context, output, at, first)
    // a late timer: catch up from the clock instead of stacking takes in the past
    while (next !== undefined && next < context.currentTime + LOOKAHEAD) next = schedule(context, output, Math.max(next, context.currentTime), false)
    if (next === undefined) return
    const wait = Math.max(0, (next - context.currentTime - LOOKAHEAD / 2) * 1000)
    timer = setTimeout(() => {
      timer = undefined
      pump(context, output, next, false)
    }, wait)
  }

  const startFiles = (): boolean => {
    if (stopped || master || !host.isReady(sound)) return master !== undefined
    const context = host.ready()
    if (!context) return false
    master = context.createGain()
    master.gain.setValueAtTime(level, context.currentTime)
    master.connect(host.output(sound.bus))
    host.register(entry)
    pump(context, master, context.currentTime, true)
    if (fallback) {
      fallback.set({ volume: 0 })
      const old = fallback
      fallback = undefined
      setTimeout(() => old.stop(), VOLUME_SMOOTHING * 6000)
    }
    return true
  }

  const ensure = (): void => {
    if (stopped || master) return
    if (startFiles()) return
    if (!fallback) {
      fallback = host.fallback(level)
      void host
        .load(sound)
        .then(() => {
          if (level > 0 || master) startFiles()
        })
        .catch(() => undefined)
    }
  }

  if (volume > 0) ensure()

  return {
    set(next) {
      if (stopped) return
      if (next.volume !== undefined) level = host.muted(sound.bus) ? 0 : Math.max(0, next.volume)
      if (level > 0) ensure()
      const context = host.ready()
      if (master && context) master.gain.setTargetAtTime(level, context.currentTime, VOLUME_SMOOTHING)
      fallback?.set(next.volume === undefined ? next : { ...next, volume: level })
    },
    stop: entry.stop,
  }
}
