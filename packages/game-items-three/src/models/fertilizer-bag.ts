import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const fertilizerBag: ItemModelBuilder = ({ mesh, bx, G, cloth, paper }) => {
  const sack = cloth(0xb5a47a)
  const group = G()
  group.add(mesh(bx(0.45, 0.11, 0.3), sack, [0, 0.055, 0]))
  group.add(mesh(bx(0.4, 0.01, 0.26), sack, [0, 0.115, 0]))
  group.add(mesh(bx(0.018, 0.11, 0.3), cloth(0x8f8161), [-0.216, 0.055, 0]))
  group.add(mesh(bx(0.018, 0.11, 0.3), cloth(0x8f8161), [0.216, 0.055, 0]))
  group.add(mesh(bx(0.2, 0.01, 0.12), paper(0x4f7a45), [0, 0.125, 0]))
  return group
}
