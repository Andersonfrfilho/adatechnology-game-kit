import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lubricant_spray`.
 */
export const lubricantSpray: ItemModelBuilder = ({ mesh, cyl, G, metal, plastic }) => {
  const can = mesh(cyl(0.25, 0.25, 1.7, 16), metal(0x1a4590))
  const cap = mesh(cyl(0.25, 0.25, 0.35, 16), plastic(0xcc2222), [0, 0.675, 0])
  const straw = mesh(cyl(0.012, 0.012, 1.2, 8), plastic(0xcc2222), [0.24, -0.1, 0])
  return G(can, cap, straw)
}
