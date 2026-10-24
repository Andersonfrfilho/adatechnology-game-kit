import type * as THREE_NS from 'three'
import type { MountKind } from '@adatechnology/game-weapons'
import type { ModelFrames, ModelParts } from '../types'

type Vec3 = [number, number, number]
const DEFAULT_BARREL_RADIUS = 0.0085
const DEFAULT_RECEIVER_WIDTH = 0.034
const RECEIVER_START_FRACTION = 0.25
const RECEIVER_END_FRACTION = 0.55
const RECEIVER_HEIGHT_FRACTION = 0.4
const DEFAULT_GRIP_OFFSET = 0.07
// how far the handguard reaches past the receiver, as a fraction of what is left of the barrel, for a model that does not say
const HANDGUARD_FRACTION = 0.5

/** The shape of a model that carries its `inner` and `root` as `buildWeaponModelById` makes them. */
export interface FramedModel {
  readonly root: THREE_NS.Group
  readonly inner: THREE_NS.Group
  readonly parts: ModelParts
}

/** Where an accessory of one kind of mount goes, in the space of the wrapper (`root`): the origin of its own frame and the sizes it needs from the weapon. */
export interface MountFrame {
  readonly mount: MountKind
  readonly position: Vec3
  /** The other end, for what stretches between two points (a sling between its swivels). */
  readonly secondary?: Vec3
  readonly barrelRadius: number
  readonly receiverWidth: number
  readonly receiverHeight: number
  /** The top rail is drawn: an optic needs no adapter. */
  readonly hasRail: boolean
  /** The sign of z for a side rail: left is negative, right is positive (z is to the right of the weapon). */
  readonly side: -1 | 0 | 1
}

/**
 * Frames for a model whose builder wrote none (pistols, revolvers, bullpups, launchers...): measured from the model as it is built, with `root` still at the origin.
 * The numbers are in the space of `inner`, like the ones the rifle builder writes.
 */
export function deriveFrames(THREE: typeof THREE_NS, model: FramedModel): ModelFrames {
  const { root, inner, parts } = model
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const span = box.max.x - box.min.x
  const toInnerX = (x: number): number => (x - inner.position.x) / inner.scale.x
  const muzzle = parts.muzzle?.position
  const length = muzzle ? muzzle.x - 0.01 : toInnerX(box.max.x)
  const receiverStart = toInnerX(box.min.x + span * RECEIVER_START_FRACTION)
  const receiverEnd = toInnerX(box.min.x + span * RECEIVER_END_FRACTION)
  return {
    length,
    barrelY: muzzle?.y ?? (box.max.y + box.min.y) / 2,
    barrelRadius: DEFAULT_BARREL_RADIUS,
    receiverStart,
    receiverEnd,
    receiverHeight: (box.max.y - box.min.y) * RECEIVER_HEIGHT_FRACTION,
    receiverWidth: Math.min(DEFAULT_RECEIVER_WIDTH, box.max.z - box.min.z),
    handguardEnd: receiverEnd + (length - receiverEnd) * HANDGUARD_FRACTION,
    magazineX: parts.mag ? parts.mag.position.x : (receiverStart + receiverEnd) / 2,
    gripX: receiverStart + DEFAULT_GRIP_OFFSET,
    hasRail: false,
  }
}

/** The frame of a mount of the model, or undefined for the mounts nothing is drawn on (`stock`, `barrel`). */
export function mountFrame(model: FramedModel, mount: MountKind): MountFrame | undefined {
  const frames = model.parts.frames
  if (!frames) return undefined
  const { inner } = model
  const toRoot = (x: number, y: number, z: number): Vec3 => [inner.position.x + x * inner.scale.x, y, z]
  const handguardHeight = frames.receiverHeight * 0.8
  const railTopY = frames.receiverHeight / 2 + (frames.hasRail ? 0.006 : 0)
  const forendMiddle = (frames.receiverEnd + frames.handguardEnd) / 2
  const base = { mount, barrelRadius: frames.barrelRadius, receiverWidth: frames.receiverWidth, receiverHeight: frames.receiverHeight, hasRail: frames.hasRail }
  switch (mount) {
    case 'muzzle':
      return { ...base, position: toRoot(frames.length, frames.barrelY, 0), side: 0 }
    case 'rail_top':
      return { ...base, position: toRoot((frames.receiverStart + frames.receiverEnd) / 2 + 0.03, railTopY, 0), side: 0 }
    case 'rail_bottom':
      return { ...base, position: toRoot(forendMiddle, frames.barrelY - handguardHeight / 2, 0), side: 0 }
    case 'rail_left':
      return { ...base, position: toRoot(forendMiddle, frames.barrelY, -(frames.receiverWidth * 0.54 + 0.004)), side: -1 }
    case 'rail_right':
      return { ...base, position: toRoot(forendMiddle, frames.barrelY, frames.receiverWidth * 0.54 + 0.004), side: 1 }
    case 'underbarrel': {
      const [x, y] = frames.underbarrel ?? [frames.receiverEnd + (frames.handguardEnd - frames.receiverEnd) * 0.25, frames.barrelY - handguardHeight / 2 - 0.02]
      return { ...base, position: toRoot(x, y, 0), side: 0 }
    }
    case 'magazine':
      return { ...base, position: toRoot(frames.magazineX, -frames.receiverHeight / 2, 0), side: 0 }
    case 'feed': {
      const belt = model.parts.belt?.position
      return { ...base, position: belt ? toRoot(belt.x, belt.y, belt.z) : toRoot(frames.magazineX + 0.02, -frames.receiverHeight / 2 - 0.05, -0.045), side: -1 }
    }
    case 'sling':
      return {
        ...base,
        position: toRoot(frames.receiverEnd + (frames.length - frames.receiverEnd) * 0.45, -frames.receiverHeight / 2 - 0.03, 0),
        secondary: toRoot(0.08, -0.09, 0),
        side: 0,
      }
    default:
      return undefined
  }
}
