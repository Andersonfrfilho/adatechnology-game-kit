import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const dogTag: ItemModelBuilder = ({ mesh, cyl, bx, torus, G, metal }) => {
  const steel = metal(0xa7abb0)
  const group = G()
  group.add(mesh(bx(0.03, 0.003, 0.02), steel, [0, 0.0015, 0]))
  group.add(mesh(cyl(0.015, 0.015, 0.003, 8), steel, [0, 0.0015, 0.01]))
  group.add(mesh(cyl(0.015, 0.015, 0.003, 8), steel, [0, 0.0015, -0.01]))
  group.add(mesh(torus(0.0065, 0.0015), metal(0x6c6f75), [0, 0.0015, 0.0175], [Math.PI / 2, 0, 0]))
  return group
}
