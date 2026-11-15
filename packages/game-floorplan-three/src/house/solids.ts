/** An axis-aligned box: [x0, y0, z0, x1, y1, z1]. */
export type Aabb = readonly [number, number, number, number, number, number]

const EPS = 1e-6

/** What is left of `a` once `b` is taken out of it: up to six boxes, none overlapping `b` or each other. */
export function subtractBox(a: Aabb, b: Aabb): Aabb[] {
  if (b[0] >= a[3] - EPS || b[3] <= a[0] + EPS || b[1] >= a[4] - EPS || b[4] <= a[1] + EPS || b[2] >= a[5] - EPS || b[5] <= a[2] + EPS) return [a]
  const out: Aabb[] = []
  const box = [...a]
  // slice off what lies outside `b` along each axis in turn; what remains at the end is inside `b` and is dropped
  for (let axis = 0; axis < 3; axis++) {
    const lo = axis, hi = axis + 3
    if (b[lo]! > box[lo]! + EPS) { const piece = [...box]; piece[hi] = b[lo]!; out.push(piece as unknown as Aabb); box[lo] = b[lo]! }
    if (b[hi]! < box[hi]! - EPS) { const piece = [...box]; piece[lo] = b[hi]!; out.push(piece as unknown as Aabb); box[hi] = b[hi]! }
  }
  return out
}

/**
 * Boxes laid in order of precedence, each cut by those before it: what two boxes would both fill belongs to the first, so no two of them overlap and no
 * face of one lies on a face of another the same way round (the depth buffer could not tell them apart).
 */
export function exclusiveBoxes<T extends { readonly box: Aabb }>(solids: readonly T[]): Array<T & { readonly box: Aabb }> {
  const laid: Array<T & { readonly box: Aabb }> = []
  for (const solid of solids) {
    let pieces: Aabb[] = [solid.box]
    for (const before of laid) pieces = pieces.flatMap((piece) => subtractBox(piece, before.box))
    for (const box of pieces) laid.push({ ...solid, box })
  }
  return laid
}

/** What is left of `box` once every one of `taken` is out of it. */
export function outsideBoxes(box: Aabb, taken: readonly Aabb[]): Aabb[] {
  let pieces: Aabb[] = [box]
  for (const t of taken) pieces = pieces.flatMap((piece) => subtractBox(piece, t))
  return pieces
}
