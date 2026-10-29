import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const note: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const group = G()
  group.add(mesh(bx(0.15, 0.001, 0.1), paper(0xe9e2cf), [0, 0.0005, 0]))
  group.add(mesh(bx(0.14, 0.001, 0.09), paper(0xf3eedd), [0, 0.0015, 0.002]))
  return group
}
