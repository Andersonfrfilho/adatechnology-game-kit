import type { SpriteKindDef } from './kinds'

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

function rgb(hex: number): readonly [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

/** Per-spawn overrides. */
export interface SpriteSpawnOptions {
  /** `0xRRGGBB`: replaces the kind's colour ramp. */
  color?: number
  /** Multiplier on the start size. */
  size?: number
  /** Multiplier on the life. */
  life?: number
  /** Multiplier on the peak alpha. */
  alpha?: number
  /** Non-zero: a `land` sprite (a drip) that reaches the ground calls the owner's `onLand` with this tag. */
  tag?: number
  /** Who hears the landing (see `VfxWorld.onLand`). */
  owner?: string
  /** Height the sprite stops or lands at, instead of the ground's under it (a splash on a table top). */
  floor?: number
  /** Multiplier on the kind's upward acceleration (slow steam). */
  rise?: number
}

export interface KindPoolHost {
  groundAt(x: number, z: number): number
  gravity: number
  land(owner: string, x: number, y: number, z: number, color: number, tag: number): void
}

/** The destruction renderer's old generator (mulberry32), so a seed gives the same sprites. */
export function spriteRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One fixed-size ring of sprites of the game's kinds, in typed arrays a renderer draws as points: `position`, `color`, `alpha` and `size` are what it
 * reads, `drawCount` how many records from the start. Additive and normal blending are two instances.
 */
export class SpriteKindPool {
  live = 0
  /** Records from the start the renderer draws (the highest live index + 1). */
  drawCount = 0
  readonly position: Float32Array
  readonly color: Float32Array
  readonly alpha: Float32Array
  readonly size: Float32Array
  private next = 0
  private high = 0
  private readonly velocity: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly size0: Float32Array
  private readonly alive: Uint8Array
  private readonly kind: Uint8Array
  private readonly seed: Float32Array
  private readonly alphaMul: Float32Array
  private readonly tag: Int32Array
  private readonly owner: Int32Array
  private readonly colorHex: Int32Array
  private readonly rgbStart: Float32Array
  private readonly rgbEnd: Float32Array
  private readonly bounced: Uint8Array
  private readonly floor: Float32Array
  private readonly riseMul: Float32Array

  constructor(
    readonly capacity: number,
    private readonly defs: readonly SpriteKindDef[],
    private readonly owners: string[],
  ) {
    const n = Math.max(1, capacity)
    this.position = new Float32Array(n * 3)
    this.color = new Float32Array(n * 3)
    this.alpha = new Float32Array(n)
    this.size = new Float32Array(n)
    this.velocity = new Float32Array(n * 3)
    this.age = new Float32Array(n)
    this.life = new Float32Array(n)
    this.size0 = new Float32Array(n)
    this.alive = new Uint8Array(n)
    this.kind = new Uint8Array(n)
    this.seed = new Float32Array(n)
    this.alphaMul = new Float32Array(n)
    this.tag = new Int32Array(n)
    this.owner = new Int32Array(n)
    this.colorHex = new Int32Array(n)
    this.rgbStart = new Float32Array(n * 3)
    this.rgbEnd = new Float32Array(n * 3)
    this.bounced = new Uint8Array(n)
    this.floor = new Float32Array(n)
    this.riseMul = new Float32Array(n)
  }

  spawn(kind: number, p: readonly number[], v: readonly number[], random: () => number, options?: SpriteSpawnOptions): void {
    if (this.capacity <= 0) return
    const def = this.defs[kind]!
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    if (this.alive[i]) this.live--
    this.alive[i] = 1
    this.live++
    if (i + 1 > this.high) this.high = i + 1
    this.kind[i] = kind
    this.position.set(p, i * 3)
    this.velocity.set(v, i * 3)
    this.age[i] = 0
    this.life[i] = lerp(def.life[0], def.life[1], random()) * (options?.life ?? 1)
    this.size0[i] = lerp(def.size[0], def.size[1], random()) * (options?.size ?? 1)
    this.seed[i] = random()
    this.alphaMul[i] = options?.alpha ?? 1
    this.tag[i] = options?.tag ?? 0
    this.owner[i] = options?.owner === undefined ? -1 : this.ownerIndex(options.owner)
    this.colorHex[i] = options?.color ?? -1
    this.rgbStart.set(rgb(options?.color ?? def.c0), i * 3)
    this.rgbEnd.set(rgb(options?.color ?? def.c1), i * 3)
    this.bounced[i] = 0
    this.floor[i] = options?.floor ?? Number.NaN
    this.riseMul[i] = options?.rise ?? 1
    this.size[i] = this.size0[i]!
    this.alpha[i] = 0
  }

  private ownerIndex(name: string): number {
    let index = this.owners.indexOf(name)
    if (index < 0) index = this.owners.push(name) - 1
    return index
  }

  private kill(i: number): void {
    if (!this.alive[i]) return
    this.alive[i] = 0
    this.live--
    this.alpha[i] = 0
    this.size[i] = 0
  }

  clear(): void {
    this.alive.fill(0)
    this.alpha.fill(0)
    this.size.fill(0)
    this.live = 0
    this.high = 0
    this.next = 0
    this.drawCount = 0
  }

  /** Shoves the live sprites within `radius` of a point away from it (a blast). */
  push(cx: number, cy: number, cz: number, radius: number, speed: number): void {
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue
      const dx = this.position[i * 3]! - cx
      const dy = this.position[i * 3 + 1]! - cy
      const dz = this.position[i * 3 + 2]! - cz
      const d = Math.hypot(dx, dy, dz)
      if (d > radius || d < 1e-4) continue
      const f = (1 - d / radius) * speed
      this.velocity[i * 3]! += (dx / d) * f
      this.velocity[i * 3 + 1]! += (dy / d) * f
      this.velocity[i * 3 + 2]! += (dz / d) * f
    }
  }

  update(dt: number, host: KindPoolHost): void {
    let top = 0
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue
      const def = this.defs[this.kind[i]!]!
      const age = (this.age[i]! + dt)
      this.age[i] = age
      const life = this.life[i]!
      if (age >= life) {
        this.kill(i)
        continue
      }
      const t = age / life
      const i3 = i * 3
      let vx = this.velocity[i3]!
      let vy = this.velocity[i3 + 1]!
      let vz = this.velocity[i3 + 2]!
      vy += (def.rise * this.riseMul[i]! - def.gravity * host.gravity) * dt
      if (def.flutter) {
        const phase = age * 7 + this.seed[i]! * 40
        vx += Math.sin(phase) * def.flutter * dt
        vz += Math.cos(phase * 1.3) * def.flutter * dt
      }
      if (def.drag > 0) {
        const k = Math.exp(-def.drag * dt)
        vx *= k
        vy *= k
        vz *= k
      }
      const x = this.position[i3]! + vx * dt
      let y = this.position[i3 + 1]! + vy * dt
      const z = this.position[i3 + 2]! + vz * dt
      if (def.ground !== 'none') {
        const own = this.floor[i]!
        const gy = Number.isNaN(own) ? host.groundAt(x, z) + 0.005 : own
        if (y < gy) {
          if (def.ground === 'land') {
            const tag = this.tag[i]!
            const owner = this.owner[i]!
            if (tag !== 0 && owner >= 0) host.land(this.owners[owner]!, x, gy, z, this.colorHex[i]! >= 0 ? this.colorHex[i]! : def.c0, tag)
            this.kill(i)
            continue
          }
          y = gy
          if (def.ground === 'bounce' && !this.bounced[i]) {
            this.bounced[i] = 1
            vy = Math.abs(vy) * 0.35
            vx *= 0.6
            vz *= 0.6
          } else {
            vx = vy = vz = 0
          }
        }
      }
      this.velocity[i3] = vx
      this.velocity[i3 + 1] = vy
      this.velocity[i3 + 2] = vz
      this.position[i3] = x
      this.position[i3 + 1] = y
      this.position[i3 + 2] = z
      this.size[i] = this.size0[i]! * lerp(1, def.grow, t)
      this.color[i3] = lerp(this.rgbStart[i3]!, this.rgbEnd[i3]!, t)
      this.color[i3 + 1] = lerp(this.rgbStart[i3 + 1]!, this.rgbEnd[i3 + 1]!, t)
      this.color[i3 + 2] = lerp(this.rgbStart[i3 + 2]!, this.rgbEnd[i3 + 2]!, t)
      let envelope = t < def.fadeIn ? t / def.fadeIn : 1 - (t - def.fadeIn) / (1 - def.fadeIn)
      if (def.flicker) envelope *= 1 - def.flicker * (0.5 + 0.5 * Math.sin(age * 38 + this.seed[i]! * 50))
      this.alpha[i] = clamp(envelope, 0, 1) * def.alpha * this.alphaMul[i]!
      top = i + 1
    }
    this.high = top
    this.drawCount = top
  }
}

export { rgb as hexToUnitRgb }
