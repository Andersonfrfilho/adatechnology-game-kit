import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sharpening_stone`.
 */
export const sharpeningStone: ItemModelBuilder = ({ mesh, bx, G, wood, plastic, paper }) => G(
  mesh(bx(19.2, 2, 2.5), wood(0x7a5632), [0, -1.5, 0]),
  mesh(bx(0.4, 2, 2.5), plastic(0x1f2022), [-9.8, -1.5, 0]),
  mesh(bx(0.4, 2, 2.5), plastic(0x1f2022), [9.8, -1.5, 0]),
  mesh(bx(9.4, 3, 2.3), paper(0x8c8f8a), [-4.7, 1, 0]),
  mesh(bx(9.4, 3, 2.3), paper(0xc9c3b0), [4.7, 1, 0]),
)
