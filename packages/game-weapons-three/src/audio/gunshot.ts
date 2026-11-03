// A gunshot as the ear gets it: the close sound (crack, blast and body), the action, the space answering (a room or the open field) and, past ~50 m,
// the far boom that replaces the close one. Pure and deterministic: the adapter turns the voices into game-audio plays, and each group has the sample
// id of checklist-sons.md 5.1, so a recorded file replaces a group with no change here.
import type { CaliberDef } from '@adatechnology/game-weapons'
import { muzzleEnergy } from '@adatechnology/game-weapons'

import data from '../data/gunshot-profiles.json'

export type GunshotProfileId = keyof typeof data.profiles
export type GunshotFarClass = 'pistol' | 'rifle' | 'shotgun' | 'heavy'

type Noise = { readonly cutoff: number; readonly gain: number; readonly seconds: number }
export interface GunshotProfile {
  /** Muzzle energy (J) the numbers are written for: a lighter or heavier calibre of the family is scaled from it. */
  readonly referenceJ: number
  readonly far: GunshotFarClass
  /** Supersonic N-wave or muzzle snap: highpass noise. */
  readonly crack: { readonly frequency: number; readonly gain: number; readonly seconds: number }
  /** The mid "slap" of the muzzle blast: lowpass noise. */
  readonly blast: Noise
  /** The low thump: a sine sweeping `from` → `to`. */
  readonly body: { readonly from: number; readonly to: number; readonly gain: number; readonly seconds: number }
  readonly far_layer: Noise
  readonly tail_out: Noise
  readonly tail_in: Noise
}

export const GUNSHOT_PROFILES: Readonly<Record<GunshotProfileId, GunshotProfile>> = data.profiles as Record<GunshotProfileId, GunshotProfile>
export const GUNSHOT_CALIBER_PROFILES: Readonly<Record<string, GunshotProfileId>> = data.calibers as Record<string, GunshotProfileId>

/** Speed of sound in air at 20 °C, m/s: a shot 200 m away is heard 0.58 s after the flash. */
export const SPEED_OF_SOUND = 343
/** Takes per shot (C5: at least 4 variations, never the same twice in a row). */
export const GUNSHOT_TAKES = 4

export type GunshotSpace = 'outdoor' | 'indoor'
export type GunshotGroup = 'close' | 'mech' | 'tail' | 'far'

export interface GunshotInput {
  readonly caliber?: CaliberDef
  /** Muzzle energy (J), for a shot with no calibre; the calibre's energy (× pellets) otherwise. */
  readonly energyJ?: number
  readonly category?: string
  /** Metres from the listener, default 0 (the player's own weapon). */
  readonly distance?: number
  readonly suppressed?: boolean
  readonly space?: GunshotSpace
  /** 0..n−1: which take (`pickTake` gives one that is not the last). */
  readonly take?: number
  /** Pitch factor of this shot, around 1 (the adapter draws ±4 %). */
  readonly pitch?: number
  /** Master level, default 1. */
  readonly volume?: number
  /** 0..1, a wall between the shot and the listener: −6 dB and the lowpass cutoffs at 40 % when fully behind it (as game-audio's occlusion). */
  readonly occlusion?: number
}

export interface GunshotOptions {
  /** Replaces or adds profiles. */
  readonly profiles?: Readonly<Partial<Record<string, GunshotProfile>>>
  /** Replaces or adds calibre → profile links. */
  readonly calibers?: Readonly<Record<string, string>>
  /** Level law `(reference / d)^exponent` beyond `reference` metres (default 4 m, 0.8: a little gentler than the 6 dB per doubling of the free field, as games do). */
  readonly reference?: number
  readonly exponent?: number
  /** Below this the shot is not played (default 0.004, −48 dB). */
  readonly minGain?: number
  /** The close sound fades to the far one between these distances, metres (default 25 and 80). */
  readonly farFrom?: number
  readonly farTo?: number
}

export interface GunshotVoice {
  readonly group: GunshotGroup
  /** Which part of the group: `crack`, `blast`, `body`, `action`, `tail`, `echo`, `reflection`, `boom`. */
  readonly part: string
  /** Seconds after the trigger (the arrival delay included). */
  readonly at: number
  readonly kind: 'noise' | 'tone'
  readonly filter?: 'lowpass' | 'highpass' | 'bandpass'
  /** Filter frequency (noise) or start frequency (tone). */
  readonly frequency: number
  /** Tone end frequency. */
  readonly to?: number
  readonly q?: number
  readonly gain: number
  readonly seconds: number
  /** Send to the reverb (a room). */
  readonly wet?: number
}

export interface Gunshot {
  readonly profile: string
  readonly energyJ: number
  readonly supersonic: boolean
  readonly take: number
  readonly pitch: number
  /** Distance / speed of sound. */
  readonly delay: number
  /** 1 = all close, 0 = all far. */
  readonly closeMix: number
  readonly audible: boolean
  /** The sample ids each group can be replaced by (checklist 5.1). */
  readonly samples: Readonly<Record<GunshotGroup, string>>
  readonly voices: readonly GunshotVoice[]
}

const SHELL_KINDS: ReadonlySet<string> = new Set(['buck', 'slug', 'birdshot'])
const TAKE_JITTER = [
  { cutoff: 1, seconds: 1, body: 1 },
  { cutoff: 0.93, seconds: 1.08, body: 1.04 },
  { cutoff: 1.07, seconds: 0.92, body: 0.96 },
  { cutoff: 0.97, seconds: 1.04, body: 1.02 },
] as const
/** A bullet faster than this drags its own crack along (the N-wave); slower ones only have the muzzle snap. */
const SUPERSONIC_MS = 360

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const smoothstep = (x: number): number => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

export const energyOfGunshot = (input: Pick<GunshotInput, 'caliber' | 'energyJ'>): number => {
  if (input.energyJ !== undefined) return input.energyJ
  if (!input.caliber) return 0
  return muzzleEnergy(input.caliber) * (input.caliber.pellets ?? 1)
}

/** The profile of a shot: by calibre (the data's table), then a shotgun by shell, then by energy. */
export const gunshotProfileOf = (input: Pick<GunshotInput, 'caliber' | 'energyJ' | 'category'>, options: GunshotOptions = {}): string => {
  const table = { ...GUNSHOT_CALIBER_PROFILES, ...options.calibers }
  const byCaliber = input.caliber ? table[input.caliber.id] : undefined
  if (byCaliber) return byCaliber
  if (input.category === 'shotgun' || SHELL_KINDS.has(input.caliber?.kind ?? '')) return 'shotgun_12'
  const energy = energyOfGunshot(input)
  if (input.category === 'pistol' || input.category === 'revolver' || input.category === 'smg') return energy < 300 ? 'pistol_22lr' : energy < 700 ? 'pistol_9mm' : 'revolver_44_50ae'
  if (energy < 300) return 'pistol_22lr'
  if (energy < 1000) return 'pistol_9mm'
  if (energy < 2000) return 'rifle_5_56'
  if (energy < 3000) return 'rifle_7_62x39'
  if (energy < 5000) return 'rifle_308_3006'
  return energy < 12000 ? 'sniper_338_300wm' : 'antimateriel_50bmg'
}

/** A take that is not `last` (C5): `random` in [0, 1). */
export const pickTake = (last: number | undefined, random: () => number, takes = GUNSHOT_TAKES): number => {
  if (takes <= 1) return 0
  if (last === undefined) return Math.floor(random() * takes) % takes
  const next = Math.floor(random() * (takes - 1)) % (takes - 1)
  return next >= last ? next + 1 : next
}

/**
 * The voices of one gunshot. Distance: every layer arrives `d / 343` s late; the level falls as `(reference / d)^exponent`, the highs go first (the
 * crack fades over ~60 m, lowpass cutoffs fall with `1 + d / 250`) and the close sound fades into the far boom between `farFrom` and `farTo`. Space:
 * outdoors the field answers with two late echoes and a long low tail; indoors the room answers at once (early reflections and a dense, short tail
 * sent to the reverb). A suppressor takes the blast and the body down and leaves the action and a supersonic crack.
 */
export function computeGunshot(input: GunshotInput, options: GunshotOptions = {}): Gunshot {
  const profileId = gunshotProfileOf(input, options)
  const profiles = { ...GUNSHOT_PROFILES, ...options.profiles } as Record<string, GunshotProfile | undefined>
  const profile = profiles[profileId] ?? GUNSHOT_PROFILES.pistol_9mm
  const energyJ = energyOfGunshot(input) || profile.referenceJ
  const take = Math.max(0, Math.floor(input.take ?? 0)) % GUNSHOT_TAKES
  const jitter = TAKE_JITTER[take] ?? TAKE_JITTER[0]
  const pitch = input.pitch ?? 1
  const distance = Math.max(0, input.distance ?? 0)
  const reference = options.reference ?? 4
  const exponent = options.exponent ?? 0.8
  const level = (input.volume ?? 1) * Math.pow(reference / Math.max(distance, reference), exponent) * (1 - 0.5 * clamp01(input.occlusion ?? 0))
  const delay = distance / SPEED_OF_SOUND
  const closeMix = 1 - smoothstep((distance - (options.farFrom ?? 25)) / ((options.farTo ?? 80) - (options.farFrom ?? 25)))
  const occlusion = clamp01(input.occlusion ?? 0)
  const air = (1 - 0.6 * occlusion) / (1 + distance / 250)
  const highs = Math.exp(-distance / 60) * (1 - 0.8 * occlusion)
  const space: GunshotSpace = input.space ?? 'outdoor'
  const supersonic = (input.caliber?.muzzleSpeed ?? 0) > SUPERSONIC_MS
  const shell = input.caliber?.kind === 'slug' ? data.shells.slug : input.caliber?.kind === 'birdshot' ? data.shells.birdshot : undefined
  const sup = data.suppressor
  const suppressed = input.suppressed === true
  // a heavier load of the family is louder, longer and a little lower
  const ratio = energyJ / profile.referenceJ
  const loud = Math.pow(ratio, 0.15)
  const longer = Math.pow(ratio, 0.1)
  const lower = Math.pow(ratio, -0.05) * pitch
  const farClass = profile.far
  const samples: Record<GunshotGroup, string> = {
    close: suppressed ? (farClass === 'pistol' ? 'suppressed_pistol' : 'suppressed_rifle') : profileId,
    mech: `mech_${input.category ?? 'rifle'}`,
    tail: space === 'indoor' ? 'gunshot_tail_indoor' : 'gunshot_tail_outdoor',
    far: `gunshot_far_${farClass}`,
  }

  const voices: GunshotVoice[] = []
  const push = (voice: GunshotVoice): void => {
    if (voice.gain > 0.0005) voices.push(voice)
  }
  const near = level * closeMix
  if (near > 0) {
    const crackGain = profile.crack.gain * (shell && 'crackGain' in shell ? shell.crackGain : 1) * (suppressed ? (supersonic ? sup.supersonicCrack : sup.subsonicCrack) : 1)
    push({ group: 'close', part: 'crack', at: delay, kind: 'noise', filter: 'highpass', frequency: profile.crack.frequency * lower, q: 0.7, gain: crackGain * near * highs * loud, seconds: profile.crack.seconds })
    const blastGain = profile.blast.gain * (shell && 'blastGain' in shell ? shell.blastGain : 1) * (suppressed ? sup.blastGain : 1)
    const blastSeconds = profile.blast.seconds * jitter.seconds * longer * (shell && 'blastSeconds' in shell ? shell.blastSeconds : 1)
    push({ group: 'close', part: 'blast', at: delay, kind: 'noise', filter: 'lowpass', frequency: profile.blast.cutoff * jitter.cutoff * lower * air * (suppressed ? sup.blastCutoff : 1), q: 0.8, gain: blastGain * near * loud, seconds: blastSeconds })
    const bodyGain = profile.body.gain * (shell && 'bodyGain' in shell ? shell.bodyGain : 1) * (suppressed ? sup.bodyGain : 1)
    push({ group: 'close', part: 'body', at: delay, kind: 'tone', frequency: profile.body.from * jitter.body * lower, to: profile.body.to * lower, gain: bodyGain * near * loud, seconds: profile.body.seconds * jitter.seconds * longer })
    const mech = (data.mech as unknown as Record<string, { at: number; frequency: number; gain: number } | undefined>)[input.category ?? '']
    // the action is only heard close (it is ~40 dB under the blast)
    if (mech && mech.gain > 0 && distance < 15) push({ group: 'mech', part: 'action', at: delay + mech.at, kind: 'noise', filter: 'bandpass', frequency: mech.frequency * pitch, q: 3, gain: mech.gain * (suppressed ? sup.mechGain : 1) * near, seconds: 0.05 })
  }
  const far = level * (1 - closeMix)
  if (far > 0) {
    const f = profile.far_layer
    const g = f.gain * (suppressed ? sup.farGain : 1) * loud * far
    push({ group: 'far', part: 'boom', at: delay, kind: 'noise', filter: 'lowpass', frequency: f.cutoff * jitter.cutoff * lower * air, q: 0.7, gain: g, seconds: f.seconds * jitter.seconds * longer })
    push({ group: 'far', part: 'body', at: delay, kind: 'tone', frequency: profile.body.to * 1.6 * lower, to: profile.body.to * lower, gain: g * 0.6, seconds: f.seconds * 0.8 })
  }
  // the space: the tail falls slower with distance than the direct sound (far away, the reverberant field is most of what is heard)
  const tailLevel = (input.volume ?? 1) * Math.pow(Math.max(level / (input.volume ?? 1), 1e-6), 0.6) * (suppressed ? sup.tailGain : 1) * loud
  if (space === 'indoor') {
    const t = profile.tail_in
    for (const [at, gain] of data.space.indoorReflections as [number, number][]) {
      push({ group: 'tail', part: 'reflection', at: delay + at, kind: 'noise', filter: 'lowpass', frequency: profile.blast.cutoff * lower * air, q: 0.7, gain: profile.blast.gain * gain * level * (suppressed ? sup.blastGain : 1), seconds: profile.blast.seconds * 0.7 })
    }
    push({ group: 'tail', part: 'tail', at: delay + 0.004, kind: 'noise', filter: 'lowpass', frequency: t.cutoff * lower * air, q: 0.6, gain: t.gain * tailLevel, seconds: t.seconds * longer, wet: data.space.indoorWet })
  } else {
    const t = profile.tail_out
    push({ group: 'tail', part: 'tail', at: delay + 0.03, kind: 'noise', filter: 'lowpass', frequency: t.cutoff * lower * air, q: 0.6, gain: t.gain * tailLevel, seconds: t.seconds * longer })
    for (const [at, gain] of data.space.outdoorEchoes as [number, number][]) {
      push({ group: 'tail', part: 'echo', at: delay + at, kind: 'noise', filter: 'lowpass', frequency: profile.far_layer.cutoff * lower * air, q: 0.7, gain: profile.far_layer.gain * gain * tailLevel, seconds: profile.far_layer.seconds })
    }
  }
  const minGain = options.minGain ?? 0.004
  const audible = voices.some((voice) => voice.gain >= minGain)
  return { profile: profileId, energyJ, supersonic, take, pitch, delay, closeMix, audible, samples, voices: audible ? voices : [] }
}
