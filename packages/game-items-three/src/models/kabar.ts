import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit from a free photo of the real knife (Wikimedia Commons, "KA-BAR.jpg"): the USMC Mk 2, 302 mm overall, a 7 in clip-point blade with its fuller, a steel crossguard,
 * eleven leather washers and a steel pommel. It draws in decimetres, lying flat with the blade along +x; `data/models.json` gives the scale to metres of the item `kabar`. The
 * weapon `kabar` of game-weapons is drawn with this same model (`game-weapons-three` lends it, no copy).
 */
export const kabar: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, metal, plastic }) => {
  const R = Math.PI / 2
  const steel = metal(0x2c2f33)
  const leather = plastic(0x7a4723)
  const gap = plastic(0x241812)
  const axis = 0.175
  const gaps = Array.from({ length: 4 }, (_, index) => mesh(cyl(0.18, 0.18, 0.035, 8), gap, [0.4 + index * 0.25, axis, 0], [0, 0, R]))
  const blade = extrude([[1.36, -0.165], [2.48, -0.165], [2.72, -0.135], [2.995, -0.06], [3.0, -0.01], [2.82, 0.08], [2.55, 0.165], [1.36, 0.165]], 0.045, 0.002)
  return G(
    mesh(cyl(0.2, 0.17, 0.16, 10), steel, [0.08, axis, 0], [0, 0, R]),
    mesh(cyl(0.175, 0.175, 1.1, 8), leather, [0.76, axis, 0], [0, 0, R]),
    ...gaps,
    mesh(bx(0.07, 0.12, 0.52), steel, [1.325, axis, 0]),
    mesh(bx(0.12, 0.12, 0.04), steel, [1.36, axis, 0.26]),
    mesh(bx(0.12, 0.12, 0.04), steel, [1.36, axis, -0.26]),
    mesh(blade, steel, [0, axis + 0.0225, 0], [R, 0, 0]),
    // the fuller stands 2 mm proud of the blade face, sunk into the blade below it, so the two never share a depth
    mesh(bx(0.95, 0.04, 0.045), metal(0x1b1d20), [1.95, axis + 0.0405, 0.07]),
  )
}
