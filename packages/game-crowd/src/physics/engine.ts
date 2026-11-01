import type { CrowdType } from '../types'
import { createBalance } from './balance'
import type { Balance } from './balance'
import { createBlasts } from './blast'
import type { Blasts } from './blast'
import { contactStep, createContactView, prepareHash } from './contact'
import type { ContactResult, ContactView } from './contact'
import { createPhysicsStats } from './context'
import type { PhysicsContext, PhysicsStats } from './context'
import { createDensity } from './density'
import type { Density } from './density'
import { createMound } from './mound'
import type { Mound } from './mound'
import type { ResolvedPhysics } from './options'
import { createDefaultWorkerFactory } from './offload/default-worker'
import { createOffload } from './offload/offload'
import type { Offload } from './offload/offload'
import { createInlineRunner, createSharedRunner, createTransferRunner, isSharedAvailable } from './offload/runner'
import type { StepRunner } from './offload/runner'
import { createPlayerPressure } from './player-pressure'
import type { PlayerPressure } from './player-pressure'
import { createPressureWorkspace, pressureStep } from './pressure'
import type { PressureResult, PressureWorkspace } from './pressure'
import { createThrown, createThrownPool } from './thrown'
import type { Thrown, ThrownPool } from './thrown'

/** Newtons of will of a type that says nothing else (`design-chain-horde.md` §5.1). */
export const DEFAULT_DRIVE_FORCE = 250
const GRAVITY_FORCE = 9.8
const EXTRA_BODIES = 500
const PAIRS_PER_AGENT = 12

/** What the crowd hands over: the shared state and the verbs only it can do. */
export type PhysicsBase = Omit<PhysicsContext, 'options' | 'stats' | 'step' | 'h' | 'centre' | 'lastBlastStep' | 'moundAt' | 'weightOn'> & {
  readonly types: readonly CrowdType[]
  readonly moundHeight: Uint16Array
  readonly corpsesMax: number
  pileBlast(x: number, z: number, radius: number): void
}

export type PhysicsEngine = {
  readonly ctx: PhysicsContext
  /** True when the contact is on: the rest of the parts depend on it. */
  readonly active: boolean
  readonly stats: PhysicsStats
  readonly blasts: Blasts
  readonly thrown: ThrownPool
  readonly contact: ContactView | null
  readonly balance: Balance | null
  /** Starts the fixed step: keeps the positions, counts the step and resolves the blasts that arrived. */
  beginStep(h: number, centre: { readonly x: number; readonly z: number }): void
  /** Contact, pressure, balance, mound and thrown bodies, in the order of the design (§3, items 5 to 10). */
  endStep(): void
  /** The store removed agent `removed` and moved agent `moved` into its place. */
  remap(removed: number, moved: number): void
  /** Stops the worker, if there is one. */
  dispose(): void
  /** What the wanted speed of an agent of band `band` is multiplied by in a thick far crowd (1 with the density off or in any other band). */
  densitySlowdown(i: number, band: number): number
  /** `pressure / critical pressure` of an agent: how close it is to falling. */
  pressureRatio(i: number): number
}

export function createPhysics(base: PhysicsBase, options: ResolvedPhysics, stats: PhysicsStats = createPhysicsStats()): PhysicsEngine {
  const moundOn = options.mound !== null
  const ctx: PhysicsContext = { ...base, options, stats, step: -1, h: 0, centre: { x: 0, z: 0 }, lastBlastStep: -1000, moundAt: (cell) => (moundOn ? base.moundHeight[cell]! : 0), weightOn: () => 0 }
  const { store, grid } = base
  const balance = options.balance ? createBalance(ctx) : null
  const thrown: Thrown | null = options.thrown ? createThrown(ctx) : null
  const contact = options.contact ? createContactView(store, grid) : null
  const pressure: PressureWorkspace | null = options.pressure && contact ? createPressureWorkspace(store.capacity, store.capacity * PAIRS_PER_AGENT) : null
  const mound: Mound | null = options.mound ? createMound(ctx, Math.max(EXTRA_BODIES, base.corpsesMax), base.moundHeight) : null
  if (mound) ctx.weightOn = mound.weightOn
  const density: Density | null = options.density && balance ? createDensity(ctx, options.density) : null
  const playerPressure: PlayerPressure | null = pressure ? createPlayerPressure(ctx) : null
  const blasts = createBlasts(ctx, { balance, thrown, pileBlast: base.pileBlast })
  const contactResult: ContactResult = { contacts: 0, maxOverlap: 0, overlapSum: 0 }
  const pressureResult: PressureResult = { playerLoad: 0, drivers: 0 }
  const driveForceOfType = Float32Array.from(base.types, (type) => type.balance?.driveForce ?? DEFAULT_DRIVE_FORCE)
  const offload: Offload | null = options.worker !== 'off' && contact ? createOffloadFor() : null
  let doorLoad = new Float32Array(0)
  let doorSince = new Float32Array(0)
  const keepPositions = options.contact !== null || options.deterministic

  function createRunner(): StepRunner | null {
    const gridCells = grid.occ.length
    const shape = { capacity: store.capacity, cells: gridCells }
    const setup = { capacity: store.capacity, gridSize: grid.size, gridCell: grid.cell, contact: options.contact!, pressure: options.pressure, driveForceOfType: Array.from(driveForceOfType) }
    const transport = options.workerTransport ?? (isSharedAvailable() ? 'shared' : 'transfer')
    const slots = options.workerLatency
    if (transport === 'inline') return createInlineRunner(setup, shape, slots)
    const factory = options.workerFactory ?? createDefaultWorkerFactory()
    if (!factory) {
      if (options.worker === 'on') throw new Error('crowd physics: worker "on" but no Worker can be made here (give physics.workerFactory)')
      return null
    }
    return transport === 'shared' ? createSharedRunner(setup, shape, factory, slots) : createTransferRunner(setup, shape, factory, slots)
  }

  function createOffloadFor(): Offload | null {
    const runner = createRunner()
    if (!runner) return null
    const host = {
      store,
      grid,
      stats,
      contact: contact!,
      addDoorLoad: (cell: number, load: number): void => {
        const door = ctx.doors.at(cell)
        if (door < 0) return
        growDoorArrays()
        doorLoad[door]! += load
      },
    }
    return createOffload(runner, host, options.workerLatency)
  }

  const beginStep = (h: number, centre: { readonly x: number; readonly z: number }): void => {
    ctx.step++
    ctx.h = h
    ctx.centre = { x: centre.x, z: centre.z }
    if (keepPositions) {
      for (let i = 0; i < store.n; i++) {
        store.prevX[i] = store.x[i]!
        store.prevZ[i] = store.z[i]!
        store.prevY[i] = store.y[i]!
      }
    }
    blasts.resolve()
  }

  /** The load the field passed to each door in the step; every `attackEvery` seconds it becomes one blow. */
  const hitDoors = (): void => {
    for (let door = 0; door < ctx.doors.list.length; door++) {
      if (doorLoad[door]! <= 0) continue
      doorSince[door]! += ctx.h
      if (doorSince[door]! < ctx.attackEvery) continue
      ctx.doors.hit(door, doorLoad[door]! * options.doorPressureDamage)
      doorLoad[door] = 0
      doorSince[door] = 0
    }
  }

  const growDoorArrays = (): void => {
    if (doorLoad.length >= ctx.doors.list.length) return
    const length = Math.max(64, ctx.doors.list.length * 2)
    doorLoad = Float32Array.from({ length }, (_, door) => doorLoad[door] ?? 0)
    doorSince = Float32Array.from({ length }, (_, door) => doorSince[door] ?? 0)
  }

  const runPressure = (view: ContactView, workspace: PressureWorkspace): void => {
    growDoorArrays()
    const target = ctx.target()
    const player = options.playerPressure.enabled && target && target.state.alive ? { x: target.state.x, z: target.state.z } : undefined
    pressureStep(view, workspace, { ...options.pressure!, h: ctx.h, radius: options.contact!.radius }, { driveForceOfType, doorAt: ctx.doors.at, doorLoad, player }, pressureResult)
    let top = 0
    for (let i = 0; i < store.n; i++) top = Math.max(top, store.field[i]!)
    stats.fieldMax = top
    hitDoors()
  }

  /** The contact and the pressure ran in the worker on the state of the previous step: apply them, hand over this step, and keep the hash for the thrown bodies. */
  const stepOffloaded = (running: Offload, view: ContactView): void => {
    growDoorArrays()
    const target = ctx.target()
    const player = options.playerPressure.enabled && target && target.state.alive ? { x: target.state.x, z: target.state.z } : undefined
    const result = running.step(ctx.h, player)
    pressureResult.playerLoad = result.playerLoad
    prepareHash(view, options.contact!.radius)
    if (pressure) hitDoors()
  }

  const measureLean = (): void => {
    const maxPush = options.contact!.maxPush
    for (let i = 0; i < store.n; i++) {
      store.leanX[i] = store.pushX[i]! / maxPush
      store.leanZ[i] = store.pushZ[i]! / maxPush
    }
  }

  const endStep = (): void => {
    if (!contact) return
    contact.n = store.n
    if (offload) stepOffloaded(offload, contact)
    else {
      contactStep(contact, { ...options.contact!, h: ctx.h }, contactResult)
      stats.contacts = contactResult.contacts
      stats.maxOverlap = contactResult.maxOverlap
      stats.meanOverlap = contactResult.contacts ? contactResult.overlapSum / contactResult.contacts : 0
      if (pressure) runPressure(contact, pressure)
    }
    density?.step()
    measureLean()
    balance?.step(options.balance!, contact.workspace.shove)
    mound?.step()
    thrown?.step(contact, balance!)
    balance?.flush()
    playerPressure?.step(pressureResult.playerLoad)
  }

  const criticalOf = (i: number): number => options.balance!.criticalFactor * store.mass[i]! * GRAVITY_FORCE * (base.typeOf(i).balance?.stability ?? 1) * store.stability[i]!

  return {
    ctx,
    active: contact !== null,
    stats,
    blasts,
    thrown: thrown?.pool ?? createThrownPool(0),
    contact,
    balance,
    beginStep,
    endStep,
    remap: (removed, moved) => {
      thrown?.remap(removed, moved)
      offload?.remap(removed, moved)
    },
    dispose: () => offload?.dispose(),
    densitySlowdown: (i, band) => density?.slowdown(i, band) ?? 1,
    pressureRatio: (i) => (options.balance ? store.pressure[i]! / criticalOf(i) : 0),
  }
}
