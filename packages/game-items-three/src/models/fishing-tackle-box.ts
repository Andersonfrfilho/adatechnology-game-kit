import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const fishingTackleBox: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const group = G()
  group.add(mesh(bx(0.3, 0.07, 0.18), plastic(0x3f6b4a), [0, 0.035, 0]))
  group.add(mesh(bx(0.3, 0.025, 0.18), plastic(0x4d7f5a), [0, 0.0825, 0]))
  group.add(mesh(bx(0.12, 0.005, 0.02), plastic(0x2c2c2c), [0, 0.0975, 0]))
  group.add(mesh(bx(0.03, 0.04, 0.004), metal(0x9a9da2), [-0.08, 0.07, 0.088]))
  group.add(mesh(bx(0.03, 0.04, 0.004), metal(0x9a9da2), [0.08, 0.07, 0.088]))
  return group
}
