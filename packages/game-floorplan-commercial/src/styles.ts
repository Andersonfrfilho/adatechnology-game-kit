import type { StyleDef } from '@adatechnology/game-floorplan'

/** Style parameters. Facade swatches come from the selected region. */
export const commercialStyles: Omit<StyleDef, 'swatches'>[] = [
  {
    id: 'commercial',
    seedKey: 'comercial',
    height: 2.5,
    front: { type: { wall: 1 }, top: { none: 1 } },
    sideYard: { type: { wall: 1 }, top: { razor_wire: 0.5, glass: 0.5 } },
    back: { type: { wall: 1 }, top: { razor_wire: 0.6, glass: 0.4 } },
    gate: { garage: { sliding: 1 } },
    facade: { finish: { roughcast: 0.6, plaster: 0.4 }, grilles: 1, roof: { fiber_cement: 0.7, slab: 0.3 } },
    grounds: { backyard: { concrete: 1 }, parking: { concrete: 1 }, side_yard: { concrete: 1 } },
  },
  {
    id: 'farm',
    seedKey: 'fazenda',
    height: 1.4,
    front: { type: { fence: 1 }, top: { none: 1 } },
    sideYard: { type: { fence: 1 }, top: { none: 1 } },
    back: { type: { fence: 1 }, top: { none: 1 } },
    gate: { garage: { sliding: 1 } },
    facade: { finish: { roughcast: 0.5, plaster: 0.5 }, grilles: 0.3, roof: { colonial: 0.6, fiber_cement: 0.4 } },
    grounds: { garden: { dirt: 1 }, parking: { dirt: 1 }, backyard: { dirt: 1 }, side_yard: { dirt: 1 } },
  },
]
