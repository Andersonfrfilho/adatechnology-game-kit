import { NAV_OBSTACLE_KIND } from '@adatechnology/game-contracts'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import type { NavObstacle, NavObstacleBox, NavObstacleSource } from '@adatechnology/game-contracts'

import type { BoxCollider } from '../kernel-types.js'
import type { House, HouseFurnitureCollider } from '../types.js'

/** Height (m) a lot wall, a fence or a grille stands to a walker; a closed door's and gate's leaf. */
const LOT_WALL_HEIGHT = 2
const DOOR_HEIGHT = 2.1
const RAILING_HEIGHT = 1
const DEFAULT_WALL_HEIGHT = 2.8
/** What a walker's body spans over its floor (m): a piece of wall under the knees or over the head does not stop it. */
const BODY_LOW = 0.25
const BODY_HIGH = 1.5
/** Step (m) a cut wall is read in along its length: what stands of it is merged into boxes this fine. */
const CUT_STEP = 0.25
/** The part states the destruction still draws standing (what `follow.blocks` answers for too). */
const STANDING_STATUS = new Set(['intact', 'damaged', 'collapsed'])
/** The destruction events after which what stands of a wall may differ. */
const CUT_EVENTS = new Set(['stage', 'spall', 'fracture', 'collapse', 'detach'])

type Rect = readonly [number, number, number, number]

type Entry = {
  readonly id: string
  readonly house: House
  readonly collider: BoxCollider
  readonly kind: NavObstacle['kind']
  /** The house part that opens the door or gate (`parts[...].opens`). */
  readonly opener: ((t: number) => void) | null
  readonly boards: number
  readonly wallHeight: number
  obstacle: NavObstacle
}

export type HouseNavObstacles = NavObstacleSource & {
  /** Route the renderer's `onCollider` here: a door or a gate of one of the houses opened or closed. */
  colliderChanged(collider: BoxCollider | HouseFurnitureCollider): void
  /** Stops listening to the houses' destruction. */
  dispose(): void
}

const isBox = (collider: BoxCollider | HouseFurnitureCollider): collider is BoxCollider => 'x0' in collider
const overlaps = (a: BoxCollider, b: BoxCollider): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

/** A rectangle of the house's space in the world, by the inner group's world matrix (a house turns by quarter turns: its boxes stay boxes). */
function worldRect(house: House, rect: Rect): Rect {
  const e = house.house.matrixWorld.elements
  const xs: number[] = []
  const zs: number[] = []
  for (const [x, z] of [[rect[0], rect[1]], [rect[2], rect[1]], [rect[0], rect[3]], [rect[2], rect[3]]] as const) {
    xs.push(e[0]! * x + e[8]! * z + e[12]!)
    zs.push(e[2]! * x + e[10]! * z + e[14]!)
  }
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]
}

/** Merges the heights read along a wall (`step` m each, from `start`) into runs of the same kind: gone, low or solid. */
function runsOf(heights: readonly number[], start: number, step: number): Array<{ readonly a: number; readonly b: number; readonly height: number }> {
  const runs: Array<{ a: number; b: number; height: number }> = []
  const classOf = (height: number): number => (height <= 0 ? 0 : height < BODY_HIGH ? 1 : 2)
  heights.forEach((height, index) => {
    const last = runs[runs.length - 1]
    const a = start + index * step
    if (last && classOf(last.height) === classOf(height) && Math.abs(last.b - a) < 1e-9) {
      last.b = a + step
      last.height = Math.max(last.height, height)
    } else runs.push({ a, b: a + step, height })
  })
  return runs.filter((run) => run.height > 0)
}

/** The boxes a wall of the ground floor stands in now: whole, the pieces a cut left (by what the destruction world says stands), or none when it is gone. */
function wallBoxes(entry: Entry): NavObstacleBox[] {
  const { house, collider } = entry
  const whole = [{ rect: worldRect(house, [collider.x0, collider.z0, collider.x1, collider.z1]), height: entry.wallHeight }]
  const piece = collider.piece
  if (!piece || !house.structure.byId.has(piece) || !house.destruction.active) return whole
  const state = house.destruction.piece(piece)
  if (state && !STANDING_STATUS.has(state.status)) return []
  const left = house.destruction.breach.standing(piece)
  if (!left) return whole
  const floorY = house.r.floors[0]?.y0 ?? 0
  const s0 = left.alongU ? collider.x0 : collider.z0
  const s1 = left.alongU ? collider.x1 : collider.z1
  const count = Math.max(1, Math.ceil((s1 - s0) / CUT_STEP))
  const heights = new Array<number>(count).fill(0)
  for (const span of left.spans) {
    if (span.y1 <= floorY + BODY_LOW || span.y0 >= floorY + BODY_HIGH) continue
    // a piece hanging over a hole still stops a walker: it stands as tall as its top
    const height = span.y1 - floorY
    const a = left.start + span.a
    const b = left.start + span.b
    for (let index = Math.max(0, Math.floor((a - s0) / CUT_STEP)); index < Math.min(count, Math.ceil((b - s0) / CUT_STEP)); index++) heights[index] = Math.max(heights[index]!, height)
  }
  return runsOf(heights, s0, CUT_STEP).map((run) => ({
    rect: worldRect(house, left.alongU ? [run.a, collider.z0, Math.min(run.b, s1), collider.z1] : [collider.x0, run.a, collider.x1, Math.min(run.b, s1)]),
    height: run.height,
  }))
}

const obstacleOf = (entry: Entry): NavObstacle => {
  const { collider } = entry
  if (entry.kind === NAV_OBSTACLE_KIND.DOOR) {
    return { id: entry.id, kind: entry.kind, boxes: [{ rect: worldRect(entry.house, [collider.x0, collider.z0, collider.x1, collider.z1]), height: DOOR_HEIGHT }], open: collider.off === true, boards: entry.boards }
  }
  return { id: entry.id, kind: entry.kind, boxes: collider.type === 'wall' ? wallBoxes(entry) : [{ rect: worldRect(entry.house, [collider.x0, collider.z0, collider.x1, collider.z1]), height: entry.wallHeight }], open: false, boards: 0 }
}

const sameBoxes = (a: readonly NavObstacleBox[], b: readonly NavObstacleBox[]): boolean =>
  a.length === b.length && a.every((box, index) => box.height === b[index]!.height && box.rect.every((value, k) => value === b[index]!.rect[k]))

/** Every house part that opens a door leaf or a gate, by its collider. */
function openersOf(house: House): Map<BoxCollider, (t: number) => void> {
  const openers = new Map<BoxCollider, (t: number) => void>()
  for (const part of Object.values(house.parts)) {
    const leaf = part.leaf as { col?: BoxCollider | null } | undefined
    const def = part.def as { col?: BoxCollider | null } | undefined
    const collider = leaf?.col ?? def?.col
    if (collider) openers.set(collider, (t) => part.opens(t))
  }
  return openers
}

function entriesOf(house: House, index: number): Entry[] {
  const boxes = house.colliders.filter(isBox).filter((collider) => collider.f === 0 || collider.f === -1)
  const boards = boxes.filter((collider) => collider.type === 'board')
  const openers = openersOf(house)
  const floor = house.r.floors[0]
  const wallById = new Map(house.r.walls.map((wall) => [wall.id, wall]))
  const entries: Entry[] = []
  boxes.forEach((collider, at) => {
    const isDoor = collider.type === 'door' || collider.type === 'gate'
    const isSolid = collider.type === 'wall' || collider.type === 'lot_wall' || collider.type === 'board'
    if (!isDoor && !isSolid) return
    // a barricade's boards over a door make the door harder to break; the rest stand in their wall
    if (collider.type === 'board' && boxes.some((other) => other.type === 'door' && overlaps(other, collider))) return
    const wall = collider.piece ? wallById.get(collider.piece) : undefined
    const wallHeight = collider.type === 'lot_wall' ? LOT_WALL_HEIGHT : wall?.type === 'railing' ? RAILING_HEIGHT : Number(wall?.h) || floor?.ceiling || DEFAULT_WALL_HEIGHT
    const entry: Entry = {
      id: `${index}:${at}`,
      house,
      collider,
      kind: isDoor ? NAV_OBSTACLE_KIND.DOOR : NAV_OBSTACLE_KIND.SOLID,
      opener: openers.get(collider) ?? null,
      boards: collider.type === 'door' ? boards.filter((board) => overlaps(board, collider)).length : 0,
      wallHeight,
      obstacle: undefined as unknown as NavObstacle,
    }
    entry.obstacle = obstacleOf(entry)
    entries.push(entry)
  })
  return entries
}

/** The ids of the parts an event of the destruction world touched. */
const partsOf = (event: DestructionEvent): readonly string[] => {
  if ('parts' in event && Array.isArray(event.parts)) return event.parts as readonly string[]
  if ('part' in event && typeof event.part === 'string') return [event.part]
  return []
}

/**
 * What the houses put on the ground for a walker's grid (`NavObstacleSource` of `game-contracts`, which `bindNavObstacles` of `game-crowd` writes into the horde's grid):
 * the walls of each ground floor, the lot walls, fences and grilles, the barricade's boards, and the doors and gates (open or closed), in the world, read when this is
 * called (each house placed and its matrix updated). A door or gate that opens or closes (route the renderer's `onCollider` to `colliderChanged`) and a wall the
 * destruction cuts (what stands of it, as `follow.blocks` reads it) come out of `changes()` at the next call; a door the horde broke is swung open.
 */
export function createHouseNavObstacles(houses: readonly House[]): HouseNavObstacles {
  const entries = houses.flatMap((house, index) => entriesOf(house, index))
  const byCollider = new Map(entries.map((entry) => [entry.collider, entry]))
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const dirty = new Set<Entry>()
  const NONE: readonly NavObstacle[] = []
  const offs = houses.map((house) => {
    const walls = new Map<string, Entry[]>()
    for (const entry of entries) {
      const piece = entry.house === house && entry.collider.type === 'wall' ? entry.collider.piece : undefined
      if (piece) walls.set(piece, [...(walls.get(piece) ?? []), entry])
    }
    return house.destruction.onEvent((event) => {
      if (!CUT_EVENTS.has(event.type)) return
      for (const part of partsOf(event)) for (const id of [part, ...house.destruction.breach.hosts(part)]) for (const entry of walls.get(id) ?? []) dirty.add(entry)
    })
  })
  return {
    obstacles: () => entries.map((entry) => entry.obstacle),
    changes() {
      if (dirty.size === 0) return NONE
      const changed: NavObstacle[] = []
      // in the order the houses gave them, so the grid changes the same way on every run
      for (const entry of entries) {
        if (!dirty.has(entry)) continue
        const next = obstacleOf(entry)
        if (next.open === entry.obstacle.open && sameBoxes(next.boxes, entry.obstacle.boxes)) continue
        entry.obstacle = next
        changed.push(next)
      }
      dirty.clear()
      return changed
    },
    breakDoor(id) {
      const entry = byId.get(id)
      if (entry?.opener && entry.collider.off !== true) entry.opener(1)
    },
    colliderChanged(collider) {
      const entry = isBox(collider) ? byCollider.get(collider) : undefined
      if (entry) dirty.add(entry)
    },
    dispose() {
      for (const off of offs) off()
    },
  }
}
