/**
 * The measuring harness of the sound criteria (C1–C10 of the sound checklist). Each criterion plays the sound through a real engine on an
 * `OfflineAudioContext` (the same mix, limiter and realizer the game uses, rendered faster than real time), and measures the rendered output: when it
 * starts against the event, how loud and bright it is at each distance, which side, how many takes, how it ends. Runs in a browser (or anything with
 * an `OfflineAudioContext`); C10 is the owner's ear, so it is left open with a recording to listen to (`recordOutput`).
 */
import type { MixProfile } from '../mix'
import type { SoundBank } from '../recipe'
import { createRng } from '../rng'
import { planSample, sampleUrls } from '../sample'
import type { SampleEnvironment, SampleSound } from '../sample'
import { createAudioEngine } from '../webaudio/engine'
import type { AudioEngine, PlayOptions, VoiceStartEvent } from '../webaudio/engine'
import type { SampleLoader } from '../webaudio/sample-store'
import { balanceOf, centroidHz, dbOf, endDropDb, onsetIndex, peakIndex, peakOf, ringSeconds, rmsDb } from './analyze'
import type { Channels } from './analyze'

export const CRITERIA = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'] as const
export type CriterionId = (typeof CRITERIA)[number]

/** The targets of the checklist, as numbers the harness compares with. */
export const CRITERIA_TARGETS = {
  /** C1: event to the first sample, and onset to the peak (one 60 fps frame). */
  syncMs: 20,
  peakAfterOnsetMs: 1000 / 60,
  /** C3: distances measured, metres. */
  distances: [1, 10, 50, 200] as readonly number[],
  /** C5: plays, distinct takes and the pitch range (fraction). */
  plays: 10,
  minTakes: 4,
  pitch: [0.03, 0.05] as const,
  /** C6: the highest peak, dBFS. */
  peakDb: -1,
  /** C8: the end of each file against its peak, dB. */
  endDropDb: -40,
  /** C9: a burst of rapid fire. */
  burst: 20,
  burstSpacing: 0.06,
} as const

export type CriterionResult = {
  readonly id: CriterionId
  /** `null`: not decided by the harness (C10, the owner's ear). */
  readonly pass: boolean | null
  /** What was measured, short (the bench prints it). */
  readonly value: string
  readonly target: string
  readonly data?: Readonly<Record<string, unknown>>
}

/** One action of the game and the sound it must play (C2). */
export type ActionCheck = { readonly action: string; readonly play: string; readonly expect: string; readonly options?: PlayOptions }

export type MeasureOptions = {
  /** The sample sound measured. */
  readonly sound: string
  readonly banks: readonly SoundBank[]
  readonly loader: SampleLoader
  /** The mixing chain the game uses (default the engine's default). */
  readonly mix?: string | MixProfile
  readonly sampleRate?: number
  /** `new OfflineAudioContext(...)` by default. */
  readonly createOfflineContext?: (channels: number, length: number, sampleRate: number) => OfflineAudioContext
  /** The live context's `baseLatency` (s), added to the rendered delay for C1. */
  readonly baseLatency?: number
  /** The device's `outputLatency` (s), reported with C1 but not counted (it is the speakers', not the game's). */
  readonly outputLatency?: number
  /** C2: the actions to check (default the sound for itself). */
  readonly actions?: readonly ActionCheck[]
  /** C6: sound ids loudest first, the order the buses must keep (tiro > explosão > impacto > passo). */
  readonly loudnessOrder?: readonly string[]
}

type Render = { readonly channels: Channels; readonly sampleRate: number; readonly events: readonly VoiceStartEvent[]; readonly handles: number }

const EVENT_AT = 0.2

const offlineFactory = (options: MeasureOptions) =>
  options.createOfflineContext ??
  ((channels: number, length: number, sampleRate: number): OfflineAudioContext => {
    const Constructor = (globalThis as { OfflineAudioContext?: new (channels: number, length: number, sampleRate: number) => OfflineAudioContext }).OfflineAudioContext
    if (!Constructor) throw new Error('no OfflineAudioContext here: the harness runs in a browser')
    return new Constructor(channels, length, sampleRate)
  })

/** Renders what `act` plays on a fresh engine (files loaded first), `seconds` long. */
async function render(options: MeasureOptions, seconds: number, act: (engine: AudioEngine) => number, engineExtras: { occlusion?: () => number; environment?: SampleEnvironment } = {}): Promise<Render> {
  const sampleRate = options.sampleRate ?? 48000
  const context = offlineFactory(options)(2, Math.ceil(seconds * sampleRate), sampleRate)
  const events: VoiceStartEvent[] = []
  const engine = createAudioEngine({
    banks: options.banks,
    createContext: () => context as unknown as AudioContext,
    samples: { loader: options.loader, autoLoad: false },
    onVoiceStart: (event) => events.push(event),
    ...(options.mix ? { mix: options.mix } : {}),
    ...(engineExtras.occlusion ? { occlusion: engineExtras.occlusion } : {}),
    ...(engineExtras.environment ? { environment: engineExtras.environment } : {}),
  })
  const ids = [...new Set([options.sound, ...(options.actions ?? []).map((action) => action.play), ...(options.loudnessOrder ?? [])])].filter((id) => engine.registry.sample(id))
  const report = await engine.loadSamples(ids)
  if (report.failed.length > 0) throw new Error(`files did not load: ${report.failed.map((entry) => `${entry.url} (${entry.error})`).join(', ')}`)
  const handles = act(engine)
  const buffer = await context.startRendering()
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
  return { channels, sampleRate, events, handles }
}

const ms = (seconds: number): string => `${(seconds * 1000).toFixed(1)} ms`
const db = (value: number): string => (Number.isFinite(value) ? `${value.toFixed(1)} dB` : '−∞')
const decreasing = (values: readonly number[]): boolean => values.every((value, index) => index === 0 || value < (values[index - 1] as number))

async function c1(options: MeasureOptions): Promise<CriterionResult> {
  const result = await render(options, 1.2, (engine) => (engine.play(options.sound, { distance: 1, delay: EVENT_AT }) ? 1 : 0))
  const onset = onsetIndex(result.channels, 0, 0.001)
  const event = result.events.find((entry) => entry.id === options.sound)
  if (onset < 0 || !event) return { id: 'C1', pass: false, value: 'sem som', target: `≤ ${CRITERIA_TARGETS.syncMs} ms` }
  const delay = onset / result.sampleRate - EVENT_AT + (event.startAt - event.requestedAt - EVENT_AT) + (options.baseLatency ?? 0)
  const peak = peakIndex(result.channels, onset, onset + Math.round(result.sampleRate * 0.25))
  const toPeak = (peak - onset) / result.sampleRate
  const pass = delay <= CRITERIA_TARGETS.syncMs / 1000 && toPeak <= CRITERIA_TARGETS.peakAfterOnsetMs / 1000
  return {
    id: 'C1',
    pass,
    value: `${ms(delay)}, pico +${ms(toPeak)}`,
    target: `≤ ${CRITERIA_TARGETS.syncMs} ms; pico no quadro do contato`,
    data: { delay, toPeak, baseLatency: options.baseLatency ?? 0, outputLatency: options.outputLatency ?? 0 },
  }
}

async function c2(options: MeasureOptions): Promise<CriterionResult> {
  const actions = options.actions ?? [{ action: options.sound, play: options.sound, expect: options.sound }]
  const result = await render(options, 0.5, (engine) => {
    let played = 0
    for (const action of actions) if (engine.play(action.play, { distance: 1, ...action.options })) played++
    return played
  })
  const wrong = actions.filter((action, index) => {
    const event = result.events[index]
    return !event || (event.fallbackOf ?? event.id) !== action.expect || event.kind !== 'sample'
  })
  return {
    id: 'C2',
    pass: wrong.length === 0,
    value: `${actions.length - wrong.length}/${actions.length} certas`,
    target: '100% das ações batem com a tabela (arquivo, não o substituto)',
    data: { wrong: wrong.map((action) => action.action), events: result.events.map((event) => `${event.kind}:${event.id}`) },
  }
}

async function c3(options: MeasureOptions, sound: SampleSound): Promise<CriterionResult> {
  const levels: number[] = []
  const brightness: number[] = []
  for (const distance of CRITERIA_TARGETS.distances) {
    const result = await render(options, 1.2, (engine) => (engine.play(options.sound, { position: [0, 0, -distance], seed: 1, delay: EVENT_AT }) ? 1 : 0))
    const onset = onsetIndex(result.channels, 0, 1e-5)
    levels.push(onset < 0 ? -Infinity : rmsDb(result.channels, onset, onset + result.sampleRate * 0.3))
    brightness.push(onset < 0 ? 0 : centroidHz(result.channels, result.sampleRate, onset))
  }
  const far = planSample(sound, { random: createRng(1), distance: CRITERIA_TARGETS.distances.at(-1) as number })
  const switched = (far?.farMix ?? 0) === 1 && (far?.layers.some((layer) => layer.role === 'far') ?? false)
  const pass = decreasing(levels) && decreasing(brightness) && switched
  return {
    id: 'C3',
    pass,
    value: `${levels.map((level) => db(level)).join(' › ')}; ${brightness.map((hz) => `${Math.round(hz)} Hz`).join(' › ')}${switched ? '; longe = far' : '; sem camada far'}`,
    target: 'cai e escurece com a distância; troca para a versão de longe depois de ~50 m',
    data: { distances: CRITERIA_TARGETS.distances, levels, brightness, switched },
  }
}

async function c4(options: MeasureOptions): Promise<CriterionResult> {
  const side = async (x: number): Promise<number> => {
    const result = await render(options, 0.8, (engine) => (engine.play(options.sound, { position: [x, 0, -2], seed: 1, delay: EVENT_AT }) ? 1 : 0))
    const [left, right] = result.channels as [Float32Array, Float32Array]
    return balanceOf(left, right, 0, left.length)
  }
  const right = await side(10)
  const left = await side(-10)
  const bright = async (occluded: boolean): Promise<number> => {
    const result = await render(options, 0.8, (engine) => (engine.play(options.sound, { position: [0, 0, -10], seed: 1, delay: EVENT_AT }) ? 1 : 0), occluded ? { occlusion: () => 1 } : {})
    const onset = onsetIndex(result.channels, 0, 1e-5)
    return onset < 0 ? 0 : centroidHz(result.channels, result.sampleRate, onset)
  }
  const clear = await bright(false)
  const wall = await bright(true)
  const pass = right > 0.2 && left < -0.2 && wall < clear * 0.7
  return {
    id: 'C4',
    pass,
    value: `dir ${right.toFixed(2)} esq ${left.toFixed(2)}; parede ${Math.round(wall)} Hz de ${Math.round(clear)} Hz`,
    target: 'lado certo; atrás da parede fica abafado',
    data: { right, left, clear, wall },
  }
}

async function c5(options: MeasureOptions, sound: SampleSound): Promise<CriterionResult> {
  const result = await render(options, 0.3 * CRITERIA_TARGETS.plays + 1, (engine) => {
    let played = 0
    for (let index = 0; index < CRITERIA_TARGETS.plays; index++) if (engine.play(options.sound, { distance: 1, delay: 0.1 + index * 0.3 })) played++
    return played
  })
  const close = result.events.map((event) => event.layers?.find((layer) => layer.role === 'close'))
  const takes = close.map((layer) => layer?.url ?? '')
  const repeats = takes.filter((take, index) => index > 0 && take === takes[index - 1]).length
  const distinct = new Set(takes).size
  const rates = close.map((layer) => layer?.rate ?? 1)
  const spread = (Math.max(...rates) - Math.min(...rates)) / 2
  const pitch = sound.pitch ?? 0.04
  const pass = distinct >= CRITERIA_TARGETS.minTakes && repeats === 0 && pitch >= CRITERIA_TARGETS.pitch[0] && pitch <= CRITERIA_TARGETS.pitch[1] && spread > 0.01
  return {
    id: 'C5',
    pass,
    value: `${distinct} tomadas, ${repeats} repetições seguidas, tom ±${(pitch * 100).toFixed(0)}%`,
    target: `≥ ${CRITERIA_TARGETS.minTakes} variações, nunca a mesma duas vezes, tom ±3–5%`,
    data: { takes, rates },
  }
}

async function c6(options: MeasureOptions): Promise<CriterionResult> {
  const peakAt = async (id: string): Promise<{ peak: number; rms: number }> => {
    const result = await render(options, 1.2, (engine) => (engine.play(id, { distance: 1, seed: 1, delay: EVENT_AT }) ? 1 : 0))
    const onset = onsetIndex(result.channels, 0, 1e-5)
    return { peak: dbOf(peakOf(result.channels)), rms: onset < 0 ? -Infinity : rmsDb(result.channels, onset, onset + result.sampleRate * 0.3) }
  }
  const own = await peakAt(options.sound)
  const order = options.loudnessOrder ?? []
  const loudness: number[] = []
  for (const id of order) loudness.push((await peakAt(id)).rms)
  const ordered = order.length < 2 || decreasing(loudness)
  const pass = own.peak <= CRITERIA_TARGETS.peakDb && ordered
  return {
    id: 'C6',
    pass,
    value: `pico ${db(own.peak)}, RMS ${db(own.rms)}${order.length > 1 ? `; ordem ${ordered ? 'ok' : 'errada'}` : ''}`,
    target: 'tiro > explosão > impacto > passo; pico ≤ −1 dBFS',
    data: { peak: own.peak, rms: own.rms, order, loudness },
  }
}

async function c7(options: MeasureOptions, sound: SampleSound): Promise<CriterionResult> {
  if (!sound.tiers || sound.tiers.length < 2) return { id: 'C7', pass: false, value: 'sem camadas leve/médio/forte', target: 'muda de camada, não só de volume' }
  const at = async (intensity: number): Promise<{ tier: string; rms: number; files: string }> => {
    const result = await render(options, 1.2, (engine) => (engine.play(options.sound, { distance: 1, seed: 1, intensity, delay: EVENT_AT }) ? 1 : 0))
    const onset = onsetIndex(result.channels, 0, 1e-5)
    const event = result.events[0]
    return { tier: event?.tier ?? '', rms: onset < 0 ? -Infinity : rmsDb(result.channels, onset, onset + result.sampleRate * 0.3), files: event?.layers?.find((layer) => layer.role === 'close')?.url ?? '' }
  }
  const light = await at(0.1)
  const heavy = await at(0.9)
  const pass = light.tier !== heavy.tier && light.files !== heavy.files && heavy.rms > light.rms
  return {
    id: 'C7',
    pass,
    value: `${light.tier} ${db(light.rms)} → ${heavy.tier} ${db(heavy.rms)}`,
    target: 'golpe fraco x forte troca a camada (leve/médio/forte), não só o volume',
    data: { light, heavy },
  }
}

async function c8(options: MeasureOptions, sound: SampleSound): Promise<CriterionResult> {
  const sampleRate = options.sampleRate ?? 48000
  const decoder = offlineFactory(options)(1, sampleRate, sampleRate)
  const drops: { url: string; drop: number }[] = []
  for (const url of sampleUrls(sound)) {
    const buffer = await decoder.decodeAudioData(await options.loader(url))
    drops.push({ url, drop: endDropDb([buffer.getChannelData(0)], buffer.sampleRate) })
  }
  const worst = drops.reduce((max, entry) => Math.max(max, entry.drop), -Infinity)
  const ring = async (environment: SampleEnvironment): Promise<number> => {
    const result = await render(options, 3, (engine) => (engine.play(options.sound, { distance: 1, seed: 1, environment, delay: EVENT_AT }) ? 1 : 0))
    return ringSeconds(result.channels, result.sampleRate, Math.round(EVENT_AT * result.sampleRate))
  }
  const indoor = await ring('indoor')
  const outdoor = await ring('outdoor')
  const hasTails = Boolean(sound.tail?.indoor?.length && sound.tail?.outdoor?.length)
  const pass = worst <= CRITERIA_TARGETS.endDropDb && hasTails && outdoor > indoor
  return {
    id: 'C8',
    pass,
    value: `fim ${db(worst)}; cauda dentro ${indoor.toFixed(2)} s, fora ${outdoor.toFixed(2)} s${hasTails ? '' : ' (sem as duas caudas)'}`,
    target: 'não corta seco; cauda de interior x exterior coerente',
    data: { drops, indoor, outdoor },
  }
}

async function c9(options: MeasureOptions): Promise<CriterionResult> {
  const { burst, burstSpacing } = CRITERIA_TARGETS
  const first = 0.1
  const result = await render(options, burst * burstSpacing + 1.5, (engine) => {
    let played = 0
    for (let index = 0; index < burst; index++) if (engine.play(options.sound, { distance: 1, delay: first + index * burstSpacing })) played++
    return played
  })
  const peak = dbOf(peakOf(result.channels))
  // C9 reads: no pile-up (the level does not build up shot after shot) and no shot that vanishes (every slot carries its shot). RMS of each shot's slot:
  const slots: number[] = []
  for (let index = 0; index < burst; index++) {
    const at = Math.round((first + index * burstSpacing) * result.sampleRate)
    slots.push(rmsDb(result.channels, at, at + Math.round(burstSpacing * result.sampleRate)))
  }
  const sorted = [...slots].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] as number
  const vanished = slots.filter((level) => level < median - 6).length
  const buildUp = slots.slice(-5).reduce((sum, level) => sum + level, 0) / 5 - (slots[0] as number)
  const pass = result.handles === burst && vanished === 0 && buildUp <= 6 && peak <= CRITERIA_TARGETS.peakDb
  return {
    id: 'C9',
    pass,
    value: `${result.handles}/${burst} tocaram, ${vanished} sumiram, acúmulo ${buildUp >= 0 ? '+' : ''}${buildUp.toFixed(1)} dB, pico ${db(peak)}`,
    target: 'rajada sem amontoar (acúmulo ≤ 6 dB) nem sumir; pico ≤ −1 dBFS',
    data: { handles: result.handles, slots, vanished, buildUp, peak },
  }
}

/** Runs the criteria (all by default) and returns one result each, in order. C10 is always open: it is the owner's ear on a recording. */
export async function measureCriteria(options: MeasureOptions, only: readonly CriterionId[] = CRITERIA): Promise<CriterionResult[]> {
  const probe = createAudioEngine({ banks: options.banks, createContext: () => null })
  const sound = probe.registry.sample(options.sound)
  if (!sound) throw new Error(`${options.sound} is not a sample sound of these banks`)
  const results: CriterionResult[] = []
  for (const id of only) {
    if (id === 'C1') results.push(await c1(options))
    else if (id === 'C2') results.push(await c2(options))
    else if (id === 'C3') results.push(await c3(options, sound))
    else if (id === 'C4') results.push(await c4(options))
    else if (id === 'C5') results.push(await c5(options, sound))
    else if (id === 'C6') results.push(await c6(options))
    else if (id === 'C7') results.push(await c7(options, sound))
    else if (id === 'C8') results.push(await c8(options, sound))
    else if (id === 'C9') results.push(await c9(options))
    else results.push({ id: 'C10', pass: null, value: 'gravar e ouvir', target: 'aprovado pelo ouvido do dono (print + gravação na 4280)' })
  }
  return results
}

/**
 * Records what the engine outputs while `act` plays, `seconds` long (the C10 recording): a `MediaRecorder` on a stream tapped from the master. Returns
 * `null` where there is no recorder or no context.
 */
export async function recordOutput(engine: AudioEngine, seconds: number, act: () => void): Promise<Blob | null> {
  engine.unlock()
  const output = engine.output()
  const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  const context = output?.context as AudioContext | undefined
  if (!output || !Recorder || !context || typeof context.createMediaStreamDestination !== 'function') return null
  const tap = context.createMediaStreamDestination()
  output.connect(tap)
  const recorder = new Recorder(tap.stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })
  recorder.start()
  act()
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  recorder.stop()
  await done
  output.disconnect(tap)
  return new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
}
