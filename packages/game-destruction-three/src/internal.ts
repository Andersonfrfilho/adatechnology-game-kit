import type * as THREE_NS from 'three'
import type { MaterialId, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from './types'

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
}

/** Coulomb friction coefficients of a piece's surface: what holds it still and what drags it while it slides. */
export interface PieceFriction {
  readonly static: number
  readonly dynamic: number
}

export interface PieceBody extends Piece {
  /** `localCenter` as a vector (kept in sync with it). */
  centerV: THREE_NS.Vector3
  /** Seconds the piece has been nearly still (sleeps after 0.5). */
  still: number
  /** Where the piece was when it last started to stay in place on the ground (centre and rotation), and for how many seconds since: see `CALM_SLEEP_AFTER`. */
  calmAt: { center: Vec3; quaternion: [number, number, number, number] } | null
  calm: number
  /** Time of the last hard-landing report. */
  lastHit: number
  onGround: boolean
  /** Falling over (`tip`): the spin it is given per second on the ground, about x and z, and the seconds it may still take; null when it lies or never had to fall. */
  tipping: { x: number; z: number; seconds: number } | null
  /** The contact impulses each point of the box gave in the last substep (normal, friction x, friction z per point), to start the next one from. */
  warm?: Float64Array
  /** Height of the lowest support the piece last stood on: the floor under a top it was put beneath. */
  floor?: number
  /**
   * The points that touch the ground in place of the corners of its box (its frame, from the centre of mass): the corners of each part left of it. A top left on one leg
   * stands on that leg's foot, so it goes over, and lands on the edge of the top.
   */
  contacts?: Vec3[]
  /** The boxes of its parts (its frame, from the centre of mass), what other pieces land on instead of its box: a shelf's boards, a table's top and legs. */
  partBoxes?: Array<{ readonly center: Vec3; readonly half: Vec3 }>
  /** The friction of its surface (by its material); against another surface the two are mixed (geometric mean). Default 0.7 static, 0.6 dynamic. */
  friction?: PieceFriction
  /**
   * A round piece (a can, a bottle, a ball, a plate on its edge): `cylinder` round about its own `axis` (0 x, 1 y, 2 z of its frame) or a `sphere`. It touches the ground by
   * points around its rims (`contacts`), so it rolls, and the ground holds it back only by rolling resistance, not by the grip that stops a box from turning.
   */
  /** The normal of the surface a round piece last lay on: where it touches is across it from the centre. */
  surfaceNormal?: Vec3
  round?: { readonly kind: 'cylinder' | 'sphere'; readonly axis: 0 | 1 | 2; readonly radius: number }
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
}
