import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `slingshot`.
 */
export const slingshot: ItemModelBuilder = ({ mesh, bx, G, wood, plastic }) => {
  const fork = mesh(bx(1.3, 1.5, 0.25), wood(0x7a5030))
  const band = mesh(bx(1.2, 0.05, 0.252), plastic(0xdd8822), [0, 0.6, 0])
  return G(fork, band)
}
