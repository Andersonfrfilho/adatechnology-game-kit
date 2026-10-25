import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `canned_sardines`.
 */
export const cannedSardines: ItemModelBuilder = ({ T, mesh, bx, cyl, G, metal, paper, food }) => {
  const tin = metal(0xb8bcc2)
  return G(
    mesh(bx(1.12, 0.22, 0.65), tin, [0, -0.02, 0]),
    mesh(bx(1.0, 0.04, 0.54), metal(0x9a9ea5), [0, 0.11, 0]),
    mesh(bx(0.7, 0.01, 0.34), paper(0x2f6aa8), [0, 0.125, 0]),
    mesh(new T.SphereGeometry(0.5, 8, 4), food(0xcfd6da), [-0.05, 0.125, 0], [0, 0.2, 0], [0.45, 0.01, 0.12]),
    mesh(cyl(0.08, 0.08, 0.01, 8), metal(0x8d9096), [0.42, 0.125, 0.0]),
    mesh(bx(0.5, 0.02, 0.65), metal(0x8d9096), [0, -0.12, 0]),
  )
}
