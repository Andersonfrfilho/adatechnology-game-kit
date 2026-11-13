import type { Opening, Rect, StructurePart } from '../types'

const MIN_OVERLAP = 0.02

const isAlongU = (part: StructurePart): boolean => part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]
const overlapOf = (a: Rect, b: Rect): Rect | undefined => {
  const box: Rect = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]
  return box[2] - box[0] > MIN_OVERLAP && box[3] - box[1] > MIN_OVERLAP ? box : undefined
}
const contains = (box: Rect, u: number, v: number): boolean => u > box[0] && u < box[2] && v > box[1] && v < box[3]

/**
 * Where walls laid in units meet (a corner, a T, a cross), the square they share is laid by one wall per course, the walls taking turns (amarração direta,
 * NBR 16868): on even courses the wall along u runs through it, on odd courses the wall along v (on a line of walls, the first of them). Returns, for each
 * wall piece, the cuts of the courses where it yields the square, as openings of the course splitter.
 */
export function interlockCuts(pieces: readonly StructurePart[], courseOf: (piece: StructurePart) => { base: number; height: number }): Map<string, Opening[]> {
  const out = new Map<string, Opening[]>()
  for (const piece of pieces) {
    const { base, height } = courseOf(piece)
    const cuts: Opening[] = []
    for (const other of pieces) {
      if (other === piece || other.floor !== piece.floor || Math.min(piece.y1, other.y1) - Math.max(piece.y0, other.y0) <= MIN_OVERLAP) continue
      const square = overlapOf(piece.aabb, other.aabb)
      if (!square) continue
      const [cu, cv] = [(square[0] + square[2]) / 2, (square[1] + square[3]) / 2]
      const sharing = pieces.filter((p) => p.floor === piece.floor && contains(p.aabb, cu, cv)).sort((a, b) => (a.id < b.id ? -1 : 1))
      const byU = sharing.find(isAlongU)
      const byV = sharing.find((p) => !isAlongU(p))
      const [from, to] = isAlongU(piece) ? [square[0], square[2]] : [square[1], square[3]]
      const first = Math.ceil((Math.max(piece.y0, other.y0) - base) / height - 1e-6)
      for (let row = Math.max(0, first - 1); base + row * height < Math.min(piece.y1, other.y1) - MIN_OVERLAP; row++) {
        const owner = row % 2 === 0 ? (byU ?? byV) : (byV ?? byU)
        if (owner === piece) continue
        const y0 = base + row * height
        if (cuts.some((c) => c.y0 === y0 && c.from === from && c.to === to)) continue
        cuts.push({ id: `${piece.id}_interlock`, kind: 'window', wall: piece.id, from, to, y0: y0 + MIN_OVERLAP / 2, y1: y0 + height - MIN_OVERLAP / 2 })
      }
    }
    if (cuts.length) out.set(piece.id, cuts)
  }
  return out
}
