/**
 * The weapons put away on the body (`HostEvent` `holster`): each is drawn at the place of the body that took it (`ModuleHost.bodySlot`: `hip` a holster, `back` a sling) for as long
 * as it is away, the pistol muzzle down against the hip, the long gun across the back with the muzzle over the off shoulder; drawn back in hand, it is hidden. The model is the
 * weapon's own (the gallery's, or the item model), at its real size; one per weapon, kept for the next time.
 */
import type * as THREE_NS from 'three'
import type { HandPose, Vec3 } from '@adatechnology/game-contracts'
import type { Arsenal } from '@adatechnology/game-weapons'
import { discardObject3D } from '@adatechnology/game-shapes-three'

import type { ItemModels } from '../item-models'
import { buildModeledProp } from '../modeled-prop'

/**
 * How a weapon lies in each place, in the frame of the body's socket (+z the body's front, -x the weapon side, y up): `muzzle` the way the barrel points, `out` the way off the body
 * the weapon's side faces. The model's muzzle is its +x, its top +y, its side z.
 */
export const HOLSTER_PLACEMENT: Readonly<Record<string, { readonly muzzle: Vec3; readonly out: Vec3 }>> = {
  hip: { muzzle: [0, -1, 0], out: [-1, 0, 0] },
  back: { muzzle: [0.55, 0.835, 0], out: [0, 0, -1] },
}

/** A weapon's model laid in a place of the body: its side on the socket, its middle over it. Undefined for a place this does not know or a weapon with no model. */
export const holsteredModel = (THREE: typeof THREE_NS, weapon: string, slot: string, items?: ItemModels): THREE_NS.Group | undefined => {
  const place = HOLSTER_PLACEMENT[slot]
  const model = place ? buildModeledProp(THREE, { id: weapon }, weapon, undefined, items) : undefined
  if (!place || !model) return undefined
  const [, height, thickness] = (model.userData.footprint ?? [0, 0, 0]) as Vec3
  const muzzle = new THREE.Vector3(...place.muzzle).normalize()
  const out = new THREE.Vector3(...place.out).normalize()
  // the model's z is its side: it goes out of the body; its top (+y) is what is left of a right-handed frame
  const top = new THREE.Vector3().crossVectors(out, muzzle).normalize()
  model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(muzzle, top, out))
  // the model stands on its underside (y 0..height) with its side centred on z: lift it to its middle and push it out by half its side
  model.position.copy(top.multiplyScalar(-height / 2)).addScaledVector(out, thickness / 2)
  const holder = new THREE.Group()
  holder.name = `holstered_${weapon}`
  holder.add(model)
  return holder
}

export interface HolsteredWeaponsOptions {
  readonly THREE: typeof THREE_NS
  readonly scene: THREE_NS.Object3D
  readonly arsenal: Pick<Arsenal, 'weapons'>
  readonly items?: ItemModels
  /** The host's places of the body (`ModuleHost.bodySlot`). */
  readonly bodySlot: (slot: string) => HandPose | null
}

export interface HolsteredWeapons {
  handle(event: { readonly weapon: string; readonly slot: string; readonly on: boolean }): void
  /** Puts each weapon away where its place of the body is now. */
  update(): void
  /** The weapons drawn on the body now. */
  readonly drawn: readonly string[]
  dispose(): void
}

export const createHolsteredWeapons = (options: HolsteredWeaponsOptions): HolsteredWeapons => {
  const { THREE } = options
  const models = new Map<string, THREE_NS.Group>()
  const away = new Map<string, string>()
  const place = (weapon: string, slot: string): void => {
    const holder = models.get(`${weapon}@${slot}`)
    const pose = options.bodySlot(slot)
    if (!holder) return
    holder.visible = pose !== null
    if (!pose) return
    holder.position.set(pose.position[0], pose.position[1], pose.position[2])
    holder.quaternion.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3])
  }
  return {
    handle(event) {
      const key = `${event.weapon}@${event.slot}`
      if (!event.on) {
        away.delete(event.weapon)
        const holder = models.get(key)
        if (holder) holder.visible = false
        return
      }
      if (!options.arsenal.weapons.has(event.weapon)) return
      if (!models.has(key)) {
        const holder = holsteredModel(THREE, event.weapon, event.slot, options.items)
        if (!holder) return
        options.scene.add(holder)
        models.set(key, holder)
      }
      away.set(event.weapon, event.slot)
      place(event.weapon, event.slot)
    },
    update() {
      for (const [weapon, slot] of away) place(weapon, slot)
    },
    get drawn() {
      return [...away.keys()]
    },
    dispose() {
      discardObject3D([...models.values()])
      models.clear()
      away.clear()
    },
  }
}
