import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sheet_metal`.
 * A 0.6 mm sheet framed by a 3 mm rolled edge that it butts against (no face on the edge's); the rust and the holes go through it and stand 1.2 mm proud of both
 * its faces, past the 1 mm where faces fight (the item is 3 mm thick, so 2 mm each side does not fit) (CLAUDE.md §13).
 */
export const sheetMetal: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const zinc = metal(0x9aa0a6)
  const edge = metal(0x7d838a)
  const hole = metal(0x1c1d1f)
  const corners: Array<[number, number]> = [[2.5, 1.8], [-2.5, 1.8], [2.5, -1.8], [-2.5, -1.8]]
  return G(
    mesh(bx(5.68, 0.006, 4.18), zinc, [0, 0, 0]),
    mesh(bx(6, 0.03, 0.16), edge, [0, 0, 2.17]),
    mesh(bx(6, 0.03, 0.16), edge, [0, 0, -2.17]),
    mesh(bx(0.16, 0.03, 4.18), edge, [2.92, 0, 0]),
    mesh(bx(0.16, 0.03, 4.18), edge, [-2.92, 0, 0]),
    mesh(bx(1.2, 0.03, 0.8), metal(0x7a4a2c), [-0.8, 0, -0.4]),
    ...corners.map(([x, z]) => mesh(cyl(0.12, 0.12, 0.03, 8), hole, [x, 0, z])),
  )
}
