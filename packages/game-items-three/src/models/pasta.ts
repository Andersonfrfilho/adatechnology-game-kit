import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pasta`.
 */
export const pasta: ItemModelBuilder = ({ mesh, bx, G, paper, glass, food }) => {
  const strand = food(0xe8cf86)
  return G(
    mesh(bx(1.0, 2.5, 0.38), paper(0xb23a2c)),
    mesh(bx(0.7, 1.7, 0.02), glass(0xf2f2ee, 0.35), [0, -0.1, 0.195]),
    ...[-0.24, -0.12, 0, 0.12, 0.24].map((x) => mesh(bx(0.05, 1.6, 0.03), strand, [x, -0.1, 0.18])),
    mesh(bx(1.0, 0.16, 0.4), paper(0xf1e3b8), [0, 1.0, 0]),
    mesh(bx(1.0, 0.16, 0.4), paper(0xf1e3b8), [0, -1.1, 0]),
  )
}
