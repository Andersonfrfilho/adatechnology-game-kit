import type { Vec3 } from '../types'
import { hashCell, valueNoise } from './noise'
import type { FilmImpact, FilmLayout, FilmRegion, FilmRules } from './types'

export interface FoldedLayoutParams {
  id: string
  columns: number
  /** Metres per cell. */
  cellSize: number
  /** World x of the left edge. */
  originX: number
  wallRows: number
  sidewalkRows: number
  curbRows: number
  roadRows: number
  /** World y of the top of the wall strip and of the sidewalk and road planes. */
  wallTopY: number
  sidewalkY: number
  roadY: number
  /** World z of the wall plane (the sidewalk starts here and runs towards +z). */
  wallZ: number
  /** Metres the curb face drops per row. Default `(sidewalkY - roadY) / curbRows`. */
  curbStep?: number
  /** x that the road's cross slope is measured from (the road falls `5 mm / m` towards +x from here). */
  roadSlopeAnchorX: number
  rules: FilmRules
}

const REGION_NAMES = ['wall', 'sidewalk', 'curb', 'road'] as const

const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function impactOf(region: FilmRegion, position: Vec3, velocity: Vec3, cellSize: number): FilmImpact {
  const local: Vec3 = [position[0] - region.origin[0], position[1] - region.origin[1], position[2] - region.origin[2]]
  return {
    row: region.firstRow + dot3(local, region.rowAxis) / cellSize,
    column: dot3(local, region.columnAxis) / cellSize,
    along: [dot3(velocity, region.columnAxis), dot3(velocity, region.rowAxis)],
    normalSpeed: -dot3(velocity, region.normal),
  }
}

function cellToWorldOf(regions: readonly FilmRegion[], cellSize: number, row: number, column: number): Vec3 {
  let region = regions[regions.length - 1]!
  for (const candidate of regions) {
    if (row < candidate.firstRow + candidate.rowCount) {
      region = candidate
      break
    }
  }
  const across = column * cellSize
  const down = (row - region.firstRow) * cellSize
  return [
    region.origin[0] + region.columnAxis[0] * across + region.rowAxis[0] * down,
    region.origin[1] + region.columnAxis[1] * across + region.rowAxis[1] * down,
    region.origin[2] + region.columnAxis[2] * across + region.rowAxis[2] * down,
  ]
}

/**
 * One strip folded over a wall, the sidewalk in front of it, the curb face and the road: the Fluid Standard's grid (F12-42) and the
 * Workshop's (W562-582) are two settings of it. Bed height (mm), pinning noise and the vertical flag are filled per cell.
 */
export function createFoldedLayout(params: FoldedLayoutParams): FilmLayout {
  const { columns, cellSize, originX, wallRows, sidewalkRows, curbRows, roadRows, wallTopY, sidewalkY, roadY, wallZ, rules } = params
  const curbStep = params.curbStep ?? (sidewalkY - roadY) / curbRows
  const height = wallRows + sidewalkRows + curbRows + roadRows
  const cellCount = columns * height
  const bed = new Float32Array(cellCount)
  const pin = new Float32Array(cellCount)
  const vertical = new Float32Array(cellCount)
  const sidewalkEnd = wallRows + sidewalkRows
  const curbEnd = sidewalkEnd + curbRows
  const regionOfRow = (row: number): number => (row < wallRows ? 0 : row < sidewalkEnd ? 1 : row < curbEnd ? 2 : 3)

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column
      const region = regionOfRow(row)
      const x = originX + (column + 0.5) * cellSize
      let bedHeight: number
      let roughness = 0.2
      if (region === 0) {
        bedHeight = (wallTopY - (row + 0.5) * cellSize) * 1000
        roughness = 0.3
      } else if (region === 1) {
        const z = (row - wallRows + 0.5) * cellSize
        bedHeight = sidewalkY * 1000 - z * 6
        const jointX = Math.abs((((x - originX) % 0.5) + 0.5) % 0.5 - 0.25)
        const jointZ = Math.abs(((z % 0.5) + 0.5) % 0.5 - 0.25)
        if (jointX > 0.25 - cellSize * 0.6 || jointZ > 0.25 - cellSize * 0.6) bedHeight -= 0.9
        roughness = 0.18
      } else if (region === 2) {
        bedHeight = sidewalkY * 1000 - (row - sidewalkEnd + 0.5) * curbStep * 1000
      } else {
        const z = (row - curbEnd + 0.5) * cellSize
        bedHeight = roadY * 1000 + z * 14 - (x - params.roadSlopeAnchorX) * 5
        roughness = 0.55
      }
      const noise = valueNoise(column * 0.35, row * 0.35) * 0.6 + valueNoise(column * 1.3, row * 1.3) * 0.4
      bed[index] = bedHeight + (noise - 0.5) * roughness * 2
      vertical[index] = region === 0 || region === 2 ? 0.95 : 1
      pin[index] = 0.62 + 0.76 * (valueNoise(column * 0.21 + 40, row * 0.21) * 0.5 + hashCell(column, row) * 0.5) * (region === 3 ? 1.25 : 1)
    }
  }

  const curbZ = wallZ + sidewalkRows * cellSize
  const roadEndZ = curbZ + roadRows * cellSize
  const right = [1, 0, 0] as Vec3
  const regions: FilmRegion[] = [
    { id: REGION_NAMES[0], firstRow: 0, rowCount: wallRows, origin: [originX, wallTopY, wallZ], columnAxis: right, rowAxis: [0, -1, 0], normal: [0, 0, 1], isVertical: true },
    { id: REGION_NAMES[1], firstRow: wallRows, rowCount: sidewalkRows, origin: [originX, sidewalkY, wallZ], columnAxis: right, rowAxis: [0, 0, 1], normal: [0, 1, 0], isVertical: false },
    { id: REGION_NAMES[2], firstRow: sidewalkEnd, rowCount: curbRows, origin: [originX, sidewalkY, curbZ], columnAxis: right, rowAxis: [0, -1, 0], normal: [0, 0, 1], isVertical: true },
    { id: REGION_NAMES[3], firstRow: curbEnd, rowCount: roadRows, origin: [originX, roadY, curbZ], columnAxis: right, rowAxis: [0, 0, 1], normal: [0, 1, 0], isVertical: false },
  ]
  const maxX = originX + columns * cellSize

  return {
    id: params.id,
    width: columns,
    height,
    cellSize,
    bed,
    pin,
    vertical,
    regions,
    rules,
    cellToWorld: (row, column) => cellToWorldOf(regions, cellSize, row, column),
    collide(previous, position) {
      if (position[2] <= wallZ && position[1] > sidewalkY) {
        position[2] = wallZ
        return 0
      }
      if (position[2] < curbZ && (!rules.guardBehindWall || position[2] >= wallZ) && position[1] <= sidewalkY) {
        position[1] = sidewalkY
        return 1
      }
      if (rules.curbCatch && position[2] >= curbZ && previous[2] < curbZ && position[1] < sidewalkY) {
        position[2] = curbZ
        return 2
      }
      if (position[2] >= curbZ && position[1] <= roadY) {
        position[1] = roadY
        return 3
      }
      return -1
    },
    impact: (region, position, velocity) => impactOf(regions[region]!, position, velocity, cellSize),
    contains: (position) => position[0] > originX && position[0] < maxX && (!rules.clipRoadEnd || position[2] < roadEndZ),
    escaped(position) {
      if (position[1] < -1) return true
      const box = rules.escapeBox
      return box !== undefined && (position[0] < box.minX || position[0] > box.maxX || position[2] > box.maxZ)
    },
  }
}

const PADRAO_CELL = 0.0125
const PADRAO_WALL_Z = 0

/** The Fluid Standard's grid: 256 x 396 cells of 1.25 cm over a 1.95 m wall, a 1.6 m sidewalk, a 15 cm curb and a 1.4 m road. */
export const PADRAO_LAYOUT: FilmLayout = createFoldedLayout({
  id: 'padrao',
  columns: 256,
  cellSize: PADRAO_CELL,
  originX: -1.6,
  wallRows: 144,
  sidewalkRows: 128,
  curbRows: 12,
  roadRows: 112,
  wallTopY: 1.95,
  sidewalkY: 0.15,
  roadY: 0,
  wallZ: PADRAO_WALL_Z,
  curbStep: PADRAO_CELL,
  roadSlopeAnchorX: 0,
  rules: {
    dropCapacity: 600,
    curbCatch: true,
    guardBehindWall: true,
    clipRoadEnd: true,
    escapeBox: { minX: -3, maxX: 3, maxZ: PADRAO_WALL_Z + 128 * PADRAO_CELL + 112 * PADRAO_CELL + 1 },
    dripStyle: 'padrao',
  },
})

const WORKSHOP_CELL = 0.0125

/** The Workshop's grid: 160 x 448 cells (wall 160, sidewalk 128, curb 9, road 151) at the foot of the workshop's wall. */
export const WORKSHOP_LAYOUT: FilmLayout = createFoldedLayout({
  id: 'workshop',
  columns: 160,
  cellSize: WORKSHOP_CELL,
  originX: -2.2,
  wallRows: 160,
  sidewalkRows: 128,
  curbRows: 9,
  roadRows: 151,
  wallTopY: 2.12,
  sidewalkY: 0.1235,
  roadY: 0.009,
  wallZ: -4.497,
  roadSlopeAnchorX: -1.2,
  rules: { dropCapacity: 400, curbCatch: false, guardBehindWall: false, clipRoadEnd: false, dripStyle: 'workshop' },
})
