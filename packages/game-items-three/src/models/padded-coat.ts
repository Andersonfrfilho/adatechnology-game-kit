import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const paddedCoat: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth, metal }) => {
  const shell = cloth(0x3a4a3e)
  const rib = cloth(0x2b362f)
  const zip = metal(0x9a9da0)
  const parts = [
    mesh(bx(0.3, 0.12, 0.35), shell, [0, 0.06, 0]),
    mesh(bx(0.075, 0.1, 0.24), shell, [-0.1875, 0.05, -0.055]),
    mesh(bx(0.075, 0.1, 0.24), shell, [0.1875, 0.05, -0.055]),
    mesh(bx(0.071, 0.102, 0.03), rib, [-0.1875, 0.053, 0.075]),
    mesh(bx(0.071, 0.102, 0.03), rib, [0.1875, 0.053, 0.075]),
    mesh(cyl(0.07, 0.07, 0.038, 12), shell, [0, 0.129, -0.1]),
    mesh(bx(0.012, 0.122, 0.336), zip, [0, 0.063, 0.003]),
  ]
  for (const z of [-0.12, -0.04, 0.04, 0.12]) parts.push(mesh(bx(0.29, 0.03, 0.014), rib, [0, 0.135, z]))
  return G(...parts)
}
