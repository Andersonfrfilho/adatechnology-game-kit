import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const jeans: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const denim = cloth(0x3d5683)
  const band = cloth(0x2f4469)
  const stitch = cloth(0xc9a45c)
  return G(
    mesh(bx(0.31, 0.054, 0.105), denim, [0.025, 0.027, -0.0575]),
    mesh(bx(0.31, 0.054, 0.105), denim, [0.025, 0.027, 0.0575]),
    mesh(bx(0.04, 0.06, 0.22), band, [-0.15, 0.03, 0]),
    mesh(bx(0.05, 0.006, 0.06), band, [-0.03, 0.057, -0.0575]),
    mesh(bx(0.05, 0.006, 0.06), band, [-0.03, 0.057, 0.0575]),
    mesh(bx(0.3, 0.0545, 0.003), stitch, [0.03, 0.02725, 0]),
    mesh(bx(0.012, 0.06, 0.012), metal(0xb0b3b6), [-0.15, 0.03, 0]),
  )
}
