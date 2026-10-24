import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bolt_cutters`.
 */
export const boltCutters: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const handles = mesh(bx(6.0, 0.6, 1.5), metal(0x333333))
  const grip = mesh(bx(2.5, 0.602, 1.4), plastic(0xdd2222), [-1.6, 0, 0])
  return G(handles, grip)
}
