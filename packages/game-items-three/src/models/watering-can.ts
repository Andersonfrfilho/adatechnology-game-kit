import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const wateringCan: ItemModelBuilder = ({ mesh, cyl, bx, G, metal }) => {
  const zinc = metal(0x7f8b8f)
  const group = G()
  group.add(mesh(cyl(0.09, 0.09, 0.2, 16), zinc, [-0.06, 0.1, 0]))
  group.add(mesh(cyl(0.07, 0.07, 0.004, 16), metal(0x4b5256), [-0.06, 0.2, 0]))
  group.add(mesh(cyl(0.012, 0.02, 0.22, 8), zinc, [0.1194, 0.115, 0], [0, 0, -0.85]))
  group.add(mesh(cyl(0.035, 0.022, 0.02, 12), zinc, [0.2094, 0.225, 0], [0, 0, -0.85]))
  group.add(mesh(bx(0.01, 0.16, 0.02), zinc, [-0.155, 0.12, 0]))
  group.add(mesh(bx(0.05, 0.01, 0.02), zinc, [-0.135, 0.2, 0]))
  group.add(mesh(bx(0.05, 0.01, 0.02), zinc, [-0.135, 0.04, 0]))
  return group
}
