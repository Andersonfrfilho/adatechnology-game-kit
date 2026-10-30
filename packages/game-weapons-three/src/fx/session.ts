import type * as THREE_NS from 'three'
import type { CaliberDef, CartridgeDims, CaseType, WeaponDef } from '@adatechnology/game-weapons'
import type { WeaponModel } from '../models'
import type { CartridgeShape } from '../models/cartridge'
import type { AttachmentRig } from '../models/attachments/fit'
import type { ModelKit } from '../models/kit'
import type { Effects } from './effects'
import type { Particles } from './particles'
import type { WeaponAudio } from '../audio'
import type { SoundProfile } from '../audio/reload-sounds'
import type { FxLayers } from './layers'

/** What the viewmodel shares with the handlers of the clip events. */
export interface FxWorld {
  readonly kit: ModelKit
  readonly scene: THREE_NS.Object3D
  readonly particles: Particles
  readonly effects: Effects
  readonly random: () => number
  readonly audio: WeaponAudio | null
  readonly layers: FxLayers
  groundAt(x: number, z: number): number
  /** A sound cue of a clip: the audio plays it (when there is one) and the host is told. */
  sound(weapon: string, cue: string, profile: SoundProfile): void
  /** Runs `step(e)` for `seconds` from `delay` seconds on, with `e` the eased progress, then `done`. */
  schedule(delay: number, seconds: number, step: (eased: number) => void, done?: () => void): void
}

/** The weapon in the hands: the model, how it is held and what its calibre makes (the case and the round, in metres). */
export interface Session {
  readonly id: string
  readonly def: WeaponDef
  readonly caliber: CaliberDef | undefined
  readonly model: WeaponModel
  /** How much the model is scaled down to sit in the hands. */
  /** The size the model is drawn at: smaller than real in front of the eye, 1 on the body. */
  holderScale: number
  readonly lengthMetres: number
  readonly caseType: CaseType
  /** How the weapon sounds: the weight of its metal and what it is made of. */
  readonly soundProfile: SoundProfile
  readonly kit: ModelKit
  readonly cartridge: { dims: CartridgeDims; shape: CartridgeShape } | null
  stuckCase: THREE_NS.Object3D | null
  nextChamber: number
  /** The accessories drawn on the model, and what was fitted when they were last synced (to see a change). */
  attachments: AttachmentRig | null
  attachmentsSignature: string
  /** Whether a suppressor is fitted for the current shot. */
  suppressed: boolean
}

/** World position of a part of the model. */
export const worldPositionOf = (session: Session, part: THREE_NS.Object3D, out: THREE_NS.Vector3): THREE_NS.Vector3 => {
  session.model.root.updateWorldMatrix(true, true)
  return part.getWorldPosition(out)
}

/** A direction or offset written in the weapon's own axes (x along the barrel, y up, z to the right) in the world; `scaled` follows the model's size. */
export const toWorld = (session: Session, vector: THREE_NS.Vector3, scaled = false): THREE_NS.Vector3 => {
  const quaternion = session.model.root.getWorldQuaternion(new session.kit.THREE.Quaternion())
  const world = vector.clone().applyQuaternion(quaternion)
  return scaled ? world.multiplyScalar(session.holderScale) : world
}
