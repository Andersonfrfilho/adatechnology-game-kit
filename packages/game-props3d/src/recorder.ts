import type { Primitive, PropsApi } from './types'

/**
 * An api that records every primitive instead of drawing it. Handy for tests, previews and for measuring a prop.
 *
 * ```ts
 * const { api, primitives } = createRecorder()
 * props.builders.sofa_l(item, api)
 * console.log(primitives.length)
 * ```
 * Pass `{ light: false }` to leave `api.light` undefined, so builders fall back to `emit('light', ...)`.
 */
export function createRecorder(options: { light?: boolean } = {}): { api: PropsApi; primitives: Primitive[] } {
  const primitives: Primitive[] = []
  const api: PropsApi = {
    box: (M, material, x, y, z, w, h, d, color, ry, rx, rz) => void primitives.push({ kind: 'box', M, material, x, y, z, w, h, d, color, ry, rx, rz }),
    cylinder: (M, material, x, y, z, r, h, color, rx, rz, shape) => void primitives.push({ kind: 'cylinder', M, material, x, y, z, r, h, color, rx, rz, shape }),
    leaf: (M, x, y, z, w, h, color, ry, rx) => void primitives.push({ kind: 'leaf', M, x, y, z, w, h, color, ry, rx }),
    plane: (M, material, x, y, z, w, h, color, ry, rx, rz, uv) => void primitives.push({ kind: 'plane', M, material, x, y, z, w, h, color, ry, rx, rz, uv }),
  }
  if (options.light !== false) {
    api.light = (M, x, y, z, color, range, lightKind) => void primitives.push({ kind: 'light', M, x, y, z, color, range, lightKind })
  }
  return { api, primitives }
}
