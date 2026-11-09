import type * as THREE_NS from 'three'
import { BATCHED_LAYER, createStaticBatcher } from '@adatechnology/game-render-three'
import type { StaticBatcher } from '@adatechnology/game-render-three'

/** How the debris at rest is drawn in batches (`RendererOptions.settledBatches`). */
export interface SettledBatchOptions {
  /** Draw the debris at rest in batches (default true). */
  readonly enabled?: boolean
  /** Debris meshes at rest outside a batch before the batches are made again (default 16). */
  readonly minMeshes?: number
  /** Seconds at least between two makings of the batches (default 1). */
  readonly intervalSeconds?: number
  /** Milliseconds of merging per update while the batches are made (default 2): what is not merged yet draws on its own meanwhile. */
  readonly budgetMs?: number
  /** Vertices of the largest mesh a batch takes (default 4000): a bigger one (a slab come down whole) draws on its own. */
  readonly maxVertices?: number
}

/** What the batches of the debris at rest hold now (`DestructionRenderer.settledBatchStats`). */
export interface SettledBatchStats {
  /** Draws of the batches: one per material, shadow and attribute set. */
  readonly batches: number
  /** Debris meshes drawn by a batch instead of on their own. */
  readonly batched: number
}

export const SETTLED_BATCH_DEFAULTS: Required<SettledBatchOptions> = { enabled: true, minMeshes: 16, intervalSeconds: 1, budgetMs: 2, maxVertices: 4000 }

/** Keys of a material that say nothing about how it draws. */
const IDENTITY_KEYS: ReadonlySet<string> = new Set(['uuid', 'id', 'name', 'version', 'userData', '_listeners'])

type Described = { readonly isColor?: boolean; readonly isTexture?: boolean; readonly isVector2?: boolean; getHexString?: () => string; readonly uuid?: string; readonly x?: number; readonly y?: number }

/** One setting of a material as text, or undefined when it cannot be told (a function, an unknown object): then the material is batched only with itself. */
const settingText = (value: unknown): string | undefined => {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return String(value)
  if (typeof value !== 'object') return undefined
  const described = value as Described
  if (described.isColor === true) return described.getHexString?.()
  if (described.isTexture === true) return described.uuid
  if (described.isVector2 === true) return `${described.x},${described.y}`
  // `defines` and the like: plain data
  if (Object.getPrototypeOf(value) === Object.prototype) {
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * What tells materials apart for the batches: its type and every setting it has. The renderer gives a mesh it chars or tints its own copy of its material, so the debris of one
 * wall or one kind of board carries many copies that draw the same; equal keys put them in one batch.
 */
export const materialKey = (material: THREE_NS.Material): string => {
  const record = material as unknown as Record<string, unknown>
  const settings: string[] = [material.type]
  for (const key of Object.keys(record).sort()) {
    // data a host keeps on it may mean anything to the host: such a material is batched only with itself
    if (key === 'userData' && Object.keys(material.userData).length > 0) return material.uuid
    if (IDENTITY_KEYS.has(key)) continue
    const text = settingText(record[key])
    if (text === undefined) return material.uuid
    settings.push(`${key}=${text}`)
  }
  return settings.join('|')
}

/** Whether a debris mesh at rest can be drawn by a batch: one opaque material, its own camera layer, not too big. */
export const isBatchableDebris = (mesh: THREE_NS.Mesh, maxVertices: number): boolean => {
  const material = mesh.material
  if (Array.isArray(material) || material.transparent) return false
  // a mesh another batcher already draws (the host's, `createStaticBatcher`) is left to it
  if (mesh.layers.isEnabled(BATCHED_LAYER)) return false
  return (mesh.geometry.attributes.position?.count ?? Infinity) <= maxVertices
}

/**
 * The debris at rest (pieces and fragments asleep) drawn as a batch per material instead of a draw each (`createStaticBatcher` of game-render-three). Only the drawing changes:
 * every mesh stays where it lies, with its collision, and the moment one moves, is hit, dented, hidden or removed it draws on its own again. The batches are made again,
 * from all the debris at rest, once enough of it lies outside them; the old ones are disposed.
 */
export class SettledBatches {
  private readonly options: Required<SettledBatchOptions>
  private batcher: StaticBatcher | null = null
  /** The meshes given to the batcher when it was made. */
  private members = new Set<THREE_NS.Mesh>()
  private sinceMade = Infinity

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly scene: THREE_NS.Scene,
    options: SettledBatchOptions = {},
  ) {
    this.options = { ...SETTLED_BATCH_DEFAULTS, ...options }
  }

  /** Gives back to its own draw whatever changed, and makes the batches again when `atRest` (the debris meshes at rest) has enough outside them. Once per frame, after the bodies moved. */
  update(dt: number, atRest: () => THREE_NS.Mesh[]): void {
    this.batcher?.update()
    this.sinceMade += dt
    if (!this.options.enabled || this.sinceMade < this.options.intervalSeconds) return
    const meshes = atRest().filter((mesh) => isBatchableDebris(mesh, this.options.maxVertices) || this.batched(mesh))
    const outside = meshes.length - (this.batcher?.stats().batched ?? 0)
    if (outside < this.options.minMeshes) return
    this.make(meshes)
  }

  stats(): SettledBatchStats {
    const stats = this.batcher?.stats()
    return { batches: this.batcher ? this.batcher.group.children.filter((child) => child.visible).length : 0, batched: stats?.batched ?? 0 }
  }

  /**
   * Something happened to one of `meshes` (a blow, fire, char): if any is drawn by a batch, every mesh draws on its own again at once and the batches are made again after
   * `intervalSeconds`. A change the batcher cannot see (a colour written in place) never shows late.
   */
  release(meshes: readonly THREE_NS.Mesh[]): void {
    if (this.members.size === 0 || !meshes.some((mesh) => this.batched(mesh))) return
    this.clear()
    this.sinceMade = 0
  }

  /** Every debris mesh draws on its own again and the batches are disposed. */
  clear(): void {
    this.batcher?.dispose()
    this.batcher = null
    this.members = new Set()
    this.sinceMade = Infinity
  }

  /** Drawn by one of these batches now (given to it, and not given back). */
  private batched(mesh: THREE_NS.Mesh): boolean {
    return this.members.has(mesh) && mesh.layers.isEnabled(BATCHED_LAYER)
  }

  private make(meshes: THREE_NS.Mesh[]): void {
    this.batcher?.dispose()
    const take = new Set(meshes)
    this.members = take
    this.batcher = createStaticBatcher(this.THREE, this.scene, { include: (mesh) => take.has(mesh), budgetMs: this.options.budgetMs, materialKey })
    this.batcher.group.name = 'settled-debris-batches'
    this.sinceMade = 0
  }
}
