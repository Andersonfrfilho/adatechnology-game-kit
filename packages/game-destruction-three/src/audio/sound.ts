import type { Vec3 } from '@adatechnology/game-contracts'
import { GAME_SFX_BANK } from '@adatechnology/game-audio'
import type { AudioEngine, AudioLoopHandle } from '@adatechnology/game-audio'

import { DESTRUCTION_SOUND_BANK } from './recipes'
import type { SoundDetail } from './impact-keys'

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
 * The keys of a blow on a material (`impactSoundKeys`, `breakSoundKeys`): `impact_<family>_<blow>`, `impact_<material>[_<blow>]`, `break_<...>`. The renderer
 * sends them before its legacy family key, so the first one with a rule plays; a game replaces any of them in `keys`.
 */
export const IMPACT_SOUND_KEYS: Readonly<Record<string, SoundKeyRule>> = {
  impact_metal_ballistic: { sound: 'metal_bullet' },
  impact_metal_blunt: { sound: 'metal_blunt' },
  impact_metal_slash: { sound: 'metal_blade' },
  impact_aluminium_ballistic: { sound: 'metal_thin' },
  impact_aluminium_blunt: { sound: 'metal_thin' },
  impact_copper_ballistic: { sound: 'metal_thin' },
  impact_copper_blunt: { sound: 'metal_thin' },
  impact_wood_ballistic: { sound: 'wood_hit' },
  impact_wood_blunt: { sound: 'wood_blunt' },
  impact_wood_slash: { sound: 'wood_blade' },
  impact_mdf_ballistic: { sound: 'mdf_puff' },
  impact_mdf_blunt: { sound: 'mdf_puff', volumeScale: 0.8 },
  impact_glass_ballistic: { sound: 'glass_bullet' },
  impact_glass_blunt: { sound: 'glass_blunt' },
  impact_glass_slash: { sound: 'glass_blade' },
  impact_ceramic: { sound: 'ceramic_hit' },
  impact_ceramic_ballistic: { sound: 'ceramic_bullet' },
  impact_masonry_ballistic: { sound: 'masonry_bullet' },
  impact_masonry_blunt: { sound: 'masonry_blunt' },
  impact_masonry_slash: { sound: 'masonry_blade' },
  impact_plaster: { sound: 'plaster_puff' },
  impact_soil: { sound: 'soil_blunt' },
  impact_soil_ballistic: { sound: 'soil_bullet' },
  impact_sand: { sound: 'sand_hit' },
  impact_gravel: { sound: 'gravel_hit' },
  impact_plastic: { sound: 'plastic_hit' },
  impact_plastic_ballistic: { sound: 'plastic_bullet' },
  impact_rubber: { sound: 'rubber_hit' },
  impact_wax: { sound: 'wax_hit' },
  impact_soft_ballistic: { sound: 'soft_bullet' },
  impact_soft_slash: { sound: 'fabric_rip' },
  impact_paper: { sound: 'paper_hit' },
  impact_paper_slash: { sound: 'paper_tear' },
  impact_plant: { sound: 'leaf_rustle' },
  impact_plant_slash: { sound: 'branch_cut' },
  impact_flesh_fruit: { sound: 'fruit_splat' },
  break_ceramic: { sound: 'ceramic_break' },
  break_tempered_glass: { sound: 'tempered_burst' },
  break_plastic: { sound: 'plastic_crack' },
  break_mdf: { sound: 'mdf_crumble' },
  break_soft: { sound: 'fabric_rip' },
  break_paper: { sound: 'paper_tear' },
  break_plant: { sound: 'branch_cut' },
}

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
    drag_wood: { sound: 'drag_wood' },
    drag_metal: { sound: 'drag_metal' },
    drag_glass: { sound: 'drag_glass' },
    drag_masonry: { sound: 'drag_masonry' },
    drag_soft: { sound: 'drag_soft' },
    // a leaf worked by hand (doors, lids, drawers): the latch, the hinge turning, the leaf meeting the frame, a locked one shaken
    leaf_latch: { sound: 'latch' },
    leaf_creak_wood: { sound: 'creak_wood' },
    leaf_creak_metal: { sound: 'creak_metal' },
    leaf_shut_wood: { sound: 'shut_wood' },
    leaf_shut_metal: { sound: 'shut_metal' },
    leaf_shut_glass: { sound: 'shut_metal', volumeScale: 0.6 },
    leaf_shut_masonry: { sound: 'shut_wood' },
    leaf_shut_soft: { sound: 'shut_soft' },
    leaf_rattle: { sound: 'rattle' },
    leaf_slide: { sound: 'slide' },
    // the keys of the item clips (furniture and vehicle doors, hoods, trunks, drawers)
    door_latch: { sound: 'latch' },
    hood_latch: { sound: 'latch' },
    trunk_latch: { sound: 'latch' },
    door_open: { sound: 'latch' },
    door_shut: { sound: 'shut_metal' },
    hood_shut: { sound: 'shut_metal' },
    trunk_shut: { sound: 'shut_metal' },
    door_close: { sound: 'shut_wood', volumeScale: 0.7 },
    drawer_open: { sound: 'slide' },
    drawer_close: { sound: 'slide' },
    lid_open: { sound: 'latch' },
    lid_close: { sound: 'shut_soft' },
    flap_open: { sound: 'latch' },
    flap_close: { sound: 'shut_soft' },
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
    ...IMPACT_SOUND_KEYS,
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
  readonly onSound: (key: string, point: Vec3, volume: number, detail?: SoundDetail) => void
  /** The rule a key resolves to, if any; with `detail`, the rule `onSound` would play (the first of `detail.keys` that has one, else `key`'s). */
  rule(key: string, detail?: SoundDetail): SoundKeyRule | undefined
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
    onSound(key, point, volume, detail) {
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
      // the most specific key that has a rule (material and blow, material, family and blow, family), else the key itself; `null` on a specific key silences it
      let rule: SoundKeyRule | null | undefined
      for (const k of detail?.keys ?? []) {
        if (k in rules) {
          rule = rules[k]
          break
        }
      }
      if (rule === undefined) rule = rules[key]
      if (!rule) return
      const sound = rule.above && volume >= rule.above.volume ? rule.above.sound : rule.sound
      engine.play(sound, { position: point, volume: volume * (rule.volumeScale ?? 1), ...(rule.params ? { params: rule.params } : {}) })
    },
    rule(key, detail) {
      for (const k of detail?.keys ?? []) if (k in rules) return rules[k] ?? undefined
      return rules[key] ?? undefined
    },
    burning: () => burning,
    dispose() {
      loop?.stop()
      loop = undefined
      burning = 0
    },
  }
}
