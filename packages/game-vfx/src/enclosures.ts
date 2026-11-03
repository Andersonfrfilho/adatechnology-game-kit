import { lehmer } from './random'
import type { RandomStream } from './random'
import type { Vec3Like } from './types'

/** A box in the frame of a {@link VfxEnclosure}: offset from its centre along its axes, half size, and how much gets through (absent: open). */
export interface VfxEnclosureBox {
  readonly center: Vec3Like
  readonly halfSize: Vec3Like
  /** Share per second of what presses on it that gets through (a bullet hole). Absent: open, everything passes. */
  readonly rate?: number
}

/**
 * A closed space the smoke, dust and steam do not cross (a car cabin, a closed room): a turned box whose walls let them through only at `openings`
 * and seep at `leak` elsewhere. The same shape as `Enclosure` of `@adatechnology/game-contracts`.
 */
export interface VfxEnclosure {
  readonly center: Vec3Like
  readonly halfSize: Vec3Like
  /** Unit quaternion `[x, y, z, w]` (default not turned). */
  readonly orientation?: readonly [number, number, number, number]
  readonly openings?: readonly VfxEnclosureBox[]
  /** Share per second of what presses on a closed wall that seeps through (default 0: sealed). */
  readonly leak?: number
}

/** What a particle that was stopped at a wall ends up with: where it is now and the wall's outward... or inward normal it pressed on, in world space. */
export interface ConfineResult {
  x: number
  y: number
  z: number
  /** Unit normal of the wall, pointing back to where the particle came from: the caller takes the velocity into it away. */
  nx: number
  ny: number
  nz: number
}

/** Stops what the air carries at the walls of the closed spaces. `confine` answers `true` and fills `out` when a step was stopped. */
export interface Confiner {
  /** No space is declared: callers skip the work. */
  readonly empty: boolean
  /**
   * The step of one particle from `(x0, y0, z0)` to `(x1, y1, z1)` over `dt` seconds. `pad` (metres) keeps an outside particle that far off the
   * walls (a puff is a ball, not a point: its middle stops before its edge goes through the glass).
   */
  confine(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pad: number, dt: number): boolean
  readonly out: ConfineResult
}

interface Space {
  readonly cx: number
  readonly cy: number
  readonly cz: number
  readonly hx: number
  readonly hy: number
  readonly hz: number
  /** Rows of the rotation, local = R^T * (p - c), world = R * local. */
  readonly r: Float64Array
  readonly radius: number
  readonly openings: readonly VfxEnclosureBox[]
  readonly leak: number
}

/** How far inside a wall a stopped particle is put back, metres. */
const SKIN = 0.005
/** The largest pad a particle gets: a big puff still comes up to the car. */
const MAX_PAD = 0.45

function rotation(q: readonly [number, number, number, number] | undefined): Float64Array {
  const [x, y, z, w] = q ?? [0, 0, 0, 1]
  const n = Math.hypot(x, y, z, w) || 1
  const qx = x / n
  const qy = y / n
  const qz = z / n
  const qw = w / n
  return new Float64Array([
    1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw),
    2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw),
    2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy),
  ])
}

/**
 * The closed spaces of a world by id. Each step of a carried particle that would cross a wall is tested: through an opening it passes (a hole only at
 * its rate), through a closed wall only at the leak; otherwise it stays on its side, put back on the wall and sliding along it.
 */
export class Enclosures implements Confiner {
  private readonly spaces = new Map<string, Space>()
  private list: Space[] = []
  private readonly random: RandomStream
  readonly out: ConfineResult = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 }
  private readonly l0 = new Float64Array(3)
  private readonly l1 = new Float64Array(3)
  private readonly q = new Float64Array(3)

  constructor(seed = 0x51ed) {
    this.random = lehmer(seed)
  }

  get empty(): boolean {
    return this.list.length === 0
  }

  get size(): number {
    return this.list.length
  }

  /** Declares, moves or (with `null`) ends the space `id`. */
  set(id: string, enclosure: VfxEnclosure | null): void {
    if (!enclosure) {
      if (this.spaces.delete(id)) this.list = [...this.spaces.values()]
      return
    }
    const [hx, hy, hz] = enclosure.halfSize
    const space: Space = {
      cx: enclosure.center[0], cy: enclosure.center[1], cz: enclosure.center[2],
      hx: Math.abs(hx), hy: Math.abs(hy), hz: Math.abs(hz),
      r: rotation(enclosure.orientation),
      radius: Math.hypot(hx, hy, hz),
      openings: enclosure.openings ?? [],
      leak: Math.max(0, enclosure.leak ?? 0),
    }
    const old = this.spaces.get(id)
    this.spaces.set(id, space)
    const at = old ? this.list.indexOf(old) : -1
    if (at >= 0) this.list[at] = space
    else this.list.push(space)
  }

  get(id: string): VfxEnclosure | undefined {
    const s = this.spaces.get(id)
    if (!s) return undefined
    return { center: [s.cx, s.cy, s.cz], halfSize: [s.hx, s.hy, s.hz], openings: s.openings, leak: s.leak }
  }

  ids(): string[] {
    return [...this.spaces.keys()]
  }

  clear(): void {
    this.spaces.clear()
    this.list = []
  }

  /** Whether a point is inside any space (on the inside of its walls). */
  inside(x: number, y: number, z: number): boolean {
    for (const s of this.list) {
      this.toLocal(s, x, y, z, this.l0)
      if (Math.abs(this.l0[0]!) <= s.hx && Math.abs(this.l0[1]!) <= s.hy && Math.abs(this.l0[2]!) <= s.hz) return true
    }
    return false
  }

  private toLocal(s: Space, x: number, y: number, z: number, out: Float64Array): void {
    const dx = x - s.cx
    const dy = y - s.cy
    const dz = z - s.cz
    const r = s.r
    out[0] = r[0]! * dx + r[3]! * dy + r[6]! * dz
    out[1] = r[1]! * dx + r[4]! * dy + r[7]! * dz
    out[2] = r[2]! * dx + r[5]! * dy + r[8]! * dz
  }

  /** Passes at `rate` per second. */
  private chance(rate: number, dt: number): boolean {
    return rate > 0 && this.random.next() < 1 - Math.exp(-rate * dt)
  }

  /** The opening the wall point `q` (local) is in lets it through now. */
  private through(s: Space, q: Float64Array, dt: number): boolean {
    for (const o of s.openings) {
      if (Math.abs(q[0]! - o.center[0]) > o.halfSize[0] || Math.abs(q[1]! - o.center[1]) > o.halfSize[1] || Math.abs(q[2]! - o.center[2]) > o.halfSize[2]) continue
      if (o.rate === undefined || this.chance(o.rate, dt)) return true
    }
    return this.chance(s.leak, dt)
  }

  confine(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pad: number, dt: number): boolean {
    const list = this.list
    if (list.length === 0) return false
    const p = Math.min(Math.max(0, pad), MAX_PAD)
    const l0 = this.l0
    const l1 = this.l1
    const q = this.q
    for (const s of list) {
      const reach = s.radius + p + 0.05
      const dx = x1 - s.cx
      const dy = y1 - s.cy
      const dz = z1 - s.cz
      if (dx * dx + dy * dy + dz * dz > reach * reach) {
        const ex = x0 - s.cx
        const ey = y0 - s.cy
        const ez = z0 - s.cz
        if (ex * ex + ey * ey + ez * ez > reach * reach) continue
      }
      this.toLocal(s, x0, y0, z0, l0)
      this.toLocal(s, x1, y1, z1, l1)
      const h = [s.hx, s.hy, s.hz] as const
      const in0 = Math.abs(l0[0]!) <= s.hx && Math.abs(l0[1]!) <= s.hy && Math.abs(l0[2]!) <= s.hz
      let axis = 0
      let sign = 1
      if (in0) {
        if (Math.abs(l1[0]!) <= s.hx && Math.abs(l1[1]!) <= s.hy && Math.abs(l1[2]!) <= s.hz) continue
        for (let a = 0; a < 3; a++) q[a] = Math.min(h[a]!, Math.max(-h[a]!, l1[a]!))
        if (this.through(s, q, dt)) continue
        // leaving through a closed wall: back onto the inside of the wall it went furthest through
        let worst = -Infinity
        for (let a = 0; a < 3; a++) {
          const over = Math.abs(l1[a]!) - h[a]!
          if (over > worst) {
            worst = over
            axis = a
          }
        }
        sign = l1[axis]! < 0 ? -1 : 1
        // back inside on every axis it went out on (a corner crosses two walls at once)
        for (let a = 0; a < 3; a++) l1[a] = Math.min(h[a]! - SKIN, Math.max(-(h[a]! - SKIN), l1[a]!))
        sign = -sign
      } else {
        // a particle that starts within the pad (a puff born at the door) is only held at the wall itself
        const padded0 = Math.abs(l0[0]!) <= s.hx + p && Math.abs(l0[1]!) <= s.hy + p && Math.abs(l0[2]!) <= s.hz + p
        const bound = padded0 ? 0 : p
        if (!(Math.abs(l1[0]!) <= s.hx + bound && Math.abs(l1[1]!) <= s.hy + bound && Math.abs(l1[2]!) <= s.hz + bound)) continue
        for (let a = 0; a < 3; a++) q[a] = Math.min(h[a]!, Math.max(-h[a]!, l1[a]!))
        if (this.through(s, q, dt)) continue
        // entering through a closed wall: back onto the outside of the wall it came from
        let worst = -Infinity
        for (let a = 0; a < 3; a++) {
          const over = Math.abs(l0[a]!) - (h[a]! + bound)
          if (over > worst) {
            worst = over
            axis = a
          }
        }
        sign = l0[axis]! < 0 ? -1 : 1
        l1[axis] = sign * (h[axis]! + bound + SKIN)
      }
      const r = s.r
      const out = this.out
      out.x = s.cx + r[0]! * l1[0]! + r[1]! * l1[1]! + r[2]! * l1[2]!
      out.y = s.cy + r[3]! * l1[0]! + r[4]! * l1[1]! + r[5]! * l1[2]!
      out.z = s.cz + r[6]! * l1[0]! + r[7]! * l1[1]! + r[8]! * l1[2]!
      // the column `axis` of R is that local axis in world space
      out.nx = r[axis]! * sign
      out.ny = r[3 + axis]! * sign
      out.nz = r[6 + axis]! * sign
      return true
    }
    return false
  }
}

/** Takes the part of a velocity that runs into the wall away (what is left slides along it). */
export function slideAlong(out: ConfineResult, vx: number, vy: number, vz: number): [number, number, number] {
  const into = vx * out.nx + vy * out.ny + vz * out.nz
  if (into >= 0) return [vx, vy, vz]
  return [vx - into * out.nx, vy - into * out.ny, vz - into * out.nz]
}
