import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `epoxy_glue`.
 */
export const epoxyGlue: ItemModelBuilder = ({ T, mesh, cyl, bx, G, glass, plastic }) => {
  const R = Math.PI / 2
  const barrel = glass(0xdfe8ec, 0.5)
  const orange = plastic(0xe07a1f)
  const blue = plastic(0x2f6bb5)
  return G(
    mesh(cyl(0.15, 0.15, 0.6, 8), barrel, [0, 0.15, 0], [0, 0, R]),
    mesh(cyl(0.15, 0.15, 0.6, 8), barrel, [0, -0.15, 0], [0, 0, R]),
    mesh(cyl(0.11, 0.11, 0.5, 8), plastic(0xf2d27a), [0, 0.15, 0], [0, 0, R]),
    mesh(cyl(0.11, 0.11, 0.5, 8), plastic(0xb9c6d4), [0, -0.15, 0], [0, 0, R]),
    mesh(cyl(0.05, 0.05, 0.16, 8), orange, [-0.38, 0.15, 0], [0, 0, R]),
    mesh(cyl(0.05, 0.05, 0.16, 8), blue, [-0.38, -0.15, 0], [0, 0, R]),
    mesh(bx(0.04, 0.58, 0.28), plastic(0xe8e8e8), [-0.48, 0, 0]),
    mesh(bx(0.03, 0.58, 0.3), plastic(0xe8e8e8), [-0.285, 0, 0]),
    mesh(new T.ConeGeometry(0.15, 0.2, 8), plastic(0xc9ccd0), [0.4, 0, 0], [0, 0, -R]),
  )
}
