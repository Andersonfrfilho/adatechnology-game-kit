import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lockpick_kit`.
 */
export const lockpickKit: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const caseMesh = mesh(bx(1.0, 0.7, 0.2), cloth(0x111111))
  const pick = mesh(bx(0.8, 0.04, 0.198), metal(0xcccccc))
  return G(caseMesh, pick)
}
