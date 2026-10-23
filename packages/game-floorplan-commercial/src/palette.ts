import type { PaletteDraw, PaletteEarly, PaletteStyleDef } from '@adatechnology/game-floorplan'

/**
 * Palette recipe of the commercial style: shop-front colours with neutral interiors. The random
 * draws keep the order of the original colour module.
 */
export function createCommercialPalette(facadeColors: PaletteStyleDef['facadeColors']): PaletteStyleDef {
  return {
    seedKey: 'comercial',
    facadeColors,
    early({ base, H0, H1, jit, hsl }: PaletteDraw): PaletteEarly {
      const roles = {
        facade: hsl(H0, base[2], base[3]),
        facade_detail: hsl(H1, jit(0.4, 0.1), jit(0.36, 0.1)),
        wall: hsl(H0, base[2] * 0.7, Math.max(0.3, Math.min(0.92, base[3]))),
        gate: hsl(220, 0.04, 0.1),
        roof: hsl(jit(19, 6), 0.5, jit(0.4, 0.05)),
        ceiling: hsl(45, 0.03, 0.96),
      }
      const generalFloor: [number, number, number] = [jit(30, 10), jit(0.14, 0.1), jit(0.42, 0.08)]
      return { wallMode: false, sMax: 0.12, roles, generalFloor }
    },
    late({ H1, H2, jit, hsl }) {
      return {
        wood: hsl(jit(30, 6), jit(0.4, 0.1), jit(0.34, 0.06)),
        fabric_main: hsl(H1, jit(0.22, 0.1), jit(0.55, 0.15)),
        fabric_accent: hsl(H2, jit(0.3, 0.05), jit(0.5, 0.1)),
        picture_accent: hsl(H2, jit(0.6, 0.1), jit(0.5, 0.08)),
        metal: hsl(220, 0.05, 0.16),
        exterior_floor: hsl(35, 0.06, jit(0.72, 0.05)),
        lawn: hsl(jit(100, 12), 0.4, 0.32),
        dirt: hsl(28, 0.35, 0.36),
        deck_floor: hsl(jit(28, 4), 0.42, 0.4),
        water: hsl(190, 0.6, 0.55),
      }
    },
  }
}
