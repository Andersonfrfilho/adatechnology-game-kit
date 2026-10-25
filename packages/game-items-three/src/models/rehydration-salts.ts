import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rehydration_salts`.
 */
export const rehydrationSalts: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, metal }) => {
  const foil = metal(0xe6eef2)
  const lower = mesh(bx(0.9, 0.5, 0.1), foil, [0, -0.23, 0])
  const stripe = mesh(bx(0.9, 0.14, 0.1), paper(0x2f9fd0), [0, 0.09, 0])
  const upper = mesh(bx(0.9, 0.32, 0.1), foil, [0, 0.32, 0])
  const topCrimp = mesh(bx(0.9, 0.12, 0.05), metal(0xc9d4da), [0, 0.54, 0])
  const bottomCrimp = mesh(bx(0.9, 0.12, 0.05), metal(0xc9d4da), [0, -0.54, 0])
  const label = mesh(bx(0.6, 0.3, 0.01), paper(0xffffff), [0, -0.23, 0.0455])
  const drop = mesh(cyl(0.06, 0.06, 0.01, 8), paper(0xffffff), [0, 0.09, 0.0455], [Math.PI / 2, 0, 0])
  return G(lower, stripe, upper, topCrimp, bottomCrimp, label, drop)
}
