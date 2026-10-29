import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cooking_oil`.
 */
export const cookingOil: ItemModelBuilder = ({ mesh, cyl, G, glass, plastic, paper }) => G(
  mesh(cyl(0.345, 0.345, 1.7, 12), glass(0xe3b830, 0.65), [0, -0.45, 0]),
  mesh(cyl(0.12, 0.345, 0.5, 12), glass(0xe3b830, 0.65), [0, 0.65, 0]),
  mesh(cyl(0.12, 0.12, 0.25, 12), glass(0xe3b830, 0.65), [0, 1.025, 0]),
  mesh(cyl(0.14, 0.14, 0.15, 12), plastic(0x3f7a2a), [0, 1.225, 0]),
  mesh(cyl(0.35, 0.35, 0.8, 12), paper(0xf1e7c8), [0, -0.5, 0]),
  mesh(cyl(0.352, 0.352, 0.2, 12), paper(0x3f7a2a), [0, -0.5, 0]),
)
