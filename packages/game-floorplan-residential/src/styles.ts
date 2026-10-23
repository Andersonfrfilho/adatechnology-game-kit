import type { StyleDef } from '@adatechnology/game-floorplan'

/** Style parameters. Facade swatches come from the selected region. */
export const residentialStyles: Omit<StyleDef, 'swatches'>[] = [
  {
    id: 'budget',
    seedKey: 'popular',
    height: 1.8,
    front: { type: { wall: 0.75, railing: 0.25 }, top: { none: 0.5, railing: 0.3, glass: 0.2 } },
    sideYard: { type: { wall: 1 }, top: { none: 0.5, glass: 0.5 } },
    back: { type: { wall: 0.7, fence: 0.3 }, top: { none: 0.4, glass: 0.4, razor_wire: 0.2 } },
    gate: { garage: { tilting: 0.5, sliding: 0.5 } },
    facade: { finish: { plaster: 0.55, roughcast: 0.45 }, grilles: 0.8, roof: { colonial: 0.4, fiber_cement: 0.4, slab: 0.2 } },
    grounds: { garden: { dirt: 0.5, lawn: 0.5 }, parking: { concrete: 1 }, backyard: { concrete: 0.6, dirt: 0.4 }, side_yard: { concrete: 1 } },
  },
  {
    id: 'mid',
    seedKey: 'medio',
    height: 2.2,
    front: { type: { wall: 0.7, railing: 0.3 }, top: { none: 0.5, railing: 0.3, glass: 0.2 } },
    sideYard: { type: { wall: 1 }, top: { none: 0.5, glass: 0.3, railing: 0.2 } },
    back: { type: { wall: 1 }, top: { none: 0.4, glass: 0.4, razor_wire: 0.2 } },
    gate: { garage: { tilting: 0.4, sliding: 0.6 } },
    facade: { finish: { plaster: 0.85, roughcast: 0.15 }, grilles: 0.5, roof: { colonial: 0.45, slab: 0.4, fiber_cement: 0.15 } },
    grounds: { garden: { lawn: 1 }, parking: { tile_floor: 0.6, concrete: 0.4 }, backyard: { lawn: 1 }, gourmet: { tile_floor: 1 }, side_yard: { concrete: 1 } },
  },
  {
    id: 'high',
    aliases: ['luxury'],
    seedKey: 'alto',
    height: 2.8,
    front: { type: { wall: 0.8, railing: 0.2 }, top: { razor_wire: 0.5, railing: 0.5 } },
    sideYard: { type: { wall: 1 }, top: { razor_wire: 0.8, railing: 0.2 } },
    back: { type: { wall: 1 }, top: { razor_wire: 0.9, glass: 0.1 } },
    gate: { garage: { sliding: 0.7, tilting: 0.3 } },
    facade: { finish: { plaster: 1 }, grilles: 0.35, roof: { colonial: 0.6, slab: 0.4 } },
    grounds: { garden: { lawn: 1 }, parking: { tile_floor: 1 }, backyard: { lawn: 1 }, gourmet: { tile_floor: 1 }, side_yard: { lawn: 0.6, concrete: 0.4 } },
  },
]
