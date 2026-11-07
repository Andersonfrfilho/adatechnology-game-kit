import type * as THREE_NS from 'three'
import { settlementAt } from '@adatechnology/game-destruction'
import type { PartSettlement, Vec3 } from '@adatechnology/game-destruction'
import type { HostVis, MeshVis, PartVis } from './internal'
import type { Visuals } from './visual'

/** Seconds a settlement takes to show: the ground slumps into the hole over about a second, it does not jump. */
export const SETTLE_SECONDS = 1.2
/** Seconds between two redraws of a settling part (a merged house mesh is written again each time). */
const SETTLE_REDRAW = 0.1

interface Settling {
  pv: PartVis
  root: THREE_NS.Object3D
  /** The settlement drawn when this one started, and where it goes. */
  start: PartSettlement | undefined
  target: PartSettlement
  /** Share of the way already drawn, 0..1, and seconds since it started. */
  shown: number
  elapsed: number
  lastDrawn: number
}

const dropOf = (line: PartSettlement | undefined, point: Vec3): number => (line ? settlementAt(line, point) : 0)
const sameLine = (a: PartSettlement | undefined, b: PartSettlement): boolean =>
  !!a && a.drop.length === b.drop.length && a.drop.every((v, k) => v === b.drop[k]) && a.from.every((v, k) => v === b.from[k]) && a.to.every((v, k) => v === b.to[k])

/**
 * Draws the settlement of the parts the ground went down under (`PartState.settlement`): each point of a part goes down by the drop at its place along
 * the settlement line (so a part that went down more at one end tilts), smoothly over `SETTLE_SECONDS`, its marks with it.
 */
export class SettlementView {
  private readonly moving = new Map<PartVis, Settling>()
  private readonly local: THREE_NS.Vector3
  private readonly inverse: THREE_NS.Matrix4

  constructor(THREE: typeof THREE_NS, private readonly visuals: Visuals) {
    this.local = new THREE.Vector3()
    this.inverse = new THREE.Matrix4()
  }

  /** The parts of an object (`root` draws it in object space) and their settlement now: those that changed start going to it. */
  follow(root: THREE_NS.Object3D, parts: Iterable<readonly [PartVis, PartSettlement | undefined]>): void {
    for (const [pv, target] of parts) {
      if (!target || pv.gone !== 'none' || sameLine(this.moving.get(pv)?.target ?? pv.settled, target)) continue
      this.finish(pv)
      this.moving.set(pv, { pv, root, start: pv.settled, target, shown: 0, elapsed: 0, lastDrawn: -SETTLE_REDRAW })
    }
  }

  get count(): number {
    return this.moving.size
  }

  update(dt: number): void {
    for (const s of this.moving.values()) {
      s.elapsed += dt
      const done = s.elapsed >= SETTLE_SECONDS
      if (!done && s.elapsed - s.lastDrawn < SETTLE_REDRAW) continue
      s.lastDrawn = s.elapsed
      const t = Math.min(1, s.elapsed / SETTLE_SECONDS)
      this.draw(s, t * t * (3 - 2 * t))
      if (done) {
        s.pv.settled = s.target
        this.moving.delete(s.pv)
      }
    }
  }

  /** Draws the rest of a part's settlement at once (it is about to be split off or put back). */
  finish(pv: PartVis): void {
    const s = this.moving.get(pv)
    if (!s) return
    this.draw(s, 1)
    pv.settled = s.target
    this.moving.delete(pv)
  }

  /** Forget a part without drawing (it was put back as it was). */
  forget(pv: PartVis): void {
    this.moving.delete(pv)
  }

  clear(): void {
    this.moving.clear()
  }

  private draw(s: Settling, shown: number): void {
    const share = shown - s.shown
    if (share <= 0) return
    s.shown = shown
    s.root.updateWorldMatrix(true, false)
    this.inverse.copy(s.root.matrixWorld).invert()
    const dropAt = (world: THREE_NS.Vector3): number => {
      const p = this.local.copy(world).applyMatrix4(this.inverse)
      const at: Vec3 = [p.x, p.y, p.z]
      return (dropOf(s.target, at) - dropOf(s.start, at)) * share
    }
    // the meshes the part shares with others are written once each
    const writes = new Map<HostVis | MeshVis, MeshVis>()
    for (const mv of s.pv.meshes) if (this.visuals.sink(mv, dropAt, false)) writes.set(mv.host ?? mv, mv)
    for (const mv of writes.values()) this.visuals.commit(mv)
  }
}
