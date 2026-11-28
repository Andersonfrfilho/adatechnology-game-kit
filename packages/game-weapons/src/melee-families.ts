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
  /** Length of the line the weapon meets a surface along (a bat's or a pipe's barrel), metres; absent: a round face or an edge. */
  readonly contactLength?: number
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

/**
 * Which way each motion moves the weapon across what it meets, in the striker's view (shares of its right and of the world's up): a cut runs along it, and a club's
 * barrel lies along it (a bat swung level runs right to left). A motion not listed (a thrust, a punch, a kick) has no sweep.
 */
export const MOTION_SWEEPS: Readonly<Record<string, { readonly right: number; readonly up: number }>> = {
  slash: { right: -0.7, up: -0.7 },
  chop: { right: -0.15, up: -1 },
  bat_swing: { right: -1, up: 0 },
  swing: { right: -0.95, up: -0.3 },
}

type Vec3 = readonly [number, number, number]

/** The world direction a blow of `motion` sweeps across a surface, for a striker looking along `forward`; undefined for a motion without a sweep. */
export const sweepOf = (motion: string | undefined, forward: Vec3): [number, number, number] | undefined => {
  const share = motion ? MOTION_SWEEPS[motion] : undefined
  if (!share) return undefined
  // the striker's right: forward crossed with the world's up, level
  const right: Vec3 = [-forward[2], 0, forward[0]]
  const flat = Math.hypot(right[0], right[2])
  if (flat < 1e-6) return undefined
  const v: [number, number, number] = [(right[0] / flat) * share.right, share.up, (right[2] / flat) * share.right]
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}
