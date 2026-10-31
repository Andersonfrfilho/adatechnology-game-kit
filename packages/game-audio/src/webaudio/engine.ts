import type { Vec3 } from '@adatechnology/game-contracts'

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
import { globalContext, unlockContext } from './context'
import { createLoopHandle } from './engine-loop'
import type { AudioLoopHandle, LoopHost } from './engine-loop'
import { createNoiseStore, noiseBuffer, prepareNoise } from './engine-noise'
import type { NoiseStore } from './engine-noise'
import type { RealizedVoice } from './nodes'
import { createStartQueue } from './engine-queue'
import type { StartQueueOptions } from './engine-queue'
import { realize } from './realize'

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
  /** A named stream of the engine (`streamFor(seed, name)`), so one subject never shifts another's sounds. */
  readonly channel?: string
}

export type VoiceHandle = { readonly id: number; readonly plan: SoundPlan; stop(): void }

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
  readonly createContext?: () => AudioContext | null
  /** Build voices in timed slices between frames instead of inside `play` (a sound starts a few ms late; a burst never costs a frame). Off by default. */
  readonly deferredStart?: StartQueueOptions
}

export type AudioEngine = {
  readonly registry: SoundRegistry
  register(bank: SoundBank): void
  /** Pure: the plan a sound would play with, from `options.seed` or the engine seed; draws nothing from the live streams. */
  plan(id: string, options?: PlayOptions): SoundPlan | null
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
  dispose(): void
}

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
  let context: AudioContext | null = null
  let chain: MixChain | null = null
  let listener: Listener = DEFAULT_LISTENER
  let lastTime = 0

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

  const ready = (): AudioContext | null => {
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

  const build = (plan: SoundPlan, store: NoiseStore, delay: number): RealizedVoice => {
    const audio = context as AudioContext
    return realize(plan, {
      context: audio,
      output: outputFor(plan.bus),
      ...(chain?.wet ? { wet: chain.wet } : {}),
      noise: () => noiseBuffer(store, audio, mix.noise.seconds),
      time: audio.currentTime + delay,
    })
  }

  // the voice a deferred sound is tracked by until it is built: `stop` cancels it or stops what was built
  const deferVoice = (plan: SoundPlan, store: NoiseStore, voiceId: number | undefined, delay: number): RealizedVoice => {
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
        if (!cancelled && context) built = build(plan, store, delay)
      },
      drop() {
        if (voiceId === undefined) return
        voices.release(voiceId)
        active.delete(voiceId)
      },
    })
    return pending
  }

  const start = (plan: SoundPlan, store: NoiseStore, voiceId: number | undefined, delay = 0): VoiceHandle | null => {
    const realized = startQueue ? deferVoice(plan, store, voiceId, delay) : build(plan, store, delay)
    if (voiceId === undefined) return null
    voices.setLength(voiceId, plan.length + delay)
    active.set(voiceId, realized)
    return {
      id: voiceId,
      plan,
      stop() {
        realized.stop()
        voices.release(voiceId)
        active.delete(voiceId)
      },
    }
  }

  const admit = (recipe: SoundRecipe, gain: number, distance: number): number | null => {
    const decision = voices.request({ ...(recipe.group ? { group: recipe.group } : {}), priority: recipe.priority ?? busPriority(recipe.bus), gain, distance, length: 0 })
    if (!decision.accepted) return null
    for (const id of decision.evicted) {
      active.get(id)?.stop()
      active.delete(id)
    }
    return decision.id
  }

  const playWith = (id: string, playOptions: PlayOptions, random: () => number, store: NoiseStore): VoiceHandle | null => {
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
    const plan = planSound(recipe, inputFor(recipe, playOptions, playOptions.seed === undefined ? random : createRng(playOptions.seed)))
    return plan ? start(plan, store, voiceId, playOptions.delay) : null
  }

  const randomFor = (playOptions: PlayOptions): (() => number) => {
    if (playOptions.channel === undefined) return engineRandom
    const existing = named.get(playOptions.channel)
    if (existing) return existing
    const stream = streamFor(seed, playOptions.channel)
    named.set(playOptions.channel, stream)
    return stream
  }

  const planWith = (id: string, playOptions: PlayOptions, random: () => number): SoundPlan | null => {
    const recipe = registry.sound(id)
    return recipe ? planSound(recipe, inputFor(recipe, playOptions, random)) : null
  }

  const loopHost: LoopHost = {
    ready,
    output: outputFor,
    prepareNoise: () => context && prepareNoise(shared, context, mix.noise.seconds),
    noise: () => noiseBuffer(shared, context as AudioContext, mix.noise.seconds),
    register: (loop) => void loops.add(loop),
    unregister: (loop) => void loops.delete(loop),
  }

  return {
    registry,
    register: (bank) => registry.register(bank),
    plan: (id, playOptions = {}) => planWith(id, playOptions, createRng(playOptions.seed ?? seed)),
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
    loop: (id, loopOptions = {}) => createLoopHandle(registry.loop(id), loopHost, loopOptions.volume),
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
      void context?.close()
      context = null
      chain = null
      busNodes.clear()
      meters.clear()
      shared.reset()
    },
  }
}
