import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const crossbodyBag: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const body = cloth(0x3b3f45)
  const strap = cloth(0x25272b)
  return G(
    mesh(bx(0.25, 0.17, 0.07), body, [0, 0.085, -0.005]),
    mesh(bx(0.25, 0.1, 0.006), strap, [0, 0.12, 0.033]),
    mesh(bx(0.03, 0.03, 0.0075), metal(0xb0b2b5), [0, 0.085, 0.03625]),
    mesh(bx(0.012, 0.03, 0.012), strap, [-0.11, 0.185, 0]),
    mesh(bx(0.012, 0.03, 0.012), strap, [0.11, 0.185, 0]),
    mesh(bx(0.22, 0.012, 0.008), strap, [0, 0.192, 0]),
  )
}
