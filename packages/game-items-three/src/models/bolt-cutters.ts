import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bolt_cutters`.
 */
export const boltCutters: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0x4a4e53)
  const grip = plastic(0xb82a1f)
  const alongX = [0, 0, Math.PI / 2] as const
  return G(
    mesh(cyl(1.2, 1.2, 36, 8), steel, [-12, 0, 3], alongX),
    mesh(cyl(1.2, 1.2, 36, 8), steel, [-12, 0, -3], alongX),
    mesh(cyl(1.5, 1.5, 14, 8), grip, [-23, 0, 3], alongX),
    mesh(cyl(1.5, 1.5, 14, 8), grip, [-23, 0, -3], alongX),
    mesh(bx(8, 3, 8), steel, [8, 0, 0]),
    mesh(bx(4, 6, 15), steel, [14, 0, 0]),
    mesh(cyl(1.5, 1.5, 6, 8), metal(0x8d9196), [14, 0, 0]),
    mesh(bx(14, 5.5, 3), metal(0x6f7378), [23, 0, 6]),
    mesh(bx(14, 5.5, 3), metal(0x6f7378), [23, 0, -6]),
  )
}
