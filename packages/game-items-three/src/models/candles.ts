import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const candles: ItemModelBuilder = ({ mesh, cyl, G, cloth, plastic }) =>
  G(
    mesh(cyl(0.03, 0.03, 0.11, 16), plastic(0xe9e2cc), [0, 0.055, 0]),
    mesh(cyl(0.023, 0.023, 0.002, 16), plastic(0xcfc7ad), [0, 0.109, 0]),
    mesh(cyl(0.0015, 0.0015, 0.011, 4), cloth(0x2a2420), [0, 0.1145, 0]),
  )
