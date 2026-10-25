import { SpriteKindPool, spriteRandom } from './kind-pool'
import type { SpriteSpawnOptions } from './kind-pool'
import { SPRITE_KINDS } from './kinds'
import type { SpriteKind, SpriteKindDef } from './kinds'

type Vec3 = readonly [number, number, number]

export interface SpriteKindSystemOptions {
  /** Most live sprites at once (additive takes 40 %, normal the rest). */
  readonly capacity: number
  /** Count multiplier for bursts (0.6 on low quality). */
  readonly density: number
  readonly seed: number
  readonly groundAt: (x: number, z: number) => number
  readonly gravity: number
  readonly kinds?: Readonly<Record<string, SpriteKindDef>>
}

export type LandListener = (x: number, y: number, z: number, color: number, tag: number) => void

/**
 * The game's sprites of fixed kinds (debris, sparks, smoke, steam, drips...), burst or spawned one by one: two pooled rings, additive and normal, that
 * a renderer draws as points. This is the destruction renderer's old particle system with the maths unchanged and the drawing taken out.
 */
export class SpriteKindSystem {
  readonly additive: SpriteKindPool
  readonly normal: SpriteKindPool
  private readonly random: () => number
  private readonly ids: readonly string[]
  private readonly defs: readonly SpriteKindDef[]
  private readonly index = new Map<string, number>()
  private readonly owners: string[] = []
  private readonly listeners = new Map<string, LandListener>()

  constructor(private readonly options: SpriteKindSystemOptions) {
    const kinds: Readonly<Record<string, SpriteKindDef>> = options.kinds ?? SPRITE_KINDS
    this.ids = Object.keys(kinds)
    this.defs = this.ids.map((id) => kinds[id]!)
    this.ids.forEach((id, at) => this.index.set(id, at))
    const additiveCapacity = Math.floor(options.capacity * 0.4)
    this.additive = new SpriteKindPool(additiveCapacity, this.defs, this.owners)
    this.normal = new SpriteKindPool(options.capacity - additiveCapacity, this.defs, this.owners)
    this.random = spriteRandom(options.seed)
  }

  get capacity(): number {
    return this.additive.capacity + this.normal.capacity
  }

  get live(): number {
    return this.additive.live + this.normal.live
  }

  /** Hears the landing of the drips of `owner` (the ones spawned with `{ owner, tag }`). Returns the function that stops listening. */
  onLand(owner: string, listener: LandListener): () => void {
    this.listeners.set(owner, listener)
    return () => {
      if (this.listeners.get(owner) === listener) this.listeners.delete(owner)
    }
  }

  private kindOf(kind: string): { index: number; def: SpriteKindDef } {
    const index = this.index.get(kind)
    if (index === undefined) throw new Error(`unknown sprite kind ${kind}`)
    return { index, def: this.defs[index]! }
  }

  /** One sprite with an explicit velocity. */
  spawn(kind: SpriteKind | string, point: Vec3, velocity: Vec3, options?: SpriteSpawnOptions): void {
    const { index, def } = this.kindOf(kind)
    ;(def.additive ? this.additive : this.normal).spawn(index, point, velocity, this.random, options)
  }

  /** `count` sprites leaving `point` around `normal` at about `speed` m/s. */
  burst(kind: SpriteKind | string, point: Vec3, normal: Vec3, count: number, speed = 1, options?: SpriteSpawnOptions): void {
    const { def } = this.kindOf(kind)
    const n = Math.max(0, Math.round(count * this.options.density))
    const rnd = this.random
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
    const nx = normal[0] / length
    const ny = normal[1] / length
    const nz = normal[2] / length
    for (let k = 0; k < n; k++) {
      const u = rnd() * 2 - 1
      const phase = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const rx = s * Math.cos(phase)
      const ry = u
      const rz = s * Math.sin(phase)
      let dx = nx * def.cone + rx * (1 - def.cone)
      let dy = ny * def.cone + ry * (1 - def.cone)
      let dz = nz * def.cone + rz * (1 - def.cone)
      // a little scatter even for a pure cone, and never push into the surface for debris
      dx += rx * 0.35
      dy += ry * 0.35
      dz += rz * 0.35
      const l = Math.hypot(dx, dy, dz) || 1
      const sp = speed * (0.35 + 0.65 * rnd())
      const jitter = 0.01 + (def.size[1] > 0.5 ? 0.15 : 0.02)
      this.spawn(
        def.id,
        [point[0] + (rnd() - 0.5) * jitter, point[1] + (rnd() - 0.5) * jitter, point[2] + (rnd() - 0.5) * jitter],
        [(dx / l) * sp, (dy / l) * sp, (dz / l) * sp],
        options,
      )
    }
  }

  /** Blast wave: shoves the live sprites away from a point. */
  push(point: Vec3, radius: number, speed: number): void {
    this.additive.push(point[0], point[1], point[2], radius, speed)
    this.normal.push(point[0], point[1], point[2], radius, speed)
  }

  update(dt: number): void {
    const host = {
      groundAt: this.options.groundAt,
      gravity: this.options.gravity,
      land: (owner: string, x: number, y: number, z: number, color: number, tag: number) => this.listeners.get(owner)?.(x, y, z, color, tag),
    }
    if (this.additive.live > 0 || this.additive.drawCount > 0) this.additive.update(dt, host)
    if (this.normal.live > 0 || this.normal.drawCount > 0) this.normal.update(dt, host)
  }

  clear(): void {
    this.additive.clear()
    this.normal.clear()
  }
}
