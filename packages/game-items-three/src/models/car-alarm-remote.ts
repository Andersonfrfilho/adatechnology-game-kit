import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const carAlarmRemote: ItemModelBuilder = ({ mesh, bx, torus, G, plastic, metal }) => {
  const button = plastic(0x6f747a)
  return G(
    mesh(bx(0.04, 0.062, 0.01), plastic(0x1c1e21), [0, 0.031, -0.0005]),
    mesh(bx(0.014, 0.012, 0.002), button, [0, 0.048, 0.0055]),
    mesh(bx(0.014, 0.012, 0.002), button, [-0.01, 0.028, 0.0055]),
    mesh(bx(0.014, 0.012, 0.002), plastic(0xa3322a), [0.01, 0.028, 0.0055]),
    mesh(torus(0.0045, 0.0012), metal(0xb4b7ba), [0, 0.0645, 0]),
  )
}
