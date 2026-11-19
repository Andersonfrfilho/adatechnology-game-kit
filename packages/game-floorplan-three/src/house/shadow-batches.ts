import { DEFERRED_QUEUE_ID, markKitOrigin } from '@adatechnology/game-contracts'
import { createStaticBatchQueue, createStaticBatcher } from '@adatechnology/game-render-three'
import type { StaticBatchQueue, StaticBatcher, ThreeLib } from '@adatechnology/game-render-three'
import type { Object3D } from 'three'

/**
 * The house's shadow in a few draws. Each of its ~400 casting meshes (walls, slabs, roof, furniture) drew its own shadow, one draw per mesh per
 * frame in the sun's pass (~270 in the room's house, 2026-11-18). The still ones cast from a handful of shadow-only batches instead; the meshes
 * keep drawing themselves for the camera, so nothing changes on screen. A piece that breaks, falls, opens or is hidden casts its own shadow again,
 * of its new shape, the frame it changes (`createStaticBatcher` with `shadowOnly`).
 */
export const HOUSE_SHADOW_BUDGET_MS = 2
/** A queue for the shadow batches of an owner's houses (the room makes one, registers `deferredQueue()` with its frame budget and passes it as `shadowQueue` to every house). */
export function createHouseShadowQueue(): StaticBatchQueue {
  return createStaticBatchQueue({ id: DEFERRED_QUEUE_ID.HOUSE_SHADOW_BATCH })
}
/** The most vertices per shadow batch: one batch is merged in one frame (~3 ms for 16k on a laptop core; 65k took 5 to 10 ms), and the shadow camera culls each by its own part of the house. */
export const HOUSE_SHADOW_BATCH_VERTICES = 16384
/** Once this share of the batched meshes cast on their own again (a blast took a wall, the cut view hid a floor), the batches are made again from what stands, after this quiet time. */
export const HOUSE_SHADOW_REBATCH_SHARE = 0.25
export const HOUSE_SHADOW_REBATCH_AFTER_MS = 2000

export type HouseShadowBatches = {
  /** Once per frame, before the render. */
  update(): void
  readonly batcher: StaticBatcher | null
  dispose(): void
}

export type HouseShadowBatchesOptions = {
  /** The clock (ms) the quiet time is read from (default `performance.now`). */
  readonly now?: () => number
  /** The queue the chunks are merged by (`createHouseShadowQueue`, shared by the houses of an owner). Default: a queue of its own that this house drains in `update` with `HOUSE_SHADOW_BUDGET_MS`. */
  readonly queue?: StaticBatchQueue
}

/** Shadow-only batches of the still meshes under `root`, made over the frames (`HOUSE_SHADOW_BUDGET_MS` each) on the first `update`. */
export function createHouseShadowBatches(THREE: ThreeLib, root: Object3D, options: HouseShadowBatchesOptions = {}): HouseShadowBatches {
  const now = options.now ?? (() => performance.now())
  const queue = options.queue ?? createHouseShadowQueue()
  let batcher: StaticBatcher | null = null
  let changedAt = Number.NEGATIVE_INFINITY
  const make = (): StaticBatcher => {
    // a mesh the house marks as its own (a pivot that swings, a piece that falls) may still be batched: it leaves the batch when it moves
    const made = createStaticBatcher(THREE, root, { shadowOnly: true, queue, budgetMs: HOUSE_SHADOW_BUDGET_MS, maxVertices: HOUSE_SHADOW_BATCH_VERTICES, include: (mesh) => mesh.userData.noShadowBatch !== true })
    made.group.name = 'house-shadow-batches'
    // the batches copy the pieces' triangles: a hit test reads the pieces, never the copy
    made.group.userData.noSurfaceRay = true
    markKitOrigin(made.group, { owner: 'game-floorplan-three', kind: 'structure', id: root.name || 'house' })
    return made
  }
  return {
    update() {
      if (!batcher) {
        batcher = make()
        return
      }
      if (batcher.update() > 0) changedAt = now()
      const { batched, released } = batcher.stats()
      if (released === 0 || released < (batched + released) * HOUSE_SHADOW_REBATCH_SHARE || now() - changedAt < HOUSE_SHADOW_REBATCH_AFTER_MS) return
      batcher.dispose()
      batcher = make()
    },
    get batcher() {
      return batcher
    },
    dispose() {
      batcher?.dispose()
      batcher = null
    },
  }
}
