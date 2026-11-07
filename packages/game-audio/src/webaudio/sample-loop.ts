/**
 * A continuous sound played from files (fire, rain, an engine idling): `SampleSound.loop` turns a sample sound into a loop that `engine.loop(id)` plays.
 * The takes are chained without a seam: each one starts `crossfade` seconds before the last one ends, the two crossed with equal-power ramps, and
 * the next take is drawn by the round-robin (never the same twice in a row while there are two or more). A take shorter than two crossfades
 * loops on itself (`AudioBufferSourceNode.loop`). While the files are not decoded the recipe loop of the fallback (or of the same id) plays, and
 * the files take over when they are ready, at the volume the loop has then. A `position` in `set` places the loop (the sound's falloff and pan from
 * the listener), and with `baseFrequency` a `frequency` in `set` glides the rate of every take (an engine following its RPM).
 */
import type { Vec3 } from '@adatechnology/game-contracts'

import { falloffGain } from '../falloff'
import { listenerDistance, panFor } from '../listener'
import type { DistanceMode, Listener } from '../listener'
import { DEFAULT_SAMPLE_FALLOFF, pickTake } from '../sample'
import type { BusId, SampleRef, SampleSound } from '../recipe'
import type { AudioLoopHandle, LoopEntry } from './engine-loop'

/** The crossfade between two takes of a loop, in seconds, when `loop: true` gives none. */
export const DEFAULT_LOOP_CROSSFADE = 0.25
/** Takes are scheduled until this far (seconds) past the clock, so a busy main thread (a heavy frame, a late timer) never leaves a gap. */
const LOOKAHEAD = 1.5
const VOLUME_SMOOTHING = 0.05
/** Time constant of the rate glide (as the recipe loops' frequency). */
const RATE_SMOOTHING = 0.04
/** The rate a loop may be pushed to by `frequency`, either way. */
const RATE_RANGE = [0.25, 4] as const

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
  ready(): BaseAudioContext | null
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
  /** Where the listener is, for a loop placed by `set({ position })`. */
  listener?(): Listener
  distance?: DistanceMode
}

type Segment = { readonly source: AudioBufferSourceNode; readonly gain: GainNode; readonly end: number }

/** The rate a loop with `baseFrequency` plays at for a frequency. */
export const loopRate = (sound: SampleSound, frequency: number): number =>
  sound.baseFrequency && sound.baseFrequency > 0 && frequency > 0 ? Math.max(RATE_RANGE[0], Math.min(RATE_RANGE[1], frequency / sound.baseFrequency)) : 1

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
  let panner: StereoPannerNode | undefined
  let rate = 1
  let position: Vec3 | undefined

  const entry: LoopEntry = {
    get created() {
      return master !== undefined
    },
    rewire() {
      const out = panner ?? master
      out?.disconnect()
      out?.connect(host.output(sound.bus))
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
      panner?.disconnect()
      panner = undefined
      fallback?.stop()
      fallback = undefined
      host.unregister(entry)
    },
  }

  const nextTake = (): { readonly buffer: AudioBuffer; readonly ref: SampleRef } | undefined => {
    const takes = sound.close
    const take = pickTake(takes.length, last, host.random)
    last = take
    const ref = takes[take]
    const buffer = ref ? host.buffer(ref.url) : undefined
    return ref && buffer ? { buffer, ref } : undefined
  }

  // schedules one take from `at`; returns when the next one starts
  const schedule = (context: BaseAudioContext, output: AudioNode, at: number, first: boolean): number | undefined => {
    const next = nextTake()
    if (!next) return undefined
    const { buffer, ref } = next
    const offset = Math.max(0, Math.min(ref.offset ?? 0, buffer.duration))
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const gain = context.createGain()
    source.connect(gain)
    gain.connect(output)
    const fade = Math.min(crossfade, buffer.duration / 2)
    if (buffer.duration < 2 * crossfade || sound.close.length === 1) {
      // one take (or a take too short to cross): it loops on itself
      source.loop = true
      if (!first) ramp(gain.gain, 'in', at, Math.max(0.001, fade))
      source.start(at, offset)
      segments.push({ source, gain, end: Number.POSITIVE_INFINITY })
      return undefined
    }
    if (first) gain.gain.setValueAtTime(1, at)
    else ramp(gain.gain, 'in', at, fade)
    // a take crossed into the next one is timed at the rate it starts with (a rate that moves later shifts the seam a little)
    const end = at + (buffer.duration - offset) / rate
    ramp(gain.gain, 'out', end - fade, fade)
    source.start(at, offset)
    source.stop(end)
    segments.push({ source, gain, end })
    source.onended = () => {
      segments = segments.filter((segment) => segment.source !== source)
      source.disconnect()
      gain.disconnect()
    }
    return end - fade
  }

  const pump = (context: BaseAudioContext, output: AudioNode, at: number, first: boolean): void => {
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

  // the files play at the sound's own level (`SampleSound.gain`); the fallback recipe loop has its own
  const spatial = (): number => {
    if (!position || !host.listener) return 1
    return falloffGain(sound.falloff ?? DEFAULT_SAMPLE_FALLOFF, 1, listenerDistance(host.listener(), position, host.distance))
  }
  const fileLevel = (): number => level * (sound.gain ?? 1) * spatial()
  const place = (context: BaseAudioContext): void => {
    if (panner && position && host.listener) panner.pan.setTargetAtTime(panFor(host.listener(), position), context.currentTime, VOLUME_SMOOTHING)
  }

  const startFiles = (): boolean => {
    if (stopped || master || !host.isReady(sound)) return master !== undefined
    const context = host.ready()
    if (!context) return false
    master = context.createGain()
    master.gain.setValueAtTime(fileLevel(), context.currentTime)
    if (sound.pan !== false && position && typeof context.createStereoPanner === 'function') {
      panner = context.createStereoPanner()
      if (host.listener) panner.pan.value = panFor(host.listener(), position)
      master.connect(panner)
      panner.connect(host.output(sound.bus))
    } else master.connect(host.output(sound.bus))
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
      if (next.position) position = next.position
      if (next.frequency !== undefined && sound.baseFrequency) rate = loopRate(sound, next.frequency)
      if (level > 0) ensure()
      const context = host.ready()
      if (master && context) {
        master.gain.setTargetAtTime(fileLevel(), context.currentTime, VOLUME_SMOOTHING)
        place(context)
        if (next.frequency !== undefined && sound.baseFrequency) for (const segment of segments) segment.source.playbackRate.setTargetAtTime(rate, context.currentTime, RATE_SMOOTHING)
      }
      fallback?.set(next.volume === undefined ? next : { ...next, volume: level })
    },
    stop: entry.stop,
  }
}
