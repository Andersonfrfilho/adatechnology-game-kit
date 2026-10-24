import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `mechanic_toolbox`.
 */
export const mechanicToolbox: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const box = mesh(bx(4.0, 1.8, 2.0), metal(0xb02020), [0, -0.1, 0])
  const handle = mesh(bx(1.2, 0.2, 0.3), plastic(0x111111), [0, 0.9, 0])
  return G(box, handle)
}
