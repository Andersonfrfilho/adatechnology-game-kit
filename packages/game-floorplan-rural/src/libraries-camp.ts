import type { SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'

/** Slot libraries of the campsite: the camp zone, the clearing, the front garden and the tents (`tent_1` to `tent_4`, by people). */
export function createCampLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { wall, corner, center, on } = kit
  const libraries: Record<string, SlotLibrary> = {
    campsite: (r) => {
      const fz = (r.d - 1.5) / r.d
      return [
        center('campfire', 0.5, fz, [1.1, 1.1], { campfire: 1 }, { required: true, clearance: 0.3 }),
        center('chair_left', 0.5, fz, [0.55, 0.55], { camp_chair: 1 }, { dx: -1.15, dz: 0.2, chance: 0.9, facing: 'u+', clearance: 0 }),
        center('chair_right', 0.5, fz, [0.55, 0.55], { camp_chair: 1 }, { dx: 1.15, dz: 0.2, chance: 0.8, facing: 'u-', clearance: 0 }),
        center('chair_front', 0.5, fz, [0.55, 0.55], { camp_chair: 1 }, { dz: 1.0, chance: 0.5, facing: 'v-', clearance: 0 }),
        center('table', 0.5, fz, [1.2, 0.6], { camp_table: 1 }, { dx: 2.7, dz: 0.5, required: true, facing: 'v-', clearance: 0.2 }),
        on('stove', 'table', { camp_stove: 1 }, { required: true }),
        center('lantern', 0.5, fz, [0.25, 0.25], { camp_lantern: 1 }, { dx: 1.0, dz: -1.0, required: true, clearance: 0 }),
        center('gas_canister', 0.5, fz, [0.2, 0.2], { camp_gas_canister: 1 }, { dx: 3.5, dz: 0.6, required: true, clearance: 0 }),
        center('cooler_1', 0.5, fz, [0.6, 0.4], { cooler: 1 }, { dx: 2.1, dz: 1.15, required: true, facing: 'v-', clearance: 0 }),
        center('cooler_2', 0.5, fz, [0.6, 0.4], { cooler: 1 }, { dx: 2.8, dz: 1.15, chance: 0.6, facing: 'v-', clearance: 0 }),
        center('firewood', 0.5, fz, [1.5, 0.5], { firewood: 1 }, { dx: -3.0, dz: 0.6, chance: 0.8, facing: 'v-', clearance: 0 }),
        center('bench', 0.5, fz, [1.2, 0.35], { '=log_bench': 1 }, { dx: -1.0, dz: 1.15, chance: 0.5, facing: 'v-', clearance: 0 }),
      ]
    },
    backyard_camping: () => [
      center('clothesline', 0.5, 0.5, [3.6, 0.4], { clothesline: 1 }, { chance: 0.8, facing: 'v+', clearance: 0 }),
      corner('outhouse', 'back-right', [1.1, 1.2], { outhouse: 1 }, { chance: 0.8, clearance: 0.6 }),
      corner('tree_left', 'back-left', [2.4, 2.4], { '=tree_small': 1 }, { chance: 0.9, clearance: 0 }),
      wall('bin', 'back', 0.35, [0.5, 0.5], { outdoor_bin: 1 }, { chance: 0.7, clearance: 0 }),
    ],
    empty: () => [],
    garden_camping: () => [
      corner('tree_left', 'front-left', [1.4, 1.4], { '=tree_small': 1 }, { chance: 0.8, clearance: 0 }),
      corner('tree_right', 'front-right', [1.4, 1.4], { '=tree_small': 1 }, { chance: 0.7, clearance: 0 }),
    ],
  }
  for (let people = 1; people <= 4; people++)
    libraries[`tent_${people}`] = () =>
      Array.from({ length: people }, (_, index) =>
        center(`sleeping_${index}`, 0.5, (index + 0.5) / people, [0.65, 1.95], { '=sleeping_bag': 3, '=sleeping_pad': 1 }, { required: true, floorFree: true, facing: 'u+', clearance: 0 }),
      )
  return libraries
}
