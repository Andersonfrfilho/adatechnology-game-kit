import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const coolerBox: ItemModelBuilder = ({ mesh, bx, G, plastic }) => {
  const body = plastic(0x2f5d8a)
  const lid = plastic(0xe6e6e0)
  return G(
    mesh(bx(0.32, 0.19, 0.21), body, [0, 0.095, -0.01]),
    mesh(bx(0.32, 0.05, 0.21), lid, [0, 0.215, -0.01]),
    mesh(bx(0.14, 0.01, 0.04), lid, [0, 0.245, 0]),
    mesh(bx(0.06, 0.05, 0.02), lid, [-0.1, 0.18, 0.105]),
    mesh(bx(0.06, 0.05, 0.02), lid, [0.1, 0.18, 0.105]),
  )
}
