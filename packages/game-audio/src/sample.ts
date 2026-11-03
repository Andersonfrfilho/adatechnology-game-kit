/**
 * Sounds made of recorded files (`.ogg`), as data. A `SampleSound` lists the takes of each layer: `close` (the sound as heard near, the only one
 * required), `far` (the same event heard from far away: a muffled bang with its echo) and the tail of the place it happens in (`indoor` / `outdoor`).
 * `planSample` decides, from a seeded stream, which take plays (round-robin: never the same take twice in a row), the pitch (± a fraction), how the
 * near and far layers cross over with the distance, the level, the pan and the distance lowpass. It is pure, so it runs in Node and in tests; the
 * WebAudio layer (`realizeSample`) plays the plan from decoded buffers.
 */
import type { Vec3 } from '@adatechnology/game-contracts'

import { falloffGain, isSilent } from './falloff'
import { DEFAULT_LISTENER, listenerDistance, panFor } from './listener'
import type { DistanceMode, Listener } from './listener'
import type { BusId, Falloff, SampleCrossover, SampleEnvironment, SampleRef, SampleSound, SampleTier } from './recipe'
import { busPriority } from './voices'

export type { SampleCrossover, SampleEnvironment, SampleRef, SampleSound, SampleTail, SampleTier } from './recipe'

export const SAMPLE_ENVIRONMENTS = ['indoor', 'outdoor'] as const satisfies readonly SampleEnvironment[]

/** The role of a layer in a plan. */
export type SampleLayerRole = 'close' | 'far' | 'tail'

export const DEFAULT_SAMPLE_FALLOFF: Falloff = { model: 'inverse_square', k: 0.002, minGain: 0.002 }
export const DEFAULT_CROSSOVER: SampleCrossover = { from: 30, to: 80 }
export const DEFAULT_SAMPLE_PITCH = 0.04
export const DEFAULT_TAIL_GAIN = 0.6
export const DEFAULT_SAMPLE_CUTOFF_K = 0.01
/** The open lowpass: at or above it the realizer leaves the filter out. */
export const OPEN_CUTOFF = 20000
/** A layer quieter than this is left out of the plan. */
export const LAYER_FLOOR = 0.001

/** One file to play: which take, at what level (already times the sound level), rate and start. */
export type PlannedSampleLayer = {
  readonly role: SampleLayerRole
  readonly url: string
  /** Index of the take in its list. */
  readonly take: number
  readonly gain: number
  readonly rate: number
  readonly at: number
}

export type SamplePlan = {
  readonly kind: 'sample'
  readonly id: string
  readonly bus: BusId
  readonly level: number
  readonly distance: number
  readonly pan?: number
  /** Lowpass cutoff in Hz (`OPEN_CUTOFF` = no filter). */
  readonly cutoff: number
  /** Playback rate of every layer (the pitch drawn for this play). */
  readonly rate: number
  readonly environment: SampleEnvironment
  /** The tier played (`undefined` without tiers or intensity). */
  readonly tier?: string
  /** 0 = all near, 1 = all far. */
  readonly farMix: number
  readonly layers: readonly PlannedSampleLayer[]
  readonly priority: number
  readonly group?: string
}

/** The last take each sound layer played (`<id>/<role>` → index), so the next play never repeats it. Keep one per engine or channel. */
export type SampleMemory = Map<string, number>

export type SamplePlanInput = {
  readonly random: () => number
  readonly listener?: Listener
  readonly distanceMode?: DistanceMode
  readonly position?: Vec3
  /** Metres; overrides `position` for the distance (not for the pan). */
  readonly distance?: number
  readonly volume?: number
  /** Default `outdoor`. */
  readonly environment?: SampleEnvironment
  /** 0 (clear) to 1 (behind a wall): lowers the level and closes the lowpass. */
  readonly occlusion?: number
  /** Round-robin memory; without it each plan is drawn on its own (and may repeat). */
  readonly memory?: SampleMemory
  /** Limiter priority when the sound has none. */
  readonly priority?: number
  /** 0 (light) to 1 (heavy): picks the tier (see `SampleTier`). */
  readonly intensity?: number
}

/**
 * Round-robin without repeat: a take drawn among all but the last one played. With one take it is always 0; without `last` any take may come.
 * One random number per call.
 */
export function pickTake(count: number, last: number | undefined, random: () => number): number {
  if (count <= 1) return 0
  if (last === undefined || last < 0 || last >= count) return Math.min(count - 1, Math.floor(random() * count))
  const drawn = Math.min(count - 2, Math.floor(random() * (count - 1)))
  return drawn >= last ? drawn + 1 : drawn
}

/** 0 at or below `from`, 1 at or beyond `to`, linear between. */
export function farMixAt(crossover: SampleCrossover, distance: number): number {
  if (crossover.to <= crossover.from) return distance >= crossover.to ? 1 : 0
  const t = (distance - crossover.from) / (crossover.to - crossover.from)
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

/** Equal-power gains of the near and far layers for a far mix (so the crossover has no dip in loudness). */
export function crossGains(farMix: number): { readonly close: number; readonly far: number } {
  return { close: Math.cos((farMix * Math.PI) / 2), far: Math.sin((farMix * Math.PI) / 2) }
}

/** The distance lowpass, closed further behind a wall (an occluded sound loses its highs first). */
export function sampleCutoff(cutoffK: number, distance: number, occlusion = 0): number {
  const byDistance = cutoffK > 0 ? OPEN_CUTOFF / (1 + distance * cutoffK) : OPEN_CUTOFF
  const occluded = occlusion > 0 ? byDistance / (1 + occlusion * 9) : byDistance
  return Math.max(80, Math.min(OPEN_CUTOFF, occluded))
}

/** Every file a sound may play (to load before its first play). */
export function sampleUrls(sound: SampleSound): string[] {
  const tiers = (sound.tiers ?? []).flatMap((tier) => [...tier.close, ...(tier.far ?? [])])
  const all = [...sound.close, ...(sound.far ?? []), ...tiers, ...(sound.tail?.indoor ?? []), ...(sound.tail?.outdoor ?? [])].map((ref) => ref.url)
  return [...new Set(all)]
}

/** The tier for an intensity: the last whose `from` is at or below it. */
export function tierFor(sound: SampleSound, intensity: number | undefined): SampleTier | undefined {
  if (intensity === undefined || !sound.tiers) return undefined
  let chosen: SampleTier | undefined
  for (const tier of sound.tiers) if (tier.from <= intensity) chosen = tier
  return chosen ?? sound.tiers[0]
}

/**
 * The plan of one play, or `null` when the sound is too far to be heard. Random numbers, in order: the pitch, the near take, the far take, the
 * tail take (each drawn only when that layer has more than zero takes and is heard).
 */
export function planSample(sound: SampleSound, input: SamplePlanInput): SamplePlan | null {
  if (sound.close.length === 0) throw new Error(`sample sound ${sound.id} has no close take`)
  const listener = input.listener ?? DEFAULT_LISTENER
  const distance = input.distance ?? (input.position ? listenerDistance(listener, input.position, input.distanceMode) : 0)
  const falloff = sound.falloff ?? DEFAULT_SAMPLE_FALLOFF
  const occlusion = Math.max(0, Math.min(1, input.occlusion ?? 0))
  const level = falloffGain(falloff, (input.volume ?? 1) * (sound.gain ?? 1), distance) * (1 - 0.45 * occlusion)
  if (isSilent(falloff, level) || level <= 0) return null

  const pitch = sound.pitch ?? DEFAULT_SAMPLE_PITCH
  const rate = pitch > 0 ? 1 + (input.random() * 2 - 1) * pitch : 1
  const environment = input.environment ?? 'outdoor'
  const tier = tierFor(sound, input.intensity)
  const close = tier?.close.length ? tier.close : sound.close
  const far = tier?.far?.length ? tier.far : (sound.far ?? [])
  const farMix = far.length > 0 ? farMixAt(sound.crossover ?? DEFAULT_CROSSOVER, distance) : 0
  const gains = crossGains(farMix)
  const layers: PlannedSampleLayer[] = []
  const take = (role: SampleLayerRole, refs: readonly SampleRef[], gain: number, at: number): void => {
    if (refs.length === 0 || gain < LAYER_FLOOR) return
    const key = `${sound.id}/${tier && role !== 'tail' ? `${tier.name}/` : ''}${role}`
    const index = pickTake(refs.length, input.memory?.get(key), input.random)
    input.memory?.set(key, index)
    const ref = refs[index] as SampleRef
    layers.push({ role, url: ref.url, take: index, gain: gain * (ref.gain ?? 1) * level, rate, at })
  }
  take('close', close, gains.close, 0)
  take('far', far, gains.far, 0)
  const tails = sound.tail?.[environment] ?? []
  take('tail', tails, sound.tail?.gain ?? DEFAULT_TAIL_GAIN, sound.tail?.at ?? 0)

  const pan = (sound.pan ?? true) && input.position ? panFor(listener, input.position) : undefined
  return {
    kind: 'sample',
    id: sound.id,
    bus: sound.bus,
    level,
    distance,
    ...(pan === undefined ? {} : { pan }),
    cutoff: sampleCutoff(sound.cutoffK ?? DEFAULT_SAMPLE_CUTOFF_K, distance, occlusion),
    rate,
    environment,
    ...(tier ? { tier: tier.name } : {}),
    farMix,
    layers,
    priority: sound.priority ?? input.priority ?? busPriority(sound.bus),
    ...(sound.group ? { group: sound.group } : {}),
  }
}
