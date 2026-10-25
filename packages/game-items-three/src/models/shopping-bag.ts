import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const shoppingBag: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const body = cloth(0x4b6a5a)
  const trim = cloth(0x2f4a3c)
  return G(
    mesh(bx(0.3, 0.008, 0.2), body, [0, 0.004, 0]),
    mesh(bx(0.2, 0.008, 0.12), trim, [0, 0.012, 0]),
    mesh(bx(0.1, 0.004, 0.012), trim, [0, 0.018, -0.05]),
    mesh(bx(0.1, 0.004, 0.012), trim, [0, 0.018, 0.05]),
  )
}
