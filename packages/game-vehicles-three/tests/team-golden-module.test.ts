import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import * as GameVehicles from '@adatechnology/game-vehicles'
import * as GameVehiclesFleet from '@adatechnology/game-vehicles-fleet'

import { PAGE_SCENARIO_ALIASES, createVehiclesTestModule } from '../src'
import { fakeDocument } from './fake-dom'

/**
 * G-veh-module: the Frota test page's own module (`MODULO_VEICULOS`, sala-veiculos.js 43114-43407) runs against the SDK in a test room, and so does the TypeScript port;
 * each of the 11 scenarios must give the same checks (pass or fail and the sentence) and the same count of every log line.
 */
vi.setConfig({ testTimeout: 900_000 })
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/sources/veiculos__sala-de-testes__sala-veiculos.js'), 'utf8')
const start = source.indexOf('// Módulo "veiculos" para a sala de testes')
const end = source.indexOf("})(typeof window !== 'undefined' ? window : globalThis)", start)
const pageModuleCode = source.slice(start, end + "})(typeof window !== 'undefined' ? window : globalThis)".length)

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}
const makeRoom = (): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, debris: { eventBudgetMs: Infinity } })
}

/** The page's module, evaluated as the page does: a classic script that finds the three globals on `window` (the kit gets the fake document the Node run needs). */
const pageModule = (): any => {
  const fakeWindow: any = {
    THREE,
    GameVehicles: { ...GameVehicles, createVehicleKit: (options: Record<string, unknown>) => GameVehicles.createVehicleKit({ ...options, document: fakeDocument } as never) },
    GameVehiclesFleet,
  }
  new Function('window', pageModuleCode)(fakeWindow)
  return fakeWindow.MODULO_VEICULOS
}

const summary = async (room: TestRoom, id: string): Promise<{ checks: { label: string; ok: boolean }[]; lines: Record<string, number> }> => {
  const before = room.log.entries().length
  const scenario = room.scenarios.find((s) => s.id === id)
  if (!scenario) throw new Error(`no scenario ${id}`)
  const report = await room.runScenarios([scenario])
  const lines: Record<string, number> = {}
  for (const entry of room.log.entries().slice(before)) {
    if (entry.channel === 'check') continue
    // the object ids carry the item id, which the port spells in English; only the type of line counts
    const key = `${entry.channel}:${entry.type}`
    lines[key] = (lines[key] ?? 0) + 1
  }
  return { checks: report.results[0]!.checks, lines }
}

describe('team golden: the page module of the Frota test against the TypeScript module', () => {
  const page = makeRoom()
  const mine = makeRoom()
  // the page was written for a room whose tools fire the moment they are taken; the room of the kit has a draw time, so the page's `setTool` waits for it (the port says so in its scenarios)
  const pageSetTool = page.setTool.bind(page)
  page.setTool = (id: string): void => {
    pageSetTool(id)
    page.waitUntilReady()
  }
  page.loadModule(pageModule())
  mine.loadModule(createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, wrecks: [] }) as never)

  it('loads the same eight vehicles with the page names', () => {
    const pageItems = pageModule().items('en').map((item: { name: string }) => item.name)
    const myItems = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, wrecks: [] }).items('en').map((item) => item.name)
    expect(myItems).toEqual(pageItems)
  })

  it.each(Object.entries(PAGE_SCENARIO_ALIASES))('%s and %s give the same checks and the same log lines', async (pageId, myId) => {
    const want = await summary(page, pageId)
    const got = await summary(mine, myId)
    // the page's own checks all pass on the SDK room, so equal means equal passes
    expect(want.checks.length).toBeGreaterThan(0)
    expect(want.checks.filter((check) => !check.ok)).toEqual([])
    expect(Object.keys(want.lines).length).toBeGreaterThan(2)
    expect(got.checks).toEqual(want.checks)
    expect(got.lines).toEqual(want.lines)
  })
})
