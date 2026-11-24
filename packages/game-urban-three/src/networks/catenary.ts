/** A point in the world, metres. */
export type Vec3 = readonly [number, number, number]

/** Segments of a drawn span: the catenary sampled in 8 stretches (design-redes §7, R13). */
export const SPAN_SEGMENTS = 8
/** Sides of a conductor's tube. */
export const TUBE_SIDES = 4

/**
 * The points of a conductor hung from `from` to `to` with `sag` metres at mid span: the parabola the network's clearance rules read
 * (`y − 4·sag·t·(1 − t)`), sampled at `segments + 1` points.
 */
export function catenaryPoints({ from, to, sag, segments = SPAN_SEGMENTS }: { readonly from: Vec3; readonly to: Vec3; readonly sag: number; readonly segments?: number }): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, index): Vec3 => {
    const t = index / segments
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - 4 * sag * t * (1 - t), from[2] + (to[2] - from[2]) * t]
  })
}

/** A geometry being merged: positions and normals (3 per vertex) and triangle indices. */
export type MeshData = { readonly positions: number[]; readonly normals: number[]; readonly indices: number[] }

export const emptyMesh = (): MeshData => ({ positions: [], normals: [], indices: [] })

const normalize = (v: readonly [number, number, number]): [number, number, number] => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}
const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]

/** The two axes across a conductor going along `tangent`: one level (never coplanar with a horizontal face), one up; a vertical run takes x. */
function sectionAxes(tangent: readonly number[]): [readonly number[], readonly number[]] {
  const level = cross(tangent, [0, 1, 0])
  const side = Math.hypot(...level) < 1e-6 ? [1, 0, 0] : normalize(level)
  return [side, normalize(cross(side, tangent))]
}

/**
 * Appends a tube of `TUBE_SIDES` sides along `points` to `mesh` and returns the range of indices it took (`[start, count]`). The section is turned
 * 45° so no side of the tube lies flat (a wire is never coplanar with anything, CLAUDE.md §13).
 */
export function appendTube({ mesh, points, radius }: { readonly mesh: MeshData; readonly points: readonly Vec3[]; readonly radius: number }): readonly [number, number] {
  const base = mesh.positions.length / 3
  const start = mesh.indices.length
  points.forEach((point, index) => {
    const previous = points[Math.max(index - 1, 0)]!
    const next = points[Math.min(index + 1, points.length - 1)]!
    const [side, up] = sectionAxes(normalize([next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]]))
    for (let k = 0; k < TUBE_SIDES; k++) {
      const angle = ((k + 0.5) / TUBE_SIDES) * 2 * Math.PI
      const normal = [0, 1, 2].map((axis) => Math.cos(angle) * side[axis]! + Math.sin(angle) * up[axis]!)
      mesh.normals.push(normal[0]!, normal[1]!, normal[2]!)
      mesh.positions.push(point[0] + normal[0]! * radius, point[1] + normal[1]! * radius, point[2] + normal[2]! * radius)
    }
  })
  for (let ring = 0; ring + 1 < points.length; ring++) {
    for (let k = 0; k < TUBE_SIDES; k++) {
      const a = base + ring * TUBE_SIDES + k
      const b = base + ring * TUBE_SIDES + ((k + 1) % TUBE_SIDES)
      const c = a + TUBE_SIDES
      const d = b + TUBE_SIDES
      mesh.indices.push(a, c, b, b, c, d)
    }
  }
  return [start, mesh.indices.length - start]
}

/** A polyline as line segments (the far level of detail): its points as vertices and a pair of indices per stretch. */
export type LineData = { readonly positions: number[]; readonly colors: number[]; readonly indices: number[] }

export const emptyLines = (): LineData => ({ positions: [], colors: [], indices: [] })

export function appendLine({ lines, points, color }: { readonly lines: LineData; readonly points: readonly Vec3[]; readonly color: readonly [number, number, number] }): readonly [number, number] {
  const base = lines.positions.length / 3
  const start = lines.indices.length
  for (const point of points) {
    lines.positions.push(point[0], point[1], point[2])
    lines.colors.push(color[0], color[1], color[2])
  }
  for (let index = 0; index + 1 < points.length; index++) lines.indices.push(base + index, base + index + 1)
  return [start, lines.indices.length - start]
}
