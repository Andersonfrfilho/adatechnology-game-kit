import type { RandomStream } from './random'

export interface GroundFieldOptions {
  /** Side of the deformable patch in metres (the Lab's 60). */
  readonly size?: number
  /** Cells per side (the Lab's 180: 33 cm cells). */
  readonly segments?: number
}

/** The deformable ground the Lab's craters dig into (L60-83): a height field, in float32 like the page, centred on the origin. */
export interface GroundField {
  readonly size: number
  readonly segments: number
  /** Vertices per side. */
  readonly stride: number
  readonly cellSize: number
  /** World coordinate of the first row and column. */
  readonly origin: number
  readonly heights: Float32Array
  /** Goes up on every dent or reset: a renderer redraws its mesh when it changes. */
  readonly version: number
  heightAt(x: number, z: number): number
  /** A bowl with an uneven floor and a raised rim, drawing from `random` like the Lab's `dent`. */
  dent(random: RandomStream, x: number, z: number, radius: number, depth: number): void
  reset(): void
}

const DEFAULT_SIZE = 60
const DEFAULT_SEGMENTS = 180
const MAX_DEPTH = 3
const RIM_REACH = 1.45
const REACH_FACTOR = 1.5

export function createGroundField(options: GroundFieldOptions = {}): GroundField {
  const size = options.size ?? DEFAULT_SIZE
  const segments = options.segments ?? DEFAULT_SEGMENTS
  const stride = segments + 1
  const cellSize = size / segments
  const origin = -size / 2
  const heights = new Float32Array(stride * stride)
  let version = 0

  function heightAt(x: number, z: number): number {
    const fx = (x - origin) / cellSize
    const fz = (z - origin) / cellSize
    if (fx < 0 || fz < 0 || fx >= segments || fz >= segments) return 0
    const column = fx | 0
    const row = fz | 0
    const tx = fx - column
    const tz = fz - row
    const index = row * stride + column
    return (heights[index]! * (1 - tx) + heights[index + 1]! * tx) * (1 - tz) + (heights[index + stride]! * (1 - tx) + heights[index + stride + 1]! * tx) * tz
  }

  function dent(random: RandomStream, x: number, z: number, radius: number, depth: number): void {
    const reach = radius * REACH_FACTOR
    const column0 = Math.max(0, Math.floor((x - reach - origin) / cellSize))
    const column1 = Math.min(segments, Math.ceil((x + reach - origin) / cellSize))
    const row0 = Math.max(0, Math.floor((z - reach - origin) / cellSize))
    const row1 = Math.min(segments, Math.ceil((z + reach - origin) / cellSize))
    const phaseA = random.next() * 6
    const phaseB = random.next() * 6
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const px = origin + column * cellSize
        const pz = origin + row * cellSize
        const distance = Math.hypot(px - x, pz - z)
        const angle = Math.atan2(pz - z, px - x)
        const q = distance / (radius * (1 + 0.13 * Math.sin(angle * 5 + phaseA) + 0.07 * Math.sin(angle * 11 + phaseB)))
        let change = 0
        if (q < 1) change = -depth * (1 - q * q) * (0.85 + random.next() * 0.3)
        else if (q < RIM_REACH) {
          const k = (q - 1) / 0.45
          change = depth * 0.3 * Math.sin(k * Math.PI) * (1 - k * 0.3) * (0.6 + random.next() * 0.8)
        }
        if (!change) continue
        const index = row * stride + column
        heights[index] = Math.max(-MAX_DEPTH, heights[index]! + change)
      }
    }
    version++
  }

  function reset(): void {
    heights.fill(0)
    version++
  }

  return {
    size,
    segments,
    stride,
    cellSize,
    origin,
    heights,
    get version() {
      return version
    },
    heightAt,
    dent,
    reset,
  }
}
