import type { MutableVec3 } from '../random'
import { coneDirection, drawRange } from './direction'
import type { DebrisSpawn, WorkshopContext } from './types'

const CAPACITY = 500
const GRAVITY = 9.8
const QUARTER_TURN = 1.5708
const FADE_SECONDS = 0.5
const DEFAULT_SIZE = [0.05, 0.05, 0.05] as const
const DEFAULT_SPIN = 12
const DEFAULT_COLOR = 0x888888
const DEFAULT_LIFE = 8
const DEFAULT_BOUNCE = 0.3
const FULL_TURN_DRAWN = 6

export interface DebrisPiece {
  on: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  sx: number
  sy: number
  sz: number
  rx: number
  ry: number
  rz: number
  ax: number
  ay: number
  az: number
  life: number
  bounce: number
  rest: boolean
  color: number
}

function createPiece(): DebrisPiece {
  return { on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, rx: 0, ry: 0, rz: 0, ax: 0, ay: 0, az: 0, life: 0, bounce: 0, rest: false, color: DEFAULT_COLOR }
}

/** The Workshop's physics debris (W248-263): 500 boxes in a ring buffer, the newest overwriting the oldest, that tumble, bounce, settle on a face and shrink away. */
export class DebrisPool {
  readonly pieces: DebrisPiece[] = Array.from({ length: CAPACITY }, createPiece)
  count = 0
  private next = 0
  private readonly direction: MutableVec3 = { x: 0, y: 0, z: 0 }

  constructor(private readonly context: WorkshopContext) {}

  spawn(options: DebrisSpawn): void {
    const random = this.context.random
    const piece = this.pieces[this.next++ % CAPACITY]!
    coneDirection(random, options.dir, options.cone ?? 3.2, this.direction)
    const speed = drawRange(random, options.sp)
    const size = options.size ?? DEFAULT_SIZE
    const scale = options.k ? drawRange(random, options.k) : 1
    const box = options.box
    const spin = options.spin || DEFAULT_SPIN
    piece.on = true
    piece.x = options.p[0] + (box ? random.between(-box[0], box[0]) : 0)
    piece.y = options.p[1] + (box ? random.between(-box[1], box[1]) : 0)
    piece.z = options.p[2] + (box ? random.between(-box[2], box[2]) : 0)
    piece.vx = this.direction.x * speed + (options.v ? options.v[0] : 0)
    piece.vy = this.direction.y * speed + (options.v ? options.v[1] : 0)
    piece.vz = this.direction.z * speed + (options.v ? options.v[2] : 0)
    piece.sx = (size[0] as number) * scale
    piece.sy = (size[1] as number) * scale
    piece.sz = (size[2] as number) * scale
    piece.rx = random.between(0, FULL_TURN_DRAWN)
    piece.ry = random.between(0, FULL_TURN_DRAWN)
    piece.rz = random.between(0, FULL_TURN_DRAWN)
    piece.ax = random.between(-1, 1) * spin
    piece.ay = random.between(-1, 1) * spin
    piece.az = random.between(-1, 1) * spin
    piece.life = options.life || DEFAULT_LIFE
    piece.bounce = options.bounce ?? DEFAULT_BOUNCE
    piece.rest = false
    piece.color = options.c ?? DEFAULT_COLOR
  }

  clear(): void {
    for (const piece of this.pieces) piece.on = false
    this.count = 0
  }

  update(dt: number): void {
    this.count = 0
    for (const piece of this.pieces) {
      if (!piece.on) continue
      this.count++
      piece.life -= dt
      if (piece.life <= 0) {
        piece.on = false
        continue
      }
      if (!piece.rest) this.move(piece, dt)
    }
  }

  /** Scale at the end of its life, 1 until the last half second (the renderer's `sh`). */
  static fade(piece: DebrisPiece): number {
    return Math.min(1, piece.life / FADE_SECONDS)
  }

  private move(piece: DebrisPiece, dt: number): void {
    piece.vy -= GRAVITY * dt
    piece.x += piece.vx * dt
    piece.y += piece.vy * dt
    piece.z += piece.vz * dt
    piece.rx += piece.ax * dt
    piece.ry += piece.ay * dt
    piece.rz += piece.az * dt
    const groundHeight = this.context.groundAt(piece.x, piece.z) + Math.min(piece.sx, piece.sy, piece.sz) * 0.5
    if (piece.y >= groundHeight) return
    piece.y = groundHeight
    piece.vy *= -piece.bounce
    piece.vx *= 0.55
    piece.vz *= 0.55
    piece.ax *= 0.5
    piece.ay *= 0.5
    piece.az *= 0.5
    if (Math.abs(piece.vy) < 0.5 && Math.hypot(piece.vx, piece.vz) < 0.3) {
      piece.rest = true
      piece.rx = Math.round(piece.rx / QUARTER_TURN) * QUARTER_TURN
      piece.rz = Math.round(piece.rz / QUARTER_TURN) * QUARTER_TURN
    }
  }
}
