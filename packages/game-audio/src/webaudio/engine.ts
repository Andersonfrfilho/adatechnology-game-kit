import type { DeferredQueue, Vec3 } from '@adatechnology/game-contracts'

import { createSoundRegistry } from '../bank'
import type { SoundRegistry } from '../bank'
import { falloffGain, isSilent } from '../falloff'
import { DEFAULT_LISTENER, listenerDistance } from '../listener'
import type { DistanceMode, Listener } from '../listener'
import { DEFAULT_MIX, busGain, resolveMix } from '../mix'
import type { BusSetting, MixProfile } from '../mix'
import { planSound } from '../plan'
import type { PlanInput, SoundPlan } from '../plan'
import type { BusId, SoundBank, SoundRecipe } from '../recipe'
import { createRng, streamFor } from '../rng'
import { busPriority, createVoiceManager } from '../voices'
import type { VoiceGroup } from '../voices'
import { buildChain } from './chain'
import type { MixChain } from './chain'
import { globalContext, isLiveContext, unlockContext } from './context'
import { createLoopHandle } from './engine-loop'
import type { AudioLoopHandle, LoopHost } from './engine-loop'
import { createSampleLoopHandle } from './sample-loop'
import { createNoiseStore, noiseBuffer, prepareNoise } from './engine-noise'
import type { NoiseStore } from './engine-noise'
import type { RealizedVoice } from './nodes'
import { createStartQueue } from './engine-queue'
import type { StartQueueOptions } from './engine-queue'
import { realize } from './realize'
import { createSetPicker, retunePlan } from '../variation'
import { planSample, sampleUrls } from '../sample'
import type { SampleEnvironment, SampleMemory, SamplePlan, SampleSound } from '../sample'
import { createSampleStore, fetchLoader } from './sample-store'
import type { SampleLoadReport, SampleLoader, SampleStatus } from './sample-store'
import { realizeSample, sampleLength } from './realize-sample'
import type { RealizedSampleVoice } from './realize-sample'

export type PlayOptions = {
  readonly position?: Vec3
  /** Meters; overrides `position` for the distance (not for the pan). */
  readonly distance?: number
  readonly volume?: number
  readonly params?: Readonly<Record<string, number>>
  /** This sound's own stream: same seed, same sound. */
  readonly seed?: number
  /** Seconds from now. */
  readonly delay?: number
  /** Built now instead of waiting in the engine's deferred start queue: for a sound that has to land on the frame the player sees it (a blow's
   * contact, a heel strike, a landing). The queue builds a voice on the next frame budget and drops it after its latency, which at a low frame
   * rate is late or silent. Default false. */
  readonly urgent?: boolean
  /** A named stream of the engine (`streamFor(seed, name)`), so one subject never shifts another's sounds. */
  readonly channel?: string
  /** The tail a sample sound plays (default the engine's, see `setEnvironment`). */
  readonly environment?: SampleEnvironment
  /** 0 (light) to 1 (heavy): the tier of takes a sample sound plays (criterion C7). */
  readonly intensity?: number
  /** 0 (clear) to 1 (behind a wall) for this play, over the engine's `occlusion` (a test bench puts a wall in between). Sample sounds only. */
  readonly occlusion?: number
}

/** A playing voice: a recipe (`kind: 'recipe'`, the plan of the synthesized sound) or files (`kind: 'sample'`). */
export type VoiceHandle =
  | { readonly id: number; readonly kind: 'recipe'; readonly plan: SoundPlan; stop(): void }
  | { readonly id: number; readonly kind: 'sample'; readonly plan: SamplePlan; stop(): void }

/**
 * A voice that started, for measuring (criterion C1: the event against the start of the sound). Times are the context clock, in seconds:
 * `requestedAt` when `play` was called, `startAt` when the first sample of the sound leaves the engine; `outputLatency` is what the device adds
 * after that (`baseLatency + outputLatency` of the context, 0 when unknown).
 */
export type VoiceStartEvent = {
  readonly id: string
  readonly kind: 'recipe' | 'sample'
  /** The sample sound this recipe stood in for while its files were not loaded. */
  readonly fallbackOf?: string
  /** The bank the played id is registered in (`kit_samples`, `user_samples`, a recipe bank...). */
  readonly bank?: string
  readonly requestedAt: number
  readonly startAt: number
  readonly outputLatency: number
  readonly level: number
  readonly distance: number
  readonly pan?: number
  /** The files a sample voice plays, by layer. */
  readonly layers?: readonly { readonly role: string; readonly url: string; readonly take: number; readonly rate: number }[]
  /** The tier of takes a sample voice played (criterion C7). */
  readonly tier?: string
}

export type SampleOptions = {
  /** Gets the bytes of a file (default `fetch`, relative to `baseUrl`). */
  readonly loader?: SampleLoader
  readonly baseUrl?: string
  /** Load a sound's files the first time it is played (default true); the fallback plays meanwhile. */
  readonly autoLoad?: boolean
  /**
   * The peak limiter every sample voice of a bus goes through before the bus (criteria C6 and C9: no sound and no burst goes over −1 dBFS): linear
   * up to `knee` (default 0.5, −6 dBFS), then bent smoothly to `ceiling` (default 0.891, −1 dBFS), with no delay. `false` leaves it out.
   */
  readonly limiter?: false | { readonly knee?: number; readonly ceiling?: number }
}

/** A subject's own random stream; `ownNoise` also gives it its own noise buffer, filled from that stream (the order `createWeaponAudio` uses). */
export type AudioChannel = {
  readonly random: () => number
  play(id: string, options?: PlayOptions): VoiceHandle | null
  plan(id: string, options?: PlayOptions): SoundPlan | null
}

export type AudioStats = {
  readonly context: 'none' | AudioContextState
  readonly voices: number
  readonly peak: number
  readonly dropped: number
  readonly maxVoices: number
  readonly loops: number
}

export type AudioEngineOptions = {
  /** Seeds the engine stream: the noise, the reverb impulse and every sound played without its own seed or channel. Default 1. */
  readonly seed?: number
  /** Default `art_scene` (Q1). */
  readonly mix?: string | MixProfile
  readonly profiles?: Readonly<Record<string, MixProfile>>
  readonly banks?: readonly SoundBank[]
  readonly maxVoices?: number
  readonly groups?: Readonly<Record<string, VoiceGroup>>
  readonly distance?: DistanceMode
  /** 0 (clear) to 1 (behind a wall) for a sound at a point; without it there is no occlusion (Q8). */
  readonly occlusion?: (point: Vec3) => number
  readonly createContext?: () => BaseAudioContext | null
  /** Build voices in timed slices between frames instead of inside `play` (a sound starts a few ms late; a burst never costs a frame). Off by default. */
  readonly deferredStart?: StartQueueOptions
  /** Where sample sounds get their files. */
  readonly samples?: SampleOptions
  /** The tail sample sounds play when `play` names none (default `outdoor`). */
  readonly environment?: SampleEnvironment
  /** Called when a voice is built (recipe or sample): the measuring hook of the criteria. */
  readonly onVoiceStart?: (event: VoiceStartEvent) => void
}

export type AudioEngine = {
  readonly registry: SoundRegistry
  register(bank: SoundBank): void
  /** Pure: the plan a sound would play with, from `options.seed` or the engine seed; draws nothing from the live streams. */
  plan(id: string, options?: PlayOptions): SoundPlan | null
  /** Pure: the plan a sample sound would play with (no round-robin memory), from `options.seed` or the engine seed. */
  planSample(id: string, options?: PlayOptions): SamplePlan | null
  /**
   * Loads the files of these sample sounds (default all registered). Creates the context; resolves when every file is decoded or failed. An id named
   * here that has no files yet (its manifest not registered) loads as soon as a bank that resolves it registers.
   */
  loadSamples(ids?: readonly string[]): Promise<SampleLoadReport>
  /** `ready` when every file of the sound is decoded. */
  sampleStatus(id: string): SampleStatus
  /** The tail sample sounds play from now on. */
  setEnvironment(environment: SampleEnvironment): void
  /** The node everything is mixed into before the speakers (to record or meter the whole output), or `null` before the context exists. */
  output(): AudioNode | null
  /** Another place files come from: urls `accepts` takes go to `loader`, the rest to the engine's own (a bench lends its calibration takes). */
  addSampleSource(accepts: (url: string) => boolean, loader: SampleLoader): void
  /** Follows every voice built from now on (as `onVoiceStart` does); returns the unsubscribe function. */
  watchVoices(listener: (event: VoiceStartEvent) => void): () => void
  play(id: string, options?: PlayOptions): VoiceHandle | null
  playPlan(plan: SoundPlan, options?: { readonly delay?: number }): VoiceHandle | null
  loop(id: string, options?: { readonly volume?: number }): AudioLoopHandle
  channel(options: { readonly seed?: number; readonly random?: () => number; readonly ownNoise?: boolean }): AudioChannel
  setListener(listener: Listener): void
  setBus(id: BusId, setting: BusSetting): void
  setMix(mix: string | MixProfile): void
  /** The master volume of the current chain and of any later one (0 to 1). */
  setMaster(gain: number): void
  /** Creates the context and the mixing chain if needed and resumes it; call from a click or a key. */
  unlock(): void
  /** Creates the context, the mixing chain (reverb impulse included) and the shared noise buffer now, so the first sound does not pay for them inside a frame. Returns false without a context. */
  warmUp(): boolean
  stats(): AudioStats
  /** RMS (0 to 1) of what a bus carries now, read from an analyser the first time you ask; sounds started before that do not reach it. 0 without a context. */
  level(bus: BusId): number
  /**
   * The voice start queue as a `DeferredQueue` for a shared frame budget (`budget.register` attaches it and the queue stops scheduling its own tasks), or `null`
   * without `deferredStart`. Asking for it changes nothing.
   */
  deferredQueue?(): DeferredQueue | null
  dispose(): void
}

/** The limiter's transfer curve over ±`range`: linear up to `knee`, then a tanh bend that never passes `ceiling`. */
export function limiterCurve(knee: number, ceiling: number, range: number, points = 2049): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points)
  const room = Math.max(1e-6, ceiling - knee)
  for (let index = 0; index < points; index++) {
    const value = ((index / (points - 1)) * 2 - 1) * range
    const size = Math.abs(value)
    const bent = size <= knee ? size : knee + room * Math.tanh((size - knee) / room)
    curve[index] = Math.sign(value) * bent
  }
  return curve
}

type Admission = { readonly bus: BusId; readonly group?: string; readonly priority?: number }

const usesNoise = (recipe: SoundRecipe): boolean => recipe.layers.some((layer) => layer.source.kind !== 'osc')
const planUsesNoise = (plan: SoundPlan): boolean => plan.layers.some((layer) => layer.source.kind !== 'osc')

/**
 * The sound engine: plans recipes and builds them on a lazily created AudioContext through one of the team mixing chains. Without an AudioContext
 * (Node, workers) every call except `plan` does nothing.
 */
export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const seed = options.seed ?? 1
  const registry = createSoundRegistry(options.banks)
  const voices = createVoiceManager({ ...(options.groups ? { groups: options.groups } : {}), ...(options.maxVoices === undefined ? {} : { maxVoices: options.maxVoices }) })
  const engineRandom = createRng(seed)
  const shared = createNoiseStore(engineRandom)
  const busSettings = new Map<BusId, BusSetting>()
  const busNodes = new Map<BusId, GainNode>()
  const meters = new Map<BusId, { readonly analyser: AnalyserNode; readonly data: Float32Array<ArrayBuffer> }>()
  const active = new Map<number, RealizedVoice>()
  const loops = new Set<{ rewire(): void; stop(): void; readonly created: boolean }>()
  const named = new Map<string, () => number>()
  let mix = resolveMix(options.mix ?? DEFAULT_MIX, options.profiles)
  let context: BaseAudioContext | null = null
  let chain: MixChain | null = null
  let listener: Listener = DEFAULT_LISTENER
  let lastTime = 0
  let environment: SampleEnvironment = options.environment ?? 'outdoor'
  const sampleLimiters = new Map<BusId, AudioNode>()
  // recipes go straight to the bus (their traces match the team routines node for node); recorded files go through a limiter of their bus. It is a
  // waveshaper, not a compressor: a compressor of the browser looks 6 ms ahead, which C1 (≤ 20 ms from the event) cannot spare.
  const sampleOutput = (bus: BusId): AudioNode => {
    const setting = options.samples?.limiter
    if (setting === false || !context) return outputFor(bus)
    const existing = sampleLimiters.get(bus)
    if (existing) return existing
    const range = 4
    const input = context.createGain()
    input.gain.value = 1 / range
    const shaper = context.createWaveShaper()
    shaper.curve = limiterCurve(setting?.knee ?? 0.5, setting?.ceiling ?? 0.891, range)
    ensureBus(bus)
    input.connect(shaper)
    shaper.connect(outputFor(bus))
    sampleLimiters.set(bus, input)
    return input
  }
  const chokes = new Map<string, { readonly id: number; readonly voice: RealizedSampleVoice }[]>()
  // the voices of a choked sound still ringing (the limiter forgets the ones that ended)
  const choked = (id: string): { readonly id: number; readonly voice: RealizedSampleVoice }[] => {
    const list = (chokes.get(id) ?? []).filter((entry) => active.has(entry.id))
    chokes.set(id, list)
    return list
  }
  const watchers = new Set<(event: VoiceStartEvent) => void>()
  const announce = (event: VoiceStartEvent): void => {
    options.onVoiceStart?.(event)
    for (const watcher of watchers) watcher(event)
  }
  const sources: { readonly accepts: (url: string) => boolean; readonly loader: SampleLoader }[] = []
  const baseLoader = options.samples?.loader ?? fetchLoader(options.samples?.baseUrl)
  const sampleStore = createSampleStore((url) => (sources.find((source) => source.accepts(url))?.loader ?? baseLoader)(url))
  const memory: SampleMemory = new Map()
  const latencyOf = (audio: BaseAudioContext): number => {
    const live = audio as Partial<Pick<AudioContext, 'baseLatency' | 'outputLatency'>>
    return (live.baseLatency ?? 0) + (live.outputLatency ?? 0)
  }

  const outputFor = (bus: BusId): AudioNode => (busNodes.get(bus) ?? chain?.master) as AudioNode

  // a bus somebody asked the level of gets an analyser as soon as it has a node, so sounds started before the first reading are metered too
  const watched = new Set<BusId>()
  const meterOf = (bus: BusId): { readonly analyser: AnalyserNode; readonly data: Float32Array<ArrayBuffer> } | undefined => {
    const existing = meters.get(bus)
    if (existing) return existing
    const node = busNodes.get(bus)
    if (!context || !node || typeof context.createAnalyser !== 'function') return undefined
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    node.connect(analyser)
    const made = { analyser, data: new Float32Array(analyser.fftSize) }
    meters.set(bus, made)
    return made
  }

  const ensureBus = (bus: BusId): void => {
    if (!context || !chain || busNodes.has(bus)) return
    const node = context.createGain()
    node.connect(chain.master)
    busNodes.set(bus, node)
    if (watched.has(bus)) meterOf(bus)
  }

  const ready = (): BaseAudioContext | null => {
    if (context) return context
    const created = (options.createContext ?? globalContext)()
    if (!created) return null
    context = created
    chain = buildChain(created, mix, engineRandom)
    if (mix.noise.create === 'eager') noiseBuffer(shared, created, mix.noise.seconds)
    for (const [bus, setting] of Object.entries(mix.buses ?? {}) as [BusId, BusSetting][]) {
      busSettings.set(bus, { ...setting, ...busSettings.get(bus) })
    }
    for (const [bus, setting] of busSettings) {
      ensureBus(bus)
      ;(busNodes.get(bus) as GainNode).gain.value = busGain(setting)
    }
    lastTime = created.currentTime
    return created
  }

  const advance = (): void => {
    if (!context) return
    const elapsed = context.currentTime - lastTime
    lastTime = context.currentTime
    if (elapsed > 0) for (const id of voices.advance(elapsed)) active.delete(id)
  }

  const inputFor = (recipe: SoundRecipe, playOptions: PlayOptions, random: () => number): PlanInput => ({
    random,
    listener,
    noiseSeconds: mix.noise.seconds,
    ...(options.distance ? { distanceMode: options.distance } : {}),
    ...(playOptions.volume === undefined ? {} : { volume: playOptions.volume }),
    ...(playOptions.distance === undefined ? {} : { distance: playOptions.distance }),
    ...(playOptions.position ? { position: playOptions.position } : {}),
    ...(playOptions.params ? { params: playOptions.params } : {}),
    ...(options.occlusion && playOptions.position && recipe.falloff?.model !== 'none' ? { occlusion: options.occlusion(playOptions.position) } : {}),
  })

  const startQueue = options.deferredStart ? createStartQueue(options.deferredStart) : null

  const build = (plan: SoundPlan, store: NoiseStore, delay: number, requestedAt: number, fallbackOf?: string): RealizedVoice => {
    const audio = context as BaseAudioContext
    const time = audio.currentTime + delay
    const realized = realize(plan, {
      context: audio,
      output: outputFor(plan.bus),
      ...(chain?.wet ? { wet: chain.wet } : {}),
      noise: () => noiseBuffer(store, audio, mix.noise.seconds),
      time,
    })
    const recipeBank = registry.bankOf(plan.id)
    announce({
      id: plan.id,
      kind: 'recipe',
      ...(fallbackOf ? { fallbackOf } : {}),
      ...(recipeBank ? { bank: recipeBank } : {}),
      requestedAt,
      startAt: time,
      outputLatency: latencyOf(audio),
      level: plan.level,
      distance: plan.distance,
      ...(plan.pan === undefined ? {} : { pan: plan.pan }),
    })
    return realized
  }

  // the voice a deferred sound is tracked by until it is built: `stop` cancels it or stops what was built
  const deferVoice = (plan: SoundPlan, store: NoiseStore, voiceId: number | undefined, delay: number, fallbackOf?: string): RealizedVoice => {
    const requestedAt = context?.currentTime ?? 0
    let built: RealizedVoice | null = null
    let cancelled = false
    const pending: RealizedVoice = {
      get sources() {
        return built?.sources ?? []
      },
      stop() {
        cancelled = true
        built?.stop()
      },
    }
    ;(startQueue as ReturnType<typeof createStartQueue>).push({
      run() {
        if (!cancelled && context) built = build(plan, store, delay, requestedAt, fallbackOf)
      },
      drop() {
        if (voiceId === undefined) return
        voices.release(voiceId)
        active.delete(voiceId)
      },
    })
    return pending
  }

  const start = (plan: SoundPlan, store: NoiseStore, voiceId: number | undefined, delay = 0, fallbackOf?: string, urgent = false): VoiceHandle | null => {
    const realized = startQueue && !urgent ? deferVoice(plan, store, voiceId, delay, fallbackOf) : build(plan, store, delay, context?.currentTime ?? 0, fallbackOf)
    if (voiceId === undefined) return null
    voices.setLength(voiceId, plan.length + delay)
    active.set(voiceId, realized)
    return {
      id: voiceId,
      kind: 'recipe',
      plan,
      stop() {
        realized.stop()
        voices.release(voiceId)
        active.delete(voiceId)
      },
    }
  }

  const admit = (recipe: Admission, gain: number, distance: number): number | null => {
    const decision = voices.request({ ...(recipe.group ? { group: recipe.group } : {}), priority: recipe.priority ?? busPriority(recipe.bus), gain, distance, length: 0 })
    if (!decision.accepted) return null
    for (const id of decision.evicted) {
      active.get(id)?.stop()
      active.delete(id)
    }
    return decision.id
  }

  // a set id (`SoundBank.sets`) plays one of its variants, never the last one, at a drawn rate; a recipe id plays itself at rate 1
  const picker = createSetPicker()
  const resolve = (id: string, random: () => number, chooser = picker): { readonly id: string; readonly rate: number } => {
    if (registry.sound(id)) return { id, rate: 1 }
    const set = registry.set(id)
    return set ? chooser.pick(set, random) : { id, rate: 1 }
  }

  // ids `loadSamples` was asked for that had no files yet: they load when a bank that resolves them registers
  const wanted = new Set<string>()
  const loadSounds = (sounds: readonly SampleSound[]): Promise<SampleLoadReport> => {
    const audio = ready()
    if (!audio) return Promise.resolve({ loaded: [], failed: sounds.flatMap(sampleUrls).map((url) => ({ url, error: 'no audio context' })) })
    return sampleStore.load([...new Set(sounds.flatMap(sampleUrls))], audio)
  }

  const sampleInput = (playOptions: PlayOptions, random: () => number, withMemory: boolean) => ({
    random,
    listener,
    environment: playOptions.environment ?? environment,
    ...(withMemory ? { memory } : {}),
    ...(options.distance ? { distanceMode: options.distance } : {}),
    ...(playOptions.volume === undefined ? {} : { volume: playOptions.volume }),
    ...(playOptions.intensity === undefined ? {} : { intensity: playOptions.intensity }),
    ...(playOptions.distance === undefined ? {} : { distance: playOptions.distance }),
    ...(playOptions.position ? { position: playOptions.position } : {}),
    ...(playOptions.occlusion !== undefined
      ? { occlusion: playOptions.occlusion }
      : options.occlusion && playOptions.position
        ? { occlusion: options.occlusion(playOptions.position) }
        : {}),
  })

  // undefined: the files are not ready and there is no fallback, so the recipe of the same id (if any) plays
  const playSample = (sample: SampleSound, playOptions: PlayOptions, random: () => number, store: NoiseStore): VoiceHandle | null | undefined => {
    if (busSettings.get(sample.bus)?.muted) return null
    if (!sampleStore.ready(sampleUrls(sample))) {
      if (options.samples?.autoLoad !== false && ready()) void loadSounds([sample]).catch(() => undefined)
      if (sample.fallback && sample.fallback !== sample.id) return playWith(sample.fallback, playOptions, random, store, sample.id)
      return registry.sound(sample.id) ? undefined : null
    }
    const plan = planSample(sample, sampleInput(playOptions, playOptions.seed === undefined ? random : createRng(playOptions.seed), true))
    if (!plan) return null
    const audio = ready()
    if (!audio) return null
    unlockContext(audio)
    advance()
    const voiceId = admit(plan, plan.level, plan.distance)
    if (voiceId === null) return null
    const requestedAt = audio.currentTime
    const time = requestedAt + (playOptions.delay ?? 0)
    const chokeList = sample.choke ? choked(sample.id) : undefined
    const realized = realizeSample(plan, { context: audio, output: sampleOutput(plan.bus), buffer: (url) => sampleStore.buffer(url), time })
    const sampleBank = registry.bankOf(plan.id)
    announce({
      id: plan.id,
      kind: 'sample',
      ...(sampleBank ? { bank: sampleBank } : {}),
      requestedAt,
      startAt: time,
      outputLatency: latencyOf(audio),
      level: plan.level,
      distance: plan.distance,
      ...(plan.pan === undefined ? {} : { pan: plan.pan }),
      layers: plan.layers.map((layer) => ({ role: layer.role, url: layer.url, take: layer.take, rate: layer.rate })),
      ...(plan.tier ? { tier: plan.tier } : {}),
    })
    voices.setLength(voiceId, sampleLength(plan, (url) => sampleStore.seconds(url)) + (playOptions.delay ?? 0))
    active.set(voiceId, realized)
    if (chokeList && sample.choke) {
      chokeList.push({ id: voiceId, voice: realized })
      while (chokeList.length > Math.max(1, sample.choke.voices)) {
        const oldest = chokeList.shift()
        if (!oldest) break
        oldest.voice.fade(time, sample.choke.fade ?? 0.03)
        voices.release(oldest.id)
        active.delete(oldest.id)
      }
    }
    return {
      id: voiceId,
      kind: 'sample',
      plan,
      stop() {
        realized.stop()
        voices.release(voiceId)
        active.delete(voiceId)
      },
    }
  }

  const playWith = (asked: string, playOptions: PlayOptions, streamRandom: () => number, store: NoiseStore, fallbackOf?: string): VoiceHandle | null => {
    const sample = fallbackOf === undefined ? registry.sample(asked) : undefined
    if (sample) {
      const played = playSample(sample, playOptions, streamRandom, store)
      if (played !== undefined) return played
    }
    const seeded = playOptions.seed === undefined ? null : createRng(playOptions.seed)
    const { id, rate } = resolve(asked, seeded ?? streamRandom)
    const random = seeded ?? streamRandom
    const recipe = registry.sound(id)
    if (!recipe || busSettings.get(recipe.bus)?.muted) return null
    const distance = playOptions.distance ?? (playOptions.position ? listenerDistance(listener, playOptions.position, options.distance) : 0)
    const level = falloffGain(recipe.falloff, playOptions.volume ?? 1, distance)
    const silent = isSilent(recipe.falloff, level)
    // a sound too quiet to play does not even start the context (the team routines return before touching it)
    if (silent && !recipe.keepSilent) return null
    const audio = ready()
    if (!audio) return null
    unlockContext(audio)
    advance()
    const voiceId = silent ? undefined : admit(recipe, level, distance)
    if (voiceId === null) return null
    if (!silent && usesNoise(recipe)) prepareNoise(store, audio, mix.noise.seconds)
    const plan = planSound(recipe, inputFor(recipe, playOptions, random))
    return plan ? start(retunePlan(plan, rate), store, voiceId, playOptions.delay, fallbackOf, playOptions.urgent) : null
  }

  const randomFor = (playOptions: PlayOptions): (() => number) => {
    if (playOptions.channel === undefined) return engineRandom
    const existing = named.get(playOptions.channel)
    if (existing) return existing
    const stream = streamFor(seed, playOptions.channel)
    named.set(playOptions.channel, stream)
    return stream
  }

  // pure: a set is drawn with a picker of its own, so planning never moves what `play` picks next
  const planWith = (asked: string, playOptions: PlayOptions, random: () => number): SoundPlan | null => {
    const { id, rate } = resolve(asked, random, createSetPicker())
    const recipe = registry.sound(id)
    const plan = recipe ? planSound(recipe, inputFor(recipe, playOptions, random)) : null
    return plan ? retunePlan(plan, rate) : null
  }

  const loopHost: LoopHost = {
    ready,
    output: outputFor,
    prepareNoise: () => context && prepareNoise(shared, context, mix.noise.seconds),
    noise: () => noiseBuffer(shared, context as BaseAudioContext, mix.noise.seconds),
    register: (loop) => void loops.add(loop),
    unregister: (loop) => void loops.delete(loop),
    listener: () => listener,
    ...(options.distance ? { distance: options.distance } : {}),
  }

  return {
    registry,
    register: (bank) => {
      registry.register(bank)
      // ids asked for before their files were known (a module preloading as it loads, the manifest still on its way) load as soon as they resolve
      if (wanted.size === 0) return
      const now = [...wanted].map((id) => registry.sample(id)).filter((sample): sample is SampleSound => sample !== undefined)
      for (const sample of now) wanted.delete(sample.id)
      if (now.length > 0) void loadSounds(now).catch(() => undefined)
    },
    plan: (id, playOptions = {}) => planWith(id, playOptions, createRng(playOptions.seed ?? seed)),
    planSample(id, playOptions = {}) {
      const sample = registry.sample(id)
      return sample ? planSample(sample, sampleInput(playOptions, createRng(playOptions.seed ?? seed), false)) : null
    },
    loadSamples(ids) {
      for (const id of ids ?? []) if (!registry.sample(id)) wanted.add(id)
      const chosen = (ids ?? registry.sampleIds()).map((id) => registry.sample(id)).filter((sample): sample is SampleSound => sample !== undefined)
      return loadSounds(chosen)
    },
    sampleStatus(id) {
      const sample = registry.sample(id)
      if (!sample) return 'none'
      const statuses = sampleUrls(sample).map((url) => sampleStore.status(url))
      if (statuses.every((status) => status === 'ready')) return 'ready'
      if (statuses.includes('failed')) return 'failed'
      if (statuses.includes('loading')) return 'loading'
      return statuses.includes('ready') ? 'loading' : 'none'
    },
    setEnvironment(next) {
      environment = next
    },
    output: () => chain?.master ?? null,
    addSampleSource(accepts, loader) {
      sources.push({ accepts, loader })
    },
    watchVoices(listener) {
      watchers.add(listener)
      return () => void watchers.delete(listener)
    },
    play: (id, playOptions = {}) => playWith(id, playOptions, randomFor(playOptions), shared),
    playPlan(plan, playOptions = {}) {
      const audio = ready()
      if (!audio) return null
      advance()
      const recipe = { id: plan.id, bus: plan.bus, layers: [], sources: [], priority: plan.priority, ...(plan.group ? { group: plan.group } : {}) }
      const voiceId = plan.silent ? undefined : admit(recipe, plan.level, plan.distance)
      if (voiceId === null) return null
      if (planUsesNoise(plan)) prepareNoise(shared, audio, mix.noise.seconds)
      return start(plan, shared, voiceId, playOptions.delay)
    },
    loop(id, loopOptions = {}) {
      const sample = registry.sample(id)
      if (!sample?.loop) return createLoopHandle(registry.loop(id), loopHost, loopOptions.volume)
      return createSampleLoopHandle(
        sample,
        {
          ready,
          output: sampleOutput,
          buffer: (url) => sampleStore.buffer(url),
          isReady: (sound) => sampleStore.ready(sampleUrls(sound)),
          load: (sound) => (options.samples?.autoLoad === false ? Promise.resolve() : loadSounds([sound])),
          fallback: (volume) => createLoopHandle(registry.loop(sample.fallback ?? sample.id) ?? registry.loop(sample.id), loopHost, volume),
          random: engineRandom,
          register: loopHost.register,
          unregister: loopHost.unregister,
          muted: (bus) => busSettings.get(bus)?.muted === true,
          listener: () => listener,
          ...(options.distance ? { distance: options.distance } : {}),
        },
        loopOptions.volume,
      )
    },
    channel(channelOptions) {
      const random = channelOptions.random ?? (channelOptions.seed === undefined ? engineRandom : createRng(channelOptions.seed))
      const store = channelOptions.ownNoise ? createNoiseStore(random) : shared
      return {
        random,
        play: (id, playOptions = {}) => playWith(id, playOptions, random, store),
        plan: (id, playOptions = {}) => planWith(id, playOptions, createRng(playOptions.seed ?? seed)),
      }
    },
    setListener(next) {
      listener = next
    },
    setBus(id, setting) {
      busSettings.set(id, { ...busSettings.get(id), ...setting })
      if (!context) return
      ensureBus(id)
      ;(busNodes.get(id) as GainNode).gain.value = busGain(busSettings.get(id))
    },
    setMix(next) {
      const previous = mix
      mix = resolveMix(next, options.profiles)
      if (!context || !chain) return
      const old = chain
      chain = buildChain(context, mix, engineRandom)
      if (mix.noise.seconds !== previous.noise.seconds) shared.reset()
      for (const node of busNodes.values()) {
        node.disconnect()
        node.connect(chain.master)
      }
      for (const loop of loops) loop.rewire()
      old.disconnect()
    },
    setMaster(gain) {
      mix = { ...mix, master: gain }
      if (chain) chain.master.gain.value = gain
    },
    unlock() {
      const audio = ready()
      if (audio) unlockContext(audio)
    },
    warmUp() {
      const audio = ready()
      if (!audio) return false
      noiseBuffer(shared, audio, mix.noise.seconds)
      return true
    },
    level(bus) {
      watched.add(bus)
      ensureBus(bus)
      const meter = meterOf(bus)
      if (!meter) return 0
      meter.analyser.getFloatTimeDomainData(meter.data)
      let sum = 0
      for (const sample of meter.data) sum += sample * sample
      return Math.sqrt(sum / meter.data.length)
    },
    deferredQueue: () => startQueue?.deferredQueue() ?? null,
    stats() {
      advance()
      const voiceStats = voices.stats()
      return {
        context: context ? context.state : 'none',
        voices: voiceStats.active,
        peak: voiceStats.peak,
        dropped: voiceStats.dropped,
        maxVoices: voiceStats.maxVoices,
        loops: [...loops].filter((loop) => loop.created).length,
      }
    },
    dispose() {
      // closing the context ends every voice; they only leave the limiter
      startQueue?.clear()
      for (const id of active.keys()) voices.release(id)
      for (const loop of [...loops]) loop.stop()
      active.clear()
      if (context && isLiveContext(context)) void context.close()
      context = null
      chain = null
      busNodes.clear()
      meters.clear()
      shared.reset()
      sampleStore.clear()
      memory.clear()
      sampleLimiters.clear()
      chokes.clear()
    },
  }
}
