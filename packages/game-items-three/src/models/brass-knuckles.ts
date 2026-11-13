import type { ItemModelBuilder } from './registry'

const RINGS = [-0.455, -0.155, 0.155, 0.455]

/**
 * Authored in the kit from a free photo of real brass knuckles (Wikimedia Commons, "Brass knuckles-P5120192-white.jpg"): four finger rings in a row, the outer two a little smaller,
 * joined by the bar the palm closes on. It draws in decimetres, lying flat with the ring row along +x, the bar on the -z side and the striking edge of the rings on +z;
 * `data/models.json` gives the scale to metres of the item `brass_knuckles`. The weapon `brass_knuckles` of game-weapons is drawn with this same model.
 */
export const brassKnuckles: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, metal }) => {
  const R = Math.PI / 2
  const brass = metal(0xb8913a)
  const ring = (radius: number): ReturnType<typeof lathe> => lathe([[radius - 0.05, 0], [radius + 0.05, 0], [radius + 0.05, 0.1], [radius - 0.05, 0.1]], 10)
  return G(
    ...RINGS.map((x, index) => mesh(ring(index === 0 || index === 3 ? 0.118 : 0.135), brass, [x, 0, 0.1])),
    mesh(bx(1.3, 0.1, 0.07), brass, [0, 0.05, 0.1]),
    mesh(cyl(0.068, 0.068, 1.16, 8), brass, [0, 0.07, -0.2], [0, 0, R]),
    // the plate behind the bar is 2 mm thinner on each face, so its top and bottom never share a plane with the bar's
    mesh(bx(1.1, 0.05, 0.3), brass, [0, 0.05, -0.05]),
  )
}
