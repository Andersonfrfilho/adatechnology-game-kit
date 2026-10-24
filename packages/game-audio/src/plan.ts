import type { Vec3 } from '@adatechnology/game-contracts'

import { cutoffDivisor, falloffGain, isSilent } from './falloff'
import { DEFAULT_LISTENER, listenerDistance, panFor } from './listener'
import type { DistanceMode, Listener } from './listener'
import type { Automation, BuildOrder, BusId, Curve, Envelope, FilterSpec, Layer, LayerSource, Modulator, Range, SoundRecipe, Time } from './recipe'
import { createRng } from './rng'
import { busPriority } from './voices'

/** How an AudioParam moves, with every number resolved and every time in seconds from the layer start. */
export type PlannedAutomation = {
  /** Assigned to `.value`. */
  readonly value?: number
  /** `setValueAtTime(from)` at the layer start. */
  readonly from?: number
  /** Ramp target, reached `at` seconds after the layer start. */
  readonly to?: number
  readonly curve?: Curve
  readonly at?: number
}

export type PlannedFilter = {
  readonly type: BiquadFilterType
  readonly frequency: PlannedAutomation
  readonly q?: number
  readonly gain?: number
  readonly level?: number
}

export type PlannedModulator = {
  readonly target: 'gain' | 'frequency'
  readonly wave?: OscillatorType
  readonly rate: number
  readonly depth: number
  readonly base?: number
}

export type PlannedSource =
  | { readonly kind: 'noise'; readonly offset: number; readonly loop: boolean }
  | { readonly kind: 'osc'; readonly wave: OscillatorType; readonly frequency: PlannedAutomation }
  | {
      readonly kind: 'formant_voice'
      readonly wave: OscillatorType
      readonly frequency: PlannedAutomation
      readonly vibrato: { readonly rate: number; readonly depth: number }
      readonly formants: readonly { readonly frequency: number; readonly q: number }[]
      readonly breath: { readonly frequency: number; readonly q: number; readonly gain: number; readonly offset: number }
      readonly mix: number
    }

export type PlannedEnvelopePoint = { readonly time: number; readonly value: number; readonly curve: 'set' | Curve }

export type PlannedLayer = {
  readonly at: number
  readonly duration: number
  readonly tail: number
  /** Layer gain × the sound's level: in the envelope for every order but `layered`, in the output stage for `layered`. */
  readonly level: number
  readonly wet?: number
  readonly source: PlannedSource
  readonly filters?: { readonly mode: 'serial' | 'parallel'; readonly bank: readonly PlannedFilter[] }
  readonly modulators: readonly PlannedModulator[]
  readonly envelope: readonly PlannedEnvelopePoint[]
}

/** A sound with every number decided: what the realizer builds, what goldens compare and what the bench sheet prints. */
export type SoundPlan = {
  readonly id: string
  readonly bus: BusId
  readonly order: BuildOrder
  readonly group?: string
  readonly priority: number
  /** The level from volume and distance, before layer gains. */
  readonly level: number
  readonly distance: number
  readonly pan?: number
  /** Too quiet to hear, kept only for a recipe with `keepSilent`. */
  readonly silent: boolean
  /** Seconds until the last source stops. */
  readonly length: number
  readonly layers: readonly PlannedLayer[]
}

export type PlanInput = {
  /** Where the numbers are drawn from. Default: a fresh stream with seed 1. */
  readonly random?: () => number
  readonly volume?: number
  /** Distance in meters; overrides `position`. */
  readonly distance?: number
  readonly position?: Vec3
  readonly listener?: Listener
  readonly distanceMode?: DistanceMode
  readonly params?: Readonly<Record<string, number>>
  /** 0..1 from the host's occlusion callback: gain × (1 − 0.5 × o), lowpass cutoffs × (1 − 0.6 × o). */
  readonly occlusion?: number
  /** Length of the noise buffer, for `offset: 'fit'`. Default 1.5. */
  readonly noiseSeconds?: number
}

const DEFAULT_TAIL = 0.05
const DEFAULT_NOISE_SECONDS = 1.5
const OCCLUSION_GAIN = 0.5
const OCCLUSION_CUTOFF = 0.6

type Scope = { readonly random: () => number; readonly params: Record<string, number> }

function isParamRef(range: Range): range is Extract<Range, { readonly param: string }> {
  return typeof range === 'object' && !Array.isArray(range)
}

function draw(range: Range, scope: Scope): number {
  if (typeof range === 'number') return range
  if (isParamRef(range)) {
    const value = scope.params[range.param]
    if (value === undefined) throw new Error(`game-audio: the recipe reads the param "${range.param}", which was not given`)
    return value * (range.scale ?? 1) + (range.add ?? 0)
  }
  const [min, max] = range as readonly [number, number]
  return min + scope.random() * (max - min)
}

// a time is drawn now when it is a range; 'duration' and '0.6d' wait for the layer duration
type PendingTime = number | 'duration' | `${number}d`

function drawTime(time: Time, scope: Scope): PendingTime {
  if (time === 'duration' || (typeof time === 'string' && time.endsWith('d'))) return time as PendingTime
  return draw(time as Range, scope)
}

function timeOf(time: PendingTime, duration: number): number {
  if (typeof time === 'number') return time
  if (time === 'duration') return duration
  return Number(time.slice(0, -1)) * duration
}

type PendingAutomation = { value?: number; from?: number; to?: number; curve?: Curve; over?: PendingTime }

function drawAutomation(automation: Automation, scope: Scope): PendingAutomation {
  const pending: PendingAutomation = {}
  for (const key of Object.keys(automation)) {
    if (key === 'set' && 'set' in automation) pending.value = draw(automation.set, scope)
    else if (key === 'from' && 'from' in automation) pending.from = draw(automation.from, scope)
    else if (key === 'to' && automation.to !== undefined) pending.to = draw(automation.to, scope)
    else if (key === 'curve') pending.curve = automation.curve
    else if (key === 'over' && automation.over !== undefined) pending.over = drawTime(automation.over, scope)
  }
  return pending
}

function finishAutomation(pending: PendingAutomation, duration: number): PlannedAutomation {
  if (pending.from !== undefined) return { from: pending.from, to: pending.to ?? pending.from, curve: pending.curve ?? 'linear', at: timeOf(pending.over ?? 'duration', duration) }
  if (pending.to === undefined || pending.over === undefined) return { value: pending.value }
  return { value: pending.value, to: pending.to, curve: pending.curve ?? 'linear', at: timeOf(pending.over, duration) }
}

const startFrequency = (automation: PendingAutomation): number => automation.from ?? automation.value ?? 0

type PendingFilter = { spec: FilterSpec; frequency: PendingAutomation; q?: number; gain?: number; level?: number }

function drawFilter(spec: FilterSpec, scope: Scope): PendingFilter {
  const pending: PendingFilter = { spec, frequency: {} }
  for (const key of Object.keys(spec)) {
    if (key === 'frequency') pending.frequency = drawAutomation(spec.frequency, scope)
    else if (key === 'q' && spec.q !== undefined) pending.q = draw(spec.q, scope)
    else if (key === 'gain' && spec.gain !== undefined) pending.gain = draw(spec.gain, scope)
    else if (key === 'level' && spec.level !== undefined) pending.level = draw(spec.level, scope)
  }
  return pending
}

type PendingModulator = { modulator: Modulator; rate: number; depth?: number }

function drawModulator(modulator: Modulator, scope: Scope): PendingModulator {
  const pending: PendingModulator = { modulator, rate: 0 }
  for (const key of Object.keys(modulator)) {
    if (key === 'rate') pending.rate = draw(modulator.rate, scope)
    else if (key === 'depth' && !(typeof modulator.depth === 'object' && 'scaleOf' in modulator.depth)) pending.depth = draw(modulator.depth as Range, scope)
  }
  return pending
}

type PendingVoice = { frequency: PendingAutomation; vibratoRate: number; formants: { frequency: number; q: number }[]; breath: { frequency: number; q: number; gain: number } }

function drawVoice(source: Extract<LayerSource, { kind: 'formant_voice' }>, scope: Scope): PendingVoice {
  const pending: PendingVoice = { frequency: {}, vibratoRate: 0, formants: [], breath: { frequency: 0, q: source.breath.q, gain: 0 } }
  for (const key of Object.keys(source)) {
    if (key === 'frequency') pending.frequency = drawAutomation(source.frequency, scope)
    else if (key === 'vibrato') pending.vibratoRate = draw(source.vibrato.rate, scope)
    else if (key === 'formants') pending.formants = source.formants.map((formant) => ({ frequency: draw(formant.frequency, scope), q: formant.q }))
    else if (key === 'breath') pending.breath = { frequency: draw(source.breath.frequency, scope), q: source.breath.q, gain: draw(source.breath.gain, scope) }
  }
  return pending
}

type LayerDefaults = { readonly duration?: number; readonly tail?: number; readonly noiseSeconds: number }

type PendingLayer = {
  at: number
  duration?: number
  gain: number
  automation?: PendingAutomation
  voice?: PendingVoice
  filters: PendingFilter[]
  modulators: PendingModulator[]
}

function drawLayer(layer: Layer, scope: Scope): PendingLayer {
  const pending: PendingLayer = { at: 0, gain: 1, filters: [], modulators: [] }
  for (const key of Object.keys(layer)) {
    if (key === 'at' && layer.at !== undefined) pending.at = draw(layer.at, scope)
    else if (key === 'duration' && layer.duration !== undefined) pending.duration = draw(layer.duration, scope)
    else if (key === 'gain' && layer.gain !== undefined) pending.gain = draw(layer.gain, scope)
    else if (key === 'source' && layer.source.kind === 'osc') pending.automation = drawAutomation(layer.source.frequency, scope)
    else if (key === 'source' && layer.source.kind === 'formant_voice') pending.voice = drawVoice(layer.source, scope)
    else if (key === 'filters' && layer.filters) pending.filters = layer.filters.bank.map((spec) => drawFilter(spec, scope))
    else if (key === 'modulators' && layer.modulators) pending.modulators = layer.modulators.map((modulator) => drawModulator(modulator, scope))
  }
  return pending
}

// the team code draws the noise start point when the source starts, after every other number of the layer
function drawOffset(source: LayerSource, duration: number, scope: Scope, noiseSeconds: number): number {
  if (source.kind === 'formant_voice') return scope.random()
  if (source.kind !== 'noise' || source.offset === undefined) return 0
  if (typeof source.offset === 'number') return source.offset
  if (source.offset === 'fit') return scope.random() * Math.max(0, noiseSeconds - duration)
  return scope.random() * (source.offsetScale ?? 1)
}

function finishSource(layer: Layer, pending: PendingLayer, duration: number, offset: number): PlannedSource {
  const source = layer.source
  if (source.kind === 'noise') return { kind: 'noise', offset, loop: source.loop === true }
  if (source.kind === 'osc') return { kind: 'osc', wave: source.wave, frequency: finishAutomation(pending.automation ?? {}, duration) }
  const voice = pending.voice as PendingVoice
  return {
    kind: 'formant_voice',
    wave: source.wave,
    frequency: finishAutomation(voice.frequency, duration),
    vibrato: { rate: voice.vibratoRate, depth: startFrequency(voice.frequency) * source.vibrato.depth },
    formants: voice.formants,
    breath: { ...voice.breath, offset },
    mix: source.mix,
  }
}

function finishModulator(pending: PendingModulator, sourceFrequency: number): PlannedModulator {
  const { modulator } = pending
  const depth = typeof modulator.depth === 'object' && 'scaleOf' in modulator.depth ? sourceFrequency * modulator.depth.factor : (pending.depth ?? 0)
  return { target: modulator.target, ...(modulator.wave ? { wave: modulator.wave } : {}), rate: pending.rate, depth, ...(modulator.base === undefined ? {} : { base: modulator.base }) }
}

function finishEnvelope(envelope: Envelope, duration: number, level: number): PlannedEnvelopePoint[] {
  return envelope.map(([time, value, curve, fixed]) => ({ time: timeOf(time, duration), value: fixed === 'fixed' ? value : value * level, curve }))
}

function planLayer(layer: Layer, scope: Scope, defaults: LayerDefaults, levelInEnvelope: boolean, soundLevel: number): PlannedLayer[] {
  const pending = drawLayer(layer, scope)
  const duration = pending.duration ?? defaults.duration
  if (duration === undefined) throw new Error('game-audio: a layer needs a duration (its own or the recipe’s)')
  const offset = drawOffset(layer.source, duration, scope, defaults.noiseSeconds)
  const level = pending.gain * soundLevel
  const sourceFrequency = layer.source.kind === 'noise' ? 0 : startFrequency(pending.automation ?? pending.voice?.frequency ?? {})
  const planned: PlannedLayer = {
    at: pending.at,
    duration,
    tail: layer.tail ?? defaults.tail ?? DEFAULT_TAIL,
    level,
    ...(layer.wet === undefined ? {} : { wet: layer.wet }),
    source: finishSource(layer, pending, duration, offset),
    ...(layer.filters
      ? {
          filters: {
            mode: layer.filters.mode,
            bank: pending.filters.map(({ spec, frequency, q, gain, level: filterLevel }) => ({
              type: spec.type,
              frequency: finishAutomation(frequency, duration),
              ...(q === undefined ? {} : { q }),
              ...(gain === undefined ? {} : { gain }),
              ...(filterLevel === undefined ? {} : { level: filterLevel }),
            })),
          },
        }
      : {}),
    modulators: pending.modulators.map((modulator) => finishModulator(modulator, sourceFrequency)),
    envelope: finishEnvelope(layer.envelope, duration, levelInEnvelope ? level : 1),
  }
  if (!layer.repeat) return [planned]
  return Array.from({ length: layer.repeat.count }, (_, index) => ({ ...planned, at: planned.at + index * (layer.repeat?.spacing ?? 0) }))
}

function scaleAutomation(automation: PlannedAutomation, divisor: number): PlannedAutomation {
  const scale = (value: number | undefined): number | undefined => (value === undefined ? undefined : value / divisor)
  const scaled: Record<string, unknown> = { ...automation }
  for (const key of ['value', 'from', 'to'] as const) if (automation[key] !== undefined) scaled[key] = scale(automation[key])
  return scaled as PlannedAutomation
}

// distance muffling and occlusion lower every lowpass cutoff of the sound
function muffle(layer: PlannedLayer, divisor: number): PlannedLayer {
  if (divisor === 1 || !layer.filters) return layer
  const bank = layer.filters.bank.map((filter) => (filter.type === 'lowpass' ? { ...filter, frequency: scaleAutomation(filter.frequency, divisor) } : filter))
  return { ...layer, filters: { ...layer.filters, bank } }
}

const layerEnd = (layer: PlannedLayer): number => layer.at + layer.duration + layer.tail

/**
 * Turns a recipe into a plan: pure, Node-safe, the same plan for the same `random`. Numbers are drawn in this order: `vars` (in the order written),
 * `duration`, then each layer in the order its fields are written, the noise start point last in its layer. A sound below its falloff's `minGain`
 * gives `null` (or a silent plan with `keepSilent`) before any number is drawn.
 */
export function planSound(recipe: SoundRecipe, input: PlanInput = {}): SoundPlan | null {
  const listener = input.listener ?? DEFAULT_LISTENER
  const distance = input.distance ?? (input.position ? listenerDistance(listener, input.position, input.distanceMode) : 0)
  const occlusion = Math.min(1, Math.max(0, input.occlusion ?? 0))
  const order = recipe.order ?? 'layered'
  const falloffLevel = falloffGain(recipe.falloff, input.volume ?? 1, distance)
  const level = occlusion > 0 ? falloffLevel * (1 - OCCLUSION_GAIN * occlusion) : falloffLevel
  const silent = isSilent(recipe.falloff, falloffLevel)
  const base = {
    id: recipe.id,
    bus: recipe.bus,
    order,
    ...(recipe.group === undefined ? {} : { group: recipe.group }),
    priority: recipe.priority ?? busPriority(recipe.bus),
    level,
    distance,
    ...(recipe.pan ? { pan: input.position ? panFor(listener, input.position) : 0 } : {}),
  }
  if (silent) return recipe.keepSilent ? { ...base, silent: true, length: 0, layers: [] } : null

  const scope: Scope = { random: input.random ?? createRng(1), params: { ...input.params } }
  for (const [name, range] of Object.entries(recipe.vars ?? {})) if (scope.params[name] === undefined) scope.params[name] = draw(range, scope)
  const defaults: LayerDefaults = {
    ...(recipe.duration === undefined ? {} : { duration: draw(recipe.duration, scope) }),
    ...(recipe.tail === undefined ? {} : { tail: recipe.tail }),
    noiseSeconds: input.noiseSeconds ?? DEFAULT_NOISE_SECONDS,
  }
  const divisor = cutoffDivisor(recipe.falloff, distance) / (1 - OCCLUSION_CUTOFF * occlusion)
  const layers = recipe.layers.flatMap((layer) => planLayer(layer, scope, defaults, order !== 'layered', level)).map((layer) => muffle(layer, divisor))
  return { ...base, silent: false, length: Math.max(0, ...layers.map(layerEnd)), layers }
}
