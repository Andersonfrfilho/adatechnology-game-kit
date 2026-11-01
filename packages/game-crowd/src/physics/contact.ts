import type { NavGrid } from '../grid'
import { SALT, unit } from '../identity'
import type { CrowdStore } from '../store'
import { BALANCE, STATE } from '../types'
import type { CrowdContactOptions } from './options'

/** A fallen body weighs as three standing ones against a push (it is on the ground, spread out). */
const GROUND_MASS_FACTOR = 3
const PAIR_MARGIN = 0.15
const MAX_LEVEL_GAP = 0.15
const PAIRS_PER_AGENT = 12
const MIN_DISTANCE = 1e-6

export type ContactParams = Required<CrowdContactOptions> & { readonly h: number }
export type ContactResult = { contacts: number; maxOverlap: number; overlapSum: number }

export type ContactWorkspace = {
  readonly head: Int32Array
  readonly next: Int32Array
  readonly touched: Int32Array
  touchedCount: number
  readonly pairI: Int32Array
  readonly pairJ: Int32Array
  pairCount: number
  readonly deltaX: Float32Array
  readonly deltaZ: Float32Array
  readonly count: Uint8Array
  readonly pushBeforeX: Float32Array
  readonly pushBeforeZ: Float32Array
  /** |Δpush| the contact gave to each agent in the last step. */
  readonly shove: Float32Array
}

export type ContactView = { n: number; readonly store: CrowdStore; readonly grid: NavGrid; readonly workspace: ContactWorkspace }

export const createContactWorkspace = (capacity: number, grid: NavGrid): ContactWorkspace => ({
  head: new Int32Array(Math.floor(grid.size) ** 2).fill(-1),
  next: new Int32Array(capacity),
  touched: new Int32Array(capacity),
  touchedCount: 0,
  pairI: new Int32Array(capacity * PAIRS_PER_AGENT),
  pairJ: new Int32Array(capacity * PAIRS_PER_AGENT),
  pairCount: 0,
  deltaX: new Float32Array(capacity),
  deltaZ: new Float32Array(capacity),
  count: new Uint8Array(capacity),
  pushBeforeX: new Float32Array(capacity),
  pushBeforeZ: new Float32Array(capacity),
  shove: new Float32Array(capacity),
})

export const createContactView = (store: CrowdStore, grid: NavGrid): ContactView => ({ n: 0, store, grid, workspace: createContactWorkspace(store.capacity, grid) })

/** In the contact: near the viewer, not a pile step, not asleep, not in the air as a thrown body. */
export const takesPartInContact = (store: CrowdStore, i: number): boolean => store.band[i] === 0 && store.balance[i] !== BALANCE.THROWN && store.state[i] !== STATE.PILE_STEP && store.state[i] !== STATE.DORMANT

const isOnGround = (store: CrowdStore, i: number): boolean => store.balance[i] === BALANCE.FALLEN || store.balance[i] === BALANCE.GETTING_UP

const effectiveMass = (store: CrowdStore, i: number): number => store.mass[i]! * (isOnGround(store, i) ? GROUND_MASS_FACTOR : 1)

const bodyRadius = (store: CrowdStore, i: number, radius: number): number => radius * store.build[i]!

/** The agents of band R0 into the 1 m hash, clearing only the cells the last step used. */
function rebuildHash(view: ContactView): void {
  const { store, grid, workspace } = view
  const side = Math.floor(grid.size)
  for (let k = 0; k < workspace.touchedCount; k++) workspace.head[workspace.touched[k]!] = -1
  workspace.touchedCount = 0
  for (let i = 0; i < view.n; i++) {
    if (!takesPartInContact(store, i)) continue
    const hx = Math.floor(store.x[i]! + grid.half)
    const hz = Math.floor(store.z[i]! + grid.half)
    if (hx < 0 || hz < 0 || hx >= side || hz >= side) continue
    const cell = hz * side + hx
    if (workspace.head[cell] === -1) workspace.touched[workspace.touchedCount++] = cell
    workspace.next[i] = workspace.head[cell]!
    workspace.head[cell] = i
  }
}

/** The cells scanned from a cell for pairs: itself (the agents after the first) and four neighbours, so that every pair of cells is looked at once, from one side. */
const FORWARD_CELLS = [1, 0, -1, 1, 0, 1, 1, 1] as const

function addPairsOfCell(view: ContactView, i: number, cell: number, sameCell: boolean, radius: number): void {
  const { store, workspace } = view
  const reachBase = bodyRadius(store, i, radius) + PAIR_MARGIN
  for (let j = workspace.head[cell]!; j !== -1; j = workspace.next[j]!) {
    if ((sameCell && j <= i) || Math.abs(store.y[i]! - store.y[j]!) > MAX_LEVEL_GAP) continue
    const reach = reachBase + bodyRadius(store, j, radius)
    const ex = store.x[j]! - store.x[i]!
    const ez = store.z[j]! - store.z[i]!
    if (ex * ex + ez * ez >= reach * reach || workspace.pairCount >= workspace.pairI.length) continue
    workspace.pairI[workspace.pairCount] = i
    workspace.pairJ[workspace.pairCount++] = j
  }
}

/** The pairs `(i, j)` near enough to touch before the step ends, in the order of the agent that found them. The solver is symmetric in the two of a pair, so which one comes first does not matter. */
function collectPairs(view: ContactView, radius: number): void {
  const { store, grid, workspace } = view
  const side = Math.floor(grid.size)
  workspace.pairCount = 0
  for (let i = 0; i < view.n; i++) {
    if (!takesPartInContact(store, i)) continue
    const hx = Math.floor(store.x[i]! + grid.half)
    const hz = Math.floor(store.z[i]! + grid.half)
    if (hx < 0 || hz < 0 || hx >= side || hz >= side) continue
    addPairsOfCell(view, i, hz * side + hx, true, radius)
    for (let k = 0; k < FORWARD_CELLS.length; k += 2) {
      const qx = hx + FORWARD_CELLS[k]!
      const qz = hz + FORWARD_CELLS[k + 1]!
      if (qx >= 0 && qz >= 0 && qx < side && qz < side) addPairsOfCell(view, i, qz * side + qx, false, radius)
    }
  }
}

/** The unit normal from `j` to `i` into `out`; a pair on the same spot gets a direction from the two identities. */
function normalOf(store: CrowdStore, i: number, j: number, distance: number, out: [number, number]): void {
  if (distance > MIN_DISTANCE) {
    out[0] = (store.x[i]! - store.x[j]!) / distance
    out[1] = (store.z[i]! - store.z[j]!) / distance
    return
  }
  const angle = 2 * Math.PI * unit(store.identity[i]! ^ store.identity[j]!, 0, SALT.SPIN)
  out[0] = Math.cos(angle)
  out[1] = Math.sin(angle)
}

const normal: [number, number] = [0, 0]

/** One inelastic impulse along the normal: the closing speed of the two bodies goes to zero, never below (restitution 0). */
function solveImpulse(store: CrowdStore, i: number, j: number, radius: number): void {
  const reach = bodyRadius(store, i, radius) + bodyRadius(store, j, radius)
  const ex = store.x[i]! - store.x[j]!
  const ez = store.z[i]! - store.z[j]!
  const distance = Math.sqrt(ex * ex + ez * ez)
  if (distance >= reach) return
  normalOf(store, i, j, distance, normal)
  const closing = (store.vx[i]! + store.pushX[i]! - store.vx[j]! - store.pushX[j]!) * normal[0] + (store.vz[i]! + store.pushZ[i]! - store.vz[j]! - store.pushZ[j]!) * normal[1]
  if (closing >= 0) return
  const massI = effectiveMass(store, i)
  const massJ = effectiveMass(store, j)
  const impulse = (-closing * massI * massJ) / (massI + massJ)
  store.pushX[i]! += (impulse * normal[0]) / massI
  store.pushZ[i]! += (impulse * normal[1]) / massI
  store.pushX[j]! -= (impulse * normal[0]) / massJ
  store.pushZ[j]! -= (impulse * normal[1]) / massJ
}

function accumulateCorrection(view: ContactView, p: number, params: ContactParams): void {
  const { store, workspace } = view
  const i = workspace.pairI[p]!
  const j = workspace.pairJ[p]!
  const reach = bodyRadius(store, i, params.radius) + bodyRadius(store, j, params.radius)
  const ex = store.x[i]! - store.x[j]!
  const ez = store.z[i]! - store.z[j]!
  const distance = Math.sqrt(ex * ex + ez * ez)
  if (distance >= reach) return
  normalOf(store, i, j, distance, normal)
  const massI = effectiveMass(store, i)
  const massJ = effectiveMass(store, j)
  const move = params.relaxation * (reach - distance)
  workspace.deltaX[i]! += move * normal[0] * (massJ / (massI + massJ))
  workspace.deltaZ[i]! += move * normal[1] * (massJ / (massI + massJ))
  workspace.deltaX[j]! -= move * normal[0] * (massI / (massI + massJ))
  workspace.deltaZ[j]! -= move * normal[1] * (massI / (massI + massJ))
  workspace.count[i]!++
  workspace.count[j]!++
}

const isOpen = (grid: NavGrid, x: number, z: number): boolean => {
  const cell = grid.cellOf(x, z)
  return cell >= 0 && (grid.occ[cell] === 0 || grid.occ[cell] === 3)
}

/** The mean of the corrections an agent got, capped, along each axis only if the grid lets it through. */
function applyCorrection(view: ContactView, agent: number, params: ContactParams): void {
  const { store, grid, workspace } = view
  const count = workspace.count[agent]!
  if (!count) return
  workspace.count[agent] = 0
  const cap = params.maxCorrection
  const dx = Math.max(-cap, Math.min(cap, workspace.deltaX[agent]! / count))
  const dz = Math.max(-cap, Math.min(cap, workspace.deltaZ[agent]! / count))
  if (isOpen(grid, store.x[agent]! + dx, store.z[agent]!)) store.x[agent]! += dx
  if (isOpen(grid, store.x[agent]!, store.z[agent]! + dz)) store.z[agent]! += dz
}

function resetCorrection(workspace: ContactWorkspace, agent: number): void {
  workspace.deltaX[agent] = 0
  workspace.deltaZ[agent] = 0
  workspace.count[agent] = 0
}

function correctPositions(view: ContactView, params: ContactParams): void {
  const { workspace } = view
  for (let p = 0; p < workspace.pairCount; p++) {
    resetCorrection(workspace, workspace.pairI[p]!)
    resetCorrection(workspace, workspace.pairJ[p]!)
  }
  for (let p = 0; p < workspace.pairCount; p++) accumulateCorrection(view, p, params)
  for (let p = 0; p < workspace.pairCount; p++) {
    applyCorrection(view, workspace.pairI[p]!, params)
    applyCorrection(view, workspace.pairJ[p]!, params)
  }
}

function measureOverlaps(view: ContactView, radius: number, out: ContactResult): void {
  const { store, workspace } = view
  for (let p = 0; p < workspace.pairCount; p++) {
    const i = workspace.pairI[p]!
    const j = workspace.pairJ[p]!
    // two bodies lying on the ground are meant to lie on one another: that is the mound, not a failure of the contact
    if (isOnGround(store, i) && isOnGround(store, j)) continue
    const reach = bodyRadius(store, i, radius) + bodyRadius(store, j, radius)
    const overlap = reach - Math.hypot(store.x[i]! - store.x[j]!, store.z[i]! - store.z[j]!)
    if (overlap <= 0) continue
    out.contacts++
    out.overlapSum += overlap
    if (overlap > out.maxOverlap) out.maxOverlap = overlap
  }
}

/** The damping and the ceiling of the push, for every agent: a body out of band R0 keeps no push for long. */
function dampPush(view: ContactView, params: ContactParams): void {
  const { store, workspace } = view
  const lambda = Math.exp(-params.friction * params.h)
  for (let i = 0; i < view.n; i++) {
    workspace.shove[i] = Math.hypot(store.pushX[i]! - workspace.pushBeforeX[i]!, store.pushZ[i]! - workspace.pushBeforeZ[i]!)
    store.pushX[i]! *= lambda
    store.pushZ[i]! *= lambda
    const speed = Math.hypot(store.pushX[i]!, store.pushZ[i]!)
    if (speed <= params.maxPush) continue
    store.pushX[i]! *= params.maxPush / speed
    store.pushZ[i]! *= params.maxPush / speed
  }
}

/**
 * One fixed step of contact in band R0 (`design-chain-horde.md` §4.3): `iterations` rounds of a symmetric Gauss-Seidel impulse (the pairs forward, then backward, so
 * a low index has no advantage) and a Jacobi position correction (the mean of what each agent was asked to move), then the damping of the push.
 * It resolves overlap and shock only: pressure is the field of `pressure.ts`. An inelastic impulse never adds energy, and the correction never touches the velocity.
 */
export function contactStep(view: ContactView, params: ContactParams, out: ContactResult): void {
  const { store, workspace } = view
  out.contacts = 0
  out.maxOverlap = 0
  out.overlapSum = 0
  for (let i = 0; i < view.n; i++) {
    workspace.pushBeforeX[i] = store.pushX[i]!
    workspace.pushBeforeZ[i] = store.pushZ[i]!
  }
  rebuildHash(view)
  collectPairs(view, params.radius)
  for (let iteration = 0; iteration < params.iterations; iteration++) {
    for (let p = 0; p < workspace.pairCount; p++) solveImpulse(store, workspace.pairI[p]!, workspace.pairJ[p]!, params.radius)
    for (let p = workspace.pairCount - 1; p >= 0; p--) solveImpulse(store, workspace.pairI[p]!, workspace.pairJ[p]!, params.radius)
    correctPositions(view, params)
  }
  measureOverlaps(view, params.radius, out)
  dampPush(view, params)
}
