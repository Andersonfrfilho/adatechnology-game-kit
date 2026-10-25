import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `potatoes`.
 */
export const potatoes: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const sack = mesh(bx(2.0, 0.9, 1.4), cloth(0x8a7050))
  const tie = mesh(bx(0.12, 0.902, 1.402), cloth(0x554433), [0.6, 0, 0])
  return G(sack, tie)
}
