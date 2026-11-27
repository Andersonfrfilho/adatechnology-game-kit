/**
 * The families of melee blows (spec 015 R3): which weapons of the arsenal strike alike, and the blows of the family in the order they follow one another. A blow names the
 * body's strike clip (`ATTACK_CLIPS` of game-characters-people), the motion of the weapon in hand (`TOOL_MOTIONS` of game-weapons-three) and how long both last, so a host
 * plays the two together and lands the hit at the clip's impact. Data in `data/melee-families.json`; a game passes its own families where it takes these.
 */
import familiesJson from './data/melee-families.json'

/** One blow of a family: the body's clip, the weapon's motion and their length (seconds). */
export interface MeleeBlow {
  readonly clip: string
  readonly motion: string
  readonly seconds: number
}

/** Weapons that strike alike and their blows; a pause longer than `reset` seconds starts the blows over from the first. */
export interface MeleeFamily {
  readonly id: string
  readonly weapons: readonly string[]
  readonly blows: readonly MeleeBlow[]
  readonly reset: number
}

export const MELEE_FAMILIES: readonly MeleeFamily[] = (familiesJson as { readonly families: readonly MeleeFamily[] }).families

/** The family a weapon strikes with, or undefined. */
export const meleeFamilyOf = (weaponId: string, families: readonly MeleeFamily[] = MELEE_FAMILIES): MeleeFamily | undefined =>
  families.find((family) => family.weapons.includes(weaponId))

/** The strike clip of each weapon of the families (its first blow), as the strike-clip map a host keys by weapon id. */
export const meleeStrikeClips = (families: readonly MeleeFamily[] = MELEE_FAMILIES): Readonly<Record<string, string>> =>
  Object.fromEntries(families.flatMap((family) => (family.blows[0] ? family.weapons.map((weapon) => [weapon, family.blows[0]!.clip] as const) : [])))

/** Picks the blows of a family in turn: the next one, or the first again after `reset` seconds without a blow. */
export interface MeleeBlowCycle {
  next(weaponId: string, now: number): MeleeBlow | undefined
}

export const createMeleeBlowCycle = (families: readonly MeleeFamily[] = MELEE_FAMILIES): MeleeBlowCycle => {
  const last = new Map<string, { readonly index: number; readonly at: number }>()
  return {
    next(weaponId, now) {
      const family = meleeFamilyOf(weaponId, families)
      if (!family || family.blows.length === 0) return undefined
      const previous = last.get(family.id)
      const index = previous && now - previous.at <= family.reset ? (previous.index + 1) % family.blows.length : 0
      last.set(family.id, { index, at: now })
      return family.blows[index]
    },
  }
}
