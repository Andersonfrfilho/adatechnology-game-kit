import type { Behavior, BehaviorHost } from '../behavior'
import { sparkAt } from '../builders/shared'
import { normalized } from '../vector-math'
import type { Vec3Tuple } from '../../workshop/types'

const SPOT: Vec3Tuple = [-2.2, 0, 2.6]
const WALL_X = -8.2
const QUARTER_TURN = Math.PI / 2

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const clamp = (value: number, low: number, high: number): number => (value < low ? low : value > high ? high : value)

/**
 * The pressure cylinder of the page (W1021-1038): an extinguisher that spins on the floor pushed by its own jet, or an oxygen bottle that becomes a
 * rocket and hits the wall. `step` moves it the way the page's tick does, drawing the sparks of the wall hit; the recipe then asks where the jet comes
 * out (`tip`, `back`, `direction`) to emit it.
 */
export function createCylinderBehavior(): Behavior {
  let position: Vec3Tuple = SPOT
  let velocity: Vec3Tuple = [0, 0, 0]
  let rotationZ = 0
  let angle = 0
  let spin = 0
  let live = false
  let oxygen = false
  let direction: Vec3Tuple = [1, 0, 0]

  const clear = (): void => {
    position = SPOT
    velocity = [0, 0, 0]
    rotationZ = 0
    angle = 0
    spin = 0
    live = false
    direction = [1, 0, 0]
  }

  return {
    reset: clear,
    act(host: BehaviorHost, action: string, args: unknown) {
      if (action === 'choose') {
        clear()
        oxygen = (args as { readonly oxygen: boolean }).oxygen
      } else if (action === 'puncture') {
        live = true
        if (oxygen) velocity = [-5, 0, -0.3]
        else spin = 9
      } else if (action === 'step') {
        if (!live) return
        const { dt, t } = args as { readonly dt: number; readonly t: number }
        const k = clamp(1 - (t - 0.6) / 3.4, 0, 1)
        if (!oxygen) {
          rotationZ = lerp(rotationZ, QUARTER_TURN, dt * 8)
          const y = lerp(position[1], 0.09, dt * 8)
          angle += spin * k * dt
          direction = [Math.cos(angle), 0, -Math.sin(angle)]
          position = [position[0] + direction[0] * (-0.6 * k * dt), y + direction[1] * (-0.6 * k * dt), position[2] + direction[2] * (-0.6 * k * dt)]
          return
        }
        let [vx, vy, vz] = velocity
        if (k > 0) vx -= 4 * k * dt
        const damping = Math.exp(-dt * (k > 0 ? 0.3 : 3))
        vx *= damping
        vy *= damping
        vz *= damping
        velocity = [vx, vy, vz]
        rotationZ = lerp(rotationZ, -QUARTER_TURN, dt * 10)
        position = [position[0] + vx * dt, lerp(position[1], 0.12, dt * 10) + vy * dt, position[2] + vz * dt]
        if (position[0] < WALL_X) {
          position = [WALL_X, position[1], position[2]]
          velocity = [velocity[0] * -0.3, velocity[1], velocity[2]]
          host.engine.screen.shake += 0.08
          sparkAt(host.engine, position, normalized([1, 0.5, 0]), 16, 1)
        }
      }
    },
    query(_host, name) {
      switch (name) {
        case 'live': return live
        case 'oxygen': return oxygen
        case 'position': return position
        case 'direction': return direction
        case 'speed_x': return velocity[0]
        case 'rotation_z': return rotationZ
        case 'tip': return [position[0] + direction[0] * 0.3, 0.1, position[2] + direction[2] * 0.3]
        case 'back': return [position[0] + 1.1, position[1], position[2]]
        default: throw new Error(`cylinder: unknown query ${name}`)
      }
    },
    update() {},
  }
}
