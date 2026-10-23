import type { Primitive, Vec3 } from './types'
import type { HouseholdApi } from './types'

export interface RecordedPart {
  id: string
  pivot: Vec3
  ry: number
  primitives: Primitive[]
}

export interface HouseholdRecorder {
  api: HouseholdApi
  /** Primitives that belong to no part. */
  primitives: Primitive[]
  /** Primitives per part id, in the part's frame. */
  parts: Record<string, RecordedPart>
}

/**
 * An api that records every primitive instead of drawing it: static ones in `primitives`, the ones drawn inside `api.part(...)` under
 * `parts[id]`. For tests, previews and measuring.
 */
export function createRecorder(): HouseholdRecorder {
  const primitives: Primitive[] = []
  const parts: Record<string, RecordedPart> = {}
  let current: Primitive[] = primitives
  const push = (p: Primitive) => void current.push(p)
  const api: HouseholdApi = {
    box: (M, material, x, y, z, w, h, d, color, ry, rx, rz) => push({ kind: 'box', M, material, x, y, z, w, h, d, color, ry, rx, rz }),
    cylinder: (M, material, x, y, z, r, h, color, rx, rz, shape) => push({ kind: 'cylinder', M, material, x, y, z, r, h, color, rx, rz, shape }),
    leaf: (M, x, y, z, w, h, color, ry, rx) => push({ kind: 'leaf', M, x, y, z, w, h, color, ry, rx }),
    plane: (M, material, x, y, z, w, h, color, ry, rx, rz, uv) => push({ kind: 'plane', M, material, x, y, z, w, h, color, ry, rx, rz, uv }),
    light: (M, x, y, z, color, range, lightKind) => push({ kind: 'light', M, x, y, z, color, range, lightKind }),
    part(id, pivot, ry, draw) {
      const rec: RecordedPart = { id, pivot, ry, primitives: [] }
      parts[id] = rec
      const prev = current
      current = rec.primitives
      try {
        draw()
      } finally {
        current = prev
      }
    },
  }
  return { api, primitives, parts }
}
