import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cash: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const bills = paper(0x6f8f62)
  const group = G()
  group.add(mesh(bx(0.0625, 0.01, 0.065), bills, [-0.04625, 0.005, 0]))
  group.add(mesh(bx(0.03, 0.01, 0.065), paper(0xd8cfa8), [0, 0.005, 0]))
  group.add(mesh(bx(0.0625, 0.01, 0.065), bills, [0.04625, 0.005, 0]))
  return group
}
