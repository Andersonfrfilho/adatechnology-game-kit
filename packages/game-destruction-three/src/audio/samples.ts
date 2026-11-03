// The recorded files of the blasts and the fire (`@adatechnology/game-audio/assets/sfx/explosoes-fogo`, field recordings): the numbers each sound id
// needs on top of its files. Same ids as the synthesized recipes of `blast-fire.ts`, which stay as the fallback while the files load, when they fail,
// and for every family that has no recording yet (fuel, pipe bomb, rocket, the indoor tail).
import { sampleBankFromManifest } from '@adatechnology/game-audio'
import type { SampleDefaults, SampleSound, SfxManifest, SoundBank } from '@adatechnology/game-audio'
import { BLAST_FALLOFF, BLAST_FAR_FALLOFF, FIRE_FALLOFF } from './blast-fire'

/** The numbers of one recorded sound, plus whether it loops (the fire's roar). */
export type BlastFireSampleDefaults = SampleDefaults & { readonly loop?: boolean | { readonly crossfade?: number } }

const blast = (gain: number): BlastFireSampleDefaults => ({ bus: 'world', gain, falloff: BLAST_FALLOFF, cutoffK: 0.006, priority: 3 })
const fire = (gain: number, group?: string): BlastFireSampleDefaults => ({ bus: 'world', gain, falloff: FIRE_FALLOFF, cutoffK: 0.01, ...(group ? { group } : {}) })

/**
 * The sounds of the blasts and the fire that have recorded takes, with their bus, level and distance curve (the recipes' own curves, so a file and its
 * fallback fade alike with distance). Data: a game passes its own table to `blastFireSampleBank`.
 */
export const BLAST_FIRE_SAMPLES: Readonly<Record<string, BlastFireSampleDefaults>> = {
  explosion_grenade: blast(1),
  explosion_big: blast(1),
  explosion_car: blast(1),
  explosion_flashbang: blast(1),
  molotov_break_ignite: blast(0.8),
  // the far takes are already muffled: no extra distance lowpass
  explosion_far: { bus: 'world', gain: 1, falloff: BLAST_FAR_FALLOFF, cutoffK: 0, priority: 2 },
  fire_ignite: fire(0.8, 'fire_ignite'),
  fire_crackle: fire(0.8, 'fire_crackle'),
  fire_pop: fire(0.6, 'fire_crackle'),
  fire_extinguish: fire(0.7),
  gas_leak: fire(0.5),
  // the roar: recorded fires chained with a crossfade (the level comes from `createDestructionSound`, by how much burns)
  fire_loop: { bus: 'world', gain: 4, loop: { crossfade: 1 } },
}

export type BlastFireSampleBankOptions = {
  /** Bank id (default 'destruction-samples'). */
  readonly id?: string
  /** Where the manifest's folder is served (`/sfx/`); default ''. */
  readonly baseUrl?: string
  /** Numbers per id (default `BLAST_FIRE_SAMPLES`). */
  readonly sounds?: Readonly<Record<string, BlastFireSampleDefaults>>
}

/**
 * A bank of the recorded blasts and fire from the kit's sound manifest. Register it with the engine next to `DESTRUCTION_SOUND_BANK`: each id plays
 * its files once loaded and its synthesized recipe until then.
 */
export function blastFireSampleBank(manifest: SfxManifest, options: BlastFireSampleBankOptions = {}): SoundBank {
  const sounds = options.sounds ?? BLAST_FIRE_SAMPLES
  const bank = sampleBankFromManifest(manifest, { id: options.id ?? 'destruction-samples', ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }), sounds })
  const samples: SampleSound[] = (bank.samples ?? []).map((sample) => {
    const loop = sounds[sample.id]?.loop
    return loop === undefined ? sample : { ...sample, loop }
  })
  return { ...bank, samples }
}
