export type ContentGroup = 'food' | 'water' | 'medicine' | 'tool' | 'cleaning' | 'improvised_weapon' | 'clothes' | 'document' | 'utensil' | 'trash'

export interface ContentEntry {
  itemId: string
  min: number
  max: number
  group: ContentGroup
  pickable: boolean
  weight: number
}

const entry = (itemId: string, min: number, max: number, group: ContentGroup, pickable: boolean, weight: number): ContentEntry => ({ itemId, min, max, group, pickable, weight })

const FRIDGE = [
  entry('water_bottle', 1, 3, 'water', true, 3), entry('milk_carton', 1, 2, 'food', true, 2), entry('eggs', 1, 1, 'food', true, 2), entry('packed_meat', 1, 2, 'food', true, 1.5), entry('fruit', 1, 4, 'food', true, 2),
  entry('yogurt', 1, 3, 'food', true, 1), entry('soda', 1, 2, 'water', true, 1), entry('cheese', 1, 1, 'food', true, 1), entry('insulin', 1, 1, 'medicine', true, 0.4), entry('leftovers', 1, 2, 'food', true, 1),
]
const BEDSIDE = [entry('medicine', 1, 2, 'medicine', true, 2), entry('book', 1, 2, 'document', true, 1.5), entry('charger', 1, 1, 'tool', true, 1), entry('flashlight', 1, 1, 'tool', true, 0.7), entry('glasses', 1, 1, 'tool', true, 0.7)]
const WARDROBE = [
  entry('shirt', 2, 6, 'clothes', true, 3), entry('trousers', 1, 4, 'clothes', true, 3), entry('coat', 1, 2, 'clothes', true, 1.5), entry('sneakers', 1, 2, 'clothes', true, 1.5),
  entry('shoes', 1, 2, 'clothes', true, 1), entry('blanket', 1, 2, 'clothes', true, 1.5), entry('backpack', 1, 1, 'tool', true, 0.8),
]
const DRESSER = [entry('underwear', 2, 6, 'clothes', true, 3), entry('socks', 2, 6, 'clothes', true, 2), entry('t_shirt', 1, 4, 'clothes', true, 2), entry('documents', 1, 2, 'document', true, 1), entry('flashlight', 1, 1, 'tool', true, 0.7), entry('batteries', 1, 2, 'tool', true, 0.7)]
const FILING = [entry('documents', 1, 4, 'document', true, 3), entry('pen', 1, 3, 'tool', true, 1.5), entry('keys', 1, 2, 'tool', true, 1), entry('stapler', 1, 1, 'improvised_weapon', true, 0.5)]
const TRASH = [entry('full_trash_bag', 1, 1, 'trash', false, 2), entry('packaging', 1, 4, 'trash', true, 3), entry('empty_can', 1, 3, 'trash', true, 2), entry('crumpled_paper', 1, 3, 'trash', true, 1)]

/** What each kind of container may hold, by category (or by type when a type differs from its category). */
export const CONTENT_TABLES: Record<string, ContentEntry[]> = {
  fridge: FRIDGE,
  display_fridge: [entry('soda', 2, 6, 'water', true, 3), entry('water_bottle', 2, 6, 'water', true, 3), entry('yogurt', 2, 5, 'food', true, 2)],
  freezer: [entry('frozen_meat', 2, 5, 'food', true, 3), entry('ice_cream', 1, 2, 'food', true, 1)],
  kitchen_cabinet: [
    entry('pot', 1, 2, 'tool', true, 1.5), entry('kitchen_knife', 1, 2, 'improvised_weapon', true, 1.5), entry('dish_soap', 1, 2, 'cleaning', true, 2), entry('sponge', 1, 2, 'cleaning', true, 1), entry('rice', 1, 2, 'food', true, 1.5),
    entry('beans', 1, 2, 'food', true, 1.5), entry('pasta', 1, 2, 'food', true, 1), entry('cooking_oil', 1, 1, 'food', true, 1), entry('canned_tuna', 1, 3, 'food', true, 1.5), entry('disinfectant', 1, 1, 'cleaning', true, 1), entry('trash_bag', 1, 2, 'trash', true, 0.7),
  ],
  overhead_cabinet: [entry('plates', 4, 8, 'utensil', false, 3), entry('glasses', 3, 6, 'utensil', false, 3), entry('mug', 1, 3, 'utensil', true, 1.5), entry('coffee', 1, 2, 'food', true, 1.5), entry('canned_corn', 1, 3, 'food', true, 1.5), entry('spices', 1, 3, 'food', true, 1)],
  washbasin: [
    entry('painkiller', 1, 2, 'medicine', true, 2), entry('bandages', 1, 2, 'medicine', true, 2), entry('soap', 1, 3, 'cleaning', true, 2), entry('toilet_paper', 1, 4, 'cleaning', true, 2), entry('shampoo', 1, 2, 'cleaning', true, 1),
    entry('toothbrush', 1, 2, 'cleaning', true, 1), entry('scissors', 1, 1, 'improvised_weapon', true, 0.5), entry('rubbing_alcohol', 1, 1, 'medicine', true, 1),
  ],
  wardrobe: WARDROBE,
  wardrobe_large: WARDROBE,
  dresser: DRESSER,
  console_table: DRESSER,
  nightstand: BEDSIDE,
  filing_cabinet: FILING,
  pantry: [
    entry('rice', 2, 4, 'food', true, 2), entry('beans', 2, 4, 'food', true, 2), entry('canned_tuna', 2, 5, 'food', true, 2), entry('water_jug', 1, 2, 'water', true, 2), entry('flour', 1, 2, 'food', true, 1),
    entry('sugar', 1, 2, 'food', true, 1), entry('cooking_oil', 1, 2, 'food', true, 1), entry('biscuits', 1, 4, 'food', true, 1.5),
  ],
  tv_unit: [entry('remote_control', 1, 1, 'tool', true, 2), entry('dvds', 1, 4, 'document', true, 1), entry('cables', 1, 3, 'tool', true, 1.5), entry('batteries', 1, 2, 'tool', true, 1)],
  laundry_cabinet: [entry('washing_powder', 1, 2, 'cleaning', true, 3), entry('bleach', 1, 2, 'cleaning', true, 2), entry('disinfectant', 1, 2, 'cleaning', true, 2), entry('bucket', 1, 1, 'tool', true, 1), entry('broom', 1, 1, 'improvised_weapon', true, 1), entry('rubber_gloves', 1, 2, 'cleaning', true, 1)],
  laundry_shelf: [entry('washing_powder', 1, 1, 'cleaning', true, 2), entry('softener', 1, 2, 'cleaning', true, 2), entry('clothespins', 1, 1, 'tool', true, 1)],
  workbench: [entry('hammer', 1, 1, 'improvised_weapon', true, 2), entry('screwdriver', 1, 2, 'tool', true, 2), entry('pliers', 1, 1, 'tool', true, 1.5), entry('insulating_tape', 1, 2, 'tool', true, 1), entry('screws', 1, 2, 'tool', true, 1)],
  tool_shelf: [entry('hammer', 1, 1, 'improvised_weapon', true, 1.5), entry('hand_saw', 1, 1, 'improvised_weapon', true, 1), entry('paint_can', 1, 3, 'trash', true, 1.5), entry('rope', 1, 1, 'tool', true, 1), entry('nails', 1, 2, 'tool', true, 1.5)],
  mailbox: [entry('letter', 1, 4, 'document', true, 3), entry('bill', 1, 2, 'document', true, 2), entry('flyer', 1, 4, 'trash', true, 2)],
  trash_bin: TRASH,
  outdoor_bin: TRASH,
  china_cabinet: [entry('china_plates', 3, 6, 'utensil', false, 3), entry('wine_glasses', 2, 5, 'utensil', false, 2)],
}

/** Groups of things somebody who locked themselves in would have stocked up. */
export const SUPPLY_GROUPS: readonly ContentGroup[] = ['food', 'water', 'medicine', 'tool']
