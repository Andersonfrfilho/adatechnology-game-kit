import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const tshirt: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const fabric = cloth(0x8a8f94)
  const rib = cloth(0x6f7378)
  const inside = cloth(0x2b2d30)
  return G(
    mesh(bx(0.21, 0.0392, 0.22), fabric, [0, 0.0196, 0]),
    mesh(bx(0.045, 0.03, 0.08), fabric, [-0.1275, 0.015, -0.07]),
    mesh(bx(0.045, 0.03, 0.08), fabric, [0.1275, 0.015, -0.07]),
    mesh(bx(0.045, 0.034, 0.012), rib, [-0.1275, 0.017, -0.024]),
    mesh(bx(0.045, 0.034, 0.012), rib, [0.1275, 0.017, -0.024]),
    mesh(bx(0.07, 0.04, 0.024), inside, [0, 0.02, -0.098]),
    mesh(bx(0.09, 0.0394, 0.012), rib, [0, 0.0197, -0.1]),
  )
}
