import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `recurve_bow`.
 */
export const recurveBow: ItemModelBuilder = ({ mesh, bx, G, wood, cloth }) => {
  const bar = (x1: number, y1: number, x2: number, y2: number, thick: number, depth: number) =>
    [bx(Math.hypot(x2 - x1, y2 - y1), thick, depth), [(x1 + x2) / 2, (y1 + y2) / 2, 0], [0, 0, Math.atan2(y2 - y1, x2 - x1)]] as const
  const limbMaterial = wood(0x6b4a2c)
  const stringMaterial = cloth(0xe3ddc8)
  const limbs = [-1, 1].flatMap((side) => [
    bar(side * 0.4, 0.6, side * 2.4, 0.35, 0.3, 0.36),
    bar(side * 2.4, 0.35, side * 4.4, -0.2, 0.26, 0.34),
    bar(side * 4.4, -0.2, side * 6.0, -0.8, 0.22, 0.32),
    bar(side * 6.0, -0.8, side * 6.45, -0.6, 0.2, 0.3),
  ])
  const strings = [bar(-6.4, -0.6, 0, -0.95, 0.06, 0.06), bar(0, -0.95, 6.4, -0.6, 0.06, 0.06)]
  return G(
    mesh(bx(0.9, 1.3, 0.46), wood(0x4a301b), [0, 0.35, 0]),
    mesh(bx(0.92, 0.5, 0.5), cloth(0x2b2b2b), [0, 0.1, 0]),
    ...limbs.map(([geometry, position, rotation]) => mesh(geometry, limbMaterial, [...position], [...rotation])),
    ...strings.map(([geometry, position, rotation]) => mesh(geometry, stringMaterial, [...position], [...rotation])),
  )
}
