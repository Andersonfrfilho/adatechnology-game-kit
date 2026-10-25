import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cigarettes: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const group = G()
  group.add(mesh(bx(0.055, 0.045, 0.022), paper(0xe8e4da), [0, 0.0225, 0]))
  group.add(mesh(bx(0.055, 0.012, 0.022), paper(0xb08a3a), [0, 0.051, 0]))
  group.add(mesh(bx(0.055, 0.031, 0.022), paper(0xa23b2e), [0, 0.0725, 0]))
  return group
}
