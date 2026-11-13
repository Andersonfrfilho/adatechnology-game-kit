import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, Material, PhysicsWorld, Quat, ShapeDesc } from '@adatechnology/game-physics'

/** A fixed box of what does not move, as it is drawn: centre, half sizes and rotation (world). */
export interface StaticSolid {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation: Quat
}

interface Fixed {
  /** The list the host gave (by reference: the same list is the same boxes), and the boxes of it with a size, as the body holds them. */
  solids: readonly StaticSolid[]
  kept: readonly StaticSolid[]
  id: BodyId | null
}

/** Equal within this (m, and for the rotation's components) is the same box: the host measures again to the same numbers in new arrays. */
const SAME = 1e-6
/** How far past a box that changed (m) what lies there is woken. */
const WAKE_MARGIN = 0.05

const near = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > SAME) return false
  return true
}

const sameBox = (a: StaticSolid, b: StaticSolid): boolean => near(a.center, b.center) && near(a.half, b.half) && near(a.rotation, b.rotation)

const hasSize = (s: StaticSolid): boolean => s.half[0] > 0 && s.half[1] > 0 && s.half[2] > 0

/**
 * The host's fixed things in the engine: one static body per object, of its drawn boxes turned as drawn. A new list for an object is compared box by box with
 * the last: unchanged, nothing is done; changed, the body keeps its id and takes the new boxes in place (`setShape`: what touches its unchanged boxes keeps its
 * contacts), and only what lies by a box that went, came or moved wakes. Made again on every new list, a leaking water tank's box woke the whole house each
 * update (the room's `single_storey_a` after a blast).
 */
export class EngineStatics {
  readonly bodies = new Map<string, Fixed>()
  /** The bodies whose boxes changed in the last `lay`, made or gone: what an outside input under a piece is, for a probe. */
  readonly changed = new Set<BodyId>()

  constructor(
    private readonly world: PhysicsWorld,
    private readonly material: Material,
  ) {}

  /** Whether the engine has a body for the object's boxes (what the kit's sweep need not set a piece back from). */
  has(objectId: string): boolean {
    return (this.bodies.get(objectId)?.id ?? null) !== null
  }

  lay(now: ReadonlyMap<string, readonly StaticSolid[]>): void {
    this.changed.clear()
    for (const [id, f] of this.bodies) {
      if (now.has(id)) continue
      this.wakeAround(f.kept)
      if (f.id !== null) {
        this.changed.add(f.id)
        this.world.removeBody(f.id)
      }
      this.bodies.delete(id)
    }
    for (const [id, solids] of now) {
      const f = this.bodies.get(id)
      if (f?.solids === solids) continue
      const kept = solids.filter(hasSize)
      if (!f) {
        const body = kept.length === 0 ? null : this.make(kept)
        if (body !== null) this.changed.add(body)
        this.bodies.set(id, { solids, kept, id: body })
        continue
      }
      f.solids = solids
      if (kept.length === f.kept.length && kept.every((s, i) => sameBox(s, f.kept[i]))) continue
      this.wakeChanged(f.kept, kept)
      this.reshape(f, kept)
    }
  }

  clear(): void {
    for (const f of this.bodies.values()) if (f.id !== null) this.world.removeBody(f.id)
    this.bodies.clear()
    this.changed.clear()
  }

  private reshape(f: Fixed, kept: readonly StaticSolid[]): void {
    f.kept = kept
    if (kept.length === 0) {
      if (f.id !== null) {
        this.changed.add(f.id)
        this.world.removeBody(f.id)
      }
      f.id = null
      return
    }
    if (f.id === null) f.id = this.make(kept)
    else this.world.setShape(f.id, this.shapeOf(kept))
    this.changed.add(f.id)
  }

  private shapeOf(kept: readonly StaticSolid[]): ShapeDesc {
    return { kind: 'compound', children: kept.map((s, i) => ({ shape: { kind: 'box', half: s.half }, position: s.center, rotation: s.rotation, tag: i })) }
  }

  private make(kept: readonly StaticSolid[]): BodyId {
    return this.world.createBody({ shape: this.shapeOf(kept), motion: 'static', position: [0, 0, 0], material: this.material, user: 0 })
  }

  /** What lies by a box that is not in both lists (went, came, or moved: in one list at one place, in the other at another) wakes. */
  private wakeChanged(before: readonly StaticSolid[], after: readonly StaticSolid[]): void {
    for (const s of before) if (!after.some((t) => sameBox(s, t))) this.wakeAround([s])
    for (const s of after) if (!before.some((t) => sameBox(s, t))) this.wakeAround([s])
  }

  private wakeAround(solids: readonly StaticSolid[]): void {
    for (const s of solids) {
      const r = Math.hypot(s.half[0], s.half[1], s.half[2]) + WAKE_MARGIN
      this.world.wakeInBox([s.center[0] - r, s.center[1] - r, s.center[2] - r], [s.center[0] + r, s.center[1] + r, s.center[2] + r])
    }
  }
}
