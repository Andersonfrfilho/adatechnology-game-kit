import { mix32 } from '../identity'
import { BALANCE, STATE } from '../types'
import type { PhysicsContext } from './context'

const CELLS_PER_BODY = 3
/** Spacing of head, trunk and legs of a lying body along its yaw (m). */
const BODY_PART_SPACING = 0.5
const CLIMB_HEIGHT = 0.25
const ELEVATED = 0.05
const NEUTRAL_MASS = 70
const NEIGHBOURS = [-1, 1, -1, 0, -1, -1, 0, -1, 0, 1, 1, -1, 1, 0, 1, 1] as const

export type Mound = {
  /** Millimetres of lying bodies per navigation cell, recomputed every step. */
  readonly height: Uint16Array
  step(): void
  /** Kilograms of the agents that stand on the three cells of the lying body of agent `i`, as of the last step. */
  weightOn(i: number): number
}

type Entries = { count: number; cell: Int32Array; thickness: Uint16Array; identity: Uint32Array; agent: Int32Array }

const BODY_IDENTITY_SCALE = 1e6

export function createMound(ctx: PhysicsContext, extraBodies: number, height: Uint16Array): Mound {
  const { store, grid } = ctx
  const options = ctx.options.mound!
  const balance = ctx.options.balance!
  const cellCount = grid.n * grid.n
  const touched = new Int32Array((store.capacity + extraBodies) * CELLS_PER_BODY * 2)
  let touchedCount = 0
  const entryCapacity = (store.capacity + extraBodies) * CELLS_PER_BODY
  const entries: Entries = { count: 0, cell: new Int32Array(entryCapacity), thickness: new Uint16Array(entryCapacity), identity: new Uint32Array(entryCapacity), agent: new Int32Array(entryCapacity) }
  const standMass = new Float32Array(cellCount)
  const standTouched = new Int32Array(store.capacity)
  let standTouchedCount = 0
  const maxMillimetres = Math.round(options.maxHeight * 1000)
  const cells: [number, number, number] = [0, 0, 0]

  const cellsOfBody = (x: number, z: number, yaw: number): void => {
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    for (let part = 0; part < CELLS_PER_BODY; part++) {
      const offset = (part - 1) * BODY_PART_SPACING
      cells[part] = grid.cellOf(x + sin * offset, z + cos * offset)
    }
  }

  const addBody = (x: number, z: number, yaw: number, millimetres: number, identity: number, agent: number): void => {
    cellsOfBody(x, z, yaw)
    for (const cell of cells) {
      if (cell < 0) continue
      if (height[cell] === 0) touched[touchedCount++] = cell
      height[cell]! += millimetres
      const index = entries.count++
      entries.cell[index] = cell
      entries.thickness[index] = millimetres
      entries.identity[index] = identity
      entries.agent[index] = agent
    }
  }

  const sumBodies = (): void => {
    for (let k = 0; k < touchedCount; k++) height[touched[k]!] = 0
    touchedCount = 0
    entries.count = 0
    for (let i = 0; i < store.n; i++) {
      const state = store.balance[i]
      if (store.band[i] !== 0 || (state !== BALANCE.FALLEN && state !== BALANCE.GETTING_UP)) continue
      addBody(store.x[i]!, store.z[i]!, store.renderYaw[i]!, Math.round(options.bodyThickness * store.build[i]! * 1000), store.identity[i]!, i)
    }
    const reach = options.corpseRadius * options.corpseRadius
    for (const { data } of ctx.corpseList()) {
      if ((data.x - ctx.centre.x) ** 2 + (data.z - ctx.centre.z) ** 2 > reach) continue
      addBody(data.x, data.z, data.yaw, Math.round(options.corpseThickness * data.build * 1000), mix32(Math.floor(data.seed * BODY_IDENTITY_SCALE)), -1)
    }
  }

  const isOpenCell = (cell: number): boolean => grid.occ[cell] === 0 || grid.occ[cell] === 3

  /** The lowest of the 8 neighbours that is open and has room for `millimetres` more; -1 when none has. Ties go to the lowest cell number. */
  const lowestNeighbour = (cell: number, millimetres: number): number => {
    const cx = cell % grid.n
    const cz = Math.floor(cell / grid.n)
    let best = -1
    for (let k = 0; k < NEIGHBOURS.length; k += 2) {
      const nx = cx + NEIGHBOURS[k]!
      const nz = cz + NEIGHBOURS[k + 1]!
      if (nx < 0 || nz < 0 || nx >= grid.n || nz >= grid.n) continue
      const neighbour = nz * grid.n + nx
      if (!isOpenCell(neighbour) || height[neighbour]! + millimetres > maxMillimetres) continue
      if (best < 0 || height[neighbour]! < height[best]! || (height[neighbour] === height[best] && neighbour < best)) best = neighbour
    }
    return best
  }

  const slideEntry = (index: number): void => {
    const cell = entries.cell[index]!
    const target = lowestNeighbour(cell, entries.thickness[index]!)
    if (target < 0) return
    if (height[target] === 0) touched[touchedCount++] = target
    height[target]! += entries.thickness[index]!
    height[cell]! -= entries.thickness[index]!
    entries.cell[index] = target
    const agent = entries.agent[index]!
    if (agent < 0) return
    store.x[agent]! += ((target % grid.n) - (cell % grid.n)) * grid.cell
    store.z[agent]! += (Math.floor(target / grid.n) - Math.floor(cell / grid.n)) * grid.cell
  }

  /** The bodies of a cell above the ceiling, taken in the order of their identity, slide to a lower neighbour: the result depends on who is in the cell, not on who was added first. */
  const capHeights = (): void => {
    let over = false
    for (let k = 0; k < touchedCount && !over; k++) over = height[touched[k]!]! > maxMillimetres
    if (!over) return
    const order = Array.from({ length: entries.count }, (_, index) => index).sort((a, b) => entries.cell[a]! - entries.cell[b]! || entries.identity[a]! - entries.identity[b]! || a - b)
    let current = -1
    let running = 0
    for (const index of order) {
      const cell = entries.cell[index]!
      if (cell !== current) {
        current = cell
        running = 0
      }
      if (height[cell]! <= maxMillimetres) continue
      if (running + entries.thickness[index]! <= maxMillimetres) running += entries.thickness[index]!
      else slideEntry(index)
    }
    for (let k = 0; k < touchedCount; k++) if (height[touched[k]!]! > maxMillimetres) height[touched[k]!] = maxMillimetres
  }

  const seatFallen = (): void => {
    let top = 0
    for (let k = 0; k < touchedCount; k++) top = Math.max(top, height[touched[k]!]!)
    ctx.stats.moundMax = top / 1000
    for (let i = 0; i < store.n; i++) {
      const state = store.balance[i]
      if (store.band[i] !== 0 || (state !== BALANCE.FALLEN && state !== BALANCE.GETTING_UP)) continue
      const cell = grid.cellOf(store.x[i]!, store.z[i]!)
      if (cell >= 0) store.y[i] = Math.max(0, height[cell]! / 1000 - options.bodyThickness * store.build[i]!)
    }
  }

  const weighStanding = (): void => {
    for (let k = 0; k < standTouchedCount; k++) standMass[standTouched[k]!] = 0
    standTouchedCount = 0
    let climbers = 0
    for (let i = 0; i < store.n; i++) {
      const state = store.balance[i]
      if (store.band[i] !== 0 || store.state[i] === STATE.PILE_STEP || (state !== BALANCE.STANDING && state !== BALANCE.STAGGERING)) continue
      if (store.y[i]! >= CLIMB_HEIGHT) climbers++
      if (store.y[i]! <= ELEVATED) continue
      const cell = grid.cellOf(store.x[i]!, store.z[i]!)
      if (cell < 0) continue
      if (standMass[cell] === 0) standTouched[standTouchedCount++] = cell
      standMass[cell]! += store.mass[i]!
    }
    ctx.stats.climbers = climbers
  }

  /** Every lying body takes damage for the weight standing on its three cells (`trampleDps` per 70 kg); a death waits for the end of the step. */
  const trample = (): void => {
    if (!standTouchedCount) return
    for (let i = 0; i < store.n; i++) {
      const state = store.balance[i]
      if (store.band[i] !== 0 || (state !== BALANCE.FALLEN && state !== BALANCE.GETTING_UP)) continue
      const mass = weightOn(i)
      if (!mass) continue
      store.hp[i]! -= balance.trampleDps * (mass / NEUTRAL_MASS) * ctx.h
      if (store.hp[i]! <= 0) ctx.deferKill(i)
    }
  }

  const step = (): void => {
    sumBodies()
    capHeights()
    seatFallen()
    weighStanding()
    trample()
  }

  const weightOn = (i: number): number => {
    cellsOfBody(store.x[i]!, store.z[i]!, store.renderYaw[i]!)
    let mass = 0
    for (const cell of cells) if (cell >= 0) mass += standMass[cell]!
    return mass
  }

  return { height, step, weightOn }
}
