import type { Behavior } from '../behavior'
import type { Vec3Tuple } from '../../workshop/types'

const ORIGIN: Vec3Tuple = [5.6, 0, 0.8]
const MAX_TILT = 0.25

/**
 * The car of the page after it blew up (`carTick`, W1131): it leaps, spins and lands crooked. Its height is what the burning wreck's fire is emitted
 * from, so the model keeps it; the body is drawn by whoever owns the car.
 */
export function createCarBehavior(): Behavior {
  let y = 0
  let rise: number | undefined
  let spin = 0
  let roll = 0
  return {
    reset() {
      y = 0
      rise = undefined
      spin = 0
      roll = 0
    },
    act(_host, action, args) {
      if (action === 'launch') {
        const launch = args as { readonly rise: number; readonly spin: number }
        rise = launch.rise
        spin = launch.spin
      } else if (action === 'step') {
        if (rise === undefined) return
        const dt = (args as { readonly dt: number }).dt
        rise -= 9.8 * dt
        y = Math.max(0, y + rise * dt)
        roll += spin * dt
        spin *= Math.exp(-dt * 2)
        if (y === 0 && rise < 0) {
          rise = undefined
          roll = Math.min(MAX_TILT, Math.max(-MAX_TILT, roll))
        }
      }
    },
    query(_host, name) {
      if (name === 'position') return [ORIGIN[0], y, ORIGIN[2]]
      if (name === 'roll') return roll
      throw new Error(`car: unknown query ${name}`)
    },
    update() {},
  }
}
