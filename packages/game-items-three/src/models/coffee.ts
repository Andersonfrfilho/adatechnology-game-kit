import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `coffee`.
 */
export const coffee: ItemModelBuilder = ({ T, mesh, bx, G, paper, food }) => G(
  mesh(bx(0.8, 1.3, 0.58), paper(0x5a3a22), [0, -0.1, 0]),
  mesh(bx(0.8, 0.2, 0.12), paper(0x3f2a18), [0, 0.65, 0]),
  mesh(bx(0.6, 0.55, 0.02), paper(0xe8d7b0), [0, -0.05, 0.3]),
  mesh(bx(0.6, 0.12, 0.022), paper(0x8a5a2e), [0, -0.4, 0.3]),
  mesh(new T.SphereGeometry(0.5, 8, 4), food(0x3b2414), [0, 0.0, 0.29], [0, 0, 0.5], [0.3, 0.42, 0.06]),
)
