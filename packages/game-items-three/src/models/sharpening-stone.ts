import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sharpening_stone`.
 */
export const sharpeningStone: ItemModelBuilder = ({ mesh, bx, G, wood }) => {
  const stone = mesh(bx(2.0, 0.5, 0.25), wood(0x777777))
  const side = mesh(bx(2.002, 0.24, 0.252), wood(0x444444), [0, -0.125, 0])
  return G(stone, side)
}
