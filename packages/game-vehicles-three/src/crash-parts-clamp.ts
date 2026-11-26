import { convexFaces } from './hull-geometry'

/** Passes over the faces of the old hull: each pass brings a point past a face back to it, and the next may undo a little of that at a corner. */
const PASSES = 8

/**
 * The points of a rebuilt hull held to the old one while the part is touching something (design 10.5): a point may move in as far as it likes and out at most `slop` past
 * a face of the old hull, so the rebuilt hull does not push what rests on it (energy made). The points past that are brought back along the face they are past; what
 * is left of the move waits for the contact to end. Returns `next` itself when nothing was past the old hull, and the old points when the old hull is not a solid.
 */
export const holdWithin = (old: ArrayLike<number>, next: Float32Array, slop: number): Float32Array => {
  const faces = convexFaces(old)
  if (!faces) return next
  const middle = [0, 1, 2].map((k) => {
    let sum = 0
    for (let i = k; i < old.length; i += 3) sum += old[i]!
    return sum / (old.length / 3)
  })
  const planes = faces.map(([a, b, c]) => {
    const ux = old[b * 3]! - old[a * 3]!, uy = old[b * 3 + 1]! - old[a * 3 + 1]!, uz = old[b * 3 + 2]! - old[a * 3 + 2]!
    const wx = old[c * 3]! - old[a * 3]!, wy = old[c * 3 + 1]! - old[a * 3 + 1]!, wz = old[c * 3 + 2]! - old[a * 3 + 2]!
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const length = Math.hypot(nx, ny, nz) || 1
    const towardMiddle = nx * (middle[0]! - old[a * 3]!) + ny * (middle[1]! - old[a * 3 + 1]!) + nz * (middle[2]! - old[a * 3 + 2]!)
    const sign = (towardMiddle > 0 ? -1 : 1) / length
    const normal = [nx * sign, ny * sign, nz * sign] as const
    return { normal, offset: normal[0] * old[a * 3]! + normal[1] * old[a * 3 + 1]! + normal[2] * old[a * 3 + 2]! + slop }
  })
  let out: Float32Array | undefined
  for (let i = 0; i < next.length; i += 3) {
    const p = [next[i]!, next[i + 1]!, next[i + 2]!]
    let moved = false
    for (let pass = 0; pass < PASSES; pass++) {
      let clean = true
      for (const { normal, offset } of planes) {
        const past = normal[0] * p[0]! + normal[1] * p[1]! + normal[2] * p[2]! - offset
        if (past <= 0) continue
        p[0] = p[0]! - normal[0] * past
        p[1] = p[1]! - normal[1] * past
        p[2] = p[2]! - normal[2] * past
        moved = true
        clean = false
      }
      if (clean) break
    }
    if (!moved) continue
    out ??= Float32Array.from(next)
    out[i] = p[0]!
    out[i + 1] = p[1]!
    out[i + 2] = p[2]!
  }
  return out ?? next
}
