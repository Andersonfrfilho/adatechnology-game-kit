import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const masterKey: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const nickel = metal(0xc7c9cc)
  const parts = [
    mesh(bx(0.057, 0.014, 0.006), nickel, [0.0165, 0.0175, 0]),
    mesh(bx(0.005, 0.02, 0.006), nickel, [-0.011, 0.0175, 0]),
  ]
  for (let tooth = 0; tooth < 6; tooth++) parts.push(mesh(bx(0.004, 0.007, 0.006), nickel, [0.0 + tooth * 0.0085, 0.0075 + (tooth % 2) * 0.002, 0]))
  const segments = 8
  for (let index = 0; index < segments; index++) {
    const angle = (2 * Math.PI * index) / segments
    parts.push(mesh(bx(0.0115, 0.006, 0.006), nickel, [-0.0275 + 0.0145 * Math.cos(angle), 0.0175 + 0.0145 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  return G(...parts)
}
