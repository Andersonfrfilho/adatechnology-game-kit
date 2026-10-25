import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `camp_stove`.
 */
export const campStove: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const base = mesh(bx(1.8, 0.92, 1.1), metal(0x336699), [0, -0.04, 0])
  const burner = mesh(cyl(0.35, 0.35, 0.08, 14), metal(0xaaaaaa), [0, 0.46, 0])
  return G(base, burner)
}
