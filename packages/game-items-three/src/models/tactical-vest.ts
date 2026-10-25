import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const tacticalVest: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const shell = cloth(0x4a5236)
  const pouch = cloth(0x3b4229)
  const buckle = plastic(0x1e2020)
  return G(
    mesh(bx(0.35, 0.03, 0.28), shell, [0, 0.015, 0.06]),
    mesh(bx(0.09, 0.03, 0.12), shell, [-0.13, 0.015, -0.14]),
    mesh(bx(0.09, 0.03, 0.12), shell, [0.13, 0.015, -0.14]),
    mesh(bx(0.09, 0.07, 0.05), pouch, [-0.11, 0.065, 0.165]),
    mesh(bx(0.09, 0.07, 0.05), pouch, [0, 0.065, 0.165]),
    mesh(bx(0.09, 0.07, 0.05), pouch, [0.11, 0.065, 0.165]),
    mesh(bx(0.07, 0.05, 0.07), pouch, [-0.13, 0.055, 0.07]),
    mesh(bx(0.07, 0.05, 0.07), pouch, [0.13, 0.055, 0.07]),
    mesh(bx(0.03, 0.02, 0.02), buckle, [0, 0.04, 0.0]),
  )
}
