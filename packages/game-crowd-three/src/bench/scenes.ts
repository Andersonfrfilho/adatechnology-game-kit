import { STATE, CELL } from '@adatechnology/game-crowd'
import type { Crowd, CrowdUpdateContext } from '@adatechnology/game-crowd'
import type { ModuleHost } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

/** The ground a scene lays out its things on: the crowd area centre. */
export type CrowdScenePlace = { readonly cx: number; readonly cz: number }

/** What the host project lends the scenes to draw with: its wall piece and the ids of the catalogue items it has (`ModuleHost.addObject`). Without them a scene only writes the grid. */
export type CrowdSceneProps = {
  /** An Object3D wall of this length and height, base at the origin along x (the kit's `wallPiece`). */
  readonly wall?: (three: typeof THREE_NS, size: { readonly length: number; readonly height: number }) => THREE_NS.Object3D | undefined
  /** Item ids of the host's catalogue: the gas cylinder, the car and the car's fuel tank. */
  readonly items?: { readonly gasCylinder?: string; readonly car?: string; readonly carTank?: string }
}

/** A place for the crowd to be born in, with the walls and doors of its own. The bench applies it after the seed and before the physics and the count. */
export interface CrowdBenchScene {
  readonly id: string
  /** Writes the walls and the doors of the scene to the crowd's grid. */
  layout(crowd: Crowd, place: CrowdScenePlace): void
  /** Bears `count` agents of `type` (-1: the pack's mix), the `first`-th of the scene onwards; `unit` is the seeded stream of the scene. */
  spawn(crowd: Crowd, request: { readonly first: number; readonly count: number; readonly type: number; readonly unit: () => number }, place: CrowdScenePlace): void
  /** The context of `crowd.update`: where the bands are centred and where the flow converges. */
  context?(place: CrowdScenePlace): Pick<CrowdUpdateContext, 'bandCentre' | 'flowTarget'>
  /** Where the camera stands to see the scene. */
  view(place: CrowdScenePlace): { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number] }
  /** Puts the scene's things in the host's world; returns what takes them away. */
  props?(host: ModuleHost, place: CrowdScenePlace, props: CrowdSceneProps): () => void
}

const WALL_LENGTH = 30
const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.5
const DOOR_WIDTH = 1.2
const BODY_COLUMNS = 50
const COLUMN_GAP = 0.6
const ROW_GAP = 0.55
const STREET_HALF_WIDTH = 6
const STREET_COLUMNS = 18
const STREET_LENGTH = 90
const CYLINDERS = 6
const CYLINDER_GAP = 1.5

const bear = (crowd: Crowd, x: number, z: number, type: number): void => {
  const i = crowd.spawn(x, z, type)
  if (i >= 0) crowd.store.state[i] = STATE.CHASE
}

const removers = (list: readonly (() => void)[]): (() => void) => () => {
  for (const remove of list) remove()
}

/** A horde pressed against a wall of 30 m with a door of 1.2 m, born behind it; the player stands on the other side. */
export const DENSE_WALL: CrowdBenchScene = {
  id: 'dense_wall',
  layout(crowd, { cx, cz }) {
    const half = WALL_LENGTH / 2
    crowd.grid.fillRect(cx - half, cz - WALL_THICKNESS / 2, cx - DOOR_WIDTH / 2, cz + WALL_THICKNESS / 2, CELL.SOLID, WALL_HEIGHT)
    crowd.grid.fillRect(cx + DOOR_WIDTH / 2, cz - WALL_THICKNESS / 2, cx + half, cz + WALL_THICKNESS / 2, CELL.SOLID, WALL_HEIGHT)
    crowd.doors.add(cx, cz, 'x', DOOR_WIDTH)
  },
  spawn(crowd, { first, count, type }, { cx, cz }) {
    for (let k = first; k < first + count; k++) {
      const row = Math.floor(k / BODY_COLUMNS)
      bear(crowd, cx + ((k % BODY_COLUMNS) - BODY_COLUMNS / 2 + (row % 2) * 0.5) * COLUMN_GAP, cz - 1.5 - row * ROW_GAP, type)
    }
  },
  context: ({ cx, cz }) => ({ bandCentre: [cx, cz - 8] }),
  view: ({ cx, cz }) => ({ eye: [cx, 1.7, cz + 9], target: [cx, 1.2, cz - 10] }),
  props(host, { cx, cz }, props) {
    const three = host.THREE as typeof THREE_NS
    const side = (WALL_LENGTH - DOOR_WIDTH) / 2
    const made: THREE_NS.Object3D[] = []
    for (const sign of [-1, 1]) {
      const wall = props.wall?.(three, { length: side, height: WALL_HEIGHT })
      if (!wall) continue
      wall.position.set(cx + sign * (DOOR_WIDTH / 2 + side / 2), 0, cz)
      ;(host.scene as THREE_NS.Object3D).add(wall)
      made.push(wall)
    }
    return () => {
      for (const wall of made) wall.removeFromParent()
    }
  },
}

/** A horde coming down a street of 12 m at a row of six gas cylinders and a car; the player stands at the end of the street. */
export const CHAIN_LINE: CrowdBenchScene = {
  id: 'chain_line',
  layout(crowd, { cx, cz }) {
    for (const sign of [-1, 1]) crowd.grid.fillRect(cx + sign * STREET_HALF_WIDTH, cz - STREET_LENGTH, cx + sign * (STREET_HALF_WIDTH + WALL_THICKNESS), cz + 20, CELL.SOLID, WALL_HEIGHT)
  },
  spawn(crowd, { first, count, type }, { cx, cz }) {
    for (let k = first; k < first + count; k++) {
      const row = Math.floor(k / STREET_COLUMNS)
      bear(crowd, cx + ((k % STREET_COLUMNS) - STREET_COLUMNS / 2 + (row % 2) * 0.5) * COLUMN_GAP, cz - 10 - row * ROW_GAP, type)
    }
  },
  context: ({ cx, cz }) => ({ bandCentre: [cx, cz - 14] }),
  view: ({ cx, cz }) => ({ eye: [cx, 1.7, cz + 14], target: [cx, 1.2, cz - 10] }),
  props(host, { cx, cz }, props) {
    const items = props.items
    const placed: (() => void)[] = []
    if (!host.addObject || !items) return removers(placed)
    if (items.gasCylinder) {
      for (let k = 0; k < CYLINDERS; k++) {
        const object = host.addObject(items.gasCylinder, { position: [cx + (k - (CYLINDERS - 1) / 2) * CYLINDER_GAP, 0, cz - 4] })
        if (object) placed.push(() => object.remove())
      }
    }
    for (const id of [items.car, items.carTank]) {
      const object = id ? host.addObject(id, { position: [cx, 0, cz + 2], rotationY: Math.PI / 2 }) : null
      if (object) placed.push(() => object.remove())
    }
    return removers(placed)
  },
}

export const BUILTIN_SCENES: Readonly<Record<string, CrowdBenchScene>> = { dense_wall: DENSE_WALL, chain_line: CHAIN_LINE }
