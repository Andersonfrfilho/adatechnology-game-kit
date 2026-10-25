import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rapadura`.
 */
export const rapadura: ItemModelBuilder = ({ mesh, bx, G, food, paper }) => G(
  mesh(bx(1.9, 0.46, 0.58), food(0x8a5a2b), [0, -0.25, 0]),
  mesh(bx(1.78, 0.04, 0.5), food(0x9b6a36), [0, -0.01, 0]),
  mesh(bx(1.9, 0.46, 0.58), food(0x7d4f25), [0, 0.25, 0]),
  mesh(bx(1.78, 0.04, 0.5), food(0x9b6a36), [0, 0.5, 0]),
  mesh(bx(0.4, 0.96, 0.6), paper(0xc9a26a), [0, 0, 0]),
  mesh(bx(0.42, 0.2, 0.602), paper(0x6b3a1a), [0, 0, 0]),
)
