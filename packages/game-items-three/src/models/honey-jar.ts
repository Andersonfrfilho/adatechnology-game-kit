import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `honey_jar`.
 */
export const honeyJar: ItemModelBuilder = ({ mesh, cyl, G, glass, metal, paper }) => {
  const jar = mesh(cyl(0.4, 0.4, 1.0, 16), glass(0xd49b24, 0.8))
  const lid = mesh(cyl(0.402, 0.402, 0.15, 16), metal(0xd4af37), [0, 0.425, 0])
  const label = mesh(cyl(0.404, 0.404, 0.5, 16), paper(0xf5e8c0))
  return G(jar, lid, label)
}
