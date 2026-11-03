import { BALANCE, STATE } from '../types'
import type { PhysicsContext } from './context'
import type { CrowdDensityOptions } from './options'

/** Fixed steps between two counts: the 5 Hz of the decision of band R1 at 60 Hz. */
const DECISION_STEPS = 12
const FAR_BAND = 1

export type Density = {
  /** Counts the walkers of band R1 per coarse cell (every 12th step) and writes the pressure that follows from it into their field. */
  step(): void
  /** What the speed of an agent of band `band` is multiplied by where the crowd is thick: `capacity / bodies` above `capacity` bodies in its cell, 1 elsewhere and in the other bands. */
  slowdown(i: number, band: number): number
  /** Bodies counted in the cell of an agent at the last count. */
  bodiesAround(i: number): number
}

/**
 * Band R1 without pairs (`design-chain-horde.md` §9): a coarse grid counts the standing walkers per cell; above `capacity` bodies the speed falls by `capacity / bodies` and the
 * field is `(bodies − capacity) · pressurePerBody` N, which the balance rule of band R0 reads as it reads any other field. Cost: one pass over the agents, no pairs.
 */
export function createDensity(ctx: PhysicsContext, options: Required<CrowdDensityOptions>): Density {
  const { store, grid } = ctx
  const side = Math.ceil(grid.size / options.cell)
  const bodies = new Uint16Array(side * side)
  const touched: number[] = []
  const half = grid.half

  const cellOf = (i: number): number => {
    const gx = Math.floor((store.x[i]! + half) / options.cell)
    const gz = Math.floor((store.z[i]! + half) / options.cell)
    return gx < 0 || gz < 0 || gx >= side || gz >= side ? -1 : gz * side + gx
  }

  const isWalking = (i: number): boolean => store.band[i] === FAR_BAND && (store.balance[i] === BALANCE.STANDING || store.balance[i] === BALANCE.STAGGERING) && store.state[i] !== STATE.PILE_STEP && store.state[i] !== STATE.DORMANT

  const count = (): void => {
    for (let k = 0; k < touched.length; k++) bodies[touched[k]!] = 0
    touched.length = 0
    for (let i = 0; i < store.n; i++) {
      if (!isWalking(i)) continue
      const cell = cellOf(i)
      if (cell < 0) continue
      if (bodies[cell] === 0) touched.push(cell)
      bodies[cell]!++
    }
  }

  const step = (): void => {
    if (ctx.step % DECISION_STEPS === 0) count()
    if (!touched.length) return
    for (let i = 0; i < store.n; i++) {
      if (!isWalking(i)) continue
      const cell = cellOf(i)
      const around = cell < 0 ? 0 : bodies[cell]!
      store.field[i] = around > options.capacity ? (around - options.capacity) * options.pressurePerBody : 0
    }
  }

  const bodiesAround = (i: number): number => {
    const cell = cellOf(i)
    return cell < 0 ? 0 : bodies[cell]!
  }

  const slowdown = (i: number, band: number): number => {
    if (band !== FAR_BAND) return 1
    const around = bodiesAround(i)
    return around > options.capacity ? options.capacity / around : 1
  }

  return { step, slowdown, bodiesAround }
}
