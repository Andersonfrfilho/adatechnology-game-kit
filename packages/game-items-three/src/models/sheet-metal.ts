import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sheet_metal`.
 */
export const sheetMetal: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const sheet = mesh(bx(6.0, 0.03, 4.5), metal(0x82888d))
  return G(sheet)
}
