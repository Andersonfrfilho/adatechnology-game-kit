import mixProfilesJson from './data/mix-profiles.json'
import type { BusId } from './recipe'

export type BusSetting = { readonly gain?: number; readonly muted?: boolean }

/**
 * A mixing chain. `master` → (compressor) → output; with `reverb`, a wet bus → convolver (an impulse from the engine's seed) → master. `noise` is
 * the shared noise buffer: its length, and whether it is made with the chain (`eager`, the art scene) or by the first sound that needs it (`lazy`,
 * the game). Buses sit under the master and have no node until one is changed.
 */
export type MixProfile = {
  readonly id: string
  readonly master: number
  readonly compressor?: { readonly threshold: number; readonly ratio: number; readonly knee?: number; readonly attack?: number; readonly release?: number }
  readonly reverb?: { readonly seconds: number; readonly decay: number; readonly wet: number }
  readonly noise: { readonly seconds: number; readonly create: 'lazy' | 'eager' }
  readonly buses?: Readonly<Partial<Record<BusId, BusSetting>>>
  readonly sources: readonly string[]
}

/** The two team chains: `game` (master 0.5, jogo L62080) and `art_scene` (compressor and reverb, cena L1305–1313). */
export const MIX_PROFILES: Readonly<Record<string, MixProfile>> = Object.fromEntries(
  (mixProfilesJson as unknown as readonly MixProfile[]).map((profile) => [profile.id, profile]),
)
/** Q1: the kit plays through the art scene chain (compressor and reverb); `mix: 'game'` reverts. */
export const DEFAULT_MIX = 'art_scene'

/** A profile by id from `profiles`, or the profile itself. */
export function resolveMix(mix: string | MixProfile, profiles: Readonly<Record<string, MixProfile>> = MIX_PROFILES): MixProfile {
  if (typeof mix !== 'string') return mix
  const profile = profiles[mix]
  if (!profile) throw new Error(`game-audio: unknown mix profile "${mix}" (known: ${Object.keys(profiles).join(', ')})`)
  return profile
}

/** The gain a bus plays at: 0 when muted, its gain (default 1) otherwise. */
export function busGain(setting: BusSetting | undefined): number {
  if (!setting) return 1
  return setting.muted ? 0 : (setting.gain ?? 1)
}
