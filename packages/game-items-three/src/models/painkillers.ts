import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `painkillers`.
 */
export const painkillers: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, metal, glass }) => {
  const card = mesh(bx(0.6, 0.03, 0.4), metal(0xd0d0d0), [0, -0.085, 0])
  const strip = mesh(bx(0.12, 0.032, 0.4), paper(0xcc2222), [0.24, -0.085, 0])
  const blisterShell = glass(0xeef3f5, 0.7)
  const bumps = [-0.16, 0, 0.16].flatMap((x) => [-0.1, 0.1].map((z) => mesh(cyl(0.06, 0.07, 0.18, 8), blisterShell, [x - 0.06, 0.01, z])))
  return G(card, strip, ...bumps)
}
