import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const motorOil: ItemModelBuilder = ({ mesh, cyl, bx, G, plastic, paper }) => {
  const bottle = plastic(0x2a2d31)
  return G(
    mesh(bx(0.09, 0.19, 0.068), bottle, [-0.005, 0.095, 0]),
    mesh(bx(0.07, 0.08, 0.002), paper(0xd9a441), [-0.005, 0.09, 0.035]),
    mesh(cyl(0.02, 0.033, 0.04, 8), bottle, [-0.005, 0.21, 0]),
    mesh(cyl(0.02, 0.02, 0.03, 8), plastic(0xd9a441), [-0.005, 0.245, 0]),
    mesh(bx(0.01, 0.12, 0.03), bottle, [0.045, 0.11, 0]),
  )
}
