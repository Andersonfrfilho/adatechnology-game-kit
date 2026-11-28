import type * as THREE_NS from 'three'
import type { RayBroadPhase, Vec3 } from '@adatechnology/game-destruction'
import type { BodyDesc, BodyId, HeightRegion, JointId, Material, Quat, Rolling, SeamWorld, ShapeDesc } from '@adatechnology/game-physics'
import { samePatch } from '@adatechnology/game-terrain'
import type { HeightPatch } from '@adatechnology/game-terrain'

import { GROUND_CELL, buildGroundTile, flatTile, readGround, sampleCount, shapeGround } from './engine-ground'
import type { AwakeList } from './awake-list'
import type { GroundGrid, GroundRect, GroundTile } from './engine-ground'
import { changedHeights } from './engine-ground-heights'
import { bandLength, latticePatchRead, readGroundBand, readGroundPatch } from './engine-ground-job'
import type { GroundPatchRead } from './engine-ground-job'
import type { GroundWorkerPort } from './engine-ground-port'
import { GroundFollow } from './engine-ground-follow'
import { GroundSchedule } from './engine-ground-schedule'
import type { PendingGround } from './engine-ground-schedule'
import { SOLID_RING } from './engine-ground-ring'
import { NO_SOLID, SOLID_STRIDE, buildSolidVolume, sameNumbers, sameSolid } from './engine-ground-solid'
import type { SolidVolume } from './engine-ground-solid'
import { createEngineRayBroadPhase } from './engine-rays'
import { EngineStatics } from './engine-statics'
import type { StaticSolid } from './engine-statics'
import { HINGE_RELEASE } from './internal'
import type { PartBox, PieceBody, PieceRound, PieceSweepHit } from './internal'
import { mergeFlushBoxes } from './merge-flush-boxes'
import { PIECE_ROLLING_DAMPING } from './friction'

export type { StaticSolid } from './engine-statics'

export interface EnginePieceOptions {
  readonly groundAt: (x: number, z: number) => number
  /**
   * The exact lowest and highest `groundAt` over a rectangle (min x, max x, min z, max z), or null when unknown. A tile it proves level is laid as a slab without reading its
   * samples; without it every tile is read. Must be exact: a loose bound lays a slab where there is a crater.
   */
  readonly groundRange?: (minX: number, maxX: number, minZ: number, maxZ: number) => { readonly low: number; readonly high: number } | null
  /** `groundAt` over a lattice in one pass, to the bit (`GroundGrid`): a tile reads its samples through it instead of a call each. Without it every sample is a call. */
  readonly groundGrid?: GroundGrid
  /**
   * The rolling resistance (C_rr) of the ground's surface at (x, z), from its material (`TerrainMaterial.rolling`), or undefined for the default (`ROLLING_RESISTANCE`, a hard
   * floor). A tile of ground has the one at its middle (`tileRollingAt`): a round piece on it rolls by the larger of its own and that one. A tile reads it when it is laid and
   * again when the host marks its ground changed (`groundChanged`, through `wakeRegion`), as for its heights: a surface that changes is marked like a height that does.
   */
  readonly groundRollingAt?: (x: number, z: number) => number | undefined
  /** The rolling damping (1/s) of the ground's surface at (x, z) (`TerrainMaterial.rollingDamping`), read per tile as `groundRollingAt` is; undefined for `GROUND_ROLLING_DAMPING`. */
  readonly groundRollingDampingAt?: (x: number, z: number) => number | undefined
  /**
   * `groundAt`'s vertices under a rectangle (`GroundPatchRead`; `Terrain.heightPatch` is one), to the bit what `groundGrid` reads there. Under `groundWorker`, a tile it covers
   * (with its ring) is asked for with its patch, about 26 x 26 numbers, not its 60 000 samples and band: the samples are made where the tile is, and a change is told by
   * comparing patches. A tile it does not cover (across the terrain's bounds) is read as before.
   */
  readonly groundPatch?: GroundPatchRead
  readonly gravity: number
  /** The fixed boxes per object; a new array for an object means it changed (measured again, broken, gone). */
  readonly staticSolids?: () => ReadonlyMap<string, readonly StaticSolid[]>
  /** The objects whose `staticSolids` list is not all of what a ray can hit (measured in part, or a loose or hidden part left out): the ray broad phase tries them whatever the engine says. */
  readonly staticUnsure?: () => ReadonlySet<string>
  readonly sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  readonly onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  readonly onKnock?: (a: PieceBody, b: PieceBody, point: Vec3, speed: number) => void
  readonly onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
  /**
   * The most tiles of ground laid at a blast (`layAhead`), nearest the centre first; 0 turns it off. A blast's pieces come into being in the next update, on tiles not laid yet:
   * laying the ones the blast reaches at the blast, before any piece needs them, takes that cost out of the frame the pieces appear in, and puts it in the explosion's. Default `BLAST_TILES` (off).
   */
  readonly blastTiles?: number
  /** Lay the ground under each part box of a piece of several parts, not under the box around all of them (default off: the same tiles as before). */
  readonly tilesUnderParts?: boolean
  /** The body a piece in a hand passes through (the holder's own): ignored while the piece is held, met again when it is let go. */
  readonly heldIgnores?: () => BodyId | undefined
  /**
   * Where the tiles that read the ground are made (`GroundWorkerPort`; `RendererOptions.groundWorker`): with it, a tile asked for at update N is applied at N + `groundWorkerFrames`
   * (`GroundSchedule`), the same tile whether the worker answered or not; a piece whose ground is not laid yet waits held still. Left out (the default), every tile is made in
   * the update it is needed, as before. The engine owns the port once handed: `dispose` stops it.
   */
  readonly groundWorker?: GroundWorkerPort
  /** Updates from asking for a tile to applying it under `groundWorker` (default `GROUND_WORKER_FRAMES`, at least 1). */
  readonly groundWorkerFrames?: number
}

/** What is done with a tile a piece needs (`EnginePieces.groundOf`): laid at once, or asked of the schedule. */
type TileVisit = (key: number, ix: number, iz: number) => void

/** Updates from asking for a tile to applying it under `groundWorker` unless the host says otherwise (owner, 2026-11-17: 1 to 3 frames of delay accepted). */
export const GROUND_WORKER_FRAMES = 2

/** Whether a tile's engine field is the coarse one (`collisionFieldOf`): a slab never is. */
const wasCoarseOf = (tile: { readonly slab: boolean; readonly collision: Float32Array; readonly heights: Float32Array }): boolean => !tile.slab && tile.collision.length < tile.heights.length

/** A piece's box seen from above (`EnginePieces.footprint`). */
interface Footprint {
  readonly corners: Float64Array
  readonly normals: Float64Array
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Side of a tile of ground (m); how far around an awake piece tiles are laid (m). */
const TILE = 2
const TILE_MARGIN = 0.5
/** How far (m) past the disc the host names a change its ground is read again (the ground's own height is read between its grid points, so a change reaches a little past them). */
const GROUND_REACH = 0.25
/**
 * The share of a height field's samples a change may cover and still be written into the shape (`updateHeights`): it costs about 23 ns a sample against 0.21 ms for a whole
 * new field of 81 x 81, so past about three quarters a new shape is the cheaper (measured, T3.8q); half leaves room for the engine's own work around the write.
 */
const IN_PLACE_SHARE = 0.5
/** The tiles laid at a blast unless the host says otherwise: none. Measured (T3.8ad), 48 of them moved about 24 ms into the explosion frame and left the worst frame no better. A count, not a clock, so the same blast lays the same tiles on any machine. */
const BLAST_TILES = 0
/** A blast's radius counts to this far (m) when the tiles it reaches are listed: the nearest ones are laid, and the count caps the rest. */
const BLAST_REACH = 32
/** A tile whose ground varies by no more than this (m) over every sample is level (`shapeGround` calls 1e-9 level; half of it leaves room for rounding). */
const FLAT_SPAN = 5e-10
/**
 * How many times in a row a height field is written in place before a whole new one is made from the exact heights. Jolt's `SetHeights` also requantizes the blocks
 * left of and above the written ones, and a sample requantized from its own dequantized value moves down: up to 4.4e-5 m a write, 1.8 mm over 50 (measured, T3.8q). Four
 * writes keep the ground within 0.18 mm of the exact heights, under one step of its 8 bit samples, and the new shape resets it.
 */
const MAX_IN_PLACE_WRITES = 4
/** The most (m) a piece's tips swinging in one update widen the tiles laid around its footprint. */
const MAX_SWING = 3
/** The most stops along a piece's path in one update where its footprint's tiles are laid (a piece that crosses a tile or more in an update lands on ground not laid yet). */
const MAX_PATH_STOPS = 6
/** A tile's key: its column and row from `TILE_KEY_ORIGIN`, in one number (no text made per tile per update). */
const TILE_KEY = 65536
const TILE_KEY_ORIGIN = 32768
const MU_STATIC = 0.7
const ROLLING_RESISTANCE = 0.015
const MU_DYNAMIC = 0.6
const GROUND: Material = { frictionStatic: MU_STATIC, frictionDynamic: MU_DYNAMIC, restitution: 0, rolling: ROLLING_RESISTANCE }

/**
 * The rolling resistance of the ground at (x, z) as the engine reads it: the surface at the middle of the tile it falls in (the engine's ground is one body a tile), so
 * a tile across a road's edge is all road or all verge, Undefined: the default.
 */
const tileRollingAt = (rollingAt: (x: number, z: number) => number | undefined, x: number, z: number): number | undefined =>
  rollingAt((Math.floor(x / TILE) + 0.5) * TILE, (Math.floor(z / TILE) + 0.5) * TILE)
const STILL_SPEED = 0.12
const STILL_SPIN = 0.45
const HARD_LANDING = 3
const SLAM_MIN_SPEED = 2
const SLAM_BOUNCE = 0.2
/** Slower than this (m/s) into a wall the engine does not have, a piece does not bounce off it: the engine's own threshold (Jolt's `mMinVelocityForRestitution`). */
const BOUNCE_SPEED = 1
const SLAM_FLOOR_NORMAL = 0.7
const KNOCK_EVERY = 0.15
/** Sleeping pieces whose ground is looked at again each update, and how far (m) it must have dropped for one to wake. */
const GROUND_CHECKS = 16
const GROUND_DROP = 0.02
/** The kit's balancing rule: a support narrower than this share of the height of the centre of mass is a balancing act, and the push (rad/s^2 per metre) that ends it. */
const NARROW = 0.3
/** Radii of a round piece's profile that differ by less than this (m) are one cylinder; the segments of the ring each profile point makes in the engine's shape. */
const TAPER_MIN = 0.002
const RING_SEGMENTS = 16
const TOPPLE = 3
/** How many times the point-mass bound on gravity's hold the push is: the engine held a 5 cm leg against 2.5 times it, and tipped it at 3 (measured). */
const HOLD_MARGIN = 4
/**
 * The same push cannot be more than this many times what gravity itself gives the piece about that edge, with the inertia it really has (`holdPush`). The point-mass
 * bound above forgets the body's own inertia: for a leg standing on its end the two are close (the leg's is 0.75 of the point's, so 6 leaves its push as it was), but
 * for a board lying flat that touches by one point for an instant the point-mass bound has both its lengths at millimetres and gave thousands of rad/s² (a 20 kg board
 * 4.4 m long went from rest to 8 rad/s in one update, a table leg to 32: boards doing pirouettes under a burst).
 */
const HOLD_MARGIN_REAL = 6

/**
 * The push (rad/s²) that ends a balancing act on a narrow support (`HOLD_MARGIN` times the point-mass bound on gravity's hold), never more than `HOLD_MARGIN_REAL`
 * times what gravity gives the body about that edge: g e / (k + h² + e²), with `turning` (k, m²) its moment of inertia per kilogram about the axis through its
 * centre of mass, `edge` (e) how far the edge is from under the centre and `height` (h) how high the centre is over it.
 */
export const holdPush = (params: { readonly edge: number; readonly height: number; readonly gravity: number; readonly turning: number }): number => {
  const e = Math.abs(params.edge)
  const arm = params.height * params.height + e * e
  if (arm <= 0) return 0
  return Math.min((HOLD_MARGIN * params.gravity * e) / arm, (HOLD_MARGIN_REAL * params.gravity * e) / (params.turning + arm))
}
/** A support whose middle is closer than this (m) to the centre of mass is under it: which way it goes over is then not read from the contact points, which flicker. */
const SIDE_DEAD = 0.01
/** How far (m) the lowest corners of a piece's box may be from the floor it stands on to count as its support (`topple`). */
const BOX_FOOT = 0.02
/** The strong push stops once it has turned a column this fast (rad/s): a 5 cm leg tips from it; measured on the bowl, 0.1 made 4.2 cm in seed 57 and 1 made 31 cm in seed 61, 0.3 is clean in all 128. */
const PUSH_SPIN = 0.3
/** Corners this close (m) to the lowest one are what it stands on. */
const STEADY_TURN = 0.1
const STEADY_SECONDS = 1.5
/** A piece on a narrow support that has not turned for this long (s) is propped by something its contact points do not read as support (a tent of two plates on their edges). */
const PROPPED_SECONDS = 0.3
/** What is left of its friction while propped: it slips, and gravity, not the kit's push, brings it down. */
const PROPPED_GRIP = 0.1
/** How far (m) a new piece may reach into the ground and be left to the engine's contact (over its slop, under a thin plate's half), and how far above it one lifted is put. */
const SINK = 0.005
const LIFT_MARGIN = 0.001
/** Ground that rises under a piece by up to this (m) is cleared by the engine's contact within an update (2 mm of push-out in each of 2 passes a step, 2 to 6 steps): the kit does not lift the piece. */
const ENGINE_CLEARS = 0.01
/** Two numbers of a pose further apart than this differ (the centre comes back through the root: equal within rounding is the same). */
const far = (a: number, b: number): boolean => Math.abs(a - b) > 1e-6
/** How many times a piece made inside fixed things is moved out of the deepest one (it may be inside two, or wedged between them). */
const OUT_TRIES = 8
/** The first step (m) a wedged piece is lifted by (`outOfStatics`). */
const WEDGE_LIFT = 0.1
/** How far (m) around a removed piece a sleeping one is woken: what rested on it touched it. */
const WAKE_MARGIN = 0.1
/** A lift that leaves more than this share of the depth it had is no way out of that fixed thing: the piece is in two (`outOfStatics`). */
const NO_PROGRESS = 0.75
/** How far apart (m) the poses are that a wedge lift is checked at on its way up: about the piece's thinnest half, so it cannot step over a slab it would cross. */
const WAY_STEP_MIN = 0.02
const WAY_STEP_MAX = 0.1

/** What a piece of debris can be made inside: the fixed things and the debris cut beside it (it meets nothing else, layer `rubble`). */
const BORN_INSIDE = { layers: ['static', 'rubble'] } as const

interface Link {
  readonly id: BodyId
  /** The fixed things a piece of debris was made inside and has not left yet (`throughStatics`): it passes through them until it is out. */
  through?: BodyId[]
  /** The ground under its centre when it went to sleep: the engine does not see `groundAt` change, the kit looks (`groundTurn`). */
  groundAtSleep: number
  readonly user: number
  shapeKey: readonly unknown[]
  /** What `shapeKey` was made from, by reference: the same objects need no new key (most updates). */
  shapeFrom: readonly unknown[]
  readonly pos: number[]
  readonly quat: number[]
  readonly vel: number[]
  readonly ang: number[]
  held: boolean
  sleeping: boolean
  /** The update it was last handed in (`update`): one not handed any more is removed. */
  seen: number
  /** Held still while its ground is being made (`hold`): kinematic at rest in the engine, the piece's own pose and speeds kept for when it goes. */
  frozen: boolean
  /** Its centre and vertical speed before the step, when it was awake (`readBack`). */
  readonly before: Vec3
  beforeVy: number
  stepped: boolean
  /** The side (x, z) the balancing push goes to: kept while the support is centred under the piece, where the contact points only flicker either way (`topple`). */
  readonly side: [number, number]
  isSlipping: boolean
}

/** A walk over the pieces an update looks at: the awake ones, or all of them. */
type Each = (visit: (b: PieceBody) => void) => void

interface Tile {
  /** The ground body: a slab when the tile is level, else a height field; kept across changes so what lies on it keeps its contacts. */
  ground: BodyId
  slab: boolean
  /** The step boxes' body, if the tile has steps, and the boxes it was made from. */
  steps: BodyId | null
  boxes: readonly number[] | Float64Array
  /** The solid body under the height field (not under a slab) and the boxes it was made from: a second body, so the height field keeps its own shape across changes. */
  solid: BodyId | null
  volume: SolidVolume
  /** The read grid's heights, to find what a change moved (empty under a slab); the engine's coarser field of them (`engine-ground-collision`); and how many times in a row it was written in place (`MAX_IN_PLACE_WRITES`). */
  heights: Float32Array
  collision: Float32Array
  writes: number
  /** Null for a tile proved level without reading it (its level then is `level`), and for one made from a patch (`patch`). */
  samples: Float64Array | null
  /** The terrain's vertices a tile was made from (`EnginePieceOptions.groundPatch`), the schedule's to take back when the tile is made again; null when it was read. */
  patch: HeightPatch | null
  level: number | null
  /** Where the host said the ground changed (world x and z, widened by `GROUND_REACH`): only the samples there are read again. Null when it did not. */
  dirty: GroundRect | null
  /** The surface its bodies have (`groundMaterial`): set again on them when the ground there turns to another (a blast takes the asphalt off the soil). */
  material: Material
}

/**
 * Steps the loose pieces through the kit's physics contract (`game-physics`): each piece a dynamic body at its centre of mass with its parts' boxes (or its box, or
 * its round shape), its mass, and its surface's static and dynamic friction (the engine adapter applies Coulomb per contact). The ground is `groundAt` as triangles
 * that keep its steps (`engine-ground`); the fixed things are their drawn boxes, turned as drawn. On top stay the kit's rules the engine does not know: the sweep
 * against walls, hard landings, falling over (`tip`), the knock sound, and (in `PieceSystem`) the budget of awake pieces and their rest points.
 */
export class EnginePieces {
  private readonly links = new Map<PieceBody, Link>()
  private readonly byUser = new Map<number, PieceBody>()
  /** The pieces by object id: what the sweep meets that the engine already has (`sweepOn`). */
  private readonly byObject = new Map<string, PieceBody>()
  private readonly byBody = new Map<BodyId, PieceBody>()
  /** The same bodies as a set: what the engine leaves out when it lists the bodies that are not the pieces' (`GroundFollow`). */
  private readonly bodyIds = new Set<BodyId>()
  /** Ground under the bodies and characters of the world that are not the pieces. */
  /** Ground under the bodies and characters of the world that are not the pieces. */
  readonly follow: GroundFollow
  /** The engine's awake bodies as `finish` last read them (one crossing), and the pieces they are. */
  private readonly activeIds: BodyId[] = []
  private readonly active = new Set<PieceBody>()
  private nextUser = 1
  private updates = 0
  private turn = 0
  /**
   * Pieces found wholly under the ground after a step (through a one-sided ground triangle: the engine has no solid below it) and put back on it: the invariant
   * of §12 (nothing goes under the floor), counted so a test or the room log can fail on it. A net, not a cure: none in a healthy run.
   */
  fellThrough = 0
  private readonly tiles = new Map<number, Tile>()
  /** The ground's surfaces by rolling resistance (`groundMaterial`): one object each, so a tile tells a change of surface by identity. */
  private readonly groundMaterials = new Map<string, Material>()
  /** The tiles made off the main thread on a fixed schedule (`EnginePieceOptions.groundWorker`), or null. */
  readonly schedule: GroundSchedule | null
  /** The due tiles `applyDueGround` takes (kept, so an update makes no list). */
  private readonly due: PendingGround[] = []
  /** Whether a tile the piece being visited needs is not laid yet (`askAt`). */
  private waits = false
  /** Blast tiles to ask for again once the tile being made there is applied (`askBlastAt`), by key. */
  private readonly blastAgain = new Set<number>()
  /** The pieces held for their ground in this update (`layGroundLater`). */
  private readonly waiting = new Set<PieceBody>()
  /** The blasts told since the last `prepare` (`layAhead`). */
  private readonly blasts: Array<{ x: number; z: number; radius: number }> = []
  /** The host's fixed things (`staticSolids`) as static bodies. */
  readonly statics: EngineStatics
  /** The debris still passing through a fixed thing it was made inside (`throughStatics`). */
  private readonly passing = new Set<PieceBody>()
  /** A set of one fixed body, to ask how deep a piece is in that one. */
  private readonly oneStatic = new Set<BodyId>()
  /** The bodies a piece of debris overlaps where it is made (`throughStatics`), kept between asks. */
  private readonly overlapped: BodyId[] = []
  private readonly ignored = new Set<string>()
  private readonly knocks = new Map<string, number>()
  private readonly footprintOut: Footprint = { corners: new Float64Array(16), normals: new Float64Array(6), minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  private readonly pose = new Float64Array(7)
  private readonly velocity = new Float64Array(6)
  private readonly contactXYZ = new Float32Array(48)
  /** The pieces hung on a hinge: the fixed anchor at the screw and the joint that holds them to it. */
  private readonly hung = new Map<PieceBody, { readonly anchor: BodyId; readonly joint: JointId }>()
  private readonly outAxis = new Float64Array(3)
  private readonly wayAxis = new Float64Array(3)
  /** The centre `readBack` reads into (the sweep may move it). */
  private readonly readPos: Vec3 = [0, 0, 0]
  private readonly v: THREE_NS.Vector3
  private readonly u: THREE_NS.Vector3
  private readonly w: THREE_NS.Vector3
  private readonly turn3: THREE_NS.Quaternion
  private readonly partQuaternion: THREE_NS.Quaternion
  private readonly partCentre: THREE_NS.Vector3

  constructor(
    THREE: typeof THREE_NS,
    private readonly world: SeamWorld,
    private readonly o: EnginePieceOptions,
  ) {
    this.v = new THREE.Vector3()
    this.u = new THREE.Vector3()
    this.w = new THREE.Vector3()
    this.turn3 = new THREE.Quaternion()
    this.partQuaternion = new THREE.Quaternion()
    this.partCentre = new THREE.Vector3()
    this.statics = new EngineStatics(world, GROUND)
    this.schedule = o.groundWorker ? new GroundSchedule(o.groundWorker, Math.max(1, Math.round(o.groundWorkerFrames ?? GROUND_WORKER_FRAMES))) : null
    if (this.schedule) this.warmGround(this.schedule)
    this.follow = new GroundFollow({
      world, skip: this.bodyIds, tile: TILE, margin: TILE_MARGIN, maxStops: MAX_PATH_STOPS, keyOrigin: TILE_KEY_ORIGIN, keyStride: TILE_KEY,
      needs: (key) => { const tile = this.tiles.get(key); return !tile || tile.dirty !== null },
      has: (key) => this.tiles.has(key),
      layNow: this.layAt,
      layLater: this.schedule ? this.askAt : this.layAt,
      drop: (key) => this.dropTile(key),
    })
  }

  /** A tile nobody needs any more: its bodies leave the world, and a piece or body that comes back asks for it again. */
  private dropTile(key: number): void {
    const tile = this.tiles.get(key)
    if (!tile) return
    this.world.removeBody(tile.ground)
    if (tile.steps !== null) this.world.removeBody(tile.steps)
    if (tile.solid !== null) this.world.removeBody(tile.solid)
    if (tile.patch) this.schedule?.givePatch(tile.patch.heights)
    this.tiles.delete(key)
  }

  /** The piece a body of the engine is, or undefined (a fixed body, someone else's). */
  pieceOfBody(body: BodyId): PieceBody | undefined {
    return this.byBody.get(body)
  }

  /** Whether the piece has a body in the engine yet (a piece made this frame has none until the next update). */
  hasBody(piece: PieceBody): boolean {
    return this.links.has(piece)
  }

  /** The fixed bodies as a broad phase for the destruction world's rays (`engine-rays.ts`). */
  rayBroadPhase(): RayBroadPhase {
    return createEngineRayBroadPhase(this.world, this.statics)
  }

  /** The worker's first job, a sloped tile with steps away from the host's ground (no host call): its code is parsed and hot before the first blast asks for real ones. */
  private warmGround(schedule: GroundSchedule): void {
    const warmGround = (x: number, z: number): number => 0.3 * x - 0.2 * z + 0.15 * Math.floor(x / 0.37) + 0.05 * Math.sin(3 * z)
    const samples = new Float64Array(sampleCount(Math.round(TILE / GROUND_CELL)))
    readGround(warmGround, samples, 0, 0, TILE)
    const band = new Float64Array(bandLength(TILE))
    readGroundBand(warmGround, band, 0, 0, TILE)
    schedule.warm(samples, band, 0, 0, TILE)
    // the warm patch is read the way a real one is (`readGroundPatch` over the tile and its ring), so it fits whatever the tile and the ring are
    if (this.o.groundPatch) schedule.warmPatch(readGroundPatch(latticePatchRead(warmGround), 0, 0, TILE) as HeightPatch, 0, 0, TILE)
  }

  /** A piece not handed in this update goes (`update`; a callback made once, so the walk makes no entry per piece). */
  private readonly removeUnseen = (link: Link, b: PieceBody): void => {
    if (link.seen !== this.updates) this.remove(b)
  }

  remove(b: PieceBody, wakeNeighbours = true): void {
    const link = this.links.get(b)
    if (!link) return
    const held = this.hung.get(b)
    if (held) this.letGo(b, held)
    this.world.removeBody(link.id)
    // an awake piece shares its island with what rests on it, so only a sleeping one leaves sleepers behind: asleep for the kit now, or asleep when the engine last
    // stepped and woken (a blow, its support looked at again) in this same frame, before the engine could wake what lay on it (CLAUDE.md §12)
    if (wakeNeighbours && (b.sleeping || link.sleeping)) this.wakeAround(b, link.pos)
    this.byUser.delete(link.user)
    this.byBody.delete(link.id)
    this.bodyIds.delete(link.id)
    this.passing.delete(b)
    this.active.delete(b)
    if (this.byObject.get(b.objectId) === b) this.byObject.delete(b.objectId)
    this.links.delete(b)
  }

  /** What lay on a piece that went is awake again (a sleeping body holds no contact with what is no longer there). */
  private wakeAround(b: PieceBody, at: readonly number[]): void {
    const boxes: readonly PartBox[] = b.partBoxes && b.partBoxes.length > 0 ? b.partBoxes : [{ center: [0, 0, 0], half: b.halfExtents }]
    let reach = 0
    for (const box of boxes) reach = Math.max(reach, Math.hypot(...box.center) + Math.hypot(...box.half))
    reach += WAKE_MARGIN
    this.world.wakeInBox([at[0]! - reach, at[1]! - reach, at[2]! - reach], [at[0]! + reach, at[1]! + reach, at[2]! + reach])
  }

  clear(): void {
    for (const b of [...this.links.keys()]) this.remove(b, false)
    for (const t of this.tiles.values()) {
      this.world.removeBody(t.ground)
      if (t.steps !== null) this.world.removeBody(t.steps)
      if (t.solid !== null) this.world.removeBody(t.solid)
    }
    this.tiles.clear()
    this.follow.clear()
    this.schedule?.clear()
    this.blastAgain.clear()
    this.blasts.length = 0
    this.statics.clear()
    this.ignored.clear()
  }

  /** Everything cleared and the ground worker stopped (`EnginePieceOptions.groundWorker`). */
  dispose(): void {
    this.clear()
    this.schedule?.dispose()
  }

  /** A blast at (x, z): the tiles within `radius` of it that are not laid, or are marked, are laid at the start of the next `prepare`, after the ground the blast changed has been told. */
  layAhead(x: number, z: number, radius: number): void {
    if ((this.o.blastTiles ?? BLAST_TILES) <= 0) return
    this.blasts.push({ x, z, radius: Math.min(radius, BLAST_REACH) })
  }

  /**
   * The ground under the disc changed (the host dug or heaped it): its tiles are laid again before the next step, and what the new ground reaches into is lifted
   * onto it once, as one made in the ground is (`underGround`): the engine pushes a deep one out too slowly and puts it to sleep half way.
   */
  groundChanged(x: number, z: number, radius: number): void {
    this.markDirty(x, z, radius)
    for (const [b, link] of this.links) {
      if (b.held) continue
      const c = this.centre(b)
      if (Math.hypot(c.x - x, c.z - z) > radius + Math.hypot(...b.halfExtents)) continue
      // lifted, a 1 t pole whose wire tip meets settling rubble would gain its weight times the rise from nowhere
      const under = this.underGround(b)
      if (under <= 0) continue
      if (under <= ENGINE_CLEARS) {
        // a rise the engine clears by itself, but only an awake body is cleared: one asleep with its centre out of the disc stayed 8 mm in the ground for good
        if (b.sleeping) {
          b.sleeping = false
          b.still = 0
          b.calmAt = null
        }
        continue
      }
      b.root.position.y += under
      b.root.updateMatrixWorld(true)
      link.groundAtSleep = NaN
    }
  }

  /** The tiles the blasts told since the last update reach, nearest first up to `blastTiles`: made if new, laid again if marked. */
  private layBlastGround(): void {
    this.askBlastAgain()
    if (this.blasts.length === 0) return
    const wanted = new Map<number, { key: number; ix: number; iz: number; distance: number }>()
    for (const { x, z, radius } of this.blasts) {
      for (let ix = Math.floor((x - radius) / TILE); ix <= Math.floor((x + radius) / TILE); ix++) {
        for (let iz = Math.floor((z - radius) / TILE); iz <= Math.floor((z + radius) / TILE); iz++) {
          const key = (ix + TILE_KEY_ORIGIN) * TILE_KEY + (iz + TILE_KEY_ORIGIN)
          const tile = this.tiles.get(key)
          if (tile && tile.dirty === null) continue
          const distance = Math.hypot(Math.max(ix * TILE, Math.min(x, (ix + 1) * TILE)) - x, Math.max(iz * TILE, Math.min(z, (iz + 1) * TILE)) - z)
          if (distance > radius) continue
          const before = wanted.get(key)
          if (!before || distance < before.distance) wanted.set(key, { key, ix, iz, distance })
        }
      }
    }
    this.blasts.length = 0
    const nearest = [...wanted.values()].sort((a, b) => a.distance - b.distance || a.key - b.key)
    const visit = this.schedule ? this.askBlastAt : this.layAt
    for (const t of nearest.slice(0, this.o.blastTiles ?? BLAST_TILES)) visit(t.key, t.ix, t.iz)
  }

  /** Under the ground worker, a blast's tile already being made (from the ground before the blast) is asked for again once it is applied (`askBlastAgain`). */
  private readonly askBlastAt: TileVisit = (key, ix, iz) => {
    if ((this.schedule as GroundSchedule).pending.has(key)) this.blastAgain.add(key)
    else this.askAt(key, ix, iz)
  }

  /** The blast tiles that were being made when their blast came, asked for again now that they are applied (if their ground changed since). */
  private askBlastAgain(): void {
    const schedule = this.schedule
    if (!schedule || this.blastAgain.size === 0) return
    for (const key of this.blastAgain) {
      if (schedule.pending.has(key)) continue
      this.blastAgain.delete(key)
      this.askAt(key, Math.floor(key / TILE_KEY) - TILE_KEY_ORIGIN, (key % TILE_KEY) - TILE_KEY_ORIGIN)
    }
  }

  /**
   * The tiles the disc touches are laid again before the next step, reading the ground again where the disc is (and `GROUND_REACH` past it); and those within `SOLID_RING`
   * of it, whose solid reads the ground that far past their edges (`engine-ground-ring`): a neighbour's dig makes it again when it changed a sample it read.
   */
  private markDirty(x: number, z: number, radius: number): void {
    for (const [key, tile] of this.tiles) tile.dirty = this.markOf(key, tile.dirty, x, z, radius)
    // a fresh tile being made has no record yet: its mark waits on the schedule and goes onto the tile when applied
    if (this.schedule) for (const [key, p] of this.schedule.pending) if (p.fresh) p.dirty = this.markOf(key, p.dirty, x, z, radius)
  }

  /** The tile's mark widened by the change at (x, z) when it reaches the tile or its ring, else as it was. */
  private markOf(key: number, before: GroundRect | null, x: number, z: number, radius: number): GroundRect | null {
    const reach = radius + GROUND_REACH
    const ix = Math.floor(key / TILE_KEY) - TILE_KEY_ORIGIN
    const iz = (key % TILE_KEY) - TILE_KEY_ORIGIN
    const nx = Math.max(ix * TILE, Math.min(x, (ix + 1) * TILE))
    const nz = Math.max(iz * TILE, Math.min(z, (iz + 1) * TILE))
    if (Math.hypot(nx - x, nz - z) > radius + SOLID_RING) return before
    return {
      minX: Math.min(before?.minX ?? Infinity, x - reach),
      maxX: Math.max(before?.maxX ?? -Infinity, x + reach),
      minZ: Math.min(before?.minZ ?? Infinity, z - reach),
      maxZ: Math.max(before?.maxZ ?? -Infinity, z + reach),
    }
  }

  /**
   * Before the frame's fixed steps: the pairs in `apart` (by object id, `a\0b`) do not meet in the engine; the kit puts them apart along the ground. `dt` is the frame's
   * time, `h` the fixed step a kinematic target is reached in.
   */
  prepare(list: readonly PieceBody[], dt: number, h: number, apart: ReadonlySet<string>, awake?: AwakeList): void {
    // nothing here is made anew per piece per update (the collector's pauses were the worst frames: gate 0 B5)
    const n = ++this.updates
    // handed the awake pieces only, the walks are over them and a piece goes by `remove`, not by being left out of the list
    const each: Each = awake ? awake.walk.bind(awake) : (visit) => list.forEach(visit)
    each((b) => {
      const link = this.links.get(b)
      if (link) link.seen = n
    })
    if (!awake) this.links.forEach(this.removeUnseen)
    this.groundTurn(list)
    // the fixed things first: a piece made or put this update is checked against them (`outOfStatics`)
    this.layStatics()
    // the tiles asked for `frames` updates ago, before anything asks again: at this update whatever the worker did
    this.applyDueGround()
    this.layBlastGround()
    this.follow.update(dt, n)
    this.makeBodies(each)
    each((b) => this.hang(b))
    each((b) => this.sync(b, dt, h))
    this.meetStaticsAgain()
    if (this.schedule) this.layGroundLater(each, dt)
    else this.layGround(each, dt)
    this.keepApart(apart)
    each((b) => {
      const link = this.links.get(b)
      if (!link) return
      link.stepped = !b.held && !b.sleeping && !link.frozen
      if (!link.stepped) return
      const c = this.centre(b)
      link.before[0] = c.x
      link.before[1] = c.y
      link.before[2] = c.z
      link.beforeVy = b.velocity[1]
    })
  }

  /** Before each fixed step after the first of a frame: a held piece's target again, so it moves by `h`, not by the frame's `dt`. */
  moveHeld(list: readonly PieceBody[], h: number, awake?: AwakeList): void {
    const each: Each = awake ? awake.walk.bind(awake) : (visit) => list.forEach(visit)
    each((b) => {
      const link = this.links.get(b)
      if (!link || !b.held) return
      const c = this.centre(b)
      const q = b.root.quaternion
      this.world.moveKinematic(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], h)
    })
  }

  /** After the frame's fixed steps: each piece read back with the kit's rules on it, then the knock sounds from the frame's contact rows. */
  finish(list: readonly PieceBody[], dt: number, time: number, awake?: AwakeList): void {
    if (awake) {
      this.readActive(awake)
      awake.walk((b) => this.readBack(b, dt, time, this.active))
    } else for (const b of list) this.readBack(b, dt, time, null)
    this.wearHinges(dt)
    this.knock(time)
  }

  /** A piece with a hinge asked for (`PieceSystem.hinge`) gets a fixed anchor at the screw and a hinge joint to it, once its body exists. It swings in the vertical plane through the screw and its centre. */
  private hang(b: PieceBody): void {
    const hinge = b.hinge
    const link = this.links.get(b)
    if (!hinge || !link || this.hung.has(b)) return
    const c = this.centre(b)
    const dx = c.x - hinge.point[0]
    const dz = c.z - hinge.point[2]
    const along = Math.hypot(dx, dz)
    const axis: Vec3 = along < 1e-3 ? [0, 0, 1] : [dz / along, 0, -dx / along]
    const anchor = this.world.createBody({ shape: { kind: 'box', half: [0.005, 0.005, 0.005] }, motion: 'static', position: hinge.point, user: 0 })
    this.world.ignorePair(anchor, link.id, true)
    const joint = this.world.createJoint({ kind: 'hinge', a: anchor, b: link.id, point: hinge.point, axis, normal: [0, 1, 0], min: -Math.PI / 2, max: Math.PI / 2 })
    this.hung.set(b, { anchor, joint })
  }

  /** The screw tears out: past `HINGE_RELEASE` of turn, or after `HINGE_SECONDS`, the piece falls free. */
  private wearHinges(dt: number): void {
    for (const [b, held] of this.hung) {
      const hinge = b.hinge
      if (hinge) {
        hinge.seconds -= dt
        const [x, y, z, w] = hinge.from
        const q = b.root.quaternion
        const turned = 2 * Math.acos(Math.min(1, Math.abs(q.x * x + q.y * y + q.z * z + q.w * w)))
        if (turned < HINGE_RELEASE && hinge.seconds > 0) continue
      }
      this.letGo(b, held)
    }
  }

  private letGo(b: PieceBody, held: { readonly anchor: BodyId; readonly joint: JointId }): void {
    this.world.removeJoint(held.joint)
    this.world.removeBody(held.anchor)
    this.hung.delete(b)
    b.hinge = undefined
  }

  /** The engine's awake bodies in one crossing: a sleeping piece one of them wakes (a blow) is among the awake pieces from now on, and read back in this same step. */
  private readActive(awake: AwakeList): void {
    this.active.clear()
    const n = this.world.readActiveBodies(this.activeIds)
    for (let i = 0; i < n; i++) {
      const b = this.byBody.get(this.activeIds[i] as BodyId)
      if (!b) continue
      this.active.add(b)
      awake.enter(b)
    }
  }

  /** The host moved the piece's root or changed what its shape is made from since `sync` last looked: its body is not up to date. */
  private isPending(b: PieceBody, link: Link): boolean {
    if (!this.sameFrom(b, link.shapeFrom)) return true
    const c = this.centre(b)
    const q = b.root.quaternion
    return far(c.x, link.pos[0]) || far(c.y, link.pos[1]) || far(c.z, link.pos[2]) || far(q.x, link.quat[0]) || far(q.y, link.quat[1]) || far(q.z, link.quat[2]) || far(q.w, link.quat[3])
  }

  /** Before the measure: a settled piece the host moved or reshaped by hand is among the awake ones again, so its `sync` runs as it did when every piece was synced. */
  wakePending(list: readonly PieceBody[], awake: AwakeList): void {
    for (const b of list) {
      if (awake.has(b)) continue
      const link = this.links.get(b)
      if (link && this.isPending(b, link)) awake.enter(b)
    }
  }

  /** Asleep on both sides (as `finish` last read the engine's) and not waiting for its ground: nothing of it is read or written until it wakes. */
  isSettled(b: PieceBody): boolean {
    const link = this.links.get(b)
    if (!link || !b.sleeping || b.held || !link.sleeping || link.frozen || this.active.has(b) || this.isPending(b, link)) return false
    // the grip a propped piece lost is back before it sleeps unread: waking it (a blow) steps it with its own friction, as when its sync ran each update
    this.slip(b, link, false)
    link.stepped = false
    b.still = 0
    return true
  }

  /**
   * A few sleeping pieces each update (`GROUND_CHECKS`, in turn) look at the ground under them again: dug or slid away since they slept (and nobody called
   * `wakeRegion`), they wake and the ground there is laid again. Their other supports are the engine's: it wakes what lay on a body that moves.
   */
  private groundTurn(list: readonly PieceBody[]): void {
    const n = list.length
    for (let k = 0; k < Math.min(GROUND_CHECKS, n); k++) {
      this.turn = (this.turn + 1) % n
      const b = list[this.turn]
      const link = this.links.get(b)
      if (!link || !b.sleeping || b.held || Number.isNaN(link.groundAtSleep)) continue
      const c = this.centre(b)
      if (Math.abs(this.o.groundAt(c.x, c.z) - link.groundAtSleep) <= GROUND_DROP) continue
      b.sleeping = false
      b.still = 0
      this.groundChanged(c.x, c.z, Math.hypot(...b.halfExtents))
    }
  }

  /** A round piece whose radius changes along its axis (a bottle, a cup): its shape is not the straight cylinder at its widest, or it would roll straight. */
  private isTapered(round: PieceRound): boolean {
    const radii = round.profile?.map(([, radius]) => radius) ?? []
    return radii.length > 1 && Math.max(...radii) - Math.min(...radii) > TAPER_MIN
  }

  /** The hull of the rings of its profile (`PieceRound.profile`), in the piece's frame: a cone, or a bottle, rolls round its narrow end. */
  private ringPoints(round: PieceRound): number[] {
    const points: number[] = []
    const across = [0, 1, 2].filter((axis) => axis !== round.axis)
    for (const [at, radius] of round.profile ?? []) {
      for (let k = 0; k < RING_SEGMENTS; k++) {
        const angle = (2 * Math.PI * k) / RING_SEGMENTS
        const point = [0, 0, 0]
        point[round.axis] = at
        point[across[0]!] = Math.cos(angle) * radius
        point[across[1]!] = Math.sin(angle) * radius
        points.push(point[0]!, point[1]!, point[2]!)
      }
    }
    return points
  }

  private shapeOf(b: PieceBody): ShapeDesc {
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return { kind: 'sphere', radius: round.radius }
      if (this.isTapered(round)) return { kind: 'compound', children: [{ shape: { kind: 'convex', points: this.ringPoints(round) }, position: [0, 0, 0] }] }
      // a cylinder stands along its own y: turned onto x or z
      const rotation: Quat = round.axis === 0 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : round.axis === 2 ? [Math.SQRT1_2, 0, 0, Math.SQRT1_2] : [0, 0, 0, 1]
      return { kind: 'compound', children: [{ shape: { kind: 'cylinder', halfHeight: b.halfExtents[round.axis], radius: round.radius }, position: [0, 0, 0], rotation }] }
    }
    if (b.partBoxes && b.partBoxes.length > 0) {
      return { kind: 'compound', children: mergeFlushBoxes(b.partBoxes).map((part, i) => ({ shape: part.hull ? { kind: 'convex', points: [...part.hull] } : part.round ? { kind: 'cylinder', halfHeight: part.half[1], radius: (part.half[0] + part.half[2]) / 2 } : { kind: 'box', half: part.half }, position: part.center, ...(part.rotation ? { rotation: part.rotation } : {}), tag: i })) }
    }
    return { kind: 'box', half: b.halfExtents }
  }

  /**
   * How far (m) a new piece reaches under the ground: its part boxes' corners (a round piece: the lowest points of its rim) below `groundAt`. The ground is a surface
   * to the engine, and a piece made through it is caught by its sides and pushed down, not out; so it is lifted out once, when its body is made, never later.
   */
  private underGround(b: PieceBody): number {
    // from the root's own position and turn: its world matrix may not be up to date yet when the piece is new
    const c = this.centre(b)
    const cx = c.x, cy = c.y, cz = c.z
    const q = b.root.quaternion
    const p = this.u
    let under = 0
    const at = (x: number, y: number, z: number, below = 0): void => {
      p.set(x, y, z).applyQuaternion(q)
      under = Math.max(under, this.o.groundAt(cx + p.x, cz + p.z) - (cy + p.y - below))
    }
    const round = b.round
    if (round) {
      const axis: Vec3 = [round.axis === 0 ? 1 : 0, round.axis === 1 ? 1 : 0, round.axis === 2 ? 1 : 0]
      const tilt = p.set(axis[0], axis[1], axis[2]).applyQuaternion(q).y
      const reach = round.kind === 'sphere' ? round.radius : round.radius * Math.sqrt(Math.max(0, 1 - tilt * tilt))
      const h = round.kind === 'sphere' ? 0 : b.halfExtents[round.axis]
      for (const s of [-1, 1]) at(axis[0] * h * s, axis[1] * h * s, axis[2] * h * s, reach)
      return this.liftFor(b, under)
    }
    // the part boxes sit about the centre of mass, as the body's compound does
    const boxes: readonly PartBox[] = b.partBoxes && b.partBoxes.length > 0 ? b.partBoxes : [{ center: [0, 0, 0], half: b.halfExtents }]
    const corner = this.w
    for (const box of boxes) {
      const r = box.rotation
      for (let k = 0; k < 8; k++) {
        corner.set((k & 1 ? 1 : -1) * box.half[0], (k & 2 ? 1 : -1) * box.half[1], (k & 4 ? 1 : -1) * box.half[2])
        if (r) corner.applyQuaternion(this.turn3.set(r[0], r[1], r[2], r[3]))
        at(box.center[0] + corner.x, box.center[1] + corner.y, box.center[2] + corner.z)
      }
    }
    return this.liftFor(b, under)
  }

  /**
   * Made through the ground by more than a contact's sink and less than its own size: lifted onto it. Deeper than its largest half size it is not lying in the
   * ground but under something `groundAt` folds into it (a box on the floor half under a table top), and it is left where it is.
   */
  private liftFor(b: PieceBody, under: number): number {
    return under > SINK && under <= Math.max(...b.halfExtents) ? under + LIFT_MARGIN : 0
  }

  /** A round piece turns about its axis by its own k (a full can, an empty one); about the others, and for a box, the engine's from the shape. */
  private inertiaOf(b: PieceBody): Vec3 | undefined {
    const round = b.round
    if (!round) return undefined
    const [hx, hy, hz] = b.halfExtents
    const m = b.mass
    const out: [number, number, number] = [(m * (hy * hy + hz * hz)) / 3, (m * (hx * hx + hz * hz)) / 3, (m * (hx * hx + hy * hy)) / 3]
    const about = round.inertia * m * round.radius * round.radius
    if (round.kind === 'sphere') return [about, about, about]
    out[round.axis] = about
    return out
  }

  /** A round piece rolls to a stop by its surface's rolling resistance (the adapter's rule; the engine has none). */
  private rollingOf(b: PieceBody): Rolling | undefined {
    return b.round ? { coefficient: b.friction?.rolling ?? ROLLING_RESISTANCE, radius: b.round.radius, damping: b.friction?.rollingDamping ?? PIECE_ROLLING_DAMPING } : undefined
  }

  private material(b: PieceBody): Material {
    return {
      frictionStatic: b.friction?.static ?? MU_STATIC,
      frictionDynamic: b.friction?.dynamic ?? MU_DYNAMIC,
      restitution: b.restitution ?? SLAM_BOUNCE,
      rolling: b.friction?.rolling ?? ROLLING_RESISTANCE,
    }
  }

  /** The bodies of the pieces that have none yet, made in one batch (one broadphase insert, ids in list order) and then each checked against the fixed things. */
  private makeBodies(each: Each): void {
    const fresh: PieceBody[] = []
    each((b) => {
      if (!this.links.has(b)) fresh.push(b)
    })
    if (fresh.length === 0) return
    const users: number[] = []
    const descs = fresh.map((b) => {
      const under = this.underGround(b)
      if (under > 0) {
        b.root.position.y += under
        b.root.updateMatrixWorld(true)
      }
      const user = this.nextUser++
      users.push(user)
      return this.bodyDesc(b, user)
    })
    const ids = this.world.createBodies(descs)
    fresh.forEach((b, i) => {
      const c = this.centre(b)
      const q = b.root.quaternion
      const user = users[i] as number
      const id = ids[i] as BodyId
      const link: Link = {
        id, groundAtSleep: NaN, user, shapeKey: this.shapeKey(b), shapeFrom: this.shapeFrom(b), pos: [c.x, c.y, c.z], quat: [q.x, q.y, q.z, q.w], vel: [...b.velocity], ang: [...b.angularVelocity],
        held: b.held, sleeping: b.sleeping, seen: this.updates, frozen: false, before: [0, 0, 0], beforeVy: 0, stepped: false, side: [1, 1], isSlipping: false,
      }
      this.links.set(b, link)
      if (b.held) this.passThroughHolder(id, true)
      this.byUser.set(user, b)
      this.byBody.set(id, b)
      this.bodyIds.add(id)
      this.byObject.set(b.objectId, b)
      if (b.debris) this.throughStatics(b, link)
      else this.outOfStatics(b, link)
    })
  }

  private bodyDesc(b: PieceBody, user: number): BodyDesc {
    const c = this.centre(b)
    const q = b.root.quaternion
    const shape = this.shapeOf(b)
    return {
      shape,
      motion: b.held ? 'kinematic' : 'dynamic',
      position: [c.x, c.y, c.z],
      rotation: [q.x, q.y, q.z, q.w],
      mass: b.mass,
      inertia: this.inertiaOf(b),
      centreAtOrigin: true,
      keepPartContacts: shape.kind === 'compound' && shape.children.length > 1,
      material: this.material(b),
      layer: b.debris ? 'rubble' : 'debris',
      // no air drag: the kit's pieces never had any (a round piece's rolling resistance is the adapter's, `rolling`)
      angularDamping: 0,
      linearDamping: 0,
      // swept (Jolt's linear cast) so nothing the engine has is passed through, now that the kit's sweep no longer sets a piece back from it (`sweepOn`); the
      // engine casts only a body that moves more than most of its own thickness in a step, so one at rest costs nothing more
      continuous: true,
      rolling: this.rollingOf(b),
      sleeping: b.sleeping,
      user,
      linearVelocity: [b.velocity[0], b.velocity[1], b.velocity[2]],
      angularVelocity: [b.angularVelocity[0], b.angularVelocity[1], b.angularVelocity[2]],
    }
  }

  private passThroughHolder(id: BodyId, ignore: boolean): void {
    const holder = this.o.heldIgnores?.()
    if (holder !== undefined) this.world.ignorePair(id, holder, ignore)
  }

  /** Brings the body of a piece up to date with what changed on the piece since the last step (moved, pushed, picked up, put to sleep). */
  private sync(b: PieceBody, dt: number, h: number): void {
    const c = this.centre(b)
    const q = b.root.quaternion
    const link = this.links.get(b)
    if (!link) return
    // by value: the renderer hands new arrays for the same boxes when it measures a piece again, and a new shape wakes the body; the same objects as last time
    // are the same shape, and are not turned into text again (it was a sixth of an update with 200 pieces)
    if (!this.sameFrom(b, link.shapeFrom)) this.reshape(b, link)
    if (b.held !== link.held) {
      link.held = b.held
      this.world.setMotion(link.id, b.held ? 'kinematic' : 'dynamic')
      this.passThroughHolder(link.id, b.held)
    }
    if (b.held) {
      this.world.moveKinematic(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], h)
      return
    }
    // the centre comes back through the root (position minus the turned centre, then plus it again): equal within rounding is not moved
    const moved = far(c.x, link.pos[0]) || far(c.y, link.pos[1]) || far(c.z, link.pos[2]) || far(q.x, link.quat[0]) || far(q.y, link.quat[1]) || far(q.z, link.quat[2]) || far(q.w, link.quat[3])
    if (moved) this.world.setPose(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], !b.sleeping)
    if (moved && b.sleeping) {
      // nothing reads it back while it sleeps: where it was put is where it is, or it would look moved on every update
      link.pos[0] = c.x
      link.pos[1] = c.y
      link.pos[2] = c.z
      link.quat[0] = q.x
      link.quat[1] = q.y
      link.quat[2] = q.z
      link.quat[3] = q.w
    }
    if (link.frozen) return this.keepFrozen(b, link, moved)
    // `tip` is the kit solver's push for a piece whose feet are thinner than its box; here the engine stands it on its parts as drawn, so it goes over by itself
    b.tipping = null
    if (!b.round && b.onGround && !b.sleeping) this.topple(b, dt)
    else this.slip(b, link, false)
    const v = b.velocity
    const w = b.angularVelocity
    const pushed = v[0] !== link.vel[0] || v[1] !== link.vel[1] || v[2] !== link.vel[2] || w[0] !== link.ang[0] || w[1] !== link.ang[1] || w[2] !== link.ang[2]
    if (pushed) this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    if (b.sleeping && !link.sleeping) this.world.sleep(link.id)
    else if (!b.sleeping && link.sleeping) {
      // woken from outside (its support looked at again, a blow): the ground under it may have been dug while it slept
      this.world.wake(link.id)
      this.markDirty(c.x, c.z, Math.hypot(...b.halfExtents))
    } else if (pushed) this.world.wake(link.id)
  }

  /**
   * A piece made or put by the kit or the host (not moved by the engine) inside a fixed thing goes out of it at once, the shortest way, as one made in the ground is
   * lifted (`underGround`). Left to the engine it is pushed out a little each step (`maxPushOut`), which reads as the piece rising by itself: a roof sheet made 1 m
   * into a shelf rose 0.83-0.94 m over the room's 11 s. Only past a contact's sink (`SINK`): resting on a shelf it is not moved.
   */
  /**
   * A piece of debris made inside something (the bars of a cage that gave way, inside the wall that still stands; a chunk overlapping the part next to the one that broke,
   * or the chunk cut beside it) is not moved out of it as a piece is (`outOfStatics`), and the engine does not push the two apart: debris is born
   * where the thing broke. It passes through what it was made inside until it is out of it, and only through that.
   */
  private throughStatics(b: PieceBody, link: Link): void {
    const q = b.root.quaternion
    const c = this.centre(b)
    const found = this.overlapped
    this.world.overlapShape(this.shapeOf(b), [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], found, BORN_INSIDE)
    for (const id of found) {
      if (id === link.id || link.through?.includes(id) || !(this.statics.ids.has(id) || this.bodyIds.has(id))) continue
      this.world.ignorePair(link.id, id, true)
      ;(link.through ??= []).push(id)
    }
    if (link.through?.length) this.passing.add(b)
  }

  /** The debris passing through what it was made inside meets it again once it is out of it; what was made again meanwhile (a fixed thing's body is a new one) is looked at afresh. */
  private meetStaticsAgain(): void {
    if (this.passing.size === 0 || !this.world.penetration) return
    const one = this.oneStatic
    for (const b of this.passing) {
      const link = this.links.get(b)
      const through = link?.through
      if (!link || !through) {
        this.passing.delete(b)
        continue
      }
      let remade = false
      for (let i = through.length - 1; i >= 0; i--) {
        const id = through[i] as BodyId
        if (!this.statics.ids.has(id) && !this.bodyIds.has(id)) {
          remade = true
          through.splice(i, 1)
          continue
        }
        one.clear()
        one.add(id)
        if (this.world.penetration(link.id, this.outAxis, one) > SINK) continue
        this.world.ignorePair(link.id, id, false)
        through.splice(i, 1)
      }
      if (remade) this.throughStatics(b, link)
      if (through.length === 0) this.passing.delete(b)
    }
  }

  private outOfStatics(b: PieceBody, link: Link): void {
    if (!this.world.penetration) return
    const axis = this.outAxis
    let px = 0, py = 0, pz = 0
    let wedged = false
    let lifts = 0
    // what the piece was made inside, how deep it was where it turned out to be wedged, and how far the tries moved it in all: a way out that is no better is put back (`putBack`)
    let found = 0
    let wedge = 0
    let previous = 0
    const moved = [0, 0, 0]
    for (let i = 0; i < OUT_TRIES; i++) {
      // the host's fixed things only: a piece made in the ground is the ground's rule (`underGround`; out of a step the shortest way too, the bowl's seed 39 made 3 mm)
      const depth = this.world.penetration(link.id, axis, this.statics.ids)
      if (depth <= SINK) return
      if (i === 0) found = depth
      // out of one the shortest way put it back into the other (a door made between its frame and a car parked against the wall), or no shallower for it (a door whose jamb it overlaps the same at any height rode up 0.4 m): it goes up out of both
      wedged ||= i > 0 && (axis[0] * px + axis[1] * py + axis[2] * pz < -0.5 || depth > previous * NO_PROGRESS)
      previous = depth
      px = axis[0]
      py = axis[1]
      pz = axis[2]
      if (wedged) {
        axis[0] = 0
        axis[1] = 1
        axis[2] = 0
      }
      // up out of a wedge, the depth across tells nothing of how high the two reach: a step that doubles each try, at most twice as high as it had to go
      const d = wedged ? depth + WEDGE_LIFT * 2 ** lifts++ : depth + LIFT_MARGIN
      this.world.readPose(link.id, this.pose, 0)
      // a lift that goes through a third fixed thing on its way (a door made in its doorway, lifted past the lintel, the ceiling slab and into the attic) is no exit
      if (wedged && wedge === 0) wedge = depth + SINK
      if (wedged && !this.isWayClear(b, link, d, wedge)) {
        this.putBack(b, link, moved)
        return
      }
      this.moveBy(b, link, axis, d, moved)
    }
    if (this.world.penetration(link.id, axis, this.statics.ids) > found) this.putBack(b, link, moved)
  }

  /** The piece is moved by `d` along `axis`, in the engine and on its root (`this.pose` is where it stands); `moved` adds it up. */
  private moveBy(b: PieceBody, link: Link, axis: Float64Array, d: number, moved: number[]): void {
    const p = this.pose
    p[0] += axis[0] * d
    p[1] += axis[1] * d
    p[2] += axis[2] * d
    this.world.setPose(link.id, [p[0], p[1], p[2]], [p[3], p[4], p[5], p[6]], !b.sleeping)
    for (let k = 0; k < 3; k++) moved[k] += axis[k] * d
    b.root.position.x += axis[0] * d
    b.root.position.y += axis[1] * d
    b.root.position.z += axis[2] * d
    b.root.updateMatrixWorld(true)
    link.pos[0] = p[0]
    link.pos[1] = p[1]
    link.pos[2] = p[2]
  }

  /** Back to where the piece was made: the tries moved it by `moved`, and the engine is left to push it out of what it is in (a little each step). */
  private putBack(b: PieceBody, link: Link, moved: number[]): void {
    const back = this.wayAxis
    back[0] = -moved[0]
    back[1] = -moved[1]
    back[2] = -moved[2]
    this.world.readPose(link.id, this.pose, 0)
    this.moveBy(b, link, back, 1, moved)
  }

  /** Whether going up by `d` from `this.pose` meets no fixed thing deeper than `limit` (m): sampled about every thinnest half of the piece, which leaves the body where it was. */
  private isWayClear(b: PieceBody, link: Link, d: number, limit: number): boolean {
    const p = this.pose
    const up = this.outAxis
    const step = Math.min(WAY_STEP_MAX, Math.max(WAY_STEP_MIN, Math.min(...b.halfExtents)))
    let isClear = true
    for (let s = step; s < d && isClear; s += step) {
      this.world.setPose(link.id, [p[0] + up[0] * s, p[1] + up[1] * s, p[2] + up[2] * s], [p[3], p[4], p[5], p[6]], false)
      isClear = (this.world.penetration?.(link.id, this.wayAxis, this.statics.ids) ?? 0) <= limit
    }
    this.world.setPose(link.id, [p[0], p[1], p[2]], [p[3], p[4], p[5], p[6]], false)
    return isClear
  }

  /**
   * Its shape, mass, friction or bounce changed (by value: the renderer hands new arrays for the same boxes when it measures a piece again, and a new shape wakes the
   * body; the same objects as last time are the same shape, and are not turned into text again: it was a sixth of an update with 200 pieces).
   */
  private reshape(b: PieceBody, link: Link): void {
    const from = this.shapeFrom(b)
    link.shapeFrom = from
    const shapeKey = this.shapeKey(b)
    if (!shapeKey.some((x, i) => x !== link.shapeKey[i])) return
    link.shapeKey = shapeKey
    // the piece's mass and moments go with its new shape: left to the engine, they would be the new shape's volume at 1000 kg/m^3
    const inertia = this.inertiaOf(b)
    this.world.setShape(link.id, this.shapeOf(b), inertia ? { mass: b.mass, inertia } : { mass: b.mass })
    this.world.setMaterial(link.id, this.material(b))
    this.world.setRolling(link.id, this.rollingOf(b))
  }

  /** Whether the objects its shape is made from are the ones it was made from (by reference, as `shapeFrom` lists them). */
  private sameFrom(b: PieceBody, from: readonly unknown[]): boolean {
    return (
      from[0] === b.halfExtents && from[1] === b.partBoxes && from[2] === b.round && from[3] === b.mass && from[4] === b.localCenter[0] && from[5] === b.localCenter[1] &&
      from[6] === b.localCenter[2] && from[7] === b.friction && from[8] === b.restitution
    )
  }

  private shapeFrom(b: PieceBody): unknown[] {
    return [b.halfExtents, b.partBoxes, b.round, b.mass, b.localCenter[0], b.localCenter[1], b.localCenter[2], b.friction, b.restitution]
  }

  private shapeKey(b: PieceBody): unknown[] {
    return [JSON.stringify(b.halfExtents), JSON.stringify(b.partBoxes), JSON.stringify(b.round), b.mass, b.localCenter[0], b.localCenter[1], b.localCenter[2], JSON.stringify(b.friction), b.restitution]
  }

  /**
   * The kit's balancing rule (§12: what stands on less than its centre of mass needs goes over): the points the engine has it touching by are its support; narrower than `NARROW` of the height of the centre of mass above them, or not under it, the piece gets the kit's push toward the side
   * it leans to. The engine alone keeps a door balanced on its 4 cm edge for ever.
   */
  /**
   * The push (rad/s2) that turns a piece about the edge of its support at `edge` (m from its centre, `height` m above it): the kit's `TOPPLE`, and on a support narrow both ways (a leg, a pole: a plate on its
   * edge is narrow one way only) at least what beats gravity's hold (at most `g |edge| / (height^2 + edge^2)` for any shape: a 5 cm leg 74 cm tall held against `TOPPLE` alone and stood for ever). Not where only
   * the contacts of one instant sit off its centre: a box rocking on a table's edge reads like that, and stays. `turning` is the piece's own inertia about that edge's
   * axis (`turningOf`): the strong push is bounded by it (`holdPush`).
   */
  private topplePush(edge: number, height: number, isNarrow: boolean, turning: number): number {
    const push = TOPPLE * Math.min(height, 1)
    return isNarrow ? Math.max(push, holdPush({ edge, height, gravity: this.o.gravity, turning })) : push
  }

  /**
   * The moment of inertia of the piece per kilogram (m²) about the world axis `axis` (0 x, 2 z) through its centre of mass, as the box it is: what resists its turning
   * about the edge it would go over (`holdPush`).
   */
  private turningOf(b: PieceBody, axis: 0 | 2): number {
    const [hx, hy, hz] = b.halfExtents
    const { x, y, z, w } = b.root.quaternion
    // the world axis in the piece's own frame: that row of its rotation
    const ax = axis === 0 ? 1 - 2 * (y * y + z * z) : 2 * (x * z - y * w)
    const ay = axis === 0 ? 2 * (x * y - z * w) : 2 * (y * z + x * w)
    const az = axis === 0 ? 2 * (x * z + y * w) : 1 - 2 * (x * x + y * y)
    return ((hy * hy + hz * hz) * ax * ax + (hx * hx + hz * hz) * ay * ay + (hx * hx + hy * hy) * az * az) / 3
  }

  private topple(b: PieceBody, dt: number): void {
    const link = this.links.get(b)
    if (!link) return
    // where the engine has it touching (the floor, a step, another piece), from its centre of mass
    const n = this.world.contactPoints(link.id, this.contactXYZ)
    if (n === 0) {
      this.slip(b, link, false)
      return
    }
    const q = b.root.quaternion
    const c = this.centre(b)
    // the weight is where the drawn parts put it, not in the middle of the box around them
    let shiftX = 0, shiftY = 0, shiftZ = 0
    if (b.massCentre) {
      this.w.set(b.massCentre[0], b.massCentre[1], b.massCentre[2]).applyQuaternion(q)
      shiftX = this.w.x; shiftY = this.w.y; shiftZ = this.w.z
      c.add(this.w)
    }
    let low = Infinity
    for (let i = 0; i < n; i++) low = Math.min(low, this.contactXYZ[i * 3 + 1] - c.y)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (let i = 0; i < n; i++) {
      const rx = this.contactXYZ[i * 3] - c.x
      const rz = this.contactXYZ[i * 3 + 2] - c.z
      x0 = Math.min(x0, rx); x1 = Math.max(x1, rx)
      z0 = Math.min(z0, rz); z1 = Math.max(z1, rz)
    }
    // a piece that never lost a part stands on its box, as the kit's solver holds it: when the engine has it on the floor of that box, the box's lowest corners are its
    // support, not only the feet it is drawn with (a pedestal basin's column, a bicycle's two wheels). One that lost a part stands on what is left of it (`apart`)
    if (!b.contacts && !b.round && !b.apart) {
      const [hx, hy, hz] = b.halfExtents
      const corner = this.w
      let lowest = Infinity
      for (let k = 0; k < 8; k++) lowest = Math.min(lowest, corner.set(k & 1 ? hx : -hx, k & 2 ? hy : -hy, k & 4 ? hz : -hz).applyQuaternion(q).y - shiftY)
      if (Math.abs(lowest - low) < BOX_FOOT) {
        for (let k = 0; k < 8; k++) {
          corner.set(k & 1 ? hx : -hx, k & 2 ? hy : -hy, k & 4 ? hz : -hz).applyQuaternion(q)
          if (corner.y - shiftY > lowest + BOX_FOOT) continue
          x0 = Math.min(x0, corner.x - shiftX); x1 = Math.max(x1, corner.x - shiftX)
          z0 = Math.min(z0, corner.z - shiftZ); z1 = Math.max(z1, corner.z - shiftZ)
        }
        low = Math.min(low, lowest)
      }
    }
    const height = -low
    const wx = x1 - x0
    const wz = z1 - z0
    const isNarrow = Math.min(wx, wz) < NARROW * height
    const isColumn = Math.max(wx, wz) < NARROW * height
    b.balancing = isNarrow || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0
    // held up at an angle by something (leant on a wall, on another piece): once it has kept its tilt for `STEADY_SECONDS` the push stops and it may sleep. The
    // tilt is timed whether or not this update's contact points read as balancing: they come and go between the engine's steps at rest, and a timer started
    // again on each flicker kept a leaning plate pushed, and awake, for good
    const was = b.steady
    if (!was || Math.abs(was.quaternion[0] * q.x + was.quaternion[1] * q.y + was.quaternion[2] * q.z + was.quaternion[3] * q.w) < Math.cos(STEADY_TURN / 2)) {
      b.steady = { quaternion: [q.x, q.y, q.z, q.w], seconds: 0 }
    } else was.seconds += dt
    const held = b.steady?.seconds ?? 0
    this.slip(b, link, isNarrow && held >= PROPPED_SECONDS)
    if (!b.balancing || held >= STEADY_SECONDS) return
    if (Math.abs(x0 + x1) > SIDE_DEAD) link.side[0] = x0 + x1 > 0 ? -1 : 1
    if (Math.abs(z0 + z1) > SIDE_DEAD) link.side[1] = z0 + z1 > 0 ? -1 : 1
    const [dirX, dirZ] = link.side
    const w = b.angularVelocity
    const v = b.velocity
    // turned about the edge of its support it goes over (about its centre of mass it would press that edge into the floor, and the contact would take it back):
    // the spin, and the speed of the centre of mass that goes with it about that edge. Only while the centre is still over the edge it turns about: once past it,
    // gravity takes it over; pushed on through the fall, a 3 kg sheet 5 m wide was driven down faster than it falls (4 cm of energy made in the room)
    if (wx <= wz) {
      const edge = dirX > 0 ? x1 : x0
      const dw = edge * dirX > 0 ? -dirX * this.topplePush(edge, height, isColumn && Math.abs(w[2]!) < PUSH_SPIN, this.turningOf(b, 2)) * dt : 0
      const rx = -edge
      const ry = -low
      w[2] += dw
      v[0] += -dw * ry
      v[1] += dw * rx
    } else {
      const edge = dirZ > 0 ? z1 : z0
      const dw = edge * dirZ > 0 ? dirZ * this.topplePush(edge, height, isColumn && Math.abs(w[0]!) < PUSH_SPIN, this.turningOf(b, 0)) * dt : 0
      const rz = -edge
      const ry = -low
      w[0] += dw
      v[1] += -dw * rz
      v[2] += dw * ry
    }
  }

  /** Propped pieces lose most of their friction until they move or sleep (the push only presses them into the prop: an energy-free way to end a wedge). */
  private slip(b: PieceBody, link: Link, isSlipping: boolean): void {
    if (link.isSlipping === isSlipping) return
    link.isSlipping = isSlipping
    const m = this.material(b)
    this.world.setMaterial(link.id, isSlipping ? { ...m, frictionStatic: m.frictionStatic * PROPPED_GRIP, frictionDynamic: m.frictionDynamic * PROPPED_GRIP } : m)
  }

  private centre(b: PieceBody): THREE_NS.Vector3 {
    return this.v.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  /**
   * Lays the tiles of ground under and around what is awake, and lays again those whose region changed (only if their ground did change). "Around" is the piece's own footprint
   * (its box as it stands now, seen from above) plus `TILE_MARGIN` and how far its tips swing in this update (up to `MAX_SWING`): a 45 m wire that fell lies on 23 tiles, not under the 625 of the
   * circle around it (a 480 ms update in the room).
   */
  private layGround(each: Each, dt: number): void {
    each((b) => {
      if (!b.sleeping) this.groundOf(b, dt, this.layAt)
    })
  }

  /** Hands `visit` the tiles an awake piece needs in this update, in scan order: under and around it, and along its path when it is fast. */
  private groundOf(b: PieceBody, dt: number, visit: TileVisit): void {
    const c = this.centre(b)
    const reach = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
    const swing = Math.hypot(b.angularVelocity[0] as number, b.angularVelocity[1] as number, b.angularVelocity[2] as number) * reach * Math.max(dt, 1 / 60)
    // a 45 m wire the blast spun to 47 rad/s swings 53 m a frame: the circle around it was 4290 tiles (2.4 s), and it is 4 m up; past a few metres the next update lays what it reached
    const margin = TILE_MARGIN + Math.min(swing, MAX_SWING)
    // a fast one (a blast's chip) moves further than the margin in an update, and would land on ground not laid yet: the tiles are laid along its path too, a tile apart
    const travel = Math.hypot(b.velocity[0] as number, b.velocity[1] as number, b.velocity[2] as number) * dt
    const stops = travel > TILE_MARGIN ? Math.min(MAX_PATH_STOPS, Math.ceil(travel / TILE)) : 0
    const x0 = c.x, y0 = c.y, z0 = c.z
    for (let stop = 0; stop <= stops; stop++) {
      const fraction = stops === 0 ? 0 : stop / stops
      const at = stop === 0 ? c : this.u.set(x0 + (b.velocity[0] as number) * dt * fraction, y0, z0 + (b.velocity[2] as number) * dt * fraction)
      this.beneath(b, at, margin, visit)
    }
  }

  /** A tile `groundOf` names is laid now (without the ground worker). */
  private readonly layAt: TileVisit = (key, ix, iz) => this.layTile(key, ix, iz, this.tiles.get(key))

  /** A tile `groundOf` names is asked of the schedule (`askTile`); `waits` when no ground is laid there yet. */
  private readonly askAt: TileVisit = (key, ix, iz) => {
    const tile = this.tiles.get(key)
    if (!(this.schedule as GroundSchedule).pending.has(key) && (!tile || tile.dirty !== null)) this.askTile(key, ix, iz, tile)
    if (!this.tiles.has(key)) this.waits = true
  }

  /**
   * Under the ground worker: the tiles each awake piece needs are asked for (`askTile`); a piece with a tile that has no ground yet waits held still (`hold`) until the update the
   * tile is applied at, then goes on (CLAUDE.md §12: never falling through ground that is not there). One whose tile is being made again stands on the old ground meanwhile.
   */
  private layGroundLater(each: Each, dt: number): void {
    const waiting = this.waiting
    waiting.clear()
    each((b) => {
      // one the kit put to sleep while held stays held while its ground is missing: let go asleep, a body landing on it would wake it over nothing
      if (b.sleeping && !this.links.get(b)?.frozen) return
      this.waits = false
      this.groundOf(b, dt, this.askAt)
      if (this.waits && !b.held) waiting.add(b)
    })
    each((b) => this.hold(b, waiting.has(b)))
    waiting.clear()
  }

  /**
   * A tile asked of the schedule: a level one the terrain's bounds prove is laid at once (it reads nothing); else its samples are read now (all of them, or again where it was
   * marked) with the band its solid reads past its edges, and the tile is made from them off the main thread and applied `frames` updates on (`applyDueGround`).
   */
  private askTile(key: number, ix: number, iz: number, tile: Tile | undefined): void {
    const schedule = this.schedule as GroundSchedule
    const x0 = ix * TILE
    const z0 = iz * TILE
    const flat = this.flatAt(tile, x0, z0)
    if (flat !== undefined) {
      if (flat) this.install(key, ix, iz, tile, flat, () => NO_SOLID, null)
      else if (tile) this.refreshMaterial(tile, ix, iz)
      return
    }
    const patch = this.o.groundPatch ? schedule.readPatch(this.o.groundPatch, x0, z0, TILE) : null
    if (patch) {
      this.askPatch({ key, ix, iz, x0, z0 }, tile, patch)
      return
    }
    let samples: Float64Array
    let wasCoarse = false
    if (tile && tile.samples) {
      const ringMoved = tile.dirty !== null && this.ringMoved(tile.volume, tile.dirty)
      const changed = readGround(this.o.groundAt, tile.samples, x0, z0, TILE, tile.dirty ?? undefined, this.o.groundGrid)
      tile.dirty = null
      if (!changed && !ringMoved) return this.refreshMaterial(tile, ix, iz)
      samples = tile.samples
      wasCoarse = wasCoarseOf(tile)
    } else {
      samples = new Float64Array(sampleCount(Math.round(TILE / GROUND_CELL)))
      readGround(this.o.groundAt, samples, x0, z0, TILE, undefined, this.o.groundGrid)
      if (tile) tile.dirty = null
    }
    const band = schedule.band(TILE)
    readGroundBand(this.o.groundAt, band, x0, z0, TILE, this.o.groundGrid)
    schedule.ask({ key, ix, iz, x0, z0, size: TILE, fresh: tile === undefined, wasCoarse, samples, patch: null }, band, this.updates)
  }

  /**
   * A tile asked for with the terrain's vertices under it and its ring (`groundPatch`): left as it is when they are the ones it was made from (the samples and the band it would
   * read are then the same, to the bit), else the tile is made from them where the schedule makes it. Nothing of its 60 000 samples is read here.
   */
  private askPatch(at: { key: number; ix: number; iz: number; x0: number; z0: number }, tile: Tile | undefined, patch: HeightPatch): void {
    const schedule = this.schedule as GroundSchedule
    if (tile) tile.dirty = null
    if (tile?.patch && samePatch(tile.patch, patch)) {
      schedule.givePatch(patch.heights)
      // the same heights, maybe another surface (a fill, a paint): its bodies take it now
      this.refreshMaterial(tile, at.ix, at.iz)
      return
    }
    const wasCoarse = tile !== undefined && wasCoarseOf(tile)
    schedule.ask({ ...at, size: TILE, fresh: tile === undefined, wasCoarse, samples: null, patch }, null, this.updates)
  }

  /** The tiles due at this update, laid in the order they were asked for: the worker's answer or the same tile made here (`GroundSchedule.resolve`). */
  private applyDueGround(): void {
    const schedule = this.schedule
    if (!schedule) return
    schedule.takeDue(this.updates, this.due)
    for (const p of this.due) {
      const made = schedule.resolve(p)
      const tile = this.tiles.get(p.key)
      this.install(p.key, p.ix, p.iz, tile, made, () => made.solid, tile ? tile.dirty : p.dirty)
    }
    this.due.length = 0
  }

  /**
   * A piece held still while its ground is made (kinematic at rest: what falls on it lands on it, it does not fall), or let go when the ground is laid: dynamic again with the
   * speeds the piece kept, awake or asleep as the piece is. A piece in a hand is never held for its ground (it is kinematic anyway).
   */
  private hold(b: PieceBody, wait: boolean): void {
    const link = this.links.get(b)
    if (!link || link.frozen === wait) return
    link.frozen = wait
    if (wait) {
      this.world.setMotion(link.id, 'kinematic')
      this.world.setVelocity(link.id, [0, 0, 0], [0, 0, 0])
      return
    }
    if (b.held) return
    this.world.setMotion(link.id, 'dynamic')
    const v = b.velocity
    const w = b.angularVelocity
    this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    for (let i = 0; i < 3; i++) {
      link.vel[i] = v[i]
      link.ang[i] = w[i]
    }
    if (b.sleeping) this.world.sleep(link.id)
    else this.world.wake(link.id)
    link.sleeping = b.sleeping
  }

  /** A held piece the kit or the host moved (lifted out of risen ground, put out of a fixed thing) keeps that pose as the one to compare against; its speeds wait with it. */
  private keepFrozen(b: PieceBody, link: Link, moved: boolean): void {
    if (!moved) return
    const c = this.centre(b)
    const q = b.root.quaternion
    link.pos[0] = c.x
    link.pos[1] = c.y
    link.pos[2] = c.z
    link.quat[0] = q.x
    link.quat[1] = q.y
    link.quat[2] = q.z
    link.quat[3] = q.w
  }

  /** The tiles under what the piece is made of: with `tilesUnderParts`, its parts' boxes where it has them (a pole with its wires is 23 m across and mostly air); else its one box. */
  private beneath(b: PieceBody, at: THREE_NS.Vector3, margin: number, visit: TileVisit): void {
    const parts = b.partBoxes
    if (!this.o.tilesUnderParts || b.round || !parts || parts.length === 0) {
      this.tilesAround(this.footprint(b, at), margin, visit)
      return
    }
    const q = b.root.quaternion
    for (const part of parts) {
      this.partCentre.set(part.center[0], part.center[1], part.center[2]).applyQuaternion(q).add(at)
      this.partQuaternion.copy(q)
      if (part.rotation) this.partQuaternion.multiply(this.turn3.set(part.rotation[0], part.rotation[1], part.rotation[2], part.rotation[3]))
      this.tilesAround(this.footprintOf(part.half, this.partQuaternion, this.partCentre), margin, visit)
    }
  }

  /** The tiles within `margin` of the footprint that are not laid, or whose ground changed, handed to `visit`. */
  private tilesAround(foot: Footprint, margin: number, visit: TileVisit): void {
    for (let ix = Math.floor((foot.minX - margin) / TILE); ix <= Math.floor((foot.maxX + margin) / TILE); ix++) {
      for (let iz = Math.floor((foot.minZ - margin) / TILE); iz <= Math.floor((foot.maxZ + margin) / TILE); iz++) {
        const key = (ix + TILE_KEY_ORIGIN) * TILE_KEY + (iz + TILE_KEY_ORIGIN)
        const tile = this.tiles.get(key)
        if (tile && tile.dirty === null) continue
        if (!this.footprintReaches(foot, ix * TILE, iz * TILE, margin)) continue
        visit(key, ix, iz)
      }
    }
  }

  /** The piece's box seen from above: its 8 corners in x and z, the box around them, and the directions its edges run (the axes that tell a tile apart from it). */
  private footprint(b: PieceBody, c: THREE_NS.Vector3): Footprint {
    return this.footprintOf(b.halfExtents, b.root.quaternion, c)
  }

  private footprintOf(h: Vec3, q: THREE_NS.Quaternion, c: THREE_NS.Vector3): Footprint {
    const out = this.footprintOut
    let k = 0
    out.minX = out.minZ = Infinity
    out.maxX = out.maxZ = -Infinity
    for (let corner = 0; corner < 8; corner++) {
      this.w.set(corner & 1 ? h[0] : -h[0], corner & 2 ? h[1] : -h[1], corner & 4 ? h[2] : -h[2]).applyQuaternion(q)
      const x = c.x + this.w.x
      const z = c.z + this.w.z
      out.corners[k++] = x
      out.corners[k++] = z
      out.minX = Math.min(out.minX, x)
      out.maxX = Math.max(out.maxX, x)
      out.minZ = Math.min(out.minZ, z)
      out.maxZ = Math.max(out.maxZ, z)
    }
    // the three box axes seen from above: a tile and the footprint are apart when a gap shows along the x axis, the z axis or the normal of one of these
    for (let axis = 0; axis < 3; axis++) {
      this.w.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0).applyQuaternion(q)
      const length = Math.hypot(this.w.x, this.w.z)
      out.normals[axis * 2] = length > 1e-6 ? -this.w.z / length : 0
      out.normals[axis * 2 + 1] = length > 1e-6 ? this.w.x / length : 0
    }
    return out
  }

  /** Whether the tile at (x0, z0) is within `margin` of the footprint (a gap wider than that along any axis rules it out; narrower, it is laid). */
  private footprintReaches(foot: Footprint, x0: number, z0: number, margin: number): boolean {
    const gap = (nx: number, nz: number): number => {
      if (nx === 0 && nz === 0) return 0
      let low = Infinity, high = -Infinity
      for (let i = 0; i < 16; i += 2) {
        const p = foot.corners[i]! * nx + foot.corners[i + 1]! * nz
        low = Math.min(low, p)
        high = Math.max(high, p)
      }
      let tileLow = Infinity, tileHigh = -Infinity
      for (let i = 0; i < 4; i++) {
        const p = (x0 + (i & 1 ? TILE : 0)) * nx + (z0 + (i & 2 ? TILE : 0)) * nz
        tileLow = Math.min(tileLow, p)
        tileHigh = Math.max(tileHigh, p)
      }
      return Math.max(tileLow - high, low - tileHigh)
    }
    if (gap(1, 0) > margin || gap(0, 1) > margin) return false
    for (let axis = 0; axis < 3; axis++) if (gap(foot.normals[axis * 2]!, foot.normals[axis * 2 + 1]!) > margin) return false
    return true
  }

  /**
   * A tile of ground, made or brought up to date on the same bodies. A tile the host marked is read again only where it said (`readGround`) and left alone when nothing
   * there differs; a height field that stays one has just the samples that moved written into its shape (`updateHeights`, the same ground as a new one within the
   * quantisation: the body keeps its id, so the engine still warm-starts the contacts of what lies on it, and the whole field is not made again); a slab is moved; the
   * solid under a height field and the step boxes are made again only when the heights or the boxes changed, or the ground its solid read past the tile's edges did.
   */
  private layTile(key: number, ix: number, iz: number, tile: Tile | undefined): void {
    const x0 = ix * TILE
    const z0 = iz * TILE
    const ringMoved = tile !== undefined && tile.dirty !== null && this.ringMoved(tile.volume, tile.dirty)
    const made = this.flatOrRead(tile, x0, z0)
    if (!made) {
      if (ringMoved && tile) this.relaySolid(tile, x0, z0)
      // the heights did not change, but the surface may have (a mark over the same ground): the kit's solver reads it live, the bodies follow
      if (tile) this.refreshMaterial(tile, ix, iz)
      return
    }
    // the solid is a function of the heights and the ground it read past the edges: the same of both, the same solid
    this.install(key, ix, iz, tile, made, (moved) => (made.level !== null ? NO_SOLID : tile && !tile.slab && moved === null && !ringMoved ? tile.volume : buildSolidVolume(made.heights, made.cells, x0, z0, TILE / made.cells, this.o.groundAt, made.cells / made.collisionCells)), null)
  }

  /** The bodies of a tile brought to `made` (`layTile`): its solid from `volumeOf` the heights that moved (null: none); `dirty` the mark the new record keeps. */
  private install(key: number, ix: number, iz: number, tile: Tile | undefined, made: GroundTile, volumeOf: (moved: HeightRegion | null) => SolidVolume, dirty: GroundRect | null): void {
    const slab = made.level !== null
    const moved = tile && !tile.slab && !slab ? changedHeights(tile.heights, made.heights, made.cells + 1) : null
    // the engine's field is the coarser collision grid (`engine-ground-collision`): what it moved there is what is written in place
    // a tile that went from one field to the other (`collisionFieldOf`) moved all of it: a new shape, not a write in place
    const fieldSize = made.collisionCells + 1
    const sameField = tile !== undefined && tile.collision.length === made.collision.length
    const movedField = tile && !tile.slab && !slab && moved ? (sameField ? changedHeights(tile.collision, made.collision, fieldSize) : { x: 0, z: 0, sizeX: fieldSize, sizeZ: fieldSize }) : null
    const kept = tile !== undefined && tile.slab === slab
    const material = this.groundMaterial(ix, iz)
    const ground = kept ? tile.ground : this.replaceGround(tile, made, ix, iz, material)
    const writes = kept ? this.updateGround(tile, made, movedField, ix, iz) : 0
    let steps = tile?.steps ?? null
    const same = tile !== undefined && sameNumbers(tile.boxes, made.boxes)
    if (!same) {
      if (steps !== null) this.world.removeBody(steps)
      steps = made.boxes.length === 0 ? null : this.world.createBody({ shape: this.stepBoxes(made.boxes), motion: 'static', position: [0, 0, 0], material, user: 0 })
    }
    const volume = volumeOf(moved)
    const laid = { ...made, solid: volume }
    const solid = this.layVolume(laid, tile, material)
    // the bodies made here have it already; the ones kept get it when the surface changed
    if (tile && tile.material !== material) {
      if (kept) this.world.setMaterial(ground, material)
      if (same && steps !== null) this.world.setMaterial(steps, material)
      if (solid !== null && solid === tile.solid) this.world.setMaterial(solid, material)
    }
    const patch = made.patch ?? null
    // the patch the tile was made from before goes back for the next read (§8: one patch per tile, no more)
    if (tile?.patch && tile.patch !== patch) this.schedule?.givePatch(tile.patch.heights)
    this.tiles.set(key, { ground, slab, steps, boxes: made.boxes, solid, volume, heights: made.heights, collision: made.collision, writes, samples: made.samples, patch, level: made.level, dirty, material })
  }

  /** A tile whose ground did not change: its bodies take the surface there now (`groundMaterial`) if it is another. */
  private refreshMaterial(tile: Tile, ix: number, iz: number): void {
    const material = this.groundMaterial(ix, iz)
    if (material === tile.material) return
    tile.material = material
    this.world.setMaterial(tile.ground, material)
    if (tile.steps !== null) this.world.setMaterial(tile.steps, material)
    if (tile.solid !== null) this.world.setMaterial(tile.solid, material)
  }

  /** The surface of the tile's bodies: the ground's own rolling resistance at its middle (`tileRollingAt`), one shared object per value; `GROUND` without the host's. */
  private groundMaterial(ix: number, iz: number): Material {
    const rolling = this.o.groundRollingAt ? tileRollingAt(this.o.groundRollingAt, ix * TILE, iz * TILE) : undefined
    const damping = this.o.groundRollingDampingAt ? tileRollingAt(this.o.groundRollingDampingAt, ix * TILE, iz * TILE) : undefined
    if ((rolling === undefined || rolling === ROLLING_RESISTANCE) && damping === undefined) return GROUND
    const key = `${rolling ?? ROLLING_RESISTANCE}|${damping ?? ''}`
    let material = this.groundMaterials.get(key)
    if (!material) {
      material = { ...GROUND, rolling: rolling ?? ROLLING_RESISTANCE, ...(damping === undefined ? {} : { rollingDamping: damping }) }
      this.groundMaterials.set(key, material)
    }
    return material
  }

  /** Whether a sample the solid read past the tile's edges, within the marked rectangle, is not the ground there now. */
  private ringMoved(volume: SolidVolume, rect: GroundRect): boolean {
    const r = volume.ring
    for (let k = 0; k < r.length; k += 3) {
      const x = r[k]!, z = r[k + 1]!
      if (x < rect.minX || x > rect.maxX || z < rect.minZ || z > rect.maxZ) continue
      if (this.o.groundAt(x, z) !== r[k + 2]) return true
    }
    return false
  }

  /** The solid of a tile whose own ground did not change, made again for the ground past its edges, which did. */
  private relaySolid(tile: Tile, x0: number, z0: number): void {
    const cells = Math.round(Math.sqrt(tile.heights.length)) - 1
    const collisionCells = Math.round(Math.sqrt(tile.collision.length)) - 1
    const volume = buildSolidVolume(tile.heights, cells, x0, z0, TILE / cells, this.o.groundAt, cells / collisionCells)
    tile.solid = this.layVolume({ heights: tile.heights, cells, collision: tile.collision, collisionCells, boxes: tile.boxes, solid: volume, level: null, samples: tile.samples }, tile, tile.material)
    tile.volume = volume
  }

  /**
   * The tile as the ground is now, or null (the mark cleared) when it did not change. A tile the terrain's own bounds prove level costs the vertices under it, not 26 000 samples:
   * the proof is exact (every sample is a blend of the vertices the tile covers), so a crater of any size under it takes the other way.
   */
  private flatOrRead(tile: Tile | undefined, x0: number, z0: number): GroundTile | null {
    const flat = this.flatAt(tile, x0, z0)
    if (flat !== undefined) return flat
    return tile && tile.samples ? this.readTile(tile, tile.samples, x0, z0) : buildGroundTile(this.o.groundAt, x0, z0, TILE, false, this.o.groundGrid)
  }

  /** The level tile the terrain's bounds prove, null (the mark cleared) when it is the slab laid there already, undefined when they do not prove it level. */
  private flatAt(tile: Tile | undefined, x0: number, z0: number): GroundTile | null | undefined {
    const range = this.o.groundRange?.(x0, x0 + TILE, z0, z0 + TILE)
    if (!range || range.high - range.low > FLAT_SPAN) return undefined
    const level = this.o.groundAt(x0 + TILE / 2, z0 + TILE / 2)
    if (tile?.slab && tile.level === level) {
      tile.dirty = null
      return null
    }
    return flatTile(level, TILE)
  }

  /** The tile as the ground is now, its marked samples read again; null (and the mark cleared) when none of them changed. */
  private readTile(tile: Tile, held: Float64Array, x0: number, z0: number): GroundTile | null {
    const changed = readGround(this.o.groundAt, held, x0, z0, TILE, tile.dirty ?? undefined, this.o.groundGrid)
    if (!changed) {
      tile.dirty = null
      return null
    }
    return shapeGround(held, x0, z0, TILE, null, !tile.slab && tile.collision.length < tile.heights.length)
  }

  /**
   * The ground body of a tile that stays a slab or a height field: the slab moved, or the height field's moved samples written in place (a whole new shape when the engine
   * cannot, when most of the field moved, or after `MAX_IN_PLACE_WRITES`). Returns how many times in a row the shape has been written in place.
   */
  private updateGround(tile: Tile, made: GroundTile, moved: HeightRegion | null, ix: number, iz: number): number {
    if (made.level !== null) {
      this.world.setPose(tile.ground, [(ix + 0.5) * TILE, made.level - 0.5, (iz + 0.5) * TILE], [0, 0, 0, 1], false)
      return 0
    }
    if (!moved) return tile.writes
    const size = made.collisionCells + 1
    const small = moved.sizeX * moved.sizeZ <= IN_PLACE_SHARE * size * size
    if (small && tile.writes < MAX_IN_PLACE_WRITES && this.world.updateHeights(tile.ground, moved, made.collision)) return tile.writes + 1
    this.world.setShape(tile.ground, this.heightField(made, ix, iz))
    return 0
  }

  /** A tile that is new, or went from a slab to a height field or back: its ground body made anew. */
  private replaceGround(tile: Tile | undefined, made: GroundTile, ix: number, iz: number, material: Material): BodyId {
    if (tile) this.world.removeBody(tile.ground)
    if (made.level === null) return this.world.createBody({ shape: this.heightField(made, ix, iz), motion: 'static', position: [0, 0, 0], material, user: 0 })
    return this.world.createBody({ shape: { kind: 'box', half: [TILE / 2, 0.5, TILE / 2], convexRadius: 0 }, motion: 'static', position: [(ix + 0.5) * TILE, made.level - 0.5, (iz + 0.5) * TILE], material, user: 0 })
  }

  /** The solid under a height field, on its own body, swapped in place when the ground changed; none under a slab. Boxes only: a box costs nothing to make, a hull did (T3.8ag). */
  private layVolume(t: GroundTile, tile: Tile | undefined, material: Material): BodyId | null {
    const id = tile?.solid ?? null
    if (t.level !== null) {
      if (id !== null) this.world.removeBody(id)
      return null
    }
    if (id === null) return this.world.createBody({ shape: this.solidShape(t.solid), motion: 'static', position: [0, 0, 0], material, user: 0 })
    if (tile && t.solid !== tile.volume && !sameSolid(tile.volume, t.solid)) this.world.setShape(id, this.solidShape(t.solid))
    return id
  }

  private solidShape(solid: SolidVolume): ShapeDesc {
    const children: Array<{ shape: ShapeDesc; position: Vec3; rotation: Quat }> = []
    const b = solid.boxes
    for (let i = 0; i < b.length; i += SOLID_STRIDE) children.push({ shape: { kind: 'box', half: [b[i + 3]!, b[i + 4]!, b[i + 5]!] }, position: [b[i]!, b[i + 1]!, b[i + 2]!], rotation: [b[i + 6]!, b[i + 7]!, b[i + 8]!, b[i + 9]!] })
    return { kind: 'compound', children }
  }

  private heightField(t: GroundTile, ix: number, iz: number): ShapeDesc {
    return { kind: 'heightfield', origin: [ix * TILE, 0, iz * TILE], cell: TILE / t.collisionCells, size: t.collisionCells + 1, heights: t.collision }
  }

  private stepBoxes(boxes: ArrayLike<number>): ShapeDesc {
    const children: Array<{ shape: ShapeDesc; position: Vec3 }> = []
    for (let i = 0; i < boxes.length; i += 6) children.push({ shape: { kind: 'box', half: [boxes[i + 3], boxes[i + 4], boxes[i + 5]], convexRadius: 0 }, position: [boxes[i], boxes[i + 1], boxes[i + 2]] })
    return { kind: 'compound', children }
  }

  /** The host's fixed boxes, one static body per object (`EngineStatics`). */
  private layStatics(): void {
    const now = this.o.staticSolids?.()
    if (now) this.statics.lay(now, this.o.staticUnsure?.())
  }

  private keepApart(apart: ReadonlySet<string>): void {
    for (const key of this.ignored) {
      if (apart.has(key)) continue
      this.ignored.delete(key)
      this.ignore(key, false)
    }
    for (const key of apart) {
      if (this.ignored.has(key)) continue
      this.ignored.add(key)
      this.ignore(key, true)
    }
  }

  /** The engine leaves the pair (`a\0b` by object id) alone, or meets it again. */
  private ignore(key: string, ignore: boolean): void {
    const cut = key.indexOf('\u0000')
    const a = this.byObject.get(key.slice(0, cut))
    const b = this.byObject.get(key.slice(cut + 1))
    const x = a && this.links.get(a)
    const y = b && this.links.get(b)
    if (x && y) this.world.ignorePair(x.id, y.id, ignore)
  }

  /** Writes the body back to the piece, then the kit's rules: the sweep against walls, hard landings, `still` for the budget. */
  private readBack(b: PieceBody, dt: number, time: number, active: ReadonlySet<PieceBody> | null): void {
    const link = this.links.get(b)
    if (!link || b.held || link.frozen) return
    // asleep on both sides since the last update: the engine has not moved it, there is nothing to read
    if (link.sleeping && b.sleeping && (active ? !active.has(b) : this.world.isSleeping(link.id))) {
      b.still = 0
      return
    }
    this.world.readPose(link.id, this.pose, 0)
    this.world.readVelocity(link.id, this.velocity, 0)
    const pos = this.readPos
    pos[0] = this.pose[0]
    pos[1] = this.pose[1]
    pos[2] = this.pose[2]
    const v = b.velocity
    const w = b.angularVelocity
    for (let i = 0; i < 3; i++) {
      v[i] = this.velocity[i]
      w[i] = this.velocity[i + 3]
    }
    b.sleeping = this.world.isSleeping(link.id)
    if (!b.sleeping) b.onGround = this.world.touching(link.id)
    // the tilt it kept while asleep says nothing of the new fall, and what it stands on is judged now: the budget put a board back to sleep in the frame its step went
    if (link.sleeping && !b.sleeping) {
      b.steady = undefined
      if (b.onGround && !b.round) this.topple(b, 0)
    }
    // the sweep judges the engine's own move; the net under the ground comes after it, so nothing the sweep does (a face that turns it back) leaves it under the ground
    let moved = link.stepped && !b.sleeping && this.o.sweep !== undefined && this.sweepOn(b, link.before, pos, time)
    const reach = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
    const floor = this.o.groundAt(pos[0], pos[2])
    if (pos[1] + reach < floor - 0.05) {
      this.fellThrough++
      pos[1] = floor + reach
      v[1] = Math.max(0, v[1])
      moved = true
    }
    if (link.stepped && !b.sleeping) {
      const impact = -link.beforeVy
      if (b.onGround && impact > HARD_LANDING && v[1] > link.beforeVy + impact * 0.5 && time - b.lastHit > 0.15) {
        b.lastHit = time
        this.o.onHardLanding(b, [pos[0], pos[1] - Math.min(...b.halfExtents), pos[2]], impact)
      }
    }
    b.root.quaternion.set(this.pose[3], this.pose[4], this.pose[5], this.pose[6])
    const off = this.v.copy(b.centerV).applyQuaternion(b.root.quaternion)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    if (!b.sleeping) {
      const still = b.onGround && !b.tipping && Math.hypot(v[0], v[1], v[2]) < STILL_SPEED && Math.hypot(w[0], w[1], w[2]) < STILL_SPIN
      b.still = still ? b.still + dt : 0
    } else {
      b.still = 0
    }
    // only what the kit changed goes back: writing the pose wakes the body and starts its sleep timer again
    if (moved) this.world.setPose(link.id, pos, [this.pose[3], this.pose[4], this.pose[5], this.pose[6]], true)
    if (moved) this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    // what is written back is what the next update compares against: a change from outside differs from it
    link.pos[0] = pos[0]
    link.pos[1] = pos[1]
    link.pos[2] = pos[2]
    const q = b.root.quaternion
    link.quat[0] = q.x
    link.quat[1] = q.y
    link.quat[2] = q.z
    link.quat[3] = q.w
    for (let i = 0; i < 3; i++) {
      link.vel[i] = v[i]
      link.ang[i] = w[i]
    }
    if (b.sleeping && !link.sleeping) {
      const c = this.centre(b)
      link.groundAtSleep = this.o.groundAt(c.x, c.z)
    }
    link.sleeping = b.sleeping
  }

  /**
   * A piece that ran into a wall on its way (`sweep`). Into what the engine has as a body (a fixed thing's drawn boxes, another piece) the engine already met it, so
   * the sweep only tells the blow (`onSlam`): setting it back there as well put a door sliding down a table edge back up every update, for good, and threw pieces
   * off a wall the engine was already holding them against. Into what the engine does not have (a wall left out of `staticSolids`), the kit's rule as before:
   * back to where it met it, the speed into it reflected.
   */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3, time: number): boolean {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return false
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return false
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return false
    const engineHas = this.byObject.has(hit.object) || this.statics.has(hit.object)
    if (!engineHas) {
      const k = Math.min(1, hit.distance / travel)
      // below the engine's restitution threshold the speed into it is only taken away: reflected, a door pressed into a parked car (which the engine does not
      // have) by its own weight was sent back off it every update and never slept
      const bounce = into >= BOUNCE_SPEED ? Math.sqrt((b.restitution ?? SLAM_BOUNCE) * (hit.restitution ?? SLAM_BOUNCE)) : 0
      // up to where it met it, then the rest of the way along it: only the part into it is taken out (set back the whole way, a door sliding down a parked car
      // was put back up on every update)
      const rest = [0, 1, 2].map((i) => (pos[i] - start[i]) * (1 - k))
      const restInto = Math.min(0, rest[0] * n[0] + rest[1] * n[1] + rest[2] * n[2])
      for (let i = 0; i < 3; i++) {
        pos[i] = start[i] + (pos[i] - start[i]) * k + rest[i] - restInto * n[i]
        v[i] += (1 + bounce) * into * n[i]
      }
      for (let i = 0; i < 3; i++) b.angularVelocity[i] *= 0.5
    }
    if (into >= SLAM_MIN_SPEED && time - b.lastHit > 0.15) {
      b.lastHit = time
      this.o.onSlam?.(b, hit, into)
    }
    return !engineHas
  }

  /** Two pieces that hit each other hard enough sound (`onKnock`), from the engine's contact rows, once per pair per `KNOCK_EVERY`. */
  private knock(time: number): void {
    const on = this.o.onKnock
    if (!on) return
    const c = this.world.contacts
    for (let i = 0; i < c.count; i++) {
      if (c.approach[i] < SLAM_MIN_SPEED) continue
      const a = this.byUser.get(c.userA[i])
      const b = this.byUser.get(c.userB[i])
      if (!a || !b) continue
      const key = a.objectId < b.objectId ? `${a.objectId}\u0000${b.objectId}` : `${b.objectId}\u0000${a.objectId}`
      if (time - (this.knocks.get(key) ?? -Infinity) < KNOCK_EVERY) continue
      this.knocks.set(key, time)
      on(a, b, [c.point[i * 3], c.point[i * 3 + 1], c.point[i * 3 + 2]], c.approach[i])
    }
  }
}
