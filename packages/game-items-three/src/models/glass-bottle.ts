import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `glass_bottle`.
 */
export const glassBottle: ItemModelBuilder = ({ mesh, lathe, cyl, G, glass, paper, metal }) => {
  const body = lathe([[0, -1.3], [0.3, -1.3], [0.372, -1.2], [0.372, 0.1], [0.33, 0.45], [0.15, 0.8], [0.12, 1.1], [0.13, 1.25]], 12)
  return G(
    mesh(body, glass(0x2f6b3f, 0.8)),
    mesh(cyl(0.375, 0.375, 0.8, 12), paper(0xe3d9b8), [0, -0.5, 0]),
    mesh(cyl(0.15, 0.15, 0.1, 8), glass(0x2f6b3f, 0.85), [0, 1.2, 0]),
    mesh(cyl(0.145, 0.145, 0.06, 12), metal(0xb8913a), [0, 1.27, 0]),
  )
}
