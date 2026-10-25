import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const deliveryBag: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const shell = cloth(0x8f3b2a)
  const trim = cloth(0x2b2b2d)
  return G(
    mesh(bx(0.48, 0.38, 0.4), shell, [0, 0.19, -0.01]),
    mesh(bx(0.48, 0.04, 0.4), trim, [0, 0.4, -0.01]),
    mesh(bx(0.36, 0.2, 0.02), trim, [0, 0.14, 0.2]),
    mesh(bx(0.24, 0.03, 0.06), trim, [0, 0.435, -0.01]),
    mesh(bx(0.05, 0.03, 0.01), plastic(0xbdbdb5), [0, 0.37, 0.2]),
    mesh(bx(0.02, 0.38, 0.4), trim, [-0.1, 0.19, -0.01]),
    mesh(bx(0.02, 0.38, 0.4), trim, [0.1, 0.19, -0.01]),
  )
}
