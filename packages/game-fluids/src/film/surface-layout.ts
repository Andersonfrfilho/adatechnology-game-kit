import { add, cross, dot, normalize, scale, sub } from '../math'
import { makeBasis } from '../stains'
import type { SurfaceSpec, Vec3 } from '../types'
import { valueNoise } from './noise'
import type { FilmLayout, FilmRegion, FilmRules } from './types'

export interface SurfaceLayoutOptions {
  /** The surface the film lies on (a floor, a table, a ramp). */
  floor: SurfaceSpec
  /** A wall that meets the floor: the film folds up it, so a splash on the wall runs down onto the floor. */
  wall?: SurfaceSpec
  /** The lower surface beyond the floor's far edge: the film folds down a curb face to it. Needs the wall or the floor's tangent to say where the edge is. */
  curb?: SurfaceSpec
  /** World point the grid is centred on (sideways; and along the floor when there is no wall). */
  center: Vec3
  /** Cells across (default 160: 2 m of 1.25 cm cells, the grid of the near-player manager). */
  columns?: number
  /** Cells along all strips together (default 160). */
  rows?: number
  /** Metres per cell (default 0.0125). */
  cellSize?: number
  /** Rows of the wall strip (default 48 with a wall, else 0) and cap of the curb face rows (default 12). */
  wallRows?: number
  curbRows?: number
}

const DEFAULT_COLUMNS = 160
const DEFAULT_ROWS = 160
const DEFAULT_CELL = 0.0125
const DEFAULT_WALL_ROWS = 48
const DEFAULT_CURB_ROWS = 12
const RULES: FilmRules = { dropCapacity: 160, curbCatch: false, guardBehindWall: false, clipRoadEnd: false, dripStyle: 'padrao' }

const along3 = (origin: Vec3, axis: Vec3, distance: number): Vec3 => add(origin, scale(axis, distance))

/** Removes the part of `vector` along the unit `axis`. */
const reject = (vector: Vec3, axis: Vec3): Vec3 => sub(vector, scale(axis, dot(vector, axis)))

interface Strip {
  id: string
  rows: number
  origin: Vec3
  rowAxis: Vec3
  normal: Vec3
  isVertical: boolean
  roughness: number
}

/**
 * Builds the folded grid from the host's surfaces: `wall` (optional) hangs above the fold line, `floor` runs away from the wall, and
 * `curb` (optional) is the lower surface the floor drops to over a curb face. Without a wall the grid is a flat patch of the floor around `center`.
 * Bed heights come from world y, so a tilted floor makes the film run downhill.
 */
export function layoutFromSurfaces(options: SurfaceLayoutOptions): FilmLayout {
  const columns = options.columns ?? DEFAULT_COLUMNS
  const totalRows = options.rows ?? DEFAULT_ROWS
  const cell = options.cellSize ?? DEFAULT_CELL
  const floorBasis = makeBasis(options.floor.normal, options.floor.tangent)
  const floorNormal = floorBasis.normal
  const projected = sub(options.center, scale(floorNormal, dot(sub(options.center, options.floor.point), floorNormal)))
  const wallNormal = options.wall ? normalize(reject(options.wall.normal, floorNormal), floorBasis.t2) : undefined
  const awayAxis = wallNormal ?? floorBasis.t2
  const columnAxis = wallNormal ? normalize(cross(floorNormal, wallNormal), floorBasis.t1) : floorBasis.t1
  const wallRows = options.wall ? Math.min(totalRows - 1, options.wallRows ?? DEFAULT_WALL_ROWS) : 0

  let fold = projected
  if (options.wall && wallNormal) {
    const toWall = dot(sub(projected, options.wall.point), wallNormal) / (dot(awayAxis, wallNormal) || 1)
    fold = sub(projected, scale(awayAxis, toWall))
  } else {
    fold = along3(projected, awayAxis, -(totalRows * cell) / 2)
  }
  const lateral = dot(sub(projected, fold), columnAxis) - (columns * cell) / 2
  const base = along3(fold, columnAxis, lateral)

  const strips: Strip[] = []
  const roughness = 0.18 + 0.4 * options.floor.porosity
  if (options.wall && wallNormal) {
    strips.push({ id: 'wall', rows: wallRows, origin: along3(base, floorNormal, wallRows * cell), rowAxis: scale(floorNormal, -1), normal: wallNormal, isVertical: true, roughness: 0.3 })
  }
  const lowerRows = totalRows - wallRows
  const dropMetres = options.curb ? Math.max(0, dot(sub(options.floor.point, options.curb.point), floorNormal)) : 0
  const curbRows = options.curb ? Math.min(options.curbRows ?? DEFAULT_CURB_ROWS, Math.max(1, Math.ceil(dropMetres / cell)), lowerRows - 2) : 0
  const floorRows = options.curb ? Math.max(1, Math.floor((lowerRows - curbRows) / 2)) : lowerRows
  strips.push({ id: 'floor', rows: floorRows, origin: base, rowAxis: awayAxis, normal: floorNormal, isVertical: false, roughness })
  if (options.curb) {
    const edge = along3(base, awayAxis, floorRows * cell)
    strips.push({ id: 'curb', rows: curbRows, origin: edge, rowAxis: scale(floorNormal, -1), normal: awayAxis, isVertical: true, roughness: 0.2 })
    const lowerOrigin = along3(edge, floorNormal, -curbRows * cell)
    strips.push({ id: 'low', rows: lowerRows - floorRows - curbRows, origin: lowerOrigin, rowAxis: awayAxis, normal: floorNormal, isVertical: false, roughness: 0.55 })
  }

  const regions: FilmRegion[] = []
  let firstRow = 0
  for (const strip of strips) {
    regions.push({ id: strip.id, firstRow, rowCount: strip.rows, origin: strip.origin, columnAxis, rowAxis: strip.rowAxis, normal: strip.normal, isVertical: strip.isVertical })
    firstRow += strip.rows
  }

  const height = firstRow
  const bed = new Float32Array(columns * height)
  const pin = new Float32Array(columns * height)
  const vertical = new Float32Array(columns * height)
  regions.forEach((region, regionIndex) => {
    const strip = strips[regionIndex]!
    for (let row = 0; row < region.rowCount; row++) {
      for (let column = 0; column < columns; column++) {
        const index = (region.firstRow + row) * columns + column
        const centre = add(add(region.origin, scale(columnAxis, (column + 0.5) * cell)), scale(region.rowAxis, (row + 0.5) * cell))
        const noise = valueNoise(column * 0.35, (region.firstRow + row) * 0.35) * 0.6 + valueNoise(column * 1.3, (region.firstRow + row) * 1.3) * 0.4
        bed[index] = centre[1] * 1000 + (noise - 0.5) * strip.roughness * 2
        vertical[index] = region.isVertical ? 0.95 : 1
        pin[index] = 0.62 + 0.76 * (valueNoise(column * 0.21 + 40, (region.firstRow + row) * 0.21) * 0.5 + valueNoise(column * 0.9, row * 0.9) * 0.5)
      }
    }
  })

  const lowestY = Math.min(...regions.map((region) => region.origin[1] - (region.rowAxis[1] > 0 ? 0 : region.rowCount * cell * Math.abs(region.rowAxis[1])))) - 1
  const width = columns * cell
  const cellToWorld = (row: number, column: number): Vec3 => {
    const region = regions.find((candidate) => row < candidate.firstRow + candidate.rowCount) ?? regions[regions.length - 1]!
    return add(add(region.origin, scale(region.columnAxis, column * cell)), scale(region.rowAxis, (row - region.firstRow) * cell))
  }

  return {
    id: 'surfaces',
    width: columns,
    height,
    cellSize: cell,
    bed,
    pin,
    vertical,
    regions,
    rules: RULES,
    cellToWorld,
    collide(previous, position) {
      for (let index = 0; index < regions.length; index++) {
        const region = regions[index]!
        const before = dot(sub(previous, region.origin), region.normal)
        const after = dot(sub(position, region.origin), region.normal)
        if (before < 0 || after > 0) continue
        const local = sub(position, region.origin)
        const sideways = dot(local, region.columnAxis)
        const downward = dot(local, region.rowAxis)
        if (sideways < 0 || sideways >= width || downward < 0 || downward >= region.rowCount * cell) continue
        position[0] -= region.normal[0] * after
        position[1] -= region.normal[1] * after
        position[2] -= region.normal[2] * after
        return index
      }
      return -1
    },
    impact(regionIndex, position, velocity) {
      const region = regions[regionIndex]!
      const local = sub(position, region.origin)
      return {
        row: region.firstRow + dot(local, region.rowAxis) / cell,
        column: dot(local, region.columnAxis) / cell,
        along: [dot(velocity, region.columnAxis), dot(velocity, region.rowAxis)],
        normalSpeed: -dot(velocity, region.normal),
      }
    },
    contains: () => true,
    escaped: (position) => position[1] < lowestY,
  }
}
