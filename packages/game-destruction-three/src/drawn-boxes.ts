/** Vertices of one box as the house draws it (a face of four, six faces). */
const BOX_VERTICES = 24
/** Most boxes a part may be drawn with to be held box by box. */
const MAX_BOXES = 16
/** How far (in the mesh's own units) a vertex may be from a corner of its box. */
const CORNER = 1e-4
/** A part drawn as separate boxes holds the air between them when held as one box: under this share of the box around them they are held one by one. */
const HOLLOW = 0.5

type DrawnBox = { readonly low: readonly number[]; readonly high: readonly number[] }

/**
 * The boxes a part is drawn with when it is several of them and they leave most of the box around them empty (a door frame: two posts and a lintel, 24 vertices each, one range),
 * from its vertices in the mesh's own space (x y z). Null when it is not drawn that way: every group of 24 vertices must be the eight corners of an axis box, three vertices on
 * each, and the boxes must fill under `HOLLOW` of the box around them all.
 */
export const hollowBoxesOf = (points: ArrayLike<number>): DrawnBox[] | null => {
  const count = points.length / 3
  if (count % BOX_VERTICES !== 0 || count / BOX_VERTICES < 2 || count / BOX_VERTICES > MAX_BOXES) return null
  const boxes: DrawnBox[] = []
  const all = { low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity] }
  for (let first = 0; first < count; first += BOX_VERTICES) {
    const low = [Infinity, Infinity, Infinity]
    const high = [-Infinity, -Infinity, -Infinity]
    for (let v = first; v < first + BOX_VERTICES; v++) {
      for (let k = 0; k < 3; k++) {
        low[k] = Math.min(low[k] as number, points[v * 3 + k] as number)
        high[k] = Math.max(high[k] as number, points[v * 3 + k] as number)
      }
    }
    const corners = new Set<number>()
    for (let v = first; v < first + BOX_VERTICES; v++) {
      let corner = 0
      for (let k = 0; k < 3; k++) {
        const x = points[v * 3 + k] as number
        if (Math.abs(x - (high[k] as number)) <= CORNER) corner |= 1 << k
        else if (Math.abs(x - (low[k] as number)) > CORNER) return null
      }
      corners.add(corner)
    }
    if (corners.size !== 8) return null
    for (let k = 0; k < 3; k++) {
      all.low[k] = Math.min(all.low[k] as number, low[k] as number)
      all.high[k] = Math.max(all.high[k] as number, high[k] as number)
    }
    boxes.push({ low, high })
  }
  const volume = (low: readonly number[], high: readonly number[]): number => (high[0]! - low[0]!) * (high[1]! - low[1]!) * (high[2]! - low[2]!)
  const filled = boxes.reduce((sum, box) => sum + volume(box.low, box.high), 0)
  return filled < HOLLOW * volume(all.low, all.high) ? boxes : null
}
