import { hexToRgb } from '../color'
import type { MutableVec3 } from '../random'
import { lerp } from '../vector'
import { coneDirection, drawRange } from './direction'
import type { SpriteSpawn, WorkshopContext } from './types'

const FLOATS_PER_VECTOR = 3
const SEGMENT_FLOATS = 6
const TAIL_BRIGHTNESS = 0.15

/** The Workshop's `Streaks` (W223-245): short lines that follow their own velocity (sparks, tracers, rain-like glints). Same swap-with-last pool as `SpritePool`. */
export class StreakPool {
  count = 0
  readonly point: Float32Array
  readonly velocity: Float32Array
  readonly colorStart: Float32Array
  readonly colorEnd: Float32Array
  readonly life: Float32Array
  readonly maxLife: Float32Array
  readonly length: Float32Array
  readonly gravity: Float32Array
  readonly drag: Float32Array
  readonly groundMode: Uint8Array
  readonly startAlpha: Float32Array
  /** Two end points and two colours per line: what the renderer draws. */
  readonly segment: Float32Array
  readonly segmentColor: Float32Array
  private readonly vectorArrays: readonly Float32Array[]
  private readonly scalarArrays: readonly (Float32Array | Uint8Array)[]
  private readonly direction: MutableVec3 = { x: 0, y: 0, z: 0 }

  constructor(readonly capacity: number, private readonly context: WorkshopContext) {
    const vectorArray = (): Float32Array => new Float32Array(capacity * FLOATS_PER_VECTOR)
    const scalarArray = (): Float32Array => new Float32Array(capacity)
    this.point = vectorArray()
    this.velocity = vectorArray()
    this.colorStart = vectorArray()
    this.colorEnd = vectorArray()
    this.life = scalarArray()
    this.maxLife = scalarArray()
    this.length = scalarArray()
    this.gravity = scalarArray()
    this.drag = scalarArray()
    this.startAlpha = scalarArray()
    this.groundMode = new Uint8Array(capacity)
    this.segment = new Float32Array(capacity * SEGMENT_FLOATS)
    this.segmentColor = new Float32Array(capacity * SEGMENT_FLOATS)
    this.vectorArrays = [this.point, this.velocity, this.colorStart, this.colorEnd]
    this.scalarArrays = [this.life, this.maxLife, this.length, this.gravity, this.drag, this.groundMode, this.startAlpha]
  }

  spawn(options: SpriteSpawn): void {
    if (this.count >= this.capacity) return
    const random = this.context.random
    const index = this.count++
    const offset = index * FLOATS_PER_VECTOR
    let [x, y, z] = options.p
    if (options.box) {
      x += random.between(-options.box[0], options.box[0])
      y += random.between(-options.box[1], options.box[1])
      z += random.between(-options.box[2], options.box[2])
    }
    this.point[offset] = x
    this.point[offset + 1] = y
    this.point[offset + 2] = z
    coneDirection(random, options.dir, options.cone ?? 3.2, this.direction)
    const speed = drawRange(random, options.sp)
    this.velocity[offset] = this.direction.x * speed + (options.v ? options.v[0] : 0)
    this.velocity[offset + 1] = this.direction.y * speed + (options.v ? options.v[1] : 0)
    this.velocity[offset + 2] = this.direction.z * speed + (options.v ? options.v[2] : 0)
    const start = hexToRgb(options.c0 ?? 0xffd080)
    const end = options.c1 != null ? hexToRgb(options.c1) : start
    for (let channel = 0; channel < FLOATS_PER_VECTOR; channel++) {
      this.colorStart[offset + channel] = start[channel]
      this.colorEnd[offset + channel] = end[channel]
    }
    this.life[index] = this.maxLife[index] = drawRange(random, options.life || 0.4)
    this.length[index] = options.len || 0.02
    this.gravity[index] = options.g || 0
    this.drag[index] = options.drag || 0
    this.groundMode[index] = options.gnd || 0
    this.startAlpha[index] = options.a ?? 1
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

  update(dt: number): void {
    const { point, velocity } = this
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
      point[offset] += velocity[offset] * dt
      point[offset + 1] += velocity[offset + 1] * dt
      point[offset + 2] += velocity[offset + 2] * dt
      if (this.groundMode[index]) {
        const groundHeight = this.context.groundAt(point[offset], point[offset + 2])
        if (point[offset + 1] < groundHeight) {
          if (this.groundMode[index] === 1) {
            this.kill(index)
            continue
          }
          point[offset + 1] = groundHeight + 0.001
          velocity[offset + 1] *= -0.35
          velocity[offset] *= 0.6
          velocity[offset + 2] *= 0.6
        }
      }
      const length = this.length[index]
      const alpha = this.startAlpha[index] * (1 - age)
      const at = index * SEGMENT_FLOATS
      this.segment[at] = point[offset]
      this.segment[at + 1] = point[offset + 1]
      this.segment[at + 2] = point[offset + 2]
      this.segment[at + 3] = point[offset] - velocity[offset] * length
      this.segment[at + 4] = point[offset + 1] - velocity[offset + 1] * length
      this.segment[at + 5] = point[offset + 2] - velocity[offset + 2] * length
      for (let channel = 0; channel < FLOATS_PER_VECTOR; channel++) {
        const shade = lerp(this.colorStart[offset + channel], this.colorEnd[offset + channel], age) * alpha
        this.segmentColor[at + channel] = shade
        this.segmentColor[at + 3 + channel] = shade * TAIL_BRIGHTNESS
      }
    }
  }
}
