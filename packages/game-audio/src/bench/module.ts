import type { AreaPlacement, BenchChange, ChoiceOption, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'

import { GAME_SFX_BANK } from '../recipes/noise-class'
import { LIBRARY_BANK } from '../library'
import { DISTANCE_CURVES } from '../falloff'
import { MIX_PROFILES } from '../mix'
import type { MixProfile } from '../mix'
import { BUS_IDS } from '../recipe'
import type { BusId, Layer, SoundBank } from '../recipe'
import type { SoundPlan } from '../plan'
import { createVoiceManager } from '../voices'
import { createAudioEngine } from '../webaudio/engine'
import type { AudioEngine, VoiceHandle } from '../webaudio/engine'
import type { EngineSink } from '../webaudio/sink'
import type { AudioLoopHandle } from '../webaudio/engine-loop'
import { audioBenchTextOf } from './locale'
import type { AudioBenchText } from './locale'

/**
 * Two probe sounds of the bench itself (a ping and a hiss), so panning, distance and the seed can be heard on something that has no subject. They are
 * made by the kit, not delivered by any team (`sdk` in the sources).
 */
export const BENCH_BANK: SoundBank = {
  id: 'audio_bench',
  sounds: [
    {
      id: 'bench_ping',
      bus: 'ui',
      pan: true,
      duration: 0.25,
      layers: [
        {
          gain: 0.5,
          wet: 0.3,
          source: { kind: 'osc', wave: 'sine', frequency: { from: 880 } },
          envelope: [
            [0, 0.0001, 'set', 'fixed'],
            [0.002, 1, 'exp'],
            ['1d', 0.0001, 'exp', 'fixed'],
          ],
        } satisfies Layer,
      ],
      falloff: DISTANCE_CURVES.art_scene,
      sources: ['sdk: bench probe, a 880 Hz ping through the art scene output stage'],
    },
    {
      id: 'bench_hiss',
      bus: 'ui',
      pan: true,
      duration: [0.3, 0.9],
      layers: [
        {
          gain: 0.4,
          source: { kind: 'noise', offset: 'random', offsetScale: 1.5, loop: true },
          filters: { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 3000 }, q: 0.7 }] },
          envelope: [
            [0, 0.0001, 'set', 'fixed'],
            [0.002, 1, 'exp'],
            ['1d', 0.0001, 'exp', 'fixed'],
          ],
        } satisfies Layer,
      ],
      falloff: DISTANCE_CURVES.art_scene,
      sources: ['sdk: bench probe, a highpass hiss of random length'],
    },
  ],
}

export type AudioTestModuleOptions = {
  /** The engine to test (default: the one the host lends in `host.audio`, else a new one of the module's own). */
  engine?: AudioEngine
  /** Banks registered in the engine besides the bench's probes (default the game's noise classes and the library). */
  banks?: readonly SoundBank[]
  locale?: string
  /** Text of a sound or loop id (`sound.glass`) in the game's words; without it the bench shows the bank and the id. */
  translate?: (key: string, locale: string) => string | undefined
  seed?: number
  /** First sound chosen (default `bench_ping`). */
  sound?: string
  /**
   * Draws the thing the probe stands for, where the sound comes from with the `probe` source (for example a portable radio of `game-items-three`). The module
   * draws nothing of its own: without it the area has no probe and the sounds come from the bench settings.
   */
  probe?: (THREE: unknown) => unknown
}

/** What the scenarios use of the context the test room passes. */
export interface AudioScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type AudioTestModule = TestableModule<AudioScenarioLike> & {
  /** The engine in use: the host's when it lent one, the module's own otherwise. */
  readonly engine: AudioEngine
  /** The resolved plan of the chosen sound as text (the S3 view: every number decided). */
  sheet(): string
  /** Plays the chosen sound as the bench is set. */
  play(): VoiceHandle | null
}

const DISTANCES = [0, 10, 40, 60, 120, 160] as const
const STORM = 20
const PROBE_ID = 'audio_probe'
const PROBE_AT: Vec3 = [0, 0, -10]
const NONE = 'none'
const DEFAULT_SOUND = 'bench_ping'

type Camera = { readonly position: { readonly x: number; readonly y: number; readonly z: number }; getWorldDirection(target: unknown): { readonly x: number; readonly z: number } }
type ThreeLike = { Vector3: new () => unknown }
type ProbeObject = { userData?: Record<string, unknown>; getWorldPosition(target: unknown): { readonly x: number; readonly y: number; readonly z: number }; traverse(visit: (object: ProbeObject) => void): void }

const variantOf = (profile: MixProfile, reverb: boolean, compressor: boolean): MixProfile => {
  const { reverb: wet, compressor: chain, ...rest } = profile
  return { ...rest, id: `${profile.id}${reverb ? '' : '+dry'}${compressor ? '' : '+open'}`, ...(wet && reverb ? { reverb: wet } : {}), ...(chain && compressor ? { compressor: chain } : {}) }
}

/**
 * The sound area of a test room, written against the generic contracts only: it plays any sound of an engine at a distance and bearing from the listener
 * (or from a probe standing in the area), runs loops, throws a storm of voices at the limiter, switches the mixing chain and its parts, reads the
 * level of each bus and prints the resolved plan. The engine is the host's (`host.audio`) when lent, else the module's own.
 */
export function createAudioTestModule(options: AudioTestModuleOptions = {}): AudioTestModule {
  const locale = options.locale ?? 'pt-BR'
  const text: AudioBenchText = audioBenchTextOf(locale)
  const banks = [BENCH_BANK, ...(options.banks ?? [GAME_SFX_BANK, LIBRARY_BANK])]
  let engine: AudioEngine = options.engine ?? createAudioEngine({ seed: options.seed ?? 1, banks })
  for (const bank of banks) engine.register(bank)
  let host: ModuleHost | null = null
  let loop: AudioLoopHandle | undefined
  const state = {
    sound: options.sound ?? DEFAULT_SOUND,
    distance: 10,
    bearing: 0,
    volume: 1,
    mix: 'art_scene',
    seed: options.seed ?? 1,
    source: 'bench',
    loop: NONE,
    loopLevel: 0.1,
    loopPitch: 0,
    reverb: true,
    compressor: true,
    panning: true,
    muffling: true,
  }

  const nameOf = (id: string): string => {
    const translated = options.translate?.(`sound.${id}`, locale)
    if (translated) return translated
    const bank = engine.registry.bankOf(id)
    return bank ? `${bank} / ${id}` : id
  }
  const soundOptions = (): ChoiceOption[] => engine.registry.soundIds().map((id) => ({ id, name: nameOf(id) }))
  const loopOptions = (): ChoiceOption[] => [{ id: NONE, name: text.options.none }, ...engine.registry.loopIds().map((id) => ({ id, name: nameOf(id) }))]

  // the listener is the host camera; without a host (a test) it stands at the origin looking along -z
  const listener = (): { position: Vec3; yaw: number } => {
    const camera = host?.camera as Camera | undefined
    const three = host?.THREE as ThreeLike | undefined
    if (typeof camera?.getWorldDirection !== 'function' || typeof three?.Vector3 !== 'function' || !camera.position) return { position: [0, 0, 0], yaw: 0 }
    const direction = camera.getWorldDirection(new three.Vector3())
    return { position: [camera.position.x, camera.position.y, camera.position.z], yaw: Math.atan2(-direction.x, -direction.z) }
  }

  const probePosition = (): Vec3 | undefined => {
    const scene = host?.scene as ProbeObject | undefined
    const three = host?.THREE as ThreeLike | undefined
    if (typeof scene?.traverse !== 'function' || typeof three?.Vector3 !== 'function') return undefined
    let found: Vec3 | undefined
    scene.traverse((object) => {
      if (found || object.userData?.[PROBE_ID] !== true) return
      const at = object.getWorldPosition(new three.Vector3())
      found = [at.x, at.y, at.z]
    })
    return found
  }

  // `bearing` is degrees to the right of straight ahead
  const sourceAt = (ears: { position: Vec3; yaw: number }): Vec3 => {
    const probe = state.source === 'probe' ? probePosition() : undefined
    if (probe) return probe
    const bearing = (state.bearing * Math.PI) / 180
    const forward = [-Math.sin(ears.yaw), -Math.cos(ears.yaw)] as const
    const right = [Math.cos(ears.yaw), -Math.sin(ears.yaw)] as const
    return [ears.position[0] + state.distance * (forward[0] * Math.cos(bearing) + right[0] * Math.sin(bearing)), ears.position[1], ears.position[2] + state.distance * (forward[1] * Math.cos(bearing) + right[1] * Math.sin(bearing))]
  }

  const playOptions = (): { position?: Vec3; distance?: number; volume: number; seed: number } => {
    const ears = listener()
    engine.setListener(ears)
    const at = sourceAt(ears)
    const distance = Math.hypot(at[0] - ears.position[0], at[2] - ears.position[2])
    return { ...(state.panning ? { position: at } : { distance }), volume: state.volume, seed: state.seed }
  }

  // no muffling: the recipe's cutoff divisor is switched off for the one call
  const withMuffling = <T>(id: string, run: () => T): T => {
    const falloff = engine.registry.sound(id)?.falloff
    if (state.muffling || !falloff || falloff.model !== 'inverse_square' || falloff.cutoffK === undefined) return run()
    engine.registry.patch(id, { falloff: { cutoffK: 0 } })
    try {
      return run()
    } finally {
      engine.registry.patch(id, { falloff: { cutoffK: falloff.cutoffK } })
    }
  }

  const play = (): VoiceHandle | null => {
    engine.unlock()
    const chosen = state.sound
    return withMuffling(chosen, () => engine.play(chosen, playOptions()))
  }

  const plan = (): SoundPlan | null => {
    const chosen = state.sound
    return withMuffling(chosen, () => engine.plan(chosen, playOptions()))
  }

  const sheet = (): string => {
    const planned = plan()
    if (!planned) return `${text.sheet.title}: ${engine.registry.sound(state.sound) ? text.sheet.silent : text.sheet.none}`
    const head = `${text.sheet.title}: ${planned.id} (${planned.bus}) ${text.sheet.level} ${planned.level.toFixed(4)} ${text.sheet.distance} ${planned.distance.toFixed(1)} m` + `${planned.pan === undefined ? '' : ` ${text.sheet.pan} ${planned.pan.toFixed(3)}`} ${planned.length.toFixed(3)} ${text.sheet.length}`
    const layers = planned.layers.map((layer, index) => {
      const source = layer.source.kind === 'noise' ? `noise@${layer.source.offset.toFixed(4)}` : layer.source.kind === 'osc' ? `${layer.source.wave}@${layer.source.frequency.value ?? layer.source.frequency.from}` : layer.source.kind
      const filters = (layer.filters?.bank ?? []).map((filter) => `${filter.type}@${(filter.frequency.value ?? filter.frequency.from ?? 0).toFixed(1)}`).join(' ')
      const envelope = layer.envelope.map((point) => `${point.time.toFixed(3)}:${point.value.toPrecision(3)}`).join(' ')
      return `  ${text.sheet.layer} ${index + 1}: ${source} at ${layer.at.toFixed(3)} for ${layer.duration.toFixed(3)} ${filters} [${envelope}]`
    })
    return [head, ...layers].join('\n')
  }

  const applyMix = (): void => {
    const profile = engine && MIX_PROFILES[state.mix]
    if (profile) engine.setMix(variantOf(profile, state.reverb, state.compressor))
  }

  const setLoop = (): void => {
    loop?.stop()
    loop = undefined
    if (state.loop === NONE) return
    engine.unlock()
    loop = engine.loop(state.loop)
    loop.set({ volume: state.loopLevel, ...(state.loopPitch > 0 ? { frequency: state.loopPitch } : {}) })
  }

  const storm = (): void => {
    engine.unlock()
    const base = playOptions()
    const chosen = state.sound
    for (let index = 0; index < STORM; index++) {
      const spread = base.position ? { position: [base.position[0] + (index - STORM / 2), base.position[1], base.position[2]] as Vec3 } : {}
      withMuffling(chosen, () => engine.play(chosen, { ...base, ...spread, seed: state.seed + index }))
    }
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      if (change.id === 'reverb' || change.id === 'compressor') {
        state[change.id] = change.on
        applyMix()
      } else if (change.id === 'panning' || change.id === 'muffling') state[change.id] = change.on
      return
    }
    if (change.kind === 'action') {
      if (change.id === 'play') play()
      else if (change.id === 'voice_storm') storm()
      return
    }
    const { id, value } = change
    if (id === 'sound' && typeof value === 'string') state.sound = value
    else if (id === 'distance' && typeof value === 'string') state.distance = Number(value)
    else if (id === 'bearing' && typeof value === 'number') state.bearing = value
    else if (id === 'volume' && typeof value === 'number') state.volume = value
    else if (id === 'seed' && typeof value === 'number') state.seed = value
    else if (id === 'source' && typeof value === 'string') state.source = value
    else if (id === 'mix' && typeof value === 'string') {
      state.mix = value
      applyMix()
    } else if (id === 'loop' && typeof value === 'string') {
      state.loop = value
      setLoop()
    } else if (id === 'loop_level' && typeof value === 'number') {
      state.loopLevel = value
      loop?.set({ volume: value })
    } else if (id === 'loop_pitch' && typeof value === 'number') {
      state.loopPitch = value
      if (value > 0) loop?.set({ frequency: value })
    }
  }

  const items = (): TestableItem[] => {
    const probe = options.probe
    if (!probe) return []
    return [
      {
        id: PROBE_ID,
        name: text.probe,
        movable: false,
        build: (THREE) => {
          const root = probe(THREE) as { userData?: Record<string, unknown> }
          root.userData = root.userData ?? {}
          root.userData[PROBE_ID] = true
          return root
        },
      },
    ]
  }

  const controls = (): ModuleControl[] => [
    { kind: 'choice', id: 'sound', name: text.controls.sound, options: soundOptions(), default: state.sound },
    { kind: 'choice', id: 'source', name: text.controls.source, hint: text.hints.source, options: [{ id: 'bench', name: text.options.bench }, { id: 'probe', name: text.options.probe }], default: state.source },
    { kind: 'choice', id: 'distance', name: text.controls.distance, hint: text.hints.distance, options: DISTANCES.map((meters) => ({ id: String(meters), name: `${meters} m` })), default: String(state.distance) },
    { kind: 'number', id: 'bearing', name: text.controls.bearing, hint: text.hints.bearing, unit: '°', min: -180, max: 180, step: 15, default: state.bearing },
    { kind: 'number', id: 'volume', name: text.controls.volume, min: 0, max: 1, step: 0.05, default: state.volume },
    { kind: 'choice', id: 'mix', name: text.controls.mix, hint: text.hints.mix, options: Object.keys(MIX_PROFILES).map((id) => ({ id, name: text.mixes[id] ?? id })), default: state.mix },
    { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 1, max: 9999, step: 1, default: state.seed },
    { kind: 'action', id: 'play', name: text.controls.play },
    { kind: 'action', id: 'voice_storm', name: text.controls.voice_storm, hint: text.hints.voice_storm },
    { kind: 'choice', id: 'loop', name: text.controls.loop, options: loopOptions(), default: state.loop },
    { kind: 'number', id: 'loop_level', name: text.controls.loop_level, min: 0, max: 0.6, step: 0.01, default: state.loopLevel },
    { kind: 'number', id: 'loop_pitch', name: text.controls.loop_pitch, hint: text.hints.loop_pitch, unit: 'Hz', min: 0, max: 400, step: 5, default: state.loopPitch },
  ]

  const layers = (): ModuleLayer[] => (['reverb', 'compressor', 'panning', 'muffling'] as const).map((id) => ({ id, name: text.layers[id] }))

  const metrics = (): ModuleMetric[] => [
    { id: 'voices', name: text.metrics.voices, digits: 0, read: () => engine.stats().voices },
    { id: 'peak', name: text.metrics.peak, digits: 0, max: engine.stats().maxVoices > 0 && Number.isFinite(engine.stats().maxVoices) ? engine.stats().maxVoices : undefined, read: () => engine.stats().peak },
    { id: 'dropped', name: text.metrics.dropped, digits: 0, read: () => engine.stats().dropped },
    { id: 'loops', name: text.metrics.loops, digits: 0, read: () => engine.stats().loops },
    { id: 'context', name: text.metrics.context, read: () => engine.stats().context },
    { id: 'plan_length', name: text.metrics.plan_length, unit: 's', digits: 2, read: () => plan()?.length ?? 0 },
    { id: 'plan_level', name: text.metrics.plan_level, digits: 3, read: () => plan()?.level ?? 0 },
    { id: 'plan_pan', name: text.metrics.plan_pan, digits: 2, read: () => plan()?.pan ?? 0 },
    ...BUS_IDS.map((bus) => ({ id: `level_${bus}`, name: text.metrics[`level_${bus}` as keyof AudioBenchText['metrics']], digits: 3, read: () => engine.level(bus as BusId) })),
  ]

  const scenarios = (): Array<ModuleScenario<AudioScenarioLike>> => [
    {
      id: 'panning',
      name: text.scenarios.panning,
      run: ({ expect }) => {
        engine.setListener({ position: [0, 0, 0], yaw: 0 })
        const pan = (at: Vec3): number => engine.plan('bench_ping', { position: at })?.pan ?? Number.NaN
        expect(pan([10, 0, 0]) > 0.3, 'a sound to the right pans right', { pan: pan([10, 0, 0]) })
        expect(pan([-10, 0, 0]) < -0.3, 'a sound to the left pans left', { pan: pan([-10, 0, 0]) })
        expect(Math.abs(pan([0, 0, -10])) < 0.05, 'a sound ahead stays in the middle', { pan: pan([0, 0, -10]) })
        engine.setListener({ position: [0, 0, 0], yaw: Math.PI / 2 })
        expect(pan([0, 0, -10]) > 0.3, 'turning the listener left puts what was ahead on the right', { pan: pan([0, 0, -10]) })
        engine.setListener(listener())
      },
    },
    {
      id: 'distance',
      name: text.scenarios.distance,
      run: ({ expect }) => {
        const levels = [0, 10, 40, 100].map((meters) => engine.plan('bench_ping', { distance: meters })?.level ?? Number.NaN)
        expect(levels.every((level, index) => index === 0 || level < (levels[index - 1] as number)), 'the level falls with the distance', { levels })
        const far = engine.registry.sound('sfx_pistol') ? engine.plan('sfx_pistol', { distance: 400 }) : null
        expect(far === null, 'a game noise class is not played too far to be heard')
      },
    },
    {
      id: 'determinism',
      name: text.scenarios.determinism,
      run: ({ expect }) => {
        const a = engine.plan('bench_hiss', { seed: 5 })
        const b = engine.plan('bench_hiss', { seed: 5 })
        const c = engine.plan('bench_hiss', { seed: 6 })
        expect(JSON.stringify(a) === JSON.stringify(b), 'the same seed gives the same plan')
        expect(JSON.stringify(a) !== JSON.stringify(c), 'another seed gives another plan')
      },
    },
    {
      id: 'limiter',
      name: text.scenarios.limiter,
      run: ({ expect }) => {
        const voices = createVoiceManager({ maxVoices: 8 })
        const request = (group?: string) => voices.request({ ...(group ? { group } : {}), priority: 3, gain: 0.5, distance: 5, length: 1 })
        const grouped = Array.from({ length: STORM }, () => request('undead_voice')).filter((decision) => decision.accepted).length
        expect(grouped === 1, 'the group cooldown lets one voice of a storm through', { accepted: grouped })
        const plain = Array.from({ length: STORM }, () => request()).filter((decision) => decision.accepted).length
        expect(plain <= 8, 'the global cap holds the rest', { accepted: plain })
      },
    },
  ]

  const area = (): { placements: AreaPlacement[]; view: { eye: Vec3; target: Vec3 } } => ({
    placements: options.probe ? [{ item: PROBE_ID, position: PROBE_AT, asleep: true }] : [],
    view: { eye: [0, 1.7, 3], target: [0, 1.4, -10] },
  })

  const module: AudioTestModule = {
    id: 'audio_area',
    name: text.name,
    ground: { surface: 'concrete_slab' },
    group: text.group,
    get engine() {
      return engine
    },
    items: () => items(),
    area: () => area(),
    controls: () => controls(),
    layers: () => layers(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    sheet,
    play,
    attach(lent) {
      host = lent
      const shared = (lent.audio as EngineSink | undefined)?.engine
      if (shared && shared !== engine) {
        for (const bank of banks) shared.register(bank)
        engine = shared
      }
      // buses get their nodes now, so the level meters see every sound
      for (const bus of BUS_IDS) {
        engine.setBus(bus, {})
        engine.level(bus)
      }
      lent.bench?.patch('sound', { options: soundOptions() })
      lent.bench?.patch('loop', { options: loopOptions() })
      const off = lent.bench?.onChange(onChange)
      const offFrame = lent.onFrame(() => {
        if (!shared) engine.setListener(listener())
      })
      return () => {
        off?.()
        offFrame()
        loop?.stop()
        loop = undefined
        host = null
      }
    },
  }
  return module
}
