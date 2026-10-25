import { clipEventsBetween, sampleFirstPersonClip } from '@adatechnology/game-characters'
import type { FirstPersonClip, FirstPersonSampleChannel } from '@adatechnology/game-characters'
import type { HandPose } from '@adatechnology/game-contracts'

import playerPreset from '../presets/player-avatar.json'
import preset from '../presets/first-person-arms.json'
import type { Three, THREE_NS } from '../three'
import { createHandMesh } from './hand'
import type { HandMesh } from './hand'
import { createTwoBone, solveTwoBone } from './ik'
import type {
  FirstPersonArms,
  FirstPersonArmsOptions,
  FirstPersonBob,
  FirstPersonColors,
  FirstPersonEvent,
  FirstPersonRig,
  RestPose,
  StanceDef,
} from './types'

const DEFAULT_BLEND = 0.18
const ELBOW_SEGMENTS = 8
/** An arm is stretched to this fraction of its length before the shoulder moves toward the target. */
const REACH_SLACK = 0.97
/** A foot is shown while a clip holds it by at least this much. */
const FOOT_SHOWN = 0.001

/** How much of its own colour each material glows with (0..1). */
const FILL = 0.3

/** The stances of the preset: `relaxed` and `fists` are rest poses, `hold` follows the targets of the tool in the hands. */
export const FIRST_PERSON_STANCES = preset.stances as unknown as Readonly<Record<string, StanceDef>>
/** The rig of the preset: shoulders, bones, elbow pole, hips and the leg of the kick. */
export const FIRST_PERSON_RIG = preset.rig as unknown as FirstPersonRig
export const FIRST_PERSON_BOB = preset.bob as FirstPersonBob

const hexOf = (value: string | number): number => (typeof value === 'string' ? Number.parseInt(value, 16) : value)
const scaleHex = (hex: number, factor: number): number => {
  const channel = (shift: number): number => Math.round(((hex >> shift) & 0xff) * factor)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
const mix = (a: number, b: number, k: number): number => a + (b - a) * k
const ease = (k: number): number => k * k * (3 - 2 * k)

/** The colours of the player's preset: the skin and the shirt of the team game's player, trousers and shoes of a plain outfit. */
export const FIRST_PERSON_COLORS: FirstPersonColors = {
  skin: hexOf(playerPreset.spec.skin),
  sleeve: hexOf(playerPreset.shirtColor),
  cuff: scaleHex(hexOf(playerPreset.shirtColor), 0.72),
  trouser: 0x2d3440,
  shoe: 0x1c1a1a,
}

type Pose = { p: THREE_NS.Vector3; q: THREE_NS.Quaternion; grip: number; scale: number }

type Segment = THREE_NS.Mesh
type Arm = {
  side: 'R' | 'L'
  sign: 1 | -1
  hand: HandMesh
  /** At the middle of the palm, in the space of the arms root. */
  anchor: THREE_NS.Group
  upper: Segment
  fore: Segment
  cuff: Segment
  elbow: THREE_NS.Mesh
  /** What the hand is told to do before a clip: eased from `from` to the stance or the target. */
  shown: Pose
  from: Pose
  mode: string | null
  blend: number
  /** What is drawn. */
  drawn: Pose
}

const newPose = (THREE: Three): Pose => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), grip: 0, scale: 1 })
const copyPose = (to: Pose, from: Pose): Pose => {
  to.p.copy(from.p)
  to.q.copy(from.q)
  to.grip = from.grip
  to.scale = from.scale
  return to
}
const mixPose = (THREE: Three, out: Pose, a: Pose, b: Pose, k: number): Pose => {
  out.p.lerpVectors(a.p, b.p, k)
  out.q.copy(a.q).slerp(b.q, k)
  out.grip = mix(a.grip, b.grip, k)
  out.scale = mix(a.scale, b.scale, k)
  return out
}

/** The mirror image of a rotation across the plane x = 0 (M R M with M = diag(-1, 1, 1)): for a shoe, which is its own mirror image about its length. */
const mirrorRotation = (THREE: Three, q: THREE_NS.Quaternion): THREE_NS.Quaternion => {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q)
  const e = m.elements
  // column-major: element (row i, column j) is e[j * 4 + i]; the ones with exactly one of i, j equal to 0 change sign
  for (const [i, j] of [[0, 1], [0, 2], [1, 0], [2, 0]] as const) e[j * 4 + i] = -e[j * 4 + i]!
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

/** The mirror image of a pose across the plane x = 0: the left hand that is the right one seen in a mirror (its frame is the right hand's with z flipped, so z is flipped back). */
const mirrorQuaternion = (THREE: Three, q: THREE_NS.Quaternion): THREE_NS.Quaternion => {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q)
  const e = m.elements
  // rows are x, y, z and columns the same, column-major: row 0 (x) flips, and column 2 (z) flips
  for (let column = 0; column < 3; column++) e[column * 4] = -e[column * 4]!
  for (let row = 0; row < 3; row++) e[8 + row] = -e[8 + row]!
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

/**
 * The player's arms in first person, drawn in the space of the camera so they cannot leave the view. Each arm is a sleeve (upper arm and forearm, an elbow and a cuff) and a hand of skin (a palm,
 * four fingers of three segments and a thumb that close on a grip); the right leg (trouser and shoe) appears only while a kick holds it. The hands go where the stance puts them (`relaxed`, `fists`) or,
 * in the `hold` stance, where the tool in the hands asks (`HandTargets` of game-contracts, world space); a two-bone IK from fixed shoulders brings the sleeves to them, the elbow bending down and out. A
 * clip (`play`) moves the hands and the foot over that, by a weight that is 0 at its start and end.
 *
 * Hand frame (both hands, as `HandPose`): x from the wrist to the knuckles, y the back of the hand, z the little-finger side of a right hand; a left hand is the right one mirrored.
 */
export function createFirstPersonArms(THREE: Three, options: FirstPersonArmsOptions = {}): FirstPersonArms {
  const colors: FirstPersonColors = { ...FIRST_PERSON_COLORS, ...options.colors }
  const rig: FirstPersonRig = {
    ...FIRST_PERSON_RIG,
    ...options.rig,
    radius: { ...FIRST_PERSON_RIG.radius, ...options.rig?.radius },
    foot: options.rig?.foot ?? FIRST_PERSON_RIG.foot,
  }
  const stances: Record<string, StanceDef> = { ...FIRST_PERSON_STANCES, ...options.stances }
  const bob: FirstPersonBob = { ...FIRST_PERSON_BOB, ...options.bob }
  const blendSeconds = options.blend ?? DEFAULT_BLEND
  const clips = new Map<string, FirstPersonClip>((options.clips ?? []).map((clip) => [clip.id, clip]))

  const root = new THREE.Group()
  root.name = 'first-person-arms'
  root.userData.viewmodel = true
  // a little of the colour glows by itself (`FILL`): the arms hang in the camera's space, where the scene's lights reach their undersides badly and a dark trouser would read as a hole
  const lit = (color: number): THREE_NS.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, emissive: scaleHex(color, FILL) })
  const materials = {
    skin: lit(colors.skin),
    sleeve: lit(colors.sleeve),
    cuff: lit(colors.cuff),
    trouser: lit(colors.trouser),
    shoe: lit(colors.shoe),
    sole: lit(scaleHex(colors.shoe, 0.55)),
  }
  const geometries: THREE_NS.BufferGeometry[] = []
  const Y = new THREE.Vector3(0, 1, 0)

  /** A tapered cylinder along +y from y = 0 (the wide end) to y = length, 8 sides. */
  const limb = (parent: THREE_NS.Object3D, wide: number, narrow: number, length: number, material: THREE_NS.Material): Segment => {
    const geometry = new THREE.CylinderGeometry(narrow, wide, length, 8, 1)
    geometry.translate(0, length / 2, 0)
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.userData.length = length
    parent.add(mesh)
    return mesh
  }
  const ball = (parent: THREE_NS.Object3D, radius: number, material: THREE_NS.Material): THREE_NS.Mesh => {
    const geometry = new THREE.SphereGeometry(radius, ELBOW_SEGMENTS, 6)
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }
  const place = (segment: Segment, from: THREE_NS.Vector3, to: THREE_NS.Vector3): void => {
    const direction = new THREE.Vector3().subVectors(to, from)
    const length = direction.length()
    segment.position.copy(from)
    if (length > 1e-6) segment.quaternion.setFromUnitVectors(Y, direction.divideScalar(length))
    segment.scale.y = length / (segment.userData.length as number)
  }

  const arms: Record<'R' | 'L', Arm> = {} as Record<'R' | 'L', Arm>
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1
    const hand = createHandMesh(THREE, materials.skin)
    const anchor = new THREE.Group()
    anchor.name = `first-person-hand-${side}`
    const mirror = new THREE.Group()
    mirror.scale.z = sign // the left hand is the right one mirrored about its z
    mirror.add(hand.root)
    anchor.add(mirror)
    root.add(anchor)
    const upper = limb(root, rig.radius.shoulder, rig.radius.elbow, rig.upper, materials.sleeve)
    const fore = limb(root, rig.radius.elbow, rig.radius.wrist, rig.fore, materials.sleeve)
    const cuff = limb(root, rig.radius.cuff, rig.radius.cuff, 0.03, materials.cuff)
    const elbow = ball(root, rig.radius.elbow * 1.02, materials.sleeve)
    arms[side] = { side, sign, hand, anchor, upper, fore, cuff, elbow, shown: newPose(THREE), from: newPose(THREE), mode: null, blend: 1, drawn: newPose(THREE) }
  }

  // the right leg, shown only while a kick holds it: a trouser, a knee, a trouser, a shoe
  const leg = new THREE.Group()
  leg.name = 'first-person-leg'
  leg.visible = false
  root.add(leg)
  const thigh = limb(leg, 0.088, 0.068, rig.thigh, materials.trouser)
  const shin = limb(leg, 0.068, 0.05, rig.shin, materials.trouser)
  const knee = ball(leg, 0.07, materials.trouser)
  const shoe = new THREE.Group()
  const shoeBox = (sx: number, sy: number, sz: number, x: number, y: number, material: THREE_NS.Material): void => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz)
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, 0)
    mesh.frustumCulled = false
    shoe.add(mesh)
  }
  shoeBox(0.27, 0.07, 0.1, 0.065, -0.05, materials.shoe)
  shoeBox(0.27, 0.025, 0.104, 0.065, -0.095, materials.sole)
  shoeBox(0.1, 0.05, 0.088, 0.17, -0.005, materials.shoe)
  leg.add(shoe)

  const shoulderOf = (sign: 1 | -1, out: THREE_NS.Vector3): THREE_NS.Vector3 => out.set(rig.shoulder[0] * sign, rig.shoulder[1], rig.shoulder[2])
  const poleOf = (sign: 1 | -1): THREE_NS.Vector3 => new THREE.Vector3(rig.elbowPole[0] * sign, rig.elbowPole[1], rig.elbowPole[2])
  const kneePole = new THREE.Vector3(...rig.kneePole)
  const hip = new THREE.Vector3(...rig.hip)

  const euler = new THREE.Euler(0, 0, 0, 'YZX')
  const quaternionOf = (r: readonly [number, number, number]): THREE_NS.Quaternion => new THREE.Quaternion().setFromEuler(euler.set(r[0], r[1], r[2], 'YZX'))
  const restPose = (rest: RestPose, mirror: boolean, out: Pose): Pose => {
    out.p.set(...rest.p)
    out.q.copy(quaternionOf(rest.r))
    if (mirror) {
      out.p.x = -out.p.x
      out.q.copy(mirrorQuaternion(THREE, out.q))
    }
    out.grip = rest.grip ?? 0
    out.scale = 1
    return out
  }
  const DEFAULT_REST: RestPose = { p: [0.17, -0.3, -0.3], r: [0, 1.5, 0], grip: 0.3 }
  const stanceRest = (id: string, side: 'R' | 'L', out: Pose): Pose => {
    const stance = stances[id] ?? stances.relaxed
    const right = stance?.R ?? DEFAULT_REST
    const left = stance?.L
    if (side === 'R') return restPose(right, false, out)
    return left && left !== 'mirror' ? restPose(left, false, out) : restPose(right, true, out)
  }

  const camPosition = new THREE.Vector3()
  const camQuaternion = new THREE.Quaternion()
  const camInverse = new THREE.Quaternion()
  const camScale = new THREE.Vector3()
  const toCamera = (target: HandPose, grip: number, scale: number, out: Pose): Pose => {
    out.p.set(...target.position).sub(camPosition).applyQuaternion(camInverse)
    out.q.set(...target.quaternion).premultiply(camInverse)
    out.grip = grip
    out.scale = scale
    return out
  }

  const listeners = new Set<(event: FirstPersonEvent) => void>()
  let run: { clip: FirstPersonClip; time: number; left: boolean } | null = null
  const emit = (event: FirstPersonEvent): void => {
    for (const listener of listeners) listener(event)
  }
  const fire = (clip: FirstPersonClip, from: number, to: number): void => {
    for (const event of clipEventsBetween(clip, from, to)) emit({ ...event, clip: clip.id })
  }

  let stanceId = 'relaxed'
  let phase = 0
  let swing = 0
  let sink = 0
  let first = true
  const bobOffset = new THREE.Vector3()
  const desired = newPose(THREE)
  const channelPose = newPose(THREE)
  const mixed = newPose(THREE)
  const bone = createTwoBone(THREE)
  const shoulder = new THREE.Vector3()
  const wristAt = new THREE.Vector3()
  const palmAt = new THREE.Vector3()
  const fingers = new THREE.Vector3()
  const towards = new THREE.Vector3()

  /** The hand of the clip's channel, in the camera's space, as a pose. */
  const fromChannel = (channel: FirstPersonSampleChannel, side: 'R' | 'L', base: Pose, out: Pose): Pose => {
    out.p.set(...channel.p)
    out.q.copy(quaternionOf(channel.r))
    if (channel.mirror && side === 'L') {
      out.p.x = -out.p.x
      out.q.copy(mirrorQuaternion(THREE, out.q))
    }
    out.grip = channel.grip ?? base.grip
    out.scale = base.scale
    return out
  }

  const drawArm = (arm: Arm, pose: Pose): void => {
    copyPose(arm.drawn, pose)
    const scale = pose.scale
    // the wrist is where the forearm ends: behind the palm along the fingers
    fingers.set(1, 0, 0).applyQuaternion(pose.q)
    wristAt.copy(pose.p).addScaledVector(fingers, -rig.wrist * scale)
    shoulderOf(arm.sign, shoulder).add(bobOffset)
    // an arm that cannot reach brings its shoulder forward, toward the hand, up to `reachShift`: the shoulders are never on screen, so a weapon held out at the length of a rifle stays in the hands
    const excess = shoulder.distanceTo(wristAt) - (rig.upper + rig.fore) * REACH_SLACK
    if (excess > 0 && rig.reachShift > 0) shoulder.addScaledVector(towards.subVectors(wristAt, shoulder).normalize(), Math.min(excess, rig.reachShift))
    solveTwoBone(shoulder, wristAt, rig.upper, rig.fore, poleOf(arm.sign), bone)
    // out of reach, the hand stays on the end of the forearm
    palmAt.copy(bone.end).addScaledVector(fingers, rig.wrist * scale)
    arm.drawn.p.copy(palmAt)
    arm.anchor.position.copy(palmAt)
    arm.anchor.quaternion.copy(pose.q)
    arm.anchor.scale.setScalar(scale)
    arm.hand.setGrip(pose.grip)
    place(arm.upper, shoulder, bone.joint)
    place(arm.fore, bone.joint, bone.end)
    arm.elbow.position.copy(bone.joint)
    // the cuff sits at the end of the forearm, a little onto the wrist
    const toWrist = new THREE.Vector3().subVectors(bone.end, bone.joint).normalize()
    place(arm.cuff, new THREE.Vector3().copy(bone.end).addScaledVector(toWrist, -0.02), new THREE.Vector3().copy(bone.end).addScaledVector(toWrist, 0.012))
  }

  const footPose = newPose(THREE)
  const footRest = newPose(THREE)
  const ankle = new THREE.Vector3()
  const hipMirrored = new THREE.Vector3(-hip.x, hip.y, hip.z)
  const kneePoleMirrored = new THREE.Vector3(-kneePole.x, kneePole.y, kneePole.z)
  const drawLeg = (pose: Pose, left: boolean): void => {
    const origin = left ? hipMirrored : hip
    solveTwoBone(origin, pose.p, rig.thigh, rig.shin, left ? kneePoleMirrored : kneePole, bone)
    ankle.copy(bone.end)
    place(thigh, origin, bone.joint)
    place(shin, bone.joint, ankle)
    knee.position.copy(bone.joint)
    shoe.position.copy(ankle)
    shoe.quaternion.copy(pose.q)
  }

  const modeOf = (key: string, arm: Arm): void => {
    if (arm.mode === key) return
    copyPose(arm.from, arm.shown)
    arm.mode = key
    arm.blend = first ? 1 : 0
  }

  return {
    root,
    get playing() {
      return run ? run.clip.id : null
    },
    get stance() {
      return stanceId
    },
    play(id, options) {
      const clip = clips.get(id)
      if (!clip) return false
      run = { clip, time: 0, left: options?.leg === 'left' }
      fire(clip, -1e-9, 0) // the events at t = 0 fire as the clip starts
      return true
    },
    stop() {
      run = null
    },
    update(dt, state) {
      const { camera } = state
      camera.updateWorldMatrix(true, false)
      camera.matrixWorld.decompose(camPosition, camQuaternion, camScale)
      camInverse.copy(camQuaternion).invert()
      root.position.copy(camPosition)
      root.quaternion.copy(camQuaternion)
      root.updateMatrixWorld(true)

      // walk bob: the shoulders (and the hands at rest) sway and rise with the stride, more when running, less when still; crouching sinks them
      const speed = state.speed ?? 0
      const target = Math.min(1, speed / bob.fullSpeed) * (state.running ? bob.run : 1)
      swing += (target - swing) * Math.min(1, dt * 8)
      phase += dt * speed * bob.frequency
      sink += ((state.crouch ? 1 : 0) - sink) * Math.min(1, dt * 8)
      bobOffset.set(Math.sin(phase) * bob.x * swing, Math.sin(phase * 2) * bob.y * swing - bob.crouch * sink, 0)

      stanceId = state.stance ?? 'relaxed'
      const stance = stances[stanceId] ?? stances.relaxed
      const targets = state.targets ?? null

      // where the clip is now
      if (run) {
        const from = run.time
        run.time += dt
        fire(run.clip, from, Math.min(run.time, run.clip.duration))
      }
      const sample = run ? sampleFirstPersonClip(run.clip, Math.min(run.time, run.clip.duration)) : null

      for (const side of ['R', 'L'] as const) {
        const arm = arms[side]
        const target = targets?.[side]
        let mode: string
        if (stance?.follow && target) {
          mode = 'target'
          toCamera(target, (side === 'L' ? targets?.gripL : undefined) ?? targets?.grip ?? 1, targets?.scale ?? 1, desired)
        } else {
          mode = `rest:${stance?.follow ? (stance.fallback ?? 'relaxed') : stanceId}`
          stanceRest(stance?.follow ? (stance.fallback ?? 'relaxed') : stanceId, side, desired)
          desired.p.add(bobOffset)
        }
        modeOf(mode, arm)
        arm.blend = blendSeconds <= 0 ? 1 : Math.min(1, arm.blend + dt / blendSeconds)
        if (arm.blend >= 1) copyPose(arm.shown, desired)
        else mixPose(THREE, arm.shown, arm.from, desired, ease(arm.blend))
        const channel = sample?.[side]
        if (channel && channel.w > 0) {
          fromChannel(channel, side, arm.shown, channelPose)
          mixPose(THREE, mixed, arm.shown, channelPose, channel.w)
          drawArm(arm, mixed)
        } else drawArm(arm, arm.shown)
      }

      // the leg of a kick
      const foot = sample?.F
      leg.visible = !!foot && foot.w > FOOT_SHOWN
      if (foot && leg.visible) {
        restPose(rig.foot, false, footRest)
        fromChannel(foot, 'R', footRest, footPose)
        mixPose(THREE, mixed, footRest, footPose, foot.w)
        copyPose(footPose, mixed)
        // the left leg is the right one in a mirror
        if (run?.left) {
          footPose.p.x = -footPose.p.x
          footPose.q.copy(mirrorRotation(THREE, footPose.q))
        }
        drawLeg(footPose, run?.left ?? false)
      }
      if (run && run.time >= run.clip.duration) run = null
      first = false
    },
    on(_type, listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    handPose(side) {
      const pose = arms[side].drawn
      return { position: pose.p.clone(), quaternion: pose.q.clone(), grip: pose.grip }
    },
    dispose() {
      run = null
      listeners.clear()
      for (const arm of Object.values(arms)) arm.hand.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of Object.values(materials)) material.dispose()
      root.removeFromParent()
    },
  }
}
