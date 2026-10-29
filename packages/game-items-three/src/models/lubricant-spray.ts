import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lubricant_spray`.
 */
export const lubricantSpray: ItemModelBuilder = ({ mesh, lathe, cyl, bx, G, metal, plastic, paper }) => {
  const body = lathe([[0, -0.85], [0.22, -0.85], [0.25, -0.8], [0.25, 0.35], [0.2, 0.55], [0.12, 0.65]], 12)
  const black = plastic(0x1b1c1d)
  return G(
    mesh(body, metal(0xb4b8bb)),
    mesh(cyl(0.252, 0.252, 0.6, 12), paper(0xd9a21f), [0, -0.2, 0]),
    mesh(cyl(0.08, 0.08, 0.12, 8), metal(0x6f7377), [0, 0.7, 0]),
    mesh(cyl(0.12, 0.12, 0.1, 12), black, [0, 0.8, 0]),
    mesh(bx(0.06, 0.05, 0.12), black, [0, 0.8, 0.14]),
    mesh(cyl(0.1, 0.1, 0.1, 12), plastic(0xd0342c), [0, 0.54, 0]),
  )
}
