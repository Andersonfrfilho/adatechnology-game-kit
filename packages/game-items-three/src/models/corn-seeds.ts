import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cornSeeds: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const width = 0.1
  const height = 0.15
  const depth = 0.02
  const group = G()
  group.add(mesh(bx(width, height, depth * 0.5), paper(0xe8dfc8)))
  group.add(mesh(bx(width * 0.9, height * 0.85, depth * 0.9), paper(0xefe7d3), [0, -height * 0.03, 0]))
  group.add(mesh(bx(width, height * 0.08, depth * 0.3), paper(0xcfc4a8), [0, height * 0.46, 0]))
  ;[1, -1].forEach((side) => group.add(mesh(bx(width * 0.7, height * 0.4, depth * 0.1), paper(0xe0b830), [0, -height * 0.05, side * depth * 0.45])))
  return group
}
