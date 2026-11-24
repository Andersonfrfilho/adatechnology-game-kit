import { createAudioEngine, loadKitSamples, loadUserSamples } from '@adatechnology/game-audio'
import type { AudioEngine } from '@adatechnology/game-audio'
import { registerFittedSounds } from '@adatechnology/game-audio/fitted'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import { DESTRUCTION_SOUND_KEYS, DESTRUCTION_VOICE_GROUPS, blastSoundIds, createDestructionSound, impactSoundIds } from '@adatechnology/game-destruction-three'
import type { SoundDetail } from '@adatechnology/game-destruction-three'

import { createWorldOcclusion } from './occlusion'

/** The recorded splash a round or a blast on water plays. */
export const WATER_SPLASH_SOUND = 'water_splash'

/** The sound of the world, over the kit's own engine (`createAudioEngine`: no AudioContext until the first sound). */
export type KitWorldAudioOptions = {
  /** Where the kit's recorded files are served (default `./sfx/`); `null` plays the recipes only. */
  readonly samplesBaseUrl?: string | null
  /** Where the owner's own sounds are served (default `./sfx-local/`); `null` leaves them out. They load after the kit's. */
  readonly userSamplesBaseUrl?: string | null
  /** The fitted copies of the recordings in place of the older recipes of the same ids (default true). */
  readonly fittedSounds?: boolean
  /** Ids the game's own sounds need decoded on the first key or click, when the page may make its AudioContext. */
  readonly preloadIds?: readonly string[]
  /** Every sound key the world plays, with its detail. */
  readonly onSound?: (key: string, point: Vec3, volume: number, detail?: SoundDetail) => void
  /** The owner's sounds were loaded: which ones play and which stay behind the kit's. */
  readonly onUserSounds?: (result: NonNullable<Awaited<ReturnType<typeof loadUserSamples>>>) => void
}

export type KitWorldSound = {
  /** The engine, or null in a silent world. */
  readonly audio: AudioEngine | null
  readonly destruction: ReturnType<typeof createDestructionSound> | null
  /** One sound key at a point: the destruction's voices and the game's `onSound`. */
  play(key: string, point: Vec3, volume: number, detail?: SoundDetail): void
  /** Frees the engine the host made; one the game handed in is not touched. */
  dispose(): void
}

export function createSound(world: DestructionWorld, option: false | AudioEngine | KitWorldAudioOptions | undefined): KitWorldSound {
  const isEngine = option !== undefined && option !== false && 'play' in option
  const options: KitWorldAudioOptions = option === undefined || option === false || isEngine ? {} : option
  const isOwned = !isEngine && option !== false
  const audio: AudioEngine | null = option === false ? null : isEngine ? option : createAudioEngine({ deferredStart: {}, groups: DESTRUCTION_VOICE_GROUPS, occlusion: { query: createWorldOcclusion(world) } })
  const destruction = audio ? createDestructionSound(audio) : null
  // the kit's recorded files, served next to the page: each recipe of the same id plays until its takes load, and stays where they cannot be fetched
  if (audio && options.samplesBaseUrl !== null) void loadRecordings(audio, options)
  // the fitted copies of the recordings: what each recorded id plays while its files load, or where they are not on the machine
  if (audio && options.fittedSounds !== false) registerFittedSounds(audio)
  return {
    audio,
    destruction,
    play(key, point, volume, detail) {
      destruction?.onSound(key, point, volume, detail)
      if (detail) options.onSound?.(key, point, volume, detail)
      else options.onSound?.(key, point, volume)
    },
    dispose() {
      destruction?.dispose()
      if (isOwned) audio?.dispose()
    },
  }
}

async function loadRecordings(audio: AudioEngine, options: KitWorldAudioOptions): Promise<void> {
  const bank = await loadKitSamples(audio, { baseUrl: options.samplesBaseUrl ?? './sfx/' })
  // the owner's own sounds after the kit's, so each one the kit has keeps the kit's recording in front
  if (options.userSamplesBaseUrl !== null) {
    const own = await loadUserSamples(audio, { baseUrl: options.userSamplesBaseUrl ?? './sfx-local/' })
    if (own) options.onUserSounds?.(own)
  }
  if (!bank || typeof window === 'undefined') return
  // the sounds of the hand and of the destruction style load on the first key or click, when the page may make its AudioContext, so even the first one is the recording
  const preload = (): void => {
    window.removeEventListener('keydown', preload, true)
    window.removeEventListener('pointerdown', preload, true)
    void audio.loadSamples([...(options.preloadIds ?? []), ...impactSoundIds(DESTRUCTION_SOUND_KEYS.art_scene)]).catch(() => undefined)
    // every explosion's boom, fire, debris and splash, decoded now: the first blast plays its recordings with no decode in its frames
    void audio.preload([...blastSoundIds(), WATER_SPLASH_SOUND]).catch(() => undefined)
  }
  window.addEventListener('keydown', preload, true)
  window.addEventListener('pointerdown', preload, true)
}
