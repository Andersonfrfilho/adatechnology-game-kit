import type { Arena } from './arena'
import type { SceneryFollower } from './types'

/** Widest scenery footprint (m) the renderer's drawn boxes stand for (as its own limit for fixed meshes); a wider one keeps its collider. */
const SOLID_SPAN = 3
/**
 * The body going through a hole, by heights over the feet (m) and the share of the player's radius each takes: a leg lifted over a sill of half a metre,
 * hips and shoulders, the head stooped to 1.6 m (a man climbs through a breach 0.8 m wide and 1.3 m tall, not only a doorway).
 */
const BODY_SLICES: ReadonlyArray<readonly [number, number, number]> = [[0.5, 1.0, 0.5], [1.0, 1.5, 0.75], [1.5, 1.6, 0.45]]

export interface SceneryBlocking {
  /** The scenery the renderer draws stops the player by what is drawn now (a fallen bookcase is walked onto, not its old footprint); what is too wide for the renderer's boxes keeps its footprint. */
  readonly drawnScenery: (colliderIndex: number) => boolean
  /** Scenery whose follower says where its drawing stops a body (a wall with a breach): the player walks by that, not by its footprint. */
  readonly followedBody: (id: string | null) => SceneryFollower | null
  readonly followerOwns: (objectId: string) => boolean
  /** Where the drawing of a followed wall stops a body at (x, z): a body is not a cylinder, it goes through a hole by its legs, its shoulders and its head, each as wide as it is. */
  readonly followedBodyBlocks: (x: number, z: number, radius: number) => boolean
}

/** The room's objects, as far as the scenery's followers go. */
export interface SceneryEntries {
  get(id: string): { readonly follower?: SceneryFollower | null } | undefined
  values(): Iterable<{ readonly follower?: SceneryFollower | null }>
}

export function createSceneryBlocking(arena: Arena, entries: SceneryEntries, feet: () => number): SceneryBlocking {
  return {
    drawnScenery(i) {
      const c = arena.colliders[i]
      return arena.colliderIds[i] !== null && c[2] - c[0] <= SOLID_SPAN && c[3] - c[1] <= SOLID_SPAN
    },
    followedBody(id) {
      const follower = id === null ? null : entries.get(id)?.follower
      return follower?.blocks ? follower : null
    },
    followerOwns(objectId) {
      for (const e of entries.values()) if (e.follower?.owns?.(objectId)) return true
      return false
    },
    followedBodyBlocks(x, z, radius) {
      for (const e of entries.values()) {
        const blocks = e.follower?.blocks
        if (!blocks) continue
        for (const [from, to, share] of BODY_SLICES) if (blocks(x, z, radius * share, feet() + from, feet() + to)) return true
      }
      return false
    },
  }
}
