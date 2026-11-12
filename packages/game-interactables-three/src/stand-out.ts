import type { ShapeNode, ShapeSchema } from '@adatechnology/game-shapes'

type Vector = [number, number, number]
type Point2 = [number, number]
/** Row-major 3x3. */
type Matrix = readonly number[]

/** How far a face moves to leave the plane it shared (CLAUDE.md §13: a detail stands out or sinks at least 2 mm). */
const GAP = 0.002
/** The guard's reach: two faces closer than this are one plane. */
const SAME_PLANE = 0.00105
/** Faces whose normals differ by less than this (per component) are parallel to the guard. */
const SAME_DIRECTION = 0.0015
/** Overlaps below this (m²) are edge contacts; the guard's own floor is 1e-4. */
const MIN_OVERLAP_AREA = 5e-5
/** A piece thinner than this along the axis grows out instead of sinking in. */
const MIN_THICKNESS_TO_SINK = 0.012
const MAX_ROUNDS = 6
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1]

type Writable = { position?: Vector; rotation?: Vector; rotationOrder?: string; scale?: number | Vector; heading?: number; matrix?: unknown; children?: Writable[]; kind: string; radiusTop?: number; radiusBottom?: number; size?: Vector }

type Piece = {
  readonly node: Writable
  /** Rotation of the parent frame (frame to world). */
  readonly parentRotation: Matrix
  readonly center: Vector
  /** World direction of each local axis. */
  readonly axes: readonly [Vector, Vector, Vector]
  readonly half: Vector
  /** A cylinder only has flat faces on its own height axis. */
  readonly isCylinder: boolean
  /** A plane has one face and no thickness. */
  readonly isPlane: boolean
}

type Face = { readonly piece: Piece; readonly axis: number; readonly sign: number; readonly normal: Vector; readonly offset: number }

const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function multiply(a: Matrix, b: Matrix): Matrix {
  const out: number[] = []
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) out.push(a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!)
  return out
}

function rotationAbout(axis: number, angle: number): Matrix {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c]
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c]
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/** The rotation of a node as three composes it: the heading about y first, then the euler angles in their order (`'YXZ'` is Ry * Rx * Rz). */
function rotationOf(node: Writable): Matrix {
  let matrix = node.heading ? rotationAbout(1, node.heading) : IDENTITY
  if (node.rotation) {
    for (const letter of node.rotationOrder ?? 'XYZ') matrix = multiply(matrix, rotationAbout('XYZ'.indexOf(letter), node.rotation['XYZ'.indexOf(letter)]!))
  }
  return matrix
}

function apply(matrix: Matrix, vector: Vector): Vector {
  return [0, 1, 2].map((row) => matrix[row * 3]! * vector[0] + matrix[row * 3 + 1]! * vector[1] + matrix[row * 3 + 2]! * vector[2]) as Vector
}

function transpose(matrix: Matrix): Matrix {
  return [matrix[0]!, matrix[3]!, matrix[6]!, matrix[1]!, matrix[4]!, matrix[7]!, matrix[2]!, matrix[5]!, matrix[8]!]
}

function pieceOf(node: Writable, parentOrigin: Vector, parentRotation: Matrix): Piece | undefined {
  if (node.matrix || node.size || !Array.isArray(node.scale) || !node.position) return undefined
  const isCylinder = node.kind === 'cylinder'
  const isPlane = node.kind === 'plane'
  if (isCylinder && (node.radiusTop ?? 1) !== (node.radiusBottom ?? 1)) return undefined
  const rotation = multiply(parentRotation, rotationOf(node))
  const axes = [0, 1, 2].map((column) => [rotation[column]!, rotation[3 + column]!, rotation[6 + column]!] as Vector) as unknown as Piece['axes']
  const half: Vector = isCylinder ? [node.scale[0]!, node.scale[1]! / 2, node.scale[2]!] : isPlane ? [node.scale[0]! / 2, node.scale[1]! / 2, 0] : [node.scale[0]! / 2, node.scale[1]! / 2, node.scale[2]! / 2]
  const offset = apply(parentRotation, node.position)
  return { node, parentRotation, center: [parentOrigin[0] + offset[0]!, parentOrigin[1] + offset[1]!, parentOrigin[2] + offset[2]!], axes, half, isCylinder, isPlane }
}

function collect(nodes: readonly ShapeNode[], origin: Vector, rotation: Matrix, out: Piece[]): void {
  for (const source of nodes) {
    const node = source as unknown as Writable
    if (node.kind === 'group') {
      if (node.matrix || node.scale !== undefined) continue
      const offset = apply(rotation, node.position ?? [0, 0, 0])
      collect((node.children ?? []) as unknown as readonly ShapeNode[], [origin[0] + offset[0]!, origin[1] + offset[1]!, origin[2] + offset[2]!], multiply(rotation, rotationOf(node)), out)
    } else if (node.kind === 'box' || node.kind === 'cylinder' || node.kind === 'plane') {
      const piece = pieceOf(node, origin, rotation)
      if (piece) out.push(piece)
    }
  }
}

function faceOf(piece: Piece, axis: number, sign: number): Face {
  const normal: Vector = [piece.axes[axis]![0] * sign, piece.axes[axis]![1] * sign, piece.axes[axis]![2] * sign]
  return { piece, axis, sign, normal, offset: dot(normal, piece.center) + piece.half[axis]! }
}

function facesOf(piece: Piece): Face[] {
  if (piece.isPlane) return [faceOf(piece, 2, 1)]
  return (piece.isCylinder ? [1] : [0, 1, 2]).flatMap((axis) => [faceOf(piece, axis, 1), faceOf(piece, axis, -1)])
}

/** The four corners of a face, in the plane's 2D basis (`u`, `v`). */
function cornersOf(face: Face, u: Vector, v: Vector): Point2[] {
  const { piece, axis } = face
  const [first, second] = [0, 1, 2].filter((other) => other !== axis) as [number, number]
  return ([[1, 1], [1, -1], [-1, -1], [-1, 1]] as const).map(([a, b]) => {
    const point = [0, 1, 2].map((k) => piece.center[k]! + piece.axes[first]![k]! * piece.half[first]! * a + piece.axes[second]![k]! * piece.half[second]! * b) as Vector
    return [dot(point, u), dot(point, v)] as Point2
  })
}

const side = (p: Point2, a: Point2, b: Point2): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])

/** Area of the overlap of two convex polygons (Sutherland-Hodgman). */
function overlapArea(subject: Point2[], clip: Point2[]): number {
  let output = subject
  const orientation = Math.sign(side(clip[2]!, clip[0]!, clip[1]!)) || 1
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i]!
    const b = clip[(i + 1) % clip.length]!
    const input = output
    output = []
    for (let j = 0; j < input.length; j++) {
      const current = input[j]!
      const previous = input[(j + input.length - 1) % input.length]!
      const currentInside = side(current, a, b) * orientation >= 0
      if (currentInside !== side(previous, a, b) * orientation >= 0) {
        const t = side(previous, a, b) / (side(previous, a, b) - side(current, a, b))
        output.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t])
      }
      if (currentInside) output.push(current)
    }
  }
  let area = 0
  for (let i = 0; i < output.length; i++) {
    const p = output[i]!
    const q = output[(i + 1) % output.length]!
    area += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(area) / 2
}

function planeBasis(normal: Vector): [Vector, Vector] {
  const side = cross(normal, Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
  const length = Math.hypot(...side)
  const u: Vector = [side[0] / length, side[1] / length, side[2] / length]
  return [u, cross(normal, u)]
}

function fight(a: Face, b: Face): boolean {
  if (Math.abs(a.offset - b.offset) > SAME_PLANE) return false
  if ([0, 1, 2].some((k) => Math.abs(a.normal[k]! - b.normal[k]!) > SAME_DIRECTION)) return false
  const [u, v] = planeBasis(a.normal)
  return overlapArea(cornersOf(a, u, v), cornersOf(b, u, v)) > MIN_OVERLAP_AREA
}

/** Moves a face of a piece by `amount` (positive: out) along its normal, in the piece's node. */
function moveFace(face: Face, amount: number): void {
  const { piece, axis } = face
  const scale = piece.node.scale as Vector
  if (!piece.isPlane) {
    scale[axis] = scale[axis]! + amount
    piece.half[axis] = piece.half[axis]! + amount / 2
  }
  const shift = face.normal.map((component) => (component * amount) / (piece.isPlane ? 1 : 2)) as Vector
  for (let k = 0; k < 3; k++) piece.center[k] = piece.center[k]! + shift[k]!
  const inParent = apply(transpose(piece.parentRotation), shift)
  const position = piece.node.position as Vector
  for (let k = 0; k < 3; k++) position[k] = position[k]! + inParent[k]!
}

/** Moves the face by the first of 2 mm in, 2 mm out, 4 mm in, 4 mm out (out first for a thin piece) that lands on no other piece's face. */
function clearFace(face: Face, pieces: readonly Piece[]): void {
  const { piece, axis, sign } = face
  const thick = piece.half[axis]! * 2 >= MIN_THICKNESS_TO_SINK
  const steps = piece.isPlane ? [GAP, 2 * GAP, 3 * GAP] : [GAP, -GAP, 2 * GAP, -2 * GAP].map((step) => (thick ? -step : step))
  const fits = (step: number): boolean => piece.isPlane || piece.half[axis]! * 2 + step >= 2 * GAP
  const clear = (): boolean => pieces.every((other) => other === piece || !facesOf(other).some((candidate) => fight(faceOf(piece, axis, sign), candidate)))
  let applied = 0
  for (const step of steps.filter(fits)) {
    moveFace(face, step - applied)
    applied = step
    if (clear()) return
  }
  moveFace(face, steps[0]! - applied)
}

/** Two coaxial round pieces whose radii differ by about a millimetre have facets on one plane: the smaller one's radius moves 2 mm away from the other. */
function separateRadii(a: Piece, b: Piece): boolean {
  if (!a.isCylinder || !b.isCylinder || Math.abs(dot(a.axes[1], b.axes[1])) < 0.9999) return false
  const between: Vector = [b.center[0] - a.center[0], b.center[1] - a.center[1], b.center[2] - a.center[2]]
  const along = dot(between, a.axes[1])
  if (Math.hypot(between[0] - a.axes[1][0] * along, between[1] - a.axes[1][1] * along, between[2] - a.axes[1][2] * along) > SAME_PLANE) return false
  if (Math.abs(along) > a.half[1] + b.half[1] - 0.005 || Math.abs(a.half[0] - b.half[0]) > SAME_PLANE * 1.1) return false
  const [mover, other] = volumeOf(a) < volumeOf(b) ? [a, b] : [b, a]
  const amount = mover.half[0] >= other.half[0] ? GAP : -GAP
  const scale = mover.node.scale as Vector
  scale[0] = scale[0]! + amount
  scale[2] = scale[2]! + amount
  mover.half[0] += amount
  mover.half[2] += amount
  return true
}

const volumeOf = (piece: Piece): number => piece.half[0] * piece.half[1] * piece.half[2]

/** The first pair of faces of the two pieces that fight, if any. */
function firstFight(a: Piece, b: Piece): [Face, Face] | undefined {
  const facesB = facesOf(b)
  for (const faceA of facesOf(a)) {
    const faceB = facesB.find((candidate) => fight(faceA, candidate))
    if (faceB) return [faceA, faceB]
  }
  return undefined
}

/**
 * Makes the boxes (and cylinders) of a schema stop sharing planes: when two pieces have a face on one plane, looking the same way and
 * overlapping, the smaller piece's face sinks 2 mm into the piece (or grows 2 mm out when the piece is thinner than 12 mm), CLAUDE.md §13.
 * Mutates the schema's nodes and returns it.
 */
export function standOutCoincidentBoxes(schema: ShapeSchema): ShapeSchema {
  const pieces: Piece[] = []
  collect((schema.root as { children?: readonly ShapeNode[] }).children ?? [], [0, 0, 0], IDENTITY, pieces)
  const reach = pieces.map((piece) => Math.hypot(...piece.half))
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let moved = false
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i]!
        const b = pieces[j]!
        if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1], a.center[2] - b.center[2]) > reach[i]! + reach[j]! + 0.01) continue
        if (separateRadii(a, b)) moved = true
        const found = firstFight(a, b)
        if (!found) continue
        const mover = volumeOf(a) < volumeOf(b) ? found[0] : found[1]
        clearFace(mover, pieces)
        moved = true
      }
    }
    if (!moved) break
  }
  return schema
}
