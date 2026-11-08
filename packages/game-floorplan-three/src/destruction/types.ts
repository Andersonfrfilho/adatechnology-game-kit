import type * as THREE_NS from 'three'
import type { DeferredQueue, DestructibleSpec, DestructionEvent, PartState, ObjectState, HitResult } from '@adatechnology/game-contracts'
import type { DestructionWorld } from '@adatechnology/game-destruction'
import type { DestructibleSpecOptions, StructurePart, Support } from '@adatechnology/game-floorplan-structure'
import type { BoundMeshes, HouseDestructionRenderer } from '../adapter-shapes.js'

/** The pieces of a house the destruction renderer draws; the breach view reads them from the structure the house assembled. */
export interface BreachViewOptions {
  house: THREE_NS.Object3D
  structure: HouseStructure
  /** The destructible spec the world was given (units and layers per part). */
  spec: () => DestructibleSpec | null
  /** Repaint damaged walls from `flush` (once per wall per frame, within a time budget) instead of on every event. */
  deferPaint?: boolean
  /** Milliseconds `flush` may spend repainting walls (at least one wall is always repainted). Default `Infinity`: every damaged wall is painted at the flush. */
  paintBudgetMs?: number
}

/** A collider of the house as the destruction reads it: the piece it stands for and the damageable that takes its hits. */
export interface DestructionCollider {
  type: string
  piece?: string
  damageable?: unknown
}

/** What draws a piece of the structure: a loose group (`obj`), or a range of a merged mesh (`whole` when the range is the whole mesh). */
export type StructureMeshItem =
  | { obj: THREE_NS.Object3D; mesh?: undefined; whole?: undefined; v0?: undefined; v1?: undefined; i0?: undefined; i1?: undefined }
  | { obj?: undefined; mesh: THREE_NS.Mesh; v0: number; v1: number; i0: number; i1: number; whole: boolean }

/** A drawn range of a merged mesh (a `StructureMeshItem` with a mesh). */
export type StructureRangeItem = Extract<StructureMeshItem, { mesh: THREE_NS.Mesh }>

/** A piece of the house's structure: the part of the plan (or a tagged piece the plan does not have), how many meshes draw it, and what it holds. */
export type HouseStructurePart = StructurePart & {
  meshes: number
  extra: boolean
  contains?: unknown
  explodes?: unknown
  tags?: string[]
  thickness?: number
  fill?: number
  [field: string]: unknown
}

/** A support of the house's structure (`extra` when the house added it: what is fitted into a wall rests on it). */
export type HouseSupport = Support & { extra?: boolean }

/** `house.structure`: the parts and supports of the house, the meshes that draw each part and the destructible spec. */
export interface HouseStructure {
  system: string
  parts: HouseStructurePart[]
  supports: HouseSupport[]
  levels: number[]
  elevation: number
  byId: Map<string, HouseStructurePart>
  meshesOf(id: string): StructureMeshItem[]
  /** The piece a raycast hit (object and face index): merged mesh by its ranges, single-piece mesh or loose group by userData. */
  pieceId(obj: THREE_NS.Object3D | null, face?: number | null): string | null
  spec(options?: DestructibleSpecOptions | null): DestructibleSpec
  [field: string]: unknown
}

/** What a wall's damage view changes at once: an opening, one chip or several (a blast), or a spall. */
export interface BreachChange {
  opening?: { center: number[]; radius: number }
  chip?: { center: number[]; size: number[]; rotation: number[] }
  chips?: { center: number[]; size: number[]; rotation: number[] }[]
  spall?: { center: number[]; radius: number }
}

/** The breach view of a house (`createBreachView`): draws the units that come out of its walls. */
export interface BreachView {
  stage(event: DestructionEvent): boolean
  spall(event: DestructionEvent): boolean
  claim(): void
  chip(event: DestructionEvent): boolean
  drop(partId: string): void
  setLod(level: number): void
  restore(): void
  flush(budgetMs?: number): number
  release(): void
  deferredQueue(): DeferredQueue
  has(partId: string): boolean
  standing(partId: string): { spans: readonly { a: number; b: number; y0: number; y1: number }[]; alongU: boolean; start: number } | null
  statistics(): { walls: number; gone: number; craters: number; flakes: number; units: number }
}

/** What undoes `follow`: the house's drawing back, the listener gone, and the per-frame painting. */
export interface HouseFollow {
  restore(): void
  dispose(): void
  update(): void
  /**
   * Whether the wall stops a body standing at the world point (x, z) with `radius`, from height `y0` to `y1` (world): what is drawn there now, so a body
   * walks through a breach and over the units left below `y0`, also in a piece of it that came loose and stands.
   */
  blocks(x: number, z: number, radius: number, y0: number, y1: number): boolean
  /** Whether the world object `objectId` is this wall or a piece that came loose of it: what `blocks` answers for, in place of its box. */
  owns(objectId: string): boolean
}

/** `house.destruction`: the adapter of the house to the destruction world (`cfg.destruction`). */
export interface HouseDestruction {
  world: DestructionWorld | null
  id: string | null
  active: boolean
  renderer: HouseDestructionRenderer | null
  spec: DestructibleSpec | null
  specOptions: DestructibleSpecOptions | null
  breach: BreachView
  onEvent(fn: (e: DestructionEvent) => void): () => void
  hide(id: string): void
  dropPiece(id: string): void
  restore(): void
  sync(): void
  ranges(): Record<string, BoundMeshes[]>
  activate(world?: DestructionWorld | null, specOptions?: DestructibleSpecOptions | null): HouseDestruction
  deactivate(): void
  follow(world: DestructionWorld, id: string, spec: DestructibleSpec): HouseFollow
  piece(id: string): PartState | null
  state(): ObjectState | null
  reset(): void
  strike(pid: string, point: { x: number; y: number; z: number } | null | undefined, type: string | undefined, amount: number | null | undefined, d?: { hpMax?: number } | null): HitResult | null
  animate(dt: number): void
  statistics(): { hiddenPieces: number; falling: number; fragments: number; breached: ReturnType<BreachView['statistics']> }
}
