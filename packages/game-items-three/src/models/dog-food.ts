import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `dog_food`.
 */
export const dogFood: ItemModelBuilder = ({ mesh, bx, cyl, G, paper }) => {
  const brown = paper(0x6b3f22)
  return G(
    mesh(bx(1.8, 2.3, 0.65), paper(0xb5461f), [0, -0.15, -0.02]),
    mesh(bx(1.8, 0.26, 0.4), paper(0x9a3a18), [0, 1.13, 0]),
    mesh(bx(1.76, 0.05, 0.14), paper(0x7a2a10), [0, 1.275, 0]),
    mesh(bx(1.3, 1.3, 0.05), paper(0xf1e7c8), [0, -0.05, 0.315]),
    mesh(cyl(0.3, 0.3, 0.04, 10), brown, [0, -0.25, 0.346], [Math.PI / 2, 0, 0]),
    ...[-0.4, -0.14, 0.14, 0.4].map((x, index) => mesh(cyl(0.09, 0.09, 0.04, 8), brown, [x, 0.2 + (index % 3 === 0 ? 0 : 0.14), 0.346], [Math.PI / 2, 0, 0])),
    mesh(bx(1.3, 0.2, 0.022), paper(0x2f5d3a), [0, -1.0, 0.315]),
  )
}
