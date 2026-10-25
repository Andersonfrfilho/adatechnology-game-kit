import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const leatherMotorcyclePants: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const leather = cloth(0x1f1d1c)
  const pad = cloth(0x302d2b)
  const zip = metal(0x9a9da0)
  return G(
    mesh(bx(0.36, 0.08, 0.145), leather, [0.02, 0.04, -0.0775]),
    mesh(bx(0.36, 0.08, 0.145), leather, [0.02, 0.04, 0.0775]),
    mesh(bx(0.04, 0.09, 0.3), pad, [-0.18, 0.045, 0]),
    mesh(bx(0.07, 0.01, 0.1), pad, [0.0, 0.085, -0.0775]),
    mesh(bx(0.07, 0.01, 0.1), pad, [0.0, 0.085, 0.0775]),
    mesh(bx(0.012, 0.0902, 0.012), zip, [-0.18, 0.0451, 0]),
    mesh(bx(0.04, 0.0802, 0.14), pad, [0.17, 0.0401, -0.0775]),
    mesh(bx(0.04, 0.0802, 0.14), pad, [0.17, 0.0401, 0.0775]),
    mesh(bx(0.2, 0.0825, 0.004), zip, [0.07, 0.04125, -0.0035]),
  )
}
