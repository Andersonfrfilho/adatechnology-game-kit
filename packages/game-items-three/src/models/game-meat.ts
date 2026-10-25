import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `game_meat`.
 */
export const gameMeat: ItemModelBuilder = ({ mesh, bx, cyl, G, food }) => {
  const meat = mesh(bx(2.8, 0.8, 2.0), food(0x6a1515))
  const bone = mesh(cyl(0.12, 0.12, 3.0, 12), food(0xe8e0d0), [0, 0, 0], [0, 0, Math.PI / 2])
  return G(meat, bone)
}
