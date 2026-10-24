import { hexToRgb } from '../color'
import { lerp } from '../vector'
import type { MutableVec3, RandomStream } from '../random'
import { coneDirection, drawRange, randomUnit } from './direction'
import type { SpriteSpawn, WorkshopContext } from './types'

/** Colour, size and alpha of a particle at its current age: what the renderer reads (`col`, `siz`, `alp`). */
const DEFAULT_FADE_IN = 0.1
const FLOATS_PER_VECTOR = 3
const BYTE_MAX = 255

export interface DecalFromSprite {
  (x: number, y: number, z: number, size: number, color: number, options: { readonly grow: number; readonly fluid: 'blood' }): void
}

/**
 * The Workshop's `PSys` (W179-220): a pool of sprites in typed arrays, as the page keeps them. A dead record is replaced by the last one, so the order
 * in the arrays is the page's, and the golden hashes the arrays as they are. Additive and normal-blend systems are two instances.
 */
export class SpritePool {
  count = 0
  readonly position: Float32Array
  readonly velocity: Float32Array
  readonly colorStart: Float32Array
  readonly colorEnd: Float32Array
  readonly life: Float32Array
  readonly maxLife: Float32Array
  readonly startSize: Float32Array
  readonly growth: Float32Array
  readonly startAlpha: Float32Array
  readonly gravity: Float32Array
  readonly drag: Float32Array
  readonly fadeIn: Float32Array
  readonly groundMode: Uint8Array
  readonly decalSize: Float32Array
  /** Written by `update`: what the renderer draws. */
  readonly color: Float32Array
  readonly size: Float32Array
  readonly alpha: Float32Array
  private readonly vectorArrays: readonly Float32Array[]
  private readonly scalarArrays: readonly (Float32Array | Uint8Array)[]
  private readonly direction: MutableVec3 = { x: 0, y: 0, z: 0 }
  private readonly unit: MutableVec3 = { x: 0, y: 0, z: 0 }

  constructor(readonly capacity: number, private readonly context: WorkshopContext) {
    const vectorArray = (): Float32Array => new Float32Array(capacity * FLOATS_PER_VECTOR)
    const scalarArray = (): Float32Array => new Float32Array(capacity)
    this.position = vectorArray()
    this.velocity = vectorArray()
    this.colorStart = vectorArray()
    this.colorEnd = vectorArray()
    this.color = vectorArray()
    this.life = scalarArray()
    this.maxLife = scalarArray()
    this.startSize = scalarArray()
    this.growth = scalarArray()
    this.startAlpha = scalarArray()
    this.gravity = scalarArray()
    this.drag = scalarArray()
    this.fadeIn = scalarArray()
    this.decalSize = scalarArray()
    this.size = scalarArray()
    this.alpha = scalarArray()
    this.groundMode = new Uint8Array(capacity)
    this.vectorArrays = [this.position, this.velocity, this.colorStart, this.colorEnd]
    this.scalarArrays = [this.life, this.maxLife, this.startSize, this.growth, this.startAlpha, this.gravity, this.drag, this.fadeIn, this.groundMode, this.decalSize]
  }

  spawn(options: SpriteSpawn): void {
    if (this.count >= this.capacity) return
    const random: RandomStream = this.context.random
    const index = this.count++
    const offset = index * FLOATS_PER_VECTOR
    let [x, y, z] = options.p
    if (options.r) {
      randomUnit(random, this.unit)
      const reach = Math.cbrt(random.next()) * options.r
      x += this.unit.x * reach
      y += this.unit.y * reach * (options.flat ? 0 : 1)
      z += this.unit.z * reach
    }
    if (options.box) {
      x += random.between(-options.box[0], options.box[0])
      y += random.between(-options.box[1], options.box[1])
      z += random.between(-options.box[2], options.box[2])
    }
    this.position[offset] = x
    this.position[offset + 1] = y
    this.position[offset + 2] = z
    coneDirection(random, options.dir, options.cone ?? 3.2, this.direction)
    const speed = drawRange(random, options.sp)
    this.velocity[offset] = this.direction.x * speed + (options.v ? options.v[0] : 0)
    this.velocity[offset + 1] = this.direction.y * speed + (options.v ? options.v[1] : 0)
    this.velocity[offset + 2] = this.direction.z * speed + (options.v ? options.v[2] : 0)
    const start = hexToRgb(options.c0 ?? 0xffffff)
    const end = options.c1 != null ? hexToRgb(options.c1) : start
    for (let channel = 0; channel < FLOATS_PER_VECTOR; channel++) {
      this.colorStart[offset + channel] = start[channel]
      this.colorEnd[offset + channel] = end[channel]
    }
    this.life[index] = this.maxLife[index] = drawRange(random, options.life || 1)
    this.startSize[index] = drawRange(random, options.size || 0.1)
    this.growth[index] = options.grow || 1
    this.startAlpha[index] = options.a ?? 1
    this.gravity[index] = options.g || 0
    this.drag[index] = options.drag || 0
    this.fadeIn[index] = options.fi ?? DEFAULT_FADE_IN
    this.groundMode[index] = options.gnd || 0
    this.decalSize[index] = options.ds ? drawRange(random, options.ds) : 0.1
  }

  kill(index: number): void {
    const last = --this.count
    if (index === last) return
    for (const array of this.vectorArrays) {
      for (let component = 0; component < FLOATS_PER_VECTOR; component++) array[index * FLOATS_PER_VECTOR + component] = array[last * FLOATS_PER_VECTOR + component]
    }
    for (const array of this.scalarArrays) array[index] = array[last]
  }

  clear(): void {
    this.count = 0
  }

  update(dt: number, leaveDecal: DecalFromSprite): void {
    const { position, velocity } = this
    for (let index = this.count - 1; index >= 0; index--) {
      this.life[index] -= dt
      if (this.life[index] <= 0) {
        this.kill(index)
        continue
      }
      const offset = index * FLOATS_PER_VECTOR
      const age = 1 - this.life[index] / this.maxLife[index]
      velocity[offset + 1] -= this.gravity[index] * dt
      const factor = Math.max(0, 1 - this.drag[index] * dt)
      velocity[offset] *= factor
      velocity[offset + 1] *= factor
      velocity[offset + 2] *= factor
      position[offset] += velocity[offset] * dt
      position[offset + 1] += velocity[offset + 1] * dt
      position[offset + 2] += velocity[offset + 2] * dt
      const mode = this.groundMode[index]
      if (mode) {
        const groundHeight = this.context.groundAt(position[offset], position[offset + 2])
        if (position[offset + 1] < groundHeight) {
          if (mode === 1) {
            this.kill(index)
            continue
          }
          if (mode === 2) {
            position[offset + 1] = groundHeight + 0.001
            velocity[offset + 1] *= -0.3
            velocity[offset] *= 0.55
            velocity[offset + 2] *= 0.55
          }
          if (mode === 3) {
            if (this.context.quality.level < 2) {
              const red = (this.colorStart[offset] * BYTE_MAX) << 16
              const green = (this.colorStart[offset + 1] * BYTE_MAX) << 8
              leaveDecal(position[offset], groundHeight, position[offset + 2], this.decalSize[index], red | green | (this.colorStart[offset + 2] * BYTE_MAX), { grow: 0.15, fluid: 'blood' })
            }
            this.kill(index)
            continue
          }
        }
      }
      this.size[index] = this.startSize[index] * (1 + (this.growth[index] - 1) * age)
      const fadeIn = this.fadeIn[index]
      this.alpha[index] = this.startAlpha[index] * (fadeIn > 0 && age < fadeIn ? age / fadeIn : 1 - (age - fadeIn) / (1 - fadeIn))
      for (let channel = 0; channel < FLOATS_PER_VECTOR; channel++) this.color[offset + channel] = lerp(this.colorStart[offset + channel], this.colorEnd[offset + channel], age)
    }
  }
}
