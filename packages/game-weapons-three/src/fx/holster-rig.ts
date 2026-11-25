/**
 * What a weapon put away on the body is made of (`createHolsteredWeapons`): the holder that rides the place of the body, the weapon's model laid in it, the point of its grip the
 * hand holds while it moves there (the same point the weapon in the hands gives the right hand, `holdOfModel`), and for a long gun on its sling the swinging part and the strap.
 */
import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-contracts'
import { catenary, createCord } from '@adatechnology/game-shapes-three'

import type { ItemModels } from '../item-models'
import { buildModeledProp } from '../modeled-prop'
import { buildWeaponModelById } from '../models'
import { holdOfModel } from './hand-hold'

/**
 * How a weapon lies in each place, in the frame of the body's socket (+z the body's front, -x the weapon side, y up): `muzzle` the way the barrel points, `out` the way off the body
 * the weapon's side faces. The model's muzzle is its +x, its top +y, its side z. On the sling the barrel hangs down and toward the off side, its side flat on the chest.
 */
export const HOLSTER_PLACEMENT: Readonly<Record<string, { readonly muzzle: Vec3; readonly out: Vec3 }>> = {
  hip: { muzzle: [0, -1, 0], out: [-1, 0, 0] },
  back: { muzzle: [0.55, 0.835, 0], out: [0, 0, -1] },
  sling: { muzzle: [0.32, -0.947, 0], out: [0, 0, 1] },
}

/** A long gun on its sling: its sling point this share of its length behind its middle; the front swivel this share ahead; the strap over the off shoulder (socket frame, m). */
export const SLING_HANG = { pivotBehind: 0.3, frontSwivel: 0.3, shoulder: [0.19, 0.2, -0.04] as Vec3, strapRadius: 0.008, sag: 0.03, color: 0x3f4429 } as const

export interface HolsterRig {
  /** Rides the place of the body (world space; its parent is the scene). */
  readonly holder: THREE_NS.Group
  /** Turned by the swing of a gun on its sling; the holder itself otherwise. */
  readonly swing: THREE_NS.Object3D
  /** The right hand on the grip, in the holder's frame at rest. */
  readonly grip: { readonly position: THREE_NS.Vector3; readonly quaternion: THREE_NS.Quaternion }
  readonly strap: readonly THREE_NS.Mesh[]
}

/** The grip of a weapon in the frame of its prop (`buildModeledProp`: centred on its footprint, the underside on y 0), where the weapon in the hands puts the right hand. */
const gripOfProp = (THREE: typeof THREE_NS, weapon: string, footprint: Vec3): { position: THREE_NS.Vector3; quaternion: THREE_NS.Quaternion } => {
  const model = buildWeaponModelById(THREE, weapon)
  const right = model ? holdOfModel(THREE, model, 1).right : null
  if (!model || !right) return { position: new THREE.Vector3(-footprint[0] * 0.15, footprint[1] * 0.3, 0), quaternion: new THREE.Quaternion() }
  // the same centring as the prop, so the grip lands on the prop's own grip
  const box = new THREE.Box3().setFromObject(model.root)
  const center = box.getCenter(new THREE.Vector3())
  const frame = new THREE.Group()
  frame.add(model.root)
  model.root.position.set(-center.x, -box.min.y, -center.z)
  frame.updateMatrixWorld(true)
  return { position: right.part.localToWorld(right.offset.clone()), quaternion: right.quaternion.clone() }
}

const placeModel = (THREE: typeof THREE_NS, model: THREE_NS.Object3D, place: { readonly muzzle: Vec3; readonly out: Vec3 }, middle: THREE_NS.Vector3): void => {
  const [, height, thickness] = (model.userData.footprint ?? [0, 0, 0]) as Vec3
  const muzzle = new THREE.Vector3(...place.muzzle).normalize()
  const out = new THREE.Vector3(...place.out).normalize()
  // the model's z is its side: it goes out of the body; its top (+y) is what is left of a right-handed frame
  const top = new THREE.Vector3().crossVectors(out, muzzle).normalize()
  model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(muzzle, top, out))
  // the model stands on its underside (y 0..height) with its side centred on z: lift it to its middle and push it out by half its side
  model.position.copy(middle).addScaledVector(top, -height / 2).addScaledVector(out, thickness / 2)
}

/** A weapon's model laid in a place of the body, with the hand's grip on it. Undefined for a place this does not know or a weapon with no model. */
export const buildHolsterRig = (THREE: typeof THREE_NS, weapon: string, slot: string, options: { readonly items?: ItemModels; readonly strapMaterial?: THREE_NS.Material } = {}): HolsterRig | undefined => {
  const place = HOLSTER_PLACEMENT[slot]
  const model = place ? buildModeledProp(THREE, { id: weapon }, weapon, undefined, options.items) : undefined
  if (!place || !model) return undefined
  const footprint = (model.userData.footprint ?? [0, 0, 0]) as Vec3
  const holder = new THREE.Group()
  holder.name = `holstered_${weapon}`
  const slung = slot === 'sling' && options.strapMaterial !== undefined
  const swing = slung ? new THREE.Group() : holder
  if (slung) holder.add(swing)
  const muzzle = new THREE.Vector3(...place.muzzle).normalize()
  // on the sling the gun hangs from its sling point, behind its middle; elsewhere its middle is on the socket
  const middle = slung ? muzzle.clone().multiplyScalar(footprint[0] * SLING_HANG.pivotBehind) : new THREE.Vector3()
  placeModel(THREE, model, place, middle)
  swing.add(model)
  const strap: THREE_NS.Mesh[] = []
  if (slung && options.strapMaterial) {
    const out = new THREE.Vector3(...place.out).normalize()
    const front = middle.clone().addScaledVector(muzzle, footprint[0] * SLING_HANG.frontSwivel).addScaledVector(out, footprint[2] / 2)
    // the strap from the sling point over the off shoulder (it stays on the body), and from the front swivel back to the sling point (it swings with the gun)
    strap.push(createCord(THREE, catenary([0, 0, 0], SLING_HANG.shoulder, SLING_HANG.sag, 8), SLING_HANG.strapRadius, options.strapMaterial))
    strap.push(createCord(THREE, catenary([front.x, front.y, front.z], [0, 0, 0], SLING_HANG.sag, 8), SLING_HANG.strapRadius, options.strapMaterial))
    holder.add(strap[0] as THREE_NS.Mesh)
    swing.add(strap[1] as THREE_NS.Mesh)
  }
  holder.updateMatrixWorld(true)
  const inProp = gripOfProp(THREE, weapon, footprint)
  const position = model.localToWorld(inProp.position.clone())
  const quaternion = model.quaternion.clone().multiply(inProp.quaternion)
  return { holder, swing, grip: { position, quaternion }, strap }
}
