// The layout of the house-and-yard-on-tables area: the tables of every room in lines from the front (the player comes from +z), the floor pieces of every room
// in lines behind them, what hangs on a wall on the face of the room's target wall. Pure given the room's `measure`.
import { GOODS_HOUSE_POOLS } from '@adatechnology/game-items-goods'
import { FINDS_TABLE_ID, ITEM_PREFIX } from '@adatechnology/game-items-three'
import type { AreaPlacement, GroundLayout, GroundZone, ModuleArea, Vec3 } from '@adatechnology/game-contracts'
import type { ItemSize } from '@adatechnology/game-test-room'

import type { HouseSection, Locale } from './house-tables-data.js'

/** The room's target wall: centred on x = 0, its middle plane at z = -11, 15 cm thick, plus the plaster of the houses' renderer; 10 m long. */
const WALL = { halfLength: 4.6, front: -11 + 0.075 + 0.025 } as const
const GROUND_SURFACE = 'concrete_slab'
const FLOOR_GAP = 0.7
const WALL_GAP = 0.25
const AISLE = 1.8
const TABLE_GAP = 0.9
const ITEM_GAP = 0.08
const TABLE_EDGE = 0.08
/** Height the things on a table are let go from above its top, metres. */
const DROP = 0.01

/** What to lay and where: the rooms, the half width (x) of the strip the lines run in, the z of the front edge of the first line, and what goes on the wall. */
export interface HousePlan {
  readonly sections: readonly HouseSection[]
  readonly halfX: number
  readonly firstZ: number
  readonly wall: readonly string[]
}

/** What the layout made: the area, its floor (a zone per room, labelled), and the ids the room's catalogue does not have (left out). */
export interface HouseTablesLayout {
  readonly area: ModuleArea
  readonly ground: GroundLayout
  readonly missing: readonly string[]
  /** The catalogue ids laid on tables and on the floor. */
  readonly onTables: ReadonlySet<string>
  readonly onFloor: ReadonlySet<string>
}

interface Piece {
  readonly item: string
  readonly size: ItemSize
}

export const textOf = (locale: Locale, pair: readonly [string, string]): string => (locale === 'en' ? pair[1] : pair[0])

/** The goods of a room's pools, each once (the first room that keeps it), as catalogue ids. */
function goodsOf(section: HouseSection, taken: Set<string>): string[] {
  const ids: string[] = []
  for (const key of section.pools) {
    for (const entry of GOODS_HOUSE_POOLS.pools[GOODS_HOUSE_POOLS.aliasOf[key] ?? key] ?? []) {
      const id = `${ITEM_PREFIX}${entry.item}`
      if (taken.has(id)) continue
      taken.add(id)
      ids.push(id)
    }
  }
  return ids
}

/** Rows of pieces that fit `length` metres side by side, `gap` apart (a piece longer than the row gets one of its own). */
function rowsOf(pieces: readonly Piece[], length: number): Piece[][] {
  const rows: Piece[][] = []
  let width = 0
  for (const piece of pieces) {
    const row = rows.at(-1)
    if (!row || width + ITEM_GAP + piece.size.w > length) {
      rows.push([piece])
      width = piece.size.w
      continue
    }
    row.push(piece)
    width += ITEM_GAP + piece.size.w
  }
  return rows
}

const depthOf = (pieces: readonly Piece[]): number => Math.max(...pieces.map((piece) => piece.size.d))

/** The tables of a room: its rows stacked from the front edge of a table back, a new table when the next row does not fit on it. */
function tablesOf(pieces: readonly Piece[], table: ItemSize): Piece[][][] {
  const tables: Piece[][][] = []
  let depth = 0
  for (const row of rowsOf(pieces, table.w - 2 * TABLE_EDGE)) {
    const current = tables.at(-1)
    if (!current || depth + ITEM_GAP + depthOf(row) > table.d - 2 * TABLE_EDGE) {
      tables.push([row])
      depth = depthOf(row)
      continue
    }
    current.push(row)
    depth += ITEM_GAP + depthOf(row)
  }
  return tables
}

/** The things on one table, rows from the front edge (the player's side) back, left to right. */
function onTable(rows: readonly Piece[][], centre: Vec3, table: ItemSize): AreaPlacement[] {
  const placements: AreaPlacement[] = []
  let rowFront = centre[2] + table.d / 2 - TABLE_EDGE
  for (const row of rows) {
    let cursor = centre[0] - table.w / 2 + TABLE_EDGE
    for (const piece of row) {
      placements.push({ item: piece.item, position: [cursor + piece.size.w / 2, table.h + DROP, rowFront - piece.size.d / 2], asleep: true })
      cursor += piece.size.w + ITEM_GAP
    }
    rowFront -= depthOf(row) + ITEM_GAP
  }
  return placements
}

/** A line of floor pieces at one z: what is on it (with the room it belongs to and the x of its centre) and how deep it is. */
interface Line {
  readonly entries: Array<{ readonly section: number; readonly piece: Piece; readonly x: number }>
  depth: number
  cursor: number
}

/** Packs the rooms' pieces left to right in lines `2 * halfX` long, a room after the other on the same line while it fits. */
function linesOf(groups: ReadonlyArray<readonly Piece[]>, halfX: number): Line[] {
  const lines: Line[] = [{ entries: [], depth: 0, cursor: -halfX }]
  groups.forEach((pieces, section) => {
    for (const piece of pieces) {
      let line = lines[lines.length - 1]
      if (line.entries.length > 0 && line.cursor + piece.size.w > halfX) {
        line = { entries: [], depth: 0, cursor: -halfX }
        lines.push(line)
      }
      line.entries.push({ section, piece, x: line.cursor + piece.size.w / 2 })
      line.cursor += piece.size.w + FLOOR_GAP
      line.depth = Math.max(line.depth, piece.size.d)
    }
  })
  return lines.filter((line) => line.entries.length > 0)
}

/** The floor zones a line covers, one per room on it, labelled where the room first shows. */
function zonesOf(line: Line, z: number, sections: readonly HouseSection[], label: (index: number) => string | undefined): GroundZone[] {
  return sections.flatMap((section, index) => {
    const own = line.entries.filter((entry) => entry.section === index)
    if (own.length === 0) return []
    const x0 = Math.min(...own.map((entry) => entry.x - entry.piece.size.w / 2)) - FLOOR_GAP / 2
    const x1 = Math.max(...own.map((entry) => entry.x + entry.piece.size.w / 2)) + FLOOR_GAP / 2
    const text = label(index)
    return [{ rect: [x0, z - line.depth / 2 - 0.5, x1, z + line.depth / 2 + 0.5], surface: section.surface, ...(text ? { label: text } : {}) }]
  })
}

/** What hangs on a wall, side by side on the face of the target wall, centred (each model is drawn at the height it hangs). */
function onTheWall(pieces: readonly Piece[]): AreaPlacement[] {
  const length = pieces.reduce((sum, piece) => sum + piece.size.w, 0) + WALL_GAP * Math.max(0, pieces.length - 1)
  let x = -Math.min(length, 2 * WALL.halfLength) / 2
  return pieces.map((piece) => {
    const placement: AreaPlacement = { item: piece.item, position: [x + piece.size.w / 2, 0, WALL.front + piece.size.d / 2] }
    x += piece.size.w + WALL_GAP
    return placement
  })
}

/**
 * Lays `plan`. `measure` is the room's (`TestRoom.measure`): null for an id the room did not load, which is left out and listed in `missing`.
 * The tables are the items area's finds table, laid with a `surface` so what lies on them rests on their top.
 */
export function layHouseTables(measure: (itemId: string) => ItemSize | null, locale: Locale, plan: HousePlan): HouseTablesLayout {
  const missing: string[] = []
  const pieceOf = (item: string): Piece[] => {
    const size = measure(item)
    if (size) return [{ item, size }]
    missing.push(item)
    return []
  }
  const table = measure(FINDS_TABLE_ID)
  if (!table) missing.push(FINDS_TABLE_ID)
  const placements: AreaPlacement[] = []
  const zones: GroundZone[] = []
  const taken = new Set<string>()
  const onTables = new Set<string>()

  // the tables, a room after the other along the line, a new line when the next table does not fit
  let z = plan.firstZ
  let x = -plan.halfX
  for (const section of plan.sections) {
    const pieces = [...goodsOf(section, taken), ...section.onTable].flatMap(pieceOf)
    if (!table) continue
    for (const [index, rows] of tablesOf(pieces, table).entries()) {
      if (x + table.w > plan.halfX) {
        x = -plan.halfX
        z -= table.d + AISLE
      }
      const centre: Vec3 = [x + table.w / 2, 0, z - table.d / 2]
      placements.push({ item: FINDS_TABLE_ID, position: centre, surface: { halfSize: [table.w / 2, table.d / 2], height: table.h } })
      const laid = onTable(rows, centre, table)
      for (const placement of laid) onTables.add(placement.item)
      placements.push(...laid)
      const label = index === 0 ? textOf(locale, section.name) : undefined
      zones.push({ rect: [centre[0] - table.w / 2, centre[2] - table.d / 2 - 0.4, centre[0] + table.w / 2, centre[2] + table.d / 2 + 0.6], surface: section.surface, ...(label ? { label } : {}) })
      x += table.w + TABLE_GAP
    }
  }

  // the floor pieces, room by room, in lines behind the tables
  z -= (table?.d ?? 0) + AISLE
  const labelled = new Set<number>()
  const label = (index: number): string | undefined => {
    if (labelled.has(index)) return undefined
    labelled.add(index)
    const section = plan.sections[index]
    return section ? textOf(locale, section.name) : undefined
  }
  const onFloor = new Set<string>()
  for (const line of linesOf(plan.sections.map((section) => section.floor.flatMap(pieceOf)), plan.halfX)) {
    const centreZ = z - line.depth / 2
    for (const entry of line.entries) {
      placements.push({ item: entry.piece.item, position: [entry.x, 0, centreZ] })
      onFloor.add(entry.piece.item)
    }
    zones.push(...zonesOf(line, centreZ, plan.sections, label))
    z = centreZ - line.depth / 2 - AISLE
  }

  // what stands on a counter is drawn at the counter's height: it is laid over the piece it stands on
  for (const section of plan.sections) {
    for (const [item, base] of Object.entries(section.onTopOf ?? {})) {
      const under = placements.find((placement) => placement.item === base)
      if (!under || pieceOf(item).length === 0) continue
      placements.push({ item, position: [under.position[0], 0, under.position[2]] })
      onFloor.add(item)
    }
  }

  placements.push(...onTheWall(plan.wall.flatMap(pieceOf)))

  return {
    area: { placements, view: { eye: [0, 6.5, plan.firstZ + 6], target: [0, 0.6, plan.firstZ - 6] } },
    ground: { surface: GROUND_SURFACE, zones },
    missing,
    onTables,
    onFloor,
  }
}
