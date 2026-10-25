import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const backpack: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const main = cloth(0x2f4a6b)
  const trim = cloth(0x1e2a3a)
  return G(
    mesh(bx(0.3, 0.28, 0.12), main, [0, 0.14, -0.02]),
    mesh(bx(0.24, 0.14, 0.06), trim, [0, 0.1, 0.07]),
    mesh(bx(0.05, 0.22, 0.02), trim, [-0.08, 0.13, -0.09]),
    mesh(bx(0.05, 0.22, 0.02), trim, [0.08, 0.13, -0.09]),
    mesh(bx(0.07, 0.02, 0.02), trim, [0, 0.29, -0.02]),
    mesh(bx(0.2, 0.012, 0.125), plastic(0x15181c), [0, 0.2, -0.02]),
  )
}
