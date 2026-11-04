import type { MaterialDef } from '@adatechnology/game-destruction'
import type { PieceFriction } from './internal'

/**
 * Coulomb friction of a surface by its material, static and dynamic. Two surfaces against each other mix by geometric mean (`pieces.ts`), so each value is the
 * coefficient of the material against itself: wood on wood 0.4 and 0.3, and then steel on wood sqrt(0.6 x 0.4) = 0.49, rubber on concrete sqrt(1.0 x 0.7) = 0.84.
 * Values from the engineering tables of dry friction (The Engineering ToolBox, "Friction and Friction Coefficients"; Serway, Physics for Scientists and
 * Engineers, table 5.1): wood 0.25-0.5, steel 0.5-0.8 static and 0.4-0.6 sliding, glass 0.4 against other materials, ceramic 0.5, rubber 0.8-1.0, concrete and
 * brick 0.6-0.7, plastic 0.3-0.4, fabric and foam 0.5-0.8, paper 0.4.
 */
const FRICTION_BY_KEY: ReadonlyArray<readonly [RegExp, PieceFriction]> = [
  [/rubber|tire|tyre/, { static: 1.0, dynamic: 0.8 }],
  [/foam|sponge|fabric|cloth|leather|textile|carpet/, { static: 0.6, dynamic: 0.5 }],
  [/concrete|brick|stone|masonry|cement|asphalt|plaster/, { static: 0.7, dynamic: 0.6 }],
  [/steel|iron|metal|alumin|copper|brass|tin/, { static: 0.6, dynamic: 0.4 }],
  [/glass/, { static: 0.4, dynamic: 0.35 }],
  [/ceramic|porcelain|tile/, { static: 0.5, dynamic: 0.4 }],
  [/wood|mdf|plywood|board|cork/, { static: 0.4, dynamic: 0.3 }],
  [/plastic|polycarbonate|acrylic|nylon|pvc/, { static: 0.4, dynamic: 0.3 }],
  [/paper|cardboard|carton/, { static: 0.4, dynamic: 0.3 }],
]

/** The friction of a material by its id and tags (see `FRICTION_BY_KEY`), or undefined when nothing matches (the pieces' default then). */
export function frictionOf(materialId: string, def?: MaterialDef): PieceFriction | undefined {
  const keys = [materialId, ...(def?.tags ?? [])].join(' ').toLowerCase()
  return FRICTION_BY_KEY.find(([key]) => key.test(keys))?.[1]
}
