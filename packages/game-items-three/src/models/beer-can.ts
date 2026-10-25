import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `beer_can`.
 */
export const beerCan: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, paper }) => {
  const shell = metal(0x235789)
  const foot = mesh(cyl(0.33, 0.29, 0.12, 16), shell, [0, -0.54, 0])
  const body = mesh(cyl(0.33, 0.33, 0.88, 16), shell, [0, -0.04, 0])
  const label = mesh(cyl(0.332, 0.332, 0.56, 16), paper(0xd4af37), [0, -0.02, 0])
  const stripe = mesh(cyl(0.332, 0.332, 0.06, 16), paper(0xf2efe4), [0, 0.3, 0])
  const neck = mesh(cyl(0.27, 0.33, 0.12, 16), shell, [0, 0.46, 0])
  const lid = mesh(cyl(0.285, 0.285, 0.08, 16), metal(0xb0b8bf), [0, 0.552, 0])
  const tab = mesh(bx(0.1, 0.008, 0.18), metal(0x8d949a), [0, 0.596, 0.04])
  return G(foot, body, label, stripe, neck, lid, tab)
}
