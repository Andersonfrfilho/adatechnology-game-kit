import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `scissors`.
 */
export const scissors: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const blades = mesh(bx(1.8, 0.15, 0.7), metal(0xcccccc))
  const grip = mesh(bx(0.6, 0.152, 0.65), plastic(0x222222), [-0.6, 0, 0])
  return G(blades, grip)
}
