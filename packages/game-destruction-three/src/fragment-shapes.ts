import type * as THREE_NS from 'three'

import { createRng } from './math'

/** How many shapes of each kind there are; a fragment takes one by the hash of its id, so a burst shares a handful of buffers. */
export const FRAGMENT_SHAPE_VARIANTS = 6

/** Cross-sections along a sliver (the last one is its point) and how much each corner may stray in or out (the torn fibres). */
const SLIVER_STATIONS = 6
const SLIVER_FRAY = 0.3

/** Corners of a sliver's cross-section in the unit box: the four corners and a ridge on each wide face. */
const SLIVER_SECTION: ReadonlyArray<readonly [number, number]> = [[0.5, 0.5], [0, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0, -0.5], [0.5, -0.5]]

/** Width of the section along a sliver (0 at the broken end, 1 at the point): ragged and narrower at the break, full in the middle, tapering to the point. */
const sliverWidth = (t: number): number => (t < 0.25 ? 0.6 + 1.6 * t : t > 0.5 ? Math.max(0, (1 - t) / 0.5) ** 0.85 : 1)

const pushTriangle = (out: number[], a: readonly number[], b: readonly number[], c: readonly number[]): void => {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
}

const faceted = (THREE: typeof THREE_NS, positions: number[]): THREE_NS.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * A splinter of wood in the unit box, long along x: a ragged broken end, a body whose corners stray in and out from section to section (the torn fibres
 * along its edges), bending a little, and a point at the other end that is off its axis. About 60 triangles, shared by every splinter of the variant.
 */
export function buildSliverGeometry(THREE: typeof THREE_NS, seed: number): THREE_NS.BufferGeometry {
  const rnd = createRng(7000 + seed)
  const rings: number[][][] = []
  const bendY = (rnd() - 0.5) * 0.3
  const bendZ = (rnd() - 0.5) * 0.3
  for (let i = 0; i < SLIVER_STATIONS - 1; i++) {
    const t = i / (SLIVER_STATIONS - 1)
    const x = -0.5 + t + (i > 0 ? (rnd() - 0.5) * 0.08 : 0)
    const width = sliverWidth(t)
    const lift = Math.sin(t * Math.PI)
    rings.push(SLIVER_SECTION.map(([y, z]) => {
      const fray = 1 - SLIVER_FRAY + SLIVER_FRAY * 1.4 * rnd()
      return [x, Math.max(-0.5, Math.min(0.5, y * width * fray + bendY * lift)), Math.max(-0.5, Math.min(0.5, z * width * fray + bendZ * lift))]
    }))
  }
  const tip = [0.5, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.3]
  // the broken end is torn, not cut: its centre stands out or sinks in
  const torn = [-0.5 + rnd() * 0.12, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2]
  const sides = SLIVER_SECTION.length
  const positions: number[] = []
  for (let k = 0; k < sides; k++) {
    const next = (k + 1) % sides
    pushTriangle(positions, torn, rings[0][next], rings[0][k])
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i][k], b = rings[i][next], c = rings[i + 1][next], d = rings[i + 1][k]
      pushTriangle(positions, a, b, c)
      pushTriangle(positions, a, c, d)
    }
    const last = rings[rings.length - 1]
    pushTriangle(positions, last[k], last[next], tip)
  }
  return faceted(THREE, positions)
}

/**
 * A crumbly lump of pressed fibre (MDF) in the unit box: an icosahedron whose corners are pushed in and out by where they are (so the faces stay
 * closed), squashed to fill the box. 20 triangles.
 */
export function buildLumpGeometry(THREE: typeof THREE_NS, seed: number): THREE_NS.BufferGeometry {
  const rnd = createRng(8000 + seed)
  const base = new THREE.IcosahedronGeometry(0.5, 0)
  const source = base.getAttribute('position')
  const pushOf = new Map<string, number>()
  const positions: number[] = []
  for (let i = 0; i < source.count; i++) {
    const x = source.getX(i), y = source.getY(i), z = source.getZ(i)
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
    let push = pushOf.get(key)
    if (push === undefined) {
      push = 0.6 + 0.55 * rnd()
      pushOf.set(key, push)
    }
    positions.push(x * push, y * push, z * push)
  }
  base.dispose()
  const extent = [0, 0, 0]
  for (let i = 0; i < positions.length; i++) extent[i % 3] = Math.max(extent[i % 3], Math.abs(positions[i]))
  for (let i = 0; i < positions.length; i++) positions[i] *= 0.5 / Math.max(extent[i % 3], 1e-3)
  return faceted(THREE, positions)
}

/** Points along each long edge of a peeled sheet of veneer. */
const VENEER_EDGE = 11

/**
 * A sheet of veneer peeled off plywood in the unit box (thin along z): long edges torn along the grain in fine teeth (now and then a deeper notch) and
 * the short ends broken across with a sliver standing out, extruded to its thickness.
 */
export function buildVeneerGeometry(THREE: typeof THREE_NS, seed: number): THREE_NS.BufferGeometry {
  const rnd = createRng(9000 + seed)
  const shape = new THREE.Shape()
  const outline: Array<[number, number]> = []
  // the long edges tear along the grain in fine teeth; each short end breaks across with one long sliver of veneer standing out
  const edge = (y: number, inward: number): number => y - inward * (rnd() * 0.16 + (rnd() < 0.15 ? 0.12 : 0))
  for (let i = 0; i <= VENEER_EDGE; i++) outline.push([-0.5 + i / VENEER_EDGE, edge(0.5, 1)])
  outline.push([0.5 - rnd() * 0.12, 0.2 * rnd()], [0.5, -0.1 + 0.2 * rnd()], [0.5 - rnd() * 0.12, -0.25 * rnd()])
  for (let i = VENEER_EDGE; i >= 0; i--) outline.push([-0.5 + i / VENEER_EDGE, edge(-0.5, -1)])
  outline.push([-0.5 + rnd() * 0.12, -0.2 * rnd()], [-0.5, 0.1 * rnd()], [-0.5 + rnd() * 0.12, 0.25 * rnd()])
  shape.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1])
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
  geometry.translate(0, 0, -0.5)
  return geometry
}

/** Share of a broken board's length its torn end takes, and how many strands of fibre (at least, at most) the end splits into across its width. */
const TORN_END = 0.24
const TORN_STRANDS: readonly [number, number] = [4, 7]

/** Pushes the two triangles of the quad a-b-c-d, wound so that it faces where (b - a) x (c - b) points. */
const pushQuad = (out: number[], quad: ReadonlyArray<readonly number[]>): void => {
  pushTriangle(out, quad[0], quad[1], quad[2])
  pushTriangle(out, quad[0], quad[2], quad[3])
}

/** Uneven cuts of [-0.5, 0.5] into `count` widths, each between a third and twice the mean. */
const unevenCuts = (count: number, rnd: () => number): number[] => {
  const shares = Array.from({ length: count }, () => 0.35 + 1.65 * rnd())
  const total = shares.reduce((sum, share) => sum + share, 0)
  const cuts = [-0.5]
  for (const share of shares) cuts.push(cuts[cuts.length - 1] + share / total)
  cuts[cuts.length - 1] = 0.5
  return cuts
}

/**
 * The stub of a wooden board broken across, in the unit box, long along x: the sound part of the board, and at its +x end the break, torn into strands
 * of fibre of uneven widths and lengths that bend a little and fray before they come to points, not a clean saw cut. 58 to 94 triangles.
 */
export function buildBrokenBoardGeometry(THREE: typeof THREE_NS, seed: number): THREE_NS.BufferGeometry {
  const rnd = createRng(10000 + seed)
  const end = 0.5 - TORN_END
  const positions: number[] = []
  const lo = -0.5, hi = 0.5
  // the sound part of the board: a box from the far end to where the break starts (its face at the break is closed by the strands)
  pushQuad(positions, [[lo, lo, hi], [end, lo, hi], [end, hi, hi], [lo, hi, hi]])
  pushQuad(positions, [[lo, hi, lo], [end, hi, lo], [end, lo, lo], [lo, lo, lo]])
  pushQuad(positions, [[lo, hi, hi], [end, hi, hi], [end, hi, lo], [lo, hi, lo]])
  pushQuad(positions, [[lo, lo, lo], [end, lo, lo], [end, lo, hi], [lo, lo, hi]])
  pushQuad(positions, [[lo, lo, lo], [lo, lo, hi], [lo, hi, hi], [lo, hi, lo]])
  const count = TORN_STRANDS[0] + Math.floor(rnd() * (TORN_STRANDS[1] - TORN_STRANDS[0] + 1))
  const cuts = unevenCuts(count, rnd)
  for (let k = 0; k < count; k++) {
    const y0 = cuts[k], y1 = cuts[k + 1]
    const length = TORN_END * (0.15 + 0.85 * rnd())
    // halfway out the strand has narrowed and strays a little sideways and up or down; then it comes to a point off its middle
    const midX = end + length * (0.35 + 0.3 * rnd())
    const narrow = 0.55 + 0.35 * rnd()
    const shiftY = (rnd() - 0.5) * (y1 - y0) * 0.6
    const shiftZ = (rnd() - 0.5) * 0.5
    const cy = (y0 + y1) / 2 + shiftY, hy = ((y1 - y0) / 2) * narrow, hz = 0.5 * (0.4 + 0.5 * rnd())
    const base = [[end, y0, lo], [end, y1, lo], [end, y1, hi], [end, y0, hi]]
    const clampZ = (z: number): number => Math.max(lo, Math.min(hi, z))
    const mid = [[midX, cy - hy, clampZ(shiftZ - hz)], [midX, cy + hy, clampZ(shiftZ - hz)], [midX, cy + hy, clampZ(shiftZ + hz)], [midX, cy - hy, clampZ(shiftZ + hz)]]
    const tip = [end + length, y0 + (y1 - y0) * rnd(), clampZ(shiftZ + (rnd() - 0.5) * 0.4)]
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4
      pushQuad(positions, [base[i], base[next], mid[next], mid[i]])
      pushTriangle(positions, mid[i], mid[next], tip)
    }
  }
  return faceted(THREE, positions)
}
