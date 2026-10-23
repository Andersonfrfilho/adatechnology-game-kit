import type * as THREE_NS from 'three'
import type { MaterialId, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from './types'

/** A decal child of a mesh (hole disc or crack star). `geometry` is set when the decal owns it. */
export interface Decal {
  obj: THREE_NS.Object3D
  geometry?: THREE_NS.BufferGeometry
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
  /** Centre of the local box in root space. */
  localCenter: THREE_NS.Vector3
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
