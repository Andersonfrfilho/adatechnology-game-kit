import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const fannyPack: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const main = cloth(0x3a3d42)
  const trim = cloth(0x25272b)
  return G(
    mesh(bx(0.17, 0.1, 0.1), main, [0, 0.05, -0.01]),
    mesh(bx(0.15, 0.06, 0.02), trim, [0, 0.05, 0.05]),
    mesh(bx(0.04, 0.03, 0.012), trim, [-0.105, 0.05, -0.054]),
    mesh(bx(0.04, 0.03, 0.012), trim, [0.105, 0.05, -0.054]),
    mesh(bx(0.03, 0.03, 0.015), plastic(0x15181c), [0.0, 0.07, 0.05]),
  )
}
