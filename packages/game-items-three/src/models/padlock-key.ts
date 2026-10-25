import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const padlockKey: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const body = metal(0x8a8d90)
  const shackle = metal(0xc0c3c6)
  const slot = metal(0x1f2022)
  const parts = [
    mesh(bx(0.05, 0.05, 0.0225), body, [0, 0.025, 0]),
    mesh(bx(0.05, 0.006, 0.0225), body, [0, 0.003, 0]),
    mesh(bx(0.006, 0.014, 0.025), slot, [0, 0.022, 0]),
    mesh(bx(0.006, 0.026, 0.008), shackle, [-0.014, 0.063, 0]),
    mesh(bx(0.006, 0.026, 0.008), shackle, [0.014, 0.063, 0]),
  ]
  const segments = 6
  for (let index = 0; index < segments; index++) {
    const angle = (Math.PI * (index + 0.5)) / segments
    parts.push(mesh(bx(0.0105, 0.006, 0.008), shackle, [0.014 * Math.cos(angle), 0.063 + 0.014 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  return G(...parts)
}
