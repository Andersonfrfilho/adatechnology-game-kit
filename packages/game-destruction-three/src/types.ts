/**
 * Public types of @adatechnology/game-destruction-three.
 *
 * `three` is only imported as a type: the host passes its own THREE namespace. The renderer listens to a `DestructionWorld` and draws what it
 * reports on the host's meshes: vertex dents, hole and crack decals, char and heat glow through vertex colours / emissive, melting (sag and
 * drips), fragments with light physics, loose pieces after a `detach`, and pooled particles.
 */
import type * as THREE_NS from 'three'
import type { DebrisKind, DestructibleSpec, DestructionWorld, HitResult, MaterialId, Quat, Vec3 } from '@adatechnology/game-destruction'
import type { WarmUpProbes } from '@adatechnology/game-contracts'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { BlastShoveOptions } from '@adatechnology/game-contracts'

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
  /**
   * The numbers of the shove a blast gives to the pieces (`BlastShoveOptions` of game-contracts: how much of the energy becomes speed, the fastest throw, the lift, the falloff).
   * The defaults give the pieces the speed the blast always gave them, with the cap lowered to 20 m/s.
   */
  blastShove?: BlastShoveOptions
  /**
   * Bound objects that have no piece but that a blast may move anyway (a fridge, a table: heavy, so not grabbable, but not nailed down either): when this answers true for an object a blast
   * reaches with enough speed, the renderer makes it a piece (`makePiece`) and shoves it, and tells `onLoosened`. Without it only the pieces move. Never answer true for a wall or a fixture.
   */
  shoveable?: (objectId: string) => boolean
  /** Called when the renderer made a bound object a piece on its own: a blast shoved it (`blast`, see `shoveable`), or furniture came apart and what stayed is loose too (`apart`). */
  onLoosened?: (objectId: string, piece: Piece, cause: 'blast' | 'apart') => void
  /** Called when a sound should play; the host maps keys to audio (e.g. `impact_metal`, `shatter_glass`, `ignite`, `explode`). `burn_loop` is sent when a part starts to burn and `burn_end` when it burns out or is put out. */
  onSound?: (key: string, point: Vec3, volume: number) => void
  /**
   * The effects world that draws blasts and fires. Pass the one the host shares with the other renderers (and step it, through its
   * `VfxRenderer.update`, once per frame); without it the renderer makes its own world and its own three layer and steps them in `update`.
   */
  vfx?: VfxWorld
  /** Which effect each destruction event plays (default `EVENT_EFFECTS_MAP` of `@adatechnology/game-vfx`): `spall`, `stage`, `expose`, `collapse`. Add, change or take out entries to tune it. */
  eventEffects?: Readonly<Record<string, string | Readonly<Record<string, string>>>>
  /** Camera of the own effects world (distance LOD, shake); only read when `vfx` is not given. Default: a camera at the origin. */
  camera?: THREE_NS.Camera
  /**
   * Particle size scale in pixels per metre at one metre from the camera, roughly `viewportHeight / (2 * tan(fov / 2))` (default 700). Set it
   * when the viewport is much smaller or larger than about 720 px tall so smoke and fire keep their physical size.
   */
  pointScale?: number
}

/**
 * A part drawn by a range of the vertices of a mesh it shares with other parts (a merged house, a baked car body). `range` is `[v0, v1)`: vertex
 * indices of the mesh's geometry, the end exclusive. For indexed geometry the faces whose three vertices all lie in the range belong to the part;
 * for non-indexed geometry the range is the part's triangles (three vertices each).
 *
 * Dents, char and heat colours (through vertex colours: the mesh gets a `color` attribute and its material `vertexColors` when it has none) and
 * melt change only that range, and hole and crack decals are attached to the part. When the part detaches or collapses, its faces are copied
 * into a new mesh with the merged mesh's transform and material (a loose piece) and the range is collapsed to a point in the merged mesh, so it
 * disappears from there. A broken, melted or burnt-out part collapses too. `restore` and `clear` give the merged mesh its original geometry and
 * material back and remove the loose meshes.
 */
export interface MeshRange {
  mesh: Mesh
  /** Vertex index range `[v0, v1)` of `mesh.geometry`. */
  range: [number, number]
}

/** Options of `bind`. */
export interface BindOptions {
  /**
   * Part id -> meshes that draw it (a mesh or group, a list of them, a `MeshRange`, or a list mixing both). When omitted, every Mesh under the root with `userData.destructionPart` (or whose name equals a part id) is
   * used; meshes with neither are matched to the part whose box contains the mesh's bounding-box centre.
   */
  parts?: Record<string, Object3D | MeshRange | Array<Object3D | MeshRange>>
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

/** Options of `DestructionRenderer.explode`. */
export interface ExplodeOptions {
  /** Id of the effect to play (an explosive id of the effects catalogue). Default `generic`. */
  readonly effect?: string
  /** Where the blast is aimed (a shaped charge). */
  readonly direction?: Vec3
  /** `false`: the host drew the blast, only the shove and the sound are left. Default `true`. */
  readonly visual?: boolean
  /**
   * What `world.explode` returned for this blast. When its results carry a `blast` report (`shelter`, `confinement`), the shove on each piece uses
   * the energy that reached it (`energy * confinement * shelter` of the piece's object) instead of the raw energy. Without it the old formula.
   */
  readonly report?: readonly HitResult[]
}

/** One box of `DestructionRenderer.solidsNear`. */
export interface SolidBox {
  readonly objectId: string
  readonly min: Vec3
  readonly max: Vec3
  /** The piece the box belongs to; null for a fixed object and a loose body. */
  readonly piece: Piece | null
  /** A big fragment (a broken board): not a piece, but it lies there and is kicked along. */
  readonly loose?: LooseBody
}

/** A fragment big enough to be walked on (`DestructionRenderer.solidsNear`). */
export interface LooseBody {
  readonly mass: number
  /** Gives it this speed on the floor (m/s). */
  push(velocityX: number, velocityZ: number): void
}

export interface DestructionRenderer {
  /** Attach a world object to its three.js root. */
  bind(objectId: string, root: Object3D, options?: BindOptions): void
  unbind(objectId: string): void
  /** Make a bound object a physical piece (bench items that can be thrown). */
  makePiece(objectId: string, options?: { mass?: number; velocity?: Vec3 }): Piece
  pieces(): Piece[]
  /** What lies in the disc looks at the ground again (`groundAt` changed under it: a crater, a heap). */
  wakeRegion(x: number, z: number, radius: number): void
  piece(objectId: string): Piece | null
  /**
   * World boxes of what is drawn around (x, z) within `radius`: each drawn mesh of a fixed object (meshes wider than 3 m and parts inside a merged
   * mesh are left out: walls, floors, roofs), of every piece and of the big fragments, with the object's id and its piece, if it is one. A turned mesh
   * gives several boxes along its length, so that they follow it instead of its axis box. A walking body uses it to step onto low debris, stop at what is
   * taller and kick what is light.
   */
  solidsNear(x: number, z: number, radius: number): SolidBox[]
  /** Push a piece (throws, blasts). */
  impulse(objectId: string, impulse: Vec3, point?: Vec3): void
  /** Integrate fragments, pieces and particles; apply pending visual changes. Call once per frame after `world.update`. */
  update(dt: number): void
  /** Emit particles directly (muzzle flashes, extinguisher foam, tool sparks). */
  emit(kind: DebrisKind | 'fire' | 'flash' | 'foam', point: Vec3, normal: Vec3, count: number, speed?: number): void
  /**
   * Draw a blast that has no exploding part (a grenade, a rocket): the effect (`options.effect`, an id of the effects catalogue, else `generic`
   * scaled by the radius), sound and a shove on pieces in range. Call it next to `world.explode`, which emits no event of its own. A host that
   * already played the effect itself passes `visual: false` and keeps only the shove and the sound.
   */
  explode(point: Vec3, energy: number, radius: number, options?: ExplodeOptions): void
  /** Remove every fragment, decal and particle, restore every bound mesh to its original geometry and colours. */
  clear(): void
  /** Restore one object (after `world.reset`). */
  restore(objectId: string): void
  stats(): { fragments: number; particles: number; pieces: number; decals: number }
  /** Meshes that use the materials of the hole, patch and crack decals, to render once so that the first hit does not build their shader programs in the middle of a frame. */
  warmUpProbes(): WarmUpProbes
  /** Bars of exposed rebar drawn now (`expose` events; one instanced mesh per part). */
  rebarCount(): number
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
