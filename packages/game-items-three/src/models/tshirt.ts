import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const tshirt: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const fabric = cloth(0x8a8f94)
  const rib = cloth(0x6f7378)
  const inside = cloth(0x2b2d30)
  return G(
    mesh(bx(0.21, 0.0352, 0.22), fabric, [0, 0.0176, 0]),
    mesh(bx(0.045, 0.03, 0.08), fabric, [-0.1275, 0.015, -0.07]),
    mesh(bx(0.045, 0.03, 0.08), fabric, [0.1275, 0.015, -0.07]),
    mesh(bx(0.045, 0.034, 0.012), rib, [-0.1275, 0.017, -0.024]),
    mesh(bx(0.045, 0.034, 0.012), rib, [0.1275, 0.017, -0.024]),
    mesh(bx(0.07, 0.0356, 0.022), inside, [0, 0.0198, -0.097]),
    mesh(bx(0.09, 0.0358, 0.012), rib, [0, 0.0219, -0.1]),
  )
}
