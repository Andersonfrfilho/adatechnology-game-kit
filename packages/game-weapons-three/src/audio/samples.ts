// The recorded firearm sounds of game-audio's sfx (`assets/sfx/armas`, cut by tools/sfx-sources from The Free Firearm Sound Library, CC0, and the
// Restrained Firearms Soundpack, CC BY 4.0): the numbers of each sound the files do not say, and the bank the weapon audio registers. A shot plays
// the takes of its calibre profile (`close` near, `far` from the mid-distance microphone, crossed over by distance); a reload step plays the takes
// of its cue in the tier of the weapon's weight (light pistols, medium rifles, heavy shotguns); a brass case landing plays the bounces of its floor
// (Oculus Audio Pack 1, CC BY 4.0: concrete, grass, metal). Without the files the synthesized sounds play.
import { sampleBankFromManifest } from '@adatechnology/game-audio'
import type { SampleDefaults, SampleSound, SfxManifest, SfxManifestSound, SoundBank } from '@adatechnology/game-audio'

import hitData from '../data/reload-sample-hits.json'
import profiles from '../data/gunshot-profiles.json'
import type { SoundProfile } from './reload-sounds'

/** Where the recorded files are: the manifest the converter wrote and how a file of it becomes a url. */
export interface WeaponSampleOptions {
  readonly manifest: SfxManifest
  /** Prefix of every file (`/sfx/`), when `url` is not given. Default ''. */
  readonly baseUrl?: string
  /** The url of a file of the manifest (`armas/pistol_9mm_close_01.ogg`): a served path or a `data:` url of the inlined bytes. */
  readonly url?: (file: string) => string
  /** Replaces the numbers of a sound by id (gain, crossover, falloff...). */
  readonly sounds?: Readonly<Record<string, Partial<SampleDefaults>>>
}

/** The shot sounds: the calibre profiles and the suppressed ones. */
export const GUNSHOT_SAMPLE_IDS: readonly string[] = [...Object.keys(profiles.profiles), 'suppressed_pistol', 'suppressed_rifle']

/**
 * A shot as recorded: the near take up to 20 m, the mid-distance one from 90 m, an equal-power crossfade between. The level falls gently (a
 * gunshot carries: about −14 dB at 100 m, −36 dB at 800 m) and the highs go with the air (6.7 kHz at 50 m, 2.2 kHz at 200 m). Three plays ring at once at most, so a burst stays shot
 * by shot.
 */
export const GUNSHOT_SAMPLE: SampleDefaults = {
  bus: 'weapons',
  gain: 1,
  pitch: 0.04,
  crossover: { from: 20, to: 90 },
  falloff: { model: 'inverse_square', k: 0.0005, minGain: 0.0006 },
  cutoffK: 0.04,
  priority: 3,
}
const SUPPRESSED_SAMPLE: SampleDefaults = { ...GUNSHOT_SAMPLE, gain: 0.55, crossover: { from: 10, to: 50 }, falloff: { model: 'inverse_square', k: 0.004, minGain: 0.0008 } }
/** A reload step: heard at the hands, about a third of a shot's level after the converter's peak normalization. */
export const RELOAD_SAMPLE: SampleDefaults = { bus: 'weapons', gain: 0.32, pitch: 0.05, falloff: { model: 'inverse_square', k: 0.05, minGain: 0.002 }, cutoffK: 0.02, priority: 2 }

/** A brass case's bounces on a floor: quiet, heard only near. */
export const CASING_SAMPLE: SampleDefaults = { bus: 'weapons', gain: 0.22, pitch: 0.06, falloff: { model: 'inverse_square', k: 0.08, minGain: 0.003 }, cutoffK: 0.03, priority: 1 }

/** The recorded bounces of a brass case on a floor (`casing_drop_<concreto|terra|metal>`); wood and the plastic hull of a shell stay synthesized. */
export const casingSampleId = (sample: string): string => sample.replace(/_(pistol|rifle|shell)$/, '')

/** Seconds from the start of each recorded reload step to its hit (`data/reload-sample-hits.json`, measured on the files). */
export const RELOAD_SAMPLE_HITS: Readonly<Record<string, number>> = hitData.hits

/** The tier a weapon's weight plays (`SFX_TIERS`: light from 0, medium from 0.34, heavy from 0.67). */
export const WEIGHT_INTENSITY: Readonly<Record<SoundProfile['weight'], number>> = { light: 0.1, medium: 0.5, heavy: 0.9 }

/**
 * Reload cues the recordings of another cue already carry: the magazine release button is the start of the "detach magazine" take, the slide of
 * the magazine into the well the start of the "insert magazine" one. When that sample plays, these cues stay silent.
 */
export const CUES_IN_SAMPLE: Readonly<Record<string, string>> = { mag_release: 'mag_out', mag_insert: 'mag_seat' }

const isGunshot = (id: string): boolean => GUNSHOT_SAMPLE_IDS.includes(id)

/** The numbers of a sound of the manifest: a gunshot, a case landing or a reload step (`armas` only). */
export function weaponSampleDefaults(sound: SfxManifestSound, overrides: WeaponSampleOptions['sounds'] = {}): SampleDefaults | undefined {
  if (sound.category !== 'armas') return undefined
  const base = sound.id.startsWith('suppressed_') ? SUPPRESSED_SAMPLE : isGunshot(sound.id) ? GUNSHOT_SAMPLE : sound.id.startsWith('casing_drop_') ? CASING_SAMPLE : RELOAD_SAMPLE
  return { ...base, ...overrides[sound.id] }
}

/** The bank of the recorded weapon sounds, every url through `url` (or `baseUrl`). Gunshots choke at three voices. */
export function weaponSampleBank(options: WeaponSampleOptions): SoundBank {
  const bank = sampleBankFromManifest(options.manifest, { id: 'weapons_three_samples', ...(options.url ? {} : { baseUrl: options.baseUrl ?? '' }), defaults: (sound) => weaponSampleDefaults(sound, options.sounds) })
  const url = options.url
  const remap = <T extends { readonly url: string }>(refs: readonly T[] | undefined): T[] | undefined => (refs && url ? refs.map((ref) => ({ ...ref, url: url(ref.url) })) : refs ? [...refs] : undefined)
  const samples = (bank.samples ?? []).map((sample): SampleSound => {
    const tiers = sample.tiers?.map((tier) => ({ ...tier, close: remap(tier.close) ?? [], ...(tier.far ? { far: remap(tier.far) ?? [] } : {}) }))
    return {
      ...sample,
      close: remap(sample.close) ?? [],
      ...(sample.far ? { far: remap(sample.far) ?? [] } : {}),
      ...(tiers ? { tiers } : {}),
      ...(isGunshot(sample.id) ? { choke: { voices: 3, fade: 0.06 } } : {}),
    }
  })
  return { id: bank.id, samples }
}
