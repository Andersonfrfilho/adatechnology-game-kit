import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `chocolate_bar`.
 */
export const chocolateBar: ItemModelBuilder = ({ mesh, bx, G, paper, food }) => {
  const chocolate = food(0x4a2a1a)
  const pieces = [-0.5, 0, 0.5].flatMap((x) => [0.18, -0.07].map((y) => mesh(bx(0.46, 0.22, 0.04), chocolate, [x, y, 0.03])))
  return G(
    mesh(bx(1.5, 0.7, 0.06), paper(0xb9bcc0), [0, 0, -0.02]),
    ...pieces,
    mesh(bx(1.5, 0.2, 0.1), paper(0x9b2f2f), [0, -0.25, 0]),
    mesh(bx(0.9, 0.05, 0.102), paper(0xe8d9a8), [0, -0.25, 0]),
  )
}
