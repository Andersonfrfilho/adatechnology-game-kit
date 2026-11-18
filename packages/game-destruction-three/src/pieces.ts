import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { PartBox, PieceBody, PieceFriction, PieceSweepHit } from './internal'
import { squareBoxOf } from './internal'
import { clamp } from './math'
import { boxesAlongGround, shapeContact } from './piece-contacts'
import type { ContactShape, ShapeContact } from './piece-contacts'
import type { PhysicsLoop } from '@adatechnology/game-physics'
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
  groundAt: (x: number, z: number) => number
  /** The terrain alone (no top of furniture or of anything drawn): the ground of an engine, which has every drawn top as a body. Default `groundAt`. */
  terrainAt?: (x: number, z: number) => number
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
   * system registers its phases on it), a world (the system makes its own loop and steps it inside `update`), or `'own'` for the kit's own solver. The kit's rules stay on top
   * (`EnginePieces`). There is no switching mid-game.
   */
  physics: PiecePhysics
  /** With `physics`: the fixed boxes of what does not move, as drawn (turned), per object. */
  staticSolids?: () => ReadonlyMap<string, readonly StaticSolid[]>
}

/** Slower than this (m/s) into a wall a piece only stops against it: no blow, no sound. */
export const SLAM_MIN_SPEED = 2
/** Share of the speed into a wall a piece keeps, bouncing back, when neither surface says otherwise (`PieceBody.restitution`, `PieceSweepHit.restitution`). */
const SLAM_BOUNCE = 0.2
/** Metres the centre of mass may stand off the hull of the points a piece rests on and still be balanced there (the drawing's tolerance). */
const BALANCE_TOLERANCE = 0.01
/** Normals steeper than this (y) are a floor or a top: the support of the pieces answers those, not the sweep. */
const SLAM_FLOOR_NORMAL = 0.7

const SUB_DT = 1 / 120
/** Coulomb friction of a piece when no material says otherwise: what holds it still (static) and what drags it while it slides (dynamic). */
const MU_STATIC = 0.7
const MU_DYNAMIC = 0.6
/** Sliding faster than this (m/s) along the surface, a contact drags with the dynamic friction; slower, it holds with the static one. */
const SLIP_SPEED = 0.02
/** Rolling resistance coefficient of the ground and of a surface that does not say (`PieceFriction.rolling`): a can or a bottle on a hard floor (0.01-0.02). */
const ROLLING_RESISTANCE = 0.015
/** A round piece whose axis leans more than 45 degrees from upright lies on its side (the share of the world's down across its axis). */
const ROUND_LYING = Math.SQRT1_2
const SLEEP_AFTER = 0.5
/** A piece on the ground slower than this (m/s) and turning slower than this (rad/s) is still: it sleeps after `SLEEP_AFTER`, or at once over `maxAwake`. */
const STILL_SPEED = 0.12
const STILL_SPIN = 0.45
/**
 * A piece on the ground that neither moves farther than `CALM_DRIFT` (m) nor turns more than `CALM_TURN` (rad) in `CALM_SLEEP_AFTER` seconds sleeps, however
 * its speed flickers: a book propped on another, or trembling where its corners rest on two pieces, stays in place; a fall or a slide leaves the window sooner.
 */
const CALM_DRIFT = 0.01
const CALM_TURN = 0.05
const CALM_SLEEP_AFTER = 1.5
/**
 * A piece held up at an angle (on its edge, leant on something) that turns less than `STEADY_TURN` (rad) in `STEADY_SECONDS` keeps its tilt: over `maxAwake` it may sleep. One
 * going over turns past it sooner: the topple alone (`TOPPLE`) turns even a low piece 0.17 rad in that time.
 */
const STEADY_TURN = 0.1
const STEADY_SECONDS = 1.5
const HARD_LANDING = 3
/** Contact tolerance in metres: corners this close to the ground count as touching, which keeps the contact set (and a resting box) stable. */
const SLOP = 0.002
/** A resting support narrower than this fraction of the centre-of-mass height is a balancing act, not a rest: the piece topples. */
const NARROW = 0.3
/** Angular acceleration (rad/s^2 per metre of height) that pushes a balancing piece off its edge, toward the side its centre of mass leans to. */
const TOPPLE = 3
/** Angular acceleration (rad/s^2) of a piece that falls over (`tip`), beyond what the box of its bounds would allow, and the height of the centre of mass (m) at which it lies. */
const TIP_ACCELERATION = 30
const TIP_LYING = 0.25
const TIP_SECONDS = 3
/** How far (m) above a corner a top may be and still catch it (on top of what the corner falls in one sub-step): higher is beside it, not under it. */
const STEP = 0.03
/** Slots of the warm start: the 8 corners and the points along the 12 edges. */
const WARM_SLOTS = 8 + 12 * 7
/** Passes of the contact solver over the points that touch the ground, each substep. */
const SOLVER_PASSES = 10
/** Restitution of a piece against the side of a step of the ground. */
const SIDE_BOUNCE = 0.1
/**
 * Points along each edge of the box, between its corners (fractions of the half edge), that also touch the ground when the support under the corners is not level
 * (the piece is over a step): the edge of a table under a box's bottom is a support between its corners. On level ground the corners are enough.
 */
const EDGE_POINTS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]
/** Sleeping pieces whose support is looked at again each update, in turn: what held one up may have broken, fallen over or been carried off. */
const SUPPORT_CHECKS = 16
/** A sleeping piece none of whose lowest points has a support within this many metres under it wakes and falls. */
const SUPPORT_GAP = 0.02
/** A piece moving faster than this (m/s) or turning faster than this (rad/s) wakes what lies asleep on it. */
/** How often (s) the far and old rule looks at the pieces. */
const KEEP_EVERY = 0.5
const WAKE_ABOVE_SPEED = 0.05
const WAKE_ABOVE_SPIN = 0.1
/** Side (m) of the cells of the grid the surfaces are found by (`surfaceGrid`). */
const SURFACE_CELL = 0.5
/** Most cells across one surface goes into; a wider one is looked at for every point (`wideSurfaces`). */
const SURFACE_CELLS_ACROSS = 24
const cellKey = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768)
/** Most steps an update is split into while round pieces roll fast (`collisionSteps`). */
const MAX_COLLISION_STEPS = 8
/** Radius (m) a round piece is taken to have at least when the update is split for it (`collisionSteps`): a degenerate one of nothing does not split it without end. */
const MIN_ROUND_RADIUS = 0.005
/** Two pieces closing slower than this (m/s) only stop against each other; faster, they bounce by their restitution. */
const BOUNCE_MIN_SPEED = 0.1
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

/** Box of a piece in the world: centre, rotation columns (`Matrix4.elements`) and half extents. */
/** Which pieces a step moves and which pairs it meets (`PieceSystem.update` splits only what closes in on a round piece). */
interface StepFilter {
  readonly moves: (b: PieceBody) => boolean
  readonly meets: (a: PieceBody, b: PieceBody) => boolean
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
})

/** The coefficient of restitution of two surfaces against each other: the geometric mean of each one's. */
const pairRestitution = (a: number | undefined, b: number | undefined): number => Math.sqrt((a ?? SLAM_BOUNCE) * (b ?? SLAM_BOUNCE))

/** The angle (rad) between the rotation `a` and `q`. */
const turnBetween = (a: readonly [number, number, number, number], q: THREE_NS.Quaternion): number => 2 * Math.acos(Math.min(1, Math.abs(a[0] * q.x + a[1] * q.y + a[2] * q.z + a[3] * q.w)))

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
  private readonly q: THREE_NS.Quaternion
  private readonly dq: THREE_NS.Quaternion
  private readonly nextQ: THREE_NS.Quaternion
  private readonly m: THREE_NS.Matrix4
  private readonly ax: THREE_NS.Vector3
  private solids: Solid[] = []
  /** The engine stepping the pieces (`PieceSystemOptions.physics`), or null for the kit's own solver. */
  private readonly engine: EnginePieces | null
  /** The host's ground worker, disposed with the system: by the engine, or here when there is none (the kit's own solver lays no tiles). */
  private readonly groundWorker: GroundWorkerPort | null
  /** The loop the system steps itself (a world was handed), the loop it only registers on (a loop was handed), or null on `'own'`. */
  private readonly loop: PhysicsLoop | null
  private readonly stepsItself: boolean
  /** The phases' way out of the loop, and whether this frame's `prepare` ran (it runs once, in the first fixed step). */
  private readonly leaveLoop: Array<() => void> = []
  private prepared = false
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
  private supportTurn = 0
  /** The surface normal and the friction of what the last `supportAt` found under the point (the ground and fixed tops are level: up, and no piece). */
  private supportNormal: Vec3 = UP
  private supportFriction: PieceFriction | null = null

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: PieceSystemOptions,
  ) {
    this.p = new THREE.Vector3()
    this.q = new THREE.Quaternion()
    this.dq = new THREE.Quaternion()
    this.nextQ = new THREE.Quaternion()
    this.m = new THREE.Matrix4()
    this.ax = new THREE.Vector3()
    const resolved = resolvePhysics(o.physics)
    this.loop = resolved?.loop ?? null
    this.stepsItself = resolved?.stepsItself ?? false
    this.engine = resolved
      ? new EnginePieces(THREE, resolved.loop.world, {
          groundAt: o.terrainAt ?? o.groundAt,
          ...(o.terrainRangeAt ? { groundRange: o.terrainRangeAt } : {}),
          // the grid stands for `terrainAt` alone: without it the tiles read `groundAt`, which the grid may not be (a lot flattened, a slab)
          ...(o.terrainGridAt && o.terrainAt ? { groundGrid: o.terrainGridAt } : {}),
          ...(o.terrainPatchAt && o.terrainGridAt && o.terrainAt ? { groundPatch: o.terrainPatchAt } : {}),
          ...(o.blastGroundTiles !== undefined ? { blastTiles: o.blastGroundTiles } : {}),
          gravity: o.gravity,
          staticSolids: o.staticSolids,
          sweep: o.sweep,
          onSlam: o.onSlam,
          onKnock: o.onKnock,
          onHardLanding: o.onHardLanding,
          ...(o.tilesUnderParts ? { tilesUnderParts: true } : {}),
          ...(o.groundWorker ? { groundWorker: o.groundWorker } : {}),
          ...(o.groundWorkerFrames !== undefined ? { groundWorkerFrames: o.groundWorkerFrames } : {}),
        })
      : null
    this.groundWorker = o.groundWorker ?? null
    if (resolved && !resolved.stepsItself) this.joinLoop(resolved.loop, this.engine as EnginePieces)
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
            if (this.prepared) return engine.moveHeld(this.list, step)
            this.prepared = true
            this.measure()
            this.wakeUnsupported(true)
            engine.prepare(this.list, frame.steps * h, step, this.apartAll(frame.steps * h))
          },
        },
        'actors',
      ),
      loop.add(
        {
          afterSteps: (dt, frame) => {
            // a frame too short for a step has no events and nothing moved: nothing to read back
            if (frame.steps > 0) engine.finish(this.list, dt, frame.time)
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
    for (const leave of this.leaveLoop.splice(0)) leave()
    if (this.engine) this.engine.dispose()
    else this.groundWorker?.dispose()
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
    this.applyPushes(dt)
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
    return Math.hypot(hit.normal[0], hit.normal[2]) > KNOCK_FLAT ? hit : boxesAlongGround(sa, sb)
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

  /** Sets a piece falling over, about the world axes x and z (a unit axis): its feet are thinner than the box that stands for it, so the box alone would hold it up. */
  tip(body: PieceBody, x: number, z: number): void {
    body.tipping = { x, z, seconds: TIP_SECONDS }
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
    const body: PieceBody = {
      objectId,
      generation: ++this.generations,
      tipping: null,
      root,
      velocity: velocity ? [...velocity] : [0, 0, 0],
      angularVelocity: angular ? [...angular] : [0, 0, 0],
      halfExtents: [Math.max(0.01, halfExtents[0]), Math.max(0.01, halfExtents[1]), Math.max(0.01, halfExtents[2])],
      mass: Math.max(0.05, mass),
      sleeping: false,
      held: false,
      localCenter: [localCenter.x, localCenter.y, localCenter.z],
      centerV: localCenter.clone(),
      still: 0,
      calmAt: null,
      calm: 0,
      lastHit: -1,
      onGround: false,
    }
    this.list.push(body)
    this.bornAt.set(body, this.time)
    return body
  }

  /** What the loop's last frame cost (ms) and how many bodies the world had awake: the pair the cost of a body is read from. Null on the kit's own solver. */
  stepCost(): { stepMs: number; active: number } | null {
    return this.loop ? { stepMs: this.loop.frame.stepMs, active: this.loop.world.activeCount } : null
  }

  /** Bodies awake in the physics world, or the pieces not asleep on the kit's own solver. */
  activeBodies(): number {
    return this.loop ? this.loop.world.activeCount : this.list.filter((b) => !b.sleeping).length
  }

  /** Move the centre of mass (after a part broke off). */
  setCenter(b: PieceBody, c: THREE_NS.Vector3): void {
    b.centerV.copy(c)
    b.localCenter = [c.x, c.y, c.z]
  }

  remove(objectId: string): void {
    const i = this.list.findIndex((b) => b.objectId === objectId)
    if (i < 0) return
    // the boxes of the step forget it too: nothing keeps a removed piece's tree alive
    const [gone] = this.list.splice(i, 1)
    // its torn pairs go with it (§8); a pair whose other side is a fixed object, not a piece, stays until the piece goes: the pole may still fall
    for (const key of this.tethered) {
      const cut = key.indexOf('\u0000')
      if (key.slice(0, cut) === objectId || key.slice(cut + 1) === objectId) this.tethered.delete(key)
    }
    if (gone) {
      this.forgetSolids(gone)
      this.engine?.remove(gone)
    }
  }

  clear(): void {
    this.engine?.clear()
    this.list.length = 0
    this.solids = []
    this.surfaces = []
    this.solidOf.clear()
    this.surfacesOf.clear()
    this.surfaceGrid.clear()
    this.cellIndex.clear()
    this.cellLists.length = 0
    this.wideSurfaces.length = 0
  }

  /** Drops a piece from the boxes of the step (`solids`, `surfaces` and their grid). */
  private forgetSolids(body: PieceBody): void {
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
      for (let k = 0; k < 4; k++) {
        for (const f of EDGE_POINTS) {
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

  /**
   * An impulse along the unit normal `n` at `r` (from the centre of mass, world) that stops the point closing in along `n` (with `bounce`); `e` holds the body's rotation.
   */
  private contactImpulse(b: PieceBody, e: ArrayLike<number>, r: Vec3, n: Vec3, bounce: number): void {
    const v = b.velocity
    const w = b.angularVelocity
    const vn = (v[0] + w[1] * r[2] - w[2] * r[1]) * n[0] + (v[1] + w[2] * r[0] - w[0] * r[2]) * n[1] + (v[2] + w[0] * r[1] - w[1] * r[0]) * n[2]
    if (vn >= 0) return
    // I^-1 (r x n), then (I^-1 (r x n) x r) . n
    const a = this.mulInvInertiaWith(b, e, r[1] * n[2] - r[2] * n[1], r[2] * n[0] - r[0] * n[2], r[0] * n[1] - r[1] * n[0])
    const k = (a[1] * r[2] - a[2] * r[1]) * n[0] + (a[2] * r[0] - a[0] * r[2]) * n[1] + (a[0] * r[1] - a[1] * r[0]) * n[2]
    const j = (-(1 + bounce) * vn) / (1 / b.mass + k)
    for (let i = 0; i < 3; i++) {
      v[i] += (j * n[i]) / b.mass
      w[i] += a[i] * j
    }
  }

  /** A blast at (x, z) of `radius`: the ground within its reach is laid at the next update, before the pieces it makes need it (`EnginePieces.layAhead`). */
  layGroundAt(x: number, z: number, radius: number): void {
    this.engine?.layAhead(x, z, radius)
  }

  /** What lies inside the disc looks at the ground again: it was dug or heaped under it. */
  wakeRegion(x: number, z: number, radius: number): void {
    this.engine?.groundChanged(x, z, radius)
    for (const b of this.list) {
      if (!b.sleeping || b.held || Math.hypot(b.root.position.x - x, b.root.position.z - z) > radius) continue
      b.sleeping = false
      b.still = 0
      b.calmAt = null
    }
  }

  update(dt: number): void {
    if (this.engine && this.loop) {
      // under a loop the host stepped it already, and its time is the one that counts
      if (!this.stepsItself) {
        this.time = this.loop.frame.time
        this.keepFar()
        return
      }
      this.time += dt
      this.measure()
      // what the budget put to sleep (the engine did not) wakes when a point it lay on loses its support: the kit's rule. What the engine put to sleep it wakes
      // itself when what holds it moves; a fixed thing removed or the ground changed wakes what was there (`EnginePieces`)
      this.wakeUnsupported(true)
      if (dt > 0) {
        this.engine.prepare(this.list, dt, dt, this.apartAll(dt))
        this.loop.step(dt)
        this.engine.finish(this.list, dt, this.time)
      }
      this.measure()
      this.keepBudget()
      this.keepFar()
      return
    }
    const { steps, near } = this.collisionSteps(dt)
    if (steps === 1) {
      this.time += dt
      this.step(dt)
      return
    }
    // only the round pieces and what closes in on them are split: the rest (a wall's bricks falling far from the can) take the update whole, so their sweep runs once
    const start = this.time
    this.time = start + dt
    const far = (b: PieceBody): boolean => !near.has(b)
    this.step(dt, { moves: far, meets: (a, b) => far(a) && far(b) })
    for (let i = 0; i < steps; i++) {
      this.time = start + (dt * (i + 1)) / steps
      this.step(dt / steps, { moves: (b) => near.has(b), meets: (a, b) => near.has(a) || near.has(b) })
    }
  }

  /**
   * Steps of an update: one, or more while a round piece and a piece it could meet within the update close in fast enough to pass through each other between two (closing at
   * their two speeds they cover at most the round one's radius per step: two cans at 3.6 m/s close 12 cm in a frame, a can is 7 cm across; a plank thrown at a can still counts).
   * A round piece with nothing in reach takes one step, so its sweep against the world (the costly part) runs once; `near` holds the pieces of the pairs that need more.
   */
  private collisionSteps(dt: number): { steps: number; near: Set<PieceBody> } {
    let need = 1
    const near = new Set<PieceBody>()
    const p = this.p
    const speedOf = (b: PieceBody): number => (b.held ? 0 : Math.hypot(b.velocity[0], b.velocity[1], b.velocity[2]))
    for (const b of this.list) {
      if (!b.round || b.held) continue
      // a radius of nothing passes through nothing: one step
      const radius = Math.max(MIN_ROUND_RADIUS, b.round.radius)
      const speed = b.sleeping ? 0 : speedOf(b)
      const c = this.centerOf(b, p)
      const cx = c.x, cy = c.y, cz = c.z
      const rb = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
      for (const o of this.list) {
        if (o === b || (b.sleeping && o.sleeping)) continue
        const closing = speed + (o.sleeping ? 0 : speedOf(o))
        if (closing * dt < radius * 0.5) continue
        const reach = closing * dt + rb + Math.hypot(o.halfExtents[0], o.halfExtents[1], o.halfExtents[2])
        const oc = this.centerOf(o, p)
        if (Math.abs(oc.x - cx) > reach || Math.abs(oc.y - cy) > reach || Math.abs(oc.z - cz) > reach) continue
        const pair = Math.ceil((closing * dt) / radius)
        if (pair < 2) continue
        need = Math.max(need, pair)
        near.add(b)
        near.add(o)
      }
    }
    return { steps: Math.max(1, Math.min(MAX_COLLISION_STEPS, need)), near }
  }

  /** A step of `dt`: the pieces `only.moves` takes move (all when absent) and the pairs `only.meets` takes meet, so each pair meets in one of the steps of an update. */
  private step(dt: number, only?: StepFilter): void {
    this.measure()
    this.wakeUnsupported()
    for (const b of this.list) {
      if (b.held) {
        b.velocity = [0, 0, 0]
        b.angularVelocity = [0, 0, 0]
        b.sleeping = false
        b.still = 0
        b.calmAt = null
        continue
      }
      if (b.sleeping || (only && !only.moves(b))) continue
      this.integrate(b, dt)
      if (b.sleeping) continue
      const v = b.velocity
      const w = b.angularVelocity
      if (Math.hypot(v[0], v[1], v[2]) > WAKE_ABOVE_SPEED || Math.hypot(w[0], w[1], w[2]) > WAKE_ABOVE_SPIN) this.wakeAbove(b)
    }
    this.collide(dt, only?.meets)
    this.keepBudget()
    this.keepFar()
  }

  /** The boxes of the pieces as they stand (`solids`, `surfaces` and their grid): what a point lands on and what `topAt` answers. */
  private measure(): void {
    // each piece's boxes are its own objects from one update to the next, written over in place: two measures an update over 200 pieces made a Vector3, a Matrix4,
    // its elements twice and the surfaces anew for each (90 MB in 200 updates of the debris bench, most of the collector's pauses)
    this.measures++
    // written over by index and cut to length at the end: emptied and pushed again, each list was made anew twice an update
    let solids = 0
    let surfaces = 0
    for (const body of this.list) {
      const rec = this.measured(body)
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
      this.solids[solids++] = w
      // what lands on a piece lands on its parts (a shelf's boards, a table's top), not on the box around them all
      const parts = body.partBoxes
      if (!parts) {
        rec.list[0] = w
        if (rec.list.length !== 1) rec.list.length = 1
      } else this.measureParts(rec, parts)
      for (const one of rec.list) this.surfaces[surfaces++] = one
      rec.stamp = this.measures
      this.solidOf.set(body, w)
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
      if (!b.sleeping || b.held || (onlyBudget && !b.restPoints?.length)) continue
      // one put to sleep by the budget needs every point it went to sleep on: a board leaning on a step whose step is gone comes down, though its foot is still on the floor
      const rest = b.restPoints
      if (rest && rest.length > 0 ? rest.every((point) => this.supportsPoint(b, point)) : this.supported(b, false) || this.supported(b, true)) continue
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

  /** What lay asleep on `b` (a box over its top) wakes at once when `b` moves: a can on a table that goes over goes with it. */
  private wakeAbove(b: PieceBody): void {
    const below = this.solidOf.get(b)
    if (!below) return
    const top = below.c[1] + below.half[0] * Math.abs(below.e[1]) + below.half[1] * Math.abs(below.e[5]) + below.half[2] * Math.abs(below.e[9])
    // what can lie on it is in the cells its own circle covers
    const x0 = Math.floor((below.c[0] - below.r) / SURFACE_CELL)
    const x1 = Math.floor((below.c[0] + below.r) / SURFACE_CELL)
    const z0 = Math.floor((below.c[2] - below.r) / SURFACE_CELL)
    const z1 = Math.floor((below.c[2] + below.r) / SURFACE_CELL)
    const wide = x1 - x0 > SURFACE_CELLS_ACROSS || z1 - z0 > SURFACE_CELLS_ACROSS
    const look = (part: Solid): void => {
      const o = part.body
      const s = this.solidOf.get(o)
      if (!s || !o.sleeping || o.held || o === b) return
      if (s.c[1] < below.c[1] || s.c[1] - s.r > top + STEP || Math.hypot(s.c[0] - below.c[0], s.c[2] - below.c[2]) > s.r + below.r) return
      // what lies on it is over it: a board leaning over a can rolling by its foot is not on the can
      if (boxTopAt(below, s.c[0], s.c[2]) === -Infinity && !this.restsOn(o, b, true)) return
      o.sleeping = false
      o.still = 0
      o.calmAt = null
    }
    if (wide) for (const s of this.solids) look(s)
    else for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) for (const part of this.surfaceGrid.get(cellKey(ix, iz)) ?? []) look(part)
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
    return Math.max(top, fixed)
  }

  /** Stops a piece that ran into something on its way from `start` to `pos` (`sweep`): moves it back to where it met it and takes the speed into it. */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3): void {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return
    const k = Math.min(1, hit.distance / travel)
    const bounce = pairRestitution(b.restitution, hit.restitution)
    for (let i = 0; i < 3; i++) {
      pos[i] = start[i] + (pos[i] - start[i]) * k
      v[i] += (1 + bounce) * into * n[i]
    }
    const w = b.angularVelocity
    w[0] *= 0.5
    w[1] *= 0.5
    w[2] *= 0.5
    if (into >= SLAM_MIN_SPEED && this.time - b.lastHit > 0.15) {
      b.lastHit = this.time
      this.o.onSlam?.(b, hit, into)
    }
  }

  private integrate(b: PieceBody, dt: number): void {
    const c = this.centerOf(b, this.p)
    const pos: Vec3 = [c.x, c.y, c.z]
    const start: Vec3 = [c.x, c.y, c.z]
    const q = this.q.copy(b.root.quaternion)
    const v = b.velocity
    const w = b.angularVelocity
    const invM = 1 / b.mass
    const steps = clamp(Math.ceil(dt / SUB_DT), 1, 8)
    const h = dt / steps
    let landing = 0
    let landPoint: Vec3 = [pos[0], pos[1], pos[2]]
    let contactedLast = false
    const propped = b.propped
    const proppedAt = b.proppedAt
    b.propped = undefined
    b.proppedAt = undefined
    let touched = false
    let unstable = false

    // over a step of the ground (the corners find it at different heights: a table's edge under it) the points along the edges touch too
    const corners = this.samples(b, false)
    this.m.makeRotationFromQuaternion(q)
    let gLow = Infinity
    let gHigh = -Infinity
    for (const [sx, sy, sz] of corners) {
      const e0 = this.m.elements
      const y = pos[1] + e0[1] * sx + e0[5] * sy + e0[9] * sz
      const x = pos[0] + e0[0] * sx + e0[4] * sy + e0[8] * sz
      const z = pos[2] + e0[2] * sx + e0[6] * sy + e0[10] * sz
      // only the fixed ground counts here: other pieces touching it (a pile, things spawned together) keep the corners
      const g = Math.max(this.o.groundAt(x, z), this.o.staticTopAt?.(x, z, y, STEP) ?? -Infinity)
      gLow = Math.min(gLow, g)
      gHigh = Math.max(gHigh, g)
    }
    let local = b.round ? this.roundSamples(b, q) : gHigh - gLow > STEP ? this.samples(b, true) : corners
    let prev: Vec3[] = local.map(() => [0, 0, 0])

    for (let s = 0; s < steps; s++) {
      if (b.round) {
        // a round piece touches by its lowest points as it will be turned at the end of this substep: they move round it as it rolls
        const wl0 = Math.hypot(w[0], w[1], w[2])
        const next = this.nextQ.copy(q)
        if (wl0 > 1e-6) next.premultiply(this.dq.setFromAxisAngle(this.ax.set(w[0] / wl0, w[1] / wl0, w[2] / wl0), wl0 * h)).normalize()
        local = this.roundSamples(b, next)
        if (prev.length !== local.length) prev = local.map(() => [0, 0, 0])
      }
      // where each point was before this substep: a point that comes at a higher ground from below it hit the side of the step
      this.m.makeRotationFromQuaternion(q)
      const e0 = this.m.elements
      for (let i = 0; i < local.length; i++) {
        const [sx, sy, sz] = local[i]
        prev[i][0] = pos[0] + e0[0] * sx + e0[4] * sy + e0[8] * sz
        prev[i][1] = pos[1] + e0[1] * sx + e0[5] * sy + e0[9] * sz
        prev[i][2] = pos[2] + e0[2] * sx + e0[6] * sy + e0[10] * sz
      }
      v[1] -= this.o.gravity * h
      // what holds it up through their overlap pushes back what gravity drives into it, as a corner's support does
      if (propped) {
        const into = v[0] * propped[0] + v[1] * propped[1] + v[2] * propped[2]
        if (into < 0) for (let k = 0; k < 3; k++) v[k] -= into * propped[k]
      }
      pos[0] += v[0] * h
      pos[1] += v[1] * h
      pos[2] += v[2] * h
      const wl = Math.hypot(w[0], w[1], w[2])
      if (wl > 1e-6) {
        this.dq.setFromAxisAngle(this.ax.set(w[0] / wl, w[1] / wl, w[2] / wl), wl * h)
        q.premultiply(this.dq).normalize()
      }
      // the air slows a box's spin a little; a round piece keeps rolling, held back only by its rolling resistance on the ground
      const damp = b.round ? 1 : Math.exp(-0.15 * h)
      w[0] *= damp
      w[1] *= damp
      w[2] *= damp

      this.m.makeRotationFromQuaternion(q)
      const e = this.m.elements
      const rs: Vec3[] = []
      const ids: number[] = []
      // per contact: the normal of the surface under it and the friction of the two surfaces
      const ns: Vec3[] = []
      const mus: PieceFriction[] = []
      let maxPen = 0
      // the normal of the surface under the deepest point: the piece is pushed out along it (straight up on the floor, across a tilted top)
      let penNormal: Vec3 = UP
      const rise = STEP + Math.max(0, -v[1]) * h * 2
      // the side of a step of the ground: how far back the piece goes (metres along -dir) and the point that hit it
      let side: { back: number; dir: [number, number]; r: Vec3 } | null = null
      let lowest = Infinity
      for (let i = 0; i < local.length; i++) {
        const [sx, sy, sz] = local[i]
        const r: Vec3 = [e[0] * sx + e[4] * sy + e[8] * sz, e[1] * sx + e[5] * sy + e[9] * sz, e[2] * sx + e[6] * sy + e[10] * sz]
        const px = pos[0] + r[0]
        const pz = pos[2] + r[2]
        const cy = pos[1] + r[1]
        // the ground's own step (a table, a counter) that the point was more than a step below before this substep: it came at its side or is
        // under it, and does not stand on it (nor ratchets up onto it as the rest of the piece is lifted)
        const was = prev[i]
        const raw = this.o.groundAt(px, pz)
        if (raw > cy - SLOP && was[1] < raw - STEP) {
          // under a top it was already beneath (put under an overhang), or coming at its side: either way that top does not hold it
          if (this.o.groundAt(was[0], was[2]) >= raw - STEP) {
            // beneath it, the point stands on the floor the piece last stood on (the height field cannot see under a top)
            const floor = b.floor
            if (floor !== undefined && floor - cy > -SLOP && floor < raw - STEP) {
              rs.push(r)
              ids.push(i)
              ns.push(UP)
              mus.push(pairFriction(b.friction, null))
              maxPen = Math.max(maxPen, floor - cy)
            }
            continue
          }
          const dx = px - was[0]
          const dz = pz - was[2]
          const len = Math.hypot(dx, dz)
          if (len > 1e-6) {
            // where along its move the point met the side: the first place the ground is up at this top
            let lo = 0
            let hi = 1
            for (let it = 0; it < 6; it++) {
              const mid = (lo + hi) / 2
              if (this.o.groundAt(was[0] + dx * mid, was[2] + dz * mid) >= raw - STEP) hi = mid
              else lo = mid
            }
            const back = (1 - lo) * len + 0.001
            if (!side || back > side.back) side = { back, dir: [dx / len, dz / len], r }
          }
          continue
        }
        // the points along the edges are there for the step of the ground; on other pieces only the corners stand, as everywhere else
        this.supportNormal = UP
        this.supportFriction = null
        const gy = i < 8 || b.contacts ? this.supportAt(b, px, cy, pz, rise) : Math.max(raw, this.o.staticTopAt?.(px, pz, cy, rise) ?? -Infinity)
        const pen = gy - cy
        if (pen > -SLOP) {
          rs.push(r)
          ids.push(i)
          ns.push(this.supportNormal)
          mus.push(pairFriction(b.friction, this.supportFriction))
          if (pen > maxPen) {
            maxPen = pen
            penNormal = this.supportNormal
          }
          lowest = Math.min(lowest, gy)
        }
      }
      if (lowest < Infinity) b.floor = lowest
      if (b.round && ns.length > 0) {
        const sum: Vec3 = [0, 0, 0]
        for (const one of ns) for (let k = 0; k < 3; k++) sum[k] += one[k]
        const len = Math.hypot(sum[0], sum[1], sum[2])
        b.surfaceNormal = len > 1e-6 ? [sum[0] / len, sum[1] / len, sum[2] / len] : UP
      } else if (b.round && rs.length === 0) b.surfaceNormal = UP
      if (side) {
        // the side of the step stops the piece: back out of it, and the point loses the speed it had into the side
        pos[0] -= side.dir[0] * side.back
        pos[2] -= side.dir[1] * side.back
        this.contactImpulse(b, e, side.r, [-side.dir[0], 0, -side.dir[1]], SIDE_BOUNCE)
      }
      contactedLast = rs.length > 0
      if (contactedLast) touched = true
      if (!contactedLast) continue
      // a point `maxPen` under a surface of normal n is `maxPen * n.y` inside it, along n
      const out = Math.max(0, maxPen - SLOP * 0.5) * penNormal[1]
      pos[0] += penNormal[0] * out
      pos[1] += penNormal[1] * out
      pos[2] += penNormal[2] * out
      let impact = 0
      for (const r of rs) impact = Math.max(impact, -(v[1] + w[2] * r[0] - w[0] * r[2]))
      const restitution = impact > 2 ? 0.25 : 0
      if (impact > landing) {
        landing = impact
        let sx = 0
        let sz = 0
        for (const r of rs) {
          sx += r[0]
          sz += r[2]
        }
        const lx = pos[0] + sx / rs.length
        const lz = pos[2] + sz / rs.length
        landPoint = [lx, pos[1] - Math.max(...rs.map((r) => -r[1])), lz]
      }
      // Contact impulses, solved together: each point keeps the impulse it has given so far (pushing only, never pulling) and the friction it has
      // given (within the paper's grip times that push), and every pass corrects them. Points spread unevenly under the box (a table's edge under
      // half of it) then share the weight as they should, instead of the first ones handled kicking the box into a spin.
      // the velocity of a point of the piece: v + w x r
      const pointV = (r: Vec3): Vec3 => [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]]
      const dot = (a: Vec3, c: Vec3): number => a[0] * c[0] + a[1] * c[1] + a[2] * c[2]
      const goal = rs.map((r, k) => {
        const vn = dot(pointV(r), ns[k])
        return vn < 0 ? -restitution * vn : 0
      })
      // a point that slides drags with the dynamic friction, one that holds with the static one (Coulomb)
      const slipping = rs.map((r, k) => {
        // as it moved before this substep's gravity: a thing at rest on a slope is held by the static grip, not let go by the pull it is to resist
        const pv = pointV(r)
        pv[1] += this.o.gravity * h
        const vn = dot(pv, ns[k])
        return Math.hypot(pv[0] - vn * ns[k][0], pv[1] - vn * ns[k][1], pv[2] - vn * ns[k][2]) > SLIP_SPEED
      })
      // the step moved the piece at the speed it had before the contacts: what they took from it along the ground is taken from the move too, so
      // a push the floor's grip holds does not creep the piece along
      const vx0 = v[0]
      const vz0 = v[2]
      // warm start: each point starts from what it gave in the last substep (a resting box carries its weight from the first pass)
      if (!b.warm || b.warm.length !== WARM_SLOTS * 4) b.warm = new Float64Array(WARM_SLOTS * 4)
      const warm = b.warm
      const accN = ids.map((id) => (id < WARM_SLOTS ? warm[id * 4] : 0))
      const accT = ids.map((id): Vec3 => (id < WARM_SLOTS ? [warm[id * 4 + 1], warm[id * 4 + 2], warm[id * 4 + 3]] : [0, 0, 0]))
      /** Gives the piece the impulse `j` (world) at `r`. */
      const push = (r: Vec3, j: Vec3): void => {
        v[0] += j[0] * invM
        v[1] += j[1] * invM
        v[2] += j[2] * invM
        const dw = this.mulInvInertiaWith(b, e, r[1] * j[2] - r[2] * j[1], r[2] * j[0] - r[0] * j[2], r[0] * j[1] - r[1] * j[0])
        w[0] += dw[0]
        w[1] += dw[1]
        w[2] += dw[2]
      }
      /** The mass the piece shows to an impulse along the unit `d` at `r`: 1 / (1/m + (I^-1 (r x d) x r) . d). */
      const reach = (r: Vec3, d: Vec3): number => {
        const a = this.mulInvInertiaWith(b, e, r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0])
        return invM + (a[1] * r[2] - a[2] * r[1]) * d[0] + (a[2] * r[0] - a[0] * r[2]) * d[1] + (a[0] * r[1] - a[1] * r[0]) * d[2]
      }
      for (let k = 0; k < rs.length; k++) {
        const n = ns[k]
        const t = accT[k]
        if (accN[k] !== 0 || t[0] !== 0 || t[1] !== 0 || t[2] !== 0) push(rs[k], [n[0] * accN[k] + t[0], n[1] * accN[k] + t[1], n[2] * accN[k] + t[2]])
      }
      for (let it = 0; it < SOLVER_PASSES; it++) {
        for (let k = 0; k < rs.length; k++) {
          const r = rs[k]
          const n = ns[k]
          // the push along the normal of the surface (a tilted top pushes across it, not straight up)
          const vn = dot(pointV(r), n)
          const total = Math.max(0, accN[k] + (goal[k] - vn) / reach(r, n))
          const j = total - accN[k]
          accN[k] = total
          if (j !== 0) push(r, [n[0] * j, n[1] * j, n[2] * j])
          // friction in the plane of the surface, up to the static or dynamic coefficient times the push the point gives
          const pv = pointV(r)
          const pn = dot(pv, n)
          const vt: Vec3 = [pv[0] - pn * n[0], pv[1] - pn * n[1], pv[2] - pn * n[2]]
          const speed = Math.hypot(vt[0], vt[1], vt[2])
          const f: Vec3 = [accT[k][0], accT[k][1], accT[k][2]]
          if (speed > 1e-6) {
            const d: Vec3 = [vt[0] / speed, vt[1] / speed, vt[2] / speed]
            const jt = speed / reach(r, d)
            f[0] -= d[0] * jt
            f[1] -= d[1] * jt
            f[2] -= d[2] * jt
          } else if (f[0] === 0 && f[1] === 0 && f[2] === 0) continue
          const most = (slipping[k] ? mus[k].dynamic : mus[k].static) * accN[k]
          const fl = Math.hypot(f[0], f[1], f[2])
          if (fl > most) {
            f[0] *= most / fl
            f[1] *= most / fl
            f[2] *= most / fl
          }
          const dj: Vec3 = [f[0] - accT[k][0], f[1] - accT[k][1], f[2] - accT[k][2]]
          accT[k] = f
          if (dj[0] !== 0 || dj[1] !== 0 || dj[2] !== 0) push(r, dj)
        }
      }
      pos[0] += (v[0] - vx0) * h
      pos[2] += (v[2] - vz0) * h
      warm.fill(0)
      for (let k = 0; k < rs.length; k++) {
        const id = ids[k]
        if (id >= WARM_SLOTS) continue
        warm[id * 4] = accN[k]
        warm[id * 4 + 1] = accT[k][0]
        warm[id * 4 + 2] = accT[k][1]
        warm[id * 4 + 3] = accT[k][2]
      }
      // Support check. The corner contacts above are relative to the centre of mass, so they already give a torque when the centre of mass is
      // outside the support. What they cannot do is end a balancing act: a tall thin piece on its edge (or a single corner) is in equilibrium
      // with the centre of mass above a very small support, so it must not rest there. It gets a gentle topple push toward the side it leans
      // to (or toward the wider side when it leans nowhere), and it may not sleep.
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, low = 0
      for (const r of rs) {
        x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0])
        z0 = Math.min(z0, r[2]); z1 = Math.max(z1, r[2])
        low = Math.min(low, r[1])
      }
      // held up through its overlap with a piece (`propped`), that point is a point of its support too
      if (proppedAt) {
        x0 = Math.min(x0, proppedAt[0]); x1 = Math.max(x1, proppedAt[0])
        z0 = Math.min(z0, proppedAt[2]); z1 = Math.max(z1, proppedAt[2])
      }
      const height = -low
      const wx = x1 - x0
      const wz = z1 - z0
      // a round piece lying on its side rests on a line: that is its rest, not a balancing act (it rolls if the ground slopes)
      unstable = !b.round && (Math.min(wx, wz) < NARROW * height || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0)
      if (b.tipping) {
        b.tipping.seconds -= h
        // lying is measured on the box as it is turned: a top corner held from above (a board it was joined to) says nothing of how it stands
        const [hx, hy, hz] = b.halfExtents
        const upHalf = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz
        if (upHalf < TIP_LYING || b.tipping.seconds <= 0) b.tipping = null
        else {
          w[0] += b.tipping.x * TIP_ACCELERATION * h
          w[2] += b.tipping.z * TIP_ACCELERATION * h
          unstable = true
        }
      }
      if (unstable) {
        // the support centre relative to the centre of mass: the piece falls away from it (toward +axis when it is centred)
        const dirX = x0 + x1 > 0 ? -1 : 1
        const dirZ = z0 + z1 > 0 ? -1 : 1
        const k = TOPPLE * Math.min(height, 1) * h
        // rotating about -z moves the top toward +x; rotating about +x moves it toward +z
        if (wx <= wz) w[2] -= dirX * k
        else w[0] += dirZ * k
      }
      // rolling / spinning resistance while touching the ground: a box loses its spin; a round piece rolls on, held back by its rolling resistance
      // (a deceleration of C_RR g / r about the axis it rolls on) and a little spin about the others
      if (b.round) {
        let rolling = 0
        for (const mu of mus) rolling = Math.max(rolling, mu.rolling ?? ROLLING_RESISTANCE)
        this.rollingResistance(b, q, w, h, rolling)
      } else {
        const rd = Math.exp((rs.length >= 3 ? -3 : -1.5) * h)
        w[0] *= rd
        w[1] *= rd
        w[2] *= rd
        const fd = Math.exp(-0.3 * h)
        v[0] *= fd
        v[2] *= fd
      }
    }

    // what stands in the way (a wall, a car): the piece stops against it, bounces a little and both take the blow
    if (this.o.sweep && !b.held) this.sweepOn(b, start, pos)

    // write back
    b.root.quaternion.copy(q)
    const off = this.ax.copy(b.centerV).applyQuaternion(q)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    b.onGround = contactedLast

    if (landing > HARD_LANDING && this.time - b.lastHit > 0.15) {
      b.lastHit = this.time
      this.o.onHardLanding(b, landPoint, landing)
    }

    const still = touched && !unstable && Math.hypot(v[0], v[1], v[2]) < STILL_SPEED && Math.hypot(w[0], w[1], w[2]) < STILL_SPIN
    if (still) b.still += dt
    else b.still = 0
    b.balancing = unstable
    this.keepsTilt(b, q, dt)
    // held up through its overlap with what is under it (`propped`) it touches too: it may sleep where it stays, as a piece on its corners does
    const held = (touched || propped !== undefined) && !b.tipping
    if (b.still >= SLEEP_AFTER || this.staysInPlace(b, held, pos, q, dt)) this.sleep(b)
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

  /** How long the piece has kept its tilt (within `STEADY_TURN`): one going over leaves it within a moment, one held up at an angle keeps it. */
  private keepsTilt(b: PieceBody, q: THREE_NS.Quaternion, dt: number): void {
    const at = b.steady
    if (at && turnBetween(at.quaternion, q) <= STEADY_TURN) {
      at.seconds += dt
      return
    }
    b.steady = { quaternion: [q.x, q.y, q.z, q.w], seconds: 0 }
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
      // one held up at an angle never sleeps by itself (`still`), though it has come to rest: with a budget it does, whatever the count
      if (b.balancing && this.hasComeToRest(b)) this.sleepByBudget(b)
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
    this.sleep(b)
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
    const corners = this.samples(b, false).filter((point) => this.supportsPoint(b, point))
    return corners.length > 0 ? corners : this.samples(b, true).filter((point) => this.supportsPoint(b, point))
  }

  /** Whether the point of `b` (its own frame) has the ground, a piece or a fixed top within `SUPPORT_GAP` under it. */
  private supportsPoint(b: PieceBody, [sx, sy, sz]: Vec3): boolean {
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    const y = c.y + e[1] * sx + e[5] * sy + e[9] * sz
    return this.supportAt(b, c.x + e[0] * sx + e[4] * sy + e[8] * sz, y, c.z + e[2] * sx + e[6] * sy + e[10] * sz, STEP) >= y - SUPPORT_GAP
  }

  /** Whether the piece has kept to the same spot on the ground for `CALM_SLEEP_AFTER` (see `CALM_DRIFT`). */
  private staysInPlace(b: PieceBody, touched: boolean, center: Vec3, q: THREE_NS.Quaternion, dt: number): boolean {
    const at = b.calmAt
    const turned = at ? turnBetween(at.quaternion, q) : Infinity
    if (!touched || !at || Math.hypot(center[0] - at.center[0], center[1] - at.center[1], center[2] - at.center[2]) > CALM_DRIFT || turned > CALM_TURN) {
      b.calmAt = touched ? { center: [center[0], center[1], center[2]], quaternion: [q.x, q.y, q.z, q.w] } : null
      b.calm = 0
      return false
    }
    b.calm += dt
    return b.calm >= CALM_SLEEP_AFTER
  }

  /** Whether the centre `c` of `upper` is over the top of `lower`'s box (as it was at the start of the update). */
  private onTopOf(upper: PieceBody, lower: PieceBody, c: THREE_NS.Vector3): boolean {
    const s = this.solidOf.get(lower)
    if (!s) return false
    const top = boxTopAt(s, c.x, c.z)
    return top > -Infinity && c.y >= top - 0.01
  }

  /**
   * The points a round piece touches the ground by as it is turned now (`q`): its rims (`contacts`), which hold it standing on an end, and the exact lowest point of each
   * rim (of the ball), so lying on its side it rests on a line and rolls smoothly instead of over the corners of a polygon.
   */
  private roundSamples(b: PieceBody, q: THREE_NS.Quaternion): Vec3[] {
    const round = b.round
    const rims = b.contacts ?? []
    if (!round) return rims
    const e = this.m.makeRotationFromQuaternion(q).elements
    // into the surface it last lay on (the world's down on the floor), in the piece's frame: on a slope it touches below its centre across the slope, not straight down
    const n = b.surfaceNormal ?? UP
    const down: Vec3 = [-(e[0] * n[0] + e[1] * n[1] + e[2] * n[2]), -(e[4] * n[0] + e[5] * n[1] + e[6] * n[2]), -(e[8] * n[0] + e[9] * n[1] + e[10] * n[2])]
    if (round.kind === 'sphere') return [...rims, [down[0] * round.radius, down[1] * round.radius, down[2] * round.radius]]
    const k = round.axis
    const across: Vec3 = [down[0], down[1], down[2]]
    across[k] = 0
    const len = Math.hypot(across[0], across[1], across[2])
    // standing on an end: the rim holds it
    if (len < 1e-3) return rims
    const lowest = (at: number, radius: number): Vec3 => {
      const p: Vec3 = [(across[0] / len) * radius, (across[1] / len) * radius, (across[2] / len) * radius]
      p[k] = at
      return p
    }
    const half = b.halfExtents[k]
    // the lowest point of each ring along it: a straight can touches by both ends, a tapered bottle by its wide end and its narrow one, a bottle's neck not at all
    const low = (round.profile ?? [[-half, round.radius], [half, round.radius]]).map(([at, radius]) => lowest(at, radius))
    // lying (its axis nearer level than upright) it touches by those lowest points only: the points of the rims beside them move as it rolls and would brake it
    return len > ROUND_LYING ? low : [...rims, ...low]
  }

  /**
   * Slows the spin of a round piece on the ground by its rolling resistance: a torque C_rr N r about the axis it rolls on (N = m g n_y on a surface of normal n), so with
   * I = k m r^2 the spin loses C_rr g n_y / (k r) per second, and down a slope of angle t it rolls at g (sin t - C_rr cos t) / (1 + k). Standing on its rim, a can's spin
   * about the rest dies down; lying, it keeps turning about the line it touches by (a tapered bottle rounds its narrow end).
   */
  private rollingResistance(b: PieceBody, q: THREE_NS.Quaternion, w: Vec3, h: number, rolling: number): void {
    const round = b.round
    if (!round) return
    const e = this.m.makeRotationFromQuaternion(q).elements
    const cylinder = round.kind === 'cylinder'
    const a: Vec3 = cylinder ? [e[round.axis * 4], e[round.axis * 4 + 1], e[round.axis * 4 + 2]] : [0, 0, 0]
    const along = cylinder ? w[0] * a[0] + w[1] * a[1] + w[2] * a[2] : 0
    const roll: Vec3 = cylinder ? [a[0] * along, a[1] * along, a[2] * along] : [w[0], w[1], w[2]]
    const rest: Vec3 = [w[0] - roll[0], w[1] - roll[1], w[2] - roll[2]]
    const spin = Math.hypot(roll[0], roll[1], roll[2])
    const upright = b.surfaceNormal?.[1] ?? 1
    const slow = spin > 0 ? Math.max(0, spin - (rolling * this.o.gravity * upright * h) / (round.inertia * round.radius)) / spin : 0
    const lying = cylinder && Math.abs(a[1]) < ROUND_LYING
    const damp = lying ? 1 : Math.exp(-3 * h)
    for (let i = 0; i < 3; i++) w[i] = roll[i] * slow + rest[i] * damp
  }

  /** Half the height of the box of a piece as it is turned now. */
  private halfHeight(b: PieceBody): number {
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    return Math.abs(e[1]) * b.halfExtents[0] + Math.abs(e[5]) * b.halfExtents[1] + Math.abs(e[9]) * b.halfExtents[2]
  }

  /**
   * Pieces against each other. Candidates by sweep and prune along x on their bounding spheres (sorted once per step: fifty cans cost a sort and a handful of pairs, not
   * 1225); a pair with a round piece in it meets by its shapes (`shapeContact`) and exchanges an impulse, two boxes are put apart by their separating axes (`separatePair`).
   */
  private collide(dt: number, meets?: StepFilter['meets']): void {
    const n = this.list.length
    if (n < 2) return
    const centers = this.list.map((b) => {
      const c = this.centerOf(b, this.p)
      return [c.x, c.y, c.z] as Vec3
    })
    const radii = this.list.map((b) => Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2]))
    const order = this.list.map((_, i) => i).sort((i, j) => centers[i][0] - radii[i] - (centers[j][0] - radii[j]))
    for (let oi = 0; oi < n; oi++) {
      const i = order[oi]
      const reach = centers[i][0] + radii[i]
      for (let oj = oi + 1; oj < n; oj++) {
        const j = order[oj]
        if (centers[j][0] - radii[j] > reach) break
        const a = this.list[i]
        const b = this.list[j]
        if ((a.held || a.sleeping) && (b.held || b.sleeping)) continue
        if (meets && !meets(a, b)) continue
        const r = radii[i] + radii[j]
        const ca = centers[i]
        const cb = centers[j]
        if (Math.abs(ca[1] - cb[1]) > r || Math.abs(ca[2] - cb[2]) > r) continue
        // one lies on the other (a book on a shelf): the corners hold them apart, a sideways push would slide it off
        // (a round piece meets the other by their shapes, which tell lying on from beside: a can by a tall wardrobe whose middle is far above it still hits it)
        const stacked = !a.round && !b.round && Math.abs(ca[1] - cb[1]) >= (this.halfHeight(a) + this.halfHeight(b)) * 0.9
        // or on a tilted top (a table going over): the one above is over the other's top, whatever their boxes' heights
        const onTop = this.onTopOf(b, a, new this.THREE.Vector3(...cb)) || this.onTopOf(a, b, new this.THREE.Vector3(...ca))
        if (a.round || b.round) {
          if (!stacked && !onTop) this.knock(a, b, ca, cb)
          continue
        }
        // two boxes when a part of one is in a part of the other (a book lying in the hollow of a case on its back is inside its box, not in its boards); lying on each
        // other, or one leaning on the other's part (a board on a bench's seat), the support holds them while they only touch: beside each other or deeper, they go apart
        if (this.partsOverlap(a, b)) this.separatePair(a, b, ca, cb, dt, stacked || onTop || this.restsOn(a, b, false) || this.restsOn(b, a, false))
      }
    }
    this.applyPushes(dt)
  }

  /**
   * Moves each piece by what its pairs put it apart this step (`pushes`), at most `SEPARATE_SPEED` along the ground and as much up: a chunk in five others is not pushed five
   * times as fast, and nothing is ever moved down (into what holds it). A piece still being put apart is moving, though its speed is nil: it does not fall asleep in the other.
   */
  private applyPushes(dt: number): void {
    const most = SEPARATE_SPEED * dt
    for (const [body, push] of this.pushes) {
      const level = Math.hypot(push[0], push[2])
      const k = level > most ? most / level : 1
      const up = Math.min(most, Math.max(0, push[1]))
      body.root.position.x += push[0] * k
      body.root.position.y += up
      body.root.position.z += push[2] * k
      if (Math.max(level * k, up) > SLOP) body.still = 0
    }
    this.pushes.clear()
  }

  /** The shape a piece meets others by (`ContactShape`), as it stands now: a round one a capsule round its axis, any other the boxes of its parts or its box. */
  private contactShape(b: PieceBody, c: Vec3): ContactShape {
    const e = [...this.m.makeRotationFromQuaternion(b.root.quaternion).elements]
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return { kind: 'capsule', from: c, to: c, radius: round.radius }
      // the segment stops a radius short of each end, so end on it is as long as the piece
      const reach = Math.max(0, b.halfExtents[round.axis] - round.radius)
      const k = round.axis * 4
      const d: Vec3 = [e[k] * reach, e[k + 1] * reach, e[k + 2] * reach]
      return { kind: 'capsule', from: [c[0] - d[0], c[1] - d[1], c[2] - d[2]], to: [c[0] + d[0], c[1] + d[1], c[2] + d[2]], radius: round.radius }
    }
    const parts = b.partBoxes ?? [{ center: [0, 0, 0] as Vec3, half: b.halfExtents }]
    return {
      kind: 'boxes',
      boxes: parts.map(squareBoxOf).map(({ center, half }) => ({
        c: [c[0] + e[0] * center[0] + e[4] * center[1] + e[8] * center[2], c[1] + e[1] * center[0] + e[5] * center[1] + e[9] * center[2], c[2] + e[2] * center[0] + e[6] * center[1] + e[10] * center[2]] as Vec3,
        e,
        half,
      })),
    }
  }

  /**
   * Two pieces that met, one of them round: they are put apart along the normal (by their inverse masses) and, closing in, exchange an impulse
   * j = -(1 + e) v_n / (1/m_a + 1/m_b + the turning of each), with the restitution e of their two materials, and the friction of their surfaces across it. The impulses are
   * equal and opposite, so the momentum of the pair is kept. A held piece is not moved (the hand holds it); a sleeping one wakes when it is knocked.
   */
  private knock(a: PieceBody, b: PieceBody, ca: Vec3, cb: Vec3): void {
    const hit = shapeContact(this.contactShape(a, ca), this.contactShape(b, cb))
    if (!hit) return
    const n = hit.normal
    // one on the other (a can rolling down a board, off its end): the support of the pieces holds it, as it does on the floor
    if (Math.abs(n[1]) > SLAM_FLOOR_NORMAL) return
    const ra: Vec3 = [hit.point[0] - ca[0], hit.point[1] - ca[1], hit.point[2] - ca[2]]
    const rb: Vec3 = [hit.point[0] - cb[0], hit.point[1] - cb[1], hit.point[2] - cb[2]]
    const pointV = (body: PieceBody, r: Vec3): Vec3 => {
      const v = body.velocity
      const w = body.angularVelocity
      return [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]]
    }
    const relative = (): Vec3 => {
      const va = pointV(a, ra)
      const vb = pointV(b, rb)
      return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]]
    }
    const vn0 = relative()
    const closing = vn0[0] * n[0] + vn0[1] * n[1] + vn0[2] * n[2]
    // a sleeping piece stays put for a touch (cans asleep side by side); knocked, it wakes
    const wake = (body: PieceBody): void => {
      body.sleeping = false
      body.still = 0
      body.calmAt = null
    }
    if (closing < -WAKE_ABOVE_SPEED) {
      if (a.sleeping) wake(a)
      if (b.sleeping) wake(b)
    }
    const ima = a.held || a.sleeping ? 0 : 1 / a.mass
    const imb = b.held || b.sleeping ? 0 : 1 / b.mass
    if (ima + imb === 0) return
    const ea = [...this.m.makeRotationFromQuaternion(a.root.quaternion).elements]
    const eb = [...this.m.makeRotationFromQuaternion(b.root.quaternion).elements]
    // apart: along the ground when they meet side by side (a can is not lifted off the floor by its neighbour), else along the normal
    const flat = Math.hypot(n[0], n[2])
    const out: Vec3 = flat > KNOCK_FLAT ? [n[0] / flat, 0, n[2] / flat] : n
    const depth = Math.max(0, hit.depth - SLOP) / (flat > KNOCK_FLAT ? flat : 1)
    for (const [body, share, sign] of [[a, ima, 1], [b, imb, -1]] as const) {
      if (share === 0) continue
      const move = (depth * share * sign) / (ima + imb)
      body.root.position.x += out[0] * move
      body.root.position.y += out[1] * move
      body.root.position.z += out[2] * move
    }
    if (closing >= 0) return
    /** What the pair shows to an impulse along the unit `d`: 1/m_a + 1/m_b + (I_a^-1 (r_a x d) x r_a) . d + (the same for b). */
    const turning = (body: PieceBody, e: number[], r: Vec3, d: Vec3): number => {
      const t = this.mulInvInertiaWith(body, e, r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0])
      return (t[1] * r[2] - t[2] * r[1]) * d[0] + (t[2] * r[0] - t[0] * r[2]) * d[1] + (t[0] * r[1] - t[1] * r[0]) * d[2]
    }
    const resist = (d: Vec3): number => ima + imb + (ima > 0 ? turning(a, ea, ra, d) : 0) + (imb > 0 ? turning(b, eb, rb, d) : 0)
    const give = (j: Vec3): void => {
      if (ima > 0) {
        for (let i = 0; i < 3; i++) a.velocity[i] += j[i] * ima
        const dw = this.mulInvInertiaWith(a, ea, ra[1] * j[2] - ra[2] * j[1], ra[2] * j[0] - ra[0] * j[2], ra[0] * j[1] - ra[1] * j[0])
        for (let i = 0; i < 3; i++) a.angularVelocity[i] += dw[i]
      }
      if (imb > 0) {
        for (let i = 0; i < 3; i++) b.velocity[i] -= j[i] * imb
        const dw = this.mulInvInertiaWith(b, eb, rb[1] * j[2] - rb[2] * j[1], rb[2] * j[0] - rb[0] * j[2], rb[0] * j[1] - rb[1] * j[0])
        for (let i = 0; i < 3; i++) b.angularVelocity[i] -= dw[i]
      }
    }
    // a touch slower than `BOUNCE_MIN_SPEED` only stops (two cans resting together do not chatter)
    const bounce = -closing > BOUNCE_MIN_SPEED ? pairRestitution(a.restitution, b.restitution) : 0
    const j = (-(1 + bounce) * closing) / resist(n)
    give([n[0] * j, n[1] * j, n[2] * j])
    // the friction of the two surfaces across the normal, up to mu times the push (Coulomb)
    const v = relative()
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]
    const vt: Vec3 = [v[0] - vn * n[0], v[1] - vn * n[1], v[2] - vn * n[2]]
    const slide = Math.hypot(vt[0], vt[1], vt[2])
    if (slide < 1e-6) return
    const t: Vec3 = [vt[0] / slide, vt[1] / slide, vt[2] / slide]
    const jt = Math.min(slide / resist(t), pairFriction(a.friction, b.friction ?? null).dynamic * j)
    give([-t[0] * jt, -t[1] * jt, -t[2] * jt])
    if (-closing >= SLAM_MIN_SPEED && this.time - Math.max(a.lastHit, b.lastHit) > 0.15) {
      a.lastHit = b.lastHit = this.time
      this.o.onKnock?.(a, b, hit.point, -closing)
    }
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

  /**
   * Two boxes overlapping, put apart by their separating axes (`shapeContact`); a held or sleeping piece is not moved. The move (`SEPARATE_SHARE` of the overlap less `SLOP`) is
   * summed into `pushes` and bounded per piece in `applyPushes`.
   * - Side by side (a normal at least `KNOCK_FLAT` level): apart along the ground only, as in `knock`, split by their inverse masses; the speed they close in with stops.
   * - One over the other as deep as a contact (`LIFT_DEPTH` and what the closing speed sank them this step): left alone when `resting` (stacked, on a top, leaning on a
   *   part: its support holds it); else only the upper rises, held up by the lower (`propped`), and its point in the lower stops sinking (`contactImpulse`): never a kick up.
   * - One over the other deeper than that: they were made inside each other (chunks of one wall), or stand on one floor side by side. Lifting the upper out would give it
   *   m g d nothing supplied (a 3 m chunk climbing 5 m through a pile), so they slide apart along the ground by their least level overlap (`boxesAlongGround`).
   */
  private separatePair(a: PieceBody, b: PieceBody, ca: Vec3, cb: Vec3, dt: number, resting: boolean): void {
    const sa = this.contactShape(a, ca)
    const sb = this.contactShape(b, cb)
    const hit = shapeContact(sa, sb)
    if (!hit) return
    const ima = a.held || a.sleeping ? 0 : 1 / a.mass
    const imb = b.held || b.sleeping ? 0 : 1 / b.mass
    if (ima + imb === 0) return
    if (Math.hypot(hit.normal[0], hit.normal[2]) > KNOCK_FLAT) {
      this.slideApart(a, b, ima, imb, hit)
      return
    }
    const n = hit.normal
    const va = a.velocity
    const vb = b.velocity
    const contact = LIFT_DEPTH + Math.max(0, -((va[0] - vb[0]) * n[0] + (va[1] - vb[1]) * n[1] + (va[2] - vb[2]) * n[2])) * dt
    if (hit.depth > contact) {
      const level = boxesAlongGround(sa, sb)
      if (level) this.slideApart(a, b, ima, imb, level)
      return
    }
    if (resting) return
    const [upper, c, up]: [PieceBody, Vec3, Vec3] = n[1] > 0 ? [a, ca, n] : [b, cb, [-n[0], -n[1], -n[2]]]
    if (upper.held || upper.sleeping) return
    upper.propped = up
    const e = this.m.makeRotationFromQuaternion(upper.root.quaternion).elements
    const r: Vec3 = [hit.point[0] - c[0], hit.point[1] - c[1], hit.point[2] - c[2]]
    upper.proppedAt = r
    // the contact point comes out as a push at that point does (as the impulse below): the body moves by its share of the lift and turns by the rest, so what it still
    // stands on elsewhere (a corner on the ground) is not carried up with it and left to fall back into the same neighbour
    const turn = this.mulInvInertiaWith(upper, e, r[1] * up[2] - r[2] * up[1], r[2] * up[0] - r[0] * up[2], r[0] * up[1] - r[1] * up[0])
    const angular = (turn[1] * r[2] - turn[2] * r[1]) * up[0] + (turn[2] * r[0] - turn[0] * r[2]) * up[1] + (turn[0] * r[1] - turn[1] * r[0]) * up[2]
    const lift = (SEPARATE_SHARE * Math.max(0, hit.depth - SLOP)) / (1 + angular * upper.mass)
    // lifted by several pieces under it at once (a sheet across three slabs) it needs the deepest of them, not all: each overlap is measured from where it stood, and their sum
    // would lift it clear of all and leave it to fall back into them, step after step
    const push = this.pushes.get(upper) ?? [0, 0, 0]
    for (let i = 0; i < 3; i++) push[i] = Math.abs(up[i] * lift) > Math.abs(push[i]) ? up[i] * lift : push[i]
    this.pushes.set(upper, push)
    this.turnAboutCentre(upper, c, [turn[0] * lift * upper.mass, turn[1] * lift * upper.mass, turn[2] * lift * upper.mass])
    this.contactImpulse(upper, e, r, up, 0)
  }

  /** Turns a piece by the rotation vector `by` (rad) about its centre `c`, which stays where it is. */
  private turnAboutCentre(b: PieceBody, c: Vec3, by: Vec3): void {
    const angle = Math.hypot(by[0], by[1], by[2])
    if (angle < 1e-9) return
    b.root.quaternion.premultiply(this.dq.setFromAxisAngle(this.ax.set(by[0] / angle, by[1] / angle, by[2] / angle), angle)).normalize()
    const off = this.ax.copy(b.centerV).applyQuaternion(b.root.quaternion)
    b.root.position.set(c[0] - off.x, c[1] - off.y, c[2] - off.z)
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
