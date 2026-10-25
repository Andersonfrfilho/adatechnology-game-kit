import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `canned_sardines`.
 */
export const cannedSardines: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const tin = mesh(bx(1.12, 0.26, 0.65), metal(0xc8c8c8))
  const ring = mesh(cyl(0.08, 0.08, 0.02, 10), metal(0x999999), [0.38, 0.12, 0])
  return G(tin, ring)
}
