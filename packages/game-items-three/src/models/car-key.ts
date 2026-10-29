import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const carKey: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const fob = plastic(0x1f2124)
  const button = plastic(0x8a8d90)
  const blade = metal(0xb5b8bb)
  const eyelet = metal(0x6f7275)
  return G(
    mesh(bx(0.038, 0.045, 0.0136), fob, [-0.011, 0.0225, 0]),
    mesh(bx(0.014, 0.008, 0.015), button, [-0.011, 0.034, 0]),
    mesh(bx(0.014, 0.008, 0.015), button, [-0.011, 0.0225, 0]),
    mesh(bx(0.014, 0.008, 0.015), button, [-0.011, 0.011, 0]),
    mesh(bx(0.006, 0.012, 0.0146), eyelet, [-0.027, 0.0385, 0]),
    mesh(bx(0.004, 0.016, 0.006), eyelet, [0.0095, 0.0225, 0]),
    mesh(bx(0.02, 0.012, 0.003), blade, [0.02, 0.0225, 0]),
    mesh(bx(0.004, 0.004, 0.003), blade, [0.016, 0.0145, 0]),
    mesh(bx(0.004, 0.004, 0.003), blade, [0.024, 0.0145, 0]),
  )
}
