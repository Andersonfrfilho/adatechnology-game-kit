import { SALT, unit } from '../identity'
import { BALANCE, FALL_CAUSE, STATE } from '../types'
import type { Corpse } from '../types'
import { takesPartInContact } from './contact'
import type { ContactView } from './contact'
import type { Balance } from './balance'
import type { PhysicsContext } from './context'
import type { CrowdThrownOptions } from './options'

export const FREE_SLOT = -2
export const CARRIED_BODY = -1
const MAX_SPIN = 8
/** Past this distance per step the flight is swept cell by cell instead of tested at the new point. */
const SWEEP_DISTANCE = 0.25
const LANDING_DAMAGE_SPEED = 6
const CENTRE_HEIGHT = 1
const MAX_POOL = 127

/** The thrown bodies, simulated here and only read by the renderer (`x`, `y`, `z` are the centre of the body, `prev*` the position of the step before). */
export type ThrownPool = {
  readonly size: number
  /** An agent index, `CARRIED_BODY` for a dead body carried until it lands, `FREE_SLOT` for an empty slot. */
  readonly agent: Int32Array
  readonly identity: Uint32Array
  readonly corpse: (Corpse | null)[]
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly prevX: Float32Array
  readonly prevY: Float32Array
  readonly prevZ: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  readonly pitch: Float32Array
  readonly roll: Float32Array
  readonly spinPitch: Float32Array
  readonly spinRoll: Float32Array
  active(): number
}

export type ThrownCandidate = { readonly index: number; readonly speed: number; readonly vx: number; readonly vy: number; readonly vz: number; readonly distance: number }

export type Thrown = {
  readonly pool: ThrownPool
  /** Gives the slots to the candidates by the priority of the options; returns how many flew. */
  assign(candidates: ThrownCandidate[]): number
  step(contact: ContactView, balance: Balance): void
  /** The store removed agent `removed` and moved agent `moved` into its place (the same index when it was the last). */
  remap(removed: number, moved: number): void
}

export const createThrownPool = (size: number): ThrownPool => {
  const f32 = (): Float32Array => new Float32Array(size)
  const pool: ThrownPool = {
    size,
    agent: new Int32Array(size).fill(FREE_SLOT),
    identity: new Uint32Array(size),
    corpse: Array.from({ length: size }, () => null),
    x: f32(),
    y: f32(),
    z: f32(),
    prevX: f32(),
    prevY: f32(),
    prevZ: f32(),
    vx: f32(),
    vy: f32(),
    vz: f32(),
    pitch: f32(),
    roll: f32(),
    spinPitch: f32(),
    spinRoll: f32(),
    active: () => pool.agent.reduce((count, agent) => count + (agent === FREE_SLOT ? 0 : 1), 0),
  }
  return pool
}

const byFastest = (a: ThrownCandidate, b: ThrownCandidate, identityOf: (i: number) => number): number => b.speed - a.speed || identityOf(a.index) - identityOf(b.index)
const byNearest = (a: ThrownCandidate, b: ThrownCandidate, identityOf: (i: number) => number): number => a.distance - b.distance || identityOf(a.index) - identityOf(b.index)

/** Who gets the free slots (`mixed`: `mixedRatio` of them to the fastest, the rest to the nearest of what is left). */
export function chooseCandidates(candidates: ThrownCandidate[], free: number, options: Required<CrowdThrownOptions>, identityOf: (i: number) => number): ThrownCandidate[] {
  if (candidates.length <= free) return candidates
  if (options.priority === 'fastest') return candidates.sort((a, b) => byFastest(a, b, identityOf)).slice(0, free)
  if (options.priority === 'nearest') return candidates.sort((a, b) => byNearest(a, b, identityOf)).slice(0, free)
  const fast = Math.round(free * options.mixedRatio)
  const sorted = candidates.sort((a, b) => byFastest(a, b, identityOf))
  const rest = sorted.slice(fast).sort((a, b) => byNearest(a, b, identityOf))
  return [...sorted.slice(0, fast), ...rest.slice(0, free - fast)]
}

export function createThrown(ctx: PhysicsContext): Thrown {
  const { store, grid } = ctx
  const options = ctx.options.thrown!
  const size = Math.min(MAX_POOL, options.pool)
  const pool = createThrownPool(size)
  const identityOf = (i: number): number => store.identity[i]!

  const assign = (candidates: ThrownCandidate[]): number => {
    let free = 0
    for (let slot = 0; slot < size; slot++) if (pool.agent[slot] === FREE_SLOT) free++
    const chosen = chooseCandidates(candidates, free, options, identityOf)
    let slot = 0
    for (const candidate of chosen) {
      while (pool.agent[slot] !== FREE_SLOT) slot++
      const i = candidate.index
      pool.agent[slot] = i
      pool.identity[slot] = store.identity[i]!
      pool.corpse[slot] = null
      pool.x[slot] = pool.prevX[slot] = store.x[i]!
      pool.y[slot] = pool.prevY[slot] = store.y[i]! + CENTRE_HEIGHT * store.height[i]!
      pool.z[slot] = pool.prevZ[slot] = store.z[i]!
      pool.vx[slot] = candidate.vx
      pool.vy[slot] = candidate.vy
      pool.vz[slot] = candidate.vz
      pool.pitch[slot] = pool.roll[slot] = 0
      pool.spinPitch[slot] = (unit(store.identity[i]!, ctx.step, SALT.SPIN) * 2 - 1) * MAX_SPIN
      pool.spinRoll[slot] = (unit(store.identity[i]!, ctx.step, SALT.SPIN + 1) * 2 - 1) * MAX_SPIN
      if (store.state[i] === STATE.PILE_STEP) ctx.releasePileStep(i)
      store.balance[i] = BALANCE.THROWN
      store.thrown[i] = slot
      store.vx[i] = store.vz[i] = store.pushX[i] = store.pushZ[i] = 0
      store.aimX[i] = store.aimZ[i] = 0
    }
    return chosen.length
  }

  const remap = (removed: number, moved: number): void => {
    for (let slot = 0; slot < size; slot++) {
      const agent = pool.agent[slot]!
      if (agent === removed) {
        pool.corpse[slot] ??= ctx.corpseOf(removed, unit(pool.identity[slot]!, ctx.step, SALT.CORPSE) * 10)
        pool.agent[slot] = CARRIED_BODY
      } else if (agent === moved && moved !== removed) pool.agent[slot] = removed
    }
  }

  /** The first solid cell on the horizontal path of one step, by the grid traversal of Amanatides and Woo; undefined when the path is clear. */
  const sweepWall = (x0: number, z0: number, x1: number, z1: number, y: number): { x: number; z: number } | undefined => {
    const cell = grid.cell
    let gx = Math.floor((x0 + grid.half) / cell)
    let gz = Math.floor((z0 + grid.half) / cell)
    const dx = x1 - x0
    const dz = z1 - z0
    const stepX = dx > 0 ? 1 : -1
    const stepZ = dz > 0 ? 1 : -1
    const deltaX = dx === 0 ? Infinity : Math.abs(cell / dx)
    const deltaZ = dz === 0 ? Infinity : Math.abs(cell / dz)
    let nextX = dx === 0 ? Infinity : ((dx > 0 ? gx + 1 : gx) * cell - grid.half - x0) / dx
    let nextZ = dz === 0 ? Infinity : ((dz > 0 ? gz + 1 : gz) * cell - grid.half - z0) / dz
    let t = 0
    while (Math.min(nextX, nextZ) <= 1) {
      if (nextX < nextZ) {
        t = nextX
        nextX += deltaX
        gx += stepX
      } else {
        t = nextZ
        nextZ += deltaZ
        gz += stepZ
      }
      const hitX = x0 + dx * t
      const hitZ = z0 + dz * t
      if (grid.solidAt(hitX + Math.sign(dx) * 1e-4, hitZ + Math.sign(dz) * 1e-4, y)) return { x: x0 + dx * Math.max(0, t - 1e-3), z: z0 + dz * Math.max(0, t - 1e-3) }
    }
    return undefined
  }

  const fly = (slot: number): void => {
    pool.prevX[slot] = pool.x[slot]!
    pool.prevY[slot] = pool.y[slot]!
    pool.prevZ[slot] = pool.z[slot]!
    pool.vy[slot]! -= ctx.gravity * ctx.h
    pool.pitch[slot]! += pool.spinPitch[slot]! * ctx.h
    pool.roll[slot]! += pool.spinRoll[slot]! * ctx.h
    const nx = pool.x[slot]! + pool.vx[slot]! * ctx.h
    const nz = pool.z[slot]! + pool.vz[slot]! * ctx.h
    const ny = pool.y[slot]! + pool.vy[slot]! * ctx.h
    const speed = Math.hypot(pool.vx[slot]!, pool.vy[slot]!, pool.vz[slot]!)
    const wall = speed * ctx.h > SWEEP_DISTANCE ? sweepWall(pool.x[slot]!, pool.z[slot]!, nx, nz, ny) : grid.solidAt(nx, nz, ny) ? { x: pool.x[slot]!, z: pool.z[slot]! } : undefined
    pool.x[slot] = wall ? wall.x : nx
    pool.z[slot] = wall ? wall.z : nz
    pool.y[slot] = ny
    if (wall) pool.vx[slot] = pool.vz[slot] = 0
  }

  const massOf = (slot: number): number => {
    const agent = pool.agent[slot]!
    if (agent >= 0) return store.mass[agent]!
    const body = pool.corpse[slot]!
    return ctx.options.contact!.baseMass * body.height * body.build * body.build
  }

  const knockNeighbours = (contact: ContactView, balance: Balance, slot: number): void => {
    const side = Math.floor(grid.size)
    const x = pool.x[slot]!
    const z = pool.z[slot]!
    const hx = Math.floor(x + grid.half)
    const hz = Math.floor(z + grid.half)
    const mass = massOf(slot)
    const speed = Math.hypot(pool.vx[slot]!, pool.vz[slot]!)
    const reach = options.landingRadius * options.landingRadius
    for (let oz = -1; oz <= 1; oz++)
      for (let ox = -1; ox <= 1; ox++) {
        if (hx + ox < 0 || hz + oz < 0 || hx + ox >= side || hz + oz >= side) continue
        for (let j = contact.workspace.head[(hz + oz) * side + hx + ox]!; j !== -1; j = contact.workspace.next[j]!) {
          const ex = store.x[j]! - x
          const ez = store.z[j]! - z
          if (j === pool.agent[slot] || ex * ex + ez * ez > reach || !takesPartInContact(store, j)) continue
          const away = Math.hypot(ex, ez)
          const along = away > 1e-6 ? [ex / away, ez / away] : [pool.vx[slot]! / (speed || 1), pool.vz[slot]! / (speed || 1)]
          const delta = (mass / (mass + store.mass[j]!)) * speed
          store.pushX[j]! += delta * along[0]!
          store.pushZ[j]! += delta * along[1]!
          balance.shove(j, delta, FALL_CAUSE.LANDING)
        }
      }
  }

  const land = (contact: ContactView, balance: Balance, slot: number, ground: number): void => {
    knockNeighbours(contact, balance, slot)
    const x = pool.x[slot]!
    const z = pool.z[slot]!
    ctx.emit('sound', { sound: 'impact', volume: 1.2, position: [x, ground, z], distance: Math.hypot(x - ctx.centre.x, z - ctx.centre.z) })
    ctx.emit('effect', { effect: 'dust', point: [x, ground, z], color: 0x8a7a66 })
    const agent = pool.agent[slot]!
    if (agent >= 0) {
      store.balance[agent] = BALANCE.FALLEN
      store.balanceTimer[agent] = 0
      store.fallCause[agent] = FALL_CAUSE.BLAST
      store.x[agent] = x
      store.z[agent] = z
      store.y[agent] = ground
      store.vy[agent] = 0
      store.thrown[agent] = -1
      const amount = Math.max(0, -pool.vy[slot]! - LANDING_DAMAGE_SPEED) * options.fallDamage
      if (amount > 0) ctx.damage(agent, { region: 1, amount, distance: 0 }, () => unit(store.identity[agent]!, ctx.step, SALT.JAW))
    } else {
      ctx.emit('effect', { effect: 'blood', point: [x, ground + 0.1, z], amount: 30, died: true })
      ctx.addCorpse({ ...pool.corpse[slot]!, x, z })
    }
    pool.agent[slot] = FREE_SLOT
    pool.corpse[slot] = null
  }

  const step = (contact: ContactView, balance: Balance): void => {
    let active = 0
    for (let slot = 0; slot < size; slot++) {
      if (pool.agent[slot] === FREE_SLOT) continue
      fly(slot)
      const cell = grid.cellOf(pool.x[slot]!, pool.z[slot]!)
      const ground = cell < 0 ? 0 : ctx.groundAt(cell, pool.y[slot]!)
      const agent = pool.agent[slot]!
      if (pool.y[slot]! <= ground) {
        land(contact, balance, slot, ground)
        continue
      }
      active++
      if (agent < 0) continue
      store.x[agent] = pool.x[slot]!
      store.z[agent] = pool.z[slot]!
      store.y[agent] = Math.max(ground, pool.y[slot]! - CENTRE_HEIGHT * store.height[agent]!)
    }
    ctx.stats.thrownActive = active
    ctx.stats.thrownPeak = Math.max(ctx.stats.thrownPeak, active)
  }

  return { pool, assign, step, remap }
}
