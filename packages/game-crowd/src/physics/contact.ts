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
  /** 1 for the agents that take part in the contact this step (`takesPartInContact`), read once. */
  readonly takesPart: Uint8Array
  /** The radius and the effective mass of each agent this step, in doubles: the balance does not change inside the contact step. */
  readonly radiusOf: Float64Array
  readonly massOf: Float64Array
  /** Per pair, valid for the positions of the current iteration: the reach, the distance, and the normal (only meaningful when the distance is under the reach) from `j` to `i`. */
  readonly pairReach: Float64Array
  readonly pairDistance: Float64Array
  readonly pairNormalX: Float64Array
  readonly pairNormalZ: Float64Array
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
  takesPart: new Uint8Array(capacity),
  radiusOf: new Float64Array(capacity),
  massOf: new Float64Array(capacity),
  pairReach: new Float64Array(capacity * PAIRS_PER_AGENT),
  pairDistance: new Float64Array(capacity * PAIRS_PER_AGENT),
  pairNormalX: new Float64Array(capacity * PAIRS_PER_AGENT),
  pairNormalZ: new Float64Array(capacity * PAIRS_PER_AGENT),
})

export const createContactView = (store: CrowdStore, grid: NavGrid): ContactView => ({ n: 0, store, grid, workspace: createContactWorkspace(store.capacity, grid) })

/** In the contact: near the viewer, not a pile step, not asleep, not in the air as a thrown body. */
export const takesPartInContact = (store: CrowdStore, i: number): boolean => store.band[i] === 0 && store.balance[i] !== BALANCE.THROWN && store.state[i] !== STATE.PILE_STEP && store.state[i] !== STATE.DORMANT

const isOnGround = (store: CrowdStore, i: number): boolean => store.balance[i] === BALANCE.FALLEN || store.balance[i] === BALANCE.GETTING_UP

const effectiveMass = (store: CrowdStore, i: number): number => store.mass[i]! * (isOnGround(store, i) ? GROUND_MASS_FACTOR : 1)

const bodyRadius = (store: CrowdStore, i: number, radius: number): number => radius * store.build[i]!

/** What each agent is for this step: in the contact or not, its radius and its effective mass. */
function readBodies(view: ContactView, radius: number): void {
  const { store, workspace } = view
  const { takesPart, radiusOf, massOf } = workspace
  for (let i = 0; i < view.n; i++) {
    const takes = takesPartInContact(store, i)
    takesPart[i] = takes ? 1 : 0
    radiusOf[i] = bodyRadius(store, i, radius)
    massOf[i] = effectiveMass(store, i)
  }
}

/** The agents of band R0 into the 1 m hash, clearing only the cells the last step used. */
export function rebuildHash(view: ContactView): void {
  const { store, grid, workspace } = view
  const side = Math.floor(grid.size)
  for (let k = 0; k < workspace.touchedCount; k++) workspace.head[workspace.touched[k]!] = -1
  workspace.touchedCount = 0
  for (let i = 0; i < view.n; i++) {
    if (!workspace.takesPart[i]) continue
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

function addPairsOfCell(view: ContactView, i: number, cell: number, sameCell: boolean): void {
  const { store, workspace } = view
  const { head, next, radiusOf, pairI, pairJ } = workspace
  const { x, z, y } = store
  const xi = x[i]!
  const zi = z[i]!
  const yi = y[i]!
  const reachBase = radiusOf[i]! + PAIR_MARGIN
  for (let j = head[cell]!; j !== -1; j = next[j]!) {
    if ((sameCell && j <= i) || Math.abs(yi - y[j]!) > MAX_LEVEL_GAP) continue
    const reach = reachBase + radiusOf[j]!
    const ex = x[j]! - xi
    const ez = z[j]! - zi
    if (ex * ex + ez * ez >= reach * reach || workspace.pairCount >= pairI.length) continue
    pairI[workspace.pairCount] = i
    pairJ[workspace.pairCount++] = j
  }
}

/** The pairs `(i, j)` near enough to touch before the step ends, in the order of the agent that found them. The solver is symmetric in the two of a pair, so which one comes first does not matter. */
function collectPairs(view: ContactView): void {
  const { store, grid, workspace } = view
  const side = Math.floor(grid.size)
  workspace.pairCount = 0
  for (let i = 0; i < view.n; i++) {
    if (!workspace.takesPart[i]) continue
    const hx = Math.floor(store.x[i]! + grid.half)
    const hz = Math.floor(store.z[i]! + grid.half)
    if (hx < 0 || hz < 0 || hx >= side || hz >= side) continue
    addPairsOfCell(view, i, hz * side + hx, true)
    for (let k = 0; k < FORWARD_CELLS.length; k += 2) {
      const qx = hx + FORWARD_CELLS[k]!
      const qz = hz + FORWARD_CELLS[k + 1]!
      if (qx >= 0 && qz >= 0 && qx < side && qz < side) addPairsOfCell(view, i, qz * side + qx, false)
    }
  }
}

/** The distance, reach and normal (from `j` to `i`) of every pair at the current positions; a pair on the same spot gets a direction from the two identities. */
function measurePairs(view: ContactView): void {
  const { store, workspace } = view
  const { pairI, pairJ, radiusOf, pairReach, pairDistance, pairNormalX, pairNormalZ } = workspace
  const { x, z, identity } = store
  for (let p = 0; p < workspace.pairCount; p++) {
    const i = pairI[p]!
    const j = pairJ[p]!
    const reach = radiusOf[i]! + radiusOf[j]!
    const ex = x[i]! - x[j]!
    const ez = z[i]! - z[j]!
    const distance = Math.sqrt(ex * ex + ez * ez)
    pairReach[p] = reach
    pairDistance[p] = distance
    if (distance >= reach) continue
    if (distance > MIN_DISTANCE) {
      pairNormalX[p] = ex / distance
      pairNormalZ[p] = ez / distance
      continue
    }
    const angle = 2 * Math.PI * unit(identity[i]! ^ identity[j]!, 0, SALT.SPIN)
    pairNormalX[p] = Math.cos(angle)
    pairNormalZ[p] = Math.sin(angle)
  }
}

/** One inelastic impulse along the normal: the closing speed of the two bodies goes to zero, never below (restitution 0). */
function solveImpulse(store: CrowdStore, workspace: ContactWorkspace, p: number): void {
  if (workspace.pairDistance[p]! >= workspace.pairReach[p]!) return
  const i = workspace.pairI[p]!
  const j = workspace.pairJ[p]!
  const nx = workspace.pairNormalX[p]!
  const nz = workspace.pairNormalZ[p]!
  const { vx, vz, pushX, pushZ } = store
  const closing = (vx[i]! + pushX[i]! - vx[j]! - pushX[j]!) * nx + (vz[i]! + pushZ[i]! - vz[j]! - pushZ[j]!) * nz
  if (closing >= 0) return
  const massI = workspace.massOf[i]!
  const massJ = workspace.massOf[j]!
  const impulse = (-closing * massI * massJ) / (massI + massJ)
  pushX[i]! += (impulse * nx) / massI
  pushZ[i]! += (impulse * nz) / massI
  pushX[j]! -= (impulse * nx) / massJ
  pushZ[j]! -= (impulse * nz) / massJ
}

function accumulateCorrection(workspace: ContactWorkspace, p: number, relaxation: number): void {
  const distance = workspace.pairDistance[p]!
  const reach = workspace.pairReach[p]!
  if (distance >= reach) return
  const i = workspace.pairI[p]!
  const j = workspace.pairJ[p]!
  const massI = workspace.massOf[i]!
  const massJ = workspace.massOf[j]!
  const move = relaxation * (reach - distance)
  const nx = workspace.pairNormalX[p]!
  const nz = workspace.pairNormalZ[p]!
  workspace.deltaX[i]! += move * nx * (massJ / (massI + massJ))
  workspace.deltaZ[i]! += move * nz * (massJ / (massI + massJ))
  workspace.deltaX[j]! -= move * nx * (massI / (massI + massJ))
  workspace.deltaZ[j]! -= move * nz * (massI / (massI + massJ))
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
  for (let p = 0; p < workspace.pairCount; p++) accumulateCorrection(workspace, p, params.relaxation)
  for (let p = 0; p < workspace.pairCount; p++) {
    applyCorrection(view, workspace.pairI[p]!, params)
    applyCorrection(view, workspace.pairJ[p]!, params)
  }
}

function measureOverlaps(view: ContactView, out: ContactResult): void {
  const { store, workspace } = view
  for (let p = 0; p < workspace.pairCount; p++) {
    const i = workspace.pairI[p]!
    const j = workspace.pairJ[p]!
    // two bodies lying on the ground are meant to lie on one another: that is the mound, not a failure of the contact
    if (isOnGround(store, i) && isOnGround(store, j)) continue
    const reach = workspace.radiusOf[i]! + workspace.radiusOf[j]!
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
  readBodies(view, params.radius)
  rebuildHash(view)
  collectPairs(view)
  for (let iteration = 0; iteration < params.iterations; iteration++) {
    measurePairs(view)
    for (let p = 0; p < workspace.pairCount; p++) solveImpulse(store, workspace, p)
    for (let p = workspace.pairCount - 1; p >= 0; p--) solveImpulse(store, workspace, p)
    correctPositions(view, params)
  }
  measureOverlaps(view, out)
  dampPush(view, params)
}
