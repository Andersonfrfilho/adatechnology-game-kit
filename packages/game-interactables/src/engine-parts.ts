import type { BodyId, Quat, SeamWorld } from '@adatechnology/game-physics'

import { attachStrips } from './engine-soft'
import { createLeafDriver } from './engine-leaf'
import type { EnginePartDriver } from './engine-leaf'
import { localToWorld, rotY } from './math'
import type { PartPhysics } from './part-physics'
import type { PartSpec, SoftSpec, Transform, Vec3 } from './types'

/** What a host tells the engine about its objects. */
export interface EnginePartOptions {
  /** The object's own static body when the host has one: a leaf does not collide with it. Without it each part gets a hidden anchor at its pivot. */
  readonly frameOf?: (object: string) => BodyId | undefined
  /** The impulse (N s) over which a part's joint breaks, or undefined for a part that never breaks. */
  readonly breakImpulse?: (object: string, part: PartSpec) => number | undefined
  /** Mass of a leaf (kg); default its volume at the density of a hollow door. */
  readonly leafMass?: (object: string, part: PartSpec) => number
}

export interface EnginePartPhysics extends PartPhysics {
  /** The leaf body of a part the engine took (also after it broke: then it is a loose body the host draws where it is), or undefined. */
  leafOf(object: string, part: string): BodyId | undefined
  dispose(): void
}

const HOLLOW_DOOR_DENSITY = 150
const MIN_LEAF_MASS = 1
/** Newtons that hold a drawer still against its slide, and N m a hinge, so a part stays where it is left. */
const SLIDE_HOLD_N = 4
const HINGE_HOLD_NM = 0.4
const SOFT_KINDS: ReadonlySet<SoftSpec['kind']> = new Set(['cloth', 'curtain', 'strip'])

export const quatY = (ry: number): Quat => [0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

const perpendicularTo = (axis: Vec3): Vec3 => {
  const side = Math.abs(axis[0]) < 0.9 ? cross(axis, [1, 0, 0]) : cross(axis, [0, 0, 1])
  const size = Math.hypot(side[0], side[1], side[2])
  return [side[0] / size, side[1] / size, side[2] / size]
}

/** The engine under the movable parts and soft volumes of an interactables world (`WorldOptions.partPhysics`), made of the contract's bodies and joints only. */
export function createEnginePartPhysics(world: SeamWorld, options: EnginePartOptions = {}): EnginePartPhysics {
  const disposers = new Set<() => void>()
  const leaves = new Map<string, BodyId>()
  return {
    attachPart(object, part, transform) {
      const key = `${object}:${part.id}`
      const driver = attachLeaf(world, options, { object, part, transform, onDispose: () => leaves.delete(key) })
      if (!driver) return undefined
      leaves.set(key, driver.leaf)
      disposers.add(() => driver.dispose())
      return driver
    },
    leafOf: (object, part) => leaves.get(`${object}:${part}`),
    attachSoft(_object, soft, transform) {
      const driver = SOFT_KINDS.has(soft.kind) ? attachStrips(world, soft, transform) : undefined
      if (driver) disposers.add(() => driver.dispose())
      return driver
    },
    dispose() {
      for (const dispose of [...disposers]) dispose()
      disposers.clear()
    },
  }
}

interface LeafRequest {
  readonly object: string
  readonly part: PartSpec
  readonly transform: Transform
  readonly onDispose: () => void
}

/** A door, lid or drawer: a leaf box on a hinge or a slider, driven toward its target and free once it gets there. Undefined without `bounds` or for another motion. */
function attachLeaf(world: SeamWorld, options: EnginePartOptions, request: LeafRequest): EnginePartDriver | undefined {
  const { object, part, transform } = request
  const motion = part.motion
  const bounds = part.bounds
  if (!bounds || (motion.kind !== 'hinge' && motion.kind !== 'slide')) return undefined
  const isHinge = motion.kind === 'hinge'
  const axisLocal = rotY(motion.axis ?? [0, 1, 0], part.ry ?? 0)
  const axis = rotY(axisLocal, transform.ry)
  const pivot = localToWorld(transform, part.pivot)
  const half: Vec3 = [(bounds[3] - bounds[0]) / 2, (bounds[4] - bounds[1]) / 2, (bounds[5] - bounds[2]) / 2]
  const centre = localToWorld(transform, [(bounds[0] + bounds[3]) / 2, (bounds[1] + bounds[4]) / 2, (bounds[2] + bounds[5]) / 2])
  const rotation = quatY(transform.ry)
  const range = isHinge ? (motion.angle ?? Math.PI / 2) : (motion.distance ?? 0.4)
  const speed = motion.speed ?? 2.5
  const frame = options.frameOf?.(object) ?? world.createBody({ shape: { kind: 'box', half: [0.01, 0.01, 0.01] }, motion: 'static', position: pivot, layer: 'static', user: -3 })
  const ownsFrame = options.frameOf?.(object) === undefined
  const mass = options.leafMass?.(object, part) ?? Math.max(MIN_LEAF_MASS, 8 * half[0] * half[1] * half[2] * HOLLOW_DOOR_DENSITY)
  const leaf = world.createBody({ shape: { kind: 'box', half }, motion: 'dynamic', mass, position: centre, rotation, layer: 'prop', allowSleep: true, user: -3 })
  world.ignorePair(frame, leaf, true)
  const limits = { min: Math.min(0, range), max: Math.max(0, range) }
  const breakImpulse = options.breakImpulse?.(object, part)
  const joint = world.createJoint(
    isHinge
      ? { kind: 'hinge', a: frame, b: leaf, point: pivot, axis, normal: perpendicularTo(axis), ...limits, friction: HINGE_HOLD_NM, ...(breakImpulse === undefined ? {} : { breakImpulse }) }
      : { kind: 'slider', a: frame, b: leaf, point: pivot, axis, ...limits, friction: SLIDE_HOLD_N, ...(breakImpulse === undefined ? {} : { breakImpulse }) },
  )
  return createLeafDriver({ world, leaf, frame, ownsFrame, joint, onDispose: request.onDispose, drive: { isHinge, axis, pivot, centre, range, speed, base: rotation } })
}

