import type { BenchChange, ModuleControl, ModuleMetric, ModuleScenario, TestableModule, Vec3 } from '@adatechnology/game-contracts'

import { CALIBRATION_ID, CALIBRATION_SOUND, calibrationLoader } from '../measure/calibration'
import { CRITERIA, measureCriteria, recordOutput } from '../measure/criteria'
import type { ActionCheck, CriterionId, CriterionResult } from '../measure/criteria'
import type { SoundBank } from '../recipe'
import { GAME_SFX_BANK } from '../recipes/noise-class'
import { SAMPLE_ENVIRONMENTS } from '../sample'
import type { SampleEnvironment } from '../sample'
import { createAudioEngine } from '../webaudio/engine'
import type { AudioEngine, VoiceHandle, VoiceStartEvent } from '../webaudio/engine'
import { fetchLoader } from '../webaudio/sample-store'
import type { SampleLoader } from '../webaudio/sample-store'
import type { AudioScenarioLike } from './module'

export type SoundCheckText = {
  readonly group: string
  readonly name: string
  readonly controls: Readonly<Record<'sound' | 'environment' | 'intensity' | 'distance' | 'play' | 'measure' | 'record', string>>
  readonly hints: Readonly<Record<'measure' | 'record' | 'intensity', string>>
  readonly environments: Readonly<Record<SampleEnvironment, string>>
  readonly criteria: Readonly<Record<CriterionId, string>>
  readonly metrics: Readonly<Record<'status' | 'last' | 'state', string>>
  readonly states: Readonly<Record<'idle' | 'measuring' | 'done' | 'failed' | 'recording' | 'recorded', string>>
  readonly scenarios: Readonly<Record<'pipeline' | 'criteria', string>>
}

const PT: SoundCheckText = {
  group: 'Som',
  name: 'Medição dos sons (C1–C10)',
  controls: { sound: 'Som (arquivo)', environment: 'Lugar', intensity: 'Força', distance: 'Distância', play: 'Tocar', measure: 'Medir C1–C10', record: 'Gravar 3 s' },
  hints: {
    measure: 'Toca o som no motor real num contexto offline e mede sincronia, distância, lado, variação, volume, força, cauda e rajada.',
    record: 'Grava 3 s da saída do jogo com o som tocando e baixa o arquivo (C10: ouvido do dono).',
    intensity: '0 = golpe fraco, 1 = golpe forte: troca a camada de tomadas.',
  },
  environments: { indoor: 'Interior', outdoor: 'Exterior' },
  criteria: { C1: 'C1 Sincronia', C2: 'C2 Certo para a ação', C3: 'C3 Distância', C4: 'C4 Posição', C5: 'C5 Variação', C6: 'C6 Volume', C7: 'C7 Intensidade', C8: 'C8 Cauda', C9: 'C9 Rajada', C10: 'C10 Escuta' },
  metrics: { status: 'Arquivos', last: 'Último som', state: 'Medição' },
  states: { idle: 'parada', measuring: 'medindo…', done: 'pronta', failed: 'falhou', recording: 'gravando…', recorded: 'gravação baixada' },
  scenarios: { pipeline: 'Arquivo → decodifica → toca (round-robin, cauda)', criteria: 'Critérios C1–C9 no som de calibração' },
}

const EN: SoundCheckText = {
  group: 'Sound',
  name: 'Sound measurement (C1–C10)',
  controls: { sound: 'Sound (file)', environment: 'Place', intensity: 'Strength', distance: 'Distance', play: 'Play', measure: 'Measure C1–C10', record: 'Record 3 s' },
  hints: {
    measure: 'Plays the sound through the real engine on an offline context and measures sync, distance, side, variation, level, strength, tail and burst.',
    record: 'Records 3 s of the game output with the sound playing and downloads the file (C10: the owner’s ear).',
    intensity: '0 = light blow, 1 = heavy blow: switches the tier of takes.',
  },
  environments: { indoor: 'Indoor', outdoor: 'Outdoor' },
  criteria: { C1: 'C1 Sync', C2: 'C2 Right for the action', C3: 'C3 Distance', C4: 'C4 Position', C5: 'C5 Variation', C6: 'C6 Level', C7: 'C7 Strength', C8: 'C8 Tail', C9: 'C9 Burst', C10: 'C10 Listening' },
  metrics: { status: 'Files', last: 'Last sound', state: 'Measurement' },
  states: { idle: 'idle', measuring: 'measuring…', done: 'done', failed: 'failed', recording: 'recording…', recorded: 'recording downloaded' },
  scenarios: { pipeline: 'File → decode → play (round-robin, tail)', criteria: 'Criteria C1–C9 on the calibration sound' },
}

export const soundCheckTextOf = (locale: string): SoundCheckText => (locale.startsWith('en') ? EN : PT)

export type SoundCheckModuleOptions = {
  /** Banks with the sample sounds to measure (the calibration sound is always there). */
  readonly banks?: readonly SoundBank[]
  /** Where the files of those banks come from (default `fetch`). */
  readonly loader?: SampleLoader
  readonly locale?: string
  /** First sound chosen (default the calibration sound). */
  readonly sound?: string
  /** C2: the actions and the sounds they must play, per sound id. */
  readonly actions?: Readonly<Record<string, readonly ActionCheck[]>>
  /** C6: sound ids loudest first. */
  readonly loudnessOrder?: readonly string[]
}

export type SoundCheckModule = TestableModule<AudioScenarioLike> & {
  readonly engine: AudioEngine
  /** Measures the chosen sound (every criterion) and keeps the results for the bench. */
  measure(): Promise<readonly CriterionResult[]>
  results(): readonly CriterionResult[]
  /** Every voice the live engine started (the event log of C1/C2). */
  events(): readonly VoiceStartEvent[]
  play(): VoiceHandle | null
}

const CALIBRATION_BANK: SoundBank = { id: 'calibration', samples: [CALIBRATION_SOUND] }
const DISTANCES = [1, 10, 50, 200] as const

/**
 * The measuring area of the sound criteria: plays a sample sound (the kit's calibration sound, or any bank given) live with its place, strength and
 * distance, measures C1–C9 through the real engine on an offline context, records 3 s of the output for C10 and shows every result on the bench.
 */
export function createSoundCheckModule(options: SoundCheckModuleOptions = {}): SoundCheckModule {
  const locale = options.locale ?? 'pt-BR'
  const text = soundCheckTextOf(locale)
  const banks: SoundBank[] = [GAME_SFX_BANK, CALIBRATION_BANK, ...(options.banks ?? [])]
  const loader = calibrationLoader(options.loader ?? fetchLoader())
  const log: VoiceStartEvent[] = []
  const engine = createAudioEngine({ banks, samples: { loader }, onVoiceStart: (event) => log.push(event) })
  let results: CriterionResult[] = []
  let state: keyof SoundCheckText['states'] = 'idle'
  const chosen = { sound: options.sound ?? CALIBRATION_ID, environment: 'outdoor' as SampleEnvironment, intensity: 0.5, distance: 10 }

  const play = (): VoiceHandle | null => {
    engine.unlock()
    const position: Vec3 = [0, 1.6, -chosen.distance]
    return engine.play(chosen.sound, { position, environment: chosen.environment, intensity: chosen.intensity })
  }

  const live = (): AudioContext | null => (engine.output()?.context as AudioContext | undefined) ?? null

  const measure = async (): Promise<readonly CriterionResult[]> => {
    state = 'measuring'
    try {
      engine.unlock()
      const context = live()
      results = await measureCriteria({
        sound: chosen.sound,
        banks,
        loader,
        ...(context ? { baseLatency: context.baseLatency ?? 0, outputLatency: context.outputLatency ?? 0 } : {}),
        ...(options.actions?.[chosen.sound] ? { actions: options.actions[chosen.sound] as readonly ActionCheck[] } : {}),
        ...(options.loudnessOrder ? { loudnessOrder: options.loudnessOrder } : {}),
      })
      state = 'done'
    } catch (error) {
      state = 'failed'
      results = [{ id: 'C1', pass: false, value: error instanceof Error ? error.message : String(error), target: '' }]
    }
    ;(globalThis as { __soundCheck?: unknown }).__soundCheck = { sound: chosen.sound, results }
    return results
  }

  const record = async (): Promise<void> => {
    state = 'recording'
    const blob = await recordOutput(engine, 3, () => {
      for (let index = 0; index < 4; index++) engine.play(chosen.sound, { position: [0, 1.6, -chosen.distance], environment: chosen.environment, intensity: chosen.intensity, delay: index * 0.6 })
    })
    const documentLike = (globalThis as { document?: Document }).document
    if (blob && documentLike && typeof URL.createObjectURL === 'function') {
      const link = documentLike.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${chosen.sound}-${chosen.environment}-${chosen.distance}m.webm`
      link.click()
      state = 'recorded'
    } else state = blob ? 'recorded' : 'failed'
  }

  const soundOptions = () => engine.registry.sampleIds().map((id) => ({ id, name: id === CALIBRATION_ID ? `${id} (sdk)` : id }))

  const controls = (): ModuleControl[] => [
    { kind: 'choice', id: 'sound', name: text.controls.sound, options: soundOptions(), default: chosen.sound },
    { kind: 'choice', id: 'environment', name: text.controls.environment, options: SAMPLE_ENVIRONMENTS.map((id) => ({ id, name: text.environments[id] })), default: chosen.environment },
    { kind: 'number', id: 'intensity', name: text.controls.intensity, hint: text.hints.intensity, min: 0, max: 1, step: 0.05, default: chosen.intensity },
    { kind: 'choice', id: 'distance', name: text.controls.distance, options: DISTANCES.map((meters) => ({ id: String(meters), name: `${meters} m` })), default: String(chosen.distance) },
    { kind: 'action', id: 'play', name: text.controls.play },
    { kind: 'action', id: 'measure', name: text.controls.measure, hint: text.hints.measure },
    { kind: 'action', id: 'record', name: text.controls.record, hint: text.hints.record },
  ]

  const line = (id: CriterionId): string => {
    const result = results.find((entry) => entry.id === id)
    if (!result) return '—'
    return `${result.pass === null ? '◌' : result.pass ? '✓' : '✗'} ${result.value}`
  }

  const metrics = (): ModuleMetric[] => [
    { id: 'state', name: text.metrics.state, read: () => text.states[state] },
    { id: 'status', name: text.metrics.status, read: () => engine.sampleStatus(chosen.sound) },
    { id: 'last', name: text.metrics.last, read: () => { const last = log.at(-1); return last ? `${last.kind}:${last.id}${last.tier ? `/${last.tier}` : ''} ${last.layers?.map((layer) => layer.url.split('/').pop()).join('+') ?? ''}` : '—' } },
    ...CRITERIA.map((id) => ({ id: `criterion_${id}`, name: text.criteria[id], read: () => line(id) })),
  ]

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'action') {
      if (change.id === 'play') play()
      else if (change.id === 'measure') void measure()
      else if (change.id === 'record') void record()
      return
    }
    if (change.kind !== 'control') return
    const { id, value } = change
    if (id === 'sound' && typeof value === 'string') {
      chosen.sound = value
      results = []
      void engine.loadSamples([value])
    } else if (id === 'environment' && (value === 'indoor' || value === 'outdoor')) chosen.environment = value
    else if (id === 'intensity' && typeof value === 'number') chosen.intensity = value
    else if (id === 'distance' && typeof value === 'string') chosen.distance = Number(value)
  }

  const scenarios = (): Array<ModuleScenario<AudioScenarioLike>> => [
    {
      id: 'sample_pipeline',
      name: text.scenarios.pipeline,
      run: async ({ expect }) => {
        const report = await engine.loadSamples([CALIBRATION_ID])
        expect(report.failed.length === 0 && engine.sampleStatus(CALIBRATION_ID) === 'ready', 'the calibration files load and decode', { failed: report.failed })
        const before = log.length
        const handles = Array.from({ length: 6 }, (_, index) => engine.play(CALIBRATION_ID, { distance: 2, environment: index % 2 === 0 ? 'indoor' : 'outdoor' }))
        expect(handles.every((handle) => handle?.kind === 'sample'), 'it plays the files, not the fallback', { kinds: handles.map((handle) => handle?.kind) })
        const takes = log.slice(before).map((event) => event.layers?.find((layer) => layer.role === 'close')?.url)
        expect(takes.every((take, index) => index === 0 || take !== takes[index - 1]), 'never the same take twice in a row', { takes })
        const tails = log.slice(before).map((event) => event.layers?.find((layer) => layer.role === 'tail')?.url ?? '')
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
  ]

  return {
    id: 'sound_check_area',
    name: text.name,
    group: text.group,
    ground: { surface: 'concrete_slab' },
    engine,
    items: () => [],
    area: () => ({ placements: [], view: { eye: [0, 1.7, 3], target: [0, 1.4, -10] } }),
    controls: () => controls(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    measure,
    results: () => results,
    events: () => log,
    play,
    // the engine (and its context) is made on the first play or measure, not when the room loads the module
    attach(lent) {
      const off = lent.bench?.onChange(onChange)
      lent.bench?.patch('sound', { options: soundOptions() })
      return () => {
        off?.()
      }
    },
  }
}
