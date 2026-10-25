import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bricks`.
 */
export const bricks: ItemModelBuilder = ({ mesh, bx, G, M }) => {
  const clay = M(0xa5532f, 'wood', { roughness: 0.95 })
  const clayDark = M(0x974a2b, 'wood', { roughness: 0.95 })
  const mortar = M(0xb9b2a4, 'wood', { roughness: 0.95 })
  return G(
    mesh(bx(1.4, 0.9, 2.9), clay, [-0.25, -0.45, 0]),
    mesh(bx(1.4, 0.9, 2.9), clayDark, [0.25, 0.45, 0]),
    mesh(bx(0.35, 0.02, 1.4), M(0x6e3320, 'wood', { roughness: 0.95 }), [-0.7, 0.005, 0]),
    mesh(bx(0.02, 0.5, 1.2), mortar, [0.951, 0.45, 0.2]),
  )
}
