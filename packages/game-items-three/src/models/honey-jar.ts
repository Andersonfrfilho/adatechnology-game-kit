import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `honey_jar`.
 */
export const honeyJar: ItemModelBuilder = ({ mesh, cyl, G, glass, metal, paper, food }) => G(
  mesh(cyl(0.395, 0.395, 0.68, 12), glass(0xe3c070, 0.55), [0, -0.16, 0]),
  mesh(cyl(0.37, 0.37, 0.6, 12), food(0xd99a1c), [0, -0.2, 0]),
  mesh(cyl(0.3, 0.395, 0.14, 12), glass(0xe3c070, 0.55), [0, 0.25, 0]),
  mesh(cyl(0.3, 0.3, 0.18, 12), metal(0x6b4a1c), [0, 0.41, 0]),
  mesh(cyl(0.4, 0.4, 0.34, 12), paper(0xf1e7c8), [0, -0.2, 0]),
  mesh(cyl(0.402, 0.402, 0.05, 12), paper(0x8a5a14), [0, -0.1, 0]),
  mesh(cyl(0.402, 0.402, 0.05, 12), paper(0x8a5a14), [0, -0.3, 0]),
)
