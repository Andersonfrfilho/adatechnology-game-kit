/*
 * three.js r160 `ExtrudeGeometry` (MIT) for straight-edged shapes, ported line by line: the outline is sampled as `Shape.extractPoints` samples a
 * path of `LineCurve`s, triangulated by three's `ShapeUtils.triangulateShape` (Earcut), bevelled and walled in the same order, with the
 * `WorldUVGenerator` uvs and `computeVertexNormals` on the Float32 positions. Path extrusion (`extrudePath`) is not supported.
 */
import type { BevelSpec, GeometryGroup, PrimitiveBuffers, ShapeOutline, Vec2 } from '../types'
import { Earcut } from './earcut'

interface P {
  x: number
  y: number
}

const equals = (a: P, b: P): boolean => a.x === b.x && a.y === b.y

/** `LineCurve.getPoint(t)`. */
const linePoint = (v1: P, v2: P, t: number): P => (t === 1 ? { x: v2.x, y: v2.y } : { x: (v2.x - v1.x) * t + v1.x, y: (v2.y - v1.y) * t + v1.y })

/** `Path.setFromPoints(points).getPoints()`: one `LineCurve` per edge, resolution 1, consecutive duplicates dropped, not closed. */
function pathPoints(points: readonly Vec2[]): P[] {
  const out: P[] = []
  let last: P | undefined
  for (let i = 1; i < points.length; i++) {
    const v1 = { x: (points[i - 1] as Vec2)[0], y: (points[i - 1] as Vec2)[1] }
    const v2 = { x: (points[i] as Vec2)[0], y: (points[i] as Vec2)[1] }
    for (let d = 0; d <= 1; d++) {
      const point = linePoint(v1, v2, d / 1)
      if (last && equals(last, point)) continue
      out.push(point)
      last = point
    }
  }
  return out
}

function area(contour: readonly P[]): number {
  const n = contour.length
  let a = 0.0
  for (let p = n - 1, q = 0; q < n; p = q++) a += (contour[p] as P).x * (contour[q] as P).y - (contour[q] as P).x * (contour[p] as P).y
  return a * 0.5
}
const isClockWise = (pts: readonly P[]): boolean => area(pts) < 0

function removeDupEndPts(points: P[]): void {
  const l = points.length
  if (l > 2 && equals(points[l - 1] as P, points[0] as P)) points.pop()
}

function triangulateShape(contour: P[], holes: P[][]): number[][] {
  const vertices: number[] = []
  const holeIndices: number[] = []
  const faces: number[][] = []
  removeDupEndPts(contour)
  for (const p of contour) vertices.push(p.x, p.y)
  let holeIndex = contour.length
  holes.forEach(removeDupEndPts)
  for (let i = 0; i < holes.length; i++) {
    holeIndices.push(holeIndex)
    holeIndex += (holes[i] as P[]).length
    for (const p of holes[i] as P[]) vertices.push(p.x, p.y)
  }
  const triangles: number[] = Earcut.triangulate(vertices, holeIndices)
  for (let i = 0; i < triangles.length; i += 3) faces.push(triangles.slice(i, i + 3))
  return faces
}

/** `BufferGeometry.computeVertexNormals` for non-indexed Float32 positions, then `normalizeNormals`, both stored as Float32. */
export function computeVertexNormals(positions: Float32Array, indices?: ArrayLike<number>): Float32Array {
  const normals = new Float32Array(positions.length)
  const get = (array: Float32Array, i: number): [number, number, number] => [array[i * 3] as number, array[i * 3 + 1] as number, array[i * 3 + 2] as number]
  const face = (vA: number, vB: number, vC: number): [number, number, number] => {
    const pA = get(positions, vA)
    const pB = get(positions, vB)
    const pC = get(positions, vC)
    const cb = [pC[0] - pB[0], pC[1] - pB[1], pC[2] - pB[2]] as const
    const ab = [pA[0] - pB[0], pA[1] - pB[1], pA[2] - pB[2]] as const
    // Vector3.cross
    return [cb[1] * ab[2] - cb[2] * ab[1], cb[2] * ab[0] - cb[0] * ab[2], cb[0] * ab[1] - cb[1] * ab[0]]
  }
  const set = (i: number, x: number, y: number, z: number): void => {
    normals[i * 3] = x
    normals[i * 3 + 1] = y
    normals[i * 3 + 2] = z
  }
  if (indices) {
    for (let i = 0; i < indices.length; i += 3) {
      const vA = indices[i] as number
      const vB = indices[i + 1] as number
      const vC = indices[i + 2] as number
      const cb = face(vA, vB, vC)
      for (const v of [vA, vB, vC]) {
        const n = get(normals, v)
        set(v, n[0] + cb[0], n[1] + cb[1], n[2] + cb[2])
      }
    }
  } else {
    for (let i = 0; i < positions.length / 3; i += 3) {
      const cb = face(i, i + 1, i + 2)
      set(i, cb[0], cb[1], cb[2])
      set(i + 1, cb[0], cb[1], cb[2])
      set(i + 2, cb[0], cb[1], cb[2])
    }
  }
  for (let i = 0; i < normals.length / 3; i++) {
    const [x, y, z] = get(normals, i)
    const s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
    set(i, x * s, y * s, z * s)
  }
  return normals
}

export function extrude(outline: ShapeOutline, depth = 1, steps = 1, bevel: false | BevelSpec | undefined = undefined): PrimitiveBuffers {
  const parameters = { shape: outline, depth, steps, bevel: bevel ?? {} }
  const verticesArray: number[] = []
  const uvArray: number[] = []
  const groups: GeometryGroup[] = []
  const placeholder: number[] = []

  const bevelEnabled = bevel !== false
  const spec: BevelSpec = bevel === false || bevel === undefined ? {} : bevel
  let bevelThickness = spec.thickness !== undefined ? spec.thickness : 0.2
  let bevelSize = spec.size !== undefined ? spec.size : bevelThickness - 0.1
  let bevelOffset = spec.offset !== undefined ? spec.offset : 0
  let bevelSegments = spec.segments !== undefined ? spec.segments : 3
  if (!bevelEnabled) {
    bevelSegments = 0
    bevelThickness = 0
    bevelSize = 0
    bevelOffset = 0
  }

  let vertices = pathPoints(outline.outer)
  const holes = (outline.holes ?? []).map(pathPoints)
  const reverse = !isClockWise(vertices)
  if (reverse) {
    vertices = vertices.reverse()
    for (let h = 0; h < holes.length; h++) {
      const ahole = holes[h] as P[]
      if (isClockWise(ahole)) holes[h] = ahole.reverse()
    }
  }
  const faces = triangulateShape(vertices, holes)
  const contour = vertices
  for (const ahole of holes) vertices = vertices.concat(ahole)

  const scalePt2 = (pt: P, vec: P, size: number): P => ({ x: pt.x + vec.x * size, y: pt.y + vec.y * size })
  const vlen = vertices.length
  const flen = faces.length

  const getBevelVec = (inPt: P, inPrev: P, inNext: P): P => {
    let vTransX: number
    let vTransY: number
    let shrinkBy: number
    const vPrevX = inPt.x - inPrev.x
    const vPrevY = inPt.y - inPrev.y
    const vNextX = inNext.x - inPt.x
    const vNextY = inNext.y - inPt.y
    const vPrevLensq = vPrevX * vPrevX + vPrevY * vPrevY
    const collinear0 = vPrevX * vNextY - vPrevY * vNextX
    if (Math.abs(collinear0) > Number.EPSILON) {
      const vPrevLen = Math.sqrt(vPrevLensq)
      const vNextLen = Math.sqrt(vNextX * vNextX + vNextY * vNextY)
      const ptPrevShiftX = inPrev.x - vPrevY / vPrevLen
      const ptPrevShiftY = inPrev.y + vPrevX / vPrevLen
      const ptNextShiftX = inNext.x - vNextY / vNextLen
      const ptNextShiftY = inNext.y + vNextX / vNextLen
      const sf = ((ptNextShiftX - ptPrevShiftX) * vNextY - (ptNextShiftY - ptPrevShiftY) * vNextX) / (vPrevX * vNextY - vPrevY * vNextX)
      vTransX = ptPrevShiftX + vPrevX * sf - inPt.x
      vTransY = ptPrevShiftY + vPrevY * sf - inPt.y
      const vTransLensq = vTransX * vTransX + vTransY * vTransY
      if (vTransLensq <= 2) return { x: vTransX, y: vTransY }
      shrinkBy = Math.sqrt(vTransLensq / 2)
    } else {
      let directionEq = false
      if (vPrevX > Number.EPSILON) {
        if (vNextX > Number.EPSILON) directionEq = true
      } else if (vPrevX < -Number.EPSILON) {
        if (vNextX < -Number.EPSILON) directionEq = true
      } else if (Math.sign(vPrevY) === Math.sign(vNextY)) {
        directionEq = true
      }
      if (directionEq) {
        vTransX = -vPrevY
        vTransY = vPrevX
        shrinkBy = Math.sqrt(vPrevLensq)
      } else {
        vTransX = vPrevX
        vTransY = vPrevY
        shrinkBy = Math.sqrt(vPrevLensq / 2)
      }
    }
    return { x: vTransX / shrinkBy, y: vTransY / shrinkBy }
  }

  const movements = (ring: readonly P[]): P[] => {
    const out: P[] = []
    for (let i = 0, il = ring.length, j = il - 1, k = i + 1; i < il; i++, j++, k++) {
      if (j === il) j = 0
      if (k === il) k = 0
      out[i] = getBevelVec(ring[i] as P, ring[j] as P, ring[k] as P)
    }
    return out
  }
  const contourMovements = movements(contour)
  const holesMovements: P[][] = []
  let verticesMovements = contourMovements.concat()
  for (const ahole of holes) {
    const oneHoleMovements = movements(ahole)
    holesMovements.push(oneHoleMovements)
    verticesMovements = verticesMovements.concat(oneHoleMovements)
  }

  const v = (x: number, y: number, z: number): void => {
    placeholder.push(x)
    placeholder.push(y)
    placeholder.push(z)
  }
  const bevelLayer = (b: number, zOf: (z: number) => number): void => {
    const t = b / bevelSegments
    const z = bevelThickness * Math.cos((t * Math.PI) / 2)
    const bs = bevelSize * Math.sin((t * Math.PI) / 2) + bevelOffset
    for (let i = 0; i < contour.length; i++) {
      const vert = scalePt2(contour[i] as P, contourMovements[i] as P, bs)
      v(vert.x, vert.y, zOf(z))
    }
    for (let h = 0; h < holes.length; h++) {
      const ahole = holes[h] as P[]
      const oneHoleMovements = holesMovements[h] as P[]
      for (let i = 0; i < ahole.length; i++) {
        const vert = scalePt2(ahole[i] as P, oneHoleMovements[i] as P, bs)
        v(vert.x, vert.y, zOf(z))
      }
    }
  }
  for (let b = 0; b < bevelSegments; b++) bevelLayer(b, (z) => -z)
  const bs = bevelSize + bevelOffset
  for (let i = 0; i < vlen; i++) {
    const vert = bevelEnabled ? scalePt2(vertices[i] as P, verticesMovements[i] as P, bs) : (vertices[i] as P)
    v(vert.x, vert.y, 0)
  }
  for (let s = 1; s <= steps; s++) {
    for (let i = 0; i < vlen; i++) {
      const vert = bevelEnabled ? scalePt2(vertices[i] as P, verticesMovements[i] as P, bs) : (vertices[i] as P)
      v(vert.x, vert.y, (depth / steps) * s)
    }
  }
  for (let b = bevelSegments - 1; b >= 0; b--) bevelLayer(b, (z) => depth + z)

  const addVertex = (index: number): void => {
    verticesArray.push(placeholder[index * 3 + 0] as number)
    verticesArray.push(placeholder[index * 3 + 1] as number)
    verticesArray.push(placeholder[index * 3 + 2] as number)
  }
  const addUV = (x: number, y: number): void => {
    uvArray.push(x)
    uvArray.push(y)
  }
  const at = (index: number, axis: number): number => verticesArray[index * 3 + axis] as number
  const f3 = (a: number, b: number, c: number): void => {
    addVertex(a)
    addVertex(b)
    addVertex(c)
    const nextIndex = verticesArray.length / 3
    for (const index of [nextIndex - 3, nextIndex - 2, nextIndex - 1]) addUV(at(index, 0), at(index, 1))
  }
  const f4 = (a: number, b: number, c: number, d: number): void => {
    addVertex(a)
    addVertex(b)
    addVertex(d)
    addVertex(b)
    addVertex(c)
    addVertex(d)
    const nextIndex = verticesArray.length / 3
    const iA = nextIndex - 6
    const iB = nextIndex - 3
    const iC = nextIndex - 2
    const iD = nextIndex - 1
    const byX = Math.abs(at(iA, 1) - at(iB, 1)) < Math.abs(at(iA, 0) - at(iB, 0))
    const uv = (index: number): [number, number] => [byX ? at(index, 0) : at(index, 1), 1 - at(index, 2)]
    const uvs = [uv(iA), uv(iB), uv(iC), uv(iD)]
    for (const k of [0, 1, 3, 1, 2, 3]) addUV(...(uvs[k] as [number, number]))
  }

  // lid faces
  let start = verticesArray.length / 3
  if (bevelEnabled) {
    let offset = 0
    for (let i = 0; i < flen; i++) {
      const face = faces[i] as number[]
      f3((face[2] as number) + offset, (face[1] as number) + offset, (face[0] as number) + offset)
    }
    const layer = steps + bevelSegments * 2
    offset = vlen * layer
    for (let i = 0; i < flen; i++) {
      const face = faces[i] as number[]
      f3((face[0] as number) + offset, (face[1] as number) + offset, (face[2] as number) + offset)
    }
  } else {
    for (let i = 0; i < flen; i++) {
      const face = faces[i] as number[]
      f3(face[2] as number, face[1] as number, face[0] as number)
    }
    for (let i = 0; i < flen; i++) {
      const face = faces[i] as number[]
      f3((face[0] as number) + vlen * steps, (face[1] as number) + vlen * steps, (face[2] as number) + vlen * steps)
    }
  }
  groups.push({ start, count: verticesArray.length / 3 - start, materialIndex: 0 })

  // side faces
  start = verticesArray.length / 3
  const sidewalls = (ring: readonly P[], layeroffset: number): void => {
    let i = ring.length
    while (--i >= 0) {
      const j = i
      let k = i - 1
      if (k < 0) k = ring.length - 1
      for (let s = 0, sl = steps + bevelSegments * 2; s < sl; s++) {
        const slen1 = vlen * s
        const slen2 = vlen * (s + 1)
        f4(layeroffset + j + slen1, layeroffset + k + slen1, layeroffset + k + slen2, layeroffset + j + slen2)
      }
    }
  }
  let layeroffset = 0
  sidewalls(contour, layeroffset)
  layeroffset += contour.length
  for (const ahole of holes) {
    sidewalls(ahole, layeroffset)
    layeroffset += ahole.length
  }
  groups.push({ start, count: verticesArray.length / 3 - start, materialIndex: 1 })

  const positions = new Float32Array(verticesArray)
  return { type: 'ExtrudeGeometry', parameters, positions, normals: computeVertexNormals(positions), uvs: new Float32Array(uvArray), groups }
}
