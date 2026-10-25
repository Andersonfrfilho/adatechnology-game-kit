import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cassava_flour`.
 */
export const cassavaFlour: ItemModelBuilder = ({ T, mesh, bx, G, paper, food }) => G(
  mesh(bx(1.5, 2.2, 0.58), paper(0xf1e9d2), [0, -0.15, 0]),
  mesh(bx(1.5, 0.3, 0.34), paper(0xdcd1b3), [0, 1.1, 0]),
  mesh(bx(1.5, 0.05, 0.12), paper(0xc4b890), [0, 1.225, 0]),
  mesh(bx(1.1, 1.0, 0.02), paper(0xd48a2a), [0, -0.1, 0.3]),
  mesh(bx(1.1, 0.16, 0.022), paper(0x5b7a3a), [0, -0.78, 0.3]),
  mesh(new T.SphereGeometry(0.5, 8, 4), food(0x7a5230), [0, 0.0, 0.29], [0, 0, 0.5], [0.8, 0.28, 0.04]),
)
