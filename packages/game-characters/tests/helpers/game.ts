import { createRng } from '../../src'
import type { CharacterSpec, DamageCharacter, CharacterKit } from '../../src'
import ages from '../../../game-characters-undead/src/data/ages.json'
import outfits from '../../../game-characters-undead/src/data/outfits.json'
import types from '../../../game-characters-undead/src/data/types.json'

/** The game's type ids (`CATS`) to the catalog's English ids. */
export const GAME_TYPES: Readonly<Record<string, string>> = {
  lento: 'walker',
  corredor: 'runner',
  rastejante: 'crawler',
  brutamonte: 'brute',
  farejador: 'sniffer',
  saltador: 'leaper',
  inchado: 'bloater',
  espreitador: 'stalker',
  cego: 'blind',
  gritador: 'screamer',
  carbonizado: 'charred',
  afogado: 'drowned',
  devorador: 'devourer',
}

/** The stun of a heavy hit in `zDamage`: 0.25 s for the brute, 0.45 s for every other type. */
const BRUTE_STUN_SECONDS = 0.25

export const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0

/** The outfit probabilities the game's `pick(ROUPAS)` walks (civilian first). */
const OUTFIT_CUMULATIVE = outfits.reduce<number[]>((sums, outfit) => [...sums, (sums[sums.length - 1] ?? 0) + outfit.probability], [])

/**
 * The game's stream for one zombie, right after `zSpawn` (G 66746): age pick, outfit pick, 3 for the height, the build band and its draw,
 * speed, wander speed, attack timer, variant, yaw, phase, next tick, the civilian colour (only when the outfit drawn is civilian) and the skin.
 * The types of the goldens draw nothing in `zSpecialSpawn`. The next draw is the one `zDamage` makes for the jaw.
 */
export const gameStreamAfterSpawn = (seed: number): (() => number) => {
  const random = createRng(seed)
  random()
  const outfitDraw = random()
  const civilian = outfitDraw < (OUTFIT_CUMULATIVE[0] ?? 0)
  const draws = 13 + (civilian ? 1 : 0)
  for (let draw = 0; draw < draws; draw++) random()
  return random
}

export type GameZombie = { readonly type: string; readonly seed: number; readonly age: number; readonly outfit: number; readonly health: number; readonly crawl: number }

/** A character in the crowd detail with the numbers of a game zombie: type multipliers, age, outfit protection, the health it spawned with. */
export const createGameZombie = (kit: CharacterKit, zombie: GameZombie, extra: Partial<CharacterSpec> = {}): DamageCharacter => {
  const type = types.find((entry) => entry.id === GAME_TYPES[zombie.type])
  const age = ages.ages[zombie.age]
  const outfit = outfits[zombie.outfit]
  if (!type || !age || !outfit) throw new Error(`no game data for ${zombie.type} / age ${zombie.age} / outfit ${zombie.outfit}`)
  return kit.create({
    seed: zombie.seed,
    kind: type.id,
    detail: 'regions',
    vitality: zombie.health,
    multipliers: type.multipliers,
    limbFactor: age.limbDamage,
    bodyCount: 'bodyCount' in type ? (type.bodyCount as number) : 1,
    stunSeconds: type.id === 'brute' ? BRUTE_STUN_SECONDS : 0.45,
    crawling: zombie.crawl === 1,
    protection: outfit.protection,
    random: gameStreamAfterSpawn(zombie.seed),
    ...extra,
  })
}
