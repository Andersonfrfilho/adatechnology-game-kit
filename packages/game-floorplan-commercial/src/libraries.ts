import type { SlotDef, SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'
import { clamp } from './util'

type LibFn = (room: { w: number; d: number }) => SlotDef[]

/** Slot libraries by room type, built with the engine's slot kit. */
export function createCommercialLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { wall, corner, center, on, inside } = kit
  const libs: Record<string, SlotLibrary> = {
    stockroom: _r => [
    wall('shelf_1', 'back', 0.2, [1.9, 0.55], { metal_shelf: 1 }, { required: true, clearance: 0.8 }),
    wall('shelf_2', 'back', 0.8, [1.9, 0.55], { metal_shelf: 1 }, { chance: 0.85, clearance: 0.8 }),
    wall('shelf_3', 'any', 0.5, [1.9, 0.55], { metal_shelf: 1 }, { chance: 0.5, clearance: 0.8 }),
    center('pallet', 0.5, 0.5, [1.3, 1.1], { pallet: 1, boxes: 2 }, { chance: 0.7, clearance: 0 }),
    corner('boxes', 'front-left', [0.9, 0.7], { boxes: 1 }, { chance: 0.5, clearance: 0 }),
    corner('meeting_table', 'front-right', [1.3, 0.8], { meeting_table: 1 }, { chance: 0.4, clearance: 0.4 }),
  ],
    shop_market: r => {
    const L = [], nx = clamp(Math.floor((r.w - 5.6) / 2.9) + 1, 1, 4), nz = clamp(Math.floor((r.d - 3.3) / 1.9) + 1, 1, 4);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const dx = nx === 1 ? r.w / 2 : 2.8 + ix * (r.w - 5.6) / (nx - 1), dz = nz === 1 ? r.d / 2 : 1.3 + iz * (r.d - 3.3) / (nz - 1);
      L.push(center('gondola' + iz + ix, 0, 0, [2.0, 0.7], { gondola_shelf: 3 }, { dx, dz, chance: ix + iz === 0 ? 1 : 0.9, required: ix + iz === 0, facing: 'v+', clearance: 0.5 }));
    }
    L.push(wall('shelving_1', 'back', 0.25, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.85, clearance: 0.9 }), wall('shelving_2', 'back', 0.75, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.85, clearance: 0.9 }),
      wall('shelving_3', 'left', 0.5, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.8, clearance: 0.9 }), wall('fridge_1', 'right', 0.3, [1.0, 0.75], { display_fridge: 1 }, { chance: 0.8, clearance: 0.9 }),
      wall('fridge_2', 'right', 0.7, [1.0, 0.75], { display_fridge: 1 }, { chance: 0.6, clearance: 0.9 }), wall('freezer', 'left', 0.15, [1.7, 0.85], { freezer: 1 }, { chance: 0.7, clearance: 0.8 }),
      center('produce', 0.5, 0.5, [1.3, 0.8], { produce_stand: 1 }, { chance: 0.5, facing: 'v+', clearance: 0.5 }), inside('fruit', 'produce', { fruit_crate: 1 }, { chance: 0.9 }),
      corner('carts', 'front-left', [0.7, 1.0], { shopping_cart: 1 }, { chance: 0.5, clearance: 0 }), corner('display', 'front-right', [0.7, 0.7], { display_stand: 1 }, { chance: 0.4, clearance: 0.3 }));
    return L;
  },
    counter_market: _r => [
    center('checkout_1', 0.25, 0.5, [1.8, 0.8], { checkout_counter: 1 }, { required: true, facing: 'v+', clearance: 0.5 }),
    on('register_1', 'checkout_1', { cash_register: 1 }, { chance: 0.95 }),
    center('checkout_2', 0.7, 0.5, [1.8, 0.8], { checkout_counter: 1 }, { chance: 0.8, facing: 'v+', clearance: 0.5 }),
    on('register_2', 'checkout_2', { cash_register: 1 }, { chance: 0.95 }),
    corner('baskets', 'front-left', [0.6, 0.5], { baskets: 1 }, { chance: 0.6, clearance: 0 }),
    corner('baskets_2', 'front-right', [0.6, 0.5], { baskets: 1 }, { chance: 0.4, clearance: 0 }),
  ],
    shop_pharmacy: r => {
    const L = [], nz = clamp(Math.floor((r.d - 3.0) / 2.0) + 1, 1, 3), nx = clamp(Math.floor((r.w - 5.0) / 2.4) + 1, 1, 3);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const dx = nx === 1 ? r.w / 2 : 2.5 + ix * (r.w - 5.0) / (nx - 1), dz = nz === 1 ? r.d / 2 : 1.4 + iz * (r.d - 3.0) / (nz - 1);
      L.push(center('display_rack' + iz + ix, 0, 0, [1.0, 0.6], { display_rack: 1 }, { dx, dz, chance: ix + iz === 0 ? 1 : 0.8, required: ix + iz === 0, facing: 'v+', clearance: 0.5 }));
    }
    L.push(wall('shelving_1', 'left', 0.5, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.85, clearance: 0.9 }), wall('shelving_2', 'right', 0.5, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.85, clearance: 0.9 }),
      wall('display_case', 'front', 0.1, [1.3, 0.55], { display_case: 1 }, { chance: 0.6, clearance: 0.6 }), wall('waiting', 'left', 0.12, [1.6, 0.55], { waiting_bench: 1 }, { chance: 0.6, clearance: 0.6 }),
      wall('fridge', 'right', 0.12, [0.8, 0.75], { display_fridge: 1 }, { chance: 0.6, clearance: 0.8 }), corner('scale', 'front-right', [0.45, 0.45], { scale: 1 }, { chance: 0.5, clearance: 0.3 }),
      corner('plant', 'back-right', [0.5, 0.5], { plant: 1 }, { chance: 0.3, clearance: 0 }));
    return L;
  },
    counter_pharmacy: _r => [
    center('counter_1', 0.3, 0.3, [2.2, 0.8], { pharmacy_counter: 1 }, { required: true, facing: 'v-', clearance: 0.5 }),
    center('counter_2', 0.7, 0.3, [2.2, 0.8], { pharmacy_counter: 1 }, { chance: 0.7, facing: 'v-', clearance: 0.5 }),
    wall('shelving_1', 'back', 0.25, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.8, clearance: 0.5 }),
    wall('shelving_2', 'back', 0.75, [1.9, 0.45], { wall_shelving: 1 }, { chance: 0.8, clearance: 0.5 }),
    corner('fridge', 'back-left', [0.8, 0.75], { display_fridge: 1 }, { chance: 0.5, clearance: 0.5 }),
  ],
    backyard_service: _r => [
    center('dumpster', 0.8, 0.8, [2.8, 1.8], { dumpster: 1 }, { chance: 0.5, facing: 'v+', clearance: 0.3 }),
    center('pallet', 0.25, 0.8, [1.3, 1.1], { pallet: 1, boxes: 2 }, { chance: 0.8, clearance: 0 }),
    corner('bin', 'back-right', [0.6, 0.6], { outdoor_bin: 1 }, { chance: 0.6, clearance: 0 }),
    wall('box_shelf', 'left', 0.5, [0.8, 0.8], { boxes: 1 }, { chance: 0.4, clearance: 0 }),
  ],
  }
  const _lib = (id: string) => libs[id] as LibFn

  return libs
}
