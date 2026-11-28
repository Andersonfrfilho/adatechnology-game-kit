import type * as THREE_NS from 'three'
import type { DestructionWorld, RayBroadPhase, Vec3 } from '@adatechnology/game-destruction'
import { AwakeList } from './awake-list'
import { PoseTrail } from './pose-trail'
import type { PartBox, PieceBody, PieceFriction, PieceSweepHit } from './internal'
import { HINGE_SECONDS, squareBoxOf } from './internal'
import { GROUND_ROLLING_DAMPING, PIECE_ROLLING_DAMPING } from './friction'
import { boxesApartAlongGround, levelBoxesApart, shapeContact } from './piece-contacts'
import type { ContactShape, ShapeContact } from './piece-contacts'
import type { BlastQuery, BodyId, PhysicsLoop } from '@adatechnology/game-physics'
import { createEngineImpacts } from './engine-impacts'
import type { EngineImpactsOptions } from './engine-impacts'
import { EnginePieces } from './engine-pieces'
import type { StaticSolid } from './engine-pieces'
import type { GroundGrid } from './engine-ground'
import type { GroundPatchRead } from './engine-ground-job'
import type { GroundWorkerPort } from './engine-ground-port'
import { resolvePhysics } from './physics-option'
import { isOverSupport } from './support-hull'
import type { PlanPoint } from './support-hull'
import type { PiecePhysics } from './physics-option'
export type { PieceSweepHit } from './internal'

export interface PieceSystemOptions {
  /** Keep the pose of the step before the last, to draw between it and the step's (`presentPose`). Default off: the roots are always the step's. */
  interpolate?: boolean
  groundAt: (x: number, z: number) => number
  /** The terrain alone (no top of furniture or of anything drawn): the ground of an engine, which has every drawn top as a body. Default `groundAt`. */
  terrainAt?: (x: number, z: number) => number
  /**
   * The rolling resistance of the terrain's surface at (x, z), undefined for the default (`RendererOptions.terrainRollingAt`). The kit's solver takes a contact to be on the
   * terrain where `groundAt` answers exactly `terrainAt` (or there is no `terrainAt`): `groundAt` must return the terrain's own value, to the bit, where nothing is on it.
   */
  terrainRollingAt?: (x: number, z: number) => number | undefined
  /** The rolling damping (1/s) of the terrain's surface at (x, z), undefined for the default (`RendererOptions.terrainRollingDampingAt`); read where `terrainRollingAt` is. */
  terrainRollingDampingAt?: (x: number, z: number) => number | undefined
  /** The most tiles of ground laid at a blast, nearest first (default 0: the tiles are laid as the pieces reach them; a count lays that many at a blast, which moves their cost into the explosion's frame). Engine physics only. */
  blastGroundTiles?: number
  /**
   * The lowest and highest `terrainAt` (else `groundAt`) can answer over a rectangle (min x, max x, min z, max z), exact bounds, or null when none is known. With it the engine lays a
   * tile it proves level without reading its 26 000 samples (`Terrain.heightRange` is one). A bound that is not exact makes a tile level that is not: leave it out if unsure.
   */
  terrainRangeAt?: (minX: number, maxX: number, minZ: number, maxZ: number) => { readonly low: number; readonly high: number } | null
  /** `terrainAt` over a lattice in one pass, to the bit (`GroundGrid`; `Terrain.heightGrid` is one). Used only with `terrainAt`; engine physics only. */
  terrainGridAt?: GroundGrid
  /** `terrainAt`'s vertices under a rectangle, to the bit (`GroundPatchRead`; `Terrain.heightPatch` is one): tiles asked of `groundWorker` carry them, not their samples. Used only with `terrainGridAt`. */
  terrainPatchAt?: GroundPatchRead
  /**
   * The highest top of what does not move (furniture, scenery) under `(x, z)` that a corner at height `y` can land on (at most `step` above it),
   * `-Infinity` when none. The ground and the other pieces are added by the system.
   */
  staticTopAt?: (x: number, z: number, y: number, step: number) => number
  gravity: number
  /** A piece hit the ground faster than 3 m/s (throttled per piece). */
  onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
  /** Notified when a piece is about to be removed. */
  scene: THREE_NS.Scene
  /**
   * What a piece moving from `from` to `to` (its centre, world) runs into on the way: a wall, a car, a cupboard (`distance` along the way, the `normal` of what it met).
   * Without it a piece only meets the ground, the tops of fixed things and the other pieces.
   */
  sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  /** A piece ran into something (`sweep`) faster than `SLAM_MIN_SPEED` m/s into it (throttled per piece): for the blow on both and the sound. */
  onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  /** Two pieces knocked into each other faster than `SLAM_MIN_SPEED` m/s (throttled per pair): for the sound. */
  onKnock?: (a: PieceBody, b: PieceBody, point: Vec3, speed: number) => void
  /**
   * Most pieces simulated at once (not asleep, not held). Over it, the oldest pieces that have come to rest (on the ground, slower than the speeds a piece sleeps under, and
   * one held up at an angle only once it kept its tilt for `STEADY_SECONDS`) sleep where they lie; nothing is moved. With a limit, one held up at an angle that kept its tilt
   * sleeps under it too. Default: no limit.
   */
  maxAwake?: number
  /** Engine only: lay the ground under each part box of a piece of several parts, not under the box around all of them (default off; `RendererOptions.tilesUnderParts`). */
  tilesUnderParts?: boolean
  /** Engine only: the body a piece in a hand passes through (the holder's own). */
  heldIgnores?: () => BodyId | undefined
  /** Engine only: where the ground tiles are made, on a fixed schedule (`RendererOptions.groundWorker`); default none. */
  groundWorker?: GroundWorkerPort
  groundWorkerFrames?: number
  /**
   * The far and old rule and the cap of pieces alive (`BlastDebrisOptions`): a piece at rest, older than `far.age` seconds and farther than `far.distance` from `focus`, sleeps or is
   * handed to `onFade`; over `maxLive` pieces the far and old ones at rest go first, then the oldest, by `onFade`. Default: none.
   */
  keep?: { readonly maxLive: number; readonly far: { readonly distance: number; readonly age: number; readonly action: 'sleep' | 'fade' }; readonly focus?: () => Vec3; readonly onFade: (b: PieceBody) => void }
  /**
   * What steps the pieces, handed by the host and never defaulted (left out, it throws): a `PhysicsLoop` (`game-physics`; the host calls `loop.step(dt)` and then `update`, and the
   * system registers its phases on it), a world (the system makes its own loop and steps it inside `update`), The kit's rules stay on top
   * (`EnginePieces`). There is no switching mid-game.
   */
  physics: PiecePhysics
  /** With `physics`: the fixed boxes of what does not move, as drawn (turned), per object. */
  staticSolids?: () => ReadonlyMap<string, readonly StaticSolid[]>
  /** With `staticSolids`: the objects whose list is not all of what a ray can hit. */
  staticUnsure?: () => ReadonlySet<string>
}

/** Slower than this (m/s) into a wall a piece only stops against it: no blow, no sound. */
export const SLAM_MIN_SPEED = 2
/** Metres the centre of mass may stand off the hull of the points a piece rests on and still be balanced there (the drawing's tolerance). */
const BALANCE_TOLERANCE = 0.01

/** Coulomb friction of a piece when no material says otherwise: what holds it still (static) and what drags it while it slides (dynamic). */
const MU_STATIC = 0.7
const MU_DYNAMIC = 0.6
/** Rolling resistance coefficient of the ground and of a surface that does not say (`PieceFriction.rolling`): a can or a bottle on a hard floor (0.01-0.02). */
const ROLLING_RESISTANCE = 0.015
/** The least half side (m) of a piece's box on the engine, however thin what is drawn of it: the box is the drawing (a 2 cm laptop is a 2 cm box); this much is only so that a face is not a plane. */
export const MIN_PIECE_HALF = 0.001
const SLEEP_AFTER = 0.5
/** A piece on the ground slower than this (m/s) and turning slower than this (rad/s) is still: it sleeps after `SLEEP_AFTER`, or at once over `maxAwake`. */
const STILL_SPEED = 0.12
const STILL_SPIN = 0.45
const STEADY_SECONDS = 1.5
/** Contact tolerance in metres: corners this close to the ground count as touching, which keeps the contact set (and a resting box) stable. */
const SLOP = 0.002
const TIP_SECONDS = 3
/** How far (m) above a corner a top may be and still catch it (on top of what the corner falls in one sub-step): higher is beside it, not under it. */
const STEP = 0.03
/** Points across a piece's footprint, per side, read for the ground under it when its root is out of a woken disc; and how far that ground must have gone down to wake it (m). */
const WAKE_SAMPLES = 4
const WAKE_DROP = 0.05
/**
 * Points along each edge of the box, between its corners (fractions of the half edge), that also touch the ground when the support under the corners is not level
 * (the piece is over a step): the edge of a table under a box's bottom is a support between its corners. On level ground the corners are enough.
 */
const EDGE_POINTS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]
/**
 * Widest gap (m) between two of those points along a long edge of a board or a lath (a piece no thicker than twice `THIN_HALF`): a step between two of them (a crater's rim
 * under a 1.5 m lath) is missed, and the piece sinks over it and rests on the points beside it, balanced in the air. Such an edge gets more points (at most
 * `MAX_EDGE_POINTS`); a bulky piece (a sofa, a crate) keeps `EDGE_POINTS`, its own weight being what the step holds.
 */
const EDGE_SPACING = 0.05
const MAX_EDGE_POINTS = 31
const THIN_HALF = 0.03

/** Fractions of a half edge of `half` metres, of a piece whose thinnest half extent is `thin`, where the points along it are. */
const edgeFractions = (half: number, thin: number): readonly number[] => {
  if (thin > THIN_HALF) return EDGE_POINTS
  const count = Math.min(MAX_EDGE_POINTS, Math.ceil((2 * half) / EDGE_SPACING) - 1)
  if (count <= EDGE_POINTS.length) return EDGE_POINTS
  return Array.from({ length: count }, (_, i) => -1 + (2 * (i + 1)) / (count + 1))
}
/** Sleeping pieces whose support is looked at again each update, in turn: what held one up may have broken, fallen over or been carried off. */
const SUPPORT_CHECKS = 16
/** A sleeping piece none of whose lowest points has a support within this many metres under it wakes and falls. */
const SUPPORT_GAP = 0.02
/** A slope steeper than the friction holds by this much (tan over the static coefficient) makes what lies on it slide: the margin keeps a piece at the edge of holding from waking and sleeping in turn. */
const STEEP_MARGIN = 1.1
/** A face tilted more than this (normal y, about 60 degrees) is a side a piece leans on, not a top it lies on. */
const SLOPE_MIN_NORMAL = 0.5
/** A piece whose face is this close (cosine, about 10 degrees) to the slope under it lies flat on it. */
const LIES_FLAT = 0.985
/** A piece moving faster than this (m/s) or turning faster than this (rad/s) wakes what lies asleep on it. */
/** How often (s) the far and old rule looks at the pieces. */
const KEEP_EVERY = 0.5
/** Side (m) of the cells of the grid the surfaces are found by (`surfaceGrid`). */
const SURFACE_CELL = 0.5
/** Most cells across one surface goes into; a wider one is looked at for every point (`wideSurfaces`). */
const SURFACE_CELLS_ACROSS = 24
const cellKey = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768)
/** A contact normal at least this level (its share along the ground) puts two pieces apart along the ground only. */
const KNOCK_FLAT = 0.5
/** Fastest (m/s) a piece is put apart from the boxes it overlaps (`separatePair`, all its pairs of a step together): a deep overlap opens over a few frames instead of in a jump. */
const SEPARATE_SPEED = 1.5
/**
 * Deepest (m) one box may be in the top of another and still be lifted out of it: as far as a resting corner sits in its support (`STEP`), more what the closing speed sinks it
 * in a step. Deeper, the two were made inside each other (chunks of one wall), not landed one on the other: lifting the upper out would give it m g d nothing supplied (a 3 m
 * chunk climbing 5 m through the pile), so they slide apart along the ground instead.
 */
const LIFT_DEPTH = STEP
/**
 * Share of an overlap one step takes back (`separatePair`). Wedged between two it cannot push (asleep on either side), the full overlap each way swings a piece back and forth
 * for ever; half settles it where the pushes balance, and a single overlap still closes to a millimetre within ten steps.
 */
const SEPARATE_SHARE = 0.5
/**
 * What is left of a piece's push each time it turns back against the last step's (`applyPushes`), and what it grows back by each step it goes on the same way (up to the
 * whole push). Held between pieces that are asleep (a book in a heap of boards, a fallen case on its books), each pushes it out into the other: it went back and forth by
 * up to `SEPARATE_SPEED` a step, for good, and never slept. A cycle that turns back at least once in four steps now shrinks (1.2^3 x 0.5 < 1), so it settles where the
 * pushes balance, as a book wedged in a heap stays where it is held; one put apart the same way step after step keeps its whole push.
 */
const TURN_BACK_SHARE = 0.5
const SAME_WAY_GROWTH = 1.2
/** The least share a push keeps (its most, 2.5 cm a step at 60 Hz, then moves under `SLOP`: the wedged piece sleeps), so a neighbour that clears is left within a few steps. */
const MIN_PUSH_SHARE = 0.05
/** How long (s) a piece's last push is remembered: past one frame, so the sub-steps of a split update (`collisionSteps`) that do not reach it keep its share. */
const PUSH_MEMORY_SECONDS = 0.1

interface PushStep {
  readonly push: Vec3
  share: number
  /** The clock (`time`) of that push. */
  at: number
}

interface Solid {
  body: PieceBody
  c: Vec3
  e: number[]
  half: Vec3
  /** Radius of the box around its centre: a point farther than it on the ground plane misses it. */
  r: number
}

/** How far a box reaches from its centre along the world axis `k` (a function of the module: a closure made per call was made per pair per update). */
const extent = (s: Solid, k: number): number => Math.abs(s.e[k]) * s.half[0] + Math.abs(s.e[k + 4]) * s.half[1] + Math.abs(s.e[k + 8]) * s.half[2]

/** A piece's boxes as `measure` keeps them: its whole box, its parts (square to it, from `from`), the list of its surfaces, and when it was last measured. */
interface MeasuredBody {
  readonly whole: Solid
  parts: Solid[]
  from: readonly PartBox[] | undefined
  squares: Array<{ readonly center: Vec3; readonly half: Vec3 }>
  readonly list: Solid[]
  stamp: number
  /** `list` as a contact shape (`apartDeep`). */
  shape?: ContactShape
}

/** The axis of the box whose face the last `boxTopAt` line left through (its top there): the face a point on that spot stands on. */
let topFace = 1

/** Height where the vertical line through `(x, z)` leaves the top of a box, or -Infinity when it misses the box. */
const boxTopAt = (s: Solid, x: number, z: number): number => {
  const e = s.e
  const dx = x - s.c[0], dz = z - s.c[2]
  let t0 = -Infinity, t1 = Infinity
  for (let k = 0; k < 3; k++) {
    // the line is c + (dx, t, dz) with t the height over the centre; along axis k: p + t d
    const p = e[k * 4] * dx + e[k * 4 + 2] * dz
    const d = e[k * 4 + 1]
    const h = s.half[k]
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(p) > h) return -Infinity
      continue
    }
    let a = (-h - p) / d, b = (h - p) / d
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a)
    if (b < t1) {
      t1 = b
      topFace = k
    }
    if (t0 > t1) return -Infinity
  }
  return s.c[1] + t1
}

const UP: Vec3 = [0, 1, 0]

/** The key of a pair of pieces (`PieceSystem.apartDeep`), the same whichever comes first. */
export const apartKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

/** The outward normal of face `axis` of a box on its upper side: the surface of a tilted table top under a point. */
const faceNormal = (s: Solid, axis: number): Vec3 => {
  const e = s.e
  const sign = e[axis * 4 + 1] < 0 ? -1 : 1
  return [sign * e[axis * 4], sign * e[axis * 4 + 1], sign * e[axis * 4 + 2]]
}

/** The friction of two surfaces against each other: the geometric mean of each one's coefficients. */
const pairFriction = (a: PieceFriction | undefined, b: PieceFriction | null): PieceFriction => ({
  static: Math.sqrt((a?.static ?? MU_STATIC) * (b?.static ?? MU_STATIC)),
  dynamic: Math.sqrt((a?.dynamic ?? MU_DYNAMIC) * (b?.dynamic ?? MU_DYNAMIC)),
  // the softer of the two sets how much a round thing rolling on the other sinks in and is held back
  rolling: Math.max(a?.rolling ?? 0, b?.rolling ?? ROLLING_RESISTANCE),
  // both lose energy in the contact: a log on grass is held by its bark and by the blades
  rollingDamping: (a?.rollingDamping ?? PIECE_ROLLING_DAMPING) + (b?.rollingDamping ?? GROUND_ROLLING_DAMPING),
})

/**
 * Light rigid-body physics for loose pieces: gravity, the 8 corners of the local box against the ground with an impulse (restitution, friction,
 * angular response), damping, sleeping, and a gentle horizontal separation between pieces side by side. The ground a corner lands on is the
 * highest of the terrain, the top of any other piece under it and what the host reports as fixed (`staticTopAt`): a falling shelf lands on the books
 * below it, a tipping panel on the chair in front of it. Over a step (a table's edge) points along the box's edges touch too, so the edge holds the box between
 * its corners, and the side of a step of the ground is a wall: a corner that comes at it from the side stops there. The contacts are solved together, warm started.
 * Not a general solver: what lies under a corner holds it, what stands beside it does not.
 */
export class PieceSystem {
  readonly list: PieceBody[] = []
  private time = 0
  private generations = 0
  private readonly p: THREE_NS.Vector3
  private readonly dq: THREE_NS.Quaternion
  private readonly m: THREE_NS.Matrix4
  private readonly ax: THREE_NS.Vector3
  private readonly wakeBox: THREE_NS.Box3
  private solids: Solid[] = []
  /** The engine stepping the pieces (`PieceSystemOptions.physics`). */
  private readonly engine: EnginePieces
  /** The loop the system steps itself (a world was handed) or only registers on (a loop was handed). */
  private readonly loop: PhysicsLoop
  private readonly stepsItself: boolean
  /** The phases' way out of the loop, and whether this frame's `prepare` ran (it runs once, in the first fixed step). */
  private readonly leaveLoop: Array<() => void> = []
  private prepared = false
  /** The pose before the last step and after it, of the pieces that were awake (`interpolate`); null when the option is off. */
  private readonly trail: PoseTrail | null
  /** The pieces the loops walk (`AwakeList`): the rest are asleep on both sides and measured, and cost nothing per update. */
  private readonly awake = new AwakeList()
  /** `solids` and `surfaces` must be written again from the list: a piece came, went, or changed its parts. */
  private layoutDirty = true
  private reshaped = false
  /** The time each piece was made (`keepFar`: how old it is). */
  private readonly bornAt = new WeakMap<PieceBody, number>()
  private keptAt = -Infinity
  /** The boxes other pieces land on: a piece's own parts when it has them (`partBoxes`), else its box. */
  private surfaces: Solid[] = []
  /** The surfaces by the cells of a grid on the ground (`SURFACE_CELL`) their bounding circle covers: what is under a point is looked for in its cell only. */
  private readonly surfaceGrid = new Map<number, Solid[]>()
  /** The surfaces wider than `SURFACE_CELLS_ACROSS` cells (a slab come down whole): looked at for every point. */
  private readonly wideSurfaces: Solid[] = []
  /** Each piece's box of the step (`solids`), by its body. */
  private readonly solidOf = new Map<PieceBody, Solid>()
  /** Each piece's surfaces of the step (its parts' boxes, or its box), by its body. */
  private readonly surfacesOf = new Map<PieceBody, Solid[]>()
  /** Each piece's boxes, reused by `measure` from one update to the next, and the count of measures (what a record was last measured in). */
  private readonly records = new WeakMap<PieceBody, MeasuredBody>()
  private measures = 0
  /** `apartDeep`'s marked pairs, kept from one update to the next, and the pieces it has already looked at when they were born. */
  private readonly apartKeys = new Set<string>()
  /** Pieces torn apart by a joint that tears (a wire and the pole it hung from): the engine leaves each pair alone for good, by `apartKey`. */
  private readonly tethered = new Set<string>()
  /** The object ids alive in this update (`apartAll`), kept to make no set per frame. */
  private readonly presentIds = new Set<string>()
  private readonly seenBorn = new WeakSet<PieceBody>()
  /** The grid's cells by key: each its list (the one in `surfaceGrid`) and how many it holds in this measure. */
  private readonly cellIndex = new Map<number, number>()
  private readonly cellLists: Solid[][] = []
  private cellCounts = new Int32Array(64)
  /** How far each piece is put apart from the boxes it overlaps this step (`separatePair`), summed over its pairs and applied once, bounded, at the end of `collide`. */
  private readonly pushes = new Map<PieceBody, Vec3>()
  /** What each piece was put apart by in the last step, and the share of its push it is given now (`applyPushes`), for the pairs met in `collide` and in `apartDeep` apart. */
  private readonly collideSteps = new Map<PieceBody, PushStep>()
  private readonly apartSteps = new Map<PieceBody, PushStep>()
  private supportTurn = 0
  /** The surface normal and the friction of what the last `supportAt` found under the point (the ground and fixed tops are level: up, and no piece). */
  private supportNormal: Vec3 = UP
  private supportFriction: PieceFriction | null = null
  private supportBody: PieceBody | null = null

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: PieceSystemOptions,
  ) {
    this.p = new THREE.Vector3()
    this.dq = new THREE.Quaternion()
    this.m = new THREE.Matrix4()
    this.ax = new THREE.Vector3()
    this.wakeBox = new THREE.Box3()
    const resolved = resolvePhysics(o.physics)
    this.loop = resolved.loop
    this.stepsItself = resolved.stepsItself
    this.trail = o.interpolate ? new PoseTrail() : null
    this.engine = new EnginePieces(THREE, resolved.loop.world, {
        groundAt: o.terrainAt ?? o.groundAt,
        ...(o.terrainRollingAt ? { groundRollingAt: o.terrainRollingAt } : {}),
        ...(o.terrainRollingDampingAt ? { groundRollingDampingAt: o.terrainRollingDampingAt } : {}),
        ...(o.terrainRangeAt ? { groundRange: o.terrainRangeAt } : {}),
        // the grid stands for `terrainAt` alone: without it the tiles read `groundAt`, which the grid may not be (a lot flattened, a slab)
        ...(o.terrainGridAt && o.terrainAt ? { groundGrid: o.terrainGridAt } : {}),
        ...(o.terrainPatchAt && o.terrainGridAt && o.terrainAt ? { groundPatch: o.terrainPatchAt } : {}),
        ...(o.blastGroundTiles !== undefined ? { blastTiles: o.blastGroundTiles } : {}),
        gravity: o.gravity,
        staticSolids: o.staticSolids,
        staticUnsure: o.staticUnsure,
        sweep: o.sweep,
        onSlam: o.onSlam,
        onKnock: o.onKnock,
        onHardLanding: o.onHardLanding,
        ...(o.tilesUnderParts ? { tilesUnderParts: true } : {}),
        ...(o.heldIgnores ? { heldIgnores: o.heldIgnores } : {}),
        ...(o.groundWorker ? { groundWorker: o.groundWorker } : {}),
        ...(o.groundWorkerFrames !== undefined ? { groundWorkerFrames: o.groundWorkerFrames } : {}),
      })
    if (!resolved.stepsItself) this.joinLoop(resolved.loop, this.engine)
  }

  /** Contact blows on the fixed parts become `blunt` hits of `destruction` (`engine-impacts.ts`). Returns the way to stop it. */
  contactHits(destruction: DestructionWorld, options?: EngineImpactsOptions): () => void {
    const engine = this.engine
    return createEngineImpacts(this.loop, engine.statics, destruction, { harmless: (body) => engine.pieceOfBody(body)?.debris === true, ...options })
  }

  /**
   * The pieces a blast at `point` can reach: the bodies the engine's `blastQuery` finds within `radius` (the pieces among them), in the order of `list`, and the pieces that have no
   * body yet. The pieces are not walked one by one to measure each one's distance; the caller still takes the distance to the centre of each, as before.
   */
  piecesInBlast(blastQuery: BlastQuery, point: Vec3, radius: number): PieceBody[] {
    const engine = this.engine
    const found = blastQuery.run({ origin: point, radius })
    const reached = new Set<PieceBody>()
    for (let i = 0; i < found.bodyCount; i++) {
      const piece = engine.pieceOfBody(found.bodies[i] as BodyId)
      if (piece) reached.add(piece)
    }
    return this.list.filter((piece) => reached.has(piece) || !engine.hasBody(piece))
  }

  /** The engine's fixed bodies as the broad phase of the world's rays. */
  rayBroadPhase(): RayBroadPhase | null {
    return this.engine.rayBroadPhase()
  }

  /**
   * The loop mode: the system's work goes into the loop's phases. `prepare` (sync, kinematic targets, the kit's rules that came before the step) runs in the first fixed step of
   * a frame; a held piece's target again in each later one; the read-back and knock sounds after the steps (`contacts`); the budget and the measure after those (`rules`).
   */
  private joinLoop(loop: PhysicsLoop, engine: EnginePieces): void {
    const h = loop.world.fixedStep
    this.leaveLoop.push(
      loop.add(
        {
          beforeStep: (step, frame) => {
            if (this.prepared) return engine.moveHeld(this.list, step, this.awake)
            this.prepared = true
            engine.wakePending(this.list, this.awake)
            this.beginTick()
            this.measure()
            this.wakeUnsupported(true)
            engine.prepare(this.list, frame.steps * h, step, this.apartAll(frame.steps * h), this.awake)
          },
        },
        'actors',
      ),
      loop.add(
        {
          afterSteps: (dt, frame) => {
            // a frame too short for a step has no events and nothing moved: nothing to read back
            if (frame.steps > 0) engine.finish(this.list, dt, frame.time, this.awake)
          },
        },
        'contacts',
      ),
      loop.add(
        {
          afterSteps: () => {
            const ran = this.prepared
            this.prepared = false
            if (!ran) return
            this.trail?.commit()
            this.measure()
            this.keepBudget()
          },
        },
        'rules',
      ),
    )
  }

  /** Takes the system's phases out of the loop it was handed. */
  dispose(): void {
    this.trail?.clear()
    for (const leave of this.leaveLoop.splice(0)) leave()
    this.engine.dispose()
  }

  /**
   * Pairs born overlapping (both made in the same update, or one made inside the other) deeper than a contact (`LIFT_DEPTH`: chunks of one wall) go apart along the ground by
   * the kit's rule (`slideApart`), and the engine leaves the pair alone until they are apart: it would push them out along their least overlap, up through the pile. A pair
   * is marked once, when the second of them is first seen, and unmarked for good when apart; what comes to overlap later through the dynamics is the engine's. The pairs, by `apartKey`.
   */
  /** The engine is to leave these two pieces (by object id) alone from now on: they were one object, held by a joint that tore. */
  tether(a: string, b: string): void {
    this.tethered.add(apartKey(a, b))
  }

  /** The pairs the engine leaves alone: the deep ones, and the tethered ones whose two pieces both exist. */
  private apartAll(dt: number): Set<string> {
    const deep = this.apartDeep(dt)
    if (this.tethered.size === 0) return deep
    const present = this.presentIds
    present.clear()
    for (const b of this.list) present.add(b.objectId)
    const all = new Set(deep)
    for (const key of this.tethered) {
      const cut = key.indexOf('\u0000')
      if (present.has(key.slice(0, cut)) && present.has(key.slice(cut + 1))) all.add(key)
    }
    return all
  }

  private apartDeep(dt: number): Set<string> {
    const keys = this.apartKeys
    const born = this.list.filter((b) => !this.seenBorn.has(b))
    for (const b of born) this.seenBorn.add(b)
    for (const b of born) {
      for (const o of this.list) {
        if (o === b || (born.includes(o) && o.objectId < b.objectId)) continue
        if (this.bornApart(b, o)) keys.add(apartKey(b.objectId, o.objectId))
      }
    }
    if (keys.size === 0) return keys
    const byObject = new Map<string, PieceBody>()
    for (const b of this.list) byObject.set(b.objectId, b)
    for (const key of keys) {
      const cut = key.indexOf('\u0000')
      const a = byObject.get(key.slice(0, cut))
      const b = byObject.get(key.slice(cut + 1))
      const hit = a && b ? this.deepContact(a, b) : null
      if (!a || !b || !hit) {
        keys.delete(key)
        continue
      }
      const ima = a.held || a.sleeping ? 0 : 1 / a.mass
      const imb = b.held || b.sleeping ? 0 : 1 / b.mass
      this.slideApart(a, b, ima, imb, hit)
    }
    this.applyPushes(dt, this.apartSteps)
    return keys
  }

  /** Whether two pieces just seen are inside each other deeper than a contact. */
  private bornApart(a: PieceBody, b: PieceBody): boolean {
    if (a.round || b.round || ((a.held || a.sleeping) && (b.held || b.sleeping))) return false
    if (!this.partsOverlap(a, b)) return false
    const hit = shapeContact(this.measuredShape(a), this.measuredShape(b))
    return !!hit && hit.depth > LIFT_DEPTH
  }

  /** The contact to slide a marked pair apart by, or null once they are no deeper than a contact (or no longer both boxes that can be moved). */
  private deepContact(a: PieceBody, b: PieceBody): ShapeContact | null {
    if (a.round || b.round || ((a.held || a.sleeping) && (b.held || b.sleeping))) return null
    const sa = this.measuredShape(a)
    const sb = this.measuredShape(b)
    const hit = shapeContact(sa, sb)
    if (!hit || hit.depth <= LIFT_DEPTH) return null
    return Math.hypot(hit.normal[0], hit.normal[2]) > KNOCK_FLAT ? (levelBoxesApart(sa, sb) ?? hit) : boxesApartAlongGround(sa, sb)
  }

  /** A box piece's shape as `measure` left it (`surfacesOf`), one object per piece. */
  private measuredShape(b: PieceBody): ContactShape {
    const rec = this.measured(b)
    rec.shape ??= { kind: 'boxes', boxes: rec.list }
    return rec.shape
  }

  get(objectId: string): PieceBody | null {
    return this.list.find((b) => b.objectId === objectId) ?? null
  }

  /** Whether `upper` lies flat on a top of `lower` that is steeper than its friction holds: what it slides on, not a wall in its way. */
  slidesOn(upper: PieceBody, lower: PieceBody): boolean {
    return this.restsOn(upper, lower, false) && this.onSteepSupport(upper)
  }

  /** Sets a piece falling over, about the world axes x and z (a unit axis): its feet are thinner than the box that stands for it, so the box alone would hold it up. */
  tip(body: PieceBody, x: number, z: number): void {
    body.tipping = { x, z, seconds: TIP_SECONDS }
    body.sleeping = false
  }

  /**
   * Hangs a piece on a hinge at `point` (world): that point of it stays where it is while the rest swings down about it, as a shelf that lost the side at one end swings on
   * the screw at the other and pours what lay on it off its free end. It lets go past `HINGE_RELEASE` or `HINGE_SECONDS`. On the engine it is a hinge joint to a fixed anchor (`EnginePieces.hang`).
   */
  hinge(body: PieceBody, point: Vec3): void {
    const c = this.centerOf(body, this.p)
    const q = body.root.quaternion
    const local = this.ax.set(point[0] - c.x, point[1] - c.y, point[2] - c.z).applyQuaternion(this.dq.copy(q).invert())
    body.hinge = { point: [point[0], point[1], point[2]], local: [local.x, local.y, local.z], from: [q.x, q.y, q.z, q.w], seconds: HINGE_SECONDS }
    body.sleeping = false
  }

  create(objectId: string, root: THREE_NS.Object3D, halfExtents: Vec3, localCenter: THREE_NS.Vector3, mass: number, velocity?: Vec3, angular?: Vec3): PieceBody {
    const existing = this.get(objectId)
    if (existing) {
      existing.root = root
      existing.halfExtents = halfExtents
      existing.mass = mass
      this.setCenter(existing, localCenter)
      if (velocity) existing.velocity = [...velocity]
      existing.sleeping = false
      return existing
    }
    const awake = this.awake
    const least = MIN_PIECE_HALF
    let asleep = false
    let inHand = false
    const body: PieceBody = {
      objectId,
      generation: ++this.generations,
      tipping: null,
      root,
      velocity: velocity ? [...velocity] : [0, 0, 0],
      angularVelocity: angular ? [...angular] : [0, 0, 0],
      halfExtents: [Math.max(least, halfExtents[0]), Math.max(least, halfExtents[1]), Math.max(least, halfExtents[2])],
      mass: Math.max(0.05, mass),
      // asleep or held is read and written as a plain flag; waking or taking it in hand puts the piece among the awake ones
      get sleeping() {
        return asleep
      },
      set sleeping(value: boolean) {
        asleep = value
        if (!value) awake.enter(body)
      },
      get held() {
        return inHand
      },
      set held(value: boolean) {
        inHand = value
        if (value) awake.enter(body)
      },
      localCenter: [localCenter.x, localCenter.y, localCenter.z],
      centerV: localCenter.clone(),
      still: 0,
      calmAt: null,
      calm: 0,
      lastHit: -1,
      onGround: false,
    }
    this.list.push(body)
    awake.enter(body)
    this.layoutDirty = true
    this.bornAt.set(body, this.time)
    return body
  }

  /** What the loop's last frame cost (ms) and how many bodies the world had awake: the pair the cost of a body is read from. */
  stepCost(): { stepMs: number; active: number } {
    return { stepMs: this.loop.frame.stepMs, active: this.loop.world.activeCount }
  }

  /** Bodies awake in the physics world. */
  activeBodies(): number {
    return this.loop.world.activeCount
  }

  /** Move the centre of mass (after a part broke off). */
  setCenter(b: PieceBody, c: THREE_NS.Vector3): void {
    b.centerV.copy(c)
    b.localCenter = [c.x, c.y, c.z]
    this.awake.enter(b)
  }

  remove(objectId: string): void {
    const i = this.list.findIndex((b) => b.objectId === objectId)
    if (i < 0) return
    // the boxes of the step forget it too: nothing keeps a removed piece's tree alive
    const [gone] = this.list.splice(i, 1)
    if (gone) this.awake.leave(gone)
    this.layoutDirty = true
    // its torn pairs go with it (§8); a pair whose other side is a fixed object, not a piece, stays until the piece goes: the pole may still fall
    for (const key of this.tethered) {
      const cut = key.indexOf('\u0000')
      if (key.slice(0, cut) === objectId || key.slice(cut + 1) === objectId) this.tethered.delete(key)
    }
    if (gone) {
      this.forgetSolids(gone)
      this.engine.remove(gone)
    }
  }

  clear(): void {
    this.trail?.clear()
    this.engine.clear()
    this.list.length = 0
    this.awake.clear()
    this.layoutDirty = true
    this.solids = []
    this.surfaces = []
    this.solidOf.clear()
    this.surfacesOf.clear()
    this.collideSteps.clear()
    this.apartSteps.clear()
    this.surfaceGrid.clear()
    this.cellIndex.clear()
    this.cellLists.length = 0
    this.wideSurfaces.length = 0
  }

  /** Drops a piece from the boxes of the step (`solids`, `surfaces` and their grid) and from the pushes it is remembered by. */
  private forgetSolids(body: PieceBody): void {
    this.collideSteps.delete(body)
    this.apartSteps.delete(body)
    this.solidOf.delete(body)
    this.surfacesOf.delete(body)
    this.solids = this.solids.filter((s) => s.body !== body)
    this.surfaces = this.surfaces.filter((s) => s.body !== body)
    for (const [key, cell] of this.surfaceGrid) {
      // the cell's own list, cut in place: `gridSurfaces` fills the same lists again
      let kept = 0
      for (const one of cell) if (one.body !== body) cell[kept++] = one
      cell.length = kept
      if (kept > 0) continue
      this.surfaceGrid.delete(key)
      this.cellIndex.delete(key)
    }
    const wide = this.wideSurfaces.filter((s) => s.body !== body)
    this.wideSurfaces.length = 0
    this.wideSurfaces.push(...wide)
  }

  /** `clear` and the clock back to 0. */
  reset(): void {
    this.clear()
    this.time = 0
  }

  /** World position of the centre of mass. */
  centerOf(b: PieceBody, out: THREE_NS.Vector3): THREE_NS.Vector3 {
    return out.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  impulse(b: PieceBody, impulse: Vec3, point?: Vec3): void {
    const inv = 1 / b.mass
    b.velocity[0] += impulse[0] * inv
    b.velocity[1] += impulse[1] * inv
    b.velocity[2] += impulse[2] * inv
    if (point) {
      const c = this.centerOf(b, this.p)
      const rx = point[0] - c.x
      const ry = point[1] - c.y
      const rz = point[2] - c.z
      // torque = r x J, angular velocity change = I^-1 torque
      const tx = ry * impulse[2] - rz * impulse[1]
      const ty = rz * impulse[0] - rx * impulse[2]
      const tz = rx * impulse[1] - ry * impulse[0]
      const w = this.mulInvInertia(b, tx, ty, tz)
      b.angularVelocity[0] += w[0]
      b.angularVelocity[1] += w[1]
      b.angularVelocity[2] += w[2]
    }
    b.sleeping = false
    b.still = 0
    b.calmAt = null
  }

  /** I^-1 * (x, y, z) in world space for a box with the body's half extents and mass (needs `this.m` to hold the body's rotation). */
  private mulInvInertia(b: PieceBody, x: number, y: number, z: number): Vec3 {
    this.m.makeRotationFromQuaternion(b.root.quaternion)
    return this.mulInvInertiaWith(b, this.m.elements, x, y, z)
  }

  private mulInvInertiaWith(b: PieceBody, e: ArrayLike<number>, x: number, y: number, z: number): Vec3 {
    const [hx, hy, hz] = b.halfExtents
    const k = 3 / b.mass
    let ix = k / (hy * hy + hz * hz)
    let iy = k / (hx * hx + hz * hz)
    let iz = k / (hx * hx + hy * hy)
    const round = b.round
    if (round) {
      // about the axis it rolls on, a round piece has I = k m r^2: a full can is a solid cylinder (k 0.5), an empty one a thin shell (k 1)
      const about = 1 / (round.inertia * b.mass * round.radius * round.radius)
      if (round.kind === 'sphere') ix = iy = iz = about
      else if (round.axis === 0) ix = about
      else if (round.axis === 1) iy = about
      else iz = about
    }
    // local = R^T v (columns of R are the local axes in world space)
    const lx = (e[0] * x + e[1] * y + e[2] * z) * ix
    const ly = (e[4] * x + e[5] * y + e[6] * z) * iy
    const lz = (e[8] * x + e[9] * y + e[10] * z) * iz
    return [e[0] * lx + e[4] * ly + e[8] * lz, e[1] * lx + e[5] * ly + e[9] * lz, e[2] * lx + e[6] * ly + e[10] * lz]
  }

  /** The points of the box that touch the ground, in its own frame: the 8 corners, then (with `edges`) `EDGE_POINTS` along each of its 12 edges; or the piece's own `contacts`. */
  private samples(b: PieceBody, edges: boolean): Vec3[] {
    if (b.contacts) return b.contacts
    const [hx, hy, hz] = b.halfExtents
    const out: Vec3[] = []
    for (let i = 0; i < 8; i++) out.push([i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz])
    if (!edges) return out
    const h = [hx, hy, hz]
    for (let axis = 0; axis < 3; axis++) {
      const a1 = (axis + 1) % 3
      const a2 = (axis + 2) % 3
      const fractions = edgeFractions(h[axis]!, Math.min(hx, hy, hz))
      for (let k = 0; k < 4; k++) {
        for (const f of fractions) {
          const p: Vec3 = [0, 0, 0]
          p[axis] = f * h[axis]
          p[a1] = k & 1 ? h[a1] : -h[a1]
          p[a2] = k & 2 ? h[a2] : -h[a2]
          out.push(p)
        }
      }
    }
    return out
  }

  /** A blast at (x, z) of `radius`: the ground within its reach is laid at the next update, before the pieces it makes need it (`EnginePieces.layAhead`). */
  layGroundAt(x: number, z: number, radius: number): void {
    this.engine.layAhead(x, z, radius)
  }

  /** What lies inside the disc looks at the ground again: it was dug or heaped under it. */
  wakeRegion(x: number, z: number, radius: number): void {
    this.engine.groundChanged(x, z, radius)
    for (const b of this.list) {
      if (!b.sleeping || b.held) continue
      if (Math.hypot(b.root.position.x - x, b.root.position.z - z) > radius && !this.lostGroundIn(b, x, z, radius)) continue
      b.sleeping = false
      b.still = 0
      b.calmAt = null
    }
  }

  /**
   * A piece whose root is elsewhere (cut from a whole object, its root is that object's origin) that lies in the disc, with the ground gone from under part of its footprint:
   * where it lies is read from its drawn box, and only a support that went down wakes it (a piece the disc only passes over stays asleep).
   */
  private lostGroundIn(b: PieceBody, x: number, z: number, radius: number): boolean {
    const center = this.centerOf(b, this.ax)
    if (Math.hypot(center.x - x, center.z - z) > radius + Math.hypot(b.halfExtents[0], b.halfExtents[2])) return false
    const box = this.wakeBox.setFromObject(b.root)
    for (let i = 0; i <= WAKE_SAMPLES; i++) {
      for (let k = 0; k <= WAKE_SAMPLES; k++) {
        const px = box.min.x + ((box.max.x - box.min.x) * i) / WAKE_SAMPLES, pz = box.min.z + ((box.max.z - box.min.z) * k) / WAKE_SAMPLES
        if (Math.hypot(px - x, pz - z) > radius) continue
        const support = Math.max(this.o.groundAt(px, pz), this.o.staticTopAt?.(px, pz, box.min.y, STEP) ?? -Infinity)
        if (support < box.min.y - WAKE_DROP) return true
      }
    }
    return false
  }

  /** A step is about to move the pieces: the roots go back to the step's pose and the awake ones are recorded as the previous one (`interpolate`). */
  private beginTick(): void {
    const trail = this.trail
    if (!trail) return
    trail.begin()
    for (const body of this.awake.items) if (!body.sleeping) trail.record(body.root)
  }

  /** The roots get the step pose back, before anything reads them (the start of a tick; a host calls it first when it reads a root between `presentPose` and the step). */
  restoreStepPose(): void {
    this.trail?.restore()
  }

  /** The awake pieces drawn `alpha` of the way from their pose before the last step to the step's (1: the step's). Pieces asleep, and without `interpolate`, are left as they are. */
  presentPose(alpha: number): void {
    this.trail?.blend(alpha)
  }

  update(dt: number): void {
    if (this.trail && this.stepsItself) {
      this.beginTick()
      this.advance(dt)
      this.trail.commit()
      return
    }
    this.advance(dt)
  }

  private advance(dt: number): void {
    // under a loop the host stepped it already, and its time is the one that counts
    if (!this.stepsItself) {
      this.time = this.loop.frame.time
      this.keepFar()
      return
    }
    this.time += dt
    this.engine.wakePending(this.list, this.awake)
    this.measure()
    // what the budget put to sleep (the engine did not) wakes when a point it lay on loses its support: the kit's rule. What the engine put to sleep it wakes
    // itself when what holds it moves; a fixed thing removed or the ground changed wakes what was there (`EnginePieces`)
    this.wakeUnsupported(true)
    if (dt > 0) {
      this.engine.prepare(this.list, dt, dt, this.apartAll(dt), this.awake)
      this.loop.step(dt)
      this.engine.finish(this.list, dt, this.time, this.awake)
    }
    this.measure()
    this.keepBudget()
    this.keepFar()
  }

  /**
   * The boxes of the pieces as they stand (`solids`, `surfaces` and their grid): the boxes of the awake pieces are worked out again, the others kept as they were measured (a
   * piece leaves the awake list only after the measure that has its last pose). With none awake and no piece come or gone, nothing is done.
   */
  private measure(): void {
    // each piece's boxes are its own objects from one update to the next, written over in place: two measures an update over 200 pieces made a Vector3, a Matrix4,
    // its elements twice and the surfaces anew for each (90 MB in 200 updates of the debris bench, most of the collector's pauses)
    this.measures++
    this.reshaped = this.layoutDirty
    this.awake.walk(this.measureAwake)
    if (this.reshaped) this.writeLayout()
    else if (this.awake.items.length > 0) this.gridSurfaces()
    this.awake.settle(this.isSettled)
  }

  /** A piece is asleep on both sides (the engine's too): nothing of it changes until it wakes. */
  private readonly isSettled = (body: PieceBody): boolean => this.engine.isSettled(body)

  private readonly measureAwake = (body: PieceBody): void => {
    const rec = this.measured(body)
    const from = rec.from
    const count = rec.list.length
    const first = rec.list[0]
    const w = rec.whole
    const c = this.centerOf(body, this.p)
    w.c[0] = c.x
    w.c[1] = c.y
    w.c[2] = c.z
    const el = this.m.makeRotationFromQuaternion(body.root.quaternion).elements
    for (let k = 0; k < 16; k++) w.e[k] = el[k]
    const h = body.halfExtents
    w.half = h
    w.r = Math.sqrt(h[0] * h[0] + h[1] * h[1] + h[2] * h[2])
    // what lands on a piece lands on its parts (a shelf's boards, a table's top), not on the box around them all
    const parts = body.partBoxes
    if (!parts) {
      rec.list[0] = w
      if (rec.list.length !== 1) rec.list.length = 1
    } else this.measureParts(rec, parts)
    if (rec.from !== from || rec.list.length !== count || rec.list[0] !== first) this.reshaped = true
  }

  /** `solids`, `surfaces` and the maps by body written from the pieces' records, in the order of the list. */
  private writeLayout(): void {
    this.layoutDirty = false
    let solids = 0
    let surfaces = 0
    for (const body of this.list) {
      const rec = this.measured(body)
      this.solids[solids++] = rec.whole
      for (const one of rec.list) this.surfaces[surfaces++] = one
      rec.stamp = this.measures
      this.solidOf.set(body, rec.whole)
      this.surfacesOf.set(body, rec.list)
    }
    this.solids.length = solids
    this.surfaces.length = surfaces
    // a piece taken out goes through `forgetSolids`: this walk only finds one that left the list some other way
    if (this.solidOf.size !== this.list.length) for (const body of this.solidOf.keys()) {
      if (this.records.get(body)?.stamp === this.measures) continue
      this.solidOf.delete(body)
      this.surfacesOf.delete(body)
    }
    this.gridSurfaces()
  }

  /** A piece's own boxes for `measure`, made once. */
  private measured(body: PieceBody): MeasuredBody {
    let rec = this.records.get(body)
    if (!rec) {
      rec = { whole: { body, c: [0, 0, 0], e: new Array<number>(16).fill(0), half: body.halfExtents, r: 0 }, parts: [], from: undefined, squares: [], list: [], stamp: 0 }
      this.records.set(body, rec)
    }
    return rec
  }

  /** Its parts' boxes, square to the piece (`squareBoxOf`, worked out again only when its parts change), placed by its centre and turn of this update. */
  private measureParts(rec: MeasuredBody, parts: readonly PartBox[]): void {
    const w = rec.whole
    if (rec.from !== parts) {
      rec.from = parts
      rec.squares = parts.map(squareBoxOf)
      rec.parts = parts.map(() => ({ body: w.body, c: [0, 0, 0], e: w.e, half: w.half, r: 0 }))
    }
    const e = w.e
    for (let i = 0; i < rec.parts.length; i++) {
      const { center, half } = rec.squares[i]
      const one = rec.parts[i]
      one.c[0] = w.c[0] + e[0] * center[0] + e[4] * center[1] + e[8] * center[2]
      one.c[1] = w.c[1] + e[1] * center[0] + e[5] * center[1] + e[9] * center[2]
      one.c[2] = w.c[2] + e[2] * center[0] + e[6] * center[1] + e[10] * center[2]
      one.half = half
      one.r = Math.sqrt(half[0] * half[0] + half[1] * half[1] + half[2] * half[2])
    }
    for (let i = 0; i < rec.parts.length; i++) rec.list[i] = rec.parts[i]
    if (rec.list.length !== rec.parts.length) rec.list.length = rec.parts.length
  }

  /**
   * The surfaces into the cells of the grid they cover (`surfaceGrid`). The cells' lists are kept from one measure to the next, written over by index and cut to their
   * count at the end: emptied and pushed again, every list was made anew each measure (31 MB in 200 updates of the debris bench).
   */
  private gridSurfaces(): void {
    this.cellCounts.fill(0)
    this.wideSurfaces.length = 0
    for (const one of this.surfaces) {
      const x0 = Math.floor((one.c[0] - one.r) / SURFACE_CELL)
      const x1 = Math.floor((one.c[0] + one.r) / SURFACE_CELL)
      const z0 = Math.floor((one.c[2] - one.r) / SURFACE_CELL)
      const z1 = Math.floor((one.c[2] + one.r) / SURFACE_CELL)
      if (x1 - x0 > SURFACE_CELLS_ACROSS || z1 - z0 > SURFACE_CELLS_ACROSS) {
        this.wideSurfaces.push(one)
        continue
      }
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) this.intoCell(cellKey(ix, iz), one)
    }
    for (const one of this.wideSurfaces) for (const key of this.surfaceGrid.keys()) this.intoCell(key, one)
    for (let i = 0; i < this.cellLists.length; i++) if (this.cellLists[i].length !== this.cellCounts[i]) this.cellLists[i].length = this.cellCounts[i]
  }

  private intoCell(key: number, one: Solid): void {
    let i = this.cellIndex.get(key)
    if (i === undefined) {
      i = this.cellLists.length
      const list: Solid[] = []
      this.cellLists.push(list)
      this.cellIndex.set(key, i)
      this.surfaceGrid.set(key, list)
      if (this.cellCounts.length <= i) {
        const grown = new Int32Array(Math.max(64, this.cellCounts.length * 2))
        grown.set(this.cellCounts)
        this.cellCounts = grown
      }
    }
    this.cellLists[i][this.cellCounts[i]++] = one
  }

  /** A few sleeping pieces each update (`SUPPORT_CHECKS`, in turn) look under them again: one whose table broke, or whose shelf fell over, falls. */
  private wakeUnsupported(onlyBudget = false): void {
    const n = this.list.length
    for (let k = 0; k < Math.min(SUPPORT_CHECKS, n); k++) {
      this.supportTurn = (this.supportTurn + 1) % n
      const b = this.list[this.supportTurn]
      if (!b.sleeping || b.held) continue
      // one put to sleep by the budget needs every point it went to sleep on: a board leaning on a step whose step is gone comes down, though its foot is still on the floor;
      // one the engine put to sleep is the engine's to hold up, unless the slope it lies on has grown steeper than its friction holds (the top under it went over)
      const rest = b.restPoints
      const budgeted = !!rest && rest.length > 0
      const held = onlyBudget && !budgeted ? true : budgeted ? rest.every((point) => this.supportsPoint(b, point)) : this.supported(b, false) || this.supported(b, true)
      if (held && !this.onSteepSupport(b)) continue
      b.sleeping = false
      b.still = 0
      b.calmAt = null
      b.restPoints = undefined
    }
  }

  /**
   * Whether a point of `b` (its corners, or with `edges` the points along its edges too) has the ground, a piece or a fixed top under it. Any point, not only the lowest:
   * a book propped on a fallen case rests by a corner high on it while its lowest one hangs beside it.
   */
  private supported(b: PieceBody, edges: boolean): boolean {
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    for (const [sx, sy, sz] of this.samples(b, edges)) {
      const y = c.y + e[1] * sx + e[5] * sy + e[9] * sz
      const x = c.x + e[0] * sx + e[4] * sy + e[8] * sz
      const z = c.z + e[2] * sx + e[6] * sy + e[10] * sz
      if (this.supportAt(b, x, y, z, STEP) >= y - SUPPORT_GAP) return true
    }
    return false
  }

  /** The surfaces whose cell holds `(x, z)`, the wide ones (`wideSurfaces`) among them. */
  private surfacesAt(x: number, z: number): readonly Solid[] {
    return this.surfaceGrid.get(cellKey(Math.floor(x / SURFACE_CELL), Math.floor(z / SURFACE_CELL))) ?? this.wideSurfaces
  }

  /** The highest top of a piece (other than `self`) under `(x, z)` that a point at height `y` stands on (at most `step` above it), -Infinity when none; the boxes of the last update. */
  topAt(x: number, z: number, y: number, step: number, self?: string): number {
    let top = -Infinity
    for (const s of this.surfacesAt(x, z)) {
      if (s.body.objectId === self || (s.body.held && !s.body.carrying) || Math.abs(x - s.c[0]) > s.r || Math.abs(z - s.c[2]) > s.r) continue
      const t = boxTopAt(s, x, z)
      if (t > top && t <= y + step) top = t
    }
    return top
  }

  /**
   * Whether `o` rests on a top of `below` (its parts, or its box): a corner of `o` (its contacts or its box) is over that top and within `STEP` of it. With `lowest`, only its
   * lowest corners count (within `STEP` of its lowest): a can rolling by another is beside it, not on it; without, a board leaning on a seat by its high end rests on the seat.
   */
  private restsOn(o: PieceBody, below: PieceBody, lowest: boolean): boolean {
    const c = this.centerOf(o, this.p)
    const e = this.m.makeRotationFromQuaternion(o.root.quaternion).elements
    const points = this.samples(o, false).map(([sx, sy, sz]): Vec3 => [c.x + e[0] * sx + e[4] * sy + e[8] * sz, c.y + e[1] * sx + e[5] * sy + e[9] * sz, c.z + e[2] * sx + e[6] * sy + e[10] * sz])
    let low = Infinity
    for (const p of points) low = Math.min(low, p[1])
    for (const [x, y, z] of points) {
      if (lowest && y > low + STEP) continue
      for (const s of this.surfacesAt(x, z)) if (s.body === below && Math.abs(y - boxTopAt(s, x, z)) <= STEP) return true
    }
    return false
  }

  /** Where a corner of `self` at `(x, y, z)` lands: the ground, the top of another piece or of something fixed under it. */
  private supportAt(self: PieceBody, x: number, y: number, z: number, step: number): number {
    let top = this.o.groundAt(x, z)
    let on: Solid | null = null
    let face = 1
    for (const s of this.surfacesAt(x, z)) {
      if (s.body === self || (s.body.held && !s.body.carrying) || Math.abs(x - s.c[0]) > s.r || Math.abs(z - s.c[2]) > s.r) continue
      const t = boxTopAt(s, x, z)
      if (t > top && t <= y + step) {
        top = t
        on = s
        face = topFace
      }
    }
    const fixed = this.o.staticTopAt?.(x, z, y, step) ?? -Infinity
    if (fixed >= top) on = null
    this.supportNormal = on ? faceNormal(on, face) : UP
    this.supportFriction = on?.body.friction ?? null
    this.supportBody = on?.body ?? null
    return Math.max(top, fixed)
  }

  /**
   * Whether `b` lies flat on a settled top (asleep) tilted past what the friction of the two holds (a laptop on a table top gone over at 42 degrees, held by 0.49 up to 26),
   * with every corner that touches on it: it slides, it does not sleep there, and one asleep there wakes. Held by anything else (the floor, a flat top, a side it leans on, a
   * pile still moving) it is not this case: the contacts hold or move it.
   */
  private onSteepSupport(b: PieceBody): boolean {
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    let touching = false
    for (const [sx, sy, sz] of this.samples(b, false)) {
      const y = c.y + e[1] * sx + e[5] * sy + e[9] * sz
      if (this.supportAt(b, c.x + e[0] * sx + e[4] * sy + e[8] * sz, y, c.z + e[2] * sx + e[6] * sy + e[10] * sz, STEP) < y - SUPPORT_GAP) continue
      // a top that is itself still moving (a pile being knocked about) is not a slope that has settled
      if (this.supportBody && !this.supportBody.sleeping) return false
      const n = this.supportNormal
      const ny = n[1]
      const holds = pairFriction(b.friction, this.supportFriction).static
      if (ny >= 1 - 1e-6 || ny < SLOPE_MIN_NORMAL || Math.sqrt(Math.max(0, 1 - ny * ny)) / ny <= holds * STEEP_MARGIN) return false
      // lying flat on the slope: a piece that leans on a corner or wedged against a side is held by more than the friction of one face
      let flat = 0
      for (let axis = 0; axis < 12; axis += 4) flat = Math.max(flat, Math.abs(e[axis] * n[0] + e[axis + 1] * n[1] + e[axis + 2] * n[2]))
      if (flat < LIES_FLAT) return false
      touching = true
    }
    return touching
  }

  /** The piece sleeps where it lies: its speeds are dropped, nothing moves it. */
  private sleep(b: PieceBody): void {
    b.restPoints = undefined
    b.sleeping = true
    b.calmAt = null
    b.steady = null
    b.velocity[0] = b.velocity[1] = b.velocity[2] = 0
    b.angularVelocity[0] = b.angularVelocity[1] = b.angularVelocity[2] = 0
  }

  /**
   * Over `maxAwake` pieces awake, the oldest that have come to rest sleep where they lie: on the ground, slower than `STILL_SPEED` and `STILL_SPIN`, not falling over (`tip`),
   * and one held up at an angle (a board leaning on a seat) only once it kept its tilt for `STEADY_SECONDS`; that one sleeps then under the budget too, since nothing else puts
   * it to sleep. It keeps the points it lies on (`restPoints`) and wakes when any of them loses its support (`wakeUnsupported`): put to sleep sooner than it would have slept by
   * itself, it answers to every point that holds it.
   */
  private keepBudget(): void {
    const most = this.o.maxAwake
    if (most === undefined || !Number.isFinite(most)) return
    let awake = 0
    for (const b of this.list) {
      if (b.sleeping || b.held) continue
      // one held up at an angle never sleeps by itself (`still`), though it has come to rest: with a budget it does, whatever the count. One that has lain still for `SLEEP_AFTER`
      // sleeps whatever the count too: the engine wakes a sleeper that touches an awake body at every step, so the ones left awake under the count would never sleep by themselves
      if (this.hasComeToRest(b) && (b.balancing || (b.still >= SLEEP_AFTER && !b.hinge && !this.onSteepSupport(b)))) this.sleepByBudget(b)
      else awake++
    }
    for (const b of this.list) {
      if (awake <= most) return
      if (b.sleeping || b.held || !this.hasComeToRest(b)) continue
      this.sleepByBudget(b)
      awake--
    }
  }

  /**
   * The far and old rule (`PieceSystemOptions.keep`), looked at twice a second: a piece at rest, old and far, sleeps or fades; over `maxLive` pieces the far and old ones at rest
   * fade first, then the oldest at rest. Only what has come to rest goes, so nothing is taken from under a falling thing.
   */
  private keepFar(): void {
    const keep = this.o.keep
    if (!keep || this.time - this.keptAt < KEEP_EVERY) return
    this.keptAt = this.time
    const focus = keep.focus?.()
    const isFarAndOld = (b: PieceBody): boolean => {
      if (!focus || this.time - (this.bornAt.get(b) ?? this.time) < keep.far.age) return false
      const c = this.centerOf(b, this.p)
      return Math.hypot(c.x - focus[0], c.y - focus[1], c.z - focus[2]) > keep.far.distance
    }
    const atRest = this.list.filter((b) => !b.held && this.hasComeToRest(b))
    if (keep.far.action === 'sleep') {
      for (const b of atRest) if (!b.sleeping && isFarAndOld(b)) this.sleepByBudget(b)
    }
    const fades = keep.far.action === 'fade'
    let over = this.list.length - keep.maxLive
    const far = new Set(atRest.filter(isFarAndOld))
    // far and old first, the oldest next (the list is in the order the pieces were made)
    for (const b of [...atRest].sort((a, c) => Number(far.has(c)) - Number(far.has(a)))) {
      if (!(over > 0 || (fades && far.has(b)))) return
      keep.onFade(b)
      over--
    }
  }

  /**
   * A piece made where its parts already stood (a group loose at load) sleeps there when a point of it has the ground, a piece or a fixed top under it, and answers to those
   * points (`restPoints`) as one the budget put to sleep: it wakes and falls when any of them loses its support. With none it stays awake and falls: nothing loose hangs in
   * the air. Returns whether it sleeps.
   */
  restIfSupported(b: PieceBody): boolean {
    const points = this.restPointsOf(b)
    // balanced on the parts as drawn (a top on one leg stands on the leg, not on the corners of the box around both)
    if (points.length === 0 || !this.balancedOn(b, this.partCornersOf(b).filter((point) => this.supportsPoint(b, point)))) return false
    this.sleep(b)
    b.restPoints = points
    return true
  }

  /** The corners of the boxes of its parts (`partBoxes`, about its centre of mass), or the samples of its box when it has none. */
  private partCornersOf(b: PieceBody): Vec3[] {
    if (!b.partBoxes) return this.samples(b, false)
    const out: Vec3[] = []
    for (const box of b.partBoxes) {
      const [x, y, z, w] = box.rotation ?? [0, 0, 0, 1]
      for (let i = 0; i < 8; i++) {
        const hx = i & 1 ? box.half[0] : -box.half[0]
        const hy = i & 2 ? box.half[1] : -box.half[1]
        const hz = i & 4 ? box.half[2] : -box.half[2]
        // q * h * q^-1
        const tx = 2 * (y * hz - z * hy)
        const ty = 2 * (z * hx - x * hz)
        const tz = 2 * (x * hy - y * hx)
        out.push([box.center[0] + hx + w * tx + y * tz - z * ty, box.center[1] + hy + w * ty + z * tx - x * tz, box.center[2] + hz + w * tz + x * ty - y * tx])
      }
    }
    return out
  }

  /** Whether the centre of mass of `b` is over the hull of the points of it (its own frame) that rest on something: off it, the piece tips. */
  private balancedOn(b: PieceBody, points: readonly Vec3[]): boolean {
    // the points are about the centre of mass, as `supportsPoint` reads them
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    const plan = points.map(([sx, sy, sz]): PlanPoint => [c.x + e[0]! * sx + e[4]! * sy + e[8]! * sz, c.z + e[2]! * sx + e[6]! * sy + e[10]! * sz])
    return isOverSupport(plan, [c.x, c.z], BALANCE_TOLERANCE)
  }

  /** Sleeps sooner than it would by itself, so it answers to every point it lies on (`restPoints`). */
  private sleepByBudget(b: PieceBody): void {
    // the tilt it kept goes with it: the engine wakes a sleeper that touches an awake body, and one that has to keep its tilt anew each time never sleeps with the row it leans on
    const steady = b.steady
    this.sleep(b)
    b.steady = steady
    b.restPoints = this.restPointsOf(b)
  }

  private hasComeToRest(b: PieceBody): boolean {
    const v = b.velocity
    const w = b.angularVelocity
    if (!b.onGround || b.tipping || Math.hypot(v[0], v[1], v[2]) >= STILL_SPEED || Math.hypot(w[0], w[1], w[2]) >= STILL_SPIN) return false
    return !b.balancing || (b.steady?.seconds ?? 0) >= STEADY_SECONDS
  }

  /** The corners of `b` (its own frame, or its own `contacts`) that have the ground, a piece or a fixed top within `SUPPORT_GAP` under them now; the points along its edges when no corner has. */
  private restPointsOf(b: PieceBody): Vec3[] {
    // the points along its edges too: a board leaning on the corner of a step rests there by an edge point between its corners, and must come down when the step goes
    return this.samples(b, true).filter((point) => this.supportsPoint(b, point))
  }

  /** Whether the point of `b` (its own frame) has the ground, a piece or a fixed top within `SUPPORT_GAP` under it. */
  private supportsPoint(b: PieceBody, [sx, sy, sz]: Vec3): boolean {
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    const y = c.y + e[1] * sx + e[5] * sy + e[9] * sz
    return this.supportAt(b, c.x + e[0] * sx + e[4] * sy + e[8] * sz, y, c.z + e[2] * sx + e[6] * sy + e[10] * sz, STEP) >= y - SUPPORT_GAP
  }

  /**
   * Moves each piece by what its pairs put it apart this step (`pushes`), at most `SEPARATE_SPEED` along the ground and as much up: a chunk in five others is not pushed five
   * times as fast, and nothing is ever moved down (into what holds it). A piece still being put apart is moving, though its speed is nil: it does not fall asleep in the other.
   */
  private applyPushes(dt: number, steps: Map<PieceBody, PushStep> = this.collideSteps): void {
    const most = SEPARATE_SPEED * dt
    // what has not been pushed for a while starts again from the whole push
    for (const [body, step] of steps) if (this.time - step.at > PUSH_MEMORY_SECONDS) steps.delete(body)
    for (const [body, push] of this.pushes) {
      const share = this.pushShare(steps, body, push)
      const level = Math.hypot(push[0], push[2])
      const k = (level > most ? most / level : 1) * share
      const up = Math.min(most, Math.max(0, push[1])) * share
      body.root.position.x += push[0] * k
      body.root.position.y += up
      body.root.position.z += push[2] * k
      if (Math.max(level * k, up) > SLOP) body.still = 0
    }
    this.pushes.clear()
  }

  /** The share of its push a piece is given: `TURN_BACK_SHARE` of it each step it turns back against the last one, `SAME_WAY_GROWTH` more (up to all) each step it goes on the same way. */
  private pushShare(steps: Map<PieceBody, PushStep>, body: PieceBody, push: Vec3): number {
    const last = steps.get(body)
    if (!last) {
      steps.set(body, { push: [push[0], push[1], push[2]], share: 1, at: this.time })
      return 1
    }
    const turnsBack = push[0] * last.push[0] + push[1] * last.push[1] + push[2] * last.push[2] < 0
    last.share = turnsBack ? Math.max(MIN_PUSH_SHARE, last.share * TURN_BACK_SHARE) : Math.min(1, last.share * SAME_WAY_GROWTH)
    last.at = this.time
    last.push[0] = push[0]
    last.push[1] = push[1]
    last.push[2] = push[2]
    return last.share
  }

  /** Whether a part of `a` and a part of `b` (their boxes of the step, as world-aligned boxes around them) overlap. */
  private partsOverlap(a: PieceBody, b: PieceBody): boolean {
    for (const pa of this.surfacesOf.get(a) ?? []) {
      for (const pb of this.surfacesOf.get(b) ?? []) {
        let apart = false
        for (let k = 0; k < 3 && !apart; k++) apart = Math.abs(pa.c[k] - pb.c[k]) > extent(pa, k) + extent(pb, k)
        if (!apart) return true
      }
    }
    return false
  }

  /** Two boxes put apart along the ground by `hit` (its normal from `b` to `a`, laid level), split by their inverse masses; the speed they close in with along it stops. */
  private slideApart(a: PieceBody, b: PieceBody, ima: number, imb: number, hit: ShapeContact): void {
    const n = hit.normal
    const flat = Math.hypot(n[0], n[2])
    const out: Vec3 = [n[0] / flat, 0, n[2] / flat]
    const move = (SEPARATE_SHARE * Math.max(0, hit.depth - SLOP)) / flat / (ima + imb)
    const va = a.velocity
    const vb = b.velocity
    const closing = (va[0] - vb[0]) * out[0] + (va[2] - vb[2]) * out[2]
    const stop = closing < 0 ? -closing / (ima + imb) : 0
    for (const [body, share, sign] of [[a, ima, 1], [b, imb, -1]] as const) {
      if (share === 0) continue
      const push = this.pushes.get(body) ?? [0, 0, 0]
      push[0] += out[0] * move * share * sign
      push[2] += out[2] * move * share * sign
      body.velocity[0] += out[0] * stop * share * sign
      body.velocity[2] += out[2] * stop * share * sign
      this.pushes.set(body, push)
    }
  }

}
