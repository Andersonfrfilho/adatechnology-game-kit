import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const fishingRod: ItemModelBuilder = ({ mesh, cyl, bx, G, plastic, wood, metal }) => {
  const group = G()
  group.add(mesh(cyl(0.02, 0.02, 0.25, 8), wood(0xc2a06a), [-0.775, 0, 0], [0, 0, Math.PI / 2]))
  group.add(mesh(cyl(0.004, 0.009, 1.55, 8), plastic(0x2f3a35), [0.125, 0, 0], [0, 0, -Math.PI / 2]))
  group.add(mesh(cyl(0.017, 0.017, 0.012, 12), metal(0x8d9096), [-0.62, 0, 0], [Math.PI / 2, 0, 0]))
  ;[-0.2, 0.2, 0.55, 0.78].forEach((x) => group.add(mesh(bx(0.004, 0.014, 0.004), metal(0x8d9096), [x, 0.01, 0])))
  group.add(mesh(bx(0.012, 0.012, 0.012), metal(0x8d9096), [0.894, 0, 0]))
  return group
}
