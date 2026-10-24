import type { Vec3 } from './types'

/** A bar as two end points. */
export type Bar = [Vec3, Vec3]

const COVER = 0.03
const MAX_BARS_PER_DIRECTION = 24
const MAX_MEMBER_BARS_PER_SIDE = 6
const STEEL_DENSITY = 7850

/** Positions centred on 0 with exact `spacing`, as many as fit inside `length - 2 * cover` (at least two, at most `cap`). */
const spread = (length: number, cover: number, spacing: number, cap: number): number[] => {
  const room = Math.max(0, length - 2 * cover)
  const count = Math.min(cap, Math.max(2, Math.floor(room / spacing) + 1))
  const step = count > 1 && room / (count - 1) < spacing ? room / (count - 1) : spacing
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
}

const bar = (axis: number, along: number, fixed: Array<[number, number]>): Bar => {
  const a: Vec3 = [0, 0, 0], b: Vec3 = [0, 0, 0]
  for (const [index, value] of fixed) {
    a[index] = value
    b[index] = value
  }
  a[axis] = -along
  b[axis] = along
  return [a, b]
}

/** Long members (columns, beams): two smaller dimensions close to each other and a much longer third one. */
const isMember = (dims: Vec3): boolean => {
  const [a = 0, b = 0, c = 0] = [...dims].sort((x, y) => x - y)
  return b / a < 3 && c / b >= 3
}

/**
 * Rebar of a box in the part's own axes. Plates (walls, slabs) get a grid along each of the two large axes at mid thickness; long members get
 * bars along their length at the perimeter of the section. `thin` is the axis the part is thinnest along.
 */
export const rebarBars = (dims: Vec3, thin: number, spacing: number): Bar[] => {
  const out: Bar[] = []
  if (isMember(dims)) {
    const long = dims.indexOf(Math.max(...dims))
    const [u = 0, v = 0] = [0, 1, 2].filter((i) => i !== long)
    const us = spread(dims[u], COVER, spacing, MAX_MEMBER_BARS_PER_SIDE)
    const vs = spread(dims[v], COVER, spacing, MAX_MEMBER_BARS_PER_SIDE)
    us.forEach((x, i) => vs.forEach((y, j) => {
      if (i === 0 || j === 0 || i === us.length - 1 || j === vs.length - 1) out.push(bar(long, dims[long] / 2 - 0.02, [[u, x], [v, y]]))
    }))
    return out
  }
  const [u = 0, v = 0] = [0, 1, 2].filter((i) => i !== thin)
  for (const y of spread(dims[v], COVER, spacing, MAX_BARS_PER_DIRECTION)) out.push(bar(u, dims[u] / 2 - 0.02, [[v, y], [thin, 0]]))
  for (const x of spread(dims[u], COVER, spacing, MAX_BARS_PER_DIRECTION)) out.push(bar(v, dims[v] / 2 - 0.02, [[u, x], [thin, 0]]))
  return out
}

/** The part of each bar that lies within `radius` of `center` in the plane of axes `u` and `v` (bars that miss the disc are dropped). */
export const clipBarsToDisc = (bars: readonly Bar[], u: number, v: number, center: [number, number], radius: number): Bar[] => {
  const out: Bar[] = []
  for (const [a, b] of bars) {
    const axis = a[u] !== b[u] ? u : v
    const other = axis === u ? v : u
    const off = a[other] - center[other === u ? 0 : 1]
    if (Math.abs(off) >= radius) continue
    const half = Math.sqrt(radius * radius - off * off)
    const mid = center[axis === u ? 0 : 1]
    const lo = Math.max(Math.min(a[axis], b[axis]), mid - half), hi = Math.min(Math.max(a[axis], b[axis]), mid + half)
    if (hi - lo < 1e-6) continue
    const p: Vec3 = [a[0], a[1], a[2]], q: Vec3 = [b[0], b[1], b[2]]
    p[axis] = lo
    q[axis] = hi
    out.push([p, q])
  }
  return out
}

/** Steel mass in kg of bars of `diameter` metres. */
export const rebarMass = (bars: readonly Bar[], diameter: number, density = STEEL_DENSITY): number => {
  let length = 0
  for (const [a, b] of bars) length += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  return Math.PI * (diameter / 2) * (diameter / 2) * length * density
}
