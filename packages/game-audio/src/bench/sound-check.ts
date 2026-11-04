import type { AreaPlacement, BenchChange, ChoiceOption, ModuleControl, ModuleHost, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'

import { SFX_BLOWS, SFX_CATALOG, SFX_CATEGORIES, SFX_IMPACTS, SFX_MATERIALS, impactSoundId, sfxState } from '../catalog'
import type { SfxBlow, SfxEntry, SfxMaterial, SfxState } from '../catalog'
import { CALIBRATION_ID, CALIBRATION_LOOP_ID, CALIBRATION_LOOP_SOUND, CALIBRATION_SOUND, calibrationLoader, isCalibrationUrl } from '../measure/calibration'
import { CRITERIA, measureCriteria, recordOutput } from '../measure/criteria'
import type { ActionCheck, CriterionId, CriterionResult } from '../measure/criteria'
import type { LoopRecipe, SampleSound, SoundBank, SoundRecipe } from '../recipe'
import { GAME_SFX_BANK } from '../recipes/noise-class'
import { SAMPLE_ENVIRONMENTS } from '../sample'
import type { SampleEnvironment } from '../sample'
import { createAudioEngine } from '../webaudio/engine'
import type { AudioEngine, PlayOptions, VoiceHandle, VoiceStartEvent } from '../webaudio/engine'
import { fetchLoader } from '../webaudio/sample-store'
import type { SampleLoader } from '../webaudio/sample-store'
import type { EngineSink } from '../webaudio/sink'
import type { AudioScenarioLike } from './module'
import { USER_SOUND_PREFIX, soundSourceOf } from '../user-samples'
import { soundCheckTextOf } from './sound-check-locale'
import type { SoundCheckText } from './sound-check-locale'

export { soundCheckTextOf } from './sound-check-locale'
export type { SoundCheckText } from './sound-check-locale'

export const SOUND_STRENGTHS = { light: 0.1, medium: 0.5, heavy: 0.9 } as const
export type SoundStrength = keyof typeof SOUND_STRENGTHS
export const CALIBRATION_CATEGORY = 'calibracao'

export type SoundCheckModuleOptions = {
  /** Banks with sample sounds to try (the calibration sound is always there); registered in the host's engine when it lends one. */
  readonly banks?: readonly SoundBank[]
  /** Where the files of those banks come from (default `fetch`). */
  readonly loader?: SampleLoader
  /** The engine to use (default the host's in `host.audio`, else a new one). */
  readonly engine?: AudioEngine
  readonly locale?: string
  /** First sound chosen (default the calibration sound). */
  readonly sound?: string
  /** The sounds by category (default the kit's catalogue, `SFX_CATALOG` and the impact matrix). */
  readonly catalog?: readonly SfxEntry[]
  /** C2: the actions and the sounds they must play, per sound id. */
  readonly actions?: Readonly<Record<string, readonly ActionCheck[]>>
  /** C6: sound ids loudest first. */
  readonly loudnessOrder?: readonly string[]
  /** Draws the source of the sound in the area (a portable radio of the items catalogue, say). Without it no source is drawn. */
  readonly probe?: (THREE: unknown) => unknown
  /** Draws the wall that goes between the listener and the source (a house wall of the floorplan renderer). Without it no wall is drawn. */
  readonly wall?: (THREE: unknown) => unknown
}

export type SoundCheckModule = TestableModule<AudioScenarioLike> & {
  readonly engine: AudioEngine
  /** Measures the chosen sound (every criterion) and keeps the results for the bench. */
  measure(): Promise<readonly CriterionResult[]>
  results(): readonly CriterionResult[]
  /** Every voice the engine started while the module was attached (the event log of C1/C2). */
  events(): readonly VoiceStartEvent[]
  /** Plays the chosen sound (its file when there is one, else the current sound). */
  play(): VoiceHandle | null
  /** The A/B pair of the chosen sound: the current (synthesized) id and the new (file) id. */
  pair(): { readonly a: string | null; readonly b: string | null }
  /** The preferences given (`sound → 'A' | 'B'`). */
  verdicts(): Readonly<Record<string, 'A' | 'B'>>
  /** The sounds whose C10 the owner approved. */
  approvals(): readonly string[]
}

const CALIBRATION_BANK: SoundBank = { id: 'calibration', samples: [CALIBRATION_SOUND, CALIBRATION_LOOP_SOUND] }
const DISTANCES = [1, 10, 50, 200] as const
const PROBE_ID = 'sound_check_source'
const WALL_ID = 'sound_check_wall'
const EYE: Vec3 = [0, 1.7, 3]
// the source is drawn at most this far (the arena is ~14 m); the sound plays at the real distance
const DRAWN_MAX = 11
const WALL_AT = -2.5
const LOG_LIMIT = 200

type Ears = { readonly position: Vec3; readonly yaw: number }
type Camera = { readonly position: { readonly x: number; readonly y: number; readonly z: number }; getWorldDirection(target: unknown): { readonly x: number; readonly z: number } }
type ThreeLike = { Vector3: new () => unknown }
type Placed = { userData?: Record<string, unknown>; visible?: boolean; position?: { set(x: number, y: number, z: number): void }; traverse(visit: (object: Placed) => void): void }

/**
 * The sound panel of the test room, in the five blocks the owner approved: (1) the sounds of each category with their state (file, synthesized, missing),
 * (2) the material × blow matrix, (3) where and how it plays (distance, bearing, indoor or outdoor, strength, behind the house wall, a burst), (4) A/B of the
 * current sound against the new file (alternating and blind, with the preference kept) and (5) the measurement of C1–C10 with a 3 s recording and the
 * owner's approval for C10. It uses the host's engine (every bank of the room) and lends it the calibration takes.
 */
export function createSoundCheckModule(options: SoundCheckModuleOptions = {}): SoundCheckModule {
  const locale = options.locale ?? 'pt-BR'
  const text: SoundCheckText = soundCheckTextOf(locale)
  const ownBanks: SoundBank[] = [CALIBRATION_BANK, ...(options.banks ?? [])]
  const loader = calibrationLoader(options.loader ?? fetchLoader())
  const log: VoiceStartEvent[] = []
  const catalog: readonly SfxEntry[] = options.catalog ?? [...SFX_CATALOG, ...SFX_IMPACTS]
  let engine: AudioEngine = options.engine ?? createAudioEngine({ banks: [GAME_SFX_BANK, ...ownBanks], samples: { loader } })
  if (options.engine) for (const bank of ownBanks) engine.register(bank)
  let host: ModuleHost | null = null
  let results: CriterionResult[] = []
  let run: keyof SoundCheckText['run'] = 'idle'
  const verdicts: Record<string, 'A' | 'B'> = {}
  const approvals = new Set<string>()
  let blind: { readonly side: 'A' | 'B'; revealed: boolean } | null = null
  const chosen = {
    category: options.sound && options.sound !== CALIBRATION_ID ? (catalog.find((entry) => entry.id === options.sound)?.category ?? CALIBRATION_CATEGORY) : CALIBRATION_CATEGORY,
    sound: options.sound ?? CALIBRATION_ID,
    material: 'concrete' as SfxMaterial,
    blow: 'bullet' as SfxBlow,
    distance: 10,
    bearing: 0,
    environment: 'outdoor' as SampleEnvironment,
    strength: 'medium' as SoundStrength,
    wall: false,
  }

  const registry = () => engine.registry
  const entryOf = (id: string): SfxEntry | undefined => catalog.find((entry) => entry.id === id)
  const stateOf = (id: string): SfxState => {
    const entry = entryOf(id)
    if (entry) return sfxState(entry, registry())
    return registry().sample(id) ? 'file' : registry().sound(id) ? 'synth' : 'missing'
  }
  /** A = what plays today (the synthesized recipe), B = the file. */
  const pairOf = (id: string): { a: string | null; b: string | null } => {
    const entry = entryOf(id)
    const sample = registry().sample(id)
    const current = entry?.current ?? sample?.fallback ?? (registry().sound(id) ? id : undefined)
    return { a: current && registry().sound(current) ? current : null, b: sample ? id : null }
  }

  const soundsOf = (category: string): string[] => {
    if (category === CALIBRATION_CATEGORY) return registry().sampleIds().filter((id) => !entryOf(id))
    return catalog.filter((entry) => entry.category === category).map((entry) => entry.id)
  }
  const sourceOfId = (id: string): string => {
    const state = stateOf(id)
    if (state !== 'file') return text.states[state]
    const own = registry().sample(`${USER_SOUND_PREFIX}${id}`) ? ' +seu' : ''
    return `${text.states.file} ${text.sources[soundSourceOf({ kind: 'sample', bank: registry().bankOf(id) })]}${own}`
  }
  const label = (id: string): string => {
    const entry = entryOf(id)
    return `${id}${entry ? ` · P${entry.priority}` : ''} · ${sourceOfId(id)}`
  }
  const soundOptions = (): ChoiceOption[] => soundsOf(chosen.category).map((id) => ({ id, name: label(id) }))

  // the listener is the host camera; without one it stands at the eye of the area, looking along −z
  const listener = (): Ears => {
    const camera = host?.camera as Camera | undefined
    const three = host?.THREE as ThreeLike | undefined
    if (typeof camera?.getWorldDirection !== 'function' || typeof three?.Vector3 !== 'function' || !camera.position) return { position: EYE, yaw: 0 }
    const direction = camera.getWorldDirection(new three.Vector3())
    return { position: [camera.position.x, camera.position.y, camera.position.z], yaw: Math.atan2(-direction.x, -direction.z) }
  }
  // `bearing` is degrees to the right of straight ahead
  const offset = (ears: Ears, distance: number): Vec3 => {
    const bearing = (chosen.bearing * Math.PI) / 180
    const forward = [-Math.sin(ears.yaw), -Math.cos(ears.yaw)] as const
    const right = [Math.cos(ears.yaw), -Math.sin(ears.yaw)] as const
    return [ears.position[0] + distance * (forward[0] * Math.cos(bearing) + right[0] * Math.sin(bearing)), ears.position[1], ears.position[2] + distance * (forward[1] * Math.cos(bearing) + right[1] * Math.sin(bearing))]
  }
  const playOptions = (extra: PlayOptions = {}): PlayOptions => {
    const ears = listener()
    engine.setListener(ears)
    return { position: offset(ears, chosen.distance), environment: chosen.environment, intensity: SOUND_STRENGTHS[chosen.strength], occlusion: chosen.wall ? 1 : 0, ...extra }
  }

  const playId = (id: string | null, extra: PlayOptions = {}): VoiceHandle | null => {
    if (!id) return null
    engine.unlock()
    return engine.play(id, playOptions(extra))
  }
  const preferred = (id: string): string | null => pairOf(id).b ?? pairOf(id).a ?? (registry().sound(id) ? id : null)
  const play = (): VoiceHandle | null => playId(preferred(chosen.sound))
  // B is the file: while its files load a sample sound plays its fallback, so B waits for them
  const playB = async (delay = 0): Promise<void> => {
    const { b } = pairOf(chosen.sound)
    if (!b) return
    if (engine.sampleStatus(b) !== 'ready') await engine.loadSamples([b])
    playId(b, { delay })
  }
  // the owner's take of the chosen sound (`user:<id>`), loaded first: it has no recipe to stand in while it loads
  const playUser = async (): Promise<void> => {
    const own = `${USER_SOUND_PREFIX}${chosen.sound}`
    if (!registry().sample(own)) return
    if (engine.sampleStatus(own) !== 'ready') await engine.loadSamples([own])
    playId(own)
  }
  const playA = (delay = 0): void => void playId(pairOf(chosen.sound).a, { delay })

  // the source and the wall drawn in the area follow the bench: the source at the bearing and distance (drawn at most DRAWN_MAX m), the wall only when asked
  const placeScenery = (): void => {
    const scene = host?.scene as Placed | undefined
    if (typeof scene?.traverse !== 'function') return
    const at = offset({ position: EYE, yaw: 0 }, Math.min(chosen.distance, DRAWN_MAX))
    scene.traverse((object) => {
      if (object.userData?.[PROBE_ID] === true) object.position?.set(at[0], 0, at[2])
      if (object.userData?.[WALL_ID] === true) object.visible = chosen.wall
    })
  }

  const measure = async (): Promise<readonly CriterionResult[]> => {
    run = 'measuring'
    try {
      engine.unlock()
      const context = (engine.output()?.context as AudioContext | undefined) ?? null
      // the measuring engines get every sound of this engine, so the fallbacks and the order of C6 are the room's
      const bank: SoundBank = {
        id: 'measured',
        sounds: registry().soundIds().map((id) => registry().sound(id)).filter((recipe): recipe is SoundRecipe => recipe !== undefined),
        loops: registry().loopIds().map((id) => registry().loop(id)).filter((recipe): recipe is LoopRecipe => recipe !== undefined),
        samples: registry().sampleIds().map((id) => registry().sample(id)).filter((sample): sample is SampleSound => sample !== undefined),
      }
      results = await measureCriteria({
        sound: chosen.sound,
        banks: [bank],
        loader,
        ...(context ? { baseLatency: context.baseLatency ?? 0, outputLatency: context.outputLatency ?? 0 } : {}),
        ...(options.actions?.[chosen.sound] ? { actions: options.actions[chosen.sound] as readonly ActionCheck[] } : {}),
        ...(options.loudnessOrder ? { loudnessOrder: options.loudnessOrder } : {}),
      })
      if (approvals.has(chosen.sound)) results = results.map((result) => (result.id === 'C10' ? { ...result, pass: true, value: text.words.approved } : result))
      run = 'done'
    } catch (error) {
      run = 'failed'
      results = [{ id: 'C1', pass: false, value: error instanceof Error ? error.message : String(error), target: '' }]
    }
    ;(globalThis as { __soundCheck?: unknown }).__soundCheck = { sound: chosen.sound, results }
    return results
  }

  const record = async (): Promise<void> => {
    run = 'recording'
    const blob = await recordOutput(engine, 3, () => {
      for (let index = 0; index < 4; index++) playId(preferred(chosen.sound), { delay: index * 0.6 })
    })
    const documentLike = (globalThis as { document?: Document }).document
    if (blob && documentLike && typeof URL.createObjectURL === 'function') {
      const link = documentLike.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${chosen.sound}-${chosen.environment}-${chosen.distance}m.webm`
      link.click()
      run = 'recorded'
    } else run = blob ? 'recorded' : 'failed'
  }

  const approve = (): void => {
    approvals.add(chosen.sound)
    results = results.map((result) => (result.id === 'C10' ? { ...result, pass: true, value: text.words.approved } : result))
    host?.log(`${chosen.sound}: C10 ${text.words.approved}`, { sound: chosen.sound }, 'sound')
  }
  const prefer = (side: 'A' | 'B'): void => {
    verdicts[chosen.sound] = side
    const pair = pairOf(chosen.sound)
    host?.log(`${chosen.sound}: ${text.words.prefers} ${side}`, { sound: chosen.sound, prefers: side, a: pair.a, b: pair.b }, 'sound')
  }

  const controls = (): ModuleControl[] => [
    { kind: 'choice', id: 'category', name: text.controls.category, options: [...SFX_CATEGORIES, CALIBRATION_CATEGORY].map((id) => ({ id, name: text.categories[id] ?? id })), default: chosen.category },
    { kind: 'choice', id: 'sound', name: text.controls.sound, hint: text.hints.sound, options: soundOptions(), default: chosen.sound },
    { kind: 'action', id: 'play', name: text.controls.play },
    { kind: 'action', id: 'play_user', name: text.controls.play_user, hint: text.hints.play_user },
    { kind: 'choice', id: 'material', name: text.controls.material, options: SFX_MATERIALS.map(([id]) => ({ id, name: text.materials[id] })), default: chosen.material },
    { kind: 'choice', id: 'blow', name: text.controls.blow, options: SFX_BLOWS.map((id) => ({ id, name: text.blows[id] })), default: chosen.blow },
    { kind: 'action', id: 'strike', name: text.controls.strike, hint: text.hints.strike },
    { kind: 'choice', id: 'distance', name: text.controls.distance, options: DISTANCES.map((meters) => ({ id: String(meters), name: `${meters} m` })), default: String(chosen.distance) },
    { kind: 'number', id: 'bearing', name: text.controls.bearing, unit: '°', min: -180, max: 180, step: 15, default: chosen.bearing },
    { kind: 'choice', id: 'environment', name: text.controls.environment, options: SAMPLE_ENVIRONMENTS.map((id) => ({ id, name: text.environments[id] })), default: chosen.environment },
    { kind: 'choice', id: 'strength', name: text.controls.strength, options: (Object.keys(SOUND_STRENGTHS) as SoundStrength[]).map((id) => ({ id, name: text.strengths[id] })), default: chosen.strength },
    { kind: 'boolean', id: 'wall', name: text.controls.wall, hint: text.hints.wall, default: chosen.wall },
    { kind: 'action', id: 'burst', name: text.controls.burst, hint: text.hints.burst },
    { kind: 'action', id: 'play_a', name: text.controls.play_a },
    { kind: 'action', id: 'play_b', name: text.controls.play_b },
    { kind: 'action', id: 'ab_cycle', name: text.controls.ab_cycle, hint: text.hints.ab_cycle },
    { kind: 'action', id: 'blind', name: text.controls.blind, hint: text.hints.blind },
    { kind: 'action', id: 'reveal', name: text.controls.reveal },
    { kind: 'action', id: 'prefer_a', name: text.controls.prefer_a },
    { kind: 'action', id: 'prefer_b', name: text.controls.prefer_b },
    { kind: 'action', id: 'measure', name: text.controls.measure, hint: text.hints.measure },
    { kind: 'action', id: 'record', name: text.controls.record, hint: text.hints.record },
    { kind: 'action', id: 'approve', name: text.controls.approve, hint: text.hints.approve },
  ]

  const line = (id: CriterionId): string => {
    const result = results.find((entry) => entry.id === id)
    if (!result) return text.words.none
    return `${result.pass === null ? '◌' : result.pass ? '✓' : '✗'} ${result.value}`
  }
  const counts = (): string => {
    const states = catalog.map((entry) => sfxState(entry, registry()))
    const count = (state: SfxState): number => states.filter((each) => each === state).length
    return `${text.states.file} ${count('file')} · ${text.states.synth} ${count('synth')} · ${text.states.missing} ${count('missing')}`
  }
  const strikeId = (): string => impactSoundId(chosen.material, chosen.blow)
  const lastLine = (): string => {
    const last = log.at(-1)
    if (!last) return text.words.none
    const files = last.layers?.map((layer) => layer.url.split('/').pop()).join('+') ?? ''
    return `${last.kind}:${last.fallbackOf ? `${last.fallbackOf}→` : ''}${last.id}${last.tier ? `/${last.tier}` : ''} ${files}`.trim()
  }
  /** Who answered the last voice: the SDK's file, the owner's file or the synthesized recipe, with the file played. */
  const sourceLine = (): string => {
    const last = log.at(-1)
    if (!last) return text.words.none
    const file = last.layers?.find((layer) => layer.role === 'close')?.url.split('/').pop() ?? last.id
    return `${text.sources[soundSourceOf(last)]} · ${last.id.replace(USER_SOUND_PREFIX, '')} · ${file}`
  }

  const metrics = (): ModuleMetric[] => [
    { id: 'source', name: text.metrics.source, read: sourceLine },
    { id: 'count', name: text.metrics.count, read: counts },
    { id: 'chosen', name: text.metrics.chosen, read: () => `${label(chosen.sound)}${registry().sample(chosen.sound) ? ` (${engine.sampleStatus(chosen.sound)})` : ''}` },
    { id: 'matrix', name: text.metrics.matrix, read: () => `${strikeId()} · ${text.states[stateOf(strikeId())]}${pairOf(strikeId()).a ? ` · A=${pairOf(strikeId()).a}` : ''}` },
    { id: 'ab', name: text.metrics.ab, read: () => `A ${pairOf(chosen.sound).a ?? text.words.none} · B ${pairOf(chosen.sound).b ?? text.words.none}` },
    { id: 'blind_state', name: text.metrics.blind, read: () => (!blind ? text.words.none : blind.revealed ? `X = ${blind.side}` : text.words.hidden) },
    { id: 'verdicts', name: text.metrics.verdicts, read: () => Object.entries(verdicts).map(([id, side]) => `${id} ${text.words.prefers} ${side}`).join('; ') || text.words.none },
    { id: 'last', name: text.metrics.last, read: lastLine },
    { id: 'state', name: text.metrics.state, read: () => text.run[run] },
    ...CRITERIA.map((id) => ({ id: `criterion_${id.toLowerCase()}`, name: text.criteria[id], read: () => line(id) })),
  ]

  const act = (id: string): void => {
    if (id === 'play') play()
    else if (id === 'play_user') void playUser()
    else if (id === 'strike') playId(preferred(strikeId()))
    else if (id === 'burst') for (let index = 0; index < 20; index++) playId(preferred(chosen.sound), { delay: index * 0.06 })
    else if (id === 'play_a') playA()
    else if (id === 'play_b') void playB()
    else if (id === 'ab_cycle') {
      playA(0)
      void playB(1).then(() => {
        playA(2)
        return playB(3)
      })
    } else if (id === 'blind') {
      const side = Math.random() < 0.5 ? 'A' : 'B'
      blind = { side, revealed: false }
      if (side === 'A') playA()
      else void playB()
    } else if (id === 'reveal' && blind) blind.revealed = true
    else if (id === 'prefer_a') prefer('A')
    else if (id === 'prefer_b') prefer('B')
    else if (id === 'measure') void measure()
    else if (id === 'record') void record()
    else if (id === 'approve') approve()
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'action') return act(change.id)
    if (change.kind !== 'control') return
    const { id, value } = change
    if (id === 'category' && typeof value === 'string') {
      chosen.category = value
      const first = soundsOf(value)[0]
      if (first) chosen.sound = first
      host?.bench?.patch('sound', { options: soundOptions(), value: chosen.sound })
      results = []
    } else if (id === 'sound' && typeof value === 'string') {
      chosen.sound = value
      results = []
      if (registry().sample(value)) void engine.loadSamples([value])
    } else if (id === 'material' && typeof value === 'string') chosen.material = value as SfxMaterial
    else if (id === 'blow' && typeof value === 'string') chosen.blow = value as SfxBlow
    else if (id === 'distance' && typeof value === 'string') chosen.distance = Number(value)
    else if (id === 'bearing' && typeof value === 'number') chosen.bearing = value
    else if (id === 'environment' && (value === 'indoor' || value === 'outdoor')) chosen.environment = value
    else if (id === 'strength' && typeof value === 'string' && value in SOUND_STRENGTHS) chosen.strength = value as SoundStrength
    else if (id === 'wall' && typeof value === 'boolean') chosen.wall = value
    placeScenery()
  }

  const items = (): TestableItem[] => {
    const marked = (id: string, name: string, build: (THREE: unknown) => unknown): TestableItem => ({
      id,
      name,
      movable: false,
      build: (THREE) => {
        const root = build(THREE) as { userData?: Record<string, unknown> }
        root.userData = root.userData ?? {}
        root.userData[id] = true
        return root
      },
    })
    return [...(options.probe ? [marked(PROBE_ID, text.probe, options.probe)] : []), ...(options.wall ? [marked(WALL_ID, text.wall, options.wall)] : [])]
  }

  const area = (): { placements: AreaPlacement[]; view: { eye: Vec3; target: Vec3 } } => ({
    placements: [
      ...(options.probe ? [{ item: PROBE_ID, position: offset({ position: EYE, yaw: 0 }, Math.min(chosen.distance, DRAWN_MAX)), asleep: true }] : []),
      ...(options.wall ? [{ item: WALL_ID, position: [0, 0, WALL_AT] as Vec3, asleep: true }] : []),
    ],
    view: { eye: EYE, target: [0, 1.2, -8] },
  })

  const scenarios = (): Array<ModuleScenario<AudioScenarioLike>> => [
    {
      id: 'sample_pipeline',
      name: text.scenarios.pipeline,
      run: async ({ expect }) => {
        const report = await engine.loadSamples([CALIBRATION_ID])
        expect(report.failed.length === 0 && engine.sampleStatus(CALIBRATION_ID) === 'ready', 'the calibration files load and decode', { failed: report.failed })
        // the voices of these six plays, watched on their own: the bench log keeps only its last LOG_LIMIT voices, so after a room full of sounds an
        // index into it no longer points at these
        const started: VoiceStartEvent[] = []
        const offStarted = engine.watchVoices((event) => void started.push(event))
        const handles = Array.from({ length: 6 }, (_, index) => engine.play(CALIBRATION_ID, { distance: 2, environment: index % 2 === 0 ? 'indoor' : 'outdoor' }))
        offStarted()
        expect(handles.every((handle) => handle?.kind === 'sample'), 'it plays the files, not the fallback', { kinds: handles.map((handle) => handle?.kind) })
        const events = started.filter((event) => event.id === CALIBRATION_ID)
        const takes = events.map((event) => event.layers?.find((layer) => layer.role === 'close')?.url)
        expect(takes.length === 6 && takes.every((take, index) => index === 0 || take !== takes[index - 1]), 'never the same take twice in a row', { takes })
        const tails = events.map((event) => event.layers?.find((layer) => layer.role === 'tail')?.url ?? '')
        expect(tails[0]?.endsWith('tail_in.wav') === true && tails[1]?.endsWith('tail_out.wav') === true, 'the tail follows the place', { tails })
        for (const handle of handles) handle?.stop()
      },
    },
    {
      id: 'sample_criteria',
      name: text.scenarios.criteria,
      run: async ({ expect }) => {
        const previous = chosen.sound
        chosen.sound = CALIBRATION_ID
        const measured = await measure()
        chosen.sound = previous
        for (const result of measured) if (result.id !== 'C10') expect(result.pass === true, `${result.id}: ${result.target}`, { value: result.value, data: result.data })
      },
    },
    {
      id: 'sample_loop',
      name: text.scenarios.loop,
      run: async ({ expect }) => {
        const report = await engine.loadSamples([CALIBRATION_LOOP_ID])
        expect(report.failed.length === 0, 'the loop takes load and decode', { failed: report.failed })
        engine.unlock()
        // read the bus once first: its analyser only hears what starts after
        engine.level('ambience')
        const loop = engine.loop(CALIBRATION_LOOP_ID, { volume: 0.8 })
        const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
        // the seams are measured once the loop sounds: the context may still be resuming and the bus analyser filling (on a busy machine
        // the first reads come back 0 and read as a dip that is only the start)
        const started = performance.now()
        while (engine.level('ambience') < 0.01 && performance.now() - started < 2000) await wait(20)
        expect(performance.now() - started < 2000, 'the loop starts within 2 s', { ms: Math.round(performance.now() - started) })
        await wait(200)
        const levels: number[] = []
        // 2.4 s: four seams of 0.6 s takes
        for (let index = 0; index < 60; index++) {
          levels.push(engine.level('ambience'))
          await wait(40)
        }
        loop.stop()
        const sorted = [...levels].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0
        const lowest = sorted[0] ?? 0
        const dip = lowest > 0 && median > 0 ? 20 * Math.log10(lowest / median) : -Infinity
        expect(median > 0.01, 'the loop sounds', { median })
        expect(dip >= -6, 'no seam: the level never dips more than 6 dB where two takes cross', { dip: Number(dip.toFixed(1)), lowest, median, levels: levels.map((level) => Number(level.toFixed(3))) })
        await wait(200)
        expect(engine.level('ambience') < median / 4, 'stop silences it', { after: engine.level('ambience') })
      },
    },
    {
      id: 'sound_panel',
      name: text.scenarios.panel,
      run: ({ expect }) => {
        const categories = SFX_CATEGORIES.map((category) => soundsOf(category).length)
        expect(categories.every((count) => count > 0), 'every category lists its sounds', { categories })
        expect(soundsOf('impactos').length >= SFX_MATERIALS.length * SFX_BLOWS.length, 'the matrix has every material × blow')
        const pair = pairOf(CALIBRATION_ID)
        expect(pair.a === 'sfx_pistol' && pair.b === CALIBRATION_ID, 'A is the synthesized sound and B the file', pair)
        const clear = engine.planSample(CALIBRATION_ID, { position: [0, 1.6, -10], occlusion: 0, seed: 1 })
        const walled = engine.planSample(CALIBRATION_ID, { position: [0, 1.6, -10], occlusion: 1, seed: 1 })
        expect((walled?.cutoff ?? Infinity) < (clear?.cutoff ?? 0) / 5, 'behind the wall the sound is muffled', { clear: clear?.cutoff, walled: walled?.cutoff })
      },
    },
  ]

  return {
    id: 'sound_check_area',
    name: text.name,
    group: text.group,
    ground: { surface: 'concrete_slab' },
    get engine() {
      return engine
    },
    items: () => items(),
    area: () => area(),
    controls: () => controls(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    measure,
    results: () => results,
    events: () => log,
    play,
    pair: () => pairOf(chosen.sound),
    verdicts: () => ({ ...verdicts }),
    approvals: () => [...approvals],
    // the engine (and its context) is made on the first play or measure, not when the room loads the module
    attach(lent) {
      host = lent
      const shared = options.engine ? undefined : (lent.audio as EngineSink | undefined)?.engine
      if (shared && shared !== engine) {
        for (const bank of ownBanks) shared.register(bank)
        shared.addSampleSource(isCalibrationUrl, loader)
        engine = shared
      }
      const offVoices = engine.watchVoices((event) => {
        log.push(event)
        // the log keeps the last voices only (a burst a second would grow it for ever)
        if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT)
      })
      lent.bench?.patch('sound', { options: soundOptions() })
      const off = lent.bench?.onChange(onChange)
      placeScenery()
      return () => {
        off?.()
        offVoices()
        host = null
      }
    },
  }
}
