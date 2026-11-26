import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as THREE from 'three'
import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { createWorkerCoordinator } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'
import { fleetGroupOf, fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'

import { FLAT_PAD, MAX_HULL_POINTS, vehicleHulls } from '../src'
import { build } from './vehicle-colliders-support'
import { MAX_BEHIND_SHARE, checkHulls } from './vehicle-hulls-check'
import { birthCostOf } from './vehicle-hulls-cost'
import type { HullReport, Side } from './vehicle-hulls-check'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const workers = createWorkerCoordinator({ spawn: nodeSpawn(new URL('./fixtures/hull-worker.mjs', import.meta.url)), workers: 1 })
afterAll(() => workers.dispose())

/** Hulls a vehicle of each class may have (design 10.3, K7): motorcycle, car, SUV and pickup as the design wrote them, van 300 and `heavy` 550 (the owner's decision of 2026-11-26: what the 69 models made, rounded), the others the most the 69 models made (`evidence.md` `## T6.4`, "Método B"), rounded up to the next 50. */
const CEILING: Readonly<Record<string, number>> = {
  motorcycles: 64,
  cars: 256,
  suvs: 256,
  pickups: 256,
  vans: 300,
  heavy: 550,
  agricultural: 150,
  military: 500,
  air: 500,
  water: 450,
}
/** K7, the time to be born (the owner's decision of 2026-11-26): the second car of a model is given its hulls in this many ms, measured only in the cost lane (`pnpm test:cost`: one suite on the machine, load under 4, nothing else running). */
const MAX_SECOND_CAR_MS = 2
/** K7: what is left in a frame by the first car of a model, whose plan is in a worker: its longest call of `hulls()` while the job is made and sent, and the call that installs the plan (ms; the division itself is not counted: it is not in the frame). */
const MAX_FIRST_CAR_MS = 5
const IS_COST_LANE = process.env.HULLS_COST === '1'
/** K4: the balls that meet a hull more than 3 cm before the drawn shell, per model and side, as measured when the method went in; it only goes down (`UPDATE_HULL_EXCESS=1` writes what a run measured when it is lower, and adds a new model). */
const LEDGER = join(process.cwd(), 'tests/fixtures/hull-excess-ledger.json')
/** K3: the same for the balls that meet a hull with no drawn surface near (the exception to §12, design 10.3). */
const FLOATING_LEDGER = join(process.cwd(), 'tests/fixtures/hull-floating-ledger.json')
const SIDES: readonly Side[] = ['above', 'below', 'side']
type Ledger = Record<string, Record<Side, number>>
const readLedger = (file: string): Ledger => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Ledger) : {})
const ledger = readLedger(LEDGER)
const floatingLedger = readLedger(FLOATING_LEDGER)

const reports = new Map<string, HullReport>()
const reportOf = (id: string): HullReport => {
  let report = reports.get(id)
  if (!report) reports.set(id, (report = checkHulls(id, FLAT_PAD * Math.SQRT2, CEILING[fleetGroupOf(id) ?? ''])))
  return report
}

/** The ledger as it is with what this run measured when that is lower, and any model that was not in it. */
const lowered = (file: string, kept: Ledger, measuredOf: (report: HullReport) => Record<Side, number>): void => {
  const next: Ledger = {}
  for (const id of [...fleetVehicleIds].sort()) {
    const report = reports.get(id)
    const before = kept[id]
    if (!report) {
      if (before) next[id] = before
      continue
    }
    const measured = measuredOf(report)
    next[id] = Object.fromEntries(SIDES.map((side) => [side, Math.min(measured[side], before?.[side] ?? measured[side])])) as Record<Side, number>
  }
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
}

afterAll(() => {
  if (process.env.HULLS_REPORT) {
    const rows = [...reports.values()].map((report) => ({ ...report, group: fleetGroupOf(report.id) }))
    writeFileSync(process.env.HULLS_REPORT, `${JSON.stringify(rows)}\n`)
  }
  if (process.env.UPDATE_HULL_EXCESS !== '1') return
  lowered(LEDGER, ledger, (report) => report.ahead)
  lowered(FLOATING_LEDGER, floatingLedger, (report) => report.floatingBySide)
})

describe('the hulls of the whole fleet (design 10.3, K1 to K7)', () => {
  it('every class has a ceiling', () => {
    for (const id of fleetVehicleIds) expect(CEILING[fleetGroupOf(id) ?? '']).toBeGreaterThan(0)
  })

  it.each(fleetVehicleIds)('%s: K2 exact reach, K5 nothing sinks, K6 solid parts whole and wheels out, at most 64 points a hull', (id) => {
    const report = reportOf(id)
    expect(report.hulls).toBeGreaterThan(0)
    expect(report.maxPoints).toBeLessThanOrEqual(MAX_HULL_POINTS)
    expect(report.extremeFailures, report.extremeFailures.slice(0, 6).join('\n')).toEqual([])
    expect(report.behind / Math.max(1, report.drawnBalls)).toBeLessThanOrEqual(MAX_BEHIND_SHARE)
    expect(report.solidFailures, report.solidFailures.join('\n')).toEqual([])
  }, 240000)

  it.each(fleetVehicleIds)('%s: K4 the excess ahead of the drawn shell is not above the ledger, by side', (id) => {
    const report = reportOf(id)
    if (process.env.UPDATE_HULL_EXCESS === '1') return
    const allowed = ledger[id]
    expect(allowed, `${id} is not in the ledger: UPDATE_HULL_EXCESS=1 writes it`).toBeDefined()
    for (const side of SIDES) expect(report.ahead[side], `${id} ${side}: ${JSON.stringify(report.aheadByPart)}`).toBeLessThanOrEqual(allowed![side])
  }, 240000)

  it.each(fleetVehicleIds)('%s: K3 the balls that touch a hull with no drawn shell near are not above the ledger, by side (exception to the rule of zero, design 10.3)', (id) => {
    const report = reportOf(id)
    if (process.env.UPDATE_HULL_EXCESS === '1') return
    const allowed = floatingLedger[id]
    expect(allowed, `${id} is not in the floating ledger: UPDATE_HULL_EXCESS=1 writes it`).toBeDefined()
    for (const side of SIDES) expect(report.floatingBySide[side], `${id} ${side}`).toBeLessThanOrEqual(allowed![side])
  }, 240000)

  it.each(fleetVehicleIds)('%s: K7 no more hulls than its class', (id) => {
    expect(reportOf(id).hulls).toBeLessThanOrEqual(CEILING[fleetGroupOf(id) ?? '']!)
  }, 240000)

  it.skipIf(!IS_COST_LANE).each(fleetVehicleIds)('%s: K7 the second car of the model is given its hulls in at most 2 ms, and the first sends its plan to the worker without waiting (cost lane)', async (id) => {
    const cost = await birthCostOf(id, workers, CEILING[fleetGroupOf(id) ?? '']!)
    if (process.env.HULLS_COST_REPORT) appendFileSync(process.env.HULLS_COST_REPORT, `${JSON.stringify(cost)}\n`)
    expect(cost.secondMs, `${id} second car`).toBeLessThanOrEqual(MAX_SECOND_CAR_MS)
    expect(cost.firstMs, `${id} first car`).toBeLessThanOrEqual(MAX_FIRST_CAR_MS)
    expect(cost.installMs, `${id} the call that installs the plan`).toBeLessThanOrEqual(MAX_FIRST_CAR_MS)
  }, 240000)

  it.each(['family_hatch', 'naked_bike', 'city_bus'])('%s: K1 the shot still meets the drawn shell: building the hulls changes no ray and no vertex', (id) => {
    const { vehicle, frame, dispose } = build(id)
    const root = vehicle.vehicle.vehicle as THREE.Object3D
    const snapshot = (): number[] => {
      const out: number[] = []
      root.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (mesh.isMesh && mesh.geometry?.getAttribute('position')) out.push(mesh.geometry.getAttribute('position').array.length, ...Array.from(mesh.geometry.getAttribute('position').array.slice(0, 30)))
      })
      return out
    }
    const rays = Array.from({ length: 160 }, (_, i) => {
      const a = (i / 160) * Math.PI * 8, b = ((i * 37) % 160) / 160 - 0.5
      return { origin: [Math.cos(a) * 6, 1 + b * 3, Math.sin(a) * 6] as [number, number, number], direction: [-Math.cos(a), -b * 0.4, -Math.sin(a)] as [number, number, number], maxDistance: 20 }
    })
    const shoot = (): Array<string | null> => rays.map((ray) => {
      const hit = vehicle.surfaceRay?.(ray)
      return hit ? `${hit.part}@${hit.distance.toFixed(6)}` : null
    })
    const before = shoot()
    const vertices = snapshot()
    expect(before.some((hit) => hit !== null)).toBe(true)
    vehicleHulls(THREE, vehicle, frame)
    expect(shoot()).toEqual(before)
    expect(snapshot()).toEqual(vertices)
    dispose()
  }, 240000)
})
