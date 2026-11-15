import type { ItemModelBuilder } from './registry'

const SORI = 0.18
const TIP = 9.8
const ROOT = 3.0
const SAMPLES = 10

// the spine bows by `SORI` at the middle of the blade, which narrows from 31 mm at the root to the point
const bow = (t: number): number => SORI * 4 * t * (1 - t)
const halfWidth = (t: number): number => 0.155 - 0.06 * t

/**
 * Authored in the kit from a free photo of a real katana (Wikimedia Commons, "Antique Japanese (samurai) katana met museum.jpg"): a 70 cm single-edged curved blade, a round iron tsuba,
 * a brass habaki and a long oval handle wrapped in cord with its pommel cap, 98 cm in all. It draws in decimetres, lying flat with the blade along +x and the bow in the plane of the floor;
 * `data/models.json` gives the scale to metres of the item `katana`. The weapon `katana` of game-weapons is drawn with this same model.
 */
export const katana: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, metal, cloth }) => {
  const R = Math.PI / 2
  const axis = 0.135
  const edge: Array<[number, number]> = []
  const spine: Array<[number, number]> = []
  for (let index = 0; index <= SAMPLES; index++) {
    const t = index / SAMPLES
    const x = ROOT + t * (TIP - ROOT - 0.25)
    edge.push([x, bow(t) - halfWidth(t)])
    spine.push([x, bow(t) + halfWidth(t)])
  }
  const blade = extrude([...edge, [TIP, bow(1) + 0.04], ...spine.reverse()], 0.055, 0.002)
  const oval: [number, number, number] = [1, 1, 1.18]
  const bands = Array.from({ length: 8 }, (_, index) => mesh(cyl(0.142, 0.142, 0.05, 8), cloth(0xb9b2a0), [0.4 + index * 0.28, axis, 0], [0, 0, R], oval))
  return G(
    mesh(cyl(0.135, 0.135, 2.5, 8), cloth(0x1c3340), [1.45, axis, 0], [0, 0, R], oval),
    ...bands,
    mesh(cyl(0.155, 0.155, 0.16, 8), metal(0xb8913a), [0.08, axis, 0], [0, 0, R], oval),
    mesh(cyl(0.4, 0.4, 0.07, 18), metal(0x1d1f22), [2.735, axis, 0], [0, 0, R]),
    mesh(bx(0.22, 0.12, 0.3), metal(0xb8913a), [2.9, axis, 0]),
    mesh(blade, metal(0xc9ced2), [0, axis + 0.0275, 0], [R, 0, 0]),
  )
}
