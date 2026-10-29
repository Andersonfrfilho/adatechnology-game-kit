import type { Vec3 } from '../types'
import { depositBlob, depositSplat } from './deposit'
import type { DepositContext } from './deposit'
import type { FilmDropState, FilmLayout } from './types'

const GRAVITY = 9.8
const AIR_DRAG = 0.25
const MIN_SIZE_CELLS = 0.6

export interface DropPool {
  readonly state: FilmDropState
  launch(position: Vec3, velocity: Vec3, radius: number): void
  update(dt: number): void
  clear(): void
}

/** Drops in flight: a ring of slots (the oldest is overwritten), a ballistic flight and a landing that makes an impact shaped by the angle and direction (F250-278). */
export function createDropPool(layout: FilmLayout, context: DepositContext): DropPool {
  const capacity = layout.rules.dropCapacity
  let cursor = 0
  const state: FilmDropState = {
    capacity,
    get launched() {
      return cursor
    },
    active: new Uint8Array(capacity),
    position: new Float64Array(capacity * 3),
    velocity: new Float64Array(capacity * 3),
    radius: new Float64Array(capacity),
  }
  const { active, position, velocity, radius } = state
  const cellMillimetres = layout.cellSize * 1000
  const previous: Vec3 = [0, 0, 0]
  const point: Vec3 = [0, 0, 0]
  const speed: Vec3 = [0, 0, 0]

  function land(region: number, dropRadius: number): void {
    const profile = context.profile()
    const impact = layout.impact(region, point, speed)
    const [alongColumn, alongRow] = impact.along
    const travel = Math.hypot(alongColumn, alongRow) || 1e-6
    const sinAngle = Math.abs(impact.normalSpeed) / Math.hypot(travel, impact.normalSpeed)
    const volume = ((4 / 3) * Math.PI * dropRadius * dropRadius * dropRadius) / (cellMillimetres * cellMillimetres) * (dropRadius > 3 ? 7 : 4) * profile.volume
    const totalSpeed = Math.sqrt(speed[0] * speed[0] + speed[1] * speed[1] + speed[2] * speed[2])
    const size = Math.max(MIN_SIZE_CELLS, (dropRadius * 2) / cellMillimetres * (1 + 0.2 * totalSpeed))
    const amount = Math.min(profile.maxAmount, Math.max(0.25, volume / ((Math.PI * size * size * 1.6) / (sinAngle < 0.3 ? 0.6 : 1))))
    if (profile.landsAsBlob) {
      depositBlob(context, impact.row, impact.column, size * 1.3, size * 1.1, alongColumn / travel, alongRow / travel, amount, 0.2)
      return
    }
    depositSplat(context, impact.row, impact.column, size, alongColumn / travel, alongRow / travel, sinAngle, amount)
  }

  return {
    state,
    launch(origin, direction, dropRadius) {
      const slot = cursor++ % capacity
      const offset = slot * 3
      active[slot] = 1
      position[offset] = origin[0]
      position[offset + 1] = origin[1]
      position[offset + 2] = origin[2]
      velocity[offset] = direction[0]
      velocity[offset + 1] = direction[1]
      velocity[offset + 2] = direction[2]
      radius[slot] = dropRadius
    },
    update(dt) {
      for (let slot = 0; slot < capacity; slot++) {
        if (!active[slot]) continue
        const offset = slot * 3
        previous[0] = position[offset]!
        previous[1] = position[offset + 1]!
        previous[2] = position[offset + 2]!
        velocity[offset + 1]! -= GRAVITY * dt
        const drag = 1 - dt * AIR_DRAG
        velocity[offset]! *= drag
        velocity[offset + 1]! *= drag
        velocity[offset + 2]! *= drag
        point[0] = position[offset]! + velocity[offset]! * dt
        point[1] = position[offset + 1]! + velocity[offset + 1]! * dt
        point[2] = position[offset + 2]! + velocity[offset + 2]! * dt
        const region = layout.collide(previous, point)
        position[offset] = point[0]
        position[offset + 1] = point[1]
        position[offset + 2] = point[2]
        if (region >= 0) {
          if (layout.contains(point)) {
            speed[0] = velocity[offset]!
            speed[1] = velocity[offset + 1]!
            speed[2] = velocity[offset + 2]!
            land(region, radius[slot]!)
          }
          active[slot] = 0
          continue
        }
        if (layout.escaped(point)) active[slot] = 0
      }
    },
    clear() {
      active.fill(0)
    },
  }
}
