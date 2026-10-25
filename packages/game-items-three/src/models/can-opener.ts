import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `can_opener`.
 */
export const canOpener: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0xa9adb2)
  const grip = plastic(0x2f5d8a)
  const rotateAcross = [Math.PI / 2, 0, 0] as const
  return G(
    mesh(bx(9, 1, 2.2), steel, [1.5, -1.5, 0]),
    mesh(bx(5, 1.6, 2.5), grip, [-4.5, -1.2, 0]),
    mesh(bx(8, 1, 2.2), steel, [-3, 1.5, 0]),
    mesh(bx(5, 1, 2.5), grip, [-4.5, 1.5, 0]),
    mesh(bx(3, 2.4, 1.5), steel, [5.5, 0, 0]),
    mesh(cyl(1.2, 1.2, 0.4, 8), steel, [5.5, -0.8, 0.85], rotateAcross),
    mesh(cyl(0.4, 0.4, 2.4, 8), metal(0x6b6f74), [2.6, 0, 0], rotateAcross),
  )
}
