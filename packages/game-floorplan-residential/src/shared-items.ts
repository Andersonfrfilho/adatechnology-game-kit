import type { ItemInput } from '@adatechnology/game-floorplan'

/** Items both content packs use; each pack registers them only when the catalogue lacks them. */
export const sharedItems: ItemInput[] = [
  { type: 'plant_tall', category: 'plant', w: 0.4, d: 0.4, h: 1.1, color: { role: 'lawn' } },
  { type: 'plant_short', category: 'plant', w: 0.35, d: 0.35, h: 0.6, color: { role: 'lawn' } },
  { type: 'outdoor_bin', category: 'outdoor_bin', w: 0.5, d: 0.5, h: 1 },
]
