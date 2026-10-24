import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `ceftriaxone`.
 */
export const ceftriaxone: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(1.0, 0.6, 0.3), paper(0x8a2be2))
  const stripe = mesh(bx(1.002, 0.15, 0.302), paper(0xffffff))
  return G(box, stripe)
}
