import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const trekkingBackpack70L: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const main = cloth(0x5d5640)
  const dark = cloth(0x2f2b22)
  return G(
    mesh(bx(0.34, 0.2, 0.2), dark, [0, 0.1, -0.03]),
    mesh(bx(0.36, 0.49, 0.2), main, [0, 0.445, -0.03]),
    mesh(bx(0.38, 0.06, 0.26), dark, [0, 0.72, -0.02]),
    mesh(bx(0.28, 0.3, 0.08), main, [0, 0.35, 0.11]),
    mesh(bx(0.06, 0.45, 0.02), dark, [-0.1, 0.45, -0.14]),
    mesh(bx(0.06, 0.45, 0.02), dark, [0.1, 0.45, -0.14]),
    mesh(bx(0.38, 0.03, 0.02), dark, [0, 0.3, 0.14]),
    mesh(bx(0.05, 0.03, 0.02), plastic(0x1c1d1f), [0, 0.3, 0.14]),
  )
}
