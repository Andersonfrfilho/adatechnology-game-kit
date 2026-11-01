import { createCellOf } from '../../grid'
import { contactStep, createContactWorkspace } from '../contact'
import type { ContactParams, ContactResult, ContactView, PhysicsGrid, PhysicsStore } from '../contact'
import type { CrowdContactOptions, CrowdPressureOptions } from '../options'
import { createPressureWorkspace, pressureStep } from '../pressure'
import type { PressureResult, PressureWorkspace } from '../pressure'
import { HEADER } from './frame'
import type { PhysicsFrame } from './frame'

const PAIRS_PER_AGENT = 12

/** What the kernel needs once, to be built (it travels to the worker as a message). */
export type KernelSetup = {
  readonly capacity: number
  readonly gridSize: number
  readonly gridCell: number
  readonly contact: Required<CrowdContactOptions>
  readonly pressure: Required<CrowdPressureOptions> | null
  readonly driveForceOfType: readonly number[]
}

export type PhysicsKernel = {
  /** The contact and the pressure over the arrays of the frame, the deltas and the fields written back into it. The same call runs on the main thread and in a worker. */
  run(frame: PhysicsFrame): void
}

const STORE_KEYS = ['x', 'z', 'y', 'vx', 'vz', 'pushX', 'pushZ', 'mass', 'build', 'aimX', 'aimZ', 'driveFactor', 'fieldPrev'] as const

/** The step as a pure function of one frame: no read of anything outside it, so a worker that gets the same bytes writes the same bytes. */
export function createKernel(setup: KernelSetup): PhysicsKernel {
  const { capacity } = setup
  const side = Math.floor(setup.gridSize / setup.gridCell)
  const half = setup.gridSize / 2
  const before = { x: new Float32Array(capacity), z: new Float32Array(capacity), pushX: new Float32Array(capacity), pushZ: new Float32Array(capacity), vx: new Float32Array(capacity), vz: new Float32Array(capacity) }
  const driveForceOfType = Float32Array.from(setup.driveForceOfType)
  const contactResult: ContactResult = { contacts: 0, maxOverlap: 0, overlapSum: 0 }
  const pressureResult: PressureResult = { playerLoad: 0, drivers: 0 }
  const workspace: PressureWorkspace | null = setup.pressure ? createPressureWorkspace(capacity, capacity * PAIRS_PER_AGENT) : null
  const cellOf = createCellOf(half, setup.gridCell, side)
  const doorLoadUnused = new Float32Array(0)
  // one store and one grid for the life of the kernel (the contact workspace is big): a new frame only points their arrays at its own bytes
  const store: Record<string, unknown> = {}
  const grid: { size: number; half: number; occ: Uint8Array<ArrayBufferLike>; cellOf: typeof cellOf } = { size: setup.gridSize, half, occ: new Uint8Array(0), cellOf }
  const view: ContactView = { n: 0, store: store as PhysicsStore, grid: grid as unknown as PhysicsGrid, workspace: createContactWorkspace(capacity, grid as unknown as PhysicsGrid) }

  const bind = (frame: PhysicsFrame): ContactView => {
    Object.assign(store, frame.u8, { identity: frame.identity, field: frame.f32.field })
    for (const key of STORE_KEYS) store[key] = frame.f32[key]
    grid.occ = frame.occ
    return view
  }

  const run = (frame: PhysicsFrame): void => {
    const { header } = frame
    const n = header[HEADER.n]!
    const contact = bind(frame)
    contact.n = n
    for (let i = 0; i < n; i++) {
      before.x[i] = frame.f32.x[i]!
      before.z[i] = frame.f32.z[i]!
      before.pushX[i] = frame.f32.pushX[i]!
      before.pushZ[i] = frame.f32.pushZ[i]!
      before.vx[i] = frame.f32.vx[i]!
      before.vz[i] = frame.f32.vz[i]!
    }
    const h = header[HEADER.h]!
    const params: ContactParams = { ...setup.contact, h }
    contactStep(contact, params, contactResult)
    header[HEADER.contacts] = contactResult.contacts
    header[HEADER.maxOverlap] = contactResult.maxOverlap
    header[HEADER.overlapSum] = contactResult.overlapSum
    frame.doorCell.fill(-1, 0, n)
    frame.f32.doorLoad.fill(0, 0, n)
    if (workspace && setup.pressure) {
      const player = header[HEADER.playerOn] ? { x: header[HEADER.playerX]!, z: header[HEADER.playerZ]! } : undefined
      const doorOut = { cell: frame.doorCell, load: frame.f32.doorLoad }
      pressureStep(contact, workspace, { ...setup.pressure, h, radius: setup.contact.radius }, { driveForceOfType, doorAt: (cell) => cell, doorLoad: doorLoadUnused, player, doorOut }, pressureResult)
      let top = 0
      for (let i = 0; i < n; i++) top = Math.max(top, frame.f32.field[i]!)
      header[HEADER.fieldMax] = top
    } else header[HEADER.fieldMax] = 0
    header[HEADER.playerLoad] = pressureResult.playerLoad
    header[HEADER.drivers] = pressureResult.drivers
    const { f32 } = frame
    for (let i = 0; i < n; i++) {
      f32.deltaX[i] = f32.x[i]! - before.x[i]!
      f32.deltaZ[i] = f32.z[i]! - before.z[i]!
      f32.deltaPushX[i] = f32.pushX[i]! - before.pushX[i]!
      f32.deltaPushZ[i] = f32.pushZ[i]! - before.pushZ[i]!
      f32.deltaVx[i] = f32.vx[i]! - before.vx[i]!
      f32.deltaVz[i] = f32.vz[i]! - before.vz[i]!
      f32.shove[i] = contact.workspace.shove[i]!
    }
  }

  return { run }
}
