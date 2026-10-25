import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `eggs`.
 */
export const eggs: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const carton = mesh(bx(2.5, 0.7, 1.0), paper(0x8a7a60))
  const label = mesh(bx(1.8, 0.01, 0.6), paper(0x336699), [0, 0.355, 0])
  return G(carton, label)
}
