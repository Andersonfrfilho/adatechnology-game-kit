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
  /** A unit quaternion (x y z w) that turns the standing body about its feet, for a body the engine laid down: `a` and `y` are then where its feet go, and its yaw is not used. */
  readonly rotation?: readonly [number, number, number, number]
}

/** Where the engine has the bodies on the ground (`CrowdFrame.lying`): the instance of a corpse it holds follows the body instead of lying by its pose. */
export type LyingBodies = {
  /** Writes the torso of the corpse `id` (x y z, then the quaternion) at the start of `out`; false for a corpse the engine does not hold. */
  readonly torso: (id: number, out: Float64Array) => boolean
  /** Where that torso is in the standing body of `corpse`: metres from its feet, along the body's own axes. */
  readonly anchor: (corpse: Corpse) => readonly [number, number, number]
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
  /** How much of the level budget to use this frame, 0..1 (default 1); the renderer lowers it when the frames run long. */
  readonly detailScale?: number
  /** The bodies on the ground the engine holds: each one is drawn where its torso is, turned as it is (the channel of the instance's `rotation`). */
  readonly lying?: LyingBodies
}

/** Takes one instance for the batch of `variant` at level `level` (0 near, 1 middle, 2 far). */
export type CrowdInstanceSink = (variant: number, level: number, instance: CrowdInstance) => void
/** Takes one body on the ground that was not an agent (a civilian killed outright): the plain body batch. */
export type PlainCorpseSink = (instance: CrowdInstance) => void

/** The level of detail after the three meshes: the impostor (with `variety.impostorFrom`). */
export const IMPOSTOR_LEVEL = 3

/** The width of a distance bin when a level budget fits the edges, and the most an edge moves in a frame (in, out). */
const BUDGET_BIN = 0.25
/** The distance bins the bodies are ordered by (half a metre each), the last one holding everything past them; the culled bodies (distance -1) go first and are skipped. */
const SORT_BINS = 130
const sortBin = (distance: number): number => (distance < 0 ? 0 : Math.min(SORT_BINS - 1, 1 + Math.floor(distance * 2)))
/** The distance out to which the bodies on the ground are counted when a budget fits their levels. */
const CORPSE_REACH = 60
const EDGE_SHRINK = 0.3
const EDGE_GROW = 0.15

const poseIndex = (pose: InstancePose): number => INSTANCE_POSES.indexOf(pose)

const TORSO_POSE = new Float64Array(7)

/** Where the feet of a standing body go so that its torso, `anchor` metres up from them, lies at `TORSO_POSE` turned as it is: the torso's place less the turned anchor. */
const feetOfTorso = (anchor: readonly [number, number, number]): { readonly position: readonly [number, number, number]; readonly rotation: readonly [number, number, number, number] } => {
  const [x, y, z, w] = [TORSO_POSE[3]!, TORSO_POSE[4]!, TORSO_POSE[5]!, TORSO_POSE[6]!]
  const tx = 2 * (y * anchor[2] - z * anchor[1])
  const ty = 2 * (z * anchor[0] - x * anchor[2])
  const tz = 2 * (x * anchor[1] - y * anchor[0])
  const turned = [anchor[0] + w * tx + y * tz - z * ty, anchor[1] + w * ty + z * tx - x * tz, anchor[2] + w * tz + x * ty - y * tx] as const
  return { position: [TORSO_POSE[0]! - turned[0], TORSO_POSE[1]! - turned[1], TORSO_POSE[2]! - turned[2]], rotation: [x, y, z, w] }
}

/** The clip family of a gait style (the order of `SEGMENT_CLIPS`: walk, limp left, limp right, drag, lurch, shamble) and the stagger after them. */
const STAGGER_FAMILY = 6

/** The clips of an agent: its family's arms-down and arms-up clips, blended by how far it has raised its arms. */
const clipsOf = (store: CrowdStore, i: number, staggering: boolean): { readonly clips: true; readonly clipA: number; readonly clipB: number; readonly clipBlend: number } => {
  const family = staggering ? STAGGER_FAMILY : Math.min(store.gaitStyle[i]!, STAGGER_FAMILY - 1)
  return { clips: true, clipA: family * 2, clipB: family * 2 + 1, clipBlend: Math.min(1, Math.max(0, store.arms[i]!)) }
}

const lookFields = (store: CrowdStore, i: number, numbers: CrowdVarietyNumbers, clips: boolean, staggering: boolean): Pick<CrowdInstance, 'd' | 'accessories' | 'type'> => {
  const look = lookOfAgent(store, i, numbers, clips ? clipsOf(store, i, staggering) : {})
  return { d: packLook(look), accessories: look.accessories, type: store.type[i]! }
}

export type CrowdInstancesOptions = {
  readonly numbers?: Partial<CrowdRenderNumbers>
  readonly poses?: Partial<CrowdPoseMap>
  /** The eye colour of each crowd type, by type index (G `_eye`); null for a type that has none. */
  readonly eyes: readonly (number | null)[]
  /** Identity for every agent (T4b.7), default off: each instance carries `d`, `accessories` and `type`, and the stagger pose; the game's numbers do not change. */
  readonly variety?: { readonly numbers?: Partial<CrowdVarietyNumbers>; readonly impostorFrom?: number; readonly segmentClips?: boolean; readonly budget?: readonly number[] }
}

export type CrowdInstances = {
  readonly numbers: CrowdRenderNumbers
  /** Writes the agents seen this frame, keeps each one's level of detail and attack pose in the store (`lod`, `attackPose`) and returns how many went out. */
  agents(store: CrowdStore, variants: readonly VariantSize[], frame: CrowdFrame, sink: CrowdInstanceSink): number
  /** Writes the bodies on the ground: an agent's on its variant, the others on the plain batch. `life` is the seconds a body lasts (the crowd's `corpseSeconds`). */
  corpses(entries: readonly { readonly id?: number; readonly age: number; readonly data: Corpse }[], variants: readonly VariantSize[], frame: CrowdFrame, life: number, sink: CrowdInstanceSink, plain: PlainCorpseSink): void
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
  const segmentClips = options.variety?.segmentClips === true
  const lodEdges = impostorFrom === undefined ? [near, middle] : [near, middle, impostorFrom]
  const lastLevel = lodEdges.length
  const budget = options.variety?.budget
  // the edges a crowd packed near the camera is drawn with: the nominal ones pulled in until each level holds the bodies its budget allows
  const edges = [...lodEdges]
  const bands = lodEdges.map(() => N.lodHysteresis)
  const histogram = new Uint32Array(budget ? Math.max(1, Math.ceil(lodEdges[lastLevel - 1]! / BUDGET_BIN) + 1) : 0)
  let distances = new Float32Array(0)
  let order = new Uint32Array(0)
  const sortStarts = new Uint32Array(SORT_BINS + 1)
  const behindFrom = N.behindFrom
  const farSquared = N.farCull * N.farCull

  /** Pulls each edge in to the distance inside which the levels up to it hold their budget (scaled), and lets it move a few centimetres a frame so a body does not flip levels at once. */
  const fitEdges = (scale: number): void => {
    let allowed = 0
    let seen = 0
    let bin = 0
    let previous = 0
    for (let level = 0; level < lastLevel; level++) {
      allowed += Math.round((budget![level] ?? Infinity) * scale)
      while (bin < histogram.length && seen + histogram[bin]! <= allowed) seen += histogram[bin++]!
      const reach = bin < histogram.length ? bin * BUDGET_BIN : lodEdges[level]!
      const target = Math.max(previous, Math.min(lodEdges[level]!, reach))
      edges[level] = Math.min(edges[level]! + EDGE_GROW, Math.max(edges[level]! - EDGE_SHRINK, target))
      // an edge pulled in close keeps a proportional band, or the bodies inside the nominal band would never leave the level
      bands[level] = N.lodHysteresis * Math.min(1, edges[level]! / lodEdges[level]!)
      previous = target
    }
  }

  /** Orders the agents by distance into `order` (a counting sort), so a batch draws its nearest bodies first and the depth test throws the hidden fragments away before they are shaded. */
  const nearestFirst = (count: number): void => {
    sortStarts.fill(0)
    for (let i = 0; i < count; i++) sortStarts[sortBin(distances[i]!) + 1]!++
    for (let b = 0; b < SORT_BINS; b++) sortStarts[b + 1]! += sortStarts[b]!
    for (let i = 0; i < count; i++) order[sortStarts[sortBin(distances[i]!)]!++] = i
  }
  const corpseHistogram = new Uint32Array(budget ? Math.ceil(CORPSE_REACH / BUDGET_BIN) + 1 : 0)
  /** The two distances that split the bodies on the ground into the near mesh, the middle one and the far one: the nominal edge and none, pulled in until each level holds no more than its share of the budget (the fourth and fifth numbers, default half the near and the middle). */
  const fitCorpseEdges = (entries: readonly { readonly data: Corpse }[], cx: number, cz: number, scale: number): readonly [number, number] => {
    if (!budget) return [N.corpseNear, Infinity]
    corpseHistogram.fill(0)
    for (const { data } of entries) {
      const distance = Math.hypot(data.x - cx, data.z - cz)
      if (distance < CORPSE_REACH) corpseHistogram[Math.floor(distance / BUDGET_BIN)]!++
    }
    let seen = 0
    let bin = 0
    const edgeFor = (allowed: number, nominal: number): number => {
      while (bin < corpseHistogram.length && seen + corpseHistogram[bin]! <= allowed) seen += corpseHistogram[bin++]!
      return bin < corpseHistogram.length ? Math.min(nominal, bin * BUDGET_BIN) : nominal
    }
    const near = edgeFor(Math.round((budget[3] ?? (budget[0] ?? Infinity) / 2) * scale), N.corpseNear)
    const middle = edgeFor(Math.round(((budget[3] ?? (budget[0] ?? Infinity) / 2) + (budget[4] ?? (budget[1] ?? Infinity) / 2)) * scale), Infinity)
    return [near, Math.max(near, middle)]
  }

  return {
    numbers: N,
    agents(Z, variants, frame, sink) {
      const cx = frame.camera.x
      const cz = frame.camera.z
      const fx = -Math.sin(frame.viewYaw)
      const fz = -Math.cos(frame.viewYaw)
      const target = frame.target
      let written = 0
      if (distances.length < Z.n) distances = new Float32Array(Math.max(Z.n, distances.length * 2))
      if (budget) histogram.fill(0)
      for (let i = 0; i < Z.n; i++) {
        const dx = Z.x[i]! - cx
        const dz = Z.z[i]! - cz
        const d2 = dx * dx + dz * dz
        distances[i] = -1
        if (d2 > behindFrom && dx * fx + dz * fz < -Math.sqrt(d2) * N.behindFactor - N.behindMargin) continue // behind the view
        if (d2 > farSquared) continue
        if (frame.hidden?.(i)) continue
        const seen = Math.sqrt(d2)
        distances[i] = seen
        if (budget && seen < lodEdges[lastLevel - 1]!) histogram[Math.floor(seen / BUDGET_BIN)]!++
      }
      if (budget) fitEdges(frame.detailScale ?? 1)
      if (budget) {
        if (order.length < Z.n) order = new Uint32Array(distances.length)
        nearestFirst(Z.n)
      }
      for (let k = 0; k < Z.n; k++) {
        const i = budget ? order[k]! : k
        const dd = distances[i]!
        if (dd < 0) continue
        // the level of detail with hysteresis: a body does not keep switching meshes on the edge
        let l = Z.lod[i]!
        while (l > 0 && dd < edges[l - 1]! - bands[l - 1]!) l--
        while (l < lastLevel && dd > edges[l]! + bands[l]!) l++
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
        // the impostor only draws a body that walks (the atlas holds the walk); any other pose stays on the far mesh
        const level = l === IMPOSTOR_LEVEL && p !== pose.walk ? IMPOSTOR_LEVEL - 1 : l
        sink(Z.variant[i]!, level, {
          a: [Z.x[i]!, Z.z[i]!, Z.renderYaw[i]!, Z.phase[i]!],
          b: [Z.height[i]! / V.s, bb / V.bulk, gait, staggering ? STAGGER_POSE : p],
          c: [Z.missing[i]!, N.ageBase + Z.age[i]! * N.agePer, N.armBase + N.armPer * Z.arms[i]!, Z.skin[i]!],
          color: Z.color[i]!,
          shade: 1,
          eye: eyeOn && st !== STATE.DORMANT ? (options.eyes[Z.type[i]!] ?? null) : null,
          y: Z.y[i]!,
          ...(variety ? lookFields(Z, i, variety, segmentClips, staggering) : {}),
        })
        written++
      }
      return written
    },
    corpses(entries, variants, frame, life, sink, plain) {
      const cx = frame.camera.x
      const cz = frame.camera.z
      const [nearEdge, middleEdge] = fitCorpseEdges(entries, cx, cz, frame.detailScale ?? 1)
      for (const { id, age: t, data: C } of entries) {
        const dark = Math.min(1, t / life)
        const shade = 1 - dark * N.corpseDarken
        const fade = t > life - N.corpseFade ? (life - t) / N.corpseFade : 1
        const c: CrowdInstance['c'] = [C.missing, N.corpseAgeBase + dark * N.corpseAgeDark, 1, C.skin]
        if (id !== undefined && frame.lying?.torso(id, TORSO_POSE)) {
          // the engine holds this body: the standing body, turned about its torso as the engine has it, with the feet where that puts them
          const feet = feetOfTorso(frame.lying.anchor(C))
          const V = C.variant >= 0 ? variants[C.variant]! : { s: 1, bulk: 1 }
          const distance = Math.hypot(C.x - cx, C.z - cz)
          const instance: CrowdInstance = { a: [feet.position[0], feet.position[2], 0, C.seed], b: [(C.height / V.s) * fade, C.build / V.bulk, 0, pose.walk], c, color: C.color, shade, eye: null, y: feet.position[1], rotation: feet.rotation }
          if (C.variant < 0) plain(instance)
          else sink(C.variant, distance < nearEdge ? 0 : distance < middleEdge ? 1 : 2, instance)
          continue
        }
        if (C.variant >= 0) {
          // an agent's body: the same mesh as its variant, lying down
          const V = variants[C.variant]!
          const dx = C.x - cx
          const dz = C.z - cz
          const distance = Math.hypot(dx, dz)
          const l = distance < nearEdge ? 0 : distance < middleEdge ? 1 : 2
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
