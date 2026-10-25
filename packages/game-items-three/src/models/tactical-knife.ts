import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tactical_knife`.
 */
export const tacticalKnife: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const blade = mesh(bx(2.6, 0.28, 0.45), metal(0x222222))
  const handle = mesh(bx(1.0, 0.282, 0.4), plastic(0x1a2e1a), [-0.8, 0, 0])
  return G(blade, handle)
}
