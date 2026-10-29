import type * as THREE_NS from 'three'
import type { AttachmentDef, FittedAttachment } from '@adatechnology/game-weapons'
import type { WeaponModel } from '../index'
import type { ModelKit } from '../kit'
import type { MountFrame } from './mount-frames'

/** Distance in metres to what the ray hits, or null when it hits nothing within `maxDistance`: the host's raycast, which the laser asks every frame. */
export type LaserRaycast = (origin: THREE_NS.Vector3, direction: THREE_NS.Vector3, maxDistance: number) => number | null

/** What a builder is given: the accessory, where it sits on the weapon (`frame`, in the space of the wrapper) and the pieces of the model it may hang from or hide. */
export interface AttachmentBuildContext {
  readonly kit: ModelKit
  readonly model: WeaponModel
  readonly attachment: AttachmentDef
  readonly fitted: FittedAttachment
  readonly frame: MountFrame
  readonly raycast: LaserRaycast | undefined
  /** The meshes the magazine pivot had before any accessory (a drum or an extension replaces or extends them). */
  readonly factoryMagazine: readonly THREE_NS.Object3D[]
  /** The pivot of the launcher under the barrel, which the reload clip slides (only on a weapon with a place for one). */
  readonly slide: THREE_NS.Object3D | undefined
}

/** What a builder makes: the object (its origin on the frame), and what the rig needs to know about it. */
export interface AttachmentModel {
  readonly object: THREE_NS.Object3D
  /** Where the object hangs: the wrapper (default), the magazine pivot (it moves with the magazine) or the sliding pivot of the launcher. */
  readonly hangsFrom?: 'root' | 'magazine'
  /** Parts of the weapon that are not drawn while this one is on (a drum hides the magazine it replaces). */
  readonly hides?: readonly THREE_NS.Object3D[]
  /** How far forward the muzzle moves (a suppressor): the flash and the smoke come out of its end. */
  readonly muzzleOffset?: number
  /** A launcher's muzzle mark, which the shot clip flashes. */
  readonly muzzle?: THREE_NS.Object3D
  /** A light or laser turned on or off. */
  setOn?(on: boolean): void
  /** Every frame, while the weapon is in the hands (the laser measures how far its beam goes). */
  update?(): void
  dispose?(): void
}

export type AttachmentModelBuilder = (context: AttachmentBuildContext) => AttachmentModel | THREE_NS.Object3D | null

/** Builders by the `model` id of the accessory (`AttachmentDef.model`). A game replaces or adds one with `attachmentModels` of the weapons module. */
export type AttachmentModelRegistry = Readonly<Record<string, AttachmentModelBuilder>>
