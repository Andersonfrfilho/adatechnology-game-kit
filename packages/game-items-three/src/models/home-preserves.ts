import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `home_preserves`.
 */
export const homePreserves: ItemModelBuilder = ({ mesh, cyl, G, glass, metal, cloth }) => {
  const jar = mesh(cyl(0.45, 0.45, 1.3, 16), glass(0xb86020, 0.8))
  const lid = mesh(cyl(0.452, 0.452, 0.12, 16), metal(0xd0a030), [0, 0.58, 0])
  const clothTop = mesh(cyl(0.454, 0.454, 0.04, 16), cloth(0xeeeeee), [0, 0.63, 0])
  return G(jar, lid, clothTop)
}
