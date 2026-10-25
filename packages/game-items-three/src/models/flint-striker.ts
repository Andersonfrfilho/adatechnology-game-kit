import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `flint_striker`.
 */
export const flintStriker: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const rod = mesh(bx(1.1, 0.2, 0.15), metal(0x333333))
  const grip = mesh(bx(0.35, 0.202, 0.152), plastic(0xcc5500), [-0.375, 0, 0])
  return G(rod, grip)
}
