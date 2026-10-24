import type { ItemsCatalog } from '../catalog-types'
import type { ItemCategory, ItemDef, PlaceTag } from '../types'

/** The items of `category` a roll can draw in `place`: no fixed-spot rarity, nothing excluded; when none lists the place, every one of the category (the game's recuo). */
export const rollableItems = (catalog: ItemsCatalog, category: ItemCategory, place: PlaceTag): ItemDef[] => {
  const { rules } = catalog
  const rollable = catalog.byCategory(category).filter((item) => !rules.rarity.fixedOnly.includes(item.rarity) && !rules.finds.rollExcluded.includes(item.id))
  const here = rollable.filter((item) => item.finds?.places.includes(place))
  return here.length > 0 ? here : rollable
}

export const rarityWeight = (catalog: ItemsCatalog, item: ItemDef): number => catalog.rules.rarity.weights[item.rarity]
