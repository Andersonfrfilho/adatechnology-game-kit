import type { AreaPlacement, Vec3 } from '@adatechnology/game-contracts'

/** What the layout needs of an item: its id, category and real size [width, height, depth] in metres. */
export interface LayoutItem {
  readonly id: string
  readonly category: string
  readonly size: readonly [number, number, number]
}

/** Height of the top of a shelf, metres. */
export const SHELF_HEIGHT = 0.9
/** Longest row of items on a shelf, metres. */
export const ROW_LIMIT = 5
const GAP = 0.06
const EDGE = 0.12
const COLUMNS = 4
const COLUMN_PITCH = 6.2
const ROW_GAP = 1.5
const FIRST_Z = -11

/** One shelf: a category's items laid out in rows at real size, the shelf's footprint and where its items sit on its top. */
export interface ShelfPlan {
  category: string
  /** Item id of the shelf in the module (`shelf_<category>`). */
  id: string
  /** Footprint on the floor: length along x, depth along z. */
  length: number
  depth: number
  position: Vec3
  /** Where each item sits, in world coordinates. */
  items: AreaPlacement[]
}

export const SHELF_PREFIX = 'shelf_'
export const ITEM_PREFIX = 'item_'
export const SHOWCASE_PREFIX = 'showcase_'

interface Row {
  items: LayoutItem[]
  width: number
  depth: number
}

const rowsOf = (items: readonly LayoutItem[]): Row[] => {
  const rows: Row[] = []
  for (const item of items) {
    const [w, , d] = item.size
    let row = rows[rows.length - 1]
    if (!row || (row.items.length > 0 && row.width + w + GAP > ROW_LIMIT)) {
      row = { items: [], width: 0, depth: 0 }
      rows.push(row)
    }
    row.items.push(item)
    row.width += w + GAP
    row.depth = Math.max(row.depth, d)
  }
  return rows
}

/**
 * The shelves of the area: one per category, in the order the categories come, with every item of the category side by side at real size, wrapped in rows of at most
 * `ROW_LIMIT` metres. Shelves stand in a grid of four columns; an item that is longer than the row limit gets a row to itself. Pure: the same items always land in the same spots.
 */
export function shelvesLayout(items: readonly LayoutItem[], categories: readonly string[]): ShelfPlan[] {
  const plans = categories.flatMap((category) => {
    const own = items.filter((item) => item.category === category)
    if (own.length === 0) return []
    const rows = rowsOf(own)
    const length = Math.max(...rows.map((row) => row.width - GAP)) + 2 * EDGE
    const depth = rows.reduce((sum, row) => sum + row.depth + GAP, 0) - GAP + 2 * EDGE
    return [{ category, rows, length, depth }]
  })
  const result: ShelfPlan[] = []
  let z = FIRST_Z
  for (let start = 0; start < plans.length; start += COLUMNS) {
    const line = plans.slice(start, start + COLUMNS)
    const lineDepth = Math.max(...line.map((plan) => plan.depth))
    line.forEach((plan, column) => {
      const x = (column - (COLUMNS - 1) / 2) * COLUMN_PITCH
      const centre: Vec3 = [x, 0, z + plan.depth / 2]
      const placed: AreaPlacement[] = []
      let rowZ = -plan.depth / 2 + EDGE
      for (const row of plan.rows) {
        let cursor = -plan.length / 2 + EDGE
        for (const item of row.items) {
          const [w, , d] = item.size
          placed.push({ item: `${ITEM_PREFIX}${item.id}`, position: [centre[0] + cursor + w / 2, SHELF_HEIGHT + 0.01, centre[2] + rowZ + d / 2], asleep: true })
          cursor += w + GAP
        }
        rowZ += row.depth + GAP
      }
      result.push({ category: plan.category, id: `${SHELF_PREFIX}${plan.category}`, length: plan.length, depth: plan.depth, position: centre, items: placed })
    })
    z += lineDepth + ROW_GAP
  }
  return result
}
