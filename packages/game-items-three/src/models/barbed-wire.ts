import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `barbed_wire`.
 */
export const barbedWire: ItemModelBuilder = ({ mesh, bx, lathe, G, metal }) => {
  const ring = (outer: number, y0: number, y1: number) => lathe([[1.25, y0], [outer, y0], [outer, y1], [1.25, y1], [1.25, y0]], 8)
  const wire = metal(0x6b6f73)
  const barb = metal(0x9a9ea3)
  return G(
    mesh(ring(1.5, -0.6, -0.2), wire),
    mesh(ring(1.46, -0.2, 0.2), metal(0x585c62)),
    mesh(ring(1.5, 0.2, 0.6), wire),
    mesh(bx(0.06, 1.2, 0.2), metal(0x3a3d40), [1.47, 0, 0]),
    mesh(bx(0.06, 1.2, 0.2), metal(0x3a3d40), [-1.47, 0, 0]),
    mesh(bx(0.08, 0.08, 0.18), barb, [1.42, 0.4, 0.5]),
    mesh(bx(0.08, 0.08, 0.18), barb, [-1.42, 0.4, -0.5]),
    mesh(bx(0.18, 0.08, 0.08), barb, [0.5, -0.4, 1.42]),
    mesh(bx(0.18, 0.08, 0.08), barb, [-0.5, -0.4, -1.42]),
  )
}
