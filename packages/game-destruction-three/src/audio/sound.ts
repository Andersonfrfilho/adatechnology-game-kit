import type { Vec3 } from '@adatechnology/game-contracts'
import { GAME_SFX_BANK } from '@adatechnology/game-audio'
import type { AudioEngine, AudioLoopHandle } from '@adatechnology/game-audio'

import { DESTRUCTION_SOUND_BANK } from './recipes'

/**
 * What a sound key plays: the recipe, its params, a scale on the volume the renderer gives, and (optionally) a louder recipe above a volume
 * (a big blast gets the long boom).
 */
export type SoundKeyRule = {
  readonly sound: string
  readonly params?: Readonly<Record<string, number>>
  readonly volumeScale?: number
  readonly above?: { readonly volume: number; readonly sound: string }
}

export type DestructionSoundStyle = 'art_scene' | 'game'

/**
 * The keys `createDestructionRenderer` sends to `onSound`, mapped to the sounds the teams delivered. The Cena de Arte has a sound for every material
 * (clang, wood, glass, crumble, thud...); the game has four classes (impact, glass, wood, explosion) and its own explosion thump. Which team sound answers
 * which key is the kit's choice (the teams call the sounds, not the renderer's keys), so it is data: `keys` replaces any entry.
 */
export const DESTRUCTION_SOUND_KEYS: Readonly<Record<DestructionSoundStyle, Readonly<Record<string, SoundKeyRule>>>> = {
  art_scene: {
    impact_metal: { sound: 'clang' },
    impact_wood: { sound: 'wood_hit' },
    impact_glass: { sound: 'ping' },
    impact_masonry: { sound: 'chip' },
    impact_soft: { sound: 'thud' },
    shatter_glass: { sound: 'glass_shatter' },
    crumble: { sound: 'crumble' },
    splinter: { sound: 'crack' },
    ricochet: { sound: 'ping' },
    unscrew: { sound: 'chip' },
    detach: { sound: 'thunk' },
    ignite: { sound: 'hiss', params: { seconds: 0.5 } },
    extinguish: { sound: 'hiss' },
    melt_sizzle: { sound: 'hiss', params: { seconds: 0.6 } },
    explode: { sound: 'boom', above: { volume: 0.9, sound: 'boom_big' } },
  },
  game: {
    impact_metal: { sound: 'sfx_impact' },
    impact_wood: { sound: 'sfx_wood' },
    impact_glass: { sound: 'sfx_glass' },
    impact_masonry: { sound: 'sfx_impact' },
    impact_soft: { sound: 'sfx_flesh' },
    shatter_glass: { sound: 'sfx_glass' },
    crumble: { sound: 'sfx_impact' },
    splinter: { sound: 'sfx_wood' },
    explode: { sound: 'explosion_boom' },
  },
}

export type DestructionSoundOptions = {
  /** Which team answers the keys (default `art_scene`, the kit mix). `game` falls back to the art scene for the keys the game has no sound for. */
  readonly style?: DestructionSoundStyle
  /** Replaces or adds a key's rule; `null` silences it. */
  readonly keys?: Readonly<Record<string, SoundKeyRule | null>>
  /** The fire loop: the volume each burning part adds and the most it reaches (the page never raises it, so these are the kit's). */
  readonly fire?: { readonly perFire?: number; readonly max?: number }
  /** Burn loop on or off (default on). */
  readonly burnLoop?: boolean
}

export type DestructionSound = {
  /** Pass to `createDestructionRenderer({ onSound })`. */
  readonly onSound: (key: string, point: Vec3, volume: number) => void
  /** The rule a key resolves to, if any. */
  rule(key: string): SoundKeyRule | undefined
  /** Parts burning now. */
  readonly burning: () => number
  dispose(): void
}

export const DEFAULT_FIRE = { perFire: 0.05, max: 0.2 } as const

/**
 * Plays the renderer's sound keys on a game-audio engine: the bank is registered in the engine, a key becomes a positional sound at the point, and
 * `burn_loop` / `burn_end` (a part starts to burn, a part burns out or is put out) drive one fire loop whose volume follows how many parts burn.
 */
export function createDestructionSound(engine: AudioEngine, options: DestructionSoundOptions = {}): DestructionSound {
  engine.register(DESTRUCTION_SOUND_BANK)
  engine.register(GAME_SFX_BANK)
  const fire = { ...DEFAULT_FIRE, ...options.fire }
  const rules: Record<string, SoundKeyRule | null | undefined> = { ...DESTRUCTION_SOUND_KEYS.art_scene, ...(options.style === 'game' ? DESTRUCTION_SOUND_KEYS.game : {}), ...options.keys }
  let loop: AudioLoopHandle | undefined
  let burning = 0

  const setFire = (): void => {
    if (options.burnLoop === false) return
    if (burning <= 0) {
      loop?.stop()
      loop = undefined
      return
    }
    loop ??= engine.loop('burn_loop')
    loop.set({ volume: Math.min(fire.max, fire.perFire * burning) })
  }

  return {
    onSound(key, point, volume) {
      if (key === 'burn_loop') {
        burning += 1
        setFire()
        return
      }
      if (key === 'burn_end') {
        if (burning > 0) burning -= 1
        setFire()
        return
      }
      const rule = rules[key]
      if (!rule) return
      const sound = rule.above && volume >= rule.above.volume ? rule.above.sound : rule.sound
      engine.play(sound, { position: point, volume: volume * (rule.volumeScale ?? 1), ...(rule.params ? { params: rule.params } : {}) })
    },
    rule: (key) => rules[key] ?? undefined,
    burning: () => burning,
    dispose() {
      loop?.stop()
      loop = undefined
      burning = 0
    },
  }
}
