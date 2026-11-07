import type { MaterialDef } from '@adatechnology/game-destruction'
import type { PieceFriction } from './internal'

/** What a surface is to what touches it: its Coulomb friction and rolling resistance (`PieceFriction`) and its coefficient of restitution. */
export interface SurfaceDef extends PieceFriction {
  readonly restitution: number
}

/**
 * Coulomb friction, rolling resistance and restitution of a surface by its material. Two surfaces against each other mix the friction and the restitution by geometric mean
 * (`pieces.ts`), so each value is the coefficient of the material against itself: wood on wood 0.4 and 0.3, and then steel on wood sqrt(0.6 x 0.4) = 0.49, rubber on concrete
 * sqrt(1.0 x 0.7) = 0.84; the rolling resistance is the softer surface's (the larger).
 * Friction from the engineering tables of dry friction (The Engineering ToolBox, "Friction and Friction Coefficients"; Serway, Physics for Scientists and Engineers, table
 * 5.1): wood 0.25-0.5, steel 0.5-0.8 static and 0.4-0.6 sliding, glass 0.4 against other materials, ceramic 0.5, rubber 0.8-1.0, concrete and brick 0.6-0.7, plastic 0.3-0.4,
 * fabric and foam 0.5-0.8, paper 0.4. Rolling resistance (The Engineering ToolBox, "Rolling Resistance"): steel on steel 0.001-0.002, a hard wheel on concrete 0.01-0.02, on
 * wood 0.01, a carpet or foam 0.05-0.1. Restitution of a body bouncing on the material (drop tests): rubber 0.8, glass 0.7, steel 0.6, wood and plastic 0.5, concrete 0.4,
 * fabric and paper 0.2.
 */
const SURFACE_BY_KEY: ReadonlyArray<readonly [RegExp, SurfaceDef]> = [
  [/rubber|tire|tyre/, { static: 1.0, dynamic: 0.8, rolling: 0.03, restitution: 0.8 }],
  [/foam|sponge|fabric|cloth|leather|textile|carpet/, { static: 0.6, dynamic: 0.5, rolling: 0.08, restitution: 0.2 }],
  [/concrete|brick|stone|masonry|cement|asphalt|plaster/, { static: 0.7, dynamic: 0.6, rolling: 0.012, restitution: 0.4 }],
  [/steel|iron|metal|alumin|copper|brass|tin/, { static: 0.6, dynamic: 0.4, rolling: 0.002, restitution: 0.6 }],
  [/glass/, { static: 0.4, dynamic: 0.35, rolling: 0.002, restitution: 0.7 }],
  [/ceramic|porcelain|tile/, { static: 0.5, dynamic: 0.4, rolling: 0.005, restitution: 0.5 }],
  [/wood|mdf|plywood|board|cork/, { static: 0.4, dynamic: 0.3, rolling: 0.01, restitution: 0.5 }],
  [/plastic|polycarbonate|acrylic|nylon|pvc/, { static: 0.4, dynamic: 0.3, rolling: 0.01, restitution: 0.5 }],
  [/paper|cardboard|carton/, { static: 0.4, dynamic: 0.3, rolling: 0.02, restitution: 0.2 }],
]

/** The surface of a material by its id and tags (see `SURFACE_BY_KEY`), or undefined when nothing matches (the pieces' defaults then). */
export function surfaceOf(materialId: string, def?: MaterialDef): SurfaceDef | undefined {
  const keys = [materialId, ...(def?.tags ?? [])].join(' ').toLowerCase()
  return SURFACE_BY_KEY.find(([key]) => key.test(keys))?.[1]
}

/** The friction of a material by its id and tags (see `SURFACE_BY_KEY`), or undefined when nothing matches (the pieces' default then). */
export function frictionOf(materialId: string, def?: MaterialDef): PieceFriction | undefined {
  const surface = surfaceOf(materialId, def)
  return surface && { static: surface.static, dynamic: surface.dynamic, rolling: surface.rolling }
}
