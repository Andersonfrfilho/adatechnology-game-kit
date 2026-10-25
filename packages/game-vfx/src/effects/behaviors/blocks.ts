import { impact } from '../builders/blood'
import type { Behavior } from '../behavior'

const COLUMNS = 6
const ROWS = 5
const ORIGIN = [-2.2, 0, 2.6] as const
const BLOCK_SIZE = [0.5, 0.44, 0.25] as const
const OBJECT_ID_DRAWS = 4
const FLOOR = 0.13
const QUARTER_TURN = 1.5708

interface Motion {
  vx: number
  vy: number
  vz: number
  wx: number
  wy: number
  wz: number
  rest: boolean
}

export interface WallBlock {
  readonly home: readonly [number, number]
  x: number
  y: number
  rotation: [number, number, number]
  /** Bullet holes stuck to this block (local to the block). */
  holes: { x: number; y: number; scale: number; chipTurn: number; chipScale: number }[]
  motion: Motion | undefined
}

const clamp = (value: number, low: number, high: number): number => (value < low ? low : value > high ? high : value)

function createBlocks(): WallBlock[] {
  const blocks: WallBlock[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const home = [(column - 2.5) * BLOCK_SIZE[0] + (row % 2 ? 0.12 : 0), 0.22 + row * BLOCK_SIZE[1]] as const
      blocks.push({ home, x: home[0], y: home[1], rotation: [0, 0, 0], holes: [], motion: undefined })
    }
  }
  return blocks
}

/**
 * The free-standing wall of 30 blocks of the page (W926-935, W1039-1046): a bullet leaves a hole and a chip stuck to the nearest block (`bwHit`, which
 * also costs the page the ids three.js gives each new mesh), and when it gives way the blocks fall with the velocities the page draws for them and
 * rest on their sides. The holes travel with the blocks, which is the point of the effect.
 */
export function createBlocksBehavior(): Behavior {
  let blocks = createBlocks()
  return {
    reset() {
      blocks = createBlocks()
    },
    act(host, action, args) {
      const random = host.engine.random
      if (action === 'hit') {
        const { x, y, scale } = args as { readonly x: number; readonly y: number; readonly scale: number }
        let best: WallBlock | undefined
        let bestDistance = 9
        for (const block of blocks) {
          const distance = Math.hypot(block.x - x, block.y - y)
          if (distance < bestDistance) {
            bestDistance = distance
            best = block
          }
        }
        if (!best) return
        const offsetX = clamp(x - best.x, -0.2, 0.2)
        const offsetY = clamp(y - best.y, -0.17, 0.17)
        for (let draw = 0; draw < OBJECT_ID_DRAWS; draw++) random.next()
        const chipTurn = random.between(0, 6)
        const chipScale = random.between(0.8, 1.3) * scale
        for (let draw = 0; draw < OBJECT_ID_DRAWS; draw++) random.next()
        best.holes.push({ x: offsetX, y: offsetY, scale, chipTurn, chipScale })
        impact(host.engine, 'concrete', [ORIGIN[0] + x, y, ORIGIN[2] + 0.13], [0, 0, 1], 0.8)
      } else if (action === 'collapse') {
        const { x, y } = args as { readonly x: number; readonly y: number }
        for (const block of blocks) {
          const dx = block.x - x
          const dy = block.y - y
          block.motion = {
            vx: dx * random.between(0.8, 2),
            vy: random.between(0.5, 2.5) + dy * 0.5,
            vz: random.between(-2.2, -0.4),
            wx: random.between(-4, 4),
            wy: random.between(-3, 3),
            wz: random.between(-4, 4),
            rest: false,
          }
        }
      }
    },
    query(_host, name) {
      if (name === 'blocks') return blocks
      throw new Error(`blocks: unknown query ${name}`)
    },
    update(_host, dt) {
      for (const block of blocks) {
        const motion = block.motion
        if (!motion || motion.rest) continue
        motion.vy -= 9.8 * dt
        block.x += motion.vx * dt
        block.y += motion.vy * dt
        block.rotation[0] += motion.wx * dt
        block.rotation[1] += motion.wy * dt
        block.rotation[2] += motion.wz * dt
        if (block.y < FLOOR) {
          block.y = FLOOR
          motion.vy *= -0.25
          motion.vx *= 0.5
          motion.vz *= 0.5
          motion.wx *= 0.5
          motion.wy *= 0.5
          motion.wz *= 0.5
          if (Math.abs(motion.vy) < 0.4 && Math.hypot(motion.vx, motion.vz) < 0.3) {
            motion.rest = true
            block.rotation[0] = Math.round(block.rotation[0] / QUARTER_TURN) * QUARTER_TURN
            block.rotation[2] = Math.round(block.rotation[2] / QUARTER_TURN) * QUARTER_TURN
          }
        }
      }
    },
  }
}
