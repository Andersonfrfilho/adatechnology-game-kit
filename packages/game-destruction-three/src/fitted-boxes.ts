import type * as THREE_NS from 'three'

/** Slice length (m) of a turned mesh and the most slices of one mesh. */
const SLICE_LENGTH = 0.12
const MAX_SLICES = 12
/** A mesh whose axis box is at most this many times its own volume counts as not turned. */
const SNUG_RATIO = 1.1

type Corner = { readonly x: number; readonly y: number; readonly z: number }
type Local = { readonly min: Corner; readonly max: Corner }

/**
 * Appends world axis boxes (min x, y, z, max x, y, z) around the local box of a mesh: one when it lies square, else slices along its longest side. The axis box of a board
 * lying askew is a wide square that holds mostly air, and what walks would hit that air.
 */
export function pushFittedBoxes(local: Local, matrix: THREE_NS.Matrix4, out: number[]): void {
  const e = matrix.elements
  const sizes = [0, 1, 2].map((k) => (k === 0 ? local.max.x - local.min.x : k === 1 ? local.max.y - local.min.y : local.max.z - local.min.z))
  const lengths = [0, 1, 2].map((k) => sizes[k] * Math.hypot(e[k * 4], e[k * 4 + 1], e[k * 4 + 2]))
  const longest = lengths.indexOf(Math.max(...lengths))
  const whole = worldBoxOf(local, matrix, longest, 0, 1)
  const span = (whole[3] - whole[0]) * (whole[4] - whole[1]) * (whole[5] - whole[2])
  const volume = lengths[0] * lengths[1] * lengths[2]
  const slices = span <= volume * SNUG_RATIO ? 1 : Math.min(MAX_SLICES, Math.ceil(lengths[longest] / SLICE_LENGTH))
  if (slices <= 1) {
    out.push(...whole)
    return
  }
  for (let i = 0; i < slices; i++) out.push(...worldBoxOf(local, matrix, longest, i / slices, (i + 1) / slices))
}

function worldBoxOf(local: Local, matrix: THREE_NS.Matrix4, axis: number, from: number, to: number): number[] {
  const e = matrix.elements
  const low = [local.min.x, local.min.y, local.min.z]
  const high = [local.max.x, local.max.y, local.max.z]
  const start = low[axis]
  const size = high[axis] - start
  low[axis] = start + size * from
  high[axis] = start + size * to
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const x of [low[0], high[0]]) for (const y of [low[1], high[1]]) for (const z of [low[2], high[2]]) {
    for (let k = 0; k < 3; k++) {
      const v = e[k] * x + e[k + 4] * y + e[k + 8] * z + e[k + 12]
      box[k] = Math.min(box[k], v)
      box[k + 3] = Math.max(box[k + 3], v)
    }
  }
  return box
}
