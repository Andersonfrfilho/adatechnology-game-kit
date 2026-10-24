import type { SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'

/** Slot libraries of the log cabin and the shack. The cabin backyard has four variants: `backyard_cabin_<outhouse><well>`. */
export function createCabinLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { wall, corner, center } = kit
  const libraries: Record<string, SlotLibrary> = {
    living_cabin: () => [
      corner('stove', 'front-right', [0.7, 0.6], { wood_stove: 1 }, { required: true, clearance: 0.5 }),
      wall('sink', 'back', 0.15, [1.1, 0.55], { '=rustic_sink': 1 }, { required: true, clearance: 0.6 }),
      center('table', 0.45, 0.62, [1.3, 0.9], { '=log_table': 1 }, { chance: 0.9, clearance: 0.2 }),
      wall('bench', 'any', 0.5, [1.2, 0.4], { '=log_bench': 1 }, { chance: 0.6, clearance: 0.3 }),
      wall('bed', 'left', 0.6, [0.95, 2.0], { '=improvised_bed': 2, '=bunk_bed': 1 }, { chance: 0, clearance: 0.5 }),
      wall('shelf', 'any', 0.5, [1.2, 0.35], { '=plank_shelf': 1 }, { chance: 0.7, clearance: 0.4 }),
      wall('firewood', 'any', 0.5, [1.5, 0.5], { firewood: 1 }, { chance: 0.5, clearance: 0.3 }),
      corner('bucket', 'front-left', [0.4, 0.4], { bucket: 1 }, { chance: 0.5, clearance: 0 }),
      corner('chair', 'front-right', [0.8, 0.8], { porch_chair: 1 }, { chance: 0.4, clearance: 0.3 }),
    ],
    bedroom_cabin: () => [
      wall('bed', 'any', 0.5, [1.0, 2.05], { '=improvised_bed': 2, '=bunk_bed': 2 }, { required: true, clearance: 0.5 }),
      wall('chest', 'any', 0.3, [1.2, 0.4], { '=log_bench': 1 }, { chance: 0.6, clearance: 0.3 }),
      wall('shelf', 'any', 0.5, [1.2, 0.35], { '=plank_shelf': 1 }, { chance: 0.8, clearance: 0.4 }),
      corner('bucket', 'front-left', [0.4, 0.4], { bucket: 1 }, { chance: 0.3, clearance: 0 }),
    ],
    living_shack: () => [
      wall('stove', 'left', 0.55, [0.7, 0.65], { stove: 1 }, { required: true, clearance: 0.6 }),
      wall('sink', 'back', 0.2, [1.0, 0.5], { '=rustic_sink': 1 }, { required: true, clearance: 0.6 }),
      corner('fridge', 'back-right', [0.7, 0.7], { fridge: 1 }, { chance: 0.6, facing: 'v-', clearance: 0.6 }),
      center('table', 0.5, 0.6, [1.2, 0.8], { '=log_table': 1 }, { chance: 0.8, clearance: 0.2 }),
      wall('bed', 'right', 0.6, [0.95, 1.95], { '=improvised_bed': 1 }, { chance: 0, clearance: 0.5 }),
      wall('bench', 'any', 0.5, [1.2, 0.4], { '=log_bench': 1 }, { chance: 0.5, clearance: 0.3 }),
      wall('shelf', 'any', 0.5, [1.2, 0.35], { '=plank_shelf': 1 }, { chance: 0.6, clearance: 0.4 }),
      corner('bucket', 'back-left', [0.4, 0.4], { bucket: 1 }, { chance: 0.5, clearance: 0 }),
    ],
    bedroom_shack: () => [
      wall('bed', 'any', 0.5, [1.0, 2.05], { '=improvised_bed': 2, '=bunk_bed': 1 }, { required: true, clearance: 0.5 }),
      wall('shelf', 'any', 0.5, [1.2, 0.35], { '=plank_shelf': 1 }, { chance: 0.6, clearance: 0.4 }),
      corner('bucket', 'front-left', [0.4, 0.4], { bucket: 1 }, { chance: 0.3, clearance: 0 }),
    ],
  }
  for (const hasOuthouse of [0, 1])
    for (const hasWell of [0, 1])
      libraries[`backyard_cabin_${hasOuthouse}${hasWell}`] = () => [
        corner('outhouse', 'back-left', [1.1, 1.2], { outhouse: 1 }, { required: !!hasOuthouse, chance: hasOuthouse ? 1 : 0, clearance: 0.6 }),
        center('well', 0.7, 0.55, [1.1, 1.1], { well: 1 }, { required: !!hasWell, chance: hasWell ? 1 : 0, clearance: 0.4 }),
        wall('firewood', 'any', 0.5, [1.5, 0.5], { firewood: 1 }, { chance: 0.7, clearance: 0.4 }),
        corner('tree_back', 'back-right', [2.4, 2.4], { '=fruit_tree': 1, '=tree_small': 1 }, { chance: 0.9, clearance: 0 }),
        center('tree_center', 0.5, 0.85, [1.4, 1.4], { '=tree_small': 1 }, { chance: 0.5, clearance: 0 }),
        wall('garden_bed', 'left', 0.5, [2.0, 0.8], { garden_bed: 1 }, { chance: 0.5, clearance: 0.4 }),
        center('clothesline', 0.4, 0.3, [3.8, 0.7], { clothesline: 1 }, { chance: 0.4, facing: 'v+', clearance: 0 }),
        corner('bench', 'front-right', [1.6, 0.6], { garden_bench: 1 }, { chance: 0.3, clearance: 0 }),
      ]
  return libraries
}
