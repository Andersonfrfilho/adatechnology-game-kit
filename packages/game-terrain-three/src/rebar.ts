import type * as THREE_NS from 'three'
import type { Terrain, TerrainChunk } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

const BAR_RADIUS = 0.006
const EXPOSED_MARGIN = 0.002
/** Metres a bar hangs just before it gives way. */
const MAX_SAG = 0.07

/** Bars a fresh geometry has room for at least, so that a chunk whose bars grow a little keeps its buffers. */
const MIN_BAR_CAPACITY = 32

function barCapacity(count: number): number {
  let capacity = MIN_BAR_CAPACITY
  while (capacity < count) capacity *= 2
  return capacity
}

/**
 * The bars of a reinforced layer where the digging passed their cover: a mesh of the chunk, or null when none is showing. A `reuse` geometry with room for them is written into
 * (and only its draw range changes) instead of making new buffers.
 */
export function buildRebarGeometry(THREE: ThreeLib, terrain: Terrain, chunk: TerrainChunk, reuse?: THREE_NS.BufferGeometry): THREE_NS.BufferGeometry | null {
  const [x0, z0] = terrain.bounds
  const { cellSize, columns, rows, stride } = terrain
  const lastColumn = Math.min(columns, chunk.column + chunk.cells)
  const lastRow = Math.min(rows, chunk.row + chunk.cells)
  const boxes: number[] = []
  const coverOf = (index: number): { depth: number; spacing: number } | null => {
    let top = 0
    for (const stratum of terrain.profileList[terrain.profileIndex[index]!]!.strata) {
      if (stratum.reinforcement) return { depth: top + stratum.reinforcement.cover, spacing: stratum.reinforcement.spacing }
      top += stratum.thickness
    }
    return null
  }
  // past the bottom of its strata the slab has opened: the bars are gone there and stay bent around the hole
  const showing = (index: number, depth: number): boolean => {
    const profile = terrain.profileList[terrain.profileIndex[index]!]!
    const limit = profile.strata.reduce((sum, stratum) => sum + stratum.thickness, 0)
    return terrain.dug[index]! > depth + EXPOSED_MARGIN && terrain.dug[index]! <= limit + EXPOSED_MARGIN
  }
  const onBar = (coordinate: number, spacing: number): boolean => Math.floor(coordinate / spacing) !== Math.floor((coordinate + cellSize) / spacing)
  const addBox = (ax: number, az: number, bx: number, bz: number, y: number): void => {
    boxes.push(Math.min(ax, bx) - BAR_RADIUS, y - BAR_RADIUS, Math.min(az, bz) - BAR_RADIUS, Math.max(ax, bx) + BAR_RADIUS, y + BAR_RADIUS, Math.max(az, bz) + BAR_RADIUS)
  }
  for (let row = chunk.row; row <= lastRow; row++) {
    for (let column = chunk.column; column <= lastColumn; column++) {
      const index = row * stride + column
      const cover = coverOf(index)
      if (!cover || !showing(index, cover.depth)) continue
      const x = x0 + column * cellSize
      const z = z0 + row * cellSize
      const y = -cover.depth - BAR_RADIUS - Math.min(1, terrain.barBend[index]!) * MAX_SAG
      if (onBar(z, cover.spacing) && column < lastColumn && showing(index + 1, cover.depth)) addBox(x, z, x + cellSize, z, y)
      if (onBar(x, cover.spacing) && row < lastRow && showing(index + stride, cover.depth)) addBox(x, z, x, z + cellSize, y)
    }
  }
  if (boxes.length === 0) return null
  const count = boxes.length / 6
  const target = reuse && reuse.getAttribute('position').count >= count * 24 ? reuse : undefined
  const capacity = target ? target.getAttribute('position').count / 24 : barCapacity(count)
  const positions = target ? (target.getAttribute('position').array as Float32Array) : new Float32Array(capacity * 24 * 3)
  const normals = target ? (target.getAttribute('normal').array as Float32Array) : new Float32Array(capacity * 24 * 3)
  const indices = target ? (target.getIndex()!.array as Uint32Array) : new Uint32Array(capacity * 36)
  const FACES: readonly (readonly [readonly number[], readonly [number, number, number]])[] = [
    [[0, 4, 2, 0, 4, 5, 3, 4, 5, 3, 4, 2], [0, 1, 0]],
    [[0, 1, 5, 0, 1, 2, 3, 1, 2, 3, 1, 5], [0, -1, 0]],
    [[0, 1, 5, 3, 1, 5, 3, 4, 5, 0, 4, 5], [0, 0, 1]],
    [[3, 1, 2, 0, 1, 2, 0, 4, 2, 3, 4, 2], [0, 0, -1]],
    [[3, 1, 5, 3, 1, 2, 3, 4, 2, 3, 4, 5], [1, 0, 0]],
    [[0, 1, 2, 0, 1, 5, 0, 4, 5, 0, 4, 2], [-1, 0, 0]],
  ]
  let vertex = 0
  let cursor = 0
  for (let n = 0; n < count; n++) {
    const box = boxes.slice(n * 6, n * 6 + 6)
    for (const [corners, normal] of FACES) {
      const first = vertex
      for (let c = 0; c < 4; c++) {
        positions[vertex * 3] = box[corners[c * 3]!]!
        positions[vertex * 3 + 1] = box[corners[c * 3 + 1]!]!
        positions[vertex * 3 + 2] = box[corners[c * 3 + 2]!]!
        normals.set(normal, vertex * 3)
        vertex++
      }
      indices.set([first, first + 1, first + 2, first, first + 2, first + 3], cursor)
      cursor += 6
    }
  }
  if (target) {
    target.getAttribute('position').needsUpdate = true
    target.getAttribute('normal').needsUpdate = true
    target.getIndex()!.needsUpdate = true
    target.boundingSphere = null
    target.boundingBox = null
    target.setDrawRange(0, count * 36)
    return target
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.setDrawRange(0, count * 36)
  return geometry
}
