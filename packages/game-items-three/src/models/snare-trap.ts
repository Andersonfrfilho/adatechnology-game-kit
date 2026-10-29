import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const snareTrap: ItemModelBuilder = ({ mesh, torus, bx, G, metal, wood }) => {
  const group = G()
  group.add(mesh(torus(0.067, 0.008), metal(0x8d9096), [0, 0.015, 0], [Math.PI / 2, 0, 0]))
  group.add(mesh(bx(0.02, 0.03, 0.02), wood(0x7a5a3a), [0.065, 0.015, 0]))
  group.add(mesh(bx(0.02, 0.02, 0.02), metal(0x6c6f75), [0, 0.015, 0.065]))
  group.add(mesh(bx(0.006, 0.006, 0.03), wood(0xa08560), [0, 0.01, -0.06]))
  return group
}
