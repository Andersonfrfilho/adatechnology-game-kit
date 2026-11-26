import type { BodyId, JointId, PhysicsLoop } from '@adatechnology/game-physics'

import { DOOR_DEFAULTS } from './doors'
import type { Doors } from './doors'

export type DoorBodiesOptions = {
  /** Mass (kg) of a leaf. Default 40. */
  readonly leafMass?: number
  /** The impulse (N s) in one step that tears the hinge off: past it the door gives way. Default 40. */
  readonly breakImpulse?: number
  /** Height (m) of a leaf. Default `DOOR_DEFAULTS.height`. */
  readonly height?: number
}

export type DoorBodies = {
  /** The leaf of the door, while it is closed and on its hinge. */
  leafOf(index: number): BodyId | undefined
  /** Takes the phase out of the loop and the frames and leaves out of the world. */
  dispose(): void
}

const DEFAULT_LEAF_MASS = 40
const DEFAULT_BREAK_IMPULSE = 40
const LEAF_HALF_THICKNESS = 0.03
const HINGE_PLAY = 0.05

type Hung = { readonly door: number; readonly frame: BodyId; readonly leaf: BodyId; readonly hinge: JointId }

/**
 * A closed door as a leaf on a hinge that gives way: a dynamic box on the `prop` layer on a frame post, the hinge limited to a hair of play and with a `breakImpulse`.
 * The agents (kinematic capsules) press on it; when the hinge breaks the door is `broken` for the crowd (`doors.hit` with all its hit points: the grid opens, the events fire).
 * A door that opens or breaks by another cause (`doors.set`, the pressure of the field) loses its leaf at the next frame, and one shut again or added gets a leaf.
 * A leaf torn off by a hinge that broke stays in the world as a prop until that door hangs a new leaf, or until `dispose`.
 */
export const createDoorBodies = (loop: PhysicsLoop, doors: Doors, options: DoorBodiesOptions = {}): DoorBodies => {
  const world = loop.world
  const leafMass = options.leafMass ?? DEFAULT_LEAF_MASS
  const breakImpulse = options.breakImpulse ?? DEFAULT_BREAK_IMPULSE
  const height = options.height ?? DOOR_DEFAULTS.height
  const hung = new Map<number, Hung>()
  const doorOfHinge = new Map<JointId, number>()
  // the leaf a door tore off its hinge stays in the world as a prop, kept here so the next leaf of that door (shut again) and `dispose` can take it out
  const tornLeaves = new Map<number, BodyId>()

  const removeTornLeaf = (index: number): void => {
    const leaf = tornLeaves.get(index)
    if (leaf === undefined) return
    tornLeaves.delete(index)
    if (world.has(leaf)) world.removeBody(leaf)
  }

  const hang = (index: number): void => {
    const door = doors.list[index]
    if (!door || door.open || door.broken || hung.has(index)) return
    removeTornLeaf(index)
    const alongX = door.axis === 'x'
    const half = door.width / 2
    const hingeAt: [number, number, number] = alongX ? [door.x - half, height / 2, door.z] : [door.x, height / 2, door.z - half]
    const frame = world.createBody({
      shape: { kind: 'box', half: [0.05, height / 2, 0.05] },
      motion: 'static',
      position: hingeAt,
      user: -1,
    })
    const leaf = world.createBody({
      shape: { kind: 'box', half: alongX ? [half - 0.02, height / 2 - 0.02, LEAF_HALF_THICKNESS] : [LEAF_HALF_THICKNESS, height / 2 - 0.02, half - 0.02] },
      motion: 'dynamic',
      mass: leafMass,
      position: [door.x, height / 2, door.z],
      layer: 'prop',
      user: -2 - index,
    })
    const hinge = world.createJoint({
      kind: 'hinge', a: frame, b: leaf, point: hingeAt, axis: [0, 1, 0], normal: alongX ? [1, 0, 0] : [0, 0, 1], min: -HINGE_PLAY, max: HINGE_PLAY, breakImpulse,
    })
    hung.set(index, { door: index, frame, leaf, hinge })
    doorOfHinge.set(hinge, index)
  }

  const drop = (entry: Hung, keepLeaf: boolean): void => {
    doorOfHinge.delete(entry.hinge)
    hung.delete(entry.door)
    if (world.jointExists(entry.hinge)) world.removeJoint(entry.hinge)
    if (world.has(entry.frame)) world.removeBody(entry.frame)
    if (!keepLeaf && world.has(entry.leaf)) world.removeBody(entry.leaf)
  }

  const afterSteps = (): void => {
    for (const joint of world.brokenJoints) {
      const index = doorOfHinge.get(joint)
      const entry = index === undefined ? undefined : hung.get(index)
      if (!entry) continue
      drop(entry, true)
      removeTornLeaf(entry.door)
      tornLeaves.set(entry.door, entry.leaf)
      doors.hit(entry.door, doors.list[entry.door]!.hp)
    }
    sync()
  }

  /** A door that opened or broke by another cause loses its leaf; one that is closed (new, or shut again) and has none gets it. */
  const sync = (): void => {
    for (const entry of hung.values()) {
      const door = doors.list[entry.door]!
      if (door.open || door.broken) drop(entry, false)
    }
    for (let index = 0; index < doors.list.length; index++) hang(index)
  }

  const removePhase = loop.add({ afterSteps }, 'contacts')
  sync()
  return {
    leafOf: (index) => hung.get(index)?.leaf,
    dispose: () => {
      removePhase()
      for (const entry of [...hung.values()]) drop(entry, false)
      for (const index of [...tornLeaves.keys()]) removeTornLeaf(index)
    },
  }
}
