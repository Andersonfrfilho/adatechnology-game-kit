import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `inverter_welder`.
 */
export const inverterWelder: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const unit = mesh(bx(3.0, 2.0, 1.3), metal(0xcc6611), [0, -0.1, 0])
  const handle = mesh(bx(1.2, 0.2, 0.3), plastic(0x111111), [0, 1.0, 0])
  return G(unit, handle)
}
