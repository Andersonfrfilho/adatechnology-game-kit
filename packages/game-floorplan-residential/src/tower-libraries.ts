import type { SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'

/** Slot libraries of the residential tower (see `templates/residential-tower.ts`), built with the engine's slot kit. */
export function createTowerLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { wall, corner, center, on, windowSlot } = kit
  return {
    // The living room of a tower apartment: one wall for the television and the sofa facing it (the house living room tries two walls and gives up on small rooms).
    living_tower: (r) => [
      wall('tv_unit', 'right', 0.5, [1.9, 0.5], { tv_unit: 3, tv_unit_small: 1, tv_unit_large: 2 }, { required: true, clearance: 0.6 }),
      on('tv', 'tv_unit', { tv: 3, tv_large: 1 }, { chance: 0.9 }),
      center('sofa', 0.5, 0.5, [2.5, 1.05], { sofa: 1 }, { dx: -r.w * 0.12, required: true, requires: 'tv_unit', facing: 'target', target: 'tv_unit', clearance: 0.6 }),
      center('table', 0.5, 0.5, [1.0, 0.65], { coffee_table: 1 }, { dx: -r.w * 0.02, chance: 0.85, requires: 'sofa', facing: 'target', target: 'tv_unit', clearance: 0 }),
      corner('armchair', 'front-left', [0.95, 0.9], { armchair: 1 }, { chance: 0.6, clearance: 0.5 }),
      wall('shelf', 'left', 0.5, [1.5, 0.5], { shelf_unit: 1 }, { chance: 0.7, clearance: 0.6 }),
      corner('plant', 'back-left', [0.5, 0.5], { plant: 2, lamp: 1 }, { chance: 0.55, clearance: 0 }),
      windowSlot('pot_window', [0.6, 0.5], { plant: 1 }, { chance: 0.3, clearance: 0 }),
    ],
  }
}
