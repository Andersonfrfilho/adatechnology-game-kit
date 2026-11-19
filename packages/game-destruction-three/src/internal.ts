import type * as THREE_NS from 'three'
import type { MaterialId, PartSettlement, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from './types'

/** A box of a part of a piece: centre and half sizes in the piece's frame from its centre of mass, and how it is turned in that frame (none: square to it). */
export interface PartBox {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation?: readonly [number, number, number, number]
}

const rows = (r: readonly [number, number, number, number]): number[] => {
  const [x, y, z, w] = r
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
}

/** Whether a part box is turned askew in its piece's frame: a quarter or half turn leaves it square, only its sizes swapped. */
export const isTurned = (box: PartBox): boolean => box.rotation !== undefined && rows(box.rotation).some((v) => Math.abs(v) > 1e-6 && Math.abs(Math.abs(v) - 1) > 1e-6)

/**
 * The square box around a part box (its frame): what the kit's own solver, which knows only boxes square to the piece, meets in its place. A part not turned is itself.
 */
export const squareBoxOf = (box: PartBox): { readonly center: Vec3; readonly half: Vec3 } => {
  const r = box.rotation
  if (!r) return { center: box.center, half: box.half }
  // the rows of the rotation, by absolute value, times the half sizes (a quarter turn swaps them)
  const m = rows(r)
  const h = box.half
  const half: Vec3 = [0, 1, 2].map((i) => Math.abs(m[i * 3]) * h[0] + Math.abs(m[i * 3 + 1]) * h[1] + Math.abs(m[i * 3 + 2]) * h[2]) as Vec3
  return { center: box.center, half }
}

/** A decal child of a mesh (hole disc or crack star). `geometry` is set when the decal owns it. */
export interface Decal {
  obj: THREE_NS.Object3D
  geometry?: THREE_NS.BufferGeometry
}

/** One merged mesh whose vertex ranges are bound to several parts (or, after a split, the loose mesh of one part). */
export interface HostVis {
  mesh: THREE_NS.Mesh
  origGeometry: THREE_NS.BufferGeometry
  origMaterial: THREE_NS.Material | THREE_NS.Material[]
  /** `mesh.geometry` is a clone the renderer may edit. */
  ownGeo: boolean
  /** Current dented positions of the whole mesh (before melt), once the geometry is owned. */
  work: Float32Array | null
  /** `mesh.material` is a clone (vertex colours switched on). */
  ownMat: boolean
  /** Every MeshVis that draws a range of this mesh, or whose merged binding is this mesh. */
  sharers: MeshVis[]
  /**
   * While `work` is null the parts are measured by the mesh's own positions: the attribute and its `version` the sharers' `shapeVersion` account for. A write since (one
   * `needsUpdate`) counts against the ranges it declared (`markPositionsWritten`), or against every sharer when it declared none.
   */
  seen: { attribute: THREE_NS.BufferAttribute | null; version: number }
  /** Once `work` is set: the ranges another drawing collapses on the mesh (`userData.collapsedRanges`, flat `v0, v1, ...`) the sharers' `shapeVersion` account for. */
  collapsedSeen: number[]
}

/** Everything the renderer knows about one bound mesh: the original assets (kept to restore) and what has been changed. */
export interface MeshVis {
  mesh: THREE_NS.Mesh
  /** Object id the mesh belonged to when it was bound (restore goes back there). */
  home: string
  origGeometry: THREE_NS.BufferGeometry
  origMaterial: THREE_NS.Material | THREE_NS.Material[]
  origVisible: boolean
  origParent: THREE_NS.Object3D | null
  origPosition: THREE_NS.Vector3
  origQuaternion: THREE_NS.Quaternion
  origScale: THREE_NS.Vector3
  /** Material cloned (colour and emissive may change). */
  ownMat: boolean
  /** Geometry cloned (vertices may change). */
  ownGeo: boolean
  /** Current dented positions in mesh space (before melt), once the geometry is owned. */
  work: Float32Array | null
  /** Colours of the original materials, to lerp from when charring. */
  baseColors: THREE_NS.Color[] | null
  decals: Decal[]
  meltApplied: number
  /** World height of the bottom of the mesh when it first started melting. */
  bottomY: number
  moved: boolean
  /**
   * Set when the part is bound by a vertex range of a merged mesh: the mesh state lives in `host` and every edit is limited to `range`. After
   * the part detaches they point at its own loose mesh and `[0, vertices]`; `merged` always keeps the binding to go back to.
   */
  host: HostVis | null
  range: [number, number] | null
  merged: { host: HostVis; range: [number, number] } | null
  /** The part's faces were extracted into `mesh` (a mesh the renderer made and owns). */
  loose: boolean
  /** The range is collapsed to a point in the merged mesh (the part is hidden or loose). */
  collapsed: boolean
  /** The part is not drawn (broken, melted, ash). */
  hidden: boolean
  /** Dents, colours, melt or hiding differ from the original geometry. */
  touched: boolean
  /** Counts every write of the positions the part is measured by (`Visuals.positionsOf`): the same count is the same vertices, so `drawnSolidsOf` reads none of them. */
  shapeVersion: number
  charK: number
  charHex: number
  glowHex: number
  glowK: number
}

export interface PartVis {
  id: string
  home: string
  material: MaterialId
  meshes: MeshVis[]
  charApplied: number
  glowApplied: number
  meltApplied: number
  /** `none` while the meshes are drawn; the reason they were hidden otherwise. */
  gone: 'none' | 'broken' | 'melted' | 'ashes'
  /** The settlement drawn on the part now (object-local line), when the ground under it went down. */
  settled?: PartSettlement
  /** Parts whose meshes draw this one's marks when it has none of its own (`BindOptions.marksOn`: a pillar under the plaster of its walls). */
  markHosts?: PartVis[]
}

/** Coulomb friction coefficients of a piece's surface: what holds it still and what drags it while it slides. */
export interface PieceFriction {
  readonly static: number
  readonly dynamic: number
  /** Rolling resistance coefficient of the surface, C_rr (a round thing rolling on it is held back by C_rr N); the softer of two surfaces sets it. */
  readonly rolling?: number
}

export interface PieceBody extends Piece {
  /** Which body of `objectId` this is (counts up per body made): a push queued for a piece reaches only that body, never one made later under the same id. */
  readonly generation: number
  /** `localCenter` as a vector (kept in sync with it). */
  centerV: THREE_NS.Vector3
  /** Seconds the piece has been nearly still (sleeps after 0.5). */
  still: number
  /** Where the piece was when it last started to stay in place on the ground (centre and rotation), and for how many seconds since: see `CALM_SLEEP_AFTER`. */
  calmAt: { center: Vec3; quaternion: [number, number, number, number] } | null
  calm: number
  /** Its support in the last step was narrower than its centre of mass needs (on an edge, or held up at an angle): it does not sleep by `still`. */
  balancing?: boolean
  /** Its rotation when it last started to keep its tilt (within `STEADY_TURN`), and for how many seconds since; null after it sleeps. */
  steady?: { quaternion: [number, number, number, number]; seconds: number } | null
  /** Put to sleep by the budget (`PieceSystemOptions.maxAwake`): the points (its frame) it lay on, every one of which must keep its support, or it wakes (`wakeUnsupported`). */
  restPoints?: Vec3[]
  /** Time of the last hard-landing report. */
  lastHit: number
  onGround: boolean
  /** Hung on a hinge (`PieceSystem.hinge`): a shelf swinging down on the screw left at one end. */
  hinge?: PieceHinge
  /** Falling over (`tip`): the spin it is given per second on the ground, about x and z, and the seconds it may still take; null when it lies or never had to fall. */
  tipping: { x: number; z: number; seconds: number } | null
  /** The contact impulses each point of the box gave in the last substep (normal, friction x, friction z per point), to start the next one from. */
  warm?: Float64Array
  /** Height of the lowest support the piece last stood on: the floor under a top it was put beneath. */
  floor?: number
  /**
   * In the last step it was held up by a piece under it through their overlap (`separatePair`), not by a corner on a top (a case lying across two books by its middle): the
   * normal of that support, up from it.
   */
  propped?: Vec3
  /** Where it is held up through that overlap, from its centre of mass (world): a point of its support, with the corners that touch. */
  proppedAt?: Vec3
  /**
   * The points that touch the ground in place of the corners of its box (its frame, from the centre of mass): the corners of each part left of it. A top left on one leg
   * stands on that leg's foot, so it goes over, and lands on the edge of the top.
   */
  contacts?: Vec3[]
  /**
   * The boxes of its parts (its frame, from the centre of mass), turned as drawn (`rotation`, in its frame; none is square to it), what other pieces land on instead of
   * its box: a shelf's boards, a table's top and legs, a roof sheet lying askew.
   */
  partBoxes?: PartBox[]
  /** The friction of its surface (by its material); against another surface the two are mixed (geometric mean). Default 0.7 static, 0.6 dynamic. */
  friction?: PieceFriction
  /** The normal of the surface a round piece last lay on: where it touches is across it from the centre. */
  surfaceNormal?: Vec3
  /**
   * A round piece (a can, a bottle, a ball, a plate on its edge): `cylinder` round about its own `axis` (0 x, 1 y, 2 z of its frame) or a `sphere`. It touches the ground by
   * points around its rims (`contacts`), so it rolls, and the ground holds it back only by rolling resistance, not by the grip that stops a box from turning.
   */
  round?: PieceRound
  /** k of `round.inertia` as the host gave it (`MakePieceOptions.inertia`), kept over the measure of its walls when the piece is fitted again. */
  inertiaGiven?: number
  /** Kg the piece weighs less than its parts in the world (the liquid that left it), kept over the refits. */
  massOffset?: number
  /** Coefficient of restitution of its surface (by its material), mixed with the other surface's by geometric mean; default `SLAM_BOUNCE`. */
  restitution?: number
}

/** A hinge a piece hangs on (`PieceBody.hinge`): the point it turns about (world), that point in its frame from its centre of mass, its rotation when hung and the seconds left. */
export interface PieceHinge {
  readonly point: Vec3
  readonly local: Vec3
  readonly from: readonly [number, number, number, number]
  seconds: number
}

/** How a round piece is round (`PieceBody.round`). */
export interface PieceRound {
  readonly kind: 'cylinder' | 'sphere'
  readonly axis: 0 | 1 | 2
  /** The largest radius (m). */
  readonly radius: number
  /**
   * k of its moment of inertia about its axis, I = k m r^2: 0.5 a solid cylinder (a full tin), 1 a thin shell (an empty tin), 0.4 a solid ball, 2/3 a hollow one. On an incline
   * of angle t it rolls down at g sin t / (1 + k).
   */
  readonly inertia: number
  /**
   * Its radius along its axis (a cylinder): `[at, radius]` from one end to the other, `at` from the centre of mass along the axis. A tapered bottle or a cup lying on its side touches
   * by the lowest point of each, so it rolls round the wide end; a straight can rolls on straight. Without it, the two ends at `radius`.
   */
  readonly profile?: ReadonlyArray<readonly [number, number]>
}

export interface Bound {
  id: string
  root: THREE_NS.Object3D
  sync: boolean
  parts: Map<string, PartVis>
  lastPos: Vec3 | null
  lastQuat: [number, number, number, number] | null
  piece: PieceBody | null
  /** Created by a `detach` (the root is a group the renderer made and owns). */
  isSplit: boolean
  /** The host's per-frame work for this object (`BindOptions.onFrame`). */
  onFrame?: (dt: number) => void
  /** Node between the root and its children that carries the settlement and tilt of the soil (`settle` events), made on the first one. */
  soilNode?: THREE_NS.Object3D
  /** The root's world matrix when it was last read for the world: an object whose matrix did not change is not decomposed again. */
  lastWorld?: Float64Array
  /** The root of a piece asleep stops recomputing its matrix (`matrixAutoUpdate = false`) until something moves it. */
  frozen?: boolean
  /** Moved by something that does not wake the piece (`DestructionRenderer.markMoved`): synced and thawed on the next `update`. */
  moved?: boolean
}

/** What a moving piece ran into (`PieceSystemOptions.sweep`). */
export interface PieceSweepHit {
  readonly object: string
  readonly part: string
  /** Metres along the way from the centre where the piece meets it. */
  readonly distance: number
  readonly point: Vec3
  readonly normal: Vec3
  /** Coefficient of restitution of what it met (by its material); mixed with the piece's (geometric mean). */
  readonly restitution?: number
}
