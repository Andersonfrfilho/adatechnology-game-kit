import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `empty_can`.
 */
export const emptyCan: ItemModelBuilder = ({ mesh, lathe, cyl, bx, G, metal, paper }) => {
  const body = lathe([[0, -0.6], [0.27, -0.6], [0.3, -0.55], [0.33, -0.45], [0.33, 0.42], [0.29, 0.55], [0.285, 0.6]], 12)
  return G(
    mesh(body, metal(0xc9ccd0)),
    mesh(cyl(0.332, 0.332, 0.5, 12), paper(0xb5342a), [0, -0.05, 0]),
    mesh(cyl(0.25, 0.25, 0.01, 12), metal(0x222222), [0, 0.55, 0]),
    mesh(bx(0.14, 0.01, 0.24), metal(0x9a9ea3), [0, 0.602, 0.05]),
  )
}
