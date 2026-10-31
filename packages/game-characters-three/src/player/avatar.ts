import {
  POSE_CLIPS,
  clipEventsBetween,
  createPoseClipRegistry,
  createRng,
  filterPoseChannels,
  samplePoseClip,
  walkCadence,
  walkGait,
} from '@adatechnology/game-characters'
import type { GaitProfile, PoseClip, PoseClipEvent, PoseClipRegistry } from '@adatechnology/game-characters'
import type { HandTargets } from '@adatechnology/game-contracts'

import preset from '../presets/player-avatar.json'
import { buildHand } from '../rich/accessories/hands'
import { createBestBuilder } from '../rich/best-builder'
import { createRigAnimator } from '../rich/animator'
import type { PoseTargets, RichRig } from '../rich/animator'
import type { Three, THREE_NS } from '../three'
import { createArmReach } from './arm-reach'

const TWO_PI = Math.PI * 2
const MAX_GAIT = 1.4
const CLIP_BLEND = 0.12
const CLIP_CASCADE = 5
const FALL_SECONDS = 0.3

// Constants carried from the team game's GPU pose code, `BODY_CHUNK` (src/instanced/body-chunk.ts), whose line numbers are quoted below.
const HIP_HEIGHT = 0.95 // :68, :74 the trunk pivot
const WALK_ARM = 0.28 // arms swing naturally beside the hips, staying below the waist
const WALK_BOB = 0.035 // :71 `abs(sin(ph))*0.035*gait`
const WALK_LEAN = 0.04 // :64 `0.04*gait`
const RUN_LEAN = 0.16
const RUN_BOB = 0.05
const REST_ARM_Z = 0.18 // outward carrying angle: clears hips and pelvis comfortably
const CROUCH = { thigh: -0.95, thighWalk: 0.3, shin: 1.9, lean: 0.25, drop: -0.35 } // :29, :66, :71
const AIMED = { shoulder: -1.42, perAim: 0.85, swing: 0.02, zRight: -0.54, zLeft: 0.36, elbowRight: -0.04, elbowLeft: -0.12 } // :45, :47
const SIT = { thigh: -1.5, lean: -0.08, arm: -0.45, armZ: 0.12, elbow: -0.75 }
const LIE = { knee: 0.08, armZ: 0.12, elbow: -0.1 }
const DOWN = { thighWalk: 0.5, shinSwing: 0.85, shinBend: 1.3, armHigh: -2.8, armLow: -0.35, armWave: 0.3, armZ: 0.5, armZWave: 0.3, tilt: 1.5, roll: 0.3, hipY: 0.16, hipZ: 0.6, hipZFlip: 1.2 } // :29-:47, :74
/** `playerHand()`: the elbow-to-hand offset of the weapon hand (the weapon hand is the puppet's right, at -x). */
const HAND_OFFSET = { x: 0, y: -0.33, z: 0.04 }

export type PlayerAvatarSpec = Record<string, unknown>

export type PlayerAvatarOptions = {
  /** The body spec for the rich builder (`createBestBuilder.build`). Default: the team game's player (`player-avatar.json`). Merged over the default. */
  readonly spec?: PlayerAvatarSpec
  /** Shirt colour, 0xRRGGBB. Default the team game's `PLAYER_COR`. */
  readonly shirtColor?: number
  /** The clips `play(id)` finds. Default: a registry with `POSE_CLIPS`. */
  readonly clips?: PoseClipRegistry
  /** Seconds to blend a clip in and out. Default 0.12. */
  readonly blend?: number
  /** Seconds the body takes to go down (the shader's `fk` smoothstep). 0 is instant. Default 0.3. */
  readonly fallSeconds?: number
  /** Smooth the joints with the Bestiário cascade (default true). */
  readonly cascade?: boolean
  /**
   * How many times faster the cascade follows while a clip that does not loop plays: a strike is over in a third of a second, and at the walk's pace the joints would
   * still be on their way when it ends (a punch that never reaches the shoulder). 1 keeps the walk's pace. Default 5.
   */
  readonly clipCascade?: number
}

export type AvatarEvent = PoseClipEvent & { clip: string }

export type AvatarItemUsePose = {
  readonly id: string
  readonly position: readonly [number, number, number]
  readonly rotation: readonly [number, number, number]
}

export type AvatarUpdate = {
  /** Ground speed, m/s. Ties cadence and swing to the ground (the game's `walkCad` and `walkGait`). */
  speed?: number
  /** Accepted for the game's state; the gait depends on the speed alone, as in the team game. */
  running?: boolean
  crouch?: boolean
  down?: boolean
  /** Weapon in hand: both arms follow the aim (the game's arm code). Default false. */
  armed?: boolean
  /** The camera pitch the game's `playerArmCode()` reads (`view.pitch`). */
  pitch?: number
  /** Leg yaw toward the step while armed (the game's `P.hip`, radians). */
  hip?: number
  /** Whether the player is carrying an item in the right hand. */
  holding?: boolean
  /** Active scripted item use (`drink`, `sip`, `chug`, `pour`, `open`, `close`, `tilt`). */
  itemUse?: AvatarItemUsePose | null
  /** Hands on a piece of furniture: `grip` closes on it with `progress`, `push` walks with it, `strain` strains against what does not give. */
  push?: { readonly phase: 'grip' | 'push' | 'strain'; readonly progress: number } | null
  /** On a seat: `sit` folds the legs under hips `hip` metres above the feet, `lie` lays the body face up with the pelvis there, the head behind the facing. */
  seat?: { readonly pose: 'sit' | 'lie'; readonly hip: number } | null
}

export type PlayPoseOptions = {
  onEvent?: (event: AvatarEvent) => void
  /** Overrides the avatar's blend for this clip. */
  blend?: number
}

/** The colours the body was drawn with, for whatever has to match it (the first-person arms): skin, shirt, trousers and shoes as 0xRRGGBB, and whether the sleeves cover the forearms. */
export type PlayerAvatarColors = { skin: number; shirt: number; trousers: number; shoes: number; longSleeves: boolean }

export type PlayerAvatar = {
  root: THREE_NS.Object3D
  rig: RichRig
  /** What the body wears, read from the body itself. */
  readonly colors: PlayerAvatarColors
  /** The three.js namespace the body was made with, so what is made to fit it (the first-person arms) uses the same one. */
  readonly three: Three
  update(dt: number, state?: AvatarUpdate): void
  play(clip: string | PoseClip, options?: PlayPoseOptions): void
  stop(): void
  readonly playing: string | null
  /** A socket at the hand: 'R' is the weapon hand (the puppet's right, at -x), 'L' the other one. */
  hand(side: 'R' | 'L'): THREE_NS.Object3D
  /** The joint of a shoulder ('R' the weapon side, at -x): where a long gun's stock rests, just inside it. */
  shoulder(side: 'R' | 'L'): THREE_NS.Object3D
  /**
   * Brings the hands to where the tool in them asks (`HandTargets`, world space) after `update`: shoulder, elbow and wrist each bend inside the human range, the chest turns and the shoulder
   * blade slides toward a hand out of reach. Null, a strike playing or the body going down leave the arms as `update` posed them. Call it after the tool is placed and the root moved.
   */
  reach(targets: HandTargets | null): void
  on(type: 'event', listener: (event: AvatarEvent) => void): () => void
  dispose(): void
}

const hexOf = (value: unknown): number => (typeof value === 'string' ? Number.parseInt(value, 16) : (value as number))
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const fract = (value: number): number => value - Math.floor(value)

type ClipRun = { clip: PoseClip; time: number; weight: number; target: 0 | 1; blend: number; onEvent?: (event: AvatarEvent) => void }

/**
 * The player's body: the rich human of the Bestiário/Elenco, built with the team game's player spec (data, overridable), walking with the engine's gait tied
 * to the ground speed, with the crouch and the knock-down of the game's GPU pose code (`BODY_CHUNK`) and a pose-clip overlay (`play`).
 */
export const createPlayerAvatar = (THREE: Three, options: PlayerAvatarOptions = {}): PlayerAvatar => {
  const pose = {
    armL: 0,
    armR: 0,
    elbL: -0.08,
    elbR: -0.08,
    lean: 0.04,
    headX: 0,
    headZ: 0,
    ...(preset.spec as { pose?: Record<string, number> }).pose,
    ...(options.spec?.pose as Record<string, number> | undefined),
  }
  const spec = { ...preset.spec, ...options.spec, pose } as Record<string, unknown>
  for (const key of ['skin', 'hair']) if (typeof spec[key] === 'string') spec[key] = hexOf(spec[key])
  const best = createBestBuilder(THREE, { types: [{ name: String(spec.type), eye: 0 }], random: createRng(Number(spec.seed ?? 1)) })
  const body = best.build(spec) as THREE_NS.Object3D
  best.topM().color.setHex(options.shirtColor ?? hexOf(preset.shirtColor))
  const rig = body.userData.rig as RichRig

  // walk: the profile follows the speed (arm swing and bob are the shader's numbers times the stride)
  const profile: { -readonly [K in keyof GaitProfile]: GaitProfile[K] } = { f: 1.1, a: 0.28, k: 0.35, arm: WALK_ARM, bob: WALK_BOB }
  const animator = createRigAnimator({ gaits: { [rig.type]: profile } })
  const clips = options.clips ?? createPoseClipRegistry(POSE_CLIPS)
  const blendDefault = options.blend ?? CLIP_BLEND
  const fallSeconds = options.fallSeconds ?? FALL_SECONDS
  const smooth = options.cascade ?? true
  const clipCascade = options.clipCascade ?? CLIP_CASCADE

  const root = new THREE.Group()
  const tilt = new THREE.Group()
  tilt.add(body)
  root.add(tilt)
  const colorOf = (object: THREE_NS.Object3D | undefined): number | undefined => ((object as THREE_NS.Mesh | undefined)?.material as THREE_NS.MeshLambertMaterial | undefined)?.color?.getHex()
  const meshesOf = (node: THREE_NS.Object3D): THREE_NS.Mesh[] => node.children.filter((child) => (child as THREE_NS.Mesh).isMesh) as THREE_NS.Mesh[]
  // the trousers are the first mesh of the thigh, the shoe the flattened long ball on the shin, the sleeve (or the skin of a bare arm) the first mesh of the forearm
  const shirt = options.shirtColor ?? hexOf(preset.shirtColor)
  const shoe = meshesOf(rig.legs[0]!.kn as unknown as THREE_NS.Object3D).find((mesh) => mesh.scale.z > 1.5)
  const forearm = colorOf(meshesOf(rig.arms[1]!.el as unknown as THREE_NS.Object3D)[0])
  const colors: PlayerAvatarColors = {
    skin: Number(spec.skin),
    shirt,
    trousers: colorOf(meshesOf(rig.legs[0]!.g as unknown as THREE_NS.Object3D)[0]) ?? 0x2d3440,
    shoes: colorOf(shoe) ?? 0x1c1a1a,
    longSleeves: forearm === shirt,
  }
  const sockets = { R: new THREE.Object3D(), L: new THREE.Object3D() }
  // arms[0] is at +x (the puppet's left), arms[1] at -x: the weapon hand of the game (`playerHand`: shoulder at -x)
  const armOf = { R: rig.arms[1]!, L: rig.arms[0]! }
  for (const side of ['R', 'L'] as const) {
    sockets[side].name = `hand_${side}`
    sockets[side].position.set(HAND_OFFSET.x, HAND_OFFSET.y, HAND_OFFSET.z)
    ;(armOf[side].el as unknown as THREE_NS.Object3D).add(sockets[side])
  }

  // Replace the single flattened sphere hand of the zombie builder on the player body with the articulated palm, four two-jointed fingers and thumb (`buildHand` of Retratos do Vale)
  const addMesh = (parent: THREE_NS.Object3D, geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE_NS.Mesh => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  type ThirdPersonHand = { side: 1 | -1; hg: THREE_NS.Group; fingers: THREE_NS.Object3D[]; th: THREE_NS.Object3D | null }
  const hands: ThirdPersonHand[] = []
  rig.arms.forEach((arm, index) => {
    const el = arm.el as unknown as THREE_NS.Object3D
    const side: 1 | -1 = index === 0 ? 1 : -1
    const oldHand = meshesOf(el).find((mesh) => Math.abs(mesh.position.y + 0.33) < 0.025)
    const handMaterial = (oldHand?.material as THREE_NS.Material | undefined) ?? new THREE.MeshLambertMaterial({ color: colors.skin })
    if (oldHand) {
      oldHand.geometry?.dispose()
      el.remove(oldHand)
    }
    const hg = new THREE.Group()
    hg.name = side > 0 ? 'hand_group_L' : 'hand_group_R'
    hg.position.set(side * 0.02, -0.3, 0.01)
    el.add(hg)
    const palm = addMesh(hg, new THREE.SphereGeometry(0.048, 14, 10), handMaterial, 0, -0.035, 0)
    palm.scale.set(0.6, 1.05, 1)
    const built = buildHand({ THREE, add: addMesh, hg, handM: handMaterial, s: side, detailed: true })
    hands.push({ side, hg, fingers: built.fingers as THREE_NS.Object3D[], th: built.th as THREE_NS.Object3D | null })
  })
  const armReach = createArmReach(THREE, rig, { R: hands.find((hand) => hand.side < 0)!.hg, L: hands.find((hand) => hand.side > 0)!.hg })
  const setHandGrip = (hand: ThirdPersonHand, grip: number, wristX = 0): void => {
    hand.fingers.forEach((finger, j) => {
      finger.rotation.z = -hand.side * grip * (j % 2 ? 1.1 : 0.9)
    })
    if (hand.th) hand.th.rotation.z = -hand.side * (0.32 + grip * 0.25)
    hand.hg.rotation.x = wristX
  }

  const legRestX = rig.legs.map((leg) => leg.g.position.x)
  /** Measured once with the leg straight: how far below the trunk pivot the leg hangs from, the thigh, and the knee to the sole. */
  const legLengths = (() => {
    const thigh = rig.legs[0]!.g as unknown as THREE_NS.Object3D
    const shin = rig.legs[0]!.kn as unknown as THREE_NS.Object3D
    root.updateMatrixWorld(true)
    const hipY = thigh.getWorldPosition(new THREE.Vector3()).y
    const kneeY = shin.getWorldPosition(new THREE.Vector3()).y
    return { hipBelowTrunk: HIP_HEIGHT - hipY, thigh: hipY - kneeY, shin: kneeY - new THREE.Box3().setFromObject(shin).min.y }
  })()
  const legSide = (index: number): number => (index === 0 ? 1 : -1) // the shader's `legS`: +1 for the leg at -x (legs[0])
  let cycles = 0 // the game's `player.ph`: gait cycles
  let time = 0
  let fall = 0
  let run: ClipRun | null = null
  const listeners = new Set<(event: AvatarEvent) => void>()

  const emit = (event: AvatarEvent, onEvent?: (event: AvatarEvent) => void): void => {
    onEvent?.(event)
    for (const listener of listeners) listener(event)
  }

  const readPose = (): Record<string, number> => ({
    lean: rig.upper.rotation.x,
    twist: rig.upper.rotation.y,
    side: rig.upper.rotation.z,
    drop: rig.fig.position.y - rig.dropBase,
    headX: rig.headG.rotation.x,
    headY: rig.headG.rotation.y,
    headZ: rig.headG.rotation.z,
    armR: rig.arms[0]!.g.rotation.x,
    armL: rig.arms[1]!.g.rotation.x,
    elbR: rig.arms[0]!.el.rotation.x,
    elbL: rig.arms[1]!.el.rotation.x,
    armRz: rig.arms[0]!.g.rotation.z,
    armLz: rig.arms[1]!.g.rotation.z,
    legL: rig.legs[0]!.g.rotation.x,
    legR: rig.legs[1]!.g.rotation.x,
    kneeL: rig.legs[0]!.kn.rotation.x,
    kneeR: rig.legs[1]!.kn.rotation.x,
  })

  /** Arms and legs of the armed human (`:45`, `:47`, `:53`): both hands on the weapon, the arms follow the aim. */
  const armed = (pitch: number, gait: number, hip: number): PoseTargets => {
    const aim = clamp((pitch + 1) / 3, 0, 0.99) * 3 - 1 // `(playerArmCode() - 2) * 3 - 1`
    const shoulder = AIMED.shoulder + aim * AIMED.perAim + AIMED.swing * Math.sin(cycles * TWO_PI) * gait
    rig.legs.forEach((leg, index) => {
      const x = legRestX[index]!
      leg.g.rotation.y = hip
      leg.g.position.x = x * Math.cos(hip)
      leg.g.position.z = -x * Math.sin(hip)
    })
    // arms[0] is the support hand (+x), arms[1] the weapon hand (-x)
    return { armR: shoulder, armL: shoulder, armRz: AIMED.zRight, armLz: AIMED.zLeft, elbR: AIMED.elbowRight, elbL: AIMED.elbowLeft }
  }

  /** The stretched arms of `shove_two_hands` (attack clips) held on the piece, the body leaning into it; straining, the legs brace and the arms shake. */
  const pushingPose = (push: NonNullable<AvatarUpdate['push']>): PoseTargets => {
    const on = push.phase === 'grip' ? Math.min(1, push.progress * 2.2) : 1
    const strain = push.phase === 'strain' ? 1 : 0
    const shake = strain * Math.sin(time * 40) * 0.025
    const raise = -1.5 * on
    const elbow = -0.9 + 0.72 * (push.phase === 'grip' ? push.progress : 1) + strain * 0.12
    return {
      lean: (0.2 + 0.2 * strain) * on,
      headX: (0.05 + 0.08 * strain) * on,
      armR: raise + shake,
      armL: raise - shake,
      armRz: -0.08 * on,
      armLz: 0.08 * on,
      elbR: elbow,
      elbL: elbow,
      ...(strain ? { legL: -0.5, legR: 0.4, kneeL: 0.55, kneeR: 0.08, drop: -0.05 } : {}),
    }
  }

  /** Right-hand carry and item-use poses in third person (`arms[1]` is the puppet's right arm at `-x`, `arms[0]` is the left arm at `+x`). */
  const holdingPose = (gait: number, itemUse?: AvatarItemUsePose | null): PoseTargets => {
    const bob = Math.sin(cycles * TWO_PI) * 0.05 * gait
    if (!itemUse) {
      return { armL: -0.45 + bob, armLz: 0.22, elbL: -1.05 }
    }
    const { id, position, rotation } = itemUse
    if (id === 'drink' || id === 'sip' || id === 'chug') {
      const raise = clamp((position[1] + 0.2) / 0.22, 0, 1)
      const tilt = clamp(Math.abs(rotation[0]) / 1.22, 0, 1.15)
      return {
        armL: -0.45 - 0.95 * raise - 0.22 * tilt,
        armLz: 0.22 + 0.44 * raise,
        elbL: -1.05 - 0.85 * raise + 0.12 * tilt,
        headX: -0.26 * tilt,
      }
    }
    if (id === 'open' || id === 'close') {
      const reach = clamp((0.22 - position[0]) / 0.12, 0, 1)
      return {
        armL: -0.45 - 0.35 * reach,
        armLz: 0.22 + 0.28 * reach,
        elbL: -1.05 - 0.25 * reach,
        armR: -0.78 * reach,
        armRz: -0.48 * reach,
        elbR: -1.25 * reach,
      }
    }
    // pour, pour_out, tilt
    const raise = clamp((position[1] + 0.2) / 0.25, 0, 1)
    const tilt = clamp(Math.abs(rotation[0]) / 1.75, 0, 1.2)
    const ext = Math.max(raise, tilt * 0.75)
    return {
      armL: -0.45 - 0.48 * ext,
      armLz: 0.22 + 0.08 * ext,
      elbL: -1.05 + 0.38 * ext,
    }
  }
  const resetLegYaw = (): void => {
    rig.legs.forEach((leg, index) => {
      leg.g.rotation.y = 0
      leg.g.position.x = legRestX[index]!
      leg.g.position.z = 0
    })
  }

  /** Running gait: forward torso lean, pronounced body drop, higher knee lift and bent-elbow arm pumping. */
  const runningPose = (gait: number, busyHands = false): PoseTargets => {
    const ph = cycles * TWO_PI
    const sine = Math.sin(ph)
    const cosine = Math.cos(ph)
    const legL = sine * 0.65 * gait
    const legR = -sine * 0.65 * gait
    const kneeL = Math.max(0, -cosine) * 1.15 * gait
    const kneeR = Math.max(0, cosine) * 1.15 * gait
    const targets: PoseTargets = {
      lean: RUN_LEAN * Math.min(1, gait),
      drop: Math.abs(cosine) * RUN_BOB * gait,
      legL,
      legR,
      kneeL,
      kneeR,
    }
    if (!busyHands) {
      targets.armR = -0.32 - sine * 0.65 * gait
      targets.armL = -0.32 + sine * 0.65 * gait
      targets.elbR = -1.25 + Math.max(0, sine) * 0.3 * gait
      targets.elbL = -1.25 + Math.max(0, -sine) * 0.3 * gait
      targets.armRz = 0.22
      targets.armLz = -0.22
    }
    return targets
  }

  const crouchPose = (gait: number): PoseTargets => {
    const swing = (leg: number): number => {
      const legS = legSide(leg)
      return CROUCH.thigh - Math.sin(cycles * TWO_PI) * legS * CROUCH.thighWalk * gait
    }
    return {
      legL: swing(0),
      legR: swing(1),
      kneeL: CROUCH.shin,
      kneeR: CROUCH.shin,
      lean: WALK_LEAN * gait + CROUCH.lean,
      drop: Math.abs(Math.sin(cycles * TWO_PI)) * WALK_BOB * gait + CROUCH.drop,
    }
  }

  /** The knocked-down limbs (`:26-:31`, `:40-:43`, `:47`) with the stride at 1, as the game pushes it while down. */
  const downPose = (): PoseTargets => {
    const ph = cycles * TWO_PI
    const gait = 1
    const leg = (index: number): { hip: number; knee: number } => {
      const legS = legSide(index)
      const walkS = Math.sin(ph) * legS
      const bend = fract(cycles * 3) * legS > 0.3 ? fract(cycles * 3) * DOWN.shinBend : Math.max(0, Math.cos(ph + (legS > 0 ? 0 : Math.PI))) * DOWN.shinSwing * gait
      return { hip: -walkS * DOWN.thighWalk * gait, knee: bend }
    }
    const arm = (index: number): { shoulder: number; z: number; elbow: number } => {
      const side = index === 0 ? 1 : -1 // arms[0] at +x
      const armS = Math.sin(ph) * (side > 0 ? 1 : -1)
      const shoulder = fract(cycles * 5) > 0.5 && side > 0 ? DOWN.armHigh : DOWN.armLow + DOWN.armWave * Math.sin(cycles * 5 + side)
      return { shoulder, z: side * (DOWN.armZ + DOWN.armZWave * Math.sin(cycles * 3)), elbow: -0.35 - Math.max(0, armS) * 0.4 * gait }
    }
    const [l, r] = [leg(0), leg(1)]
    const [a0, a1] = [arm(0), arm(1)]
    return {
      legL: l.hip,
      kneeL: l.knee,
      legR: r.hip,
      kneeR: r.knee,
      armR: a0.shoulder,
      armRz: a0.z,
      elbR: a0.elbow,
      armL: a1.shoulder,
      armLz: a1.z,
      elbL: a1.elbow,
      lean: WALK_LEAN * gait,
      drop: Math.abs(Math.sin(ph)) * WALK_BOB * gait,
    }
  }

  /** The knee opens until the sole reaches the floor: a low seat sends the shins forward, a high one lets them hang straight down. */
  const sitPose = (hip: number): PoseTargets => {
    const knee = hip - legLengths.hipBelowTrunk - legLengths.thigh * Math.cos(SIT.thigh)
    const shinFromVertical = Math.acos(clamp(knee / legLengths.shin, 0, 1))
    const bend = -SIT.thigh - shinFromVertical
    return {
    legL: SIT.thigh,
    legR: SIT.thigh,
    kneeL: bend,
    kneeR: bend,
    lean: SIT.lean,
    drop: hip - HIP_HEIGHT,
    armR: SIT.arm,
    armL: SIT.arm,
    armRz: SIT.armZ,
    armLz: -SIT.armZ,
    elbR: SIT.elbow,
    elbL: SIT.elbow,
    }
  }
  const liePose = (): PoseTargets => ({ legL: 0, legR: 0, kneeL: LIE.knee, kneeR: LIE.knee, lean: 0, drop: 0, armR: 0, armL: 0, armRz: LIE.armZ, armLz: -LIE.armZ, elbR: LIE.elbow, elbL: LIE.elbow })
  /** Face up, the pelvis `hip` metres above the feet: a quarter turn about the hip, head toward -z. */
  const layBody = (hip: number): void => {
    tilt.rotation.set(-Math.PI / 2, 0, 0, 'XYZ')
    const pivot = new THREE.Vector3(0, HIP_HEIGHT, 0).applyEuler(tilt.rotation)
    tilt.position.set(0, hip, 0).sub(pivot)
  }

  const placeBody = (progress: number): void => {
    // `:74`: the whole body turns about the hip (face down or face up by the phase) and the hip drops to the ground
    const fk = progress * progress * (3 - 2 * progress)
    const flip = fract(cycles * 1.7) >= 0.5 ? 1 : 0
    tilt.rotation.set((-DOWN.tilt + flip * 2 * DOWN.tilt) * fk, 0, Math.sin(cycles * 7) * DOWN.roll * fk, 'XYZ')
    const hip = new THREE.Vector3(0, HIP_HEIGHT, 0)
    const target = new THREE.Vector3(0, DOWN.hipY, -DOWN.hipZ + flip * DOWN.hipZFlip)
    const place = new THREE.Vector3(0, HIP_HEIGHT * (1 - fk), 0).addScaledVector(target, fk)
    tilt.position.copy(place.sub(hip.applyEuler(tilt.rotation)))
  }

  const fireClipEvents = (r: ClipRun, from: number, to: number): void => {
    for (const event of clipEventsBetween(r.clip, from, to)) emit({ ...event, clip: r.clip.id }, r.onEvent)
  }

  const stepClip = (dt: number, down: boolean, crouch: boolean): void => {
    if (!run) return
    const r = run
    const from = r.time
    r.time += dt
    const { duration } = r.clip
    if (r.clip.loop && r.time > duration) {
      fireClipEvents(r, from, duration)
      r.time -= duration * Math.floor(r.time / duration)
      fireClipEvents(r, -1e-9, r.time)
    } else {
      fireClipEvents(r, from, Math.min(r.time, duration))
      if (r.time >= duration && !r.clip.loop) r.target = 0
    }
    r.weight = r.blend <= 0 ? r.target : clamp(r.weight + (r.target ? dt : -dt) / r.blend, 0, 1)
    if (r.target === 0 && r.weight <= 0) {
      run = null
      return
    }
    if (down) return
    // a crouched body keeps its legs bent under a punch or the guard: only a kick needs them
    const keepsCrouch = crouch && !r.clip.events?.some((event) => event.data?.kind === 'kick')
    const channels = r.clip.channels ?? 'full'
    const sampled = filterPoseChannels(filterPoseChannels(samplePoseClip(r.clip, Math.min(r.time, duration)), channels), keepsCrouch ? 'upper' : 'full')
    const current = readPose()
    const blended: Record<string, number> = {}
    for (const [name, value] of Object.entries(sampled)) if (name in current) blended[name] = current[name]! + (value - current[name]!) * r.weight
    animator.setPose(rig, blended as PoseTargets)
  }

  return {
    root,
    rig,
    colors,
    three: THREE,
    get playing() {
      return run ? run.clip.id : null
    },
    update(dt, state = {}) {
      armReach.restore()
      const speed = state.speed ?? 0
      const moving = speed >= 0.05 // the game: `spd < 0.05 ? 0 : walkCad(spd)`
      const down = !!state.down
      const running = Boolean(state.running && moving && !down && !state.crouch)
      if (moving) cycles += dt * (running ? walkCadence(speed) * 1.3 : walkCadence(speed))
      const gait = Math.min(MAX_GAIT, walkGait(speed))
      profile.arm = (running ? 0.55 : WALK_ARM) * gait
      profile.bob = (running ? RUN_BOB : WALK_BOB) * gait
      time = cycles / (walkCadence(Math.max(speed, 0)) * (running ? 1.3 : 1))
      animator.animate(body, time, { speed })
      fall = fallSeconds <= 0 ? (down ? 1 : 0) : clamp(fall + (down ? dt : -dt) / fallSeconds, 0, 1)
      resetLegYaw()
      const seat = down ? null : (state.seat ?? null)
      if (down) animator.setPose(rig, downPose())
      else if (seat) animator.setPose(rig, seat.pose === 'lie' ? liePose() : sitPose(seat.hip))
      else {
        if (running) animator.setPose(rig, runningPose(gait, Boolean(state.armed || state.holding || state.itemUse)))
        if (state.crouch) animator.setPose(rig, crouchPose(gait))
        if (state.push) animator.setPose(rig, pushingPose(state.push))
        else if (state.armed) animator.setPose(rig, armed(state.pitch ?? 0, gait, state.hip ?? 0))
        else if (state.holding || state.itemUse) animator.setPose(rig, holdingPose(gait, state.itemUse))
        else if (!running) {
          animator.setPose(rig, {
            armRz: REST_ARM_Z,
            armLz: -REST_ARM_Z,
            elbR: -0.12,
            elbL: -0.12,
          })
        }
      }
      if (seat?.pose === 'lie') layBody(seat.hip)
      else placeBody(fall)
      stepClip(dt, down, Boolean(state.crouch || seat))
      if (smooth) animator.cascade(rig, run && !run.clip.loop ? dt * clipCascade : dt)
      // the hands close for a punch and open for a shove, whatever the clip is called (a combo has a jab, a cross, a hook, an uppercut); a clip with no impact,
      // such as the fighting guard, closes them with a `grip` event
      const blow = run?.clip.events?.find((event) => (event.type === 'impact' || event.type === 'grip') && event.data?.kind)?.data?.kind
      const ph = cycles * TWO_PI
      hands.forEach((hand) => {
        const isRight = hand.side < 0
        const holdRight = isRight && (!!state.holding || !!state.itemUse)
        const holdLeft = !isRight && (state.itemUse?.id === 'open' || state.itemUse?.id === 'close')
        const grip =
          blow === 'punch'
            ? 1.4
            : blow === 'shove'
              ? 0.15
              : state.armed || holdRight || holdLeft
                ? 1.22
                : running
                  ? 0.85
                  : 0.12
        const wristSwing = holdRight || state.armed || running ? 0 : -Math.min(1, gait) * Math.sin(ph - 0.6) * 0.12 * hand.side
        setHandGrip(hand, grip, wristSwing)
      })
    },
    play(clip, playOptions = {}) {
      const found = typeof clip === 'string' ? clips.get(clip) : clip
      if (!found) throw new Error(`Unknown pose clip: ${String(clip)}`)
      run = { clip: found, time: 0, weight: run?.weight ?? 0, target: 1, blend: playOptions.blend ?? blendDefault, ...(playOptions.onEvent ? { onEvent: playOptions.onEvent } : {}) }
      fireClipEvents(run, -1e-9, 0) // events at t = 0 fire on the first frame
      run.time = 0
    },
    stop() {
      if (run) run.target = 0
    },
    hand: (side) => sockets[side],
    shoulder: (side) => armOf[side].g as unknown as THREE_NS.Object3D,
    reach(targets) {
      if (run || fall > 0) return
      root.updateMatrixWorld(true)
      armReach.apply(targets)
    },
    on(_type, listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    dispose() {
      run = null
      listeners.clear()
      body.traverse((object) => {
        const mesh = object as THREE_NS.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material?.dispose()
      })
      root.removeFromParent()
    },
  }
}
