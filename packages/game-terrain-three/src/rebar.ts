import type * as THREE_NS from 'three'
import type { Terrain, TerrainChunk } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

const BAR_RADIUS = 0.006
const EXPOSED_MARGIN = 0.002

/** The bars of a reinforced layer where the digging passed their cover: a mesh of the chunk, or null when none is showing. */
export function buildRebarGeometry(THREE: ThreeLib, terrain: Terrain, chunk: TerrainChunk): THREE_NS.BufferGeometry | null {
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
  const showing = (index: number, depth: number): boolean => terrain.dug[index]! > depth + EXPOSED_MARGIN
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
      const y = -cover.depth - BAR_RADIUS
      if (onBar(z, cover.spacing) && column < lastColumn && showing(index + 1, cover.depth)) addBox(x, z, x + cellSize, z, y)
      if (onBar(x, cover.spacing) && row < lastRow && showing(index + stride, cover.depth)) addBox(x, z, x, z + cellSize, y)
    }
  }
  if (boxes.length === 0) return null
  const count = boxes.length / 6
  const positions = new Float32Array(count * 24 * 3)
  const normals = new Float32Array(count * 24 * 3)
  const indices = new Uint32Array(count * 36)
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
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}
