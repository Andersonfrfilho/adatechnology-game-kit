import type * as THREE_NS from 'three'
import type { FilmLayout, FilmRegion } from '@adatechnology/game-fluids'
import type { ThreeLib } from '../types'

const SEGMENTS_ACROSS = 8
const SEGMENTS_ALONG = 8

/**
 * One strip of the folded grid as a plane of the surface: `uv` runs over the region's rows and the grid's columns, so the shader reads its own cells.
 * `aB` is the way the film runs down the strip (rows) and `aT` its columns.
 */
export function createStripGeometry(THREE: ThreeLib, layout: FilmLayout, region: FilmRegion): THREE_NS.BufferGeometry {
  const { width, height, cellSize } = layout
  const alongSegments = region.rowCount <= 2 ? 1 : SEGMENTS_ALONG
  const position: number[] = []
  const normal: number[] = []
  const uv: number[] = []
  const down: number[] = []
  const across: number[] = []
  const index: number[] = []
  for (let j = 0; j <= alongSegments; j++) {
    const t = j / alongSegments
    for (let i = 0; i <= SEGMENTS_ACROSS; i++) {
      const u = i / SEGMENTS_ACROSS
      for (let k = 0; k < 3; k++) position.push(region.origin[k] + region.columnAxis[k] * u * width * cellSize + region.rowAxis[k] * t * region.rowCount * cellSize)
      normal.push(region.normal[0], region.normal[1], region.normal[2])
      down.push(region.rowAxis[0], region.rowAxis[1], region.rowAxis[2])
      across.push(region.columnAxis[0], region.columnAxis[1], region.columnAxis[2])
      uv.push(u, (region.firstRow + t * region.rowCount) / height)
    }
  }
  for (let j = 0; j < alongSegments; j++) {
    for (let i = 0; i < SEGMENTS_ACROSS; i++) {
      const a = j * (SEGMENTS_ACROSS + 1) + i
      const b = a + 1
      const c = a + SEGMENTS_ACROSS + 1
      index.push(a, c, b, b, c, c + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setAttribute('aB', new THREE.Float32BufferAttribute(down, 3))
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(across, 3))
  geometry.setIndex(index)
  return geometry
}
