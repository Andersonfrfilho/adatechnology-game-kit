import type { DepletionRule } from '../rules-types'
import type { ItemRules } from '../rules-types'
import type { PlaceTag } from '../types'

/** Share of the normal stock a place still has `day` days into the outbreak: `max(floor, 1 - perDay x day)`; 1 on day 0 and where no rule names the place. */
export const depletionFactor = (place: PlaceTag, day: number, rules: ItemRules): number => {
  if (day <= 0) return 1
  const rule: DepletionRule | undefined = rules.finds.depletion.find((entry) => entry.places.includes(place))
  return rule ? Math.max(rule.floor, 1 - rule.perDay * day) : 1
}

/** The count of stacks after the days of the outbreak and the region: the roll is drawn first, so day 0 and an unknown region leave it as it was. */
export const scaleCount = (count: number, scale: { place: PlaceTag; day: number; region?: string }, rules: ItemRules): number => {
  const region = scale.region === undefined ? 1 : (rules.finds.regionMultiplier[scale.region] ?? 1)
  return Math.round(count * depletionFactor(scale.place, scale.day, rules) * region)
}
