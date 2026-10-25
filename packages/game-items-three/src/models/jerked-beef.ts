import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `jerked_beef`.
 */
export const jerkedBeef: ItemModelBuilder = ({ mesh, bx, cyl, G, food, wood }) => {
  const dark = food(0x5b2e22)
  const mid = food(0x70392a)
  const fat = food(0xb98a6a)
  return G(
    mesh(bx(2.5, 0.08, 0.4), dark, [0, -0.085, -0.55]),
    mesh(bx(2.2, 0.08, 0.4), mid, [0.1, 0.08, -0.18]),
    mesh(bx(2.4, 0.08, 0.4), dark, [-0.05, -0.085, 0.2]),
    mesh(bx(2.1, 0.08, 0.4), mid, [0.15, 0.085, 0.55]),
    mesh(bx(1.1, 0.012, 0.06), fat, [0.2, 0.12, -0.18]),
    mesh(bx(0.9, 0.012, 0.06), fat, [-0.3, 0.12, 0.55]),
    mesh(cyl(0.04, 0.04, 1.5, 6), wood(0x9b7a4a), [-0.95, 0.085, 0], [Math.PI / 2, 0, 0]),
  )
}
