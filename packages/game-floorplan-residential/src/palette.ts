import type { PaletteDraw, PaletteEarly, PaletteStyleDef } from '@adatechnology/game-floorplan'

type Tier = 'budget' | 'mid' | 'high'

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))

/**
 * Colour recipe of a residential style. The order of the random draws matters (it is the order
 * of the seeded stream), so the expressions are evaluated exactly in this sequence.
 */
function recipe(tier: Tier, facadeColors: PaletteStyleDef['facadeColors'], seedKey: string): PaletteStyleDef {
  return {
    seedKey,
    facadeColors,
    early({ rng, base, H0, H1, jit, hsl }: PaletteDraw): PaletteEarly {
      // mode A: more saturated walls; mode B: accents on objects
      const wallMode = tier === 'budget' ? rng() < 0.5 : false
      const sMax = tier === 'budget' ? (wallMode ? 0.48 : 0.3) : tier === 'mid' ? 0.22 : 0.12
      const roles = {
        facade: hsl(H0, base[2], base[3]),
        facade_detail: tier === 'high' ? hsl(220, 0.05, 0.14) : tier === 'mid' ? hsl(H1, jit(0.3, 0.1), jit(0.5, 0.1)) : hsl(H1, jit(0.4, 0.1), jit(0.36, 0.1)),
        wall: tier === 'budget' && rng() < 0.5 ? hsl(35, 0.04, jit(0.58, 0.08)) : hsl(H0, base[2] * 0.7, clamp(base[3] + (tier === 'high' ? -0.1 : 0), 0.3, 0.92)),
        gate: tier === 'budget' ? hsl(rng() < 0.5 ? H1 : 140, 0.45, 0.3) : tier === 'mid' ? hsl(220, 0.06, 0.22) : hsl(220, 0.04, 0.1),
        roof: tier === 'high' ? hsl(220, 0.05, 0.25) : hsl(jit(19, 6), 0.5, jit(0.4, 0.05)),
        ceiling: hsl(45, 0.03, 0.96),
      }
      const generalFloor: [number, number, number] =
        tier === 'budget' ? [jit(28, 14), jit(0.18, 0.1), jit(0.5, 0.08)] : tier === 'mid' ? [jit(32, 14), jit(0.2, 0.12), jit(0.5, 0.08)] : [jit(30, 10), jit(0.14, 0.1), jit(0.42, 0.08)]
      return { wallMode, sMax, roles, generalFloor }
    },
    late({ H1, H2, jit, hsl }, { wallMode }) {
      return {
        wood: hsl(jit(tier === 'high' ? 28 : 30, 6), jit(tier === 'high' ? 0.45 : 0.4, 0.1), jit(tier === 'budget' ? 0.46 : tier === 'mid' ? 0.4 : 0.34, 0.06)),
        fabric_main: hsl(H1, jit(tier === 'high' ? 0.1 : 0.22, 0.1), jit(0.55, 0.15)),
        fabric_accent: hsl(H2, wallMode ? jit(0.25, 0.1) : jit(0.3, 0.05), jit(0.5, 0.1)),
        picture_accent: hsl(H2, wallMode ? jit(0.25, 0.08) : jit(0.6, 0.1), jit(0.5, 0.08)),
        metal: tier === 'budget' ? hsl(210, 0.04, 0.58) : tier === 'mid' ? hsl(210, 0.05, 0.4) : hsl(220, 0.05, 0.16),
        exterior_floor: tier === 'budget' ? hsl(35, 0.05, jit(0.58, 0.06)) : tier === 'mid' ? hsl(30, 0.12, jit(0.62, 0.05)) : hsl(35, 0.06, jit(0.72, 0.05)),
        lawn: hsl(jit(100, 12), 0.4, tier === 'high' ? 0.36 : 0.32),
        dirt: hsl(28, 0.35, 0.36),
        deck_floor: hsl(jit(28, 4), 0.42, 0.4),
        water: hsl(190, 0.6, 0.55),
      }
    },
  }
}

/** Palette recipes of the residential styles, with the facade colour table of the selected region. */
export function createPaletteStyles(facadeColors: Record<string, PaletteStyleDef['facadeColors']>): Record<Tier, PaletteStyleDef> {
  return {
    budget: recipe('budget', facadeColors.budget, 'popular'),
    mid: recipe('mid', facadeColors.mid, 'medio'),
    high: recipe('high', facadeColors.high, 'alto'),
  }
}
