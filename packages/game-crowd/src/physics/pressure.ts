import type { CrowdStore } from '../store'
import { BALANCE } from '../types'
import { takesPartInContact } from './contact'
import type { ContactView } from './contact'
import type { CrowdPressureOptions } from './options'

/** Two bodies count as touching up to this far past the sum of their radii. */
const TOUCH_SLACK = 0.08
/** How far past its own radius an agent feels a wall in front of it. */
const WALL_PROBE = 0.12
/** The agents that stand in front of the target and pass the field on to it (a little past the attack range). */
const PLAYER_REACH = 1.3
const PLAYER_RADIUS_SQUARED = PLAYER_REACH * PLAYER_REACH

export type PressureParams = Required<CrowdPressureOptions> & { readonly h: number; readonly radius: number }

export type PressureWorkspace = {
  readonly weightSum: Float32Array
  /** 1 when something stands in front of the agent that it presses on (a wall, a body, even one pressing back). */
  readonly pressing: Uint8Array
  readonly wallKind: Uint8Array
  readonly wallDoor: Int32Array
  readonly playerWeight: Float32Array
  readonly cutExcess: Float32Array
  readonly cutX: Float32Array
  readonly cutZ: Float32Array
  readonly pairWeightForward: Float32Array
  readonly pairWeightBackward: Float32Array
}

export type PressureContext = {
  /** Newtons of will of each type, by type index. */
  readonly driveForceOfType: Float32Array
  /** The door index of a grid cell, -1 for none. */
  readonly doorAt: (cell: number) => number
  /** N·s each door got from the field this step, added to. */
  readonly doorLoad: Float32Array
  /** The agent the horde presses on (position only); undefined: nothing to press on. */
  readonly player?: { readonly x: number; readonly z: number } | undefined
}

export type PressureResult = { playerLoad: number; drivers: number }

export const createPressureWorkspace = (capacity: number, pairCapacity: number): PressureWorkspace => ({
  weightSum: new Float32Array(capacity),
  pressing: new Uint8Array(capacity),
  wallKind: new Uint8Array(capacity),
  wallDoor: new Int32Array(capacity),
  playerWeight: new Float32Array(capacity),
  cutExcess: new Float32Array(capacity),
  cutX: new Float32Array(capacity),
  cutZ: new Float32Array(capacity),
  pairWeightForward: new Float32Array(pairCapacity),
  pairWeightBackward: new Float32Array(pairCapacity),
})

const isPressing = (store: CrowdStore, i: number): boolean => takesPartInContact(store, i) && (store.balance[i] === BALANCE.STANDING || store.balance[i] === BALANCE.STAGGERING)

const frontWeight = (alignment: number, cone: number): number => (alignment > cone ? (alignment - cone) / (1 - cone) : 0)

const hasAim = (store: CrowdStore, i: number): boolean => store.aimX[i] !== 0 || store.aimZ[i] !== 0

/** The will of `i` against its front neighbour `j`: the part of its speed along the contact that the neighbour does not have is cut. */
function noteCut(store: CrowdStore, workspace: PressureWorkspace, i: number, j: number, nx: number, nz: number): void {
  const excess = (store.vx[i]! - store.vx[j]!) * nx + (store.vz[i]! - store.vz[j]!) * nz
  if (excess <= workspace.cutExcess[i]!) return
  workspace.cutExcess[i] = excess
  workspace.cutX[i] = nx
  workspace.cutZ[i] = nz
}

/** Pass A: the weight of each front contact between agents, per direction, and the cut of the will against it. */
function weighPairs(view: ContactView, workspace: PressureWorkspace, params: PressureParams): void {
  const { store } = view
  for (let p = 0; p < view.workspace.pairCount; p++) {
    workspace.pairWeightForward[p] = 0
    workspace.pairWeightBackward[p] = 0
    const i = view.workspace.pairI[p]!
    const j = view.workspace.pairJ[p]!
    if (!isPressing(store, i) || !isPressing(store, j)) continue
    const ex = store.x[j]! - store.x[i]!
    const ez = store.z[j]! - store.z[i]!
    const distance = Math.sqrt(ex * ex + ez * ez)
    if (distance < 1e-6 || distance > (store.build[i]! + store.build[j]!) * params.radius + TOUCH_SLACK) continue
    const nx = ex / distance
    const nz = ez / distance
    const forward = frontWeight(store.aimX[i]! * nx + store.aimZ[i]! * nz, params.frontCone)
    const backward = frontWeight(-(store.aimX[j]! * nx + store.aimZ[j]! * nz), params.frontCone)
    if (forward > 0) {
      workspace.pressing[i] = 1
      noteCut(store, workspace, i, j, nx, nz)
    }
    if (backward > 0) {
      workspace.pressing[j] = 1
      noteCut(store, workspace, j, i, -nx, -nz)
    }
    // two agents pressing on each other (head on) feel their own drive and no more: passing the field both ways would feed it back on itself without a limit
    if (forward > 0 && backward > 0) continue
    workspace.pairWeightForward[p] = forward
    workspace.pairWeightBackward[p] = backward
    workspace.weightSum[i]! += forward
    workspace.weightSum[j]! += backward
  }
}

/** Pass B: a blocked grid cell in the direction of the will is a wall of weight 1 (a closed door too, and the door takes the load). */
function weighWalls(view: ContactView, workspace: PressureWorkspace, params: PressureParams, doorAt: PressureContext['doorAt']): void {
  const { store, grid } = view
  for (let i = 0; i < view.n; i++) {
    if (!isPressing(store, i) || !hasAim(store, i)) continue
    const reach = store.build[i]! * params.radius + WALL_PROBE
    const cell = grid.cellOf(store.x[i]! + store.aimX[i]! * reach, store.z[i]! + store.aimZ[i]! * reach)
    if (cell >= 0 && (grid.occ[cell] === 0 || grid.occ[cell] === 3)) continue
    workspace.wallKind[i] = 1
    workspace.wallDoor[i] = cell >= 0 && grid.occ[cell] === 5 ? doorAt(cell) : -1
    workspace.pressing[i] = 1
    workspace.weightSum[i]! += 1
  }
}

/** The agents at the target pass the field on to it: one that wants to go there by its cone weight, one that stopped to attack with weight 1. */
function weighPlayer(view: ContactView, workspace: PressureWorkspace, params: PressureParams, player: { readonly x: number; readonly z: number }): void {
  const { store } = view
  for (let i = 0; i < view.n; i++) {
    if (!isPressing(store, i)) continue
    const ex = player.x - store.x[i]!
    const ez = player.z - store.z[i]!
    const squared = ex * ex + ez * ez
    if (squared > PLAYER_RADIUS_SQUARED || squared < 1e-6) continue
    const distance = Math.sqrt(squared)
    const weight = hasAim(store, i) ? frontWeight((store.aimX[i]! * ex + store.aimZ[i]! * ez) / distance, params.frontCone) : 1
    workspace.playerWeight[i] = weight
    if (weight > 0) workspace.pressing[i] = 1
    workspace.weightSum[i]! += weight
  }
}

function clearWorkspace(view: ContactView, workspace: PressureWorkspace): void {
  const { store } = view
  for (let i = 0; i < view.n; i++) {
    workspace.weightSum[i] = 0
    workspace.pressing[i] = 0
    workspace.wallKind[i] = 0
    workspace.playerWeight[i] = 0
    workspace.cutExcess[i] = 0
    store.field[i] = 0
  }
}

/** What agent `i` adds to the field by itself: its drive, when it wants to go and has something in front. */
function ownDrive(store: CrowdStore, context: PressureContext, workspace: PressureWorkspace, i: number): number {
  if (!hasAim(store, i) || !workspace.pressing[i]) return 0
  return context.driveForceOfType[store.type[i]!]! * store.driveFactor[i]!
}

/** Pass C: each agent's field is its own drive plus what the agents behind it passed on, read from the previous step. */
function spreadField(view: ContactView, workspace: PressureWorkspace, params: PressureParams, context: PressureContext, out: PressureResult): void {
  const { store } = view
  for (let i = 0; i < view.n; i++) {
    if (!isPressing(store, i)) continue
    store.field[i] = ownDrive(store, context, workspace, i)
    if (store.field[i]! > 0) out.drivers++
  }
  for (let p = 0; p < view.workspace.pairCount; p++) {
    const i = view.workspace.pairI[p]!
    const j = view.workspace.pairJ[p]!
    const forward = workspace.pairWeightForward[p]!
    const backward = workspace.pairWeightBackward[p]!
    if (forward > 0) store.field[j]! += (params.transmission * store.fieldPrev[i]! * forward * forward) / workspace.weightSum[i]!
    if (backward > 0) store.field[i]! += (params.transmission * store.fieldPrev[j]! * backward * backward) / workspace.weightSum[j]!
  }
  for (let i = 0; i < view.n; i++) {
    if (!isPressing(store, i)) continue
    const passed = (params.transmission * store.fieldPrev[i]!) / (workspace.weightSum[i]! || 1)
    if (workspace.wallKind[i] && workspace.wallDoor[i]! >= 0) context.doorLoad[workspace.wallDoor[i]!]! += passed * params.h
    if (workspace.playerWeight[i]! > 0) out.playerLoad += passed * workspace.playerWeight[i]! * workspace.playerWeight[i]!
    if (store.field[i]! > params.cap) store.field[i] = params.cap
  }
}

function applyCuts(view: ContactView, workspace: PressureWorkspace): void {
  const { store } = view
  for (let i = 0; i < view.n; i++) {
    const excess = workspace.cutExcess[i]!
    if (excess <= 0) continue
    store.vx[i]! -= excess * workspace.cutX[i]!
    store.vz[i]! -= excess * workspace.cutZ[i]!
  }
}

/**
 * One fixed step of the pressure field (`design-chain-horde.md` §4.5): the field moves one hop per step, each agent reading only the previous step of the others, so the
 * result does not depend on the order of the indices. A column of N pushing agents gives its front `D·(1 − τᴺ)/(1 − τ)`; a hexagonal block against a flat wall loses 29% per hop.
 */
export function pressureStep(view: ContactView, workspace: PressureWorkspace, params: PressureParams, context: PressureContext, out: PressureResult): void {
  out.playerLoad = 0
  out.drivers = 0
  clearWorkspace(view, workspace)
  weighPairs(view, workspace, params)
  weighWalls(view, workspace, params, context.doorAt)
  if (context.player) weighPlayer(view, workspace, params, context.player)
  spreadField(view, workspace, params, context, out)
  applyCuts(view, workspace)
  for (let i = 0; i < view.n; i++) view.store.fieldPrev[i] = view.store.field[i]!
}

