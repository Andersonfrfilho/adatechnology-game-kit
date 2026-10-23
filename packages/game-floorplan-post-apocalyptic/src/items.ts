import type { ItemInput } from '@adatechnology/game-floorplan'

/** Items the fortified and abandoned states add to a plan. */
export const postApocalypticItems: ItemInput[] = [
  { type: 'window_boards', category: 'window_boards', w: 1.2, d: 0.08, h: 1.4, decor: true, mount: 'window' },
  { type: 'sandbags', category: 'sandbags', w: 1.2, d: 0.5, h: 0.6, color: { role: 'exterior_floor' } },
  { type: 'barbed_wire', category: 'barbed_wire', w: 1, d: 0.1, h: 0.3, decor: true, mount: 'wall_top', color: { role: 'metal' } },
  { type: 'razor_wire', category: 'razor_wire', w: 1, d: 0.4, h: 0.4, decor: true, mount: 'wall_top', color: { role: 'metal' } },
  { type: 'water_bottle_crates', category: 'stockroom', w: 0.6, d: 0.4, h: 0.4 },
  { type: 'canned_food', category: 'stockroom', w: 0.5, d: 0.4, h: 0.4 },
  { type: 'water_jug', category: 'stockroom', w: 0.35, d: 0.35, h: 0.5 },
  { type: 'floor_mattress', category: 'floor_mattress', w: 0.9, d: 1.9, h: 0.15, color: { role: 'fabric_accent' } },
  { type: 'lantern', category: 'lantern', w: 0.15, d: 0.15, h: 0.25, decor: true, mount: 'support', color: { role: 'metal' } },
  { type: 'candles', category: 'lantern', w: 0.12, d: 0.12, h: 0.15, decor: true, mount: 'support', color: { role: 'metal' } },
  { type: 'open_suitcases', category: 'open_suitcases', w: 0.7, d: 0.5, h: 0.3 },
  { type: 'clothes_on_floor', category: 'clothes_on_floor', w: 0.8, d: 0.6, h: 0.05, flat: true },
  { type: 'fallen_chair', category: 'fallen_chair', w: 0.5, d: 0.5, h: 0.45 },
  { type: 'blood_stains', category: 'blood_stains', w: 0.8, d: 0.8, h: 0.01, flat: true, color: { hex: 0x5a0f0f } },
]
