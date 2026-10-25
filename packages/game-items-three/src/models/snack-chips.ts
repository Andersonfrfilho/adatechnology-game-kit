import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `snack_chips`.
 */
export const snackChips: ItemModelBuilder = ({ T, mesh, bx, G, paper, plastic, food }) => G(
  mesh(bx(2.0, 2.4, 0.58), plastic(0xd0402a)),
  mesh(bx(2.0, 0.2, 0.12), plastic(0xa8301c), [0, 1.3, 0]),
  mesh(bx(2.0, 0.2, 0.12), plastic(0xa8301c), [0, -1.3, 0]),
  mesh(bx(1.4, 1.2, 0.02), paper(0xf1c230), [0, 0.1, 0.3]),
  mesh(new T.SphereGeometry(0.5, 8, 4), food(0xe3b04a), [0, 0.1, 0.29], [0, 0, 0.4], [0.9, 0.6, 0.04]),
  mesh(bx(1.4, 0.2, 0.022), paper(0x7a1a10), [0, -0.8, 0.3]),
)
