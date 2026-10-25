import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rope`.
 */
export const rope: ItemModelBuilder = ({ mesh, lathe, bx, G, cloth }) => {
  const ring = (innerRadius: number, outerRadius: number, y0: number, y1: number, color: number) =>
    mesh(lathe([[innerRadius, y0], [outerRadius, y0], [outerRadius, y1], [innerRadius, y1], [innerRadius, y0]], 12), cloth(color))
  const tie = cloth(0x6b5a3e)
  return G(
    ring(0.42, 0.75, -0.4, -0.14, 0xb59b63),
    ring(0.46, 0.72, -0.14, 0.12, 0xa68c55),
    ring(0.42, 0.75, 0.12, 0.4, 0xb59b63),
    mesh(bx(0.2, 0.8, 0.06), tie, [0, 0, 0.72]),
    mesh(bx(0.2, 0.8, 0.06), tie, [0, 0, -0.72]),
    mesh(bx(0.06, 0.8, 0.2), tie, [0.72, 0, 0]),
    mesh(bx(0.06, 0.8, 0.2), tie, [-0.72, 0, 0]),
  )
}
