import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `salted_fish`.
 */
export const saltedFish: ItemModelBuilder = ({ mesh, bx, G, food }) => {
  const fillet = mesh(bx(2.5, 0.3, 1.0), food(0xc5b89a))
  const salt = mesh(bx(2.0, 0.298, 0.8), food(0xeeeeee))
  return G(fillet, salt)
}
