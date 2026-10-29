import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const extensionCord: ItemModelBuilder = ({ mesh, cyl, bx, G, plastic }) => {
  const flange = plastic(0x3a3b3c)
  const plugBody = plastic(0xd8d4c8)
  return G(
    mesh(cyl(0.115, 0.115, 0.008, 14), flange, [0, 0.004, 0]),
    mesh(cyl(0.115, 0.115, 0.008, 14), flange, [0, 0.076, 0]),
    mesh(cyl(0.1, 0.1, 0.064, 14), plastic(0xc7691a), [0, 0.04, 0]),
    mesh(bx(0.012, 0.03, 0.025), plugBody, [0.108, 0.04, 0.02]),
    mesh(bx(0.012, 0.03, 0.04), plugBody, [-0.108, 0.04, -0.02]),
  )
}
