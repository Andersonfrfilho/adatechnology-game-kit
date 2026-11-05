/**
 * Synthesized sounds measured from the kit's recordings (`tools/sfx-sources/fit.mjs`): what plays when the recorded files are not on the machine
 * (CI, the published site, a clean clone) or have not loaded yet, so a door, a shot or a footstep stays close to its recording instead of a hand-made
 * hiss. Each take of a recording becomes one recipe: white noise through the same twelve bandpass bands the fit measured, each band with its own gain
 * curve (exponential ramps), plus the ringing partials as sines. The takes of one id form a set, so plays vary like the recordings. A loop or an
 * ambience is a noise loop through a parallel bank with its average band gains. Only numbers: the data holds no audio.
 *
 * `fittedSoundBank()` gives the bank; `registerFittedSounds(engine)` registers it and, by default, lets it replace the older recipe of the same id
 * (except the ones driven by params, such as `fire_extinguish` and `gas_leak`), so the recording, its fitted copy and the call site share one id.
 */
import fitted from './data/fitted-sfx.json'
import { KIT_CATEGORY_BUS, KIT_SAMPLE_ALIASES } from './kit-samples'
import { splitTier } from './manifest'
import type { BusId, Envelope, Falloff, Layer, LoopRecipe, SoundBank, SoundRecipe, SoundSet } from './recipe'
import type { SoundRegistry } from './bank'

/** One band layer (`band`) or one partial (`frequency` + `wave`) of a fitted take: peak gain and its curve, `[seconds, 0..1]` points. */
export type FittedLayer = {
  readonly band?: number
  readonly frequency?: number
  readonly wave?: 'sine'
  readonly gain: number
  readonly env: readonly (readonly [number, number])[]
}
export type FittedTake = { readonly duration: number; readonly layers: readonly FittedLayer[] }
export type FittedSound = {
  readonly id: string
  readonly category: string
  readonly takes?: readonly FittedTake[]
  readonly loop?: { readonly bands: readonly { readonly band: number; readonly gain: number }[] }
  readonly sources: readonly string[]
}
/** A band: its centre, its Q and how many bandpass biquads in series (2 makes the skirts fall 12 dB an octave instead of 6). */
export type FittedBand = { readonly frequency: number; readonly q: number; readonly stages?: number }
export type FittedData = {
  readonly rate: number
  readonly bands: readonly FittedBand[]
  /** The bands of the loops (a parallel bank of single biquads); the take bands when left out. */
  readonly loopBands?: readonly FittedBand[]
  readonly sounds: readonly FittedSound[]
}

/** The fitted numbers of every recorded sound of the kit. */
export const FITTED_SFX: FittedData = fitted as FittedData

/** Voice sounds go on the voices bus whatever folder they are in (as the recordings do). */
const VOICE_IDS = /^(player_(hurt|death|effort|breath)|scream|zombie_)/

/** Ids whose older recipe reads params (a hiss of `seconds`): the fitted copy does not replace it. */
export const FITTED_KEEPS_RECIPE: ReadonlySet<string> = new Set(['fire_extinguish', 'gas_leak'])

/** How far each bus carries, the same curves the recordings play with. */
export const FITTED_FALLOFF: Readonly<Record<BusId, Falloff>> = {
  weapons: { model: 'inverse_square', k: 0.0005, minGain: 0.0006 },
  voices: { model: 'inverse_square', k: 0.006, minGain: 0.02 },
  world: { model: 'inverse_square', k: 0.002, minGain: 0.002 },
  ambience: { model: 'none' },
  weather: { model: 'none' },
  ui: { model: 'none' },
}

/** The bus of a fitted sound. */
export function fittedBus(sound: { readonly id: string; readonly category: string }): BusId {
  return VOICE_IDS.test(sound.id) ? 'voices' : (KIT_CATEGORY_BUS[sound.category] ?? 'world')
}

/** The id of take `index` (from 1) of a sound: `door_wood_shut~2`. */
export const fittedTakeId = (id: string, index: number): string => `${id}~${index}`

/** The lowest point of a curve (-80 dB): an exponential ramp cannot reach 0. */
const FLOOR = 0.0001

/** The gain curve of a layer: exponential ramps through its points, down to the floor at the end. */
function envelopeOf(points: FittedLayer['env'], duration: number): Envelope {
  const envelope: [number, number, 'set' | 'exp'][] = []
  let last = -1
  for (const [time, value] of points) {
    if (time <= last) continue
    envelope.push([time, Math.max(FLOOR, value), envelope.length === 0 ? 'set' : 'exp'])
    last = time
  }
  const out: Envelope = [...envelope, ...(last < duration ? [[duration, FLOOR, 'exp', 'fixed'] as const] : [])]
  return out
}

/** The recipe of one take. */
export function fittedTakeRecipe(sound: FittedSound, take: FittedTake, index: number, data: FittedData = FITTED_SFX): SoundRecipe {
  const bus = fittedBus(sound)
  const layers: Layer[] = take.layers.map((layer): Layer => {
    const envelope = envelopeOf(layer.env, take.duration)
    if (layer.wave && layer.frequency) return { gain: layer.gain, source: { kind: 'osc', wave: layer.wave, frequency: { set: layer.frequency } }, envelope }
    const band = data.bands[layer.band ?? 0] ?? { frequency: 1000, q: 1.6 }
    const stage = { type: 'bandpass' as const, frequency: { set: band.frequency }, q: band.q }
    return {
      gain: layer.gain,
      source: { kind: 'noise', offset: 'random', loop: true },
      filters: { mode: 'serial', bank: Array.from({ length: Math.max(1, band.stages ?? 1) }, () => stage) },
      envelope,
    }
  })
  return {
    id: fittedTakeId(sound.id, index),
    bus,
    duration: take.duration,
    tail: 0.02,
    layers,
    falloff: FITTED_FALLOFF[bus],
    pan: true,
    sources: ['sdk: fitted by tools/sfx-sources/fit.mjs from the recording', ...sound.sources],
  }
}

/** The loop of a loop or an ambience. */
export function fittedLoopRecipe(sound: FittedSound, data: FittedData = FITTED_SFX): LoopRecipe | null {
  if (!sound.loop || sound.loop.bands.length === 0) return null
  return {
    id: sound.id,
    bus: fittedBus(sound),
    order: 'chain_loop',
    source: { kind: 'noise', loop: true },
    filters: {
      mode: 'parallel',
      bank: sound.loop.bands.map(({ band, gain }) => {
        const spec = (data.loopBands ?? data.bands)[band] ?? { frequency: 1000, q: 1.6 }
        return { type: 'bandpass' as const, frequency: { set: spec.frequency }, q: spec.q, level: gain }
      }),
    },
    volume: 0,
    sources: ['sdk: fitted by tools/sfx-sources/fit.mjs from the recording (average band gains)', ...sound.sources],
  }
}

export type FittedBankOptions = {
  readonly id?: string
  /** Leave out sounds (by id or by a test). */
  readonly skip?: (sound: FittedSound) => boolean
  /** Playback rate range of each play of a set (default ±3 %). */
  readonly rate?: readonly [number, number]
  readonly data?: FittedData
  /**
   * Recipe id → recorded id, answered by the recorded id's fitted takes as the files answer it once loaded (default `KIT_SAMPLE_ALIASES`, so
   * `shut_wood` plays the fitted `door_wood_shut`). An alias whose target is not fitted is left alone.
   */
  readonly aliases?: Readonly<Record<string, string>>
}

/** The bank: one recipe per take, one set per id (its takes), one loop per loop sound. */
export function fittedSoundBank(options: FittedBankOptions = {}): SoundBank {
  const data = options.data ?? FITTED_SFX
  const sounds: SoundRecipe[] = []
  const sets: SoundSet[] = []
  const loops: LoopRecipe[] = []
  for (const sound of data.sounds) {
    if (options.skip?.(sound)) continue
    if (sound.loop) {
      const loop = fittedLoopRecipe(sound, data)
      if (loop) loops.push(loop)
      continue
    }
    const takes = sound.takes ?? []
    if (takes.length === 0) continue
    takes.forEach((take, index) => sounds.push(fittedTakeRecipe(sound, take, index + 1, data)))
    sets.push({ id: sound.id, variants: takes.map((_, index) => fittedTakeId(sound.id, index + 1)), rate: options.rate ?? [0.97, 1.03] })
  }
  const byId = new Map(sets.map((set) => [set.id, set]))
  // `<id>_light`, `_medium`, `_heavy` are the tiers the recordings gather under `<id>`: the bare id plays the medium tier (or the first there is)
  const tiers = new Map<string, SoundSet[]>()
  for (const set of sets) {
    const { base, tier } = splitTier(set.id)
    if (tier && !byId.has(base)) tiers.set(base, tier === 'medium' ? [set, ...(tiers.get(base) ?? [])] : [...(tiers.get(base) ?? []), set])
  }
  for (const [base, [first]] of tiers) if (first) sets.push({ ...first, id: base })
  for (const [alias, target] of Object.entries(options.aliases ?? KIT_SAMPLE_ALIASES)) {
    const set = byId.get(target)
    if (set && !byId.has(alias) && !options.skip?.({ id: alias, category: '', sources: [] })) sets.push({ ...set, id: alias })
  }
  return { id: options.id ?? 'fitted_sfx', sounds, sets, loops }
}

/** Ids of the recorded sounds that have fitted numbers (takes or a loop). */
export function fittedIds(data: FittedData = FITTED_SFX): string[] {
  return data.sounds.filter((sound) => (sound.takes?.length ?? 0) > 0 || (sound.loop?.bands.length ?? 0) > 0).map((sound) => sound.id)
}

export type RegisterFittedOptions = FittedBankOptions & {
  /** Let a fitted set or loop replace the older recipe of the same id (default true; `FITTED_KEEPS_RECIPE` always keeps theirs). */
  readonly replace?: boolean
}

/** What `registerFittedSounds` needs of an engine: its registry and `register`. */
export type FittedHost = { readonly registry: SoundRegistry; register(bank: SoundBank): void }

/**
 * Registers the fitted bank. A set loses to a recipe of the same id, so with `replace` the older one-shot recipe of each fitted id is removed (its
 * samples stay); a fitted loop simply replaces the older loop. Returns the ids now answered by a fitted sound.
 */
export function registerFittedSounds(host: FittedHost, options: RegisterFittedOptions = {}): string[] {
  const replace = options.replace ?? true
  const keep = (sound: FittedSound): boolean => FITTED_KEEPS_RECIPE.has(sound.id) || (!replace && (host.registry.sound(sound.id) !== undefined || host.registry.loop(sound.id) !== undefined))
  const bank = fittedSoundBank({ ...options, skip: (sound) => keep(sound) || (options.skip?.(sound) ?? false) })
  for (const set of bank.sets ?? []) {
    if (!host.registry.sound(set.id)) continue
    // `remove` drops every entry of the id: the recorded takes go back in, so the files still play once loaded
    const sample = host.registry.sample(set.id)
    host.registry.remove(set.id)
    if (sample) host.register({ id: `${bank.id}_kept_samples`, samples: [sample] })
  }
  host.register(bank)
  return [...(bank.sets ?? []).map((set) => set.id), ...(bank.loops ?? []).map((loop) => loop.id)]
}
