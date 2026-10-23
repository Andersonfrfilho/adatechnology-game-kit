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

export interface PieceBody extends Piece {
  /** `localCenter` as a vector (kept in sync with it). */
  centerV: THREE_NS.Vector3
  /** Seconds the piece has been nearly still (sleeps after 0.5). */
  still: number
  /** Time of the last hard-landing report. */
  lastHit: number
  onGround: boolean
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
}
