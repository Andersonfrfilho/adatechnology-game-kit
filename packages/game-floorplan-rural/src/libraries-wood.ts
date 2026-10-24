import type { SlotDef, SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'

type RoomSize = { w: number; d: number }
type Base = (room: RoomSize) => SlotDef[]

/** Slot libraries of the wood frame house and the chalet; `living` and `laundry` are the residential ones they extend. */
export function createWoodLibraries(kit: SlotKit, base: { living: Base; laundry: Base }): Record<string, SlotLibrary> {
  const { wall, corner, center } = kit
  return {
    living_wood_frame: (r) => base.living(r).concat([wall('fireplace', 'right', 0, [1.5, 0.55], { fireplace: 1 }, { chance: 0, clearance: 0.7 })]),
    garage_wood_frame: () => [
      center('car_1', 0.5, 0.5, [1.95, 4.35], { car: 1 }, { required: true, facing: 'v-', clearance: 0 }),
      wall('tool_shelf', 'any', 0.5, [1.2, 0.5], { tool_shelf: 1 }, { chance: 0.4, clearance: 0.4 }),
      corner('crate', 'back-right', [0.55, 0.55], { crate: 1 }, { chance: 0.4, clearance: 0 }),
    ],
    porch: () => [
      wall('chair', 'any', 0.3, [0.8, 0.8], { porch_chair: 1 }, { chance: 0.7, clearance: 0.3 }),
      wall('bench', 'any', 0.7, [1.2, 0.45], { bench: 1 }, { chance: 0.5, clearance: 0.3 }),
      corner('pot_1', 'back-left', [0.5, 0.5], { outdoor_pot: 1, plant: 1 }, { chance: 0.7, clearance: 0 }),
      corner('pot_2', 'back-right', [0.5, 0.5], { outdoor_pot: 1, plant: 1 }, { chance: 0.5, clearance: 0 }),
      wall('firewood', 'any', 0.5, [1.5, 0.5], { firewood: 1 }, { chance: 0.25, clearance: 0.3 }),
    ],
    laundry_wood_frame: (r) => [wall('basement_stairs', 'back', 0, [0.9, 2.4], { basement_stairs: 1 }, { chance: 0, clearance: 0.9 })].concat(base.laundry(r)),
    pantry: () => [
      wall('shelf', 'any', 0.5, [1.2, 0.35], { laundry_shelf: 1, pantry: 1 }, { required: true, clearance: 0.5 }),
      wall('shelf_2', 'any', 0.5, [1.2, 0.35], { laundry_shelf: 1, pantry: 1 }, { chance: 0.6, clearance: 0.5 }),
      corner('crate', 'back-left', [0.5, 0.5], { crate: 1 }, { chance: 0.5, clearance: 0 }),
    ],
    backyard_rural: () => [
      wall('firewood', 'any', 0.5, [1.5, 0.5], { firewood: 1 }, { required: true, clearance: 0.4 }),
      center('table', 0.6, 0.5, [1.8, 1.2], { outdoor_table: 1 }, { chance: 0.5, clearance: 0 }),
      corner('tree_left', 'back-left', [2.4, 2.4], { '=fruit_tree': 2, '=tree_small': 1 }, { chance: 0.9, clearance: 0 }),
      corner('tree_right', 'back-right', [2.4, 2.4], { '=fruit_tree': 2, '=tree_small': 1 }, { chance: 0.8, clearance: 0 }),
      wall('garden_bed', 'left', 0.5, [2.0, 0.8], { garden_bed: 1 }, { chance: 0.6, clearance: 0.4 }),
      wall('garden_bed_2', 'right', 0.5, [2.0, 0.8], { garden_bed: 1 }, { chance: 0.4, clearance: 0.4 }),
      wall('grill', 'any', 0.5, [1.1, 0.8], { bbq_grill: 1 }, { chance: 0.4, clearance: 0.8 }),
      center('clothesline', 0.5, 0.3, [3.8, 0.7], { clothesline: 1 }, { chance: 0.5, facing: 'v+', clearance: 0 }),
      corner('doghouse', 'front-right', [0.9, 0.9], { doghouse: 1 }, { chance: 0.5, clearance: 0 }),
      wall('bin', 'back', 0.5, [0.6, 0.6], { outdoor_bin: 1 }, { chance: 0.4, clearance: 0 }),
    ],
    backyard_wood_frame: () => [
      center('clothesline', 0.5, 0.35, [3.8, 0.7], { clothesline: 1 }, { chance: 0.6, facing: 'v+', clearance: 0 }),
      wall('grill', 'any', 0.5, [1.1, 0.8], { bbq_grill: 1 }, { chance: 0.5, clearance: 0.8 }),
      center('table', 0.6, 0.6, [1.8, 1.2], { outdoor_table: 1 }, { chance: 0.5, clearance: 0 }),
      corner('tree_left', 'back-left', [2.4, 2.4], { '=fruit_tree': 2, '=tree_small': 1 }, { chance: 0.85, clearance: 0 }),
      corner('tree_right', 'back-right', [2.4, 2.4], { '=fruit_tree': 2, '=tree_small': 1 }, { chance: 0.7, clearance: 0 }),
      wall('garden_bed', 'left', 0.55, [2.0, 0.8], { garden_bed: 1 }, { chance: 0.4, clearance: 0.4 }),
      wall('firewood', 'right', 0.5, [1.5, 0.5], { firewood: 1 }, { chance: 0.4, clearance: 0.4 }),
      corner('doghouse', 'front-right', [0.9, 0.9], { doghouse: 1 }, { chance: 0.5, clearance: 0 }),
      wall('bin', 'back', 0.5, [0.6, 0.6], { outdoor_bin: 1 }, { chance: 0.4, clearance: 0 }),
      wall('bicycle', 'right', 0.2, [1.8, 0.6], { bicycle: 1 }, { chance: 0.25, clearance: 0 }),
    ],
  }
}
