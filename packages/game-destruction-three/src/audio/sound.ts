import type { Vec3 } from '@adatechnology/game-contracts'
import { FOLEY_BANK, GAME_SFX_BANK } from '@adatechnology/game-audio'
import type { AudioEngine, AudioLoopHandle } from '@adatechnology/game-audio'

import { BIG_BLAST_RADIUS, BLAST_FAR_DISTANCE, BLAST_KIND_OF, BLAST_SOUND_OF, FIRE_CRACKLE_OF, FIRE_FUEL_OF, FIRE_LOOP_OF } from './blast-fire'
import type { BlastKind, FireFuel } from './blast-fire'
import { DESTRUCTION_SOUND_BANK } from './recipes'
import type { SoundDetail } from '../types'

/**
 * What a sound key plays: the recipe, its params, a scale on the volume the renderer gives, and (optionally) a louder recipe above a volume
 * (a big blast gets the long boom).
 */
export type SoundKeyRule = {
  readonly sound: string
  readonly params?: Readonly<Record<string, number>>
  readonly volumeScale?: number
  readonly above?: { readonly volume: number; readonly sound: string }
  /** A sound of this bank played when the engine does not know `sound` (a vehicle door without the vehicle bank registered shuts like metal). */
  readonly fallback?: string
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
  ricochet_metal: { sound: 'ricochet_metal' },
  ricochet_masonry: { sound: 'ricochet_stone' },
  ricochet_soil: { sound: 'ricochet_stone' },
  ricochet_ceramic: { sound: 'ricochet_stone' },
  break_ceramic: { sound: 'ceramic_break' },
  break_tempered_glass: { sound: 'tempered_burst' },
  break_plastic: { sound: 'plastic_crack' },
  break_mdf: { sound: 'mdf_crumble' },
  break_soft: { sound: 'fabric_rip' },
  break_paper: { sound: 'paper_tear' },
  break_plant: { sound: 'branch_cut' },
}

/**
 * Every sound a blow, ricochet or break on a material can play (`sound`, `above.sound` and `fallback` of each rule of `rules`): a game preloads them on
 * the first input, so even the first ricochet or impact plays the recording instead of the synthesized recipe while the file is still loading.
 */
export const impactSoundIds = (rules: Readonly<Record<string, SoundKeyRule>> = IMPACT_SOUND_KEYS): string[] => {
  const ids = new Set<string>()
  for (const rule of Object.values(rules)) {
    ids.add(rule.sound)
    if (rule.above) ids.add(rule.above.sound)
    if (rule.fallback) ids.add(rule.fallback)
  }
  return [...ids]
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
    // a round strikes: the steel rings high, glass cracks, wood and masonry chip, a soft part takes a dull thunk
    shot_metal: { sound: 'ping' },
    shot_wood: { sound: 'chip' },
    shot_glass: { sound: 'crack' },
    shot_masonry: { sound: 'chip' },
    shot_soft: { sound: 'thunk' },
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
    // a vehicle's leaves (the vehicle bank of game-vehicles-three): a car door shuts with a padded thump and a latch, not like a fridge
    vehicle_door_open: { sound: 'car_door_open', fallback: 'latch' },
    vehicle_door_shut: { sound: 'car_door_close', fallback: 'shut_metal' },
    vehicle_trunk_open: { sound: 'car_door_open', fallback: 'latch' },
    vehicle_trunk_shut: { sound: 'car_trunk_close', fallback: 'shut_metal' },
    vehicle_hood_open: { sound: 'car_hood_open', fallback: 'latch' },
    vehicle_hood_shut: { sound: 'car_hood_close', fallback: 'shut_metal' },
    drawer_open: { sound: 'slide' },
    drawer_close: { sound: 'slide' },
    lid_open: { sound: 'latch' },
    lid_close: { sound: 'shut_soft' },
    flap_open: { sound: 'latch' },
    flap_close: { sound: 'shut_soft' },
    // an item taken in the hand, by what it is made of (game-audio's KIT_SAMPLE_ALIASES puts recordings on these ids)
    grab_metal: { sound: 'grab_hard' },
    grab_wood: { sound: 'grab_hard' },
    grab_glass: { sound: 'grab_hard', volumeScale: 0.7 },
    grab_masonry: { sound: 'grab_hard' },
    grab_soft: { sound: 'grab_soft' },
    shatter_glass: { sound: 'glass_shatter' },
    crumble: { sound: 'crumble' },
    splinter: { sound: 'crack' },
    ricochet: { sound: 'ping' },
    unscrew: { sound: 'chip' },
    detach: { sound: 'thunk' },
    ignite: { sound: 'fire_ignite' },
    primed: { sound: 'gas_leak' },
    extinguish: { sound: 'fire_extinguish' },
    melt_sizzle: { sound: 'hiss', params: { seconds: 0.6 } },
    // the blast family comes from the explosion's effect (`BLAST_KIND_OF`); this rule answers only an explosion the kit cannot place
    explode: { sound: 'explosion_grenade', above: { volume: 0.9, sound: 'explosion_big' } },
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
  /** Replaces or adds a key's rule; `null` silences it. A key without a rule that is the id of a registered sound (the foley bank's) plays that sound. */
  readonly keys?: Readonly<Record<string, SoundKeyRule | null>>
  /** The fire loop: the volume each burning part adds and the most it reaches (the page never raises it, so these are the kit's). */
  readonly fire?: { readonly perFire?: number; readonly max?: number }
  /** Burn loop on or off (default on). */
  readonly burnLoop?: boolean
  /** The loop of the wood fire (default `fire_loop`; `burn_loop` is the art scene's bright one). */
  readonly fireLoop?: string
  /** Adds to or changes `FIRE_FUEL_OF`: which fuel a burning material sounds like. */
  readonly fuels?: Readonly<Record<string, FireFuel>>
  /** Adds to or changes `FIRE_LOOP_OF`: the loop of each fuel. */
  readonly fireLoops?: Partial<Readonly<Record<FireFuel, string>>>
  /** The fuel of a fire whose material is not in the table (default `wood`). */
  readonly defaultFuel?: FireFuel
  /** Crackles per second over the fire loop: `base + perSqrtFire × √(parts burning)`, at most `max` (default 2, 3, 14). `false` turns them off. */
  readonly crackles?: false | { readonly base?: number; readonly perSqrtFire?: number; readonly max?: number; readonly volume?: number }
  /** Adds to or changes `BLAST_KIND_OF`: which family a named explosion (`effect`) sounds like. */
  readonly blastKinds?: Readonly<Record<string, BlastKind>>
  /** Metres past which a blast plays `explosion_far` instead of its own sound (default `BLAST_FAR_DISTANCE`). */
  readonly blastFarDistance?: number
  /** `confinement` of a blast (from its report) from which the indoor tail plays too (default 1.3). */
  readonly indoorConfinement?: number
  /** Seed of the crackle timing (default 1). */
  readonly seed?: number
}

export type DestructionSound = {
  /** Pass to `createDestructionRenderer({ onSound })`. */
  readonly onSound: (key: string, point: Vec3, volume: number, detail?: SoundDetail) => void
  /** Moves the fire crackles on; call once per frame with the frame time in seconds. */
  update(dt: number): void
  /** The sound an explosion plays (`explode` with its detail), for a listener at the engine's listener position. */
  blastSound(point: Vec3, volume: number, detail?: SoundDetail): string
  /** The rule a key resolves to, if any; with `detail`, the rule `onSound` would play (the first of `detail.keys` that has one, else `key`'s). */
  rule(key: string, detail?: SoundDetail): SoundKeyRule | undefined
  /** Parts burning now. */
  readonly burning: () => number
  /** Parts burning now, by fuel. */
  readonly burningBy: () => Readonly<Partial<Record<FireFuel, number>>>
  /** Puts every fire sound out (the scene was cleared); the engine and the bank stay. */
  reset(): void
  dispose(): void
}

export const DEFAULT_FIRE = { perFire: 0.08, max: 0.45 } as const
export const DEFAULT_CRACKLES = { base: 2, perSqrtFire: 3, max: 14, volume: 0.5 } as const
export const DEFAULT_INDOOR_CONFINEMENT = 1.3

/**
 * Plays the renderer's sound keys on a game-audio engine: the bank is registered in the engine, a key becomes a positional sound at the point, and
 * `burn_loop` / `burn_end` (a part starts to burn, a part burns out or is put out) drive one fire loop whose volume follows how many parts burn, with
 * crackles at the burning points (`update`). An explosion plays the sound of its family (`BLAST_KIND_OF` by its effect), the far rumble past
 * `blastFarDistance` and the indoor tail when the blast was confined.
 */
export function createDestructionSound(engine: AudioEngine, options: DestructionSoundOptions = {}): DestructionSound {
  engine.register(DESTRUCTION_SOUND_BANK)
  engine.register(GAME_SFX_BANK)
  // the foley of the hand (doors, lids, drawers, items): its ids are keys of their own, played as they are
  engine.register(FOLEY_BANK)
  const fire = { ...DEFAULT_FIRE, ...options.fire }
  const crackles = options.crackles === false ? null : { ...DEFAULT_CRACKLES, ...options.crackles }
  const fireLoop = options.fireLoop ?? 'fire_loop'
  const kinds: Readonly<Record<string, BlastKind>> = { ...BLAST_KIND_OF, ...options.blastKinds }
  const farDistance = options.blastFarDistance ?? BLAST_FAR_DISTANCE
  const indoorFrom = options.indoorConfinement ?? DEFAULT_INDOOR_CONFINEMENT
  const rules: Record<string, SoundKeyRule | null | undefined> = { ...DESTRUCTION_SOUND_KEYS.art_scene, ...(options.style === 'game' ? DESTRUCTION_SOUND_KEYS.game : {}), ...options.keys }
  // a blast takes its family's sound unless the host chose the explode rule itself (a style or a key of its own)
  const blastByKind = options.style !== 'game' && !(options.keys && 'explode' in options.keys)
  const channel = engine.channel({ seed: options.seed ?? 1 })
  const fuelOf: Readonly<Record<string, FireFuel>> = { ...FIRE_FUEL_OF, ...options.fuels }
  const loopOf: Readonly<Record<FireFuel, string>> = { ...FIRE_LOOP_OF, ...(options.fireLoop ? { wood: fireLoop, fabric: fireLoop } : {}), ...options.fireLoops }
  const defaultFuel = options.defaultFuel ?? 'wood'
  // one loop per sound (fuels that share a loop share its level); a loop stops when nothing of its fuels burns
  const loops = new Map<string, AudioLoopHandle>()
  // where the fires are and what burns there: the crackles come from the points whose fuel crackles
  const fires: { readonly point: Vec3; readonly fuel: FireFuel }[] = []
  let nextCrackle = 0

  const fuelFor = (detail: SoundDetail | undefined): FireFuel => detail?.fuel ?? (detail?.material !== undefined ? fuelOf[detail.material] : undefined) ?? defaultFuel

  const setFire = (): void => {
    if (options.burnLoop === false) return
    const count = new Map<string, number>()
    for (const f of fires) {
      const id = loopOf[f.fuel]
      count.set(id, (count.get(id) ?? 0) + 1)
    }
    for (const [id, handle] of loops) {
      if (count.has(id)) continue
      handle.stop()
      loops.delete(id)
    }
    for (const [id, n] of count) {
      let handle = loops.get(id)
      if (!handle) {
        handle = engine.loop(id)
        loops.set(id, handle)
      }
      handle.set({ volume: Math.min(fire.max, fire.perFire * n) })
    }
  }

  // the nearest fire of that fuel goes out (any fuel when the end does not say)
  const forget = (point: Vec3, fuel: FireFuel | undefined): void => {
    let best = -1
    let bestD = Infinity
    fires.forEach((f, i) => {
      if (fuel !== undefined && f.fuel !== fuel) return
      const d = (f.point[0] - point[0]) ** 2 + (f.point[1] - point[1]) ** 2 + (f.point[2] - point[2]) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best < 0 && fuel !== undefined) forget(point, undefined)
    else if (best >= 0) fires.splice(best, 1)
  }

  const reset = (): void => {
    for (const handle of loops.values()) handle.stop()
    loops.clear()
    fires.length = 0
  }

  const blastSound = (point: Vec3, volume: number, detail?: SoundDetail): string => {
    const named = detail?.effect === undefined ? undefined : kinds[detail.effect]
    const kind = named ?? ((detail?.radius ?? 0) >= BIG_BLAST_RADIUS || volume >= 0.9 ? 'big' : 'grenade')
    const sound = BLAST_SOUND_OF[kind]
    const distance = engine.plan(sound, { position: point, seed: 1 })?.distance ?? 0
    // a molotov is a fire, not a blast: it never turns into the far rumble
    return kind !== 'molotov' && distance > farDistance ? 'explosion_far' : sound
  }

  return {
    onSound(key, point, volume, detail) {
      if (key === 'burn_loop') {
        fires.push({ point, fuel: fuelFor(detail) })
        setFire()
        return
      }
      if (key === 'burn_end') {
        forget(point, detail?.fuel ?? (detail?.material !== undefined ? fuelOf[detail.material] : undefined))
        setFire()
        return
      }
      if (key === 'explode' && blastByKind) {
        const sound = blastSound(point, volume, detail)
        engine.play(sound, { position: point, volume })
        if (sound !== 'explosion_far' && sound !== 'molotov_break_ignite' && (detail?.confinement ?? 1) >= indoorFrom) engine.play('explosion_indoor_tail', { position: point, volume })
        return
      }
      // the most specific key that has a rule (material and blow, material, family and blow, family), else the key itself (a `shot_` key with no rule
      // falls back to its `impact_` one); `null` on a specific key silences it
      let rule: SoundKeyRule | null | undefined
      for (const k of detail?.keys ?? []) {
        if (k in rules) {
          rule = rules[k]
          break
        }
      }
      if (rule === undefined) rule = key in rules ? rules[key] : rules[key.replace(/^shot_/, 'impact_')]
      if (rule === null) return
      if (!rule) {
        // a key with no rule that names a registered sound plays that sound (the foley ids: `door_wood_close`, `item_pickup_metal`...)
        if (engine.registry.sound(key)) engine.play(key, { position: point, volume })
        return
      }
      const wanted = rule.above && volume >= rule.above.volume ? rule.above.sound : rule.sound
      const sound = rule.fallback && !engine.registry.sound(wanted) ? rule.fallback : wanted
      const params = detail?.seconds === undefined ? rule.params : { ...rule.params, seconds: detail.seconds }
      engine.play(sound, { position: point, volume: volume * (rule.volumeScale ?? 1), ...(params ? { params } : {}) })
    },
    update(dt) {
      if (!crackles || fires.length === 0 || options.burnLoop === false) return
      // only the fuels that crackle count: a gas jet or a fuel pool roars without snapping
      const weight = fires.reduce((sum, f) => sum + FIRE_CRACKLE_OF[f.fuel], 0)
      if (weight <= 0) return
      nextCrackle -= dt
      // at most a few crackles per frame, even after a long one
      for (let i = 0; i < 4 && nextCrackle <= 0; i++) {
        const rate = Math.min(crackles.max, crackles.base * Math.min(1, weight) + crackles.perSqrtFire * Math.sqrt(weight))
        nextCrackle += (0.4 + channel.random() * 1.2) / rate
        let pick = channel.random() * weight
        const at = fires.find((f) => (pick -= FIRE_CRACKLE_OF[f.fuel]) <= 0) ?? (fires[fires.length - 1] as (typeof fires)[number])
        engine.play(channel.random() < 0.18 ? 'fire_pop' : 'fire_crackle', { position: at.point, volume: crackles.volume })
      }
      if (nextCrackle < 0) nextCrackle = 0
    },
    blastSound,
    rule(key, detail) {
      for (const k of detail?.keys ?? []) if (k in rules) return rules[k] ?? undefined
      return rules[key] ?? undefined
    },
    burning: () => fires.length,
    burningBy: () => {
      const by: Partial<Record<FireFuel, number>> = {}
      for (const f of fires) by[f.fuel] = (by[f.fuel] ?? 0) + 1
      return by
    },
    reset,
    dispose: reset,
  }
}
