import type { Behavior } from '../behavior'

const WALKER_COUNT = 10
const ARRIVAL_DISTANCE = 0.05
const SWAY_AMPLITUDE = 0.04
const BOB_AMPLITUDE = 0.04
const STRIDE_FACTOR = 4.5

/**
 * The `ph` of each walker, the offset of its sway and stride. The page drew them at load (`Math.random() * 6`) after three.js had drawn a few hundred
 * numbers for object ids, so they cannot be replayed; the three that matter (the runners with red eyes, whose trails start at the eyes) were fitted to
 * the recording until every position matched to four decimals. The others only turn a zombie nobody reads.
 */
const PHASES = [0, 0, 3.59629, 0, 0, 0, 2.946505, 0, 0, 0, 2.44693] as const

interface Walker {
  x: number
  z: number
  facing: number
  bob: number
  sway: number
  walk: { toX: number; toZ: number; speed: number } | undefined
}

function createWalkers(): Walker[] {
  return Array.from({ length: WALKER_COUNT }, () => ({ x: 0, z: 0, facing: 0, bob: 0, sway: 0, walk: undefined }))
}

interface PlaceArgs { readonly index: number; readonly x: number; readonly z: number; readonly facing: number }
interface WalkArgs { readonly index: number; readonly to: readonly [number, number, number]; readonly speed: number }
interface MoveArgs { readonly index: number; readonly x: number }

/**
 * The ten walking zombies of the page (W151, W190-197): they walk to a point at a speed, face where they go, bob with each stride and sway. An effect
 * reads where their eyes are (`point`) to start a trail from them. Phases are the page's, so the sway and bob repeat to the last digit.
 */
export function createWalkersBehavior(phases: readonly number[] = PHASES): Behavior {
  let walkers = createWalkers()
  return {
  reset() {
    walkers = createWalkers()
  },
  act(_host, action, args) {
    if (action === 'place') {
      const { index, x, z, facing } = args as PlaceArgs
      Object.assign(walkers[index]!, { x, z, facing })
    } else if (action === 'walk') {
      const { index, to, speed } = args as WalkArgs
      walkers[index]!.walk = { toX: to[0], toZ: to[2], speed }
    } else if (action === 'move_x') {
      const { index, x } = args as MoveArgs
      walkers[index]!.x = x
    }
  },
  query(_host, name, args) {
    const walker = walkers[args[0] as number]!
    if (name === 'x') return walker.x
    if (name === 'z') return walker.z
    if (name === 'is_walking') return walker.walk !== undefined
    if (name !== 'point') throw new Error(`walkers: unknown query ${name}`)
    const [localX, localY, localZ] = args[1] as readonly [number, number, number]
    const swayedX = Math.cos(walker.sway) * localX - Math.sin(walker.sway) * localY
    const swayedY = Math.sin(walker.sway) * localX + Math.cos(walker.sway) * localY + walker.bob
    return [Math.cos(walker.facing) * swayedX + Math.sin(walker.facing) * localZ + walker.x, swayedY, -Math.sin(walker.facing) * swayedX + Math.cos(walker.facing) * localZ + walker.z]
  },
  update(_host, dt, elapsed) {
    walkers.forEach((walker, index) => {
      walker.sway = Math.sin(elapsed * 1.3 + phases[index + 1]!) * SWAY_AMPLITUDE
      const walk = walker.walk
      if (!walk) return
      const dx = walk.toX - walker.x
      const dz = walk.toZ - walker.z
      const distance = Math.hypot(dx, dz)
      if (distance <= ARRIVAL_DISTANCE) {
        walker.walk = undefined
        return
      }
      const step = Math.min(distance, walk.speed * dt)
      walker.x += (dx / distance) * step
      walker.z += (dz / distance) * step
      walker.facing = Math.atan2(dx, dz)
      walker.bob = Math.abs(Math.cos(elapsed * walk.speed * STRIDE_FACTOR + phases[index + 1]!)) * BOB_AMPLITUDE
    })
  },
}
}
