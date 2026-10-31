import type * as THREE_NS from 'three'
import type { Terrain, TerrainChunk } from '@adatechnology/game-terrain'
import { patternIndex } from './surface-material'

type ThreeLib = typeof THREE_NS

/** Metres over which the raw colour of a dug layer darkens: the bottom of a hole gets little light. */
const DEPTH_SHADE = 1.6
const MIN_DEPTH_LIGHT = 0.55
const LOOSE_VISIBLE = 0.004
/** A skin thinner than this (turf, asphalt) is not what comes out of a hole: what is under it is. */
const THIN_SKIN = 0.1
const SKIRT_QUADS = 4
const BROKEN_DEPTH = 0.004
const BROKEN_TONE = 0.62

/** What a vertex shows: the colour and pattern of what is exposed or heaped on it, sharp at the edge between materials, and its light and burn, which blend. */
function vertexLook(terrain: Terrain, column: number, row: number, base: [number, number, number], shade: [number, number]): number {
  const index = row * terrain.stride + column
  let material = terrain.vertexMaterial(column, row)
  if (terrain.loose[index]! > LOOSE_VISIBLE) {
    const profile = terrain.profileList[terrain.profileIndex[index]!]!
    const first = profile.strata[0]!
    material = terrain.material(first.thickness < THIN_SKIN && profile.strata[1] ? profile.strata[1].material : first.material)
  }
  // dug concrete shows its broken aggregate, not the troweled surface with its joints
  const broken = material.pattern === 'concrete' && terrain.dug[index]! > BROKEN_DEPTH
  const tone = broken ? BROKEN_TONE : 1
  base[0] = material.color[0] * tone
  base[1] = material.color[1] * tone
  base[2] = material.color[2] * tone
  shade[0] = Math.max(MIN_DEPTH_LIGHT, 1 - terrain.dug[index]! / DEPTH_SHADE)
  shade[1] = terrain.scorch[index]!
  return patternIndex(broken ? 'soil' : material.pattern)
}

/** The chunk as a grid with one vertex every `step` cells; the normals come from the height field, so that neighbouring chunks meet without a seam. */
export function buildChunkGeometry(THREE: ThreeLib, terrain: Terrain, chunk: TerrainChunk, step: number): THREE_NS.BufferGeometry {
  const [x0, z0] = terrain.bounds
  const { cellSize, columns, rows } = terrain
  const lastColumn = Math.min(columns, chunk.column + chunk.cells)
  const lastRow = Math.min(rows, chunk.row + chunk.cells)
  const across = Math.ceil((lastColumn - chunk.column) / step) + 1
  const down = Math.ceil((lastRow - chunk.row) / step) + 1
  const positions = new Float32Array(across * down * 3)
  const normals = new Float32Array(across * down * 3)
  const bases = new Float32Array(across * down * 3)
  const shades = new Float32Array(across * down * 2)
  const patterns = new Float32Array(across * down)
  const base: [number, number, number] = [0, 0, 0]
  const shade: [number, number] = [1, 0]
  let at = 0
  for (let j = 0; j < down; j++) {
    const row = Math.min(lastRow, chunk.row + j * step)
    for (let i = 0; i < across; i++) {
      const column = Math.min(lastColumn, chunk.column + i * step)
      const height = terrain.vertexHeight(column, row)
      positions[at * 3] = x0 + column * cellSize
      positions[at * 3 + 1] = height
      positions[at * 3 + 2] = z0 + row * cellSize
      const left = terrain.vertexHeight(Math.max(0, column - 1), row)
      const right = terrain.vertexHeight(Math.min(columns, column + 1), row)
      const back = terrain.vertexHeight(column, Math.max(0, row - 1))
      const front = terrain.vertexHeight(column, Math.min(rows, row + 1))
      const nx = left - right
      const ny = 2 * cellSize
      const nz = back - front
      const length = Math.hypot(nx, ny, nz)
      normals[at * 3] = nx / length
      normals[at * 3 + 1] = ny / length
      normals[at * 3 + 2] = nz / length
      patterns[at] = vertexLook(terrain, column, row, base, shade)
      bases.set(base, at * 3)
      shades.set(shade, at * 2)
      at++
    }
  }
  const indices = new Uint32Array((across - 1) * (down - 1) * 6)
  let cursor = 0
  for (let j = 0; j < down - 1; j++) {
    for (let i = 0; i < across - 1; i++) {
      const a = j * across + i
      const b = a + 1
      const c = a + across
      const d = c + 1
      indices[cursor++] = a
      indices[cursor++] = c
      indices[cursor++] = b
      // both triangles end on `b`: a flat attribute takes the last vertex, so the whole quad has one material and the edge between two is a straight line
      indices[cursor++] = c
      indices[cursor++] = d
      indices[cursor++] = b
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('aBase', new THREE.BufferAttribute(bases, 3))
  geometry.setAttribute('aShade', new THREE.BufferAttribute(shades, 2))
  geometry.setAttribute('aPattern', new THREE.BufferAttribute(patterns, 1))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}

/**
 * Every chunk nothing touched, as one flat quad each in one geometry: the whole floor of an arena is a single draw call until someone digs it. Around them, out to `skirt` metres, the
 * ground goes on as the same surface: what is thrown past the edge lands on something, not on the sky.
 */
export function buildPristineGeometry(THREE: ThreeLib, terrain: Terrain, chunks: readonly TerrainChunk[], skirt: number): THREE_NS.BufferGeometry {
  const [x0, z0] = terrain.bounds
  const { cellSize, columns, rows } = terrain
  const [, , x1, z1] = terrain.bounds
  const quads = chunks.length + SKIRT_QUADS
  const positions = new Float32Array(quads * 12)
  const normals = new Float32Array(quads * 12)
  const bases = new Float32Array(quads * 12)
  const shades = new Float32Array(quads * 8)
  const patterns = new Float32Array(quads * 4)
  const indices = new Uint32Array(quads * 6)
  const base: [number, number, number] = [0, 0, 0]
  const shade: [number, number] = [1, 0]
  chunks.forEach((chunk, n) => {
    const lastColumn = Math.min(columns, chunk.column + chunk.cells)
    const lastRow = Math.min(rows, chunk.row + chunk.cells)
    const corners = [[chunk.column, chunk.row], [lastColumn, chunk.row], [chunk.column, lastRow], [lastColumn, lastRow]] as const
    const pattern = vertexLook(terrain, chunk.column, chunk.row, base, shade)
    corners.forEach(([column, row], corner) => {
      const at = n * 4 + corner
      positions[at * 3] = x0 + column * cellSize
      positions[at * 3 + 1] = terrain.vertexHeight(column, row)
      positions[at * 3 + 2] = z0 + row * cellSize
      normals[at * 3 + 1] = 1
      bases.set(base, at * 3)
      shades.set(shade, at * 2)
      patterns[at] = pattern
    })
    const first = n * 4
    indices.set([first, first + 2, first + 1, first + 2, first + 3, first + 1], n * 6)
  })
  const surface = terrain.material(terrain.profileList.find((profile) => profile.id === terrain.layout().surface)?.strata[0]?.material ?? terrain.profileList[terrain.profileIndex[0]!]!.strata[0]!.material)
  const rects = [
    [x0 - skirt, z0 - skirt, x1 + skirt, z0],
    [x0 - skirt, z1, x1 + skirt, z1 + skirt],
    [x0 - skirt, z0, x0, z1],
    [x1, z0, x1 + skirt, z1],
  ] as const
  rects.forEach(([ax, az, bx, bz], r) => {
    const n = chunks.length + r
    const corners = [[ax, az], [bx, az], [ax, bz], [bx, bz]] as const
    corners.forEach(([x, z], corner) => {
      const at = n * 4 + corner
      positions[at * 3] = x
      positions[at * 3 + 2] = z
      normals[at * 3 + 1] = 1
      bases.set(surface.color, at * 3)
      shades[at * 2] = 1
      patterns[at] = patternIndex(surface.pattern)
    })
    const first = n * 4
    indices.set([first, first + 2, first + 1, first + 2, first + 3, first + 1], n * 6)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('aBase', new THREE.BufferAttribute(bases, 3))
  geometry.setAttribute('aShade', new THREE.BufferAttribute(shades, 2))
  geometry.setAttribute('aPattern', new THREE.BufferAttribute(patterns, 1))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}
