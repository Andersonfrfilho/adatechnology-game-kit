import type { PartBox } from './internal'

const FLUSH = 1e-4

const sameTurn = (a: PartBox, b: PartBox): boolean => {
  if (!a.rotation && !b.rotation) return true
  if (!a.rotation || !b.rotation) return false
  return a.rotation.every((v, i) => Math.abs(v - b.rotation![i]!) < FLUSH)
}

/** The axis along which `b` continues `a` (same size and place on the other two, touching on this one), or -1. */
const flushAxis = (a: PartBox, b: PartBox): number => {
  if (!sameTurn(a, b)) return -1
  let along = -1
  for (let axis = 0; axis < 3; axis++) {
    const same = Math.abs(a.half[axis]! - b.half[axis]!) < FLUSH && Math.abs(a.center[axis]! - b.center[axis]!) < FLUSH
    if (same) continue
    if (along >= 0) return -1
    along = axis
  }
  if (along < 0) return -1
  return Math.abs(Math.abs(a.center[along]! - b.center[along]!) - a.half[along]! - b.half[along]!) < FLUSH ? along : -1
}

/**
 * Boxes that continue one another into one box (the planks of a table top, courses of a wall): the engine's contact with the seam between two boxes of one body pushes a
 * thin plate lying across it back, and holds it on a slope it should slide down.
 */
export function mergeFlushBoxes(boxes: readonly PartBox[]): readonly PartBox[] {
  const out: PartBox[] = [...boxes]
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!
      const axis = flushAxis(a, out[j]!)
      if (axis < 0) continue
      const b = out[j]!
      const low = Math.min(a.center[axis]! - a.half[axis]!, b.center[axis]! - b.half[axis]!)
      const high = Math.max(a.center[axis]! + a.half[axis]!, b.center[axis]! + b.half[axis]!)
      const center: [number, number, number] = [a.center[0], a.center[1], a.center[2]]
      const half: [number, number, number] = [a.half[0], a.half[1], a.half[2]]
      center[axis] = (low + high) / 2
      half[axis] = (high - low) / 2
      out[i] = { center, half, ...(a.rotation ? { rotation: a.rotation } : {}) }
      out.splice(j, 1)
      j = i
    }
  }
  return out
}
