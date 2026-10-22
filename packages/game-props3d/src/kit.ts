import { DEFS } from './catalog'
import { hex, rng, seedOf } from './colors'
import type { EmitFn, Kit, PropItem, PropsApi } from './types'

/** Shortcuts that fix `M` and the api, so builders read as a list of primitives. */
export function makeKit(M: PropItem, api: PropsApi, emit: EmitFn): Kit {
  const role = (name: string): number | null => {
    const v = M.palette && M.palette[name]
    return v != null ? hex(v) : null
  }
  const K: Kit = {
    M,
    api,
    rnd: rng(seedOf(M)),
    box: (material, x, y, z, w, h, d, color, ry, rx, rz) => api.box(M, material, x, y, z, w, h, d, hex(color), ry || 0, rx || 0, rz || 0),
    cyl: (material, x, y, z, r, h, color, rx, rz, shape) => api.cylinder(M, material, x, y, z, r, h, hex(color), rx || 0, rz || 0, shape),
    leaf: (x, y, z, w, h, color, ry, rx) => api.leaf(M, x, y, z, w, h, hex(color), ry || 0, rx || 0),
    plane: (material, x, y, z, w, h, color, ry, rx, rz, uv) => api.plane(M, material, x, y, z, w, h, hex(color), ry || 0, rx || 0, rz || 0, uv),
    light: (x, y, z, color, range, kind) => {
      if (api.light) api.light(M, x, y, z, hex(color), range, kind)
      else emit('light', { M, x, y, z, color: hex(color), range, kind })
    },
    // colours: role in the house palette (M.palette) or the default; main = M.color
    color: (name, fallback) => role(name) ?? hex(fallback),
    main: (fallback) => (M.color != null ? hex(M.color) : hex(fallback)),
    fabric: (fallback) => (M.color != null ? hex(M.color) : (role('fabric_main') ?? hex(fallback))),
    accent: (fallback) => role('fabric_accent') ?? hex(fallback),
    wood: (fallback) => role('wood') ?? hex(fallback),
    metal: (fallback) => role('metal') ?? hex(fallback),
    dim: (id) => {
      const t = DEFS[id]
      return { w: M.w || t.w, d: M.d || t.d, h: M.h || t.h }
    },
    ceiling: () => M.ceiling || 2.9,
    // long tilted box: starts at (x, y, z) and follows u = (0, sin a, -cos a) for L meters
    ramp(material, x, y, z, w, t, L, color, alpha) {
      const cy = y + (Math.sin(alpha) * L) / 2
      const cz = z - (Math.cos(alpha) * L) / 2
      K.box(material, x, cy - t / 2, cz, w, t, L, color, 0, alpha + Math.PI, 0)
    },
  }
  return K
}
