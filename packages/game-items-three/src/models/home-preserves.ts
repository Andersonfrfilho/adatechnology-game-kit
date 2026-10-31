import { asLid } from '../opening'

import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `home_preserves`.
 */
export const homePreserves: ItemModelBuilder = ({ mesh, cyl, G, glass, metal, paper, food, cloth }) => G(
  mesh(cyl(0.445, 0.445, 0.98, 12), glass(0xcfe6ee, 0.5), [0, -0.16, 0]),
  mesh(cyl(0.41, 0.41, 0.86, 12), food(0x8e1f3a), [0, -0.2, 0]),
  mesh(cyl(0.34, 0.445, 0.12, 12), glass(0xcfe6ee, 0.5), [0, 0.39, 0]),
  mesh(cyl(0.34, 0.34, 0.05, 12), glass(0xcfe6ee, 0.5), [0, 0.475, 0]),
  asLid(mesh(cyl(0.38, 0.38, 0.15, 12), metal(0xb99a3c), [0, 0.575, 0])),
  mesh(cyl(0.45, 0.45, 0.4, 12), paper(0xe9dfc4), [0, -0.2, 0]),
  mesh(cyl(0.452, 0.452, 0.08, 12), cloth(0x9b3a3a), [0, -0.2, 0]),
)
