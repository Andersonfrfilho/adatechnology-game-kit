import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sugar`.
 */
export const sugar: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const bag = mesh(bx(1.0, 1.9, 0.6), paper(0xf4f1ea), [0, -0.05, 0])
  const fold = mesh(bx(1.0, 0.1, 0.2), paper(0xd5cfbe), [0, 0.95, 0])
  const logo = mesh(bx(0.6, 0.6, 0.01), paper(0x2d5a7b), [0, 0, 0.305])
  return G(bag, fold, logo)
}
