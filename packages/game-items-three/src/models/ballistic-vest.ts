import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const ballisticVest: ItemModelBuilder = ({ mesh, bx, G, cloth, metal, plastic }) => {
  const shell = cloth(0x4b5439)
  const strap = cloth(0x3a4130)
  const plate = plastic(0x2a2d2a)
  const buckle = metal(0x8a8d90)
  return G(
    mesh(bx(0.34, 0.045, 0.34), shell, [0, 0.0225, 0.055]),
    mesh(bx(0.08, 0.022, 0.1), strap, [-0.1, 0.011, -0.175]),
    mesh(bx(0.08, 0.022, 0.1), strap, [0.1, 0.011, -0.175]),
    mesh(bx(0.03, 0.04, 0.22), strap, [-0.185, 0.02, 0.1]),
    mesh(bx(0.03, 0.04, 0.22), strap, [0.185, 0.02, 0.1]),
    mesh(bx(0.24, 0.025, 0.24), plate, [0, 0.0575, 0.03]),
    mesh(bx(0.07, 0.02, 0.05), strap, [-0.1, 0.055, 0.19]),
    mesh(bx(0.07, 0.02, 0.05), strap, [0, 0.055, 0.19]),
    mesh(bx(0.07, 0.02, 0.05), strap, [0.1, 0.055, 0.19]),
    mesh(bx(0.03, 0.01, 0.02), buckle, [-0.1, 0.027, -0.215]),
    mesh(bx(0.03, 0.01, 0.02), buckle, [0.1, 0.027, -0.215]),
  )
}
