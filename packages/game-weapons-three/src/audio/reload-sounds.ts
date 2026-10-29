import data from '../data/reload-sounds.json'
import type { SoundStep } from './mechanical-sounds'

/** The sound cues a reload clip carries (`cue(t, 'sound', { id })`): one per physical step, at the second the animation does it. */
export type ReloadCueId = keyof typeof data.cues

export const RELOAD_CUE_IDS = Object.keys(data.cues) as ReloadCueId[]

/** How a weapon sounds: the weight of its metal (pitch and level) and what it is made of. */
export interface SoundProfile {
  readonly weight: keyof typeof data.profiles.weight
  readonly material: keyof typeof data.profiles.material
}

export const DEFAULT_SOUND_PROFILE: SoundProfile = { weight: 'medium', material: 'steel' }

/** The recipes of the cues, as data (`data/reload-sounds.json`): layers of the primitives `createWeaponAudio` registers in game-audio. */
export const RELOAD_CUES: Readonly<Record<string, readonly SoundStep[]>> = data.cues as unknown as Record<string, readonly SoundStep[]>

const polymer = new Set<string>(data.polymer)
const weights = data.weights as Record<string, SoundProfile['weight']>

/** The profile of a weapon: the weight from the family of its model, polymer when the data lists it. */
export const soundProfileOf = (weaponId: string, modelFamily: string): SoundProfile => ({ weight: weights[modelFamily] ?? 'medium', material: polymer.has(weaponId) ? 'polymer' : 'steel' })

/** The layers of a cue for a profile: every frequency times the pitch of weight and material, every level times their gain. Pure. */
export const reloadCueSteps = (id: string, profile: SoundProfile = DEFAULT_SOUND_PROFILE, table: Readonly<Record<string, readonly SoundStep[]>> = RELOAD_CUES): readonly SoundStep[] => {
  const steps = table[id]
  if (!steps) return []
  const weight = data.profiles.weight[profile.weight]
  const material = data.profiles.material[profile.material]
  const pitch = weight.pitch * material.pitch
  const gain = weight.gain * material.gain
  return steps.map((entry): SoundStep => {
    switch (entry.layer) {
      case 'metal':
        return { ...entry, frequency: Math.round(entry.frequency * pitch), gain: entry.gain * gain }
      case 'thud':
        return { ...entry, frequency: Math.round(entry.frequency * pitch), gain: entry.gain * gain }
      case 'scene_tone':
        return { ...entry, f: Math.round(entry.f * pitch), ...(entry.f2 === undefined ? {} : { f2: Math.round(entry.f2 * pitch) }), vol: entry.vol * gain }
      case 'scene_noise':
        return { ...entry, f: Math.round(entry.f * pitch), ...(entry.f2 === undefined ? {} : { f2: Math.round(entry.f2 * pitch) }), vol: entry.vol * gain }
      default:
        return entry
    }
  })
}
