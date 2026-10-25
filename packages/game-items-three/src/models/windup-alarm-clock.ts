import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const windupAlarmClock: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const steel = metal(0xa7a9ab)
  const bell = metal(0x7e8083)
  const quarter = Math.PI / 2
  return G(
    mesh(cyl(0.0475, 0.0475, 0.048, 18), steel, [0, 0.0575, 0], [quarter, 0, 0]),
    mesh(cyl(0.04, 0.04, 0.002, 18), plastic(0xe8e2cf), [0, 0.0575, 0.025], [quarter, 0, 0]),
    mesh(bx(0.003, 0.026, 0.0015), plastic(0x1c1c1c), [0, 0.07, 0.0255]),
    mesh(bx(0.003, 0.018, 0.0015), plastic(0x1c1c1c), [0.008, 0.0575, 0.0255], [0, 0, -quarter]),
    mesh(cyl(0.005, 0.008, 0.014, 6), steel, [-0.03, 0.007, 0]),
    mesh(cyl(0.005, 0.008, 0.014, 6), steel, [0.03, 0.007, 0]),
    mesh(cyl(0.008, 0.0215, 0.016, 10), bell, [-0.034, 0.105, 0]),
    mesh(cyl(0.008, 0.0215, 0.016, 10), bell, [0.034, 0.105, 0]),
    mesh(cyl(0.002, 0.002, 0.01, 6), steel, [-0.026, 0.118, 0]),
    mesh(cyl(0.002, 0.002, 0.01, 6), steel, [0.026, 0.118, 0]),
    mesh(bx(0.052, 0.004, 0.004), steel, [0, 0.123, 0]),
    mesh(cyl(0.003, 0.003, 0.007, 6), steel, [0, 0.0575, -0.0255], [quarter, 0, 0]),
    mesh(bx(0.022, 0.008, 0.003), M(0xa7a9ab, 'metal', { metalness: 0.55, roughness: 0.45 }), [0, 0.0575, -0.0275]),
  )
}
