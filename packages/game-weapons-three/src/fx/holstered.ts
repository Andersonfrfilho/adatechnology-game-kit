/**
 * The weapons put away on the body (`HostEvent` `holster`): each is drawn at the place of the body that took it (`ModuleHost.bodySlot`: `hip` a holster, `back` across the back,
 * `sling` hanging on its sling) for as long as it is away, and hidden once it is back in hand. With `seconds` the move is seen (owner, 2026-11-25): the weapon goes from the hand
 * (`from`) to its place with the right hand on its grip (`handTargets`), and back the same way; `ground` tosses it, the hand letting go on the way down, for the host to drop the
 * weapon's world item where it lands. A long gun on its sling hangs from the chest and swings with the body (`createSlingSwing` of game-weapons). One model per weapon and place, kept
 * for the next time.
 */
import type * as THREE_NS from 'three'
import type { HandPose, HandTargets } from '@adatechnology/game-contracts'
import { createSlingSwing } from '@adatechnology/game-weapons'
import type { Arsenal, SlingSwing } from '@adatechnology/game-weapons'
import { discardObject3D } from '@adatechnology/game-shapes-three'

import type { ItemModels } from '../item-models'
import { SLING_HANG, buildHolsterRig } from './holster-rig'
import type { HolsterRig } from './holster-rig'

export { HOLSTER_PLACEMENT, SLING_HANG, buildHolsterRig } from './holster-rig'
export type { HolsterRig } from './holster-rig'

/** The place a tossed weapon goes: down to the floor. */
export const GROUND_SLOT = 'ground'

/** A toss: the weapon falls this far (m) and this far ahead of the hand, turning by `turn` (radians); the hand lets go at `release` of the way. */
export const HOLSTER_TOSS = { drop: 0.8, ahead: 0.3, turn: 1.3, release: 0.4 } as const

/** How the right hand closes on a weapon it moves. */
const MOVE_GRIP = 0.9
/** The most acceleration (m/s²) the swing of a slung gun takes from the body in one frame (a respawn moves the body at once). */
const MAX_SWING_ACCELERATION = 40

/** A weapon's model laid in a place of the body: its side on the socket, its middle over it. Undefined for a place this does not know or a weapon with no model. */
export const holsteredModel = (THREE: typeof THREE_NS, weapon: string, slot: string, items?: ItemModels): THREE_NS.Group | undefined => buildHolsterRig(THREE, weapon, slot, items ? { items } : {})?.holder

export interface HolsteredWeaponsOptions {
  readonly THREE: typeof THREE_NS
  readonly scene: THREE_NS.Object3D
  readonly arsenal: Pick<Arsenal, 'weapons'>
  readonly items?: ItemModels
  /** The host's places of the body (`ModuleHost.bodySlot`). */
  readonly bodySlot: (slot: string) => HandPose | null
  /** The frame the weapon in the hands is held in (`ModuleHost.holdFrame`): a weapon drawn back goes to where it was taken from in this frame. */
  readonly holdFrame?: (() => HandPose | null) | undefined
}

export interface HolsteredWeapons {
  handle(event: { readonly weapon: string; readonly slot: string; readonly on: boolean; readonly from?: HandPose | undefined; readonly seconds?: number | undefined }): void
  /** The weapon now in the hands (`tool` events): it is not on the body any more. */
  inHand(weapon: string): void
  /** Puts each weapon where its place of the body is now, moves the ones on their way and swings the slung ones. */
  update(dt?: number): void
  /** The right hand on a weapon on its way between the hand and the body, or null with none moving. */
  handTargets(): HandTargets | null
  /** The weapons drawn on the body now. */
  readonly drawn: readonly string[]
  dispose(): void
}

type Frame = { readonly position: THREE_NS.Vector3; readonly quaternion: THREE_NS.Quaternion }
type Motion = { readonly kind: 'away' | 'back' | 'toss'; time: number; readonly seconds: number; readonly start: Frame }
type Away = { readonly weapon: string; readonly slot: string; readonly rig: HolsterRig; motion: Motion | null; taken: Frame | null; readonly swing: SlingSwing | null; last: THREE_NS.Vector3 | null; readonly speed: THREE_NS.Vector3; lean: number }

const ease = (t: number): number => {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

export const createHolsteredWeapons = (options: HolsteredWeaponsOptions): HolsteredWeapons => {
  const { THREE } = options
  const rigs = new Map<string, HolsterRig>()
  const away = new Map<string, Away>()
  const strapMaterial = new THREE.MeshStandardMaterial({ color: SLING_HANG.color, roughness: 0.85, metalness: 0 })
  const frameOf = (pose: HandPose): Frame => ({ position: new THREE.Vector3(...pose.position), quaternion: new THREE.Quaternion(...pose.quaternion) })
  const scratch = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), inverse: new THREE.Quaternion(), acceleration: new THREE.Vector3(), velocity: new THREE.Vector3() }
  /** The holder's frame that puts the grip on `hand`. */
  const holderOnHand = (rig: HolsterRig, hand: Frame): Frame => {
    const quaternion = hand.quaternion.clone().multiply(rig.grip.quaternion.clone().invert())
    return { position: hand.position.clone().sub(rig.grip.position.clone().applyQuaternion(quaternion)), quaternion }
  }
  const relativeTo = (frame: Frame, base: Frame): Frame => {
    const inverse = base.quaternion.clone().invert()
    return { position: frame.position.clone().sub(base.position).applyQuaternion(inverse), quaternion: inverse.multiply(frame.quaternion) }
  }
  const inFrame = (local: Frame, base: Frame): Frame => ({ position: local.position.clone().applyQuaternion(base.quaternion).add(base.position), quaternion: base.quaternion.clone().multiply(local.quaternion) })
  const holdFrame = (): Frame | null => {
    const pose = options.holdFrame?.()
    return pose ? frameOf(pose) : null
  }
  /** Where the holder goes now: the place of the body, the floor of a toss, or the hand a weapon goes back to. */
  const goal = (entry: Away): Frame | null => {
    if (entry.motion?.kind === 'toss') {
      const start = entry.motion.start
      const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(holdFrame()?.quaternion ?? start.quaternion).setY(0).normalize()
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(ahead, new THREE.Vector3(0, 1, 0)).normalize(), HOLSTER_TOSS.turn)
      return { position: start.position.clone().addScaledVector(ahead, HOLSTER_TOSS.ahead).add(new THREE.Vector3(0, -HOLSTER_TOSS.drop, 0)), quaternion: turn.multiply(start.quaternion.clone()) }
    }
    if (entry.motion?.kind === 'back') {
      const base = holdFrame()
      return base && entry.taken ? inFrame(entry.taken, base) : null
    }
    const pose = options.bodySlot(entry.slot)
    if (!pose) return null
    return entry.swing ? hanging(entry, frameOf(pose)) : frameOf(pose)
  }
  /** A gun on its sling hangs by its weight: the body's turn about the vertical only; how far the chest leans is kept for the swing (it pushes the gun out when it leans back). */
  const hanging = (entry: Away, frame: Frame): Frame => {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(frame.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(frame.quaternion)
    forward.y = 0
    if (forward.lengthSq() < 1e-8) return frame
    forward.normalize()
    entry.lean = Math.atan2(up.dot(forward), up.y)
    return { position: frame.position, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward) }
  }
  const place = (entry: Away, frame: Frame): void => {
    entry.rig.holder.position.copy(frame.position)
    entry.rig.holder.quaternion.copy(frame.quaternion)
    entry.rig.holder.updateMatrixWorld(true)
  }
  /** The slung gun swings with what the sling point does: its acceleration in the body's frame. */
  const swingOf = (entry: Away, frame: Frame, dt: number): void => {
    if (!entry.swing || dt <= 0) return
    const { velocity, acceleration, inverse } = scratch
    velocity.copy(frame.position).sub(entry.last ?? frame.position).divideScalar(dt)
    acceleration.copy(velocity).sub(entry.last ? entry.speed : velocity).divideScalar(dt).clampLength(0, MAX_SWING_ACCELERATION)
    entry.last = (entry.last ?? new THREE.Vector3()).copy(frame.position)
    entry.speed.copy(velocity)
    acceleration.applyQuaternion(inverse.copy(frame.quaternion).invert())
    // the socket's -x is the body's right
    const state = entry.swing.step(dt, [-acceleration.x, acceleration.y, acceleration.z])
    // a chest leaning back lays the gun out along it
    entry.rig.swing.rotation.set(-(state.forward + Math.max(0, -entry.lean)), 0, -state.side)
    entry.rig.holder.updateMatrixWorld(true)
  }
  const hide = (weapon: string): void => {
    const entry = away.get(weapon)
    if (!entry) return
    entry.rig.holder.visible = false
    away.delete(weapon)
  }
  const step = (entry: Away, dt: number): void => {
    const motion = entry.motion
    const target = goal(entry)
    entry.rig.holder.visible = target !== null
    // the strap goes over the shoulder only once the gun hangs on the body; on its way it hangs from the gun
    const body = entry.rig.strap[0]
    if (body) body.visible = motion === null
    if (!target) return
    if (!motion) {
      place(entry, target)
      swingOf(entry, target, dt)
      return
    }
    motion.time = Math.min(motion.seconds, motion.time + dt)
    const k = ease(motion.time / motion.seconds)
    place(entry, { position: motion.start.position.clone().lerp(target.position, k), quaternion: motion.start.quaternion.clone().slerp(target.quaternion, k) })
    if (motion.time < motion.seconds) return
    if (motion.kind === 'away') {
      entry.motion = null
      if (body) body.visible = true
    }
    // the tossed weapon is the host's world item now; one on its way back stays at the hand until the host puts it in hand (`inHand`)
    if (motion.kind === 'toss') hide(entry.weapon)
  }
  const rigOf = (weapon: string, slot: string): HolsterRig | undefined => {
    const key = `${weapon}@${slot}`
    const known = rigs.get(key)
    if (known) return known
    // a tossed weapon is drawn as it lies in the holster of the hip, its side to the hand
    const rig = buildHolsterRig(THREE, weapon, slot === GROUND_SLOT ? 'hip' : slot, { ...(options.items ? { items: options.items } : {}), strapMaterial })
    if (!rig) return undefined
    options.scene.add(rig.holder)
    rig.holder.visible = false
    rigs.set(key, rig)
    return rig
  }
  const putAway = (event: Parameters<HolsteredWeapons['handle']>[0], seconds: number): void => {
    if (!options.arsenal.weapons.has(event.weapon)) return
    hide(event.weapon)
    const rig = rigOf(event.weapon, event.slot)
    if (!rig) return
    rig.swing.rotation.set(0, 0, 0)
    const entry: Away = { weapon: event.weapon, slot: event.slot, rig, motion: null, taken: null, swing: event.slot === 'sling' ? createSlingSwing() : null, last: null, speed: new THREE.Vector3(), lean: 0 }
    if (event.from && seconds > 0) {
      const start = holderOnHand(rig, frameOf(event.from))
      const base = holdFrame()
      entry.taken = base ? relativeTo(start, base) : null
      entry.motion = { kind: event.slot === GROUND_SLOT ? 'toss' : 'away', time: 0, seconds, start }
    } else if (event.slot === GROUND_SLOT) return
    away.set(event.weapon, entry)
    step(entry, 0)
  }
  return {
    handle(event) {
      const seconds = event.seconds ?? 0
      if (event.on) return putAway(event, seconds)
      const entry = away.get(event.weapon)
      // drawn back: seen going to the hand, else gone at once
      if (!entry || seconds <= 0 || !entry.taken || !holdFrame()) return hide(event.weapon)
      entry.motion = { kind: 'back', time: 0, seconds, start: { position: entry.rig.holder.position.clone(), quaternion: entry.rig.holder.quaternion.clone() } }
      entry.swing?.reset()
      entry.rig.swing.rotation.set(0, 0, 0)
    },
    inHand(weapon) {
      if (away.get(weapon)?.motion?.kind !== 'toss') hide(weapon)
    },
    update(dt = 0) {
      for (const entry of [...away.values()]) step(entry, dt)
    },
    handTargets() {
      for (const entry of away.values()) {
        const motion = entry.motion
        if (!motion || !entry.rig.holder.visible) continue
        if (motion.kind === 'toss' && motion.time / motion.seconds > HOLSTER_TOSS.release) continue
        const { position, quaternion } = scratch
        position.copy(entry.rig.grip.position).applyMatrix4(entry.rig.holder.matrixWorld)
        quaternion.copy(entry.rig.holder.quaternion).multiply(entry.rig.grip.quaternion)
        return { R: { position: [position.x, position.y, position.z], quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] }, grip: MOVE_GRIP }
      }
      return null
    },
    get drawn() {
      return [...away.values()].filter((entry) => entry.motion?.kind !== 'toss').map((entry) => entry.weapon)
    },
    dispose() {
      discardObject3D([...rigs.values()].map((rig) => rig.holder))
      strapMaterial.dispose()
      rigs.clear()
      away.clear()
    },
  }
}
