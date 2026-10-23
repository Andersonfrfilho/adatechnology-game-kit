/**
 * Public types of @adatechnology/game-destruction-three.
 *
 * `three` is only imported as a type: the host passes its own THREE namespace. The renderer listens to a `DestructionWorld` and draws what it
 * reports on the host's meshes: vertex dents, hole and crack decals, char and heat glow through vertex colours / emissive, melting (sag and
 * drips), fragments with light physics, loose pieces after a `detach`, and pooled particles.
 */
import type * as THREE_NS from 'three'
import type { DebrisKind, DestructibleSpec, DestructionWorld, MaterialId, Quat, Vec3 } from '@adatechnology/game-destruction'

export type ThreeNamespace = typeof THREE_NS
export type Object3D = THREE_NS.Object3D
export type Mesh = THREE_NS.Mesh

export type Quality = 'low' | 'medium' | 'high'

export interface RendererOptions {
  /** Scene that receives fragments, loose pieces, decals and particles. */
  scene: THREE_NS.Scene
  world: DestructionWorld
  /** `low` halves particle and fragment budgets and skips vertex dents on meshes over 20k vertices (default `medium`). */
  quality?: Quality
  /** Upper bound of live fragment meshes (default 160; oldest fade first). */
  maxFragments?: number
  /** Upper bound of live particles (default 2500). */
  maxParticles?: number
  /** Seconds a resting fragment stays before it fades (default 12; 0 = forever). */
  fragmentLife?: number
  /** Ground height at (x, z) for fragments, pieces and drips (default 0). */
  groundAt?: (x: number, z: number) => number
  gravity?: number
  /** Turn a loose group into a separate physical piece automatically (default true). */
  autoSplit?: boolean
  /** Called when a loose piece is created (the bench registers it as grabbable). */
  onPiece?: (piece: Piece) => void
  /** Called when a sound should play; the host maps keys to audio (e.g. `impact_metal`, `shatter_glass`, `ignite`, `explode`). */
  onSound?: (key: string, point: Vec3, volume: number) => void
  /** A point light flashes on explosions (default true; costs one light). */
  explosionLight?: boolean
  /**
   * Particle size scale in pixels per metre at one metre from the camera, roughly `viewportHeight / (2 * tan(fov / 2))` (default 700). Set it
   * when the viewport is much smaller or larger than about 720 px tall so smoke and fire keep their physical size.
   */
  pointScale?: number
}

/** Options of `bind`. */
export interface BindOptions {
  /**
   * Part id -> meshes that draw it. When omitted, every Mesh under the root with `userData.destructionPart` (or whose name equals a part id) is
   * used; meshes with neither are matched to the part whose box contains the mesh's bounding-box centre.
   */
  parts?: Record<string, Object3D | Object3D[]>
  /** Keep the world transform in sync from the root's matrixWorld every update (default true). */
  syncTransform?: boolean
}

/** A body the renderer moves with its light physics: a loose piece of an object after a detach (or a whole object handed to it). */
export interface Piece {
  /** World object id of this piece. */
  objectId: string
  root: Object3D
  velocity: Vec3
  angularVelocity: Vec3
  /** Half extents of the local bounding box used for ground contact and grabbing. */
  halfExtents: Vec3
  /** Centre of mass relative to the root's origin, in the root's local space (metres). It moves when a part breaks off the piece. */
  localCenter: Vec3
  mass: number
  sleeping: boolean
  /** While held by a player the renderer does not integrate it. */
  held: boolean
}

export interface DestructionRenderer {
  /** Attach a world object to its three.js root. */
  bind(objectId: string, root: Object3D, options?: BindOptions): void
  unbind(objectId: string): void
  /** Make a bound object a physical piece (bench items that can be thrown). */
  makePiece(objectId: string, options?: { mass?: number; velocity?: Vec3 }): Piece
  pieces(): Piece[]
  piece(objectId: string): Piece | null
  /** Push a piece (throws, blasts). */
  impulse(objectId: string, impulse: Vec3, point?: Vec3): void
  /** Integrate fragments, pieces and particles; apply pending visual changes. Call once per frame after `world.update`. */
  update(dt: number): void
  /** Emit particles directly (muzzle flashes, extinguisher foam, tool sparks). */
  emit(kind: DebrisKind | 'fire' | 'flash' | 'foam', point: Vec3, normal: Vec3, count: number, speed?: number): void
  /** Remove every fragment, decal and particle, restore every bound mesh to its original geometry and colours. */
  clear(): void
  /** Restore one object (after `world.reset`). */
  restore(objectId: string): void
  stats(): { fragments: number; particles: number; pieces: number; decals: number }
  dispose(): void
}

export interface SpecFromObjectOptions {
  /** Material of a mesh. Default: `userData.destructionMaterial`, else `guessMaterial` on the mesh and material names, else `fallback`. */
  materialOf?: (mesh: Mesh) => MaterialId | undefined
  /** Material when nothing matches (default `plastic`). */
  fallback?: MaterialId
  /** Merge meshes smaller than this (largest box side, metres) into the part they touch (default 0.015). */
  minSize?: number
  /** Infer joints between touching parts (default true). */
  joints?: boolean
  /** Parts whose box bottom is within this distance of y = 0 in root space are `anchored` (default -1 = none). */
  anchorBelow?: number
  /** Fill per material for hollow shells (default: sheet metal 0.04 when the box is thin, 1 otherwise). */
  fillOf?: (mesh: Mesh, material: MaterialId) => number | undefined
  name?: string
  tags?: string[]
}

/** Result of `specFromObject3D`: the spec and which mesh became which part (pass `parts` to `bind`). */
export interface SpecFromObjectResult {
  spec: DestructibleSpec
  parts: Record<string, Object3D[]>
}

export type { Quat, Vec3 }
