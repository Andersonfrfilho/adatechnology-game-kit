import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rehydration_salts`.
 */
export const rehydrationSalts: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(0.9, 1.2, 0.1), paper(0x309060))
  const logo = mesh(bx(0.6, 0.5, 0.098), paper(0xffffff))
  return G(box, logo)
}
