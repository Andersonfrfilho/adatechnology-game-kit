import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tarp`.
 */
export const tarp: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth, metal }) => {
  const blue = cloth(0x2f5f8f)
  const deep = cloth(0x2a557f)
  const rope = cloth(0xcbb98a)
  const corners: Array<[number, number]> = [[1.55, 1.05], [-1.55, 1.05], [1.55, -1.05], [-1.55, -1.05]]
  return G(
    mesh(bx(3.5, 0.24, 2.5), blue, [0, -0.38, 0]),
    mesh(bx(3.4, 0.25, 2.44), deep, [0, -0.135, 0]),
    mesh(bx(3.46, 0.25, 2.4), blue, [0, 0.115, 0]),
    mesh(bx(3.38, 0.24, 2.46), deep, [0, 0.37, 0]),
    mesh(bx(0.12, 1.002, 2.502), rope, [0.9, 0, 0]),
    mesh(bx(0.12, 1.002, 2.502), rope, [-0.9, 0, 0]),
    ...corners.map(([x, z]) => mesh(cyl(0.09, 0.09, 0.02, 8), metal(0xb4b8bb), [x, 0.49, z])),
  )
}
