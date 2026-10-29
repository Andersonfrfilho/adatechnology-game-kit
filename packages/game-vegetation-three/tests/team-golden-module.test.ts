// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import * as GameVegetationMain from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'

import { VEGETATION_ITEM_IDS, VEGETATION_SCENARIO_IDS, createVegetationTestModule } from '../src'

/**
 * G-veg-module: the Viveiro artifact's own module (`vegetation-module.js`, the global `VegetationTestModule`) runs against the SDK in a test room, and so does the TypeScript port. The 18 specs
 * (parts, joints, shapes, tags) and the 18 sway clips must be equal, and each of the 13 scenarios must give the same checks (pass or fail and the sentence) and the same count of every log line.
 */
vi.setConfig({ testTimeout: 900_000 })
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html'), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string)
const pageCode = scripts.find((s) => s.startsWith('/* vegetacao/sala/vegetation-module.js')) as string
const sdk = { ...GameVegetationMain, ...GameVegetationAdapter }

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}
const makeRoom = (): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
}

/** The artifact's module, evaluated as the page does: a classic script that sets a global. */
const pageModule = (): any => {
  const fakeWindow: any = {}
  new Function('window', pageCode)(fakeWindow)
  return fakeWindow.VegetationTestModule.create({ GameVegetation: sdk, GameVegetationSpecies })
}
const myModule = () => createVegetationTestModule({ locale: 'en', GameVegetation: sdk as never, GameVegetationSpecies: GameVegetationSpecies as never })

const plain = (value: unknown): unknown => (value === undefined ? null : JSON.parse(JSON.stringify(value)))

const summary = async (room: TestRoom, id: string): Promise<{ checks: { label: string; ok: boolean }[]; lines: Record<string, number> }> => {
  const before = room.log.entries().length
  const scenario = room.scenarios.find((s) => s.id === id)
  if (!scenario) throw new Error(`no scenario ${id}`)
  const report = await room.runScenarios([scenario])
  const lines: Record<string, number> = {}
  for (const entry of room.log.entries().slice(before)) {
    if (entry.channel === 'check') continue
    const key = `${entry.channel}:${entry.type}`
    lines[key] = (lines[key] ?? 0) + 1
  }
  return { checks: report.results[0]!.checks, lines }
}

describe('team golden: the module of the Viveiro artifact against the TypeScript module', () => {
  const page = makeRoom()
  const mine = makeRoom()
  // the artifact was written for a room whose weapons fire the moment they are taken; the room of the kit has a draw time, so the page's `setTool` waits for it
  const pageSetTool = page.setTool.bind(page)
  page.setTool = (id: string): void => {
    pageSetTool(id)
    page.waitUntilReady()
  }
  page.loadModule(pageModule())
  mine.loadModule(myModule() as never)

  it('has the same 18 items, with the same names, in both languages', () => {
    expect(VEGETATION_ITEM_IDS).toHaveLength(18)
    for (const locale of ['en', 'pt-BR']) {
      const want = pageModule().items(locale).map((item: { id: string; name: string; movable: boolean }) => [item.id, item.name, item.movable])
      const got = myModule().items(locale).map((item) => [item.id, item.name, item.movable])
      expect(got).toEqual(want)
    }
  })

  it.each([...VEGETATION_ITEM_IDS])('%s has the same pieces, joints, shapes and sway clip', (id) => {
    const want = pageModule().items('en').find((item: { id: string }) => item.id === id)
    const got = myModule().items('en').find((item) => item.id === id)!
    const wantRoot = want.build(THREE)
    const gotRoot = got.build(THREE) as { children: { name: string; position: unknown }[] }
    // the same meshes, in the same order, at the same places
    expect(gotRoot.children.map((c) => c.name)).toEqual(wantRoot.children.map((c: { name: string }) => c.name))
    expect(plain(gotRoot.children.map((c) => c.position))).toEqual(plain(wantRoot.children.map((c: { position: unknown }) => c.position)))
    const wantSpec = want.spec(wantRoot)
    const gotSpec = (got.spec as (root: unknown) => unknown)(gotRoot)
    expect(plain(gotSpec)).toEqual(plain(wantSpec))
    expect(plain(got.animations)).toEqual(plain(want.animations))
    expect((wantSpec as { parts: unknown[] }).parts.length).toBeGreaterThan(0)
  })

  it.each(VEGETATION_SCENARIO_IDS.map((id) => [id]))('%s gives the same checks and the same log lines', async (id) => {
    const want = await summary(page, id)
    const got = await summary(mine, id)
    expect(want.checks.length).toBeGreaterThan(0)
    expect(want.checks.filter((check) => !check.ok), 'the artifact fails its own check on this room').toEqual([])
    expect(Object.keys(want.lines).length).toBeGreaterThan(id === 'veg_walk_on_grass' ? 0 : 2)
    expect(got.checks).toEqual(want.checks)
    expect(got.lines).toEqual(want.lines)
  })
})
