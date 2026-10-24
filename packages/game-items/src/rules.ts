import type { ItemRules } from './rules-types'

/**
 * The numbers of the rules, from the team's Vale Cinzento delivery. `storage` was read by hand from its table (Validade e apodrecimento) so the
 * skeleton runs; the source test of the catalog tool proves it against the HTML (legendary and unique are never rolled: L276). Every field is an option of `createItems({ rules })`.
 */
export const DEFAULT_RULES: ItemRules = {
  rarity: {
    weights: { common: 60, uncommon: 28, rare: 9, very_rare: 2.5, legendary: 0.5, unique: 0 },
    fixedOnly: ['legendary', 'unique'],
  },
  freshness: { stale: 0.5, spoiled: 1, rotten: 1.5 },
  storage: {
    fridge: { multiplier: 0.33, needsPower: true },
    freezer: { multiplier: 0.1, needsPower: true },
    cooler: { multiplier: 0.5, limitDays: 2, afterLimit: 1 },
    delivery_bag: { multiplier: 0.8 },
    cellar: { multiplier: 0.66 },
    ambient: { multiplier: 1 },
    hot: { multiplier: 2 },
  },
  carry: { baseKg: 8, perStrengthKg: 2.5, factor: 1.2, encumbered: 1, overloaded: 1.5 },
  protection: { cap: 0.9, wear: { bite: 8, scratch: 3 }, tornShare: 0.25, repairMargin: 10 },
  aging: { thawShelfDays: { freezer: 2 } },
  inventory: { defaultSlots: 10, encumberedRunFactor: 0.75 },
  use: {
    freshness: {
      stale: { satietyFactor: 0.7, poisonChance: 0.1, morale: 0, isEdible: true },
      spoiled: { satietyFactor: 0.7, poisonChance: 0.5, morale: -20, isEdible: true },
      rotten: { satietyFactor: 0, poisonChance: 0, morale: 0, isEdible: false },
    },
    cookedPoisonFactor: 0.25,
  },
  spawn: { retailNew: true, retailPlaces: [] },
}
