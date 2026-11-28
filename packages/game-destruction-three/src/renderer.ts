import type * as THREE_NS from 'three'
import type { Crack, DamageType, DebrisKind, DestructionEvent, Fragment, MaterialDef, ObjectState, PartSettlement, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { breakSoundKeys, impactSoundKeys, ricochetSoundKeys } from './audio/impact-keys'
import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID, blastShove, drainDetached, warnOnce } from '@adatechnology/game-contracts'
import { createVfx, effectForEvent, EVENT_EFFECTS_MAP } from '@adatechnology/game-vfx'
import type { GameEvent } from '@adatechnology/game-vfx'
import type { VfxWorld } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import { WorkBudget, WorkQueue } from '@adatechnology/game-physics'
import { BlastWakes, PhysicsCostMeter, chooseForPhysics, physicsPieceCount, resolveBlastDebris, resolveWorkUnitCosts, splitWorkUnits } from './blast-debris'
import type { BlastWake, DebrisCostSample, ResolvedBlastDebris, WorkUnitCosts } from './blast-debris'
import { EventOrder, isStructuralEvent } from './event-class'
import { eventApplyWeight } from './event-weight'
import { FragmentSystem } from './fragments'
import { GroundSpots } from './ground'
import type { Bound, HostVis, MeshVis, PartBox, PartVis, PieceBody, PieceRound } from './internal'
import { isTurned } from './internal'
import { drawnSolidsOf } from './drawn-solids'
import { builtSolidsOf, isRoundSolid } from './built-solids'
import type { BuiltSolid } from './built-solids'
import { OWN_MESH, RANGED, hollowBoxesOf } from './drawn-boxes'
import { isRigidPose } from './rigid-pose'
import type { MeasureBudget } from './drawn-solids'
import { fitOrientedBoxes } from '@adatechnology/game-shapes'
import { clamp, createRng, hashNumbers, hashString } from './math'
import type { StaticSolid } from './engine-pieces'
import type { HostSolid } from '@adatechnology/game-contracts'
import { sameSolids } from './engine-statics'
import { MIN_PIECE_HALF, PieceSystem } from './pieces'
import type { PieceSweepHit } from './pieces'
import { RebarCages } from './rebar'
import { partHintOf, specFrameInverse } from './spec'
import { surfaceOf } from './friction'
import { kitOriginOf, markKitOrigin } from '@adatechnology/game-contracts'
import { debrisColor, debrisLook, fragmentTone } from '@adatechnology/game-destruction'
import { familyPlay, HitPoints } from './debris-events'
import type { FamilyPlay } from './debris-events'
import type { DeferredQueue, WarmUpProbes } from '@adatechnology/game-contracts'
import { warmUpDestructionJit } from './jit-warmup'
import type { DeferredQueueRegistration, DestructionRenderer, BindOptions, MakePieceOptions, ExplodeOptions, Mesh, MeshRange, Object3D, Piece, RendererOptions, SolidBox, SoundDetail, ThreeNamespace } from './types'
import { showCollapsedRanges, Visuals } from './visual'
import { SettlementView } from './settlement'
import { SettledBatches } from './settled-batches'
import type { SettledBatchStats } from './settled-batches'
import { anchorOnMesh, anchorWorld } from './emitter-anchor'
import { stampSource } from './vfx-source'
import type { EmitterAnchor } from './emitter-anchor'

let rendererCount = 0
/** Most loose pieces and fragments simulated at once a game loop can start from (`RendererOptions.maxAwakePieces`, `maxAwakeFragments`; the default is no limit). */
export const SUGGESTED_MAX_AWAKE_PIECES = 24
export const SUGGESTED_MAX_AWAKE_FRAGMENTS = 64
/** Mass (kg) a collapse of furniture must bring down to raise the collapse effect's cloud; less (a shelf with its books) raises a puff of dust. */
const COLLAPSE_CLOUD_KG = 1000
/** Colour of bare rebar (the cages' material) and of a bar that came down; the steel of a bar weighs this much per cubic metre when the catalogue has no steel. */
const REBAR_COLOR = 0x74665c
const STEEL_DENSITY = 7850
/** Metres around a unit that came out within which its decals go too: the plaster over it and the ragged edge that breaks with it. */
const CHIP_DECAL_EDGE = 0.05
/** How far inside the drawn face a unit's face may sit and still be on it (the drawing is round, the unit a box): its gap is drawn there (`drawChipGap`). */
const CHIP_GAP_REACH = 0.03
/** The broken inside of a gap is darker than the material's inner colour: it is in its own shadow. */
const CHIP_GAP_SHADE = 0.4
/** The gap's patch reaches a little past the unit's narrower side: its broken edge is ragged. */
const CHIP_GAP_WIDTH = 1.15
/** Radius of the rim of torn fibres around a hole in wood, in hole diameters. */
/**
 * A round on concrete, stone or brick knocks a cone out of the face around its hole (front-face cratering): about five calibres across (a 7.62 leaves a crater of
 * 3 to 4 cm, a pistol round 2 to 3 cm), fresh broken material a shade lighter than the weathered face. Radius per hole diameter, its least (m) and the lightening.
 */
const CRATER_RADIUS = 2.5
const CRATER_MIN_RADIUS = 0.012
const CRATER_LIGHTEN = 0.12
const WOOD_RIM = 1.5

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>

const GLOW_FROM_C = 430
/** A settlement crack is drawn at least this wide (m), so that a hairline still shows a few metres away; and in the colour of the open joint. */
const MIN_DRAWN_CRACK_WIDTH = 0.004
const SETTLEMENT_CRACK_COLOR = 0x2b2420
const QUEUE_CAP = 4000
/** Seconds the grit of a broken hard face keeps falling (least, most), how often a pinch of it at first, and how many places at once. */
const TRICKLE_SECONDS: readonly [number, number] = [2, 5]
const TRICKLE_EVERY = 0.25
const TRICKLE_MAX = 24
/** Frames in a row with a structural event waiting and no tick to apply it in, after which a frame drain applies everything (a paused or skipped simulation). */
const STALLED_FRAMES = 8
/** Fragments of a fracture spawned in one go before the frame budget is looked at, so a small break is never split over frames. */
const MIN_FRAGMENTS_PER_SLICE = 8

/** A loose group waiting its turn to become a piece (`RendererOptions.workBudget`): data only, so it can be saved. */
interface PendingSplit {
  readonly objectId: string
  /** Every part of the group when it came loose, sorted: at its turn the group is the loose one holding any of them still (a part may be shattered meanwhile). */
  readonly parts: readonly string[]
  readonly torn: ReadonlyArray<readonly [string, string]>
}

/** Fragments of a fracture still to spawn from `from` (`RendererOptions.workBudget`): data, not a closure. */
interface FragmentSlice {
  readonly ev: Ev<'fracture'>
  readonly from: number
  readonly look: { def: MaterialDef | undefined; color: number; opacity: number; transparent: boolean }
}
/** Seconds the boxes of the fixed objects the pieces land on are kept without an event (a host may move a root). */
const STATIC_REFRESH = 0.5
/**
 * Objects the periodic re-measure takes per call: the refresh walks the objects a slice at a time (the dirty ones are measured at once). A count, not a clock: the boxes feed
 * the physics (`staticSolids`, `staticTopAt`), so what is measured when cannot depend on the machine. Measuring every object in one call cost up to 88 ms in a frame of the
 * horde chain (perf.mjs, software GL, 2026-11-03); a round of 8 a call covers 240 objects in the 0.5 s of `STATIC_REFRESH`.
 */
const STATIC_REFRESH_PER_UPDATE = 8
/** Widest mesh (m, along x or z) a piece lands on by its box: furniture and things; a wider one (a roof, a merged room) would hold it on air. */
/** Rays down `surfaceAt` casts at most, the distance under which a hit is the part it starts inside, and how far below such a hit it looks again (m). */
const SURFACE_RAYS = 4
const SURFACE_INSIDE = 0.005
const SURFACE_STEP = 0.15
const STATIC_SPAN = 3
/** Vertices of fixed parts measured from scratch per update for an engine (about 2 ms): a house of hundreds of parts is filled in over a few updates, not one frame. */
const VERTICES_PER_UPDATE = 3000
/** What counts as a foot of a piece (m above its lowest point); from what height (m) it can fall over and how close its feet are for that (share of the height). */
const FEET_BAND = 0.03
/**
 * How far the centre of what is left of a piece of furniture must be inside the polygon of its feet to stand (`loosenIfFootless`), per metre of its height: it would have to
 * lean past atan(0.1), 6°, to go over. Less, it is balanced on an edge (a table on three legs, its centre a few centimetres inside the line between two of them) and goes over.
 */
const STAND_LEAN = 0.1
/** The spin (rad/s) a piece of furniture balanced on an edge of its feet is started over it with. */
const EDGE_NUDGE = 1
const TIP_MIN_HEIGHT = 0.3
const TIP_NARROW = 0.3
/**
 * What is left of a piece of furniture after something came off it stands, though tall over narrow feet (a bookcase 2 m high on sides 35 cm deep), when its feet are at
 * least this wide (m) and the centre of its drawn box is over their middle, off it by less than `TIP_CENTRED` of their width: a book taken off a shelf does not tip the case.
 */
const TIP_STANDING_FEET = 0.1
const TIP_CENTRED = 0.15
/** What a loose group hangs on (`hingeOf`) stands still when its piece is slower than this (m/s) and turns slower than this (rad/s). */
const HINGE_STILL_SPEED = 0.2
const HINGE_STILL_SPIN = 0.5
/** Milliseconds the boxes fitted ahead of the blow take per events drain when no budget runs the `destruction.prefit` queue (`fitBoxesAhead`): a house is a few hundred parts, fitted over a few seconds. */
const PREFIT_SLICE_MS = 1

/** Most meshes a loose piece of furniture touches the ground by, each by its own corners (`setContacts`); one with more stands on its box. */
const CONTACT_MESHES = 12
/** Most meshes of a loose piece other pieces land on one by one (`partBoxes`: a shelf's boards, not the box around the shelf; the shelf unit of the catalogue has 65); one with more is landed on by its box. */
const PART_BOX_MESHES = 96
/** Points of the drawing looked at to tell a round piece (per mesh), how alike its two other sides must be (share of the larger) and how far past their circle a point may be. */
const ROUND_SAMPLES = 400
const ROUND_SIDES = 0.12
const ROUND_SLACK = 1.12
/**
 * A piece is round (a cylinder or a ball in the engine) only when what is drawn fills at least this share of that round shape: a can, a bottle, a log do; a stool on four
 * legs, a round table on one foot, a pot's rim do not, and as one cylinder the air under the seat or inside the rim would be solid (CLAUDE.md §12, spec 019).
 */
const ROUND_FILL = 0.9
/** Points looked at each way across the round shape to measure how much of it is drawn (`ROUND_FILL`): a grid of this many cells per side. */
const FILL_GRID = 8

/** The radius the engine's round body has at `at` along its axis: the outer edge of the profile's convex hull (the engine holds a tapered piece by that hull). */
const hullRadiusAt = (profile: ReadonlyArray<readonly [number, number]> | undefined, radius: number, at: number): number => {
  if (!profile || profile.length < 2) return radius
  // upper hull of (at, r): a ring under the line between its neighbours is inside the hull
  const hull: Array<readonly [number, number]> = []
  for (const point of profile) {
    while (hull.length >= 2) {
      const [a, ra] = hull[hull.length - 2]!
      const [b, rb] = hull[hull.length - 1]!
      if ((b - a) * (point[1] - ra) - (rb - ra) * (point[0] - a) >= 0) hull.pop()
      else break
    }
    hull.push(point)
  }
  if (at <= hull[0]![0]) return hull[0]![1]
  for (let i = 1; i < hull.length; i++) {
    const [a, ra] = hull[i - 1]!
    const [b, rb] = hull[i]!
    if (at <= b) return ra + ((rb - ra) * (at - a)) / (b - a || 1)
  }
  return hull[hull.length - 1]![1]
}

type PrimitiveGeometry = THREE_NS.BufferGeometry & { readonly type?: string; readonly parameters?: Record<string, unknown> }

/** Whether a point of a mesh's own space is inside what the mesh draws: its solids (`userData.solids`), else the primitive three made it as, else its geometry's box. */
const insideDrawn = (mesh: THREE_NS.Mesh, built: readonly BuiltSolid[] | null, x: number, y: number, z: number): boolean => {
  if (built) {
    for (const solid of built) {
      // into the solid's frame: q^-1 * (p - c) * q
      const [qx, qy, qz, qw] = solid.rotation
      const px = x - solid.center[0], py = y - solid.center[1], pz = z - solid.center[2]
      const tx = 2 * (-qy * pz + qz * py), ty = 2 * (-qz * px + qx * pz), tz = 2 * (-qx * py + qy * px)
      const lx = px + qw * tx - qy * tz + qz * ty, ly = py + qw * ty - qz * tx + qx * tz, lz = pz + qw * tz - qx * ty + qy * tx
      const [hx, hy, hz] = solid.half
      if (solid.kind === 'cylinder' || solid.kind === 'cone') {
        if (Math.abs(ly) <= hy && (lx / hx) ** 2 + (lz / hz) ** 2 <= 1) return true
      } else if (solid.kind === 'sphere') {
        if ((lx / hx) ** 2 + (ly / hy) ** 2 + (lz / hz) ** 2 <= 1) return true
      } else if (Math.abs(lx) <= hx && Math.abs(ly) <= hy && Math.abs(lz) <= hz) return true
    }
    return false
  }
  const geometry = mesh.geometry as PrimitiveGeometry
  const p = geometry.parameters ?? {}
  const n = (key: string, fallback: number): number => (typeof p[key] === 'number' ? (p[key] as number) : fallback)
  switch (geometry.type) {
    case 'BoxGeometry':
      return Math.abs(x) <= n('width', 1) / 2 && Math.abs(y) <= n('height', 1) / 2 && Math.abs(z) <= n('depth', 1) / 2
    case 'CylinderGeometry':
    case 'ConeGeometry': {
      const h = n('height', 1) / 2
      if (Math.abs(y) > h || p.openEnded === true) return false
      const top = geometry.type === 'ConeGeometry' ? 0 : n('radiusTop', 1)
      const bottom = geometry.type === 'ConeGeometry' ? n('radius', 1) : n('radiusBottom', 1)
      return Math.hypot(x, z) <= bottom + ((top - bottom) * (y + h)) / (2 * h || 1)
    }
    case 'SphereGeometry':
      return Math.hypot(x, y, z) <= n('radius', 1)
    default: {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const box = geometry.boundingBox
      return !!box && x >= box.min.x && x <= box.max.x && y >= box.min.y && y <= box.max.y && z >= box.min.z && z <= box.max.z
    }
  }
}

/** Points around each rim of a round piece (and around a ball's three great circles). */
const RIM_POINTS = 12

/** The contacts of a round piece: two rims of `RIM_POINTS` at its ends (a cylinder), or three great circles (a ball), in its frame from the centre. */
const rimPoints = (round: PieceRound, half: Vec3): Vec3[] => {
  const out: Vec3[] = []
  const circle = (axis: 0 | 1 | 2, at: number, radius: number): void => {
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
    for (let k = 0; k < RIM_POINTS; k++) {
      const a = (k / RIM_POINTS) * Math.PI * 2
      const p: Vec3 = [0, 0, 0]
      p[axis] = at
      p[i] = Math.cos(a) * radius
      p[j] = Math.sin(a) * radius
      out.push(p)
    }
  }
  if (round.kind === 'sphere') for (const axis of [0, 1, 2] as const) circle(axis, 0, round.radius)
  else {
    // each end by its own rim: a bottle stands on its base, and on its cap only as narrow as the cap is
    const ends = round.profile ?? []
    circle(round.axis, -half[round.axis], ends[0]?.[1] ?? round.radius)
    circle(round.axis, half[round.axis], ends[ends.length - 1]?.[1] ?? round.radius)
  }
  return out
}
/** Rings the profile of a round piece is measured in along its axis (`PieceRound.profile`): enough to tell a bottle's shoulder and neck from its body. */
const PROFILE_RINGS = 8
/** k of I = k m r^2 about the axis: a thin cylindrical shell, a solid cylinder, a thin spherical shell and a solid ball. */
const SHELL_CYLINDER = 1
const SOLID_CYLINDER = 0.5
const SHELL_SPHERE = 2 / 3
const SOLID_SPHERE = 0.4
/** Kg per litre of the liquid inside a round piece when its walls are weighed by what is left (water, soda, juice: about 1). */
const LIQUID_KG_PER_L = 1
/** How much of a solid cylinder's moment the liquid in a rolling can adds: a liquid is dragged round by the walls but does not turn as one with them (0 a liquid that never spins, 1 frozen). */
const LIQUID_SPIN_COUPLING = 0.5
/** The lightest a piece weighs in the physics (kg): below it the solver's mass ratios against a floor or a foot go wild. An empty can is 50 g, so it keeps its own mass. */
export const MIN_PIECE_MASS_KG = 0.02

/**
 * The radius of a round piece along its axis, from the points of its drawing (its frame, from the centre of mass): the widest point of each of `PROFILE_RINGS` rings, the end rings
 * at the ends. Its lower hull (what a flat floor can touch it by) is kept: a ring under the line between its neighbours never touches (the neck of a bottle whose cap is as wide).
 */
const profileOf = (points: readonly Vec3[], axis: 0 | 1 | 2, half: number, radius: number): Array<readonly [number, number]> => {
  const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
  const widest = new Array<number>(PROFILE_RINGS).fill(0)
  for (const p of points) {
    const ring = Math.min(PROFILE_RINGS - 1, Math.max(0, Math.floor(((p[axis] + half) / (2 * half)) * PROFILE_RINGS)))
    widest[ring] = Math.max(widest[ring], Math.hypot(p[i], p[j]))
  }
  const rings: Array<readonly [number, number]> = []
  for (let k = 0; k < PROFILE_RINGS; k++) {
    if (widest[k] <= 0) continue
    const at = k === 0 ? -half : k === PROFILE_RINGS - 1 ? half : -half + ((k + 0.5) / PROFILE_RINGS) * 2 * half
    rings.push([at, Math.min(radius, widest[k])])
  }
  // the outer hull of (at, radius): a ring inside the line from the one before it to the one after it is not touched
  const hull: Array<readonly [number, number]> = []
  for (const ring of rings) {
    while (hull.length >= 2) {
      const [a0, r0] = hull[hull.length - 2]
      const [a1, r1] = hull[hull.length - 1]
      // the middle one is under the line from the first to this ring: it never reaches the floor
      if ((r1 - r0) * (ring[0] - a0) <= (ring[1] - r0) * (a1 - a0)) hull.pop()
      else break
    }
    hull.push(ring)
  }
  return hull
}

/** How far (m) over its support what is left of a broken object may be and still stand; where under its lowest boxes the support is looked for (shares of the box). */
const BROKEN_GAP = 0.03
const BROKEN_SAMPLES: ReadonlyArray<readonly [number, number]> = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]
/**
 * Discs of changed ground kept for `checkUndermined` between two updates (a burst of fire digs one per round); how far past a disc (m) the floor the feet stood on is read,
 * and how far below or above the feet it may be there and still be that floor (the rim of a crater is heaped, the edge of a dug hole slumps).
 */
const UNDERMINED_MAX = 64
const UNDERMINED_RIM = 0.04
const UNDERMINED_RIM_DROP = 0.05
const UNDERMINED_RIM_RISE = 0.1
/**
 * How far the centre must be inside the feet that still hold, per metre of its height, for what lost the floor under a foot (or a leg) to stay up. A bed or a table on four
 * legs that loses one is left with its centre near the line between the two beside the gap (a headboard pulls it 10 cm in): the frame is wood, not a rigid box, and that
 * corner sags down to the floor. A cabinet on a full base that loses a patch of floor keeps its centre well inside the rest and stands.
 */
const UNDERMINED_STAND = 0.4
/** Share of the hold of its whole feet (how far inside them its centre was) that keeps it up whatever its height: a wardrobe with a corner of its base over a hole. */
const UNDERMINED_KEEP = 0.6
/** Solids of one merged mesh `solidBoxesOf` takes apart, at most; past it the mesh keeps its one box. Positions closer than this (m) are one corner. */
const SOLIDS_MAX = 64
/** Speed (m/s) the corner over the gap is started down with: what is balanced on the line between two feet goes the way its corner went, not stays (`checkUndermined`). */
const UNDERMINED_PUSH = 0.6
/** Slower than this (m/s) a piece lies still for `checkUndermined`. */
const UNDERMINED_STILL = 0.05
const SOLID_WELD = 1e-4
/** Kinds of object that answer to a load path of their own (a house, a wall, the ground), not to `checkBroken`. */
const UNCHECKED_KINDS: ReadonlySet<string> = new Set(['structure', 'room', 'ground'])
/** A part's fire lasts until the part stops burning (`stopFire`); this is only the ceiling the effects world needs. */
const FIRE_CEILING_SECONDS = 3600
/** The `generic` explosion is the M67's (15 m injury radius): a blast with no effect id of its own scales with its radius. */
const GENERIC_REFERENCE_RADIUS = 15
/** Largest half size (m) of the core of a piece swept for what it runs into: a sofa sweeps a small box at its centre, not the whole of it. */
const SWEEP_CORE = 0.15
/** The small flame of a part that a bullet or fire primed: it burns until the part goes off. */
const PRIMED_FIRE_RADIUS = 0.2

/** The joints that tear and still hold two parts that are in different groups of the object: the pairs of parts that are about to go apart. */
function tornPairsOf(state: ObjectState): Array<readonly [string, string]> {
  const groupOf = new Map<string, number>()
  state.groups.forEach((group, index) => group.forEach((part) => groupOf.set(part, index)))
  return state.joints.filter((joint) => joint.tears === true && !joint.open && groupOf.get(joint.a) !== groupOf.get(joint.b)).map((joint) => [joint.a, joint.b] as const)
}

interface FireEmitter {
  object: string
  part: string
  point: Vec3
  /** The burning part's position, moved every frame; the effects world's fire follows it. */
  follow: { x: number; y: number; z: number }
  /** Handle of the fire in the effects world, once the part's box is known. */
  handle?: number
}

interface Leak {
  object: string
  part: string
  fluid: string
  point: Vec3
  direction: Vec3
  rate: number
  pressurized: boolean
  acc: number
  /** The part had a through opening when the leak began: the leak ends when it has none (a valve shut with `seal`). */
  opened: boolean
  localPoint?: Vec3
  localDirection?: Vec3
  lastLiters?: number
  idleSeconds?: number
  life?: number
}

const FLUID_COLORS: Record<string, number> = {
  water: 0x8cc8ff,
  fuel: 0xd9a032,
  oil: 0x2a2018,
  gas: 0xf2f2f2,
  sap: 0xb89b3a,
  acid: 0x9bd23c,
  blood: 0x8a0a0a,
  soda: 0x3a1e12,
  coffee: 0x3b2414,
  beer: 0xd9953c,
  milk: 0xf4f1ea,
  wine: 0x6b101f,
  juice: 0xe8870b,
}
const SMOKE_TONES: Record<string, number> = { white: 0xe6e6e6, grey: 0x8a8a8a, black: 0x2a2a2a }

const DEFAULT_SPEED: Record<string, number> = {
  sparks: 3,
  splinters: 2.5,
  dust: 1,
  shards: 2.5,
  fibers: 1.2,
  leaves: 1.2,
  drips: 0.5,
  ash: 0.8,
  chips: 2.5,
  smoke: 0.8,
  steam: 1,
  fire: 1.2,
  flash: 0,
  foam: 2.5,
}

/** Sound key for an impact on a material. */
export function impactKey(def: MaterialDef | undefined): string {
  if (!def) return 'impact_wood'
  const tags = def.tags ?? []
  if (tags.includes('metal')) return 'impact_metal'
  if (def.visual?.transparent || def.fracture === 'shatter') return 'impact_glass'
  if (def.fracture === 'crumble') return 'impact_masonry'
  if (def.fracture === 'tear') return 'impact_soft'
  return def.fracture === 'none' ? 'impact_metal' : 'impact_wood'
}

/** Sound key (`shot_*`) of a round striking this material: sharper than a blow (a tink on steel, a crack on glass); a host without it plays the `impact_*`. */
export const shotKey = (def: MaterialDef | undefined): string => impactKey(def).replace('impact_', 'shot_')

/** Sound key (`drag_*`) of a base of this material dragged on a floor. */
export const dragSoundKey = (def: MaterialDef | undefined): string => impactKey(def).replace('impact_', 'drag_')

function fractureKey(def: MaterialDef | undefined, style: string): string {
  switch (style) {
    case 'shatter':
      return 'shatter_glass'
    case 'crumble':
      return 'crumble'
    case 'splinter':
      return 'splinter'
    default:
      return impactKey(def)
  }
}

/** Colour of a material when the part gives none: its inside, a unit of it, or its family's (never wood brown on stone). */
function fallbackColor(def: MaterialDef | undefined): number {
  return debrisColor(def)
}

function materialsOf(m: THREE_NS.Material | THREE_NS.Material[]): THREE_NS.Material[] {
  return Array.isArray(m) ? m : [m]
}

function isMeshRange(v: Object3D | MeshRange): v is MeshRange {
  const r = v as Partial<MeshRange>
  return !!r.mesh && Array.isArray(r.range)
}

/** Create the renderer. See `DestructionRenderer`. */
/** The seed of the renderer's random stream; `reset` takes it back here. */
const RNG_SEED = 0xc0ffee

/** The renderer this package makes always has its `deferredQueue`; a third-party `DestructionRenderer` may leave it out. */
export function createDestructionRenderer(THREE: ThreeNamespace, options: RendererOptions): DestructionRenderer & { deferredQueue(): DeferredQueue; deferredQueues(): readonly DeferredQueueRegistration[] } {
  if (options.jitWarmUp !== false) {
    // the throwaway renderer takes no number of the game's: the first real one is still `destruction-1`
    const before = rendererCount
    try {
      warmUpDestructionJit(THREE, (inner) => new Renderer(THREE, inner), options.jitWarmUp === true ? {} : options.jitWarmUp)
    } catch (error) {
      // the warm-up only saves time: the game starts without it
      warnOnce('game-destruction-three.jit-warm-up-failed', `game-destruction-three skipped the JIT warm-up: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      rendererCount = before
    }
  }
  return new Renderer(THREE, options)
}

/** true when both lists hold the very same numbers, in the same order. */
const sameNumbers = (a: readonly number[], b: readonly number[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

class Renderer implements DestructionRenderer {
  private readonly world: RendererOptions['world']
  private readonly scene: THREE_NS.Scene
  private readonly quality: 'low' | 'medium' | 'high'
  private readonly low: boolean
  private readonly groundAt: (x: number, z: number) => number
  private readonly gravity: number
  private readonly autoSplit: boolean
  private readonly maxFragments: number
  /** The debris policy of blasts (`RendererOptions.blastDebris`), or null: a host that sets nothing wakes and loosens everything in the blast's frame, as before. */
  private readonly blastDebris: ResolvedBlastDebris | null
  private readonly blastWakes: BlastWakes | null
  private readonly costMeter: PhysicsCostMeter
  /** The step cost the debris policy reads this frame (`debrisCost`), null when there is none (`fixed`). */
  private cost: DebrisCostSample | null = null
  private costFrame = 0
  /** The pieces faded away (`faded`): their root shrinks, then leaves the scene. */
  private readonly fading = new Map<string, { root: Object3D; age: number }>()
  private readonly eventBudgetMs: number
  private readonly bounds = new Map<string, Bound>()
  /** World boxes (min xyz, max xyz) of the drawn meshes of the bound objects that are not pieces, for the pieces to land on. */
  private readonly staticBoxes = new Map<string, number[]>()
  /** `staticSolids` per object, kept until `staticNow` measures the object again for a reason. */
  private readonly solidCache = new Map<string, { solids: StaticSolid[]; leftOut: boolean }>()
  /** The fixed bodies a host module gives that are no bound object (`setHostSolids`), and the list last made of each: the same numbers keep the same list. */
  private readonly hostSolids = new Map<string, () => readonly HostSolid[]>()
  private readonly hostSolidLists = new Map<string, { readonly given: readonly HostSolid[]; readonly solids: StaticSolid[] }>()
  /** The objects whose last `staticSolids` list is not all of what a ray can hit: measured in part, or with a loose or hidden part left out. */
  private readonly unsureSolids = new Set<string>()
  /** The objects `staticNow` measured again for a reason (an event, a moved root, boxes that changed): their `staticSolids` are measured again too. */
  private readonly solidStale = new Set<string>()
  /** The world matrix of each root when `staticNow` last measured it. */
  private readonly rootMatrices = new Map<string, number[]>()
  /** `clipToDrawn` per hosted body: the boxes it was given, the root's world matrix, and the boxes cut to what it draws. */
  private readonly clipped = new Map<string, { from: readonly StaticSolid[]; matrix: number[]; solids: readonly StaticSolid[] }>()
  /** Each drawn solid with its surface's friction (`withSurface`), by the solid `drawnSolidsOf` gave: weak, so a solid measured anew lets the old one go. */
  private readonly surfaced = new WeakMap<StaticSolid, StaticSolid>()
  /** The meshes whose world matrix one `staticSolids` call brought up to date (`MeasureBudget.updated`), emptied at its end. */
  private readonly measuredMeshes = new Set<object>()
  /** What `staticSolids` hands back, refilled each call. */
  private readonly solidsOut = new Map<string, readonly StaticSolid[]>()
  /** Objects to measure again; `staticAll` measures every one. */
  private readonly staticDirty = new Set<string>()
  private staticAll = true
  /** The periodic refresh: the objects still to measure again in this round, a slice per call. */
  private staticRound: string[] = []
  /** Boxes of the pieces' meshes (as `staticBoxes`), with the time they were measured. */
  private readonly pieceBoxes = new WeakMap<PieceBody, { at: number; boxes: number[] }>()
  /** Objects broken since the last update: `checkBroken` looks at what is left of them. */
  private readonly broken = new Set<string>()
  /** Discs of ground that changed since the last update (`wakeRegion`): `checkUndermined` looks at what stood on them. */
  private readonly undermined: Array<{ x: number; z: number; radius: number }> = []
  private staticAt = 0
  private queue: DestructionEvent[] = []
  /** The cover of each body around a part of the world that went off, read as the event is emitted: before the blast tore or moved anything. */
  private readonly coverWhenWentOff = new WeakMap<DestructionEvent, Map<string, number>>()
  /** Places a blow broke a hard face at: grit and dust keep coming off them for a few seconds, less and less (`TRICKLE_SECONDS`). */
  private readonly trickles: Array<{ point: Vec3; normal: Vec3; anchor: EmitterAnchor | null; color: number | undefined; left: number; total: number; next: number; source: string | undefined }> = []
  /** Presentation work an event left for later frames (fragments still to spawn, loose groups still to split), run in order within the frame budget; as data under `workBudget`. */
  private readonly slices: Array<(() => void) | FragmentSlice> = []
  /** The frame budget of work units the explosion's deferred work draws from (`RendererOptions.workBudget`), null when the clock cuts it as before. */
  private readonly work: WorkBudget | null
  private readonly workCosts: Required<WorkUnitCosts>
  /** The loose groups waiting to become pieces under `workBudget`, as data: the object, a part of the group, and the tearing joints read when it came loose. */
  private readonly splitQueue = new WorkQueue<PendingSplit>('split')
  /**
   * Objects bound or drawn again whose loose groups become pieces in the next drain: queued under `workBudget` (a load drops the queue the save was taken with), split without
   * it. The value says whether it came with a fresh `bind` (its pieces start where they stood, `splittingAtLoad`); one drawn again or given its pieces back splits as live.
   */
  private readonly looseToCheck = new Map<string, boolean>()
  /** Where the player was at the start of this frame's work step: read once per frame. */
  private workFocus: Vec3 | undefined
  /** True while the loose groups an object was freshly bound with are split (`splitChecked`): their pieces start where they stood, asleep when balanced on a support. */
  private splittingAtLoad = false
  /** The `WorkBudget` frame an event last split a group in: the first one of a frame goes over the budget, so a blow breaks something at once. */
  private eventSplitFrame = -1
  /** The boxes `fitOrientedBoxes` gave for the points of a part drawn by a range of a merged mesh (in its mesh's own space, unless its pose scales), kept with the points and triangles they came from: the same drawing is not fitted again. Released with the object (`forgetBound`). */
  private readonly fittedBoxes = new Map<MeshVis, { readonly points: readonly number[]; readonly triangles: readonly number[]; readonly boxes: ReturnType<typeof fitOrientedBoxes> }>()
  /** Objects whose ranged parts are still to be fitted ahead of the blow that breaks them, a part per step, only with time left in the frame. */
  private readonly prefitting: Array<{ readonly b: Bound; readonly parts: MeshVis[]; next: number }> = []
  /** When the work of this frame must stop; `Infinity` outside a drain, where a call finishes what it started. */
  private sliceDeadline = Infinity
  /** The clock the drain reads; a budget lends its own while it runs the queue. */
  private drainClock: () => number = () => performance.now()
  /** true once a frame budget owns the draining: `update` no longer drains by itself. */
  private attached = false
  /** true while the host applies the structural events itself, at the end of each tick (`applyStructuralEvents`): a frame drain leaves them, and what waits behind them, for the next tick. */
  private structuralInTick = false
  private readonly eventOrder = new EventOrder()
  /** true while the host holds every event (a blast still being run in slices, `holdEvents`): no drain applies one and no stall is counted. */
  private areEventsHeld = false
  /**
   * The structural events of a spread blast, arranged once as `applyStructuralEvents` arranges them, applied a slice per frame (`applyStructuralEventsSliced`); `tail`
   * is what followed the last structural one, given back to the queue when they are all applied.
   */
  private heldStructural: { readonly events: readonly DestructionEvent[]; readonly tail: readonly DestructionEvent[]; next: number } | undefined
  private stalledFrames = 0
  private watchedFrame = -1
  private readonly eventQueue: DeferredQueue = {
    id: DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS,
    pending: (frame) => this.watchStall(frame) + this.appliableEvents() + this.slices.length + this.splitQueue.size + this.looseLeft(),
    run: (deadline, clock) => this.runBudgeted(deadline, clock),
    flush: () => {
      for (let guard = 0; guard < 16 && this.queue.length + this.slices.length + this.splitQueue.size + this.looseLeft() > 0; guard++) this.runBudgeted(Infinity, () => 0, true)
      if (!this.prefitAttached) this.prefitQueue.flush()
    },
    attach: () => {
      this.attached = true
    },
    detach: () => {
      this.attached = false
    },
  }
  /** true once a frame budget owns the fitting ahead: the events drain no longer does it. */
  private prefitAttached = false
  private readonly prefitQueue: DeferredQueue = {
    id: DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT,
    pending: () => this.prefitLeft(),
    run: (deadline, clock) => this.runPrefit(deadline, clock),
    flush: () => {
      this.runPrefit(Infinity, () => 0)
    },
    attach: () => {
      this.prefitAttached = true
    },
    detach: () => {
      this.prefitAttached = false
    },
  }
  private readonly unsubscribe: () => void
  private readonly visuals: Visuals
  /** The parts the ground went down under, drawn going down (`subside`). */
  private readonly settlement: SettlementView
  private readonly fragments: FragmentSystem
  private readonly ground: GroundSpots
  private readonly pieceSys: PieceSystem
  private readonly cages: RebarCages
  /** The debris at rest drawn in batches. */
  private readonly settledBatches: SettledBatches
  private readonly hitPoints = new HitPoints()
  private readonly active = new Map<string, { object: string; part: string }>()
  private readonly fires = new Map<string, FireEmitter>()
  /** Primed parts burning in the effects world until they go off: their burn loop ends when they are put out. */
  private readonly primedBurning = new Set<string>()
  /** The burn loops asked of the host and not yet ended, by part: whatever stops a part's fire ends its loop, once, with what it started with. */
  private readonly burnSounds = new Map<string, { readonly object: string; readonly point: Vec3; readonly detail: SoundDetail | undefined }>()
  private readonly leaks: Leak[] = []
  private readonly homeTags: string[] = []
  private readonly throttles = new Map<string, number>()
  private rng = createRng(RNG_SEED)
  private readonly vfx: VfxWorld
  /** The object whose event is being applied: what the effects world is given while it is set is that object's (`stampSource`). */
  private emitting: string | undefined
  /** Names this renderer to the world's drips, so a shared world tells each renderer where its own landed. */
  private readonly owner = `destruction-${++rendererCount}`
  private readonly stopLanding: () => void
  /** The effects renderer made here when the host gave no shared world; it is stepped in `update`. */
  private readonly ownVfx: VfxRenderer | undefined
  private time = 0
  private scanTimer = 0
  private disposed = false
  private stopContactHits: (() => void) | null = null
  private readonly box: THREE_NS.Box3
  private readonly tmpQ: THREE_NS.Quaternion
  private readonly v1: THREE_NS.Vector3
  private readonly v2: THREE_NS.Vector3
  private readonly v3: THREE_NS.Vector3
  private readonly q1: THREE_NS.Quaternion

  constructor(
    private readonly THREE: ThreeNamespace,
    private readonly o: RendererOptions,
  ) {
    this.world = o.world
    this.scene = o.scene
    this.quality = o.quality ?? 'medium'
    this.low = this.quality === 'low'
    this.groundAt = o.groundAt ?? (() => 0)
    this.gravity = o.gravity ?? 9.81
    this.autoSplit = o.autoSplit !== false
    this.maxFragments = o.maxFragments ?? 160
    this.blastDebris = o.blastDebris ? resolveBlastDebris(o.blastDebris) : null
    this.blastWakes = this.blastDebris ? new BlastWakes(this.blastDebris) : null
    const priors = resolveBlastDebris(o.blastDebris)
    this.costMeter = new PhysicsCostMeter(priors.physicsCostPerBodyMs, priors.wakeCostPerBodyMs)
    this.eventBudgetMs = o.eventBudgetMs ?? Infinity
    this.work = o.workBudget ? new WorkBudget(o.workBudget) : null
    this.workCosts = resolveWorkUnitCosts(o.workBudget?.costs)
    this.box = new THREE.Box3()
    this.tmpQ = new THREE.Quaternion()
    this.v1 = new THREE.Vector3()
    this.v2 = new THREE.Vector3()
    this.v3 = new THREE.Vector3()
    this.q1 = new THREE.Quaternion()
    const maxParticles = Math.max(8, Math.floor((o.maxParticles ?? 2500) * (this.low ? 0.5 : 1)))
    this.visuals = new Visuals(THREE, this.low, 600)
    this.settlement = new SettlementView(THREE, this.visuals)
    this.ground = new GroundSpots(THREE, o.scene, this.groundAt, 48)
    if (!o.vfx) warnOnce('game-destruction-three.own-effects-world', 'game-destruction-three made an effects world of its own because the host lent none (options.vfx); pass the host effects so the effects share one budget')
    this.vfx = stampSource(o.vfx ?? createVfx({ profile: this.quality, gravity: this.gravity, groundAt: this.groundAt, sprites: { capacity: maxParticles, density: this.low ? 0.6 : 1 } }), () => this.emitting)
    this.ownVfx = o.vfx ? undefined : createVfxRenderer(THREE, { scene: o.scene, camera: o.camera ?? new THREE.PerspectiveCamera(), vfx: this.vfx, pointScale: o.pointScale ?? 700 })
    this.stopLanding = this.vfx.onLand(this.owner, (x, _y, z, color, tag) => {
      const home = this.homeTags[tag - 1] ?? ''
      this.ground.add('puddle', x, z, 0.05 + this.rng() * 0.04, color, home)
    })
    this.fragments = new FragmentSystem(THREE, {
      scene: o.scene,
      groundAt: this.groundAt,
      gravity: this.gravity,
      max: this.maxFragments,
      life: o.fragmentLife ?? 12,
      formOf: (id) => this.world.materials.get(id)?.splitForm,
      crumbles: (id) => this.world.materials.get(id)?.fracture === 'crumble',
      // rubble lands on what is still built (a slab, a wall's top, a floor), not only on the terrain under it
      surfaceAt: (x, y, z) => this.surfaceAt(x, y, z),
      // and it meets the walls, ceilings and furniture on its way: it stops on their face instead of flying into them
      sweep: (from, direction, distance) => (typeof this.world.raycast === 'function' ? this.world.raycast([from[0], from[1], from[2]], [direction[0], direction[1], direction[2]], distance) : null),
      maxAwake: o.maxAwakeFragments ?? Infinity,
      ...(o.interpolate ? { interpolate: true } : {}),
    })
    this.cages = new RebarCages(THREE, o.scene)
    this.settledBatches = new SettledBatches(THREE, o.scene, o.settledBatches ?? { enabled: false })
    this.pieceSys = new PieceSystem(THREE, {
      physics: o.physics,
      ...(o.interpolate ? { interpolate: true } : {}),
      groundAt: this.groundAt,
      ...(o.terrainAt ? { terrainAt: o.terrainAt } : {}),
      ...(o.terrainRollingAt ? { terrainRollingAt: o.terrainRollingAt } : {}),
      ...(o.terrainRollingDampingAt ? { terrainRollingDampingAt: o.terrainRollingDampingAt } : {}),
      ...(o.terrainRangeAt ? { terrainRangeAt: o.terrainRangeAt } : {}),
      ...(o.terrainGridAt && o.terrainAt ? { terrainGridAt: o.terrainGridAt } : {}),
      ...(o.terrainPatchAt && o.terrainGridAt && o.terrainAt ? { terrainPatchAt: o.terrainPatchAt } : {}),
      ...(o.blastGroundTiles !== undefined ? { blastGroundTiles: o.blastGroundTiles } : {}),
      staticTopAt: (x, z, y, step) => this.staticTopAt(x, z, y, step),
      staticSolids: () => this.staticSolids(),
      staticUnsure: () => this.unsureSolids,
      gravity: this.gravity,
      scene: o.scene,
      maxAwake: o.maxAwakePieces ?? Infinity,
      ...(o.tilesUnderParts ? { tilesUnderParts: true } : {}),
      ...(o.heldIgnores ? { heldIgnores: o.heldIgnores } : {}),
      ...(o.groundWorker ? { groundWorker: o.groundWorker } : {}),
      ...(o.groundWorkerFrames !== undefined ? { groundWorkerFrames: o.groundWorkerFrames } : {}),
      ...(this.blastDebris
        ? { keep: { maxLive: this.blastDebris.maxLivePieces, far: this.blastDebris.far, ...(o.focus ? { focus: o.focus } : {}), onFade: (b: PieceBody) => this.fadePiece(b) } }
        : {}),
      onHardLanding: (p, point, speed) => this.hardLanding(p, point, speed),
      sweep: (p, from, to) => this.sweepPiece(p, from, to),
      onSlam: (p, hit, speed) => this.slam(p, hit, speed),
      // two pieces knocked together: each sounds as its material does (a can on a can, a bottle on a table's leg)
      onKnock: (a, b, point, speed) => {
        this.landingSound(a.objectId, point, clamp(speed / 10, 0.2, 1))
        this.landingSound(b.objectId, point, clamp(speed / 10, 0.2, 1))
      },
    })
    if (o.rayBroadPhase) this.world.setRayBroadPhase(this.pieceSys.rayBroadPhase())
    if (o.contactHits) this.stopContactHits = this.pieceSys.contactHits(this.world, o.contactHits === true ? undefined : o.contactHits)
    this.unsubscribe = this.world.on('*', (ev) => {
      if (ev.type === 'explode') this.coverWhenWentOff.set(ev, this.coverAround(ev))
      // past the cap only what changes the simulation is kept: a blast floods the queue with damage and marks, and a dropped collapse leaves a fallen wall drawn standing
      if (this.queue.length < QUEUE_CAP || isStructuralEvent(ev)) this.queue.push(ev)
    })
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Binding
  // ----------------------------------------------------------------------------------------------------------------------------------

  bind(objectId: string, root: Object3D, options: BindOptions = {}): void {
    this.staticDirty.add(objectId)
    if (this.bounds.has(objectId)) this.unbind(objectId)
    const state = this.world.state(objectId)
    const partIds = new Set((state?.parts ?? []).map((p) => p.id))
    const byPart = new Map<string, Array<{ mesh: Mesh; range?: [number, number] }>>()
    const taken = new Set<Mesh>()
    const put = (pid: string, e: { mesh: Mesh; range?: [number, number] }): void => {
      const l = byPart.get(pid)
      if (l) l.push(e)
      else byPart.set(pid, [e])
    }
    const add = (pid: string, m: Mesh): void => {
      if (taken.has(m)) return
      taken.add(m)
      put(pid, { mesh: m })
    }
    const addRange = (pid: string, r: MeshRange): void => {
      const n = (r.mesh.geometry.getAttribute('position')?.count ?? 0) as number
      const [v0, v1] = r.range
      if (!Number.isInteger(v0) || !Number.isInteger(v1) || v0 < 0 || v1 <= v0 || v1 > n) {
        throw new Error(`game-destruction-three: invalid vertex range [${v0}, ${v1}) for part "${pid}" (the mesh has ${n} vertices)`)
      }
      put(pid, { mesh: r.mesh, range: [v0, v1] })
    }
    const meshesIn = (o: Object3D): Mesh[] => {
      const out: Mesh[] = []
      o.traverse((c) => {
        if ((c as Mesh).isMesh) out.push(c as Mesh)
      })
      return out
    }
    if (options.parts) {
      for (const [pid, v] of Object.entries(options.parts)) {
        for (const o of Array.isArray(v) ? v : [v]) {
          if (isMeshRange(o)) addRange(pid, o)
          else for (const m of meshesIn(o)) add(pid, m)
        }
      }
    } else {
      const leftovers: Mesh[] = []
      for (const m of meshesIn(root)) {
        const ud = partHintOf(m.userData?.destructionPart)?.id
        if (ud !== undefined && partIds.has(ud)) add(ud, m)
        else if (partIds.has(m.name)) add(m.name, m)
        else leftovers.push(m)
      }
      if (leftovers.length) this.matchByBox(objectId, root, leftovers, add)
    }
    const bound: Bound = { id: objectId, root, sync: options.syncTransform !== false, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: false }
    if (options.onFrame) bound.onFrame = options.onFrame
    const hosts = new Map<Mesh, HostVis>()
    for (const pid of partIds) bound.parts.set(pid, this.makePartVis(objectId, pid, state?.parts.find((p) => p.id === pid)?.material ?? '', byPart.get(pid) ?? [], hosts))
    for (const [pid, meshes] of byPart) {
      if (!bound.parts.has(pid)) bound.parts.set(pid, this.makePartVis(objectId, pid, this.world.part(objectId, pid)?.material ?? '', meshes, hosts))
    }
    for (const [pid, hostIds] of Object.entries(options.marksOn ?? {})) {
      const pv = bound.parts.get(pid)
      const markHosts = hostIds.map((h) => bound.parts.get(h)).filter((h): h is PartVis => !!h && h !== pv)
      if (pv && markHosts.length) pv.markHosts = markHosts
    }
    this.bounds.set(objectId, bound)
    for (const pv of bound.parts.values()) this.tagPart(pv, objectId)
    if (this.o.fitBoxesAhead !== false) this.prefitPartBoxes(bound)
    this.checkLoose(objectId, true)
  }

  /**
   * Label the meshes of a part so a host can go from a raycast hit to the world: `userData.destructionPart` (the part id) and
   * `userData.destructionObject` (the id of the world object that part belongs to now; a loose piece has an id of its own). Parts drawn by a range
   * of a merged mesh share that mesh with others and are left alone until they get a mesh of their own. Decals are marked `destructionDebris`.
   */
  private tagPart(pv: PartVis, objectId: string): void {
    for (const mv of pv.meshes) {
      if (mv.merged && !mv.loose) continue
      mv.mesh.traverse((c) => {
        if (!(c as Mesh).isMesh) return
        const ud = c.userData as Record<string, unknown>
        if (ud.destructionDebris) return
        if (partHintOf(ud.destructionPart)?.id !== pv.id) ud.destructionPart = pv.id
        ud.destructionObject = objectId
      })
    }
  }

  private makePartVis(home: string, id: string, material: string, meshes: Array<{ mesh: Mesh; range?: [number, number] }>, hosts: Map<Mesh, HostVis>): PartVis {
    return { id, home, material, meshes: meshes.map((m) => this.visuals.makeMeshVis(m.mesh, home, m.range, hosts)), charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' }
  }

  /** Match unlabelled meshes to the part whose shape contains the centre of the mesh's bounding box. */
  private matchByBox(objectId: string, root: Object3D, meshes: Mesh[], add: (pid: string, m: Mesh) => void): void {
    let specParts: PartSpec[] | undefined
    try {
      specParts = this.world.serialize?.().objects.find((o) => o.id === objectId)?.spec.parts
    } catch {
      specParts = undefined
    }
    if (!specParts) return
    const frame = specFrameInverse(this.THREE, root)
    const e = new this.THREE.Euler()
    const q = new this.THREE.Quaternion()
    for (const m of meshes) {
      this.box.setFromObject(m)
      if (this.box.isEmpty()) continue
      const c = this.box.getCenter(this.v1).applyMatrix4(frame)
      let best: PartSpec | null = null
      let bestVol = Infinity
      for (const p of specParts) {
        const l = this.v2.set(c.x - p.position[0], c.y - p.position[1], c.z - p.position[2])
        if (p.rotation) l.applyQuaternion(q.setFromEuler(e.set(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')).invert())
        let inside = false
        let vol = 0
        const s = p.shape
        if (s.kind === 'box') {
          inside = Math.abs(l.x) <= s.size[0] / 2 && Math.abs(l.y) <= s.size[1] / 2 && Math.abs(l.z) <= s.size[2] / 2
          vol = s.size[0] * s.size[1] * s.size[2]
        } else if (s.kind === 'cylinder') {
          inside = Math.hypot(l.x, l.z) <= s.radius && Math.abs(l.y) <= s.height / 2
          vol = Math.PI * s.radius * s.radius * s.height
        } else {
          inside = l.length() <= s.radius
          vol = (4 / 3) * Math.PI * s.radius ** 3
        }
        if (inside && vol < bestVol) {
          best = p
          bestVol = vol
        }
      }
      if (best) add(best.id, m)
    }
  }

  /** Drop an object from the bound ones, with the boxes fitted for its parts. */
  private forgetBound(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (b) {
      for (const pv of b.parts.values()) for (const mv of pv.meshes) this.fittedBoxes.delete(mv)
      if (b.frozen) this.thawRoot(b)
    }
    this.bounds.delete(objectId)
  }

  unbind(objectId: string): void {
    this.staticDirty.add(objectId)
    this.clipped.delete(objectId)
    this.looseToCheck.delete(objectId)
    this.splitQueue.remove((entry) => entry.objectId === objectId)
    const b = this.bounds.get(objectId)
    if (!b) return
    this.restore(objectId)
    this.pieceSys.remove(objectId)
    this.forgetBound(objectId)
    this.hitPoints.forget(objectId)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Pieces
  // ----------------------------------------------------------------------------------------------------------------------------------

  /** Half extents and centre of the box around some meshes, in the metric frame of `root` (its pose removed, its scale kept). */
  private measure(root: Object3D, meshes: MeshVis[]): { half: Vec3; center: THREE_NS.Vector3 } {
    const inv = specFrameInverse(this.THREE, root)
    const total = new this.THREE.Box3()
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    for (const mv of meshes) {
      const m = mv.mesh
      m.updateWorldMatrix(true, false)
      this.visuals.localBox(mv, lb)
      if (lb.isEmpty()) continue
      total.union(lb.clone().applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld)))
    }
    if (total.isEmpty()) return { half: [0.25, 0.25, 0.25], center: new this.THREE.Vector3() }
    const size = total.getSize(new this.THREE.Vector3())
    return { half: [Math.max(MIN_PIECE_HALF, size.x / 2), Math.max(MIN_PIECE_HALF, size.y / 2), Math.max(MIN_PIECE_HALF, size.z / 2)], center: total.getCenter(new this.THREE.Vector3()) }
  }

  /**
   * A hosted body's boxes (`hostedSolids`: its damage zones) cut to the box of what its root draws, in the root's frame: the zones reach past the drawn body (17 cm each
   * side and 14 cm over the room's sedan), and a box where nothing is drawn is an invisible collider (§12): doors made by the wall it is parked against were made inside
   * it. A box turned against the root (a door swung open) is kept as it is. The same list back until the boxes or the root's place change.
   */
  private clipToDrawn(id: string, hosted: readonly StaticSolid[]): readonly StaticSolid[] {
    const b = this.bounds.get(id)
    if (!b) return hosted
    // the root's meshes are measured by their bounds: a merged mesh with a write pending in the batch must show them
    this.visuals.flushPendingRebuilds()
    b.root.updateWorldMatrix(true, true)
    const m = b.root.matrixWorld.elements
    const known = this.clipped.get(id)
    if (known && known.from === hosted && known.matrix.every((v, k) => v === m[k])) return known.solids
    const inv = new this.THREE.Matrix4().copy(b.root.matrixWorld).invert()
    const drawn = new this.THREE.Box3()
    const part = new this.THREE.Box3()
    const to = new this.THREE.Matrix4()
    b.root.traverseVisible((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (!mesh.geometry.boundingBox) return
      drawn.union(part.copy(mesh.geometry.boundingBox).applyMatrix4(to.multiplyMatrices(inv, mesh.matrixWorld)))
    })
    const rootQ = new this.THREE.Quaternion()
    b.root.getWorldQuaternion(rootQ)
    const solids = drawn.isEmpty() ? hosted : this.clipEach(hosted, { drawn, inv, root: b.root, rootQ })
    this.clipped.set(id, { from: hosted, matrix: [...m], solids })
    return solids
  }

  private clipEach(hosted: readonly StaticSolid[], frame: { readonly drawn: THREE_NS.Box3; readonly inv: THREE_NS.Matrix4; readonly root: Object3D; readonly rootQ: THREE_NS.Quaternion }): StaticSolid[] {
    const out: StaticSolid[] = []
    const q = new this.THREE.Quaternion()
    const c = new this.THREE.Vector3()
    const box = new this.THREE.Box3()
    for (const s of hosted) {
      q.set(s.rotation[0], s.rotation[1], s.rotation[2], s.rotation[3])
      // turned against the root (a part posed): kept as the world holds it
      if (Math.abs(q.dot(frame.rootQ)) < 1 - 1e-6) {
        out.push(s)
        continue
      }
      c.set(s.center[0], s.center[1], s.center[2]).applyMatrix4(frame.inv)
      box.min.set(c.x - s.half[0], c.y - s.half[1], c.z - s.half[2])
      box.max.set(c.x + s.half[0], c.y + s.half[1], c.z + s.half[2])
      box.intersect(frame.drawn)
      if (box.isEmpty()) continue
      const center = box.getCenter(c).applyMatrix4(frame.root.matrixWorld)
      out.push({ center: [center.x, center.y, center.z], half: [(box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2, (box.max.z - box.min.z) / 2], rotation: s.rotation })
    }
    return out
  }

  /** Whether a bound object has no mesh here at all (another module draws it), as against one whose meshes all broke or are hidden. */
  private drawsNothingHere(objectId: string): boolean {
    const b = this.bounds.get(objectId)
    if (!b) return false
    for (const pv of b.parts.values()) if (pv.meshes.length > 0) return false
    return true
  }

  private meshesOf(b: Bound): MeshVis[] {
    const out: MeshVis[] = []
    for (const pv of b.parts.values()) if (pv.gone === 'none') for (const mv of pv.meshes) out.push(mv)
    return out
  }

  private massOf(objectId: string): number {
    const st = this.world.state(objectId)
    if (!st) return 5
    let m = 0
    for (const p of st.parts) if (p.status !== 'broken' && p.status !== 'melted' && p.status !== 'ashes') m += p.mass
    return m > 0 ? m : 5
  }

  /** The mass of a piece changed (a liquid drunk or leaked out of it): its mass follows, and a round one turns by the moment of what is left in it. */
  setPieceMass(objectId: string, mass: number): void {
    const b = this.bounds.get(objectId)
    const body = b?.piece ?? this.pieceSys.get(objectId)
    if (!b || !body) return
    // what the world's parts weigh minus what the piece weighs now: the liquid that left, kept over the refits a break makes
    body.massOffset = Math.max(0, this.massOf(objectId) - mass)
    body.mass = Math.max(MIN_PIECE_MASS_KG, mass)
    if (body.round) this.fitSurface(b, body)
    body.sleeping = false
  }

  makePiece(objectId: string, options: MakePieceOptions = {}): Piece {
    this.staticDirty.add(objectId)
    const b = this.bounds.get(objectId)
    if (!b) throw new Error(`game-destruction-three: object "${objectId}" is not bound`)
    if (b.root.parent && b.root.parent !== this.scene) this.scene.attach(b.root)
    const { half, center } = this.measure(b.root, this.meshesOf(b))
    const piece = this.pieceSys.create(objectId, b.root, half, center, options.mass ?? this.massOf(objectId), options.velocity)
    b.piece = piece
    this.fitSurface(b, piece, options.inertia)
    this.fitPartBoxes(b, piece)
    return piece
  }

  /**
   * What lands on or runs into a piece of several meshes meets its parts as drawn (`partBoxes`: a bench's slats, a table's top and legs), from the moment it is made a piece, not
   * the box around them all: a board laid on a bench rests on its seat, a can rolls under a table between its legs. Its own contacts with the ground are left as they were.
   */
  private fitPartBoxes(b: Bound, body: PieceBody): void {
    if (body.round) return
    const contacts = body.contacts
    this.setContacts(b, body, this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
    body.contacts = contacts
  }

  /** What the piece's surface is (the friction of the material it stands on) and whether it is round (`round`: it rolls on rings of contacts). */
  private fitSurface(b: Bound, body: PieceBody, inertia?: number): void {
    // the surface it stands on is its lowest part (a sofa's feet, a can's steel), whatever most of its weight is
    const box = new this.THREE.Box3()
    let low = Infinity
    let material: string | null = null
    for (const [partId, pv] of b.parts) {
      if (pv.gone !== 'none') continue
      for (const mv of pv.meshes) {
        if (!this.visuals.shown(mv)) continue
        this.visuals.worldBox(mv, box)
        if (box.isEmpty() || box.min.y >= low - 0.005) continue
        low = box.min.y
        material = this.world.part(b.id, partId)?.material ?? pv.material ?? null
      }
    }
    const surface = material ? surfaceOf(material, this.world.materials.get(material)) : undefined
    body.friction = surface && { static: surface.static, dynamic: surface.dynamic, rolling: surface.rolling, rollingDamping: surface.rollingDamping }
    body.restitution = surface?.restitution
    const wasRound = body.round !== undefined
    if (inertia !== undefined) body.inertiaGiven = inertia
    const round = this.roundOf(b, body)
    body.round = round ?? undefined
    if (round) {
      body.contacts = rimPoints(round, body.halfExtents)
      body.partBoxes = undefined
    } else if (wasRound) body.contacts = undefined
  }

  /**
   * k of a round piece's moment of inertia about its axis (I = k m r^2), from where its mass is. A piece that is not hollow is a solid (k 1/2 for a cylinder, 2/5 for a ball).
   * A hollow one (`userData.hollow`) with nothing inside (no `destructionContains` liquid, no `destructionPowder`) is all wall, a thin shell (k 1, 2/3): an empty can. One with
   * contents weighs its walls as their area times their thickness (`destructionThickness`) times density, or, without a thickness, as what is left of its mass besides the liquid
   * (`LIQUID_KG_PER_L`), and the rest as a solid: a full 350 ml can comes to about 0.53 and rolls down a slope at g sin t / 1.53, an empty one at g sin t / 2.
   */
  private inertiaOf(b: Bound, body: PieceBody, kind: PieceRound['kind'], axis: 0 | 1 | 2, radius: number): number {
    const shell = kind === 'sphere' ? SHELL_SPHERE : SHELL_CYLINDER
    const solid = kind === 'sphere' ? SOLID_SPHERE : SOLID_CYLINDER
    let hollow = false
    let filled = false
    let liters = 0
    let thickness = 0
    let material: string | null = null
    for (const [partId, pv] of b.parts) {
      if (pv.gone !== 'none') continue
      for (const mv of pv.meshes) {
        const ud = mv.mesh.userData as { hollow?: unknown; destructionThickness?: unknown; destructionContains?: { liters?: unknown }; destructionPowder?: unknown }
        if (ud.hollow !== true) continue
        hollow = true
        if (ud.destructionPowder) filled = true
        if (ud.destructionContains) {
          filled = true
          // what is left in it now (drunk or leaked), else what it was filled with
          const left = this.world.part(b.id, partId)?.liters
          liters += left ?? (typeof ud.destructionContains.liters === 'number' ? ud.destructionContains.liters : 0)
        }
        const t = typeof ud.destructionThickness === 'number' ? ud.destructionThickness : 0
        if (t > thickness) {
          thickness = t
          material = this.world.part(b.id, partId)?.material ?? pv.material
        }
      }
    }
    if (!hollow) return solid
    if (!filled) return shell
    const density = material ? this.world.materials.get(material)?.density : undefined
    const area = kind === 'sphere' ? 4 * Math.PI * radius * radius : 2 * Math.PI * radius * 2 * body.halfExtents[axis] + 2 * Math.PI * radius * radius
    const walls = density && thickness > 0 ? area * thickness * density : body.mass - liters * LIQUID_KG_PER_L
    const share = clamp(walls / body.mass, 0, 1)
    // the liquid inside lags the walls: it carries a part of what a solid of its mass would
    const liquidShare = clamp((liters * LIQUID_KG_PER_L) / body.mass, 0, 1 - share)
    return share * shell + (1 - share - liquidShare) * solid + liquidShare * solid * LIQUID_SPIN_COUPLING
  }

  /**
   * Whether what is drawn of the piece is round about one of its axes (a can, a bottle, a plate) or all of them (a ball): its points, in its frame from the centre of
   * mass, all lie within the circle the box's two other sides draw (a box's corners would stick out of it by sqrt 2). Null for anything else.
   */
  private roundOf(b: Bound, body: PieceBody): PieceRound | null {
    const half = body.halfExtents
    const inv = specFrameInverse(this.THREE, b.root)
    const m4 = new this.THREE.Matrix4()
    const p = new this.THREE.Vector3()
    const [cx, cy, cz] = body.localCenter
    const points: Vec3[] = []
    for (const mv of this.meshesOf(b)) {
      if (!this.visuals.shown(mv) || mv.host) continue
      const pos = (mv.mesh.geometry as THREE_NS.BufferGeometry).getAttribute('position')
      if (!pos) continue
      mv.mesh.updateWorldMatrix(true, false)
      m4.multiplyMatrices(inv, mv.mesh.matrixWorld)
      const stride = Math.max(1, Math.floor(pos.count / ROUND_SAMPLES))
      for (let i = 0; i < pos.count; i += stride) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m4)
        points.push([p.x - cx, p.y - cy, p.z - cz])
      }
    }
    if (points.length < 12) return null
    // what is drawn reaches this far each way: a chip smaller than the least box a piece gets (`MIN_PIECE_HALF`) sits well inside its box, and inside the circle of it
    // too, square or not (a 1 x 1 cm splinter of a blast rolled like a pencil at 600 rad/s, for good)
    const drawn = new Float64Array(3)
    for (const q of points) for (let k = 0; k < 3; k++) drawn[k] = Math.max(drawn[k], Math.abs(q[k]))
    const fits = (axis: 0 | 1 | 2): number | null => {
      const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
      // the two other sides alike, and no point out past the circle they draw, both as drawn
      if (Math.abs(half[i] - half[j]) > ROUND_SIDES * Math.max(half[i], half[j])) return null
      if (Math.abs(drawn[i] - drawn[j]) > ROUND_SIDES * Math.max(drawn[i], drawn[j])) return null
      const reach = (drawn[i] + drawn[j]) / 2
      for (const q of points) if (Math.hypot(q[i], q[j]) > reach * ROUND_SLACK) return null
      return (half[i] + half[j]) / 2
    }
    const radii = ([0, 1, 2] as const).map(fits)
    if (radii.every((r) => r !== null)) {
      const radius = (half[0] + half[1] + half[2]) / 3
      if (this.drawnShareOf(b, body, (q) => Math.hypot(q[0], q[1], q[2]) <= radius) < ROUND_FILL) return null
      return { kind: 'sphere', axis: 1, radius, inertia: body.inertiaGiven ?? this.inertiaOf(b, body, 'sphere', 1, radius) }
    }
    const axis = ([0, 1, 2] as const).find((k) => radii[k] !== null)
    if (axis === undefined) return null
    const radius = radii[axis] ?? 0
    const profile = profileOf(points, axis, half[axis], radius)
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
    if (this.drawnShareOf(b, body, (q) => Math.abs(q[axis]) <= half[axis] && Math.hypot(q[i], q[j]) <= hullRadiusAt(profile, radius, q[axis])) < ROUND_FILL) return null
    return { kind: 'cylinder', axis, radius, inertia: body.inertiaGiven ?? this.inertiaOf(b, body, 'cylinder', axis, radius), profile }
  }

  /** The vertices of a mesh about the centre of its box (`lb`, its own space), scaled as it is drawn: the points of the hull the engine holds it by (`PartBox.hull`). */
  private hullOf(mv: MeshVis, lb: THREE_NS.Box3, scale: THREE_NS.Vector3): number[] {
    const own: number[] = []
    this.visuals.rangePoints(mv, new this.THREE.Matrix4(), own)
    const c = lb.getCenter(new this.THREE.Vector3())
    const out: number[] = []
    for (let i = 0; i < own.length; i += 3) out.push((own[i]! - c.x) * Math.abs(scale.x), (own[i + 1]! - c.y) * Math.abs(scale.y), (own[i + 2]! - c.z) * Math.abs(scale.z))
    return out
  }

  /**
   * The share of a round body the engine would hold (`inside`: a point from the piece's centre of mass) that is drawn: a grid of points through its box (`FILL_GRID`), those
   * inside the body, and of them those inside a primitive of the piece (`insideDrawn`). Primitives that overlap count once (a lamp's glow over its shade).
   */
  private drawnShareOf(b: Bound, body: PieceBody, inside: (q: Vec3) => boolean): number {
    const inv = specFrameInverse(this.THREE, b.root)
    const meshes = this.meshesOf(b).filter((mv) => this.visuals.shown(mv) && !mv.host).map((mv) => {
      mv.mesh.updateWorldMatrix(true, false)
      return { mesh: mv.mesh, built: builtSolidsOf(mv.mesh), back: new this.THREE.Matrix4().multiplyMatrices(inv, mv.mesh.matrixWorld).invert() }
    })
    const [cx, cy, cz] = body.localCenter
    const half = body.halfExtents
    const p = new this.THREE.Vector3()
    let shape = 0
    let drawn = 0
    for (let a = 0; a < FILL_GRID; a++) for (let c = 0; c < FILL_GRID; c++) for (let d = 0; d < FILL_GRID; d++) {
      const q: Vec3 = [half[0] * (((a + 0.5) / FILL_GRID) * 2 - 1), half[1] * (((c + 0.5) / FILL_GRID) * 2 - 1), half[2] * (((d + 0.5) / FILL_GRID) * 2 - 1)]
      if (!inside(q)) continue
      shape++
      for (const m of meshes) {
        p.set(q[0] + cx, q[1] + cy, q[2] + cz).applyMatrix4(m.back)
        if (insideDrawn(m.mesh, m.built, p.x, p.y, p.z)) {
          drawn++
          break
        }
      }
    }
    return shape === 0 ? 1 : drawn / shape
  }

  pieces(): Piece[] {
    return [...this.pieceSys.list]
  }

  piece(objectId: string): Piece | null {
    return this.pieceSys.get(objectId)
  }

  impulse(objectId: string, impulse: Vec3, point?: Vec3): void {
    const p = this.pieceSys.get(objectId)
    if (p) this.pieceSys.impulse(p, impulse, point)
  }

  /**
   * What a piece moving from `from` to `to` runs into: the core of its box (its thinnest half each way, at most `SWEEP_CORE`) swept through the world, the piece itself left out,
   * so a crate thrown by a blast stops at the wall instead of passing through it. Null for a world that cannot sweep.
   */
  private sweepPiece(p: PieceBody, from: Vec3, to: Vec3): PieceSweepHit | null {
    if (typeof this.world.sweepBox !== 'function') return null
    const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
    const travel = Math.hypot(d[0], d[1], d[2])
    if (travel < 1e-4) return null
    const core = Math.min(SWEEP_CORE, ...p.halfExtents)
    const box = { min: [from[0] - core, from[1] - core, from[2] - core] as Vec3, max: [from[0] + core, from[1] + core, from[2] + core] as Vec3 }
    const hit = this.world.sweepBox(box, d, travel, { ignore: p.objectId, spacing: Math.max(0.05, core) })
    if (!hit) return null
    // a round piece and another piece meet by their shapes and trade momentum (`PieceSystem.knock`), not as a piece against a wall
    const other = this.pieceSys.get(hit.object)
    if (other && (p.round || other.round)) return null
    // the top it lies on is what it slides on (a table top gone over): the sweep would take it for a wall at every step and hold it there
    if (other && this.pieceSys.slidesOn(p, other)) return null
    const material = this.world.part(hit.object, hit.part)?.material
    const restitution = material === undefined ? undefined : surfaceOf(material, this.world.materials.get(material))?.restitution
    return { object: hit.object, part: hit.part, distance: hit.distance, point: hit.point, normal: hit.normal, ...(restitution === undefined ? {} : { restitution }) }
  }

  /** A piece thrown into a wall: the wall takes the blow of its weight where it met it, the piece takes it too, and each sounds as its material does. */
  private slam(p: PieceBody, hit: PieceSweepHit, speed: number): void {
    const energy = 0.5 * p.mass * speed * speed
    const direction: Vec3 = [-hit.normal[0], -hit.normal[1], -hit.normal[2]]
    this.landingSound(hit.object, hit.point, clamp(speed / 10, 0.2, 1))
    this.syncBound(p.objectId)
    try {
      this.world.hitPart(hit.object, hit.part, { type: 'blunt', point: hit.point, energy, radius: 0.1, direction, normal: hit.normal, source: p.objectId })
      this.world.hit(p.objectId, { type: 'blunt', point: hit.point, energy, radius: 0.08, direction: hit.normal, source: 'slam' })
    } catch {
      // either may have left the world
    }
  }

  private hardLanding(p: PieceBody, point: Vec3, speed: number): void {
    this.landingSound(p.objectId, point, clamp(speed / 10, 0.2, 1))
    // the piece just moved this frame: the world must know where it is before the hit is resolved against its parts
    this.syncBound(p.objectId)
    try {
      this.world.hit(p.objectId, { type: 'blunt', point, energy: 0.5 * p.mass * speed * speed, radius: 0.08, direction: [0, -1, 0], source: 'fall' })
    } catch {
      // the object may have been removed from the world
    }
  }

  /** The impact of the heaviest part of an object (a piece landing): its material and the blunt blow of the fall. */
  private landingSound(objectId: string, point: Vec3, volume: number): void {
    const st = this.world.state(objectId)
    let best = ''
    let mass = -1
    for (const p of st?.parts ?? []) {
      if (p.mass > mass) {
        mass = p.mass
        best = p.material
      }
    }
    this.impactSound(best, point, volume, 'blunt')
  }

  /** The impact on a material by a blow: the legacy family key (`impactKey`) with the more specific keys to try first (`impactSoundKeys`). */
  private impactSound(material: string, point: Vec3, volume: number, blow?: DamageType): void {
    const def = this.world.materials.get(material)
    this.sound(impactKey(def), point, volume, impactSoundKeys(material, def, blow))
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Update
  // ----------------------------------------------------------------------------------------------------------------------------------

  restoreStepPose(): void {
    this.pieceSys.restoreStepPose()
    this.fragments.restoreStepPose()
  }

  present(alpha: number): void {
    if (this.disposed) return
    this.pieceSys.presentPose(alpha)
    this.fragments.presentPose(alpha)
  }

  update(dt: number): void {
    if (this.disposed) return
    this.restoreStepPose()
    dt = clamp(dt, 0, 0.1)
    this.time += dt
    this.work?.beginFrame()
    if (!this.attached) this.drainQueue()
    this.checkBroken()
    this.checkUndermined()
    for (const b of this.bounds.values()) b.onFrame?.(dt)
    // a settling object keeps moving between its (throttled) `settle` events
    for (const b of this.bounds.values()) if (b.soilNode && this.world.state(b.id)?.soil?.status === 'yielding') this.onSettle(b.id)
    this.settlement.update(dt)
    this.cost = this.sampleCost()
    this.advanceWakes(dt)
    this.thawWoken()
    this.pieceSys.update(dt)
    this.measureCost()
    this.updateFading(dt)
    this.fragments.update(dt)
    // what goes on at a part (fire, leaks, trickling grit) reads where the part is after the bodies moved this frame, not a frame behind
    this.updateActive(dt)
    this.updateLeaks(dt)
    this.updateTrickles(dt)
    this.ground.update(dt)
    this.ownVfx?.update(dt)
    this.syncTransforms()
    this.settledBatches.update(dt, () => this.restingDebris())
  }

  /** An event of the object (a blow, fire, char): its meshes leave the batches before it is drawn (`SettledBatches.release`). */
  private releaseBatched(objectId: string): void {
    if (!this.settledBatches.hasMembers()) return
    const b = this.bounds.get(objectId)
    if (b) this.settledBatches.release(this.meshesOf(b).map((mv) => mv.mesh))
  }

  /**
   * The meshes of the debris at rest: the fragments asleep (without marks on them) and the meshes of their own of the pieces asleep, but for an object with a part burning,
   * hot or still charring (`active`): its colours change in place.
   */
  private restingDebris(): Mesh[] {
    const meshes = new Set(this.fragments.restingMeshes())
    const changing = new Set<string>()
    for (const a of this.active.values()) changing.add(a.object)
    for (const piece of this.pieceSys.list) {
      const b = piece.sleeping && !piece.held && !changing.has(piece.objectId) ? this.bounds.get(piece.objectId) : undefined
      if (!b) continue
      // a part drawn by a range of a mesh it shares with others (a house) is left in that mesh
      for (const mv of this.meshesOf(b)) if ((!mv.host || mv.loose) && !mv.hidden && this.visuals.shown(mv)) meshes.add(mv.mesh)
    }
    return [...meshes]
  }

  settledBatchStats(): SettledBatchStats {
    return this.settledBatches.stats()
  }

  deferredQueue(): DeferredQueue {
    return this.eventQueue
  }

  /** Every queue of the renderer with the options a frame budget registers it with: the blow's own effect drains whole (`mustDrain`), the rest obeys the deadline. */
  deferredQueues(): readonly DeferredQueueRegistration[] {
    return [
      { queue: this.eventQueue, options: { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS], mustDrain: true } },
      { queue: this.prefitQueue, options: DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT] },
      { queue: this.settledBatches.queue, options: DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.SETTLED_BATCH] },
    ]
  }

  /** The host applies the structural events itself at the end of each tick (`applyStructuralEvents`) from now on, or no longer; not under `workBudget`, whose events are paced by the frame. */
  setStructuralInTick(isInTick: boolean): void {
    // pending: under `workBudget` the mode stays off, so the events there still read the drawn pose (spec 017, evidence-120hz T2.2)
    this.structuralInTick = isInTick && !this.work
  }

  /**
   * At the end of a tick, on the step pose: applies the structural events that wait, with every visual event before the last of them, in the order of emission (a visual event of
   * an object with a structural one goes before it). What follows the last structural event is the frame's.
   */
  applyStructuralEvents(): void {
    if (this.disposed || this.work || this.areEventsHeld) return
    this.stalledFrames = 0
    // a spread blast whose slices are not all applied yet goes first, whole: the tick never runs past events of an earlier blast
    if (this.heldStructural) this.applyHeldStructural(Infinity)
    let last = -1
    for (let i = this.queue.length - 1; i >= 0 && last < 0; i--) if (isStructuralEvent(this.queue[i]!)) last = i
    if (last < 0) return
    const ordered = this.eventOrder.arrange(this.queue.splice(0, this.queue.length))
    let end = ordered.length
    while (end > 0 && !isStructuralEvent(ordered[end - 1]!)) end--
    this.requeue(ordered, end)
    this.visuals.batchRebuilds(() => {
      for (let i = 0; i < end; i++) {
        try {
          this.apply(ordered[i]!)
        } catch (err) {
          if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', ordered[i]!.type, err)
        }
      }
    })
  }

  /** Holds every event of the queue (no drain applies any, no stall is counted) while the host runs a blast in slices, or lets them go. */
  holdEvents(isHeld: boolean): void {
    this.areEventsHeld = isHeld
    this.stalledFrames = 0
  }

  /**
   * `applyStructuralEvents` spread over frames: the first call arranges the waiting events once, exactly as the whole call does, and keeps those up to the last structural
   * one; each call applies the next of them in order until their weights (`EVENT_APPLY_WEIGHT`) reach `units` (at least one event). The same events in the same order as
   * the whole call, so the same world. What followed the last structural event goes back to the queue once they are all applied. Returns the events still held.
   */
  applyStructuralEventsSliced(units: number): number {
    if (this.disposed || this.work) return 0
    this.stalledFrames = 0
    if (!this.heldStructural) {
      let last = -1
      for (let i = this.queue.length - 1; i >= 0 && last < 0; i--) if (isStructuralEvent(this.queue[i]!)) last = i
      if (last < 0) return 0
      const ordered = this.eventOrder.arrange(this.queue.splice(0, this.queue.length))
      let end = ordered.length
      while (end > 0 && !isStructuralEvent(ordered[end - 1]!)) end--
      this.heldStructural = { events: ordered.slice(0, end), tail: ordered.slice(end), next: 0 }
    }
    this.applyHeldStructural(units)
    return this.structuralBacklog()
  }

  /** Structural events of a spread blast not applied yet (`applyStructuralEventsSliced`). */
  structuralBacklog(): number {
    return this.heldStructural ? this.heldStructural.events.length - this.heldStructural.next : 0
  }

  private applyHeldStructural(units: number): void {
    const held = this.heldStructural
    if (!held) return
    let spent = 0
    let stop = held.next
    while (stop < held.events.length && (stop === held.next || spent + eventApplyWeight(held.events[stop]!) <= units)) spent += eventApplyWeight(held.events[stop++]!)
    this.visuals.batchRebuilds(() => {
      for (let i = held.next; i < stop; i++) {
        try {
          this.apply(held.events[i]!)
        } catch (err) {
          if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', held.events[i]!.type, err)
        }
      }
    })
    held.next = stop
    if (held.next < held.events.length) return
    this.heldStructural = undefined
    this.requeue(held.tail, 0)
  }

  /** Puts `events` from `from` on, back at the front of the queue, in order (no spread: a blast leaves tens of thousands). */
  private requeue(events: readonly DestructionEvent[], from: number): void {
    if (from >= events.length) return
    this.queue = events.slice(from).concat(this.queue)
  }

  /** Counts the frames (once each) a structural event has waited with no tick to apply it; always 0, for `pending`'s sum. */
  private watchStall(frame: number | undefined): number {
    if (!this.structuralInTick || frame === undefined || frame === this.watchedFrame) return 0
    // a held blast is not stalled: the host applies it in slices and lets the ticks go when it is done
    if (this.areEventsHeld || this.heldStructural) {
      this.stalledFrames = 0
      return 0
    }
    this.watchedFrame = frame
    this.stalledFrames = this.queue.some(isStructuralEvent) ? this.stalledFrames + 1 : 0
    return 0
  }

  /** How many events a drain may apply now: all, or (the host applies the structural ones in the tick) only those ahead of the first structural one. */
  private appliableEvents(all = false): number {
    if (this.areEventsHeld && !all) return 0
    if (all || !this.structuralInTick || this.stalledFrames >= STALLED_FRAMES) return this.queue.length
    let count = 0
    while (count < this.queue.length && !isStructuralEvent(this.queue[count]!)) count++
    return count
  }

  private drainQueue(): void {
    drainDetached(this.eventQueue, this.eventBudgetMs)
  }

  /** Applies the waiting events in order until the deadline, after the slices earlier events left; always at least one unit when something waits. Returns the units run. */
  private runBudgeted(deadline: number, clock: () => number, all = false): number {
    if (this.work) return this.runWork(this.work, all)
    // events produced while applying (a hard landing calls `hit`) wait for the next frame
    const batch = this.eventOrder.arrange(this.queue.splice(0, this.appliableEvents(all)))
    if (this.stalledFrames >= STALLED_FRAMES) this.stalledFrames = 0
    const outerClock = this.drainClock
    this.drainClock = clock
    this.sliceDeadline = deadline
    let ran = 0
    try {
      ran = this.runSlices(deadline)
      let isOutOfTime = false
      this.visuals.batchRebuilds(() => {
        for (let i = 0; i < batch.length; i++) {
          if ((i > 0 || (ran > 0 && this.attached)) && clock() >= deadline) {
            this.requeue(batch, i)
            isOutOfTime = true
            return
          }
          try {
            this.apply(batch[i]!)
          } catch (err) {
            if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', batch[i]!.type, err)
          }
          ran++
        }
      })
      if (isOutOfTime) return ran
      // after the events, as under the budget: a group a blow of this frame looses keeps the split it gets in the event
      ran += this.splitChecked(deadline, ran)
      if (this.queue.length === 0 && this.slices.length === 0 && this.looseToCheck.size === 0) ran += this.runPrefitDetached(deadline, clock, ran === 0)
    } finally {
      this.sliceDeadline = Infinity
      this.drainClock = outerClock
    }
    return ran
  }

  /**
   * One frame under `workBudget`: the work earlier frames left (fragments, then the loose groups whose turn it is), then every waiting event (its effects show in the frame
   * it happened; it only leaves less of the budget; the groups it looses split in it while they fit, `splitWithin`). No clock is read. `all` runs everything (a flush).
   */
  private runWork(work: WorkBudget, all: boolean): number {
    const batch = this.eventOrder.arrange(this.queue.splice(0, this.queue.length))
    this.workFocus = this.o.focus?.()
    const outerDeadline = this.sliceDeadline
    // a finite deadline only says "in a drain": under the budget the work stops on units, never on the clock
    this.sliceDeadline = all ? Infinity : 0
    let ran = 0
    try {
      // the work earlier frames left goes first, as without the budget: the fragments, then the loose groups whose turn it is
      ran += this.runSlices(Infinity)
      ran += this.runSplits(work, all)
      for (const ev of batch) {
        work.take('event', this.workCosts.perEvent)
        try {
          this.apply(ev)
        } catch (err) {
          if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', ev.type, err)
        }
        ran++
      }
      // after the events, so a group a blow of this frame looses keeps the split it gets in the event
      this.queueChecked()
      if (all) ran += this.runSlices(Infinity) + this.runSplits(work, all)
      // the fits ahead take only what the frame left, after everything else (as without the budget)
      if (this.queue.length === 0 && this.slices.length === 0 && this.splitQueue.size === 0 && !all) ran += this.runPrefitWork(work)
    } finally {
      this.sliceDeadline = outerDeadline
    }
    return ran
  }

  /** Runs the work left by earlier frames until the deadline (under `workBudget`, while units are left); at least one piece per frame, so it always finishes. */
  private runSlices(deadline: number): number {
    let ran = 0
    for (; this.slices.length > 0 && (ran === 0 || (this.work ? this.work.remaining > 0 || this.sliceDeadline === Infinity : this.drainClock() < deadline)); ran++) {
      try {
        const slice = this.slices.shift()!
        if (typeof slice === 'function') slice()
        else this.spawnFragments(slice.ev, slice.from, slice.look)
      } catch (err) {
        if (typeof console !== 'undefined') console.error('game-destruction-three: failed to run deferred work', err)
      }
    }
    return ran
  }

  /**
   * The ground under an object settled or tilted: its parts are drawn under a node with the soil's offset (`ObjectState.soil.offset`), so the host's
   * root keeps the pose the host gave and the world keeps getting it from `syncTransform`.
   */
  private onSettle(objectId: string): void {
    const b = this.bounds.get(objectId)
    const soil = this.world.state(objectId)?.soil
    if (!b || !soil) return
    let node = b.soilNode
    if (!node) {
      node = new this.THREE.Group()
      node.name = 'destruction-soil'
      for (const c of [...b.root.children]) node.add(c)
      b.root.add(node)
      b.soilNode = node
    }
    const { position: p, rotation: q } = soil.offset
    node.position.set(p[0], p[1], p[2])
    node.quaternion.set(q[0], q[1], q[2], q[3])
    node.updateMatrixWorld(true)
  }

  /** The ground went down under some parts of an object: each part with a settlement (`PartState.settlement`) starts going down to it. */
  private onSubside(objectId: string): void {
    const b = this.bounds.get(objectId)
    const state = this.world.state(objectId)
    if (!b || !state) return
    const parts: Array<readonly [PartVis, PartSettlement | undefined]> = []
    for (const ps of state.parts) {
      const pv = b.parts.get(ps.id)
      if (pv && ps.settlement) parts.push([pv, ps.settlement])
    }
    this.settlement.follow(b.soilNode ?? b.root, parts)
  }

  /**
   * The roots the world is told about: a piece asleep is not read (its root stops recomputing its matrix) until it wakes or a host calls
   * `markMoved`; every other root is read, and only decomposed when its world matrix changed.
   */
  private syncTransforms(): void {
    for (const b of this.bounds.values()) {
      // a held piece is moved by its host (push, carry) even while the engine still has it asleep
      if (b.piece?.sleeping && !b.piece.held && !b.moved) {
        if (!b.frozen) this.freezeRoot(b)
        continue
      }
      if (b.frozen) this.thawRoot(b)
      b.moved = false
      this.syncOne(b)
    }
  }

  private freezeRoot(b: Bound): void {
    this.syncOne(b)
    b.root.updateMatrix()
    b.root.matrixAutoUpdate = false
    b.frozen = true
  }

  private thawRoot(b: Bound): void {
    b.root.matrixAutoUpdate = true
    b.frozen = false
    b.root.updateMatrixWorld(true)
  }

  /** A piece woken before the step (a blow, the host) has its matrix back before the engine writes its pose to the root. */
  private thawWoken(): void {
    for (const b of this.bounds.values()) if (b.frozen && !b.piece?.sleeping) this.thawRoot(b)
  }

  /** The host moved the root of an object by hand (a teleport): its transform goes to the world on the next `update`, even if it is a piece asleep. */
  markMoved(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b) return
    b.moved = true
    if (b.frozen) this.thawRoot(b)
  }

  /** Push the current transform of one bound object to the world right now (used before a landing hit). */
  private syncBound(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (b) this.syncOne(b)
  }

  private syncOne(b: Bound): void {
    if (!b.sync) return
    const p = this.v1
    const q = this.tmpQ
    b.root.updateWorldMatrix(true, false)
    const elements = b.root.matrixWorld.elements
    const world = b.lastWorld
    if (world) {
      let same = true
      for (let i = 0; i < 16; i++) {
        if (world[i] === elements[i]) continue
        same = false
        world[i] = elements[i] as number
      }
      if (same && b.lastPos) return
    } else {
      b.lastWorld = Float64Array.from(elements)
    }
    b.root.matrixWorld.decompose(p, q, this.v2)
    const last = b.lastPos
    const lq = b.lastQuat
    const moved = !last || !lq || Math.abs(p.x - last[0]) + Math.abs(p.y - last[1]) + Math.abs(p.z - last[2]) > 1e-5 || Math.abs(q.x - lq[0]) + Math.abs(q.y - lq[1]) + Math.abs(q.z - lq[2]) + Math.abs(q.w - lq[3]) > 1e-6
    if (!moved) return
    if (last && lq) {
      last[0] = p.x
      last[1] = p.y
      last[2] = p.z
      lq[0] = q.x
      lq[1] = q.y
      lq[2] = q.z
      lq[3] = q.w
    } else {
      b.lastPos = [p.x, p.y, p.z]
      b.lastQuat = [q.x, q.y, q.z, q.w]
    }
    if (this.world.has(b.id)) this.world.setTransform(b.id, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w])
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Events
  // ----------------------------------------------------------------------------------------------------------------------------------

  /**
   * The highest top of a bound object that is not a piece under (x, z) a corner at height `y` can land on (at most `step` above it). The world boxes
   * of their drawn meshes are kept until an event or a moved root changes them; parts drawn inside a merged mesh and meshes wider than `STATIC_SPAN`
   * are left out (walls, floors, roofs: the terrain under them is the host's `groundAt`).
   */
  private staticTopAt(x: number, z: number, y: number, step: number): number {
    let top = -Infinity
    for (const a of this.staticNow().values()) {
      // the first six numbers are the box around all of the object's boxes
      if (a.length === 0 || x < a[0] || x > a[3] || z < a[2] || z > a[5]) continue
      for (let i = 6; i < a.length; i += 6) {
        if (x < a[i] || x > a[i + 3] || z < a[i + 2] || z > a[i + 5]) continue
        const t = a[i + 4]
        if (t > top && t <= y + step) top = t
      }
    }
    return top
  }

  /**
   * The fixed objects as their drawn boxes turned as drawn (the local box of each mesh in its world matrix), for an engine: one list per object, the same list until
   * `staticNow` measures that object again. The same meshes `staticNow` keeps: no merged host, no loose part, nothing hidden, nothing wider than `STATIC_SPAN`.
   */
  private staticSolids(): Map<string, readonly StaticSolid[]> {
    const now = this.staticNow()
    for (const id of this.solidCache.keys()) if (!now.has(id)) this.solidCache.delete(id)
    // asked every update: the map and the scratch are kept, the lists are the cached ones
    const out = this.solidsOut
    out.clear()
    const budget: MeasureBudget = { left: VERTICES_PER_UPDATE, incomplete: false, updated: this.measuredMeshes, workers: this.o.workers ?? null }
    try {
      this.measureEach(now, budget, out)
      this.unsureSolids.clear()
      for (const id of out.keys()) {
        if (this.solidStale.has(id) || this.solidCache.get(id)?.leftOut) this.unsureSolids.add(id)
      }
    } finally {
      // holds no mesh past the call (a mesh that leaves the scene is not kept here)
      this.measuredMeshes.clear()
    }
    for (const [id, source] of this.hostSolids) out.set(id, this.hostSolidsOf(id, source()))
    return out
  }

  setHostSolids(id: string, source: (() => readonly HostSolid[]) | null): void {
    if (source) this.hostSolids.set(id, source)
    else {
      this.hostSolids.delete(id)
      this.hostSolidLists.delete(id)
    }
  }

  /** The module's boxes as static solids: measured again to the same numbers, the list is the one held (an engine finds it unchanged by identity). */
  private hostSolidsOf(id: string, given: readonly HostSolid[]): StaticSolid[] {
    const kept = this.hostSolidLists.get(id)
    // the very boxes given again (a module keeps what it measured): nothing is made
    if (kept && kept.given.length === given.length && given.every((s, i) => s === kept.given[i])) return kept.solids
    const next = given.map((s, i): StaticSolid => ({ center: [s.center[0], s.center[1], s.center[2]], half: [s.half[0], s.half[1], s.half[2]], rotation: s.rotation ? [s.rotation[0], s.rotation[1], s.rotation[2], s.rotation[3]] : [0, 0, 0, 1], key: s.key ?? String(i) }))
    if (kept && sameSolids(kept.solids, next)) {
      this.hostSolidLists.set(id, { given, solids: kept.solids })
      return kept.solids
    }
    this.hostSolidLists.set(id, { given, solids: next })
    return next
  }

  /** `staticSolids` for each fixed object of `now`, into `out`. */
  private measureEach(now: ReadonlyMap<string, unknown>, budget: MeasureBudget, out: Map<string, readonly StaticSolid[]>): void {
    for (const id of now.keys()) {
      // a body drawn by a module of its own (a vehicle: no mesh of it is bound here) is the boxes of its parts still on it, as the world holds them
      const hosted = this.drawsNothingHere(id) ? this.world.hostedSolids?.(id) : null
      if (hosted) {
        // pieces the body's own module measured on what it draws (a part id as key) are the drawn shape already: only the damage-zone boxes are cut to it
        out.set(id, hosted.length > 0 && hosted.every((solid) => solid.key !== undefined) ? hosted : this.clipToDrawn(id, hosted))
        continue
      }
      const cached = this.solidCache.get(id)
      if (cached && !this.solidStale.has(id)) {
        out.set(id, cached.solids)
        continue
      }
      this.solidStale.delete(id)
      budget.incomplete = false
      const solids = this.measureSolids(id, budget)
      // some parts wait for the next update: this object is measured again then, the parts done are kept
      if (budget.incomplete) this.solidStale.add(id)
      // measured again often to the same numbers: the same boxes keep the same list (an engine rebuilds what changed)
      const leftOut = this.hasUnlistedPart(id)
      if (cached && sameSolids(cached.solids, solids)) {
        cached.leftOut = leftOut
        out.set(id, cached.solids)
        continue
      }
      this.solidCache.set(id, { solids, leftOut })
      out.set(id, solids)
    }
  }

  /** Whether a part the world still lets a ray hit is not in the object's list: a loose or hidden mesh (a lost part is no hit either). */
  private hasUnlistedPart(id: string): boolean {
    const b = this.bounds.get(id)
    if (!b) return false
    for (const pv of b.parts.values()) {
      if (pv.gone !== 'none') continue
      if (pv.meshes.some((mv) => mv.loose || !this.visuals.shown(mv))) return true
    }
    return false
  }

  /**
   * Every fixed thing the object draws as what it collides as (`drawnSolidsOf`): a box where one fits the part, the triangles where not, a part of a merged mesh by its own
   * vertices, a mesh of any width. What is hidden, broken or loose is not drawn, so it is not here.
   */
  private measureSolids(id: string, budget: MeasureBudget): StaticSolid[] {
    const solids: StaticSolid[] = []
    const b = this.bounds.get(id)
    if (!b) return solids
    for (const pv of b.parts.values()) {
      if (pv.gone !== 'none') continue
      const material = this.world.part(id, pv.id)?.material ?? pv.material
      const surface = material ? surfaceOf(material, this.world.materials.get(material)) : undefined
      pv.meshes.forEach((mv, k) => {
        if (mv.loose || !this.visuals.shown(mv)) return
        for (const solid of drawnSolidsOf(this.THREE, this.visuals, mv, `${pv.id}:${k}`, budget)) solids.push(surface ? this.withSurface(solid, surface) : solid)
      })
    }
    return solids
  }

  /**
   * The solid with the friction of its surface: the same object as last time for the same solid and the same numbers, so the lists after a re-measure hold the very objects the engine
   * holds and compare by identity (`sameSolids`, `EngineStatics.fit`), not number by number through every vertex of a mesh.
   */
  private withSurface(solid: StaticSolid, surface: { readonly static: number; readonly dynamic: number; readonly rolling?: number; readonly rollingDamping?: number }): StaticSolid {
    const rolling = surface.rolling ?? 0
    const rollingDamping = surface.rollingDamping ?? 0
    const kept = this.surfaced.get(solid)
    if (kept?.friction && kept.friction.static === surface.static && kept.friction.dynamic === surface.dynamic && kept.friction.rolling === rolling && kept.friction.rollingDamping === rollingDamping) return kept
    const made: StaticSolid = { ...solid, friction: { static: surface.static, dynamic: surface.dynamic, rolling, rollingDamping } }
    this.surfaced.set(solid, made)
    return made
  }

  /** The boxes of the fixed objects (per object: the box around them all, then each one), each object measured again when an event touched it (all of them every `STATIC_REFRESH` s). */
  private staticNow(): Map<string, number[]> {
    if (this.time - this.staticAt > STATIC_REFRESH) {
      this.staticAt = this.time
      if (this.staticRound.length === 0) this.staticRound = [...this.bounds.keys()].reverse()
    }
    if (!this.staticAll && this.staticDirty.size === 0 && this.staticRound.length === 0) return this.staticBoxes
    const box = new this.THREE.Box3()
    const measure = (b: Bound, force: boolean): void => {
      if (b.piece || this.pieceSys.get(b.id)) {
        this.staticBoxes.delete(b.id)
        this.solidStale.delete(b.id)
        this.rootMatrices.delete(b.id)
        return
      }
      const out: number[] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
      for (const mv of this.meshesOf(b)) {
        if (mv.host || mv.loose || !this.visuals.shown(mv)) continue
        this.visuals.worldBox(mv, box)
        if (box.isEmpty() || box.max.x - box.min.x > STATIC_SPAN || box.max.z - box.min.z > STATIC_SPAN) continue
        this.visuals.fittedBoxes(mv, out)
        for (let k = 0; k < 3; k++) {
          out[k] = Math.min(out[k], box.min.getComponent(k))
          out[k + 3] = Math.max(out[k + 3], box.max.getComponent(k))
        }
      }
      const next = out.length > 6 ? out : []
      const was = this.staticBoxes.get(b.id)
      b.root.updateWorldMatrix(true, false)
      const matrix = b.root.matrixWorld.elements
      const placed = this.rootMatrices.get(b.id)
      if (force || !was || was.length !== next.length || next.some((v, k) => Math.abs(v - was[k]) > 1e-6) || !placed || matrix.some((v, k) => v !== placed[k])) this.solidStale.add(b.id)
      this.rootMatrices.set(b.id, [...matrix])
      this.staticBoxes.set(b.id, next)
    }
    const measureId = (id: string, force: boolean): void => {
      const b = this.bounds.get(id)
      if (b) measure(b, force)
      else {
        this.staticBoxes.delete(id)
        this.solidStale.delete(id)
        this.rootMatrices.delete(id)
      }
    }
    if (this.staticAll) {
      this.staticBoxes.clear()
      for (const b of this.bounds.values()) measure(b, true)
      this.staticRound = []
    } else {
      for (const id of this.staticDirty) measureId(id, true)
      for (let taken = 0; taken < STATIC_REFRESH_PER_UPDATE && this.staticRound.length > 0; taken++) measureId(this.staticRound.pop() as string, false)
    }
    this.staticAll = false
    this.staticDirty.clear()
    return this.staticBoxes
  }

  /** The boxes of a piece's drawn meshes, measured once per frame. */
  private pieceBoxesOf(pc: PieceBody): number[] {
    const cached = this.pieceBoxes.get(pc)
    if (cached && cached.at === this.time) return cached.boxes
    const boxes: number[] = []
    const b = this.bounds.get(pc.objectId)
    if (b) {
      for (const mv of this.meshesOf(b)) {
        if (this.visuals.shown(mv)) this.visuals.fittedBoxes(mv, boxes)
      }
    }
    this.pieceBoxes.set(pc, { at: this.time, boxes })
    return boxes
  }

  solidsNear(x: number, z: number, radius: number): SolidBox[] {
    const found: SolidBox[] = []
    const scan = (a: number[], id: string, piece: Piece | null, from: number): void => {
      if (from > 0 && (a.length === 0 || x < a[0] - radius || x > a[3] + radius || z < a[2] - radius || z > a[5] + radius)) return
      for (let i = from; i < a.length; i += 6) {
        if (x < a[i] - radius || x > a[i + 3] + radius || z < a[i + 2] - radius || z > a[i + 5] + radius) continue
        found.push({ objectId: id, min: [a[i], a[i + 1], a[i + 2]], max: [a[i + 3], a[i + 4], a[i + 5]], piece })
      }
    }
    for (const [id, a] of this.staticNow()) scan(a, id, null, 6)
    const c = this.v1
    for (const pc of this.pieceSys.list) {
      if (pc.held) continue
      // only the pieces whose box can reach the point are measured
      this.pieceSys.centerOf(pc, c)
      const reach = Math.hypot(pc.halfExtents[0], pc.halfExtents[1], pc.halfExtents[2]) + radius
      if (Math.abs(c.x - x) > reach || Math.abs(c.z - z) > reach) continue
      scan(this.pieceBoxesOf(pc), pc.objectId, pc, 0)
    }
    this.fragments.solidsNear(x, z, radius, (home, min, max, loose) => found.push({ objectId: home, min, max, piece: null, loose }))
    return found
  }

  private apply(ev: DestructionEvent): void {
    const outer = this.emitting
    // an event of no object (a blast set off in the air) makes effects of no one
    this.emitting = ev.object || undefined
    try {
      this.applyEvent(ev)
    } finally {
      this.emitting = outer
    }
  }

  private applyEvent(ev: DestructionEvent): void {
    this.staticDirty.add(ev.object)
    this.releaseBatched(ev.object)
    this.hitPoints.note(ev, this.time)
    if (ev.type === 'fracture' || ev.type === 'detach' || ev.type === 'collapse' || ev.type === 'burnout' || ev.type === 'destroyed') this.broken.add(ev.object)
    switch (ev.type) {
      case 'damage':
        if (ev.damageType === 'heat' || ev.damageType === 'fire' || ev.damageType === 'explosive') this.activate(ev.object, ev.part)
        break
      case 'dent':
        this.onDent(ev)
        break
      case 'bend':
        this.onBend(ev)
        break
      case 'hole':
        this.onHole(ev)
        break
      case 'crack':
        this.onCrack(ev)
        break
      case 'ricochet': {
        const d = ev.direction
        this.vfx.burst('sparks', ev.point, d, 4 + Math.min(10, ev.energy / 150), 4)
        // the whine of a round off steel, the short crack off stone: by what the part it glanced off is made of
        const glanced = this.partVis(ev.object, ev.part)?.material ?? ''
        this.sound('ricochet', ev.point, 0.7, ricochetSoundKeys(glanced, this.world.materials.get(glanced)))
        break
      }
      case 'debris':
        this.vfx.burst(ev.kind, ev.point, ev.normal, ev.count, ev.speed > 0 ? ev.speed : DEFAULT_SPEED[ev.kind] ?? 1, this.debrisOptions(ev.kind, ev.object, ev.part, ev.material))
        break
      case 'fracture': {
        const pv = this.partVis(ev.object, ev.part)
        if (pv) this.settlement.forget(pv)
        this.onFracture(ev)
        break
      }
      case 'subside':
        this.onSubside(ev.object)
        break
      case 'detach':
        this.onDetach(ev)
        break
      case 'settle':
        this.onSettle(ev.object)
        break
      case 'collapse': {
        // a storey coming down raises the cloud of the collapse effect; a piece of furniture (a shelf and its books) only a puff
        const root = this.bounds.get(ev.object)?.root
        const furniture = !!root && kitOriginOf(root)?.kind === 'furniture'
        // what was still going down goes the rest of the way before it falls on its own
        for (const part of ev.parts) {
          const pv = this.partVis(ev.object, part)
          if (pv) this.settlement.finish(pv)
        }
        this.splitLoose(ev.object)
        if (!furniture || ev.mass >= COLLAPSE_CLOUD_KG) this.playEvent({ kind: 'collapse' }, this.rootPoint(ev.object), this.partPlay(ev.object, ev.parts[0] ?? ''))
        else this.vfx.burst('dust', this.rootPoint(ev.object), [0, 1, 0], clamp(Math.round(ev.mass / 4), 4, 24), 0.8)
        break
      }
      case 'disassemble_progress': {
        const k = `unscrew:${ev.joint}`
        if (this.time - (this.throttles.get(k) ?? -1) > 0.25) {
          this.throttles.set(k, this.time)
          this.sound('unscrew', this.rootPoint(ev.object), clamp(0.3 + ev.progress * 0.5, 0, 1))
        }
        break
      }
      case 'ignite':
        this.startFire(ev)
        this.activate(ev.object, ev.part)
        this.sound('ignite', ev.point, 0.7)
        this.startBurnSound(ev.object, ev.part, ev.point, this.burning(ev.object, ev.part))
        break
      case 'primed':
        // a bullet or fire sets the part burning until its delay runs out; a blast nearby only waits for the explosion
        if (ev.trigger !== 'explosion') {
          this.vfx.fire({ point: ev.point, radius: PRIMED_FIRE_RADIUS, life: ev.delay })
          this.primedBurning.add(`${ev.object}|${ev.part}`)
          this.activate(ev.object, ev.part)
          // the vessel is venting until it bursts: the gas leak for as long as the delay, and the flame it feeds
          this.sound('primed', ev.point, 0.7, { seconds: ev.delay })
          if (!this.burnSounds.has(`${ev.object}|${ev.part}`)) this.startBurnSound(ev.object, ev.part, ev.point, { fuel: 'gas' })
        }
        break
      case 'spall':
        this.onSpall(ev)
        break
      case 'stage':
        this.onStage(ev)
        break
      case 'chip':
        this.onChip(ev)
        break
      case 'expose':
        if (ev.bars.length > 0) this.cages.set(`${ev.object}|${ev.part}`, ev.bars, this.bounds.get(ev.object)?.root)
        else this.dropCage(ev.object, ev.part)
        if (ev.bars.length > 0) {
          const [a, b] = ev.bars[0] as [Vec3, Vec3]
          this.playEvent({ kind: 'expose' }, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], this.partPlay(ev.object, ev.part))
        }
        break
      case 'extinguish': {
        const f = this.fires.get(`${ev.object}|${ev.part}`)
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        if (f) {
          this.stopFire(`${ev.object}|${ev.part}`)
          this.vfx.burst('steam', f.point, [0, 1, 0], 14, 1.2)
        }
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.activate(ev.object, ev.part)
        this.sound('extinguish', f?.point ?? this.rootPoint(ev.object), 0.6)
        break
      }
      case 'burnout': {
        this.stopFire(`${ev.object}|${ev.part}`)
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.vfx.burst('ash', ev.point, [0, 1, 0], 16, 1)
        this.vfx.burst('smoke', ev.point, [0, 1, 0], 6, 0.8, { color: SMOKE_TONES.grey })
        const pv = this.partVis(ev.object, ev.part)
        if (pv) {
          const def = this.world.materials.get(pv.material)
          this.visuals.setChar(pv, 1, def?.visual?.charColor ?? 0x1a1410)
        }
        this.activate(ev.object, ev.part)
        break
      }
      case 'melt':
        this.activate(ev.object, ev.part)
        // one sizzle per melting object every 1.5 s, not one per part (a plastic bin has dozens)
        if (this.time - (this.throttles.get(`melt:${ev.object}`) ?? -9) > 1.5) {
          this.throttles.set(`melt:${ev.object}`, this.time)
          this.sound('melt_sizzle', this.rootPoint(ev.object), 0.4)
        }
        break
      case 'drip': {
        const b = this.bounds.get(ev.object)
        const pv = b?.parts.get(ev.part)
        const def = this.world.materials.get(ev.material)
        const color = (pv && this.partColor(pv, def)) ?? fallbackColor(def)
        let tag = this.homeTags.indexOf(ev.object) + 1
        if (tag === 0) tag = this.homeTags.push(ev.object)
        this.vfx.spawn('drips', ev.point, [(this.rng() - 0.5) * 0.1, -0.1, (this.rng() - 0.5) * 0.1], { color, tag, owner: this.owner })
        break
      }
      case 'leak': {
        const key = `${ev.object}|${ev.part}`
        const b = this.bounds.get(ev.object)
        let localPoint: Vec3 | undefined
        let localDirection: Vec3 | undefined
        if (b) {
          b.root.updateWorldMatrix(true, false)
          const inv = new this.THREE.Matrix4().copy(b.root.matrixWorld).invert()
          const lp = this.v1.set(ev.point[0], ev.point[1], ev.point[2]).applyMatrix4(inv)
          const ld = this.v2.set(ev.direction[0], ev.direction[1], ev.direction[2]).transformDirection(inv).normalize()
          localPoint = [lp.x, lp.y, lp.z]
          localDirection = [ld.x, ld.y, ld.z]
        }
        const same = this.leaks.find((l) => l.object === ev.object && l.part === ev.part && Math.hypot(l.point[0] - ev.point[0], l.point[1] - ev.point[1], l.point[2] - ev.point[2]) < 0.03)
        if (same) {
          same.rate = ev.rate
          same.direction = ev.direction
          if (localPoint) same.localPoint = localPoint
          if (localDirection) same.localDirection = localDirection
        } else {
          if (this.leaks.length >= 24) this.leaks.shift()
          this.leaks.push({
            object: ev.object,
            part: ev.part,
            fluid: ev.fluid,
            point: ev.point,
            direction: ev.direction,
            rate: ev.rate,
            pressurized: ev.pressurized,
            acc: 0,
            opened: this.world.part(ev.object, ev.part)?.holes.some((h) => h.through) ?? false,
            localPoint,
            localDirection,
            life: 0,
          })
        }
        void key
        break
      }
      case 'explode':
        // the vessel that vented into its flame bursts: the gas jet ends with it
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.onExplode(ev)
        break
      case 'destroyed':
        break
    }
  }

  /** Where the object's root is now, in the world: a body that tipped or fell is there, not where it was bound. */
  private rootPoint(objectId: string): Vec3 {
    const b = this.bounds.get(objectId)
    if (!b) return [0, 0, 0]
    const p = b.root.getWorldPosition(new this.THREE.Vector3())
    return [p.x, p.y, p.z]
  }

  private sound(key: string, point: Vec3, volume: number, detail?: SoundDetail): void {
    if (detail) this.o.onSound?.(key, point, volume, detail)
    else this.o.onSound?.(key, point, volume)
  }

  /** What a burning part is made of, for the fire's sound. */
  private burning(objectId: string, partId: string): SoundDetail | undefined {
    const material = this.partVis(objectId, partId)?.material || this.world.part(objectId, partId)?.material
    return material ? { material } : undefined
  }

  private partVis(objectId: string, partId: string): PartVis | null {
    return this.bounds.get(objectId)?.parts.get(partId) ?? null
  }

  private activate(objectId: string, partId: string): void {
    this.active.set(`${objectId}|${partId}`, { object: objectId, part: partId })
  }

  /** Current colour of the part's first mesh (char included), or null. */
  private partColor(pv: PartVis, def: MaterialDef | undefined): number | null {
    // the colour of what most of the part is drawn with (a roof's tiles, not the strip of plaster drawn with it first)
    const size = (m: MeshVis): number => (m.range ? m.range[1] - m.range[0] : (m.mesh.geometry.getAttribute('position')?.count ?? 0))
    const mv = pv.meshes.reduce<MeshVis | undefined>((best, m) => (!best || size(m) > size(best) ? m : best), undefined)
    if (!mv) return null
    const mat = materialsOf(mv.mesh.material)[0] as THREE_NS.MeshStandardMaterial | undefined
    const c = mat?.color
    if (c && (c as THREE_NS.Color).isColor) {
      const tint = this.visuals.vertexTint(mv)
      return tint ? c.clone().multiply(tint).getHex() : c.getHex()
    }
    return def ? fallbackColor(def) : null
  }

  private debrisOptions(kind: DebrisKind, objectId: string, partId: string, material?: string): { color?: number } | undefined {
    const pv = this.partVis(objectId, partId)
    const def = this.world.materials.get(material ?? pv?.material ?? '')
    if (kind === 'smoke') return { color: SMOKE_TONES[def?.thermal.smoke ?? 'grey'] }
    // crushed masonry is the colour of its inside (brick orange, plaster light, concrete grey), not of the paint over it
    if ((kind === 'dust' || kind === 'chips') && def?.visual?.innerColor !== undefined) return { color: def.visual.innerColor }
    if (kind === 'fibers' || kind === 'leaves') {
      if (def?.visual?.innerColor !== undefined) return { color: def.visual.innerColor }
      // a part drawn by its host (a house piece) has no mesh of its own here: the burst keeps its default colour
      const c = pv && pv.meshes[0] ? this.visuals.baseColorHex(pv.meshes[0]) : -1
      return c >= 0 ? { color: c } : undefined
    }
    if (kind === 'dust' || kind === 'chips') {
      const c = pv && pv.meshes[0] ? this.visuals.baseColorHex(pv.meshes[0]) : -1
      return c >= 0 && kind === 'chips' ? { color: c } : undefined
    }
    return undefined
  }

  /** Mesh of the part closest to a world point. */
  private nearestMesh(pv: PartVis, p: THREE_NS.Vector3): PartVis['meshes'][number] | null {
    let best: PartVis['meshes'][number] | null = null
    let bd = Infinity
    // a part drawn by no mesh of its own takes its marks on the meshes it is drawn inside (`BindOptions.marksOn`)
    const meshes = pv.meshes.length || !pv.markHosts ? pv.meshes : pv.markHosts.flatMap((h) => h.meshes)
    for (const mv of meshes) {
      if (!this.visuals.shown(mv)) continue
      const d = this.visuals.worldBox(mv, this.box).distanceToPoint(p)
      if (d < bd) {
        bd = d
        best = mv
      }
    }
    return best
  }

  private worldDir(b: Bound, v: Vec3): THREE_NS.Vector3 {
    b.root.updateWorldMatrix(true, false)
    return new this.THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(b.root.getWorldQuaternion(this.tmpQ)).normalize()
  }

  /** A plate bent: every mesh of the part turns about the hinge line together (a shovel's blade pieces), on top of the dents they already have. */
  private onBend(ev: Ev<'bend'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    // the object's frame is in metres whatever the scale of the model root (a model drawn in centimetres): its pose is the root's position and rotation only
    b.root.updateWorldMatrix(true, false)
    const point = new this.THREE.Vector3(ev.hinge.point[0], ev.hinge.point[1], ev.hinge.point[2])
    const origin = this.v1
    const rotation = this.tmpQ
    b.root.matrixWorld.decompose(origin, rotation, this.v2)
    point.applyQuaternion(rotation).add(origin)
    const axis = this.worldDir(b, ev.hinge.axis)
    const side = this.worldDir(b, ev.hinge.side)
    for (const mv of pv.meshes) if (this.visuals.shown(mv)) this.visuals.applyBend(mv, point, axis, side, ev.angle)
  }

  private onDent(ev: Ev<'dent'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const wp = new this.THREE.Vector3(ev.worldPoint[0], ev.worldPoint[1], ev.worldPoint[2])
    const wn = this.worldDir(b, ev.dent.normal)
    const shown = pv.meshes.filter((mv) => this.visuals.shown(mv))
    const reach = shown.reduce((widest, mv) => Math.max(widest, this.visuals.dentReach(mv, wp, ev.dent)), ev.dent.radius)
    this.visuals.applyPartDent(shown, wp, wn, ev.dent, reach)
    if (def?.tags?.includes('metal')) this.vfx.burst('sparks', ev.worldPoint, [wn.x, wn.y, wn.z], 4 + Math.min(8, ev.dent.depth * 150), 3.2)
    this.impactSound(pv.material, ev.worldPoint, clamp(0.3 + ev.dent.depth * 12, 0.3, 1), ev.blow)
  }

  private onHole(ev: Ev<'hole'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const n = this.worldDir(b, ev.hole.normal)
    const look = debrisLook(def, 'shot')
    this.drawHoleMark(pv, ev.worldPoint, n, ev.hole.diameter, ev.time)
    if (ev.hole.through && ev.exitPoint) this.drawHoleMark(pv, ev.exitPoint, n.clone().negate(), ev.hole.diameter, ev.time)
    if (look.sparks) this.vfx.burst('sparks', ev.worldPoint, [n.x, n.y, n.z], 6, 3.5)
    if (ev.powder) {
      // what the part holds loose (flakes, flour) puffs out: a little back out of the entry, most out of the exit along the shot
      const puff = { color: ev.powder.color, size: 0.6, life: 1.6, alpha: 1.3 }
      this.vfx.burst('dust', ev.worldPoint, [n.x, n.y, n.z], this.low ? 5 : 10, 0.7, puff)
      if (ev.hole.through && ev.exitPoint) this.vfx.burst('dust', ev.exitPoint, [-n.x, -n.y, -n.z], this.low ? 10 : 20, 1.3, puff)
    }
    // the blow's own keys first (`impact_steel_ballistic`...), then the round's per-family key (`shot_metal`), which falls back to the plain impact
    this.sound(shotKey(def), ev.worldPoint, 0.6, impactSoundKeys(pv.material, def, ev.blow))
  }

  /** The mark of one hole on the mesh of `pv` nearest to the world `point`: a star crack in glass, a ragged rim and a dark disc elsewhere. */
  private drawHoleMark(pv: PartVis, point: Vec3, normal: THREE_NS.Vector3, diameter: number, time: number): void {
    const def = this.world.materials.get(pv.material)
    const look = debrisLook(def, 'shot')
    const wp = new this.THREE.Vector3(point[0], point[1], point[2])
    const mv = this.nearestMesh(pv, wp)
    if (!mv) return
    if (look.mark === 'star_crack') {
      const seed = hashNumbers(time, point[0], point[1], point[2])
      this.visuals.addCrack(mv, wp, normal, 7, Math.max(0.05, diameter * 5), 0xe8f4ff, seed)
      return
    }
    // wood tears its fibres around the hole: a ragged rim of fresh wood under it
    const fresh = look.mark === 'splintered_hole' ? def?.visual?.innerColor : undefined
    if (fresh !== undefined) this.visuals.addSpall(mv, wp, normal, Math.max(0.006, diameter * WOOD_RIM), fresh)
    // masonry and concrete crater around the hole: the patch of fresh broken material under the dark hole
    const core = look.mark === 'crater' ? def?.visual?.innerColor : undefined
    if (core !== undefined) this.visuals.addSpall(mv, wp, normal, Math.max(CRATER_MIN_RADIUS, diameter * CRATER_RADIUS), lighten(core, CRATER_LIGHTEN))
    this.visuals.addHole(mv, wp, normal, diameter)
  }

  private onCrack(ev: Ev<'crack'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    this.drawCrackMark(b, pv, ev.crack, ev.worldPoint, ev.time)
    this.impactSound(pv.material, ev.worldPoint, 0.5, ev.blow)
  }

  /** The mark of one crack: the mortar gap of a settlement crack on both faces of a wall, or the star lines of glass; an opaque body shows chips, holes and dents instead. */
  private drawCrackMark(b: Bound, pv: PartVis, crack: Crack, worldPoint: Vec3, time: number): void {
    const def = this.world.materials.get(pv.material)
    const stair = crack.stair
    // a stair-step crack of settlement opens the mortar joints of the wall: a dark gap drawn on its face, as wide as it opened (and wide enough to be seen)
    if (stair && !def?.visual?.transparent) {
      const wp = new this.THREE.Vector3(worldPoint[0], worldPoint[1], worldPoint[2])
      const seed = hashNumbers(time, worldPoint[0], worldPoint[1], worldPoint[2])
      const width = Math.max(stair.width, MIN_DRAWN_CRACK_WIDTH)
      const normal = this.worldDir(b, crack.normal)
      const toward = this.worldDir(b, stair.along)
      const look = { length: crack.length, step: stair.step, width, color: SETTLEMENT_CRACK_COLOR, seed }
      // the same crack on both faces of the wall (the far one seen from behind: its side runs the other way round, its path the same)
      for (const face of [wp, wp.clone().addScaledVector(normal, -stair.through)]) {
        const out = face === wp ? normal : normal.clone().negate()
        const mv = this.nearestMesh(pv, face)
        if (mv) this.visuals.addStairCrack(mv, face, out, toward, look)
      }
    }
    // only glass shows a crack as lines (the break runs inside a clear body); an opaque body shows its damage as chips, holes and dents, never lines drawn over it
    else if (def?.visual?.transparent) {
      const wp = new this.THREE.Vector3(worldPoint[0], worldPoint[1], worldPoint[2])
      const mv = this.nearestMesh(pv, wp)
      const seed = hashNumbers(time, worldPoint[0], worldPoint[1], worldPoint[2])
      if (mv) this.visuals.addCrack(mv, wp, this.worldDir(b, crack.normal), crack.rays, crack.length, 0xe8f4ff, seed)
    }
  }

  /** Outward normal of the face of `mv` nearest to a world point: the thin axis of its world box (right for a wall; a sloped face is left to the vertex-range binding). */
  private faceNormal(mv: PartVis['meshes'][number], point: THREE_NS.Vector3): THREE_NS.Vector3 {
    const box = this.visuals.worldBox(mv, this.box)
    const size = box.getSize(this.v1)
    const axis = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z'
    const side = point[axis] >= (box.min[axis] + box.max[axis]) / 2 ? 1 : -1
    return new this.THREE.Vector3(axis === 'x' ? side : 0, axis === 'y' ? side : 0, axis === 'z' ? side : 0)
  }

  /**
   * Plays the effect the event map names for a destruction event (`data/event-effects.json` of `game-vfx`, or `RendererOptions.eventEffects`) at a point.
   * `play` gives the family of the material (the map's `{material}`) and the colours of its debris and dust. Answers whether one played, so the caller can
   * leave out the burst it replaces.
   */
  private playEvent(event: GameEvent, point: Vec3, play?: FamilyPlay): boolean {
    const id = effectForEvent(play && event.material === undefined ? { ...event, material: play.material } : event, this.o.eventEffects ?? EVENT_EFFECTS_MAP)
    if (!id) return false
    return this.vfx.play(id, point, { seed: hashNumbers(point[0], point[1], point[2], this.time), ...(play ? { values: play.values } : {}) }) !== null
  }

  /** The family and colours of a part's material, for the effects of the event map. */
  private partPlay(objectId: string, partId: string): FamilyPlay {
    const pv = this.partVis(objectId, partId)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    return familyPlay(def, pv ? (this.partColor(pv, def) ?? undefined) : undefined)
  }

  /** A coat came off: a patch in the colour of the core under it, below the bullet holes and cracks. */
  private onSpall(ev: Ev<'spall'>): void {
    const pv = this.partVis(ev.object, ev.part)
    if (!pv) return
    const wp = new this.THREE.Vector3(ev.point[0], ev.point[1], ev.point[2])
    const mv = this.nearestMesh(pv, wp)
    if (!mv) return
    const def = this.world.materials.get(pv.material)
    const normal = this.faceNormal(mv, wp)
    const core = def?.visual?.innerColor
    const look = debrisLook(def, 'spall', { partColor: this.partColor(pv, def) ?? undefined })
    // masonry crumbles in the colour of what is under the coat (brick orange, concrete grey); the generic impact would throw dark grey chips, and a
    // material with no impact recipe of its own (plastic, fabric, soil) throws its own debris in its colour, not the concrete impact
    if (core !== undefined || look.impact === undefined) this.vfx.burst(look.debris, ev.point, [normal.x, normal.y, normal.z], 5, 2.5, { color: look.color })
    else this.playEvent({ kind: 'spall', material: look.impact }, ev.point)
    if (core !== undefined) this.trickleFrom(ev.point, [normal.x, normal.y, normal.z], core, mv)
    // a drawing that shows the coat coming off itself (the house renderer cuts its plaster and draws the bricks under it) takes no flat patch
    if ((mv.mesh.userData.drawnSpalls as string[] | undefined)?.includes(ev.part)) return
    this.visuals.addSpall(mv, wp, normal, Math.sqrt(ev.area / Math.PI), core ?? fallbackColor(def))
  }

  /**
   * Grit and dust go on falling from where a blow broke a hard face (masonry, concrete, wood) for `TRICKLE_SECONDS`, a pinch at a time and less and
   * less. The place is held on the mesh it broke on (`mv`), so it falls with the object when it tips or a piece of it comes away.
   */
  private trickleFrom(point: Vec3, normal: Vec3, color: number | undefined, mv: MeshVis | null): void {
    if (this.trickles.length >= TRICKLE_MAX) this.trickles.shift()
    const total = TRICKLE_SECONDS[0] + (TRICKLE_SECONDS[1] - TRICKLE_SECONDS[0]) * this.rng()
    const anchor = mv ? anchorOnMesh(this.THREE, mv, point, normal) : null
    this.trickles.push({ point: [point[0], point[1], point[2]], normal, anchor, color, left: total, total, next: TRICKLE_EVERY, source: this.emitting ?? mv?.home })
  }

  private updateTrickles(dt: number): void {
    for (let i = this.trickles.length - 1; i >= 0; i--) {
      const t = this.trickles[i]!
      t.left -= dt
      t.next -= dt
      if (t.left <= 0) {
        this.trickles.splice(i, 1)
        continue
      }
      if (t.next > 0) continue
      if (t.anchor) {
        // nothing left to crumble from: the part broke into fragments or is gone
        if (!anchorWorld(t.anchor, this.visuals.shown(t.anchor.mv), this.v1, this.v2)) {
          this.trickles.splice(i, 1)
          continue
        }
        t.point = [this.v1.x, this.v1.y, this.v1.z]
        t.normal = [this.v2.x, this.v2.y, this.v2.z]
      }
      // falling off the face, slower as the loose grit runs out
      const share = t.left / t.total
      t.next = TRICKLE_EVERY / Math.max(share, 0.25)
      const out: Vec3 = [t.normal[0] * 0.2, -1, t.normal[2] * 0.2]
      const options = { ...(t.color !== undefined ? { color: t.color } : {}), ...(t.source !== undefined ? { source: t.source } : {}) }
      this.vfx.burst('chips', t.point, out, this.low ? 1 : 2, 0.3, options)
      if (this.rng() < 0.5) this.vfx.burst('dust', t.point, out, 1, 0.2, options)
    }
  }

  /**
   * Stage 2 of a staged part: the unit-sized fragments come out and the part stays drawn (hiding it is what `fracture` does). The opening itself
   * (cutting the wall's faces) is not drawn yet: it needs the per-vertex binding of the house renderer.
   */
  private onStage(ev: Ev<'stage'>): void {
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const at = ev.opening?.center ?? this.hitPoints.of(ev.object, ev.part, this.time) ?? this.rootPoint(ev.object)
    const played = this.playEvent({ kind: 'stage', stage: ev.stage }, at, this.partPlay(ev.object, ev.part))
    if (!ev.fragments || !ev.opening) return
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = 0; i < ev.fragments.length; i += step) {
      const fr = ev.fragments[i] as Fragment
      const fdef = this.world.materials.get(fr.material)
      this.fragments.spawn(fr, this.fragments.materialFor(fr.material, fdef === def || !fdef ? color : fallbackColor(fdef), false), ev.object, maxAlive)
    }
    if (!played) this.vfx.burst('dust', ev.opening.center, [0, 1, 0], 14, 1.2, { color })
    this.impactSound(pv?.material ?? '', ev.opening.center, 0.8, ev.blow)
  }

  /**
   * A unit came out of a wall of units: the unit flies as a fragment with a puff of its dust, and the marks drawn on it (bullet holes, spalls, the impact
   * marks of the effects) go with it. The gap itself is the drawing's (the house renderer cuts the wall where the unit was); a part drawn as one box
   * keeps its box.
   */
  private onChip(ev: Ev<'chip'>): void {
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    for (const fr of ev.fragments) {
      const fdef = this.world.materials.get(fr.material)
      // the inside of the material (fresh wood) when the piece came from it, else the part's colour
      const tone = fragmentTone(fdef, fr, fdef === def ? color : fallbackColor(fdef))
      this.fragments.spawn(fr as Fragment, this.fragments.materialFor(fr.material, tone, false), ev.object, maxAlive)
    }
    // a unit knocked out of masonry or concrete leaves a broken edge that goes on crumbling
    if (def?.visual?.innerColor !== undefined || pv?.material === 'concrete' || pv?.material === 'brick') {
      this.trickleFrom(ev.center, [0, 0, 0], color, pv ? this.nearestMesh(pv, new this.THREE.Vector3(ev.center[0], ev.center[1], ev.center[2])) : null)
    }
    // what a blow tore off a face leaves the hole it made where it is
    if (ev.torn) {
      this.impactSound(pv?.material ?? '', ev.center, 0.5, ev.blow)
      return
    }
    // the holes and spalls drawn on the unit leave with it (also those on the wall a beam is drawn inside), and on the ragged edge of plaster around it
    const T = this.THREE
    const center = new T.Vector3(ev.center[0], ev.center[1], ev.center[2])
    const half = new T.Vector3(ev.size[0] / 2 + CHIP_DECAL_EDGE, ev.size[1] / 2 + CHIP_DECAL_EDGE, ev.size[2] / 2 + CHIP_DECAL_EDGE)
    const rotation = new T.Quaternion(ev.rotation[0], ev.rotation[1], ev.rotation[2], ev.rotation[3])
    for (const part of this.bounds.get(ev.object)?.parts.values() ?? []) for (const mv of part.meshes) this.visuals.clearDecals(mv, center, half, rotation)
    this.vfx.peekWorkshop()?.decals.clearInside(ev.center, [half.x, half.y, half.z], ev.rotation)
    if (pv) this.drawChipGap(pv, ev, center, rotation)
    // a puff of the unit's own dust; not the bullet impact effect, which would leave its black mark on the hole the unit left
    this.vfx.burst('dust', ev.center, [0, 1, 0], ev.units ? Math.min(40, 8 + ev.units.length) : 8, ev.units ? 1.6 : 0.8, { color })
    this.impactSound(pv?.material ?? '', ev.center, 0.7, ev.blow)
  }

  /**
   * The gap a unit leaves in an object the renderer draws whole (a concrete pole, a block, a post): on each outer face the unit reached, the broken inside of its material,
   * as wide as the unit there, so the bars it bared show in a hole and not on a smooth face. A drawing that cuts its own gaps (the house's breach, `drawnSpalls`) takes none.
   */
  private drawChipGap(pv: PartVis, ev: Ev<'chip'>, center: THREE_NS.Vector3, rotation: THREE_NS.Quaternion): void {
    const mv = this.nearestMesh(pv, center)
    if (!mv || (mv.mesh.userData.drawnSpalls as string[] | undefined)?.includes(ev.part)) return
    const def = this.world.materials.get(pv.material)
    // darkened channel by channel on the hex as drawn (a three.js Color would darken it in linear space and give it back lighter)
    const inner = def?.visual?.innerColor ?? fallbackColor(def)
    const color = [16, 8, 0].reduce((hex, shift) => hex | (Math.round(((inner >> shift) & 0xff) * CHIP_GAP_SHADE) << shift), 0)
    const box = this.visuals.worldBox(mv, new this.THREE.Box3())
    for (let axis = 0; axis < 3; axis++) {
      for (const side of [-1, 1]) {
        const normal = new this.THREE.Vector3(axis === 0 ? side : 0, axis === 1 ? side : 0, axis === 2 ? side : 0).applyQuaternion(rotation)
        const face = center.clone().addScaledVector(normal, ev.size[axis]! / 2)
        const k = Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z) ? 'x' : Math.abs(normal.y) >= Math.abs(normal.z) ? 'y' : 'z'
        const surface = normal[k] > 0 ? box.max[k] : box.min[k]
        if (Math.abs(face[k] - surface) > CHIP_GAP_REACH) continue
        face[k] = surface
        // as wide as the narrower side of the unit's face: a round part (a pole) shows its gap on its face, not past its edges
        this.visuals.addSpall(mv, face, normal, (Math.min(ev.size[(axis + 1) % 3]!, ev.size[(axis + 2) % 3]!) / 2) * CHIP_GAP_WIDTH, color)
      }
    }
  }

  private onFracture(ev: Ev<'fracture'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    const matId = pv?.material || (ev.fragments[0]?.material ?? '')
    const def = this.world.materials.get(matId)
    let color = fallbackColor(def)
    let opacity = 0.5
    const transparent = def?.visual?.transparent === true
    if (pv) {
      const c = this.partColor(pv, def)
      if (c !== null) color = c
      const m = pv.meshes[0] ? (materialsOf(pv.meshes[0].origMaterial)[0] as THREE_NS.Material | undefined) : undefined
      if (m && m.transparent) opacity = clamp(m.opacity, 0.2, 0.8)
      this.visuals.hide(pv, 'broken')
    }
    this.spawnFragments(ev, 0, { def, color, opacity, transparent })
    // the groups the operation left loose come off first (the world's state is that of the end of the operation, whatever order its events arrive in): only
    // what is left of the object can have lost its footing
    this.splitLoose(ev.object)
    this.loosenIfFootless(ev.object)
    const up: Vec3 = [0, 1, 0]
    const sizeK = clamp(ev.fragments.length / 10, 0.5, 2)
    // what flies off is of the material that broke, in its colour: grey chips of concrete, orange of brick, splinters and pale dust of wood
    const look = debrisLook(def, 'fracture', { style: ev.style, partColor: color })
    const dust = look.dust !== undefined ? { color: look.dust } : undefined
    switch (ev.style) {
      case 'shatter':
        this.vfx.burst('shards', ev.point, up, 18 * sizeK, 3)
        break
      case 'crumble':
        this.vfx.burst('dust', ev.point, up, 16 * sizeK, 1.2, dust)
        this.vfx.burst(look.family === 'glass' ? 'shards' : 'chips', ev.point, up, 6, 3, { color: look.color })
        break
      case 'splinter':
        this.vfx.burst('splinters', ev.point, up, 14 * sizeK, 3, { color: look.color })
        this.vfx.burst('dust', ev.point, up, 5, 0.8, dust)
        break
      case 'tear':
        this.vfx.burst('fibers', ev.point, up, 12 * sizeK, 1.6, { color: look.color })
        break
      case 'snap':
        this.vfx.burst('chips', ev.point, up, 8 * sizeK, 3, { color: look.color })
        break
      default:
        this.vfx.burst('sparks', ev.point, up, 10, 4)
    }
    this.sound(fractureKey(def, ev.style), ev.point, clamp(0.4 + ev.fragments.length * 0.03, 0.4, 1), breakSoundKeys(matId, def, ev.blow))
  }

  /** Spawns the fragments of a fracture from index `from`; what does not fit in this frame's budget is spawned by the next frames. */
  private spawnFragments(ev: Ev<'fracture'>, from: number, look: { def: MaterialDef | undefined; color: number; opacity: number; transparent: boolean }): void {
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = from; i < ev.fragments.length; i += step) {
      if (this.work && this.sliceDeadline !== Infinity) {
        if (i - from >= MIN_FRAGMENTS_PER_SLICE * step && !this.work.tryTake('fragment', this.workCosts.perFragment)) {
          this.slices.push({ ev, from: i, look })
          return
        }
        if (i - from < MIN_FRAGMENTS_PER_SLICE * step) this.work.take('fragment', this.workCosts.perFragment)
      } else if (i - from >= MIN_FRAGMENTS_PER_SLICE * step && this.drainClock() >= this.sliceDeadline) {
        this.slices.push(() => this.spawnFragments(ev, i, look))
        return
      }
      const fr = ev.fragments[i]
      const fdef = this.world.materials.get(fr.material)
      const tone = fragmentTone(fdef, fr, fdef === look.def || !fdef ? look.color : fallbackColor(fdef))
      const mat = this.fragments.materialFor(fr.material, tone, look.transparent || fdef?.visual?.transparent === true, look.opacity)
      this.fragments.spawn(fr, mat, ev.object, maxAlive)
    }
  }

  private onDetach(ev: Ev<'detach'>): void {
    this.sound('detach', this.rootPoint(ev.object), 0.5)
    this.splitLoose(ev.object)
  }

  /**
   * The cage of a part gave way (`expose` with no bars): nothing holds its bars any more, so each comes down where it is, as steel debris that stays on the
   * ground with a body (`FragmentSystem.spawn` with `lasting`), not as bars left standing in the air.
   */
  private dropCage(objectId: string, partId: string): void {
    const bars = this.cages.take(`${objectId}|${partId}`)
    if (bars.length === 0) return
    const radius = this.cages.barRadius
    const density = this.world.materials.get('steel')?.density ?? STEEL_DENSITY
    const material = this.fragments.materialFor('steel', REBAR_COLOR, false)
    const rnd = createRng(hashString(`${objectId}|${partId}`))
    bars.forEach((bar, i) => {
      const fragment: Fragment = {
        id: `${partId}#bar${i}`, part: partId, material: 'steel', shape: 'chunk', center: bar.center, size: [2 * radius, bar.length, 2 * radius], rotation: bar.rotation,
        velocity: [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4], angularVelocity: [(rnd() - 0.5) * 1.5, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 1.5],
        mass: density * Math.PI * radius * radius * bar.length,
      }
      this.fragments.spawn(fragment, material, objectId, this.maxFragments, true)
    })
  }

  /**
   * What goes on at a part (its fire, its leak, its burn sound, its heat) moves with the part to the object a split made of it: it goes on where the
   * part is, as it falls, not where the object stood, and does not end because the part has a new id.
   */
  private followSplit(from: Bound, to: Bound): void {
    for (const part of to.parts.keys()) {
      const was = `${from.id}|${part}`
      const now = `${to.id}|${part}`
      const fire = this.fires.get(was)
      if (fire) {
        this.fires.delete(was)
        fire.object = to.id
        this.fires.set(now, fire)
      }
      const sound = this.burnSounds.get(was)
      if (sound) {
        this.burnSounds.delete(was)
        this.burnSounds.set(now, { ...sound, object: to.id })
      }
      if (this.active.delete(was)) this.active.set(now, { object: to.id, part })
    }
    from.root.updateWorldMatrix(true, false)
    to.root.updateWorldMatrix(true, false)
    const into = new this.THREE.Matrix4().copy(to.root.matrixWorld).invert()
    for (const leak of this.leaks) {
      if (leak.object !== from.id || !to.parts.has(leak.part)) continue
      leak.object = to.id
      const point = leak.localPoint ? this.v1.set(...leak.localPoint).applyMatrix4(from.root.matrixWorld) : this.v1.set(...leak.point)
      const direction = leak.localDirection ? this.v2.set(...leak.localDirection).transformDirection(from.root.matrixWorld) : this.v2.set(...leak.direction)
      point.applyMatrix4(into)
      direction.transformDirection(into)
      leak.localPoint = [point.x, point.y, point.z]
      leak.localDirection = [direction.x, direction.y, direction.z]
    }
  }

  /** The pieces that held two parts by a joint that tears leave each other alone for good: a wire does not hit the pole it was clipped to as that pole falls. */
  private tetherTorn(torn: ReadonlyArray<readonly [string, string]>): void {
    const objectOf = (part: string): string | undefined => {
      for (const [id, bound] of this.bounds) if (bound.parts.has(part)) return id
      return undefined
    }
    for (const [first, second] of torn) {
      const a = objectOf(first)
      const c = objectOf(second)
      if (a !== undefined && c !== undefined && a !== c) this.pieceSys.tether(a, c)
    }
  }

  /** Turn every loose group of the object (a detach, a collapse) into a piece of its own. */
  private splitLoose(objectId: string, tearing: ReadonlyArray<readonly [string, string]> = []): void {
    if (!this.autoSplit) return
    const b = this.bounds.get(objectId)
    if (!b) return
    const st = this.world.state(objectId)
    if (!st || st.groups.length < 2) return
    const loose = st.groups.length - 1
    const torn = [...tearing, ...tornPairsOf(st)]
    if (this.work) {
      this.splitWithin(this.work, b, st, torn)
      return
    }
    // every loose group at once, whatever the clock says: the world builds what is left once, not once per group (a blast tears several off a house of
    // hundreds of parts), and what comes off in a frame must not depend on how long the frame took
    this.visuals.batchRebuilds(() => {
      // the hinges are read before, while the groups still hang on what stands
      let hinges: (Vec3 | null)[]
      let newIds: string[]
      try {
        hinges = Array.from({ length: loose }, (_, i) => this.hingeOf(objectId, i + 1))
        newIds = this.world.splitGroups(objectId, Array.from({ length: loose }, (_, i) => i + 1))
      } catch {
        return
      }
      newIds.forEach((newId, i) => {
        this.adoptSplit(b, newId)
        this.hangOnHinge(newId, hinges[i] ?? null)
      })
    })
    this.afterSplit(b, torn)
  }

  /** What is left of an object after loose groups came off it: its piece takes the box and contacts of what is left, or furniture left without its feet becomes one. */
  private afterSplit(b: Bound, torn: ReadonlyArray<readonly [string, string]>): void {
    const objectId = b.id
    this.tetherTorn(torn)
    const old = b.piece
    if (old) {
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      old.halfExtents = half
      this.pieceSys.setCenter(old, center)
      old.mass = Math.max(MIN_PIECE_MASS_KG, this.massOf(objectId) - (old.massOffset ?? 0))
      old.apart = true
      // what came off no longer touches the ground for it: its contacts are those of what is left
      // and what others meet it by are the boxes of what is left (`partBoxes`): nothing invisible collides
      if (old.contacts || old.round) {
        this.fitSurface(b, old)
        if (!old.round) this.setContacts(b, old, this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
      } else if (old.partBoxes) this.fitPartBoxes(b, old)
      // at load what is left stood as it was: it is not woken
      if (!this.splittingAtLoad) old.sleeping = false
    } else if (kitOriginOf(b.root)?.kind === 'furniture' && !this.splittingAtLoad && !this.heldByWorld(objectId)) {
      // furniture only stands on the floor: what stayed (a leg, two legs and a board) is loose too, and what cannot stand on its own topples; at load it stands as it stood
      const piece = this.makePiece(objectId)
      ;(piece as PieceBody).apart = true
      this.tipIfTopHeavy(b, true)
      // the host stops keeping the footprint it had where it stood: it is a body that moves now
      this.o.onLoosened?.(objectId, piece, 'apart')
    }
  }

  /**
   * Under `workBudget`: each loose group of the object none of whose parts is already waiting joins the split queue, ranked by its distance to `focus` (the player at the
   * start of the frame's work step) and its smallest part id, and charged by the size of its work. Until its turn it stays in the object, drawn and solid where it stood.
   */
  private queueLoose(b: Bound, st: ObjectState, torn: ReadonlyArray<readonly [string, string]>, focus: Vec3 | undefined): void {
    const waiting = new Set<string>()
    for (const { item } of this.splitQueue.saveState()) if (item.objectId === b.id) for (const id of item.parts) waiting.add(id)
    for (let g = 1; g < st.groups.length; g++) {
      const group = st.groups[g]!
      const parts = [...group].sort()
      if (parts.length === 0 || parts.some((id) => waiting.has(id))) continue
      const units = this.splitUnitsOf(b, group, st.parts.length)
      const centre = focus ? this.groupCentre(b, group) : null
      const priority = focus && centre ? Math.hypot(centre.x - focus[0], centre.y - focus[1], centre.z - focus[2]) : 0
      this.splitQueue.push({ objectId: b.id, parts, torn: torn.map(([first, second]) => [first, second] as const) }, priority, `${b.id}\0${parts[0]}`, units)
    }
  }

  /**
   * The object's loose groups become pieces in the next drain (after a bind, a redraw, or pieces given back), not inside the call: the world may still be building it. Under
   * `workBudget` they join the split queue (`queueChecked`); without it they split in the drain (`splitChecked`).
   */
  private checkLoose(objectId: string, bound = false): void {
    if (this.autoSplit) this.looseToCheck.set(objectId, bound || (this.looseToCheck.get(objectId) ?? false))
  }

  /** The objects `checkLoose` marked that have a loose group now; one without any is no work waiting and is forgotten (a group that comes loose later comes with an event). */
  private looseLeft(): number {
    let left = 0
    for (const objectId of [...this.looseToCheck.keys()]) {
      if ((this.world.state(objectId)?.groups.length ?? 0) > 1) left++
      else this.looseToCheck.delete(objectId)
    }
    return left
  }

  /**
   * Without `workBudget`: the objects `checkLoose` marked, in the order they were marked, have their loose groups split (`splitLoose`) while the drain has time (with nothing
   * run before it in the drain, `done`, the first always does); the rest wait for the next drain. One with no loose group costs nothing. Returns how many objects split.
   */
  private splitChecked(deadline: number, done: number): number {
    let ran = 0
    for (const [objectId, bound] of [...this.looseToCheck]) {
      if (done + ran > 0 && this.drainClock() >= deadline) break
      this.looseToCheck.delete(objectId)
      const st = this.world.state(objectId)
      if (!this.bounds.has(objectId) || !st || st.groups.length < 2) continue
      this.staticDirty.add(objectId)
      this.splittingAtLoad = bound
      try {
        this.splitLoose(objectId)
      } finally {
        this.splittingAtLoad = false
      }
      ran++
    }
    return ran
  }

  /** The loose groups of the objects `checkLoose` marked join the split queue, unless waiting already: none stays loose in its object for ever. */
  private queueChecked(): void {
    for (const objectId of this.looseToCheck.keys()) {
      const b = this.bounds.get(objectId)
      const st = this.world.state(objectId)
      if (b && st && st.groups.length > 1) this.queueLoose(b, st, tornPairsOf(st), this.workFocus)
    }
    this.looseToCheck.clear()
  }

  /**
   * Under `workBudget`, in the event: the loose groups split now, in the world's order, while their units fit (the first of the frame always does, so a blow breaks something
   * at once); the rest wait in the queue. With room for all of them it is the same work in the same order as without the budget. An object with groups already waiting
   * keeps its turn in the queue.
   */
  private splitWithin(work: WorkBudget, b: Bound, st: ObjectState, torn: ReadonlyArray<readonly [string, string]>): void {
    const waiting = this.splitQueue.some((entry) => entry.objectId === b.id)
    let split = 0
    this.visuals.batchRebuilds(() => {
      // the world makes the object anew on each split: its state is read again each time
      for (let now: ObjectState | null = st; !waiting && now && now.groups.length > 1; now = this.world.state(b.id)) {
        const units = this.splitUnitsOf(b, now.groups[1]!, now.parts.length)
        if (!work.tryTake('split', units)) {
          if (this.eventSplitFrame === work.frame) return
          work.take('split', units)
        }
        let newId: string
        const hinge = this.hingeOf(b.id, 1)
        try {
          newId = this.world.splitGroup(b.id, 1)
        } catch {
          return
        }
        if (newId === b.id) return
        this.eventSplitFrame = work.frame
        this.adoptSplit(b, newId)
        this.hangOnHinge(newId, hinge)
        split++
      }
    })
    const left = this.world.state(b.id)
    if (left && left.groups.length > 1) this.queueLoose(b, left, torn, this.workFocus)
    if (split > 0) this.afterSplit(b, torn)
  }

  /** The units of cutting `group` off `b` (`splitWorkUnits`): its vertices, the merged meshes it leaves, the parts of the object. */
  private splitUnitsOf(b: Bound, group: readonly string[], objectParts: number): number {
    let vertices = 0
    const hosts = new Set<HostVis>()
    for (const id of group) {
      for (const mv of b.parts.get(id)?.meshes ?? []) {
        vertices += mv.range ? mv.range[1] - mv.range[0] : (mv.mesh.geometry.getAttribute('position')?.count ?? 0)
        if (mv.host && !mv.loose) hosts.add(mv.host)
      }
    }
    let hostVertices = 0
    for (const host of hosts) hostVertices += host.mesh.geometry.getAttribute('position')?.count ?? 0
    return splitWorkUnits(this.workCosts, { vertices, hostVertices, objectParts })
  }

  /** The centre of the drawn boxes of a group's meshes, in the world; null when none is drawn. */
  private groupCentre(b: Bound, group: readonly string[]): THREE_NS.Vector3 | null {
    const box = this.box.makeEmpty()
    for (const id of group) for (const mv of b.parts.get(id)?.meshes ?? []) box.union(this.visuals.worldBox(mv, new this.THREE.Box3()))
    return box.isEmpty() ? null : box.getCenter(this.v1)
  }

  /** The loose groups whose turn it is this frame become pieces; each object they came off is measured again once after its batch. Returns how many split. */
  private runSplits(work: WorkBudget, all: boolean): number {
    const turn = all ? this.drainSplits() : this.splitQueue.release(work)
    const touched = new Map<string, ReadonlyArray<readonly [string, string]>>()
    const lost = new Map<string, ReadonlyArray<readonly [string, string]>>()
    let ran = 0
    this.visuals.batchRebuilds(() => {
    for (const entry of turn) {
      const b = this.bounds.get(entry.objectId)
      const st = this.world.state(entry.objectId)
      if (!b || !st || !this.world.has(entry.objectId)) continue
      // groups renumber as others split, and may have grown or lost parts since: the group is the loose one holding any of its parts now
      const parts = new Set(entry.parts)
      const index = st.groups.findIndex((group, g) => g > 0 && group.some((id) => parts.has(id)))
      if (index < 1) {
        lost.set(entry.objectId, [...(lost.get(entry.objectId) ?? []), ...entry.torn])
        continue
      }
      let newId: string
      const hinge = this.hingeOf(entry.objectId, index)
      try {
        newId = this.world.splitGroup(entry.objectId, index)
      } catch {
        continue
      }
      this.adoptSplit(b, newId)
      this.hangOnHinge(newId, hinge)
      this.staticDirty.add(entry.objectId)
      touched.set(entry.objectId, [...(touched.get(entry.objectId) ?? []), ...entry.torn])
      ran++
    }
    })
    for (const [objectId, torn] of touched) {
      const b = this.bounds.get(objectId)
      if (b) this.afterSplit(b, torn)
    }
    // a waiting group may have broken in two before its turn, or none of its parts be loose any more: every loose group not waiting now joins the queue
    for (const [objectId, torn] of [...touched, ...lost]) {
      const b = this.bounds.get(objectId)
      const st = this.world.state(objectId)
      if (b && st && st.groups.length > 1) this.queueLoose(b, st, [...torn, ...tornPairsOf(st)], this.workFocus)
    }
    return ran
  }

  /** Every waiting split, in queue order (a flush). */
  private drainSplits(): PendingSplit[] {
    const out = this.splitQueue.saveState().map((entry) => entry.item)
    this.splitQueue.clear()
    return out
  }

  /** The renderer side of `splitGroup`: a new group holding the meshes of the new object, made a piece. */
  /**
   * Where a loose group still hangs on what stands (a shelf that lost the side at one end, still screwed to the other): the middle of the overlap of the two parts of the
   * one joint that holds and joins it to a structural part of the object's first group, which stands, in the world. Null when it hangs on nothing, or on more than one.
   */
  private hingeOf(objectId: string, group: number): Vec3 | null {
    const st = this.world.state(objectId)
    const loose = st?.groups[group]
    const standing = st?.groups[0]
    if (!st || !loose || !standing || group === 0) return null
    // what stands must stand still: a hinge is a point fixed in the world (a case knocked over carries its shelves with it)
    const piece = this.bounds.get(objectId)?.piece
    if (piece && !piece.sleeping && (Math.hypot(...piece.velocity) > HINGE_STILL_SPEED || Math.hypot(...piece.angularVelocity) > HINGE_STILL_SPIN)) return null
    const inLoose = new Set(loose)
    const inStanding = new Set(standing)
    const structural = new Set(st.parts.filter((p) => p.load !== undefined).map((p) => p.id))
    const holds = st.joints.filter((j) => {
      if (j.open || j.tears || j.kind === 'resting') return false
      const [own, other] = inLoose.has(j.a) ? [j.a, j.b] : [j.b, j.a]
      return inLoose.has(own) && inStanding.has(other) && structural.has(own) && structural.has(other)
    })
    if (holds.length !== 1) return null
    const joint = holds[0]!
    const boxOf = (partId: string): number[] | null =>
      this.shownBoxes(objectId, partId).reduce<number[] | null>((all, one) => (all ? all.map((value, k) => (k < 3 ? Math.min(value, one[k]!) : Math.max(value, one[k]!))) : [...one]), null)
    const a = boxOf(joint.a)
    const c = boxOf(joint.b)
    if (!a || !c) return null
    const point: Vec3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) point[k] = (Math.max(a[k]!, c[k]!) + Math.min(a[k + 3]!, c[k + 3]!)) / 2
    return point
  }

  /** The piece of a group split off hangs on its hinge (`hingeOf`), when it had one. */
  private hangOnHinge(newId: string, hinge: Vec3 | null): void {
    const piece = hinge && this.bounds.get(newId)?.piece
    if (piece && hinge) this.pieceSys.hinge(piece, hinge)
  }

  private adoptSplit(from: Bound, newId: string): void {
    const state = this.world.state(newId)
    const root = from.root
    root.updateWorldMatrix(true, false)
    const group = new this.THREE.Group()
    group.name = `destruction-piece-${newId}`
    // a piece is drawn by this renderer from the meshes of the object it came off (CLAUDE.md, "where every drawn piece comes from"); its kind stays out of the source's checks
    markKitOrigin(group, { owner: 'game-destruction-three', kind: 'piece', id: kitOriginOf(root)?.id ?? from.id })
    root.getWorldPosition(group.position)
    root.getWorldQuaternion(group.quaternion)
    this.scene.add(group)
    group.updateMatrixWorld(true)
    const nb: Bound = { id: newId, root: group, sync: true, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: true }
    for (const p of state?.parts ?? []) {
      const pv = from.parts.get(p.id)
      if (!pv) continue
      from.parts.delete(p.id)
      nb.parts.set(p.id, pv)
      // its bare bars go with it
      this.cages.move(`${from.id}|${p.id}`, `${newId}|${p.id}`, group)
      for (const mv of pv.meshes) {
        // a part drawn by a range of a merged mesh leaves its faces behind: it gets a mesh of its own
        if (mv.host && !mv.loose) this.visuals.extract(mv, group)
        else {
          group.attach(mv.mesh)
          showCollapsedRanges(mv.mesh)
          mv.moved = true
        }
      }
    }
    this.bounds.set(newId, nb)
    for (const pv of nb.parts.values()) this.tagPart(pv, newId)
    this.followSplit(from, nb)
    const meshes = this.meshesOf(nb)
    if (meshes.length === 0) return
    const { half, center } = this.measure(group, meshes)
    let vel: Vec3 = [0, 0, 0]
    let ang: Vec3 = [0, 0, 0]
    const op = from.piece
    if (op) {
      vel = [...op.velocity]
      ang = [...op.angularVelocity]
      // linear velocity at the loose piece's centre
      const c = this.pieceSys.centerOf(op, new this.THREE.Vector3())
      const nc = center.clone().applyQuaternion(group.quaternion).add(group.position)
      vel[0] += ang[1] * (nc.z - c.z) - ang[2] * (nc.y - c.y)
      vel[1] += ang[2] * (nc.x - c.x) - ang[0] * (nc.z - c.z)
      vel[2] += ang[0] * (nc.y - c.y) - ang[1] * (nc.x - c.x)
    }
    const piece = this.pieceSys.create(newId, group, half, center, this.massOf(newId), vel, ang)
    nb.piece = piece
    piece.apart = true
    this.fitSurface(nb, piece)
    // what lands on it meets its parts as drawn (a board come off with its books), not the box around them all: nothing invisible collides
    this.fitPartBoxes(nb, piece)
    // a group loose at load starts asleep where it stood when something holds it up, so nothing jumps; held by nothing, it falls
    const resting = this.splittingAtLoad && this.pieceSys.restIfSupported(piece)
    // what cannot stand where it stood (at load), and furniture come apart, stands on the corners of its parts as drawn (§12), not on its box: a top on one leg tips over it
    const furniture = kitOriginOf(from.root)?.kind === 'furniture'
    if (!resting && (this.splittingAtLoad || furniture) && !piece.round) this.setContacts(nb, piece, meshes.filter((mv) => this.visuals.shown(mv)))
    if (!resting && furniture) this.tipIfTopHeavy(nb)
    this.o.onPiece?.(piece)
  }

  /**
   * What lost what it stood on falls (furniture, a stand, a crate, a car; not a structure): with every leg of a table broken the top is loose, and with the legs of one side
   * gone what is left topples. Feet are the meshes at the bottom of the object as it was whole; while the ones left still span the same floor (a cupboard with a broken door,
   * a table missing one leg) it stands. A piece that lost a part is the box of what is left, touching the ground by the corners of each part (`setContacts`).
   */
  private loosenIfFootless(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b || !this.autoSplit) return
    const left = this.meshesOf(b).filter((mv) => this.visuals.shown(mv))
    if (left.length === 0) return
    // a house, a wall, the ground answer to their own load path: their pieces only take the box of what is left
    const structural = UNCHECKED_KINDS.has(this.kindOf(b))
    const body = b.piece ?? this.pieceSys.get(objectId)
    if (body) {
      // a piece is the box of what is left of it: the legs that broke off no longer hold it up
      const { half, center } = this.measure(b.root, left)
      body.halfExtents = half
      this.pieceSys.setCenter(body, center)
      body.mass = Math.max(MIN_PIECE_MASS_KG, this.massOf(objectId) - (body.massOffset ?? 0))
      body.apart = true
      if (!structural) {
        // what is left may be round (a can's label torn off) or not any more (a stool that lost its legs): its contacts follow
        this.fitSurface(b, body)
        if (!body.round) this.setContacts(b, body, left)
      }
      body.sleeping = false
      // furniture lying still on what is left of its legs (a bed with one shot off) is on the line between the two beside the gap: it goes down that way
      if (!structural && !body.round && !body.held && kitOriginOf(b.root)?.kind === 'furniture' && Math.hypot(...body.velocity) <= UNDERMINED_STILL) this.goOverIfBalanced(b, body, left)
      return
    }
    // what is still set in the ground or fixed to a wall (a pole, a mast) stands by its own load path too, however little of its foot is drawn
    if (structural || this.heldByWorld(objectId)) return
    const boxOf = (mv: MeshVis): THREE_NS.Box3 => this.visuals.worldBox(mv, new this.THREE.Box3())
    const whole = [...b.parts.values()].flatMap((pv) => pv.meshes).map(boxOf).filter((one) => !one.isEmpty())
    // what hangs (a wall cabinet, a lamp) is held by what it hangs on: only what stood on something can lose its footing
    if (!this.standsOn(objectId, whole.map((one): [number, number, number, number, number, number] => [one.min.x, one.min.y, one.min.z, one.max.x, one.max.y, one.max.z]))) return
    const floor = Math.min(...whole.map((one) => one.min.y))
    const feetOf = (boxes: THREE_NS.Box3[]): THREE_NS.Box3 => boxes.filter((one) => one.min.y < floor + FEET_BAND).reduce((feet, one) => feet.union(one), new this.THREE.Box3())
    const leftBoxes = left.map(boxOf).filter((one) => !one.isEmpty())
    const now = feetOf(leftBoxes)
    // it stands while the centre of what is left is inside the polygon of its feet by `STAND_MARGIN` (a cupboard with a broken door); a table that lost a leg has its
    // centre on the line between the two legs beside the gap, balanced on an edge, and goes over toward the gap
    let away: { x: number; z: number } | null = null
    const was = feetOf(whole)
    const same = !now.isEmpty() && now.min.x <= was.min.x + FEET_BAND && now.max.x >= was.max.x - FEET_BAND && now.min.z <= was.min.z + FEET_BAND && now.max.z >= was.max.z - FEET_BAND
    // what is not furniture (a frame, a stand) keeps standing while its feet still span the same floor: its own load path answers for it
    if (same && kitOriginOf(b.root)?.kind !== 'furniture') return
    if (!now.isEmpty()) {
      const feet = leftBoxes.filter((one) => one.min.y < floor + FEET_BAND)
      const hull = convexHull(feet.flatMap((one) => [[one.min.x, one.min.z], [one.max.x, one.min.z], [one.max.x, one.max.z], [one.min.x, one.max.z]] as Array<[number, number]>))
      const centre = centreOfBoxes(leftBoxes)
      const inside = insideBy(hull, [centre[0], centre[2]])
      const box = leftBoxes.reduce((all, one) => all.union(one), new this.THREE.Box3())
      const height = box.max.y - box.min.y
      const narrow = height >= TIP_MIN_HEIGHT && Math.min(now.max.x - now.min.x, now.max.z - now.min.z) < TIP_NARROW * height
      if (!narrow && inside.depth > STAND_LEAN * (centre[1] - floor)) return
      away = hull.length >= 3 ? inside.out : null
    }
    const piece = this.makePiece(objectId)
    ;(b.piece ?? (piece as PieceBody)).apart = true
    this.setContacts(b, b.piece ?? (piece as PieceBody), left)
    // balanced on an edge it is started over it, and gravity does the rest: turning about (z, 0, -x) moves the top toward (x, z)
    const loose = b.piece
    if (away && loose) {
      loose.angularVelocity[0] += away.z * EDGE_NUDGE
      loose.angularVelocity[2] -= away.x * EDGE_NUDGE
      loose.sleeping = false
    } else this.tipIfTopHeavy(b)
    // the host stops keeping the footprint it had where it stood: it is a body that moves now
    this.o.onLoosened?.(objectId, piece, 'apart')
  }

  shownBoxes(objectId: string, partId?: string): Array<[number, number, number, number, number, number]> {
    const b = this.bounds.get(objectId)
    if (!b) return []
    const box = new this.THREE.Box3()
    const out: Array<[number, number, number, number, number, number]> = []
    const pv = partId === undefined ? null : b.parts.get(partId)
    if (partId !== undefined && (!pv || pv.gone !== 'none')) return out
    for (const mv of pv ? pv.meshes : this.meshesOf(b)) {
      if (!this.visuals.shown(mv)) continue
      this.visuals.worldBox(mv, box)
      if (!box.isEmpty()) out.push([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z])
    }
    return out
  }

  /**
   * What is left of each object broken since the last update stands on something, or falls: an object that is not a piece whose lowest drawn box has neither the ground, a
   * fixed top nor a piece within `BROKEN_GAP` under it is made a piece on the spot (see `onBrokenChecked`).
   */
  private checkBroken(): void {
    if (this.broken.size === 0) return
    const ids = [...this.broken]
    this.broken.clear()
    for (const id of ids) {
      const released = this.releaseIfFloating(id)
      this.o.onBrokenChecked?.(id, released)
    }
  }

  private releaseIfFloating(objectId: string): boolean {
    const b = this.bounds.get(objectId)
    if (!b || b.piece || this.pieceSys.get(objectId) || !this.autoSplit || UNCHECKED_KINDS.has(this.kindOf(b)) || this.heldByWorld(objectId)) return false
    const boxes = this.shownBoxes(objectId)
    if (boxes.length === 0) return false
    // the object as it was whole (it has not moved: it is no piece): one that hung (a wall cabinet, a lamp) is held by what it hangs on, not checked here
    const whole = new this.THREE.Box3()
    const wholeBoxes: Array<[number, number, number, number, number, number]> = []
    for (const pv of b.parts.values()) {
      for (const mv of pv.meshes) {
        this.visuals.worldBox(mv, whole)
        if (!whole.isEmpty()) wholeBoxes.push([whole.min.x, whole.min.y, whole.min.z, whole.max.x, whole.max.y, whole.max.z])
      }
    }
    if (!this.standsOn(objectId, wholeBoxes) || this.standsOn(objectId, boxes)) return false
    const piece = this.makePiece(objectId)
    ;(b.piece ?? (piece as PieceBody)).apart = true
    this.setContacts(b, b.piece ?? (piece as PieceBody), this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
    this.tipIfTopHeavy(b)
    this.o.onLoosened?.(objectId, piece, 'apart')
    return true
  }

  /**
   * The ground changed under what stands on feet (`wakeRegion`: a hole shot, dug or blown in the floor): furniture and what the host lets move (`shoveable`), not a piece yet or
   * a piece lying still. It looks at its feet again (`lowPoints`): a point of them with nothing left under it (`holdsAt`) no longer holds. While the points that still hold keep its
   * centre inside their polygon by `UNDERMINED_STAND` it stands (a cabinet on a full base over a small hole); otherwise it becomes a piece if it was not one, its corner over the
   * gap is started down, and the engine takes it into the hole by its own weight: a bed with a leg over the hole goes down on that corner until its frame meets the floor, and
   * what lay on it slides or falls off. Structures answer to their own load path.
   */
  private checkUndermined(): void {
    if (this.undermined.length === 0) return
    const discs = this.undermined.splice(0)
    const inDisc = (x: number, z: number, d: { x: number; z: number; radius: number }): boolean => Math.hypot(x - d.x, z - d.z) <= d.radius
    for (const b of [...this.bounds.values()]) {
      // what stands on feet: furniture, and what the host lets move though heavy (`shoveable`); a wall or a house answers to its own load path, rubble and small things
      // lie on the ground by their whole box and the pieces find it again by themselves (`PieceSystem.wakeRegion`)
      if (this.kindOf(b) !== 'furniture' && !this.o.shoveable?.(b.id)) continue
      const was = b.piece ?? this.pieceSys.get(b.id) ?? null
      // a piece on the move finds the new ground by itself; one that lay still on it (asleep, or just woken by the same change) is looked at like what is not a piece yet
      if (was && (was.held || Math.hypot(...was.velocity) > UNDERMINED_STILL)) continue
      const meshes = this.meshesOf(b).filter((mv) => this.visuals.shown(mv))
      const boxes = meshes.map((mv) => this.visuals.worldBox(mv, new this.THREE.Box3())).filter((one) => !one.isEmpty())
      if (boxes.length === 0) continue
      const reach = boxes.reduce((all, one) => all.union(one), new this.THREE.Box3())
      if (!discs.some((d) => Math.hypot(Math.max(reach.min.x - d.x, 0, d.x - reach.max.x), Math.max(reach.min.z - d.z, 0, d.z - reach.max.z)) <= d.radius)) continue
      // the feet are the points it is drawn lowest by (the bottoms of its legs, the base of a cabinet), read from its vertices: a mesh merged from the frame and the legs
      // has a box that reaches the floor everywhere under it, the legs do not
      const feet = this.lowPoints(meshes)
      if (!feet) continue
      const { floor, points } = feet
      const held: Array<[number, number]> = []
      const lost: Array<[number, number]> = []
      for (const point of points) (this.holdsAt(b.id, point[0], point[1], floor) ? held : lost).push(point)
      if (lost.length === 0) continue
      // only what stood on that ground loses it: the floor just past the disc, toward the foot, is where its feet were (a wall cabinet over a crater never stood there)
      if (!lost.some(([x, z]) => discs.some((d) => inDisc(x, z, d) && this.stoodBeside(x, z, d, floor)))) continue
      const centre = centreOfBoxes(boxes)
      if (this.standsWith(held, points, centre, floor)) continue
      let body: PieceBody
      if (was) body = was
      else {
        const piece = this.makePiece(b.id)
        body = b.piece ?? (piece as PieceBody)
        body.apart = true
        this.setContacts(b, body, meshes, true)
      }
      // started down over the gap (the middle of the feet that went), and its weight does the rest
      const gx = lost.reduce((sum, p) => sum + p[0], 0) / lost.length - centre[0]
      const gz = lost.reduce((sum, p) => sum + p[1], 0) / lost.length - centre[2]
      const length = Math.hypot(gx, gz)
      body.sleeping = false
      body.still = 0
      body.calmAt = null
      if (held.length > 0 && length > 1e-6) this.pieceSys.impulse(body, [0, -body.mass * UNDERMINED_PUSH, 0], [centre[0] + gx, floor, centre[2] + gz])
      if (!was) this.o.onLoosened?.(b.id, body, 'ground')
    }
  }

  /**
   * A piece whose feet that still hold keep its centre inside their polygon by less than `UNDERMINED_STAND` per metre of its height is started down over the nearest edge of
   * that polygon (its weight does the rest); one that stands on nothing falls by itself.
   */
  private goOverIfBalanced(b: Bound, body: PieceBody, meshes: readonly MeshVis[]): void {
    const feet = this.lowPoints(meshes)
    if (!feet) return
    const held = feet.points.filter(([x, z]) => this.holdsAt(b.id, x, z, feet.floor))
    if (held.length < 3) return
    const centre = centreOfBoxes(meshes.map((mv) => this.visuals.worldBox(mv, new this.THREE.Box3())).filter((one) => !one.isEmpty()))
    // the feet it had whole are not drawn any more (the leg is gone): only its height says how far in the centre must be
    if (this.standsWith(held, null, centre, feet.floor)) return
    const inside = insideBy(convexHull(held), [centre[0], centre[2]])
    const reach = Math.max(body.halfExtents[0], body.halfExtents[2])
    this.pieceSys.impulse(body, [0, -body.mass * UNDERMINED_PUSH, 0], [centre[0] + inside.out.x * reach, feet.floor, centre[2] + inside.out.z * reach])
  }

  /**
   * Whether what stands on the points `held` of its feet (`all` of them whole) stays up with its centre at `centre`: the centre is inside what holds by `UNDERMINED_STAND` per metre of its height above `floor`, or it keeps
   * most of the hold it had (`UNDERMINED_KEEP` of how far inside its whole feet `all` the centre was; null when those are gone with a leg).
   */
  private standsWith(held: ReadonlyArray<[number, number]>, all: ReadonlyArray<[number, number]> | null, centre: readonly [number, number, number], floor: number): boolean {
    if (held.length < 3) return false
    const now = insideBy(convexHull([...held]), [centre[0], centre[2]]).depth
    if (now > UNDERMINED_STAND * (centre[1] - floor)) return true
    return all !== null && now >= UNDERMINED_KEEP * insideBy(convexHull([...all]), [centre[0], centre[2]]).depth
  }

  /**
   * Where `meshes` touch the floor, (x, z) in the world, and how high that floor is (their lowest drawn point); null with nothing drawn. The bottom faces (triangles
   * within `FEET_BAND` of the lowest point) give their corners, the middles of their sides and their own middles: the base of a cabinet is held along its edges and
   * across, not only at its four corners, and a mesh merged from a frame and its legs is held under each leg, not in the air between them.
   */
  private lowPoints(meshes: readonly MeshVis[]): { floor: number; points: Array<[number, number]> } | null {
    const faces: number[] = []
    let floor = Infinity
    for (const mv of meshes) {
      mv.mesh.updateWorldMatrix(true, false)
      const points: number[] = []
      this.visuals.rangePoints(mv, mv.mesh.matrixWorld, points)
      const count = points.length / 3
      const index = mv.mesh.geometry.getIndex()?.array
      const from = mv.range ? mv.range[0] : 0
      const total = index ? index.length : count
      for (let i = 0; i + 2 < total; i += 3) {
        const a = (index ? index[i]! : i) - from, b = (index ? index[i + 1]! : i + 1) - from, c = (index ? index[i + 2]! : i + 2) - from
        if (a < 0 || b < 0 || c < 0 || a >= count || b >= count || c >= count) continue
        for (const k of [a, b, c]) {
          faces.push(points[k * 3]!, points[k * 3 + 1]!, points[k * 3 + 2]!)
          floor = Math.min(floor, points[k * 3 + 1]!)
        }
      }
    }
    if (faces.length === 0) return null
    const out: Array<[number, number]> = []
    const seen = new Set<string>()
    const add = (x: number, z: number): void => {
      // the same corner is in several faces: once each, to the millimetre
      const key = `${Math.round(x * 1000)},${Math.round(z * 1000)}`
      if (seen.has(key)) return
      seen.add(key)
      out.push([x, z])
    }
    for (let i = 0; i < faces.length; i += 9) {
      if (faces[i + 1]! > floor + FEET_BAND || faces[i + 4]! > floor + FEET_BAND || faces[i + 7]! > floor + FEET_BAND) continue
      const ax = faces[i]!, az = faces[i + 2]!, bx = faces[i + 3]!, bz = faces[i + 5]!, cx = faces[i + 6]!, cz = faces[i + 8]!
      add(ax, az)
      add(bx, bz)
      add(cx, cz)
      add((ax + bx) / 2, (az + bz) / 2)
      add((bx + cx) / 2, (bz + cz) / 2)
      add((ax + cx) / 2, (az + cz) / 2)
      add((ax + bx + cx) / 3, (az + bz + cz) / 3)
    }
    return out.length > 0 ? { floor, points: out } : null
  }

  /** Whether the ground, a fixed top or a piece (not `objectId` itself) is within `BROKEN_GAP` under the point (x, z) of a foot at height `y`. */
  private holdsAt(objectId: string, x: number, z: number, y: number): boolean {
    return Math.max(this.groundAt(x, z), this.staticTopAtBut(objectId, x, z, y, BROKEN_GAP), this.pieceSys.topAt(x, z, y, BROKEN_GAP, objectId)) >= y - BROKEN_GAP
  }

  /** Whether the ground just past the disc `d`, on the way from its middle to the foot at (x, z), is where the object's feet (`floor`) were: it stood on the ground that went. */
  private stoodBeside(x: number, z: number, d: { x: number; z: number; radius: number }, floor: number): boolean {
    const fx = x - d.x, fz = z - d.z
    const length = Math.hypot(fx, fz)
    const ux = length > 1e-6 ? fx / length : 1, uz = length > 1e-6 ? fz / length : 0
    const reach = d.radius + UNDERMINED_RIM
    const ground = this.groundAt(d.x + ux * reach, d.z + uz * reach)
    return ground >= floor - BROKEN_GAP - UNDERMINED_RIM_DROP && ground <= floor + UNDERMINED_RIM_RISE
  }

  /** Whether the lowest of `boxes` (world boxes of the object `objectId`) has the ground, a fixed top or a piece within `BROKEN_GAP` under it. */
  private standsOn(objectId: string, boxes: ReadonlyArray<readonly [number, number, number, number, number, number]>): boolean {
    if (boxes.length === 0) return false
    const low = Math.min(...boxes.map((one) => one[1]))
    for (const [x0, y0, z0, x1, , z1] of boxes) {
      if (y0 > low + FEET_BAND) continue
      for (const [fx, fz] of BROKEN_SAMPLES) {
        const x = x0 + (x1 - x0) * fx
        const z = z0 + (z1 - z0) * fz
        const under = Math.max(this.groundAt(x, z), this.staticTopAtBut(objectId, x, z, y0, BROKEN_GAP), this.pieceSys.topAt(x, z, y0, BROKEN_GAP, objectId))
        if (under >= y0 - BROKEN_GAP) return true
      }
    }
    return false
  }

  /** The kind of kit piece a bound object is, by the mark on its root or the nearest one above it (a house binds a group inside its marked root); '' when unmarked. */
  /** Whether what is left of the object is fixed where it was laid and still anchored (`DestructionWorld.fixedInPlace`): it stands by its load path, it is never let go as a piece. */
  private heldByWorld(objectId: string): boolean {
    return this.world.fixedInPlace(objectId)
  }

  private kindOf(b: Bound): string {
    for (let o: THREE_NS.Object3D | null = b.root; o; o = o.parent) {
      const kind = kitOriginOf(o)?.kind
      if (kind) return kind
    }
    return ''
  }

  /** The top of the ground or of a standing part of the world under (x, z), below height y: a ray straight down through the destruction world. */
  private surfaceAt(x: number, y: number, z: number): number {
    const ground = this.groundAt(x, z)
    // a world that casts no rays (a stand-in in a test) has only the ground to land on
    if (y <= ground || typeof this.world.raycast !== 'function') return ground
    // a piece of rubble spawned inside a part (the top course of a wall under its bond beam) sees that part first, at no distance: look under it
    let from = y
    for (let k = 0; k < SURFACE_RAYS && from > ground; k++) {
      const hit = this.world.raycast([x, from, z], [0, -1, 0], from - ground)
      if (!hit) return ground
      if (hit.distance > SURFACE_INSIDE) return Math.max(ground, hit.point[1])
      from -= SURFACE_STEP
    }
    return ground
  }

  /** `staticTopAt` without the boxes of `objectId` itself. */
  private staticTopAtBut(objectId: string, x: number, z: number, y: number, step: number): number {
    let top = -Infinity
    for (const [id, a] of this.staticNow()) {
      if (id === objectId || a.length === 0 || x < a[0] || x > a[3] || z < a[2] || z > a[5]) continue
      for (let i = 6; i < a.length; i += 6) {
        if (x < a[i] || x > a[i + 3] || z < a[i + 2] || z > a[i + 5]) continue
        const t = a[i + 4]
        if (t > top && t <= y + step) top = t
      }
    }
    return top
  }

  /**
   * The piece touches the ground by the corners of each part left of it, not by the box around them all: on one leg, or on the legs of one side, its centre of mass is off
   * what holds it and it goes over until the top meets the floor. Past `CONTACT_MESHES` meshes it keeps the corners of its box; up to `PART_BOX_MESHES`, what lands on it lands
   * on its parts.
   */
  private setContacts(b: Bound, body: PieceBody, meshes: MeshVis[], fitWhole = false): void {
    if (meshes.length > PART_BOX_MESHES) {
      body.contacts = undefined
      body.partBoxes = undefined
      return
    }
    const inv = specFrameInverse(this.THREE, b.root)
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    const [cx, cy, cz] = body.localCenter
    const points: Vec3[] = []
    const boxes: PartBox[] = []
    for (const mv of meshes) {
      mv.mesh.updateWorldMatrix(true, false)
      this.visuals.localBox(mv, lb)
      if (lb.isEmpty()) continue
      m4.multiplyMatrices(inv, mv.mesh.matrixWorld)
      this.partBoxesOf(mv, { lb, m4, from: [cx, cy, cz], fitWhole }, boxes)
      lb.applyMatrix4(m4)
      for (let i = 0; i < 8; i++) points.push([(i & 1 ? lb.max.x : lb.min.x) - cx, (i & 2 ? lb.max.y : lb.min.y) - cy, (i & 4 ? lb.max.z : lb.min.z) - cz])
    }
    body.contacts = points.length > 0 && meshes.length <= CONTACT_MESHES ? points : undefined
    // one box turned as drawn (a roof sheet lying askew) is kept too: the box of the piece would be the air around it
    body.partBoxes = boxes.length > 1 || (boxes.length === 1 && isTurned(boxes[0])) ? boxes : undefined
    body.massCentre = this.massCentreOf(b, body)
  }

  /** Where the weight of what is drawn of `b` is, from the middle of its box (`PieceBody.massCentre`): each part's box centre weighed by the part's mass. */
  private massCentreOf(b: Bound, body: PieceBody): Vec3 | undefined {
    if (b.parts.size < 2) return undefined
    const inv = specFrameInverse(this.THREE, b.root)
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    const box = new this.THREE.Box3()
    const middle = new this.THREE.Vector3()
    let weight = 0
    const sum: Vec3 = [0, 0, 0]
    for (const [partId, pv] of b.parts) {
      const mass = pv.gone === 'none' ? (this.world.part(b.id, partId)?.mass ?? 0) : 0
      if (mass <= 0) continue
      box.makeEmpty()
      for (const mv of pv.meshes) {
        if (!this.visuals.shown(mv)) continue
        mv.mesh.updateWorldMatrix(true, false)
        this.visuals.localBox(mv, lb)
        if (!lb.isEmpty()) box.union(lb.applyMatrix4(m4.multiplyMatrices(inv, mv.mesh.matrixWorld)))
      }
      if (box.isEmpty()) continue
      box.getCenter(middle)
      sum[0] += middle.x * mass; sum[1] += middle.y * mass; sum[2] += middle.z * mass
      weight += mass
    }
    if (weight <= 0) return undefined
    const [cx, cy, cz] = body.localCenter
    return [sum[0] / weight - cx, sum[1] / weight - cy, sum[2] / weight - cz]
  }

  /** `fitOrientedBoxes` of a ranged part's points, taken from what it gave before when the points and the triangles are the very same numbers. */
  private fitRanged(mv: MeshVis, points: number[]): ReturnType<typeof fitOrientedBoxes> {
    const triangles = this.trianglesOf(mv)
    const kept = this.fittedBoxes.get(mv)
    if (kept && sameNumbers(kept.points, points) && sameNumbers(kept.triangles, triangles)) return kept.boxes
    const boxes = fitOrientedBoxes(points, triangles)
    this.fittedBoxes.set(mv, { points, triangles, boxes })
    return boxes
  }

  /** Queue the ranged parts of a bound object to be fitted while a frame has time to spare, read the way `setContacts` reads them while the object stands where it is. */
  private prefitPartBoxes(b: Bound): void {
    const parts = this.meshesOf(b).filter((mv) => mv.range && mv.host && !mv.loose)
    if (parts.length > 0) this.prefitting.push({ b, parts, next: 0 })
  }

  private prefitLeft(): number {
    let left = 0
    for (const job of this.prefitting) left += job.parts.length - job.next
    return left
  }

  /** Fit queued parts one at a time until the deadline, one at least. Returns the parts taken off the queue. */
  private runPrefit(deadline: number, clock: () => number): number {
    let ran = 0
    const frames = new Map<Bound, THREE_NS.Matrix4>()
    while (this.prefitting.length > 0 && (ran === 0 || clock() < deadline)) {
      this.prefitOne(frames)
      ran++
    }
    return ran
  }

  /** With no budget running the fitting ahead (`prefitQueue`): inside the events drain, for `PREFIT_SLICE_MS` or what is left of `deadline` (one part at least when `force`: nothing else ran). */
  private runPrefitDetached(deadline: number, clock: () => number, force: boolean): number {
    if (this.prefitAttached) return 0
    const left = deadline - clock()
    if (left <= 0 && !force) return 0
    return drainDetached(this.prefitQueue, Math.min(left, PREFIT_SLICE_MS), clock)
  }

  /** Under `workBudget`: the queued parts fitted ahead while their units fit in what the frame left (`perVertex` of the part's range), never by the clock. */
  private runPrefitWork(work: WorkBudget): number {
    let ran = 0
    const frames = new Map<Bound, THREE_NS.Matrix4>()
    while (this.prefitting.length > 0) {
      const job = this.prefitting[0]!
      const mv = job.parts[job.next]
      const units = mv?.range ? this.workCosts.perVertex * (mv.range[1] - mv.range[0]) : 0
      if (units > 0 && !work.tryTake('prefit', units)) break
      if (this.prefitOne(frames)) ran++
    }
    return ran
  }

  /** The next queued part fitted ahead; false when it was skipped (gone, loose, or its object unbound). */
  private prefitOne(frames: Map<Bound, THREE_NS.Matrix4>): boolean {
    const job = this.prefitting[0]!
    const mv = job.parts[job.next++]
    if (job.next >= job.parts.length) this.prefitting.shift()
    if (!mv || this.bounds.get(job.b.id) !== job.b) {
      if (this.prefitting[0] === job) this.prefitting.shift()
      return false
    }
    if (!mv.range || !mv.host || mv.loose) return false
    let inverse = frames.get(job.b)
    if (!inverse) frames.set(job.b, (inverse = specFrameInverse(this.THREE, job.b.root)))
    mv.mesh.updateWorldMatrix(true, false)
    const m4 = new this.THREE.Matrix4().multiplyMatrices(inverse, mv.mesh.matrixWorld)
    this.partBoxesOf(mv, { lb: new this.THREE.Box3(), m4, from: [0, 0, 0] }, [])
    return true
  }

  /** The triangles of a ranged part as vertex numbers of its own range (three each): the surface its vertices are joined by. A loose part is read from the buffer itself, not from what the host keeps for the parts that still hang on it. */
  private trianglesOf(mv: MeshVis): number[] {
    const [from, to] = mv.range ?? [0, 0]
    const index = mv.mesh.geometry.getIndex()?.array
    const count = index ? index.length : (mv.mesh.geometry.getAttribute('position')?.count ?? 0)
    const own: number[] = []
    for (let i = 0; i + 2 < count; i += 3) {
      const a = index ? index[i]! : i
      const b = index ? index[i + 1]! : i + 1
      const c = index ? index[i + 2]! : i + 2
      if (a < from || a >= to || b < from || b >= to || c < from || c >= to) continue
      own.push(a - from, b - from, c - from)
    }
    return own
  }

  /**
   * The boxes of one mesh in the piece's frame, from its centre of mass, turned as the mesh is drawn: a mesh drawn as boxes round the air is those boxes (`hollowBoxesOf`);
   * else a plain mesh is its geometry's box in its own space, turned by its place in the piece; a part drawn by a range of a merged mesh (a roof sheet in the house's roof mesh) is fitted to its own vertices (`fitOrientedBoxes`), since the box
   * of those vertices in the merged mesh's space is the box around a tilted sheet, mostly air.
   */
  private partBoxesOf(mv: MeshVis, at: { readonly lb: THREE_NS.Box3; readonly m4: THREE_NS.Matrix4; readonly from: Vec3; readonly fitWhole?: boolean }, out: PartBox[]): void {
    const [cx, cy, cz] = at.from
    // a mesh of its own that says what it was built from (spec 019) is held by that, box by box: nothing is read back from its vertices
    const built = mv.range ? null : builtSolidsOf(mv.mesh)
    // a whole mesh drawn as more than one solid (a frame and its legs merged in one geometry) that says nothing of how it was built stands on each of them when asked
    // (`checkUndermined`): its one box would stand over the hole
    const solids = at.fitWhole && !mv.range && !built ? solidBoxesOf(mv.mesh.geometry) : null
    if (solids) {
      const pos = new this.THREE.Vector3()
      const quat = new this.THREE.Quaternion()
      const scale = new this.THREE.Vector3()
      at.m4.decompose(pos, quat, scale)
      for (const box of solids) {
        const c = new this.THREE.Vector3((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2).applyMatrix4(at.m4)
        const half: Vec3 = [Math.max(0.005, Math.abs((box[3] - box[0]) * scale.x) / 2), Math.max(0.005, Math.abs((box[4] - box[1]) * scale.y) / 2), Math.max(0.005, Math.abs((box[5] - box[2]) * scale.z) / 2)]
        out.push({ center: [c.x - cx, c.y - cy, c.z - cz], half, rotation: [quat.x, quat.y, quat.z, quat.w] })
      }
      return
    }
    if (built) {
      const pos = new this.THREE.Vector3()
      const quat = new this.THREE.Quaternion()
      const scale = new this.THREE.Vector3()
      at.m4.decompose(pos, quat, scale)
      const c = new this.THREE.Vector3()
      const q = new this.THREE.Quaternion()
      const even = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3
      for (const solid of built) {
        c.set(solid.center[0], solid.center[1], solid.center[2]).applyMatrix4(at.m4)
        q.set(solid.rotation[0], solid.rotation[1], solid.rotation[2], solid.rotation[3])
        const turned = Math.abs(q.w) < 1 - 1e-9
        const s: Vec3 = turned ? [even, even, even] : [Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)]
        q.premultiply(quat).normalize()
        const round = isRoundSolid(solid) && Math.abs(s[0] - s[2]) <= 1e-9
        out.push({ center: [c.x - cx, c.y - cy, c.z - cz], half: [Math.max(0.005, solid.half[0] * s[0]), Math.max(0.005, solid.half[1] * s[1]), Math.max(0.005, solid.half[2] * s[2])], rotation: [q.x, q.y, q.z, q.w], ...(round ? { round: true as const } : {}) })
      }
      return
    }
    // a mesh drawn as boxes with air between them (a kennel's boards, a door frame, the two slabs of a roof) is held box by box, ranged or not: the box around them is not drawn
    const own: number[] = []
    this.visuals.rangePoints(mv, new this.THREE.Matrix4(), own)
    const drawn = hollowBoxesOf(own, mv.range ? RANGED : OWN_MESH)
    if (drawn) {
      const pos = new this.THREE.Vector3()
      const quat = new this.THREE.Quaternion()
      const scale = new this.THREE.Vector3()
      at.m4.decompose(pos, quat, scale)
      const c = new this.THREE.Vector3()
      const q = new this.THREE.Quaternion()
      // a turned box keeps its shape under one scale only: the mean of the three stands for a mesh scaled unevenly
      const even = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3
      for (const box of drawn) {
        c.set(box.center[0]!, box.center[1]!, box.center[2]!).applyMatrix4(at.m4)
        const half: Vec3 = box.rotation ? [box.half[0]! * even, box.half[1]! * even, box.half[2]! * even] : [Math.abs(box.half[0]! * scale.x), Math.abs(box.half[1]! * scale.y), Math.abs(box.half[2]! * scale.z)]
        if (box.rotation) q.set(box.rotation[0]!, box.rotation[1]!, box.rotation[2]!, box.rotation[3]!).premultiply(quat).normalize()
        else q.copy(quat)
        // a mesh of its own may draw a sheet with no thickness (a liner): it is held 1 cm thick, as a plain mesh's box is; a part of a merged mesh is held as it always was
        const thin = mv.range ? 0 : 0.005
        out.push({ center: [c.x - cx, c.y - cy, c.z - cz], half: [Math.max(thin, half[0]), Math.max(thin, half[1]), Math.max(thin, half[2])], rotation: [q.x, q.y, q.z, q.w] })
      }
      return
    }
    if (mv.range) {
      // fitted in the mesh's own space, which a split or a move does not change, and carried into the piece by the pose: the same boxes, turned and moved, with no fit
      if (isRigidPose(at.m4.elements)) {
        const turn = new this.THREE.Quaternion().setFromRotationMatrix(at.m4)
        const c = new this.THREE.Vector3()
        const q = new this.THREE.Quaternion()
        for (const box of this.fitRanged(mv, own)) {
          c.set(box.center[0], box.center[1], box.center[2]).applyMatrix4(at.m4)
          q.set(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]).premultiply(turn).normalize()
          out.push({ center: [c.x - cx, c.y - cy, c.z - cz], half: [...box.half], rotation: [q.x, q.y, q.z, q.w] })
        }
        return
      }
      const pts: number[] = []
      this.visuals.rangePoints(mv, at.m4, pts)
      for (const box of this.fitRanged(mv, pts)) out.push({ center: [box.center[0] - cx, box.center[1] - cy, box.center[2] - cz], half: [...box.half], rotation: [...box.rotation] })
      return
    }
    const pos = new this.THREE.Vector3()
    const quat = new this.THREE.Quaternion()
    const scale = new this.THREE.Vector3()
    at.m4.decompose(pos, quat, scale)
    const c = at.lb.getCenter(new this.THREE.Vector3()).applyMatrix4(at.m4)
    const size = at.lb.getSize(new this.THREE.Vector3())
    const half: Vec3 = [Math.max(0.005, Math.abs(size.x * scale.x) / 2), Math.max(0.005, Math.abs(size.y * scale.y) / 2), Math.max(0.005, Math.abs(size.z * scale.z) / 2)]
    // a mesh made as one straight whole cylinder (`CylinderGeometry`) is held as that cylinder; one made as another round primitive (half a log, a cone, a ball) as the
    // hull of its vertices: never as the box around it, whose corners are air
    const geometry = mv.mesh.geometry as PrimitiveGeometry
    const params = geometry.parameters ?? {}
    const whole = typeof params.thetaLength !== 'number' || Math.abs(params.thetaLength - 2 * Math.PI) < 1e-6
    const cylinder = geometry.type === 'CylinderGeometry' && !mv.range
    const straight = cylinder && whole && params.openEnded !== true && isRoundSolid({ kind: params.radiusTop === params.radiusBottom ? 'cylinder' : 'cone', half })
    const curved = !mv.range && !straight && (cylinder || geometry.type === 'ConeGeometry' || geometry.type === 'SphereGeometry')
    out.push({ center: [c.x - cx, c.y - cy, c.z - cz], half, rotation: [quat.x, quat.y, quat.z, quat.w], ...(straight ? { round: true as const } : {}), ...(curved ? { hull: this.hullOf(mv, at.lb, scale) } : {}) })
  }

  /**
   * A piece of furniture standing on feet too close for its height (a board on two legs in a line, a lone leg) does not stay up: the box of a piece hides that its weight is up
   * high and its feet are thin, so it gets the start of the fall, across the line of its feet. `isStandingWhenCentred`: what is left after a part came off stands when it is
   * centred over feet wide enough (`TIP_STANDING_FEET`, `TIP_CENTRED`).
   */
  private tipIfTopHeavy(b: Bound, isStandingWhenCentred = false): void {
    const piece = b.piece
    if (!piece) return
    const box = new this.THREE.Box3()
    const boxes = this.meshesOf(b).filter((mv) => this.visuals.shown(mv)).map((mv) => this.visuals.worldBox(mv, new this.THREE.Box3()))
    if (boxes.length === 0) return
    for (const one of boxes) box.union(one)
    const height = box.max.y - box.min.y
    const feet = new this.THREE.Box3()
    for (const one of boxes) if (one.min.y < box.min.y + FEET_BAND) feet.union(one)
    const spanX = feet.max.x - feet.min.x
    const spanZ = feet.max.z - feet.min.z
    if (height < TIP_MIN_HEIGHT || Math.min(spanX, spanZ) >= TIP_NARROW * height) return
    const across = spanX <= spanZ ? 0 : 2
    const lean = across === 0 ? box.min.x + box.max.x - feet.min.x - feet.max.x : box.min.z + box.max.z - feet.min.z - feet.max.z
    const span = Math.min(spanX, spanZ)
    if (isStandingWhenCentred && span >= TIP_STANDING_FEET && Math.abs(lean) / 2 < TIP_CENTRED * span) return
    const away = lean < 0 ? -1 : 1
    // rotating about -z moves the top toward +x; rotating about +x moves it toward +z
    if (across === 0) this.pieceSys.tip(piece, 0, -away)
    else this.pieceSys.tip(piece, away, 0)
  }

  private onExplode(ev: Ev<'explode'>, options: ExplodeOptions = {}): void {
    const p = ev.point
    if (options.visual !== false) this.playExplosion(ev, options)
    this.vfx.push(p, ev.radius, 4)
    this.pieceSys.layGroundAt(p[0], p[2], ev.radius)
    // shove pieces and fragments
    const c = this.v1
    const report = options.report
    const confinement = report?.find((r) => r.blast !== undefined)?.blast?.confinement ?? 1
    const energy = ev.energy * confinement
    // the energy that got to an object after what stood in the way: the world's shelter of this blast when it carries one, else the cover between the centre and the
    // object's centre (`blastReach`, always on: a wall, a car or a cupboard between them takes the push), as it stood when the part went off: the cupboard the wave
    // tears apart still met it, and the stove it throws was not in the way yet
    const wentOff = this.coverWhenWentOff.get(ev)
    const reachOf = (objectId: string, at: Vec3): number =>
      report?.find((r) => r.object === objectId)?.blast?.shelter ??
      wentOff?.get(objectId) ??
      this.world.blastReach?.(p, at, { ignore: ev.object ? [ev.object, objectId] : [objectId] }) ??
      1
    // with a debris policy the shove waits its turn in the wake queue (nearest the player first, else the centre), sized by the measured step cost: not the whole pile in the blast's frame
    const policy = this.blastDebris ? resolveBlastDebris(this.o.blastDebris, options.debris) : null
    const focus = this.o.focus?.()
    const reach = (distance: number, wake: BlastWake, at: Vec3): void => {
      if (!policy || !this.blastWakes) return this.applyWake(wake)
      const priority = focus ? Math.hypot(at[0] - focus[0], at[1] - focus[1], at[2] - focus[2]) : distance
      this.blastWakes.push(priority, wake, policy.maxWakeDelay)
    }
    // the wave presses on the whole face it meets, so the push has no lever arm beyond the thinnest side of the body: a thin long piece (a shovel) is not spun by it
    const shove = (pc: PieceBody): void => {
      this.pieceSys.centerOf(pc, c)
      const distance = c.distanceTo(this.v2.set(p[0], p[1], p[2]))
      if (distance > ev.radius) return
      const area = this.waveArea(pc.objectId, pc.halfExtents, pc.root.quaternion, c, p)
      const hit = blastShove({ point: p, energy, radius: ev.radius, reach: reachOf(pc.objectId, [c.x, c.y, c.z]) }, { position: [c.x, c.y, c.z], mass: pc.mass, ...(area !== undefined ? { area } : {}) }, this.o.blastShove)
      if (!hit) return
      const spread = Math.min(...pc.halfExtents)
      const momentum = hit.speed * pc.mass
      const impulse: Vec3 = [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum]
      const point: Vec3 = [c.x + (this.rng() - 0.5) * spread, c.y + spread * 0.5, c.z + (this.rng() - 0.5) * spread]
      reach(distance, { objectId: pc.objectId, generation: pc.generation, impulse, point }, [c.x, c.y, c.z])
    }
    const reached = this.o.blastQuery ? this.pieceSys.piecesInBlast(this.o.blastQuery, p, ev.radius) : [...this.pieceSys.list]
    for (const pc of reached) shove(pc)
    if (this.o.shoveable) this.loosen(p, ev.radius, energy, reachOf, policy, reach)
    this.advanceWakes(0)
    this.fragments.blast(p, ev.radius, Math.min(20, Math.sqrt(energy) * 0.08))
    this.sound('explode', p, clamp(0.5 + ev.radius / 10, 0.5, 1), {
      radius: ev.radius,
      ...(ev.effect !== undefined ? { effect: ev.effect } : {}),
      ...(options.effect !== undefined ? { effect: options.effect } : {}),
      ...(report ? { confinement } : {}),
    })
  }

  /** The area a body shows the blast, or undefined when the host gave the numbers of the game rule (`blastShove`): then the push is that rule, not the blast wave. */
  private waveArea(objectId: string, half: Vec3, quaternion: THREE_NS.Quaternion, centre: THREE_NS.Vector3, point: Vec3): number | undefined {
    if (this.o.blastShove !== undefined) return undefined
    const box = this.areaFacing(half, quaternion, centre, point)
    const shown = this.shownArea(objectId, point)
    return shown === undefined ? box : Math.min(box, shown)
  }

  /**
   * Square metres the drawn parts of an object still standing show a blast at `point`: the box of each mesh, turned as it is, seen from there. The box of the whole piece
   * overstates a slender thing: a shovel lying on its side is a 1.1 x 0.07 m box (0.077 m2) but its handle and blade show 0.9 x 0.035 + 0.3 x 0.012 = 0.035 m2.
   */
  private shownArea(objectId: string, point: Vec3): number | undefined {
    const b = this.bounds.get(objectId)
    if (!b) return undefined
    this.visuals.flushPendingRebuilds()
    const seen = new Set<THREE_NS.Object3D>()
    const size = new this.THREE.Vector3()
    const scale = new this.THREE.Vector3()
    const centre = new this.THREE.Vector3()
    const turn = new this.THREE.Quaternion()
    let area = 0
    for (const pv of b.parts.values()) {
      if (pv.gone !== 'none') continue
      for (const { mesh } of pv.meshes) {
        if (seen.has(mesh) || !mesh.visible) continue
        seen.add(mesh)
        const geometry = mesh.geometry
        if (!geometry.boundingBox) geometry.computeBoundingBox()
        const bounds = geometry.boundingBox
        if (!bounds || bounds.isEmpty()) continue
        mesh.updateWorldMatrix(true, false)
        mesh.matrixWorld.decompose(centre, turn, scale)
        bounds.getSize(size).multiply(scale)
        bounds.getCenter(centre).applyMatrix4(mesh.matrixWorld)
        area += this.areaFacing([Math.abs(size.x) / 2, Math.abs(size.y) / 2, Math.abs(size.z) / 2], turn, centre, point)
      }
    }
    return area > 0 ? area : undefined
  }

  /** Square metres a box of half sizes `half` (its own axes, turned by `quaternion`) at `centre` shows a blast at `point`: the sum of its faces seen from there, by the cosine of each. */
  private areaFacing(half: Vec3, quaternion: THREE_NS.Quaternion, centre: THREE_NS.Vector3, point: Vec3): number {
    const toward = this.v3.set(centre.x - point[0], centre.y - point[1], centre.z - point[2])
    if (toward.lengthSq() < 1e-12) return 0
    toward.normalize().applyQuaternion(this.q1.copy(quaternion).invert())
    return 4 * (half[1] * half[2] * Math.abs(toward.x) + half[0] * half[2] * Math.abs(toward.y) + half[0] * half[1] * Math.abs(toward.z))
  }

  /** The cover between a part of the world that goes off and the centre of each piece and each shoveable body within its radius, as the world stands at that moment. */
  private coverAround(ev: Ev<'explode'>): Map<string, number> {
    const cover = new Map<string, number>()
    const reach = this.world.blastReach
    if (!reach) return cover
    const point = new this.THREE.Vector3(ev.point[0], ev.point[1], ev.point[2])
    const centre = new this.THREE.Vector3()
    const read = (objectId: string): void => {
      if (centre.distanceTo(point) <= ev.radius) cover.set(objectId, reach.call(this.world, ev.point, [centre.x, centre.y, centre.z], { ignore: [ev.object, objectId] }))
    }
    for (const pc of this.pieceSys.list) {
      this.pieceSys.centerOf(pc, centre)
      read(pc.objectId)
    }
    const shoveable = this.o.shoveable
    if (!shoveable) return cover
    for (const b of this.bounds.values()) {
      if (b.piece || cover.has(b.id) || !shoveable(b.id) || !this.world.has(b.id)) continue
      centre.copy(this.measure(b.root, this.meshesOf(b)).center).applyQuaternion(b.root.quaternion).add(b.root.position)
      read(b.id)
    }
    return cover
  }

  /**
   * The bound objects without a piece that the host lets a blast move (`shoveable`): the ones it reaches with enough speed become pieces and get the shove. With a debris
   * policy, how many enter physics is the count the measured cost allows (`physicsPieceCount`): every big one, then the nearest chips while there is room; the chips left
   * over stay where they stand (nothing invisible collides, nothing drawn is taken away) and the blast throws visual chips there instead.
   */
  private loosen(point: Vec3, radius: number, energy: number, reachOf: (objectId: string, at: Vec3) => number, policy: ResolvedBlastDebris | null, reach: (distance: number, wake: BlastWake, at: Vec3) => void): void {
    const shoveable = this.o.shoveable
    if (!shoveable) return
    const candidates: Array<{ b: Bound; world: THREE_NS.Vector3; half: Vec3; mass: number; hit: { direction: Vec3; speed: number }; size: number; distance: number }> = []
    const focus = this.o.focus?.()
    for (const b of [...this.bounds.values()]) {
      if (b.piece || this.pieceSys.get(b.id) || !shoveable(b.id) || !this.world.has(b.id)) continue
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      const world = center.clone().applyQuaternion(b.root.quaternion).add(b.root.position)
      const mass = this.massOf(b.id)
      const distance = world.distanceTo(this.v2.set(point[0], point[1], point[2]))
      if (distance > radius) continue
      const area = this.waveArea(b.id, half, b.root.quaternion, world, point)
      const hit = blastShove({ point, energy, radius, reach: reachOf(b.id, [world.x, world.y, world.z]) }, { position: [world.x, world.y, world.z], mass, ...(area !== undefined ? { area } : {}) }, this.o.blastShove)
      // what orders them is the distance to the player when there is one, else to the blast
      const rank = focus ? Math.hypot(world.x - focus[0], world.y - focus[1], world.z - focus[2]) : distance
      if (hit) candidates.push({ b, world, half, mass, hit, size: 2 * Math.max(...half), distance: rank })
    }
    const count = policy ? physicsPieceCount({ minPieces: policy.minPhysicsPieces, maxPieces: policy.maxPhysicsPieces, costTargetMs: policy.physicsCostTargetMs }, this.costMeter.wakeCostPerBodyMs, this.awakeBodies()) : Infinity
    const { physics, chips } = policy ? chooseForPhysics(candidates, count, policy.chipSize) : { physics: candidates, chips: [] }
    for (const { b, world, half, mass, hit, distance } of physics) {
      const piece = this.makePiece(b.id, { mass })
      const body = this.pieceSys.get(b.id)
      if (!body) continue
      this.o.onLoosened?.(b.id, piece, 'blast')
      const spread = Math.min(...half)
      const momentum = hit.speed * mass
      const impulse: Vec3 = [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum]
      const at: Vec3 = [world.x + (this.rng() - 0.5) * spread, world.y + spread * 0.5, world.z + (this.rng() - 0.5) * spread]
      reach(distance, { objectId: b.id, generation: body.generation, impulse, point: at }, [world.x, world.y, world.z])
    }
    for (const { world, hit } of chips) this.vfx.burst('chips', [world.x, world.y, world.z], hit.direction, 4, Math.min(6, hit.speed))
  }

  /** The step cost of this frame by the `debrisCost` source: the loop's clock, nothing (`fixed`), or the recording. */
  private sampleCost(): DebrisCostSample | null {
    const source = this.o.debrisCost
    if (source?.source === 'fixed') return null
    if (source?.source === 'replay') return source.samples[this.costFrame++] ?? null
    const sample = this.pieceSys.stepCost()
    if (sample && source?.record) source.record.push(sample)
    return sample
  }

  /** One frame of the wake queue: the step cost of the frames before sizes the batch. */
  private advanceWakes(dt: number): void {
    if (!this.blastWakes) return
    const work = this.work
    // under the work budget the wakes draw what the frame's other work left (the cost still sizes the batch below it)
    const limit = work ? work.fits(this.workCosts.perWake) : Infinity
    const woken = this.blastWakes.advance({ dt, lastStepMs: this.cost?.stepMs ?? 0, costPerBodyMs: this.costMeter.wakeCostPerBodyMs, limit, apply: this.applyWake })
    work?.take('wake', woken * this.workCosts.perWake)
  }

  /** A blast's push reaching its piece: the very body it was pushed for (a piece removed or faded since, or made again under the same id, takes nothing). */
  private readonly applyWake = (wake: BlastWake): void => {
    const piece = this.pieceSys.get(wake.objectId)
    if (piece && piece.generation === wake.generation) this.pieceSys.impulse(piece, [wake.impulse[0], wake.impulse[1], wake.impulse[2]], [wake.point[0], wake.point[1], wake.point[2]])
  }

  /** Awake bodies in the physics world (what a blast's debris adds to). */
  private awakeBodies(): number {
    return this.pieceSys.activeBodies()
  }

  /** The world's cost per awake body, from the loop's last frame. */
  private measureCost(): void {
    if (this.cost) this.costMeter.observe(this.cost.stepMs, this.cost.active)
  }

  /** A piece at rest that is far and old, or over the cap (`PieceSystemOptions.keep`): its body and collider go now and its root shrinks away. */
  private fadePiece(b: PieceBody): void {
    const bound = this.bounds.get(b.objectId)
    if (!bound || this.fading.has(b.objectId)) return
    this.staticDirty.add(b.objectId)
    this.pieceSys.remove(b.objectId)
    this.forgetBound(b.objectId)
    this.hitPoints.forget(b.objectId)
    this.fading.set(b.objectId, { root: bound.root, age: 0 })
  }

  private updateFading(dt: number): void {
    if (this.fading.size === 0) return
    const seconds = this.blastDebris?.far.fadeSeconds ?? 0
    for (const [id, f] of this.fading) {
      f.age += dt
      const left = seconds > 0 ? 1 - f.age / seconds : 0
      if (left > 0) {
        f.root.scale.setScalar(left)
        continue
      }
      this.fading.delete(id)
      // the host owns the geometry and disposes it in `onDebrisFaded`
      // eslint-disable-next-line kit/no-bare-remove -- the host disposes the root it is handed
      f.root.removeFromParent()
      this.o.onDebrisFaded?.(id, f.root)
    }
  }

  private playExplosion(ev: Ev<'explode'>, options: ExplodeOptions): void {
    const named = options.effect ?? ev.effect
    const direction = options.direction
    const scale = clamp(ev.radius / GENERIC_REFERENCE_RADIUS, 0.2, 3)
    if (named !== undefined && this.vfx.explosion(named, ev.point, direction ? { direction } : {}) !== null) return
    this.vfx.explosion('generic', ev.point, { scale, ...(direction ? { direction } : {}) })
  }

  private startFire(ev: { object: string; part: string; point: Vec3 }): void {
    const key = `${ev.object}|${ev.part}`
    this.stopFire(key)
    this.fires.set(key, { object: ev.object, part: ev.part, point: ev.point, follow: { x: ev.point[0], y: ev.point[1], z: ev.point[2] } })
  }

  private stopFire(key: string): void {
    const fire = this.fires.get(key)
    if (fire) {
      if (fire.handle !== undefined) this.vfx.stop(fire.handle)
      this.fires.delete(key)
    }
    this.endBurnSound(key)
  }

  /** A part's fire loop starts; one already running for the part (it caught again) is ended first, so the host never counts a fire twice. */
  private startBurnSound(object: string, part: string, point: Vec3, detail: SoundDetail | undefined): void {
    const key = `${object}|${part}`
    this.endBurnSound(key)
    this.burnSounds.set(key, { object, point, detail })
    this.sound('burn_loop', point, 0.5, detail)
  }

  /** The part's fire loop ends, with the point and the fuel it started with; nothing when it has none running. */
  private endBurnSound(key: string): void {
    const started = this.burnSounds.get(key)
    if (!started) return
    this.burnSounds.delete(key)
    this.sound('burn_end', started.point, 0.5, started.detail)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Fire, heat, char, melt, leaks
  // ----------------------------------------------------------------------------------------------------------------------------------

  private updateActive(dt: number): void {
    this.scanTimer += dt
    if (this.scanTimer >= 0.4) {
      this.scanTimer = 0
      for (const b of this.bounds.values()) {
        for (const pv of b.parts.values()) {
          if (pv.gone !== 'none' && pv.gone !== 'broken') continue
          const ps = this.world.part(b.id, pv.id)
          if (!ps) continue
          const def = this.world.materials.get(pv.material)
          if (
            ps.burning ||
            (def?.visual?.glows && ps.temperature > GLOW_FROM_C) ||
            Math.abs(ps.char - pv.charApplied) > 0.01 ||
            Math.abs(ps.melt - pv.meltApplied) > 0.01 ||
            (pv.gone === 'none' && (ps.status === 'melted' || ps.status === 'ashes'))
          ) {
            this.activate(b.id, pv.id)
          }
        }
      }
    }
    for (const [key, a] of this.active) {
      const pv = this.partVis(a.object, a.part)
      const ps = pv ? this.world.part(a.object, a.part) : null
      if (!pv || !ps) {
        this.active.delete(key)
        this.stopFire(key)
        continue
      }
      const def = this.world.materials.get(pv.material)
      if (pv.gone === 'none') {
        this.visuals.setChar(pv, ps.char, def?.visual?.charColor ?? 0x1a1410)
        if (def?.visual?.glows) this.visuals.setGlow(pv, ps.temperature)
        this.visuals.setMelt(pv, ps.melt)
        if (ps.status === 'melted') this.onGone(a.object, pv, 'melted', def)
        else if (ps.status === 'ashes') this.onGone(a.object, pv, 'ashes', def)
      }
      const fire = this.fires.get(key)
      if (fire) {
        if (ps.burning && ps.status !== 'broken' && ps.status !== 'ashes' && ps.status !== 'melted') this.emitFire(fire, pv, def)
        else this.stopFire(key)
      }
      const hot = def?.visual?.glows === true && ps.temperature > GLOW_FROM_C
      if (!ps.burning && !hot && Math.abs(ps.char - pv.charApplied) < 0.01 && Math.abs(ps.melt - pv.meltApplied) < 0.01) {
        if (def?.visual?.glows && pv.gone === 'none') this.visuals.setGlow(pv, 0)
        this.active.delete(key)
      }
    }
  }

  private onGone(objectId: string, pv: PartVis, reason: 'melted' | 'ashes', def: MaterialDef | undefined): void {
    const bb = new this.THREE.Box3()
    for (const mv of pv.meshes) bb.union(this.visuals.worldBox(mv, this.box))
    this.visuals.hide(pv, reason)
    if (bb.isEmpty()) return
    const c = bb.getCenter(new this.THREE.Vector3())
    const s = bb.getSize(new this.THREE.Vector3())
    const footprint = Math.sqrt(Math.max(s.x * s.z, 1e-4))
    if (reason === 'melted') {
      this.ground.add('puddle', c.x, c.z, clamp(footprint * 0.55, 0.05, 1), this.partColor(pv, def) ?? fallbackColor(def), objectId)
    } else {
      this.ground.add('ash', c.x, c.z, clamp(footprint * 0.35, 0.04, 0.5), 0x1d1a18, objectId)
      this.vfx.burst('ash', [c.x, bb.max.y, c.z], [0, 1, 0], 10, 0.8, { source: objectId })
    }
  }

  private emitFire(f: FireEmitter, pv: PartVis, def: MaterialDef | undefined): void {
    const bb = this.box
    bb.makeEmpty()
    const tmp = new this.THREE.Box3()
    for (const mv of pv.meshes) if (this.visuals.shown(mv)) bb.union(this.visuals.worldBox(mv, tmp))
    if (bb.isEmpty()) {
      // nothing of the part is drawn (a roof rafter has no mesh, or the part broke or burnt away): no flame may hang where it was
      if (f.handle !== undefined) this.vfx.stop(f.handle)
      delete f.handle
      return
    }
    const c = bb.getCenter(this.v1)
    f.follow.x = c.x
    f.follow.y = bb.min.y
    f.follow.z = c.z
    if (f.handle !== undefined) return
    const size = bb.getSize(this.v2)
    const radius = clamp(Math.max(size.x, size.z) * 0.5, 0.12, 1.2)
    const smokeColor = SMOKE_TONES[def?.thermal.smoke ?? 'grey']
    f.handle = this.vfx.fire({ point: [f.follow.x, f.follow.y, f.follow.z], radius, life: FIRE_CEILING_SECONDS, follow: f.follow, source: f.object, ...(smokeColor !== undefined ? { smokeColor } : {}) })
  }

  private updateLeaks(dt: number): void {
    for (let i = this.leaks.length - 1; i >= 0; i--) {
      const l = this.leaks[i]
      const b = this.bounds.get(l.object)
      const ps = this.world.part(l.object, l.part)
      // a leak ends when the container is empty or the opening is closed (a valve shut, `seal`)
      if (!b || !ps || ps.liters === undefined || ps.liters <= 1e-4 || (l.opened && !ps.holes.some((h) => h.through))) {
        this.leaks.splice(i, 1)
        continue
      }
      l.life = (l.life ?? 0) + dt
      if (l.pressurized && l.life > 0.8) l.pressurized = false

      if (l.lastLiters !== undefined && Math.abs(ps.liters - l.lastLiters) < 1e-5) {
        l.idleSeconds = (l.idleSeconds ?? 0) + dt
        if (l.idleSeconds > 0.4) {
          this.leaks.splice(i, 1)
          continue
        }
      } else {
        l.idleSeconds = 0
        l.lastLiters = ps.liters
      }

      let pt = l.point
      let dir = l.direction
      if (l.localPoint && l.localDirection) {
        b.root.updateWorldMatrix(true, false)
        const wp = this.v1.set(l.localPoint[0], l.localPoint[1], l.localPoint[2]).applyMatrix4(b.root.matrixWorld)
        const wd = this.v2.set(l.localDirection[0], l.localDirection[1], l.localDirection[2]).transformDirection(b.root.matrixWorld).normalize()
        pt = [wp.x, wp.y, wp.z]
        dir = [wd.x, wd.y, wd.z]
        l.point = pt
        l.direction = dir
      }

      l.acc += clamp(20 + l.rate * 400, 15, 120) * dt
      const color = FLUID_COLORS[l.fluid] ?? 0xaaaaaa
      const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
      const sp = l.pressurized ? 2.5 + this.rng() * 1.5 : 0.3 + this.rng() * 0.3
      while (l.acc >= 1) {
        l.acc -= 1
        const vel: Vec3 = [(dir[0] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[1] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[2] / dl) * sp + (this.rng() - 0.5) * 0.25]
        if (l.fluid === 'gas') this.vfx.spawn('steam', pt, vel, { color, size: 0.5, alpha: 0.5, source: l.object })
        else this.vfx.spawn('drips', pt, vel, { color, tag: this.rng() < 0.03 ? this.tagOf(l.object) : 0, owner: this.owner, source: l.object })
      }
    }
  }

  private tagOf(object: string): number {
    let tag = this.homeTags.indexOf(object) + 1
    if (tag === 0) tag = this.homeTags.push(object)
    return tag
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Emit, clear, restore, stats, dispose
  // ----------------------------------------------------------------------------------------------------------------------------------

  emit(kind: DebrisKind | 'fire' | 'flash' | 'foam', point: Vec3, normal: Vec3, count: number, speed?: number): void {
    this.vfx.burst(kind, point, normal, count, speed ?? DEFAULT_SPEED[kind] ?? 1, kind === 'smoke' ? { color: SMOKE_TONES.grey } : undefined)
  }

  explode(point: Vec3, energy: number, radius: number, options?: ExplodeOptions): void {
    this.onExplode({ type: 'explode', object: '', part: '', time: this.time, point, energy, radius }, options)
  }

  restore(objectId: string): void {
    const homes = new Set<string>([objectId])
    const self = this.bounds.get(objectId)
    if (self?.isSplit) for (const pv of self.parts.values()) homes.add(pv.home)
    for (const home of homes) this.restoreHome(home)
    for (const [key, a] of [...this.active]) if (homes.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (homes.has(f.object)) this.stopFire(key)
    for (const [key, started] of [...this.burnSounds]) if (homes.has(started.object)) this.endBurnSound(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (homes.has(this.leaks[i].object)) this.leaks.splice(i, 1)
    for (const home of homes) {
      this.fragments.removeHome(home)
      this.ground.removeHome(home)
      this.cages.removeObject(home)
    }
  }

  /**
   * Draws a bound object again from the state its world holds now: the host put it back damaged (`DestructionWorld.loadObject`) and the meshes, still whole, take its dents, holes,
   * cracks, bend and char, with the broken, melted and burned parts hidden, as the live path drew them. Marks the meshes already carry are wiped first.
   */
  redraw(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b) return
    this.restoreHome(objectId)
    b.root.updateWorldMatrix(true, false)
    for (const pv of b.parts.values()) this.drawPartState(b, pv)
    this.checkLoose(objectId)
  }

  private drawPartState(b: Bound, pv: PartVis): void {
    const ps = this.world.part(b.id, pv.id)
    if (!ps) return
    if (ps.status === 'broken' || ps.status === 'melted' || ps.status === 'ashes') {
      this.visuals.hide(pv, ps.status)
      return
    }
    const toWorld = (local: Vec3): Vec3 => {
      const at = new this.THREE.Vector3(local[0], local[1], local[2]).applyMatrix4(b.root.matrixWorld)
      return [at.x, at.y, at.z]
    }
    const shown = pv.meshes.filter((mv) => this.visuals.shown(mv))
    for (const dent of ps.dents) {
      const at = toWorld(dent.point)
      const wp = new this.THREE.Vector3(at[0], at[1], at[2])
      const reach = shown.reduce((widest, mv) => Math.max(widest, this.visuals.dentReach(mv, wp, dent)), dent.radius)
      this.visuals.applyPartDent(shown, wp, this.worldDir(b, dent.normal), dent, reach)
    }
    for (const hole of ps.holes) this.drawHoleMark(pv, toWorld(hole.point), this.worldDir(b, hole.normal), hole.diameter, 0)
    for (const crack of ps.cracks) this.drawCrackMark(b, pv, crack, toWorld(crack.point), 0)
    if (ps.bend !== undefined && ps.bendHinge) {
      const hinge = new this.THREE.Vector3(...toWorld(ps.bendHinge.point))
      const axis = this.worldDir(b, ps.bendHinge.axis)
      const side = this.worldDir(b, ps.bendHinge.side)
      for (const mv of shown) this.visuals.applyBend(mv, hinge, axis, side, ps.bend)
    }
    if (ps.char > 0 || ps.melt > 0) this.activate(b.id, pv.id)
  }

  release(objectId: string): string[] {
    const removed = this.releasePieces(objectId)
    this.unbind(objectId)
    return removed
  }

  releasePieces(objectId: string): string[] {
    const family = this.familyOf(objectId)
    const pieces = [...family].filter((id) => id !== objectId)
    const ofFamily = (key: string): boolean => [...family].some((id) => key.startsWith(`${id}|`))
    // an event still waiting would bring an effect of theirs back after they left
    for (let i = this.queue.length - 1; i >= 0; i--) if (family.has(this.queue[i]!.object)) this.queue.splice(i, 1)
    this.splitQueue.remove((entry) => family.has(entry.objectId))
    for (const id of family) this.looseToCheck.delete(id)
    for (const [key, a] of [...this.active]) if (family.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (family.has(f.object)) this.stopFire(key)
    for (const [key, started] of [...this.burnSounds]) if (family.has(started.object)) this.endBurnSound(key)
    for (const key of [...this.primedBurning]) if (ofFamily(key)) this.primedBurning.delete(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (family.has(this.leaks[i]!.object)) this.leaks.splice(i, 1)
    for (let i = this.trickles.length - 1; i >= 0; i--) if (family.has(this.trickles[i]!.source ?? '')) this.trickles.splice(i, 1)
    for (const id of family) {
      this.fragments.removeHome(id)
      this.ground.removeHome(id)
      this.cages.removeObject(id)
      this.vfx.clearSource(id)
    }
    // the parts of the pieces go back to the object's binding (their meshes to where they were drawn, the ones made for them disposed)
    this.restore(objectId)
    for (const id of pieces) {
      this.pieceSys.remove(id)
      this.forgetBound(id)
      this.hitPoints.forget(id)
      this.broken.delete(id)
      this.staticDirty.add(id)
      if (this.world.has(id)) this.world.remove(id)
    }
    if (pieces.length > 0) this.o.onReleased?.(pieces)
    // groups of the object still loose in its world go back to the queue in the next work step (`unbind` drops it when the object leaves too)
    if (this.bounds.has(objectId)) this.checkLoose(objectId)
    return pieces
  }

  /** The object and every piece split from it (a piece holds parts whose home is the object, also a piece of a piece). */
  private familyOf(objectId: string): Set<string> {
    const family = new Set([objectId])
    for (const b of this.bounds.values()) {
      if (!b.isSplit) continue
      for (const pv of b.parts.values()) {
        if (pv.home !== objectId) continue
        family.add(b.id)
        break
      }
    }
    return family
  }

  private restoreHome(home: string): void {
    const homeBound = this.bounds.get(home)
    for (const b of [...this.bounds.values()]) {
      for (const [pid, pv] of [...b.parts]) {
        if (pv.home !== home) continue
        this.settlement.forget(pv)
        this.visuals.restorePart(pv)
        this.tagPart(pv, home)
        if (b !== homeBound && homeBound) {
          b.parts.delete(pid)
          homeBound.parts.set(pid, pv)
        }
      }
      if (b.isSplit && b.parts.size === 0) {
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.forgetBound(b.id)
        // its box leaves now: the periodic round only walks the objects still bound
        this.staticDirty.add(b.id)
      }
    }
  }

  clear(): void {
    // the meshes go back to their own draw before they are restored or removed
    this.settledBatches.clear()
    // what was bound is gone: the next read measures what is left, all of it
    this.staticAll = true
    this.queue.length = 0
    // a spread blast's events held or still to apply go with the world they were for
    this.heldStructural = undefined
    this.areEventsHeld = false
    this.slices.length = 0
    this.splitQueue.clear()
    this.looseToCheck.clear()
    this.prefitting.length = 0
    this.active.clear()
    for (const key of [...this.fires.keys()]) this.stopFire(key)
    for (const key of [...this.burnSounds.keys()]) this.endBurnSound(key)
    this.leaks.length = 0
    this.trickles.length = 0
    this.settlement.clear()
    for (const id of [...this.bounds.keys()]) if (this.bounds.has(id)) this.restore(id)
    // anything left of a split object whose home is gone
    for (const b of [...this.bounds.values()]) {
      if (b.isSplit) {
        for (const pv of b.parts.values()) this.visuals.restorePart(pv)
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.forgetBound(b.id)
      }
    }
    this.fragments.clear()
    this.ground.clear()
    this.cages.clear()
    this.primedBurning.clear()
    this.vfx.sprites().clear()
    this.ownVfx?.world.clear()
  }

  reset(): void {
    this.clear()
    this.rng = createRng(RNG_SEED)
    this.time = 0
    this.staticAt = 0
    this.staticRound = []
    this.staticAll = true
    this.throttles.clear()
    this.fragments.reset()
    this.pieceSys.reset()
    this.blastWakes?.clear()
    this.costMeter.reset()
    this.cost = null
    this.costFrame = 0
  }

  wakeRegion(x: number, z: number, radius: number): void {
    this.fragments.wakeRegion(x, z, radius)
    this.pieceSys.wakeRegion(x, z, radius)
    if (this.autoSplit && this.undermined.length < UNDERMINED_MAX) this.undermined.push({ x, z, radius })
  }

  stats(): { fragments: number; particles: number; pieces: number; decals: number } {
    return { fragments: this.fragments.count, particles: this.vfx.sprites().live + this.ownedVfxParticles(), pieces: this.pieceSys.list.length, decals: this.visuals.decalCount + this.ground.count }
  }

  private ownedVfxParticles(): number {
    if (!this.ownVfx) return 0
    const { puffs, sparks, glows, chunks } = this.vfx.stats()
    return puffs + sparks + glows + chunks
  }

  // The last warm-up keeps its materials until the next one: a material that does not use lights keeps the program of the lights it was first drawn with, so each warm-up needs materials of its own.
  private warmProbes: { readonly group: THREE_NS.Group; readonly geometry: THREE_NS.BufferGeometry; readonly materials: THREE_NS.Material[] } | undefined

  warmUpProbes(): WarmUpProbes {
    this.releaseWarmProbes()
    const { kit } = this.visuals
    const T = this.THREE
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
    const materials = [kit.discMaterial().clone(), kit.patchMaterial(0x808080).clone(), kit.lineMaterial(0x000000).clone()]
    const group = new T.Group()
    group.add(new T.Mesh(kit.discGeometry(), materials[0]), new T.Mesh(kit.discGeometry(), materials[1]), new T.LineSegments(geometry, materials[2] as THREE_NS.LineBasicMaterial))
    group.add(...this.fragments.warmMeshes())
    for (const probe of group.children) probe.frustumCulled = false
    this.warmProbes = { group, geometry, materials }
    return { group, dispose: () => {} }
  }

  private releaseWarmProbes(): void {
    if (!this.warmProbes) return
    this.warmProbes.geometry.dispose()
    for (const material of this.warmProbes.materials) material.dispose()
    this.warmProbes = undefined
  }

  rebarCount(): number {
    return this.cages.count
  }

  dispose(): void {
    this.releaseWarmProbes()
    if (this.disposed) return
    this.unsubscribe()
    if (this.o.rayBroadPhase) this.world.setRayBroadPhase(null)
    this.stopContactHits?.()
    this.clear()
    for (const id of [...this.bounds.keys()]) this.unbind(id)
    this.fragments.dispose()
    this.ground.dispose()
    this.cages.dispose()
    this.stopLanding()
    this.pieceSys.dispose()
    this.visuals.dispose()
    this.ownVfx?.dispose()
    this.disposed = true
  }
}

/** `color` (0xRRGGBB) a share `t` of the way to white. */
function lighten(color: number, t: number): number {
  const ch = (shift: number) => {
    const c = (color >> shift) & 0xff
    return Math.round(c + (255 - c) * t) << shift
  }
  return ch(16) | ch(8) | ch(0)
}

/**
 * The boxes (in the geometry's own space: min x, y, z, max x, y, z) of the separate solids a merged geometry is drawn of: triangles that share a corner (by position, so the
 * faces of one box, drawn with vertices of their own, are one solid) belong together. Null for one solid, or for more than `SOLIDS_MAX`.
 */
function solidBoxesOf(geometry: THREE_NS.BufferGeometry): Array<[number, number, number, number, number, number]> | null {
  const position = geometry.getAttribute('position')
  if (!position || position.count <= 24) return null
  const parent = new Int32Array(position.count)
  for (let i = 0; i < parent.length; i++) parent[i] = i
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  const join = (a: number, b: number): void => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const corners = new Map<string, number>()
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) / SOLID_WELD)},${Math.round(position.getY(i) / SOLID_WELD)},${Math.round(position.getZ(i) / SOLID_WELD)}`
    const first = corners.get(key)
    if (first === undefined) corners.set(key, i)
    else join(i, first)
  }
  const index = geometry.getIndex()
  const triangles = index ? index.count / 3 : position.count / 3
  for (let t = 0; t < triangles; t++) {
    const a = index ? index.getX(t * 3) : t * 3
    join(a, index ? index.getX(t * 3 + 1) : t * 3 + 1)
    join(a, index ? index.getX(t * 3 + 2) : t * 3 + 2)
  }
  const boxes = new Map<number, [number, number, number, number, number, number]>()
  for (let i = 0; i < position.count; i++) {
    const root = find(i)
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const box = boxes.get(root)
    if (!box) {
      if (boxes.size >= SOLIDS_MAX) return null
      boxes.set(root, [x, y, z, x, y, z])
      continue
    }
    box[0] = Math.min(box[0], x)
    box[1] = Math.min(box[1], y)
    box[2] = Math.min(box[2], z)
    box[3] = Math.max(box[3], x)
    box[4] = Math.max(box[4], y)
    box[5] = Math.max(box[5], z)
  }
  return boxes.size > 1 ? [...boxes.values()] : null
}

/** The convex hull (counter-clockwise) of points on the ground, (x, z). */
function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length < 3) return sorted
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Array<[number, number]>): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** The centre of a set of boxes weighted by their volumes (x, y, z). */
function centreOfBoxes(boxes: ReadonlyArray<THREE_NS.Box3>): [number, number, number] {
  const sum: [number, number, number] = [0, 0, 0]
  let total = 0
  for (const one of boxes) {
    const volume = Math.max(1e-9, (one.max.x - one.min.x) * (one.max.y - one.min.y) * (one.max.z - one.min.z))
    sum[0] += ((one.min.x + one.max.x) / 2) * volume
    sum[1] += ((one.min.y + one.max.y) / 2) * volume
    sum[2] += ((one.min.z + one.max.z) / 2) * volume
    total += volume
  }
  return [sum[0] / total, sum[1] / total, sum[2] / total]
}

/** How far (m) a point is inside a convex polygon (counter-clockwise; negative outside), and the outward normal of the edge it is nearest. */
function insideBy(hull: ReadonlyArray<[number, number]>, point: [number, number]): { depth: number; out: { x: number; z: number } } {
  let depth = Infinity
  let out = { x: 1, z: 0 }
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    const ex = b[0] - a[0]
    const ez = b[1] - a[1]
    const length = Math.hypot(ex, ez)
    if (length < 1e-9) continue
    // counter-clockwise in (x, z): the outward normal of an edge is (ez, -ex)
    const nx = ez / length
    const nz = -ex / length
    const d = -((point[0] - a[0]) * nx + (point[1] - a[1]) * nz)
    if (d < depth) {
      depth = d
      out = { x: nx, z: nz }
    }
  }
  return { depth: hull.length < 3 ? -Infinity : depth, out }
}
