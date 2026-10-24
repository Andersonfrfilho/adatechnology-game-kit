import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `glass_bottle`.
 */
export const glassBottle: ItemModelBuilder = ({ mesh, cyl, G, glass, metal }) => {
  const bottle = mesh(cyl(0.375, 0.375, 2.6, 16), glass(0x355e3b, 0.8))
  const cap = mesh(cyl(0.16, 0.16, 0.05, 14), metal(0xb89040), [0, 1.275, 0])
  return G(bottle, cap)
}
