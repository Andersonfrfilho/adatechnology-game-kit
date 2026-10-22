import type { ItemInput } from '@adatechnology/game-floorplan'

/** Shop, supermarket and pharmacy items. */
export const commercialItems: ItemInput[] = [
  { type: 'gondola_shelf', category: 'gondola_shelf', w: 1.9, d: 0.6, h: 1.3 },
  { type: 'gondola_shelf_short', category: 'gondola_shelf', w: 1.2, d: 0.6, h: 1.3 },
  { type: 'freezer', category: 'freezer', w: 1.6, d: 0.8, h: 0.9, color: { role: 'metal' } },
  { type: 'display_fridge', category: 'display_fridge', w: 0.9, d: 0.7, h: 2, color: { role: 'metal' } },
  { type: 'display_fridge_medium', category: 'display_fridge', w: 0.7, d: 0.7, h: 1.8, color: { role: 'metal' } },
  { type: 'wall_shelving', category: 'wall_shelving', w: 1.8, d: 0.4, h: 2 },
  { type: 'checkout_counter', category: 'checkout_counter', w: 1.6, d: 0.7, h: 1 },
  { type: 'cash_register', category: 'cash_register', w: 0.4, d: 0.4, h: 0.3 },
  { type: 'baskets', category: 'baskets', w: 0.5, d: 0.4, h: 0.5 },
  { type: 'shopping_cart', category: 'shopping_cart', w: 0.6, d: 0.9, h: 1 },
  { type: 'produce_stand', category: 'produce_stand', w: 1.2, d: 0.7, h: 0.9 },
  { type: 'fruit_crate', category: 'fruit_crate', w: 0.5, d: 0.4, h: 0.2 },
  { type: 'display_stand', category: 'display_stand', w: 0.6, d: 0.6, h: 1.4 },
  { type: 'metal_shelf', category: 'metal_shelf', w: 1.8, d: 0.5, h: 2 },
  { type: 'pallet', category: 'pallet', w: 1.2, d: 1, h: 1.2 },
  { type: 'boxes', category: 'boxes', w: 0.8, d: 0.6, h: 0.8 },
  { type: 'meeting_table', category: 'meeting_table', w: 1.2, d: 0.7, h: 0.9 },
  { type: 'pharmacy_counter', category: 'pharmacy_counter', w: 2, d: 0.7, h: 1 },
  { type: 'display_case', category: 'display_case', w: 1.2, d: 0.5, h: 1 },
  { type: 'display_rack', category: 'display_rack', w: 0.8, d: 0.5, h: 1.6 },
  { type: 'waiting_bench', category: 'waiting_bench', w: 1.5, d: 0.5, h: 0.9 },
  { type: 'scale', category: 'scale', w: 0.4, d: 0.4, h: 0.9 },
  { type: 'dumpster', category: 'dumpster', w: 2.6, d: 1.6, h: 1.5 },
]
