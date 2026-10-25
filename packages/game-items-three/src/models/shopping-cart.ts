import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const shoppingCart: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) => {
  const wire = metal(0xb4b7ba)
  const grip = plastic(0x2a2c2e)
  const group = G()
  const add = (...parts: Parameters<typeof G>) => parts.forEach((part) => group.add(part))
  add(mesh(bx(0.5, 0.012, 0.8), wire, [0, 0.38, 0]), mesh(bx(0.55, 0.03, 0.03), grip, [0, 0.965, -0.46]))
  for (const side of [-1, 1]) {
    add(mesh(bx(0.012, 0.012, 0.8), wire, [side * 0.25, 0.75, 0]), mesh(bx(0.012, 0.012, 0.8), wire, [side * 0.25, 0.56, 0]))
    add(mesh(bx(0.012, 0.012, 0.95), wire, [side * 0.22, 0.14, 0]), mesh(bx(0.02, 0.62, 0.02), wire, [side * 0.26, 0.67, -0.46]))
    for (const z of [-0.4, -0.13, 0.13, 0.4]) add(mesh(bx(0.012, 0.37, 0.012), wire, [side * 0.25, 0.565, z]))
    add(mesh(bx(0.012, 0.25, 0.012), wire, [side * 0.22, 0.26, -0.3]), mesh(bx(0.012, 0.25, 0.012), wire, [side * 0.22, 0.26, 0.3]))
    for (const z of [-0.3, 0.4]) add(mesh(cyl(0.06, 0.06, 0.03, 8), grip, [side * 0.25, 0.06, z], [0, 0, Math.PI / 2]))
  }
  add(mesh(bx(0.5, 0.012, 0.012), wire, [0, 0.75, 0.4]), mesh(bx(0.5, 0.012, 0.012), wire, [0, 0.56, 0.4]))
  add(mesh(bx(0.5, 0.012, 0.012), wire, [0, 0.75, -0.4]), mesh(bx(0.5, 0.012, 0.012), wire, [0, 0.56, -0.4]))
  for (const x of [-0.125, 0.125]) add(mesh(bx(0.012, 0.37, 0.012), wire, [x, 0.565, 0.4]), mesh(bx(0.012, 0.012, 0.8), wire, [x, 0.38, 0]))
  add(mesh(bx(0.44, 0.012, 0.012), wire, [0, 0.14, -0.3]), mesh(bx(0.44, 0.012, 0.012), wire, [0, 0.14, 0.3]))
  return group
}
