import type { SlotKit, SlotLibrary } from '@adatechnology/game-floorplan'
import { clamp } from './util'

/** Slot libraries of the office tower (see `templates/office-tower.ts`), built with the engine's slot kit. */
export function createTowerLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { wall, corner, center, on } = kit
  return {
    // An open-plan office suite: a grid of desks with their chairs' room, filing along the back wall, a plant and a waiting bench by the corridor.
    office_open: (r) => {
      const nx = clamp(Math.floor((r.w - 2.4) / 3.4) + 1, 1, 3), nz = clamp(Math.floor((r.d - 2.4) / 3.2) + 1, 1, 2)
      const L = []
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const dx = nx === 1 ? r.w / 2 : 1.8 + ix * (r.w - 3.6) / (nx - 1), dz = nz === 1 ? r.d / 2 : 1.6 + iz * (r.d - 3.2) / (nz - 1)
          L.push(center('desk' + iz + ix, 0, 0, [1.6, 0.8], { office_desk: 1 }, { dx, dz, chance: ix + iz === 0 ? 1 : 0.9, required: ix + iz === 0, facing: 'v+', clearance: 0.7 }))
        }
      }
      L.push(
        on('lamp_0', 'desk00', { table_light: 1 }, { chance: 0.4 }),
        wall('filing_1', 'back', 0.2, [0.9, 0.6], { filing_cabinet: 1 }, { chance: 0.8, clearance: 0.7 }),
        wall('filing_2', 'back', 0.8, [0.9, 0.6], { filing_cabinet: 1 }, { chance: 0.5, clearance: 0.7 }),
        wall('bookcase', 'left', 0.5, [1.3, 0.45], { bookcase: 1 }, { chance: 0.6, clearance: 0.6 }),
        corner('meeting_table', 'back-right', [1.3, 0.8], { meeting_table: 1 }, { chance: 0.5, clearance: 0.5 }),
        corner('plant', 'front-left', [0.5, 0.5], { plant_tall: 1, plant: 1 }, { chance: 0.6, clearance: 0 }),
        corner('bench', 'front-right', [1.5, 0.5], { waiting_bench: 1 }, { chance: 0.3, clearance: 0.4 }),
      )
      return L
    },
  }
}
