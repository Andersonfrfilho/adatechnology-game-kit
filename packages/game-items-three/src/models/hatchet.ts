import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hatchet`.
 */
export const hatchet: ItemModelBuilder = ({ mesh, cyl, bx, extrude, G, metal, wood, cloth }) => {
  const R = Math.PI / 2
  const head = metal(0x5c6065)
  const blade = extrude([[0.7, -0.25], [1.75, -0.65], [1.75, 0.65], [0.7, 0.25]], 0.28, 0.002)
  return G(
    mesh(cyl(0.14, 0.09, 3.0, 8), wood(0x8a643c), [-0.25, 0, 0], [0, 0, R]),
    mesh(cyl(0.16, 0.16, 0.2, 8), wood(0x6f4f2e), [-1.65, 0, 0], [0, 0, R]),
    mesh(cyl(0.145, 0.145, 1.0, 8), cloth(0x2b2b2b), [-1.15, 0, 0], [0, 0, R]),
    mesh(bx(0.5, 0.5, 0.45), head, [1.0, 0, 0]),
    mesh(blade, head, [0, 0.14, 0], [R, 0, 0]),
    mesh(bx(0.08, 0.12, 1.3), metal(0xc4c8cb), [1.71, 0, 0]),
  )
}
