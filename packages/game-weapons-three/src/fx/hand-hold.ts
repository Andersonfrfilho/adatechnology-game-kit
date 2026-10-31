import type * as THREE_NS from 'three'
import type { HandPose, HandTargets } from '@adatechnology/game-contracts'
import type { WeaponModel } from '../models'
import type { HandWork } from './hand-work'

/**
 * How the hands take a tool, in metres of the model. Constants of the grip (the thickness of a palm against the thing it holds), not of any weapon: the models say where their grip is.
 */
export const HAND_HOLD = {
  /** Half the width of a pistol grip, the palm sits this far (plus the palm) off its middle. */
  gripHalfWidth: 0.0145,
  /** Half the thickness of a palm. */
  palm: 0.011,
  /** How far up the grip the web of the hand sits from its middle. */
  gripUp: 0.006,
  /** How far down the grip the supporting hand of a pistol sits from the middle. */
  supportDown: 0.036,
  /** Where along the handguard (0 the receiver, 1 the end of the forend) the supporting hand closes. */
  forendAt: 0.6,
  /** How far under the handguard the palm sits (half a handguard plus the palm). */
  forendUnder: 0.034,
  /** The grip of a long gun that has no drawn pistol grip: how far under the receiver the hand sits. */
  strapUnder: 0.04,
  /** How far lower than touching the palm hangs under a handguard, so the fingers close under it and not over it. */
  forendDrop: 0.03,
  /** How far (radians) the fingers of a support hand under a handguard rise from level. */
  forendTilt: 0.5,
  /** How far a handgun's support hand dips for the new magazine, along the grip. */
  magDip: 0.045,
  /** Closure of the fingers on a grip and on a forend (0 open, 1 closed). */
  closed: 0.9,
  forend: 0.6,
  /** How far the shooting hand slides on its grip so the thumb reaches the safety lever. */
  thumbReach: 0.02,
  /** How fast the supporting hand goes to the magazine and back, per second. */
  magRate: 7,
} as const

/** A point a hand holds: `offset` in the local space of `part` and the hand's orientation in the model root's space. */
export interface HandAnchor {
  part: THREE_NS.Object3D
  offset: THREE_NS.Vector3
  quaternion: THREE_NS.Quaternion
}

/** Where the hands take a model. `leftMagazine` is where the supporting hand goes while the magazine is changed. */
export interface Hold {
  right: HandAnchor | null
  left: HandAnchor | null
  leftMagazine: HandAnchor | null
  scale: number
  grip: number
  gripLeft: number
  /** What the hands do to the parts the clips move (`handWorkOf`); empty until the viewmodel adds it. */
  works?: readonly HandWork[]
}

type Three = typeof THREE_NS

/** The orientation whose hand-local x is `x` and y is `y` (z follows from the right-handed frame), both in the space they are given in. */
export const handFrame = (THREE: Three, x: THREE_NS.Vector3, y: THREE_NS.Vector3): THREE_NS.Quaternion => {
  const ax = x.clone().normalize()
  const az = ax.clone().cross(y).normalize()
  const ay = az.clone().cross(ax)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, az))
}

/** The pose a `Hold` gives a hand now, in the world; `rootQuaternion` is the world rotation of the model root. */
export const poseOf = (anchor: HandAnchor, rootQuaternion: THREE_NS.Quaternion): HandPose => {
  const position = anchor.part.localToWorld(anchor.offset.clone())
  const q = rootQuaternion.clone().multiply(anchor.quaternion)
  return { position: [position.x, position.y, position.z], quaternion: [q.x, q.y, q.z, q.w] }
}

/** Mixes two poses (the supporting hand between the forend and the magazine). */
export const blendPose = (THREE: Three, a: HandPose, b: HandPose, k: number): HandPose => {
  const q = new THREE.Quaternion(...a.quaternion).slerp(new THREE.Quaternion(...b.quaternion), k)
  return {
    position: [a.position[0] + (b.position[0] - a.position[0]) * k, a.position[1] + (b.position[1] - a.position[1]) * k, a.position[2] + (b.position[2] - a.position[2]) * k],
    quaternion: [q.x, q.y, q.z, q.w],
  }
}

/** The targets of a hold: the right hand, the supporting hand (moved toward the magazine by `magazine` 0..1), the grip and the size of the hands. */
export const targetsOf = (THREE: Three, hold: Hold, rootQuaternion: THREE_NS.Quaternion, magazine: number, weights?: readonly number[]): HandTargets => {
  let right = hold.right ? poseOf(hold.right, rootQuaternion) : null
  let left: HandPose | null = null
  if (hold.left) {
    left = poseOf(hold.left, rootQuaternion)
    if (hold.leftMagazine && magazine > 0) left = blendPose(THREE, left, poseOf(hold.leftMagazine, rootQuaternion), magazine)
  }
  // the hand that works a part leaves what it was holding and goes to the part for as long as the clip moves it
  hold.works?.forEach((work, index) => {
    const k = weights?.[index] ?? 0
    if (k <= 0) return
    const pose = poseOf(work.anchor, rootQuaternion)
    if (work.hand === 'R') right = right ? blendPose(THREE, right, pose, k) : pose
    else left = left ? blendPose(THREE, left, pose, k) : pose
  })
  return { R: right, L: left, grip: hold.grip, gripL: hold.gripLeft, scale: hold.scale }
}

const V = (THREE: Three, x: number, y: number, z: number): THREE_NS.Vector3 => new THREE.Vector3(x, y, z)

/** The palm lies on the right (or left) side of a vertical-ish grip, the fingers go forward and wrap around the front of it. `axis` is the way up the grip, in the space of `root`. */
const gripFrame = (THREE: Three, up: THREE_NS.Vector3, side: 1 | -1): THREE_NS.Quaternion => {
  const forward = V(THREE, 1, 0, 0)
  const toSide = V(THREE, 0, 0, 1)
  // fingers along the weapon's x turned with the grip's tilt; the back of the hand to the side the palm is on
  const tilt = new THREE.Quaternion().setFromUnitVectors(V(THREE, 0, 1, 0), up)
  return handFrame(THREE, forward.clone().applyQuaternion(tilt), toSide.clone().applyQuaternion(tilt).multiplyScalar(side))
}

/** The palm under a forend (palm up, back of the hand down), the fingers going to the right and closing up its right side, the thumb forward along its left. `tilt` raises the fingers, so the wrist is below and to the left: the forearm comes from under the gun. */
const forendFrame = (THREE: Three, tilt = 0): THREE_NS.Quaternion => handFrame(THREE, V(THREE, 0, Math.sin(tilt), Math.cos(tilt)), V(THREE, 0, -Math.cos(tilt), Math.sin(tilt)))

/** The hold of a gallery model: the right hand on the pistol grip, the left on the forend (or wrapped under the right on a handgun), on the pump of a pump gun, on the magazine while it is changed. */
export function holdOfModel(THREE: Three, model: WeaponModel, holderScale: number): Hold {
  const { root, inner, parts } = model
  const frames = parts.frames
  const toRoot = (x: number, y: number, z: number): THREE_NS.Vector3 => V(THREE, inner.position.x + x * inner.scale.x, y, z)
  const handgun = parts.family === 'pistol' || parts.family === 'revolver'
  root.updateWorldMatrix(true, true)

  // the right hand: on the pivot of the drawn pistol grip, else under the receiver at the grip's x
  let gripAt: THREE_NS.Vector3
  let up: THREE_NS.Vector3
  if (parts.grip) {
    gripAt = toRoot(parts.grip.position.x, parts.grip.position.y, parts.grip.position.z)
    up = V(THREE, 0, 1, 0).applyQuaternion(parts.grip.quaternion)
  } else {
    const receiverHeight = frames?.receiverHeight ?? 0.06
    gripAt = toRoot(frames?.gripX ?? 0.07, -receiverHeight / 2 - HAND_HOLD.strapUnder, 0)
    up = V(THREE, Math.sin(0.3), Math.cos(0.3), 0)
  }
  const side = HAND_HOLD.gripHalfWidth + HAND_HOLD.palm
  const right: HandAnchor = {
    part: root,
    offset: gripAt.clone().addScaledVector(up, HAND_HOLD.gripUp).add(V(THREE, 0, 0, side)),
    quaternion: gripFrame(THREE, up, 1),
  }

  let left: HandAnchor | null = null
  let leftMagazine: HandAnchor | null = null
  if (handgun) {
    // both hands on a handgun: the left wraps the grip from its side, under the fingers of the right
    left = { part: root, offset: gripAt.clone().addScaledVector(up, -HAND_HOLD.supportDown).add(V(THREE, 0, 0, -side)), quaternion: gripFrame(THREE, up, -1) }
  } else if (parts.pump) {
    const box = new THREE.Box3().setFromObject(parts.pump)
    const center = box.getCenter(new THREE.Vector3())
    const under = parts.pump.worldToLocal(V(THREE, center.x, box.min.y - HAND_HOLD.palm, center.z))
    left = { part: parts.pump, offset: under, quaternion: forendFrame(THREE) }
  } else if (frames) {
    const handguardHeight = frames.receiverHeight * 0.8
    const x = frames.receiverEnd + (frames.handguardEnd - frames.receiverEnd) * HAND_HOLD.forendAt
    left = { part: root, offset: toRoot(x, frames.barrelY - handguardHeight / 2 - HAND_HOLD.palm - HAND_HOLD.forendDrop, 0), quaternion: forendFrame(THREE, HAND_HOLD.forendTilt) }
  }
  if (left && parts.mag) {
    const box = new THREE.Box3().setFromObject(parts.mag)
    const center = box.getCenter(new THREE.Vector3())
    // the magazine well of a handgun is inside the grip: the hand goes under its base, where the new magazine is slapped in
    const local = parts.mag.worldToLocal(V(THREE, center.x, box.min.y - HAND_HOLD.palm, center.z))
    // a handgun's new magazine comes from the belt: the hand dips a little along the grip and stays in the view; a long gun's goes under its magazine
    leftMagazine = handgun && left ? { part: root, offset: left.offset.clone().addScaledVector(up, -HAND_HOLD.magDip), quaternion: left.quaternion } : { part: parts.mag, offset: local, quaternion: forendFrame(THREE) }
  }
  return {
    right,
    left,
    leftMagazine,
    // the hands at the tool's scale: a tool drawn smaller than the hands looks like a toy in them
    scale: holderScale,
    grip: HAND_HOLD.closed,
    gripLeft: HAND_HOLD.forend,
  }
}

/** The generic low-poly props (a handle and a head lying along x): the right hand around the handle, the left under the head of a long gun. */
export function holdOfProp(THREE: Three, group: THREE_NS.Object3D, category: string, scale: number): Hold {
  const handle = group.getObjectByName('handle') ?? group.getObjectByName('body') ?? group
  const head = group.getObjectByName('head')
  const size = (object: THREE_NS.Object3D): THREE_NS.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
  // the handle's long axis is x: the fingers wrap about it, the palm on the right
  const wrap = handFrame(THREE, V(THREE, 0, 1, 0), V(THREE, 0, 0, 1))
  const handleSize = size(handle)
  const right: HandAnchor = { part: group, offset: handle.position.clone().add(V(THREE, 0, handleSize.y / 2 + 0.002, 0)), quaternion: wrap }
  // a long gun's head is its barrel: the left hand under it
  const long = head && ['smg', 'carbine', 'rifle', 'sniper', 'shotgun', 'crossbow', 'flame'].includes(category)
  const headSize = head ? size(head) : null
  const left: HandAnchor | null =
    long && head && headSize ? { part: group, offset: head.position.clone().add(V(THREE, -headSize.x * 0.15, -headSize.y / 2 - HAND_HOLD.palm, 0)), quaternion: forendFrame(THREE) } : null
  return { right, left, leftMagazine: null, scale, grip: HAND_HOLD.closed, gripLeft: HAND_HOLD.forend }
}
