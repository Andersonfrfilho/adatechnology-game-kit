import type { Rgb } from '../color'
import { OrderedPool } from '../pool'
import type { RandomStream } from '../random'
import type { Glow } from './glows'

/** Debris with embers (L366-400). The last block is what the renderer reads: the colour already blended towards the glow of a hot piece. */
export interface Chunk {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  rz: number
  ax: number
  ay: number
  az: number
  sx: number
  sy: number
  sz: number
  color: Rgb
  plate: boolean
  hot: boolean
  rest: boolean
  blood: boolean
  splat: boolean
  t: number
  trail: number
  glow: Glow | null
  rng: RandomStream
  outColor: [number, number, number]
}

export type ChunkInit = Partial<Pick<Chunk, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz' | 'sx' | 'sy' | 'sz' | 'color' | 'plate' | 'hot' | 'blood'>>

const DEFAULT_COLOR: Rgb = [0x55 / 255, 0x55 / 255, 0x55 / 255]

/** A glow that follows a chunk keeps the spot the chunk had when the chunk leaves the pool, as the Lab's does (the object stays where it was). */
function freezeFollowingGlow(chunk: Chunk): void {
  const glow = chunk.glow
  chunk.glow = null
  if (!glow || glow.follow !== chunk) return
  glow.x = chunk.x + glow.fx
  glow.y = chunk.y + glow.fy
  glow.z = chunk.z + glow.fz
  glow.fx = glow.fy = glow.fz = 0
  glow.follow = null
}

export function createChunkPool(capacity: number, placeholder: RandomStream): OrderedPool<Chunk> {
  return new OrderedPool<Chunk>(
    capacity,
    () => ({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, ax: 0, ay: 0, az: 0, sx: 0.2, sy: 0.2, sz: 0.2, color: DEFAULT_COLOR, plate: false, hot: false, rest: false,
      blood: false, splat: false, t: 0, trail: 0, glow: null, rng: placeholder, outColor: [0, 0, 0],
    }),
    freezeFollowingGlow,
  )
}

function firstResting(chunks: readonly Chunk[]): number {
  const index = chunks.findIndex((chunk) => chunk.rest)
  return index >= 0 ? index : 0
}

/** `chunk()` (L368-376). Draws rotation and spin first (six numbers, always), then lets the caller add what it wants; a full pool drops a resting piece, else the oldest. */
export function spawnChunk(pool: OrderedPool<Chunk>, random: RandomStream, init: ChunkInit): Chunk {
  const chunk = pool.acquire(firstResting)
  chunk.x = init.x ?? 0
  chunk.y = init.y ?? 0
  chunk.z = init.z ?? 0
  chunk.vx = init.vx ?? 0
  chunk.vy = init.vy ?? 0
  chunk.vz = init.vz ?? 0
  chunk.rx = random.next() * 6
  chunk.ry = random.next() * 6
  chunk.rz = random.next() * 6
  chunk.ax = random.between(-12, 12)
  chunk.ay = random.between(-12, 12)
  chunk.az = random.between(-12, 12)
  chunk.sx = init.sx ?? 0.2
  chunk.sy = init.sy ?? 0.2
  chunk.sz = init.sz ?? 0.2
  chunk.color = init.color ?? DEFAULT_COLOR
  chunk.plate = init.plate ?? false
  chunk.hot = init.hot ?? false
  chunk.rest = false
  chunk.blood = init.blood ?? false
  chunk.splat = false
  chunk.t = 0
  chunk.trail = 0
  chunk.glow = null
  chunk.rng = random
  return chunk
}

export const HOT_COLOR: Rgb = [1, 0.42, 0.1]
export const HOT_SECONDS = 1.6
const HOT_BLEND = 0.85

/** `_hotCol` (L399-400): the colour of a hot piece, blended towards the glow while it is young. */
export function colorOfChunk(chunk: Chunk): readonly [number, number, number] {
  if (!chunk.hot || chunk.t >= HOT_SECONDS) {
    chunk.outColor[0] = chunk.color[0]
    chunk.outColor[1] = chunk.color[1]
    chunk.outColor[2] = chunk.color[2]
    return chunk.outColor
  }
  const amount = Math.max(0, 1 - chunk.t / HOT_SECONDS) * HOT_BLEND
  chunk.outColor[0] = chunk.color[0] + (HOT_COLOR[0] - chunk.color[0]) * amount
  chunk.outColor[1] = chunk.color[1] + (HOT_COLOR[1] - chunk.color[1]) * amount
  chunk.outColor[2] = chunk.color[2] + (HOT_COLOR[2] - chunk.color[2]) * amount
  return chunk.outColor
}
