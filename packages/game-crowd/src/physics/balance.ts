import { SALT, unit } from '../identity'
import { BALANCE, FALL_CAUSE, STATE } from '../types'
import type { PhysicsContext } from './context'
import type { CrowdBalanceOptions } from './options'

const GRAVITY_FORCE = 9.8
const GROUND_MASS_FACTOR = 3
/** Speed above which entering a cell with a body can trip (m/s), and the speed the trip chance is given for. */
const TRIP_MIN_SPEED = 0.5
const TRIP_REFERENCE_SPEED = 1.4
const TRIP_MOUND = 150
const TRIP_CLEARANCE = 0.1
/** Drop height (m) that makes a body stagger, and that knocks it down (`design-chain-horde.md` §6, item 5). */
const COLLAPSE_STAGGER = 0.6
const COLLAPSE_FALL = 1
const CAUSE_ORDER = [FALL_CAUSE.PRESSURE, FALL_CAUSE.SHOVE, FALL_CAUSE.TRIP, FALL_CAUSE.LANDING, FALL_CAUSE.COLLAPSE, FALL_CAUSE.BLAST]
const CHAIN_WINDOW_STEPS = 240

/** A fall that waited for its turn (the ceiling of falls per step) is dropped after this many steps. */
const CARRY_STEPS = 24
/** Pressure and trip are drawn again every step; the rest (a shove, a landing, a collapse, a blast) is a fact and waits for its turn. */
const isCarried = (cause: number): boolean => cause !== FALL_CAUSE.PRESSURE && cause !== FALL_CAUSE.TRIP

type FallRequest = { index: number; identity: number; cause: number; score: number; born: number }

export type Balance = {
  /** Asks for agent `i` to go down; the ones with the highest `score` go first, up to the ceiling of the step. */
  requestFall(i: number, cause: number, score: number): void
  /** Agent `i` starts staggering if it stands. */
  stagger(i: number): void
  /** A push of `speed` m/s (an increment) on a standing agent: staggers it, or asks for the fall, by its stability. */
  shove(i: number, speed: number, cause: number): void
  step(options: Required<CrowdBalanceOptions>, contactShove: Float32Array): void
  /** Carries out the requests of the step, in the order of the score. */
  flush(): void
  /** A body landed after a drop of `height` m (a pile or a mound gave way). */
  landed(i: number, height: number): void
  /** Falls requested and not yet carried out. */
  pending(): number
}

export function createBalance(ctx: PhysicsContext): Balance {
  const { store } = ctx
  const requests: FallRequest[] = []
  const balanceOptions = (): Required<CrowdBalanceOptions> => ctx.options.balance!

  const stabilityOf = (i: number): number => (ctx.typeOf(i).balance?.stability ?? 1) * store.stability[i]!
  const canFall = (i: number): boolean => ctx.typeOf(i).balance?.canFall !== false
  const criticalOf = (i: number): number => balanceOptions().criticalFactor * store.mass[i]! * GRAVITY_FORCE * stabilityOf(i)

  const requestFall = (i: number, cause: number, score: number): void => {
    if (!canFall(i)) return
    requests.push({ index: i, identity: store.identity[i]!, cause, score, born: ctx.step })
  }

  const stagger = (i: number): void => {
    if (store.balance[i] !== BALANCE.STANDING || !canFall(i)) return
    store.balance[i] = BALANCE.STAGGERING
    store.balanceTimer[i] = 0
  }

  const shove = (i: number, speed: number, cause: number): void => {
    const options = balanceOptions()
    const knockSpeed = options.shoveFall * stabilityOf(i)
    if (store.balance[i] !== BALANCE.STANDING && store.balance[i] !== BALANCE.STAGGERING) return
    if (speed > knockSpeed) requestFall(i, cause, speed / knockSpeed)
    else if (speed > options.shoveStagger) stagger(i)
  }

  const countsAsChainFall = (i: number, cause: number): boolean => {
    if (cause === FALL_CAUSE.PRESSURE || cause === FALL_CAUSE.BLAST) return false
    if (ctx.step - ctx.lastBlastStep > CHAIN_WINDOW_STEPS) return false
    const direct = store.blastStep[i] === ctx.lastBlastStep ? store.directShove[i]! : 0
    return direct < balanceOptions().shoveStagger
  }

  const goDown = (i: number, cause: number): void => {
    ctx.stats.falls[CAUSE_ORDER.indexOf(cause as (typeof CAUSE_ORDER)[number])]!++
    if (countsAsChainFall(i, cause)) ctx.stats.fallsBeyondBlast++
    if (store.state[i] === STATE.PILE_STEP) ctx.releasePileStep(i)
    store.balance[i] = BALANCE.FALLEN
    store.balanceTimer[i] = 0
    store.fallCause[i] = cause
    store.vx[i] = store.vz[i] = 0
    store.pushX[i]! /= GROUND_MASS_FACTOR
    store.pushZ[i]! /= GROUND_MASS_FACTOR
    store.aimX[i] = store.aimZ[i] = 0
    const target = ctx.target()
    if (target && target.state.grabbedBy === i) target.release()
    ctx.emit('fall', { agent: i, cause, x: store.x[i]!, z: store.z[i]!, identity: store.identity[i]! })
  }

  const flush = (): void => {
    if (!requests.length) return
    const options = balanceOptions()
    requests.sort((a, b) => b.score - a.score || a.identity - b.identity)
    let fallen = ctx.stats.fallen
    let fallsLeft = options.maxFallsPerStep
    const waiting: FallRequest[] = []
    for (const request of requests) {
      const i = request.index
      if (i >= store.n || store.identity[i] !== request.identity) continue
      const balance = store.balance[i]
      if (balance !== BALANCE.STANDING && balance !== BALANCE.STAGGERING) continue
      if (fallsLeft > 0 && fallen < options.maxFallen) {
        goDown(i, request.cause)
        fallsLeft--
        fallen++
        continue
      }
      stagger(i)
      if (isCarried(request.cause) && ctx.step - request.born < CARRY_STEPS) waiting.push(request)
    }
    requests.length = 0
    requests.push(...waiting)
  }

  const hasBodyOnTop = (i: number): boolean => {
    const cell = ctx.grid.cellOf(store.x[i]!, store.z[i]!)
    if (cell < 0) return false
    const options = ctx.options.mound
    if (!options) return false
    const top = store.y[i]! + options.bodyThickness * store.build[i]!
    return ctx.moundAt(cell) / 1000 > top + 0.05 || ctx.weightOn(i) > 0
  }

  const stepStanding = (i: number, ratio: number, contactShove: number, options: Required<CrowdBalanceOptions>): void => {
    if (contactShove > options.shoveFall * stabilityOf(i)) return requestFall(i, FALL_CAUSE.SHOVE, contactShove / (options.shoveFall * stabilityOf(i)))
    if (ratio > options.staggerEnter || contactShove > options.shoveStagger) stagger(i)
    else tryTrip(i)
  }

  const tryTrip = (i: number): void => {
    const cell = ctx.grid.cellOf(store.x[i]!, store.z[i]!)
    if (cell < 0 || cell === ctx.grid.cellOf(store.prevX[i]!, store.prevZ[i]!)) return
    const mound = ctx.moundAt(cell)
    if (mound < TRIP_MOUND || store.y[i]! >= mound / 1000 - TRIP_CLEARANCE) return
    const speed = Math.hypot(store.vx[i]! + store.pushX[i]!, store.vz[i]! + store.pushZ[i]!)
    if (speed <= TRIP_MIN_SPEED) return
    const chance = (ctx.typeOf(i).balance?.trip ?? 0.04) * store.tripFactor[i]! * (speed / TRIP_REFERENCE_SPEED)
    if (unit(store.identity[i]!, ctx.step, SALT.TRIP) < chance) requestFall(i, FALL_CAUSE.TRIP, 1)
  }

  const stepStaggering = (i: number, ratio: number, contactShove: number, options: Required<CrowdBalanceOptions>): void => {
    store.balanceTimer[i]! += ctx.h
    if (contactShove > options.shoveFall * stabilityOf(i)) return requestFall(i, FALL_CAUSE.SHOVE, contactShove / (options.shoveFall * stabilityOf(i)))
    if (ratio > 1 && unit(store.identity[i]!, ctx.step, SALT.FALL) < 1 - Math.exp(-options.fallRate * (ratio - 1) ** 2 * ctx.h)) return requestFall(i, FALL_CAUSE.PRESSURE, ratio)
    if (ratio < options.staggerLeave && store.balanceTimer[i]! >= options.staggerMin) {
      store.balance[i] = BALANCE.STANDING
      store.balanceTimer[i] = 0
    }
  }

  const stepFallen = (i: number, ratio: number, options: Required<CrowdBalanceOptions>): void => {
    store.balanceTimer[i]! += ctx.h
    if (store.balanceTimer[i]! < options.fallenMin + store.reaction[i]! || ratio >= options.releaseFactor || hasBodyOnTop(i)) return
    store.balance[i] = BALANCE.GETTING_UP
    store.balanceTimer[i] = 0
  }

  const step = (options: Required<CrowdBalanceOptions>, contactShove: Float32Array): void => {
    const smoothing = 1 - Math.exp(-ctx.h / options.pressureTau)
    let fallen = 0
    let staggering = 0
    for (let i = 0; i < store.n; i++) {
      const state = store.balance[i]!
      if (state === BALANCE.THROWN) continue
      store.pressure[i]! += (store.field[i]! - store.pressure[i]!) * smoothing
      const ratio = store.pressure[i]! / criticalOf(i)
      if (state === BALANCE.STANDING) stepStanding(i, ratio, contactShove[i]!, options)
      else if (state === BALANCE.STAGGERING) stepStaggering(i, ratio, contactShove[i]!, options)
      else if (state === BALANCE.FALLEN) stepFallen(i, ratio, options)
      else if ((store.balanceTimer[i]! += ctx.h) >= options.getUpSeconds) {
        store.balance[i] = BALANCE.STANDING
        store.balanceTimer[i] = 0
      }
      if (store.balance[i] === BALANCE.STAGGERING) staggering++
      else if (store.balance[i] === BALANCE.FALLEN || store.balance[i] === BALANCE.GETTING_UP) fallen++
    }
    ctx.stats.fallen = fallen
    ctx.stats.staggering = staggering
  }

  const landed = (i: number, height: number): void => {
    if (store.balance[i] !== BALANCE.STANDING && store.balance[i] !== BALANCE.STAGGERING) return
    if (height > COLLAPSE_FALL) requestFall(i, FALL_CAUSE.COLLAPSE, height / COLLAPSE_FALL)
    else if (height > COLLAPSE_STAGGER) stagger(i)
  }

  return { requestFall, stagger, shove, step, flush, landed, pending: () => requests.length }
}
