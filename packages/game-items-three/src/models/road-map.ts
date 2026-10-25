import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const roadMap: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const group = G()
  group.add(mesh(bx(0.11, 0.003, 0.25), paper(0x4f7a8a), [0, 0.0015, 0]))
  group.add(mesh(bx(0.108, 0.004, 0.24), paper(0xe4dcc2), [0, 0.005, 0]))
  group.add(mesh(bx(0.11, 0.003, 0.18), paper(0x4f7a8a), [0, 0.0085, 0.035]))
  group.add(mesh(bx(0.11, 0.003, 0.07), paper(0xe0b830), [0, 0.0085, -0.09]))
  return group
}
