import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `inverter_welder`.
 */
export const inverterWelder: ItemModelBuilder = ({ mesh, bx, cyl, G, M, metal, plastic }) => {
  const front = [Math.PI / 2, 0, 0] as const
  const dark = plastic(0x1f2022)
  return G(
    mesh(bx(30, 19, 12.8), metal(0xc2561c), [0, -1.5, 0]),
    mesh(bx(27, 15, 0.15), dark, [0, -1.5, 6.375]),
    mesh(bx(1.8, 2, 1.8), dark, [-8, 9, 0]),
    mesh(bx(1.8, 2, 1.8), dark, [8, 9, 0]),
    mesh(bx(18, 1, 1.8), dark, [0, 10.5, 0]),
    mesh(bx(6, 2.6, 0.12), M(0x2e5d3a, 'glass', { emissive: 0x1a6b3a, emissiveIntensity: 0.5 }), [-7, 3.5, 6.44]),
    mesh(cyl(1.4, 1.4, 1.2, 8), metal(0xb8bcc1), [-8, -2.5, 5.9], front),
    mesh(cyl(1.4, 1.4, 1.2, 8), metal(0xb8bcc1), [-3, -2.5, 5.9], front),
    mesh(cyl(1.2, 1.2, 1.2, 8), plastic(0xb5321f), [8.5, -7, 5.9], front),
    mesh(cyl(1.2, 1.2, 1.2, 8), plastic(0x15161a), [11.5, -7, 5.9], front),
  )
}
