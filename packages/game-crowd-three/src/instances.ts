import { INSTANCE_POSES, walkGait } from '@adatechnology/game-characters'
import type { InstancePose } from '@adatechnology/game-characters'
import { STAGGER_POSE } from '@adatechnology/game-characters-three'
import { MISSING, STATE } from '@adatechnology/game-crowd'
import type { Civilian, Corpse, CrowdStore } from '@adatechnology/game-crowd'

import defaults from './data/render.json'
import { VARIETY_DEFAULTS, isStaggering, lookOfAgent, packLook } from './variety/look'
import type { CrowdVarietyNumbers } from './variety/look'

export type CrowdRenderNumbers = typeof defaults.numbers
export type CrowdPoseMap = { readonly [K in keyof typeof defaults.poses]: InstancePose }

/** The game's numbers for the drawing (G 67098 `hordeRender`, G 70177 `npcRender`) and the instance pose of each state. */
export const CROWD_RENDER_DEFAULTS: { readonly sources: Readonly<Record<string, string>>; readonly numbers: CrowdRenderNumbers; readonly poses: CrowdPoseMap } = {
  sources: defaults.sources,
  numbers: defaults.numbers,
  poses: defaults.poses as CrowdPoseMap,
}

/**
 * One body for a batch: the 12 numbers of the shader's `iA`, `iB` and `iC` (`a`: x, z, yaw, phase; `b`: height and build over the variant's,
 * stride, pose; `c`: missing parts, age look, arms, skin), the shirt colour as hex with the shade it is multiplied by, the eye colour (none:
 * no glow) and the ground height.
 */
export type CrowdInstance = {
  readonly a: readonly [number, number, number, number]
  readonly b: readonly [number, number, number, number]
  readonly c: readonly [number, number, number, number]
  readonly color: number
  readonly shade: number
  readonly eye: number | null
  readonly y: number
  /** The identity `iD` (with `variety`): wounds, trousers, gait style, accessories, clips, lean. See `packIdentity`. */
  readonly d?: readonly [number, number, number, number]
  /** The accessory bits of the look (with `variety`), so a renderer routes the instance to the accessory batches. */
  readonly accessories?: number
  /** The crowd type index of the agent (with `variety`). */
  readonly type?: number
}

/** A baked variant as the drawing reads it: its own height and build (the instance scales the agent's against them). */
export type VariantSize = { readonly s: number; readonly bulk: number }

/** Where the frame is seen from. `target` is who the agents attack (the attack pose); `hidden` leaves an agent out (a floor the viewer is not on). */
export type CrowdFrame = {
  readonly camera: { readonly x: number; readonly z: number }
  /** The view's yaw: forward is `(-sin, -cos)`. */
  readonly viewYaw: number
  readonly target?: { readonly x: number; readonly z: number; readonly alive: boolean } | null
  readonly hidden?: (i: number) => boolean
}

/** Takes one instance for the batch of `variant` at level `level` (0 near, 1 middle, 2 far). */
export type CrowdInstanceSink = (variant: number, level: number, instance: CrowdInstance) => void
/** Takes one body on the ground that was not an agent (a civilian killed outright): the plain body batch. */
export type PlainCorpseSink = (instance: CrowdInstance) => void

const poseIndex = (pose: InstancePose): number => INSTANCE_POSES.indexOf(pose)

const lookFields = (store: CrowdStore, i: number, numbers: CrowdVarietyNumbers): Pick<CrowdInstance, 'd' | 'accessories' | 'type'> => {
  const look = lookOfAgent(store, i, numbers)
  return { d: packLook(look), accessories: look.accessories, type: store.type[i]! }
}

export type CrowdInstancesOptions = {
  readonly numbers?: Partial<CrowdRenderNumbers>
  readonly poses?: Partial<CrowdPoseMap>
  /** The eye colour of each crowd type, by type index (G `_eye`); null for a type that has none. */
  readonly eyes: readonly (number | null)[]
  /** Identity for every agent (T4b.7), default off: each instance carries `d`, `accessories` and `type`, and the stagger pose; the game's numbers do not change. */
  readonly variety?: { readonly numbers?: Partial<CrowdVarietyNumbers>; readonly impostorFrom?: number }
}

export type CrowdInstances = {
  readonly numbers: CrowdRenderNumbers
  /** Writes the agents seen this frame, keeps each one's level of detail and attack pose in the store (`lod`, `attackPose`) and returns how many went out. */
  agents(store: CrowdStore, variants: readonly VariantSize[], frame: CrowdFrame, sink: CrowdInstanceSink): number
  /** Writes the bodies on the ground: an agent's on its variant, the others on the plain batch. `life` is the seconds a body lasts (the crowd's `corpseSeconds`). */
  corpses(entries: readonly { readonly age: number; readonly data: Corpse }[], variants: readonly VariantSize[], frame: CrowdFrame, life: number, sink: CrowdInstanceSink, plain: PlainCorpseSink): void
  /** Writes the civilians that are still people (not dead, turned or gone); `colorOf` gives each one's shirt. */
  civilians(list: readonly Civilian[], colorOf: (civilian: Civilian) => number, sink: (civilian: Civilian, instance: CrowdInstance) => void): void
}

/**
 * The drawing of a crowd as instances, without three.js: a literal port of the team game's `hordeRender` (G 67098-67136) and `npcRender`
 * (G 70177-70184). The renderer of `game-crowd-three` hands each instance to a `BodyBatch` of `game-characters-three`; any other drawing can take them.
 */
export function createCrowdInstances(options: CrowdInstancesOptions): CrowdInstances {
  const N: CrowdRenderNumbers = { ...defaults.numbers, ...options.numbers }
  const P: CrowdPoseMap = { ...(defaults.poses as CrowdPoseMap), ...options.poses }
  const pose = {
    dormant: poseIndex(P.dormant),
    airborne: poseIndex(P.airborne),
    eating: poseIndex(P.eating),
    pileStep: poseIndex(P.pileStep),
    swing: poseIndex(P.swing),
    crawl: poseIndex(P.crawl),
    grab: poseIndex(P.grab),
    calling: poseIndex(P.calling),
    walk: poseIndex(P.default),
    corpse: poseIndex(P.corpse),
    civilian: poseIndex(P.civilian),
  }
  const [near, middle] = N.lodDistances as unknown as [number, number]
  const variety = options.variety ? { ...VARIETY_DEFAULTS, ...options.variety.numbers } : null
  const impostorFrom = options.variety?.impostorFrom
  const lodEdges = impostorFrom === undefined ? [near, middle] : [near, middle, impostorFrom]
  const lastLevel = lodEdges.length
  const behindFrom = N.behindFrom
  const farSquared = N.farCull * N.farCull

  return {
    numbers: N,
    agents(Z, variants, frame, sink) {
      const cx = frame.camera.x
      const cz = frame.camera.z
      const fx = -Math.sin(frame.viewYaw)
      const fz = -Math.cos(frame.viewYaw)
      const target = frame.target
      let written = 0
      for (let i = 0; i < Z.n; i++) {
        const dx = Z.x[i]! - cx
        const dz = Z.z[i]! - cz
        const d2 = dx * dx + dz * dz
        if (d2 > behindFrom && dx * fx + dz * fz < -Math.sqrt(d2) * N.behindFactor - N.behindMargin) continue // behind the view
        if (d2 > farSquared) continue
        if (frame.hidden?.(i)) continue
        // the level of detail with hysteresis: a body does not keep switching meshes on the edge
        let l = Z.lod[i]!
        const dd = Math.sqrt(d2)
        while (l > 0 && dd < lodEdges[l - 1]! - N.lodHysteresis) l--
        while (l < lastLevel && dd > lodEdges[l]! + N.lodHysteresis) l++
        Z.lod[i] = l
        const sp = Z.renderSpeed[i]!
        const gait = Math.min(N.gaitMax, walkGait(sp, Z.height[i]!))
        const st = Z.state[i]!
        // the attack pose by distance with hysteresis (in at 1.6 m, out at 2.2 m): it does not flicker between walking and striking
        if (st === STATE.CHASE && target?.alive) {
          const px = Z.x[i]! - target.x
          const pz = Z.z[i]! - target.z
          const p2 = px * px + pz * pz
          Z.attackPose[i] = p2 < (Z.attackPose[i] ? N.attackLeave : N.attackEnter) ? 1 : 0
        } else Z.attackPose[i] = 0
        const p =
          st === STATE.DORMANT
            ? pose.dormant
            : st === STATE.AIRBORNE
              ? pose.airborne
              : st === STATE.EATING
                ? pose.eating
                : st === STATE.PILE_STEP
                  ? pose.pileStep
                  : st === STATE.SWING
                    ? pose.swing
                    : Z.crawl[i]
                      ? pose.crawl
                      : st === STATE.GRAB || Z.attackPose[i]
                        ? pose.grab
                        : st === STATE.CALLING
                          ? pose.calling
                          : pose.walk
        const staggering = variety !== null && p === pose.walk && isStaggering(Z, i)
        const bb = st === STATE.SWELLING ? Z.build[i]! * (1 + (N.swellPivot - Z.stateTimer[i]!) * N.swell) : Z.build[i]!
        const eyeOn = !(Z.missing[i]! & MISSING.SKULL)
        const V = variants[Z.variant[i]!]!
        sink(Z.variant[i]!, l, {
          a: [Z.x[i]!, Z.z[i]!, Z.renderYaw[i]!, Z.phase[i]!],
          b: [Z.height[i]! / V.s, bb / V.bulk, gait, staggering ? STAGGER_POSE : p],
          c: [Z.missing[i]!, N.ageBase + Z.age[i]! * N.agePer, N.armBase + N.armPer * Z.arms[i]!, Z.skin[i]!],
          color: Z.color[i]!,
          shade: 1,
          eye: eyeOn && st !== STATE.DORMANT ? (options.eyes[Z.type[i]!] ?? null) : null,
          y: Z.y[i]!,
          ...(variety ? lookFields(Z, i, variety) : {}),
        })
        written++
      }
      return written
    },
    corpses(entries, variants, frame, life, sink, plain) {
      const cx = frame.camera.x
      const cz = frame.camera.z
      for (const { age: t, data: C } of entries) {
        const dark = Math.min(1, t / life)
        const shade = 1 - dark * N.corpseDarken
        const fade = t > life - N.corpseFade ? (life - t) / N.corpseFade : 1
        const c: CrowdInstance['c'] = [C.missing, N.corpseAgeBase + dark * N.corpseAgeDark, 1, C.skin]
        if (C.variant >= 0) {
          // an agent's body: the same mesh as its variant, lying down
          const V = variants[C.variant]!
          const dx = C.x - cx
          const dz = C.z - cz
          const l = dx * dx + dz * dz < N.corpseNear * N.corpseNear ? 0 : 1
          sink(C.variant, l, { a: [C.x, C.z, C.yaw, C.seed], b: [(C.height / V.s) * fade, C.build / V.bulk, Math.min(1, t * N.corpseRise), pose.corpse], c, color: C.color, shade, eye: null, y: 0 })
          continue
        }
        plain({ a: [C.x, C.z, C.yaw, C.seed], b: [C.height * fade, C.build, Math.min(1, t * N.corpseRise), pose.corpse], c, color: C.color, shade, eye: null, y: 0 })
      }
    },
    civilians(list, colorOf, sink) {
      for (const n of list) {
        if (n.state === 'undead' || n.state === 'gone' || n.state === 'dead') continue
        const sp = Math.hypot(n.vx, n.vz)
        const child = !!n.spec.child
        sink(n, {
          a: [n.x, n.z, n.yaw, n.phase],
          b: [child ? N.childHeight : 1, child ? N.childBuild : 1, Math.min(N.gaitMax, walkGait(sp, child ? N.childHeight : 1)), pose.civilian],
          c: [0, n.biteTimer > 0 ? N.bittenLook : 0, 0, n.k * N.civilianSkinStep],
          color: colorOf(n),
          shade: 1,
          eye: null,
          y: 0,
        })
      }
    },
  }
}
