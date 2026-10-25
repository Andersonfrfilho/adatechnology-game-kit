import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const photo: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const group = G()
  group.add(mesh(bx(0.102, 0.001, 0.152), paper(0xf1eee4), [0, 0.0005, 0]))
  group.add(mesh(bx(0.088, 0.001, 0.115), paper(0x7a8a8c), [0, 0.0015, -0.01]))
  return group
}
