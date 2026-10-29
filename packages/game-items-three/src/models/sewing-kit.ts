import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sewing_kit`.
 */
export const sewingKit: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, cloth, wood }) => {
  const spool = (x: number, color: number) => [mesh(cyl(0.75, 0.75, 3, 8), cloth(color), [x, 1, 0.4]), mesh(cyl(0.95, 0.95, 0.3, 8), wood(0xc9a46a), [x, 2.35, 0.4])]
  return G(
    mesh(bx(9, 2, 3), plastic(0x3a5a78), [0, -1.5, 0]),
    mesh(bx(8.4, 0.3, 2.4), cloth(0xa83a3a), [0, -0.4, 0.1]),
    mesh(bx(9, 5, 0.4), plastic(0x2f4a63), [0, 0, -1.3]),
    ...spool(-3, 0xc93a3a),
    ...spool(0, 0x3a6fc9),
    ...spool(3, 0xd8b43a),
  )
}
