import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const generatorKey: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const steel = metal(0x9a9da0)
  const groove = metal(0x55585b)
  const cover = plastic(0xa8322a)
  const parts = [
    mesh(bx(0.05, 0.012, 0.006), steel, [0.015, 0.016, 0]),
    mesh(bx(0.044, 0.002, 0.006), groove, [0.017, 0.016, 0]),
    mesh(bx(0.005, 0.006, 0.006), steel, [0.0, 0.0075, 0]),
    mesh(bx(0.005, 0.006, 0.006), steel, [0.009, 0.0075, 0]),
    mesh(bx(0.005, 0.006, 0.006), steel, [0.018, 0.0075, 0]),
    mesh(bx(0.005, 0.006, 0.006), steel, [0.033, 0.0075, 0]),
    mesh(bx(0.014, 0.01, 0.006), cover, [-0.008, 0.016, 0]),
  ]
  const segments = 8
  for (let index = 0; index < segments; index++) {
    const angle = (2 * Math.PI * index) / segments
    parts.push(mesh(bx(0.0092, 0.005, 0.006), cover, [-0.025 + 0.0125 * Math.cos(angle), 0.015 + 0.0125 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  return G(...parts)
}
