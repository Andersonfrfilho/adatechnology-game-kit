import { DEFAULT_RULES } from './rules'
import type { ItemRules } from './rules-types'
import type { BodySlot, ItemDef } from './types'

export type AttackKind = 'bite' | 'scratch'

/** A piece of clothing on a body: the item and its condition, 0 (torn) to 100 (new). */
export interface WornPiece {
  item: ItemDef
  condition: number
}

const FULL_CONDITION = 100

const covers = (piece: WornPiece, slot: BodySlot): boolean => piece.item.protection?.slots.includes(slot) ?? false

/** What one piece blocks of an attack: its value times its condition; a torn piece (condition 0) keeps `tornShare` of the value. */
export const pieceBlock = (piece: WornPiece, attack: AttackKind, rules: ItemRules = DEFAULT_RULES): number => {
  const value = piece.item.protection?.[attack] ?? 0
  const share = piece.condition <= 0 ? rules.protection.tornShare : piece.condition / FULL_CONDITION
  return value * share
}

/** Share of an attack on `slot` that clothing blocks: `1 - PROD(1 - value x condition)`, never above the cap (there is always some risk). */
export const blockChance = (pieces: readonly WornPiece[], slot: BodySlot, attack: AttackKind, rules: ItemRules = DEFAULT_RULES): number => {
  const unblocked = pieces.filter((piece) => covers(piece, slot)).reduce((product, piece) => product * (1 - pieceBlock(piece, attack, rules)), 1)
  return Math.min(rules.protection.cap, 1 - unblocked)
}

/** A blocked attack wears every piece that covers the slot and blocks something: bite -8, scratch -3 (never below 0). */
export const wearBlocked = (pieces: readonly WornPiece[], slot: BodySlot, attack: AttackKind, rules: ItemRules = DEFAULT_RULES): WornPiece[] =>
  pieces.map((piece) => {
    if (!covers(piece, slot) || pieceBlock(piece, attack, rules) <= 0) return piece
    return { ...piece, condition: Math.max(0, piece.condition - rules.protection.wear[attack]) }
  })

/** A repair kit restores up to the maximum condition minus the margin (10); a piece already better is left alone. */
export const repairPiece = (piece: WornPiece, rules: ItemRules = DEFAULT_RULES, maxCondition: number = FULL_CONDITION): WornPiece => ({
  ...piece,
  condition: Math.max(piece.condition, maxCondition - rules.protection.repairMargin),
})
