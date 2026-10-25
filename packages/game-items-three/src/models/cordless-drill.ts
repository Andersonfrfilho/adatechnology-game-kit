import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cordless_drill`.
 */
export const cordlessDrill: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const body = plastic(0x2f7a45)
  const alongX = [0, 0, Math.PI / 2] as const
  const dark = plastic(0x1f2022)
  return G(
    mesh(cyl(3.2, 3.5, 2, 12), dark, [-10, 6.5, 0], alongX),
    mesh(cyl(3.5, 3.5, 10, 12), body, [-4, 6.5, 0], alongX),
    mesh(cyl(2.8, 3.3, 3, 12), dark, [2.5, 6.5, 0], alongX),
    mesh(cyl(2.3, 2, 4, 12), metal(0x9a9ea3), [6, 6.5, 0], alongX),
    mesh(cyl(0.5, 0.5, 3, 8), metal(0x6f7378), [9.5, 6.5, 0], alongX),
    mesh(bx(4, 8, 5), dark, [-3.5, -0.5, 0]),
    mesh(bx(0.8, 2.2, 1.4), plastic(0xb5321f), [-1.1, 1, 0]),
    mesh(bx(9, 5.5, 6), body, [-5.5, -7.25, 0]),
  )
}
