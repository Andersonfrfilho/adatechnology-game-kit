import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `electronic_components`.
 */
export const electronicComponents: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic }) => {
  const pcb = mesh(bx(1.0, 0.12, 0.8), plastic(0x15582a), [0, -0.04, 0])
  const ic = mesh(bx(0.4, 0.08, 0.26), plastic(0x181818), [0, 0.06, 0])
  const cap = mesh(cyl(0.06, 0.06, 0.08, 12), plastic(0x1a3388), [-0.3, 0.06, 0.2])
  return G(pcb, ic, cap)
}
