/**
 * The hands and the weapon (decision of the owner, 2026-11-24): an interaction of one hand (a small thing picked up, a door, a switch) takes the free hand, the one that does not
 * hold the weapon, and the weapon stays in its hand; one of both hands (a big thing carried, a push, a climb) first puts the weapon away in a slot of the body that takes it
 * (a holster at the hip, a sling or back slot for a long gun) and, with none, lets it fall to the ground. A two-handed weapon (a rifle, a shotgun) leaves no hand free, so any
 * interaction puts it away or drops it. When the interaction ends, what was put away comes back to its hand; what fell stays on the ground.
 * A long gun on its sling (decision of the owner, 2026-11-25) is not put away: it swings onto the sling and hangs on the body (`sling`), and stays there after the interaction until
 * the player brings it back to the hands; with no sling worn it goes to the next slot that takes it (`SLOT_FALLBACKS`: the back).
 * Engine-agnostic: the host says what is in each hand and which slots the body wears; this says which hand acts and what happens to each weapon.
 */

/** `R` the weapon hand, `L` the other one. */
export type BodyHand = 'R' | 'L'

/** A weapon in a hand: `hands` it takes (0 the bare hand, 1, 2) and the slot of the body that takes it (`hip`, `back`...), null when none does. */
export interface HandWeapon {
  readonly id: string
  readonly hands: 0 | 1 | 2
  readonly slot: string | null
}

export interface HandsRules {
  /** A thing up to `maxKg` whose longest side is up to `maxLength` metres goes in one hand; anything bigger or heavier takes both. */
  readonly oneHand: { readonly maxKg: number; readonly maxLength: number }
}

export const HANDS_DEFAULTS: HandsRules = { oneHand: { maxKg: 4, maxLength: 0.7 } }

/** The slot a weapon goes to when the body wears none of its own: a long gun with no sling goes across the back. */
export const SLOT_FALLBACKS: Readonly<Record<string, readonly string[]>> = { sling: ['back'] }

/** The slot of a long gun that hangs on its sling. */
export const SLING_SLOT = 'sling'

/**
 * What a weapon does when the hands are wanted: `holster` goes to `slot` and comes back after; `sling` hangs on the body by its sling and stays there until it is brought back;
 * `drop` falls to the ground and stays there.
 */
export type HandsMoveKind = 'holster' | 'sling' | 'drop'

export interface HandsMove {
  readonly hand: BodyHand
  readonly weapon: string
  readonly move: HandsMoveKind
  readonly slot?: string
}

export interface HandsPlan {
  /** The hand the interaction takes, or `both`. */
  readonly hand: BodyHand | 'both'
  /** What happens to each weapon that is in the way, the weapon hand first. */
  readonly moves: readonly HandsMove[]
}

export interface PlanHandsParams {
  /** The hands the interaction takes (`interactionHandsFor` for a thing picked up). */
  readonly hands: 1 | 2
  /** What each hand holds; absent or null is an empty hand. */
  readonly weapons: { readonly R?: HandWeapon | null; readonly L?: HandWeapon | null }
  /** The slots the body wears and that are empty (a holster, a sling); one weapon each. */
  readonly slots: readonly string[]
  /** The slots tried when a weapon's own is not worn; default `SLOT_FALLBACKS`. */
  readonly fallbacks?: Readonly<Record<string, readonly string[]>>
}

/** How many hands it takes to carry a thing of `massKg` and `size` (metres, any order). */
export function interactionHandsFor(thing: { readonly massKg: number; readonly size?: readonly number[] }, rules: HandsRules = HANDS_DEFAULTS): 1 | 2 {
  const longest = Math.max(0, ...(thing.size ?? []))
  return thing.massKg > rules.oneHand.maxKg || longest > rules.oneHand.maxLength ? 2 : 1
}

const holds = (weapon: HandWeapon | null | undefined): weapon is HandWeapon => !!weapon && weapon.hands > 0

/** Which hand acts and what happens to each weapon in the way. */
export function planHands(params: PlanHandsParams): HandsPlan {
  const { R, L } = params.weapons
  const free = [...params.slots]
  const fallbacks = params.fallbacks ?? SLOT_FALLBACKS
  const stow = (hand: BodyHand, weapon: HandWeapon): HandsMove => {
    const tried = weapon.slot === null ? [] : [weapon.slot, ...(fallbacks[weapon.slot] ?? [])]
    const slot = tried.find((name) => free.includes(name))
    if (slot === undefined) return { hand, weapon: weapon.id, move: 'drop' }
    free.splice(free.indexOf(slot), 1)
    return { hand, weapon: weapon.id, move: slot === SLING_SLOT ? 'sling' : 'holster', slot }
  }
  if (params.hands === 2) {
    const moves = [...(holds(R) ? [stow('R', R)] : []), ...(holds(L) ? [stow('L', L)] : [])]
    return { hand: 'both', moves }
  }
  if (holds(L)) return { hand: 'L', moves: [stow('L', L)] }
  if (!holds(R)) return { hand: 'R', moves: [] }
  return { hand: 'L', moves: R.hands === 2 ? [stow('R', R)] : [] }
}

/** What comes back to the hands once the interaction ends: the weapons that were put away, each to its hand; the slung ones stay on the sling and the dropped ones on the ground. */
export function drawBackOf(plan: HandsPlan): readonly { readonly hand: BodyHand; readonly weapon: string }[] {
  return plan.moves.filter((move) => move.move === 'holster').map((move) => ({ hand: move.hand, weapon: move.weapon }))
}
