import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyDesc, BodyId, Material, Quat, SeamWorld, ShapeDesc } from '@adatechnology/game-physics'

/** The triangles of a fixed drawn part where no box fits it (world space, three indices a triangle). */
export interface StaticMesh {
  readonly vertices: Float32Array
  readonly indices: Uint32Array
}

/** A fixed box of what does not move, as it is drawn: centre, half sizes and rotation (world). With `mesh` the part is those triangles, and the box is the one around them. */
export interface StaticSolid {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation: Quat
  readonly mesh?: StaticMesh
  /** Names the part across lists (a part measured again is the same part): without it, the place in the list. */
  readonly key?: string
}

interface Held {
  solid: StaticSolid
  id: BodyId
}

interface Fixed {
  /** The list the host gave (by reference: the same list is the same parts), and the parts the engine holds. */
  solids: readonly StaticSolid[]
  held: Map<string, Held>
  /** Meshes left for a later update. */
  waiting: number
  /** Every part was made once: from then on what lies by a part that came or went wakes (when the house is first filled, nothing lies there). */
  settled: boolean
}

/** Triangles of meshes made per update (about a millisecond for a thousand): an object with hundreds of conduits and frames fills in over a few updates, not one frame. */
const TRIANGLES_PER_UPDATE = 1200

/** Equal within this (m, and for the rotation's components) is the same box: the host measures again to the same numbers in new arrays. */
const SAME = 1e-6
/** How far past a box that changed (m) what lies there is woken. */
const WAKE_MARGIN = 0.05

const near = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > SAME) return false
  return true
}

const sameMesh = (a: StaticMesh | undefined, b: StaticMesh | undefined): boolean => {
  if (!a || !b) return a === b
  return a.indices.length === b.indices.length && a.vertices.length === b.vertices.length && near(a.vertices, b.vertices) && a.indices.every((v, i) => v === b.indices[i])
}

const sameBox = (a: StaticSolid, b: StaticSolid): boolean => a === b || (near(a.center, b.center) && near(a.half, b.half) && near(a.rotation, b.rotation) && sameMesh(a.mesh, b.mesh))

export const sameSolids = (a: readonly StaticSolid[], b: readonly StaticSolid[]): boolean => a.length === b.length && a.every((s, i) => sameBox(s, b[i]))

const hasSize = (s: StaticSolid): boolean => s.half[0] > 0 && s.half[1] > 0 && s.half[2] > 0

const shapeOf = (s: StaticSolid): ShapeDesc => (s.mesh ? { kind: 'trimesh', vertices: s.mesh.vertices, indices: s.mesh.indices } : { kind: 'box', half: s.half })

/**
 * The host's fixed things in the engine: one static body per drawn part of an object, a box turned as drawn or the triangles where no box fits. A new list for an object is
 * compared part by part with the last: an unchanged part is left alone, a changed one keeps its body and takes the new shape in place (`setShape`: what touches it keeps its
 * contacts), a part that went loses its body and a new one gets its own, so an object of hundreds of parts costs one body when one part breaks, and a leaking water tank's box wakes
 * only what lies by it (the room's `single_storey_a` after a blast). What wakes is only what lies by a part that went, came or moved. A mesh costs to build: each update
 * makes new ones up to `TRIANGLES_PER_UPDATE` triangles and leaves the rest for the next (boxes are made at once).
 */
export class EngineStatics {
  readonly bodies = new Map<string, Fixed>()
  /** The bodies that were made, changed or went in the last `lay`: what an outside input under a piece is, for a probe. */
  readonly changed = new Set<BodyId>()
  /** Every body it holds now: what a piece made or put is checked against (`EnginePieces.outOfStatics`; the ground has its own rule). */
  readonly ids = new Set<BodyId>()

  constructor(
    private readonly world: SeamWorld,
    private readonly material: Material,
  ) {}

  /** Whether the engine has a body for the object's drawn parts (what the kit's sweep need not set a piece back from). */
  has(objectId: string): boolean {
    const f = this.bodies.get(objectId)
    return f !== undefined && f.held.size > 0
  }

  lay(now: ReadonlyMap<string, readonly StaticSolid[]>): void {
    this.changed.clear()
    for (const [id, f] of this.bodies) {
      if (now.has(id)) continue
      for (const h of f.held.values()) this.release(h, f.settled)
      this.bodies.delete(id)
    }
    const budget = { triangles: TRIANGLES_PER_UPDATE }
    for (const [id, solids] of now) {
      const f = this.bodies.get(id)
      if (f?.solids === solids && f.waiting === 0) continue
      const fixed = f ?? { solids, held: new Map<string, Held>(), waiting: 0, settled: false }
      this.bodies.set(id, fixed)
      fixed.solids = solids
      this.fit(fixed, budget)
    }
  }

  clear(): void {
    for (const f of this.bodies.values()) for (const h of f.held.values()) this.drop(h.id)
    this.bodies.clear()
    this.changed.clear()
  }

  /** The object's parts of a list by name, the ones with a size only. */
  private named(solids: readonly StaticSolid[]): Map<string, StaticSolid> {
    const out = new Map<string, StaticSolid>()
    solids.forEach((s, i) => {
      if (!hasSize(s)) return
      let key = s.key ?? String(i)
      while (out.has(key)) key += '+'
      out.set(key, s)
    })
    return out
  }

  private fit(f: Fixed, budget: { triangles: number }): void {
    const next = this.named(f.solids)
    for (const [key, h] of f.held) {
      if (next.has(key)) continue
      this.release(h, f.settled)
      f.held.delete(key)
    }
    const fresh: Array<{ key: string; solid: StaticSolid }> = []
    let waiting = 0
    for (const [key, solid] of next) {
      const h = f.held.get(key)
      if (!h) {
        const cost = solid.mesh ? solid.mesh.indices.length / 3 : 0
        // a mesh over what is left waits, unless it is the first of the update (one bigger than the whole budget is made alone)
        if (cost > budget.triangles && budget.triangles < TRIANGLES_PER_UPDATE) {
          waiting++
          continue
        }
        budget.triangles -= cost
        fresh.push({ key, solid })
        continue
      }
      if (h.solid === solid || sameBox(h.solid, solid)) continue
      if (f.settled) {
        this.wakeAround(h.solid)
        this.wakeAround(solid)
      }
      this.reshape(h, solid)
    }
    if (fresh.length > 0) {
      const ids = this.world.createBodies(fresh.map((x) => this.describe(x.solid)))
      fresh.forEach((x, i) => {
        const id = ids[i]
        f.held.set(x.key, { solid: x.solid, id })
        this.ids.add(id)
        this.changed.add(id)
        if (f.settled) this.wakeAround(x.solid)
      })
    }
    f.waiting = waiting
    if (waiting === 0) f.settled = true
  }

  private reshape(h: Held, solid: StaticSolid): void {
    h.solid = solid
    if (!solid.mesh) this.world.setPose(h.id, solid.center, solid.rotation, false)
    this.world.setShape(h.id, shapeOf(solid))
    this.changed.add(h.id)
  }

  private describe(solid: StaticSolid): BodyDesc {
    return { shape: shapeOf(solid), motion: 'static', position: solid.mesh ? [0, 0, 0] : solid.center, ...(solid.mesh ? {} : { rotation: solid.rotation }), material: this.material, user: 0 }
  }

  private release(h: Held, wake: boolean): void {
    if (wake) this.wakeAround(h.solid)
    this.changed.add(h.id)
    this.drop(h.id)
  }

  private drop(id: BodyId): void {
    this.ids.delete(id)
    this.world.removeBody(id)
  }

  private wakeAround(s: StaticSolid): void {
    const r = Math.hypot(s.half[0], s.half[1], s.half[2]) + WAKE_MARGIN
    this.world.wakeInBox([s.center[0] - r, s.center[1] - r, s.center[2] - r], [s.center[0] + r, s.center[1] + r, s.center[2] + r])
  }
}
